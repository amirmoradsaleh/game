# Gameplay Rules

The definitive reference for every gameplay mechanic. Values reference `GameConfig` and the
gameplay modules; treat them as the source of truth.

---

## 1. Board & coordinates

- **Grid:** hexagonal, `BOARD.cols = 12` wide, `BOARD.rows = 60` tall. Only a **viewport** is ever
  visible; the camera climbs the tall stage.
- **Geometry:** logical view `540×960`. Horizontal cell spacing `d ≈ 41.6 px`, bubble radius
  `r ≈ 20.8 px` (drawn diameter ≈ d, so neighbours touch). Row height `≈ d·√3/2 ≈ 36 px`.
- **Ceiling:** `BOARD.top = 140` (below the HUD). Left/right inner margin `marginX = 10`.
- Each cell holds at most one `Bubble` (colour + optional special + optional shell/obstacle).

## 2. Colours & matching

- **5 colours:** red, blue, green, yellow, purple. Levels ramp **3 → 4 → 5** colours (3 for n≤3,
  4 for n≤10, 5 afterwards).
- **Match rule:** a fired bubble that lands adjacent to a **connected group of 3+ of the same colour
  pops** the whole connected group. Fewer than 3 stays on the board.
- After a pop, any bubbles no longer connected to the **ceiling row** become **floating** and **fall**.
- Match detection is a connected-colour flood from the landed cell; drop detection is a connectivity
  flood from the top. All match logic lives in `Board.resolve()`.

## 3. The launcher & bubble queue

- The launcher sits at the bottom centre. It shows the **current** bubble (top, at the launch point)
  and a **reserve** bubble (to the right, ~75% scale).
- **Swap:** tapping either the current or the reserve swaps them (a `swap` sound plays).
- **Colour policy (`BubbleQueue`):** the next colour is chosen by a **smart weighting** — it favours
  colours that have reachable clusters in the bottom band and overall, blended toward pure randomness
  by the level's **generosity** (1.0 very generous → 0.33 late-game). This keeps early levels fair and
  late levels demanding without ever changing the match rules.
- The launcher has subtle **idle life**: it gently floats, the queue "breathes", and an equipped
  special glows.

## 4. Aim system

- **Drag to aim.** The launcher rotates freely **upward** but never fires close to horizontal.
- **Minimum elevation:** `AIM.minElevation = 0.32 rad ≈ 18°` above the horizon on both sides.
- **Below the limit → aim is CANCELLED**: the angle stops updating, the **trajectory hides**, the aim
  arrow dims, and releasing **does not fire**. The player simply re-aims above the limit. (This
  prevents accidental near-horizontal shots.)
- **Trajectory guide:** colour-matched **rounded dots** (matching the current bubble), ~60% opacity,
  soft glow, that **shrink and fade toward the end** and **flow forward** (animated). It shows **wall
  reflections** and no explicit landing marker.
