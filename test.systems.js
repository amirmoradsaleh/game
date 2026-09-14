// Headless tests for the King-style redesign (static levels, progression, save,
// stars, circular queue, and the connected-cluster matching FIX).
const fs = require('fs');
const code = fs.readFileSync('dist.bundle.js', 'utf8');
const api = eval('(function(){' + code + '\n return {GameConfig,HexGrid,Utils,Board,Bubble,Progression,LevelGenerator,LevelManager,BubbleQueue,DifficultyManager,AbilityBar,SaveManager,RewardedAdManager};})()');
const { GameConfig, HexGrid, Utils, Board, Bubble, Progression, LevelGenerator, LevelManager, BubbleQueue, DifficultyManager, AbilityBar, SaveManager, RewardedAdManager } = api;

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : (fail++, console.log('  FAIL:', n)); };
const grid = new HexGrid(GameConfig);

// ---- 1) CRITICAL FIX: only the CONNECTED same-colour cluster is removed ----
console.log('Connected-cluster matching (critical fix):');
{
  const b = new Board(GameConfig, grid);
  // all in row 0 (anchored) so nothing floats away and confounds the test
  b.set(0, 3, new Bubble({ color: 'red' }));
  b.set(0, 4, new Bubble({ color: 'red' }));
  b.set(0, 5, new Bubble({ color: 'red' }));
  b.set(0, 6, new Bubble({ color: 'blue' }));
  b.set(0, 7, new Bubble({ color: 'blue' }));
  b.set(0, 9, new Bubble({ color: 'red' })); // SEPARATE red, not connected
  // shoot a red next to the connected trio
  b.set(0, 2, new Bubble({ color: 'red' }));
  const res = b.resolve(0, 2);
  ok('connected red cluster popped (>=3)', res.popped.length >= 3);
  ok('separate red bubble NOT removed', !!b.cells[0][9] && b.cells[0][9].color === 'red');
  ok('connected reds are gone', !b.cells[0][2] && !b.cells[0][3] && !b.cells[0][4] && !b.cells[0][5]);
  ok('untouched blues remain', !!b.cells[0][6] && !!b.cells[0][7]);
}

// ---- 1b) RAINBOW FIX: wildcard adopts touched colour, clears CONNECTED only --
console.log('Rainbow wildcard (connected-only, never board-wide):');
{
  const b = new Board(GameConfig, grid);
  b.set(0, 3, new Bubble({ color: 'blue' }));
  b.set(0, 4, new Bubble({ color: 'blue' }));
  b.set(0, 5, new Bubble({ color: 'blue' }));
  b.set(0, 9, new Bubble({ color: 'blue' }));   // SEPARATE blue cluster
  b.set(0, 10, new Bubble({ color: 'blue' }));
  // shoot a RAINBOW next to the connected blue trio
  b.set(0, 2, new Bubble({ color: '', special: 'rainbow' }));
  const res = b.resolve(0, 2);
  ok('rainbow adopted blue + popped connected group', res.popped.length >= 3);
  ok('rainbow did NOT clear blue board-wide', !!b.cells[0][9] && !!b.cells[0][10] && b.cells[0][9].color === 'blue');
  ok('connected blues (incl. rainbow) gone', !b.cells[0][2] && !b.cells[0][3] && !b.cells[0][4] && !b.cells[0][5]);
}
console.log('Progression bands (progressive unlock):');
ok('has 500 levels', Progression.COUNT === 500);
ok('L1-2 basic (no obstacles, no specials)', [1, 2].every(n => { const o = Progression.get(n).obstacles; const a = Progression.get(n).abilities; return !o.ice && !o.locked && !o.crystal && Object.keys(a).length === 0; }));
ok('bomb unlocks at 3', Progression.get(3).abilities.bomb > 0 && !Progression.get(2).abilities.bomb);
ok('rainbow unlocks at 6', Progression.get(6).abilities.rainbow > 0 && !Progression.get(5).abilities.rainbow);
ok('ice introduced at 15', Progression.get(15).obstacles.ice > 0 && Progression.get(14).obstacles.ice === 0);
ok('stone (crystal) introduced at 22', Progression.get(22).obstacles.crystal > 0 && Progression.get(21).obstacles.crystal === 0);
ok('locked introduced at 28', Progression.get(28).obstacles.locked > 0 && Progression.get(27).obstacles.locked === 0);
ok('colours ramp 3->5', Progression.get(1).allowedColors.length === 3 && Progression.get(100).allowedColors.length === 5);
ok('specials available later (solver)', Object.keys(Progression.get(12).abilities).length >= 3);
ok('tutorial flags scheduled', Progression.get(1).newMechanic === 'basics' && Progression.get(3).newMechanic === 'bomb' && Progression.get(6).newMechanic === 'rainbow' && Progression.get(15).newMechanic === 'ice' && Progression.get(28).newMechanic === 'locked');
ok('deterministic (same config twice)', JSON.stringify(Progression.get(37)) === JSON.stringify(Progression.get(37)));

