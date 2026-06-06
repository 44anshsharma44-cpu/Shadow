import { Coordinate, HandSide } from '@/types/pose';

export interface PredictedMotion {
  position: Coordinate;
  velocity: Coordinate;
  acceleration: Coordinate;
  speed: number;
  accelerationMagnitude: number;
  confidence: number;
}

interface MotionSample {
  timestamp: number;
  position: Coordinate;
  velocity: Coordinate;
  acceleration: Coordinate;
}

const HISTORY_SIZE = 30;
const MAX_PREDICTION_MS = 90;

export class MotionPredictor {
  private history: Record<HandSide, MotionSample[]> = {
    left: [],
    right: [],
  };

  public update(side: HandSide, position: Coordinate, timestampMs: number, confidence: number): PredictedMotion {
    const samples = this.history[side];
    const previous = samples[samples.length - 1];
    const dt = previous ? Math.max((timestampMs - previous.timestamp) / 1000, 0.001) : 1 / 60;

    const velocity = previous
      ? coord(
          (position.x - previous.position.x) / dt,
          (position.y - previous.position.y) / dt,
          ((position.z ?? 0) - (previous.position.z ?? 0)) / dt,
          confidence
        )
      : coord(0, 0, 0, confidence);

    const acceleration = previous
      ? coord(
          (velocity.x - previous.velocity.x) / dt,
          (velocity.y - previous.velocity.y) / dt,
          ((velocity.z ?? 0) - (previous.velocity.z ?? 0)) / dt,
          confidence
        )
      : coord(0, 0, 0, confidence);

    const sample: MotionSample = { timestamp: timestampMs, position, velocity, acceleration };
    samples.push(sample);
    if (samples.length > HISTORY_SIZE) samples.shift();

    return this.predict(side, timestampMs, confidence);
  }

  public predict(side: HandSide, timestampMs: number, sourceConfidence = 0.35): PredictedMotion {
    const samples = this.history[side];
    const last = samples[samples.length - 1];
    if (!last) {
      const fallback = coord(0.5, 0.5, 0, 0);
      return {
        position: fallback,
        velocity: coord(0, 0, 0, 0),
        acceleration: coord(0, 0, 0, 0),
        speed: 0,
        accelerationMagnitude: 0,
        confidence: 0,
      };
    }

    const elapsedMs = Math.max(0, Math.min(timestampMs - last.timestamp, MAX_PREDICTION_MS));
    const dt = elapsedMs / 1000;
    const position = coord(
      clamp(last.position.x + last.velocity.x * dt + 0.5 * last.acceleration.x * dt * dt, 0, 1),
      clamp(last.position.y + last.velocity.y * dt + 0.5 * last.acceleration.y * dt * dt, 0, 1),
      (last.position.z ?? 0) + (last.velocity.z ?? 0) * dt + 0.5 * (last.acceleration.z ?? 0) * dt * dt,
      sourceConfidence
    );

    const speed = magnitude(last.velocity);
    const accelerationMagnitude = magnitude(last.acceleration);
    const agePenalty = 1 - elapsedMs / MAX_PREDICTION_MS;

    return {
      position,
      velocity: last.velocity,
      acceleration: last.acceleration,
      speed,
      accelerationMagnitude,
      confidence: clamp(sourceConfidence * 0.65 + agePenalty * 0.35, 0, 1),
    };
  }

  public reset() {
    this.history.left = [];
    this.history.right = [];
  }
}

function coord(x: number, y: number, z: number, visibility: number): Coordinate {
  return { x, y, z, visibility };
}

function magnitude(v: Coordinate): number {
  return Math.hypot(v.x, v.y, v.z ?? 0);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
