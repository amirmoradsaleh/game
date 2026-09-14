/* =========================================================================
 * AbilityBar — the player's special-ball abilities (Bubble Witch style).
 *
 * Special balls are abilities, NOT obstacles and NOT queue items. Each level
 * grants a set of charges (e.g. Bomb ×2, Rainbow ×1). The player taps one to
 * equip it; the very next shot fires that special ball and one charge is
 * consumed. Tapping the equipped ability again un-equips it.
 *
 * Ability id -> internal SpecialEffects strategy:
 *   bomb     -> radial blast
 *   rainbow  -> colour wildcard
 *   laser    -> vertical beam (clears the column)
 *   fireball -> spreading burn
 *   rocket   -> clears the row
 * ========================================================================= */
const AbilityDefs = {
  bomb:     { special: 'bomb',      label: 'Bomb',     icon: '💣', color: '#ff5d6c' },
  rainbow:  { special: 'rainbow',   label: 'Rainbow',  icon: '🌈', color: '#b06cff' },
  laser:    { special: 'lightning', label: 'Lightning', icon: '⚡', color: '#ffcf3f' },
  fireball: { special: 'fire',      label: 'Fireball', icon: '🔥', color: '#ff8a3d' },
  rocket:   { special: 'rocket',    label: 'Rocket',   icon: '🚀', color: '#41a6ff' },
};

class AbilityBar {
  // abilities: { bomb: 2, rainbow: 0, ... } — 0-count slots are kept (they show a
  // "Watch Video +3" affordance) so unlocked specials never disappear.
  constructor(abilities) {
    this.slots = Object.keys(abilities || {})
      .filter(id => AbilityDefs[id])
      .map(id => ({ id, count: abilities[id] | 0, def: AbilityDefs[id] }));
    this.equipped = null; // id currently armed for the next shot
  }

  has(id) { const s = this.slots.find(s => s.id === id); return !!s && s.count > 0; }

  // Tap an ability: arm it, or toggle it off if already armed.
  toggle(id) {
    if (!this.has(id)) return false;
    this.equipped = this.equipped === id ? null : id;
    return true;
  }

  isEquipped(id) { return this.equipped === id; }

  // Consume the armed ability, returning its internal special id (or null).
  // Always un-equips after use: one special ball per tap.
  consume() {
    if (!this.equipped) return null;
    const slot = this.slots.find(s => s.id === this.equipped);
    this.equipped = null;
    if (!slot || slot.count <= 0) return null;
    slot.count -= 1;
    return slot.def.special;
  }

  clearEquip() { this.equipped = null; }
}
