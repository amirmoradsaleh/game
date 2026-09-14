# Code Style Guide

Conventions and architecture principles for Bubble Quest Legends. The codebase is small, dependency-
free, and deliberately consistent — keep it that way.

---

## 1. Language & module model

- **Vanilla ES2019**, browser-target, **no framework, no imports/exports**. Each `src/**` file defines
  one or more **globals** (a class or an IIFE returning an object).
- **Load order = dependency graph.** A file may only reference globals defined earlier in `build.js`'s
  concatenation order. When adding a file, insert it at the correct position.

## 2. Folder organisation

- `config/` static data & tunables · `core/` foundational utils/geometry/audio · `effects/` particles ·
  `gameplay/` rules & simulation · `managers/` coordinating services · `ui/` rendering ·
  `assets/` inlined data URIs · `Game.js` orchestrator. Put new code in the folder that matches its role.

## 3. Naming

- **Classes / global singletons:** PascalCase (`Board`, `SoundManager`, `GameConfig`).
- **Methods / variables:** camelCase (`nearestValidCell`, `movesBudget`).
- **Private/internal methods & fields:** leading underscore (`_update`, `_hitInfo`, `_winTimer`).
- **Constants / config maps:** UPPER_SNAKE for enums (`GameState`, `SPECIAL`, `SHELL`), or grouped
  config objects (`GameConfig.AIM.minElevation`).
- **DOM ids:** camelCase (`progressWrap`, `winStars`); CSS classes kebab-case (`.progress-track`).

## 4. Data-driven principle

- **All tunables live in `GameConfig`** (global) or **`LevelDatabase`** (per level). Do not hard-code
  gameplay numbers in logic files — reference the config so balancing stays centralised.
- Per-level content is **formula-derived + seeded**, never hand-authored per level.

## 5. Separation of concerns

- **Simulation never draws; the renderer never mutates state.** `Board`/`Shooter` compute; `Renderer`
  draws; `Game` orchestrates. Particles/audio/camera are presentational and must not affect outcomes.
- **Determinism boundary:** anything that affects gameplay results must be deterministic and seeded;
  presentation may be non-deterministic.

## 6. Performance rules (enforced)

- **Object pooling** for particles (free-list + swap-remove + cap). No ad-hoc particle arrays.
- **No allocations in hot loops** (`_update`, `_draw`, particle/flight loops).
- **O(1) collision** via cell + neighbours; never scan the whole board per step.
- Keep CSS animations on transform/opacity; avoid layout thrash. Maintain **60 FPS**.

## 7. Extend, don't rewrite

- Prefer **adding** methods/fields over rewriting systems. Preserve public method names and DOM ids
  (tests, save and state routing depend on them).
- When behaviour must change, change the **smallest surface** and keep guide/flight/collision/save
  invariants intact. See [CLAUDE_RULES.md](CLAUDE_RULES.md).

## 8. Comments

- Explain **why**, not just what — especially for non-obvious invariants (e.g. "whole-STEP with carry
  → guide == flight", "reflect at centre bounds for consistency"). Keep the existing header-comment
  style on each module.

## 9. Testing discipline

- Every logic change ships with/updates a headless test. Suites `eval` the built bundle, so **rebuild
  before testing** (`node build.js`).
- For CSS/layout-sensitive changes, add a **real-browser** (Playwright) check — headless stubs don't do
  layout.

## 10. Build hygiene

- Edit `src/**` and `index.template.html` only; **never** edit `dist/` or `dist.bundle.js`.
- Keep scratch/debug files out of the build and out of the shipped zip.

## 11. Formatting

- 2-space indent, semicolons, single quotes, trailing commas in multiline literals — match the existing
  files. Keep lines readable; group related one-liners where the existing code does.

Cross-references: [ARCHITECTURE_OVERVIEW.md](ARCHITECTURE_OVERVIEW.md),
[TECHNICAL_SPECIFICATION.md](TECHNICAL_SPECIFICATION.md), [CLAUDE_RULES.md](CLAUDE_RULES.md).
