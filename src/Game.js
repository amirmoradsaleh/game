/* =========================================================================
 * Game — orchestrator for the King-style flow:
 *   Main Menu -> Level Map -> static Level -> Results -> back to Map.
 *
 * A fixed portrait viewport (no scrolling camera), 100 sequential levels with
 * deterministic stars and save-based unlocking, a circular shooter HUD, and
 * player-only special tools. Reuses Board/matching, sprites and the underwater
 * scene. Existing managers/systems are preserved.
 * ========================================================================= */
class Game {
  constructor(canvas, dom) {
    this.cfg = GameConfig;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dom = dom;

    this.grid = new HexGrid(this.cfg);
    this.board = new Board(this.cfg, this.grid);
    this.renderer = new Renderer(this.ctx, this.cfg, this.grid);
    this.particles = new ParticleSystem();
    this.sound = new SoundManager();
    this.difficulty = new DifficultyManager();
    this.save = new SaveManager();
    this.levels = new LevelManager(this.cfg, this.grid);
    this.camera = new CameraController(this.cfg); // kept static (no scrolling)
    this.shooterScreenY = this.cfg.VIEW.H - 205; // raised: clears the special inventory

    this._queuePolicy = () => this._policy();
    this.queue = new BubbleQueue(this.cfg, this.board, this._queuePolicy);
    this.shooter = new Shooter(this.cfg, this.grid, this.board);
    this.abilities = new AbilityBar({});
    this.state = new GameStateManager((s) => this._onState(s));

    this.moves = 0; this.movesBudget = 0; this.score = 0; this.combo = 0;
    this.popping = []; this.falling = [];
    this.aiming = false; this.pointerDown = null;
    this.shake = 0; this.flashT = 0; this.flashColor = '#ffffff'; this.muzzle = 0;
    this._lastPop = 0; this._last = 0;
    this._nextHit = null;

    this._setupCanvas();
    this._bindInput();
    this._bindButtons();
  }

