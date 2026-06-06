import { useEffect } from 'react';
import { gameEngine } from '@/game/GameEngine';
import { useGameStore } from '@/stores/GameStore';

export function useGameLoop() {
  const status = useGameStore((s) => s.status);

  useEffect(() => {
    // Start game loop when fighting or countdown is active
    if (status === 'FIGHTING' || status === 'COUNTDOWN') {
      gameEngine.start();
    } else {
      gameEngine.stop();
    }

    // Stop engine on unmount
    return () => {
      gameEngine.stop();
    };
  }, [status]);
}

export default useGameLoop;
