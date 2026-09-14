# Animation Guide

The unified animation language. The guiding principle: **everything is fast, subtle and ease-out**,
with **strong celebrations reserved for exactly two moments** — the **winning shot** and the **star
reward**. The player should feel the polish without consciously noticing individual animations.

---

## 1. Animation philosophy

- **Fast, lightweight, responsive, smooth, elegant, premium.**
- **Avoid:** large bouncing, rubber/elastic, oversized squash & stretch, slow tweens, cartoon
  exaggeration, overshoot.
- **Use ease-out, no overshoot** — canonical CSS curve `cubic-bezier(.33, 1, .68, 1)` (easeOutCubic).
  The **only** overshoot curves permitted anywhere are the **star bounce** and the **win entrance**.

## 2. Timing budget

| Category | Duration |
|---|---|
| Micro interactions (press, land) | 60–100 ms |
| Bubble pop | 120–180 ms (~150 ms) |
| UI transitions (popups, panels) | 180–250 ms |
| Large celebrations (win, stars) | 400–700 ms |

## 3. Gameplay micro-animations (subtle)

- **Shooting:** pitched shoot SFX, small **muzzle flash**, launcher **recoil** spring, colour-matched
  **glow trail** behind the moving bubble.
- **Flight:** three-stage speed curve (ease-in 10% / constant / ease-out ~18%) — feel only; a slight
  directional lean; a tiny launch squash.
- **Collision (landing):** **~5%** squash settling in ~100 ms (no rebound), a small impact flash, a
  soft water splash, tiny bubbles, a pitched impact click.
- **Popping:** expands only **~7%** then quick-fades over ~150 ms; burst shards + splash + rising
  mini-bubbles + sparkles + a soft glow flash. Bigger matches → stronger flash and lower pop pitch.
- **Falling:** gentle spin (±2 rad/s), fade-out, a trail of tiny bubbles, splash on the floor, soft
  falling SFX.
- **Bubble spawn:** ease-out (no back-overshoot).

## 4. Camera feedback

- **Regular matches:** a small **shake** scaled by match size only. **No zoom, no slow-motion** during
  ordinary play.
- **Combos:** subtle shake + tiered praise text; audio gets richer. Big drops (8+) add a slightly
  stronger shake + a "COMBO DROP!" flourish — still no zoom/slow-mo.

## 5. Combo praise text

Tiered floating text that scales in, glows and fades: **Nice! → Great! → Awesome! → Excellent! →
Incredible! → Legendary!**, keyed to combo size; fast and clean (not a "celebration").

## 6. Aim guide animation

- Rounded dots **flow forward** continuously (energy toward the target), shrink and fade toward the
  end, ~60% opacity, soft glow. Lightweight enough to hold 60 FPS.

## 7. Progress bar & stars (in-play)

- Fill animates **ease-out**, forward-only, with glow + animated shine. Each star **lights one-by-one**
  with a small **bounce** (the only in-play bounce allowed), a sparkle, and a rising-pitch star sound.

## 8. Celebration A — the winning shot (allowed to be big)

Frame-timed (a `_winTimer` in `_update`, ~0.85 s), so it is deterministic:
1. Brief **freeze** (input locked).
2. **Bigger explosion** bursts + sparkles (staggered).
3. Remaining/decorative **bubbles fall** with physics.
4. Sweeping **light rays** (additive).
5. Camera **zoom punch** + **~0.15 s slow-motion** + bright **flash** + shake.
6. The **"Level Complete!"** popup enters with a gentle celebration curve (`cubic-bezier(.25,1.1,.4,1)`,
   ~1.03 peak — premium, not rubbery).

## 9. Celebration B — the star reward (allowed a small bounce)

- Stars light **one by one** (staggered ~240 ms), each with a **small bounce**
  (`starBounce`, ~1.14 peak), a **sparkle**, a **golden shine**, and a **rising-pitch** star sound.
- The **third star** gets the biggest flourish (extra flash + shake).
- A **shot bonus** counts up (ease-out).

## 10. UI transitions

- Menus/popups **fade + scale** in (ease-out, 180–250 ms); the pause menu **slides**; reward popups
  scale in cleanly; the Play button has a subtle idle **pulse**. Level buttons have a tap press.
- Map focus scrolls with a smooth ~0.5 s **easeOutCubic**.

## 11. Background life

- Rising bubbles, gentle sway, and slow additive light shimmer — continuous but very subtle. See
  [VISUAL_STYLE_GUIDE.md](VISUAL_STYLE_GUIDE.md) §5.

## 12. Easing inventory (CSS)

Only two non-ease-out curves exist in the stylesheet — `starBounce` and `winEntrance` — both by design.
Everything else is `cubic-bezier(.33,1,.68,1)`.

## 13. Guardrails

- **Keep everything subtle except win + stars.** Do not add zoom/slow-mo/big-bounce to ordinary
  gameplay.
- Keep timings within the budget; keep 60 FPS (reuse the pooled particle system; no per-frame allocs).
- Do not reintroduce overshoot easing outside the two allowed celebrations.