  // ---- invisible mercy tuning for the queue -----------------------------
  _policy() {
    const remaining = this.board.countAll();
    const struggle = this.difficulty.struggle(this.moves, Math.min(remaining, this.moves * 3));
    const counts = {};
    for (const c of this.board.activeColors()) counts[c] = this.board.countColor(c);
    const helpful = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 2);
    return { struggle, helpful };
  }

  // ---- boot: preload assets, then show the Main Menu --------------------
  start() {
    this._applySceneBackground();
    this._buildMenu();
    this._buildMap();
    this.state.set(GameState.LOADING);
    this.dom.loading.classList.add('show');
    let p = 0; const bar = this.dom.loadingBar;
    const assetsReady = Promise.all([BubbleSprites.load(), BackgroundImage.load()]);
    const tick = () => {
      p = Math.min(100, p + Utils.rand(8, 18));
      bar.style.width = p + '%';
      if (p < 100) setTimeout(tick, 80);
      else assetsReady.then(() => setTimeout(() => { this.dom.loading.classList.remove('show'); this._showMenu(); }, 150));
    };
    tick();
    requestAnimationFrame((t) => this._loop(t));
  }

  _applySceneBackground() {
    const frame = this.dom.frame;
    if (!frame || !frame.style) return;
    frame.style.backgroundImage = `url("${BackgroundImage.DATA}")`;
    frame.style.backgroundSize = 'cover';
    frame.style.backgroundPosition = 'center';
    frame.style.backgroundRepeat = 'no-repeat';
  }

  _setupCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.cfg.VIEW.W * dpr;
    this.canvas.height = this.cfg.VIEW.H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in this.ctx) this.ctx.imageSmoothingQuality = 'high';
  }

  // ===================================================================== //
  //  SCREEN FLOW
  // ===================================================================== //
  _showMenu() { this.state.set(GameState.MENU); }

  _onState(s) {
    const d = this.dom;
    const show = (el, on) => el && el.classList.toggle('show', on);
    show(d.menuScreen, s === GameState.MENU);
    show(d.mapScreen, s === GameState.MAP);
    show(d.pausePopup, s === GameState.PAUSED);
    show(d.winPopup, s === GameState.WON);
    if (s !== GameState.WON) show(d.rewardPopup, false);
    show(d.losePopup, s === GameState.LOST);
    // HUD is only visible while a level is active
    const active = (s === GameState.PLAYING || s === GameState.PAUSED || s === GameState.WON || s === GameState.LOST);
    if (d.topbar) d.topbar.style.visibility = (s === GameState.PLAYING) ? 'visible' : 'hidden';
    if (d.abilityBar) d.abilityBar.style.visibility = (s === GameState.PLAYING) ? 'visible' : 'hidden';
    this._levelActive = active;
  }

  // ---- start a specific level ------------------------------------------
  _startLevel(n) {
    if (!this.save.isUnlocked(n)) return;
    this._winning = false; this._winRays = 0; this._winTimer = 0;
    this.levels.goto(n);
    this.save.setCurrentLevel(n);
    const mech = this.levels.level.newMechanic;
    // grant a newly-unlocked special ball into the persistent inventory (once)
    const grant = { bomb: ['bomb', 3], rainbow: ['rainbow', 3], fireball: ['fireball', 3], lightning: ['laser', 3] }[mech];
    if (grant) this.save.unlockSpecial(grant[0], grant[1]);
    this._loadLevel();
    // Tutorials are now taught DURING gameplay (see _checkTutorials), not before
    // the level. Track the mechanic this level introduces, if still unseen.
    this.tutorialActive = false;
    this._pendingTutorial = null;
    this._levelMech = (mech && !this.save.hasSeenTutorial(mech)) ? mech : null;
    this._tutCheckT = 0;
    this.state.set(GameState.PLAYING);
    this._announceLevel();
  }

  _loadLevel() {
    const diag = this.levels.buildInto(this.board);
    this.difficulty.reset();
    this.movesBudget = diag.moves;
    this.moves = diag.moves;
    this.optimalShots = diag.optimal;
    this.queue = new BubbleQueue(this.cfg, this.board, this._queuePolicy);
    this.queue.generosity = this.levels.level.generosity;
    this.shooter = new Shooter(this.cfg, this.grid, this.board);
    this.abilities = new AbilityBar(this._unlockedInventory());
    this.score = 0; this.combo = 0;
    this._maxCombo = 0;
    this.bonusFound = false;
    this.bonusType = this.levels.level.bonus ? this.levels.level.bonus.type : null;
    this._placeBonus();
    this._initialBubbles = Math.max(1, this.board.countAll());   // for star-progress
    this._setupProgressBar();
    this.popping = []; this.falling = []; this.aiming = false; this.pointerDown = null;
    // dynamic climb camera: start viewing the BOTTOM of the tall stage; the top
    // is not visible. Summit is world y = 0.
    this.initialBottomRow = diag.bottomRow;
    const startScroll = this._scrollForBottom(diag.bottomRow);
    this.camera.setBounds(0, startScroll);
    this.camera.reset(startScroll);
    this.shooter.y = this.camera.y + this.shooterScreenY;
    this._buildAbilityBar();
    this._updateHUD();
    return diag;
  }

  // Scroll (world y at screen top) that frames the given bottom row ~62% down.
  _scrollForBottom(bottomRow) {
    if (bottomRow < 0) return 0;
    const y = this.grid.cellCenter(bottomRow, 0).y + this.grid.r;
    return Utils.clamp(y - this.cfg.VIEW.H * 0.62, 0, 100000);
  }

  _announceLevel() {
    const cx = this.cfg.VIEW.W / 2, cy = this.cfg.VIEW.H * 0.4;
    this.particles.floatText(cx, cy, `LEVEL ${this.levels.number}`, '#ffe9a3', 34);
  }

  // Unlocked specials with their current saved counts (0-count kept so the bar
  // can offer "Watch Video +3").
  _unlockedInventory() {
    const inv = {};
    for (const id of Object.keys(this.save.data.unlockedSpecials || {}))
      if (this.save.data.unlockedSpecials[id]) inv[id] = this.save.inventory[id] || 0;
    return inv;
  }

  // Tag one hidden bubble as the level's optional bonus objective (if any).
  _placeBonus() {
    if (!this.bonusType) return;
    const cands = [];
    for (let r = 0; r < this.grid.rows; r++) for (let c = 0; c < this.grid.cols; c++) {
      const b = this.board.cells[r][c];
      if (b && b.color && !b.isBlocking()) cands.push(b);
    }
    if (!cands.length) { this.bonusType = null; return; }
    const b = cands[(Math.random() * cands.length) | 0];
    b.bonus = true; b.bonusType = this.bonusType;
  }

  _onBonusFound() {
    this.bonusFound = true;
    this.score += 2500;
    const names = { fish: 'fish', turtle: 'baby turtle', chest: 'treasure chest', pearl: 'hidden pearl', octopus: 'baby octopus' };
    const cx = this.cfg.VIEW.W / 2, cy = this.camera.y + this.cfg.VIEW.H * 0.42;
    this.particles.floatText(cx, cy, 'BONUS STAR FOUND!', '#ffd23f', 30);
    this.particles.floatText(cx, cy + 32, `Rescued the ${names[this.bonusType] || 'treasure'}! +2500`, '#ffffff', 16);
    this.particles.explosion(cx, cy, '#ffd23f');
    this._kick(8); this._flash(0.4, '#ffe9a3');
    this.sound.play('victory');
  }

  // ===================================================================== //
  //  INPUT
  // ===================================================================== //
  _canvasPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.cfg.VIEW.W / rect.width, sy = this.cfg.VIEW.H / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * sx, y: (src.clientY - rect.top) * sy };
  }

  // Screen point -> world point (only y shifts, by the camera scroll).
  _worldPoint(e) { const p = this._canvasPoint(e); return { x: p.x, y: p.y + this.camera.y }; }

  _bindInput() {
    const down = (e) => {
      if (!this.state.is(GameState.PLAYING) || this.tutorialActive || this._winning || !this.shooter.canShoot()) return;
      this.sound.resume();
      this.shooter.y = this.camera.y + this.shooterScreenY;
      const p = this._worldPoint(e);
      // tap EITHER the current or next bubble to swap them (no manual button)
      const hitNext = this._nextHit && Utils.dist(p.x, p.y, this._nextHit.x, this._nextHit.y) < this._nextHit.r + 8;
      const hitCur = this._curHit && Utils.dist(p.x, p.y, this._curHit.x, this._curHit.y) < this._curHit.r + 8;
      if (hitNext || hitCur) { this._swap(); this.pointerDown = null; e.preventDefault(); return; }
      this.pointerDown = { x: p.x, y: p.y, moved: false };
      this.aiming = true; this.shooter.aiming = true; this.shooter.aimAt(p.x, p.y);
      e.preventDefault();
    };
    const move = (e) => {
      if (!this.pointerDown) return;
      const p = this._worldPoint(e);
      if (Utils.dist(p.x, p.y, this.pointerDown.x, this.pointerDown.y) > 6) this.pointerDown.moved = true;
      if (this.aiming) this.shooter.aimAt(p.x, p.y);
      e.preventDefault();
    };
    const up = (e) => {
      if (!this.pointerDown) return;
      this.pointerDown = null; this.shooter.aiming = false;
      // Only fire if the aim is valid (>= min elevation). If it was cancelled by
      // aiming too horizontally, no shot fires — the player simply re-aims.
      if (this.aiming) { const fire = this.shooter.aimValid; this.aiming = false; if (fire) this._fire(); }
      e && e.preventDefault && e.preventDefault();
    };
    this.canvas.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    this.canvas.addEventListener('touchstart', down, { passive: false });
    this.canvas.addEventListener('touchmove', move, { passive: false });
    this.canvas.addEventListener('touchend', up, { passive: false });
  }

  _bindButtons() {
    const click = (el, fn) => el && el.addEventListener('click', () => { this.sound.resume(); this.sound.play('click'); fn(); });
    // menu
    click(this.dom.playBtn, () => this._showMap());
    click(this.dom.collectionBtn, () => this.dom.collectionScreen && this.dom.collectionScreen.classList.add('show'));
    click(this.dom.powerupsBtn, () => { this._refreshPowerups(); this.dom.powerupsScreen && this.dom.powerupsScreen.classList.add('show'); });
    click(this.dom.powerupsClose, () => this.dom.powerupsScreen && this.dom.powerupsScreen.classList.remove('show'));
    click(this.dom.settingsBtn, () => this.dom.settingsScreen && this.dom.settingsScreen.classList.add('show'));
    click(this.dom.collectionClose, () => this.dom.collectionScreen && this.dom.collectionScreen.classList.remove('show'));
    click(this.dom.settingsClose, () => this.dom.settingsScreen && this.dom.settingsScreen.classList.remove('show'));
    click(this.dom.resetBtn, () => { this.save.reset(); this._mapResetView(); });
    click(this.dom.mapBackBtn, () => this._showMenu());
    // in-level
    click(this.dom.pauseBtn, () => this._pause());
    click(this.dom.resumeBtn, () => this._closePause(() => this._resume()));
    click(this.dom.restartBtn, () => this._closePause(() => this._startLevel(this.levels.number)));
    click(this.dom.exitBtn, () => this._closePause(() => this._showMenu()));
    click(this.dom.winNext, () => this._advance());
    click(this.dom.winMap, () => this._showMap({ focusCurrent: true }));
    click(this.dom.loseRetry, () => this._startLevel(this.levels.number));
    click(this.dom.loseMap, () => this._showMap({ focusCurrent: true }));
    click(this.dom.tutorialOk, () => this._dismissTutorial());
    click(this.dom.rewardOk, () => this._dismissReward());
    click(this.dom.muteBtn, () => { const m = this.sound.toggleMute(); this.dom.muteBtn.textContent = m ? '🔇' : '🔊'; });
    click(this.dom.settingsMute, () => { const m = this.sound.toggleMute(); this.dom.settingsMute.textContent = m ? 'Sound: Off' : 'Sound: On'; });
  }

  _swap() { if (this.shooter.canShoot()) { this.queue.swap(); this.sound.play('swap'); } }

  _fire() {
    if (!this.state.is(GameState.PLAYING) || !this.shooter.canShoot()) return;
    let bubble;
    const eqId = this.abilities.equipped;
    const special = this.abilities.consume();
    if (special) {
      this.save.useSpecial(eqId); // decrement the persistent inventory
      const color = special === this.cfg.SPECIAL.RAINBOW ? '' : (this.board.activeColors()[0] || 'red');
      bubble = new Bubble({ color, special });
      this._updateAbilityBar();
      // a special shot doesn't consume the colour queue, but still costs a move
    } else {
      bubble = this.queue.current;
      this.queue.advance(); // Reserve -> Current, and a NEW reserve is generated
    }
    this.shooter.launch(bubble);
    this.muzzle = 1;
    this._recoil = 1;                                  // launcher kicks back, springs up
    this.particles.softFlash(this.shooter.x, this.shooter.y, 'rgba(255,240,200,0.8)', 40);
    this.moves = Math.max(0, this.moves - 1);
    this._updateHUD();
    this.sound.play('shoot', 0.92 + Math.random() * 0.16);
  }

  // ===================================================================== //
  //  SHOT RESOLUTION  (connected-cluster matching via Board.resolve)
  // ===================================================================== //
  _onLanded(cell) {
    const bubble = this._lastLaunched;
    if (!cell) return;
    bubble.falling = false; bubble.spawnT = 1; bubble.land = 1;
    this.board.set(cell.row, cell.col, bubble);
    // soft collision feedback (impact flash + splash + pitched click)
    this.particles.sparkle(bubble.x, bubble.y, 5, '#ffffff');
    this.particles.softFlash(bubble.x, bubble.y, 'rgba(200,235,255,0.7)', 30);
    this.particles.splash(bubble.x, bubble.y, 4, '#d6f0ff');
    this.sound.play('impact', 0.9 + Math.random() * 0.25);

    const res = this.board.resolve(cell.row, cell.col);
    const cleared = res.popped.length + res.fell.length;
    this._processRemovals(res);

    if (res.bonusPopped && !this.bonusFound) this._onBonusFound();

    if (cleared > 0) {
      this.combo++;
      this._maxCombo = Math.max(this._maxCombo || 0, this.combo);
      const base = res.popped.length * 10 + res.fell.length * 15;
      const gained = Math.round(base * (1 + (this.combo - 1) * 0.25));
      this.score += gained;
      this.particles.floatText(bubble.x, bubble.y - this.grid.r, `+${gained}`, '#fff2a8', 20);
      this._comboFeedback(bubble.x, bubble.y);
      // Gameplay feedback stays clean & subtle (no zoom/slow-mo — those are
      // reserved for the winning shot). Shake scales gently with match size.
      if (res.fell.length >= 8) {
        this.score += res.fell.length * 20;
        this._kick(6); this._flash(0.18, '#ffe9a3');
        this.particles.floatText(this.cfg.VIEW.W / 2, this.camera.y + this.cfg.VIEW.H * 0.5, 'COMBO DROP!', '#ffd23f', 28);
        this.sound.play('combo');
      } else if (cleared >= 8 || this.combo >= 5) { this._kick(5); this.sound.play('combo'); }
      else if (res.detonated || cleared >= 5) this._kick(4);
      else if (cleared >= 3) this._kick(2);
    } else this.combo = 0;

    this.queue.refreshValidity();
    this.difficulty.recordShot(cleared);
    this._checkEnd();
  }

  _processRemovals(res) {
    const now = performance.now();
    const n = res.popped.length;
    for (const b of res.popped) {
      const col = this.cfg.COLORS[b.color] ? this.cfg.COLORS[b.color].base : '#bfe8ff';
      if (b.isSpecial()) { this.particles.explosion(b.x, b.y, col); this.sound.play('explosion'); }
      else { this.particles.burst(b.x, b.y, col); }
      // water splash + rising bubbles + soft glow for a juicy pop
      this.particles.splash(b.x, b.y, 3, '#d6f0ff');
      this.particles.bubbles(b.x, b.y, 3);
      this.popping.push({ bubble: b, popT: 0 });
    }
    // bigger matches -> stronger glow flash + lower, richer pop pitch
    if (n > 0) {
      const cx = res.popped.reduce((s, b) => s + b.x, 0) / n;
      const cy = res.popped.reduce((s, b) => s + b.y, 0) / n;
      this.particles.softFlash(cx, cy, 'rgba(255,255,255,0.7)', 40 + n * 6);
    }
    if (res.popped.length && now - this._lastPop > 40) {
      const pitch = 1.15 - Math.min(0.35, n * 0.03) + (Math.random() * 0.12 - 0.06); // bigger match = lower
      this.sound.play('pop', pitch);
      this._lastPop = now;
    }
    for (const b of res.fell) { b.vy = Utils.rand(-40, 40); b.rot = Utils.rand(0, 6.28); b.vr = Utils.rand(-2, 2); b.fadeT = 0; b.emitT = 0; this.falling.push(b); }
    if (res.fell.length > 0) this.sound.play('fall', 0.85 + Math.random() * 0.2 - Math.min(0.15, res.fell.length * 0.02));
    this._updateHUD();
  }

  // Level complete when the whole cave is cleared AND the camera has finished
  // its ascent to the summit (never an early win). Lose when out of shots with
  // bubbles remaining and everything has settled.
  _checkEnd() {
    if (this.board.isEmpty() && this.camera.atTop() && this.camera.settled()) { this._win(); return; }
    if (this.moves <= 0 && !this.shooter.flying && this.popping.length === 0 && this.falling.length === 0 && !this.board.isEmpty()) this._lose();
  }

  _kick(m) { this.shake = Math.max(this.shake, m); }

  // Animated combo praise text that scales in, glows and fades (particle 'text').
  _comboFeedback(x, y) {
    const c = this.combo;
    if (c < 2) return;
    const TIERS = [
      [8, 'Legendary!', '#ff6b6b'], [6, 'Incredible!', '#ffab5e'], [5, 'Excellent!', '#ff9de0'],
      [4, 'Awesome!', '#ffe066'], [3, 'Great!', '#7dff9e'], [2, 'Nice!', '#8fe3ff'],
    ];
    let word = null, col = '#ff9de0';
    for (const [n, w, cc] of TIERS) { if (c >= n) { word = w; col = cc; break; } }
    if (word) {
      const size = Utils.clamp(20 + c * 2, 20, 36);
      this.particles.floatText(x, y - this.grid.r * 2.1, word, col, size);
      this.particles.sparkle(x, y - this.grid.r * 2.1, 8, col);
      if (c >= 4) this.sound.play('combo', 0.9 + Math.min(0.5, c * 0.04));
    }
  }
  _flash(i, c) { this.flashT = Math.max(this.flashT, i); this.flashColor = c || '#ffffff'; }

  // ===================================================================== //
  //  LOOP
  // ===================================================================== //
  _loop(t) {
    const realDt = Math.min(0.033, (t - this._last) / 1000 || 0);
    this._last = t;
    let dt = realDt;
    // brief slow-motion on big combos (timer runs in real time)
    if (this._slowMo > 0) { this._slowMo = Math.max(0, this._slowMo - realDt); dt = realDt * 0.4; }
    if (this.state.is(GameState.PLAYING)) this._update(dt);
    if (this.dom.progressWrap) this.dom.progressWrap.style.display = this.state.is(GameState.PLAYING) ? '' : 'none';
    this._draw();
    requestAnimationFrame((tt) => this._loop(tt));
  }

  _update(dt) {
    // In-game tutorial: freeze gameplay (auto-pause) while the tooltip is shown.
    if (this.tutorialActive) { this.particles.update(dt); this._tutPulse = (this._tutPulse || 0) + dt; return; }
    if (this._levelMech) { this._tutCheckT += dt; this._checkTutorials(); if (this.tutorialActive) return; }
    this.queue.update(dt);
    this.particles.update(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
    if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt * 2.6);
    if (this.muzzle > 0) this.muzzle = Math.max(0, this.muzzle - dt * 5);
    if (this._zoom > 0) this._zoom = Math.max(0, this._zoom - dt * 4);      // zoom-pulse decay
    if (this._recoil > 0) this._recoil = Math.max(0, this._recoil - dt * 6); // recoil spring-back

    // dynamic climb: the camera advances upward only as the bottom rows clear
    // (or an island collapses); it never drops. Final ascent when the board empties.
    const bottomRow = this.board.lowestFilledRow();
    if (bottomRow < 0) this.camera.forceTo(0);
    else this.camera.climbTo(this._scrollForBottom(bottomRow));
    this.camera.update(dt);
    this.shooter.y = this.camera.y + this.shooterScreenY;

    if (this.shooter.flying) {
      this._lastLaunched = this.shooter.flying.bubble;
      const cell = this.shooter.update(dt, (x, y, b) => {
        const c = this.cfg.COLORS[b.color] ? this.cfg.COLORS[b.color].light : '#ffffff';
        this.particles.trail(x, y, c);
      });
      if (cell) this._onLanded(cell);
    }

    for (let i = this.popping.length - 1; i >= 0; i--) { this.popping[i].popT += dt * 6.5; if (this.popping[i].popT >= 1) this.popping.splice(i, 1); }
    if (this._winRays > 0) { this._winRaysT = (this._winRaysT || 0) + dt; this._winRays = Math.max(0, this._winRays - dt * 0.45); }
    if (this._winning) { this._winTimer -= dt; if (this._winTimer <= 0) this._revealWinResults(); }

    const floorY = this.camera.y + this.cfg.VIEW.H + 60; // just off the screen bottom
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const b = this.falling[i];
      b.vy += this.cfg.TIME.fallGravity * dt; b.y += b.vy * dt; b.x += Math.sin(b.y * 0.05) * 12 * dt;
      b.rot = (b.rot || 0) + (b.vr || 0) * dt;                 // small spin
      b.fadeT = (b.fadeT || 0) + dt;                           // fade out over time
      b.emitT = (b.emitT || 0) + dt;
      if (b.emitT > 0.12) { b.emitT = 0; this.particles.bubbles(b.x, b.y, 1); } // trail of tiny bubbles
      if (b.y > floorY) {
        const col = this.cfg.COLORS[b.color] ? this.cfg.COLORS[b.color].base : '#bfe8ff';
        this.particles.sparkle(b.x, floorY - 20, 4, col); this.particles.splash(b.x, floorY - 20, 4, '#cfeeff');
        this.falling.splice(i, 1);
      }
    }

    for (let r = 0; r < this.grid.rows; r++) for (let c = 0; c < this.grid.cols; c++) {
      const b = this.board.cells[r][c];
      if (b) { if (b.spawnT < 1) b.spawnT = Math.min(1, b.spawnT + dt * 6); if (b.land > 0) b.land = Math.max(0, b.land - dt * 11); b.wobble += dt; }
    }

    this._updateHUD();
    this._checkEnd();
  }

  _draw() {
    const ctx = this.ctx;
    this.renderer.clear();
    this.renderer.background(0);       // transparent canvas + ambient bubbles
    if (!this._levelActive) return;    // menu/map are DOM screens

    ctx.save();
    // zoom pulse (scales the whole scene around the viewport centre)
    if (this._zoom > 0) {
      const z = 1 + this._zoom * 0.03, cx = this.cfg.VIEW.W / 2, cy = this.cfg.VIEW.H / 2;
      ctx.translate(cx, cy); ctx.scale(z, z); ctx.translate(-cx, -cy);
    }
    const shx = this.shake > 0 ? Utils.rand(-this.shake, this.shake) : 0;
    const shy = this.shake > 0 ? Utils.rand(-this.shake, this.shake) : 0;
    ctx.translate(shx, shy - this.camera.y);

    // only draw bubbles within the visible viewport (+margin); the rest of the
    // tall cave stays hidden until the player climbs to it
    const viewTop = this.camera.y - this.grid.d, viewBot = this.camera.y + this.cfg.VIEW.H + this.grid.d;
    for (let r = 0; r < this.grid.rows; r++) for (let c = 0; c < this.grid.cols; c++) {
      const b = this.board.cells[r][c]; if (!b || b.y < viewTop || b.y > viewBot) continue;
      const sc = Utils.easeOutCubic(Utils.clamp(b.spawnT, 0, 1));
      const wob = Math.sin(b.wobble * 2 + (r + c)) * 0.6;
      this.renderer.bubble(b, b.x, b.y + wob, this.grid.r, sc);
    }
    for (const b of this.falling) { const fa = Utils.clamp(1 - (b.fadeT || 0) * 0.8, 0, 1) * 0.95; this.renderer.bubble(b, b.x, b.y, this.grid.r, 1, fa, b.rot || 0); }
    for (const p of this.popping) { const t = p.popT; const s = 1 + Math.sin(t * Math.PI * 0.5) * 0.07; const a = 1 - t * t; this.renderer.bubble(p.bubble, p.bubble.x, p.bubble.y, this.grid.r, s, a); }

    if (this.aiming && this.shooter.canShoot() && this.shooter.aimValid) this._drawTrajectory();
    this.particles.draw(ctx);
    if (this.shooter.flying) { const b = this.shooter.flying.bubble; this.renderer.bubble(b, b.x, b.y, this.grid.r, 1, 1, b.rot || 0); }
    this._drawShooter();
    ctx.restore();
    if (this.flashT > 0) this.renderer.flash(this.flashT * 0.5, this.flashColor);
    if (this._winRays > 0) this._drawWinRays();
    if (this.tutorialActive) this._drawTutorialSpotlight();
  }

  // Radiant light rays sweeping from the top-centre during the win sequence.
  _drawWinRays() {
    const ctx = this.ctx; const W = this.cfg.VIEW.W, H = this.cfg.VIEW.H;
    const a = Math.min(1, this._winRays);
    const cx = W / 2, cy = H * 0.34;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(cx, cy);
    const spin = (this._winRaysT || 0) * 0.5;
    for (let i = 0; i < 12; i++) {
      const ang = spin + i * (Math.PI * 2 / 12);
      ctx.save(); ctx.rotate(ang);
      const g = ctx.createLinearGradient(0, 0, 0, -H);
      g.addColorStop(0, `rgba(255,240,190,${0.16 * a})`);
      g.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(26, 0); ctx.lineTo(10, -H); ctx.lineTo(-10, -H); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // Darken the play area and spotlight the newly-introduced object with a
  // glowing outline + an animated pointer (screen space).
  _drawTutorialSpotlight() {
    const ctx = this.ctx; const W = this.cfg.VIEW.W, H = this.cfg.VIEW.H;
    const t = this._tutPulse || 0;
    ctx.save();
    ctx.fillStyle = 'rgba(3,12,34,0.6)';
    ctx.fillRect(0, 0, W, H);
    const tgt = this._tutTarget;
    if (tgt && tgt.mode === 'board') {
      const sx = tgt.x, sy = tgt.y - this.camera.y;         // world -> screen
      const rr = this.grid.r + 6 + Math.sin(t * 4) * 3;      // pulsing ring
      // punch a brighter spotlight hole
      const grd = ctx.createRadialGradient(sx, sy, rr * 0.4, sx, sy, rr * 2.2);
      grd.addColorStop(0, 'rgba(255,255,255,0.22)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(sx, sy, rr * 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = '#ffe9a3'; ctx.shadowBlur = 18;
      ctx.strokeStyle = '#ffe9a3'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(sx, sy, rr, 0, Math.PI * 2); ctx.stroke();
      // animated pointer above the target
      ctx.shadowBlur = 0; ctx.fillStyle = '#ffe9a3';
      const py = sy - rr - 14 - Math.abs(Math.sin(t * 3)) * 6;
      ctx.beginPath(); ctx.moveTo(sx, py + 12); ctx.lineTo(sx - 8, py); ctx.lineTo(sx + 8, py); ctx.closePath(); ctx.fill();
    } else if (tgt && tgt.mode === 'center') {
      const sx = W / 2, sy = H * 0.42;
      ctx.shadowColor = '#ffe9a3'; ctx.shadowBlur = 16; ctx.strokeStyle = 'rgba(255,233,163,0.8)'; ctx.lineWidth = 3;
      const rr = 60 + Math.sin(t * 3) * 6;
      ctx.beginPath(); ctx.arc(sx, sy, rr, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  // Premium aim guide: a thin, smooth, softly glowing trajectory that runs the
  // FULL path to the predicted landing point, including wall reflections, at
  // ~60% opacity. No ghost bubble or landing marker — the player estimates the
  // exact landing naturally.
  _drawTrajectory() {
    const ctx = this.ctx;
    // Predict with the EXACT same wall bounds, reflection, collision radius, offset,
    // STEP and float math as the real moving bubble (previewPath() with the default
    // centre bounds minLeft/maxRight — identical to Shooter.update). This keeps the
    // drawn path perfectly synchronized with the bubble after every wall bounce, so
    // a bank shot's predicted collision point is always the real collision point.
    const pts = this.shooter.previewPath();
    if (!pts.length) return;
    const cdef = this.cfg.COLORS[this.queue.current.color];
    const color = cdef ? cdef.light : '#ffffff';
    const marginX = this.cfg.BOARD.marginX, W = this.cfg.VIEW.W;

    const sx = this.shooter.x, sy = this.shooter.y;
    const gap = this.grid.r * 1.15;
    // Piecewise-straight guide through the launcher, each WALL CONTACT point, and the
    // true landing. The ball CENTRE bounces a radius from the wall (previewPath is
    // unchanged), but its EDGE touches the wall; drawing the reflection vertex at that
    // contact point bends the long straight legs by only ~2-3 degrees (imperceptible)
    // yet makes the guide reflect exactly AT the wall with no gap, no spur and no poke.
    // The final point stays the exact collision, so the guide and the ball meet at both
    // the wall and the landing cell.
    const poly = [{ x: sx + Math.cos(this.shooter.angle) * gap, y: sy + Math.sin(this.shooter.angle) * gap }];
    for (const p of pts) {
      if (p.wall) poly.push({ x: p.wall < 0 ? marginX : (W - marginX), y: p.y, wall: p.wall });
    }
    const lastP = pts[pts.length - 1];
    if (lastP && !lastP.wall) poly.push({ x: lastP.x, y: lastP.y });
    if (poly.length < 2) return;

    // arc-length segments; note the first wall bounce (fade) + the wall-corner dots
    const seg = []; let total = 0, firstBounce = Infinity; const wallDots = [];
    for (let i = 1; i < poly.length; i++) {
      const len = Utils.dist(poly[i - 1].x, poly[i - 1].y, poly[i].x, poly[i].y);
      seg.push({ a: poly[i - 1], b: poly[i], len, acc: total }); total += len;
      if (poly[i].wall) { if (total < firstBounce) firstBounce = total; wallDots.push({ x: poly[i].x, y: poly[i].y, acc: total }); }
    }
    if (total < 2) return;

    const spacing = 15;
    const flow = ((performance.now() / 1000) * 26) % spacing;
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    let si = 0;
    for (let d = flow; d < total; d += spacing) {
      while (si < seg.length - 1 && d > seg[si].acc + seg[si].len) si++;
      const s = seg[si];
      const t = s.len ? (d - s.acc) / s.len : 0;
      const x = s.a.x + (s.b.x - s.a.x) * t, y = s.a.y + (s.b.y - s.a.y) * t;
      const f = d / total;
      let alpha = 0.6 * (1 - f * 0.7);
      // gently fade the trajectory past the first wall bounce (aesthetic only — the
      // path is now an exact prediction, not an approximation)
      if (d > firstBounce) alpha *= Math.max(0.28, 1 - (d - firstBounce) / 170);
      ctx.globalAlpha = alpha;
      const rad = 4 * (1 - f * 0.55);
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    }
    // a dot exactly on each wall corner so the guide visibly meets the wall (this sits
    // ON the reflection vertex — part of the line, not a spur)
    for (const wd of wallDots) {
      const f = wd.acc / total;
      let alpha = 0.6 * (1 - f * 0.7);
      if (wd.acc > firstBounce + 0.5) alpha *= Math.max(0.28, 1 - (wd.acc - firstBounce) / 170);
      ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.arc(wd.x, wd.y, 4 * (1 - f * 0.55), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Vertical shooter HUD (reference layout):
  //   ● Current bubble (top, glowing) -> the ball that fires
  //   ◍ Remaining shots (larger centre ring, below current)
  //   ○ Reserve bubble (to the RIGHT of the ring, ~75% scale)
  // Tap either bubble to swap; a ~250ms animation crosses them over. The whole
  // cluster sits well above the special inventory with clear spacing.
  _drawShooter() {
    const ctx = this.ctx; const sh = this.shooter; const r = this.grid.r;

    if (this.muzzle > 0) {
      ctx.save(); ctx.translate(sh.x, sh.y); ctx.rotate(sh.angle); ctx.globalAlpha = this.muzzle * 0.8;
      const fr = r * (0.8 + this.muzzle * 0.9);
      const mg = ctx.createRadialGradient(r * 0.7, 0, 0, r * 0.7, 0, fr);
      mg.addColorStop(0, 'rgba(255,255,255,0.95)'); mg.addColorStop(0.5, 'rgba(255,220,150,0.5)'); mg.addColorStop(1, 'rgba(255,180,90,0)');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(r * 0.7, 0, fr, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (!this.shooter.canShoot()) return;

    // geometry — clear vertical gaps; reserve offset to the right (not below)
    const ringR = r * 1.9;                        // ~25% larger shots ring
    const cx = sh.x;
    const curSlot = { x: cx, y: sh.y };           // current (launch point) on top
    const recoil = (this._recoil || 0) * 7;       // launcher kicks down then springs up
    const ringY = sh.y + r + 8 + ringR;           // ring centre, gap below current
    const nr = r * 0.75;                          // reserve ~75% scale
    const resSlot = { x: cx + ringR + nr + 6, y: ringY + ringR * 0.4 }; // right of ring

    // swap cross-over animation (queue.swapAnim 1 -> 0): current <-> reserve
    const s = this.queue.swapAnim;
    const nowS = performance.now() / 1000;
    const float = Math.sin(nowS * 1.6) * 2.2;          // launcher gently floats
    const breathe = 1 + Math.sin(nowS * 1.6) * 0.03;   // queue gently breathes
    const curP = { x: curSlot.x + (resSlot.x - curSlot.x) * s, y: curSlot.y + (resSlot.y - curSlot.y) * s + recoil + float };
    const resP = { x: resSlot.x + (curSlot.x - resSlot.x) * s, y: resSlot.y + (curSlot.y - resSlot.y) * s + float * 0.7 };

    // centre ring with the remaining-shots count
    ctx.save();
    ctx.shadowColor = 'rgba(180,220,255,0.9)'; ctx.shadowBlur = 12;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(230,244,255,0.95)';
    ctx.beginPath(); ctx.arc(cx, ringY, ringR, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(120,190,255,0.9)'; ctx.shadowBlur = 10;
    ctx.fillStyle = '#eaf4ff'; ctx.font = '900 40px Nunito, system-ui, sans-serif';
    ctx.fillText(String(this.moves), cx, ringY + 1);
    ctx.restore();

    // RESERVE bubble (right of ring, ~75% scale)
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 6;
    ctx.fillStyle = 'rgba(4,18,63,0.35)'; ctx.beginPath(); ctx.arc(resSlot.x, resSlot.y, nr + 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    this.renderer.bubble(this.queue.next, resP.x, resP.y, nr * breathe);
    this._nextHit = { x: resSlot.x, y: resSlot.y, r: nr };

    // CURRENT bubble (top) with an active glow — or an equipped special preview
    ctx.save();
    const specGlow = this.abilities.equipped ? (8 + 6 * Math.sin(nowS * 5)) : 0; // specials softly glow
    ctx.shadowColor = this.abilities.equipped ? 'rgba(255,225,150,0.95)' : 'rgba(150,210,255,0.95)';
    ctx.shadowBlur = 18 + 6 * Math.sin(performance.now() / 240) + specGlow;
    ctx.beginPath(); ctx.arc(curP.x, curP.y, r * 1.05, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(210,238,255,0.9)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
    if (this.abilities.equipped) {
      const def = AbilityDefs[this.abilities.equipped];
      const preview = new Bubble({ color: def.special === 'rainbow' ? '' : (this.board.activeColors()[0] || 'red'), special: def.special });
      this.renderer.bubble(preview, curP.x, curP.y, r * 0.98 * breathe);
    } else {
      this.renderer.bubble(this.queue.current, curP.x, curP.y, r * 0.98 * breathe);
    }
    this._curHit = { x: curSlot.x, y: curSlot.y, r: r };
  }

  // ===================================================================== //
  //  HUD & OVERLAYS
  // ===================================================================== //
  _updateHUD() {
    if (this.dom.levelLabel) this.dom.levelLabel.textContent = 'Level ' + this.levels.number;
    this._updateProgress();
  }

  // Star thresholds (fraction of the multi-factor performance) needed for 1/2/3
  // stars. Early levels are generous; harder levels gradually demand more.
  _progressThresholds() {
    const diff = Utils.clamp((this.levels.number - 1) / 220, 0, 1);
    return [0.34 + diff * 0.05, 0.62 + diff * 0.08, 0.88 + diff * 0.07];
  }

  // Overall performance in [0,1] from weighted factors: 45% bubbles cleared,
  // 25% shots remaining, 20% combo, 10% score (+ a little for bonus objects).
  _computeProgress() {
    const initial = this._initialBubbles || 1;
    const cleared = Utils.clamp((initial - this.board.countAll()) / initial, 0, 1);
    const shots = Utils.clamp(this.moves / Math.max(1, this.movesBudget), 0, 1);
    const combo = Utils.clamp((this._maxCombo || 0) / 5, 0, 1);
    const score = Utils.clamp(this.score / Math.max(1, initial * 12), 0, 1);
    let p = 0.45 * cleared + 0.25 * shots + 0.20 * combo + 0.10 * score;
    if (this.bonusFound) p += 0.06;                 // rescuing the hidden bonus rewards progress
    return Utils.clamp(p, 0, 1);
  }

  // Reset + position the three star markers for the current level.
  _setupProgressBar() {
    const th = this._progressThresholds();
    const stars = [this.dom.pstar1, this.dom.pstar2, this.dom.pstar3];
    stars.forEach((s, i) => { if (s) { s.style.left = (th[i] * 100) + '%'; s.classList.remove('lit', 'pop'); } });
    if (this.dom.progressFill) this.dom.progressFill.style.width = '0%';
    this._litStars = 0; this._progShown = 0;
  }

  // Smoothly reflect current performance; light stars one-by-one as they're reached.
  _updateProgress(finalize) {
    if (!this.dom.progressFill) return;
    const p = this._computeProgress();
    // the bar only moves forward (never dips) so it always feels rewarding
    this._progShown = Math.max(this._progShown || 0, p);
    const shown = finalize ? p : this._progShown;
    this.dom.progressFill.style.width = (shown * 100).toFixed(1) + '%';
    const th = this._progressThresholds();
    const stars = [this.dom.pstar1, this.dom.pstar2, this.dom.pstar3];
    for (let i = 0; i < 3; i++) {
      if (shown >= th[i] - 1e-6 && (this._litStars || 0) <= i) {
        this._litStars = i + 1;
        const el = stars[i];
        if (el) { el.classList.add('lit', 'pop'); setTimeout(() => el.classList.remove('pop'), 430); }
        this.sound.play('star', 1 + i * 0.18);
        // sparkle at the star's on-screen position
        const wrap = this.dom.progressWrap;
        if (wrap && wrap.getBoundingClientRect && this.canvas && this.canvas.getBoundingClientRect) {
          const wb = wrap.getBoundingClientRect(), fb = this.canvas.getBoundingClientRect();
          if (fb.width > 0) {
            const sc = this.cfg.VIEW.W / fb.width;
            const sxp = (wb.left - fb.left + wb.width * th[i]) * sc;
            const syp = (wb.top - fb.top) * sc + this.camera.y;
            this.particles.sparkle(sxp, syp, 9, '#ffe27a');
          }
        }
      }
    }
  }

  _pause() { if (this.state.is(GameState.PLAYING)) this.state.set(GameState.PAUSED); }
  // Play the pause-popup close animation, then run the action.
  _closePause(fn) {
    const pop = this.dom.pausePopup;
    const card = pop && pop.querySelector && pop.querySelector('.popup');
    if (card && card.classList) { card.classList.add('closing'); setTimeout(() => { card.classList.remove('closing'); fn(); }, 180); }
    else fn();
  }
  _resume() { if (this.state.is(GameState.PAUSED)) this.state.set(GameState.PLAYING); }

  _win() {
    if (this.state.is(GameState.WON) || this._winning) return;
    this._winning = true;                       // freeze end-checks + input briefly
    const n = this.levels.number;
    // Multi-factor star award (bubbles/shots/combo/score) — replaces the old
    // shots-only calc; still 0–3 stars feeding the same star/save system.
    this._updateProgress(true);
    const P = this._computeProgress();
    const th = this._progressThresholds();
    const stars = Utils.clamp(P >= th[2] ? 3 : P >= th[1] ? 2 : 1, 1, 3);
    this.save.recordResult(n, stars);
    this._lastStars = stars;

    // Milestone reward: comes from the LevelDatabase record (claimed once).
    this._pendingReward = null;
    const dbReward = this.levels.level.rewards;
    if (dbReward && !this.save.hasClaimed(n)) {
      for (const [id, cnt] of dbReward.items) this.save.addSpecial(id, cnt);
      this.save.markClaimed(n);
      this._pendingReward = dbReward;
    }

    // ---- premium completion sequence (burst -> fall -> rays -> shake) ----
    this._winStars = stars;
    this.sound.play('victory');
    this._kick(12); this._flash(0.55, '#ffe9a3');
    this._winRays = 1; this._winRaysT = 0;
    this._zoom = 2;                       // camera zoom punch on completion
    this._slowMo = 0.15;                  // brief slow-motion (winning shot only)
    this._winBurst();
    this._winTimer = 0.85;                // seconds of sequence before the popup
  }

  // Reveal the polished results popup after the completion sequence.
  _revealWinResults() {
    this._winning = false; this._winTimer = 0;
    const n = this.levels.number;
    this.state.set(GameState.WON);
    this._renderStars(this._winStars);       // stars pop in one-by-one (CSS)
    if (this.dom.winTitle) this.dom.winTitle.textContent = (this.levels.level.milestone ? 'Milestone ' : 'Level ') + n + ' Complete!';
    if (this.dom.winNext) this.dom.winNext.style.display = this.levels.isLast ? 'none' : '';
    this._animateWinBonus(this.moves);       // count remaining shots into a bonus
    if (this._pendingReward) setTimeout(() => this._showReward(this._pendingReward), 1000);
  }

  // Burst of explosions + sparkles + decorative bubbles raining down.
  _winBurst() {
    const cols = ['#ffd23f', '#ff5d6c', '#41a6ff', '#4fd267', '#b06cff'];
    const cy0 = this.camera.y;
    this.particles.explosion(this.cfg.VIEW.W / 2, cy0 + this.cfg.VIEW.H * 0.4, '#ffd23f');
    let k = 0;
    const b = () => {
      if (k++ > 7 || this.state.is(GameState.WON)) return;
      const x = Utils.rand(40, this.cfg.VIEW.W - 40), y = this.camera.y + Utils.rand(120, 440);
      this.particles.explosion(x, y, Utils.pick(cols));
      this.particles.sparkle(x, y, 10, '#ffffff');
      setTimeout(b, 110);
    };
    b();
    const keys = this.cfg.COLOR_KEYS || ['red', 'blue', 'green', 'yellow', 'purple'];
    for (let i = 0; i < 16; i++) {
      const bub = new Bubble({ color: Utils.pick(keys) });
      bub.x = Utils.rand(36, this.cfg.VIEW.W - 36);
      bub.y = this.camera.y + Utils.rand(70, 260);
      bub.vy = Utils.rand(-40, 30);
      this.falling.push(bub);
    }
  }

  // Count remaining shots into a bonus score shown in the results popup.
  _animateWinBonus(shotsLeft) {
    const el = this.dom.winBonus; if (!el) return;
    const total = Math.max(0, shotsLeft | 0) * 100;
    if (total <= 0) { el.textContent = ''; el.classList.remove('show'); return; }
    el.classList.add('show');
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const dur = 700;
    const tick = () => {
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const p = Math.min(1, (now - t0) / dur);
      const val = Math.round(total * (1 - Math.pow(1 - p, 3)));
      el.textContent = `Shot Bonus  +${val}`;
      if (p < 1 && typeof requestAnimationFrame === 'function') requestAnimationFrame(tick);
      else el.textContent = `Shot Bonus  +${total}`;
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tick); else el.textContent = `Shot Bonus  +${total}`;
  }

  _showReward(reward) {
    const d = this.dom;
    if (d.rewardTitle) d.rewardTitle.textContent = reward.title;
    if (d.rewardItems) {
      d.rewardItems.innerHTML = '';
      for (const [id, cnt] of reward.items) {
        const def = AbilityDefs[id]; if (!def) continue;
        const chip = document.createElement('div'); chip.className = 'reward-chip';
        chip.innerHTML = `<span class="reward-icon">${def.icon}</span><span class="reward-x">×${cnt}</span>`;
        d.rewardItems.appendChild(chip);
      }
    }
    if (d.rewardPopup) d.rewardPopup.classList.add('show');
  }
  _dismissReward() { if (this.dom.rewardPopup) this.dom.rewardPopup.classList.remove('show'); }

  _lose() {
    if (this.state.is(GameState.LOST)) return;
    this.state.set(GameState.LOST);
    this.sound.play('failure');
  }

  _renderStars(stars) {
    const wrap = this.dom.winStars; if (!wrap) return;
    const spans = wrap.querySelectorAll('span');
    spans.forEach((s, i) => {
      // restart the pop animation so re-shown popups animate again
      s.classList.remove('earned', 'pop');
      if (i < stars) {
        // schedule each star to light up one-by-one with a rising pitch + sparkle
        setTimeout(() => {
          if (s.classList) s.classList.add('earned', 'pop');
          this.sound.play('star', 1 + i * 0.18);
          const cx = this.cfg.VIEW.W / 2 + (i - 1) * 46, cy = this.cfg.VIEW.H * 0.34;
          this.particles.sparkle(cx, this.camera.y + cy, 10, '#ffe27a');
          if (i === stars - 1 && stars >= 3) { this._kick(6); this.particles.softFlash(cx, this.camera.y + cy, 'rgba(255,226,122,0.9)', 70); } // 3rd star extra
        }, 260 + i * 240);
      }
    });
  }

  _celebrate() {
    let n = 0;
    const burst = () => {
      if (n++ > 9 || !this.state.is(GameState.WON)) return;
      const x = Utils.rand(40, this.cfg.VIEW.W - 40), y = Utils.rand(120, 360);
      this.particles.explosion(x, y, Utils.pick(['#ffd23f', '#ff5d6c', '#41a6ff', '#4fd267', '#b06cff']));
      setTimeout(burst, 170);
    };
    burst();
  }

  _advance() {
    const nxt = this.levels.number + 1;
    if (nxt <= this.levels.count && this.save.isUnlocked(nxt)) this._startLevel(nxt);
    else this._showMap({ focusCurrent: true });
  }

  // ---- tutorials --------------------------------------------------------
  // Called each PLAYING frame while this level introduces an unseen mechanic.
  // Triggers a lightweight in-game tutorial the moment the player first meets it.
  _checkTutorials() {
    const mech = this._levelMech;
    if (!mech || this.tutorialActive) return;
    let target = null;
    if (mech === 'bomb' || mech === 'rainbow' || mech === 'fireball' || mech === 'lightning') {
      // special ball: show once the inventory bar is on-screen (shortly after start)
      if (this._tutCheckT > 0.6) target = { mode: 'ability', id: mech === 'lightning' ? 'laser' : mech };
    } else if (mech === 'basics') {
      if (this._tutCheckT > 0.5) target = { mode: 'center' };
    } else {
      // obstacle: wait until one is actually visible in the viewport
      const shell = mech === 'ice' ? 'ice' : mech === 'stone' ? 'crystal' : mech === 'locked' ? 'chain' : null;
      if (shell) { const cell = this._findVisibleShell(shell); if (cell) target = { mode: 'board', x: cell.x, y: cell.y }; }
    }
    if (target) this._triggerTutorial(mech, target);
  }

  // Find an on-board obstacle of the given shell currently within the viewport.
  _findVisibleShell(shell) {
    const top = this.camera.y - this.grid.d, bot = this.camera.y + this.cfg.VIEW.H * 0.85;
    for (let r = 0; r < this.grid.rows; r++) for (let c = 0; c < this.grid.cols; c++) {
      const b = this.board.cells[r][c];
      if (b && b.shell === shell && b.y > top && b.y < bot) return b;
    }
    return null;
  }

  _triggerTutorial(mech, target) {
    this.tutorialActive = true;
    this._pendingTutorial = mech;
    this._tutTarget = target;
    this._tutPulse = 0;
    const info = {
      basics: ['💧', 'Match & Pop', 'Match 3 or more touching bubbles of the same colour to pop them. Clear the whole cave to win!'],
      bomb: ['💣', 'Bomb Bubble', 'Explodes nearby bubbles within its blast radius. Tap it below, then fire.'],
      rainbow: ['🌈', 'Rainbow Bubble', 'Matches any colour it touches — it becomes the colour it connects with and clears that group.'],
      fireball: ['🔥', 'Fire Ball', 'Destroys every bubble along its flight path.'],
      lightning: ['⚡', 'Lightning Bubble', 'Strikes down a whole column, clearing everything in its path.'],
      ice: ['🧊', 'Ice Bubble', 'Frozen bubbles take two hits — crack the ice with a nearby match, then clear it.'],
      stone: ['🪨', 'Stone Block', 'Stone has no colour and blocks shots. Pop bubbles next to it to shatter it.'],
      locked: ['🔒', 'Locked Bubble', 'Chained bubbles are locked. Clear an adjacent match to break the chain first.'],
    }[mech] || ['✨', 'New Mechanic', 'A new challenge awaits!'];
    if (this.dom.tutorialBanner) this.dom.tutorialBanner.textContent = info[0];
    if (this.dom.tutorialTitle) this.dom.tutorialTitle.textContent = info[1];
    if (this.dom.tutorialBody) this.dom.tutorialBody.textContent = info[2];
    // highlight the special's inventory slot if this is an ability tutorial
    if (target.mode === 'ability' && this.dom.abilityBar && this.dom.abilityBar.querySelector) {
      const slot = this.dom.abilityBar.querySelector(`[data-id="${target.id}"]`);
      if (slot && slot.classList) slot.classList.add('tut-glow');
    }
    if (this.dom.tutorialPopup) { this.dom.tutorialPopup.classList.add('show', 'ingame'); }
    this.sound.play('click');
  }

  _dismissTutorial() {
    if (this.dom.tutorialPopup) this.dom.tutorialPopup.classList.remove('show', 'ingame');
    if (this.dom.abilityBar && this.dom.abilityBar.querySelectorAll)
      this.dom.abilityBar.querySelectorAll('.tut-glow').forEach && this.dom.abilityBar.querySelectorAll('.tut-glow').forEach(el => el.classList && el.classList.remove('tut-glow'));
    if (this._pendingTutorial) { this.save.markTutorial(this._pendingTutorial); if (this._pendingTutorial === this._levelMech) this._levelMech = null; this._pendingTutorial = null; }
    this.tutorialActive = false; this._tutTarget = null;
    // gameplay continues immediately (state was never left)
  }

  // ---- Ability Bar ------------------------------------------------------
  _buildAbilityBar() {
    const wrap = this.dom.abilityBar; if (!wrap) return;
    wrap.innerHTML = '';
    this.abilities.slots.forEach((slot) => {
      const btn = document.createElement('button');
      btn.className = 'ability'; btn.dataset.id = slot.id; btn.style.setProperty('--acol', slot.def.color);
      const icon = document.createElement('span'); icon.className = 'ability-icon'; icon.textContent = slot.def.icon;
      const badge = document.createElement('span'); badge.className = 'ability-count';
      btn.appendChild(icon); btn.appendChild(badge);
      btn.addEventListener('click', () => {
        this.sound.resume(); this.sound.play('click');
        if (slot.count > 0) { this.abilities.toggle(slot.id); this._updateAbilityBar(); }
        else this._watchAdFor(slot.id);   // depleted -> rewarded video
      });
      wrap.appendChild(btn);
    });
    this._updateAbilityBar();
  }
  _updateAbilityBar() {
    const wrap = this.dom.abilityBar; if (!wrap) return;
    this.abilities.slots.forEach((slot) => {
      const btn = wrap.querySelector(`[data-id="${slot.id}"]`); if (!btn) return;
      const depleted = slot.count <= 0;
      btn.querySelector('.ability-count').textContent = depleted ? '▶+3' : ('x' + slot.count);
      btn.classList.toggle('equipped', this.abilities.isEquipped(slot.id));
      btn.classList.toggle('depleted', depleted);
      btn.classList.toggle('watch', depleted); // depleted is tappable to watch an ad
      btn.disabled = false;
    });
  }

  // Rewarded-video reward for a depleted special (placeholder ad manager).
  _watchAdFor(id) {
    if (!RewardedAdManager.isAvailable()) return;
    RewardedAdManager.show((ok, amount) => {
      if (!ok) return;
      this.save.addSpecial(id, amount || 3);
      this.abilities = new AbilityBar(this._unlockedInventory());
      this._buildAbilityBar();
      if (this._refreshPowerups) this._refreshPowerups();
      const def = AbilityDefs[id];
      this.particles.floatText(this.cfg.VIEW.W / 2, this.camera.y + this.cfg.VIEW.H * 0.5, `+${amount || 3} ${def ? def.label : ''}!`, '#ffd23f', 24);
      this.sound.play('victory');
    });
  }

  // ===================================================================== //
  //  MAIN MENU + LEVEL MAP (DOM)
  // ===================================================================== //
  // Power-Ups / Special Inventory menu: lists every special with its saved
  // count; depleted ones show a "Watch Video" button (placeholder rewarded ad).
  _refreshPowerups() {
    const wrap = this.dom.powerupList; if (!wrap) return;
    wrap.innerHTML = '';
    for (const id of ['bomb', 'rainbow', 'fireball', 'laser']) {
      const def = AbilityDefs[id]; if (!def) continue;
      const count = this.save.inventory[id] || 0;
      const row = document.createElement('div'); row.className = 'powerup-row';
      const icon = document.createElement('span'); icon.className = 'pu-icon'; icon.textContent = def.icon;
      const name = document.createElement('span'); name.className = 'pu-name'; name.textContent = def.label;
      row.appendChild(icon); row.appendChild(name);
      if (count > 0) {
        const cnt = document.createElement('span'); cnt.className = 'pu-count'; cnt.textContent = 'x' + count;
        row.appendChild(cnt);
      } else {
        const btn = document.createElement('button'); btn.className = 'pu-watch'; btn.textContent = '▶ Watch Video';
        btn.addEventListener('click', () => { this.sound.resume(); this.sound.play('click'); this._watchAdForMenu(id); });
        row.appendChild(btn);
      }
      wrap.appendChild(row);
    }
  }

  _watchAdForMenu(id) {
    if (!RewardedAdManager.isAvailable()) return;
    RewardedAdManager.show((ok, amount) => {
      if (!ok) return;
      if (!this.save.data.unlockedSpecials[id]) this.save.data.unlockedSpecials[id] = true;
      this.save.addSpecial(id, amount || 3);
      this._refreshPowerups();
    });
  }

  _buildMenu() {
    // populate the collection gallery once with the real bubble sprites
    const gal = this.dom.collectionGallery;
    if (gal && !gal.dataset.built) {
      gal.dataset.built = '1';
      for (const c of ['red', 'blue', 'green', 'yellow', 'purple', 'gold', 'orange']) {
        const cell = document.createElement('div'); cell.className = 'coll-cell';
        const img = document.createElement('img'); img.src = BubbleSprites.DATA[BubbleSprites.keyFor(c)]; img.alt = c;
        cell.appendChild(img); gal.appendChild(cell);
      }
    }
  }

  // ======================================================================
  //  LEVEL MAP (rebuilt) — reversed snake path (Level 1 at the BOTTOM, higher
  //  levels upward). Loaded levels are real DOM buttons, bottom-anchored and
  //  append-only (never recreated); the browser virtualizes off-screen nodes
  //  via CSS content-visibility, so buttons are always present and cheap.
  //  Loading more grows the track upward and shifts scrollTop by the same delta
  //  so the view never jumps.
  // ======================================================================
  _buildMap() {
    const track = this.dom.mapNodes; if (!track || track.dataset.built) return;
    track.dataset.built = '1';
    this.MAP_ROW = 92; this.MAP_PAD = 84; this.MAP_AMP = 70; this.MAP_NODE = 64;
    this._mapLoaded = 0;                  // highest level currently in the DOM
    this._mapEls = new Map();             // level -> node element
    this._mapLoading = false; this._mapSaveT = 0;
    if (track.style) track.style.position = 'relative';
    this._mapEnsureLoaded(Math.max(50, this.save.getMapLoaded() || 50));  // first 50
    const s = this.dom.mapScroll;
    if (s && s.addEventListener) s.addEventListener('scroll', () => this._onMapScroll());
  }

  // Geometry: level 1 lowest; each level ROW px higher. Bottom-anchored so
  // appending higher levels never repositions existing ones.
  _mapBottom(n) { return this.MAP_PAD + (n - 1) * this.MAP_ROW; }
  _mapSnakeX(n) { return Math.sin(n * 0.5) * this.MAP_AMP; }        // curves every ~6 levels
  _mapTopOf(n) { return this._mapHeight - (this._mapBottom(n) + this.MAP_NODE / 2); }

  _mapApplyHeight() {
    this._mapHeight = this.MAP_PAD * 2 + Math.max(0, this._mapLoaded - 1) * this.MAP_ROW + this.MAP_NODE;
    if (this.dom.mapNodes && this.dom.mapNodes.style) this.dom.mapNodes.style.height = this._mapHeight + 'px';
  }

  // Append levels up to `upTo` (never recreates existing nodes).
  _mapEnsureLoaded(upTo) {
    upTo = Math.min(upTo, this.levels.count);
    if (upTo <= this._mapLoaded) return;
    for (let n = this._mapLoaded + 1; n <= upTo; n++) this._mapCreateNode(n);
    this._mapLoaded = upTo;
    this._mapApplyHeight();
  }

  _mapCreateNode(n) {
    const el = document.createElement('button');
    el.dataset.level = n;
    el.style.bottom = this._mapBottom(n) + 'px';
    el.style.marginLeft = (this._mapSnakeX(n) - this.MAP_NODE / 2) + 'px';
    const num = document.createElement('span'); num.className = 'map-num';
    const st = document.createElement('span'); st.className = 'map-stars';
    el.appendChild(num); el.appendChild(st);
    el.addEventListener('click', () => {
      const lv = +el.dataset.level;
      if (!this.save.isUnlocked(lv)) return;
      el.classList.add('press'); setTimeout(() => el.classList.remove('press'), 130);
      this.sound.resume(); this.sound.play('click');
      this._startLevel(lv);
    });
    this.dom.mapNodes.appendChild(el);
    this._mapEls.set(n, el);
    if (n > 1) this._mapCreateDot(n);      // connector to the previous level
    this._mapCreateDeco(n);                // maybe a decoration beside it
    this._mapStyleNode(n);
  }

  _mapCreateDot(n) {
    const dot = document.createElement('div'); dot.className = 'map-dot';
    dot.style.bottom = ((this._mapBottom(n) + this._mapBottom(n - 1)) / 2 + this.MAP_NODE / 2) + 'px';
    dot.style.marginLeft = ((this._mapSnakeX(n) + this._mapSnakeX(n - 1)) / 2) + 'px';
    this.dom.mapNodes.appendChild(dot);
  }

  _mapCreateDeco(n) {
    // deterministic, sparse; placed OUTSIDE the snake band so it never overlaps
    if (n % 2 !== 0) return;
    const DECO = ['🪸', '🌿', '🪨', '🧰', '💎', '🫧'];
    const el = document.createElement('div'); el.className = 'map-deco';
    el.textContent = DECO[(n * 5) % DECO.length];
    const side = this._mapSnakeX(n) >= 0 ? -1 : 1;
    el.style.bottom = (this._mapBottom(n) + 6) + 'px';
    el.style.marginLeft = (side * (this.MAP_AMP + 50) - 13) + 'px';
    this.dom.mapNodes.appendChild(el);
  }

  _mapStyleNode(n) {
    const el = this._mapEls.get(n); if (!el) return;
    const unlocked = this.save.isUnlocked(n), done = this.save.isCompleted(n), stars = this.save.starsFor(n);
    el.className = 'map-node' + (n % 20 === 0 ? ' milestone' : '') + (!unlocked ? ' locked' : '') +
      (done ? ' done' : '') + ((unlocked && !done && n === this.save.unlocked) ? ' current' : '');
    el.disabled = !unlocked;
    const num = el.querySelector && el.querySelector('.map-num'); if (num) num.textContent = n;
    const st = el.querySelector && el.querySelector('.map-stars');
    if (st) st.textContent = done ? ('★'.repeat(stars) + '☆'.repeat(3 - stars)) : (unlocked ? '' : '🔒');
  }

  _mapRefreshStates() { if (this._mapEls) for (const n of this._mapEls.keys()) this._mapStyleNode(n); }

  _onMapScroll() {
    if (!this.state.is(GameState.MAP)) return;
    this._mapSavePosThrottled();
    const s = this.dom.mapScroll; if (!s) return;
    // approaching the TOP (higher levels) -> load the next batch
    if (!this._mapLoading && this._mapLoaded < this.levels.count && (s.scrollTop || 0) < this.MAP_ROW * 4) this._mapLoadMore();
  }

  // Grow the track at the top by `add` levels, keeping the view exactly put.
  _mapGrow(add) {
    const s = this.dom.mapScroll;
    const prevTop = (s && s.scrollTop) || 0;
    const prevH = this._mapHeight;
    this._mapEnsureLoaded(this._mapLoaded + add);
    const delta = this._mapHeight - prevH;
    if (s) s.scrollTop = prevTop + delta;          // no jump
    this.save.setMapLoaded(this._mapLoaded);
    return delta;
  }

  _mapLoadMore() {
    if (this._mapLoading || this._mapLoaded >= this.levels.count) return;
    this._mapLoading = true;
    if (this.dom.mapSpinner && this.dom.mapSpinner.classList) this.dom.mapSpinner.classList.add('show');
    const add = Math.min(20, this.levels.count - this._mapLoaded);
    const finish = () => {
      this._mapGrow(add);
      if (this.dom.mapSpinner && this.dom.mapSpinner.classList) this.dom.mapSpinner.classList.remove('show');
      this._mapLoading = false;
    };
    if (typeof setTimeout === 'function') setTimeout(finish, 240); else finish();
  }

  _mapSavePosThrottled() {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (now - (this._mapSaveT || 0) < 300) return;
    this._mapSaveT = now;
    this.save.setMapCenter(this._mapCenterLevel());
  }
  _mapCenterLevel() {
    const s = this.dom.mapScroll; const h = (s && s.clientHeight) || this.cfg.VIEW.H;
    const centerTop = ((s && s.scrollTop) || 0) + h / 2;               // viewport centre (from top)
    const fromBottom = this._mapHeight - centerTop;                    // distance from content bottom
    return Utils.clamp(Math.round((fromBottom - this.MAP_PAD) / this.MAP_ROW) + 1, 1, this._mapLoaded);
  }

  _mapScrollTo(n, focus) {
    const s = this.dom.mapScroll; if (!s) return;
    const h = s.clientHeight || this.cfg.VIEW.H;
    const top = focus ? (this._mapTopOf(n) - h * 0.72) : (this._mapTopOf(n) - h / 2);
    s.scrollTop = Utils.clamp(top, 0, Math.max(0, this._mapHeight - h));
  }

  _mapResetView() {
    if (!this.dom.mapNodes) return;
    const wrap = this.dom.mapNodes;
    while (wrap.firstChild && wrap.removeChild) wrap.removeChild(wrap.firstChild);
    if (this._mapEls) this._mapEls.clear();
    this._mapLoaded = 0;
    this._mapEnsureLoaded(50);
    this._mapRefreshStates();
  }

  // Open the map. ALWAYS centres on the current playable level (the highest
  // unlocked / level the player is on) — previous manual scrolling is ignored —
  // and scrolls there smoothly (~0.5s) rather than jumping.
  _showMap(opts) {
    this.state.set(GameState.MAP);
    const target = Utils.clamp(this.save.currentLevel || this.save.unlocked, 1, this.save.unlocked);
    this._mapEnsureLoaded(Math.max(50, Math.min(this.levels.count, target + 8), this.save.getMapLoaded() || 0));
    this._mapRefreshStates();
    this.save.setMapCenter(target);
    const run = () => {
      const s = this.dom.mapScroll; if (!s) return;
      const h = s.clientHeight || this.cfg.VIEW.H;
      const dest = Utils.clamp(this._mapTopOf(target) - h * 0.72, 0, Math.max(0, this._mapHeight - h));
      this._mapAnimateScroll(dest, 0.5);
    };
    run();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
  }

  // Smoothly ease scrollTop to dest over `dur` seconds. Sets the final value
  // immediately as a fallback (headless / no rAF), then animates in the browser.
  _mapAnimateScroll(dest, dur) {
    const s = this.dom.mapScroll; if (!s) return;
    const start = s.scrollTop || 0;
    s.scrollTop = dest;                                   // correct final value (headless-safe)
    if (typeof requestAnimationFrame !== 'function' || Math.abs(dest - start) < 2) return;
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const t0 = now(); const token = t0; this._mapScrollAnim = token;
    const ease = (t) => 1 - Math.pow(1 - t, 3);          // easeOutCubic
    const step = () => {
      if (this._mapScrollAnim !== token) return;         // superseded by a newer open
      const p = Math.min(1, (now() - t0) / (dur * 1000));
      s.scrollTop = start + (dest - start) * ease(p);    // eases start->dest (paint is post-rAF)
      if (p < 1) requestAnimationFrame(step); else s.scrollTop = dest;
    };
    requestAnimationFrame(step);
  }
}
