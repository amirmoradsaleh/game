const gradient={addColorStop(){}};
const ctx=new Proxy({},{get(_,k){if(k==='createLinearGradient'||k==='createRadialGradient')return()=>gradient;if(k==='canvas')return{width:540,height:960};return()=>{};},set(){return true;}});
function makeEl(){return{style:{setProperty(){}},dataset:{},children:[],classList:{_s:{},add(){},remove(){},toggle(){},contains(){return false;}},addEventListener(){},appendChild(c){return c;},querySelector(){return makeEl();},querySelectorAll(){return[];},getBoundingClientRect(){return{left:0,top:0,width:540,height:960};},getContext(){return ctx;},scrollIntoView(){},set width(v){},set height(v){},textContent:'',innerHTML:''};}
global.window={devicePixelRatio:1,addEventListener(){}}; global.document={getElementById:()=>makeEl(),createElement:()=>makeEl()};
global.performance={now:()=>Date.now()}; global.requestAnimationFrame=()=>0; global.setTimeout=(fn)=>0; global.navigator={};
const fs=require('fs');const code=fs.readFileSync('dist.bundle.js','utf8');
const {Game}=eval('(function(){'+code+'\nreturn {Game};})()');
const dom={}; ['loading','loadingBar','topbar','levelLabel','abilityBar','stage','frame','menuScreen','mapScreen','mapNodes','winStars','tutorialPopup','tutorialBanner'].forEach(k=>dom[k]=makeEl());
const g=new Game(makeEl(),dom); g.start(); g.save.data.tutorials={basics:1,bomb:1,rainbow:1,fireball:1,lightning:1,ice:1,stone:1,locked:1}; g.save.data.unlocked=3; g.save.unlockSpecial('bomb',3); g._startLevel(3); if(!g.state.is('playing')) g._dismissTutorial();
g._update(0.016); g._draw();
let p=0,f=0;const ok=(n,c)=>{c?p++:(f++,console.log(' FAIL:',n));};
const cur=g._curHit, nx=g._nextHit;
ok('current + reserve hit-targets set', !!cur && !!nx);
ok('current is ABOVE the ring/reserve', cur.y < nx.y);
ok('reserve is to the RIGHT of current', nx.x > cur.x + 10);
ok('reserve ~75% scale', Math.abs(nx.r/g.grid.r - 0.75) < 0.02);
ok('whole cluster clears the inventory (screen y < 878)', (cur.y-g.camera.y) < 878 && (nx.y-g.camera.y) < 878);
// tap either bubble swaps
const c0=g.queue.current, n0=g.queue.next; g._swap();
ok('tap swaps current<->reserve', g.queue.current===n0 && g.queue.next===c0);
// progressive unlock: bomb in inventory at L3, none before
const s=g.save; s.reset();
ok('inventory empty at start', (s.inventory.bomb||0)===0);
g._startLevel(1); if(!g.state.is('playing')) g._dismissTutorial();
ok('L1 has no specials (normal only)', g.abilities.slots.length===0);
g.save.data.unlocked=3; g._startLevel(3); if(!g.state.is('playing')) g._dismissTutorial();
ok('bomb unlocked + in bar at L3', g.save.inventory.bomb===3 && g.abilities.slots.some(sl=>sl.id==='bomb'));
// in-game obstacle tutorial targets an on-board object (spotlight)
const gg=new Game(makeEl(),dom); gg.start(); gg.save.data.tutorials={}; gg.save.data.unlocked=15;
gg._startLevel(15); gg._update(0.016); gg._levelMech='ice';
const top=gg.camera.y, bot=gg.camera.y+gg.cfg.VIEW.H*0.85; let tagged=false;
for(let r=0;r<gg.grid.rows&&!tagged;r++)for(let c=0;c<gg.grid.cols;c++){const b=gg.board.cells[r][c]; if(b&&b.y>top&&b.y<bot){b.shell='ice';tagged=true;break;}}
gg._tutCheckT=1; gg.tutorialActive=false; gg._checkTutorials();
ok('obstacle tutorial spotlights a board object', gg.tutorialActive===true && gg._tutTarget && gg._tutTarget.mode==='board');
gg._dismissTutorial();
ok('dismiss resumes + marks ice seen', !gg.tutorialActive && gg.save.hasSeenTutorial('ice'));
// ---- aim angle limit: below ~18deg the aim is CANCELLED (no fire) ---------
{
  const sh=g.shooter; const lim=sh.aimLimits(); const EPS=1e-6;
  ok('min elevation ~15-20deg', lim.minElevation>=0.26 && lim.minElevation<=0.35);
  sh.aimAt(sh.x, sh.y-400);            // straight up -> valid
  ok('straight up is a valid aim', sh.aimValid===true && Math.abs(sh.angle+Math.PI/2)<EPS);
  const upAngle=sh.angle;
  sh.aimAt(sh.x+500, sh.y);            // horizontal right -> cancel
  ok('horizontal-right cancels the aim', sh.aimValid===false);
  ok('angle is not changed while cancelled', Math.abs(sh.angle-upAngle)<EPS);
  sh.aimAt(sh.x-500, sh.y);            // horizontal left -> cancel
  ok('horizontal-left cancels the aim', sh.aimValid===false);
  sh.aimAt(sh.x+200, sh.y+300);       // below-right -> cancel
  ok('drag below-right cancels the aim', sh.aimValid===false);
  sh.aimAt(sh.x-200, sh.y+300);       // below-left -> cancel
  ok('drag below-left cancels the aim', sh.aimValid===false);
  // just BELOW the limit -> cancelled; just ABOVE -> valid (re-aim resumes)
  const dxAt=100; const belowDy=-(dxAt*Math.tan(lim.minElevation)-4);
  sh.aimAt(sh.x+dxAt, sh.y+belowDy);  ok('just below limit -> cancelled', sh.aimValid===false);
  const aboveDy=-(dxAt*Math.tan(lim.minElevation)+8);
  sh.aimAt(sh.x+dxAt, sh.y+aboveDy);  ok('re-aiming above limit -> valid again', sh.aimValid===true && (-sh.angle)>=lim.minElevation-0.02);
}
// ---- collision hitbox: reduced so shots thread gaps, solid areas still block
{
  const grid=g.grid, sh=g.shooter, bd=g.board;
  let bref=null; for(let r=0;r<grid.rows&&!bref;r++)for(let c=0;c<grid.cols;c++){if(bd.cells[r][c]){bref=bd.cells[r][c];break;}}
  ok('collision factor reduced (~0.80, <0.86)', g.cfg.COLLISION.factor < 0.86 && g.cfg.COLLISION.factor >= 0.75);
  bd.clear();
  const p=grid.cellCenter(10,5); bref.x=p.x; bref.y=p.y; bd.set(10,5,bref);
  const d=grid.d;
  ok('hit at an isolated bubble centre', sh._hitTest(p.x,p.y)===true);
  ok('threads a full-cell gap (no hit at ~1.0d)', sh._hitTest(p.x + d, p.y)===false);
  ok('reduced hitbox: no hit at 0.83d', sh._hitTest(p.x + d*0.83, p.y)===false);
  ok('still blocks close approach: hit at 0.78d', sh._hitTest(p.x + d*0.78, p.y)===true);
}
// ---- Smart Gap Assist: grazing-past ~1px is forgiven; head-on always collides
{
  const grid=g.grid, sh=g.shooter, bd=g.board;
  bd.clear();
  let b2=null; for(let r=0;r<grid.rows&&!b2;r++)for(let c=0;c<grid.cols;c++){if(bd.cells[r][c]){b2=bd.cells[r][c];break;}}
  if(!b2){ b2={x:0,y:0,color:'red',isSpecial:()=>false}; }
  const p=grid.cellCenter(12,5); b2.x=p.x; b2.y=p.y; bd.set(12,5,b2);
  const rr=grid.d*g.cfg.COLLISION.factor;
  ok('grazing ~0.5px moving AWAY threads (no collide)', sh._shouldCollide(p.x-(rr-0.5), p.y, -3, 0)===false);
  ok('grazing ~0.5px moving TOWARD collides', sh._shouldCollide(p.x-(rr-0.5), p.y, 3, 0)===true);
  ok('clearly blocked (deep overlap) always collides', sh._shouldCollide(p.x, p.y, 3, 0)===true);
  ok('no bubble nearby -> no collision', sh._shouldCollide(p.x-rr*3, p.y, 3, 0)===false);
  ok('gap-assist grace is tiny (~1-2px)', sh.GAP_ASSIST > 0 && sh.GAP_ASSIST <= 2.5);
  // the real flight is a HAIR more forgiving than the guide (never less), so any
  // gap the aim line shows as passable is always cleared by the real bubble
  ok('flight tolerance > guide tolerance', sh.GAP_ASSIST_FLIGHT > sh.GAP_ASSIST);
  ok('flight extra tolerance is subtle (~3-5% of a bubble)',
     (sh.GAP_ASSIST_FLIGHT - sh.GAP_ASSIST) / grid.d >= 0.02 && (sh.GAP_ASSIST_FLIGHT - sh.GAP_ASSIST) / grid.d <= 0.06);
  {
    const rr2 = grid.d * g.cfg.COLLISION.factor;
    bd.clear(); const pp = grid.cellCenter(20, 6); const bb = { x: pp.x, y: pp.y, color: 'red', isSpecial: () => false };
    bd.set(20, 6, bb);
    const gx = pp.x - (rr2 - 2.5);                 // grazing, pen = 2.5px (between the two tolerances)
    ok('borderline graze past: guide would collide', sh._shouldCollide(gx, pp.y, -1, 0, sh.GAP_ASSIST) === true);
    ok('borderline graze past: real bubble threads it', sh._shouldCollide(gx, pp.y, -1, 0, sh.GAP_ASSIST_FLIGHT) === false);
    ok('head-on still collides at flight tolerance', sh._shouldCollide(gx, pp.y, 1, 0, sh.GAP_ASSIST_FLIGHT) === true);
    ok('solid overlap still collides at flight tolerance', sh._shouldCollide(pp.x, pp.y, 1, 0, sh.GAP_ASSIST_FLIGHT) === true);
  }
  // ---- bank shot: aim prediction stays synced with the real flight after a wall bounce
  {
    bd.clear();
    sh.angle = -0.5; sh.aimValid = true;                 // shallow up-right -> right-wall bounce
    const pv = sh.previewPath(); const bounced = pv.some(p => p.wall); const pred = sh.previewLanding;
    const savedTol = sh.GAP_ASSIST_FLIGHT; sh.GAP_ASSIST_FLIGHT = sh.GAP_ASSIST; // isolate wall math
    const bub = { color: 'red', x: 0, y: 0, spawnT: 1, land: 0, isSpecial: () => false };
    sh.flying = null; sh.launch(bub);
    let land = null; for (let i = 0; i < 1500 && !land; i++) land = sh.update(0.016);
    sh.GAP_ASSIST_FLIGHT = savedTol;
    ok('bank shot actually bounces off a wall', bounced === true);
    ok('bank shot: aim prediction == real landing cell', !!pred && !!land && pred.row === land.row && pred.col === land.col);
  }
  // the guide and the real flight must predict the SAME landing cell
  bd.clear();
  sh.angle = -Math.PI / 2; sh.aimValid = true;
  sh.previewPath(); const predicted = sh.previewLanding;
  const bub = { color: 'red', x: 0, y: 0, spawnT: 1, land: 0, isSpecial: () => false };
  sh.launch(bub);
  let landing = null;
  for (let i = 0; i < 500 && !landing; i++) landing = sh.update(0.016);
  ok('guide predicts the SAME landing cell as the real flight',
     !!predicted && !!landing && predicted.row === landing.row && predicted.col === landing.col);
  ok('shared STEP resolution is set', sh.STEP > 0 && sh.STEP <= 5);
}
// ---- star-progress bar: multi-factor performance + adaptive thresholds ----
{
  const th = g._progressThresholds();
  ok('thresholds ascending 1<2<3', th[0] < th[1] && th[1] < th[2] && th[2] <= 1.01);
  ok('early levels are generous (t1 <= 0.42)', th[0] <= 0.42);
  g.board.clear(); g.moves = g.movesBudget; g._maxCombo = 4; g.score = 6000;
  const P = g._computeProgress();
  ok('progress stays within [0,1]', P >= 0 && P <= 1);
  ok('cleared board yields high progress (>=0.6)', P >= 0.6);
  const stars = (P >= th[2] ? 3 : P >= th[1] ? 2 : 1);
  ok('multi-factor star award is 1-3', stars >= 1 && stars <= 3);
  // harder level demands more performance than an early one
  g.save.data.unlocked = 160; g._startLevel(160);
  ok('harder levels demand more (t3 grows)', g._progressThresholds()[2] >= th[2]);
}
console.log(`HUD/UNLOCK: ${p} passed, ${f} failed`); process.exit(f?1:0);
