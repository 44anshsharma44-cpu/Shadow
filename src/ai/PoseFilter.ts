/**
 * PoseFilter.ts
 * Advanced landmark filtering combining:
 *  - Confidence threshold gating (only use landmarks with visibility > 0.75)
 *  - Exponential smoothing (EMA) per axis
 *  - Kalman-style prediction / correction between frames
 *  - Temporal averaging across a rolling window
 *  - Jitter reduction via dead-band suppression
 */

import { LandmarkSet, Coordinate } from '@/types/pose';

// ─── Kalman state per axis ────────────────────────────────────────────────────
interface KalmanAxisState {
  estimate: number;     // current estimate (x̂)
  errorCov: number;     // estimation error covariance (P)
  processNoise: number; // Q – how much the "true" value can jump per frame
  measureNoise: number; // R – sensor noise
  velocity: number;     // simple first-order velocity prediction
}

function createKalmanAxis(initial: number): KalmanAxisState {
  return {
    estimate: initial,
    errorCov: 1.0,
    processNoise: 0.0015, // relatively stable body joints
    measureNoise: 0.04,   // webcam noise level
    velocity: 0,
  };
}

function kalmanUpdate(state: KalmanAxisState, measurement: number, dt: number): number {
  // Predict
  const predicted = state.estimate + state.velocity * dt;
  const predictedCov = state.errorCov + state.processNoise;

  // Kalman gain
  const K = predictedCov / (predictedCov + state.measureNoise);

  // Correct
  const corrected = predicted + K * (measurement - predicted);
  state.velocity = (corrected - state.estimate) / Math.max(dt, 0.001);
  state.estimate = corrected;
  state.errorCov = (1 - K) * predictedCov;

  return corrected;
}

// ─── Per-landmark filter state ────────────────────────────────────────────────
interface LandmarkFilter {
  kx: KalmanAxisState;
  ky: KalmanAxisState;
  kz: KalmanAxisState;
  emaX: number;
  emaY: number;
  emaZ: number;
  history: Coordinate[]; // temporal window
  lastGoodValue: Coordinate | null;
}

// ─── Temporal window size ────────────────────────────────────────────────────
const TEMPORAL_WINDOW = 5;
const EMA_ALPHA = 0.45;          // higher = less smooth but more responsive
const CONFIDENCE_THRESHOLD = 0.75;
const DEAD_BAND = 0.003;          // ignore sub-pixel jitter (normalised coords)

// ─── Landmark names that we track ────────────────────────────────────────────
const LANDMARK_KEYS: (keyof LandmarkSet)[] = [
  'nose',
  'leftShoulder', 'rightShoulder',
  'leftElbow', 'rightElbow',
  'leftWrist', 'rightWrist',
  'leftHip', 'rightHip',
];

export class PoseFilter {
  private filters: Record<string, LandmarkFilter> = {};
  private prevTimestamp: number = 0;
  private initialized = false;

  constructor() {
    for (const key of LANDMARK_KEYS) {
      this.filters[key] = {
        kx: createKalmanAxis(0.5),
        ky: createKalmanAxis(0.5),
        kz: createKalmanAxis(0),
        emaX: 0.5,
        emaY: 0.5,
        emaZ: 0,
        history: [],
        lastGoodValue: null,
      };
    }
  }

