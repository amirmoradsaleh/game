# Bubble Quest Legends — King-style redesign

A modern mobile bubble shooter: a polished Main Menu, a 100-level path Map with
sequential unlocking and 1–3 star ratings, and vertical-climb levels with a
dynamic camera and a circular shooter HUD. Everything ships as a single self-contained
`dist/index.html` (HTML5 Canvas + vanilla JS), with the official bubble sprites
and the underwater scene inlined.

## Play
Open `dist/index.html` (desktop or mobile). Flow: **Main Menu → Level Map →
Level → Results → Map**.

- **Main Menu** — PLAY, COLLECTION, SETTINGS. PLAY opens the Level Map (the game
  never starts a level directly).
- **Level Map** — 100 levels along a path. Only unlocked levels are playable;
  locked levels are greyed out; completed levels show their best 1–3 stars. The
  next level unlocks only after clearing the previous one. Progress is saved.
- **Aim & fire** — drag to aim (a glowing trajectory line shows wall bounces but
  is a thin glowing DOTTED line that ends before impact — wall reflections shown,
  no ghost bubble, so the exact landing is estimated), release to shoot.
- **Vertical shooter HUD** — current bubble on top (glowing), the remaining-shot
  count in a centre ring, and the next bubble below at ~75% scale. Tap either
  bubble to swap (200–300ms cross-over); Next auto-advances after each shot. No
  manual switch button.
- **Special balls are tools** — Bomb / Rainbow / Laser / Fireball are equipped
  from the Ability Bar; they never spawn in the board. New mechanics (ice at 6,
  locked/caged at 21, crystals at 40) each show a one-time tutorial.
- **Win** — clear the whole board. **Lose** — run out of shots with bubbles left.

## Core logic

- **Connected-cluster matching (the critical fix).** A shot only removes the
  connected same-colour cluster it joins (flood fill from the landing cell) — it
  never clears same-coloured bubbles elsewhere on the board. Unsupported bubbles
  then detach and fall. (Rainbow is a deliberate player *tool*, separate from
  normal matching.)
- **Dynamic climb camera.** Each level is a tall vertical cave; only the bottom
  is visible at first. As the bottom clears (or an island collapses) the camera
  eases upward, revealing new formations — the top is never shown at the start.
  Win only after clearing the whole cave and reaching the summit.
- **100-level progression** (`Progression.js`) — deterministic recipes by band:
  1–5 basic colours (no obstacles), 6–20 ice, 21+ locked then crystals, with
  colours ramping 3→4→5 and obstacle counts growing with depth.
- **Deterministic stars** (`LevelManager`) — each level is solved by a greedy
  near-optimal estimator at load time; the move budget is `~2.4×` that optimum
  (so every level is clearable) and stars are awarded by shots used vs optimum
  (≤1.3× → 3★, ≤1.9× → 2★, else 1★). Never randomised.
- **Save / unlock** (`SaveManager`) — localStorage with an in-memory fallback;
  stores the highest unlocked level, best stars per level, and seen tutorials.
- **Board is +1 column wider (12), denser, with slightly smaller bubbles.**


## Special inventory, milestones & rewards
- **Persistent special inventory.** Bomb / Rainbow / Lightning / Fireball are a
  saved, accumulating pool (never in the colour queue). Tap one below the shooter
  to arm it; the next shot fires it and one charge is deducted from the saved
  inventory. Starting stock is granted; milestone levels top it up.
- **Handcrafted milestone levels** every 20th level (20/40/60/80/100) use a
  recognisable silhouette hung from a ceiling chain — heart, star, diamond,
  butterfly, flower — with bigger colour clusters (bigger chains) and slightly
  higher difficulty, so they instantly read as special. Milestone nodes are
  marked with a gold star on the map.
- **Milestone rewards** are granted once on completion and shown in a reward
  popup: L20 Bomb×3, L40 Rainbow×2, L60 Lightning×2, L80 Fireball×3,
  L100 a Mega Pack.
- **Organic generation.** Regular climbs are carved to ~55–80% density with
  curved edges, gaps and islands (never solid rows), while two full-height
  "spine" chains keep the whole cave anchored so it always climbs.


