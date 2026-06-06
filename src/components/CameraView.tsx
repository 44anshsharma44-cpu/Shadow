'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { usePoseStore } from '@/stores/PoseStore';
import { useSettingsStore } from '@/stores/SettingsStore';
import { poseTracker } from '@/ai/PoseTracker';
import { handTracker } from '@/ai/HandTracker';
import { TrackingFusion } from '@/ai/TrackingFusion';
import { CameraQualityAnalyzer } from '@/ai/CameraQualityAnalyzer';
import { PunchAnalyzer } from '@/ai/PunchAnalyzer';
import { MovementEventManager } from '@/ai/MovementEvents';
import { handAvatarMapper } from '@/ai/HandAvatarMapper';
import {
  LandmarkSet,
  GestureType,
  Coordinate,
  HandTrackingPair,
  TrackingDebugInfo,
  TrackingHandDebug,
  HandLandmarkSet,
} from '@/types/pose';
import { Loader2, VideoOff, Layers, RefreshCw } from 'lucide-react';

// ─── Debug overlay component (rendered in React, outside canvas) ──────────────
function DebugPanel({ info }: { info: Record<string, string | number> }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        background: 'rgba(0,0,0,0.75)',
        color: '#45f3ff',
        fontFamily: 'monospace',
        fontSize: 10,
        padding: '6px 10px',
        borderRadius: 6,
        zIndex: 50,
        lineHeight: 1.7,
        pointerEvents: 'none',
        minWidth: 180,
      }}
    >
      {Object.entries(info).map(([k, v]) => (
        <div key={k}>
          <span style={{ color: '#888' }}>{k}:</span>{' '}
          <span style={{ color: typeof v === 'number' && (v as number) > 0.5 ? '#ff007f' : '#45f3ff' }}>
            {typeof v === 'number' ? (v as number).toFixed(3) : v}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CameraView() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<Record<string, string | number>>({});

  const { cameraId, sensitivity, showOverlay } = useSettingsStore();
  const { isModelLoading, setModelLoading, setCameraActive, setFps, setPoseData } = usePoseStore();
  const { stream, error: cameraError, isActive } = useCamera(cameraId);

  // ── Pipeline instances (persistent across frames) ──────────────────────────
  const fusionRef      = useRef(new TrackingFusion());
  const qualityRef     = useRef(new CameraQualityAnalyzer());
  const analyzerRef    = useRef(new PunchAnalyzer());
  const eventsRef      = useRef(new MovementEventManager());

  // FPS tracking
  const lastFpsTimeRef = useRef(0);
  const frameCountRef  = useRef(0);
  const currentFpsRef  = useRef(0);

  // Whether to show debug overlay (URL param ?overlay=1 or dev mode)
  const showDebugOverlay = typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('overlay') === '1' ||
     new URLSearchParams(window.location.search).get('debug') === '1');

  useEffect(() => {
    setCameraActive(isActive);
  }, [isActive, setCameraActive]);

  // ── Load MediaPipe model ───────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const loadModel = async () => {
      setModelLoading(true);
      setModelError(null);
      try {
        const modelUrl =
          process.env.NEXT_PUBLIC_MEDIAPIPE_MODEL_URL ||
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
        const handModelUrl =
          process.env.NEXT_PUBLIC_MEDIAPIPE_HAND_MODEL_URL ||
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
        await Promise.all([
          poseTracker.init(modelUrl),
          handTracker.init(handModelUrl),
        ]);
        if (active) setModelLoading(false);
      } catch (err: unknown) {
        console.error('Failed to load MediaPipe model:', err);
        if (active) {
          setModelError('Failed to load AI tracking models. Please check internet access.');
          setModelLoading(false);
        }
      }
    };
    loadModel();
    return () => { active = false; };
  }, [setModelLoading]);

  const resetPipeline = () => {
    fusionRef.current.reset();
    qualityRef.current.reset();
    analyzerRef.current.reset();
    eventsRef.current.reset();
    handTracker.reset();
    handAvatarMapper.reset();
  };

  // ── Main processing loop ───────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream || isModelLoading || modelError) return;

    video.srcObject = stream;
    video.onloadedmetadata = () => {
      video.play().catch(e => console.error('Video play interrupted:', e));
      resetPipeline();
    };

    let frameId: number | null = null;
    lastFpsTimeRef.current = performance.now();
    frameCountRef.current = 0;

    const processFrame = () => {
      if (video.paused || video.ended) return;

      const now = performance.now();

      // FPS counter
      frameCountRef.current++;
      if (now - lastFpsTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        currentFpsRef.current = frameCountRef.current;
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }

      // ── MediaPipe inference ──────────────────────────────────────────────
      const results = poseTracker.detect(video, now);
      const trackedHands = handTracker.detect(video, now);
      const canvas  = canvasRef.current;
      const ctx     = canvas?.getContext('2d');

      if (results?.landmarks?.[0]) {
        const rawLandmarks = results.landmarks[0];

        // Map MediaPipe indices → our LandmarkSet
        const mapped: LandmarkSet = {
          nose:          rawLandmarks[0]  as Coordinate,
          leftShoulder:  rawLandmarks[11] as Coordinate,
          rightShoulder: rawLandmarks[12] as Coordinate,
          leftElbow:     rawLandmarks[13] as Coordinate,
          rightElbow:    rawLandmarks[14] as Coordinate,
          leftWrist:     rawLandmarks[15] as Coordinate,
          rightWrist:    rawLandmarks[16] as Coordinate,
          leftHip:       rawLandmarks[23] as Coordinate,
          rightHip:      rawLandmarks[24] as Coordinate,
        };

        // ── Stage 1: Camera quality + pose/hand fusion ─────────────────────
        const cameraQuality = qualityRef.current.analyze(video, mapped, trackedHands);
        const fusion = fusionRef.current.fuse({
          pose: mapped,
          hands: trackedHands,
          timestampMs: now,
          camera: cameraQuality,
          fps: currentFpsRef.current,
        });
        const filtered = fusion.landmarks;
        const confidence = fusion.debug.trackingConfidence;

        // ── Stage 2: Multi-feature punch analysis (uses MotionBuffer) ──────
        const gesture = analyzerRef.current.analyze(filtered, now, sensitivity);

        // ── Stage 3: Dispatch to game engine ───────────────────────────────
        eventsRef.current.processGesture(gesture);

        // ── Stage 4: Update PoseStore ───────────────────────────────────────
        // Build a lightweight PoseFeatures-compatible object for the store
        const debugAnalysis = analyzerRef.current.getDebugInfo();
        const fakeFeatures = {
          leftHand: {
            velocity: { x: debugAnalysis?.leftSpeed ?? 0, y: 0, speed: debugAnalysis?.leftSpeed ?? 0 },
            acceleration: { x: 0, y: 0, total: fusion.debug.leftHand.acceleration },
            extension: debugAnalysis?.leftElbow ?? 90,
            relativeToFace: { x: filtered.leftWrist.x - filtered.nose.x, y: filtered.leftWrist.y - filtered.nose.y },
            relativeToShoulder: { x: filtered.leftWrist.x - filtered.leftShoulder.x, y: filtered.leftWrist.y - filtered.leftShoulder.y },
          },
          rightHand: {
            velocity: { x: debugAnalysis?.rightSpeed ?? 0, y: 0, speed: debugAnalysis?.rightSpeed ?? 0 },
            acceleration: { x: 0, y: 0, total: fusion.debug.rightHand.acceleration },
            extension: debugAnalysis?.rightElbow ?? 90,
            relativeToFace: { x: filtered.rightWrist.x - filtered.nose.x, y: filtered.rightWrist.y - filtered.nose.y },
            relativeToShoulder: { x: filtered.rightWrist.x - filtered.rightShoulder.x, y: filtered.rightWrist.y - filtered.rightShoulder.y },
          },
          bodyHeight: (filtered.leftHip.y + filtered.rightHip.y) / 2 - filtered.nose.y,
          noseY: filtered.nose.y,
        };

        setPoseData(filtered, fakeFeatures, gesture);

        // ── Stage 4b: Update avatar mapper (drives GameCanvas glove positions) ─
        handAvatarMapper.map(filtered, fusion.hands, true, fusion.debug);

        // ── Stage 5: Debug overlay ──────────────────────────────────────────
        if (showDebugOverlay && debugAnalysis) {
          setDebugInfo({
            'Gesture': gesture,
            'Tracking': confidence,
            'Pose': fusion.debug.poseConfidence,
            'L Hand': fusion.debug.leftHand.confidence,
            'R Hand': fusion.debug.rightHand.confidence,
            'L Visibility': fusion.debug.leftHand.visibility,
            'R Visibility': fusion.debug.rightHand.visibility,
            'Mode': fusion.debug.punchMode ? 'PUNCH' : 'NORMAL',
            'FPS': fusion.debug.fps,
            'Brightness': fusion.debug.camera.brightness,
            'Contrast': fusion.debug.camera.contrast,
            'Blur': fusion.debug.camera.blur,
            'Warnings': fusion.debug.camera.warnings.join(', ') || '-',
            'L Speed': debugAnalysis.leftSpeed,
            'R Speed': debugAnalysis.rightSpeed,
            'L Elbow°': debugAnalysis.leftElbow,
            'R Elbow°': debugAnalysis.rightElbow,
            'L Curve': debugAnalysis.leftCurvature,
            'R Curve': debugAnalysis.rightCurvature,
            'L Shoulder Δ': debugAnalysis.leftShoulderDelta,
            'R Shoulder Δ': debugAnalysis.rightShoulderDelta,
            'L Traj': debugAnalysis.leftTrajectory,
            'R Traj': debugAnalysis.rightTrajectory,
            'Block frames': debugAnalysis.blockFrameCount,
          });
        }

        // ── Stage 6: Skeleton overlay on camera canvas ──────────────────────
        if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (showOverlay) {
            drawSkeletonOverlay(ctx, canvas.width, canvas.height, filtered, fusion.hands, fusion.debug, gesture, confidence);
          }
        }
      } else {
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        setPoseData(null, null, 'NONE');
        handAvatarMapper.map(null, null, false);
      }

      frameId = requestAnimationFrame(processFrame);
    };

    video.onplay = () => {
      frameId = requestAnimationFrame(processFrame);
    };

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      if (video) {
        video.pause();
        video.srcObject = null;
      }
    };
  }, [stream, isModelLoading, modelError, sensitivity, showOverlay, setFps, setPoseData, showDebugOverlay]);

  return (
    <div className="relative border border-[#1f2833]/40 bg-[#0f111a] rounded-3xl overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] aspect-[4/3] w-full max-w-[360px] mx-auto">
      {/* Video input (mirrored) */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full h-full object-cover scale-x-[-1]"
        style={{ display: stream ? 'block' : 'none' }}
      />

      {/* Skeleton canvas overlay */}
      <canvas
        ref={canvasRef}
        width={360}
        height={270}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        style={{ display: stream ? 'block' : 'none' }}
      />

      {/* Debug overlay panel */}
      {showDebugOverlay && Object.keys(debugInfo).length > 0 && (
        <DebugPanel info={debugInfo} />
      )}

      {/* Loading */}
      {isModelLoading && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center">
          <Loader2 className="w-8 h-8 text-[#45f3ff] animate-spin mb-3" />
          <p className="text-sm font-extrabold tracking-widest text-[#45f3ff] animate-pulse">
            LOADING AI MODEL...
          </p>
          <p className="text-xs text-gray-500 mt-1">Downloading MediaPipe landmarker (~6MB)</p>
        </div>
      )}

      {/* Model error */}
      {!isModelLoading && modelError && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-4 text-center">
          <Layers className="w-8 h-8 text-red-500 mb-2" />
          <p className="text-sm font-bold text-red-400">{modelError}</p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs px-3 py-1.5 rounded-lg border border-red-500/20 mt-3 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reload Page
          </button>
        </div>
      )}

      {/* No camera stream */}
      {!isModelLoading && !modelError && !stream && (
        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-4 text-center">
          <VideoOff className="w-8 h-8 text-gray-500 mb-2 animate-pulse" />
          {cameraError ? (
            <>
              <p className="text-sm font-bold text-red-400">Webcam Blocked</p>
              <p className="text-xs text-gray-500 mt-1 max-w-[240px]">
                Please allow camera access in your browser settings to play.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-gray-300">Webcam Required</p>
              <p className="text-xs text-gray-500 mt-1 max-w-[240px]">
                Stand in front of the camera and authorise stream prompts.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function drawSkeletonOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  joints: LandmarkSet,
  hands: HandTrackingPair,
  trackingDebug: TrackingDebugInfo,
  gesture: GestureType,
  confidence: number
) {
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1); // mirror to match webcam flip

  const drawJoint = (j: Coordinate, radius = 5, color = '#45f3ff') => {
    if ((j.visibility ?? 1) < 0.5) return;
    ctx.beginPath();
    ctx.arc(j.x * w, j.y * h, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowBlur = 12;
    ctx.shadowColor = color;
    ctx.fill();
  };

  const drawLink = (j1: Coordinate, j2: Coordinate, color = 'rgba(255,255,255,0.35)', width = 2) => {
    if ((j1.visibility ?? 1) < 0.5 || (j2.visibility ?? 1) < 0.5) return;
    ctx.beginPath();
    ctx.moveTo(j1.x * w, j1.y * h);
    ctx.lineTo(j2.x * w, j2.y * h);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowBlur = 0;
    ctx.stroke();
  };

  const skeletonColor = confidence > 0.75 ? '#45f3ff' : '#ffaa00';

  drawLink(joints.leftShoulder, joints.rightShoulder, skeletonColor, 3);
  drawLink(joints.leftShoulder, joints.leftElbow, skeletonColor);
  drawLink(joints.leftElbow, joints.leftWrist, skeletonColor);
  drawLink(joints.rightShoulder, joints.rightElbow, skeletonColor);
  drawLink(joints.rightElbow, joints.rightWrist, skeletonColor);
  drawLink(joints.leftShoulder, joints.leftHip);
  drawLink(joints.rightShoulder, joints.rightHip);
  drawLink(joints.leftHip, joints.rightHip);

  Object.values(joints).forEach(j => drawJoint(j, 5, skeletonColor));
  drawJoint(joints.nose, 8, '#ffffff');

  drawHandLandmarks(ctx, w, h, hands.left, trackingDebug.leftHand.confidence);
  drawHandLandmarks(ctx, w, h, hands.right, trackingDebug.rightHand.confidence);
  drawTrackedWrist(ctx, w, h, trackingDebug.leftHand);
  drawTrackedWrist(ctx, w, h, trackingDebug.rightHand);

  if (gesture !== 'NONE') {
    ctx.restore();
    ctx.save();
    const isPunch = gesture.startsWith('PUNCH');
    ctx.fillStyle = isPunch ? '#ff007f' : '#45f3ff';
    ctx.font = 'bold 15px monospace';
    ctx.shadowBlur = 12;
    ctx.shadowColor = ctx.fillStyle;
    ctx.fillText(`▶ ${gesture.replace('PUNCH_', '').replace('_', ' ')}`, 12, h - 14);
  }

  ctx.restore();
}

function drawHandLandmarks(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  hand: HandLandmarkSet | null,
  confidence: number
) {
  if (!hand) return;
  const color = reliabilityColor(confidence);
  const points = [hand.wrist, hand.indexKnuckle, hand.middleKnuckle, hand.palmCenter];
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowBlur = 10;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.moveTo(hand.wrist.x * w, hand.wrist.y * h);
  ctx.lineTo(hand.indexKnuckle.x * w, hand.indexKnuckle.y * h);
  ctx.moveTo(hand.wrist.x * w, hand.wrist.y * h);
  ctx.lineTo(hand.middleKnuckle.x * w, hand.middleKnuckle.y * h);
  ctx.stroke();
  for (const point of points) {
    ctx.beginPath();
    ctx.arc(point.x * w, point.y * h, point === hand.palmCenter ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTrackedWrist(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  hand: TrackingHandDebug
) {
  const color = reliabilityColor(hand.visibility);
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.shadowBlur = 12;
  ctx.shadowColor = color;

  ctx.beginPath();
  ctx.arc(hand.actualWrist.x * w, hand.actualWrist.y * h, 6, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(hand.predictedWrist.x * w, hand.predictedWrist.y * h, 5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(hand.actualWrist.x * w, hand.actualWrist.y * h);
  ctx.lineTo(hand.predictedWrist.x * w, hand.predictedWrist.y * h);
  ctx.stroke();
  ctx.restore();
}

function reliabilityColor(score: number): string {
  if (score >= 0.72) return '#35ff82';
  if (score >= 0.42) return '#ffcc33';
  return '#ff4d5a';
}

export default CameraView;
