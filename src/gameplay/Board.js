/* =========================================================================
 * Board — authoritative grid state & rules. Handles placement, colour-match
 * flood fill (rainbow wildcard), special detonation chains, obstacle damage
 * and floating-bubble detection. Returns removed bubbles for the Game to
 * animate & score. No rendering, no input: pure game logic.
 * ========================================================================= */
class Board {
  constructor(cfg, grid) {
    this.cfg = cfg;
    this.grid = grid;
    this.cells = Array.from({ length: grid.rows }, () => new Array(grid.cols).fill(null));
  }

  get(r, c) { return this.grid.inBounds(r, c) ? this.cells[r][c] : null; }
  set(r, c, b) {
    this.cells[r][c] = b;
    if (b) { b.row = r; b.col = c; const p = this.grid.cellCenter(r, c); b.x = p.x; b.y = p.y; }
  }
  remove(r, c) { const b = this.cells[r][c]; this.cells[r][c] = null; return b; }

  // ---- load from data-driven layout ------------------------------------
  load(layout) {
    layout.forEach((row, r) => row.forEach((cell, c) => {
      if (cell === '.' || cell == null) return;
      let bubble;
      if (typeof cell === 'string') {
        const color = this._letterToColor(cell);
        bubble = new Bubble({ color });
      } else {
        bubble = new Bubble({
          color: this._letterToColor(cell.c || ''),
          special: cell.special || 'none',
          shell: cell.shell || 'none',
          hp: cell.hp != null ? cell.hp : (cell.shell === 'ice' ? 2 : 1),
        });
      }
      bubble.spawnT = 1;
      this.set(r, c, bubble);
    }));
  }

  _letterToColor(l) {
    return { r: 'red', b: 'blue', g: 'green', y: 'yellow', p: 'purple' }[l] || '';
  }

