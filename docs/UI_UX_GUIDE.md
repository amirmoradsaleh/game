# UI / UX Guide

Every screen, the navigation between them, and the UX principles. UI is **DOM + CSS overlays** on top
of the Canvas; the boot script in `index.template.html` wires DOM refs into `Game`.

---

## 1. Screens & overlays

| Screen / overlay | DOM id | Shown in state | Contents |
|---|---|---|---|
| Loading | `loading` / `loadingBar` | LOADING | Brief asset init |
| Main Menu | `menuScreen` | MENU | Title, **Play** (pulsing), Power-Ups |
| Power-Ups | `powerupsScreen` | (over menu) | Special inventory overview |
| World Map | `mapScreen` (`mapScroll` / `mapNodes` / `mapSpinner`) | MAP | Snake path of level nodes |
| HUD (top bar) | `topbar` | PLAYING | Level chip, **star-progress bar**, pause + mute |
| Ability Bar | `abilityBar` | PLAYING | Equippable specials |
| Pause | `pausePopup` | PAUSED | Continue ▶ / Restart ↻ / Exit to Menu |
| Win | `winPopup` (`winStars`, `winBonus`, `winTitle`, `winNext`, `winMap`) | WON | "Level Complete!", stars, shot bonus |
| Reward | `rewardPopup` | (after win, milestones) | Milestone reward pack |
| Lose | `losePopup` | LOST | Retry / Map |
| Tutorial | `tutorialPopup` / `tutorialBanner` | PLAYING (first-time) | One-time in-context callouts |

State→overlay routing is centralised in `Game._onState(s)`.

## 2. Gameplay HUD

- **Top bar:** a compact row — the **Level chip** (left, small), the **star-progress bar** (centre,
  compact, ~150 px, 7 px track, 12 px stars) between the chip and the **pause** button (right, above
  **mute**). See [STAR_SYSTEM.md](STAR_SYSTEM.md).
- **Launcher (canvas):** current bubble (top) + reserve (right, ~75%). Tap to swap. Idle life: gentle
  float, queue breathe, special glow.
- **Ability Bar (bottom):** special slots with counts (`x3`, `x1`, …); tap to equip.
- **Aim:** drag anywhere in the play area; the colour-matched trajectory previews the shot.

## 3. Navigation

```
Menu ──Play──► Map ──tap level──► Playing ──pause──► Pause ──Continue──► Playing
                ▲                     │  └─Restart──► Playing
                │                     │  └─Exit─────► Menu
                │              win────┴────► Win ──Next──► Playing (n+1)
                │                            └───Map───► Map (focus current)
                │              lose──────────► Lose ─Retry─► Playing
                └───────────────────────────── Map ◄─ (any return focuses current level)
```

## 4. UX principles

- **Always know where you stand:** the live progress bar means the player sees their star standing at
  all times, not just at the end.
- **Never lose your place:** the map always re-focuses on the current level; infinite loading never
  jumps the scroll.
- **One-tap everything:** swap, equip, aim/fire, and navigation are all single taps/drags; large hit
  targets (64 px map nodes, generous buttons).
- **Fair aiming:** the guide is a reliable prediction; near-horizontal shots are cancelled (not fired
  by accident).
- **Gentle onboarding:** each new mechanic gets a one-time, in-context tutorial; nothing is dumped at
  once.
- **Reserved celebration:** ordinary actions are subtle; big moments (win, stars) are loud — so the
  loud moments stay special. See [ANIMATION_GUIDE.md](ANIMATION_GUIDE.md).

## 5. Buttons & feedback

- Buttons scale slightly on press (`:active`), popups scale+fade in, panels scale in, the pause menu
  slides, reward pops. The **Play** button has a subtle idle pulse.
- Icon buttons (pause/mute) are round, top-right; the mute toggle reflects sound state.

## 6. Spacing & layout

- Logical canvas is **540×960** portrait; the frame keeps a phone aspect ratio and the renderer scales
  to the device. Overlays are centred within the frame.
- Top bar padding keeps the Level chip, progress bar and buttons on one visually-aligned row.
- **Layout robustness:** the map scroll container is forced full-width (see [MAP_SYSTEM.md](MAP_SYSTEM.md)).

## 7. Accessibility & input

- Pointer (mouse/touch) driven; drag to aim, release to fire. Buttons have `aria-label`s.
- Sound can be muted; all critical feedback is also visual (particles, flashes, star reveals).

## 8. Guardrails

- **Never break existing UI** or remove screens/overlays. Extend additively.
- Keep the progress bar compact and top-centred (between Level and pause).
- Preserve the pause/win/lose/reward flows and their DOM ids (save/tests/routing depend on them).
