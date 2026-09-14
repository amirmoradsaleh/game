# Ads System

Ads are **not yet integrated**. A placeholder `RewardedAdManager` exists with the exact call-site seam
needed to drop in **Google AdMob Rewarded Ads** later without touching gameplay.

---

## 1. Current state (placeholder)

`src/managers/RewardedAdManager.js`:

- `REWARD_AMOUNT = 3` — grants **+3 of the chosen special** per completed view.
- `isAvailable()` → returns whether an ad is "loaded" (placeholder: always true).
- `load()` — preload the next rewarded ad (no-op placeholder; future: AdMob load callbacks).
- `show(onReward)` — plays the (placeholder) ad and invokes the `onReward` callback with the reward.

Every **call site already uses this API**, so shipping real ads only means changing `load()`/`show()`
internals.

## 2. Where rewarded ads appear (intended)

- **Power-Ups / low inventory:** "Watch an ad for +3 <special>." (primary current hook.)
- **Future — continue on failure:** "Watch an ad for +N shots" on a near-miss loss.
- **Future — double reward:** "Watch to double this milestone reward."

No interstitials or banners are used; the design favours **opt-in rewarded** ads only.

## 3. AdMob integration plan

1. Add the AdMob SDK (WebView bridge / plugin for the mobile shell).
2. In `RewardedAdManager.load()`: request/preload a rewarded ad; set `loaded` via the SDK's
   loaded/failed callbacks.
3. In `show(onReward)`: present the ad; on the SDK's **reward** callback, call `onReward(REWARD_AMOUNT)`;
   on close/failure, resolve gracefully (no reward, no crash) and `load()` the next one.
4. Keep the reward grant flowing through `SaveManager.addSpecial(...)` (and future `coins`).

## 4. Rules & UX

- **Opt-in only:** ads are always initiated by the player (a button), never forced.
- **Reward is guaranteed on completion:** if the SDK fires reward, grant it; if the user cancels, grant
  nothing but never punish.
- **Fail-safe:** if no ad is available (`isAvailable()` false / offline), hide or disable the button;
  never block progression on ads.
- **Cooldowns / frequency capping:** none today. When live, add a light cooldown to prevent spam of the
  same reward (e.g. per-level or short time-based), configured centrally so balance stays intact.

## 5. Ads & fairness

- Ads only ever **grant accelerators** (specials, future coins/continues). They never gate levels and
  never change balance formulas. Every level remains completable without watching ads. See
  [ECONOMY_GUIDE.md](ECONOMY_GUIDE.md).

## 6. Guardrails

- Keep the `isAvailable / load / show(onReward)` seam stable — call sites depend on it.
- Real ad plumbing goes **only** inside `RewardedAdManager`; do not scatter SDK calls across gameplay.
- Rewarded/opt-in only; never interstitial/forced. Never block gameplay or progression on an ad.
