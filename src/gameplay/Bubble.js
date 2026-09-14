/* =========================================================================
 * Bubble — data model for a single cell occupant. Colour + optional special
 * effect tag + optional obstacle shell. Carries transient anim state.
 * ========================================================================= */
class Bubble {
  constructor({ color, special = 'none', shell = 'none', hp = 1 }) {
    this.color = color || '';        // '' means colourless (crystal)
    this.special = special;          // GameConfig.SPECIAL.*
    this.shell = shell;              // GameConfig.SHELL.*
    this.hp = hp;                    // for shells: cracks remaining
    // grid position
    this.row = -1; this.col = -1;
    // pixel position (also used while flying / falling)
    this.x = 0; this.y = 0;
    // animation
    this.spawnT = 0;                 // 0..1 pop-in scale
    this.popping = false;            // being cleared this frame
    this.popT = 0;                   // 0..1 pop-out progress
    this.falling = false;            // detached, physics-driven
    this.vy = 0;
    this.wobble = 0;                 // gentle idle wobble phase
    this.land = 0;                   // 0..1 landing squash-and-stretch impulse
  }

  isCrystal() { return this.shell === 'crystal'; }
  isBlocking() { return this.shell === 'crystal'; } // no colour match
  hasShell() { return this.shell === 'ice' || this.shell === 'chain'; }
  isSpecial() { return this.special !== 'none'; }

  // Whether this bubble can colour-match with `other`.
  matchesColor(other) {
    if (this.isBlocking() || other.isBlocking()) return false;
    if (this.special === 'rainbow' || other.special === 'rainbow') return true;
    return this.color && this.color === other.color;
  }
}
