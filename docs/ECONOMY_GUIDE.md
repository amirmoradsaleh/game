# Economy Guide

The current in-game economy is intentionally light: a **special-bubble inventory** earned through
progression and rewards. There is **no coin currency or IAP yet** — this document also captures the
intended future monetization so it can be added cleanly.

---

## 1. What exists today

### Special-bubble inventory
- Stored in the save: `inventory: { bomb, rainbow, laser, fireball }` (all start at **0**).
- **Earned by:**
  1. **First-unlock grants** — the first time a special becomes available (bomb 3, rainbow 6,
     fireball 9, lightning 12), it is granted once (`unlockSpecial`).
  2. **Milestone reward packs** — every 20 levels, `MREWARDS` grants specials (`addSpecial`), cycling
     through Bomb Cache, Rainbow Boost, Lightning Strike, Fireball Pack and a Mega Pack.
  3. **Rewarded ads (placeholder)** — +3 of a chosen special per completed view (see
     [ADS_SYSTEM.md](ADS_SYSTEM.md)).
- **Spent by:** equipping a special from the Ability Bar and firing it (one consumed per shot).
- Surfaced in-game via the **Power-Ups** screen and the **Ability Bar** slot counts.

### No coins / no lives
- There is currently **no coin currency**, **no lives/energy system**, and **no IAP**. Progression is
  purely level completion + stars + specials.

## 2. Economy loop (current)

```
Play levels ──► reach milestones ──► reward packs ──► more specials
      │                                                   │
      └──► unlock specials (first grant) ◄────────────────┘
                    │
                    └──► spend specials to clear tough levels ──► progress faster
```

Specials make hard levels/obstacles more approachable, and milestones keep the supply healthy, so the
player always has tools without them being infinite.

## 3. Intended future monetization (not implemented)

Design these to slot into the existing save/managers without breaking compatibility:

- **Coins (soft currency):** earned from levels/stars/dailies; spent on specials or continues. Add a
  `coins` field to the save (additively).
- **Rewarded ads (real AdMob):** already structured — grant specials/coins/continues per view. See
  [ADS_SYSTEM.md](ADS_SYSTEM.md).
- **IAP (hard currency / packs):** special bundles, a "remove ads" purchase, starter packs. Route
  through a new `PurchaseManager`; grant via the same `addSpecial`/(future) coin APIs.
- **Continues:** spend coins/ads to gain a few extra shots on a near-miss (fits the existing
  move-budget model without changing balance formulas).
- **Lives/energy (optional):** a session gate; only add if the retention model requires it, and keep it
  off by default to preserve the current friction-free feel.

## 4. Balance considerations

- Specials are powerful; their **supply** (grants + milestones + ads/IAP) is the monetization lever,
  **not** their power. Do not buff/nerf special effects for monetization.
- Keep every level **completable without spending** (the move budget already guarantees clearability).
  Specials and continues are accelerators, never gates.

## 5. Guardrails

- **Preserve the inventory shape** (`bomb, rainbow, laser, fireball`) — extend additively (`coins`,
  new specials) without renaming existing fields.
- Do not make progression **require** purchases. Keep the game fair for non-payers.
- Route all future currency/IAP through managers, mirroring `RewardedAdManager`'s clean seam.

Cross-references: [SPECIAL_BUBBLES_GUIDE.md](SPECIAL_BUBBLES_GUIDE.md), [ADS_SYSTEM.md](ADS_SYSTEM.md),
[SAVE_SYSTEM.md](SAVE_SYSTEM.md), [PROGRESSION_SYSTEM.md](PROGRESSION_SYSTEM.md).
