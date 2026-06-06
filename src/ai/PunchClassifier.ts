import { PoseFeatures, GestureType } from '@/types/pose';

export class PunchClassifier {
  private cooldownTimer: number = 0; // ms
  private lastTimestamp: number = 0;
  private standingHeight: number = 0.35; // calibrated standing height (nose to hip mid)
  private calibrationFrames: number = 0;
  private calibrationSum: number = 0;

  // Gesture cooldown to prevent double triggering
  private readonly PUNCH_COOLDOWN_MS = 400;

  public classify(features: PoseFeatures, timestampMs: number, sensitivity: number): GestureType {
    const dt = this.lastTimestamp > 0 ? timestampMs - this.lastTimestamp : 0;
    this.lastTimestamp = timestampMs;

    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= dt;
    }

    // 1. Calibrate standing height during the first 100 frames
    if (this.calibrationFrames < 100) {
      this.calibrationSum += features.bodyHeight;
      this.calibrationFrames++;
      this.standingHeight = this.calibrationSum / this.calibrationFrames;
    }

    // Adjust velocity thresholds based on sensitivity settings [0, 1]
    // sensitivity = 1.0 -> multiplier = 0.5 (very easy to trigger)
    // sensitivity = 0.5 -> multiplier = 1.0 (standard)
    // sensitivity = 0.0 -> multiplier = 1.8 (requires extreme speed)
    const sensMultiplier = 1.5 - sensitivity;
    
    const JAB_VELOCITY_THRESHOLD = 1.1 * sensMultiplier;
    const HOOK_VELOCITY_THRESHOLD = 1.0 * sensMultiplier;
    const UPPERCUT_VELOCITY_THRESHOLD = 0.9 * sensMultiplier;
    const BLOCK_DISTANCE_THRESHOLD = 0.16; // wrist to nose distance
    const DUCK_PERCENTAGE_THRESHOLD = 0.78; // 22% drop in height

    const { leftHand, rightHand, bodyHeight } = features;

    // Check Duck (continuous, no cooldown check)
    // nose drop relative to hips
    if (bodyHeight < this.standingHeight * DUCK_PERCENTAGE_THRESHOLD) {
      return 'DUCK';
    }

    // Check Block (continuous, no cooldown check)
    // Hands are up close to the face (nose)
    const leftDistToNose = Math.sqrt(
      leftHand.relativeToFace.x * leftHand.relativeToFace.x +
      leftHand.relativeToFace.y * leftHand.relativeToFace.y
    );
    const rightDistToNose = Math.sqrt(
      rightHand.relativeToFace.x * rightHand.relativeToFace.x +
      rightHand.relativeToFace.y * rightHand.relativeToFace.y
    );

    // If both hands are close to nose, or left and right hand are shielding the face
    // In webcams, blocking is wrists close to nose (high up y relative to hips, and low x distance)
    if (leftDistToNose < BLOCK_DISTANCE_THRESHOLD && rightDistToNose < BLOCK_DISTANCE_THRESHOLD) {
      return 'BLOCK';
    }

    // If in punch cooldown, ignore new punches
    if (this.cooldownTimer > 0) {
      return 'NONE';
    }

    // 2. Classify punches (highest priority first: Uppercut -> Hook -> Jab)
    
    // --- UPPERCUTS ---
    // High vertical speed (vy is negative because y decreases going up)
    const leftVyUp = -leftHand.velocity.y;
    const rightVyUp = -rightHand.velocity.y;

    if (leftVyUp > UPPERCUT_VELOCITY_THRESHOLD && leftHand.velocity.speed > JAB_VELOCITY_THRESHOLD) {
      // Uppercut moves upward, and hand starts lower (or hand is moving vertically faster than horizontally)
      if (Math.abs(leftHand.velocity.y) > Math.abs(leftHand.velocity.x)) {
        this.cooldownTimer = this.PUNCH_COOLDOWN_MS;
        return 'PUNCH_LEFT_UPPERCUT';
      }
    }
    if (rightVyUp > UPPERCUT_VELOCITY_THRESHOLD && rightHand.velocity.speed > JAB_VELOCITY_THRESHOLD) {
      if (Math.abs(rightHand.velocity.y) > Math.abs(rightHand.velocity.x)) {
        this.cooldownTimer = this.PUNCH_COOLDOWN_MS;
        return 'PUNCH_RIGHT_UPPERCUT';
      }
    }

    // --- HOOKS ---
    // High horizontal speed, elbow bent (extension angle between 65 and 125 degrees)
    const leftVxAbs = Math.abs(leftHand.velocity.x);
    const rightVxAbs = Math.abs(rightHand.velocity.x);

    if (
      leftVxAbs > HOOK_VELOCITY_THRESHOLD &&
      leftHand.velocity.speed > HOOK_VELOCITY_THRESHOLD &&
      leftHand.extension >= 65 &&
      leftHand.extension <= 130
    ) {
      if (leftVxAbs > Math.abs(leftHand.velocity.y)) {
        this.cooldownTimer = this.PUNCH_COOLDOWN_MS;
        return 'PUNCH_LEFT_HOOK';
      }
    }
    if (
      rightVxAbs > HOOK_VELOCITY_THRESHOLD &&
      rightHand.velocity.speed > HOOK_VELOCITY_THRESHOLD &&
      rightHand.extension >= 65 &&
      rightHand.extension <= 130
    ) {
      if (rightVxAbs > Math.abs(rightHand.velocity.y)) {
        this.cooldownTimer = this.PUNCH_COOLDOWN_MS;
        return 'PUNCH_RIGHT_HOOK';
      }
    }

    // --- JABS ---
    // Fast straight push, high extension angle (> 135 degrees)
    if (
      leftHand.velocity.speed > JAB_VELOCITY_THRESHOLD &&
      leftHand.extension > 130
    ) {
      this.cooldownTimer = this.PUNCH_COOLDOWN_MS;
      return 'PUNCH_LEFT_JAB';
    }
    if (
      rightHand.velocity.speed > JAB_VELOCITY_THRESHOLD &&
      rightHand.extension > 130
    ) {
      this.cooldownTimer = this.PUNCH_COOLDOWN_MS;
      return 'PUNCH_RIGHT_JAB';
    }

    return 'NONE';
  }

  public resetCalibration() {
    this.calibrationFrames = 0;
    this.calibrationSum = 0;
    this.standingHeight = 0.35;
    this.cooldownTimer = 0;
  }
}
export default PunchClassifier;
