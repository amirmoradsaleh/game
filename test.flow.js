// End-to-end flow: menu -> map -> level -> win -> unlock -> next -> lose.
const gradient = { addColorStop() {} };
const ctx = new Proxy({}, { get(_, k) { if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => gradient; if (k === 'canvas') return { width: 540, height: 960 }; return () => {}; }, set() { return true; } });
function makeEl() { const el = { style: { setProperty() {} }, dataset: {}, children: [],
  classList: { _s: {}, add(c){this._s[c]=1;}, remove(c){delete this._s[c];}, toggle(c,v){const on=v===undefined?!this._s[c]:v; if(on)this._s[c]=1; else delete this._s[c]; return !!on;}, contains(c){return !!this._s[c];} },
  addEventListener() {}, appendChild(c){this.children.push(c);return c;}, querySelector(){return makeEl();}, querySelectorAll(){return [];},
  getBoundingClientRect(){return {left:0,top:0,width:540,height:960};}, getContext(){return ctx;}, scrollIntoView(){}, set width(v){}, set height(v){}, textContent:'', innerHTML:'', disabled:false }; return el; }
global.window = { devicePixelRatio: 1, addEventListener() {} };
global.document = { getElementById: () => makeEl(), createElement: () => makeEl() };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 0; global.navigator = {};

const fs = require('fs'); const code = fs.readFileSync('dist.bundle.js', 'utf8');
const { Game, GameState } = eval('(function(){' + code + '\nreturn {Game,GameState};})()');
const keys = ['loading','loadingBar','topbar','levelLabel','pauseBtn','muteBtn','abilityBar','stage','frame','menuScreen','playBtn','collectionBtn','settingsBtn','mapScreen','mapNodes','mapBackBtn','collectionScreen','collectionGallery','collectionClose','settingsScreen','settingsMute','settingsClose','resetBtn','tutorialPopup','tutorialTitle','tutorialBody','tutorialOk','pausePopup','resumeBtn','restartBtn','winPopup','winTitle','winStars','winNext','winMap','losePopup','loseRetry','loseMap'];
const dom = {}; keys.forEach(k => dom[k] = makeEl());

let p = 0, f = 0; const ok = (n, c) => { c ? p++ : (f++, console.log('  FAIL:', n)); };
const g = new Game(makeEl(), dom); g.start();

// menu
g._showMenu(); ok('boots to MENU', g.state.is(GameState.MENU));
// map
g._showMap(); ok('PLAY -> MAP', g.state.is(GameState.MAP));
ok('save starts with L1 unlocked only', g.save.unlocked === 1);

// level starts immediately (no pre-level tutorial); the basics tutorial is
// taught DURING gameplay, pausing until dismissed
g._startLevel(1);
ok('level starts immediately in PLAYING', g.state.is(GameState.PLAYING) && g.levels.number === 1);
for (let i = 0; i < 90 && !g.tutorialActive; i++) g._update(0.016);
ok('basics tutorial triggers during gameplay', g.tutorialActive === true && g._pendingTutorial === 'basics');
g._dismissTutorial();
ok('Got it -> resumes gameplay immediately', !g.tutorialActive && g.state.is(GameState.PLAYING));
ok('tutorial marked seen (once per lifetime)', g.save.hasSeenTutorial('basics'));
ok('has a move budget', g.movesBudget >= 14 && g.moves === g.movesBudget);
// don't let later levels' tutorials interrupt the win/loss flow checks
g.save.data.tutorials = { basics: 1, bomb: 1, rainbow: 1, fireball: 1, lightning: 1, ice: 1, stone: 1, locked: 1 };

// win: clear the board, then let the camera finish its ascent to the summit
g.board.clear();
for (let i = 0; i < 600 && !g.state.is(GameState.WON); i++) g._update(0.016);
ok('cleared + camera at summit -> WON', g.state.is(GameState.WON));
ok('win awards multi-factor stars (1-3)', g._lastStars >= 2 && g._lastStars <= 3);
ok('finishing L1 unlocks L2', g.save.unlocked === 2 && g.save.starsFor(1) === g._lastStars);

// advance to next level (no tutorial at L2)
g._advance();
ok('advance -> level 2 PLAYING', g.state.is(GameState.PLAYING) && g.levels.number === 2);

// lose: run out of shots with bubbles remaining
g.moves = 0;
ok('board not empty at L2', !g.board.isEmpty());
g._update(0.016);
ok('out of shots -> LOST', g.state.is(GameState.LOST));

// retry reloads the same level
g._startLevel(2);
ok('retry L2 back to PLAYING', g.state.is(GameState.PLAYING) && g.levels.number === 2 && g.moves === g.movesBudget);

// locked level cannot be started
g._startLevel(50);
ok('locked level 50 does not start', g.levels.number === 2);