// ---- 3) Static level generation across the range -----------------------
console.log('Static level generation:');
for (const n of [1, 5, 6, 15, 21, 40, 70, 100]) {
  const mgr = new LevelManager(GameConfig, grid); mgr.goto(n);
  const board = new Board(GameConfig, grid);
  const diag = mgr.buildInto(board);
  ok(`L${n} anchored to ceiling`, [...Array(grid.cols).keys()].some(c => board.cells[0][c]));
  ok(`L${n} only allowed colours`, board.activeColors().every(c => mgr.level.allowedColors.includes(c)));
  ok(`L${n} has a move budget`, diag.moves >= 14);
  ok(`L${n} not initially empty`, !board.isEmpty());
  const lvl = mgr.level;
  if (lvl.obstacles.crystal > 0) ok(`L${n} has crystals`, board.countCrystals() > 0);
}

// ---- 4) Deterministic stars --------------------------------------------
console.log('Star logic (easier, bonus-aware):');
{
  const mgr = new LevelManager(GameConfig, grid);
  ok('3 stars when efficient (<=2x opt)', mgr.starsFor(10, 10, false) === 3 && mgr.starsFor(20, 10, false) === 3);
  ok('3 stars when bonus objective found', mgr.starsFor(40, 10, true) === 3);
  ok('2 stars for reasonable play', mgr.starsFor(25, 10, false) === 2 && mgr.starsFor(28, 10, false) === 2);
  ok('1 star for just completing', mgr.starsFor(30, 10, false) === 1);
  ok('same input -> same stars (not random)', mgr.starsFor(22, 10, false) === mgr.starsFor(22, 10, false));
}

// ---- 5) SaveManager: sequential unlock + best stars --------------------
console.log('Save / unlock:');
{
  const s = new SaveManager(); s.reset();
  ok('starts with only L1 unlocked', s.unlocked === 1 && s.isUnlocked(1) && !s.isUnlocked(2));
  s.recordResult(1, 2);
  ok('finishing L1 unlocks L2', s.isUnlocked(2) && !s.isUnlocked(3));
  ok('stars recorded', s.starsFor(1) === 2);
  s.recordResult(1, 3); ok('keeps best stars', s.starsFor(1) === 3);
  s.recordResult(1, 1); ok('does not downgrade', s.starsFor(1) === 3);
  ok('tutorial persistence', !s.hasSeenTutorial('ice') && (s.markTutorial('ice'), s.hasSeenTutorial('ice')));
}

// ---- 6) Queue: current + next, tap-swap, auto-advance ------------------
console.log('Circular queue (current/next):');
{
  const mgr = new LevelManager(GameConfig, grid); mgr.goto(3);
  const b2 = new Board(GameConfig, grid); mgr.buildInto(b2);
  const q = new BubbleQueue(GameConfig, b2, () => ({ struggle: 0, helpful: [] }));
  ok('has current + next', !!q.current && !!q.next);
  ok('no specials in queue', q.current.special === 'none' && q.next.special === 'none');
  const cur = q.current, nx = q.next; q.swap();
  ok('tap-swap exchanges current<->next', q.current === nx && q.next === cur);
  const before = q.next; q.advance();
  ok('advance: next->current', q.current === before);
  ok('advance: new next generated', q.next !== before);
}

