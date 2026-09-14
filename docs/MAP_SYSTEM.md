# Map System

The world map is a **curved snake path** of 500 level nodes, Level 1 at the bottom, climbing upward.
It is implemented as **append-only DOM nodes** inside `Game.js`, virtualized natively by the browser.

---

## 1. Layout

- **Bottom-anchored snake:** Level 1 sits at the bottom; higher levels rise upward. The player scrolls
  **up** to reach higher levels.
- **Geometry constants:** `MAP_ROW = 92` (vertical spacing), `MAP_PAD = 84`, `MAP_AMP = 70` (snake
  amplitude), `MAP_NODE = 64` (node size).
  - `bottom(n) = MAP_PAD + (n−1)·MAP_ROW` — each level sits one ROW higher; **bottom-anchored** so
    appending higher levels never repositions existing ones.
  - `snakeX(n) = sin(n·0.5)·MAP_AMP` — a smooth wave that curves left/right roughly every ~6 levels.
- **Connector dots** link consecutive nodes; **decorations** (coral, plants, rocks, chests, crystals,
  bubbles) are placed beside the path (never overlapping nodes).

## 2. Node states

Each node reflects the save:
- **Locked** (grey, not clickable) — beyond `unlocked`.
- **Unlocked / current** — the highest unlocked level **glows** (`current`).
- **Completed** — shows earned **stars** (★ filled / ☆ empty).
- **Milestone** (every 20th) — gets a star badge accent.
Tapping an unlocked node plays a click, presses the node, and starts that level.

## 3. Append-only, virtualized rendering

- Loaded levels are **real DOM buttons** that are **appended and never recreated** ("append-only").
- The browser **virtualizes** off-screen nodes via CSS **`content-visibility`**, so even hundreds of
  nodes stay cheap and buttons are always present (no windowing bugs).
- This replaced an earlier windowed-virtualization approach that could render zero buttons; the
  append-only + `content-visibility` model is the robust source of truth. **Do not** reintroduce
  recycling/windowing of level nodes.

## 4. Infinite loading

- **Initial:** the first **50** levels are built.
- **On scroll near the top:** the next **20** levels are appended (`50 → 70 → 90 → …`) with a **tiny
  top spinner**, and the track grows upward while `scrollTop` is shifted by the exact growth delta, so
  **the view never jumps** and no previously-loaded level is recreated.
- Loading continues up to **500** (`LevelDatabase.COUNT`).

## 5. Always focus the current level

- Every time the map opens it **centres on the current playable level** = `clamp(currentLevel, 1,
  unlocked)`, **ignoring any prior manual scroll**, and scrolls there **smoothly** (~0.5 s
  `easeOutCubic`). This is headless-safe (sets the final scroll immediately, then eases in the browser).
- The focused level is saved as `mapCenter`; loaded batch count is saved as `mapLoaded` — both restored
  on reopen. See [SAVE_SYSTEM.md](SAVE_SYSTEM.md).

## 6. Return-from-gameplay behaviour

- Winning/exiting returns to the map, which re-focuses on the new current level (after a win the current
  level advances). The bar/animation for the map is separate from gameplay and always subtle.

## 7. Layout robustness note

- Because level nodes are absolutely positioned, the scroll container is forced to **full width**
  (`#mapScreen { align-items: stretch }` + `.map-scroll { align-self: stretch; width: 100% }`). Without
  this the container collapsed to zero width and the buttons rendered off-screen. **Keep this.**

## 8. Performance

- `content-visibility` virtualization + append-only nodes + simple absolute positioning keep the map at
  **60 FPS** even when scrolled deep. No per-frame JS runs the map; it's static DOM + CSS.

## 9. Guardrails

- Do **not** change to Level-1-at-top, windowed recycling, or non-append node creation.
- Do **not** break the no-jump growth (`scrollTop += delta`) or the always-focus-current behaviour.
- Preserve the width-stretch fix and the decorations-never-overlap rule.

Cross-references: [PROGRESSION_SYSTEM.md](PROGRESSION_SYSTEM.md), [SAVE_SYSTEM.md](SAVE_SYSTEM.md),
[UI_UX_GUIDE.md](UI_UX_GUIDE.md).
