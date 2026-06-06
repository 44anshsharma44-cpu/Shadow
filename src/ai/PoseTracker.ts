import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

class PoseTracker {
  private landmarker: PoseLandmarker | null = null;
  private loadingPromise: Promise<PoseLandmarker> | null = null;

  public async init(modelUrl: string): Promise<PoseLandmarker> {
    if (this.landmarker) return this.landmarker;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
        );
        this.landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelUrl,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
        return this.landmarker;
      } catch (err) {
        this.loadingPromise = null;
        console.error('Failed to initialize MediaPipe PoseLandmarker:', err);
        throw err;
      }
    })();

    return this.loadingPromise;
  }

  public detect(video: HTMLVideoElement, timestamp: number) {
    if (!this.landmarker) return null;
    try {
      return this.landmarker.detectForVideo(video, timestamp);
    } catch (e) {
      console.error('Error running MediaPipe detection:', e);
      return null;
    }
  }

  public destroy() {
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
      this.loadingPromise = null;
    }
  }
}

export const poseTracker = new PoseTracker();
export default poseTracker;
