/* =========================================================================
 * DifficultyManager — subtle, adaptive difficulty (rubber-banding).
 *
 * Watches recent shot outcomes and objective pace, then produces a single
 * `struggle` signal in [0..1]. The shooter reads it to (a) slightly raise the
 * special-bubble chance and (b) bias helpful colours when the player is stuck.
 * When the player is cruising, struggle falls toward 0 and the game quietly
 * returns to baseline. Adjustments are small and almost invisible.
 * ========================================================================= */
class DifficultyManager {
  constructor() {
    this.wasteEMA = 0;      // exponential moving avg of "shot cleared nothing"
    this.shots = 0;
    this.recentClears = []; // last few clear counts
  }

  reset() { this.wasteEMA = 0; this.shots = 0; this.recentClears = []; }

  // clearedCount: bubbles removed by the shot that just resolved.
  recordShot(clearedCount) {
    this.shots++;
    const wasted = clearedCount <= 0 ? 1 : 0;
    const k = 0.35;
    this.wasteEMA = this.wasteEMA * (1 - k) + wasted * k;
    this.recentClears.push(clearedCount);
    if (this.recentClears.length > 6) this.recentClears.shift();
  }

  // 0 = cruising, 1 = really stuck. Combines wasted-shot rate with move pressure.
  struggle(movesLeft, objectivesRemaining) {
    let s = this.wasteEMA; // 0..1 from wasted shots
    // pressure: few moves left but lots of objective still to clear
    if (movesLeft != null && objectivesRemaining != null && movesLeft > 0) {
      const pressure = Utils.clamp(objectivesRemaining / (movesLeft * 3), 0, 1);
      s = Math.max(s, pressure * 0.8);
    }
    // a couple of good clears in a row quickly relaxes difficulty
    const recentGood = this.recentClears.slice(-2).every(n => n >= 3) && this.recentClears.length >= 2;
    if (recentGood) s *= 0.4;
    return Utils.clamp(s, 0, 1);
  }
}
