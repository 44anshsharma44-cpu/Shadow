/**
 * PunchAnalyzer.ts
 * 
 * Complete multi-feature punch classifier that replaces PunchClassifier.ts.
 *
 * Detection strategy:
 *  - NEVER classifies from a single frame
 *  - Uses MotionBuffer (last 30 frames) for temporal context
 *  - Uses TrajectoryTracker for path curvature / axis analysis
 *  - Uses MovementHistory for cooldown and sustained-duration checks
 *  - Combines: wrist velocity, acceleration, elbow angle, shoulder rotation,
 *    hand trajectory, body orientation, and movement history
 *
 * Classification Priority: DUCK → BLOCK → UPPERCUT → HOOK → JAB
 * (Higher-specificity gestures checked first to prevent mis-labelling)
 */

import { GestureType, LandmarkSet } from '@/types/pose';
import { MotionBuffer } from './MotionBuffer';
import { TrajectoryTracker } from './TrajectoryTracker';
import { MovementHistory } from './MovementHistory';

// ─── Tunable thresholds ───────────────────────────────────────────────────────
// All speed values are in normalised-coordinate units/sec (typical 0.5–3.0 for punches)
const THRESHOLDS = {
  // Minimum wrist speed to even begin evaluating a punch
  MIN_PUNCH_SPEED: 0.55,

  // JAB: arm extends fully → high elbow angle, forward thrust
  JAB_MIN_SPEED: 0.65,
  JAB_MIN_ELBOW_ANGLE: 130,       // nearly straight arm
  JAB_MAX_CURVATURE: 0.30,        // very linear path
  JAB_MIN_FORWARD_Z: -0.018,      // wrist must move toward camera
  JAB_MIN_DURATION_MS: 80,        // ms the fast motion must persist
  JAB_MAX_DURATION_MS: 500,
  JAB_MAX_LATERAL_RATIO: 0.85,    // wrist cannot be moving mostly sideways

  // HOOK: arm bent, horizontal arc, strong shoulder rotation
  HOOK_MIN_SPEED: 0.55,
  HOOK_MAX_ELBOW_ANGLE: 125,      // arm bent
  HOOK_MIN_CURVATURE: 0.15,       // must be curved
  HOOK_MIN_SHOULDER_ROTATION: 0.025, // shoulder must swing
  HOOK_MIN_LATERAL_RATIO: 0.95,   // mostly lateral motion

  // UPPERCUT: hand starts below shoulder, rises rapidly, elbow bent
  UPPERCUT_MIN_SPEED: 0.50,
  UPPERCUT_MAX_ELBOW_ANGLE: 130,  // bent throughout
  UPPERCUT_MIN_VERTICAL_RATIO: 0.65, // mostly vertical
  UPPERCUT_MIN_ASCENT: -0.025,    // must move significantly upward (negative Y = up)

  // BLOCK: both wrists near nose, sustained ≥ 150ms
  BLOCK_WRIST_TO_NOSE_MAX: 0.17,
  BLOCK_SUSTAIN_MS: 150,
  BLOCK_MIN_FRAMES: 4,

  // DUCK: body height drops by ≥ 15%
  DUCK_HEIGHT_RATIO: 0.83,
};

// ─── Calibration state ───────────────────────────────────────────────────────
interface Calibration {
  standingBodyHeight: number; // nose.y → hip_mid.y distance at rest
  frames: number;
  sum: number;
  complete: boolean;
}

// ─── Block state tracking ─────────────────────────────────────────────────────
interface BlockState {
  startMs: number;
  active: boolean;
}

export interface AnalyzerDebugInfo {
  leftSpeed: number;
  rightSpeed: number;
  leftElbow: number;
  rightElbow: number;
  leftCurvature: number;
  rightCurvature: number;
  leftShoulderDelta: number;
  rightShoulderDelta: number;
  leftTrajectory: string;
  rightTrajectory: string;
  classification: GestureType;
  confidence: number;
  blockFrameCount: number;
}

export class PunchAnalyzer {
  private buffer: MotionBuffer;
  private trajectory: TrajectoryTracker;
  private history: MovementHistory;
  private calib: Calibration = { standingBodyHeight: 0.28, frames: 0, sum: 0, complete: false };
  private blockState: BlockState = { startMs: 0, active: false };
  
  // Track block frame count for sustain check
  private blockFrameCount: number = 0;
  private lastDebug: AnalyzerDebugInfo | null = null;

