/**
 * BodyToAvatarMapper.ts
 *
 * Maps live MediaPipe landmark positions to avatar fist/arm/torso positions
 * in canvas-space (800×450).
 *
 * Goals:
 *  - 1:1 motion feel (wrist moves → avatar fist moves proportionally)
 *  - Low-latency (no heavy smoothing on top of PoseFilter which already smooths)
 *  - No snapping – lerp output positions at ~0.5 per frame
 *  - Left webcam wrist → player's right-hand glove (mirror convention)
 *  - Right webcam wrist → player's left-hand glove
 */

import { LandmarkSet, Coordinate } from '@/types/pose';
import { COMBAT_ARENA } from '@/game/CombatRangeManager';

// ─── Canvas dimensions ────────────────────────────────────────────────────────
const CH = 450;

// Mapping reference: normalised webcam rect → canvas region where player
// gloves should appear (bottom-third of screen, spread horizontally)
const GLOVE_MAP = {
  // When webcam wrist is at centre (0.5, 0.5), glove appears here on canvas
  LEFT_BASE_X:  COMBAT_ARENA.PLAYER_HOME_X + 36,
  LEFT_BASE_Y:  COMBAT_ARENA.PLAYER_HIP_Y - 68,
  RIGHT_BASE_X: COMBAT_ARENA.PLAYER_HOME_X - 28,
  RIGHT_BASE_Y: COMBAT_ARENA.PLAYER_HIP_Y - 66,

  // How many canvas pixels per unit of normalised landmark movement
  SCALE_X: 360,
  SCALE_Y: 320,
  SCALE_Z: 210,
};

// Where the player's "neutral" wrist is in webcam normalised space
const WRIST_NEUTRAL = { x: 0.5, y: 0.58, z: 0 };

export interface AvatarPose {
  rightGlove: { x: number; y: number; scale: number; rotation: number };
  leftGlove:  { x: number; y: number; scale: number; rotation: number };
  torsoRotation: number;  // radians, positive = leaning right
  shoulderTilt:  number;  // radians
}

export class BodyToAvatarMapper {
  // Smoothed output positions (EMA at each call)
  private rightGloveX = GLOVE_MAP.RIGHT_BASE_X;
  private rightGloveY = GLOVE_MAP.RIGHT_BASE_Y;
  private leftGloveX  = GLOVE_MAP.LEFT_BASE_X;
  private leftGloveY  = GLOVE_MAP.LEFT_BASE_Y;
  private torsoRot    = 0;
  private shoulderT   = 0;
  private neutralReady = false;
  private neutral = {
    leftWrist: { ...WRIST_NEUTRAL },
    rightWrist: { ...WRIST_NEUTRAL },
    leftShoulder: { x: 0.42, y: 0.42, z: 0 },
    rightShoulder: { x: 0.58, y: 0.42, z: 0 },
  };

  private readonly ALPHA = 0.62;

  // Cache last computed pose so GameCanvas can read it without re-computing
  private _lastPose: AvatarPose = {
    rightGlove: { x: GLOVE_MAP.RIGHT_BASE_X, y: GLOVE_MAP.RIGHT_BASE_Y, scale: 1.0, rotation: 0 },
    leftGlove:  { x: GLOVE_MAP.LEFT_BASE_X,  y: GLOVE_MAP.LEFT_BASE_Y,  scale: 1.0, rotation: 0 },
    torsoRotation: 0,
    shoulderTilt:  0,
  };

  /** Returns the last computed pose (no re-computation) */
  public get lastPose(): AvatarPose { return this._lastPose; }


