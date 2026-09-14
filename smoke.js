// Minimal DOM/canvas stubs to instantiate the FULL game and step it.
const gradient = { addColorStop(){} };
const ctx = new Proxy({}, { get(_,k){
  if(k==='createLinearGradient'||k==='createRadialGradient') return ()=>gradient;
  if(k==='canvas') return {width:540,height:960};
  return (...a)=>{};
}});
function makeEl(){ return {
  style:{setProperty(){}}, dataset:{}, classList:{add(){},remove(){},toggle(){}}, 
  addEventListener(){}, appendChild(){}, querySelector(){return makeEl();},
  getBoundingClientRect(){return {left:0,top:0,width:540,height:960};},
  getContext(){return ctx;}, textContent:'', innerHTML:'', set width(v){}, set height(v){},
  focus(){}, };
}
global.window = { devicePixelRatio:1, addEventListener(){}, AudioContext:undefined, webkitAudioContext:undefined };
global.document = { getElementById:()=>makeEl(), createElement:()=>makeEl() };
global.performance = { now:()=>Date.now() };
global.requestAnimationFrame = ()=>0;      // don't auto-loop
global.setTimeout = (fn)=>0;               // don't auto-advance loader
global.navigator = { };

const fs=require('fs');
const code=fs.readFileSync('dist.bundle.js','utf8');
// Top-level class/const declarations don't attach to global scope under eval,
// so run the bundle inside a function and return the symbols we need.
const { Game, GameState } = eval('(function(){'+code+'\nreturn {Game, GameState};})()');

const canvas = makeEl();
const dom = { loading:makeEl(), loadingBar:makeEl(), moves:makeEl(), objectives:makeEl(),
  pauseBtn:makeEl(), muteBtn:makeEl(), swapBtn:makeEl(), abilityBar:makeEl(), stage:makeEl(), frame:makeEl(), pausePopup:makeEl(),
  resumeBtn:makeEl(), restartBtn:makeEl(), winPopup:makeEl(), winNext:makeEl(),
  losePopup:makeEl(), loseRetry:makeEl() };

const game = new Game(canvas, dom);
game.start(); game.save.data.tutorials={basics:1,bomb:1,rainbow:1,fireball:1,lightning:1,ice:1,stone:1,locked:1};
game._startLevel(1);                       // menu -> load level 1
game._dismissTutorial();                   // skip the first-time tutorial -> PLAYING

// simulate a full shot: aim up-left, fire, step until it lands & resolves
let landed=false, frames=0;
game.shooter.angle = -Math.PI/2 + 0.15;
game._fire();
for(let i=0;i<600 && game.shooter.flying;i++){ game._update(0.016); frames++; }
game._draw();

// simulate a few more shots including a swap
game._swap();
game._fire();
for(let i=0;i<600 && game.shooter.flying;i++){ game._update(0.016); }
game._draw();

console.log('OK — ran', frames, 'flight frames; moves left', game.moves,
            '; state', game.state.state, '; board bubbles',
            (()=>{let n=0;for(let r=0;r<game.grid.rows;r++)for(let c=0;c<game.grid.cols;c++)if(game.board.cells[r][c])n++;return n;})());
