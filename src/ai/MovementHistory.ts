/**
 * MovementHistory.ts
 * Stores per-frame feature snapshots used by PunchAnalyzer.
 * Separate from MotionBuffer (which stores raw pose data).
 * This tracks high-level punch "candidate" events with timing.
 */

import { GestureType } from '@/types/pose';

export interface PunchCandidate {
  side: 'left' | 'right';
  type: 'jab' | 'hook' | 'uppercut';
  confidence: number;    // 0–1 how confident the classifier is
  startTime: number;     // ms timestamp when this candidate started
  peakSpeed: number;
  peakAcceleration: number;
  elbowAngleAtPeak: number;
  shoulderDelta: number; // how much shoulder rotated
}

export interface MovementRecord {
  timestamp: number;
  leftSpeed: number;
  rightSpeed: number;
  leftElbowAngle: number;
  rightElbowAngle: number;
  leftShoulderX: number;
  rightShoulderX: number;
  gesture: GestureType;
}

const MAX_HISTORY = 60; // ~2 seconds at 30fps
const MAX_CANDIDATES = 5;

export class MovementHistory {
  private records: MovementRecord[] = [];
  private candidates: PunchCandidate[] = [];
  private lastFiredGesture: GestureType = 'NONE';
  private lastFiredTime: number = 0;

  // Minimum ms between gestures of the same type (anti-double-fire)
  private readonly GESTURE_COOLDOWN = 350;

  public addRecord(record: MovementRecord) {
    this.records.push(record);
    if (this.records.length > MAX_HISTORY) this.records.shift();
  }

  public addCandidate(candidate: PunchCandidate) {
    this.candidates.push(candidate);
    if (this.candidates.length > MAX_CANDIDATES) this.candidates.shift();
  }

  public recent(n: number): MovementRecord[] {
    return this.records.slice(-Math.min(n, this.records.length));
  }

  public all(): MovementRecord[] {
    return [...this.records];
  }

  /** Returns average speed over the last N records for a given side */
  public avgSpeed(side: 'left' | 'right', n = 8): number {
    const slice = this.recent(n);
    if (!slice.length) return 0;
    const key = side === 'left' ? 'leftSpeed' : 'rightSpeed';
    return slice.reduce((s, r) => s + r[key], 0) / slice.length;
  }

  /** Returns average elbow angle delta over last N records */
  public avgElbowAngle(side: 'left' | 'right', n = 8): number {
    const slice = this.recent(n);
    if (!slice.length) return 90;
    const key = side === 'left' ? 'leftElbowAngle' : 'rightElbowAngle';
    return slice.reduce((s, r) => s + r[key], 0) / slice.length;
  }

  /** Returns shoulder rotation delta (max - min X) over last N frames */
  public shoulderRotationDelta(side: 'left' | 'right', n = 10): number {
    const slice = this.recent(n);
    if (slice.length < 2) return 0;
    const key = side === 'left' ? 'leftShoulderX' : 'rightShoulderX';
    const vals = slice.map(r => r[key]);
    return Math.max(...vals) - Math.min(...vals);
  }

  /** 
   * Returns duration (ms) during which speed was above the threshold,
   * used to ensure punch lasted 100-500ms.
   */
  public speedAboveThresholdDuration(
    side: 'left' | 'right',
    threshold: number
  ): number {
    const key = side === 'left' ? 'leftSpeed' : 'rightSpeed';
    const highFrames = this.records.filter(r => r[key] > threshold);
    if (highFrames.length < 2) return 0;
    return highFrames[highFrames.length - 1].timestamp - highFrames[0].timestamp;
  }

  /** Whether this gesture was recently fired (cooldown guard) */
  public isOnCooldown(gesture: GestureType, nowMs: number): boolean {
    if (gesture === this.lastFiredGesture) {
      return nowMs - this.lastFiredTime < this.GESTURE_COOLDOWN;
    }
    return false;
  }

  public recordFiredGesture(gesture: GestureType, nowMs: number) {
    this.lastFiredGesture = gesture;
    this.lastFiredTime = nowMs;
  }

  public get lastGesture(): GestureType {
    return this.records.length ? this.records[this.records.length - 1].gesture : 'NONE';
  }

  public reset() {
    this.records = [];
    this.candidates = [];
    this.lastFiredGesture = 'NONE';
    this.lastFiredTime = 0;
  }
}
