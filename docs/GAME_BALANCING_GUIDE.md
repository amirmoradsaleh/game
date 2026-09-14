# Game Balancing Guide

The knobs that control difficulty and reward, where they live, and the intended curve. All values are
formula-driven in `LevelDatabase` / `LevelManager` — tune the formula, not individual levels.

---

## 1. Difficulty curve at a glance

| Level range | Difficulty | Colours | Ammo tier | Generosity | Obstacles | Feel |
|---|---|---|---|---|---|---|
| 1–5 | 1 | 3→4 | 48 | 1.0 | none | Onboarding / basics |
| 6–14 | 1 | 4→5 | 48 | 1.0 | none | Learn specials (bomb/rainbow/fireball/lightning) |
| 15–20 | 1 | 5 | 48 | 1.0 | ice | First obstacle, milestone at 20 |
| 21–50 | 1 | 5 | 44 | 1.0 | ice, stone, chain intro | Obstacle mastery |
| 51–100 | 2 | 5 | 40 | 1.0 | scaling | Depth increases |
| 101–200 | 3–4 | 5 | 35 | 0.66 | scaling | Colour luck tightens |
| 201–500 | 5–10 | 5 | 33 | 0.33 | high caps | Expert campaign |

`difficulty = min(10, 1 + floor((n−1)/50))`.

## 2. Shots (ammo) per level

Base ammo by tier (`LevelDatabase.shotsFor`):

| Levels | Base ammo |
|---|---|
| 1–20 | 48 |
| 21–50 | 44 |
| 51–100 | 40 |
| 101–200 | 35 |
| 201–500 | 33 (never below 32) |

The **playable budget** is computed in `LevelManager`:

```
optimal      = greedy near-optimal solve of the generated board
obstacleBonus= extra shots granted for obstacles present
moves        = clamp( max(shots + obstacleBonus, optimal + 4), 32, 200 )
```

**Guarantees:** every level is clearable (`moves ≥ optimal + 4`), never punishingly short
(`≥ 32`), and never trivially infinite (`≤ 200`). The extra budget above `optimal` is what makes
efficient play (and thus higher stars) a skill expression rather than a coin flip.

## 3. Star difficulty

Stars are awarded at **win** from the live **multi-factor performance score** `P` (0..1) against
**adaptive thresholds** (see [STAR_SYSTEM.md](STAR_SYSTEM.md)):

```
P = 0.45·bubblesCleared + 0.25·shotsRemaining + 0.20·combo + 0.10·score  (+0.06 if bonus rescued)
thresholds(n) = [ 0.34 + diff·0.05 , 0.62 + diff·0.08 , 0.88 + diff·0.07 ]   diff = (n−1)/220
stars = 3 if P ≥ t3 ; 2 if P ≥ t2 ; else 1
```

- **Generous early, demanding late:** thresholds rise with level, so the same play earns more stars in
  early levels and fewer deep in the campaign.
- **Multi-factor by design:** clearing the board is the dominant factor (45%), but a **skilled player
  who uses a few extra shots can still earn stars** via combos, score and the bonus rescue.
- A legacy **efficiency-based** star function still exists (`LevelManager.starsFor`: 3★ ≤ 2.0×optimal,
  2★ ≤ 2.8×optimal) using each record's `starThresholds`. The **live progress `P`** is what the win
  screen uses; keep both consistent if you retune.

## 4. Combo rewards

- Each consecutive clearing shot raises the combo; a non-clearing shot resets it.
- **Score:** `base = popped·10 + fell·15`, multiplied by `(1 + (combo−1)·0.25)` — combos compound.
- **Big drops:** groups of **8+** falling bubbles add a bonus (`fell·20`) and a "COMBO DROP!" flourish.
- Combos feed the **star progress** (20% weight, `min(1, maxCombo/5)`), so chaining is a real path to stars.
- **Feedback stays tasteful:** regular matches use only a small camera shake; **zoom/slow-motion are
  reserved for the winning shot**.

## 5. Player progression pacing

- **Unlock:** completing level `n` unlocks `n+1` (best-star record kept). No lives/energy gate exists.
- **Specials granted on unlock:** the first time each special is available it is granted once
  (`unlockSpecial`), then **milestones** (every 20 levels) top up the inventory with reward packs.
- **Generosity ramp** (`generosity(n)`: 1.0 ≤100, 0.66 ≤250, 0.33 ≤500) is the quiet difficulty dial —
  it controls how often the queue hands the player useful colours, without ever changing rules.

## 6. Early / mid / late balancing intent

- **Early (1–20):** teach one thing at a time. Full ammo (48), maximum generosity, obstacles arrive
  only at 15 (ice). Stars should feel achievable to build confidence.
- **Mid (21–100):** obstacle combinations and slightly tighter ammo (44→40). Generosity still 1.0.
  Specials become genuinely useful; milestones keep the inventory stocked.
- **Late (101–500):** five colours with **reduced generosity** (0.66→0.33) and lower ammo (35→33) plus
  higher obstacle caps. This is where efficiency, combos and special usage separate skilled players.

## 7. Retuning checklist

1. Change the formula in `LevelDatabase` / `LevelManager` (never individual shipped levels).
2. Re-run all headless suites (`test.systems/logic/flow/climb/hud/assets`, `smoke`, `stress`).
3. Confirm `moves ≥ optimal + 4` still holds and the solver still solves.
4. Spot-check star reachability at a few levels across bands.
5. Verify 60 FPS is unaffected (no new per-frame allocations).
