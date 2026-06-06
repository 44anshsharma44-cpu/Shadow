export interface Coordinate {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface LandmarkSet {
  nose: Coordinate;
  leftShoulder: Coordinate;
  rightShoulder: Coordinate;
  leftElbow: Coordinate;
  rightElbow: Coordinate;
  leftWrist: Coordinate;
  rightWrist: Coordinate;
  leftHip: Coordinate;
  rightHip: Coordinate;
}

export type HandSide = 'left' | 'right';

export interface HandLandmarkSet {
  wrist: Coordinate;
  indexKnuckle: Coordinate;
  middleKnuckle: Coordinate;
  palmCenter: Coordinate;
  confidence: number;
  handedness?: HandSide;
}

export interface HandTrackingPair {
  left: HandLandmarkSet | null;
  right: HandLandmarkSet | null;
}

export interface TrackingHandDebug {
  source: 'pose' | 'hand' | 'predicted' | 'stabilized';
  confidence: number;
  visibility: number;
  predictedWrist: Coordinate;
  actualWrist: Coordinate;
  palmCenter: Coordinate;
  acceleration: number;
}

export interface CameraQualityReport {
  brightness: number;
  contrast: number;
  blur: number;
  warnings: string[];
}

export interface TrackingDebugInfo {
  fps: number;
  poseConfidence: number;
  trackingConfidence: number;
  leftHand: TrackingHandDebug;
  rightHand: TrackingHandDebug;
  camera: CameraQualityReport;
  punchMode: boolean;
}

export type GestureType =
  | 'PUNCH_LEFT_JAB'
  | 'PUNCH_RIGHT_JAB'
  | 'PUNCH_LEFT_HOOK'
  | 'PUNCH_RIGHT_HOOK'
  | 'PUNCH_LEFT_UPPERCUT'
  | 'PUNCH_RIGHT_UPPERCUT'
  | 'BLOCK'
  | 'DUCK'
  | 'NONE';

export interface HandFeatures {
  velocity: {
    x: number;
    y: number;
    speed: number;
  };
  acceleration: {
    x: number;
    y: number;
    total: number;
  };
  extension: number; // angle in degrees (Shoulder-Elbow-Wrist)
  relativeToFace: Point2D; // vector distance (wrist - nose)
  relativeToShoulder: Point2D; // vector distance (wrist - shoulder)
}

export interface PoseFeatures {
  leftHand: HandFeatures;
  rightHand: HandFeatures;
  bodyHeight: number; // nose y relative to hips y midpoint
  noseY: number;
}

export interface FrameData {
  timestamp: number;
  landmarks: LandmarkSet | null;
  features: PoseFeatures | null;
  gesture: GestureType;
}