  constructor() {
    this.buffer = new MotionBuffer();
    this.trajectory = new TrajectoryTracker();
    this.history = new MovementHistory();
  }

  /**
   * Main entry point. Call once per frame with filtered landmarks.
   * Returns the detected gesture for this frame.
   */
  public analyze(
    landmarks: LandmarkSet,
    timestampMs: number,
    sensitivity: number  // 0.0 (hardest) – 1.0 (easiest)
  ): GestureType {
    // Push into buffer first
    this.buffer.push(landmarks, timestampMs);

    // Need at least 4 frames before classifying
    if (this.buffer.size < 4) return 'NONE';

    // Calibrate standing height during first 80 frames
    if (!this.calib.complete) {
      const hipMidY = (landmarks.leftHip.y + landmarks.rightHip.y) / 2;
      const bodyH = hipMidY - landmarks.nose.y;
      this.calib.sum += bodyH;
      this.calib.frames++;
      if (this.calib.frames >= 80) {
        this.calib.standingBodyHeight = this.calib.sum / this.calib.frames;
        this.calib.complete = true;
      }
      return 'NONE';
    }

    // Sensitivity scaling – makes thresholds easier to trigger at high sensitivity
    const sens = Math.max(0.2, Math.min(1.0, sensitivity));
    const speedScale = 2.0 - sens * 1.0; // 1.0 at sens=1, 1.5 at sens=0.5

    const recent = this.buffer.recent(24);

    // ── 1. DUCK ────────────────────────────────────────────────────────────────
    const hipMidY = (landmarks.leftHip.y + landmarks.rightHip.y) / 2;
    const currentBodyH = hipMidY - landmarks.nose.y;
    if (currentBodyH < this.calib.standingBodyHeight * THRESHOLDS.DUCK_HEIGHT_RATIO) {
      this.blockFrameCount = 0;
      this.blockState.active = false;
      return 'DUCK';
    }

    // ── 2. BLOCK ───────────────────────────────────────────────────────────────
    const leftDistNose = Math.sqrt(
      (landmarks.leftWrist.x - landmarks.nose.x) ** 2 +
      (landmarks.leftWrist.y - landmarks.nose.y) ** 2
    );
    const rightDistNose = Math.sqrt(
      (landmarks.rightWrist.x - landmarks.nose.x) ** 2 +
      (landmarks.rightWrist.y - landmarks.nose.y) ** 2
    );

    if (
      leftDistNose < THRESHOLDS.BLOCK_WRIST_TO_NOSE_MAX &&
      rightDistNose < THRESHOLDS.BLOCK_WRIST_TO_NOSE_MAX
    ) {
      this.blockFrameCount++;
      if (this.blockFrameCount >= THRESHOLDS.BLOCK_MIN_FRAMES) {
        if (!this.blockState.active) {
          this.blockState.active = true;
          this.blockState.startMs = timestampMs;
        }
        const elapsed = timestampMs - this.blockState.startMs;
        if (elapsed >= THRESHOLDS.BLOCK_SUSTAIN_MS) {
          return 'BLOCK';
        }
      }
    } else {
      this.blockFrameCount = 0;
      this.blockState.active = false;
    }

    // ── Check global punch cooldown ────────────────────────────────────────────
    // (shared across both hands – prevents firing two punches simultaneously)

    // ── Analyse trajectories for each hand ────────────────────────────────────
    const leftFrames = recent.map(f => f.left);
    const rightFrames = recent.map(f => f.right);
    const leftTraj = this.trajectory.analyse(leftFrames);
    const rightTraj = this.trajectory.analyse(rightFrames);

    const leftPeakSpeed = this.buffer.peakSpeed('left', 18);
    const rightPeakSpeed = this.buffer.peakSpeed('right', 18);
    const leftAvgElbow = leftFrames.reduce((s, f) => s + f.elbowAngle, 0) / leftFrames.length;
    const rightAvgElbow = rightFrames.reduce((s, f) => s + f.elbowAngle, 0) / rightFrames.length;
    const leftShoulderDelta = this.history.shoulderRotationDelta('left', 10);
    const rightShoulderDelta = this.history.shoulderRotationDelta('right', 10);

    // Record for debug
    this.lastDebug = {
      leftSpeed: leftPeakSpeed,
      rightSpeed: rightPeakSpeed,
      leftElbow: leftAvgElbow,
      rightElbow: rightAvgElbow,
      leftCurvature: leftTraj.curvature,
      rightCurvature: rightTraj.curvature,
      leftShoulderDelta,
      rightShoulderDelta,
      leftTrajectory: leftTraj.primaryAxis,
      rightTrajectory: rightTraj.primaryAxis,
      classification: 'NONE',
      confidence: 0,
      blockFrameCount: this.blockFrameCount,
    };

    // Record movement history
    this.history.addRecord({
      timestamp: timestampMs,
      leftSpeed: leftPeakSpeed,
      rightSpeed: rightPeakSpeed,
      leftElbowAngle: leftAvgElbow,
      rightElbowAngle: rightAvgElbow,
      leftShoulderX: landmarks.leftShoulder.x,
      rightShoulderX: landmarks.rightShoulder.x,
      gesture: 'NONE',
    });

    // ── 3. UPPERCUT (checked before hook to avoid vertical-as-hook confusion) ──
    const UC_SPEED = THRESHOLDS.UPPERCUT_MIN_SPEED * speedScale;

    // Left uppercut
    if (leftPeakSpeed > UC_SPEED) {
      const result = this.tryClassifyUppercut(
        leftFrames, leftTraj, leftAvgElbow, 'left', timestampMs
      );
      if (result) {
        this.history.recordFiredGesture(result, timestampMs);
        this.lastDebug.classification = result;
        this.lastDebug.confidence = 0.85;
        return result;
      }
    }

    // Right uppercut
    if (rightPeakSpeed > UC_SPEED) {
      const result = this.tryClassifyUppercut(
        rightFrames, rightTraj, rightAvgElbow, 'right', timestampMs
      );
      if (result) {
        this.history.recordFiredGesture(result, timestampMs);
        this.lastDebug.classification = result;
        this.lastDebug.confidence = 0.85;
        return result;
      }
    }

    // ── 4. HOOK ────────────────────────────────────────────────────────────────
    const HK_SPEED = THRESHOLDS.HOOK_MIN_SPEED * speedScale;

    if (leftPeakSpeed > HK_SPEED) {
      const result = this.tryClassifyHook(
        leftFrames, leftTraj, leftAvgElbow, leftShoulderDelta, 'left', timestampMs
      );
      if (result) {
        this.history.recordFiredGesture(result, timestampMs);
        this.lastDebug.classification = result;
        this.lastDebug.confidence = 0.80;
        return result;
      }
    }

    if (rightPeakSpeed > HK_SPEED) {
      const result = this.tryClassifyHook(
        rightFrames, rightTraj, rightAvgElbow, rightShoulderDelta, 'right', timestampMs
      );
      if (result) {
        this.history.recordFiredGesture(result, timestampMs);
        this.lastDebug.classification = result;
        this.lastDebug.confidence = 0.80;
        return result;
      }
    }

    // ── 5. JAB ─────────────────────────────────────────────────────────────────
    const JB_SPEED = THRESHOLDS.JAB_MIN_SPEED * speedScale;

    if (leftPeakSpeed > JB_SPEED) {
      const result = this.tryClassifyJab(
        leftFrames, leftTraj, leftAvgElbow, 'left', timestampMs
      );
      if (result) {
        this.history.recordFiredGesture(result, timestampMs);
        this.lastDebug.classification = result;
        this.lastDebug.confidence = 0.88;
        return result;
      }
    }

    if (rightPeakSpeed > JB_SPEED) {
      const result = this.tryClassifyJab(
        rightFrames, rightTraj, rightAvgElbow, 'right', timestampMs
      );
      if (result) {
        this.history.recordFiredGesture(result, timestampMs);
        this.lastDebug.classification = result;
        this.lastDebug.confidence = 0.88;
        return result;
      }
    }

    return 'NONE';
  }

