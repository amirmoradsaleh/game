/* =========================================================================
 * Shooter — aim vector, wall-bounce trajectory preview, and the flying
 * bubble simulation. Emits a landing cell when the projectile collides.
 * ========================================================================= */
class Shooter {
  constructor(cfg, grid, board) {
    this.cfg = cfg; this.grid = grid; this.board = board;
    this.x = cfg.VIEW.W / 2;
    this.y = cfg.VIEW.H - 120;
    this.angle = -Math.PI / 2;      // pointing up
    this.aimValid = false;          // becomes true once a valid (non-horizontal) aim is set
    this.aiming = false;
    this.flying = null;             // { bubble, x, y, vx, vy }
    this.minLeft = cfg.BOARD.marginX + grid.r;
    this.maxRight = cfg.VIEW.W - cfg.BOARD.marginX - grid.r;
    this.ceiling = cfg.BOARD.top - grid.r;
    this.GAP_ASSIST = 1.9;          // grazing forgiveness used by the AIM GUIDE (unchanged)
    this.STEP = 3.5;                // shared collision-sampling step (guide == flight)
    // The real moving bubble is allowed a *hair* more grazing tolerance than the
    // guide (~+3.5% of a bubble). This only ever makes the flight MORE forgiving
    // than the aim line, never less — so any gap the aim line shows as passable is
    // always cleared by the real bubble. It never shrinks the base hitbox, never
    // changes placed-bubble spacing, and (via the same grazing-past gate) never
    // lets a shot through a solid pair or a wall.
    this.GAP_ASSIST_FLIGHT = this.GAP_ASSIST + this.grid.d * 0.035;
  }

  aimAt(px, py) {
    const dx = px - this.x, dy = py - this.y;
    // The launcher fires UPWARD only. If the player aims too close to horizontal
    // (elevation below minElevation) the aim is CANCELLED: the angle is not
    // updated, the trajectory hides and releasing won't fire — the player must
    // aim again. Valid aims (elevation >= minElevation) update the angle.
    const minElev = (this.cfg.AIM && this.cfg.AIM.minElevation) || 0.32;
    if (dy >= 0) { this.aimValid = false; return; }            // at/below the launcher
    const elevation = Math.atan2(-dy, Math.abs(dx));           // 0..PI/2 above horizontal
    if (elevation < minElev) { this.aimValid = false; return; } // too horizontal -> cancel
    this.angle = Math.atan2(dy, dx);
    this.aimValid = true;
  }

  // Current aim limits (radians), exposed for UI/tests.
  aimLimits() {
    const minElev = (this.cfg.AIM && this.cfg.AIM.minElevation) || 0.32;
    return { min: -Math.PI + minElev, max: -minElev, minElevation: minElev };
  }

  canShoot() { return !this.flying; }

  launch(bubble) {
    if (this.flying) return;
    bubble.x = this.x; bubble.y = this.y; bubble.spawnT = 1; bubble.land = 0.5; bubble.rot = 0; // tiny launch squash
    // pre-compute the total path length so the flight can ease in/out naturally
    const pts = this.previewPath();
    let total = 0, px = this.x, py = this.y;
    for (const p of pts) { total += Math.hypot(p.x - px, p.y - py); px = p.x; py = p.y; }
    this.flying = {
      bubble,
      x: this.x, y: this.y,
      vx: Math.cos(this.angle) * this.cfg.TIME.shotSpeed,
      vy: Math.sin(this.angle) * this.cfg.TIME.shotSpeed,
      dist: 0, totalDist: Math.max(1, total), carry: 0,
    };
  }

  // Predict the bounce path. With no args (flight / consistency) it uses the true
  // centre bounds (minLeft/maxRight). The aim-guide renderer passes the play-field
  // EDGE bounds so the drawn line reaches the wall; the pre-bounce leg is identical
  // either way, so the visible aim stays accurate.
  previewPath(wallL, wallR) {
    const L = wallL != null ? wallL : this.minLeft;
    const R = wallR != null ? wallR : this.maxRight;
    const pts = [];
    let x = this.x, y = this.y;
    let ux = Math.cos(this.angle), uy = Math.sin(this.angle);
    const STEP = this.STEP;
    const maxSteps = Math.ceil((this.cfg.VIEW.H * 3) / STEP);
    this.previewLanding = null;
    let acc = 0;
    for (let i = 0; i < maxSteps; i++) {
      x += ux * STEP; y += uy * STEP;
      if (x < L) { x = L; ux = -ux; pts.push({ x, y, wall: -1 }); acc = 0; }
      else if (x > R) { x = R; ux = -ux; pts.push({ x, y, wall: 1 }); acc = 0; }
      if (y <= this.ceiling || this._shouldCollide(x, y, ux, uy)) {
        pts.push({ x, y });
        const cell = this.board.nearestValidCell(x, y);
        if (cell) {
          const p = this.grid.cellCenter(cell.row, cell.col);
          this.previewLanding = { row: cell.row, col: cell.col, x: p.x, y: p.y };
        }
        break;
      }
      acc += STEP;
      if (acc >= 6) { pts.push({ x, y }); acc = 0; }   // sample for the dotted line
    }
    return pts;
  }

