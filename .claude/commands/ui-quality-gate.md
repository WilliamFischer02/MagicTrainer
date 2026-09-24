---
description: Run the commercial-quality checklist on a screen or board feature before calling it done. Use after implementing any UI/board work.
allowed-tools: Read, Glob, Grep, Bash(npm run *)
---
Checklist (all must pass; record results in the commit message body):
- [ ] Tokens only — grep the changed files for raw hex/px magic numbers.
- [ ] States: empty, loading (with progress text if > 300 ms), error (actionable), success.
- [ ] Keyboard: every control reachable and operable; focus visible.
- [ ] Motion: ≤ 600 ms, eased; reduced-motion path exists.
- [ ] Imagery: card art 63:88, DPR-aware, never upscaled/blurred.
- [ ] Copy: precise MTG vocabulary; rules citations link to the rules viewer.
- [ ] Perf: board ≤ 16 ms/frame in the spike harness; no layout thrash in React panels.
- [ ] Screenshot review at 1× and 2× (use the `ui-reviewer` subagent for a second opinion).
