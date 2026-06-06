import { Boxer } from '@/types/game';
import { COMBAT_ARENA } from './CombatRangeManager';

export class PhysicsSystem {
  /**
   * Updates coordinates towards their targets using linear interpolation.
   * Keeps fighters within arena boundaries and prevents them from overlapping.
   */
  public static updatePositions(player: Boxer, opponent: Boxer, dtMs: number) {
    const lerpSpeed = 0.007; // movement speed dampening

    // Lerp coordinate x to targetX
    player.x += (player.targetX - player.x) * lerpSpeed * dtMs;
    opponent.x += (opponent.targetX - opponent.x) * lerpSpeed * dtMs;

    player.x = Math.max(COMBAT_ARENA.LEFT_WALL, Math.min(player.x, COMBAT_ARENA.RIGHT_WALL));
    opponent.x = Math.max(COMBAT_ARENA.LEFT_WALL, Math.min(opponent.x, COMBAT_ARENA.RIGHT_WALL));

    // Collision boundary: Prevent overlaps.
    const minDistance = COMBAT_ARENA.MIN_GAP;
    if (opponent.x - player.x < minDistance) {
      const midpoint = (player.x + opponent.x) / 2;
      player.x = midpoint - minDistance / 2;
      opponent.x = midpoint + minDistance / 2;

      // Push back targets to prevent sticking
      player.targetX = Math.max(COMBAT_ARENA.LEFT_WALL, player.x);
      opponent.targetX = Math.min(COMBAT_ARENA.RIGHT_WALL, opponent.x);
    }
  }

  /**
   * Pushes a boxer backwards when struck by a punch.
   */
  public static applyKnockback(defender: Boxer, force: number) {
    if (defender.id === 'player') {
      // Push player left
      defender.targetX = Math.max(COMBAT_ARENA.LEFT_WALL, defender.x - force);
    } else {
      // Push opponent right
      defender.targetX = Math.min(COMBAT_ARENA.RIGHT_WALL, defender.x + force);
    }
  }

  /**
   * Steps a boxer forward during their punch swing.
   */
  public static applyLunge(attacker: Boxer, force: number) {
    if (attacker.id === 'player') {
      // Lunge player right
      attacker.targetX = Math.min(COMBAT_ARENA.RIGHT_WALL, attacker.x + force);
    } else {
      // Lunge opponent left
      attacker.targetX = Math.max(COMBAT_ARENA.LEFT_WALL, attacker.x - force);
    }
  }
}

export default PhysicsSystem;
