/**
 * PunchReachSystem.ts
 *
 * Replaces single-frame hit evaluation with a physically travelling fist hitbox.
 *
 * Each punch type has a defined REACH (normalised 0-1 → pixel range).
 * During animation the virtual fist position is computed from progress,
 * and a collision AABB is tested against the defender's body hitbox.
 *
 * Reach values (in pixels at 1× fighter scale):
 *   Jab:      220px  (longest – straight arm extension)
 *   Hook:     180px  (slightly shorter – bent arm)
 *   Uppercut: 150px  (shortest – close-range rising blow)
 */

import { Boxer, AttackType } from '@/types/game';
import { COMBAT_ARENA } from './CombatRangeManager';

export interface FistHitbox {
  x: number;   // centre
  y: number;
  r: number;   // radius
  extension: number;
  type: AttackType;
}

export interface BodyHitbox {
  head:  { x: number; y: number; r: number };
  torso: { x: number; y: number; w: number; h: number };
  arms:  { x: number; y: number; w: number; h: number }[];
}

export interface CollisionResult {
  hit: boolean;
  target: 'head' | 'torso' | 'arm' | null;
  penetration: number;
}

// ─── Punch definitions ────────────────────────────────────────────────────────
// Normalized requested reach. Pixel reach is derived from fighter width so
// screen scale and combat distance stay physically coherent.
export const PUNCH_REACH: Record<AttackType, number> = {
  jab:      1.0,
  hook:     0.9,
  uppercut: 0.8,
};

const BASE_REACH_PX = COMBAT_ARENA.FIGHTER_WIDTH * 1.36;

// How far through the animation the fist is fully extended (0–1)
export const PUNCH_PEAK_PROGRESS: Record<AttackType, number> = {
  jab:      0.45,
  hook:     0.50,
  uppercut: 0.45,
};

export class PunchReachSystem {
  /**
   * Calculate where the attacker's virtual fist centre is right now, in
   * canvas-space (800×450).
   */
  public static getFistPosition(
    attacker: Boxer,
    attackType: AttackType,
    progress: number,
    canvasW: number,
    canvasH: number,
    attackerScreenX: number,
    attackerScreenY: number
  ): FistHitbox {
    // Normalised reach: rises to 1 at peak, then retracts.
    const peakAt = PUNCH_PEAK_PROGRESS[attackType];
    const rawT = progress <= peakAt
      ? progress / peakAt                  // 0 → 1 extending
      : 1 - (progress - peakAt) / (1 - peakAt); // 1 → 0 retracting
    const t = easeOutCubic(clamp(rawT, 0, 1));

    const reach = BASE_REACH_PX * PUNCH_REACH[attackType] * t;
    const isPlayer = attacker.id === 'player';
    const dir = isPlayer ? 1 : -1;

    const guardX = attackerScreenX + dir * 34;
    const guardY = attackerScreenY - 6;
    let x = guardX;
    let y = guardY;

    if (attackType === 'jab') {
      // Straight forward extension toward the opponent's center line.
      x = guardX + dir * reach;
      y = guardY - reach * 0.08;
    } else if (attackType === 'hook') {
      // Horizontal arc: starts outside, cuts across the target line, then retracts.
      const arc = Math.sin(t * Math.PI);
      x = guardX + dir * (reach * 0.72 + arc * 34);
      y = guardY - 18 - arc * 18;
    } else {
      // Shorter rising blow: less forward travel, more vertical lift.
      x = guardX + dir * reach * 0.66;
      y = guardY + 24 - reach * 0.92;
    }

    return {
      x,
      y,
      r: 18 + t * 7,
      extension: t,
      type: attackType,
    };
  }

  /**
   * Build the body hitbox for a fighter in canvas-space.
   * `bodyScreenX` and `bodyScreenY` are the base (hip) position on screen.
   */
  public static getBodyHitbox(
    fighter: Boxer,
    bodyScreenX: number,
    bodyScreenY: number,
    scale: number
  ): BodyHitbox {
    const headR   = 25 * scale;
    const headY   = bodyScreenY - 108 * scale;
    const torsoW  = 76 * scale;
    const torsoH  = 66 * scale;
    const torsoY  = bodyScreenY - 78 * scale;

    return {
      head:  { x: bodyScreenX, y: headY,  r: headR },
      torso: {
        x: bodyScreenX - torsoW / 2,
        y: torsoY,
        w: torsoW,
        h: torsoH,
      },
      arms: [
        {
          x: bodyScreenX - 60 * scale,
          y: bodyScreenY - 90 * scale,
          w: 28 * scale,
          h: 60 * scale,
        },
        {
          x: bodyScreenX + 32 * scale,
          y: bodyScreenY - 90 * scale,
          w: 28 * scale,
          h: 60 * scale,
        },
      ],
    };
  }

  /**
   * Tests whether the attacker's virtual fist collides with ANY part of
   * the defender's body hitbox.
   */
  public static checkFistCollision(
    fist: FistHitbox,
    body: BodyHitbox
  ): boolean {
    return this.getCollision(fist, body).hit;
  }

