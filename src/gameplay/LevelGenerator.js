/* =========================================================================
 * LevelGenerator — smart, cluster-based board generation.
 *
 * Replaces naive random placement. Produces boards that look handcrafted:
 *   • colours grow in natural connected clusters (never scattered noise)
 *   • no isolated single-colour bubbles (singletons are smoothed away)
 *   • every objective colour is guaranteed to appear in sufficient quantity
 *   • obstacles (ice / chain / crystal) are woven in without breaking anchoring
 *   • output is always a solid mass anchored to the ceiling (no floaters)
 *
 * Emits a data-driven `layout` (same shape Board.load already consumes), so the
 * rest of the engine is untouched. Deterministic-friendly (uses injected rng).
 * ========================================================================= */
class LevelGenerator {
  constructor(cfg, grid) {
    this.cfg = cfg;
    this.grid = grid;
    this._letter = { red: 'r', blue: 'b', green: 'g', yellow: 'y', purple: 'p' };
  }

  // ======================================================================
  // VERTICAL STAGE GENERATION
  // Builds a tall, sectioned board: clustered formations stacked and joined by
  // thin SUPPORT structures. Difficulty bands by depth (easy at the bottom the
  // player starts on, harder toward the summit). No colour objectives.
  // Returns { layout, rows, bottomRow, supports:[{row,cols}] }.
  // ======================================================================
  generateStage(level, opts = {}) {
    const cols = this.grid.cols;
    const S = level.stage;
    const shape = opts.shape || null;
    const sections = shape ? Math.min(S.sections, 5) : S.sections; // moderate height so shapes read
    const totalRows = Math.min(sections * (S.sectionRows + 1), this.grid.rows);

    const color = mat(totalRows, cols, '');
    const shell = mat(totalRows, cols, 'none');
    const filled = mat(totalRows, cols, false);
    const supports = [];

    // 1) lay out sections top(0)->bottom, with an empty divider row between
    const ranges = [];
    let cur = 0;
    for (let s = 0; s < sections; s++) {
      const r0 = cur, r1 = Math.min(cur + S.sectionRows - 1, totalRows - 1);
      ranges.push({ s, r0, r1 });
      for (let r = r0; r <= r1; r++) for (let c = 0; c < cols; c++) filled[r][c] = true;
      cur = r1 + 1;
      // divider (support) row below every section except the last
      if (s < sections - 1 && cur < totalRows) {
        const dr = cur;
        for (let c = 0; c < cols; c++) filled[dr][c] = false; // empty the divider
        const supCols = this._supportColumns(cols, S.supports, s);
        const supColor = Utils.pick(level.allowedColors);
        for (const sc of supCols) {
          // a 2-wide support plug (guarantees the vertical hex bridge)
          filled[dr][sc] = true; color[dr][sc] = supColor;
          if (sc + 1 < cols) { filled[dr][sc + 1] = true; color[dr][sc + 1] = supColor; }
        }
        supports.push({ row: dr, cols: supCols });
        cur = dr + 1;
      }
    }

    // 1b) milestone shapes get a handcrafted silhouette; normal levels get
    // organic breathing space. Both keep supports + ceiling connectivity.
    if (shape) this._applyShapeMask(filled, ranges, supports, cols, totalRows, shape);
    else this._carveStage(filled, ranges, supports, cols);

    // 2) colour + obstacles per section, banded by depth (0 bottom .. 1 top)
    for (const { s, r0, r1 } of ranges) {
      const depth = sections > 1 ? (sections - 1 - s) / (sections - 1) : 0;
      const nColors = Math.round(Utils.lerp(S.minColors, S.maxColors, depth));
      const colorsSec = level.allowedColors.slice(0, Utils.clamp(nColors, 2, level.allowedColors.length));
      const bump = shape ? 1 : 0; // milestones use bigger clusters -> bigger chains
      const minS = Math.round(Utils.lerp(S.bottomCluster, S.topCluster, depth)) + bump;
      const maxS = minS + 2 + bump;

      this._growWindow(color, shell, filled, r0, r1, cols, colorsSec, minS, maxS);
      this._capWindow(color, shell, filled, r0, r1, cols, colorsSec, maxS);
      this._smoothWindow(color, shell, filled, r0, r1, cols);

      this._placeCrystalsWindow(Math.round(depth * (S.crystalMax || 0)), shell, color, filled, r0, r1, cols);
      this._placeShellWindow('ice', Math.round(depth * (S.iceMax || 0)), shell, color, filled, r0, r1, cols);
      this._placeShellWindow('chain', Math.round(depth * (S.lockedMax || 0)), shell, color, filled, r0, r1, cols);
    }

    // 3) any leftover filled cell (e.g. a support) gets a colour
    for (let r = 0; r < totalRows; r++)
      for (let c = 0; c < cols; c++)
        if (filled[r][c] && !color[r][c] && shell[r][c] !== 'crystal') color[r][c] = Utils.pick(level.allowedColors);

    let bottomRow = 0;
    for (let r = totalRows - 1; r >= 0; r--) { if (filled[r].some(Boolean)) { bottomRow = r; break; } }

    return { layout: this._toLayout(totalRows, cols, filled, shell, color), rows: totalRows, bottomRow, supports };
  }