// world map (rebuilt): reversed (L1 bottom), append-only, no-jump growth, 500
{
  const dom2 = {}; keys.forEach(k => dom2[k] = makeEl());
  dom2.mapScroll = makeEl(); dom2.mapSpinner = makeEl();
  const g2 = new Game(makeEl(), dom2); g2.start();
  ok('map supports 500 levels', g2.levels.count === 500);
  ok('map loads only 50 initially', g2._mapLoaded === 50);
  ok('Levels 1-50 all instantiated', g2._mapEls.has(1) && g2._mapEls.has(50) && g2._mapEls.size === 50);
  ok('reversed: level 1 sits below higher levels', g2._mapBottom(1) < g2._mapBottom(50));
  g2._showMap();
  ok('level buttons present after open', g2._mapEls.size >= 50);
  // no-jump growth: a node keeps its on-screen position after loading more
  dom2.mapScroll.scrollTop = 300;
  const before = g2._mapTopOf(40) - dom2.mapScroll.scrollTop;
  g2._mapGrow(20);
  const after = g2._mapTopOf(40) - dom2.mapScroll.scrollTop;
  ok('loading more never jumps the view', Math.abs(before - after) < 0.001 && g2._mapLoaded === 70);
  ok('previously loaded levels remain (append-only)', g2._mapEls.has(1) && g2._mapEls.has(50) && g2._mapEls.has(70));
  g2._mapEnsureLoaded(500); ok('can load up to COUNT', g2._mapLoaded === 500 && g2._mapEls.size === 500);
  ok('loaded batches saved', g2.save.getMapLoaded() >= 70);
}

// map ALWAYS opens on the current playable level (ignores prior scrolling)
{
  const dom3 = {}; keys.forEach(k => dom3[k] = makeEl());
  dom3.mapScroll = makeEl(); dom3.mapSpinner = makeEl();
  const g3 = new Game(makeEl(), dom3); g3.start();
  g3.save.data.unlocked = 140; g3.save.setCurrentLevel(37);
  g3.save.setMapCenter(120);            // pretend the player had scrolled to 120
  g3._showMap();                        // must ignore 120 and focus current (37)
  ok('map loads enough to reach the current level', g3._mapEls.has(37));
  ok('map focuses the CURRENT level, not prior scroll', Math.abs(g3._mapCenterLevel() - 37) <= 3);
  g3.save.setMapCenter(5);              // scroll far the other way
  g3._showMap();
  ok('re-opening still focuses current level', Math.abs(g3._mapCenterLevel() - 37) <= 3);
  ok('map position persists in save', typeof g3.save.getMapCenter() === 'number');
}

// REGRESSION: a fresh open must actually instantiate Level 1 (buttons visible).
{
  const dom4 = {}; keys.forEach(k => dom4[k] = makeEl());
  dom4.mapScroll = makeEl(); dom4.mapSpinner = makeEl();
  const g4 = new Game(makeEl(), dom4); g4.start();       // fresh save: unlocked 1
  g4._showMap();                                          // PLAY -> map
  ok('Level 1 button is instantiated', g4._mapEls.has(1) && g4._mapEls.get(1).dataset.level == 1);
  ok('level buttons are present (not empty)', g4._mapEls.size >= 50);
  ok('Level 1 node is not locked (playable)', !g4._mapEls.get(1).className.includes('locked'));
  ok('saved centre is a valid low level', g4.save.getMapCenter() >= 1 && g4.save.getMapCenter() <= 3);
}

// milestone reward at level 20 (unlock it directly, clear it, expect reward)
g.save.data.unlocked = 20;
const bombBefore = g.save.inventory.bomb;
g._startLevel(20);
if (!g.state.is(GameState.PLAYING)) g._dismissTutorial();
ok('milestone L20 loads a shaped board', !g.board.isEmpty() && g.levels.level.milestone === true);
g.board.clear();
for (let i = 0; i < 900 && !g.state.is(GameState.WON); i++) g._update(0.016);
ok('milestone win grants Bomb x3', g.save.inventory.bomb === bombBefore + 3);
ok('milestone reward marked claimed', g.save.hasClaimed(20));
ok('reward popup pending', !!g._pendingReward && g._pendingReward.items.length >= 1);

// hidden bonus objective -> boosts star progress
g.save.data.unlocked = 6;
g._startLevel(6);
if (!g.state.is(GameState.PLAYING)) g._dismissTutorial();
ok('bonus level tags a bonus type', !!g.bonusType && ['fish', 'turtle', 'chest', 'pearl', 'octopus'].includes(g.bonusType));
g._onBonusFound();
ok('finding bonus sets flag + score bonus', g.bonusFound === true && g.score >= 2500);
g.board.clear();
for (let i = 0; i < 900 && !g.state.is(GameState.WON); i++) g._update(0.016);
ok('bonus objective boosts star progress (>=2)', g._lastStars >= 2 && g._lastStars <= 3);

// rewarded-video placeholder grants +3 (async)
g.save.reset(); g.save.unlockSpecial('bomb', 3);
while (g.save.useSpecial('bomb')) { }
ok('bomb depleted to 0', g.save.inventory.bomb === 0);
g._watchAdFor('bomb');
setTimeout(() => {
  ok('watch-video grants +3 bomb (saved)', g.save.inventory.bomb === 3);
  console.log(`\nFLOW: ${p} passed, ${f} failed`);
  process.exit(f ? 1 : 0);
}, 500);
