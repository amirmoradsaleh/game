# Architecture Overview

How the code is organised, how the pieces talk to each other, and how the game flows.

---

## 1. High-level shape

Bubble Quest Legends has **no framework and no module system**. Source files under `src/` are plain
scripts that define **global** classes/objects (`GameConfig`, `Board`, `Shooter`, `Game`, …).
`build.js` concatenates them **in dependency order** into one bundle and inlines the CSS/DOM shell
(`index.template.html`) and the image assets (as data URIs) into a single `dist/index.html`.

Because there are no imports, **ordering is the dependency graph**. The canonical build order is:

```
GameConfig → LevelDatabase → BubbleSprites → BackgroundImage → HexGrid(+Utils) →
SoundManager → ParticleSystem → Bubble → SpecialEffects → Board → LevelGenerator →
BubbleQueue → Shooter → Renderer → GameStateManager → DifficultyManager →
CameraController → AbilityBar → SaveManager → RewardedAdManager → LevelManager → Game
```

`Game` is the last-loaded orchestrator; the boot script in `index.template.html` collects DOM
references and constructs `new Game(canvas, dom)`.

## 2. Folder architecture

| Folder | Responsibility |
|---|---|
| `src/config/` | Static data: global tunables (`GameConfig`) and per-level records (`LevelDatabase`). |
| `src/core/` | Foundational utilities: `HexGrid` (geometry) + `Utils` (seeded RNG, math, easing, hashing), and `SoundManager`. |
| `src/effects/` | `ParticleSystem` (pooled visual particles). |
| `src/gameplay/` | Rules & simulation: `Bubble`, `Board`, `BubbleQueue`, `LevelGenerator`, `Shooter`, `SpecialEffects`. |
| `src/managers/` | Coordinating services (see below). |
| `src/ui/` | `Renderer` (canvas drawing). |
| `src/assets/` | Inlined sprite/background data URIs. |
| `src/Game.js` | The orchestrator that wires everything together. |

## 3. Managers

| Manager | Role |
|---|---|
| **GameStateManager** | Finite-state machine: `MENU, MAP, LOADING, PLAYING, PAUSED, WON, LOST`. On change, `Game._onState` routes DOM overlays and HUD visibility. |
| **LevelManager** | Turns a `LevelDatabase` record into a **playable level**: generates the layout (via `LevelGenerator`), runs a greedy **near-optimal solver** to estimate `optimal`, sets the **move budget**, and provides `starsFor(...)` (legacy efficiency stars). |
| **CameraController** | Smoothly climbs the vertical camera to keep the active cluster framed; reports `atTop()` / `settled()` for win detection. |
| **AbilityBar** | Holds equippable player specials as slots backed by the save inventory; `equip`, `has`, `consume`. |
| **DifficultyManager** | Difficulty helpers/curve support around `LevelDatabase.difficulty`. |
| **SaveManager** | localStorage persistence (`bql_save_v2`) with in-memory fallback; unlock, stars, inventory, tutorials, map state. |
| **RewardedAdManager** | Placeholder rewarded-ad service; AdMob-ready. |

## 4. Game flow (control loop)

`Game` owns a single **rAF loop** (`_loop`):

```
_loop(t):
  realDt = clamp(frame delta, ≤33ms)
  dt = realDt          # scaled to 0.4× while a brief win slow-motion timer is active
  if state == PLAYING: _update(dt)
  _draw()
  requestAnimationFrame(_loop)
```

`_update(dt)` (only while PLAYING):
1. Advance the **queue**, **particles**, **camera**, **shooter flight** (which may produce a landing).
2. Progress **popping** timers, **falling** physics, **win-ray / zoom / recoil / muzzle** decays, and
   the **win-sequence timer**.
3. `_checkEnd()` — **win** if the board is empty and the camera has settled at the summit; **lose**
   if out of shots with bubbles remaining and everything has settled.

`_draw()`:
1. Background + ambient layer.
2. A camera transform (`scale` for a win zoom pulse, then `translate` for shake + camera Y).
3. Board bubbles, falling bubbles, popping bubbles, particles, the flying bubble, the shooter/launcher.
4. Screen-space overlays: flash, win light rays, tutorial spotlight.

## 5. Scene / screen flow

```
                 ┌────────────┐
   boot ───────► │  LOADING   │
                 └─────┬──────┘
                       ▼
                 ┌────────────┐  Play    ┌────────────┐  tap level  ┌────────────┐
                 │   MENU     ├────────► │    MAP     ├───────────► │  PLAYING   │
                 └────────────┘          └─────▲──────┘             └──┬───┬──┬──┘
                                               │                       │   │  │
                            back / after win   │            pause ◄────┘   │  │
                                               │                           │  │
                                       ┌───────┴──────┐   win  ┌───────────┘  │ lose
                                       │  (map focus  │◄───────┤    WON        │
                                       │  = current)  │        └───────────────┤
                                       └──────────────┘◄──────────────  LOST ◄─┘
```

- **PLAYING → PAUSED**: pause overlay (Continue / Restart / Exit-to-Menu).
- **PLAYING → WON**: frame-timed win sequence → results popup → (optional reward popup) → Next / Map.
- **PLAYING → LOST**: failure popup → Retry / Map.
- Any return to the **MAP** re-focuses on `save.currentLevel` (clamped to unlocked) with a smooth scroll.

## 6. State management

`GameStateManager` is a minimal FSM: `state.set(x)` fires `onChange(x)` → `Game._onState(s)` toggles
the correct overlay `.show` classes and HUD visibility. Gameplay input, updates and end-checks are
gated on `state.is(PLAYING)`. The **win sequence** is **frame-timed** (a decrementing `_winTimer` in
`_update`) rather than `setTimeout`, so it is deterministic and testable in headless loops.

## 7. Major systems and their collaborators

- **Shooting:** `Game` input → `Shooter.aimAt / launch / update` → landing cell → `Board.resolve` →
  `Game._processRemovals` (particles, sound, popping/falling) → `_updateHUD` / progress bar → `_checkEnd`.
- **Map:** `Game` builds append-only DOM nodes positioned by hex-free snake math; `SaveManager` stores
  `mapCenter`, `mapLoaded`, `currentLevel`.
- **Progression:** win → `SaveManager.recordResult(n, stars)` (best stars + unlock next) → map refresh.
- **Rendering vs. simulation** are cleanly separated: `Board`/`Shooter` never draw; `Renderer` never
  mutates game state.

## 8. Determinism boundary

- **Pure/deterministic:** `LevelDatabase`, `LevelGenerator` (seeded via `Utils.withSeed`), `Board`
  resolution, `Shooter` collision. These are unit-tested headlessly.
- **Presentational/non-deterministic:** particles, camera easing, animation timings, audio, ambient
  background. These never affect gameplay outcomes.

See [TECHNICAL_SPECIFICATION.md](TECHNICAL_SPECIFICATION.md) for build/test detail and
[CODE_STYLE_GUIDE.md](CODE_STYLE_GUIDE.md) for conventions.
