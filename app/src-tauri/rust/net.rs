//! Shared HTTP plumbing: one descriptive User-Agent, one agent factory, and a blocking
//! rate limiter so every outbound path (bulk downloads, images, Spellbook) obeys the
//! published limits — Scryfall ≤ 10 req/s (`knowledge/mtg-data-apis/scryfall/api_rate-limits.md`),
//! Commander Spellbook ≤ 80 req/min (`knowledge/mtg-data-apis/commander-spellbook/spellbook_api.md`).

use std::sync::Mutex;
use std::time::{Duration, Instant};

pub const USER_AGENT: &str = "MagicTrainer/0.1 (github.com/WilliamFischer02/MagicTrainer)";

pub fn agent() -> ureq::Agent {
    agent_with_timeout(Duration::from_secs(60 * 30))
}

pub fn agent_with_timeout(timeout: Duration) -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_global(Some(timeout))
        .user_agent(USER_AGENT)
        // We inspect 4xx/5xx ourselves (429 handling, negative caching).
        .http_status_as_error(false)
        .build()
        .into()
}

/// Minimum-gap rate limiter shared by concurrent callers. `acquire()` blocks the calling
/// thread until the next slot; slots are handed out in FIFO order of lock acquisition.
#[derive(Debug)]
pub struct RateLimiter {
    min_gap: Duration,
    next_at: Mutex<Instant>,
}

impl RateLimiter {
    pub fn new(min_gap: Duration) -> Self {
        Self { min_gap, next_at: Mutex::new(Instant::now()) }
    }

    /// `n` requests per second.
    pub fn per_second(n: u32) -> Self {
        Self::new(Duration::from_millis(1000 / u64::from(n.max(1))))
    }

    /// `n` requests per minute.
    pub fn per_minute(n: u32) -> Self {
        Self::new(Duration::from_millis(60_000 / u64::from(n.max(1))))
    }

    /// Reserve the next slot and sleep until it arrives.
    pub fn acquire(&self) {
        let wait = {
            let mut next = self.next_at.lock().expect("rate limiter mutex");
            let now = Instant::now();
            let slot = if *next > now { *next } else { now };
            *next = slot + self.min_gap;
            slot.saturating_duration_since(now)
        };
        if !wait.is_zero() {
            std::thread::sleep(wait);
        }
    }

    /// Push the next slot out (e.g. after a 429 with `Retry-After`).
    pub fn back_off(&self, for_: Duration) {
        let mut next = self.next_at.lock().expect("rate limiter mutex");
        let until = Instant::now() + for_;
        if until > *next {
            *next = until;
        }
    }
}

/// Seconds from a `Retry-After` header (delta-seconds form only; HTTP-dates are rare here).
pub fn retry_after_secs(value: Option<&str>) -> Option<u64> {
    value?.trim().parse::<u64>().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn limiter_spaces_calls() {
        let rl = RateLimiter::new(Duration::from_millis(20));
        let t0 = Instant::now();
        for _ in 0..4 {
            rl.acquire();
        }
        // 4 slots: 0, 20, 40, 60 ms → at least 60 ms elapsed.
        assert!(t0.elapsed() >= Duration::from_millis(60), "elapsed {:?}", t0.elapsed());
    }

    #[test]
    fn limiter_is_thread_safe_and_fifo_ish() {
        let rl = std::sync::Arc::new(RateLimiter::new(Duration::from_millis(10)));
        let t0 = Instant::now();
        let handles: Vec<_> = (0..5)
            .map(|_| {
                let rl = rl.clone();
                std::thread::spawn(move || rl.acquire())
            })
            .collect();
        for h in handles {
            h.join().unwrap();
        }
        assert!(t0.elapsed() >= Duration::from_millis(40));
    }

    #[test]
    fn back_off_delays_next_slot() {
        let rl = RateLimiter::new(Duration::from_millis(1));
        rl.back_off(Duration::from_millis(30));
        let t0 = Instant::now();
        rl.acquire();
        assert!(t0.elapsed() >= Duration::from_millis(25));
    }

    #[test]
    fn retry_after_parses_seconds() {
        assert_eq!(retry_after_secs(Some("30")), Some(30));
        assert_eq!(retry_after_secs(Some(" 5 ")), Some(5));
        assert_eq!(retry_after_secs(Some("Wed, 21 Oct 2015 07:28:00 GMT")), None);
        assert_eq!(retry_after_secs(None), None);
    }
}
