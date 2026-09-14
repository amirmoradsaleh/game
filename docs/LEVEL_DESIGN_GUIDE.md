# Level Design Guide

How the 500 levels are designed, why, and how difficulty grows. Levels are **not hand-authored** —
they are **derived by formula** from `LevelDatabase.get(n)` and **generated deterministically** from a
per-level seed. This document explains that system so a designer can tune it confidently.

---

## 1. Design philosophy

- **Deterministic, formula-driven:** every field of a level is computed from its number `n`. There are
  no per-level JSON files to maintain; balancing is centralised in a handful of formulas.
- **Reproducible:** each level carries a fixed `seed = Utils.seedFor(n)`; `LevelGenerator` runs under
  `Utils.withSeed(seed, …)`, so the exact same cave is produced for every player, every time.
- **Always solvable:** `LevelManager` runs a greedy near-optimal solver on the generated board and sets
  the move budget to guarantee clearability with a fair buffer.
- **Gentle onboarding, escalating mastery:** mechanics are introduced one at a time with a one-time
  tutorial; difficulty then scales smoothly across the campaign.

## 2. Anatomy of a level record (`LevelDatabase.get(n)`)

| Field | Meaning |
|---|---|
| `number`, `seed` | Identity + deterministic generation seed. |
| `difficulty` | `1 + floor((n−1)/50)`, capped at 10. |
| `band` | `basic` (n≤5), `obstacles` (n≤20), `advanced` (21+). |
| `allowedColors` | Colour palette slice (3 → 4 → 5). |
| `generation` | `{ rows, fillRatio, minClusterSize:3, maxClusterSize:6 }`. |
| `obstacles` | `{ ice, locked, crystal }` counts (0 until introduced, then scale). |
| `abilities` | Special availability (solver reference; real counts live in save). |
| `stage` | Camera height / cave length + generation params (`sections`, `sectionRows`, colour range, clusters, obstacle caps). |
| `shots` | Base ammo tier (`shotsFor`). |
| `starThresholds` | `{ efficientMult: 2.0, okMult: 2.8 }` (legacy efficiency stars). |
| `rewards` | Milestone reward pack (every 20th level) or `null`. |
| `generosity` | Queue colour policy strength (1.0 → 0.33). |
| `milestone`, `shape`, `bonus`, `newMechanic` | Flags for milestone shapes, hidden bonus objects, and mechanic intros. |

## 3. Layout philosophy

- **Vertical cave:** each level is a **tall cave** made of `stage.sections` stacked sections
  (`sectionRows = 5` each), so the camera climbs a longer shaft as levels progress
  (`sections = clamp(4 + floor((n−1)/12), 5, 9)`).
- **Bottom-heavy start:** a `bottomCluster` (~4) seeds the reachable action near the launcher; a
  `topCluster` (~3) rewards the climb.
- **Fill ratio:** `fillRatio = min(0.86 + n·0.0015, 0.95)` — caves get slightly denser with depth.
- **Rows visible per screen:** `rows = min(6 + floor((n−1)/7), 11)` shapes how packed the visible band is.
- **Cluster sizing:** clusters are kept in the **3–6** range so there is always a legible, matchable
  structure rather than random noise.
- **Milestone shapes:** every 20th level renders a **themed shape** (`heart, star, diamond, butterfly,
  flower, spiral, cross, wave, hourglass, staircase`) for a memorable landmark.

## 4. Colour progression

| Levels | Colours |
|---|---|
| 1–3 | 3 (red, blue, green) |
| 4–10 | 4 (+ yellow) |
| 11–500 | 5 (+ purple) |

Fewer colours early makes matches obvious and teaches the core loop; five colours later increases the
planning depth. The **queue generosity** further softens/hardens colour luck by tier.

## 5. Obstacle progression

Obstacles are introduced one at a time, then their **maximum count scales with depth** (capped):

| Obstacle | First level | Count formula (capped) |
|---|---|---|
| **Ice** | 15 | `min(2 + floor((n−15)/4), 12)` |
| **Stone/crystal** | 22 | `min(1 + floor((n−22)/10), 8)` |
| **Chain/locked** | 28 | `min(2 + floor((n−28)/6), 12)` |

See [OBSTACLES_GUIDE.md](OBSTACLES_GUIDE.md) for behaviour and [LEVEL_PROGRESSION.md](LEVEL_PROGRESSION.md)
for the full intro schedule.

## 6. Special-tool availability

The record's `abilities` map reflects what specials are **available** at level `n` (used by the solver
and to gate tutorials). Real player counts are the **save inventory**, granted as specials unlock and
topped up by milestones:

| Special | Available from | Tutorial |
|---|---|---|
| Bomb | 3 | `bomb` |
| Rainbow | 6 | `rainbow` |
| Fireball (fire) | 9 | `fireball` |
| Lightning (laser) | 12 | `lightning` |

## 7. Milestones & rewards

- Every **20th level** (`n % 20 === 0`) is a **milestone**: a themed shape + a **reward pack**
  (`MREWARDS`, cycling through Bomb Cache, Rainbow Boost, Lightning Strike, Fireball Pack, Mega Pack).
- **Bonus objects** appear in some non-milestone levels (`n % 4 === 2`): a hidden `fish/turtle/chest/
  pearl/octopus`. Rescuing it adds star progress (exploration reward).

## 8. Extending the game

- **More levels:** raise `COUNT` in `LevelDatabase`. All fields are formula-derived, so 501..1000 (or
  beyond) generate automatically. The map virtualization already supports arbitrary counts.
- **New mechanics:** add to the `INTRO` schedule and the relevant generation/obstacle logic; **do not**
  retro-fit new mechanics into already-shipped low levels (see [CLAUDE_RULES.md](CLAUDE_RULES.md)).
- **Tuning:** adjust the formulas (`shotsFor`, `generosity`, obstacle caps, `fillRatio`, `sections`).
  Because levels are deterministic, verify changes against the headless suites before shipping.

## 9. Guardrails

- **Never change a level's seed or number** — that silently reshapes a shipped level.
- **Never reduce the move budget below the solver's `optimal + 4`** — levels must stay clearable.
- Keep cluster sizes and fill ratios within the tested ranges to preserve readability and 60 FPS.
