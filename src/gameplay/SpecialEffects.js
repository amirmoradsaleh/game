/* =========================================================================
 * SpecialEffects — one reusable strategy per special. Each returns the list
 * of cells its detonation clears. Board runs them through a work-queue so
 * effects chain-react. Adding a new special = adding one entry here (OCP).
 * ========================================================================= */
const SpecialEffects = {
  // Radial blast: everything within hex radius 2 of the bomb.
  bomb(board, row, col) {
    const out = [];
    const R = 2;
    for (let r = 0; r < board.grid.rows; r++) {
      for (let c = 0; c < board.grid.cols; c++) {
        if (board.get(r, c) && board.hexDistance(row, col, r, c) <= R) out.push([r, c]);
      }
    }
    return out;
  },

  // Clears the entire row the rocket sits on.
  rocket(board, row) {
    const out = [];
    for (let c = 0; c < board.grid.cols; c++) if (board.get(row, c)) out.push([row, c]);
    return out;
  },

  // Clears the entire column.
  lightning(board, row, col) {
    const out = [];
    for (let r = 0; r < board.grid.rows; r++) if (board.get(r, col)) out.push([r, col]);
    return out;
  },

  // Spreading burn: consumes an expanding cluster of neighbours (radius 2 flood).
  fire(board, row, col) {
    const out = [];
    const seen = new Set();
    let frontier = [[row, col]]; let depth = 0;
    while (frontier.length && depth <= 2) {
      const next = [];
      for (const [r, c] of frontier) {
        const key = r + ':' + c;
        if (seen.has(key)) continue;
        seen.add(key);
        if (board.get(r, c)) out.push([r, c]);
        for (const [nr, nc] of board.grid.neighbors(r, c)) {
          if (!seen.has(nr + ':' + nc) && board.get(nr, nc)) next.push([nr, nc]);
        }
      }
      frontier = next; depth++;
    }
    return out;
  },

  // Rainbow is handled as a wildcard in Board.resolve (adopts the colour it
  // touches and matches only the CONNECTED group). It is never an on-board
  // special, so this effect is a no-op safeguard against board-wide clears.
  rainbow(board, row, col) {
    return [[row, col]];
  },

  run(special, board, row, col) {
    const fn = this[special];
    return fn ? fn.call(this, board, row, col) : [[row, col]];
  },
};