  // ─── Private classifiers ────────────────────────────────────────────────────

  private tryClassifyJab(
    frames: ReturnType<MotionBuffer['recent']>[0]['left'][],
    traj: ReturnType<TrajectoryTracker['analyse']>,
    avgElbow: number,
    side: 'left' | 'right',
    nowMs: number
  ): GestureType | null {
    const gesture: GestureType = side === 'left' ? 'PUNCH_LEFT_JAB' : 'PUNCH_RIGHT_JAB';
    if (this.history.isOnCooldown(gesture, nowMs)) return null;

    // Reject if moving too laterally
    if (traj.lateralToVerticalRatio > THRESHOLDS.JAB_MAX_LATERAL_RATIO &&
      traj.primaryAxis === 'lateral') return null;
    // Reject ascending (that's an uppercut)
    if (traj.isAscending && Math.abs(traj.netDeltaY) > Math.abs(traj.netDeltaX)) return null;
    // Reject highly curved paths (hook)
    if (traj.curvature > THRESHOLDS.JAB_MAX_CURVATURE) return null;
    // Require extended arm
    if (avgElbow < THRESHOLDS.JAB_MIN_ELBOW_ANGLE) return null;
    // Require speed persisted for a plausible duration
    const dur = this.buffer.windowDuration(18);
    if (dur < THRESHOLDS.JAB_MIN_DURATION_MS || dur > THRESHOLDS.JAB_MAX_DURATION_MS) return null;
    // Require true forward extension in depth or a forward-dominant path.
    if (traj.netDeltaZ > THRESHOLDS.JAB_MIN_FORWARD_Z && traj.primaryAxis !== 'forward') return null;

    return gesture;
  }

