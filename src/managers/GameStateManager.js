/* =========================================================================
 * ObjectiveTracker — data-driven goals. Counts cleared bubbles by colour and
 * destroyed crystals. Reports progress for the HUD and win check.
 * ========================================================================= */
class ObjectiveTracker {
  constructor(objectives) {
    this.items = objectives.map(o => ({ ...o, done: 0 }));
  }
  record(bubble) {
    for (const it of this.items) {
      if (it.type === 'color' && bubble.color === it.color) it.done = Math.min(it.target, it.done + 1);
      if (it.type === 'crystal' && bubble.isCrystal()) it.done = Math.min(it.target, it.done + 1);
    }
  }
  isComplete() { return this.items.every(it => it.done >= it.target); }
}

/* =========================================================================
 * GameStateManager — finite states + overlay routing.
 * ========================================================================= */
const GameState = { MENU: 'menu', MAP: 'map', LOADING: 'loading', PLAYING: 'playing', PAUSED: 'paused', WON: 'won', LOST: 'lost' };

class GameStateManager {
  constructor(onChange) { this.state = GameState.LOADING; this.onChange = onChange; }
  set(s) { this.state = s; if (this.onChange) this.onChange(s); }
  is(s) { return this.state === s; }
}
