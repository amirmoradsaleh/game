// Reuse smoke stubs, then fire many randomized shots to exercise resolve chains,
// specials, obstacle cracking, and win/lose transitions.
const gradient={addColorStop(){}};
const ctx=new Proxy({},{get(_,k){if(k==='createLinearGradient'||k==='createRadialGradient')return()=>gradient;if(k==='canvas')return{width:540,height:960};return(...a)=>{};}});
function makeEl(){return{style:{setProperty(){}},dataset:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},appendChild(){},querySelector(){return makeEl();},getBoundingClientRect(){return{left:0,top:0,width:540,height:960};},getContext(){return ctx;},textContent:'',innerHTML:'',set width(v){},set height(v){},focus(){}};}
global.window={devicePixelRatio:1,addEventListener(){},AudioContext:undefined,webkitAudioContext:undefined};
global.document={getElementById:()=>makeEl(),createElement:()=>makeEl()};
global.performance={now:()=>Date.now()};
global.requestAnimationFrame=()=>0; global.setTimeout=(fn)=>0; global.navigator={};
const fs=require('fs');const code=fs.readFileSync('dist.bundle.js','utf8');
const {Game,GameState}=eval('(function(){'+code+'\nreturn {Game,GameState};})()');
const canvas=makeEl();
const dom={loading:makeEl(),loadingBar:makeEl(),moves:makeEl(),objectives:makeEl(),pauseBtn:makeEl(),muteBtn:makeEl(),swapBtn:makeEl(),abilityBar:makeEl(),stage:makeEl(),frame:makeEl(),pausePopup:makeEl(),resumeBtn:makeEl(),restartBtn:makeEl(),winPopup:makeEl(),winNext:makeEl(),losePopup:makeEl(),loseRetry:makeEl()};
const game=new Game(canvas,dom); game.start(); game.save.data.tutorials={basics:1,bomb:1,rainbow:1,fireball:1,lightning:1,ice:1,stone:1,locked:1}; game._startLevel(1); game._dismissTutorial();
let shots=0;
for(let s=0; s<40 && game.state.state==='playing'; s++){
  if(s%4===0) game._swap();
  game.shooter.angle = -Math.PI/2 + (Math.random()*1.2-0.6);
  game._fire(); shots++;
  for(let i=0;i<800 && game.shooter.flying;i++){ game._update(0.016); }
  // let pop/fall animations settle
  for(let i=0;i<120;i++){ game._update(0.016); }
  game._draw();
}
const count=()=>{let n=0;for(let r=0;r<game.grid.rows;r++)for(let c=0;c<game.grid.cols;c++)if(game.board.cells[r][c])n++;return n;};
console.log('OK stress — shots',shots,'| final state',game.state.state,'| moves',game.moves,'| board',count());
console.log('objectives:',JSON.stringify(game.objectives.tracker||game.objectives.state||{}, null, 0).slice(0,200));
