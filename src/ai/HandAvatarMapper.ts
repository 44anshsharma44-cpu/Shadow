import { COMBAT_ARENA } from '@/game/CombatRangeManager';
import { Coordinate, HandTrackingPair, LandmarkSet, TrackingDebugInfo } from '@/types/pose';
import { AvatarPose } from './BodyToAvatarMapper';

interface IkArm {
  shoulder: { x: number; y: number };
  elbow: { x: number; y: number };
  wrist: { x: number; y: number };
}

export interface HandAvatarPose extends AvatarPose {
  rightArm: IkArm;
  leftArm: IkArm;
}

const CANVAS_H = 450;
const BASE = {
  leftShoulder: { x: COMBAT_ARENA.PLAYER_HOME_X + 40, y: COMBAT_ARENA.PLAYER_HIP_Y - 82 },
  rightShoulder: { x: COMBAT_ARENA.PLAYER_HOME_X - 34, y: COMBAT_ARENA.PLAYER_HIP_Y - 82 },
  leftGlove: { x: COMBAT_ARENA.PLAYER_HOME_X + 40, y: COMBAT_ARENA.PLAYER_HIP_Y - 62 },
  rightGlove: { x: COMBAT_ARENA.PLAYER_HOME_X - 30, y: COMBAT_ARENA.PLAYER_HIP_Y - 62 },
};

export class HandAvatarMapper {
  private neutral: LandmarkSet | null = null;
  private last: HandAvatarPose = this.defaultPose();

  public get lastPose(): HandAvatarPose {
    return this.last;
  }

  public map(
    landmarks: LandmarkSet | null,
    hands: HandTrackingPair | null,
    isActive: boolean,
    debug?: TrackingDebugInfo | null
  ): HandAvatarPose {
    if (!landmarks || !isActive) return this.last;
    if (!this.neutral) this.neutral = cloneLandmarks(landmarks);

    this.updateNeutral(landmarks, debug?.punchMode ?? false);

    const leftTarget = this.mapHandToCanvas('left', landmarks, hands?.left?.palmCenter ?? landmarks.leftWrist);
    const rightTarget = this.mapHandToCanvas('right', landmarks, hands?.right?.palmCenter ?? landmarks.rightWrist);

    const alpha = debug?.punchMode ? 0.92 : 0.72;
    const rightX = lerp(this.last.rightGlove.x, rightTarget.x, alpha);
    const rightY = lerp(this.last.rightGlove.y, rightTarget.y, alpha);
    const leftX = lerp(this.last.leftGlove.x, leftTarget.x, alpha);
    const leftY = lerp(this.last.leftGlove.y, leftTarget.y, alpha);

    const rightShoulder = mapShoulder('right', landmarks, this.neutral);
    const leftShoulder = mapShoulder('left', landmarks, this.neutral);
    const rightArm = solveIk(rightShoulder, { x: rightX, y: rightY }, 58, 62, -1);
    const leftArm = solveIk(leftShoulder, { x: leftX, y: leftY }, 58, 62, 1);

    const rightElbowAngle = elbowAngle(landmarks.rightShoulder, landmarks.rightElbow, landmarks.rightWrist);
    const leftElbowAngle = elbowAngle(landmarks.leftShoulder, landmarks.leftElbow, landmarks.leftWrist);
    const rightForward = Math.max(0, ((this.neutral.rightWrist.z ?? 0) - (landmarks.rightWrist.z ?? 0)) * 2.3);
    const leftForward = Math.max(0, ((this.neutral.leftWrist.z ?? 0) - (landmarks.leftWrist.z ?? 0)) * 2.3);

    this.last = {
      rightGlove: {
        x: rightX,
        y: rightY,
        scale: clamp(mapRange(rightElbowAngle, 80, 170, 0.95, 1.55) + rightForward, 0.85, 2.25),
        rotation: Math.atan2(rightArm.wrist.y - rightArm.elbow.y, rightArm.wrist.x - rightArm.elbow.x),
      },
      leftGlove: {
        x: leftX,
        y: leftY,
        scale: clamp(mapRange(leftElbowAngle, 80, 170, 0.95, 1.55) + leftForward, 0.85, 2.25),
        rotation: Math.atan2(leftArm.wrist.y - leftArm.elbow.y, leftArm.wrist.x - leftArm.elbow.x),
      },
      rightArm,
      leftArm,
      torsoRotation: ((landmarks.leftShoulder.y - landmarks.rightShoulder.y) * 1.1),
      shoulderTilt: (landmarks.leftShoulder.y - landmarks.rightShoulder.y) * 1.45,
    };

    return this.last;
  }

  public reset() {
    this.neutral = null;
    this.last = this.defaultPose();
  }

