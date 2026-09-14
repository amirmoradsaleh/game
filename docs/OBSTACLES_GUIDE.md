# Obstacles Guide

Obstacles are **shells/blockers** placed into the grid by level generation. They raise difficulty
without changing the core match rule. Shell types are defined in `GameConfig.SHELL`; counts and
introduction timing come from `LevelDatabase`.

---

## Summary table

| Obstacle | Shell id | Player term | First level | Max count (capped) | Behaviour |
|---|---|---|---|---|---|
| **Ice** | `ice` | Ice 🧊 | 15 | `min(2 + floor((n−15)/4), 12)` | Frozen casing; a neighbouring pop **cracks** it, a second **clears** it |
| **Stone / crystal** | `crystal` | Stone 🪨 | 22 | `min(1 + floor((n−22)/10), 8)` | **Colourless solid** blocker; cannot be matched — dislodge by clearing around it |
| **Chain / locked** | `chain` | Locked 🔒 | 28 | `min(2 + floor((n−28)/6), 12)` | Chained; a neighbouring pop **breaks the chain**, then it behaves as a normal bubble |

`newMechanic` intro flags (`LevelDatabase.INTRO`): `ice` at 15, `stone` at 22, `locked` at 28. Each
fires a **one-time tutorial** the first time it appears.

---

## 1. Ice 🧊 (from Level 15)

- **Purpose:** the first obstacle — teaches "clear around it, then clear it." Slows down chains.
- **Difficulty:** moderate; requires **two** nearby pops (crack, then clear).
- **Interaction:** a match/pop **adjacent** to an ice bubble cracks its casing; the next adjacent pop
  removes it. Specials that clear it directly (bomb/fire/lightning within range) also work.
- **Scaling:** count grows every ~4 levels after 15, capped at 12.

## 2. Stone / crystal 🪨 (from Level 22)

- **Purpose:** a hard **colourless wall** that shapes the cave and forces routing around it.
- **Difficulty:** high — it can **never** be matched by colour.
- **Interaction:** remove it **indirectly** by clearing its supporting/neighbouring bubbles so it is no
  longer held (or catch it in a special's blast). It never participates in colour matches.
- **Scaling:** count grows every ~10 levels after 22, capped at 8 (kept sparse — stones are strong).

## 3. Chain / locked 🔒 (from Level 28)

- **Purpose:** a **two-stage** blocker that gates a bubble behind a chain.
- **Difficulty:** moderate — like ice but the first hit **unlocks** rather than cracks.
- **Interaction:** a neighbouring pop **breaks the chain**; the bubble then becomes a normal
  (matchable) bubble of its colour.
- **Scaling:** count grows every ~6 levels after 28, capped at 12.

---

## Placement & generation

- Per-level maximums come from `stage.iceMax / crystalMax / lockedMax` (mirrors of `obstacles`).
- `LevelGenerator` places obstacles under the level seed, keeping the board **solvable** (the solver +
  budget guarantee still hold with obstacles present, and `obstacleBonus` adds shots).
- Obstacles never appear before their intro level, preserving the onboarding ramp.

## Interactions with specials

| Special | Effect on obstacles |
|---|---|
| Bomb | Clears obstacles caught in the radius-2 blast |
| Fireball | Burns through obstacles in the expanding flood |
| Lightning | Clears obstacles in the struck column |
| Rocket | Clears obstacles in the struck row |
| Rainbow | Matches colour only — does not directly remove colourless stone |

## Design guardrails

- Do **not** change obstacle unlock levels or count formulas without an explicit request — they define
  the campaign's difficulty ramp and are baked into player expectations.
- Keep stone **colourless and unmatchable**; keep ice/chain **two-stage**. These identities are core.
- Any new obstacle should follow the same pattern: a `SHELL` id, an `INTRO` level, a count formula, and
  a one-time tutorial. See [LEVEL_PROGRESSION.md](LEVEL_PROGRESSION.md).