  public static getCollision(
    fist: FistHitbox,
    body: BodyHitbox
  ): CollisionResult {
    // Circle vs circle (head)
    const headDist = Math.hypot(fist.x - body.head.x, fist.y - body.head.y);
    const headPen = fist.r + body.head.r - headDist;
    if (headPen > 0) return { hit: true, target: 'head', penetration: headPen };

    // Circle vs AABB (torso)
    const torsoPen = this.circleAABBPenetration(fist, body.torso);
    if (torsoPen > 0) return { hit: true, target: 'torso', penetration: torsoPen };

    // Circle vs AABB (each arm)
    for (const arm of body.arms) {
      const armPen = this.circleAABBPenetration(fist, arm);
      if (armPen > 0) return { hit: true, target: 'arm', penetration: armPen };
    }

    return { hit: false, target: null, penetration: 0 };
  }

  private static circleAABB(
    circle: FistHitbox,
    rect: { x: number; y: number; w: number; h: number }
  ): boolean {
    return this.circleAABBPenetration(circle, rect) > 0;
  }

  private static circleAABBPenetration(
    circle: FistHitbox,
    rect: { x: number; y: number; w: number; h: number }
  ): number {
    const nearX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
    const nearY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
    const dist  = Math.hypot(circle.x - nearX, circle.y - nearY);
    return circle.r - dist;
  }

  /**
   * Draw debug hitboxes (call only when ?debug=1 is in URL)
   */
  public static drawDebug(
    ctx: CanvasRenderingContext2D,
    fist: FistHitbox | null,
    body: BodyHitbox,
    colliding: boolean,
    distance: number,
    punchType: AttackType | null,
    confidence: number
  ) {
    ctx.save();

    const hitColor  = colliding ? 'rgba(255,50,50,0.7)'  : 'rgba(50,255,100,0.35)';
    const fistColor = colliding ? 'rgba(255,80,0,0.9)'   : 'rgba(255,220,0,0.6)';

    // Head hitbox
    ctx.beginPath();
    ctx.arc(body.head.x, body.head.y, body.head.r, 0, Math.PI * 2);
    ctx.strokeStyle = hitColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Torso hitbox
    ctx.strokeRect(body.torso.x, body.torso.y, body.torso.w, body.torso.h);

    // Arm hitboxes
    for (const arm of body.arms) {
      ctx.strokeRect(arm.x, arm.y, arm.w, arm.h);
    }

    // Fist hitbox
    if (fist) {
      ctx.beginPath();
      ctx.arc(fist.x, fist.y, fist.r, 0, Math.PI * 2);
      ctx.strokeStyle = fistColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // HUD info
    ctx.fillStyle = '#45f3ff';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`Dist: ${Math.round(distance)}px`, 10, 440);
    ctx.fillText(`Punch: ${punchType ?? '-'}`, 10, 425);
    ctx.fillText(`Conf: ${(confidence * 100).toFixed(0)}%`, 10, 410);
    if (colliding) {
      ctx.fillStyle = '#ff4444';
      ctx.fillText('HIT!', 10, 395);
    }

    ctx.restore();
  }

  public static drawDebugScene(
    ctx: CanvasRenderingContext2D,
    playerBody: BodyHitbox | null,
    opponentBody: BodyHitbox | null,
    playerFist: FistHitbox | null,
    opponentFist: FistHitbox | null,
    playerCollision: boolean,
    opponentCollision: boolean,
    distance: number,
    punchType: AttackType | null,
    confidence: number
  ) {
    ctx.save();
    if (playerBody) this.drawBody(ctx, playerBody, opponentCollision ? '#ff5b5b' : '#45f3ff');
    if (opponentBody) this.drawBody(ctx, opponentBody, playerCollision ? '#ff5b5b' : '#35ff82');
    if (playerFist) this.drawFist(ctx, playerFist, playerCollision ? '#ffcc00' : '#45f3ff');
    if (opponentFist) this.drawFist(ctx, opponentFist, opponentCollision ? '#ffcc00' : '#ff007f');

    ctx.fillStyle = 'rgba(0,0,0,0.68)';
    ctx.fillRect(10, 328, 210, 104);
    ctx.fillStyle = '#dffcff';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`Collision: ${playerCollision || opponentCollision ? 'YES' : 'NO'}`, 20, 350);
    ctx.fillText(`Distance: ${Math.round(distance)}px`, 20, 368);
    ctx.fillText(`Punch: ${punchType ?? '-'}`, 20, 386);
    ctx.fillText(`Confidence: ${(confidence * 100).toFixed(0)}%`, 20, 404);
    ctx.fillText(`Reach: jab 1.0 hook .9 upper .8`, 20, 422);
    ctx.restore();
  }

  private static drawBody(ctx: CanvasRenderingContext2D, body: BodyHitbox, color: string) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(body.head.x, body.head.y, body.head.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeRect(body.torso.x, body.torso.y, body.torso.w, body.torso.h);
    for (const arm of body.arms) ctx.strokeRect(arm.x, arm.y, arm.w, arm.h);
    ctx.restore();
  }

  private static drawFist(ctx: CanvasRenderingContext2D, fist: FistHitbox, color: string) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color + '33';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(fist.x, fist.y, fist.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
