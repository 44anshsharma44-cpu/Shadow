import {
  CameraQualityReport,
  Coordinate,
  HandLandmarkSet,
  HandSide,
  HandTrackingPair,
  LandmarkSet,
  TrackingDebugInfo,
  TrackingHandDebug,
} from '@/types/pose';
import { MotionPredictor, PredictedMotion } from './MotionPredictor';
import { PunchTrackingMode } from './PunchTrackingMode';
import { WristStabilizer } from './WristStabilizer';

export interface TrackingFusionInput {
  pose: LandmarkSet;
  hands: HandTrackingPair;
  timestampMs: number;
  camera: CameraQualityReport;
  fps: number;
}

export interface TrackingFusionResult {
  landmarks: LandmarkSet;
  hands: HandTrackingPair;
  debug: TrackingDebugInfo;
}

interface JointKalman {
  x: AxisKalman;
  y: AxisKalman;
  z: AxisKalman;
  initialized: boolean;
}

interface AxisKalman {
  value: number;
  velocity: number;
  covariance: number;
}

type TrackedJoint = keyof Pick<
  LandmarkSet,
  'leftShoulder' | 'rightShoulder' | 'leftElbow' | 'rightElbow' | 'leftWrist' | 'rightWrist'
>;

const TRACKED_JOINTS: TrackedJoint[] = [
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
];

export class TrackingFusion {
  private predictor = new MotionPredictor();
  private punchMode = new PunchTrackingMode();
  private stabilizer = new WristStabilizer();
  private kalman: Record<TrackedJoint, JointKalman>;
  private previousTimestamp = 0;
  private lastDebug: TrackingDebugInfo | null = null;

  constructor() {
    this.kalman = TRACKED_JOINTS.reduce((acc, key) => {
      acc[key] = {
        x: createAxis(),
        y: createAxis(),
        z: createAxis(),
        initialized: false,
      };
      return acc;
    }, {} as Record<TrackedJoint, JointKalman>);
  }

  public fuse(input: TrackingFusionInput): TrackingFusionResult {
    const dt = this.previousTimestamp > 0
      ? Math.min((input.timestampMs - this.previousTimestamp) / 1000, 0.08)
      : 1 / 60;
    this.previousTimestamp = input.timestampMs;

    const rawLeft = this.selectWrist('left', input.pose.leftWrist, input.hands.left);
    const rawRight = this.selectWrist('right', input.pose.rightWrist, input.hands.right);

    const leftMotion = this.predictor.update('left', rawLeft.wrist, input.timestampMs, rawLeft.confidence);
    const rightMotion = this.predictor.update('right', rawRight.wrist, input.timestampMs, rawRight.confidence);
    const mode = this.punchMode.update({
      left: leftMotion.accelerationMagnitude,
      right: rightMotion.accelerationMagnitude,
    }, input.timestampMs);

    const leftStabilized = this.stabilizer.stabilize(
      'left',
      this.withPrediction(rawLeft.wrist, leftMotion, rawLeft.confidence),
      input.hands.left,
      input.pose.leftElbow,
      input.pose.leftShoulder,
      input.timestampMs,
      mode.maxJump
    );
    const rightStabilized = this.stabilizer.stabilize(
      'right',
      this.withPrediction(rawRight.wrist, rightMotion, rawRight.confidence),
      input.hands.right,
      input.pose.rightElbow,
      input.pose.rightShoulder,
      input.timestampMs,
      mode.maxJump
    );

    const fused: LandmarkSet = {
      ...input.pose,
      leftShoulder: this.filterJoint('leftShoulder', input.pose.leftShoulder, dt, 0.8, mode.processNoise, 0.56),
      rightShoulder: this.filterJoint('rightShoulder', input.pose.rightShoulder, dt, 0.8, mode.processNoise, 0.56),
      leftElbow: this.filterJoint('leftElbow', input.pose.leftElbow, dt, 0.76, mode.processNoise, 0.62),
      rightElbow: this.filterJoint('rightElbow', input.pose.rightElbow, dt, 0.76, mode.processNoise, 0.62),
      leftWrist: this.filterJoint('leftWrist', leftStabilized.wrist, dt, rawLeft.confidence, mode.processNoise, mode.smoothingAlpha),
      rightWrist: this.filterJoint('rightWrist', rightStabilized.wrist, dt, rawRight.confidence, mode.processNoise, mode.smoothingAlpha),
    };

    const leftHand = input.hands.left ? { ...input.hands.left, wrist: fused.leftWrist } : null;
    const rightHand = input.hands.right ? { ...input.hands.right, wrist: fused.rightWrist } : null;
    const hands: HandTrackingPair = { left: leftHand, right: rightHand };

    const leftDebug = this.handDebug(rawLeft.source, rawLeft.confidence, input.hands.left, fused.leftWrist, leftMotion);
    const rightDebug = this.handDebug(rawRight.source, rawRight.confidence, input.hands.right, fused.rightWrist, rightMotion);
    const poseConfidence = averageVisibility(input.pose);
    const trackingConfidence = (leftDebug.confidence + rightDebug.confidence + poseConfidence) / 3;

    this.lastDebug = {
      fps: input.fps,
      poseConfidence,
      trackingConfidence,
      leftHand: leftDebug,
      rightHand: rightDebug,
      camera: input.camera,
      punchMode: mode.active,
    };

    return { landmarks: fused, hands, debug: this.lastDebug };
  }