## Shooter UI, rainbow & progressive unlock
- **Shooter layout** (raised clear of the special inventory): Current bubble on
  top (glowing), a larger remaining-shots ring below it, and the Reserve bubble
  to the RIGHT of the ring (~75% scale). Tap either bubble to swap (~250ms
  cross-over). Clear spacing, nothing overlaps.
- **Rainbow = true wildcard.** On landing it adopts the colour of the group it
  touches and clears only that CONNECTED group via normal matching — it never
  removes a colour board-wide.
- **Progressive unlock.** Early levels are normal bubbles only; specials and
  obstacles are introduced gradually — Bomb (L3), Rainbow (L6), Fire Ball (L9),
  Lightning (L12), Ice (L15), Stone (L22), Locked (L28) — each granted into the
  persistent inventory on unlock. Every new mechanic shows a one-time tutorial
  popup (large icon, name, short explanation, Got it) that never repeats.


## Rewarding & monetization pass
- **Easier, multi-factor stars.** Completing a level is 1 star; finishing with a
  reasonable number of shots left is 2; efficient play OR finding the level's
  hidden bonus objective is 3. Early/mid levels award 3 stars frequently.
- **Hidden bonus objectives** in some levels (rescue a fish/turtle/octopus, open
  a chest, reveal a pearl). Popping the hidden target shows "BONUS STAR FOUND!",
  awards a large score bonus and guarantees 3 stars — encouraging replay.
- **Smart bubble generator.** Upcoming colours are weighted toward colours the
  player can actually use (reachable clusters near the bottom + overall counts),
  scaled by a difficulty-tier generosity (1-100 very generous → 500+ random).
  It never guarantees a colour — only raises the odds — so it stays fair.
- **Generous, dynamic shot budget** derived from the near-optimal solve, the
  difficulty tier and obstacles (very generous early, tightening later) so
  beginners have room for mistakes.
- **Premium aim guide:** a thin, softly glowing full-length trajectory (~60%
  opacity) with wall reflections, drawn all the way to the predicted landing —
  no ghost bubble or marker, so the player estimates the exact spot.
- **Free ×3 on unlock** for every special, then no auto-refill.
- **Rewarded-video architecture** (placeholder `RewardedAdManager`, AdMob-ready):
  when a special hits 0 the in-level slot and the Power-Ups menu show
  "Watch Video +3"; on reward the saved inventory gains +3.
- **Power-Ups menu** on the main menu lists every special with its saved count
  and a Watch Video button when depleted.
- **Saved inventory** persists across levels and sessions (localStorage); future
  rewarded ads simply increase the saved values.


## UX polish
- **Redesigned pause menu** — large rounded icon buttons (Continue ▶, Restart ↻)
  plus a subtle Exit-to-Menu button, with smooth pop-in / pop-out animation.
