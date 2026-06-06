import { Coordinate, HandLandmarkSet, HandSide } from '@/types/pose';

export interface StabilizedWrist {
  wrist: Coordinate;
  accepted: boolean;
  reason: 'ok' | 'jump' | 'arm-length' | 'low-confidence';
}

interface WristState {
  last: Coordinate | null;
}

const STATES: Record<HandSide, WristState> = {
  left: { last: null },
  right: { last: null },
};

export class WristStabilizer {
  public stabilize(
    side: HandSide,
    wristCandidate: Coordinate,
    hand: HandLandmarkSet | null,
    elbow: Coordinate,
    shoulder: Coordinate,
    timestampMs: number,
    maxJump: number
  ): StabilizedWrist {
    const state = STATES[side];
    const sourceConfidence = wristCandidate.visibility ?? hand?.confidence ?? 0.5;
    const upperArm = distance(shoulder, elbow);
    const forearm = distance(elbow, wristCandidate);
    const plausibleArm = upperArm < 0.01 || (forearm > upperArm * 0.45 && forearm < upperArm * 1.95);

    let accepted = sourceConfidence >= 0.22 && plausibleArm;
    let reason: StabilizedWrist['reason'] = accepted ? 'ok' : sourceConfidence < 0.22 ? 'low-confidence' : 'arm-length';

    if (state.last) {
      const jump = distance(state.last, wristCandidate);
      if (jump > maxJump && sourceConfidence < 0.82) {
        accepted = false;
        reason = 'jump';
      }
    }

    let wrist = wristCandidate;
    if (!accepted) {
      const kinematic = projectFromArm(elbow, shoulder, hand?.palmCenter ?? wristCandidate);
      wrist = state.last
        ? blend(state.last, kinematic, reason === 'jump' ? 0.38 : 0.55, sourceConfidence * 0.8)
        : kinematic;
    }

    // Hand landmarks give a second anatomical anchor. Pull the wrist slightly
    // toward palm orientation so hooks/uppercuts do not drift off the fist.
    if (hand && hand.confidence > 0.45) {
      const palmBack = {
        x: hand.palmCenter.x + (hand.wrist.x - hand.palmCenter.x) * 0.72,
        y: hand.palmCenter.y + (hand.wrist.y - hand.palmCenter.y) * 0.72,
        z: (hand.palmCenter.z ?? 0) + ((hand.wrist.z ?? 0) - (hand.palmCenter.z ?? 0)) * 0.72,
        visibility: hand.confidence,
      };
      wrist = blend(wrist, palmBack, 0.34, Math.max(sourceConfidence, hand.confidence));
    }

    state.last = {
      x: clamp(wrist.x, 0, 1),
      y: clamp(wrist.y, 0, 1),
      z: wrist.z ?? 0,
      visibility: wrist.visibility ?? sourceConfidence,
    };

    return { wrist: state.last, accepted, reason };
  }

  public reset() {
    STATES.left.last = null;
    STATES.right.last = null;
  }
}

function projectFromArm(elbow: Coordinate, shoulder: Coordinate, target: Coordinate): Coordinate {
  const upperArm = Math.max(distance(shoulder, elbow), 0.05);
  const desired = upperArm * 1.08;
  const dx = target.x - elbow.x;
  const dy = target.y - elbow.y;
  const dz = (target.z ?? 0) - (elbow.z ?? 0);
  const len = Math.max(Math.hypot(dx, dy, dz), 0.001);
  return {
    x: elbow.x + (dx / len) * desired,
    y: elbow.y + (dy / len) * desired,
    z: (elbow.z ?? 0) + (dz / len) * desired,
    visibility: Math.min(target.visibility ?? 0.45, 0.65),
  };
}

function distance(a: Coordinate, b: Coordinate): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

function blend(a: Coordinate, b: Coordinate, t: number, visibility: number): Coordinate {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t,
    visibility,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export const wristStabilizer = new WristStabilizer();
