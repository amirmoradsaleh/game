/* =========================================================================
 * CameraController — smooth vertical camera for the climbing stage.
 *
 * The world is a tall stage; only a viewport is shown. `y` is the world-space
 * coordinate rendered at the TOP of the screen (the scroll offset). The camera
 * eases toward a target and NEVER jumps — it only advances (climbs) when enough
 * progress is made (the bottom rows clear or an island collapses), giving the
 * cinematic "camera slowly rises, revealing a new section" feel.
 * ========================================================================= */
class CameraController {
  constructor(cfg) {
    this.cfg = cfg;
    this.y = 0;         // current scroll (world y at screen top)
    this.target = 0;    // eased destination
    this.min = 0;       // summit (top of stage)
    this.max = 0;       // deepest (bottom of stage) — set at load
    this.initial = 0;   // starting scroll, for progress
    this.speed = 3.2;   // easing rate (higher = snappier, still smooth)
  }

  setBounds(min, max) { this.min = min; this.max = max; }

  // Jump instantly (used once at level start, never during play).
  reset(y) { this.y = this.target = Utils.clamp(y, this.min, this.max); this.initial = this.y; }

  // Request a new destination; only *climbs* (upward) so the view never drops.
  climbTo(y) {
    const t = Utils.clamp(y, this.min, this.max);
    if (t < this.target) this.target = t;
  }

  // Force a target (e.g. final ascent to the summit once the board is clear).
  forceTo(y) { this.target = Utils.clamp(y, this.min, this.max); }

  update(dt) {
    const k = 1 - Math.exp(-this.speed * dt); // frame-rate independent easing
    this.y += (this.target - this.y) * k;
    if (Math.abs(this.target - this.y) < 0.15) this.y = this.target;
  }

  get progress() {
    if (this.initial <= this.min) return 1;
    return Utils.clamp((this.initial - this.y) / (this.initial - this.min), 0, 1);
  }

  atTop() { return this.y <= this.min + 1.5; }
  settled() { return Math.abs(this.target - this.y) < 1; }
}
