/* =========================================================================
 * LevelDatabase — the single, scalable source of truth for every level
 * (1..COUNT). Gameplay, UI, progression, rewards, stars, procedural generation
 * and map loading all read from here, so extending the game to 501..1000 later
 * only means raising COUNT (all fields are derived by formula per level).
 *
 * Each level record is DETERMINISTIC and carries its own fixed seed, so a level
 * always generates the exact same layout — restarting or revisiting reproduces
 * it identically for every player.
 *
 * Record fields:
 *   number, seed, difficulty,
 *   allowedColors        (colour distribution),
 *   abilities            (special-bubble availability, for the solver),
 *   obstacles{ice,locked,crystal}   (obstacle availability),
 *   stage                (camera height / level length + generation params),
 *   shots                (bubble/ammo count target for this tier),
 *   starThresholds       (efficiency multipliers of optimal),
 *   rewards              (milestone rewards, else null),
 *   generosity           (recommended bubble-queue logic, 1..0),
 *   milestone, shape, bonus, newMechanic, generation
 * ========================================================================= */
const LevelDatabase = (() => {
  const PALETTE = ['red', 'blue', 'green', 'yellow', 'purple'];
  const COUNT = 500;

  const band = (n) => (n <= 5 ? 'basic' : n <= 20 ? 'obstacles' : 'advanced');
  const INTRO = { 1: 'basics', 3: 'bomb', 6: 'rainbow', 9: 'fireball', 12: 'lightning', 15: 'ice', 22: 'stone', 28: 'locked' };
  const SHAPES = ['heart', 'star', 'diamond', 'butterfly', 'flower', 'spiral', 'cross', 'wave', 'hourglass', 'staircase'];
  const MREWARDS = [
    { title: 'Bomb Cache!', items: [['bomb', 3]] },
    { title: 'Rainbow Boost!', items: [['rainbow', 2]] },
    { title: 'Lightning Strike!', items: [['laser', 2]] },
    { title: 'Fireball Pack!', items: [['fireball', 3]] },
    { title: 'Mega Reward Pack!', items: [['bomb', 3], ['rainbow', 3], ['laser', 3], ['fireball', 3]] },
  ];

  // Ammo (a.k.a. "bubble count") the player receives, by difficulty tier.
  function shotsFor(n) {
    if (n <= 20) return 48;    // 45-50
    if (n <= 50) return 44;    // 42-46
    if (n <= 100) return 40;   // 38-42
    if (n <= 200) return 35;   // 32-38
    return 33;                 // 201-500, never below 32
  }

  // Adaptive queue generosity by difficulty tier (1 very generous .. 0 random).
  function generosity(n) {
    if (n <= 100) return 1.0;
    if (n <= 250) return 0.66;
    if (n <= 500) return 0.33;
    return 0.0;
  }

  function get(n) {
    n = Math.max(1, Math.min(COUNT, n | 0));
    const seed = Utils.seedFor(n);

    // colours ramp 3 -> 4 -> 5
    const colorCount = n <= 3 ? 3 : n <= 10 ? 4 : 5;
    const allowedColors = PALETTE.slice(0, colorCount);

    const rows = Math.min(6 + Math.floor((n - 1) / 7), 11);
    const fillRatio = Math.min(0.86 + n * 0.0015, 0.95);

    // obstacles introduced gradually then scale with depth
    let ice = 0, locked = 0, crystal = 0;
    if (n >= 15) ice = Math.min(2 + Math.floor((n - 15) / 4), 12);
    if (n >= 22) crystal = Math.min(1 + Math.floor((n - 22) / 10), 8);   // "stone"
    if (n >= 28) locked = Math.min(2 + Math.floor((n - 28) / 6), 12);

    // special-tool availability (solver reference; player counts live in save)
    const abilities = {};
    if (n >= 3) abilities.bomb = 1 + Math.floor(n / 25);
    if (n >= 6) abilities.rainbow = 1;
    if (n >= 9) abilities.fireball = 1;
    if (n >= 12) abilities.laser = 1;

    // camera height / level length grows with level (more sections = taller cave)
    const sections = Math.min(Math.max(5, 4 + Math.floor((n - 1) / 12)), 9);
    const stage = {
      sections, sectionRows: 5, supports: 2,
      minColors: Math.min(3, colorCount), maxColors: colorCount,
      bottomCluster: 4, topCluster: 3,
      iceMax: ice, lockedMax: locked, crystalMax: crystal,
    };

    const milestone = n % 20 === 0;
    const shape = milestone ? SHAPES[(n / 20 - 1) % SHAPES.length] : null;
    const rewards = milestone ? MREWARDS[(n / 20 - 1) % MREWARDS.length] : null;

    // hidden bonus objective in some (non-milestone) levels
    const BTYPES = ['fish', 'turtle', 'chest', 'pearl', 'octopus'];
    const bonus = ((n % 4 === 2) && !milestone) ? { type: BTYPES[n % BTYPES.length] } : null;

    return {
      number: n,
      seed,
      difficulty: Math.min(10, 1 + Math.floor((n - 1) / 50)),
      band: band(n),
      allowedColors,
      objectives: [],
      generation: { rows, fillRatio, minClusterSize: 3, maxClusterSize: 6 },
      obstacles: { ice, locked, crystal },
      abilities,
      stage,
      shots: shotsFor(n),
      starThresholds: { efficientMult: 2.0, okMult: 2.8 },
      rewards,
      generosity: generosity(n),
      milestone, shape, bonus,
      newMechanic: INTRO[n] || null,
    };
  }

  return { get, COUNT, PALETTE, band, shotsFor, generosity };
})();

// Backwards-compatible alias (older modules/tests reference `Progression`).
const Progression = LevelDatabase;
