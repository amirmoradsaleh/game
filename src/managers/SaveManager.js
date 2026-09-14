/* =========================================================================
 * SaveManager — persists level progression, stars and seen tutorials.
 *
 * Uses localStorage when available (real browser / Android WebView) and falls
 * back to in-memory storage otherwise, so it never throws. Shape:
 *   { unlocked: <highest unlocked level>, stars: { "<n>": 1..3 }, tutorials: {} }
 * ========================================================================= */
class SaveManager {
  constructor() {
    this.KEY = 'bql_save_v2';
    const d = this._read() || {};
    this.data = {
      unlocked: d.unlocked || 1,
      stars: d.stars || {},
      tutorials: d.tutorials || {},
      // persistent special-ball inventory — starts EMPTY; specials are granted
      // as they are unlocked across the campaign, and topped up by milestones.
      inventory: d.inventory || { bomb: 0, rainbow: 0, laser: 0, fireball: 0 },
      unlockedSpecials: d.unlockedSpecials || {},
      claimed: d.claimed || {}, // milestone rewards already granted
      mapCenter: d.mapCenter || null,   // last map position (centred level)
      mapLoaded: d.mapLoaded || 50,     // how many level batches are loaded
      currentLevel: d.currentLevel || 1,
    };
  }

  _read() {
    try {
      const s = (typeof localStorage !== 'undefined') && localStorage.getItem(this.KEY);
      return s ? JSON.parse(s) : null;
    } catch (e) { return null; }
  }

  _write() {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(this.KEY, JSON.stringify(this.data)); }
    catch (e) { /* in-memory only */ }
  }

  get unlocked() { return this.data.unlocked; }
  starsFor(n) { return this.data.stars[n] || 0; }
  isUnlocked(n) { return n <= this.data.unlocked; }
  isCompleted(n) { return !!this.data.stars[n]; }

  // last-viewed map position (centred level) + current level
  getMapCenter() { return this.data.mapCenter; }
  setMapCenter(level) { this.data.mapCenter = level; this._write(); }
  getMapLoaded() { return this.data.mapLoaded || 50; }
  setMapLoaded(n) { this.data.mapLoaded = n; this._write(); }
  get currentLevel() { return this.data.currentLevel; }
  setCurrentLevel(n) { this.data.currentLevel = n; this._write(); }

  // ---- persistent special inventory ------------------------------------
  get inventory() { return this.data.inventory; }
  useSpecial(id) {
    if (!this.data.inventory[id] || this.data.inventory[id] <= 0) return false;
    this.data.inventory[id] -= 1; this._write(); return true;
  }
  addSpecial(id, n) { this.data.inventory[id] = (this.data.inventory[id] || 0) + n; this._write(); }
  // Grant a special the first time it is unlocked (returns true if newly granted).
  unlockSpecial(id, amount) {
    if (this.data.unlockedSpecials[id]) return false;
    this.data.unlockedSpecials[id] = true;
    this.data.inventory[id] = (this.data.inventory[id] || 0) + amount;
    this._write();
    return true;
  }
  hasClaimed(n) { return !!this.data.claimed[n]; }
  markClaimed(n) { this.data.claimed[n] = true; this._write(); }

  // Record a level result; keeps the best star count and unlocks the next level.
  recordResult(n, stars) {
    stars = Math.max(1, Math.min(3, stars | 0));
    const prev = this.data.stars[n] || 0;
    if (stars > prev) this.data.stars[n] = stars;
    if (n >= this.data.unlocked) this.data.unlocked = Math.min(n + 1, LevelDatabase.COUNT);
    this._write();
  }

  hasSeenTutorial(key) { return !!this.data.tutorials[key]; }
  markTutorial(key) { this.data.tutorials[key] = true; this._write(); }

  reset() { this.data = { unlocked: 1, stars: {}, tutorials: {}, inventory: { bomb: 0, rainbow: 0, laser: 0, fireball: 0 }, unlockedSpecials: {}, claimed: {}, mapCenter: null, mapLoaded: 50, currentLevel: 1 }; this._write(); }
}