  /**
   * Returns a filtered, high-confidence LandmarkSet.
   * Low-confidence landmarks are replaced with the last known good value (or a
   * Kalman-predicted position), preventing noise from polluting the pipeline.
   */
  public filter(raw: LandmarkSet, timestampMs: number): LandmarkSet {
    const dt = this.prevTimestamp > 0
      ? Math.min((timestampMs - this.prevTimestamp) / 1000, 0.1)
      : 0.016;
    this.prevTimestamp = timestampMs;

    const filtered: Partial<LandmarkSet> = {};

    for (const key of LANDMARK_KEYS) {
      const rawCoord = raw[key];
      const fState = this.filters[key];

      const isConfident = (rawCoord.visibility ?? 1) >= CONFIDENCE_THRESHOLD;

      let inputX = rawCoord.x;
      let inputY = rawCoord.y;
      let inputZ = rawCoord.z;

      if (!isConfident) {
        // Use Kalman prediction only (do not incorporate the measurement)
        if (fState.lastGoodValue) {
          // Still run a prediction step with no measurement correction
          inputX = fState.kx.estimate + fState.kx.velocity * dt;
          inputY = fState.ky.estimate + fState.ky.velocity * dt;
          inputZ = fState.kz.estimate + fState.kz.velocity * dt;
        } else {
          // No known good value yet – pass through with low weight
          inputX = rawCoord.x;
          inputY = rawCoord.y;
          inputZ = rawCoord.z;
        }
      } else {
        fState.lastGoodValue = rawCoord;
      }

      // 1. Kalman update
      const kx = kalmanUpdate(fState.kx, inputX, dt);
      const ky = kalmanUpdate(fState.ky, inputY, dt);
      const kz = kalmanUpdate(fState.kz, inputZ, dt);

      // 2. EMA on top of Kalman output
      fState.emaX = EMA_ALPHA * kx + (1 - EMA_ALPHA) * fState.emaX;
      fState.emaY = EMA_ALPHA * ky + (1 - EMA_ALPHA) * fState.emaY;
      fState.emaZ = EMA_ALPHA * kz + (1 - EMA_ALPHA) * fState.emaZ;

      // 3. Dead-band suppression (ignore micro-jitter)
      const prevCoord = fState.history[fState.history.length - 1];
      let fx = fState.emaX;
      let fy = fState.emaY;
      let fz = fState.emaZ;
      if (prevCoord) {
        if (Math.abs(fx - prevCoord.x) < DEAD_BAND) fx = prevCoord.x;
        if (Math.abs(fy - prevCoord.y) < DEAD_BAND) fy = prevCoord.y;
        if (Math.abs(fz - prevCoord.z) < DEAD_BAND) fz = prevCoord.z;
      }

      const filteredCoord: Coordinate = {
        x: fx,
        y: fy,
        z: fz,
        visibility: rawCoord.visibility,
      };

      // 4. Temporal history maintenance
      fState.history.push(filteredCoord);
      if (fState.history.length > TEMPORAL_WINDOW) {
        fState.history.shift();
      }

      // 5. Temporal average over history window (reduces remaining noise)
      if (fState.history.length >= 2) {
        let sx = 0, sy = 0, sz = 0;
        const n = fState.history.length;
        for (const h of fState.history) { sx += h.x; sy += h.y; sz += h.z; }
        filteredCoord.x = sx / n;
        filteredCoord.y = sy / n;
        filteredCoord.z = sz / n;
      }

      filtered[key] = filteredCoord;
    }

    this.initialized = true;
    return filtered as LandmarkSet;
  }

  /**
   * Returns the smoothed velocity for a given landmark (units/sec).
   * Derived from the Kalman filter's internal velocity estimate.
   */
  public getVelocity(key: keyof LandmarkSet): { vx: number; vy: number; vz: number } {
    const f = this.filters[key];
    return { vx: f.kx.velocity, vy: f.ky.velocity, vz: f.kz.velocity };
  }

  /** Confidence score – fraction of landmarks that were high-confidence this frame */
  public getConfidenceScore(raw: LandmarkSet): number {
    let ok = 0;
    for (const key of LANDMARK_KEYS) {
      if ((raw[key].visibility ?? 1) >= CONFIDENCE_THRESHOLD) ok++;
    }
    return ok / LANDMARK_KEYS.length;
  }

  public reset() {
    this.prevTimestamp = 0;
    this.initialized = false;
    for (const key of LANDMARK_KEYS) {
      this.filters[key].history = [];
      this.filters[key].lastGoodValue = null;
      this.filters[key].kx = createKalmanAxis(0.5);
      this.filters[key].ky = createKalmanAxis(0.5);
      this.filters[key].kz = createKalmanAxis(0);
      this.filters[key].emaX = 0.5;
      this.filters[key].emaY = 0.5;
      this.filters[key].emaZ = 0;
    }
  }
}