  // ======================================================================
  // MILESTONE STAGE — one continuous, handcrafted SHAPE hung from the ceiling
  // (heart, star, diamond, butterfly, flower ...). Distinct from regular levels:
  // symmetric silhouette, bigger colour clusters (bigger chains), slightly
  // harder. Returns { layout, rows, bottomRow, supports:[] }.
  // ======================================================================
  generateMilestone(level, shapeName) {
    const cols = this.grid.cols;
    const totalRows = Math.min(Math.round(cols * 1.9), this.grid.rows); // ~square-ish shape + climb space
    const color = mat(totalRows, cols, '');
    const shell = mat(totalRows, cols, 'none');
    const filled = mat(totalRows, cols, false);

    // centre a square shape region; hang it below the ceiling
    const size = cols - 1;                     // shape spans the full width
    const cxs = (cols - 1) / 2;
    const top = Math.max(2, Math.floor((totalRows - cols) * 0.55)); // vertical offset
    const cys = top + size / 2;
    for (let r = 0; r < totalRows; r++) for (let c = 0; c < cols; c++) {
      const x = (c - cxs) / (size / 2);
      const y = (r - cys) / (size / 2);
      if (Math.abs(x) <= 1.05 && Math.abs(y) <= 1.05 && this._shapeMask(shapeName, x, y)) filled[r][c] = true;
    }
    // hang the shape from the ceiling with a central chain
    const midc = Math.floor(cols / 2);
    let topShape = -1;
    for (let r = 0; r < totalRows && topShape < 0; r++) for (let c = 0; c < cols; c++) if (filled[r][c]) { topShape = r; break; }
    if (topShape < 0) { for (let c = 2; c < cols - 2; c++) filled[Math.floor(totalRows / 2)][c] = true; topShape = 0; }
    for (let r = 0; r <= topShape; r++) { filled[r][midc] = true; if (r % 2 === 0 && midc + 1 < cols) filled[r][midc + 1] = true; }
    this._keepCeilingConnected(filled, cols);

    // colour the whole mass with bounded clusters (bigger than normal -> bigger chains)
    const r1 = totalRows - 1;
    const colors = level.allowedColors.slice(0, Math.max(3, level.allowedColors.length));
    this._growWindow(color, shell, filled, 0, r1, cols, colors, 4, 6);
    this._capWindow(color, shell, filled, 0, r1, cols, colors, 6);
    this._smoothWindow(color, shell, filled, 0, r1, cols);
    // slightly harder obstacles
    this._placeCrystalsWindow(Math.min(3, (level.obstacles.crystal || 0) + 1), shell, color, filled, 0, r1, cols);
    this._placeShellWindow('ice', Math.min(5, (level.obstacles.ice || 0) + 1), shell, color, filled, 0, r1, cols);
    this._placeShellWindow('chain', Math.min(5, (level.obstacles.locked || 0)), shell, color, filled, 0, r1, cols);

    for (let r = 0; r < totalRows; r++) for (let c = 0; c < cols; c++)
      if (filled[r][c] && !color[r][c] && shell[r][c] !== 'crystal') color[r][c] = Utils.pick(level.allowedColors);

    let bottomRow = 0;
    for (let r = totalRows - 1; r >= 0; r--) { if (filled[r].some(Boolean)) { bottomRow = r; break; } }
    return { layout: this._toLayout(totalRows, cols, filled, shell, color), rows: totalRows, bottomRow, supports: [] };
  }

  // Milestone silhouette: keep only cells inside the chosen shape, then hang the
  // shape from the ceiling with a central chain so it stays anchored (and its
  // removal triggers a big satisfying collapse).
  _applyShapeMask(filled, ranges, supports, cols, totalRows, shapeName) {
    const rows = filled.length;
    const protect = mat(rows, cols, false);
    for (const sup of supports) for (const sc of sup.cols) for (const cc of [sc, sc + 1]) {
      if (cc < 0 || cc >= cols) continue;
      for (const rr of [sup.row - 1, sup.row, sup.row + 1]) if (rr >= 0 && rr < rows) protect[rr][cc] = true;
    }
    for (let r = 0; r < totalRows; r++) for (let c = 0; c < cols; c++) {
      if (protect[r][c]) continue;
      const x = (cols > 1 ? c / (cols - 1) : 0.5) * 2 - 1;   // -1..1
      const y = (totalRows > 1 ? r / (totalRows - 1) : 0.5) * 2 - 1;
      if (!(filled[r][c] && this._shapeMask(shapeName, x, y))) filled[r][c] = false;
    }
    // hanging chain from the ceiling to the top of the shape
    const midc = Math.floor(cols / 2);
    let topShape = -1;
    for (let r = 0; r < totalRows && topShape < 0; r++) for (let c = 0; c < cols; c++) if (filled[r][c]) { topShape = r; break; }
    if (topShape < 0) topShape = 0;
    for (let r = 0; r <= topShape; r++) { filled[r][midc] = true; if (r % 2 === 0 && midc + 1 < cols) filled[r][midc + 1] = true; }
    this._keepCeilingConnected(filled, cols);
  }