- **In-game tutorials** — new mechanics are taught DURING play, the moment the
  player first meets them (never before the level). The game auto-pauses, the
  board darkens, the new object gets a glowing outline + an animated pointer (or
  the special's inventory slot glows), and a small bottom card explains it with
  a "Got it!" button. Each mechanic is shown once per lifetime and never again.


## Persistent levels & scalable database (1-500)
- **Fixed seed per level.** Generation runs under a deterministic PRNG seeded
  from the level number, so every level always produces the exact same layout —
  restarting or revisiting reproduces it identically, and every player sees the
  same version. (Runtime randomness like the shot queue stays live.)
- **LevelDatabase** is the single source of truth for levels 1-500: each record
  holds seed, difficulty, colour distribution, special & obstacle availability,
  camera length (climb sections), ammo/"bubble count", star thresholds, rewards
  and queue generosity. Gameplay, UI, stars, rewards, generation and the map all
  read from it — extending to 501-1000 later only means raising COUNT.
- **Ammo rebalance by tier** (the player's shot budget): L1-20 ~48, L21-50 ~44,
  L51-100 ~40, L101-200 ~35, L201-500 ~33 — never below 32, always enough to
  clear (verified 100% clearable across the range).
- **Virtualized map.** The map renders the first 50 buttons, then dynamically
  loads the next 20 as the player scrolls (cached, capped at 500) to stay light
  on low-end devices. Level 1 is at the top; the map auto-scrolls to the highest
  unlocked level on return. Locked levels are disabled; completed levels show
  their earned stars.


## Premium world map (Candy Crush-style)
- **Reversed direction** — Level 1 sits at the BOTTOM; higher levels climb
  upward, so the player scrolls up to progress (numbers are not reversed).
- **Auto-focus** — opening the map (returning from a level) snaps to the highest
  unlocked level, positioned slightly above the bottom so a few completed levels
  show beneath it. Never opens at Level 1 unless the player is new.
- **Remembers position** — the last browsed map position (centred level) is saved
  and restored on return, even after restarting.
- **True virtualization** — nodes are absolutely positioned by level, so only the
  visible window exists in the DOM (pooled/recycled, never recreated) for smooth
  60fps scrolling on low-end devices.
- **Infinite scroll, no jump** — starts with 50 levels; nearing the top reveals
  the next 20 with a tiny bottom-loading dots indicator, growing the list ABOVE
  the view and shifting scroll by the same delta so the view never jumps.
- **Snake path + decorations** — a gently curving path with connector dots and
  purely-decorative environment objects (rocks, plants, coral, crystals,
  seaweed, bubbles) that never block the level buttons.
- **Saved progress** — highest unlocked level, per-level stars, last map
  position, current level and claimed rewards all persist across restarts.


## Level Map (rebuilt)
Note: level nodes are absolutely positioned, so the scroll container is forced
to full width (`#mapScreen{align-items:stretch}` + `.map-scroll{align-self:stretch;width:100%}`)
to avoid a width-collapse that previously pushed the buttons off-screen.
The map was rebuilt for reliability: every loaded level is a real, bottom-anchored
DOM button on a curved snake path (Level 1 at the bottom, higher levels upward).
Nodes are append-only and never recreated; the browser virtualizes off-screen
ones via CSS `content-visibility`, so buttons are always present and cheap.
Initial load is 50 levels; scrolling near the top loads the next 20 with a small
top spinner, growing the track upward and shifting scrollTop by the same delta so
the view never jumps. Highest unlocked level auto-focuses on open; last position,
loaded batches, stars, unlocked level and current level all persist.


## UX polish pass
- **Map always opens on the current level** — the highest unlocked / level you're
  on is centred (a bit above the bottom), ignoring any previous manual scroll,
  with a smooth ~0.5s eased scroll instead of a jump.
- **Aim guide** originates from the launcher mouth (offset above the ball with a
  small gap), ~60% opacity, wall reflections, trajectory line only (no landing marker).
- **Premium win sequence** — brief freeze, staggered explosion bursts + sparkles,
  decorative bubbles falling with physics, sweeping light rays, camera shake and
  victory sound, then the results popup pops in with stars appearing one-by-one
  and a shot-bonus count-up (presentation only; scoring/rewards unchanged).
- **Animation polish** — press/scale feedback on buttons and level nodes, panels
  and popups scale/fade in, on top of the existing pop-scaling and landing
  squash-and-stretch.

## Aim angle limit
The launcher rotates freely upward. If the player aims below ~18° above the
horizon (`GameConfig.AIM.minElevation`) the aim is CANCELLED: the angle stops
updating, the trajectory line hides, the aim arrow dims, and releasing fires
nothing — the player simply re-aims above the limit. This prevents accidental
near-horizontal shots.

## Game-feel (juice) pass
Presentation-only polish (no gameplay/generation/progression changes):
- **Shooting**: pitched shoot SFX, muzzle flash, launcher recoil spring, glow trail.
- **Collision**: soft impact flash + water-splash particles + pitched click, landing squash.
- **Popping**: bubbles expand before vanishing, plus burst shards, water splash, rising
  mini-bubbles, sparkles and a soft glow flash; pop pitch varies (bigger match = lower).
- **Falling**: spin, fade-out, a trail of tiny bubbles, and soft falling SFX.
- **Camera**: match-scaled shake, a zoom pulse on medium+ clears, and ~0.15s slow-motion
  on big combos/drops.
- **Combos**: tiered praise text (Nice!→Legendary!) that scales, glows and fades, with
  richer combo SFX.
- **Aiming**: trajectory now fades gradually toward the end (glow, ~60%, reflections).
- **Stars**: light up one-by-one with a rising-pitch star sound, sparkle and bounce; the
  third star adds an extra flash + shake.
- **Level complete**: freeze, staggered bursts, falling bubbles, light rays, zoom + shake,
  bonus count-up, then a dramatic popup entrance.
- **Background**: more rising bubbles, gentle sway, and a slow additive light shimmer.
- **UI**: press/scale feedback, popup scale/fade, pause slide, reward bounce.
- **Audio**: randomized pitch for shoot/pop/fall/UI; richer sounds for large combos.
- **Performance**: reuses the pooled particle system (hard cap), no new per-frame allocations;
  measured 60 FPS in-browser.

## Collision & flight polish
- **Reduced collision hitbox** (`GameConfig.COLLISION.factor`, 0.86→0.80 of the
  bubble diameter) so shots thread narrow gaps precisely, while solid rows still
  block (a shot centre still can't fit between two touching bubbles). Grid
  snapping and match logic are unchanged.
- **Three-stage flight** — slight ease-in over the first 10%, constant middle,
  gentle ease-out over the final ~18% before impact (path length is precomputed
  at launch), plus a small directional lean and a tiny launch squash.
- **Idle micro-polish** — the launcher gently floats, the bubble queue breathes,
  equipped specials glow softly, and the PLAY button pulses slightly.

## Animation style unification
A tone-down pass to a single, premium animation language — fast, subtle, ease-out
(no overshoot/bounce), with stronger effects reserved for two moments only:
- **Everywhere:** landing squash reduced to ~5%, pop expands only ~7% (settles in
  ~150ms), bubble spawn uses ease-out (no back-overshoot), falling spin softened,
  and regular matches use a gentle shake — no zoom or slow-motion. All UI/CSS
  overshoot curves were replaced with easeOutCubic and durations tightened
  (micro ~100ms, pop ~150ms, UI ~200–250ms).
- **Winning shot (allowed to be big):** camera zoom punch, ~0.15s slow-motion,
  flash, shake, light rays, particle burst + splash, remaining bubbles fall, and
  a premium "Level Complete!" entrance.
- **Star reward (allowed a small bounce):** stars light up one-by-one with a
  rising-pitch star sound, sparkle and a small bounce; the third adds an extra
  flash + shake.

## Aim guide & Smart Gap Assist
- **Aim guide** — the arrow head is gone; the guide is now colour-matched rounded
  dots (matching the current bubble) with a soft outer glow, ~60% opacity, that
  shrink and fade toward the end and flow forward continuously (energy toward the
  target). It reflects right at the play-field edge (`previewPath(wallL,wallR)`)
  so there's no gap at the wall, while the real flight keeps its physically-correct
  centre bounce. Still hidden when the aim is cancelled below the min angle.
- **Smart Gap Assist** — `Shooter._shouldCollide` forgives an overlap of only
  ~1px (`GAP_ASSIST`) when the bubble is grazing PAST a bubble (overlap decreasing
  along its path — i.e. threading a gap). A head-on approach (overlap increasing)
  always collides, so solid masses and walls are never passed through and the
  collision radius itself is unchanged. Applies to both the flight and the guide.

## Guide/flight unification
The aim guide and the real shot now run through **one** collision routine, so the
prediction is exact:
- Both call `previewPath()` / `update()` which step at the **same shared resolution**
  (`Shooter.STEP`), reflect off the **same wall bounds** (`minLeft/maxRight`), and use
  the **same** `_shouldCollide` gap-assist with an identical fixed look-ahead.
- The flight advances in **whole STEP increments with a carried remainder**, so its
  collision samples land on the exact same grid the guide draws — independent of frame
  rate. Verified: 0 divergences over 2,400 shots across 30 levels with jittered dt.
- Gap assist nudged up very slightly (`GAP_ASSIST` 1.5→1.9) — still a ~1px grace, only
  ever forgiving a grazing overlap that is decreasing along the path; head-on approaches
  and walls always collide.

## Guide wall-alignment (render only)
The aim guide now visually touches the side walls without any change to physics.
`previewPath()` still reflects the centre path at `minLeft/maxRight` (identical to
the flight — consistency preserved) and just records the exact contact vertex.
`_drawTrajectory` then warps the dots toward the wall over the last ~26px so the
line reaches the edge, tightens dot spacing near the wall, and places one crisp
dot exactly on each wall-contact point — so the reflection reads as one continuous
line. Colour, glow, rounded dots, ~60% opacity and end-fade are unchanged. Landing
prediction is untouched: 0 divergences over 1,190 mixed shots.

## Aim guide wall fix + star-progress bar
- **Aim guide** — reverted the "warp toward the wall" that was bending the line at
  a bounce; the guide is again a clean straight reflection at `minLeft/maxRight`
  (exactly matching the ball's path). Bubble-colour dots, soft glow, animated flow
  and end-fade are unchanged.
- **Top star-progress bar** — a premium underwater bar with three stars sitting at
  the level's adaptive thresholds. Fill (`ease-out`, glow, shine) reflects a
  multi-factor performance score — 45% bubbles cleared, 25% shots remaining, 20%
  combo, 10% score, plus a bonus for rescuing the hidden object — and only ever
  moves forward. Each star lights one-by-one with a pop, sparkle and rising star
  sound as it's reached. Thresholds are generous early and demand more on harder
  levels. At level end the same score awards 1–3 stars into the existing star/save
  system (win popup, map, save all unchanged).

## Aim guide reaches the wall + compact progress bar
- **Aim guide** — the drawn line now reflects near the frame edge (`previewPath`
  accepts optional render bounds), so it reaches the wall instead of stopping a
  bubble-radius short (gap ~31px → ~5px). It stays clean and straight (no bending).
  The pre-bounce leg is identical to the real shot, and the faint post-bounce hint
  fades quickly. The flight/collision still use the true centre bounds, so gameplay
  and guide/flight landing consistency are unchanged.
- **Progress bar** — moved into the top bar, centred between the level chip and the
  pause button, made noticeably smaller (168px, 8px track, 13px stars) and cleaner
  (tighter gradient, subtle border, soft blue glow, animated shine). Same live
  multi-factor star logic.

## Top bar compaction
The Level chip and the star-progress bar were both shrunk and aligned on one row
(chip ~31px tall, 16px label; bar 150px wide, 7px track, 12px stars), with the bar
centred between the level chip and the pause button and a brighter track border so
it reads clearly against the dark background.

## Build & test
    node build.js          # concatenate src/ -> dist/index.html (single file)
    node test.logic.js     # board rules (match, float/collapse, specials, obstacles)
    node test.systems.js   # matching FIX, progression, static gen, stars, save, queue
    node test.flow.js      # menu -> map -> level -> win -> unlock -> next -> lose
    node test.climb.js     # dynamic camera: starts at bottom, climbs, summit win
    node test.hud.js       # shooter layout (current/ring/reserve) + progressive unlock
    #                        (systems/flow also cover inventory, milestones, rewards)
    node test.assets.js    # sprites, scene image (clipped to frame), ambient layer
    node smoke.js / stress.js   # full Game with DOM stubs

## Visuals
Official bubble sprites (centralised in `BubbleSprites`, `yellow→gold`), the
underwater scene (`BackgroundImage`) shown via CSS `cover` clipped to the game
frame only (solid dark margins around it), and a subtle ambient bubble layer
behind gameplay. See the asset test for the guarantees these uphold.

## Ship to Android
One self-contained HTML file — wrap `dist/index.html` in Capacitor/Cordova or a
full-screen WebView. The 540×960 portrait canvas scales to any screen; input is
unified mouse/touch. Progress persists via localStorage.
