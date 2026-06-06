import { Boxer } from '@/types/game';
import { COMBAT_ARENA, CombatRangeManager } from './CombatRangeManager';

export interface BoxingCameraState {
  zoom: number;
  offsetX: number;
  offsetY: number;
  shakeX: number;
  shakeY: number;
}

const CAMERA = {
  MIN_ZOOM: 1.0,
  MAX_ZOOM: 1.13,
  CENTER_PULL: 0.28,
  ZOOM_LERP: 0.075,
  OFFSET_LERP: 0.08,
  SHAKE_DECAY: 0.72,
};

export class BoxingCameraSystem {
  private state: BoxingCameraState = {
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    shakeX: 0,
    shakeY: 0,
  };

  public update(player: Boxer, opponent: Boxer, canvasW: number, canvasH: number): BoxingCameraState {
    const playerX = CombatRangeManager.playerScreenX(player, canvasW);
    const opponentX = CombatRangeManager.opponentScreenX(opponent, canvasW);
    const midpoint = (playerX + opponentX) / 2;
    const gap = CombatRangeManager.distance(player, opponent);
    const exchanging = player.activeAttack !== null || opponent.activeAttack !== null;

    const tightness = 1 - clamp(
      (gap - COMBAT_ARENA.MIN_GAP) / (COMBAT_ARENA.MAX_GAP - COMBAT_ARENA.MIN_GAP),
      0,
      1
    );
    const targetZoom = clamp(
      1 + tightness * 0.075 + (exchanging ? 0.035 : 0),
      CAMERA.MIN_ZOOM,
      CAMERA.MAX_ZOOM
    );
    const targetOffsetX = (canvasW / 2 - midpoint) * CAMERA.CENTER_PULL;
    const targetOffsetY = canvasH * (exchanging ? -0.013 : -0.004);

    this.state.zoom += (targetZoom - this.state.zoom) * CAMERA.ZOOM_LERP;
    this.state.offsetX += (targetOffsetX - this.state.offsetX) * CAMERA.OFFSET_LERP;
    this.state.offsetY += (targetOffsetY - this.state.offsetY) * CAMERA.OFFSET_LERP;
    this.state.shakeX *= CAMERA.SHAKE_DECAY;
    this.state.shakeY *= CAMERA.SHAKE_DECAY;

    return { ...this.state };
  }

  public addImpactShake(amount: number) {
    this.state.shakeX += (Math.random() - 0.5) * amount;
    this.state.shakeY += (Math.random() - 0.5) * amount * 0.72;
  }

  public reset() {
    this.state = { zoom: 1, offsetX: 0, offsetY: 0, shakeX: 0, shakeY: 0 };
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export const boxingCameraSystem = new BoxingCameraSystem();
