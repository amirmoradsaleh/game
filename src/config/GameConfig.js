/* =========================================================================
 * GameConfig — single source of truth. Everything data-driven & tunable.
 * Bubble Quest Legends — Vertical Slice
 * ========================================================================= */
const GameConfig = (() => {
  // Logical canvas resolution (portrait). Renderer scales to the device.
  const VIEW = { W: 540, H: 960 };

  // Hex board geometry — denser grid, smaller bubbles (more cols => smaller d)
  const BOARD = {
    cols: 12,         // +1 wider board (more columns => slightly smaller bubbles)
    rows: 60,         // tall stage: only a viewport is ever visible (camera climbs)
    marginX: 10,      // left/right inner margin
    top: 140,         // y where the grid ceiling sits (below HUD)
  };

  // Colour palette — glossy candy tones (Royal Match / Bubble Witch register)
  const COLORS = {
    red:    { base: '#ff5d6c', dark: '#d63a55', light: '#ffb3bd' },
    blue:   { base: '#41a6ff', dark: '#1f73d6', light: '#a9d8ff' },
    green:  { base: '#4fd267', dark: '#27a648', light: '#b0f0bd' },
    yellow: { base: '#ffcf3f', dark: '#e0a416', light: '#ffe9a3' },
    purple: { base: '#b06cff', dark: '#7d3fd6', light: '#dfc2ff' },
  };
  const COLOR_KEYS = Object.keys(COLORS);

  // Special bubble ids (each has its own effect strategy)
  const SPECIAL = {
    NONE: 'none',
    BOMB: 'bomb',        // radial blast
    RAINBOW: 'rainbow',  // colour wildcard
    ROCKET: 'rocket',    // clears the row
    FIRE: 'fire',        // spreading burn
    LIGHTNING: 'lightning', // clears the column
  };

  // Obstacle / shell ids (modular behaviours)
  const SHELL = {
    NONE: 'none',
    ICE: 'ice',      // frozen casing, cracks when a neighbour pops
    CHAIN: 'chain',  // chained, breaks when a neighbour pops
    CRYSTAL: 'crystal', // solid colourless blocker
  };

  // Player special bubbles are equipped from the Ability Bar, never spawned
  // into the grid. Keeping this map empty guarantees no in-grid specials.
  const SPAWN_ON_MATCH = {};

  // Timings (seconds)
  const TIME = {
    shotSpeed: 1200,   // px/s of a launched bubble
    popStagger: 0.028, // delay between staggered pops
    fallGravity: 2200, // px/s^2 for falling bubbles
  };

  // Aiming limits: the launcher may rotate freely upward but never fire close to
  // horizontal. minElevation is the smallest angle (radians) above the horizon
  // allowed on BOTH sides (~18° here — within the desired 15°–20° band).
  const AIM = { minElevation: 0.32 };

  // Collision hitbox as a fraction of the bubble diameter. Slightly reduced so
  // shots can thread narrow gaps precisely; still large enough that a shot can
  // never squeeze between two touching bubbles (solid areas stay blocked).
  const COLLISION = { factor: 0.80 };

  // ---- Level data lives in LevelLibrary.js (data-driven, generated) -----
  // GameConfig holds only global tunables + palette; per-level recipes and
  // generation happen in LevelLibrary / LevelGenerator / LevelManager.

  return { VIEW, BOARD, COLORS, COLOR_KEYS, SPECIAL, SHELL, SPAWN_ON_MATCH, TIME, AIM, COLLISION };
})();
