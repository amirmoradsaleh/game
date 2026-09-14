# TODO — Development Roadmap

A prioritised roadmap. Respect [CLAUDE_RULES.md](CLAUDE_RULES.md) for every item: extend, don't
rewrite; preserve save/gameplay/balance/visual style; keep 60 FPS and all suites green.

---

## 🔴 High Priority

- [ ] **Real AdMob rewarded ads** — implement `RewardedAdManager.load()/show()` against the SDK in the
      mobile shell; keep the `isAvailable/load/show(onReward)` seam. (See [ADS_SYSTEM.md](ADS_SYSTEM.md).)
- [ ] **Soft currency (coins)** — add a `coins` field (additive save), earn from levels/stars, spend on
      specials/continues. (See [ECONOMY_GUIDE.md](ECONOMY_GUIDE.md).)
- [ ] **Continue on failure** — offer +N shots via ad/coins on a near-miss loss (fits the move-budget
      model without changing balance formulas).
- [ ] **Persistent settings** — save mute/volume (and future options) additively (`settings` object).
- [ ] **Save versioning** — add a `version` field and a forward-compatible migration path before the
      economy expands.

## 🟠 Medium Priority

- [ ] **Wire the Rocket special** into the unlock/economy flow (effect already implemented).
- [ ] **Daily reward / streak** to drive retention (grants specials/coins).
- [ ] **Milestone celebration screen** polish (beyond the reward popup).
- [ ] **Level select QoL** — jump-to-level, "next uncompleted", star totals summary on the map.
- [ ] **More obstacle types** following the `SHELL` + `INTRO` + count-formula + tutorial pattern.
- [ ] **Haptics** on pop/land/star/win (Vibration API, settings-gated). (See [AUDIO_GUIDE.md](AUDIO_GUIDE.md).)
- [ ] **Background music** — a calm, loopable underwater ambience (synth or one lean inlined asset),
      duckable during celebrations.

## 🟢 Low Priority

- [ ] **Cosmetic themes** (alternate backgrounds / bubble skins) as reward/monetization.
- [ ] **Leaderboards / cloud save** (would require a backend — currently intentionally offline).
- [ ] **Accessibility options** (colour-blind-friendly bubble markers, reduced-motion toggle).
- [ ] **Localization** of UI strings.

## 💡 Future Ideas

- [ ] **Extend to 1000+ levels** — raise `LevelDatabase.COUNT`; verify balance across new bands.
- [ ] **Event/limited-time levels** layered on the deterministic generator.
- [ ] **New specials** (e.g. colour-swap, star bubble) via `AbilityDefs` + `SpecialEffects`.
- [ ] **Meta-map chapters/biomes** grouping level ranges with distinct art.

## 🐞 Bug Fixes / Watch-list

- [ ] **Real-browser regressions** — CSS/layout issues aren't caught by headless stubs; keep a
      Playwright check for any UI change (map width-collapse & progress-bar layout were both
      real-browser-only). 
- [ ] **Deep-level star reachability** — periodically spot-check that late-game thresholds remain fair.
- [ ] **Edge-case aim near walls** — the guide's edge-reflection post-bounce hint is approximate by
      design; confirm it never misleads on common shots.

## ✨ Polish

- [ ] Fine-tune progress-bar sizing/contrast per device feedback.
- [ ] Additional idle/ambient touches (kept subtle, per the animation language).
- [ ] Reward popup / power-ups screen visual refinement.

## ⚡ Optimization

- [ ] Profile on low-end devices; confirm 60 FPS with many simultaneous particles + falling groups.
- [ ] Audit hot loops for stray allocations after future features land.
- [ ] Consider lazy-decoding inlined assets if startup time grows.

---

> Keep this list current: when an item ships, move it to [CHANGELOG.md](CHANGELOG.md).
