# PROJECT_MEMORY — Permanent Knowledge Base

> **Read this first.** It lets a future session understand the whole project in ~10 minutes, without
> chat history. Concise but complete. For depth, see the linked docs. For rules, see
> [CLAUDE_RULES.md](CLAUDE_RULES.md).

---

## 1. What this is

**Bubble Quest Legends** — a premium underwater **bubble shooter** with a **500-level snake world map**
feeding **vertical-climb** shooter levels. Built as a **single self-contained `dist/index.html`** (HTML5
Canvas 2D + vanilla JS, synth Web Audio, localStorage save). No framework, no module system, no runtime
dependencies, no server. Quality bar: *Bubble Witch Saga / Panda Pop / Royal Match*, **60 FPS on mobile**.

## 2. Core gameplay philosophy

Fair, skill-based, and constantly rewarding. Deterministic content (every level generates identically
via a per-level seed). Clearing the cave wins; a **live star-progress bar** always tells the player how
close they are to 1/2/3 stars. Feel is fast and subtle, with strong celebrations reserved for **wins**
and **star rewards** only.

## 3. Current status

**Feature-complete vertical slice, production-polished.** 500 deterministic levels, specials,
obstacles, world map, save, star system, full juice/animation pass, aim/collision system, rewarded-ad
placeholder. **253 headless assertions green**, real-Chromium 60 FPS verified. No coins/IAP/real-ads yet
(next milestones). Single-file deliverable ~3.9 MB.

## 4. Implemented systems

- **Board** (hex, 12×60, camera climbs): match 3+ connected same-colour; disconnected groups fall.
- **Shooter**: aim, three-stage flight, wall reflection, grid snapping, collision + Gap Assist,
  trajectory. Guide and real shot are **identical** (shared collision/STEP).
- **Bubble queue**: current + reserve, smart colour policy blended by per-tier *generosity*.
- **Specials** (equipped from Ability Bar, never in grid): bomb (radius 2), rainbow (wildcard),
  fireball (spreading burn), lightning (column), rocket (row).
- **Obstacles**: ice (L15, 2-hit), stone/crystal (L22, colourless solid), chain/locked (L28, unlock).
- **LevelDatabase** (COUNT=500): formula-derived records (colours, obstacles, abilities, stage, ammo,
  thresholds, milestone rewards, generosity, bonus, mechanic intros) + per-level seed.
- **LevelManager**: generates a solvable layout, runs a near-optimal solver, sets the move budget,
  exposes legacy efficiency stars.
- **Camera**: eases vertically, settles before win.
- **Save** (`bql_save_v2`): unlocked, stars, tutorials, inventory, unlockedSpecials, claimed, mapCenter,
  mapLoaded, currentLevel. localStorage + in-memory fallback.
- **World map**: append-only snake nodes, `content-visibility` virtualization, infinite +20 loading,
  always-focus-current.
- **Star-progress bar**: multi-factor live meter; awards stars at win.
- **Renderer + ParticleSystem (pooled) + SoundManager (synth)**: visuals/particles/audio.
- **RewardedAdManager**: placeholder, AdMob-ready.

## 5. UI flow

`LOADING → MENU →(Play)→ MAP →(tap level)→ PLAYING →(pause)→ PAUSED / →(win)→ WON / →(lose)→ LOST →
back to MAP (re-focused on current level)`. Overlays are DOM/CSS routed by `Game._onState`. HUD top bar:
small **Level chip · compact star-progress bar · pause/mute**. Bottom: **Ability Bar**. Launcher on the
canvas (current + reserve, tap to swap).

## 6. UX principles

Always know your star standing (live bar); never lose your place (map re-focuses, no scroll jumps);
one-tap everything with big targets; reliable aim (guide == flight; near-horizontal cancels); gentle
one-at-a-time tutorials; subtle by default, loud only at win/stars.

## 7. Visual style

Glossy candy bubbles (5 colours: red/blue/green/yellow/purple) over a calm luminous **underwater cave**
(real inlined PNGs). **Gold** stars, **blue** UI glows, rounded pills/buttons. Background always shows
through (no opaque overlay); subtle ambient life (rising bubbles, sway, light shimmer). Milestones show
themed shapes. See [VISUAL_STYLE_GUIDE.md](VISUAL_STYLE_GUIDE.md).

