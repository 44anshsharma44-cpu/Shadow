/**
 * CombatRangeManager.ts
 *
 * Controls fighter spacing to keep them in realistic sparring range.
 *
 * Layout (800×450 canvas):
 *   Player  X home = 42% → 336px
 *   Opponent X home = 58% → 464px
 *   Ideal gap       = 128px   (~1.5 fighter widths of ~85px each)
 *   Min gap         = 60px    (collision hard stop)
 *   Max gap         = 200px   (beyond this opponent advances)
 *
 * The key difference from the old CombatDistanceManager:
 *  - Opponent never "rests" at the back ropes (old 65% = 520px)
 *  - Opponent home is 58% = 464px – very close to center
 *  - Screen-space projection squashes the gap further so they appear
 *    within arm's reach at all times
 */

import { Boxer, AttackType } from '@/types/game';

const CANVAS_W = 800;
const CANVAS_H = 450;

export const COMBAT_ARENA = {
  // Fighter home positions
  PLAYER_HOME_X:   CANVAS_W * 0.42,   // 336
  OPPONENT_HOME_X: CANVAS_W * 0.58,   // 464

  // Gap management (pixels between fighter centres). One fighter is treated
  // as 86px wide, so ideal range is 1.5 widths and max range is 2 widths.
  FIGHTER_WIDTH: 86,
  IDEAL_GAP: 129,
  MIN_GAP:    82,
  MAX_GAP:   172,

  // Arena walls
  LEFT_WALL:   70,
  RIGHT_WALL:  CANVAS_W - 70,

  // Vertical placement: both fighters' hip Y (base point)
  PLAYER_HIP_Y:   CANVAS_H * 0.80,   // 360
  OPPONENT_HIP_Y: CANVAS_H * 0.78,   // 351  (very shallow depth illusion)

  // Attack ranges (pixel distance between fighter centres)
  REACH: {
    jab:      168,
    hook:     150,
    uppercut: 132,
  },

  // Screen-space projection constants
  // Maps internal X position to canvas X with minimal spread
  SCREEN_CENTER:   CANVAS_W / 2,     // 400
  SCREEN_SPREAD:   0.48,             // how much lateral drift is shown
};

export class CombatRangeManager {
  /**
   * Called every game tick. Updates targetX to enforce ideal sparring gap.
   */
  public static update(player: Boxer, opponent: Boxer, dtMs: number): void {
    const gap = opponent.x - player.x;

    const desiredOpponentX = player.x + COMBAT_ARENA.IDEAL_GAP;

    // ── Opponent too far away → step forward aggressively ──────────────────
    if (gap > COMBAT_ARENA.MAX_GAP) {
      const pull = (gap - COMBAT_ARENA.IDEAL_GAP) * 0.11 * (dtMs / 16);
      opponent.targetX = Math.max(desiredOpponentX, opponent.x - Math.min(pull, 46));
    } else if (gap > COMBAT_ARENA.IDEAL_GAP + 10) {
      opponent.targetX += (desiredOpponentX - opponent.targetX) * 0.018 * dtMs;
    }

    // ── Overlap → push apart ───────────────────────────────────────────────
    if (gap < COMBAT_ARENA.MIN_GAP) {
      const overlap = (COMBAT_ARENA.MIN_GAP - gap) / 2;
      player.targetX   = Math.max(COMBAT_ARENA.LEFT_WALL,  player.x   - overlap);
      opponent.targetX = Math.min(COMBAT_ARENA.RIGHT_WALL, opponent.x + overlap);
    }

    // ── Idle drift back toward home ────────────────────────────────────────
    if (opponent.state === 'IDLE' || opponent.state === 'BLOCKING') {
      const homeWeighted = COMBAT_ARENA.OPPONENT_HOME_X * 0.35 + desiredOpponentX * 0.65;
      opponent.targetX += (homeWeighted - opponent.targetX) * 0.0045 * dtMs;
    }

    // ── Hard clamps ────────────────────────────────────────────────────────
    player.x   = clamp(player.x,   COMBAT_ARENA.LEFT_WALL,  COMBAT_ARENA.RIGHT_WALL);
    opponent.x = clamp(opponent.x, COMBAT_ARENA.LEFT_WALL,  COMBAT_ARENA.RIGHT_WALL);
    player.targetX   = clamp(player.targetX,   COMBAT_ARENA.LEFT_WALL,  COMBAT_ARENA.RIGHT_WALL);
    opponent.targetX = clamp(opponent.targetX, COMBAT_ARENA.LEFT_WALL,  COMBAT_ARENA.RIGHT_WALL);
  }

  /** Whether attacker can reach defender with given punch type */
  public static inReach(attacker: Boxer, defender: Boxer, type: AttackType): boolean {
    return Math.abs(attacker.x - defender.x) <= COMBAT_ARENA.REACH[type];
  }

  /**
   * Project a fighter's internal X position → canvas screen X.
   * Keeps both fighters visually near center even when they drift.
   */
  /**
   * Opponent screen X – always clamped near center-right of canvas.
   * At neutral spacing this is exactly 58% of the canvas.
   */
  public static opponentScreenX(opponent: Boxer, canvasW: number): number {
    const raw = canvasW * 0.58 + (opponent.x - COMBAT_ARENA.OPPONENT_HOME_X) * COMBAT_ARENA.SCREEN_SPREAD;
    return clamp(raw, canvasW * 0.52, canvasW * 0.64);
  }

  /**
   * Player screen X – always clamped near center-left of canvas.
   * At neutral spacing this is exactly 42% of the canvas.
   */
  public static playerScreenX(player: Boxer, canvasW: number): number {
    const raw = canvasW * 0.42 + (player.x - COMBAT_ARENA.PLAYER_HOME_X) * COMBAT_ARENA.SCREEN_SPREAD;
    return clamp(raw, canvasW * 0.36, canvasW * 0.48);
  }

  /**
   * Opponent vertical base (hip Y) on screen.
   * Slightly higher than player to create mild depth perspective.
   */
  public static opponentScreenY(opponent: Boxer, player: Boxer, canvasH: number): number {
    // Gap-based depth: smaller gap = opponent slightly higher (closer)
    const gap    = Math.abs(opponent.x - player.x);
    const depth  = (gap - COMBAT_ARENA.IDEAL_GAP) / (COMBAT_ARENA.MAX_GAP - COMBAT_ARENA.MIN_GAP);
    const depthY = COMBAT_ARENA.OPPONENT_HIP_Y + depth * 7;
    return clamp(depthY, canvasH * 0.755, canvasH * 0.805);
  }

  /**
   * Scale factor for opponent rendering.
   * Kept very close to 1.0 so opponent never appears tiny.
   * Range: 0.95 (max gap) → 1.05 (min gap)
   */
  public static opponentScale(opponent: Boxer, player: Boxer): number {
    const gap     = Math.abs(opponent.x - player.x);
    const norm    = (gap - COMBAT_ARENA.MIN_GAP) / (COMBAT_ARENA.MAX_GAP - COMBAT_ARENA.MIN_GAP);
    return clamp(1.05 - norm * 0.10, 0.95, 1.05);
  }

  /** Pixel distance between fighter centres */
  public static distance(a: Boxer, b: Boxer): number {
    return Math.abs(a.x - b.x);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
