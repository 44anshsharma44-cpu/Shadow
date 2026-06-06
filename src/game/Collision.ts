import { Boxer, AttackType, AttackStats } from '@/types/game';
import { COMBAT_CONFIG } from './CombatSystem';

export class CollisionSystem {
  /**
   * Checks if an attack landed on the defender based on range.
   * Ducking and blocking states are processed separately in the applyHit store action.
   */
  public static checkHit(
    attacker: Boxer,
    defender: Boxer,
    attackType: AttackType
  ): boolean {
    const config: AttackStats = COMBAT_CONFIG[attackType];
    const distance = Math.abs(attacker.x - defender.x);

    // If the defender is too far away, the punch misses
    if (distance > config.range) {
      return false;
    }

    // Hit connects if within range
    return true;
  }
}

export default CollisionSystem;