  public map(landmarks: LandmarkSet | null, isActive: boolean): AvatarPose {
    if (!landmarks || !isActive) {
      // Return last known pose (graceful fallback, no snap to defaults)
      return this._lastPose;
    }

    const lw = landmarks.leftWrist;
    const rw = landmarks.rightWrist;
    const ls = landmarks.leftShoulder;
    const rs = landmarks.rightShoulder;
    const le = landmarks.leftElbow;
    const re = landmarks.rightElbow;

    if (!this.neutralReady) {
      this.neutral = {
        leftWrist: { x: lw.x, y: lw.y, z: lw.z ?? 0 },
        rightWrist: { x: rw.x, y: rw.y, z: rw.z ?? 0 },
        leftShoulder: { x: ls.x, y: ls.y, z: ls.z ?? 0 },
        rightShoulder: { x: rs.x, y: rs.y, z: rs.z ?? 0 },
      };
      this.neutralReady = true;
    } else {
      this.neutral.leftWrist = smoothNeutral(this.neutral.leftWrist, lw, 0.018);
      this.neutral.rightWrist = smoothNeutral(this.neutral.rightWrist, rw, 0.018);
      this.neutral.leftShoulder = smoothNeutral(this.neutral.leftShoulder, ls, 0.012);
      this.neutral.rightShoulder = smoothNeutral(this.neutral.rightShoulder, rs, 0.012);
    }

    // ── Wrist → glove mapping ─────────────────────────────────────────────────
    // Webcam is mirrored: webcam-left = player's right (convention)
    // Delta from neutral position, scaled to canvas pixels

    const rwDeltaX = (rw.x - this.neutral.rightWrist.x) * GLOVE_MAP.SCALE_X;
    const rwDeltaY = (rw.y - this.neutral.rightWrist.y) * GLOVE_MAP.SCALE_Y;
    const lwDeltaX = (lw.x - this.neutral.leftWrist.x) * GLOVE_MAP.SCALE_X;
    const lwDeltaY = (lw.y - this.neutral.leftWrist.y) * GLOVE_MAP.SCALE_Y;

    // MediaPipe z is usually more negative as the hand moves toward camera.
    // In this side-on avatar that becomes forward motion toward the opponent.
    const rwForward = clamp(((this.neutral.rightWrist.z ?? 0) - (rw.z ?? 0)) * GLOVE_MAP.SCALE_Z, -28, 118);
    const lwForward = clamp(((this.neutral.leftWrist.z ?? 0) - (lw.z ?? 0)) * GLOVE_MAP.SCALE_Z, -28, 118);

    // Right glove (player's left hand on screen) = mapped from webcam right wrist
    const targetRX = GLOVE_MAP.RIGHT_BASE_X - rwDeltaX + rwForward;
    const targetRY = GLOVE_MAP.RIGHT_BASE_Y + rwDeltaY - Math.max(0, rwForward) * 0.10;

    // Left glove (player's right hand on screen) = mapped from webcam left wrist
    const targetLX = GLOVE_MAP.LEFT_BASE_X - lwDeltaX + lwForward;
    const targetLY = GLOVE_MAP.LEFT_BASE_Y + lwDeltaY - Math.max(0, lwForward) * 0.10;

    // EMA lerp for smooth, no-snap movement
    this.rightGloveX = lerp(this.rightGloveX, targetRX, this.ALPHA);
    this.rightGloveY = lerp(this.rightGloveY, targetRY, this.ALPHA);
    this.leftGloveX  = lerp(this.leftGloveX,  targetLX, this.ALPHA);
    this.leftGloveY  = lerp(this.leftGloveY,  targetLY, this.ALPHA);

    // ── Shoulder rotation → torso lean ────────────────────────────────────────
    const shoulderDeltaY = ls.y - rs.y; // positive = left shoulder lower
    const shoulderTwist = ((ls.x - this.neutral.leftShoulder.x) - (rs.x - this.neutral.rightShoulder.x));
    const targetTorso = shoulderDeltaY * 1.1 + shoulderTwist * 0.9;
    this.torsoRot = lerp(this.torsoRot, targetTorso, this.ALPHA * 0.6);

    // ── Elbow angle → glove scale (extended arm = bigger fist in POV) ─────────
    const rightElbowAngle = calcElbowAngle(rs, re, rw);
    const leftElbowAngle  = calcElbowAngle(ls, le, lw);

    // Map 90° (bent) → scale 1.0,  180° (extended) → scale 1.6
    const rightScale = mapRange(rightElbowAngle, 90, 170, 1.0, 1.6);
    const leftScale  = mapRange(leftElbowAngle,  90, 170, 1.0, 1.6);

    // ── Arm rotation from shoulder–wrist vector ────────────────────────────────
    const rightRot = Math.atan2(rw.y - rs.y, -(rw.x - rs.x)); // mirror x
    const leftRot  = Math.atan2(lw.y - ls.y, -(lw.x - ls.x));

    this.shoulderT = lerp(this.shoulderT, (ls.y - rs.y) * 1.5, this.ALPHA * 0.5);

    this._lastPose = {
      rightGlove: {
        x: clamp(this.rightGloveX, COMBAT_ARENA.PLAYER_HOME_X - 92, COMBAT_ARENA.OPPONENT_HOME_X + 36),
        y: clamp(this.rightGloveY, 118, CH - 42),
        scale:    clamp(rightScale + Math.max(0, rwForward) / 180, 0.85, 2.25),
        rotation: rightRot,
      },
      leftGlove: {
        x: clamp(this.leftGloveX, COMBAT_ARENA.PLAYER_HOME_X - 72, COMBAT_ARENA.OPPONENT_HOME_X + 46),
        y: clamp(this.leftGloveY, 118, CH - 42),
        scale:    clamp(leftScale + Math.max(0, lwForward) / 180, 0.85, 2.25),
        rotation: leftRot,
      },
      torsoRotation: this.torsoRot,
      shoulderTilt:  this.shoulderT,
    };
    return this._lastPose;
  }

