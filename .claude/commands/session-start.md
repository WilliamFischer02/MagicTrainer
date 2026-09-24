---
description: Orient at the start of a MagicTrainer work session. Use when a session begins, after /clear or compaction, or when asked "where were we".
allowed-tools: Read, Glob, Grep, Bash(git log *), Bash(git status*), Bash(npm test*)
---
1. Read `docs/HANDOFF.md`, `docs/ROADMAP.md`, `docs/QUESTIONS_FOR_WILLIAM.md` (OPEN block), and the last 10 commits (`git log --oneline -10`).
2. Run `cd app && npm test` to confirm the baseline is green. If red, fixing it is task #1.
3. State in ≤ 8 lines: current phase, next 3 actions, provisional decisions in force, any risk.
4. Do not ask William anything. Begin action #1.
