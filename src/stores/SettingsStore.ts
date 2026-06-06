import { create } from 'zustand';
import { GameSettings, DifficultyLevel } from '@/types/game';
import { audioManager } from '@/lib/audio';

interface SettingsState extends GameSettings {
  setDifficulty: (difficulty: DifficultyLevel) => void;
  setVolume: (volume: number) => void;
  setSensitivity: (sensitivity: number) => void;
  setCameraId: (cameraId: string) => void;
  toggleOverlay: () => void;
  loadSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  difficulty: 'MEDIUM',
  volume: 0.5,
  sensitivity: 0.5,
  cameraId: '',
  showOverlay: true,

  setDifficulty: (difficulty) => {
    set({ difficulty });
    localStorage.setItem('sb_difficulty', difficulty);
  },

  setVolume: (volume) => {
    const val = Math.max(0, Math.min(1, volume));
    set({ volume: val });
    localStorage.setItem('sb_volume', String(val));
    if (audioManager) {
      audioManager.setVolume(val);
    }
  },

  setSensitivity: (sensitivity) => {
    const val = Math.max(0, Math.min(1, sensitivity));
    set({ sensitivity: val });
    localStorage.setItem('sb_sensitivity', String(val));
  },

  setCameraId: (cameraId) => {
    set({ cameraId });
    localStorage.setItem('sb_camera_id', cameraId);
  },

  toggleOverlay: () => {
    const updated = !get().showOverlay;
    set({ showOverlay: updated });
    localStorage.setItem('sb_show_overlay', String(updated));
  },

  loadSettings: () => {
    if (typeof window === 'undefined') return;
    try {
      const difficulty = (localStorage.getItem('sb_difficulty') as DifficultyLevel) || 'MEDIUM';
      const volume = Number(localStorage.getItem('sb_volume') ?? '0.5');
      const sensitivity = Number(localStorage.getItem('sb_sensitivity') ?? '0.5');
      const cameraId = localStorage.getItem('sb_camera_id') || '';
      const showOverlay = localStorage.getItem('sb_show_overlay') !== 'false';

      set({ difficulty, volume, sensitivity, cameraId, showOverlay });
      if (audioManager) {
        audioManager.setVolume(volume);
      }
    } catch (e) {
      console.error('Failed to load settings from localStorage:', e);
    }
  },
}));
