# CLAUDE_RULES — Permanent Development Rules

> **This is the most important document in the project.**
> Read it at the start of **every** session before changing anything. These rules are permanent and
> override convenience. When a request conflicts with a rule, ask for explicit confirmation.

---

## 0. Golden principle

**Extend, never rewrite.** Make the smallest change that satisfies the request while preserving every
existing system, invariant and player expectation. This game is production-quality and heavily
iterated — treat the current behaviour as intentional unless told otherwise.

## 1. Never do (unless explicitly requested)

- **Never rewrite existing systems.** Modify in place; keep public method names, DOM ids, and file roles.
- **Never regenerate or reshape completed levels.** Level seeds and numbers are fixed and reproducible.
- **Never modify level IDs / numbers.** Progression, saves and the map all key on them.
- **Never remove implemented features** or screens/overlays.
- **Never break save compatibility.** The key `bql_save_v2` and its field shapes are sacred — extend
  additively with safe defaults only.
- **Never change gameplay mechanics** (matching, shooting, camera, queue, win/lose conditions).
- **Never change collision behaviour** (hitbox `COLLISION.factor`, Gap Assist, wall reflection, snapping)
  — the guide/flight consistency depends on it.
- **Never change balance** (shots, generosity, star thresholds, obstacle/colour formulas).
- **Never change progression logic** (linear `n → n+1` unlock, star recording).
- **Never change the visual style** (palette, glossy sprites, underwater scene, gold stars, blue UI).
- **Never break existing UI** or the top-bar/progress-bar layout.
- **Never reintroduce map windowing/recycling** (nodes are append-only + `content-visibility`).
- **Never add zoom/slow-motion/big-bounce to ordinary gameplay** — those are reserved for win + stars.
- **Never edit `dist/` or `dist.bundle.js` by hand** — they are generated.

## 2. Always do

- **Always preserve save compatibility** (additive fields with defaults).
- **Always preserve gameplay mechanics, balance, collision, progression and visual style.**
- **Always preserve architecture** (no framework, no module system; load order = dependency graph in
  `build.js`).
- **Always use object pooling** for particles; **no allocations in hot loops**.
- **Always optimize for mobile** and **maintain 60 FPS**.
- **Always keep the guide == flight consistency** (shared `STEP`, shared collision, whole-STEP-with-carry,
  and the SAME centre wall bounds `minLeft/maxRight` for both — bank shots must stay perfectly synced).
- **Always keep the animation language** (fast, ease-out, no overshoot except star bounce + win entrance;
  micro 60–100 ms, pop ~150 ms, UI 180–250 ms, celebration 400–700 ms).
- **Always extend instead of replacing.**
- **Always rebuild before testing** (`node build.js`) and **keep all 253 assertions green**; add tests
  for new logic.
- **Always verify CSS/layout-sensitive changes in a real browser** (headless stubs don't do layout).
- **Always keep the game a single self-contained file** (inline assets; zero runtime dependencies).
- **Always update `CHANGELOG.md` and the relevant doc** when you change behaviour.

## 3. Invariants that must hold after any change

- Every level is **clearable** (`moves ≥ optimal + 4`).
- **Solids/walls are never passable**; Gap Assist only forgives a grazing overlap that is decreasing
  along the path (guide tolerance ≈ 1.9 px; the real flight is a hair more forgiving, ≈ 3.4 px, and
  never *less* forgiving than the guide).
- Aiming below ~18° elevation **cancels** the shot (no near-horizontal fire).
- The **map always opens focused on the current level**; loading more never jumps the scroll.
- **Stars are 1–3**, recorded as best; completing `n` unlocks `n+1` (capped at `COUNT`).
- The **background always shows through** (no opaque overlay / no `fillRect` over the scene; ambient
  field ≤ 24, radii 6–20 px — enforced by `test.assets.js`).

## 4. Workflow for any change

1. Read this file + the relevant system doc(s) in `docs/`.
2. Make the **smallest** edit in `src/**` / `index.template.html`.
3. `node build.js` → `node --check dist.bundle.js`.
4. Run all suites (`test.systems/logic/flow/climb/hud/assets`, `smoke`, `stress`) — must be green.
5. For visual/layout changes, run a **real-browser** check (FPS 60, no errors, correct layout).
6. Update `CHANGELOG.md` and any affected doc.
7. Re-package (`dist/index.html` + source zip) excluding `node_modules`/scratch files.

## 5. When requirements have oscillated

Requirements in this project have flip-flopped across sessions (e.g. aim-guide "reach the wall" vs.
"guide==flight consistency"; collision "reduce hitbox" vs. "90–95%"). **Follow the latest explicit
request**, but never silently break a previously-established invariant — if a request conflicts with an
invariant here, surface the trade-off and confirm.

## 6. Definition of done

A change is done when: the request is satisfied; no rule/invariant above is broken; all suites are
green; a real-browser check passes for visual changes; the changelog + docs are updated; and the
deliverables are repackaged.

> Future sessions: rely on `docs/` (start with [PROJECT_MEMORY.md](PROJECT_MEMORY.md)) instead of chat
> history. These documents are the definitive source of truth.
