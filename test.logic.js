// Headless logic test: load only pure-logic modules with light stubs.
global.performance = { now: () => Date.now() };
const fs = require('fs');
const files = [
  'src/config/GameConfig.js','src/config/LevelDatabase.js','src/core/HexGrid.js','src/gameplay/Bubble.js',
  'src/gameplay/SpecialEffects.js','src/gameplay/Board.js','src/gameplay/LevelGenerator.js','src/managers/GameStateManager.js'
];
const code = files.map(f => fs.readFileSync(f,'utf8')).join('\n');
const scope = eval('(function(){' + code + '\n; return {GameConfig,Progression,HexGrid,Bubble,Board,SpecialEffects,LevelGenerator,ObjectiveTracker};})()');
const {GameConfig,Progression,HexGrid,Bubble,Board,SpecialEffects,LevelGenerator,ObjectiveTracker} = scope;

let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;} else {fail++; console.log('  FAIL:', m);} };

const grid = new HexGrid(GameConfig);
ok(grid.r>18 && grid.r<40, 'bubble radius sane ('+grid.r.toFixed(1)+')');

// neighbor symmetry
let sym=true;
for(let r=1;r<5;r++)for(let c=1;c<5;c++){
  for(const [nr,nc] of grid.neighbors(r,c)){
    if(!grid.neighbors(nr,nc).some(([a,b])=>a===r&&b===c)) sym=false;
  }
}
ok(sym,'neighbor symmetry');

// load a static level (generated from the Progression recipe)
const board=new Board(GameConfig,grid);
board.load(new LevelGenerator(GameConfig,grid).generate(Progression.get(10)));
let count=0; for(let r=0;r<grid.rows;r++)for(let c=0;c<grid.cols;c++) if(board.cells[r][c]) count++;
ok(count>40,'level loaded '+count+' bubbles');

// hexDistance
ok(board.hexDistance(0,0,0,0)===0 && board.hexDistance(2,2,2,4)===2,'hexDistance');

// MATCH TEST: build a controlled 3-in-a-row and complete it
const b2=new Board(GameConfig,grid);
b2.set(5,3,new Bubble({color:'red'}));
b2.set(5,4,new Bubble({color:'red'}));
b2.set(4,3,new Bubble({color:'blue'})); // anchor to top chain not needed for match
// place third red adjacent
b2.set(5,5,new Bubble({color:'red'}));
const res=b2.resolve(5,5);
ok(res.popped.length>=3,'match-3 pops ('+res.popped.length+')');

// FLOATING TEST
const b3=new Board(GameConfig,grid);
b3.set(0,2,new Bubble({color:'red'}));      // anchored to ceiling
b3.set(1,2,new Bubble({color:'blue'}));     // hangs from anchor
b3.set(5,5,new Bubble({color:'green'}));    // floating island
b3.set(5,6,new Bubble({color:'green'}));
b3.set(5,7,new Bubble({color:'green'}));    // will match+pop, then check float logic separately
// force a detach by clearing the anchor manually then detect
b3.remove(0,2);
const fell=b3._detachFloating();
ok(fell.length>=4,'floating detach ('+fell.length+' fell)');

// BOMB detonation radius
const b4=new Board(GameConfig,grid);
for(let c=0;c<8;c++){ b4.set(5,c,new Bubble({color:'blue'})); b4.set(4,c,new Bubble({color:'blue'})); b4.set(6,c,new Bubble({color:'blue'})); }
b4.set(5,3,new Bubble({color:'blue',special:'bomb'}));
b4.set(5,2,new Bubble({color:'blue'}));
b4.set(5,4,new Bubble({color:'blue'}));
const rb=b4.resolve(5,3); // matching blues incl bomb -> detonate
ok(rb.popped.length>=7,'bomb blast cleared '+rb.popped.length);

// ROCKET clears row
const b5=new Board(GameConfig,grid);
for(let c=0;c<9;c++) b5.set(3,c,new Bubble({color:'yellow'}));
b5.cells[3][4].special='rocket';
const rr=b5.resolve(3,4);
ok(rr.popped.length>=9,'rocket cleared row '+rr.popped.length);

// OBSTACLE crack: ice loses shell when neighbor pops
const b6=new Board(GameConfig,grid);
// anchor chain to the ceiling so the ice stays attached after the reds pop
b6.set(0,3,new Bubble({color:'green'}));
b6.set(1,3,new Bubble({color:'green'}));
b6.set(2,3,new Bubble({color:'green'}));
b6.set(3,3,new Bubble({color:'green'}));
b6.set(5,3,new Bubble({color:'red'}));
b6.set(5,4,new Bubble({color:'red'}));
b6.set(5,5,new Bubble({color:'red'}));
b6.set(4,3,new Bubble({color:'green',shell:'ice',hp:1}));
b6.resolve(5,5);
const iced=b6.cells[4][3];
ok(iced && iced.shell==='none','ice cracked to normal after adjacent pop');

// CRYSTAL objective + destroy
const b7=new Board(GameConfig,grid);
b7.set(5,3,new Bubble({color:'red'}));
b7.set(5,4,new Bubble({color:'red'}));
b7.set(5,5,new Bubble({color:'red'}));
b7.set(4,3,new Bubble({color:'',shell:'crystal',hp:1}));
const r7=b7.resolve(5,5);
const crystalGone=!b7.cells[4][3];
ok(crystalGone,'crystal destroyed by adjacent pop');
const tracker=new ObjectiveTracker([{type:'crystal',target:1}]);
r7.popped.forEach(x=>tracker.record(x));
ok(tracker.isComplete(),'crystal objective recorded');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
