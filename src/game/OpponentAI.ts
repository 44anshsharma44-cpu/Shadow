import { Boxer, DifficultyLevel, AttackType } from '@/types/game';
import { useGameStore } from '@/stores/GameStore';
import { CombatRangeManager, COMBAT_ARENA } from './CombatRangeManager';
import { audioManager } from '@/lib/audio';

// ─── Footwork constants ───────────────────────────────────────────────────────
const FOOTWORK = {
  BOUNCE_SPEED: 0.08,   // bob cycle speed (radians per tick)
  DRIFT_RANGE: 8,       // max X drift pixels from home position
  DRIFT_SPEED: 0.035,   // drift oscillation speed
};

export class OpponentAI {
  private decisionTimer: number = 0;
  private reactionTimer: number = 0;
  private targetAction: (() => void) | null = null;
  private comboQueue: AttackType[] = [];

  // Idle animation phases
  private bouncePhase: number = 0;
  private driftPhase: number = 0;
  private weightPhase: number = 0;

  public update(
    dtMs: number,
    player: Boxer,
    opponent: Boxer,
    difficulty: DifficultyLevel
  ) {
    const store = useGameStore.getState();

    if (
      opponent.state === 'KNOCKED_OUT' ||
      opponent.state === 'VICTORY' ||
      player.state === 'KNOCKED_OUT' ||
      player.state === 'VICTORY' ||
      store.status !== 'FIGHTING'
    ) return;

    // ── Idle animation (always runs) ───────────────────────────────────────────
    this.bouncePhase += FOOTWORK.BOUNCE_SPEED * (dtMs / 16);
    this.driftPhase  += FOOTWORK.DRIFT_SPEED  * (dtMs / 16);
    this.weightPhase += FOOTWORK.BOUNCE_SPEED * 0.6 * (dtMs / 16);

    // Apply subtle X drift when idle (footwork)
    if (opponent.state === 'IDLE' || opponent.state === 'BLOCKING') {
      const drift = Math.sin(this.driftPhase) * FOOTWORK.DRIFT_RANGE;
      const homeX = Math.min(
        COMBAT_ARENA.OPPONENT_HOME_X + 8,
        player.x + COMBAT_ARENA.IDEAL_GAP + 10
      );
      // Bias pull toward ideal sparring gap from player
      const biasPull = (player.x + COMBAT_ARENA.IDEAL_GAP - opponent.x) * 0.010 * dtMs;
      opponent.targetX = homeX + drift + biasPull;
    }

    // Tick decision and reaction timers
    if (this.decisionTimer > 0) this.decisionTimer -= dtMs;
    if (this.reactionTimer > 0) {
      this.reactionTimer -= dtMs;
      if (this.reactionTimer <= 0 && this.targetAction) {
        this.targetAction();
        this.targetAction = null;
      }
    }

    // Busy in animation
    if (
      opponent.state === 'JABBING' ||
      opponent.state === 'HOOKING' ||
      opponent.state === 'UPPERCUTTING' ||
      opponent.state === 'HIT'
    ) return;

    const distance = Math.abs(opponent.x - player.x);

    // ── React to player attacks ────────────────────────────────────────────────
    const isPlayerAttacking =
      player.state === 'JABBING' ||
      player.state === 'HOOKING' ||
      player.state === 'UPPERCUTTING';

    if (isPlayerAttacking && opponent.state === 'IDLE' && !this.targetAction) {
      let blockChance = 0.18;
      let reactionDelay = 480;
      let dodgeChance = 0.08;

      if (difficulty === 'MEDIUM') {
        blockChance = 0.48;
        reactionDelay = 280;
        dodgeChance = 0.18;
      } else if (difficulty === 'HARD') {
        blockChance = 0.78;
        reactionDelay = 120;
        dodgeChance = 0.30;
      }

      if (distance < COMBAT_ARENA.REACH.jab) {
        const roll = Math.random();
        if (roll < blockChance) {
          this.targetAction = () => {
            opponent.state = 'BLOCKING';
            opponent.stateTimer = 280;
          };
          this.reactionTimer = reactionDelay;
          return;
        } else if (roll < blockChance + dodgeChance) {
          // Dodge: step backward quickly
          this.targetAction = () => {
            opponent.targetX = Math.min(COMBAT_ARENA.RIGHT_WALL, opponent.x + 45);
          };
          this.reactionTimer = reactionDelay * 0.6;
          return;
        }
      }
    }

    // Release block if player stopped attacking
    if (opponent.state === 'BLOCKING' && !isPlayerAttacking && !this.targetAction) {
      opponent.state = 'IDLE';
      opponent.stateTimer = 0;
    }

    // ── Offensive decisions when idle ─────────────────────────────────────────
    if (this.decisionTimer <= 0 && opponent.state === 'IDLE') {

      // Pop combo queue
      if (this.comboQueue.length > 0) {
        const nextPunch = this.comboQueue.shift()!;
        this.firePunch(opponent, nextPunch);
        this.decisionTimer = 200 + Math.random() * 80;
        return;
      }

      let attackRate = 1600;
      let closeInChance = 0.55;
      let counterChance = 0.18;

      if (difficulty === 'MEDIUM') {
        attackRate = 750;
        closeInChance = 0.72;
        counterChance = 0.38;
      } else if (difficulty === 'HARD') {
        attackRate = 400;
        closeInChance = 0.92;
        counterChance = 0.62;
      }

      this.decisionTimer = attackRate + Math.random() * 250;

      // Advance or retreat based on distance
      if (distance > COMBAT_ARENA.MAX_GAP) {
        if (Math.random() < closeInChance) {
          const targetX = Math.max(player.x + COMBAT_ARENA.IDEAL_GAP, opponent.x - 42);
          opponent.targetX = targetX;
          this.decisionTimer = 220 + Math.random() * 130;
          return;
        }
      } else if (distance < COMBAT_ARENA.MIN_GAP + 10) {
        // Too close – back up
        opponent.targetX = Math.min(COMBAT_ARENA.OPPONENT_HOME_X + 26, opponent.x + 30);
        this.decisionTimer = 200 + Math.random() * 100;
        return;
      }

      // Launch a punch if in range (use CombatRangeManager reach values)
      if (CombatRangeManager.inReach(opponent, player, 'jab')) {
        const canAct = player.state === 'HIT' || player.state === 'IDLE' || Math.random() < counterChance;
        if (canAct) {
          let punch: AttackType = 'jab';
          if (CombatRangeManager.inReach(opponent, player, 'uppercut') && Math.random() < 0.65) punch = 'uppercut';
          else if (CombatRangeManager.inReach(opponent, player, 'hook') && Math.random() < 0.50) punch = 'hook';

          this.firePunch(opponent, punch);

          // Queue combo follow-ups
          let comboChance = 0.12;
          if (difficulty === 'MEDIUM') comboChance = 0.42;
          else if (difficulty === 'HARD') comboChance = 0.72;

          if (Math.random() < comboChance) {
            if (punch === 'jab') this.comboQueue = Math.random() < 0.6 ? ['hook'] : ['jab'];
            else if (punch === 'hook') this.comboQueue = ['uppercut'];
          }

          if (this.comboQueue.length > 0) {
            this.decisionTimer = 200 + Math.random() * 70;
          }
        }
      }
    }
  }

  private firePunch(opponent: Boxer, type: AttackType) {
    const durations = { jab: 280, hook: 420, uppercut: 560 };
    const states = { jab: 'JABBING' as const, hook: 'HOOKING' as const, uppercut: 'UPPERCUTTING' as const };

    const duration = durations[type];
    opponent.state = states[type];
    opponent.stateTimer = duration;
    opponent.activeAttack = { type, progress: 0, duration };

    if (audioManager) {
      if (type === 'jab') audioManager.playPunch();
      else if (type === 'hook') audioManager.playHook();
      else audioManager.playUppercut();
    }
  }

  public reset() {
    this.decisionTimer = 0;
    this.reactionTimer = 0;
    this.targetAction = null;
    this.comboQueue = [];
    this.bouncePhase = 0;
    this.driftPhase = 0;
    this.weightPhase = 0;
  }
}

export const opponentAI = new OpponentAI();
export default opponentAI;
