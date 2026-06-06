import { create } from 'zustand';
import { LandmarkSet, PoseFeatures, GestureType } from '@/types/pose';

interface PoseState {
  landmarks: LandmarkSet | null;
  features: PoseFeatures | null;
  gesture: GestureType;
  fps: number;
  isModelLoading: boolean;
  isCameraActive: boolean;
  setPoseData: (landmarks: LandmarkSet | null, features: PoseFeatures | null, gesture: GestureType) => void;
  setFps: (fps: number) => void;
  setModelLoading: (loading: boolean) => void;
  setCameraActive: (active: boolean) => void;
  reset: () => void;
}

export const usePoseStore = create<PoseState>((set) => ({
  landmarks: null,
  features: null,
  gesture: 'NONE',
  fps: 0,
  isModelLoading: true,
  isCameraActive: false,

  setPoseData: (landmarks, features, gesture) => set({ landmarks, features, gesture }),
  setFps: (fps) => set({ fps }),
  setModelLoading: (loading) => set({ isModelLoading: loading }),
  setCameraActive: (active) => set({ isCameraActive: active }),

  reset: () =>
    set({
      landmarks: null,
      features: null,
      gesture: 'NONE',
      fps: 0,
    }),
}));
