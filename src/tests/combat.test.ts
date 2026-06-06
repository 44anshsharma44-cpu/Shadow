import { describe, it, expect, beforeEach } from 'vitest';
import { FIGHTER_MAX_HP, useGameStore } from '@/stores/GameStore';
import { CombatRangeManager, COMBAT_ARENA } from '@/game/CombatRangeManager';
import { PunchReachSystem, PUNCH_REACH } from '@/game/PunchReachSystem';

describe('Game Combat System State Store Tests', () => {
  beforeEach(() => {
    // Reset store before each test
    useGameStore.getState().initMatch();
  });

  it('should initialize with correct default fighter states', () => {
    const state = useGameStore.getState();
    expect(state.player.hp).toBe(FIGHTER_MAX_HP);
    expect(state.opponent.hp).toBe(FIGHTER_MAX_HP);
    expect(state.score).toBe(0);
    expect(state.combo).toBe(0);
    expect(state.status).toBe('LOBBY');
  });

  it('should deduct health from opponent when player punch lands', () => {
    const store = useGameStore.getState();
    store.startFighting();

    // Hit opponent with a Jab (10 damage)
    store.applyHit('player', 'jab', 10);

    const updatedState = useGameStore.getState();
    expect(updatedState.opponent.hp).toBe(FIGHTER_MAX_HP - 10);
    expect(updatedState.opponent.state).toBe('HIT');
    expect(updatedState.score).toBe(100); // 100 base score
    expect(updatedState.combo).toBe(1);
  });

  it('should increase combo and apply multiplier bonuses on consecutive hits', () => {
    const store = useGameStore.getState();
    store.startFighting();

    // Hit 1
    store.applyHit('player', 'jab', 10);
    // Hit 2
    store.applyHit('player', 'hook', 20);

    const state = useGameStore.getState();
    expect(state.opponent.hp).toBe(FIGHTER_MAX_HP - 30);
    expect(state.combo).toBe(2);
    expect(state.maxCombo).toBe(2);
    // Score calculation: Hit 1: 100 points, Hit 2: 100 + (50 * 2) = 200 points. Total: 300 points
    expect(state.score).toBe(300);
  });

  it('should mitigate damage and award block points when defender is blocking', () => {
    const store = useGameStore.getState();
    store.startFighting();

    // Set opponent state to BLOCKING
    store.setOpponentState('BLOCKING', 500);

    // Land Player jab on blocking opponent
    store.applyHit('player', 'jab', 10);

    const state = useGameStore.getState();
    // Opponent health should still be full (fully blocked)
    expect(state.opponent.hp).toBe(FIGHTER_MAX_HP);
    // Player gets block mitigation points (50 points)
    expect(state.score).toBe(50);
  });

  it('should trigger knockout when health falls to zero', () => {
    const store = useGameStore.getState();
    store.startFighting();

    // Deal heavy damage to knock out opponent
    store.applyHit('player', 'uppercut', FIGHTER_MAX_HP);

    const state = useGameStore.getState();
    expect(state.opponent.hp).toBe(0);
    expect(state.opponent.state).toBe('KNOCKED_OUT');
    expect(state.winner).toBe('player');
    expect(state.status).toBe('FINISHED');
  });

  it('keeps fighters at close center-screen sparring positions', () => {
    const state = useGameStore.getState();

    expect(state.player.x).toBeCloseTo(336, 0);
    expect(state.opponent.x).toBeCloseTo(464, 0);
    expect(CombatRangeManager.playerScreenX(state.player, 800)).toBeCloseTo(800 * 0.42, 0);
    expect(CombatRangeManager.opponentScreenX(state.opponent, 800)).toBeCloseTo(800 * 0.58, 0);
    expect(COMBAT_ARENA.MAX_GAP).toBe(COMBAT_ARENA.FIGHTER_WIDTH * 2);
  });

  it('moves the fist hitbox before allowing collision damage', () => {
    const state = useGameStore.getState();
    const playerX = CombatRangeManager.playerScreenX(state.player, 800);
    const playerY = COMBAT_ARENA.PLAYER_HIP_Y - 70;
    const opponentX = CombatRangeManager.opponentScreenX(state.opponent, 800);
    const opponentY = CombatRangeManager.opponentScreenY(state.opponent, state.player, 450);
    const opponentBody = PunchReachSystem.getBodyHitbox(state.opponent, opponentX, opponentY, 1);

    const startFist = PunchReachSystem.getFistPosition(state.player, 'jab', 0, 800, 450, playerX, playerY);
    const peakFist = PunchReachSystem.getFistPosition(state.player, 'jab', 0.45, 800, 450, playerX, playerY);

    expect(PUNCH_REACH.jab).toBe(1);
    expect(PUNCH_REACH.hook).toBe(0.9);
    expect(PUNCH_REACH.uppercut).toBe(0.8);
    expect(PunchReachSystem.checkFistCollision(startFist, opponentBody)).toBe(false);
    expect(PunchReachSystem.checkFistCollision(peakFist, opponentBody)).toBe(true);
  });
});
