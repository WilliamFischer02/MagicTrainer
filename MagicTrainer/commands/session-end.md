---
description: Close out a work session — commit, update HANDOFF/ROADMAP/DECISIONS, and present batched questions. Use before ending, every ~2 hours of unattended work, or when context is about to compact.
allowed-tools: Read, Edit, Write, Bash(git *), Bash(npm test*), Bash(npm run typecheck*)
---
1. `npm test` and `npm run typecheck` must pass; if not, fix or revert to green.
2. Commit all work with Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`), scoped (`feat(core): …`).
3. Rewrite `docs/HANDOFF.md`: date, state, next 3 actions, risks, where things are.
4. Tick completed items in `docs/ROADMAP.md`; add new items discovered.
5. Append any architectural choice to `docs/DECISIONS.md` (D-### format).
6. Run `/batch-questions` to present the OPEN questions block.
7. Final commit: `docs: session handoff YYYY-MM-DD`.
