/* =========================================================================
 * HexGrid — offset ("odd-r") hexagonal coordinate math + geometry helpers.
 * Pure, stateless: given config it maps between (row,col) and pixels and
 * knows the 6 neighbours of any cell. Reused by Board, Shooter and Renderer.
 * ========================================================================= */
class HexGrid {
  constructor(cfg) {
    const V = cfg.VIEW, B = cfg.BOARD;
    this.cols = B.cols;
    this.rows = B.rows;
    // Bubble diameter derived so (cols + 0.5) fit the playable width.
    const playW = V.W - B.marginX * 2;
    this.d = playW / (this.cols + 0.5);
    this.r = this.d / 2;
    this.rowH = this.d * Math.sqrt(3) / 2; // vertical spacing of hex rows
    this.originX = B.marginX + this.r;
    this.originY = B.top + this.r;
  }

  // Pixel centre of a logical cell.
  cellCenter(row, col) {
    const offset = (row & 1) ? this.d / 2 : 0;
    return {
      x: this.originX + col * this.d + offset,
      y: this.originY + row * this.rowH,
    };
  }

  inBounds(row, col) {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }

  // Six neighbours in odd-r offset layout.
  neighbors(row, col) {
    const odd = row & 1;
    const deltas = odd
      ? [[0,-1],[0,1],[-1,0],[-1,1],[1,0],[1,1]]
      : [[0,-1],[0,1],[-1,-1],[-1,0],[1,-1],[1,0]];
    const out = [];
    for (const [dr, dc] of deltas) {
      const nr = row + dr, nc = col + dc;
      if (this.inBounds(nr, nc)) out.push([nr, nc]);
    }
    return out;
  }

  // Nearest logical cell to a pixel position (rough round then refine).
  pixelToCell(x, y) {
    let best = null, bestD = Infinity;
    const approxRow = Math.round((y - this.originY) / this.rowH);
    for (let dr = -1; dr <= 1; dr++) {
      const row = approxRow + dr;
      if (row < 0 || row >= this.rows) continue;
      const offset = (row & 1) ? this.d / 2 : 0;
      const approxCol = Math.round((x - this.originX - offset) / this.d);
      for (let dc = -1; dc <= 1; dc++) {
        const col = approxCol + dc;
        if (col < 0 || col >= this.cols) continue;
        const c = this.cellCenter(row, col);
        const dist = (c.x - x) ** 2 + (c.y - y) ** 2;
        if (dist < bestD) { bestD = dist; best = { row, col }; }
      }
    }
    return best;
  }
}

const Utils = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => a + ((Math.random() * (b - a + 1)) | 0),
  pick: (arr) => arr[(Math.random() * arr.length) | 0],
  shuffle: (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; },
  easeOutBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; },
  easeOutCubic: (t) => 1 - (1 - t) ** 3,
  easeInCubic: (t) => t * t * t,
  // --- deterministic RNG (fixed seed per level) ---------------------------
  mulberry32: (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  // Stable 32-bit seed derived from a level number (used if a level omits one).
  seedFor: (n) => {
    let h = 2166136261 >>> 0; const s = 'bql-level-' + n;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  },
  // Run fn() with Math.random replaced by a seeded PRNG, then restore. Makes any
  // Math.random-based code (incl. Utils.rand/pick/shuffle) reproducible.
  withSeed: (seed, fn) => {
    const orig = Math.random;
    Math.random = Utils.mulberry32(seed);
    try { return fn(); } finally { Math.random = orig; }
  },
};
