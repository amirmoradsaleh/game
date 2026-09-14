/* =========================================================================
 * BubbleQueue — the player's colour supply for the circular shooter.
 *   • Current — the bubble about to fire
 *   • Next    — the upcoming bubble, previewed above the shooter
 *
 * Colours only: special balls are equipped from the Ability Bar and never
 * appear here. Switching is NOT done with a manual button — the player taps the
 * Next preview to swap Current<->Next, and Next auto-advances after every shot.
 *
 * Smart selection only ever hands out colours still present on the board; if a
 * colour vanishes, queued bubbles are remapped so the player is never stuck.
 * When struggling, colour choice is gently biased toward the most common
 * colours on the board (invisible mercy).
 * ========================================================================= */
class BubbleQueue {
  constructor(cfg, board, policy) {
    this.cfg = cfg;
    this.board = board;
    this.policy = policy || (() => ({ struggle: 0, helpful: [] }));
    this.current = this._make();
    this.next = this._make();
    this.swapAnim = 0;    // 0..1 tap-swap animation
    this.refillAnim = 0;  // 0..1 slide-in animation for a fresh Next
  }

  _boardColors() {
    const cols = this.board.activeColors();
    return cols.length ? cols : this.cfg.COLOR_KEYS.slice();
  }

  // Smart generation: bias the next colour toward colours the player can
  // actually use — those forming reachable clusters near the bottom — scaled by
  // the level's generosity (1 = very generous .. 0 = fully random). Never
  // guarantees a colour; it only raises the odds, so the game stays fair.
  _pickColor() {
    const pol = this.policy() || {};
    const colors = this._boardColors();
    if (colors.length <= 1) return colors[0] || Utils.pick(this.cfg.COLOR_KEYS);

    const g = (this.generosity == null) ? 1 : this.generosity;
    const struggle = pol.struggle || 0;
    const bottom = this.board.lowestFilledRow();
    const near = this.board.colorCountsInRows(bottom - 8, bottom);   // reachable clusters
    let total = 0;
    for (const c of colors) total += (near[c] || 0) + this.board.countColor(c) * 0.25;
    total = total || 1;

    const weights = colors.map((c) => {
      const useful = ((near[c] || 0) + this.board.countColor(c) * 0.25) / total; // 0..1
      let w = (1 - g) * (1 / colors.length) + g * useful;                        // blend uniform<->useful
      if (pol.helpful && pol.helpful.includes(c)) w += struggle * 0.5;           // mercy nudge
      return Math.max(0.0001, w);
    });
    return colors[this._sample(weights)];
  }

  _sample(weights) {
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
    return weights.length - 1;
  }

  _make() { return new Bubble({ color: this._pickColor() }); }

  // Tap the Next preview to swap it with Current.
  swap() {
    const t = this.current; this.current = this.next; this.next = t;
    this.swapAnim = 1;
  }

  // After firing Current: Next becomes Current and a fresh Next is generated.
  advance() {
    this.current = this.next;
    this.next = this._make();
    this.refillAnim = 1;
  }

  // Keep queued colours valid: remap any colour no longer on the board.
  refreshValidity() {
    const colors = this._boardColors();
    for (const slot of ['current', 'next']) {
      const b = this[slot];
      if (b && b.color && !colors.includes(b.color)) b.color = Utils.pick(colors);
    }
  }

  update(dt) {
    if (this.swapAnim > 0) this.swapAnim = Math.max(0, this.swapAnim - dt * 4); // ~250ms cross-over
    if (this.refillAnim > 0) this.refillAnim = Math.max(0, this.refillAnim - dt * 4);
  }
}
