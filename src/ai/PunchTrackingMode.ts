import { HandSide } from '@/types/pose';

export interface PunchModeState {
  active: boolean;
  smoothingAlpha: number;
  processNoise: number;
  maxJump: number;
}

const ENTER_ACCEL = 8.5;
const EXIT_ACCEL = 3.2;
const HOLD_MS = 180;

export class PunchTrackingMode {
  private active = false;
  private lastHighAccelerationMs = 0;

  public update(accelerationBySide: Record<HandSide, number>, timestampMs: number): PunchModeState {
    const peak = Math.max(accelerationBySide.left, accelerationBySide.right);
    if (peak >= ENTER_ACCEL) {
      this.active = true;
      this.lastHighAccelerationMs = timestampMs;
    } else if (this.active && peak < EXIT_ACCEL && timestampMs - this.lastHighAccelerationMs > HOLD_MS) {
      this.active = false;
    }

    return this.current();
  }

  public current(): PunchModeState {
    return this.active
      ? { active: true, smoothingAlpha: 0.86, processNoise: 0.018, maxJump: 0.20 }
      : { active: false, smoothingAlpha: 0.58, processNoise: 0.006, maxJump: 0.075 };
  }

  public reset() {
    this.active = false;
    this.lastHighAccelerationMs = 0;
  }
}
