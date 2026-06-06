'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/stores/GameStore';

export function ComboCounter() {
  const combo = useGameStore((s) => s.combo);
  const status = useGameStore((s) => s.status);

  // Calculate combo details
  const getMultiplier = (count: number) => {
    if (count >= 10) return 'x3.0';
    if (count >= 5) return 'x2.0';
    if (count >= 3) return 'x1.5';
    return 'x1.0';
  };

  const getComboColor = (count: number) => {
    if (count >= 10) return 'text-[#ff007f] drop-shadow-[0_0_15px_rgba(255,0,127,0.8)]';
    if (count >= 5) return 'text-[#e0a96d] drop-shadow-[0_0_10px_rgba(224,169,109,0.7)]';
    return 'text-[#45f3ff] drop-shadow-[0_0_8px_rgba(69,243,255,0.6)]';
  };

  const showCombo = status === 'FIGHTING' && combo > 1;

  return (
    <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 flex flex-col items-center">
      <AnimatePresence>
        {showCombo && (
          <motion.div
            key={combo}
            initial={{ scale: 0.3, y: 30, opacity: 0 }}
            animate={{ 
              scale: [1, 1.25, 1], 
              y: 0, 
              opacity: 1,
              rotate: [0, -4, 4, 0]
            }}
            exit={{ scale: 0.8, y: -30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            className="flex flex-col items-center select-none"
          >
            <span className={`text-5xl sm:text-6xl font-black tracking-tighter uppercase ${getComboColor(combo)}`}>
              {combo} HITS!
            </span>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.05 }}
              className="bg-black/70 border border-[#1f2833] px-3 py-1 rounded-full text-xs font-bold tracking-widest text-[#c5c6c7] mt-1 shadow-2xl"
            >
              MULTIPLIER <span className="text-white font-extrabold">{getMultiplier(combo)}</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ComboCounter;
