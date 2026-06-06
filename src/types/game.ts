export type BoxerState =
  | 'IDLE'
  | 'JABBING'
  | 'HOOKING'
  | 'UPPERCUTTING'
  | 'BLOCKING'
  | 'DUCKING'
  | 'HIT'
  | 'STUNNED'
  | 'KNOCKED_OUT'
  | 'VICTORY';

export type OpponentAIState =
  | 'IDLE'
  | 'ATTACKING'
  | 'BLOCKING'
  | 'STUNNED'
  | 'KNOCKED_OUT'
  | 'VICTORY';

export interface Boxer {
  id: 'player' | 'opponent';
  state: BoxerState;
  hp: number;
  maxHp: number;
  x: number;
  targetX: number;
  facing: 'right' | 'left';
  stateTimer: number; // in milliseconds
  activeAttack: {
    type: 'jab' | 'hook' | 'uppercut';
    progress: number; // 0 to 1
    duration: number;
  } | null;
}

export interface AttackStats {
  damage: number;
  range: number;
  speed: number;    // duration of execution (ms)
  recovery: number; // duration of recovery (ms)
}

export type AttackType = 'jab' | 'hook' | 'uppercut';

export interface CombatConfig {
  jab: AttackStats;
  hook: AttackStats;
  uppercut: AttackStats;
}

export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';

export interface GameSettings {
  difficulty: DifficultyLevel;
  volume: number;
  sensitivity: number;
  cameraId: string;
  showOverlay: boolean;
}

export interface MatchStats {
  score: number;
  maxCombo: number;
  hitsLanded: number;
  totalPunches: number;
  accuracy: number;
  duration: number;
  result: 'WIN' | 'LOSS' | 'DRAW' | null;
}

export interface HighScoreRecord {
  id: string;
  score: number;
  userName: string;
  createdAt: string;
}
