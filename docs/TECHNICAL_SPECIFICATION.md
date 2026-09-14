# Technical Specification

Core systems, dependencies, build, tests, performance targets and mobile requirements.

---

## 1. Runtime & rendering

- **Rendering:** HTML5 **Canvas 2D**, logical resolution **540×960** (portrait), scaled to the device
  (`_setupCanvas`, DPR-aware). All gameplay is drawn on the canvas; UI is DOM/CSS overlays.
- **Language:** vanilla ES2019 JavaScript, **no framework / no module system**. Files define globals
  and are concatenated in dependency order.
- **Audio:** Web Audio API, synthesised (no files).
- **Persistence:** localStorage (`bql_save_v2`) + in-memory fallback.
- **One-file deliverable:** `dist/index.html` (~3.9 MB) — HTML + CSS + concatenated JS + inlined image
  data URIs. No network, no server.

## 2. Dependencies

- **Runtime:** none (zero third-party runtime libraries).
- **Dev-only:** Node (build + headless tests); optionally Playwright + a local Chromium for real-browser
  verification. `node_modules/` is dev-only and **excluded** from the shipped zip.

## 3. Build pipeline (`build.js`)

1. Concatenate `src/**` in the fixed **dependency order** (see [ARCHITECTURE_OVERVIEW.md](ARCHITECTURE_OVERVIEW.md) §1).
2. Inline the CSS/DOM shell from `index.template.html`.
3. Inline image assets as data URIs (already captured in `src/assets/*`).
4. Emit `dist/index.html` (self-contained) and `dist.bundle.js` (concatenated JS for tests).

```bash
node build.js
node --check dist.bundle.js
```

**Never hand-edit `dist/` or `dist.bundle.js`** — edit `src/` + `index.template.html` and rebuild.

## 4. Tests

Headless Node harnesses `eval` the built bundle with light DOM/canvas stubs:

| Suite | Focus | Approx. count |
|---|---|---|
| `test.systems.js` | Board, generation, queue, managers | 115 |
| `test.logic.js` | Core match/flood logic | 11 |
| `test.flow.js` | State flow, win/lose, map focus & loading | 42 |
| `test.climb.js` | Camera climb / summit win | 10 |
| `test.hud.js` | HUD, aim limits, Gap Assist, guide==flight, star progress | 38 |
| `test.assets.js` | Sprites/background/ambient invariants | 42 |
| `smoke.js` | End-to-end flight sanity | — |
| `stress.js` | Many-shot stress | — |

**Total: 253 assertions.** All must stay green. Real-Chromium checks additionally confirm **60 FPS**,
no console errors, and layout/visual correctness.

## 5. Performance targets

- **60 FPS** on mobile (target device: mid-range phone in a WebView).
- Single **rAF loop**; `dt` clamped to ≤ 33 ms to avoid spiral-of-death on stalls.
- **Object pooling:** `ParticleSystem` uses a free-list with swap-remove and a hard cap (~420). No
  per-particle allocation in steady state.
- **O(1) collision:** `Shooter._hitInfo` tests only the cell under the point + its hex neighbours (not
  the whole board).
- **Map virtualization:** append-only DOM nodes + CSS `content-visibility` — off-screen nodes are not
  rendered; no per-frame JS for the map.
- **Minimal allocations:** hot paths (flight, draw, particle update) avoid new objects/arrays.
- **Deterministic flight sampling:** whole-`STEP` (3.5 px) advance with carried remainder → frame-rate
  independent collisions and guide/flight parity.

## 6. Optimization rules

- Reuse the pooled particle system; never spawn ad-hoc particle arrays.
- Avoid allocations inside `_update`/`_draw`/particle loops.
- Prefer additive/simple canvas ops; keep the background a single drawn image + a tiny ambient field.
- Keep CSS animations GPU-friendly (transform/opacity); avoid layout thrash.
- Verify any change against `stress.js` and a real-browser FPS check.

## 7. Mobile requirements

- Portrait 540×960 logical, scaled to any screen; large touch targets (64 px map nodes).
- Pointer/touch input (drag to aim, release to fire); `preventDefault` on gameplay pointers.
- Works inside an Android/iOS **WebView** with no network; localStorage available there.
- Graceful degradation where `localStorage` is blocked (in-memory save).
- No reliance on desktop-only APIs; audio unlocked on first user gesture.

## 8. Known technical constraints

- No module system means **load order is the dependency graph** — new files must be inserted at the
  correct position in `build.js`.
- The single-file model requires assets to be inlined; large new assets grow the file — keep them lean.
- Headless tests use stubs; **real-browser verification is required** for CSS/layout-sensitive changes
  (the map width-collapse and progress-bar layout were only catchable in a real browser).

## 9. Guardrails

- Maintain 60 FPS and the pooling/virtualization strategies.
- Keep the build deterministic and the one-file deliverable intact.
- Keep all suites green and add tests for new logic. See [CODE_STYLE_GUIDE.md](CODE_STYLE_GUIDE.md).
