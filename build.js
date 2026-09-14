const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
// Dependency order matters (no module system; shared globals).
const ORDER = [
  'src/config/GameConfig.js',
  'src/config/LevelDatabase.js',
  'src/assets/BubbleSprites.js',
  'src/assets/BackgroundImage.js',
  'src/core/HexGrid.js',
  'src/core/SoundManager.js',
  'src/effects/ParticleSystem.js',
  'src/gameplay/Bubble.js',
  'src/gameplay/SpecialEffects.js',
  'src/gameplay/Board.js',
  'src/gameplay/LevelGenerator.js',
  'src/gameplay/BubbleQueue.js',
  'src/gameplay/Shooter.js',
  'src/ui/Renderer.js',
  'src/managers/GameStateManager.js',
  'src/managers/DifficultyManager.js',
  'src/managers/CameraController.js',
  'src/managers/AbilityBar.js',
  'src/managers/SaveManager.js',
  'src/managers/RewardedAdManager.js',
  'src/managers/LevelManager.js',
  'src/Game.js',
];

const js = ORDER.map(f => `/* ==== ${f} ==== */\n` + fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n\n');

// 1) write concatenated JS for syntax checking
fs.writeFileSync(path.join(ROOT, 'dist.bundle.js'), js);

// 2) inline into the HTML template
const tpl = fs.readFileSync(path.join(ROOT, 'index.template.html'), 'utf8');
const html = tpl.replace('<!--SCRIPTS-->', `<script>\n${js}\n</script>`);
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist', 'index.html'), html);

console.log('Built dist/index.html (' + (html.length / 1024).toFixed(1) + ' KB), bundle ' + (js.length / 1024).toFixed(1) + ' KB JS');
