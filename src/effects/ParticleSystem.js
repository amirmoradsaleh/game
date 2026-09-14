/* =========================================================================
 * ParticleSystem — juicy feedback with a reuse pool (no per-frame GC churn).
 *
 * Dead particles are recycled through a free-list instead of being discarded,
 * and the active array uses swap-remove (O(1)) instead of splice. Emitters:
 * shard bursts, sparkles, glow rings, trails and floating score text.
 * ========================================================================= */
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.pool = [];
    this.maxActive = 420; // hard cap protects mid-range devices
  }

  _spawn(props) {
    if (this.particles.length >= this.maxActive) return null;
    const p = this.pool.pop() || {};
    // reset transient text fields that not every kind sets
    p.text = null;
    Object.assign(p, props);
    this.particles.push(p);
    return p;
  }

  // Colourful shard burst when a bubble pops.
  burst(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const a = Utils.rand(0, Math.PI * 2);
      const spd = Utils.rand(90, 260);
      this._spawn({
        kind: 'shard', x, y,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 60,
        life: 1, ttl: Utils.rand(0.4, 0.7),
        size: Utils.rand(3, 7), color, rot: Utils.rand(0, 6.28), vr: Utils.rand(-8, 8),
      });
    }
    this.glowRing(x, y, color);
  }

  // Star sparkles (twinkle, no gravity).
  sparkle(x, y, count = 6, color = '#ffffff') {
    for (let i = 0; i < count; i++) {
      const a = Utils.rand(0, Math.PI * 2);
      const spd = Utils.rand(30, 130);
      this._spawn({
        kind: 'spark', x, y,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life: 1, ttl: Utils.rand(0.35, 0.6),
        size: Utils.rand(2, 5), color,
      });
    }
  }

  glowRing(x, y, color) {
    this._spawn({ kind: 'ring', x, y, life: 1, ttl: 0.35, r0: 6, r1: 46, color });
  }

  // Big explosion feedback for bomb / rocket / lightning.
  explosion(x, y, color = '#ffd23f') {
    this.burst(x, y, color, 22);
    this.sparkle(x, y, 14, '#ffffff');
    this._spawn({ kind: 'ring', x, y, life: 1, ttl: 0.45, r0: 10, r1: 90, color });
  }

  trail(x, y, color) {
    this._spawn({ kind: 'trail', x, y, life: 1, ttl: 0.25, size: Utils.rand(6, 10), color });
  }

  // Floating score / combo text that rises and fades.
  floatText(x, y, text, color = '#ffffff', size = 22) {
    this._spawn({ kind: 'text', x, y, vy: -46, life: 1, ttl: 0.9, text, color, size });
  }

  // Water-splash droplets that arc up and fall.
  splash(x, y, count = 6, color = '#bfe8ff') {
    for (let i = 0; i < count; i++) {
      const a = Utils.rand(-Math.PI * 0.85, -Math.PI * 0.15);
      const spd = Utils.rand(80, 220);
      this._spawn({ kind: 'drop', x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 1, ttl: Utils.rand(0.4, 0.7), size: Utils.rand(2, 4), color });
    }
  }

  // Tiny bubbles that rise and wobble (pop feedback + ambient life).
  bubbles(x, y, count = 5, color = 'rgba(210,240,255,0.8)') {
    for (let i = 0; i < count; i++) {
      this._spawn({ kind: 'bub', x: x + Utils.rand(-10, 10), y, vx: Utils.rand(-18, 18), vy: Utils.rand(-70, -30), life: 1, ttl: Utils.rand(0.6, 1.1), size: Utils.rand(2, 5), color, phase: Utils.rand(0, 6.28) });
    }
  }

  // Soft additive glow flash.
  softFlash(x, y, color = 'rgba(255,240,190,0.9)', r = 60) {
    this._spawn({ kind: 'flash', x, y, life: 1, ttl: 0.3, r0: r * 0.35, r1: r, color });
  }

  update(dt) {
    const g = 620;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt / p.ttl;
      if (p.life <= 0) {
        // swap-remove + recycle
        const last = this.particles.pop();
        if (i < this.particles.length) this.particles[i] = last;
        this.pool.push(p);
        continue;
      }
      if (p.kind === 'shard') {
        p.vy += g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      } else if (p.kind === 'spark') {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92;
      } else if (p.kind === 'text') {
        p.y += p.vy * dt; p.vy *= 0.92;
      } else if (p.kind === 'drop') {
        p.vy += g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      } else if (p.kind === 'bub') {
        p.phase += dt * 6; p.y += p.vy * dt; p.x += p.vx * dt + Math.sin(p.phase) * 12 * dt; p.vy *= 0.985;
      }
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      const a = Utils.clamp(p.life, 0, 1);
      ctx.save();
      if (p.kind === 'shard') {
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.roundRect(-p.size / 2, -p.size / 2, p.size, p.size, 2);
        ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        this._star(ctx, p.size);
      } else if (p.kind === 'ring') {
        const r = Utils.lerp(p.r0, p.r1, 1 - a);
        ctx.globalAlpha = a * 0.6;
        ctx.strokeStyle = p.color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
      } else if (p.kind === 'trail') {
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'drop') {
        ctx.globalAlpha = a * 0.85; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'bub') {
        ctx.globalAlpha = a * 0.6; ctx.strokeStyle = p.color; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = a * 0.25; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.35, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'flash') {
        const rr = Utils.lerp(p.r0, p.r1, 1 - a);
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
        grd.addColorStop(0, p.color); grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = a * 0.55; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'text') {
        const pop = 1 + (1 - a) * 0.4;
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y); ctx.scale(pop, pop);
        ctx.font = `900 ${p.size}px Nunito, system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(40,10,60,0.55)';
        ctx.strokeText(p.text, 0, 0);
        ctx.fillStyle = p.color; ctx.fillText(p.text, 0, 0);
      }
      ctx.restore();
    }
  }

  _star(ctx, s) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
      const a2 = a + Math.PI / 5;
      ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
      ctx.lineTo(Math.cos(a2) * s * 0.45, Math.sin(a2) * s * 0.45);
    }
    ctx.closePath(); ctx.fill();
  }
}
