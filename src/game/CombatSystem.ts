import { CombatConfig } from '@/types/game';

export const COMBAT_CONFIG: CombatConfig = {
  jab: {
    damage: 10,
    range: 168,      // long range, matches physical reach envelope
    speed: 200,      // fast execution (200ms)
    recovery: 150,   // quick recovery
  },
  hook: {
    damage: 20,
    range: 150,      // medium range
    speed: 350,      // medium execution (350ms)
    recovery: 250,   // medium recovery
  },
  uppercut: {
    damage: 30,
    range: 132,      // short range (must be close)
    speed: 500,      // slow execution (500ms)
    recovery: 350,   // long recovery
  },
};

export default COMBAT_CONFIG;
