// Validates the official-artwork integration (centralized map + real rendering).
const fs = require('fs');
const code = fs.readFileSync('dist.bundle.js', 'utf8');

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : (fail++, console.log('  FAIL:', n)); };

// Image stub: firing onload synchronously when src is assigned.
global.Image = class { constructor() { this.complete = false; this.naturalWidth = 0; } set src(v) { this._src = v; this.complete = true; this.naturalWidth = 500; this.naturalHeight = 500; if (this.onload) this.onload(); } get src() { return this._src; } };

const api = eval('(function(){' + code + '\n return {GameConfig,HexGrid,Renderer,Bubble,BubbleSprites};})()');
const { GameConfig, HexGrid, Renderer, Bubble, BubbleSprites } = api;

// ---- 1) centralized mapping + real PNG data ----------------------------
console.log('Sprite map & assets:');
const need = ['red', 'blue', 'green', 'gold', 'orange', 'purple'];
ok('all six official sprites present', need.every(k => typeof BubbleSprites.DATA[k] === 'string'));
for (const k of need) {
  const uri = BubbleSprites.DATA[k];
  ok(`${k} is a PNG data URI`, uri.startsWith('data:image/png;base64,'));
  const bytes = Buffer.from(uri.split(',')[1], 'base64');
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const w = bytes.readUInt32BE(16), h = bytes.readUInt32BE(20);
  ok(`${k} decodes to a real square PNG (${w}x${h})`, isPng && w > 0 && w === h);
}

// ---- 2) gameplay colour -> asset mapping -------------------------------
console.log('Colour mapping:');
ok("yellow aliases to gold artwork", BubbleSprites.keyFor('yellow') === 'gold');
ok('red->red', BubbleSprites.keyFor('red') === 'red');
// every gameplay colour resolves to a real asset
for (const c of GameConfig.COLOR_KEYS) {
  ok(`gameplay '${c}' has a sprite`, !!BubbleSprites.DATA[BubbleSprites.keyFor(c)]);
}

// ---- 3) sprites preload; image() returns decoded bitmaps ---------------
console.log('Preload:');
let loadedResolved = false;
return_test: {
  // load() must resolve and mark ready
}
(async () => {
  await BubbleSprites.load();
  ok('load() marks ready', BubbleSprites.isReady());
  ok('image(red) returns a bitmap', !!BubbleSprites.image('red'));
  ok('image(yellow) returns the gold bitmap', !!BubbleSprites.image('yellow'));

  // ---- 4) Renderer draws the sprite (not a circle) for coloured bubbles
  console.log('Renderer uses sprites:');
  const calls = [];
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, { get(_, k) {
    if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad;
    if (k === 'imageSmoothingEnabled' || k === 'imageSmoothingQuality') return undefined;
    return (...a) => { calls.push(k); };
  }, set() { return true; } });
  const grid = new HexGrid(GameConfig);
  const r = new Renderer(ctx, GameConfig, grid);

  calls.length = 0;
  r.bubble(new Bubble({ color: 'red' }), 100, 100, 23);
  ok('coloured bubble drawImage (sprite) used', calls.includes('drawImage'));

  calls.length = 0;
  r.bubble(new Bubble({ color: 'yellow' }), 100, 100, 23);
  ok('yellow bubble uses sprite (gold)', calls.includes('drawImage'));

  // rainbow wildcard has no asset -> procedural fallback (no drawImage)
  calls.length = 0;
  r.bubble(new Bubble({ color: '', special: 'rainbow' }), 100, 100, 23);
  ok('rainbow wildcard falls back (no sprite)', !calls.includes('drawImage'));

  // ---- 5) no hardcoded sprite refs outside the centralized module ------
  console.log('Centralization:');
  const rendererSrc = fs.readFileSync('src/ui/Renderer.js', 'utf8');
  ok('Renderer references BubbleSprites (centralized)', rendererSrc.includes('BubbleSprites.image'));
  const files = fs.readdirSync('src', { recursive: true }).filter(f => f.endsWith('.js') && !f.endsWith('BubbleSprites.js'));
  let hardcoded = false;
  for (const f of files) { if (fs.readFileSync('src/' + f, 'utf8').match(/ball(Red|Blue|Green|Gold|Orange|Purple)\.png/)) hardcoded = true; }
  ok('no hardcoded sprite filenames elsewhere', !hardcoded);

  // ---- 6) background scene image + ambient layer -----------------------
  console.log('Background scene & ambient bubbles:');
  const BackgroundImage = eval('(function(){' + code + '\n return BackgroundImage;})()');
  ok('scene image is a PNG data URI', BackgroundImage.DATA.startsWith('data:image/png;base64,'));
  {
    const bytes = Buffer.from(BackgroundImage.DATA.split(',')[1], 'base64');
    const w = bytes.readUInt32BE(16), h = bytes.readUInt32BE(20);
    ok(`scene image decodes (${w}x${h}, portrait)`, bytes[0] === 0x89 && w > 0 && h > w);
  }
  {
    // background() must NOT paint an opaque fill/overlay (scene shows through),
    // and MUST draw the ambient bubble layer (arcs).
    const calls2 = [];
    const grad2 = { addColorStop() {} };
    const ctx2 = new Proxy({}, { get(_, k) {
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad2;
      return (...a) => { calls2.push(k); };
    }, set() { return true; } });
    const grid2 = new HexGrid(GameConfig);
    const r2 = new Renderer(ctx2, GameConfig, grid2);
    r2.background(0.5);
    ok('no opaque fillRect overlay on background', !calls2.includes('fillRect'));
    ok('ambient bubbles drawn (arcs)', calls2.filter(c => c === 'arc').length >= 10);
    const field = r2._ambient;
    ok('ambient field is small (<=24)', field.length > 0 && field.length <= 24);
    ok('ambient sizes 6-20px radius', field.every(b => b.r >= 6 && b.r <= 20));
    ok('ambient opacity 0.15-0.35', field.every(b => b.a >= 0.15 && b.a <= 0.35));
    ok('most static, some drift up', field.some(b => b.drift > 0) && field.filter(b => b.drift > 0).length < field.length / 2);
  }

  // ---- 7) background is scoped to the game frame, not the page ---------
  console.log('Background is clipped to the game viewport:');
  const gameSrc = fs.readFileSync('src/Game.js', 'utf8');
  const tpl = fs.readFileSync('index.template.html', 'utf8');
  ok('scene applied to the game frame', /this\.dom\.frame[\s\S]{0,80}backgroundImage/.test(gameSrc));
  ok('scene NOT applied to body/html/stage', !/dom\.(stage|body|html)[\s\S]{0,60}backgroundImage/.test(gameSrc));
  ok('#frame clips with overflow:hidden', /#frame\s*\{[\s\S]*?overflow:\s*hidden/.test(tpl));
  ok('#frame uses cover/center/no-repeat', /#frame\s*\{[\s\S]*?background-size:\s*cover[\s\S]*?background-position:\s*center[\s\S]*?background-repeat:\s*no-repeat/.test(tpl));
  ok('#stage is solid dark (no image)', /#stage\s*\{[\s\S]*?background:\s*#04123F/.test(tpl));
  ok('body/html carry no background image', !/(html,\s*body|body)\s*\{[\s\S]*?url\(/.test(tpl));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