  // Shape membership in normalized coords x,y in [-1,1] (y down). Stretched to
  // the tall stage aspect on purpose — the silhouette still reads as "special".
  _shapeMask(name, x, y) {
    const r = Math.hypot(x, y), a = Math.atan2(y, x);
    switch (name) {
      case 'diamond': return Math.abs(x) + Math.abs(y) <= 1;
      case 'heart': { const X = x * 1.2, Y = -y * 1.2 + 0.2; const t = (X * X + Y * Y - 1); return t * t * t - X * X * Y * Y * Y <= 0; }
      case 'star': return r < (0.58 + 0.42 * Math.cos(5 * a - Math.PI / 2));
      case 'flower': return r < (0.5 + 0.45 * Math.cos(6 * a));
      case 'butterfly': return (Math.abs(x) < 0.14 && Math.abs(y) < 0.9) || (Math.pow((Math.abs(x) - 0.42) / 0.42, 2) + Math.pow(y / 0.7, 2) < 1);
      case 'wave': return Math.abs(y - 0.4 * Math.sin(x * Math.PI * 1.5)) < 0.42;
      case 'cross': return Math.abs(x) < 0.33 || Math.abs(y) < 0.33;
      case 'hourglass': return Math.abs(x) <= Math.abs(y) + 0.05;
      case 'spiral': { const f = r * 2.2 - a / (2 * Math.PI); return r < 1 && (f - Math.floor(f)) < 0.42; }
      case 'staircase': { const step = Math.floor((y + 1) / 2 * 5); return x <= -1 + (step + 1) * 0.4; }
      default: return Math.abs(x) + Math.abs(y) <= 1;
    }
  }

  // Carve organic gaps/curves/islands into the solid section fill, keeping the
  // support bridges intact and everything connected to the ceiling (row 0) so
  // nothing floats free. Targets ~55-80% density for a handcrafted feel.
  _carveStage(filled, ranges, supports, cols) {
    const rows = filled.length;
    const protect = mat(rows, cols, false);
    // two guaranteed full-height "spine" chains keep the whole cave anchored to
    // the ceiling (so carving can never disconnect the lower sections).
    const lastRow = ranges.length ? ranges[ranges.length - 1].r1 : rows - 1;
    const spine = [Math.floor(cols * 0.33), Math.floor(cols * 0.66)];
    for (const sc of spine) for (let r = 0; r <= lastRow; r++) { filled[r][sc] = true; protect[r][sc] = true; }
    // protect vertical support corridors (bridges between sections)
    for (const sup of supports) for (const sc of sup.cols) for (const cc of [sc, sc + 1]) {
      if (cc < 0 || cc >= cols) continue;
      for (const rr of [sup.row - 1, sup.row, sup.row + 1]) if (rr >= 0 && rr < rows) protect[rr][cc] = true;
    }
    // always keep a few central ceiling cells so the whole mass stays anchored
    for (let c = Math.floor(cols * 0.3); c <= Math.ceil(cols * 0.7); c++) if (filled[0][c] !== undefined) protect[0][c] = true;

    for (const { r0, r1 } of ranges) {
      const h = r1 - r0 + 1;
      // curved side boundaries (organic left/right edges)
      const phase = Math.random() * Math.PI * 2, amp = 1 + Math.random() * 2.2;
      for (let r = r0; r <= r1; r++) {
        const inset = Math.round((Math.sin((r - r0) / Math.max(1, h) * Math.PI + phase) + 1) * 0.5 * amp);
        for (let k = 0; k < inset; k++) {
          if (!protect[r][k]) filled[r][k] = false;
          if (!protect[r][cols - 1 - k]) filled[r][cols - 1 - k] = false;
        }
      }
      // punch a few elliptical holes (gaps between clusters / islands)
      const holes = 1 + (Math.random() * 2 | 0);
      for (let hI = 0; hI < holes; hI++) {
        const hr = r0 + Math.random() * h, hc = 1 + Math.random() * (cols - 2);
        const rrad = 0.8 + Math.random() * 1.3, crad = 1.2 + Math.random() * 2.0;
        for (let r = r0; r <= r1; r++) for (let c = 0; c < cols; c++) {
          if (protect[r][c]) continue;
          const dr = (r - hr) / rrad, dc = (c - hc) / crad;
          if (dr * dr + dc * dc < 1) filled[r][c] = false;
        }
      }
    }
    this._keepCeilingConnected(filled, cols);
  }