  private defaultPose(): AvatarPose {
    return {
      rightGlove: { x: GLOVE_MAP.RIGHT_BASE_X, y: GLOVE_MAP.RIGHT_BASE_Y, scale: 1.0, rotation: 0 },
      leftGlove:  { x: GLOVE_MAP.LEFT_BASE_X,  y: GLOVE_MAP.LEFT_BASE_Y,  scale: 1.0, rotation: 0 },
      torsoRotation: 0,
      shoulderTilt:  0,
    };
  }

  public reset() {
    this.rightGloveX = GLOVE_MAP.RIGHT_BASE_X;
    this.rightGloveY = GLOVE_MAP.RIGHT_BASE_Y;
    this.leftGloveX  = GLOVE_MAP.LEFT_BASE_X;
    this.leftGloveY  = GLOVE_MAP.LEFT_BASE_Y;
    this.torsoRot    = 0;
    this.shoulderT   = 0;
    this.neutralReady = false;
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function mapRange(v: number, inLo: number, inHi: number, outLo: number, outHi: number): number {
  const t = (v - inLo) / (inHi - inLo);
  return outLo + clamp(t, 0, 1) * (outHi - outLo);
}

function calcElbowAngle(shoulder: Coordinate, elbow: Coordinate, wrist: Coordinate): number {
  const ba = { x: shoulder.x - elbow.x, y: shoulder.y - elbow.y };
  const bc = { x: wrist.x    - elbow.x, y: wrist.y    - elbow.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const magA = Math.hypot(ba.x, ba.y);
  const magB = Math.hypot(bc.x, bc.y);
  if (magA < 0.001 || magB < 0.001) return 90;
  return (Math.acos(Math.max(-1, Math.min(1, dot / (magA * magB)))) * 180) / Math.PI;
}

function smoothNeutral(prev: Coordinate, next: Coordinate, alpha: number): Coordinate {
  if ((next.visibility ?? 1) < 0.62) return prev;
  return {
    x: lerp(prev.x, next.x, alpha),
    y: lerp(prev.y, next.y, alpha),
    z: lerp(prev.z ?? 0, next.z ?? 0, alpha),
    visibility: next.visibility,
  };
}

export const bodyToAvatarMapper = new BodyToAvatarMapper();
