---
paths: app/src/ui/**, app/src/board/**
---
# UI / board rules
- Follow `docs/UI_UX_GUIDELINES.md` and `docs/VISUALIZATION_SPEC.md`.
- Design tokens only (no ad-hoc hex values in components).
- Every screen ships with empty / loading / error / success states.
- Card art: keep 63:88 ratio, render at devicePixelRatio, never upscale beyond source.
- Honor `prefers-reduced-motion`. Keyboard-reachable controls. Contrast ≥ 4.5:1.
- Run `/ui-quality-gate` before marking a UI task done.