  // Remove any filled cell not connected (6-neighbour) to the ceiling (row 0).
  _keepCeilingConnected(filled, cols) {
    const rows = filled.length;
    const seen = mat(rows, cols, false); const q = [];
    for (let c = 0; c < cols; c++) if (filled[0][c]) { seen[0][c] = true; q.push([0, c]); }
    while (q.length) {
      const [r, c] = q.pop();
      for (const [nr, nc] of this.grid.neighbors(r, c)) {
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && filled[nr][nc] && !seen[nr][nc]) { seen[nr][nc] = true; q.push([nr, nc]); }
      }
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (filled[r][c] && !seen[r][c]) filled[r][c] = false;
  }

  _supportColumns(cols, n, seed) {
    // spread supports; vary position per divider so the climb feels handcrafted
    const out = [];
    const usable = cols - 2;
    for (let i = 0; i < n; i++) {
      const base = 1 + Math.floor(((i + 0.5) / n) * usable);
      const jitter = ((seed * 3 + i * 5) % 3) - 1;
      out.push(Utils.clamp(base + jitter, 1, cols - 2));
    }
    return [...new Set(out)];
  }

  // ---- windowed cluster helpers (operate on rows [r0..r1]) --------------
  _neighborsWindow(r, c, r0, r1, cols) {
    return this.grid.neighbors(r, c).filter(([nr, nc]) => nr >= r0 && nr <= r1 && nc >= 0 && nc < cols);
  }

  _growWindow(color, shell, filled, r0, r1, cols, colors, minS, maxS) {
    const key = (r, c) => r + ':' + c;
    const uncolored = new Set();
    for (let r = r0; r <= r1; r++) for (let c = 0; c < cols; c++)
      if (filled[r][c] && shell[r][c] !== 'crystal' && !color[r][c]) uncolored.add(key(r, c));

    let ensure = 0;
    while (uncolored.size) {
      const seed = uncolored.values().next().value;
      const [sr, sc] = seed.split(':').map(Number);
      const adj = new Set();
      for (const [nr, nc] of this._neighborsWindow(sr, sc, r0, r1, cols)) if (color[nr][nc]) adj.add(color[nr][nc]);
      let col;
      if (ensure < colors.length) col = colors[ensure++];
      else { const free = colors.filter(c => !adj.has(c)); col = free.length ? Utils.pick(free) : Utils.pick(colors); }

      const target = Utils.randInt(minS, maxS);
      let size = 1; color[sr][sc] = col; uncolored.delete(seed);
      const fr = [[sr, sc]];
      while (fr.length && size < target) {
        const [r, c] = fr.splice((Math.random() * fr.length) | 0, 1)[0];
        for (const [nr, nc] of this._neighborsWindow(r, c, r0, r1, cols)) {
          if (size >= target) break;
          const k = key(nr, nc);
          if (uncolored.has(k)) { color[nr][nc] = col; uncolored.delete(k); size++; fr.push([nr, nc]); }
        }
      }
    }
  }

  _clustersWindow(color, shell, r0, r1, cols) {
    const seen = {}; const out = [];
    const key = (r, c) => r + ':' + c;
    for (let r = r0; r <= r1; r++) for (let c = 0; c < cols; c++) {
      if (seen[key(r, c)] || !color[r][c] || shell[r][c] === 'crystal') continue;
      const col = color[r][c], cells = [], st = [[r, c]]; seen[key(r, c)] = true;
      while (st.length) {
        const [cr, cc] = st.pop(); cells.push([cr, cc]);
        for (const [nr, nc] of this._neighborsWindow(cr, cc, r0, r1, cols))
          if (!seen[key(nr, nc)] && color[nr][nc] === col && shell[nr][nc] !== 'crystal') { seen[key(nr, nc)] = true; st.push([nr, nc]); }
      }
      out.push({ color: col, cells });
    }
    return out;
  }

  _capWindow(color, shell, filled, r0, r1, cols, colors, maxS) {
    const cap = maxS + 2;
    for (let iter = 0; iter < 60; iter++) {
      const big = this._clustersWindow(color, shell, r0, r1, cols).filter(cl => cl.cells.length > cap).sort((a, b) => b.cells.length - a.cells.length);
      if (!big.length) break;
      let progressed = false;
      for (const cl of big) {
        const order = this._bfsOrderWindow(cl, color, r0, r1, cols);
        for (let k = order.length - 1; k >= cap; k--) {
          const [r, c] = order[k];
          let best = null, bestScore = Infinity;
          for (const cand of colors) {
            if (cand === cl.color) continue;
            const join = this._joinedSizeWindow(color, shell, r, c, cand, r0, r1, cols);
            const score = join <= 1 ? cap + 3 : join;
            if (score < bestScore) { bestScore = score; best = cand; }
          }
          if (best) { color[r][c] = best; progressed = true; }
        }
      }
      if (!progressed) break;
    }
  }

