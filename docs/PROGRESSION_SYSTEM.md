# Progression System

How players move through the 500-level campaign: unlocking, current-level tracking, specials, and
milestones. Backed by `SaveManager` and `LevelDatabase`.

---

## 1. Unlock model

- **Linear unlock:** the player can play any level up to `save.unlocked` (the highest unlocked level).
- **On win** (`SaveManager.recordResult(n, stars)`):
  - Keeps the **best** star count for `n`.
  - If `n ≥ unlocked`, sets `unlocked = min(n + 1, COUNT)` — i.e. completing your newest level unlocks
    the next one (capped at 500).
- **Replays** are allowed for any unlocked level; they can improve the star record but never reduce it,
  and never lock anything.
- There is **no lives/energy gate** and no hard fail-forward — losing simply lets you retry.

## 2. Current level & map focus

- `save.currentLevel` tracks the level the player is on (set by `setCurrentLevel` when a level starts).
- The **map always opens focused on the current playable level** (`clamp(currentLevel, 1, unlocked)`),
  ignoring any previous scroll, with a smooth ~0.5 s ease-out scroll. See [MAP_SYSTEM.md](MAP_SYSTEM.md).

## 3. Specials unlocking

Specials become **available** at fixed levels (bomb 3, rainbow 6, fireball 9, lightning 12) and are
**granted once** to the inventory the first time they unlock (`SaveManager.unlockSpecial(id, amount)`
returns true only on first grant). Thereafter the inventory is topped up by:
- **Milestone reward packs** (every 20 levels) — `SaveManager.addSpecial`.
- **Rewarded ads** (future) — +3 of a chosen special per view.

`unlockedSpecials` records which specials have been granted so they are never double-granted. See
[ECONOMY_GUIDE.md](ECONOMY_GUIDE.md) and [SPECIAL_BUBBLES_GUIDE.md](SPECIAL_BUBBLES_GUIDE.md).

## 4. Milestones

- Every **20th level** grants a **reward pack** (claimed once via `hasClaimed`/`markClaimed`, so
  replays don't re-grant). Milestones also render a themed shape. See
  [LEVEL_PROGRESSION.md](LEVEL_PROGRESSION.md).

## 5. Stars & progression

- Stars are a **reward/rating layer**, not a gate — you never need N stars to proceed. They persist per
  level and drive the map's completed-state display. See [STAR_SYSTEM.md](STAR_SYSTEM.md).

## 6. Data owned by the progression system (`SaveManager`)

| Field | Meaning |
|---|---|
| `unlocked` | Highest unlocked level (start 1). |
| `stars` | `{ "<n>": 1..3 }` best stars per level. |
| `currentLevel` | Level the player is on (map focus). |
| `unlockedSpecials` | Which specials have been first-granted. |
| `claimed` | Milestone rewards already granted. |
| `inventory` | Special counts (`bomb, rainbow, laser, fireball`). |
| `tutorials` | One-time tutorials already seen. |
| `mapCenter`, `mapLoaded` | Map scroll focus + loaded batches. |

## 7. Reset

`SaveManager.reset()` returns to a fresh profile (unlocked 1, no stars/tutorials, empty inventory,
mapLoaded 50, currentLevel 1). Exposed via the settings **reset** action.

## 8. Guardrails

- **Never change unlock logic** (linear `n → n+1`) without an explicit request.
- **Never modify level IDs/numbers** — progression, saves and the map all key on them.
- **Preserve save compatibility** (`bql_save_v2` shape) — extend additively only.