  // Overlap info at (x,y): the deepest penetration into any nearby placed bubble.
  _hitInfo(x, y) {
    const rr = this.grid.d * ((this.cfg.COLLISION && this.cfg.COLLISION.factor) || 0.80);
    let pen = 0;
    const approx = this.grid.pixelToCell(x, y);
    if (!approx) return { hit: false, pen: 0 };
    const cells = [[approx.row, approx.col], ...this.grid.neighbors(approx.row, approx.col)];
    for (const [r, c] of cells) {
      const b = this.board.cells[r] && this.board.cells[r][c];
      if (!b) continue;
      const dist = Math.hypot(x - b.x, y - b.y);
      const p = rr - dist;
      if (p > pen) pen = p;
    }
    return { hit: pen > 0, pen };
  }

  // Whether the bubble should collide at (x,y) travelling in unit direction
  // (ux,uy). Smart Gap Assist: a grazing overlap within ~1px that is DECREASING
  // one STEP ahead (threading a gap) is let through; a head-on approach (overlap
  // increasing) always collides, so solid masses and walls are never passed.
  // Both the flight and the guide call this with the SAME fixed STEP look-ahead.
  _shouldCollide(x, y, ux, uy, assist) {
    const tol = (assist != null) ? assist : this.GAP_ASSIST;
    const hi = this._hitInfo(x, y);
    if (!hi.hit) return false;
    if (hi.pen <= tol) {
      const ahead = this._hitInfo(x + ux * this.STEP, y + uy * this.STEP);
      if (ahead.pen < hi.pen) return false;   // grazing past -> thread the gap
    }
    return true;
  }

  // Kept for tests/back-compat: plain boolean overlap test (no gap assist).
  _hitTest(x, y) { return this._hitInfo(x, y).hit; }

  // Advance the flying bubble. Returns landing {row,col} or null if still moving.
  // Steps at the shared STEP resolution and uses the shared _shouldCollide, so the
  // path exactly matches what previewPath() draws for the aim guide.
  update(dt, onTrail) {
    if (!this.flying) return null;
    const f = this.flying;
    // three-stage speed curve: ease-in (first 10%), constant, gentle ease-out
    // (final ~18%). This only scales how far it travels per frame — NOT where it
    // collides — so the prediction stays identical.
    const frac = Utils.clamp(f.dist / f.totalDist, 0, 1);
    let mult = 1;
    if (frac < 0.10) mult = Utils.lerp(0.7, 1, frac / 0.10);
    else if (frac > 0.82) mult = Utils.lerp(1, 0.72, (frac - 0.82) / 0.18);
    const speed = this.cfg.TIME.shotSpeed;
    let budget = speed * mult * dt + (f.carry || 0);
    while (budget >= this.STEP) {
      let ux = f.vx / speed, uy = f.vy / speed;
      f.x += ux * this.STEP; f.y += uy * this.STEP; f.dist += this.STEP;
      if (f.x < this.minLeft) { f.x = this.minLeft; f.vx = -f.vx; }
      else if (f.x > this.maxRight) { f.x = this.maxRight; f.vx = -f.vx; }
      f.bubble.x = f.x; f.bubble.y = f.y;
      ux = f.vx / speed; uy = f.vy / speed;                 // dir after any bounce
      if (f.y <= this.ceiling || this._shouldCollide(f.x, f.y, ux, uy, this.GAP_ASSIST_FLIGHT)) {
        const cell = this.board.nearestValidCell(f.x, f.y);
        this.flying = null;
        return cell;
      }
      budget -= this.STEP;
    }
    f.carry = budget;                                       // whole-STEP grid == guide
    // slight lean based on horizontal direction + decay the launch squash
    f.bubble.rot = (f.vx / speed) * 0.22;
    f.bubble.land = Math.max(0, (f.bubble.land || 0) - dt * 3);
    if (onTrail) onTrail(f.x, f.y, f.bubble);
    return null;
  }
}