  _bfsOrderWindow(comp, color, r0, r1, cols) {
    const set = new Set(comp.cells.map(([r, c]) => r + ':' + c));
    const seen = new Set(); const [s0r, s0c] = comp.cells[0];
    const q = [[s0r, s0c]]; seen.add(s0r + ':' + s0c); const order = [];
    while (q.length) {
      const [r, c] = q.shift(); order.push([r, c]);
      for (const [nr, nc] of this._neighborsWindow(r, c, r0, r1, cols)) {
        const k = nr + ':' + nc;
        if (set.has(k) && !seen.has(k)) { seen.add(k); q.push([nr, nc]); }
      }
    }
    return order;
  }

  _joinedSizeWindow(color, shell, r, c, cand, r0, r1, cols) {
    const seen = new Set([r + ':' + c]); const st = [[r, c]]; let size = 1;
    while (st.length) {
      const [cr, cc] = st.pop();
      for (const [nr, nc] of this._neighborsWindow(cr, cc, r0, r1, cols)) {
        const k = nr + ':' + nc;
        if (seen.has(k) || shell[nr][nc] === 'crystal') continue;
        if (color[nr][nc] === cand) { seen.add(k); st.push([nr, nc]); size++; }
      }
    }
    return size;
  }

  _smoothWindow(color, shell, filled, r0, r1, cols) {
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (let r = r0; r <= r1; r++) for (let c = 0; c < cols; c++) {
        if (!filled[r][c] || shell[r][c] === 'crystal' || !color[r][c]) continue;
        const nbrs = this._neighborsWindow(r, c, r0, r1, cols).map(([nr, nc]) => color[nr][nc]).filter(Boolean);
        const same = nbrs.filter(x => x === color[r][c]).length;
        if (same === 0 && nbrs.length) {
          const tally = {}; for (const x of nbrs) tally[x] = (tally[x] || 0) + 1;
          color[r][c] = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0]; changed = true;
        }
      }
      if (!changed) break;
    }
  }

  _placeCrystalsWindow(count, shell, color, filled, r0, r1, cols) {
    if (!count) return;
    const spots = [];
    for (let r = r0 + 1; r < r1; r++) for (let c = 1; c < cols - 1; c++) if (filled[r][c]) spots.push([r, c]);
    Utils.shuffle(spots);
    let placed = 0;
    for (const [r, c] of spots) { if (placed >= count) break; shell[r][c] = 'crystal'; color[r][c] = ''; placed++; }
  }

  _placeShellWindow(kind, count, shell, color, filled, r0, r1, cols) {
    if (!count) return;
    const spots = [];
    for (let r = r0; r <= r1; r++) for (let c = 0; c < cols; c++)
      if (filled[r][c] && shell[r][c] === 'none' && color[r][c]) spots.push([r, c]);
    Utils.shuffle(spots);
    for (let i = 0; i < Math.min(count, spots.length); i++) { const [r, c] = spots[i]; shell[r][c] = kind; }
  }

  // Build a layout for the given level recipe. Internally retries the colour
  // pipeline until it passes quality gates (objective counts met, few
  // singletons, no board-nuking blob); returns the best attempt otherwise.
  generate(level) {
    let best = null, bestScore = -Infinity;
    for (let attempt = 0; attempt < 24; attempt++) {
      const cand = this._generateOnce(level);
      const q = this._quality(level, cand);
      if (q.ok) return cand.layout;
      if (q.score > bestScore) { bestScore = q.score; best = cand.layout; }
    }
    return best;
  }

  // Score a candidate: objective satisfaction, singleton rate, max blob size.
  _quality(level, cand) {
    const { rows, cols, filled, shell, color } = cand;
    let ok = true, score = 0;

    for (const o of level.objectives) {
      if (o.type === 'color') {
        const have = this._countColor(rows, cols, color, o.color);
        if (have < o.target) { ok = false; score -= (o.target - have) * 5; }
      }
    }
    // singleton rate
    let singles = 0, colored = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (!filled[r][c] || shell[r][c] === 'crystal' || !color[r][c]) continue;
      colored++;
      const same = this._neighborsInZone(r, c, rows, cols).some(([nr, nc]) => color[nr][nc] === color[r][c] && shell[nr][nc] !== 'crystal');
      if (!same) singles++;
    }
    const rate = colored ? singles / colored : 0;
    if (rate > 0.06) { ok = false; score -= (rate - 0.06) * 100; }

    // largest component
    const comps = this._clusters(rows, cols, color, shell);
    const maxComp = comps.reduce((m, cl) => Math.max(m, cl.cells.length), 0);
    const bound = Math.max(level.generation.maxClusterSize + 2,
      Math.max(0, ...level.objectives.filter(o => o.type === 'color').map(o => o.target)));
    if (maxComp > bound) { ok = false; score -= (maxComp - bound) * 3; }

    return { ok, score };
  }

  // One full colour pipeline pass; returns the layout plus internal grids.
  _generateOnce(level) {
    const cols = this.grid.cols;
    const rows = Math.min(level.generation.rows, this.grid.rows);
    const colors = level.allowedColors.slice();

    const color = mat(rows, cols, '');
    const shell = mat(rows, cols, 'none');
    const filled = mat(rows, cols, false);

    this._carveFillZone(rows, cols, level, filled);
    this._placeCrystals(rows, cols, level, filled, shell, color);
    this._growClusters(rows, cols, level, filled, shell, color, colors);
    this._enforceObjectiveColors(rows, cols, level, filled, shell, color, colors);
    this._smoothSingletons(rows, cols, filled, shell, color);
    this._capComponents(rows, cols, level, filled, shell, color, colors);
    this._enforceObjectiveColors(rows, cols, level, filled, shell, color, colors);
    this._placeShells(rows, cols, level, filled, shell, color);

    const layout = this._toLayout(rows, cols, filled, shell, color);
    return { layout, rows, cols, filled, shell, color };
  }

  // ---- 1) contiguous fill mass anchored to the ceiling ------------------
  _carveFillZone(rows, cols, level, filled) {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) filled[r][c] = true;

    // Remove a share of cells to hit fillRatio — only from the bottom rows and
    // the outer edges so the mass stays connected to the ceiling.
    const total = rows * cols;
    let holes = Math.round((1 - level.generation.fillRatio) * total);
    const candidates = [];
    for (let r = rows - 1; r >= Math.max(1, rows - 2); r--)
      for (let c = 0; c < cols; c++) candidates.push([r, c, Math.abs(c - (cols - 1) / 2) + (rows - r) * 3]);
    candidates.sort((a, b) => b[2] - a[2]);
    for (const [r, c] of candidates) {
      if (holes <= 0) break;
      filled[r][c] = false; holes--;
    }

    // Narrow-passage layouts: carve a couple of vertical channels through the
    // interior (top rows stay solid so both sides remain ceiling-anchored).
    if (level.generation.narrow) {
      const chans = [Math.floor(cols * 0.32), Math.floor(cols * 0.68)];
      for (const cc of chans)
        for (let r = 2; r < rows; r++)
          if ((r + cc) % 2 === 0 || r > 3) filled[r][cc] = false;
    }
  }

  // ---- 2) crystal blockers (colourless), spread through the interior ----
  _placeCrystals(rows, cols, level, filled, shell, color) {
    const want = level.obstacles.crystal | 0;
    if (!want) return;
    const spots = this._interiorCells(rows, cols, filled);
    Utils.shuffle(spots);
    let placed = 0;
    for (const [r, c] of spots) {
      if (placed >= want) break;
      // keep crystals from clumping
      if (this._neighborsInZone(r, c, rows, cols).some(([nr, nc]) => shell[nr][nc] === 'crystal')) continue;
      shell[r][c] = 'crystal'; color[r][c] = '';
      placed++;
    }
    // fallback if the interior was too small
    for (const [r, c] of spots) {
      if (placed >= want) break;
      if (shell[r][c] === 'crystal') continue;
      shell[r][c] = 'crystal'; color[r][c] = ''; placed++;
    }
  }

  // ---- 3) grow natural colour clusters (bounded, objective-aware) -------
  // Every cluster is capped at maxClusterSize and a new cluster prefers a
  // colour NOT touching its neighbours, so each colour ends up as several
  // separated patches. A single match therefore clears a satisfying group
  // (~3-8) instead of nuking an entire colour region.
  _growClusters(rows, cols, level, filled, shell, color, colors) {
    const minS = level.generation.minClusterSize;
    const maxS = level.generation.maxClusterSize;
    const need = {};
    for (const o of level.objectives) if (o.type === 'color') need[o.color] = (need[o.color] || 0) + o.target;
    const produced = {}; colors.forEach(c => produced[c] = 0);

    const keyOf = (r, c) => r + ':' + c;
    const uncolored = new Set();
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (filled[r][c] && shell[r][c] !== 'crystal') uncolored.add(keyOf(r, c));

    const neighbourColors = (r, c) => {
      const s = new Set();
      for (const [nr, nc] of this._neighborsInZone(r, c, rows, cols)) if (color[nr][nc]) s.add(color[nr][nc]);
      return s;
    };

    let ensureIdx = 0; // guarantee each allowed colour appears at least once
    while (uncolored.size) {
      const seed = uncolored.values().next().value;
      const [sr, sc] = seed.split(':').map(Number);
      const adj = neighbourColors(sr, sc);

      // choose this cluster's colour
      let col;
      if (ensureIdx < colors.length) {
        col = colors[ensureIdx++];
      } else {
        // biggest unmet objective deficit first
        let bestObj = null, bestDef = 0;
        for (const oc in need) { const def = need[oc] - produced[oc]; if (def > bestDef) { bestDef = def; bestObj = oc; } }
        const free = colors.filter(c => !adj.has(c)); // colours that won't merge
        if (bestObj && bestDef > 0 && !adj.has(bestObj)) col = bestObj;
        else if (free.length) col = Utils.pick(free);
        else if (bestObj && bestDef > 0) col = bestObj;
        else col = Utils.pick(colors);
      }

      // grow BFS into uncolored cells up to a random target size
      const target = Utils.randInt(minS, maxS);
      let size = 1;
      color[sr][sc] = col; uncolored.delete(seed); produced[col]++;
      const frontier = [[sr, sc]];
      while (frontier.length && size < target) {
        const idx = (Math.random() * frontier.length) | 0;
        const [r, c] = frontier.splice(idx, 1)[0];
        for (const [nr, nc] of this._neighborsInZone(r, c, rows, cols)) {
          if (size >= target) break;
          const k = keyOf(nr, nc);
          if (uncolored.has(k)) { color[nr][nc] = col; uncolored.delete(k); size++; produced[col]++; frontier.push([nr, nc]); }
        }
      }
    }
  }

  // Split any over-large same-colour component so matches stay moderate,
  // without dropping an objective colour below its required total. Runs last.
  // Overflow cells are recoloured one at a time into whichever colour joins the
  // SMALLEST neighbouring same-colour group — this drains big blobs into minority
  // pockets and converges (no colour ping-pong) even with only three colours.
  _capComponents(rows, cols, level, filled, shell, color, colors) {
    const need = {};
    for (const o of level.objectives) if (o.type === 'color') need[o.color] = (need[o.color] || 0) + o.target;
    const cap = level.generation.maxClusterSize + 2;

    for (let iter = 0; iter < 120; iter++) {
      const bigs = this._clusters(rows, cols, color, shell)
        .filter(cl => cl.cells.length > cap)
        .sort((a, b) => b.cells.length - a.cells.length);
      if (!bigs.length) break;
      let progressed = false;

      for (const big of bigs) {
        let budget = this._countColor(rows, cols, color, big.color) - (need[big.color] || 0);
        if (budget <= 0) continue; // pinned at objective floor

        const order = this._bfsOrder(rows, cols, big, color, shell);
        // recolour the tail (farthest cells) so the retained head stays compact
        for (let k = order.length - 1; k >= cap && budget > 0; k--) {
          const [r, c] = order[k];
          let best = null, bestScore = Infinity, bestJoin = Infinity;
          for (const cand of colors) {
            if (cand === big.color) continue;
            const join = this._joinedSize(rows, cols, color, shell, r, c, cand);
            // prefer attaching to a small existing pocket; avoid isolating (join==1)
            const score = join <= 1 ? cap + 3 : join;
            if (score < bestScore) { bestScore = score; bestJoin = join; best = cand; }
          }
          if (best && bestJoin < big.cells.length) { color[r][c] = best; budget--; progressed = true; }
        }
      }
      if (!progressed) break;
    }
  }

  // Size of the same-colour group a `cand` bubble at (r,c) would belong to.
  _joinedSize(rows, cols, color, shell, r, c, cand) {
    const seen = new Set([r + ':' + c]);
    const stack = [[r, c]];
    let size = 1;
    while (stack.length) {
      const [cr, cc] = stack.pop();
      for (const [nr, nc] of this._neighborsInZone(cr, cc, rows, cols)) {
        const k = nr + ':' + nc;
        if (seen.has(k) || shell[nr][nc] === 'crystal') continue;
        if (color[nr][nc] === cand) { seen.add(k); stack.push([nr, nc]); size++; }
      }
    }
    return size;
  }

  // BFS ordering of a component's cells from its first cell.
  _bfsOrder(rows, cols, comp, color, shell) {
    const set = new Set(comp.cells.map(([r, c]) => r + ':' + c));
    const seen = new Set();
    const [s0r, s0c] = comp.cells[0];
    const q = [[s0r, s0c]]; seen.add(s0r + ':' + s0c);
    const order = [];
    while (q.length) {
      const [r, c] = q.shift(); order.push([r, c]);
      for (const [nr, nc] of this._neighborsInZone(r, c, rows, cols)) {
        const k = nr + ':' + nc;
        if (set.has(k) && !seen.has(k)) { seen.add(k); q.push([nr, nc]); }
      }
    }
    return order;
  }

  // ---- 4) guarantee objective colours reach their targets ---------------
  _enforceObjectiveColors(rows, cols, level, filled, shell, color, colors) {
    const need = {};
    for (const o of level.objectives) if (o.type === 'color') need[o.color] = (need[o.color] || 0) + o.target;

    for (const wantColor in need) {
      let have = this._countColor(rows, cols, color, wantColor);
      if (have >= need[wantColor]) continue;

      // Recolour whole clusters of *surplus* colours into the deficient colour,
      // preserving natural grouping. Prefer the smallest surplus clusters.
      const clusters = this._clusters(rows, cols, color, shell)
        .filter(cl => cl.color !== wantColor)
        .sort((a, b) => a.cells.length - b.cells.length);

      for (const cl of clusters) {
        if (have >= need[wantColor]) break;
        const surplus = this._countColor(rows, cols, color, cl.color) - (need[cl.color] || 0);
        if (surplus < cl.cells.length) continue; // don't starve another objective
        for (const [r, c] of cl.cells) color[r][c] = wantColor;
        have += cl.cells.length;
      }

      // Last resort: recolour individual non-objective cells.
      if (have < need[wantColor]) {
        for (let r = 0; r < rows && have < need[wantColor]; r++)
          for (let c = 0; c < cols && have < need[wantColor]; c++) {
            if (!filled[r][c] || shell[r][c] === 'crystal' || color[r][c] === wantColor) continue;
            if (need[color[r][c]] && this._countColor(rows, cols, color, color[r][c]) <= need[color[r][c]]) continue;
            color[r][c] = wantColor; have++;
          }
      }
    }
  }

  // ---- 5) remove isolated single-colour bubbles -------------------------
  _smoothSingletons(rows, cols, filled, shell, color) {
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          if (!filled[r][c] || shell[r][c] === 'crystal' || !color[r][c]) continue;
          const nbrs = this._neighborsInZone(r, c, rows, cols)
            .map(([nr, nc]) => color[nr][nc]).filter(Boolean);
          const same = nbrs.filter(x => x === color[r][c]).length;
          if (same === 0 && nbrs.length) {
            // adopt the majority neighbour colour
            const tally = {};
            for (const x of nbrs) tally[x] = (tally[x] || 0) + 1;
            color[r][c] = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
            changed = true;
          }
        }
      if (!changed) break;
    }
  }

  // ---- 6) weave in ice / locked shells (keep their colour) --------------
  _placeShells(rows, cols, level, filled, shell, color) {
    const apply = (kind, count) => {
      const spots = this._interiorCells(rows, cols, filled)
        .filter(([r, c]) => shell[r][c] === 'none' && color[r][c]);
      Utils.shuffle(spots);
      for (let i = 0; i < Math.min(count, spots.length); i++) {
        const [r, c] = spots[i]; shell[r][c] = kind; // colour preserved
      }
    };
    apply('ice', level.obstacles.ice | 0);
    apply('chain', level.obstacles.locked | 0); // "locked" caged bubbles
  }

  // ---- convert internal grids into a Board-ready layout -----------------
  _toLayout(rows, cols, filled, shell, color) {
    const layout = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        if (!filled[r][c]) { row.push('.'); continue; }
        if (shell[r][c] === 'crystal') { row.push({ c: '', shell: 'crystal', hp: 1 }); continue; }
        if (shell[r][c] === 'ice') { row.push({ c: this._letter[color[r][c]], shell: 'ice', hp: 2 }); continue; }
        if (shell[r][c] === 'chain') { row.push({ c: this._letter[color[r][c]], shell: 'chain', hp: 1 }); continue; }
        row.push(this._letter[color[r][c]] || 'r');
      }
      layout.push(row);
    }
    return layout;
  }

  // ---- shared helpers ---------------------------------------------------
  _neighborsInZone(r, c, rows, cols) {
    return this.grid.neighbors(r, c).filter(([nr, nc]) => nr < rows && nr >= 0 && nc >= 0 && nc < cols);
  }
  _interiorCells(rows, cols, filled) {
    const out = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (filled[r][c] && r > 0 && r < rows - 1 && c > 0 && c < cols - 1) out.push([r, c]);
    return out.length ? out : this._allFilled(rows, cols, filled);
  }
  _allFilled(rows, cols, filled) {
    const out = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (filled[r][c]) out.push([r, c]);
    return out;
  }
  _countColor(rows, cols, color, want) {
    let n = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (color[r][c] === want) n++;
    return n;
  }
  // Connected same-colour components (ignores crystals).
  _clusters(rows, cols, color, shell) {
    const seen = mat(rows, cols, false);
    const out = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        if (seen[r][c] || !color[r][c] || shell[r][c] === 'crystal') continue;
        const col = color[r][c], cells = [], stack = [[r, c]]; seen[r][c] = true;
        while (stack.length) {
          const [cr, cc] = stack.pop(); cells.push([cr, cc]);
          for (const [nr, nc] of this._neighborsInZone(cr, cc, rows, cols))
            if (!seen[nr][nc] && color[nr][nc] === col && shell[nr][nc] !== 'crystal') { seen[nr][nc] = true; stack.push([nr, nc]); }
        }
        out.push({ color: col, cells });
      }
    return out;
  }
}

// tiny matrix helper (kept local to avoid polluting Utils)
function mat(rows, cols, v) {
  return Array.from({ length: rows }, () => new Array(cols).fill(v));
}
