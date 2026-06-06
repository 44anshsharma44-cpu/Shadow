import { LandmarkSet, Coordinate, PoseFeatures, HandFeatures } from '@/types/pose';

export class FeatureExtractor {
  private prevLandmarks: LandmarkSet | null = null;
  private prevTimestamp: number | null = null;
  private prevFeatures: PoseFeatures | null = null;

  public extract(landmarks: LandmarkSet, timestampMs: number): PoseFeatures {
    const dt = this.prevTimestamp !== null ? (timestampMs - this.prevTimestamp) / 1000 : 0.016; // default to 60fps if first frame
    const dtSec = dt > 0 ? dt : 0.016;

    // Calculate left hand features
    const leftHand = this.calculateHandFeatures(
      landmarks.leftShoulder,
      landmarks.leftElbow,
      landmarks.leftWrist,
      landmarks.nose,
      this.prevLandmarks?.leftWrist,
      this.prevFeatures?.leftHand,
      dtSec
    );

    // Calculate right hand features
    const rightHand = this.calculateHandFeatures(
      landmarks.rightShoulder,
      landmarks.rightElbow,
      landmarks.rightWrist,
      landmarks.nose,
      this.prevLandmarks?.rightWrist,
      this.prevFeatures?.rightHand,
      dtSec
    );

    // Calculate body height (vertical distance from nose to midpoint of hips)
    const hipMidpointY = (landmarks.leftHip.y + landmarks.rightHip.y) / 2;
    const bodyHeight = hipMidpointY - landmarks.nose.y;

    const features: PoseFeatures = {
      leftHand,
      rightHand,
      bodyHeight,
      noseY: landmarks.nose.y,
    };

    // Cache current state for next frame calculation
    this.prevLandmarks = JSON.parse(JSON.stringify(landmarks));
    this.prevTimestamp = timestampMs;
    this.prevFeatures = features;

    return features;
  }

  private calculateHandFeatures(
    shoulder: Coordinate,
    elbow: Coordinate,
    wrist: Coordinate,
    nose: Coordinate,
    prevWrist: Coordinate | undefined,
    prevHandFeat: HandFeatures | undefined,
    dt: number
  ): HandFeatures {
    // 1. Velocity (units/sec)
    let vx = 0;
    let vy = 0;
    let speed = 0;
    if (prevWrist) {
      vx = (wrist.x - prevWrist.x) / dt;
      vy = (wrist.y - prevWrist.y) / dt;
      speed = Math.sqrt(vx * vx + vy * vy);
    }

    // 2. Acceleration (units/sec^2)
    let ax = 0;
    let ay = 0;
    let accelTotal = 0;
    if (prevHandFeat) {
      ax = (vx - prevHandFeat.velocity.x) / dt;
      ay = (vy - prevHandFeat.velocity.y) / dt;
      accelTotal = Math.sqrt(ax * ax + ay * ay);
    }

    // 3. Arm Extension Angle (cosine rule on elbow)
    // vectors BA (elbow -> shoulder) and BC (elbow -> wrist)
    const ba = { x: shoulder.x - elbow.x, y: shoulder.y - elbow.y, z: shoulder.z - elbow.z };
    const bc = { x: wrist.x - elbow.x, y: wrist.y - elbow.y, z: wrist.z - elbow.z };

    const dotProduct = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
    const magBa = Math.sqrt(ba.x * ba.x + ba.y * ba.y + ba.z * ba.z);
    const magBc = Math.sqrt(bc.x * bc.x + bc.y * bc.y + bc.z * bc.z);

    let angle = 90; // fallback default
    if (magBa > 0 && magBc > 0) {
      const cosTheta = Math.max(-1, Math.min(1, dotProduct / (magBa * magBc)));
      angle = (Math.acos(cosTheta) * 180) / Math.PI;
    }

    // 4. Relative positions
    const relativeToFace = {
      x: wrist.x - nose.x,
      y: wrist.y - nose.y,
    };

    const relativeToShoulder = {
      x: wrist.x - shoulder.x,
      y: wrist.y - shoulder.y,
    };

    return {
      velocity: { x: vx, y: vy, speed },
      acceleration: { x: ax, y: ay, total: accelTotal },
      extension: angle,
      relativeToFace,
      relativeToShoulder,
    };
  }

  public reset() {
    this.prevLandmarks = null;
    this.prevTimestamp = null;
    this.prevFeatures = null;
  }
}
