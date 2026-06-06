import { FilesetResolver, HandLandmarker, HandLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { Coordinate, HandLandmarkSet, HandSide, HandTrackingPair } from '@/types/pose';

interface CandidateHand extends HandLandmarkSet {
  label: HandSide | null;
}

class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private loadingPromise: Promise<HandLandmarker> | null = null;
  private previous: HandTrackingPair = { left: null, right: null };

  public async init(modelUrl: string): Promise<HandLandmarker> {
    if (this.landmarker) return this.landmarker;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
        );
        this.landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelUrl,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.42,
          minHandPresenceConfidence: 0.42,
          minTrackingConfidence: 0.38,
        });
        return this.landmarker;
      } catch (err) {
        this.loadingPromise = null;
        console.error('Failed to initialize MediaPipe HandLandmarker:', err);
        throw err;
      }
    })();

    return this.loadingPromise;
  }

  public detect(video: HTMLVideoElement, timestamp: number): HandTrackingPair {
    if (!this.landmarker) return this.previous;
    try {
      const result = this.landmarker.detectForVideo(video, timestamp);
      const pair = this.toHandPair(result);
      this.previous = pair;
      return pair;
    } catch (e) {
      console.error('Error running MediaPipe hand detection:', e);
      return this.previous;
    }
  }

  public reset() {
    this.previous = { left: null, right: null };
  }

  public destroy() {
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
      this.loadingPromise = null;
    }
    this.reset();
  }

  private toHandPair(result: HandLandmarkerResult): HandTrackingPair {
    const candidates = result.landmarks.map((landmarks, index) => {
      const category = result.handedness?.[index]?.[0] ?? result.handednesses?.[index]?.[0];
      const label = parseHandedness(category?.categoryName);
      const confidence = category?.score ?? averageVisibility(landmarks);
      return buildHand(landmarks, confidence, label);
    });

    if (candidates.length === 0) return { left: null, right: null };
    if (candidates.length === 1) {
      const only = candidates[0];
      const side = this.resolveSingleHand(only);
      return side === 'left'
        ? { left: only, right: null }
        : { left: null, right: only };
    }

    const first = candidates[0];
    const second = candidates[1];
    const normal = assignmentCost(first, 'left', this.previous) + assignmentCost(second, 'right', this.previous);
    const swapped = assignmentCost(first, 'right', this.previous) + assignmentCost(second, 'left', this.previous);

    return normal <= swapped
      ? { left: { ...first, handedness: 'left' }, right: { ...second, handedness: 'right' } }
      : { left: { ...second, handedness: 'left' }, right: { ...first, handedness: 'right' } };
  }

  private resolveSingleHand(hand: CandidateHand): HandSide {
    if (hand.label) {
      const opposite = hand.label === 'left' ? 'right' : 'left';
      const labelCost = assignmentCost(hand, hand.label, this.previous);
      const oppositeCost = assignmentCost(hand, opposite, this.previous);
      return labelCost <= oppositeCost * 1.28 ? hand.label : opposite;
    }

    if (this.previous.left && this.previous.right) {
      return dist(hand.wrist, this.previous.left.wrist) <= dist(hand.wrist, this.previous.right.wrist) ? 'left' : 'right';
    }
    if (this.previous.left) return 'left';
    if (this.previous.right) return 'right';

    return hand.wrist.x < 0.5 ? 'left' : 'right';
  }
}

function buildHand(landmarks: NormalizedLandmark[], confidence: number, label: HandSide | null): CandidateHand {
  const wrist = toCoord(landmarks[0], confidence);
  const indexKnuckle = toCoord(landmarks[5], confidence);
  const middleKnuckle = toCoord(landmarks[9], confidence);
  const palmCenter = {
    x: (wrist.x + indexKnuckle.x + middleKnuckle.x + toCoord(landmarks[17], confidence).x) / 4,
    y: (wrist.y + indexKnuckle.y + middleKnuckle.y + toCoord(landmarks[17], confidence).y) / 4,
    z: ((wrist.z ?? 0) + (indexKnuckle.z ?? 0) + (middleKnuckle.z ?? 0) + (toCoord(landmarks[17], confidence).z ?? 0)) / 4,
    visibility: confidence,
  };

  return {
    wrist,
    indexKnuckle,
    middleKnuckle,
    palmCenter,
    confidence,
    handedness: label ?? undefined,
    label,
  };
}

function assignmentCost(hand: CandidateHand, side: HandSide, previous: HandTrackingPair): number {
  let cost = hand.label && hand.label !== side ? 0.18 : 0;
  const prev = previous[side];
  if (prev) cost += dist(hand.wrist, prev.wrist) * 1.9;
  else cost += side === 'left' ? Math.max(0, hand.wrist.x - 0.52) * 0.35 : Math.max(0, 0.48 - hand.wrist.x) * 0.35;
  return cost - hand.confidence * 0.08;
}

function parseHandedness(label: string | undefined): HandSide | null {
  const normalized = label?.toLowerCase();
  if (normalized === 'left') return 'left';
  if (normalized === 'right') return 'right';
  return null;
}

function toCoord(point: NormalizedLandmark, confidence: number): Coordinate {
  return {
    x: point.x,
    y: point.y,
    z: point.z ?? 0,
    visibility: confidence,
  };
}

function averageVisibility(landmarks: NormalizedLandmark[]): number {
  if (landmarks.length === 0) return 0;
  return landmarks.reduce((sum, point) => sum + (point.visibility ?? 0.75), 0) / landmarks.length;
}

function dist(a: Coordinate, b: Coordinate): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

export const handTracker = new HandTracker();
export default handTracker;