## 8. Animation philosophy

**Fast, ease-out, no overshoot** (canonical `cubic-bezier(.33,1,.68,1)`). Timings: micro 60–100 ms, pop
~150 ms (~7% expand), UI 180–250 ms, celebration 400–700 ms. Landing squash ~5%. **Only** allowed
overshoots: star bounce + win entrance. **Zoom/slow-motion are win-only.** See
[ANIMATION_GUIDE.md](ANIMATION_GUIDE.md).

## 9. Camera behaviour

Smoothly climbs vertically to keep the lowest filled row framed as the cluster shrinks; **settles before
a win registers** (never an early win). Regular matches: small shake scaled by match size (no zoom/slow-
mo). Win: zoom punch + ~0.15 s slow-mo + flash + shake.

## 10. Aim system

Drag to aim; launcher rotates upward only. **Minimum elevation ~18°** (`AIM.minElevation = 0.32 rad`);
below it the aim is **cancelled** (trajectory hides, release doesn't fire). Trajectory = colour-matched
rounded dots, ~60% opacity, glow, shrink+fade, animated flow, wall reflections, no landing marker. The guide reflects off walls at the **exact same centre bounds**
(`minLeft/maxRight`) as the real bubble, so bank-shot predictions are 100%% reliable even after multiple
bounces (0 divergences over 3,300+ bank shots). The drawn dots at each bounce are visually extended to
the wall (rendering-only, same y as the bounce) so the guide touches the side wall with no gap, without
altering the predicted/collision path.

## 11. Gap Assist behaviour

Collision hitbox = **0.80 × diameter** (`COLLISION.factor`). **Smart Gap Assist**: forgive a grazing
overlap ≤ **~1.9 px** (`GAP_ASSIST`) **only when overlap is decreasing** one `STEP` ahead (threading
past). Head-on approaches and walls **always** collide — solids are never passable. Guide and flight use
the same routine, so predictions are reliable. The **real flight is a hair more forgiving than the
guide** (`GAP_ASSIST_FLIGHT` ≈ 3.4 px vs guide 1.9 px, ~3.5% of a bubble) so any gap the aim line
shows as passable is always cleared by the bubble; it never shrinks the hitbox, changes spacing, or
lets shots through solids/walls, and the aim line itself is unchanged.

## 12. Bubble queue

Current (launch point) + reserve (right, ~75%); tap to swap. Next colour chosen by smart weighting of
reachable clusters, blended toward randomness by **generosity** (1.0 ≤100 · 0.66 ≤250 · 0.33 ≤500).

## 13. Special bubble system

Held in save inventory (`bomb, rainbow, laser, fireball`), shown as Ability Bar slots, equipped to fire
instead of the current bubble. **Granted once on unlock** (bomb 3 / rainbow 6 / fireball 9 / lightning
12) and topped up by **milestone reward packs** (+ future ads). See
[SPECIAL_BUBBLES_GUIDE.md](SPECIAL_BUBBLES_GUIDE.md).

## 14. Obstacle progression

Ice (L15), stone/crystal (L22), chain/locked (L28); counts scale with depth (capped 12/8/12). Each fires
a one-time tutorial. See [OBSTACLES_GUIDE.md](OBSTACLES_GUIDE.md), [LEVEL_PROGRESSION.md](LEVEL_PROGRESSION.md).

## 15. Map system

Bottom-anchored snake (Level 1 bottom), **append-only** real DOM nodes, native `content-visibility`
virtualization, initial 50 then **+20 near the top** with a spinner and **no scroll jump**, always opens
**focused on the current level** (smooth ~0.5 s scroll). Saves `mapCenter`/`mapLoaded`. Keep the
full-width-stretch fix. See [MAP_SYSTEM.md](MAP_SYSTEM.md).

## 16. Progress bar & star system

Live score `P = 0.45·cleared + 0.25·shotsLeft + 0.20·combo + 0.10·score (+0.06 bonus)`; adaptive
thresholds `[0.34+diff·.05, 0.62+diff·.08, 0.88+diff·.07]`, `diff=(n−1)/220` (generous early, demanding
late). Forward-only ease-out fill; stars light one-by-one; at win `stars = P≥t3?3:P≥t2?2:1` (min 1). See
[STAR_SYSTEM.md](STAR_SYSTEM.md).

## 17. Economy overview

Special-bubble inventory only (no coins/IAP yet). Earned via first-unlock grants + milestone packs +
(future) rewarded ads. Every level is completable **without** spending. See [ECONOMY_GUIDE.md](ECONOMY_GUIDE.md).

## 18. Ads architecture

Placeholder `RewardedAdManager` (+3 specials/view). AdMob-ready — only `load()/show(onReward)` change.
Opt-in rewarded only; never gates progression. See [ADS_SYSTEM.md](ADS_SYSTEM.md).

## 19. Save system

Key `bql_save_v2`, localStorage + in-memory fallback. Deterministic content means saves store only
outcomes (unlocked, stars, inventory, map focus). **Compatibility is sacred** — extend additively with
defaults; never rename/remove fields or change the key. See [SAVE_SYSTEM.md](SAVE_SYSTEM.md).

## 20. Technical architecture summary

No framework/module system → **load order in `build.js` is the dependency graph**. `build.js`
concatenates `src/**` + inlines the CSS/DOM shell + image data URIs into one `dist/index.html`. Single
rAF loop; simulation and rendering are cleanly separated; gameplay is deterministic and unit-tested
headlessly. See [ARCHITECTURE_OVERVIEW.md](ARCHITECTURE_OVERVIEW.md), [TECHNICAL_SPECIFICATION.md](TECHNICAL_SPECIFICATION.md).

## 21. Folder structure summary

`src/config` (GameConfig, LevelDatabase) · `src/core` (HexGrid+Utils, SoundManager) · `src/effects`
(ParticleSystem) · `src/gameplay` (Board, Bubble, BubbleQueue, LevelGenerator, Shooter, SpecialEffects)
· `src/managers` (AbilityBar, CameraController, DifficultyManager, GameStateManager, LevelManager,
RewardedAdManager, SaveManager) · `src/ui` (Renderer) · `src/assets` (inlined data URIs) · `src/Game.js`
(orchestrator) · `index.template.html` (shell) · `build.js` · `test.*.js` · `docs/`.

## 22. Performance goals

**60 FPS mobile.** Pooled particles (cap ~420), O(1) collision (cell + neighbours), map virtualization
(`content-visibility`), whole-`STEP` flight (frame-rate-independent), **no allocations in hot loops**.

## 23. Coding philosophy

Data-driven (tunables in `GameConfig`, per-level in `LevelDatabase`); **extend, never rewrite**; keep
public method names + DOM ids stable (tests/save/routing depend on them); separation of concerns
(sim ≠ render); rebuild before testing; verify layout in a real browser. See
[CODE_STYLE_GUIDE.md](CODE_STYLE_GUIDE.md).

## 24. Permanent gameplay rules

Match 3+ connected same-colour; float-drop after pops; linear unlock `n → n+1`; stars 1–3 (best kept);
every level clearable (`moves ≥ optimal+4`); near-horizontal shots cancelled; solids/walls never
passable; guide == flight.

## 25. NEVER change (unless explicitly requested)

Gameplay mechanics · collision/Gap Assist/wall reflection/snapping · balance (shots, generosity, star
thresholds, obstacle/colour formulas) · progression logic · level IDs/seeds · completed-level layouts ·
save shape/key · visual style · the animation language (no zoom/slow-mo/overshoot in ordinary play) ·
map append-only virtualization · existing UI/screens. **Extend, don't rewrite.** See
[CLAUDE_RULES.md](CLAUDE_RULES.md).

## 26. Future roadmap summary

Real AdMob → coins → continue-on-fail → persistent settings + save versioning → daily rewards → more
obstacles/specials → haptics/music → themes/localization → 1000+ levels. See [TODO.md](TODO.md).

## 27. Known limitations

No coins/IAP/real-ads/music/haptics yet. Offline-only (no cloud save/leaderboards by design). Headless
tests don't cover CSS/layout — **real-browser verification required** for UI changes. Single-file model
means new assets must be inlined and lean. Requirements have oscillated across sessions — follow the
latest explicit request but never silently break an invariant.

## 28. Current priorities

1. Real AdMob rewarded ads (seam ready). 2. Coins (soft currency, additive save). 3. Continue-on-fail.
4. Persistent settings + save versioning. Keep 60 FPS, all suites green, and every invariant above
intact.