  private mapHandToCanvas(side: 'left' | 'right', landmarks: LandmarkSet, wrist: Coordinate): { x: number; y: number } {
    const neutral = this.neutral ?? landmarks;
    const neutralWrist = side === 'left' ? neutral.leftWrist : neutral.rightWrist;
    const base = side === 'left' ? BASE.leftGlove : BASE.rightGlove;
    const dx = wrist.x - neutralWrist.x;
    const dy = wrist.y - neutralWrist.y;
    const dz = (neutralWrist.z ?? 0) - (wrist.z ?? 0);

    const x = base.x - dx * 390 + clamp(dz * 230, -24, 124);
    const y = base.y + dy * 340 - Math.max(0, dz * 42);
    return {
      x: clamp(x, COMBAT_ARENA.PLAYER_HOME_X - 106, COMBAT_ARENA.OPPONENT_HOME_X + 54),
      y: clamp(y, 112, CANVAS_H - 36),
    };
  }

  private updateNeutral(landmarks: LandmarkSet, punchMode: boolean) {
    if (!this.neutral || punchMode) return;
    this.neutral.leftShoulder = blendCoord(this.neutral.leftShoulder, landmarks.leftShoulder, 0.01);
    this.neutral.rightShoulder = blendCoord(this.neutral.rightShoulder, landmarks.rightShoulder, 0.01);
    this.neutral.leftWrist = blendCoord(this.neutral.leftWrist, landmarks.leftWrist, 0.006);
    this.neutral.rightWrist = blendCoord(this.neutral.rightWrist, landmarks.rightWrist, 0.006);
  }

  private defaultPose(): HandAvatarPose {
    return {
      rightGlove: { x: BASE.rightGlove.x, y: BASE.rightGlove.y, scale: 1, rotation: 0 },
      leftGlove: { x: BASE.leftGlove.x, y: BASE.leftGlove.y, scale: 1, rotation: 0 },
      rightArm: solveIk(BASE.rightShoulder, BASE.rightGlove, 58, 62, -1),
      leftArm: solveIk(BASE.leftShoulder, BASE.leftGlove, 58, 62, 1),
      torsoRotation: 0,
      shoulderTilt: 0,
    };
  }
}

function solveIk(
  shoulder: { x: number; y: number },
  wrist: { x: number; y: number },
  upperLen: number,
  lowerLen: number,
  bendDir: number
): IkArm {
  const dx = wrist.x - shoulder.x;
  const dy = wrist.y - shoulder.y;
  const d = clamp(Math.hypot(dx, dy), 8, upperLen + lowerLen - 1);
  const baseAngle = Math.atan2(dy, dx);
  const elbowAngle = Math.acos(clamp((upperLen * upperLen + d * d - lowerLen * lowerLen) / (2 * upperLen * d), -1, 1));
  const angle = baseAngle + elbowAngle * bendDir;
  return {
    shoulder,
    elbow: {
      x: shoulder.x + Math.cos(angle) * upperLen,
      y: shoulder.y + Math.sin(angle) * upperLen,
    },
    wrist,
  };
}

function mapShoulder(side: 'left' | 'right', landmarks: LandmarkSet, neutral: LandmarkSet | null): { x: number; y: number } {
  const base = side === 'left' ? BASE.leftShoulder : BASE.rightShoulder;
  if (!neutral) return base;
  const current = side === 'left' ? landmarks.leftShoulder : landmarks.rightShoulder;
  const rest = side === 'left' ? neutral.leftShoulder : neutral.rightShoulder;
  return {
    x: base.x - (current.x - rest.x) * 190,
    y: base.y + (current.y - rest.y) * 165,
  };
}

function cloneLandmarks(landmarks: LandmarkSet): LandmarkSet {
  return JSON.parse(JSON.stringify(landmarks)) as LandmarkSet;
}

function blendCoord(a: Coordinate, b: Coordinate, t: number): Coordinate {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z ?? 0, b.z ?? 0, t),
    visibility: b.visibility,
  };
}

function elbowAngle(shoulder: Coordinate, elbow: Coordinate, wrist: Coordinate): number {
  const ax = shoulder.x - elbow.x;
  const ay = shoulder.y - elbow.y;
  const bx = wrist.x - elbow.x;
  const by = wrist.y - elbow.y;
  const magA = Math.hypot(ax, ay);
  const magB = Math.hypot(bx, by);
  if (magA < 0.001 || magB < 0.001) return 90;
  return Math.acos(clamp((ax * bx + ay * by) / (magA * magB), -1, 1)) * 180 / Math.PI;
}

function mapRange(v: number, inLo: number, inHi: number, outLo: number, outHi: number): number {
  return outLo + clamp((v - inLo) / (inHi - inLo), 0, 1) * (outHi - outLo);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export const handAvatarMapper = new HandAvatarMapper();
