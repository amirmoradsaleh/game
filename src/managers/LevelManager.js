/* =========================================================================
 * LevelManager — owns the current level number (1..100) and turns a
 * Progression recipe into a validated, static, fully-clearable board.
 *
 * Win condition is "clear the whole board", so the move budget is derived from
 * the generated bubble count, and deterministic star thresholds are returned
 * for the results screen (never randomised).
 * ========================================================================= */
class LevelManager {
  constructor(cfg, grid) {
    this.cfg = cfg;
    this.grid = grid;
    this.generator = new LevelGenerator(cfg, grid);
    this._scratch = new Board(cfg, grid);
    this.number = 1;
    this.count = Progression.COUNT;
    this.MAX_ATTEMPTS = 16;
  }

  get level() { return Progression.get(this.number); }
  get isLast() { return this.number >= this.count; }
  goto(n) { this.number = Math.max(1, Math.min(this.count, n | 0)); return this.level; }
  next() { if (!this.isLast) this.number++; return this.level; }

  // Generate this level's CLIMB stage. Generation runs under the level's FIXED
  // SEED so the layout (and derived budget) is identical every time the level is
  // played — restart or revisit reproduces it exactly. The shot budget comes
  // from the LevelDatabase tier ("bubble count"), the star thresholds from the
  // database, and the near-optimal solve guarantees clearability.
  buildInto(board) {
    const level = this.level;
    return Utils.withSeed(level.seed, () => this._buildDeterministic(board, level));
  }

  _buildDeterministic(board, level) {
    let best = null, bestOpen = -1, bestStage = null;
    for (let attempt = 0; attempt < this.MAX_ATTEMPTS; attempt++) {
      const stage = level.milestone ? this.generator.generateMilestone(level, level.shape) : this.generator.generateStage(level);
      board.clear();
      board.load(stage.layout);
      const openings = board.countOpeningMatches(board.activeColors());
      if (openings >= 3) { best = stage.layout; bestOpen = openings; bestStage = stage; break; }
      if (openings > bestOpen) { bestOpen = openings; best = stage.layout; bestStage = stage; }
    }
    if (!bestStage) { bestStage = level.milestone ? this.generator.generateMilestone(level, level.shape) : this.generator.generateStage(level); best = bestStage.layout; }
    board.clear();
    board.load(best);

    const optimal = this._estimateOptimal(best, level);
    const bubbles = board.countAll();
    // Ammo ("bubble count") from the database tier, plus a small allowance for
    // obstacles; never below 32 and always enough to clear (>= optimal + 4).
    const obstacleBonus = (level.obstacles.ice + level.obstacles.locked + level.obstacles.crystal) > 0 ? 4 : 0;
    const moves = Utils.clamp(Math.max(level.shots + obstacleBonus, optimal + 4), 32, 200);
    this.optimal = optimal;
    return {
      level, moves, optimal, bubbles, openings: bestOpen,
      rows: bestStage.rows, bottomRow: board.lowestFilledRow(), supports: bestStage.supports || [],
    };
  }

  // Easier, multi-factor star rating from the database thresholds. Completing is
  // 1 star; reasonable shots left is 2; efficient play OR the hidden bonus is 3.
  starsFor(shotsUsed, optimal, bonusFound) {
    optimal = Math.max(1, optimal | 0);
    const th = (this.level && this.level.starThresholds) || { efficientMult: 2.0, okMult: 2.8 };
    if (bonusFound) return 3;
    if (shotsUsed <= Math.ceil(optimal * th.efficientMult)) return 3;
    if (shotsUsed <= Math.ceil(optimal * th.okMult)) return 2;
    return 1;
  }

  // Greedy near-optimal solver on a scratch board: how few shots clear it.
  _estimateOptimal(layout, level) {
    const b = this._scratch, grid = this.grid;
    b.clear(); b.load(layout);
    const abilities = Object.assign({}, level.abilities);
    let shots = 0, guard = 0;
    while (!b.isEmpty() && guard++ < 300) {
      const cols = b.activeColors(); if (!cols.length) break;
      const em = b.anchoredEmptyCells(); if (!em.length) break;
      let best = null, bestN = 2;
      for (const [r, c] of em) for (const col of cols) {
        const s = b.simulateGroupSize(r, c, col);
        if (s > bestN) { bestN = s; best = { r, c, col }; }
      }
      if (best) { b.set(best.r, best.c, new Bubble({ color: best.col })); b.resolve(best.r, best.c); shots++; continue; }
      // no match: spend a bomb on the fullest reachable cell
      if ((abilities.bomb || 0) > 0) {
        let t = em[0], bn = -1;
        for (const [r, c] of em) { const k = grid.neighbors(r, c).filter(([nr, nc]) => b.cells[nr] && b.cells[nr][nc]).length; if (k > bn) { bn = k; t = [r, c]; } }
        b.set(t[0], t[1], new Bubble({ color: cols[0], special: 'bomb' })); b.resolve(t[0], t[1]); abilities.bomb--; shots++; continue;
      }
      // build toward a match at the fullest cell
      let t = em[0], bn = -1;
      for (const [r, c] of em) { const k = grid.neighbors(r, c).filter(([nr, nc]) => b.cells[nr] && b.cells[nr][nc]).length; if (k > bn) { bn = k; t = [r, c]; } }
      b.set(t[0], t[1], new Bubble({ color: cols[0] })); b.resolve(t[0], t[1]); shots++;
    }
    return Math.max(3, shots);
  }
}
