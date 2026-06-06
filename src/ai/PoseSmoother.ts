import { LandmarkSet, Coordinate } from '@/types/pose';

export class PoseSmoother {
  private prevLandmarks: LandmarkSet | null = null;
  private alpha: number; // smoothing factor (0 = infinite smooth/static, 1 = no smoothing)

  constructor(alpha: number = 0.4) {
    this.alpha = alpha;
  }

  public smooth(raw: LandmarkSet): LandmarkSet {
    if (!this.prevLandmarks) {
      this.prevLandmarks = JSON.parse(JSON.stringify(raw));
      return raw;
    }

    const smoothed: LandmarkSet = {
      nose: this.smoothCoord(raw.nose, this.prevLandmarks.nose),
      leftShoulder: this.smoothCoord(raw.leftShoulder, this.prevLandmarks.leftShoulder),
      rightShoulder: this.smoothCoord(raw.rightShoulder, this.prevLandmarks.rightShoulder),
      leftElbow: this.smoothCoord(raw.leftElbow, this.prevLandmarks.leftElbow),
      rightElbow: this.smoothCoord(raw.rightElbow, this.prevLandmarks.rightElbow),
      leftWrist: this.smoothCoord(raw.leftWrist, this.prevLandmarks.leftWrist),
      rightWrist: this.smoothCoord(raw.rightWrist, this.prevLandmarks.rightWrist),
      leftHip: this.smoothCoord(raw.leftHip, this.prevLandmarks.leftHip),
      rightHip: this.smoothCoord(raw.rightHip, this.prevLandmarks.rightHip),
    };

    this.prevLandmarks = smoothed;
    return smoothed;
  }

  private smoothCoord(curr: Coordinate, prev: Coordinate): Coordinate {
    return {
      x: this.alpha * curr.x + (1 - this.alpha) * prev.x,
      y: this.alpha * curr.y + (1 - this.alpha) * prev.y,
      z: this.alpha * curr.z + (1 - this.alpha) * prev.z,
      visibility: curr.visibility !== undefined ? curr.visibility : prev.visibility,
    };
  }

  public reset() {
    this.prevLandmarks = null;
  }
}
