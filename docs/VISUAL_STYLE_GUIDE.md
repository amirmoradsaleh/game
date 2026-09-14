# Visual Style Guide

The art direction and visual identity of Bubble Quest Legends. Reference register: *Bubble Witch
Saga*, *Panda Pop*, *Royal Match*, *Angry Birds Dream Blast* — glossy, warm, premium.

---

## 1. Art direction

- **Theme:** a serene **underwater cave**. Warm caustic light rays from above, cool blue depths, coral
  and sea plants framing the play area.
- **Mood:** calm but rewarding; readable at all times; celebratory at wins.
- **Assets:** real, high-quality PNGs — glossy **bubble sprites** (`ball*.png`) and a painted
  **underwater scene** (`backgroundGame.png`), inlined as data URIs so the game is one file.

## 2. Colour palette (bubbles)

Glossy candy tones (from `GameConfig.COLORS`) — each has base / dark / light:

| Colour | Base | Dark | Light |
|---|---|---|---|
| Red | `#ff5d6c` | `#d63a55` | `#ffb3bd` |
| Blue | `#41a6ff` | `#1f73d6` | `#a9d8ff` |
| Green | `#4fd267` | `#27a648` | `#b0f0bd` |
| Yellow | `#ffcf3f` | `#e0a416` | `#ffe9a3` |
| Purple | `#b06cff` | `#7d3fd6` | `#dfc2ff` |

The **light** tint doubles as the aim-guide colour for the current bubble (colour-matched trajectory).

## 3. UI colour language

- **Underwater blues** for the progress bar and HUD accents (soft blue glow, translucent tracks).
- **Gold** (`#ffd23f`) for **stars** and celebratory accents.
- **White chips** with soft purple ink for the Level label; rounded corners throughout.

## 4. Bubble style

- Bubbles are drawn from real sprites at radius `r ≈ 20.8` (diameter ≈ cell spacing, so neighbours
  touch with ~1–3 px visual spacing). Glossy highlight, soft rim.
- **Landing squash** is subtle (~5%), settling fast (~100 ms). **Pop** expands only ~7% then fades
  (~150 ms). No rubbery/oversized deformation.

## 5. Background & lighting

- The inlined underwater scene is the base layer (never covered by an opaque overlay — the scene must
  show through).
- An **ambient layer** (in `Renderer`) adds life: ~22 decorative bubbles, ~1/3 slowly **rising**, all
  with a gentle horizontal **sway**, plus **3 slow additive light-shimmer rays**. All very low-alpha,
  subtle, never distracting. (Constraint enforced by `test.assets.js`: no `fillRect` overlay, field
  ≤ 24, bubble radii 6–20 px.)

## 6. Particles

A single **pooled** system (`ParticleSystem`) provides: shard **burst**, **sparkle**, **explosion**,
water **splash** (droplets with gravity), rising **bubbles**, soft **glow flash** (additive), **trail**,
and floating **text**. Colours match the popped bubble; bigger matches → stronger flashes.

## 7. Map visuals

- Snake path with glossy circular level nodes; **current** node glows blue, **completed** show gold
  stars, **locked** are muted grey. Decorations (coral, plants, rocks, chests, crystals, bubbles) sit
  beside the path. See [MAP_SYSTEM.md](MAP_SYSTEM.md).

## 8. Aim guide

- Colour-matched **rounded dots**, ~60% opacity, soft outer glow, shrinking + fading toward the end,
  flowing forward. Reaches the wall on bounces. See [GAMEPLAY_RULES.md](GAMEPLAY_RULES.md) §4.

## 9. Typography & shapes

- Rounded, friendly UI: pill chips, rounded buttons, soft shadows. Bold weights for numbers/labels.
- Milestone levels render **themed shapes** (heart, star, diamond, …) as memorable landmarks.

## 10. Visual identity summary

Glossy candy bubbles over a calm, luminous underwater cave, with gold stars for reward and soft blue
glows for UI — polished, warm, and immediately legible.

## 11. Guardrails

- **Preserve the visual style** — palette, glossy sprites, underwater scene, gold stars, blue UI.
- Keep the background **showing through** (no opaque overlays / no `fillRect` over the scene).
- Keep deformations subtle (squash ~5%, pop ~7%); reserve strong visuals for win/stars.

Cross-references: [ANIMATION_GUIDE.md](ANIMATION_GUIDE.md), [UI_UX_GUIDE.md](UI_UX_GUIDE.md).