// ---- 7) Completion: only when board cleared ----------------------------
console.log('Completion logic:');
{
  const mgr = new LevelManager(GameConfig, grid); mgr.goto(2);
  const b3 = new Board(GameConfig, grid); mgr.buildInto(b3);
  ok('not complete while bubbles remain', !b3.isEmpty());
  b3.clear();
  ok('complete only when board empty', b3.isEmpty());
}

// ---- 8) Ability shots still detonate (player tools) --------------------
console.log('Ability tools:');
{
  const mgr = new LevelManager(GameConfig, grid); mgr.goto(30);
  const b4 = new Board(GameConfig, grid); mgr.buildInto(b4);
  const em = b4.anchoredEmptyCells()[0];
  b4.set(em[0], em[1], new Bubble({ color: 'red', special: 'bomb' }));
  ok('bomb tool detonates', b4.resolve(em[0], em[1]).detonated === true);
  const bar = new AbilityBar({ bomb: 2 });
  bar.toggle('bomb'); ok('equip+consume', bar.consume() === 'bomb' && bar.slots[0].count === 1);
}

// ---- 9) Persistent special inventory -----------------------------------
console.log('Persistent special inventory:');
{
  const s = new SaveManager(); s.reset();
  ok('starts EMPTY (progressive unlock)', (s.inventory.bomb || 0) === 0 && (s.inventory.rainbow || 0) === 0);
  ok('unlockSpecial grants once', s.unlockSpecial('bomb', 3) && s.inventory.bomb === 3 && !s.unlockSpecial('bomb', 3) && s.inventory.bomb === 3);
  ok('useSpecial decrements + persists', s.useSpecial('bomb') && s.inventory.bomb === 2);
  ok('addSpecial adds to inventory', (s.addSpecial('rainbow', 2), s.inventory.rainbow === 2));
  ok('milestone claims tracked once', !s.hasClaimed(20) && (s.markClaimed(20), s.hasClaimed(20)));
}

// ---- 10) Milestone levels (handcrafted shapes) -------------------------
console.log('Milestone levels:');
ok('every 20th level is a milestone', Progression.get(20).milestone && Progression.get(40).milestone && !Progression.get(19).milestone && !Progression.get(21).milestone);
ok('milestones carry a shape', typeof Progression.get(20).shape === 'string' && typeof Progression.get(100).shape === 'string');
for (const n of [20, 40, 60, 80, 100]) {
  const mgr = new LevelManager(GameConfig, grid); mgr.goto(n);
  const board = new Board(GameConfig, grid);
  mgr.buildInto(board);
  ok(`L${n} milestone builds a shaped mass`, board.countAll() >= 30 && board.countAll() <= 220);
  ok(`L${n} milestone anchored to ceiling`, [...Array(grid.cols).keys()].some(c => board.cells[0][c]));
  ok(`L${n} milestone only allowed colours`, board.activeColors().every(c => mgr.level.allowedColors.includes(c)));
}

// ---- 11) Monetization & polish pass ------------------------------------
console.log('Difficulty generosity tiers:');
ok('levels 1-100 very generous (1.0)', Progression.get(1).generosity === 1.0 && Progression.get(100).generosity === 1.0);

console.log('Hidden bonus objectives (some levels):');
ok('bonus appears in some levels, not all', !!Progression.get(6).bonus && !Progression.get(1).bonus);
ok('bonus never on milestones', !Progression.get(20).bonus && !Progression.get(40).bonus);
ok('bonus has a themed type', ['fish', 'turtle', 'chest', 'pearl', 'octopus'].includes((Progression.get(6).bonus || {}).type));
{
  const b = new Board(GameConfig, grid);
  b.set(0, 3, new Bubble({ color: 'red' }));
  b.set(0, 4, new Bubble({ color: 'red' }));
  const bonus = new Bubble({ color: 'red' }); bonus.bonus = true; b.set(0, 5, bonus);
  b.set(0, 2, new Bubble({ color: 'red' }));
  const res = b.resolve(0, 2);
  ok('popping the bonus bubble is detected', res.bonusPopped === true);
}

