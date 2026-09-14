# Bubble Quest Legends — Documentation

> **This `docs/` folder is the permanent source of truth for the project.**
> Every future development session should rely on these documents instead of chat history.
> Start with **[PROJECT_MEMORY.md](PROJECT_MEMORY.md)** for a 10-minute full-project briefing,
> then read **[CLAUDE_RULES.md](CLAUDE_RULES.md)** before changing anything.

---

## 1. Project overview

**Bubble Quest Legends** is a premium, underwater-themed **bubble shooter** built to the
production quality of *Bubble Witch Saga*, *Panda Pop* and *Angry Birds Dream Blast*.

- **Platform:** single self-contained HTML5 file (Canvas 2D + vanilla JavaScript). Runs in any
  modern browser and inside an Android/iOS WebView with no server, no bundler runtime, no network.
- **Structure:** a King-style meta-game — a **500-level snake world map** (Level 1 at the bottom,
  climbing upward) feeding into **vertical-climb bubble-shooter levels** where the camera ascends a
  tall cave as the player clears bubbles.
- **Feel:** glossy candy-coloured bubbles, an animated underwater background, a colour-matched aim
  guide, satisfying pops/combos, a live star-progress bar, and celebratory win sequences — all
  tuned to hold **60 FPS on mobile**.

The game is **fully data-driven**: every level (1..500) is derived deterministically by formula
from `LevelDatabase`, so a level always generates the same layout for every player, and extending
to 1000 levels later is a one-line `COUNT` change.

## 2. Folder structure

```
bubble-quest/
├── index.template.html      # HTML shell: <head> CSS + <body> DOM + boot script (dom refs, resize)
├── build.js                 # Concatenates src/ in dependency order, inlines assets → dist/index.html
├── src/
│   ├── Game.js              # Orchestrator (state machine, loop, input, HUD, win/lose, map, draw)
│   ├── config/
│   │   ├── GameConfig.js    # Global tunables: view, board, colours, specials, timings, AIM, COLLISION
│   │   └── LevelDatabase.js # Deterministic per-level records for 1..500 (COUNT=500)
│   ├── core/
│   │   ├── HexGrid.js       # Hex geometry + Utils (seeded RNG, clamp/lerp/easing, hashing)
│   │   └── SoundManager.js  # Synthesised Web Audio SFX (pitchable)
│   ├── effects/
│   │   └── ParticleSystem.js# Pooled particles (burst, sparkle, splash, bubbles, flash, trail, text)
│   ├── gameplay/
│   │   ├── Board.js         # Hex board storage, match/flood resolution, floating-drop detection
│   │   ├── Bubble.js        # Bubble data model (colour, special, shell, anim state)
│   │   ├── BubbleQueue.js   # Current/reserve queue with smart colour policy (generosity)
│   │   ├── LevelGenerator.js# Deterministic layout generation from a level record + seed
│   │   ├── Shooter.js       # Aim, flight, wall reflection, collision, Gap Assist, trajectory
│   │   └── SpecialEffects.js# Per-special clear strategies (bomb/rainbow/rocket/fire/lightning)
│   ├── managers/
│   │   ├── AbilityBar.js    # Equippable player specials (inventory-backed slots)
│   │   ├── CameraController.js # Smooth vertical camera climb + settle
│   │   ├── DifficultyManager.js
│   │   ├── GameStateManager.js # Finite states + overlay routing
│   │   ├── LevelManager.js  # Builds a playable level (layout + budget + solver + stars)
│   │   ├── RewardedAdManager.js # Rewarded-ad placeholder (AdMob-ready)
│   │   └── SaveManager.js   # localStorage persistence (key bql_save_v2) + in-memory fallback
│   ├── ui/
│   │   └── Renderer.js      # Canvas drawing (bubbles, background, ambient life)
│   └── assets/
│       ├── BubbleSprites.js # Inlined PNG bubble sprites (data URIs)
│       └── BackgroundImage.js # Inlined underwater scene (data URI)
├── assets/                  # Source PNGs (ball*.png, backgroundGame.png)
├── dist/index.html          # Built, self-contained deliverable (~3.9 MB)
├── test.*.js                # Headless Node test harnesses (eval the bundle)
├── smoke.js / stress.js     # End-to-end flight/stress simulations
└── docs/                    # ← you are here
```

> Root also contains scratch/debug files (`dbg.js`, `wc3.js`, `wincheck*.js`, etc.). These are
> developer utilities and are **not** part of the build or the shipped source.

## 3. Technology stack

| Layer            | Technology                                                        |
|------------------|-------------------------------------------------------------------|
| Rendering        | HTML5 **Canvas 2D** (logical 540×960, scaled to device)           |
| Language         | **Vanilla JavaScript** (ES2019), **no framework, no module system** — files share globals and are concatenated in dependency order |
| UI / overlays    | **DOM + CSS** (menus, map, popups, HUD, progress bar, ability bar)|
| Audio            | **Web Audio API** — 100% synthesised SFX (no audio files)         |
| Persistence      | **localStorage** (`bql_save_v2`) with in-memory fallback          |
| Build            | **Node** script (`build.js`) — concatenate + inline assets        |
| Tests            | **Node** headless harnesses that `eval` the built bundle          |
| Ads (future)     | Placeholder `RewardedAdManager`, structured for **Google AdMob**  |

