const gradient={addColorStop(){}};
const ctx=new Proxy({},{get(_,k){if(k==='createLinearGradient'||k==='createRadialGradient')return()=>gradient;if(k==='canvas')return{width:540,height:960};return()=>{};},set(){return true;}});
function makeEl(){return{style:{setProperty(){}},dataset:{},children:[],classList:{_s:{},add(c){this._s[c]=1;},remove(c){delete this._s[c];},toggle(c,v){const on=v===undefined?!this._s[c]:v;if(on)this._s[c]=1;else delete this._s[c];return !!on;},contains(c){return !!this._s[c];}},addEventListener(){},appendChild(c){this.children.push(c);return c;},querySelector(){return makeEl();},querySelectorAll(){return[];},getBoundingClientRect(){return{left:0,top:0,width:540,height:960};},getContext(){return ctx;},scrollIntoView(){},set width(v){},set height(v){},textContent:'',innerHTML:'',disabled:false};}
global.window={devicePixelRatio:1,addEventListener(){}}; global.document={getElementById:()=>makeEl(),createElement:()=>makeEl()};
global.performance={now:()=>Date.now()}; global.requestAnimationFrame=()=>0; global.setTimeout=(fn)=>0; global.navigator={};
const fs=require('fs');const code=fs.readFileSync('dist.bundle.js','utf8');
const {Game,GameState}=eval('(function(){'+code+'\nreturn {Game,GameState};})()');
const keys=['loading','loadingBar','topbar','levelLabel','pauseBtn','muteBtn','abilityBar','stage','frame','menuScreen','playBtn','collectionBtn','settingsBtn','mapScreen','mapNodes','mapBackBtn','collectionScreen','collectionGallery','collectionClose','settingsScreen','settingsMute','settingsClose','resetBtn','tutorialPopup','tutorialTitle','tutorialBody','tutorialOk','pausePopup','resumeBtn','restartBtn','winPopup','winTitle','winStars','winNext','winMap','losePopup','loseRetry','loseMap'];
const dom={}; keys.forEach(k=>dom[k]=makeEl());
let p=0,f=0;const ok=(n,c)=>{c?p++:(f++,console.log('  FAIL:',n));};
const g=new Game(makeEl(),dom); g.start(); g.save.data.tutorials={basics:1,bomb:1,rainbow:1,fireball:1,lightning:1,ice:1,stone:1,locked:1}; g._startLevel(1); g._dismissTutorial();

const grid=g.grid, board=g.board;
ok('camera starts at bottom (progress ~0)', g.camera.progress<0.05);
ok('camera y == start max', Math.abs(g.camera.y-g.camera.max)<1 && g.camera.max>100);
ok('top of level not visible at start', g.camera.y > g.cfg.VIEW.H*0.3);

// clear bottom rows in chunks; camera must climb up only, smoothly
let prevY=g.camera.y,maxJump=0,monotonic=true,prevProg=g.camera.progress,progUp=true;
for(let chunk=0;chunk<14;chunk++){
  const br=board.lowestFilledRow(); if(br<0)break;
  for(let c=0;c<grid.cols;c++) if(board.cells[br][c]) board.remove(br,c);
  for(let s=0;s<40;s++){ g._update(0.016); const j=Math.abs(g.camera.y-prevY); if(j>maxJump)maxJump=j; if(g.camera.y>prevY+0.5)monotonic=false; prevY=g.camera.y; }
  if(g.camera.progress<prevProg-1e-6)progUp=false; prevProg=g.camera.progress;
}
ok('camera only climbs (never descends)', monotonic);
ok('camera never jumps (small per-frame delta)', maxJump<25);
ok('progress increased while clearing', g.camera.progress>0.2);
ok('progress monotonic non-decreasing', progUp);
ok('did NOT win while bubbles remain', !g.state.is(GameState.WON));

// clear everything -> ascend to summit -> win
board.clear();
for(let s=0;s<800 && !g.state.is(GameState.WON);s++) g._update(0.016);
ok('camera reached summit', g.camera.atTop());
ok('win only at summit with empty board', g.state.is(GameState.WON));

console.log(`\nCLIMB: ${p} passed, ${f} failed`);
process.exit(f?1:0);