  public getDebugInfo(): TrackingDebugInfo | null {
    return this.lastDebug;
  }

  public reset() {
    this.predictor.reset();
    this.punchMode.reset();
    this.stabilizer.reset();
    this.previousTimestamp = 0;
    this.lastDebug = null;
    for (const key of TRACKED_JOINTS) {
      this.kalman[key] = { x: createAxis(), y: createAxis(), z: createAxis(), initialized: false };
    }
  }

  private selectWrist(
    side: HandSide,
    poseWrist: Coordinate,
    hand: HandLandmarkSet | null
  ): { wrist: Coordinate; confidence: number; source: TrackingHandDebug['source'] } {
    const poseConfidence = poseWrist.visibility ?? 0.45;
    const handConfidence = hand?.confidence ?? 0;

    if (hand && handConfidence >= poseConfidence * 0.86 && handConfidence > 0.26) {
      return { wrist: { ...hand.wrist, visibility: handConfidence }, confidence: handConfidence, source: 'hand' };
    }

    const predicted = this.predictor.predict(side, this.previousTimestamp, poseConfidence);
    if (poseConfidence < 0.28 && predicted.confidence > poseConfidence) {
      return { wrist: predicted.position, confidence: predicted.confidence, source: 'predicted' };
    }

    return { wrist: poseWrist, confidence: poseConfidence, source: 'pose' };
  }

  private withPrediction(wrist: Coordinate, predicted: PredictedMotion, confidence: number): Coordinate {
    if (confidence > 0.72) return wrist;
    const t = confidence < 0.32 ? 0.72 : 0.36;
    return {
      x: wrist.x + (predicted.position.x - wrist.x) * t,
      y: wrist.y + (predicted.position.y - wrist.y) * t,
      z: (wrist.z ?? 0) + ((predicted.position.z ?? 0) - (wrist.z ?? 0)) * t,
      visibility: Math.max(confidence, predicted.confidence * 0.82),
    };
  }

  private filterJoint(
    key: TrackedJoint,
    measurement: Coordinate,
    dt: number,
    confidence: number,
    processNoise: number,
    responsiveness: number
  ): Coordinate {
    const state = this.kalman[key];
    if (!state.initialized) {
      state.x.value = measurement.x;
      state.y.value = measurement.y;
      state.z.value = measurement.z ?? 0;
      state.initialized = true;
      return measurement;
    }

    const measureNoise = clamp(0.055 - confidence * 0.042, 0.008, 0.06);
    const x = kalmanAxis(state.x, measurement.x, dt, processNoise, measureNoise);
    const y = kalmanAxis(state.y, measurement.y, dt, processNoise, measureNoise);
    const z = kalmanAxis(state.z, measurement.z ?? 0, dt, processNoise, measureNoise * 1.4);

    return {
      x: x + (measurement.x - x) * responsiveness * confidence * 0.18,
      y: y + (measurement.y - y) * responsiveness * confidence * 0.18,
      z: z + ((measurement.z ?? 0) - z) * responsiveness * confidence * 0.18,
      visibility: confidence,
    };
  }

  private handDebug(
    source: TrackingHandDebug['source'],
    confidence: number,
    hand: HandLandmarkSet | null,
    fusedWrist: Coordinate,
    motion: PredictedMotion
  ): TrackingHandDebug {
    const handSize = hand ? Math.hypot(hand.indexKnuckle.x - hand.wrist.x, hand.indexKnuckle.y - hand.wrist.y) : 0;
    const visibility = clamp(confidence * 0.55 + handSize * 4.5 + motion.confidence * 0.25, 0, 1);
    return {
      source,
      confidence: clamp(confidence, 0, 1),
      visibility,
      actualWrist: hand?.wrist ?? fusedWrist,
      predictedWrist: motion.position,
      palmCenter: hand?.palmCenter ?? fusedWrist,
      acceleration: motion.accelerationMagnitude,
    };
  }
}

function createAxis(): AxisKalman {
  return { value: 0, velocity: 0, covariance: 1 };
}

function kalmanAxis(axis: AxisKalman, measurement: number, dt: number, processNoise: number, measureNoise: number): number {
  const predicted = axis.value + axis.velocity * dt;
  const covariance = axis.covariance + processNoise;
  const gain = covariance / (covariance + measureNoise);
  const corrected = predicted + gain * (measurement - predicted);
  axis.velocity = (corrected - axis.value) / Math.max(dt, 0.001);
  axis.value = corrected;
  axis.covariance = (1 - gain) * covariance;
  return corrected;
}

function averageVisibility(landmarks: LandmarkSet): number {
  const values = Object.values(landmarks).map(v => v.visibility ?? 1);
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
