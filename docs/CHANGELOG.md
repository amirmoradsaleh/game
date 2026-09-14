# Changelog

Milestones and implemented features for Bubble Quest Legends. This is a **feature/behaviour** log
(the game is a single deterministic build; there is no semantic version yet — treat the current
`dist/index.html` as the latest). Newest first.

---

## Documentation
- **Docs package added** — a complete `docs/` folder (this set) as the permanent source of truth,
  including `PROJECT_MEMORY.md` for fast onboarding and `CLAUDE_RULES.md` for permanent rules.

## Aim/collision refinement
- **Aim guide touches the wall (visual)** — the drawn guide reflects exactly AT the wall. The guide is
  a piecewise-straight polyline through the launcher, each wall-CONTACT point (where the ball's edge
  meets the wall) and the true landing. The ball's centre still bounces a radius from the wall
  (`previewPath` unchanged), but moving the drawn reflection vertex to the contact point bends the long
  straight legs by only ~2-3 degrees (imperceptible) while closing the gap completely — no spur, no
  poke. The final point stays the exact collision, so the guide and ball meet at both the wall and the
  landing cell (bank-shot prediction test still passes).
- **Bank-shot prediction 100%% reliable** — the aim line's renderer now reflects off the walls at the
  exact same centre bounds (`minLeft/maxRight`) as the real bubble (it calls `previewPath()` with the
  default bounds instead of edge bounds). After every wall bounce — including multiple bounces and
  shallow angles — the predicted collision point is identical to the real one (0 divergences over
  3,300+ bank shots, 990+ multi-bounce). Only that one reflection reference changed; dots, glow, fade,
  colour, gap assist and flight are untouched. Consequence: the line reflects at the true bounce point
  (a bubble-radius from the frame, where the bubble actually bounces) rather than kissing the frame edge.
- **Flight gap tolerance** — the real moving bubble now gets a hair more grazing tolerance than the
  aim guide (`GAP_ASSIST_FLIGHT` ≈ 3.4 px vs 1.9 px, ~3.5% of a bubble), so a gap the aim line shows
  as passable is always cleared by the bubble. The aim line (rendering, length, reflections,
  algorithm) is completely unchanged; the base hitbox, spacing, snapping, matching, wall reflections
  and level layouts are unchanged; solids/walls stay impassable. Imperceptible in general play
  (0% landing change in random sampling); only borderline narrow-gap grazes benefit.

## Top bar & progress bar
- **Compact top bar** — the Level chip and the star-progress bar were shrunk and aligned on one row;
  the progress bar sits **centred between the Level chip and the pause button** with a brighter track.
- **Live star-progress bar** — a multi-factor performance meter (45% bubbles / 25% shots / 20% combo /
  10% score, +6% bonus rescue) with **adaptive thresholds** (generous early, demanding late), forward-
  only ease-out fill, animated shine, and **one-by-one star reveals** with rising-pitch sounds. Drives
  the awarded stars at level completion while preserving the existing star/save system.

## Aim guide & collision
- **Guide reaches the wall** — the drawn trajectory reflects near the frame edge so it visually touches
  the wall (gap ~31 px → ~5 px), kept clean/straight (earlier "warp" bend removed); the pre-bounce leg
  is identical to the real shot and the faint post-bounce hint fades. Flight/collision unchanged.
- **Guide == flight consistency** — the aim guide and the real shot share one collision routine, one
  `STEP` (3.5 px) sampling resolution and one Gap Assist; the flight advances in whole-`STEP` increments
  with a carried remainder → **0 landing divergences** across thousands of simulated shots.
- **Smart Gap Assist** — a ~1.9 px grazing forgiveness that only applies when overlap is decreasing
  (threading past); head-on approaches and walls always collide.
- **Premium aim guide visuals** — colour-matched rounded dots, soft glow, ~60% opacity, shrink+fade to
  the end, animated forward flow; the aim arrow was removed.
- **Aim angle limit** — the launcher clamps to a minimum ~18° elevation; aiming below **cancels** the
  shot (no near-horizontal fire).
- **Reduced collision hitbox** (`COLLISION.factor = 0.80`) so shots thread narrow gaps while solids stay
  blocked.
- **Bubble flight** — three-stage speed curve, directional lean, launch squash, glow trail, recoil.

## Game feel & animation
- **Animation unification** — one premium ease-out language; overshoot removed everywhere except the
  star bounce and the win entrance; landing squash ~5%, pop ~7%/~150 ms; falling spin softened; zoom/
  slow-motion reserved for the winning shot only.
- **Juice pass** — pitched audio (shoot/pop/fall/impact/click/combo/star), water splash + rising-bubble
  + soft-flash particles, tiered combo praise text, richer win sequence (freeze, burst, light rays,
  zoom punch, ~0.15 s slow-mo, flash, remaining fall, "Level Complete!" entrance, shot-bonus count-up),
  animated underwater background (rising bubbles, sway, light shimmer), idle micro-polish (launcher
  float, queue breathe, special glow, Play-button pulse).

## World map
- **Level map rebuilt** — bottom-anchored snake path (Level 1 at bottom), **append-only** real DOM
  nodes with native `content-visibility` virtualization, **infinite loading** (+20 near the top with a
  spinner and **no scroll jump**), decorations, and **always-focus-current-level** on open with a smooth
  ~0.5 s scroll. Fixed a width-collapse that hid all buttons.

## Core game (vertical slice)
- **500-level campaign** — deterministic, formula-driven `LevelDatabase` (COUNT=500) with per-level
  seeds; colours ramp 3→4→5; milestones every 20 levels with themed shapes + reward packs; hidden bonus
  objects; adaptive queue generosity.
- **Special bubbles** — bomb (radial), rainbow (wildcard), fireball (spreading burn), lightning
  (column), rocket (row); equipped from the Ability Bar, granted on unlock + milestones.
- **Obstacles** — ice (L15), stone/crystal (L22), chain/locked (L28) with scaling counts.
- **Solver-backed budget** — near-optimal solver sets a fair, always-clearable move budget.
- **Save system** — `bql_save_v2` (unlocked, stars, inventory, tutorials, map state, current level) with
  in-memory fallback.
- **Rewarded-ad placeholder** — AdMob-ready `RewardedAdManager` (+3 specials per view).
- **Renderer & audio** — glossy PNG bubble sprites + inlined underwater scene; synthesised Web Audio.
- **Build & tests** — `build.js` one-file build; **253 headless assertions** across systems/logic/flow/
  climb/hud/assets + smoke/stress; real-Chromium 60 FPS verification.

---

### Notes
- The game is a single self-contained `dist/index.html` (~3.9 MB). There is no incremental version
  tagging yet; consider adding a `version` field to the save and a semantic version once the meta-game
  (economy/ads/IAP) lands.