There are **no runtime third-party dependencies**. `node_modules/` exists only for dev tooling
(headless DOM / real-Chromium verification) and is **excluded** from the shipped zip.

## 4. How to run the project

**Play the built game:** open `dist/index.html` in any browser (or double-click the shipped
`BubbleQuestLegends.html`). No server needed.

**Build from source:**
```bash
node build.js
# → dist/index.html (self-contained) and dist.bundle.js (concatenated JS for tests)
node --check dist.bundle.js   # syntax sanity
```

**Run the test suite (headless Node):**
```bash
for t in systems logic flow climb hud assets; do node test.$t.js; done
node smoke.js
node stress.js
```
All suites must stay green (currently **253 assertions**). See [TECHNICAL_SPECIFICATION.md](TECHNICAL_SPECIFICATION.md).

**Real-browser verification** (optional, when available): Playwright + local Chromium is used to
confirm 60 FPS, no console errors, and visual correctness. See [TECHNICAL_SPECIFICATION.md](TECHNICAL_SPECIFICATION.md).

## 5. Important notes

- **Never edit `dist/` or `dist.bundle.js` by hand** — they are generated. Edit `src/` +
  `index.template.html`, then run `node build.js`.
- The game is **deterministic**: level `n` always produces the same layout (seeded per level).
- **Save compatibility is sacred** — the save key `bql_save_v2` and its shape must be preserved
  (extend additively). See [SAVE_SYSTEM.md](SAVE_SYSTEM.md).
- Follow **[CLAUDE_RULES.md](CLAUDE_RULES.md)** for every change: extend, never rewrite; preserve
  gameplay, balance, collision, progression, visual style and 60 FPS.

## 6. Document index

| Document | Purpose |
|---|---|
| [PROJECT_MEMORY.md](PROJECT_MEMORY.md) | **Read first.** 10-minute permanent briefing for any new session. |
| [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) | End-to-end overview of every system. |
| [ARCHITECTURE_OVERVIEW.md](ARCHITECTURE_OVERVIEW.md) | Folders, managers, game/scene/state flow. |
| [GAMEPLAY_RULES.md](GAMEPLAY_RULES.md) | Every gameplay mechanic in detail. |
| [LEVEL_DESIGN_GUIDE.md](LEVEL_DESIGN_GUIDE.md) | How levels are designed & scaled. |
| [GAME_BALANCING_GUIDE.md](GAME_BALANCING_GUIDE.md) | Difficulty curve, shots, stars, combos. |
| [SPECIAL_BUBBLES_GUIDE.md](SPECIAL_BUBBLES_GUIDE.md) | Every special bubble. |
| [OBSTACLES_GUIDE.md](OBSTACLES_GUIDE.md) | Every obstacle. |
| [LEVEL_PROGRESSION.md](LEVEL_PROGRESSION.md) | Level ranges & mechanic introductions. |
| [STAR_SYSTEM.md](STAR_SYSTEM.md) | Progress bar & star calculation. |
| [PROGRESSION_SYSTEM.md](PROGRESSION_SYSTEM.md) | Unlock flow & player progression. |
| [MAP_SYSTEM.md](MAP_SYSTEM.md) | World map, infinite scroll, focus. |
| [UI_UX_GUIDE.md](UI_UX_GUIDE.md) | Every screen & UX principle. |
| [VISUAL_STYLE_GUIDE.md](VISUAL_STYLE_GUIDE.md) | Art direction & visual identity. |
| [ANIMATION_GUIDE.md](ANIMATION_GUIDE.md) | All animations, timing, easing. |
| [AUDIO_GUIDE.md](AUDIO_GUIDE.md) | Music, SFX, pitch, future haptics. |
| [ECONOMY_GUIDE.md](ECONOMY_GUIDE.md) | Inventory, rewards, future monetization. |
| [ADS_SYSTEM.md](ADS_SYSTEM.md) | Rewarded ads & AdMob plan. |
| [SAVE_SYSTEM.md](SAVE_SYSTEM.md) | Saved data & compatibility. |
| [TECHNICAL_SPECIFICATION.md](TECHNICAL_SPECIFICATION.md) | Core systems, perf, mobile. |
| [CODE_STYLE_GUIDE.md](CODE_STYLE_GUIDE.md) | Conventions & architecture principles. |
| [CLAUDE_RULES.md](CLAUDE_RULES.md) | **Permanent development rules.** |
| [CHANGELOG.md](CHANGELOG.md) | Milestones & implemented features. |
| [TODO.md](TODO.md) | Prioritised roadmap. |