  private tryClassifyHook(
    frames: ReturnType<MotionBuffer['recent']>[0]['left'][],
    traj: ReturnType<TrajectoryTracker['analyse']>,
    avgElbow: number,
    shoulderDelta: number,
    side: 'left' | 'right',
    nowMs: number
  ): GestureType | null {
    const gesture: GestureType = side === 'left' ? 'PUNCH_LEFT_HOOK' : 'PUNCH_RIGHT_HOOK';
    if (this.history.isOnCooldown(gesture, nowMs)) return null;

    // Arm must be bent
    if (avgElbow > THRESHOLDS.HOOK_MAX_ELBOW_ANGLE) return null;
    // Path must be curved (differentiates from jab)
    if (traj.curvature < THRESHOLDS.HOOK_MIN_CURVATURE) return null;
    // Motion must be primarily lateral
    if (traj.lateralToVerticalRatio < THRESHOLDS.HOOK_MIN_LATERAL_RATIO) return null;
    if (traj.primaryAxis !== 'lateral') return null;
    // Shoulder rotation required
    if (shoulderDelta < THRESHOLDS.HOOK_MIN_SHOULDER_ROTATION) return null;
    // Hooks travel around, not straight out at the camera.
    if (traj.netDeltaZ < THRESHOLDS.JAB_MIN_FORWARD_Z * 1.6 && traj.curvature < 0.35) return null;
    // Reject ascending hooks (uppercut territory)
    if (traj.isAscending && Math.abs(traj.netDeltaY) > Math.abs(traj.netDeltaX) * 0.8) return null;

    return gesture;
  }

  private tryClassifyUppercut(
    frames: ReturnType<MotionBuffer['recent']>[0]['left'][],
    traj: ReturnType<TrajectoryTracker['analyse']>,
    avgElbow: number,
    side: 'left' | 'right',
    nowMs: number
  ): GestureType | null {
    const gesture: GestureType = side === 'left' ? 'PUNCH_LEFT_UPPERCUT' : 'PUNCH_RIGHT_UPPERCUT';
    if (this.history.isOnCooldown(gesture, nowMs)) return null;

    // Must be ascending
    if (!traj.isAscending) return null;
    if (traj.netDeltaY > THRESHOLDS.UPPERCUT_MIN_ASCENT) return null; // not enough rise
    // Primary axis must be vertical
    if (traj.primaryAxis !== 'vertical') return null;
    // Elbow must remain bent (not a straight jab going upward)
    if (avgElbow > THRESHOLDS.UPPERCUT_MAX_ELBOW_ANGLE) return null;
    // Wrist must start below shoulder
    const firstFrame = frames[0];
    const lastFrame = frames[frames.length - 1];
    if (firstFrame && lastFrame) {
      if (firstFrame.wristPos.y < firstFrame.shoulderPos.y - 0.05) {
        // Wrist started ABOVE shoulder – not a valid uppercut start
        return null;
      }
    }

    return gesture;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  public getDebugInfo(): AnalyzerDebugInfo | null {
    return this.lastDebug;
  }

  public getMotionBuffer(): MotionBuffer {
    return this.buffer;
  }

  public reset() {
    this.buffer.reset();
    this.history.reset();
    this.calib = { standingBodyHeight: 0.28, frames: 0, sum: 0, complete: false };
    this.blockState = { startMs: 0, active: false };
    this.blockFrameCount = 0;
    this.lastDebug = null;
  }
}