- **Guide == flight:** the guide and the real shot use the **same** collision routine, the **same**
  `STEP` sampling resolution, and the **same** Gap Assist, so *what the guide shows is what happens*
  including **after wall bounces**. The guide reflects off the walls at the **exact same centre bounds**
  (`minLeft/maxRight = marginX + r`) the real bubble uses, with the same collision radius, wall offset,
  reflection, `STEP` and float math — so a bank shot's dots trace the real path and the predicted
  collision point is always identical to the real one (verified: 0 divergences over 3,300+ bank shots,
  including 990+ multi-bounce, at shallow angles). The later part of the path past the first bounce is
  gently faded for aesthetics only. For polish, the **drawn dots** at each bounce are visually extended
  the last few pixels to the screen edge so the guide appears to touch the side wall with no gap (the
  bubble's edge contacts the wall directly left/right of the centre bounce point, at the same y). This
  is a **rendering-only** extension — it adds drawn dots and changes nothing about the predicted path,
  reflection point, collision point or any gameplay value.

## 5. Bubble flight

- **Speed:** `TIME.shotSpeed = 1200 px/s`, advanced in whole `STEP = 3.5 px` increments with a carried
  remainder (so collision sampling is frame-rate independent and matches the guide exactly).
- **Three-stage speed curve** (feel only — never affects where it collides): ease-in over the first
  10%, constant middle, gentle ease-out over the final ~18% before impact.
- **Wall reflection:** the bubble **centre** reflects at `minLeft = marginX + r` and
  `maxRight = W − marginX − r` (a bubble-radius from the frame). Reflection is a perfect mirror.
- **Rotation & squash:** a slight directional lean while flying, plus a tiny launch squash.
- **Snapping:** on collision (ceiling or a bubble), the bubble snaps to the **nearest valid empty
  hex cell** (`Board.nearestValidCell`), preserving hexagonal alignment.

## 6. Collision & Gap Assist

- **Collision hitbox:** `COLLISION.factor = 0.80` of the bubble diameter. A shot registers a hit when
  its centre comes within `0.80·d` of a placed bubble's centre. This is small enough that shots can
  **thread genuine gaps**, but large enough that a shot can **never squeeze between two touching
  bubbles** (solid areas always block).
- **Smart Gap Assist:** a very subtle fairness aid. When a shot only **grazes** a bubble (overlap
  within `GAP_ASSIST ≈ 1.9 px`) **and** the overlap is **decreasing** one `STEP` ahead (i.e. it is
  threading *past* the bubble), the collision is skipped and the shot continues. A **head-on** approach
  (overlap increasing) **always** collides, so solids and walls are never passed through. Effect: a
  few percent more "just made it" gap shots, essentially invisible to the player.
- The Gap Assist applies to both the **aim guide** and the **real flight**, but the real bubble is
  given a *hair* more grazing tolerance than the guide (`GAP_ASSIST_FLIGHT = GAP_ASSIST + ~3.5% of a
  bubble`, i.e. ≈ 3.4 px vs 1.9 px). This only ever makes the flight **more** forgiving than the aim
  line, never less — so **any gap the aim line shows as passable is always cleared by the real
  bubble**. It never shrinks the base `0.80` hitbox, never changes placed-bubble spacing, and (via the
  same grazing-past gate) never lets a shot through a solid pair or a wall. The aim-line rendering,
  length and reflections are unchanged.

## 7. Special bubbles (player-equipped)

- Specials are **equipped from the Ability Bar** (never spawned into the grid) and fired **instead of**
  the current bubble. See [SPECIAL_BUBBLES_GUIDE.md](SPECIAL_BUBBLES_GUIDE.md).
- Strategies (`SpecialEffects`): **bomb** clears everything within hex radius 2; **rainbow** adopts the
  dominant neighbour colour then matches normally; **rocket** clears the whole row; **fire** consumes an
  expanding flood of neighbours; **lightning** clears the whole column.

## 8. Obstacles

- **Ice** (from L15): a frozen casing; a neighbouring pop **cracks** it, a second **clears** it.
- **Stone / crystal** (from L22): a **colourless solid** blocker; cannot be matched — remove by popping
  around it until it is dislodged.
- **Chain / locked** (from L28): chained; a neighbouring pop **breaks the chain**, then it behaves as a
  normal bubble. See [OBSTACLES_GUIDE.md](OBSTACLES_GUIDE.md).

## 9. Combos, drops & feedback

- **Combo:** each consecutive **clearing** shot increments the combo; a non-clearing shot resets it.
  Combos add score and trigger tiered praise text (Nice! → Great! → Awesome! → Excellent! →
  Incredible! → Legendary!).
- **Drops:** disconnected groups fall with physics (gravity, spin, fade, tiny-bubble trail, splash).
- **Camera feedback in regular play is subtle** — a small shake scaled by match size. **Zoom punch and
  slow-motion are reserved for the winning shot** (and stars), never for ordinary matches.

## 10. Camera

- The camera eases **vertically** to keep the lowest filled row framed as the cluster shrinks (the
  cave "reveals" upward). It **settles** before a win is registered, so wins never trigger early.

## 11. Winning

The level is won when **the whole cave is cleared** (`Board.isEmpty()`) **and** the camera has reached
the summit and settled. On win:
1. Gameplay **freezes** briefly; a premium celebration plays (burst + sparkles, decorative bubbles
   falling with physics, sweeping light rays, camera **zoom punch**, ~0.15 s **slow-motion**, flash).
2. After the frame-timed sequence, the **"Level Complete!"** popup animates in.
3. **Stars light one-by-one** with a rising-pitch star sound; the third star gets the biggest flourish.
4. A **shot bonus** counts up (remaining shots as a presentational bonus).
5. Milestone levels grant a **reward pack** popup. The next level unlocks. See
   [STAR_SYSTEM.md](STAR_SYSTEM.md) and [PROGRESSION_SYSTEM.md](PROGRESSION_SYSTEM.md).

## 12. Losing

The level is lost when the player is **out of shots** (`moves ≤ 0`) with bubbles still on the board and
everything has settled (no flying/popping/falling in progress). A **failure** popup offers Retry or Map.
Losing does **not** reduce progress; the highest-unlocked level and earned stars are untouched.

## 13. Move budget (shots)

- Base ammo per tier (`shotsFor`): **48** (n≤20), **44** (n≤50), **40** (n≤100), **35** (n≤200),
  **33** (n≤500).
- The playable budget is `moves = clamp(max(shots + obstacleBonus, optimal + 4), 32, 200)`, where
  `optimal` is the solver's near-optimal solve. This guarantees every level is **clearable** with a
  fair buffer. See [GAME_BALANCING_GUIDE.md](GAME_BALANCING_GUIDE.md).

## 14. Bonus objects (optional objectives)

Some non-milestone levels (`n % 4 === 2`) hide a **bonus object** (fish/turtle/chest/pearl/octopus).
Popping the bubble covering it **rescues** it, which **adds progress toward stars** (+6%). It is purely
a reward for exploration; it never blocks completion.
