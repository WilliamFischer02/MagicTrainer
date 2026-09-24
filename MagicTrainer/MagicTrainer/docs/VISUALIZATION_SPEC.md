# Visualization Spec — the board

Visual grammar: `knowledge/mtg-strategy/zone-trajectory-signatures.md`. This is the implementation spec.

## Layout (1440×900 baseline, responsive)
```
┌──────────────────────────────────────────────────────────────┐
│ Opponent strip: library · hand(count) · battlefield · graveyard · exile · life │
├──────────────────────────────────────────────────────────────┤
│                     BATTLEFIELD (you)                         │
│   lands row │ creatures row │ noncreature permanents row      │
│  ┌stack┐                                                      │
├──────────────────────────────────────────────────────────────┤
│ command │ library │ hand (fanned) │ graveyard │ exile │ HUD   │
├──────────────────────────────────────────────────────────────┤
│ ◄ ▌▌ ►  timeline: T1 ─ T2 ─ T3 …  (phase ticks)   speed  step panel │
└──────────────────────────────────────────────────────────────┘
```
- Zones are labeled with the CR term and rule number on hover (e.g. "Graveyard — CR 404").
- Cards are sprites (art crop, 2× DPI textures); hover → full card + oracle text panel.

## Animation primitives
- `moveCard(card, fromZone, toZone, style)` — bezier path, 350–600 ms, easing per action (cast = quick, reanimate = slow glow).
- `pulse(node, kind)` — ring + label ("Blood Artist: each opponent loses 1").
- `arrowTrail` persists for the current step then fades; a "ghost" trail shows the last N steps.
- Damage/life: HUD number tick with ±delta.
- Timeline: steps grouped by (turn, phase); the scrubber snaps to steps; keyboard ← → space.

## Step panel
Title (action), cards involved, cost ledger (mana, cards), consequence, **why** (CR citation link → rules viewer), **break point** (interaction that stops this; what to do instead).

## Accessibility & motion
`prefers-reduced-motion` → instant moves + highlighted trails; all HUD text ≥ 12 px with 4.5:1 contrast; every control keyboard-reachable.

## Rendering decision
Phase 1 spike compares PixiJS 8 (canvas) vs SVG + Framer Motion. Acceptance: 150 sprites + 40 arrows at 60 fps on a mid-range laptop at 1440×900, crisp at DPR 2. Record in DECISIONS.md D-006.
