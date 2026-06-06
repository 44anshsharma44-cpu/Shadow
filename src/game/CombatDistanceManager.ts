/**
 * CombatDistanceManager.ts
 *
 * Manages ideal fighting distance between player and opponent.
 * - Ideal gap = 1.5 × fighter width (≈ 120px)
 * - If fighters are too far: opponent steps forward
 * - If fighters overlap: they are pushed apart
 * - Player X is anchored at ~35% of canvas (280px / 800px)
 * - Opponent X is anchored at ~65% of canvas (520px / 800px)
 */

import { Boxer } from '@/types/game';

const CANVAS_WIDTH = 800;

// Preferred X positions (pixels in the 800×450 canvas)
export const ARENA = {
  PLAYER_HOME_X: CANVAS_WIDTH * 0.35,   // 280
  OPPONENT_HOME_X: CANVAS_WIDTH * 0.65, // 520
  IDEAL_GAP: 120,      // ~1.5 × fighter body width
  MIN_GAP: 70,         // collision boundary
  MAX_GAP: 260,        // if wider, opponent closes in
  LEFT_WALL: 80,
  RIGHT_WALL: CANVAS_WIDTH - 80,
};

export class CombatDistanceManager {
  /**
   * Call this every game tick to update opponent targetX and enforce spacing.
   * Returns the computed ideal opponent X for this frame.
   */
  public static update(
    player: Boxer,
    opponent: Boxer,
    dtMs: number
  ): void {
    const distance = opponent.x - player.x;

    // 1. If fighters are too far apart → opponent advances
    if (distance > ARENA.MAX_GAP) {
      const step = Math.min(30, (distance - ARENA.IDEAL_GAP) * 0.04 * dtMs);
      opponent.targetX = Math.max(
        player.x + ARENA.IDEAL_GAP,
        opponent.x - step
      );
    }

    // 2. If fighters overlap → push them apart
    if (distance < ARENA.MIN_GAP) {
      const overlap = ARENA.MIN_GAP - distance;
      const half = overlap / 2;
      player.targetX = Math.max(ARENA.LEFT_WALL, player.x - half);
      opponent.targetX = Math.min(ARENA.RIGHT_WALL, opponent.x + half);
    }

    // 3. Keep opponent within soft home range – drift back towards 65% X when idle
    if (
      opponent.state === 'IDLE' &&
      Math.abs(opponent.x - ARENA.OPPONENT_HOME_X) > 60
    ) {
      const drift = (ARENA.OPPONENT_HOME_X - opponent.x) * 0.001 * dtMs;
      opponent.targetX += drift;
    }

    // 4. Hard clamp to arena walls
    player.x = Math.max(ARENA.LEFT_WALL, Math.min(player.x, ARENA.RIGHT_WALL));
    opponent.x = Math.max(ARENA.LEFT_WALL, Math.min(opponent.x, ARENA.RIGHT_WALL));
    player.targetX = Math.max(ARENA.LEFT_WALL, Math.min(player.targetX, ARENA.RIGHT_WALL));
    opponent.targetX = Math.max(ARENA.LEFT_WALL, Math.min(opponent.targetX, ARENA.RIGHT_WALL));
  }

  /** Returns whether the fighters are within striking range for a given attack type */
  public static inRange(
    player: Boxer,
    opponent: Boxer,
    attackType: 'jab' | 'hook' | 'uppercut'
  ): boolean {
    const dist = Math.abs(opponent.x - player.x);
    const ranges = { jab: 200, hook: 160, uppercut: 130 };
    return dist <= ranges[attackType];
  }

  /** Returns the opponent's X mapped to screen POV space */
  public static opponentScreenX(opponent: Boxer, canvasW: number): number {
    // Map opponent.x (280–520px arena range) to screen center (400px ± spread)
    const center = canvasW / 2;
    const arenaCenter = (ARENA.PLAYER_HOME_X + ARENA.OPPONENT_HOME_X) / 2;
    const spread = 0.65; // reduces lateral drift at screen level
    return center + (opponent.x - arenaCenter) * spread;
  }
}
