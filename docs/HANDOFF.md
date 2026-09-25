# Session Handoff

The agent rewrites this file at the end of every session (and every ~2 hours of unattended work).
It is the first thing the next session reads after CLAUDE.md.

## Last session
- **Date:** 2026-09-25 · **By:** Claude (Fable 5.1, Claude Code) · **Duration:** ~1.5 h unattended (Phase 4)
- **State:** **Phases 1–4 done; v1.0.0 built and tagged** (unsigned MSI + NSIS under `app/src-tauri/target/release/bundle/`).
  `main` is green: 195 Vitest, 32 cargo tests, `tsc`, `eslint` (0 violations of the dependency-direction rule), `cargo clippy`,
  and 6 Playwright E2E tests that drive the **built** app over WebView2's DevTools port (incl. a 2× DPI capture).
- **Bottom line:** first-run onboarding downloads Scryfall (live size shown, 109 MB), an offline banner and stale-cache fallbacks keep
  the app usable without a connection, a production CSP is in place, errors go to a local log, and the README has screenshots.

## Next 3 actions (in order)
1. **Ship it to William:** copy `MagicTrainer_1.0.0_x64_en-US.msi` (or the NSIS setup) to him with the SmartScreen note (unsigned, Q-010).
   First launch on a clean PC exercises the onboarding download — the one path the dev box could not test end to end (it already had data).
2. **v1.1 backlog (from the review passes):** step-panel "consequence" line; mana-value-aware turn placement in templates; templates for
   go-wide-tokens / voltron / storm; collection list view + tag filter; real card-back asset; decision-point branching (Q-003).
3. **Ops:** re-measure the board on integrated graphics (D-006 caveat); trim the dev DB (900 MB with Spellbook bulk — first-run DB is ~190 MB);
   refresh the CR pack (`scripts/refresh-rules.ps1`, text is 98 days old); consider a code-signing cert → then the Tauri updater (D-019).

## Open risks / unknowns
- **Onboarding download untested on a machine without data** (dev box always had `data/`). The same importer runs from Settings and was
  tested there; the onboarding screen itself was verified with `?onboarding=1`.
- **Templates are schematic; tracks are static** (D-018). Damage = printed power only.
- **HiDPI:** verified only via CDP emulation (DPR 2) in the E2E run, not on a physical HiDPI display.
- **Perf** numbers are from an RTX 5070 desktop. **CR text** is 98 days old.

## How to verify things unattended (worked this session)
- **Everything at once:** `cd app && npm test && npm run typecheck && npm run lint && (cd src-tauri && cargo test && cargo clippy --all-targets)`.
- **Built-app E2E:** `npm run tauri build` then `npx playwright test` (spawns `target/release/magictrainer.exe` with
  `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`, connects over CDP; screenshots land in `app/e2e/shots/`).
  Env: `MT_EXE`, `MT_DATA` (defaults: release exe, repo `data/`). Needs the seeded sample decks (`/diag.html?seed=…`).
- **Dev app:** `MAGICTRAINER_DATA_DIR=C:\dev\MagicTrainer\data npm run tauri dev`; screens via `?route=…&mode=…&deck=…&view=graph&pos=…&autoplay=1&onboarding=1|skip`.
- **Screenshot without focus:** `powershell -File scripts/screenshot-window.ps1 -Out shot.png`.
- **Diagnostics page:** `/diag.html?collector=…&autoclose=1` (image protocol, Spellbook, deck IPC); `?seed=`, `?seedCollection=`.
- **Tool gotchas:** long Bash heredocs get mangled → Write patch scripts to the scratchpad; Python non-raw `\b`/`\.` warnings → raw strings;
  Python text writes emit CRLF (`newline=""`); `grep -c` exits 1 on zero matches; Playwright `selectOption` takes a value string, not a label regex;
  E2E spec is ESM (`import.meta.url` for `__dirname`).

## Where things are
- Rust: `app/src-tauri/rust/` — `applog.rs` (new), `collection.rs`, `decks.rs`, `images.rs`, `spellbook_api.rs`, `net.rs`, `db.rs`, `import/`, `rules.rs`, `commands.rs`
- UI: `app/src/ui/` — `screens/OnboardingScreen.tsx` (new), `hooks/useBulkImport.ts` (new: import state machine + `useOnline`), `store.ts` (`usePrefs`)
- Quality: `app/eslint.config.js` (dependency direction), `app/playwright.config.ts` + `app/e2e/app.spec.ts`
- Config: `app/src-tauri/tauri.conf.json` (`csp` + `devCsp`, version 1.0.0), `app/vite.config.ts` (`__APP_VERSION__`, `server.fs.allow`)
- Docs: `README.md` + `docs/screenshots/`; Decisions D-012…D-019; ROADMAP Phases 1–4 ticked; QUESTIONS OPEN block empty
