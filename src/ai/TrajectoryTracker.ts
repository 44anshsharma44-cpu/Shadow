/**
 * TrajectoryTracker.ts
 * Analyses the spatial path of a wrist across the last N frames to determine:
 *  - Is the trajectory linear (→ jab candidate) or curved (→ hook candidate)?
 *  - What is the primary axis of motion (horizontal, vertical, or forward)?
 *  - Is the path ascending (→ uppercut) or descending?
 */

import { HandMotionFrame } from './MotionBuffer';

export interface TrajectoryAnalysis {
  /** 0 = perfectly linear, 1 = very curved */
  curvature: number;
  /** Primary axis: 'lateral' | 'vertical' | 'forward' */
  primaryAxis: 'lateral' | 'vertical' | 'forward';
  /** Is the wrist moving upward (true) or not? */
  isAscending: boolean;
  /** Net horizontal displacement over the window (negative = rightward in normalised coords) */
  netDeltaX: number;
  /** Net vertical displacement (negative = upward in normalised coords) */
  netDeltaY: number;
  /** Net depth displacement (negative = toward camera) */
  netDeltaZ: number;
  /** Dominant speed over window */
  peakSpeed: number;
  /** Ratio of lateral to vertical motion (high → lateral/hook, low → vertical/uppercut) */
  lateralToVerticalRatio: number;
}

export class TrajectoryTracker {
  /**
   * Analyses a sequence of hand frames (most-recent-first or ascending timestamps).
   * Pass in the last 8–15 frames for best results.
   */
  public analyse(frames: HandMotionFrame[]): TrajectoryAnalysis {
    if (frames.length < 3) {
      return {
        curvature: 0,
        primaryAxis: 'forward',
        isAscending: false,
        netDeltaX: 0,
        netDeltaY: 0,
        netDeltaZ: 0,
        peakSpeed: 0,
        lateralToVerticalRatio: 1,
      };
    }

    const positions = frames.map(f => f.wristPos);

    // ── Net displacement ──────────────────────────────────────────────────────
    const first = positions[0];
    const last = positions[positions.length - 1];
    const netDeltaX = last.x - first.x;
    const netDeltaY = last.y - first.y;   // negative = moving up
    const netDeltaZ = (last.z ?? 0) - (first.z ?? 0); // negative = toward camera
    const netDist = Math.sqrt(netDeltaX ** 2 + netDeltaY ** 2);

    // ── Path length ───────────────────────────────────────────────────────────
    let pathLength = 0;
    for (let i = 1; i < positions.length; i++) {
      const dx = positions[i].x - positions[i - 1].x;
      const dy = positions[i].y - positions[i - 1].y;
      pathLength += Math.sqrt(dx * dx + dy * dy);
    }

    // ── Curvature: ratio of total path length to straight-line distance ───────
    // If path length >> straight distance → curved (hook)
    const curvature = netDist > 0.001 ? Math.min(1, (pathLength / netDist - 1) / 0.5) : 0;

    // ── Primary axis determination ────────────────────────────────────────────
    const absX = Math.abs(netDeltaX);
    const absY = Math.abs(netDeltaY);
    const absZ = Math.abs(netDeltaZ);
    let primaryAxis: 'lateral' | 'vertical' | 'forward';

    if (absZ > Math.max(absX, absY) * 1.15) {
      primaryAxis = 'forward';
    } else if (absX > absY * 1.4) {
      primaryAxis = 'lateral';
    } else if (absY > absX * 1.4) {
      primaryAxis = 'vertical';
    } else {
      primaryAxis = 'forward';
    }

    // ── Ascending (upward trajectory for uppercut) ────────────────────────────
    // In normalised coords, Y decreases as hand moves UP
    const isAscending = netDeltaY < -0.02;

    // ── Peak speed ────────────────────────────────────────────────────────────
    const peakSpeed = frames.reduce((max, f) => Math.max(max, f.velocity.speed), 0);

    const lateralToVerticalRatio = absY > 0.0001 ? absX / absY : 99;

    return {
      curvature,
      primaryAxis,
      isAscending,
      netDeltaX,
      netDeltaY,
      netDeltaZ,
      peakSpeed,
      lateralToVerticalRatio,
    };
  }

  /**
   * Checks if the wrist path is "forward-dominant" in Z space.
   * MediaPipe provides a relative Z (negative = closer to camera).
   * A jab should see Z decrease (hand approaching camera).
   */
  public isForwardThrust(frames: HandMotionFrame[]): boolean {
    if (frames.length < 3) return false;
    const zVals = frames.map(f => f.wristPos.z ?? 0);
    const dz = zVals[zVals.length - 1] - zVals[0];
    return dz < -0.02; // hand moved toward camera
  }
}

export const trajectoryTracker = new TrajectoryTracker();
