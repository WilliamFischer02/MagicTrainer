---
description: Log or present project-direction questions for William in one batch instead of interrupting work. Use whenever a decision needs the owner, and at session end to present the OPEN block.
allowed-tools: Read, Edit, Write
---
## Logging (during work)
Append to `docs/QUESTIONS_FOR_WILLIAM.md` under OPEN, grouped by topic (Product / Visual identity / Data & scope / Engineering):
`- **Q-### · Title.** Context in 1–2 sentences. Options: A) … B) … **Provisional: X** because …`
Then continue working on the provisional choice. Mark code with `// Q-###`.

## Presenting (session end or ≥5 open or a phase blocker)
Output one message titled "Questions for William (N open)" with:
- TL;DR: "Reply `accept all` to confirm the provisional answers, or override by ID (e.g. `Q-003: B`)."
- Each question: ID, one-line ask, options, provisional + one-line reason. Group by topic. No more than ~15 lines per group.
- After William answers: move items to RESOLVED with the date, update `// Q-###` markers, and add a DECISIONS entry if architectural.
