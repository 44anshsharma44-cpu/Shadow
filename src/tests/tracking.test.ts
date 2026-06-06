import { describe, expect, it } from 'vitest';
import { MotionPredictor } from '@/ai/MotionPredictor';
import { PunchTrackingMode } from '@/ai/PunchTrackingMode';
import { TrackingFusion } from '@/ai/TrackingFusion';
import { Coordinate, HandLandmarkSet, LandmarkSet } from '@/types/pose';

describe('tracking fusion pipeline', () => {
  it('predicts wrist movement from velocity and acceleration history', () => {
    const predictor = new MotionPredictor();
    predictor.update('left', c(0.30, 0.50), 0, 0.9);
    predictor.update('left', c(0.36, 0.48), 16, 0.9);
    const prediction = predictor.predict('left', 32, 0.9);

    expect(prediction.position.x).toBeGreaterThan(0.36);
    expect(prediction.speed).toBeGreaterThan(2.0);
    expect(prediction.confidence).toBeGreaterThan(0.7);
  });

  it('switches to responsive punch mode during high acceleration', () => {
    const mode = new PunchTrackingMode();
    const normal = mode.update({ left: 1, right: 1 }, 0);
    const punch = mode.update({ left: 12, right: 2 }, 16);

    expect(normal.active).toBe(false);
    expect(punch.active).toBe(true);
    expect(punch.smoothingAlpha).toBeGreaterThan(normal.smoothingAlpha);
    expect(punch.maxJump).toBeGreaterThan(normal.maxJump);
  });

  it('prioritizes confident hand landmarks over noisy pose wrists', () => {
    const fusion = new TrackingFusion();
    const pose = makePose();
    pose.leftWrist = c(0.18, 0.76, 0, 0.52);
    const hand = makeHand(0.42, 0.52, 0.94);

    const result = fusion.fuse({
      pose,
      hands: { left: hand, right: null },
      timestampMs: 100,
      fps: 60,
      camera: { brightness: 1, contrast: 1, blur: 1, warnings: [] },
    });

    expect(result.debug.leftHand.source).toBe('hand');
    expect(result.landmarks.leftWrist.x).toBeCloseTo(hand.wrist.x, 2);
    expect(result.debug.leftHand.confidence).toBeGreaterThan(0.9);
  });
});

function makePose(): LandmarkSet {
  return {
    nose: c(0.5, 0.22),
    leftShoulder: c(0.38, 0.42),
    rightShoulder: c(0.62, 0.42),
    leftElbow: c(0.34, 0.56),
    rightElbow: c(0.66, 0.56),
    leftWrist: c(0.30, 0.62),
    rightWrist: c(0.70, 0.62),
    leftHip: c(0.43, 0.82),
    rightHip: c(0.57, 0.82),
  };
}

function makeHand(x: number, y: number, confidence: number): HandLandmarkSet {
  return {
    wrist: c(x, y, 0, confidence),
    indexKnuckle: c(x + 0.025, y - 0.035, 0, confidence),
    middleKnuckle: c(x + 0.005, y - 0.045, 0, confidence),
    palmCenter: c(x + 0.008, y - 0.018, 0, confidence),
    confidence,
    handedness: 'left',
  };
}

function c(x: number, y: number, z = 0, visibility = 0.9): Coordinate {
  return { x, y, z, visibility };
}
