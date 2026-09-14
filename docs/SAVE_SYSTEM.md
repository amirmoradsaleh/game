# Save System

Persistence is handled entirely by `SaveManager`, using **localStorage** with a safe **in-memory
fallback**. Save compatibility is **sacred** — the key and shape must be preserved and only extended
additively.

---

## 1. Storage

- **Key:** `bql_save_v2`.
- **Backend:** `localStorage` when available (real browser / Android/iOS WebView). If `localStorage`
  throws or is unavailable (e.g. opaque-origin `file://` sandboxes), it silently falls back to
  **in-memory** storage so the game never crashes.
- **Serialization:** a single JSON object read on construction, written on every mutation (`_write`).

## 2. Saved data shape

```js
{
  unlocked: 1,                                   // highest unlocked level (1..500)
  stars: { "<n>": 1..3 },                        // best stars per completed level
  tutorials: { "<key>": true },                  // one-time tutorials already seen
  inventory: { bomb:0, rainbow:0, laser:0, fireball:0 }, // special counts (start empty)
  unlockedSpecials: { "<id>": true },            // which specials were first-granted
  claimed: { "<n>": true },                      // milestone rewards already granted
  mapCenter: null | <level>,                     // last map focus (centred level)
  mapLoaded: 50,                                 // how many level batches are loaded
  currentLevel: 1                                // level the player is on (map focus)
}
```

## 3. Public API (selected)

| Method | Purpose |
|---|---|
| `get unlocked()` | Highest unlocked level. |
| `isUnlocked(n)` / `isCompleted(n)` / `starsFor(n)` | Level state queries. |
| `recordResult(n, stars)` | Clamp stars 1..3, keep best, unlock `min(n+1, COUNT)`. |
| `get inventory` / `useSpecial(id)` / `addSpecial(id, n)` | Special inventory. |
| `unlockSpecial(id, amount)` | Grant once on first unlock (returns true if newly granted). |
| `hasClaimed(n)` / `markClaimed(n)` | Milestone reward claim tracking. |
| `hasSeenTutorial(key)` / `markTutorial(key)` | One-time tutorials. |
| `getMapCenter/setMapCenter`, `getMapLoaded/setMapLoaded`, `get currentLevel/setCurrentLevel` | Map state. |
| `reset()` | Fresh profile (unlocked 1, empty inventory, mapLoaded 50, currentLevel 1). |

## 4. What each system persists

- **Progression:** `unlocked`, `currentLevel`, `stars` (see [PROGRESSION_SYSTEM.md](PROGRESSION_SYSTEM.md)).
- **Economy:** `inventory`, `unlockedSpecials`, `claimed` (see [ECONOMY_GUIDE.md](ECONOMY_GUIDE.md)).
- **Map:** `mapCenter`, `mapLoaded` (see [MAP_SYSTEM.md](MAP_SYSTEM.md)).
- **Onboarding:** `tutorials`.

> **Settings** (e.g. mute) are currently runtime-only in `SoundManager`. If persistent settings are
> added, extend the save additively (e.g. a `settings` object) — never repurpose existing fields.

## 5. Compatibility rules

- The key `bql_save_v2` and existing field names/shapes **must not change**. Add new fields with safe
  defaults (`d.newField || default`) so older saves load cleanly, exactly as existing fields do.
- `recordResult` must keep the **best** star count and never lower `unlocked`.
- Never write partial/invalid states; `_write` always serialises the full object.

## 6. Reliability

- All reads/writes are wrapped in try/catch; failures degrade to in-memory (never throw).
- Because generation is deterministic, a save only needs to store **outcomes** (unlocked, stars,
  inventory, map focus), not level layouts.

## 7. Guardrails

- **Always preserve save compatibility.** This is a top-tier rule in [CLAUDE_RULES.md](CLAUDE_RULES.md).
- Extend additively with defaults; never rename/remove fields; never change the key.
- Keep the in-memory fallback so sandboxed/opaque-origin runs still work.
