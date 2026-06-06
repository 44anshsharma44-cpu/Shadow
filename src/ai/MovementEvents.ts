import { GestureType } from '@/types/pose';
import { useGameStore } from '@/stores/GameStore';

export class MovementEventManager {
  private prevGesture: GestureType = 'NONE';

  public processGesture(gesture: GestureType) {
    const gameStore = useGameStore.getState();
    const { status } = gameStore;

    // Only process movements when active fighting is ongoing
    if (status !== 'FIGHTING') {
      this.prevGesture = 'NONE';
      return;
    }

    if (gesture === this.prevGesture) {
      // No transition change
      return;
    }

    // --- TRANSITION RELEASES ---
    if (this.prevGesture === 'BLOCK' && gesture !== 'BLOCK') {
      gameStore.triggerPlayerBlock(false);
    }
    if (this.prevGesture === 'DUCK' && gesture !== 'DUCK') {
      gameStore.triggerPlayerDuck(false);
    }

    // --- TRANSITION TRIGGERS ---
    switch (gesture) {
      case 'BLOCK':
        gameStore.triggerPlayerBlock(true);
        break;

      case 'DUCK':
        gameStore.triggerPlayerDuck(true);
        break;

      case 'PUNCH_LEFT_JAB':
      case 'PUNCH_RIGHT_JAB':
        gameStore.triggerPlayerPunch('jab');
        break;

      case 'PUNCH_LEFT_HOOK':
      case 'PUNCH_RIGHT_HOOK':
        gameStore.triggerPlayerPunch('hook');
        break;

      case 'PUNCH_LEFT_UPPERCUT':
      case 'PUNCH_RIGHT_UPPERCUT':
        gameStore.triggerPlayerPunch('uppercut');
        break;

      default:
        // No action needed for NONE
        break;
    }

    this.prevGesture = gesture;
  }

  public reset() {
    this.prevGesture = 'NONE';
  }
}

export const movementEvents = new MovementEventManager();
export default movementEvents;
