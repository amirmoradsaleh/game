# Project Documentation — Bubble Quest Legends

A complete, end-to-end overview of the game and every system currently implemented.

---

## 1. What the game is

Bubble Quest Legends is a **vertical-climb bubble shooter** wrapped in a **500-level snake world
map**. The player taps **Play**, sees the map focused on their current level, taps a level, and
enters a tall underwater cave. From a launcher at the bottom they aim and fire coloured bubbles
upward; matching **3+ same-colour bubbles** pops them, and any bubbles left hanging fall. As the
cluster shrinks, the **camera climbs** toward the summit. Clearing the whole cave wins the level,
awards **1–3 stars** based on performance, unlocks the next level, and returns to the map.

It is a **self-contained HTML file** (Canvas + vanilla JS, synth audio, localStorage save). No
server, no network, no runtime dependencies. Designed to feel like a premium commercial title.

## 2. The full player journey (beginning to end)

1. **Boot / Loading** — assets (inlined sprites + background) initialise; the game shows a brief
   loading state, then the **Main Menu**.
2. **Main Menu** — title, a pulsing **Play** button, and a **Power-Ups** entry. Play opens the map.
3. **World Map** — a curved snake path of level nodes, Level 1 at the bottom, higher levels upward.
   The map **always opens focused on the player's current level** (ignoring prior scroll) with a
   smooth scroll. Completed levels show earned stars; the current level glows; locked levels can't
   be tapped. Scrolling up **loads more levels 20 at a time** with a tiny spinner and no scroll jump.
4. **Level (Playing)** — the core loop:
   - A **launcher** at the bottom holds the **current** bubble (top) and a **reserve** (to the
     right); tap either to swap.
   - **Aim** by dragging; a colour-matched dotted **trajectory** shows the path (with wall
     reflections). Aiming too close to horizontal (below ~18°) **cancels** the shot.
   - **Fire** to launch the bubble; it flies, bounces off side walls, and snaps to the hex grid.
   - **Matching 3+** pops the cluster; disconnected groups **fall**. Combos, drops and specials
     produce escalating feedback.
   - A **top star-progress bar** fills live based on multi-factor performance; stars light up as
     thresholds are reached.
   - **Special bubbles** (bomb/rainbow/fireball/lightning) can be **equipped** from the Ability Bar
     and fired instead of a normal bubble.
   - **Obstacles** (ice, stone, chains) appear from mid-campaign and must be cleared indirectly.
5. **Win** — clearing the cave freezes gameplay and plays a **premium celebration** (burst, light
   rays, camera zoom punch, brief slow-motion, flash, remaining bubbles fall), then a **"Level
   Complete!"** popup animates in, stars light **one by one**, and a **shot bonus** counts up.
   Milestone levels also grant a **reward pack**. The next level unlocks.
6. **Lose** — running out of shots with bubbles remaining shows a **failure** popup (retry / map).
7. Back to the **map**, now focused on the newly-current level, and the loop repeats.

## 3. Systems inventory (everything implemented)

### Core gameplay
- **Hex board** (`Board.js`) — 12×60 hex grid; only a viewport is visible; camera climbs. Handles
  placement, **connected-colour match** (3+), **flood** for specials, and **floating-drop** detection.
- **Shooter** (`Shooter.js`) — aim (with an 18° minimum elevation; below cancels), flight with a
  **three-stage speed curve**, **wall reflection**, **grid snapping**, **collision** (0.80× diameter
  hitbox), and **Smart Gap Assist** (a ~1px grazing forgiveness that never lets shots through solids).
  The aim **trajectory** and the real shot share one collision routine → the guide is a reliable
  prediction.
- **Bubble queue** (`BubbleQueue.js`) — current + reserve with a **smart colour policy** weighted by
  reachable clusters, blended by per-tier **generosity**.
- **Ability Bar** (`AbilityBar.js`) — equip a player special (from inventory) to fire next.
- **Special effects** (`SpecialEffects.js`) — bomb (radial), rainbow (wildcard), rocket (row),
  fire (spreading burn), lightning (column).
- **Camera** (`CameraController.js`) — eases vertically to keep the active cluster framed; settles.

### Content & progression
- **Level database** (`LevelDatabase.js`) — deterministic records for **1..500** (`COUNT=500`):
  colours, obstacles, abilities, stage height, ammo, star thresholds, milestone rewards, generosity,
  bonus objects, mechanic-intro flags — all by formula, per level, with a fixed seed.
- **Level generation** (`LevelGenerator.js` + `LevelManager.js`) — builds a solvable layout from the
  record + seed, estimates an **optimal** solve, sets the **move budget**, and exposes **star** logic.
- **Save** (`SaveManager.js`) — `bql_save_v2`: unlocked level, stars, tutorials seen, special
  inventory, unlocked specials, claimed milestones, map position/batches, current level.
- **World map** (in `Game.js`) — append-only snake path, native `content-visibility` virtualization,
  infinite loading (+20), always-focus-current, decorations.

### Presentation
- **Renderer** (`Renderer.js`) — glossy bubble sprites, the inlined underwater scene, and an animated
  **ambient layer** (rising bubbles, gentle sway, slow light shimmer).
- **Particles** (`ParticleSystem.js`) — a single **pooled** system: shard bursts, sparkles, water
  splash, rising bubbles, soft glow flashes, trails, floating text.
- **Audio** (`SoundManager.js`) — synthesised, **pitch-varied** SFX (shoot, pop, impact, fall, click,
  combo, star, victory, failure).
- **Star-progress bar** (in `Game.js`) — live, **multi-factor** performance meter with adaptive
  thresholds and one-by-one star reveals; also computes the awarded stars at win.
- **UI** — DOM overlays for menu, map, HUD, pause, win, lose, reward, power-ups, in-game tutorials.

### Meta
- **Rewarded ads** (`RewardedAdManager.js`) — placeholder that grants +3 specials on "view";
  AdMob-ready (only `load`/`show` change).
- **Tutorials** — one-time, in-context callouts the first time each mechanic appears.

## 4. Determinism & data-driven design

`GameConfig` holds only **global tunables** (view, board geometry, palette, timings, aim, collision).
Everything **per level** lives in `LevelDatabase.get(n)` and is computed by formula, so:
- A level always looks and plays the same for everyone (seeded).
- Balancing is centralised (change a formula, not 500 hand-authored files).
- Scaling to 1000 levels is `COUNT = 1000`.

## 5. Quality bar

- **60 FPS** on mobile (pooled particles, O(1) collision, virtualized map, minimal allocations).
- **Premium game feel**: unified ease-out animation language, colour-matched aim guide, satisfying
  pops/combos, reserved strong celebrations for win + stars only.
- **Reliability**: 253 headless assertions + real-Chromium verification; guide/flight consistency
  verified across thousands of simulated shots.

See the specialised documents for exhaustive detail on each system.