  // ---- geometry helpers -------------------------------------------------
  hexDistance(r1, c1, r2, c2) {
    const toCube = (row, col) => {
      const x = col - (row - (row & 1)) / 2;
      const z = row; const y = -x - z; return { x, y, z };
    };
    const a = toCube(r1, c1), b = toCube(r2, c2);
    return (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z)) / 2;
  }

  firstEmptyRowCount() {
    let count = 0;
    for (let r = 0; r < this.grid.rows; r++) {
      let any = false;
      for (let c = 0; c < this.grid.cols; c++) if (this.cells[r][c]) { any = true; break; }
      if (any) count = r + 1;
    }
    return count;
  }

  // Largest row index that still holds any bubble (the bottom of the mass).
  // Returns -1 when the board is empty.
  lowestFilledRow() {
    for (let r = this.grid.rows - 1; r >= 0; r--)
      for (let c = 0; c < this.grid.cols; c++) if (this.cells[r][c]) return r;
    return -1;
  }

  // Colour counts within a row band (used by the smart bubble generator to
  // favour colours the player can actually reach near the bottom).
  colorCountsInRows(r0, r1) {
    const out = {};
    r0 = Math.max(0, r0); r1 = Math.min(this.grid.rows - 1, r1);
    for (let r = r0; r <= r1; r++)
      for (let c = 0; c < this.grid.cols; c++) {
        const b = this.cells[r][c];
        if (b && b.color && !b.isBlocking()) out[b.color] = (out[b.color] || 0) + 1;
      }
    return out;
  }

  // Total bubbles on the board.
  countAll() {
    let n = 0;
    for (let r = 0; r < this.grid.rows; r++)
      for (let c = 0; c < this.grid.cols; c++) if (this.cells[r][c]) n++;
    return n;
  }

  isEmpty() {
    for (let r = 0; r < this.grid.rows; r++)
      for (let c = 0; c < this.grid.cols; c++) if (this.cells[r][c]) return false;
    return true;
  }

  // Reset every cell (used when (re)building a level).
  clear() {
    for (let r = 0; r < this.grid.rows; r++)
      for (let c = 0; c < this.grid.cols; c++) this.cells[r][c] = null;
  }

  // ---- query helpers (generator / validator / smart shooter) -----------
  countColor(color) {
    let n = 0;
    for (let r = 0; r < this.grid.rows; r++)
      for (let c = 0; c < this.grid.cols; c++) {
        const b = this.cells[r][c];
        if (b && b.color === color) n++;
      }
    return n;
  }

  countCrystals() {
    let n = 0;
    for (let r = 0; r < this.grid.rows; r++)
      for (let c = 0; c < this.grid.cols; c++) {
        const b = this.cells[r][c];
        if (b && b.isCrystal()) n++;
      }
    return n;
  }

  // Distinct matchable colours currently on the board (excludes crystals).
  activeColors() {
    const set = new Set();
    for (let r = 0; r < this.grid.rows; r++)
      for (let c = 0; c < this.grid.cols; c++) {
        const b = this.cells[r][c];
        if (b && b.color && !b.isBlocking()) set.add(b.color);
      }
    return [...set];
  }

  // Does this colour appear as at least one adjacent same-colour pair?
  hasPair(color) {
    for (let r = 0; r < this.grid.rows; r++)
      for (let c = 0; c < this.grid.cols; c++) {
        const b = this.cells[r][c];
        if (!b || b.color !== color || b.hasShell()) continue;
        for (const [nr, nc] of this.grid.neighbors(r, c)) {
          const nb = this.cells[nr][nc];
          if (nb && nb.color === color && !nb.hasShell()) return true;
        }
      }
    return false;
  }

  // Empty cells that would anchor a landing (ceiling row or a filled neighbour).
  anchoredEmptyCells() {
    const out = [];
    for (let r = 0; r < this.grid.rows; r++)
      for (let c = 0; c < this.grid.cols; c++) {
        if (this.cells[r][c]) continue;
        if (r === 0 || this.grid.neighbors(r, c).some(([nr, nc]) => this.cells[nr][nc])) out.push([r, c]);
      }
    return out;
  }

  // Size of the same-colour group formed if a `color` bubble were placed at
  // the (empty) cell (r,c). Counts the virtual bubble itself.
  simulateGroupSize(r, c, color) {
    const seen = new Set([r + ':' + c]);
    const stack = [[r, c]];
    let size = 1;
    while (stack.length) {
      const [cr, cc] = stack.pop();
      for (const [nr, nc] of this.grid.neighbors(cr, cc)) {
        const k = nr + ':' + nc;
        if (seen.has(k)) continue;
        const nb = this.cells[nr][nc];
        if (nb && !nb.hasShell() && !nb.isBlocking() && nb.color === color) {
          seen.add(k); stack.push([nr, nc]); size++;
        }
      }
    }
    return size;
  }

  // How many distinct (cell,colour) placements would create a match-3+?
  countOpeningMatches(colors) {
    let n = 0;
    const empties = this.anchoredEmptyCells();
    for (const [r, c] of empties) {
      for (const color of colors) {
        if (this.simulateGroupSize(r, c, color) >= 3) { n++; break; }
      }
    }
    return n;
  }


  // Nearest empty cell to a pixel position that is anchored (top row or has a
  // filled neighbour). Guarantees no floating placements.
  nearestValidCell(x, y) {
    let best = null, bestD = Infinity;
    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.cols; c++) {
        if (this.cells[r][c]) continue;
        const anchored = r === 0 || this.grid.neighbors(r, c).some(([nr, nc]) => this.cells[nr][nc]);
        if (!anchored) continue;
        const p = this.grid.cellCenter(r, c);
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bestD) { bestD = d; best = { row: r, col: c }; }
      }
    }
    return best;
  }

  // ---- core resolution after a bubble lands ----------------------------
  // Returns { popped:[Bubble], fell:[Bubble], spawnedSpecial:Bubble|null,
  //           detonated:Bool }
  resolve(placedRow, placedCol) {
    const placed = this.get(placedRow, placedCol);
    const result = { popped: [], fell: [], spawnedSpecial: null, detonated: false };
    if (!placed) return result;

    const toClear = new Set();
    const key = (r, c) => r + ':' + c;
    let clearColorCells = [];

    // Rainbow wildcard: on landing it ADOPTS the colour of the group it touches
    // and then follows the NORMAL connected-match rule (it never clears a colour
    // board-wide). Convert it to a normal coloured bubble before matching.
    if (placed.special === 'rainbow' || placed.special === this.cfg.SPECIAL.RAINBOW) {
      const target = this._dominantNeighborColor(placedRow, placedCol);
      placed.special = 'none';
      if (target) placed.color = target;
    }

    // A) The player shot a SPECIAL bubble -> detonate it immediately, no match
    //    required. (Specials are shooter bubbles now, never obstacles.)
    if (placed.special !== 'none') {
      result.detonated = true;
      toClear.add(key(placedRow, placedCol));
      this._detonateChain([[placedRow, placedCol]], toClear, key);
      // colour cells that get cleared act as "pop sources" for obstacle cracking
      clearColorCells = [...toClear].map(k => k.split(':').map(Number));
    } else {
      // B) Normal bubble -> colour-match flood fill from the placed bubble
      const group = this._matchFlood(placedRow, placedCol);
      if (group.length >= 3) {
        // reward: spawn a special at the shot cell on large matches
        const spawn = this.cfg.SPAWN_ON_MATCH[group.length];
        if (spawn && placed.special === 'none' && placed.shell === 'none') {
          placed.special = spawn;
          placed.spawnT = 0.2;
          result.spawnedSpecial = placed;
          clearColorCells = group.filter(([r, c]) => !(r === placedRow && c === placedCol));
        } else {
          clearColorCells = group.slice();
        }
        // build clear set + detonate any specials caught in the group
        const seeds = [];
        for (const [r, c] of clearColorCells) {
          toClear.add(key(r, c));
          const b = this.get(r, c); if (b && b.special !== 'none') seeds.push([r, c]);
        }
        if (seeds.length) this._detonateChain(seeds, toClear, key);
      }
    }

    // 3) obstacle cracking from adjacent colour pops (not from blast cells)
    for (const [r, c] of clearColorCells) {
      for (const [nr, nc] of this.grid.neighbors(r, c)) {
        if (toClear.has(key(nr, nc))) continue;
        const nb = this.get(nr, nc);
        if (!nb) continue;
        if (nb.isCrystal()) { nb.hp -= 1; if (nb.hp <= 0) toClear.add(key(nr, nc)); }
        else if (nb.hasShell()) { nb.hp -= 1; if (nb.hp <= 0) nb.shell = 'none'; }
      }
    }

    // 4) remove cleared bubbles
    for (const k of toClear) {
      const [r, c] = k.split(':').map(Number);
      const b = this.remove(r, c);
      if (b) { result.popped.push(b); if (b.bonus) result.bonusPopped = true; }
    }

    // 5) floating detection -> falls
    if (result.popped.length) result.fell = this._detachFloating();
    return result;
  }

  // Work-queue detonation: expands every special's blast, chaining into any
  // further specials it uncovers. Mutates `toClear`.
  _detonateChain(seedCells, toClear, key) {
    const queue = seedCells.slice();
    while (queue.length) {
      const [r, c] = queue.pop();
      const b = this.get(r, c);
      if (!b || b.special === 'none') continue;
      const cells = SpecialEffects.run(b.special, this, r, c);
      for (const [nr, nc] of cells) {
        const nb = this.get(nr, nc);
        if (!nb || toClear.has(key(nr, nc))) continue;
        toClear.add(key(nr, nc));
        if (nb.special !== 'none') queue.push([nr, nc]);
      }
    }
  }

  // Most common colour among a cell's neighbours (for the rainbow wildcard).
  _dominantNeighborColor(row, col) {
    const counts = {};
    for (const [nr, nc] of this.grid.neighbors(row, col)) {
      const b = this.get(nr, nc);
      if (b && b.color && !b.isBlocking()) counts[b.color] = (counts[b.color] || 0) + 1;
    }
    let target = null, best = 0;
    for (const k in counts) if (counts[k] > best) { best = counts[k]; target = k; }
    return target;
  }

  // Same-colour connected component (rainbow acts as wildcard). Stops at
  // shelled / crystal bubbles (they are protected).
  _matchFlood(row, col) {
    const start = this.get(row, col);
    if (!start || start.isBlocking()) return [];
    const seen = new Set([row + ':' + col]);
    const stack = [[row, col]];
    const out = [[row, col]];
    while (stack.length) {
      const [r, c] = stack.pop();
      const cur = this.get(r, c);
      for (const [nr, nc] of this.grid.neighbors(r, c)) {
        const k = nr + ':' + nc;
        if (seen.has(k)) continue;
        const nb = this.get(nr, nc);
        if (!nb || nb.hasShell() || nb.isBlocking()) continue;
        if (cur.matchesColor(nb)) { seen.add(k); stack.push([nr, nc]); out.push([nr, nc]); }
      }
    }
    return out;
  }

  // Any bubble not reachable from the top ceiling detaches and falls.
  _detachFloating() {
    const anchored = new Set();
    const stack = [];
    for (let c = 0; c < this.grid.cols; c++) if (this.cells[0][c]) { anchored.add('0:' + c); stack.push([0, c]); }
    while (stack.length) {
      const [r, c] = stack.pop();
      for (const [nr, nc] of this.grid.neighbors(r, c)) {
        const k = nr + ':' + nc;
        if (!anchored.has(k) && this.cells[nr][nc]) { anchored.add(k); stack.push([nr, nc]); }
      }
    }
    const fell = [];
    for (let r = 0; r < this.grid.rows; r++)
      for (let c = 0; c < this.grid.cols; c++) {
        if (this.cells[r][c] && !anchored.has(r + ':' + c)) {
          const b = this.remove(r, c); b.falling = true; fell.push(b);
        }
      }
    return fell;
  }
}
