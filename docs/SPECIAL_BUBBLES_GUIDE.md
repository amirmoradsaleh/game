# Special Bubbles Guide

Player specials are **equipped from the Ability Bar** and fired **instead of** the current bubble. They
are **never spawned into the grid** (`GameConfig.SPAWN_ON_MATCH` is intentionally empty). Their clear
strategies live in `SpecialEffects.js`; their definitions/icons in `AbilityBar.js` (`AbilityDefs`).

---

## Summary table

| Special | Ability id | Effect id | Available from | Icon | Colour | Effect |
|---|---|---|---|---|---|---|
| **Bomb** | `bomb` | `bomb` | Level 3 | 💣 | `#ff5d6c` | Radial blast — clears everything within hex radius 2 |
| **Rainbow** | `rainbow` | `rainbow` | Level 6 | 🌈 | `#b06cff` | Colour wildcard — adopts the dominant neighbour colour, then matches normally |
| **Fireball** | `fireball` | `fire` | Level 9 | 🔥 | `#ff8a3d` | Spreading burn — consumes an expanding radius-2 flood of neighbours |
| **Lightning** | `laser` | `lightning` | Level 12 | ⚡ | `#ffcf3f` | Clears the entire **column** |
| **Rocket** | `rocket` | `rocket` | (defined; not in default unlock flow) | 🚀 | `#41a6ff` | Clears the entire **row** |

> Note the two id spaces: the **ability id** (inventory / UI, e.g. `laser`, `fireball`) and the
> **effect id** (`SpecialEffects`, e.g. `lightning`, `fire`). `AbilityDefs` maps between them.

---

## 1. Bomb 💣

- **Purpose:** reliable, position-based clearing — great against packed clusters and obstacles.
- **Unlock:** available from **Level 3**; a `bomb` tutorial fires the first time it appears.
- **Visual design:** dark bomb sprite with a golden fuse spark; a strong `explosion` particle burst.
- **Gameplay:** on landing, clears **every bubble within hex distance 2** of the impact cell.
- **Interaction:** removes obstacles caught in the blast; useful to break open sealed pockets.
- **Availability formula:** `abilities.bomb = 1 + floor(n/25)` (solver reference; player count in save).

## 2. Rainbow 🌈

- **Purpose:** a colour wildcard that turns an awkward queue into a match.
- **Unlock:** from **Level 6**; `rainbow` tutorial.
- **Visual design:** rainbow-swirl bubble; adopts a colour on contact.
- **Gameplay:** on landing it takes the **dominant colour among its neighbours**, then triggers a
  **normal connected match** of that colour (never a board-wide clear).
- **Interaction:** best fired into a large single-colour cluster to detonate it.

## 3. Fireball (fire) 🔥

- **Purpose:** organic chain clearing that spreads through a neighbourhood.
- **Unlock:** from **Level 9**; `fireball` tutorial.
- **Visual design:** flame bubble; spreading burn particles.
- **Gameplay:** consumes an **expanding flood** of neighbours (a radius-2 burn from the impact),
  clearing a sizeable connected pocket regardless of colour.
- **Interaction:** strong against mixed-colour walls where matching is hard.

## 4. Lightning (laser) ⚡

- **Purpose:** decisive vertical clearing.
- **Unlock:** from **Level 12**; `lightning` tutorial.
- **Visual design:** electric bubble; a column flash.
- **Gameplay:** clears the **entire column** the bubble lands in.
- **Interaction:** ideal for tall, narrow caves and cutting through a column of obstacles.

## 5. Rocket 🚀 (defined, not in default flow)

- **Effect:** clears the **entire row**. Present in `AbilityDefs` / `SpecialEffects` and ready to be
  wired into progression/economy if desired. Currently not granted by the default unlock schedule.

---

## Equipping & consuming

- Specials are held in the **save inventory** (`inventory: { bomb, rainbow, laser, fireball }`) and
  surfaced as **Ability Bar** slots. `AbilityBar` keeps a slot even at count 0 (greyed out).
- Tap a slot to **equip**; the launcher then previews the special (with a soft glow). Firing consumes
  one from the inventory. A slot with count 0 cannot be equipped.
- Specials are **granted once on unlock** and **topped up by milestone reward packs** and (future) ads.
  See [ECONOMY_GUIDE.md](ECONOMY_GUIDE.md) and [PROGRESSION_SYSTEM.md](PROGRESSION_SYSTEM.md).

## Tutorials

Each special has a **one-time in-context tutorial** (`tutorials` keys `bomb`, `rainbow`, `fireball`,
`lightning`) shown the first time it becomes relevant. Seen-state persists in the save.

## Design guardrails

- Do **not** spawn specials into the grid (keep `SPAWN_ON_MATCH` empty).
- Do **not** change a special's effect radius/scope without an explicit request — it rebalances levels.
- Keep the ability-id ↔ effect-id mapping in `AbilityDefs` intact.
