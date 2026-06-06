import { useGameStore } from '@/stores/GameStore';
import { useSettingsStore } from '@/stores/SettingsStore';
import { PhysicsSystem } from './Physics';
import { opponentAI } from './OpponentAI';
import { COMBAT_CONFIG } from './CombatSystem';
import { CombatRangeManager, COMBAT_ARENA } from './CombatRangeManager';
import { PunchReachSystem } from './PunchReachSystem';
import { Boxer, AttackType } from '@/types/game';
import { audioManager } from '@/lib/audio';

// Screen geometry used for fist-position calculation
const CANVAS_W = 800;
const CANVAS_H = 450;

export class GameEngine {
  private lastTime: number = 0;
  private animationFrameId: number | null = null;
  private hitEvaluated = { player: false, opponent: false };

  // Expose last fist & body hitboxes so GameCanvas can render debug overlay
  public lastPlayerFist: ReturnType<typeof PunchReachSystem.getFistPosition> | null = null;
  public lastOpponentFist: ReturnType<typeof PunchReachSystem.getFistPosition> | null = null;
  public lastOpponentBody: ReturnType<typeof PunchReachSystem.getBodyHitbox> | null = null;
  public lastPlayerBody: ReturnType<typeof PunchReachSystem.getBodyHitbox> | null = null;
  public lastCollision = { player: false, opponent: false };
  public lastDistance = 0;
  public lastImpact: {
    attacker: 'player' | 'opponent';
    type: AttackType;
    target: 'head' | 'torso' | 'arm' | null;
    x: number;
    y: number;
    score: number;
    time: number;
  } | null = null;

