---
paths: app/src/core/**
---
# Core module rules
- No imports from `react`, `@tauri-apps/*`, `pixi.js`, or DOM globals (`window`, `document`). Use `globalThis` guards only.
- Every exported function has a unit test in `app/src/core/__tests__/`.
- Parsers never throw on bad input; they return `{ errors[] }`.
- Detection output must include `rationale` and `roles`.
