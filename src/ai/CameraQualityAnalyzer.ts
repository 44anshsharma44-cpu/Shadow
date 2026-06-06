import { CameraQualityReport, HandTrackingPair, LandmarkSet } from '@/types/pose';

const SAMPLE_W = 80;
const SAMPLE_H = 60;

export class CameraQualityAnalyzer {
  private canvas: HTMLCanvasElement | null = null;
  private previousLuma: Uint8ClampedArray | null = null;

  public analyze(video: HTMLVideoElement, landmarks: LandmarkSet | null, hands: HandTrackingPair): CameraQualityReport {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = SAMPLE_W;
      this.canvas.height = SAMPLE_H;
    }

    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) {
      return { brightness: 1, contrast: 1, blur: 1, warnings: [] };
    }

    ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
    const data = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
    const luma = new Uint8ClampedArray(SAMPLE_W * SAMPLE_H);

    let sum = 0;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const y = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
      luma[p] = y;
      sum += y;
    }
    const mean = sum / luma.length;

    let variance = 0;
    for (const y of luma) variance += (y - mean) ** 2;
    const contrast = Math.sqrt(variance / luma.length) / 64;

    let edgeEnergy = 0;
    for (let y = 1; y < SAMPLE_H - 1; y++) {
      for (let x = 1; x < SAMPLE_W - 1; x++) {
        const i = y * SAMPLE_W + x;
        edgeEnergy += Math.abs(luma[i] - luma[i - 1]) + Math.abs(luma[i] - luma[i - SAMPLE_W]);
      }
    }
    const blur = edgeEnergy / ((SAMPLE_W - 2) * (SAMPLE_H - 2) * 52);

    let frameDelta = 0;
    if (this.previousLuma) {
      for (let i = 0; i < luma.length; i++) frameDelta += Math.abs(luma[i] - this.previousLuma[i]);
      frameDelta /= luma.length * 255;
    }
    this.previousLuma = luma;

    const warnings: string[] = [];
    if (mean < 72) warnings.push('Increase lighting');
    if (contrast < 0.32) warnings.push('Increase lighting');
    if (blur < 0.22 && frameDelta > 0.08) warnings.push('Reduce motion blur');
    if (!hands.left || !hands.right) warnings.push('Hands not fully visible');

    if (landmarks) {
      const shoulderWidth = Math.abs(landmarks.leftShoulder.x - landmarks.rightShoulder.x);
      const hipY = (landmarks.leftHip.y + landmarks.rightHip.y) / 2;
      if (shoulderWidth > 0.42) warnings.push('Move further back');
      if (landmarks.nose.y > 0.34 || hipY > 0.92) warnings.push('Camera angle too low');
    }

    return {
      brightness: clamp(mean / 128, 0, 1.4),
      contrast: clamp(contrast, 0, 1.4),
      blur: clamp(blur, 0, 1.4),
      warnings,
    };
  }

  public reset() {
    this.previousLuma = null;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
