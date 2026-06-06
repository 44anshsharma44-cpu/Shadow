import { describe, it, expect, beforeEach } from 'vitest';
import { PunchClassifier } from '@/ai/PunchClassifier';
import { PoseFeatures } from '@/types/pose';

describe('PunchClassifier Gesture Recognition Tests', () => {
  let classifier: PunchClassifier;

  beforeEach(() => {
    classifier = new PunchClassifier();
    
    // Seed some initial frames to calibrate standing height
    const neutralFeatures: PoseFeatures = {
      leftHand: {
        velocity: { x: 0, y: 0, speed: 0 },
        acceleration: { x: 0, y: 0, total: 0 },
        extension: 90,
        relativeToFace: { x: 0.25, y: 0.15 },
        relativeToShoulder: { x: 0.25, y: 0.25 },
      },
      rightHand: {
        velocity: { x: 0, y: 0, speed: 0 },
        acceleration: { x: 0, y: 0, total: 0 },
        extension: 90,
        relativeToFace: { x: -0.25, y: 0.15 },
        relativeToShoulder: { x: -0.25, y: 0.25 },
      },
      bodyHeight: 0.4, // standard standing height
      noseY: 0.2,
    };

    for (let i = 0; i < 110; i++) {
      classifier.classify(neutralFeatures, i * 16, 0.5); // calibrate
    }
  });

  it('should classify JAB when wrist velocity is high and arm is fully extended', () => {
    const jabFeatures: PoseFeatures = {
      leftHand: {
        velocity: { x: 1.5, y: 0.1, speed: 1.5 },
        acceleration: { x: 10, y: 0, total: 10 },
        extension: 140, // straight extended
        relativeToFace: { x: 0.45, y: 0.1 },
        relativeToShoulder: { x: 0.45, y: 0.1 },
      },
      rightHand: {
        velocity: { x: 0, y: 0, speed: 0 },
        acceleration: { x: 0, y: 0, total: 0 },
        extension: 95,
        relativeToFace: { x: -0.25, y: 0.15 },
        relativeToShoulder: { x: -0.25, y: 0.25 },
      },
      bodyHeight: 0.4,
      noseY: 0.2,
    };

    const gesture = classifier.classify(jabFeatures, 2000, 0.5);
    expect(gesture).toBe('PUNCH_LEFT_JAB');
  });

  it('should classify HOOK when wrist horizontal velocity is high and elbow is bent', () => {
    const hookFeatures: PoseFeatures = {
      leftHand: {
        velocity: { x: 0, y: 0, speed: 0 },
        acceleration: { x: 0, y: 0, total: 0 },
        extension: 95,
        relativeToFace: { x: 0.25, y: 0.15 },
        relativeToShoulder: { x: 0.25, y: 0.25 },
      },
      rightHand: {
        velocity: { x: -1.3, y: 0.1, speed: 1.3 }, // moving left fast
        acceleration: { x: -8, y: 0, total: 8 },
        extension: 90, // bent elbow hook range
        relativeToFace: { x: -0.1, y: 0.1 },
        relativeToShoulder: { x: -0.1, y: 0.1 },
      },
      bodyHeight: 0.4,
      noseY: 0.2,
    };

    const gesture = classifier.classify(hookFeatures, 2500, 0.5);
    expect(gesture).toBe('PUNCH_RIGHT_HOOK');
  });

  it('should classify UPPERCUT when wrist Y velocity is accelerating upward', () => {
    const uppercutFeatures: PoseFeatures = {
      leftHand: {
        velocity: { x: 0.2, y: -1.2, speed: 1.25 }, // vy negative means moving UP on screen
        acceleration: { x: 0, y: -15, total: 15 },
        extension: 110,
        relativeToFace: { x: 0.15, y: 0.1 },
        relativeToShoulder: { x: 0.15, y: 0.0 },
      },
      rightHand: {
        velocity: { x: 0, y: 0, speed: 0 },
        acceleration: { x: 0, y: 0, total: 0 },
        extension: 95,
        relativeToFace: { x: -0.25, y: 0.15 },
        relativeToShoulder: { x: -0.25, y: 0.25 },
      },
      bodyHeight: 0.4,
      noseY: 0.2,
    };

    const gesture = classifier.classify(uppercutFeatures, 3000, 0.5);
    expect(gesture).toBe('PUNCH_LEFT_UPPERCUT');
  });

  it('should classify BLOCK when hands are shields near the face', () => {
    const blockFeatures: PoseFeatures = {
      leftHand: {
        velocity: { x: 0, y: 0, speed: 0 },
        acceleration: { x: 0, y: 0, total: 0 },
        extension: 85,
        relativeToFace: { x: 0.08, y: 0.05 }, // close to nose
        relativeToShoulder: { x: 0.08, y: -0.15 },
      },
      rightHand: {
        velocity: { x: 0, y: 0, speed: 0 },
        acceleration: { x: 0, y: 0, total: 0 },
        extension: 85,
        relativeToFace: { x: -0.08, y: 0.05 }, // close to nose
        relativeToShoulder: { x: -0.08, y: -0.15 },
      },
      bodyHeight: 0.4,
      noseY: 0.2,
    };

    const gesture = classifier.classify(blockFeatures, 3500, 0.5);
    expect(gesture).toBe('BLOCK');
  });

  it('should classify DUCK when body height drops below baseline', () => {
    const duckFeatures: PoseFeatures = {
      leftHand: {
        velocity: { x: 0, y: 0, speed: 0 },
        acceleration: { x: 0, y: 0, total: 0 },
        extension: 90,
        relativeToFace: { x: 0.25, y: 0.15 },
        relativeToShoulder: { x: 0.25, y: 0.25 },
      },
      rightHand: {
        velocity: { x: 0, y: 0, speed: 0 },
        acceleration: { x: 0, y: 0, total: 0 },
        extension: 90,
        relativeToFace: { x: -0.25, y: 0.15 },
        relativeToShoulder: { x: -0.25, y: 0.25 },
      },
      bodyHeight: 0.28, // drops below standingHeight (0.4) * 0.78 = 0.312
      noseY: 0.35,
    };

    const gesture = classifier.classify(duckFeatures, 4000, 0.5);
    expect(gesture).toBe('DUCK');
  });
});
