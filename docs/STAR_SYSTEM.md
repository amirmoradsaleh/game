# Star System

Bubble Quest Legends shows a **live star-progress bar** during play and awards **1–3 stars** at level
completion from a **multi-factor performance score**. This replaces "discover your result at the end"
with constant, motivating feedback. Implemented in `Game.js`; the star DOM/save lives in `SaveManager`.

---

## 1. The progress bar (top HUD)

- A compact bar sits in the **top bar, centred between the "Level" chip and the pause button**, with
  **three stars** positioned above it at the level's adaptive thresholds.
- The fill reflects the live performance score `P` (0..1) and **only ever moves forward** (it latches to
  the best-so-far during play). It animates smoothly with **`ease-out`** (no jumps), a soft glow and an
  animated shine.
- As the fill reaches each star's threshold, that star **lights up** with a small pop, a **sparkle**,
  and a **rising-pitch star sound** — so the player always knows how close the next star is.
- The bar is only visible while **PLAYING**.

## 2. Multi-factor performance score `P`

Computed each HUD update by `Game._computeProgress()`:

```
initial   = bubbles present at level start
cleared   = clamp((initial − bubblesNow) / initial, 0, 1)          # completion
shots     = clamp(movesLeft / movesBudget, 0, 1)                    # efficiency
combo     = clamp(maxCombo / 5, 0, 1)                               # skill
score     = clamp(score / (initial · 12), 0, 1)                     # output

P = 0.45·cleared + 0.25·shots + 0.20·combo + 0.10·score
if bonus rescued: P += 0.06
P = clamp(P, 0, 1)
```

**Weighting rationale** (matches the design brief):
- **45% remaining bubbles** — clearing the board is the dominant driver (reaches 1.0 at completion).
- **25% remaining shots** — rewards efficiency, but only a quarter, so a few extra shots don't sink you.
- **20% combo** — chaining is a real path to stars.
- **10% score** — overall output.
- **+6% bonus rescue** — exploration is rewarded.

This lets **skilled players earn stars even with a few extra shots**, exactly as intended.

## 3. Adaptive thresholds

`Game._progressThresholds()`:

```
diff = clamp((levelNumber − 1) / 220, 0, 1)
thresholds = [ 0.34 + diff·0.05 ,  0.62 + diff·0.08 ,  0.88 + diff·0.07 ]
```

- **Early levels are generous** (≈ 0.34 / 0.62 / 0.88); **harder levels demand more** (up to ≈ 0.40 /
  0.70 / 0.95). The star markers on the bar are positioned at these percentages.

## 4. Star award at level completion

`Game._win()` computes the final stars from `P` at the end state (board empty → `cleared = 1.0`, plus
final shots/combo/score/bonus):

```
stars = clamp( P ≥ t3 ? 3 : P ≥ t2 ? 2 : 1 , 1, 3 )
```

- Minimum **1 star** on any completion. The result feeds the existing star display/save.
- **Level-complete sequence:** the bar freezes, stars fly in **one by one** (rising-pitch star sound +
  sparkle), and the **third star** gets the biggest celebration. A **shot bonus** counts up (remaining
  shots as a presentational number). See [ANIMATION_GUIDE.md](ANIMATION_GUIDE.md).

## 5. Relationship to the legacy efficiency stars

`LevelManager.starsFor(shotsUsed, optimal, bonusFound)` still exists (3★ ≤ `2.0×optimal`, 2★ ≤
`2.8×optimal`, using each record's `starThresholds`). The **live `P`** is the source used by the win
screen. If you retune one, keep both broadly aligned so the bar's promise matches the award.

## 6. Persistence

- Stars are stored per level in `SaveManager.data.stars["<n>"]` (best kept). `recordResult(n, stars)`
  clamps to 1..3, keeps the max, and unlocks the next level. See [SAVE_SYSTEM.md](SAVE_SYSTEM.md).

## 7. Guardrails

- **Do not remove the star system** or change the 1–3 range / save shape.
- Keep the progress bar **forward-only** and **ease-out**; keep strong star celebrations **only** at
  win (per the animation language).
- If you change weights or thresholds, re-verify with `test.hud.js` (which asserts the thresholds are
  ascending/generous-early and that `P` behaves) and confirm reachability across bands.
