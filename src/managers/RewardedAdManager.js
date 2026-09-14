/* =========================================================================
 * RewardedAdManager — placeholder rewarded-video architecture.
 *
 * No real ads are integrated yet. The game calls `show(onReward)` wherever a
 * "Watch a Video to Receive +3" action appears; here we simulate a successful
 * ad view and invoke the reward callback. To ship real Google AdMob Rewarded
 * Ads later, only `load()` / `show()` need to change — every call site already
 * routes through this manager and grants the reward in the onReward callback.
 * ========================================================================= */
const RewardedAdManager = (() => {
  const REWARD_AMOUNT = 3;    // +3 of the chosen special per completed view
  let loaded = true;          // future: set by AdMob load callbacks

  function isAvailable() { return loaded; }

  // Preload the next rewarded ad (no-op placeholder).
  function load() { loaded = true; }

  // Present the rewarded ad. `onReward(success, amount)` fires when the user has
  // earned the reward (placeholder: always succeeds after a short delay).
  function show(onReward) {
    // Future AdMob flow:
    //   rewardedAd.show({ onUserEarnedReward: () => onReward(true, REWARD_AMOUNT),
    //                     onAdDismissed: () => load() });
    setTimeout(() => {
      try { onReward && onReward(true, REWARD_AMOUNT); } catch (e) {}
      load();
    }, 300);
  }

  return { isAvailable, load, show, REWARD_AMOUNT };
})();
