import { create } from 'zustand';
import { Boxer, BoxerState, AttackType } from '@/types/game';
import { audioManager } from '@/lib/audio';

export type GameStatus = 'LOBBY' | 'COUNTDOWN' | 'FIGHTING' | 'ROUND_OVER' | 'FINISHED';

export const FIGHTER_MAX_HP = 250;

interface GameState {
  status: GameStatus;
  countdown: number; // 3, 2, 1
  round: number;
  maxRounds: number;
  roundTime: number; // in seconds
  maxRoundTime: number;
  score: number;
  combo: number;
  maxCombo: number;
  punchesThrown: number;
  punchesLanded: number;
  lastHitTime: number; // timestamp
  winner: 'player' | 'opponent' | 'draw' | null;

  player: Boxer;
  opponent: Boxer;

  // Actions
  initMatch: () => void;
  startCountdown: () => void;
  startFighting: () => void;
  updateTime: (deltaTime: number) => void;
  triggerPlayerPunch: (punchType: AttackType) => void;
  triggerPlayerBlock: (active: boolean) => void;
  triggerPlayerDuck: (active: boolean) => void;
  
  applyHit: (attackerId: 'player' | 'opponent', type: AttackType, damage: number) => void;
  opponentsAttack: (type: AttackType, damage: number) => void;
  setPlayerState: (state: BoxerState, duration?: number) => void;
  setOpponentState: (state: BoxerState, duration?: number) => void;
  
  endRound: () => void;
  nextRound: () => void;
  finishMatch: (winnerOverride?: 'player' | 'opponent' | 'draw') => void;
  resetGame: () => void;
}

const INITIAL_PLAYER = (): Boxer => ({
  id: 'player',
  state: 'IDLE',
  hp: FIGHTER_MAX_HP,
  maxHp: FIGHTER_MAX_HP,
  x: 336,      // 42% of 800px canvas – close sparring range
  targetX: 336,
  facing: 'right',
  stateTimer: 0,
  activeAttack: null,
});

const INITIAL_OPPONENT = (): Boxer => ({
  id: 'opponent',
  state: 'IDLE',
  hp: FIGHTER_MAX_HP,
  maxHp: FIGHTER_MAX_HP,
  x: 464,      // 58% of 800px canvas – close sparring range
  targetX: 464,
  facing: 'left',
  stateTimer: 0,
  activeAttack: null,
});