  public start() {
    this.lastTime = performance.now();
    this.hitEvaluated = { player: false, opponent: false };
    opponentAI.reset();

    this.stop();

    const loop = (time: number) => {
      this.update(time);
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  public stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private applyHitLocal(
    attackerId: 'player' | 'opponent',
    type: AttackType,
    damage: number,
    player: Boxer,
    opponent: Boxer,
    store: typeof useGameStore
  ) {
    const defender    = attackerId === 'player' ? opponent : player;
    const isBlocking  = defender.state === 'BLOCKING';
    const isDucking   = defender.state === 'DUCKING';

    if (isDucking && type !== 'uppercut') return; // ducked under the punch

    const now = Date.now();

    if (isBlocking) {
      if (audioManager) audioManager.playBlock();
      if (attackerId === 'player') {
        store.setState({ score: store.getState().score + 50 });
      } else {
        const currentCombo = store.getState().combo + 1;
        store.setState({
          score:    store.getState().score + 200,
          combo:    currentCombo,
          maxCombo: Math.max(store.getState().maxCombo, currentCombo),
          lastHitTime: now,
        });
      }
      return;
    }

    // ── Connect hit ───────────────────────────────────────────────────────────
    const nextHp = Math.max(0, defender.hp - damage);
    defender.hp         = nextHp;
    defender.state      = nextHp <= 0 ? 'KNOCKED_OUT' : 'HIT';
    defender.stateTimer = nextHp <= 0 ? 999999 : 280;
    defender.activeAttack = null;

    if (audioManager) {
      if (nextHp <= 0) audioManager.playKnockout();
      else audioManager.playHook();
    }

    if (attackerId === 'player') {
      const currentCombo = store.getState().combo + 1;
      const comboBonus   = currentCombo >= 2 ? 50 * currentCombo : 0;
      const isCounter    = opponent.activeAttack !== null;
      const hitPoints    = 100 + comboBonus + (isCounter ? 300 : 0);

      store.setState({
        punchesLanded: store.getState().punchesLanded + 1,
        score:         store.getState().score + hitPoints,
        combo:         currentCombo,
        maxCombo:      Math.max(store.getState().maxCombo, currentCombo),
        lastHitTime:   now,
      });

      if (nextHp <= 0) {
        store.getState().finishMatch('player');
        player.state    = 'VICTORY';
        player.stateTimer = 999999;
        opponent.state  = 'KNOCKED_OUT';
        opponent.stateTimer = 999999;
      }
    } else {
      store.setState({ combo: 0 });
      if (nextHp <= 0) {
        store.getState().finishMatch('opponent');
        player.state    = 'KNOCKED_OUT';
        player.stateTimer = 999999;
        opponent.state  = 'VICTORY';
        opponent.stateTimer = 999999;
      }
    }
  }

  private update(time: number) {
    const dtMs        = time - this.lastTime;
    this.lastTime     = time;
    const clampedDtMs = Math.min(dtMs, 100);
    const dtSec       = clampedDtMs / 1000;

    const store    = useGameStore.getState();
    const settings = useSettingsStore.getState();

    store.updateTime(dtSec);

    const player   = { ...store.player };
    const opponent = { ...store.opponent };

    // Distance for debug
    this.lastDistance = CombatRangeManager.distance(player, opponent);

    if (store.status === 'FIGHTING') {
      // ── 1. Opponent AI ───────────────────────────────────────────────────────
      opponentAI.update(clampedDtMs, player, opponent, settings.difficulty);

      // ── 2. Compute screen positions for hitbox checks ────────────────────────
      const playerScreenX  = CombatRangeManager.playerScreenX(player, CANVAS_W);
      const playerScreenY  = COMBAT_ARENA.PLAYER_HIP_Y;
      const opponentScreenX = CombatRangeManager.opponentScreenX(opponent, CANVAS_W);
      const opponentScreenY = CombatRangeManager.opponentScreenY(opponent, player, CANVAS_H);
      const oppScale        = CombatRangeManager.opponentScale(opponent, player);

      // Build body hitboxes (persistent for debug rendering)
      this.lastPlayerBody   = PunchReachSystem.getBodyHitbox(player,   playerScreenX,   playerScreenY,   1.0);
      this.lastOpponentBody = PunchReachSystem.getBodyHitbox(opponent, opponentScreenX, opponentScreenY, oppScale);

      // ── 3. Process player attack ─────────────────────────────────────────────
      if (player.activeAttack) {
        player.activeAttack          = { ...player.activeAttack };
        player.activeAttack.progress += clampedDtMs / player.activeAttack.duration;

        // Lunge early
        if (player.activeAttack.progress < 0.25) {
          PhysicsSystem.applyLunge(player, 3);
        }

        // Compute virtual fist position every frame
        const punchType = player.activeAttack.type;
        const fist      = PunchReachSystem.getFistPosition(
          player, punchType, player.activeAttack.progress,
          CANVAS_W, CANVAS_H, playerScreenX, playerScreenY - 70
        );
        this.lastPlayerFist = fist;

        // Hitbox collision check (runs every frame, registered once via flag)
        if (!this.hitEvaluated.player && this.lastOpponentBody) {
          const collision = PunchReachSystem.getCollision(fist, this.lastOpponentBody);
          this.lastCollision.player = collision.hit;
          if (collision.hit) {
            this.hitEvaluated.player = true;
            const config = COMBAT_CONFIG[punchType];
            this.applyHitLocal('player', punchType, config.damage, player, opponent, useGameStore);
            PhysicsSystem.applyKnockback(opponent, punchType === 'jab' ? 18 : punchType === 'hook' ? 28 : 34);
            this.lastImpact = {
              attacker: 'player',
              type: punchType,
              target: collision.target,
              x: fist.x,
              y: fist.y,
              score: punchType === 'jab' ? 100 : punchType === 'hook' ? 150 : 220,
              time,
            };
          }
        }

        if (player.activeAttack.progress >= 1.0) {
          player.activeAttack   = null;
          player.state          = 'IDLE';
          this.hitEvaluated.player = false;
          this.lastPlayerFist      = null;
          this.lastCollision.player = false;
        }
      }

      // ── 4. Process opponent attack ───────────────────────────────────────────
      if (opponent.activeAttack) {
        opponent.activeAttack          = { ...opponent.activeAttack };
        opponent.activeAttack.progress += clampedDtMs / opponent.activeAttack.duration;

        if (opponent.activeAttack.progress < 0.25) {
          PhysicsSystem.applyLunge(opponent, 3);
        }

        const punchType = opponent.activeAttack.type;
        const fist      = PunchReachSystem.getFistPosition(
          opponent, punchType, opponent.activeAttack.progress,
          CANVAS_W, CANVAS_H, opponentScreenX, opponentScreenY - 70
        );
        this.lastOpponentFist = fist;

        if (!this.hitEvaluated.opponent && this.lastPlayerBody) {
          const collision = PunchReachSystem.getCollision(fist, this.lastPlayerBody);
          this.lastCollision.opponent = collision.hit;
          if (collision.hit) {
            this.hitEvaluated.opponent = true;
            const config = COMBAT_CONFIG[punchType];
            this.applyHitLocal('opponent', punchType, config.damage, player, opponent, useGameStore);
            PhysicsSystem.applyKnockback(player, punchType === 'jab' ? 18 : punchType === 'hook' ? 28 : 34);
            this.lastImpact = {
              attacker: 'opponent',
              type: punchType,
              target: collision.target,
              x: fist.x,
              y: fist.y,
              score: 0,
              time,
            };
          }
        }

        if (opponent.activeAttack.progress >= 1.0) {
          opponent.activeAttack   = null;
          opponent.state          = 'IDLE';
          this.hitEvaluated.opponent = false;
          this.lastOpponentFist      = null;
          this.lastCollision.opponent = false;
        }
      }

      // Reset evaluated flags when attacks finish
      if (!player.activeAttack)   this.hitEvaluated.player   = false;
      if (!opponent.activeAttack) this.hitEvaluated.opponent  = false;

      // ── 5. Hitstun / recovery timers ─────────────────────────────────────────
      if (player.state === 'HIT' && player.stateTimer > 0) {
        player.stateTimer -= clampedDtMs;
        if (player.stateTimer <= 0) player.state = 'IDLE';
      }
      if (opponent.state === 'HIT' && opponent.stateTimer > 0) {
        opponent.stateTimer -= clampedDtMs;
        if (opponent.stateTimer <= 0) opponent.state = 'IDLE';
      }
      if (opponent.state === 'BLOCKING') {
        opponent.stateTimer -= clampedDtMs;
        if (opponent.stateTimer <= 0) opponent.state = 'IDLE';
      }

      // ── 6. Combat range management (42%/58% spacing, no back-rope camping) ───
      CombatRangeManager.update(player, opponent, clampedDtMs);
    }

    // ── 7. Physics movement ────────────────────────────────────────────────────
    PhysicsSystem.updatePositions(player, opponent, clampedDtMs);

    // ── 8. Write back ──────────────────────────────────────────────────────────
    useGameStore.setState({ player, opponent });
  }
}

export const gameEngine = new GameEngine();
export default gameEngine;
