# Audio Guide

All audio is **synthesised at runtime** via the **Web Audio API** (`SoundManager`). There are **no
audio files** — every sound is generated from oscillators/noise, so the game stays a single small
self-contained file. Sounds support **pitch variation** for a lively, non-repetitive feel.

---

## 1. Architecture

- `SoundManager` lazily creates an `AudioContext` on first use (resumed on user gesture), with a master
  gain and a mute flag.
- **`play(name, pitch = 1)`** looks up a **recipe** and renders it; the `pitch` multiplier scales the
  recipe's frequencies (threaded through `_blip` and `_arpeggio`).
- Primitives: **`_blip`** (a pitched oscillator sweep with an envelope) and **`_arpeggio`** (a sequence
  of notes), plus a noise burst for explosions.

## 2. Sound effects (recipes)

| Name | Used for | Character |
|---|---|---|
| `shoot` | Firing a bubble | Short triangle sweep, **pitched ±** per shot |
| `pop` | Popping bubbles | Sine blip, **pitch varies by match size** (bigger = lower) |
| `explosion` | Special detonation | Noise burst |
| `impact` | Bubble landing/connecting | Soft sine click, **pitched** |
| `fall` | Disconnected group falling | Low soft sweep, **pitched** (bigger drop = lower) |
| `click` | UI buttons | Short square blip, **pitched** |
| `swap` | Swapping current/reserve | Sine blip |
| `combo` | Combos / big drops | Rising **arpeggio** (richer for bigger combos) |
| `star` | Star reveal | Bright triangle blip, **rising pitch** per star (1st→3rd) |
| `victory` | Level complete | Ascending major **arpeggio** |
| `failure` | Level failed | Descending **arpeggio** |

## 3. Pitch variation (feel)

Randomised/scaled pitch prevents machine-gun repetition and rewards escalation:
- **shoot:** ~`0.92 + rand·0.16`.
- **pop:** `~1.15 − min(0.35, matchSize·0.03) + rand(±0.06)` (bigger match → lower, chunkier).
- **fall:** `~0.85 + rand·0.2 − min(0.15, groupSize·0.02)`.
- **impact / click:** small random pitch each hit.
- **combo:** pitch rises with combo size; **star:** `1 + i·0.18` for the i-th star.

## 4. Music

- There is currently **no background music track** (SFX-only). If added later, it should be a calm,
  loopable underwater ambience at low volume, duckable during celebrations, and respect the mute flag.
  Keep it synthesised or as a single small inlined asset to preserve the one-file model.

## 5. Mute

- A HUD **mute** toggle flips `SoundManager.muted`; all critical feedback is also visual, so muted play
  is fully functional.

## 6. Future haptics

- Not yet implemented. When targeting mobile web / WebView, add light haptic taps (via the Vibration
  API where available) on: pop, land, star reveal, and win. Keep them short and optional (respect a
  settings toggle), mirroring the audio events. Never block gameplay on haptics.

## 7. Guardrails

- Keep audio **synthesised and pitch-varied**; do not add heavy audio assets that break the one-file model.
- Preserve the recipe names/call-sites (gameplay triggers them by name).
- Reserve the richest sounds (victory, multi-star, big combo) for the big moments, matching the
  animation language. See [ANIMATION_GUIDE.md](ANIMATION_GUIDE.md).