export const useGameStore = create<GameState>((set, get) => ({
  status: 'LOBBY',
  countdown: 3,
  round: 1,
  maxRounds: 3,
  roundTime: 90,
  maxRoundTime: 90,
  score: 0,
  combo: 0,
  maxCombo: 0,
  punchesThrown: 0,
  punchesLanded: 0,
  lastHitTime: 0,
  winner: null,

  player: INITIAL_PLAYER(),
  opponent: INITIAL_OPPONENT(),

  initMatch: () => {
    set({
      status: 'LOBBY',
      round: 1,
      roundTime: 90,
      score: 0,
      combo: 0,
      maxCombo: 0,
      punchesThrown: 0,
      punchesLanded: 0,
      winner: null,
      player: INITIAL_PLAYER(),
      opponent: INITIAL_OPPONENT(),
    });
  },

  startCountdown: () => {
    set({ status: 'COUNTDOWN', countdown: 3 });
    if (audioManager) audioManager.playBell();
  },

  startFighting: () => {
    set({ status: 'FIGHTING', roundTime: get().maxRoundTime });
    if (audioManager) audioManager.playCrowd();
  },

  updateTime: (deltaTime) => {
    const { status, roundTime, countdown } = get();

    if (status === 'COUNTDOWN') {
      const nextCountdown = countdown - deltaTime;
      if (nextCountdown <= 0) {
        get().startFighting();
      } else {
        set({ countdown: nextCountdown });
      }
    } else if (status === 'FIGHTING') {
      const nextTime = Math.max(0, roundTime - deltaTime);
      set({ roundTime: nextTime });
      if (nextTime <= 0) {
        get().endRound();
      }
    }

    // Check combo timeout (3 seconds)
    const now = Date.now();
    if (get().combo > 0 && now - get().lastHitTime > 3000) {
      set({ combo: 0 });
    }
  },

  triggerPlayerPunch: (punchType) => {
    const { status, player } = get();
    if (status !== 'FIGHTING' || player.state === 'KNOCKED_OUT' || player.state === 'HIT') return;

    // Set player animation state
    const duration = punchType === 'jab' ? 200 : punchType === 'hook' ? 350 : 500;
    const state: BoxerState = punchType === 'jab' ? 'JABBING' : punchType === 'hook' ? 'HOOKING' : 'UPPERCUTTING';

    set((s) => ({
      punchesThrown: s.punchesThrown + 1,
      player: {
        ...s.player,
        state,
        stateTimer: duration,
        activeAttack: { type: punchType, progress: 0, duration },
      },
    }));

    if (audioManager) {
      if (punchType === 'jab') audioManager.playPunch();
      else if (punchType === 'hook') audioManager.playHook();
      else audioManager.playUppercut();
    }
  },

  triggerPlayerBlock: (active) => {
    const { status, player } = get();
    if (status !== 'FIGHTING' || player.state === 'KNOCKED_OUT' || player.state === 'HIT') return;

    if (active) {
      // Transition to blocking
      if (player.state !== 'BLOCKING') {
        set((s) => ({ player: { ...s.player, state: 'BLOCKING', activeAttack: null } }));
      }
    } else {
      // Revert if blocking
      if (player.state === 'BLOCKING') {
        set((s) => ({ player: { ...s.player, state: 'IDLE' } }));
      }
    }
  },

  triggerPlayerDuck: (active) => {
    const { status, player } = get();
    if (status !== 'FIGHTING' || player.state === 'KNOCKED_OUT' || player.state === 'HIT') return;

    if (active) {
      if (player.state !== 'DUCKING') {
        set((s) => ({ player: { ...s.player, state: 'DUCKING', activeAttack: null } }));
      }
    } else {
      if (player.state === 'DUCKING') {
        set((s) => ({ player: { ...s.player, state: 'IDLE' } }));
      }
    }
  },

  opponentsAttack: (type) => {
    const { status, opponent } = get();
    if (status !== 'FIGHTING' || opponent.state === 'KNOCKED_OUT' || opponent.state === 'HIT') return;

    const duration = type === 'jab' ? 300 : type === 'hook' ? 450 : 600;
    const state: BoxerState = type === 'jab' ? 'JABBING' : type === 'hook' ? 'HOOKING' : 'UPPERCUTTING';

    set((s) => ({
      opponent: {
        ...s.opponent,
        state,
        stateTimer: duration,
        activeAttack: { type, progress: 0, duration },
      },
    }));

    if (audioManager) {
      if (type === 'jab') audioManager.playPunch();
      else if (type === 'hook') audioManager.playHook();
      else audioManager.playUppercut();
    }
  },

  applyHit: (attackerId, type, damage) => {
    const now = Date.now();
    const isPlayerAttacking = attackerId === 'player';
    const defender = isPlayerAttacking ? get().opponent : get().player;
    
    // Check if target is blocking or ducking
    const isBlocking = defender.state === 'BLOCKING';
    const isDucking = defender.state === 'DUCKING';

    if (isDucking && type !== 'uppercut') {
      // Avoid hits except uppercut
      return;
    }

    if (isBlocking) {
      // Damage mitigated, trigger block sound
      if (audioManager) audioManager.playBlock();
      
      if (isPlayerAttacking) {
        // Player gets a tiny combo increase or minor score
        set((s) => ({
          score: s.score + 50,
        }));
      } else {
        // Player blocks opponent - Perfect Block bonus!
        set((s) => ({
          score: s.score + 200,
          combo: s.combo + 1,
          maxCombo: Math.max(s.maxCombo, s.combo + 1),
          lastHitTime: now,
        }));
      }
      return;
    }

    // Connect hit
    const nextHp = Math.max(0, defender.hp - damage);

    if (audioManager) {
      if (nextHp <= 0) {
        audioManager.playKnockout();
      } else {
        // Trigger generic hit thud / punch impact
        audioManager.playHook();
      }
    }

    if (isPlayerAttacking) {
      // Player hit Opponent
      const currentCombo = get().combo + 1;
      const comboBonus = currentCombo >= 2 ? 50 * currentCombo : 0;
      const isCounter = get().opponent.activeAttack !== null;
      const hitPoints = 100 + comboBonus + (isCounter ? 300 : 0);

      set((s) => ({
        punchesLanded: s.punchesLanded + 1,
        score: s.score + hitPoints,
        combo: currentCombo,
        maxCombo: Math.max(s.maxCombo, currentCombo),
        lastHitTime: now,
        opponent: {
          ...s.opponent,
          hp: nextHp,
          state: nextHp <= 0 ? 'KNOCKED_OUT' : 'HIT',
          stateTimer: nextHp <= 0 ? 999999 : 250,
          activeAttack: null,
        },
      }));

      if (nextHp <= 0) {
        get().finishMatch('player');
      }
    } else {
      // Opponent hit Player
      set((s) => ({
        combo: 0, // Break combo
        player: {
          ...s.player,
          hp: nextHp,
          state: nextHp <= 0 ? 'KNOCKED_OUT' : 'HIT',
          stateTimer: nextHp <= 0 ? 999999 : 250,
          activeAttack: null,
        },
      }));

      if (nextHp <= 0) {
        get().finishMatch('opponent');
      }
    }
  },

  setPlayerState: (state, duration = 0) => {
    set((s) => ({
      player: {
        ...s.player,
        state,
        stateTimer: duration,
        activeAttack: state === 'IDLE' ? null : s.player.activeAttack,
      },
    }));
  },

  setOpponentState: (state, duration = 0) => {
    set((s) => ({
      opponent: {
        ...s.opponent,
        state,
        stateTimer: duration,
        activeAttack: state === 'IDLE' ? null : s.opponent.activeAttack,
      },
    }));
  },

  endRound: () => {
    const { round, maxRounds, player, opponent } = get();
    if (audioManager) audioManager.playBell();

    if (round >= maxRounds) {
      // Fight finishes by points
      const winner = player.hp > opponent.hp ? 'player' : player.hp < opponent.hp ? 'opponent' : 'draw';
      set({ status: 'FINISHED', winner });
    } else {
      set({ status: 'ROUND_OVER' });
    }
  },

  nextRound: () => {
    set((s) => ({
      status: 'COUNTDOWN',
      countdown: 3,
      round: s.round + 1,
      roundTime: s.maxRoundTime,
      player: {
        ...s.player,
        hp: FIGHTER_MAX_HP, // Reset round health
        state: 'IDLE',
        stateTimer: 0,
        activeAttack: null,
      },
      opponent: {
        ...s.opponent,
        hp: FIGHTER_MAX_HP,
        state: 'IDLE',
        stateTimer: 0,
        activeAttack: null,
      },
    }));
    if (audioManager) audioManager.playBell();
  },

  finishMatch: (winnerOverride) => {
    const winner = winnerOverride || (get().player.hp > get().opponent.hp ? 'player' : 'opponent');
    set({
      status: 'FINISHED',
      winner,
      player: {
        ...get().player,
        state: winner === 'player' ? 'VICTORY' : 'KNOCKED_OUT',
        stateTimer: 999999,
      },
      opponent: {
        ...get().opponent,
        state: winner === 'opponent' ? 'VICTORY' : 'KNOCKED_OUT',
        stateTimer: 999999,
      },
    });
  },

  resetGame: () => {
    get().initMatch();
  },
}));
export type useGameStoreType = typeof useGameStore;
export type GameStoreState = ReturnType<useGameStoreType['getState']>;
