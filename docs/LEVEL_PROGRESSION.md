# Level Progression

The campaign-wide schedule: what is introduced when, and how difficulty scales across 1..500. All
values are formula-derived in `LevelDatabase`.

---

## 1. Mechanic introduction schedule (`INTRO`)

| Level | Introduces | Tutorial key |
|---|---|---|
| 1 | Basics (shoot & match) | `basics` |
| 3 | **Bomb** special | `bomb` |
| 6 | **Rainbow** special | `rainbow` |
| 9 | **Fireball** special | `fireball` |
| 12 | **Lightning** special | `lightning` |
| 15 | **Ice** obstacle | `ice` |
| 22 | **Stone/crystal** obstacle | `stone` |
| 28 | **Chain/locked** obstacle | `locked` |

Each intro fires a **one-time tutorial**; seen-state persists in the save so it never repeats.

## 2. Colour introduction

| Levels | Colour count |
|---|---|
| 1–3 | 3 |
| 4–10 | 4 |
| 11–500 | 5 |

## 3. Bands

`band(n)`: **basic** (1–5), **obstacles** (6–20), **advanced** (21+). Used for tagging/tuning.

## 4. Difficulty & length scaling

| Quantity | Formula | Range |
|---|---|---|
| Difficulty | `1 + floor((n−1)/50)` | 1..10 |
| Cave sections (length) | `clamp(4 + floor((n−1)/12), 5, 9)` | 5..9 |
| Visible rows | `min(6 + floor((n−1)/7), 11)` | 6..11 |
| Fill ratio | `min(0.86 + n·0.0015, 0.95)` | 0.86..0.95 |
| Base ammo | tiered (`shotsFor`) | 48→33 |
| Generosity | tiered (`generosity`) | 1.0→0.33 |

## 5. Obstacle scaling

| Obstacle | First | Count formula (capped) |
|---|---|---|
| Ice | 15 | `min(2 + floor((n−15)/4), 12)` |
| Stone/crystal | 22 | `min(1 + floor((n−22)/10), 8)` |
| Chain/locked | 28 | `min(2 + floor((n−28)/6), 12)` |

## 6. Milestones (every 20 levels)

`milestone = (n % 20 === 0)`. A milestone level gets:
- A **themed shape** from `SHAPES` (`heart, star, diamond, butterfly, flower, spiral, cross, wave,
  hourglass, staircase`), cycling by `n/20`.
- A **reward pack** from `MREWARDS`, cycling by `n/20`:
  1. Bomb Cache! — `bomb ×3`
  2. Rainbow Boost! — `rainbow ×2`
  3. Lightning Strike! — `laser ×2`
  4. Fireball Pack! — `fireball ×3`
  5. Mega Reward Pack! — `bomb ×3, rainbow ×3, laser ×3, fireball ×3`

## 7. Bonus objects (optional)

Non-milestone levels where `n % 4 === 2` hide a bonus object from `['fish','turtle','chest','pearl',
'octopus']`. Rescuing it adds **+6% star progress** (exploration reward). It never blocks completion.

## 8. Representative walk-through

- **1–2:** 3 colours, no specials/obstacles — pure basics.
- **3–5:** bomb introduced; still 3–4 colours.
- **6–14:** rainbow, fireball, lightning introduced; colours reach 5.
- **15–21:** ice appears; milestone **20** (shape + Bomb Cache reward).
- **22–27:** stone appears.
- **28–40:** chains appear; milestone **40** (shape + reward #2).
- **41–100:** obstacle mixes deepen; ammo drops 44→40; milestones every 20.
- **101–200:** generosity 0.66, ammo 35; colour luck tightens.
- **201–500:** generosity 0.33, ammo 33, obstacle caps high, difficulty 5–10.

## 9. Guardrails

- **Never move an intro level** for an already-shipped mechanic — it retro-changes the campaign.
- **Never regenerate or reshape completed levels** (seeds are fixed for reproducibility).
- Extending past 500 is a `COUNT` bump; the schedule formulas continue naturally.

Cross-references: [LEVEL_DESIGN_GUIDE.md](LEVEL_DESIGN_GUIDE.md), [OBSTACLES_GUIDE.md](OBSTACLES_GUIDE.md),
[SPECIAL_BUBBLES_GUIDE.md](SPECIAL_BUBBLES_GUIDE.md), [GAME_BALANCING_GUIDE.md](GAME_BALANCING_GUIDE.md).
