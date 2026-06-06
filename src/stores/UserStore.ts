import { create } from 'zustand';

interface UserProfile {
  id: string;
  name: string | null;
  email: string;
}

interface LocalStats {
  totalMatches: number;
  wins: number;
  losses: number;
  bestCombo: number;
  highestScore: number;
  accuracySum: number;
}

interface UserState {
  user: UserProfile | null;
  isGuest: boolean;
  guestName: string;
  stats: LocalStats;
  setUser: (user: UserProfile | null) => void;
  setGuest: (active: boolean, name?: string) => void;
  updateStats: (score: number, combo: number, accuracy: number, isWin: boolean) => void;
  loadStats: () => void;
  logout: () => void;
}

const DEFAULT_STATS: LocalStats = {
  totalMatches: 0,
  wins: 0,
  losses: 0,
  bestCombo: 0,
  highestScore: 0,
  accuracySum: 0,
};

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  isGuest: false,
  guestName: 'Guest Boxer',
  stats: DEFAULT_STATS,

  setUser: (user) => set({ user, isGuest: false }),

  setGuest: (active, name) => {
    set({ isGuest: active, user: null, guestName: name || 'Guest Boxer' });
    if (active) {
      localStorage.setItem('sb_is_guest', 'true');
      localStorage.setItem('sb_guest_name', name || 'Guest Boxer');
    } else {
      localStorage.removeItem('sb_is_guest');
      localStorage.removeItem('sb_guest_name');
    }
  },

  updateStats: (score, combo, accuracy, isWin) => {
    const currentStats = get().stats;
    const totalMatches = currentStats.totalMatches + 1;
    const wins = currentStats.wins + (isWin ? 1 : 0);
    const losses = currentStats.losses + (isWin ? 0 : 1);
    const bestCombo = Math.max(currentStats.bestCombo, combo);
    const highestScore = Math.max(currentStats.highestScore, score);
    const accuracySum = currentStats.accuracySum + accuracy;

    const newStats = {
      totalMatches,
      wins,
      losses,
      bestCombo,
      highestScore,
      accuracySum,
    };

    set({ stats: newStats });
    localStorage.setItem('sb_local_stats', JSON.stringify(newStats));
  },

  loadStats: () => {
    if (typeof window === 'undefined') return;
    try {
      const isGuest = localStorage.getItem('sb_is_guest') === 'true';
      const guestName = localStorage.getItem('sb_guest_name') || 'Guest Boxer';
      const localStatsRaw = localStorage.getItem('sb_local_stats');
      const stats = localStatsRaw ? JSON.parse(localStatsRaw) : DEFAULT_STATS;

      set({ isGuest, guestName, stats });
    } catch (e) {
      console.error('Failed to load user stats from localStorage:', e);
    }
  },

  logout: () => {
    set({ user: null, isGuest: false, guestName: 'Guest Boxer', stats: DEFAULT_STATS });
    localStorage.removeItem('sb_is_guest');
    localStorage.removeItem('sb_guest_name');
    localStorage.removeItem('sb_local_stats');
  },
}));
