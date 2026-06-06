/**
 * MotionBuffer.ts
 * Circular buffer of the last 30 frames of per-hand motion data.
 * All punch classifiers MUST consume aggregated data from this buffer,
 * never from a single frame alone. This is the primary defence against
 * false-positive punch detection.
 */

import { LandmarkSet, Coordinate } from '@/types/pose';

export interface HandMotionFrame {
  timestamp: number;      // ms
  wristPos: Coordinate;   // normalised [0,1] position
  elbowPos: Coordinate;
  shoulderPos: Coordinate;
  velocity: { x: number; y: number; speed: number };       // units/sec
  acceleration: { x: number; y: number; total: number };   // units/sec²
  elbowAngle: number;     // degrees (Shoulder-Elbow-Wrist)
  shoulderRotation: number; // horizontal offset of shoulder from baseline (normalised)
}

export interface MotionFrame {
  timestamp: number;
  left: HandMotionFrame;
  right: HandMotionFrame;
  bodyLower: number;      // hip-midpoint Y (rising = ducking)
  noseY: number;
}

const BUFFER_SIZE = 30;

export class MotionBuffer {
  private frames: MotionFrame[] = [];

  // Cached velocity for acceleration calculation
  private prevLeftVel: { x: number; y: number } = { x: 0, y: 0 };
  private prevRightVel: { x: number; y: number } = { x: 0, y: 0 };
  private prevTimestamp: number = 0;

  /** Push a new MediaPipe landmark set into the buffer. */
  public push(landmarks: LandmarkSet, timestamp: number): void {
    const dt = this.prevTimestamp > 0
      ? Math.max((timestamp - this.prevTimestamp) / 1000, 0.001)
      : 0.016;

    const prevFrame = this.frames[this.frames.length - 1];

    const left = this.buildHandFrame(
      landmarks.leftShoulder,
      landmarks.leftElbow,
      landmarks.leftWrist,
      this.prevLeftVel,
      dt,
      timestamp,
      prevFrame?.left.wristPos
    );

    const right = this.buildHandFrame(
      landmarks.rightShoulder,
      landmarks.rightElbow,
      landmarks.rightWrist,
      this.prevRightVel,
      dt,
      timestamp,
      prevFrame?.right.wristPos
    );

    const hipMidY = (landmarks.leftHip.y + landmarks.rightHip.y) / 2;

    const frame: MotionFrame = {
      timestamp,
      left,
      right,
      bodyLower: hipMidY,
      noseY: landmarks.nose.y,
    };

    this.frames.push(frame);
    if (this.frames.length > BUFFER_SIZE) this.frames.shift();

    this.prevLeftVel = { x: left.velocity.x, y: left.velocity.y };
    this.prevRightVel = { x: right.velocity.x, y: right.velocity.y };
    this.prevTimestamp = timestamp;
  }

  private buildHandFrame(
    shoulder: Coordinate,
    elbow: Coordinate,
    wrist: Coordinate,
    prevVel: { x: number; y: number },
    dt: number,
    timestamp: number,
    prevWristOverride?: Coordinate
  ): HandMotionFrame {
    // Velocity
    const prevWrist = prevWristOverride ?? wrist;
    const vx = (wrist.x - prevWrist.x) / dt;
    const vy = (wrist.y - prevWrist.y) / dt;
    const speed = Math.sqrt(vx * vx + vy * vy);

    // Acceleration
    const ax = (vx - prevVel.x) / dt;
    const ay = (vy - prevVel.y) / dt;
    const total = Math.sqrt(ax * ax + ay * ay);

    // Elbow angle (shoulder → elbow → wrist)
    const ba = { x: shoulder.x - elbow.x, y: shoulder.y - elbow.y, z: (shoulder.z ?? 0) - (elbow.z ?? 0) };
    const bc = { x: wrist.x - elbow.x, y: wrist.y - elbow.y, z: (wrist.z ?? 0) - (elbow.z ?? 0) };
    const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
    const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
    const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);
    const elbowAngle =
      magBA > 0 && magBC > 0
        ? (Math.acos(Math.max(-1, Math.min(1, dot / (magBA * magBC)))) * 180) / Math.PI
        : 90;

    // Shoulder rotation: horizontal offset of shoulder from typical midline
    const shoulderRotation = shoulder.x; // use raw X; relative change indicates rotation

    return {
      timestamp,
      wristPos: wrist,
      elbowPos: elbow,
      shoulderPos: shoulder,
      velocity: { x: vx, y: vy, speed },
      acceleration: { x: ax, y: ay, total },
      elbowAngle,
      shoulderRotation,
    };
  }

  /** Most recent frame */
  public latest(): MotionFrame | null {
    return this.frames.length ? this.frames[this.frames.length - 1] : null;
  }

  /** All frames in chronological order */
  public all(): MotionFrame[] {
    return this.frames;
  }

  /** Last N frames */
  public recent(n: number): MotionFrame[] {
    return this.frames.slice(-Math.min(n, this.frames.length));
  }

  /** Peak wrist speed over last N frames for a given side */
  public peakSpeed(side: 'left' | 'right', n = 10): number {
    return this.recent(n).reduce((max, f) => Math.max(max, f[side].velocity.speed), 0);
  }

  /** Duration in ms between first and last frame in window (useful for timing checks) */
  public windowDuration(n: number): number {
    const sliced = this.recent(n);
    if (sliced.length < 2) return 0;
    return sliced[sliced.length - 1].timestamp - sliced[0].timestamp;
  }

  public get size(): number {
    return this.frames.length;
  }

  public reset() {
    this.frames = [];
    this.prevLeftVel = { x: 0, y: 0 };
    this.prevRightVel = { x: 0, y: 0 };
    this.prevTimestamp = 0;
  }
}
