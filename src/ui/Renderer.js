/* =========================================================================
 * Renderer — all canvas drawing. Glossy bubbles with radial gradients,
 * soft shadows, special glyphs, obstacle overlays, background & shooter.
 * Kept separate from game logic (single responsibility).
 * ========================================================================= */
class Renderer {
  constructor(ctx, cfg, grid) {
    this.ctx = ctx; this.cfg = cfg; this.grid = grid;
    this._gradientCache = new Map();
    this._bg = null;
    // crisp, artifact-free downscaling of the high-res bubble sprites
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
  }

  clear() {
    const { W, H } = this.cfg.VIEW;
    this.ctx.clearRect(0, 0, W, H);
  }

  // The gameplay scene image is shown full-screen via CSS on #stage (cover), so
  // the canvas stays transparent here — we only paint a subtle, decorative
  // ambient bubble layer that sits BEHIND every gameplay object. No fills, no
  // tint, no overlay: the underwater artwork shows through untouched.
  background(progress = 0) {
    const ctx = this.ctx; const { W, H } = this.cfg.VIEW;
    if (!this._ambient) this._ambient = this._makeAmbient(W, H);

    const now = performance.now() / 1000;
    ctx.save();
    // gentle underwater light shimmer — a few soft rays that slowly drift (additive,
    // very low alpha, so the scene shows through untouched)
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const lx = W * (0.25 + 0.25 * i) + Math.sin(now * 0.18 + i * 2) * 40;
      const g = ctx.createLinearGradient(lx, 0, lx + 30, H);
      g.addColorStop(0, 'rgba(180,225,255,0.06)');
      g.addColorStop(0.5, 'rgba(180,225,255,0.03)');
      g.addColorStop(1, 'rgba(180,225,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(lx - 40, 0); ctx.lineTo(lx + 40, 0); ctx.lineTo(lx + 90, H); ctx.lineTo(lx - 10, H); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const b of this._ambient) {
      let y = b.y;
      if (b.drift) { // a few bubbles slowly float upward and wrap around
        const range = H + 40;
        y = ((b.y - now * b.drift) % range + range) % range - 20;
      }
      const x = b.x + Math.sin(now * (b.swaySpeed || 0.4) + (b.swayPhase || 0)) * (b.sway || 6); // gentle drift
      const g = ctx.createRadialGradient(x - b.r * 0.3, y - b.r * 0.3, b.r * 0.1, x, y, b.r);
      g.addColorStop(0, `rgba(220,240,255,${b.a})`);
      g.addColorStop(0.7, `rgba(180,220,255,${b.a * 0.5})`);
      g.addColorStop(1, 'rgba(180,220,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, b.r, 0, Math.PI * 2); ctx.fill();
      // faint rim for a glassy underwater feel
      ctx.strokeStyle = `rgba(255,255,255,${b.a * 0.5})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, b.r * 0.92, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  // A small, fixed field of decorative bubbles: mostly static, a few drifting.
  _makeAmbient(W, H) {
    const rnd = (a, b) => a + Math.random() * (b - a);
    const n = 22;                     // few at a time — never cluttered
    const out = [];
    for (let i = 0; i < n; i++) {
      const drift = (i % 3 === 0) ? rnd(6, 16) : 0; // ~33% slowly float upward
      out.push({
        x: rnd(0, W), y: rnd(0, H),
        r: rnd(6, 20),                // ~12-40px diameter
        a: rnd(0.15, 0.35),           // low opacity
        drift,
        sway: rnd(4, 12), swaySpeed: rnd(0.25, 0.6), swayPhase: rnd(0, 6.28),
      });
    }
    return out;
  }

  // Full-screen colour flash (impact feedback). alpha 0..1.
  flash(alpha, color = '#ffffff') {
    if (alpha <= 0) return;
    const ctx = this.ctx; const { W, H } = this.cfg.VIEW;
    ctx.save();
    ctx.globalAlpha = Utils.clamp(alpha, 0, 1);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  _bubbleGradient(color, r) {
    const key = color + '|' + Math.round(r);
    if (this._gradientCache.has(key)) return this._gradientCache.get(key);
    const c = this.cfg.COLORS[color] || { base: '#c9c9d6', dark: '#8a8aa0', light: '#f2f2fb' };
    const g = this.ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.15);
    g.addColorStop(0, c.light);
    g.addColorStop(0.35, c.base);
    g.addColorStop(1, c.dark);
    this._gradientCache.set(key, g);
    return g;
  }

  // Draw a bubble at pixel (x,y) with radius r and scale s.
  bubble(bubble, x, y, r, s = 1, alpha = 1, rot = 0) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    // landing squash-and-stretch: subtle and premium (a few %), settles fast
    const L = bubble.land || 0;
    const sx = s * (1 + 0.05 * L), sy = s * (1 - 0.045 * L);
    ctx.scale(sx, sy);

    // soft drop shadow
    ctx.save();
    ctx.globalAlpha = alpha * 0.25; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(0, r * 0.55, r * 0.85, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (bubble.isCrystal()) { this._crystal(r); this._restoreAndOverlays(bubble, r, ctx); return; }

    // Official artwork: draw the sprite as the whole bubble (identical diameter
    // 2r and centre pivot for every colour). Falls back to the procedural sphere
    // only for the rainbow wildcard (no asset) or before sprites finish loading.
    const sprite = (typeof BubbleSprites !== 'undefined' && bubble.color) ? BubbleSprites.image(bubble.color) : null;
    if (sprite) {
      ctx.drawImage(sprite, -r, -r, r * 2, r * 2);
    } else {
      ctx.fillStyle = this._bubbleGradient(bubble.color, r);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.94, -0.6, 2.1); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.ellipse(-r * 0.32, -r * 0.4, r * 0.28, r * 0.18, -0.5, 0, Math.PI * 2); ctx.fill();
      const gl = Math.sin((performance.now() / 900) + (bubble.wobble || 0)) * r * 0.06;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(-r * 0.4 + gl, -r * 0.42 + gl * 0.5, r * 0.09, 0, Math.PI * 2); ctx.fill();
    }

    if (bubble.isSpecial()) this._specialGlyph(bubble.special, r);

    this._restoreAndOverlays(bubble, r, ctx);
  }

  _restoreAndOverlays(bubble, r, ctx) {
    if (bubble.shell === 'ice') this._ice(r, bubble.hp);
    else if (bubble.shell === 'chain') this._chain(r);
    ctx.restore();
  }

  _crystal(r) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#e9f6ff'); g.addColorStop(0.5, '#9fd4ef'); g.addColorStop(1, '#5aa3c9');
    ctx.fillStyle = g;
    ctx.beginPath();
    const pts = 6;
    for (let i = 0; i < pts; i++) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / pts);
      const rr = r * (i % 2 ? 0.86 : 1);
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    // facet lines
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.moveTo(-r * 0.8, 0); ctx.lineTo(r * 0.8, 0); ctx.stroke();
  }

  _ice(r, hp) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(210,240,255,0.42)';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2); ctx.stroke();
    // frost cracks (more when damaged)
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
    const cracks = hp <= 1 ? 5 : 3;
    for (let i = 0; i < cracks; i++) {
      const a = i * (Math.PI * 2 / cracks) + 0.3;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); ctx.stroke();
    }
  }

  _chain(r) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(60,60,70,0.85)'; ctx.lineWidth = r * 0.16;
    ctx.beginPath(); ctx.moveTo(-r, -r * 0.15); ctx.lineTo(r, r * 0.15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.15, -r); ctx.lineTo(r * 0.15, r); ctx.stroke();
    ctx.strokeStyle = 'rgba(180,180,190,0.9)'; ctx.lineWidth = r * 0.09;
    ctx.beginPath(); ctx.moveTo(-r, -r * 0.15); ctx.lineTo(r, r * 0.15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.15, -r); ctx.lineTo(r * 0.15, r); ctx.stroke();
  }

  _specialGlyph(special, r) {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = r * 0.08;
    const s = r * 0.5;
    if (special === 'bomb') {
      ctx.beginPath(); ctx.arc(0, r * 0.1, s * 0.8, 0, Math.PI * 2); ctx.fillStyle = 'rgba(30,30,40,0.9)'; ctx.fill();
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = r * 0.1;
      ctx.beginPath(); ctx.moveTo(s * 0.3, -s * 0.5); ctx.quadraticCurveTo(s * 0.9, -s * 0.9, s * 0.6, -s * 1.1); ctx.stroke();
      ctx.fillStyle = '#ffefb0'; ctx.beginPath(); ctx.arc(s * 0.6, -s * 1.1, r * 0.09, 0, Math.PI * 2); ctx.fill();
    } else if (special === 'rocket') {
      ctx.save(); ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.5, s * 0.2); ctx.lineTo(0, -s * 0.05);
      ctx.lineTo(-s * 0.5, s * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff8a3d';
      ctx.beginPath(); ctx.moveTo(-s*0.22, s*0.2); ctx.lineTo(0, s*0.8); ctx.lineTo(s*0.22, s*0.2); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (special === 'lightning') {
      ctx.fillStyle = '#fff2a8';
      ctx.beginPath();
      ctx.moveTo(s*0.15,-s); ctx.lineTo(-s*0.4,s*0.15); ctx.lineTo(-s*0.02,s*0.15);
      ctx.lineTo(-s*0.2,s); ctx.lineTo(s*0.5,-s*0.2); ctx.lineTo(s*0.08,-s*0.2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (special === 'fire') {
      ctx.fillStyle = '#ff7a2d';
      ctx.beginPath();
      ctx.moveTo(0, s); ctx.quadraticCurveTo(-s*0.8, s*0.2, -s*0.2, -s*0.4);
      ctx.quadraticCurveTo(0, -s*0.1, s*0.15, -s);
      ctx.quadraticCurveTo(s*0.9, -s*0.1, s*0.5, s*0.4);
      ctx.quadraticCurveTo(s*0.7, s*0.7, 0, s); ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.moveTo(0, s*0.7); ctx.quadraticCurveTo(-s*0.3, s*0.1, 0, -s*0.3);
      ctx.quadraticCurveTo(s*0.35, s*0.1, 0, s*0.7); ctx.fill();
    } else if (special === 'rainbow') {
      const cols = ['#ff5d6c','#ffcf3f','#4fd267','#41a6ff','#b06cff'];
      for (let i = 0; i < cols.length; i++) {
        ctx.strokeStyle = cols[i]; ctx.lineWidth = r * 0.11;
        ctx.beginPath(); ctx.arc(0, r*0.2, s * (0.9 - i*0.14), Math.PI, 0); ctx.stroke();
      }
    }
    ctx.restore();
  }
}