console.log('Generous shot budget (beginner-friendly):');
for (const n of [1, 10, 50]) {
  const mgr = new LevelManager(GameConfig, grid); mgr.goto(n);
  const board = new Board(GameConfig, grid); const diag = mgr.buildInto(board);
  ok(`L${n} budget >= 32 and matches tier ammo`, diag.moves >= 32 && diag.moves >= mgr.level.shots);
}

console.log('Rewarded-ad architecture (placeholder):');
ok('RewardedAdManager available + grants +3', RewardedAdManager.isAvailable() && RewardedAdManager.REWARD_AMOUNT === 3);
{
  const s = new SaveManager(); s.reset(); s.unlockSpecial('bomb', 3);
  while (s.useSpecial('bomb')) { }
  ok('depleted special can be topped up (+3)', s.inventory.bomb === 0 && (s.addSpecial('bomb', 3), s.inventory.bomb === 3));
}

console.log('Smart generator (weights toward reachable colours):');
{
  const b = new Board(GameConfig, grid);
  // bottom band dominated by blue; a few reds/greens elsewhere
  for (let c = 0; c < 12; c++) b.set(10, c, new Bubble({ color: 'blue' }));
  b.set(10, 0, new Bubble({ color: 'red' })); b.set(9, 5, new Bubble({ color: 'green' }));
  b.set(0, 0, new Bubble({ color: 'red' })); b.set(0, 1, new Bubble({ color: 'green' }));
  const q = new BubbleQueue(GameConfig, b, () => ({ struggle: 0, helpful: [] }));
  q.generosity = 1.0;
  let blue = 0, N = 600;
  for (let i = 0; i < N; i++) if (q._pickColor() === 'blue') blue++;
  ok('blue favoured but never guaranteed', blue > N * 0.4 && blue < N);
  q.generosity = 0.0; let blue2 = 0;
  for (let i = 0; i < N; i++) if (q._pickColor() === 'blue') blue2++;
  ok('generosity 0 -> closer to uniform', blue2 < blue);
}

console.log('Deterministic levels (fixed seed per level):');
{
  const sig = (b) => { let s = ''; for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) { const x = b.cells[r][c]; s += x ? (x.shell[0] + (x.color ? x.color[0] : '_')) : '..'; } return s; };
  const m1 = new LevelManager(GameConfig, grid); m1.goto(7); const b1 = new Board(GameConfig, grid); const d1 = m1.buildInto(b1);
  const m2 = new LevelManager(GameConfig, grid); m2.goto(7); const b2 = new Board(GameConfig, grid); const d2 = m2.buildInto(b2);
  ok('same level -> identical layout every time', sig(b1) === sig(b2));
  ok('same level -> identical budget + optimal', d1.moves === d2.moves && d1.optimal === d2.optimal);
  const m3 = new LevelManager(GameConfig, grid); m3.goto(8); const b3 = new Board(GameConfig, grid); m3.buildInto(b3);
  ok('different level -> different layout', sig(b1) !== sig(b3));
  ok('seeds are stable numbers', typeof Progression.get(7).seed === 'number' && Progression.get(7).seed === Progression.get(7).seed);
}

console.log('LevelDatabase records (single source of truth):');
{
  const L = Progression.get(120);
  ok('record carries seed/difficulty/shots/starThresholds/generosity', typeof L.seed === 'number' && typeof L.difficulty === 'number' && typeof L.shots === 'number' && !!L.starThresholds && typeof L.generosity === 'number');
  ok('record carries stage(length)/obstacles/abilities', !!L.stage && !!L.stage.sections && !!L.obstacles && !!L.abilities);
  ok('milestone record has rewards + shape', !!Progression.get(120).rewards && !!Progression.get(120).shape);
  ok('tier ammo 48 early / 33 late / never < 32', Progression.get(5).shots === 48 && Progression.get(300).shots === 33 && Progression.get(500).shots >= 32);
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
