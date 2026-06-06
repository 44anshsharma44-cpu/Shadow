'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/stores/GameStore';
import { useUserStore } from '@/stores/UserStore';
import { Trophy, Swords, Home, RefreshCw, Star, Percent, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';

export function ScoreBoard() {
  const router = useRouter();
  const {
    status,
    winner,
    score,
    punchesThrown,
    punchesLanded,
    maxCombo,
    round,
    maxRoundTime,
    resetGame,
    startCountdown,
  } = useGameStore();

  const { user, isGuest, updateStats } = useUserStore();
  const saveTriggered = useRef(false);

  const [coachReview, setCoachReview] = React.useState<string | null>(null);
  const [loadingCoach, setLoadingCoach] = React.useState(false);

  const accuracy = punchesThrown > 0 ? Math.round((punchesLanded / punchesThrown) * 100) : 0;
  const isWin = winner === 'player';

  // Trigger confetti on win and sync scores
  useEffect(() => {
    if (status !== 'FINISHED') {
      saveTriggered.current = false;
      return;
    }

    if (isWin) {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#45f3ff', '#ffffff', '#ff007f'],
      });
    }

    if (saveTriggered.current) return;
    saveTriggered.current = true;

    const gameResult = isWin ? 'WIN' : winner === 'opponent' ? 'LOSS' : 'DRAW';

    // Update local store stats
    updateStats(score, maxCombo, accuracy, isWin);

    // Sync to SQLite if logged in
    if (user && !isGuest) {
      fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score,
          duration: maxRoundTime * round,
          accuracy,
          comboCount: maxCombo,
          result: gameResult,
        }),
      }).catch((e) => console.error('Failed to save score to database:', e));
    }

    // Call AI coach route
    setLoadingCoach(true);
    setCoachReview(null);
    fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        result: gameResult,
        score,
        accuracy,
        maxCombo,
        duration: maxRoundTime * round,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.critique) setCoachReview(data.critique);
      })
      .catch((e) => console.error('Failed to fetch AI Coach review:', e))
      .finally(() => setLoadingCoach(false));
  }, [status, isWin, score, maxCombo, accuracy, winner, user, isGuest, updateStats, maxRoundTime, round]);

  if (status !== 'FINISHED') return null;

  return (
    <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-40">
      <div className="bg-[#0f111a] border border-[#1f2833] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-[0_0_50px_rgba(69,243,255,0.15)] flex flex-col items-center">
        {/* Outcome Header */}
        <div className="mb-6 text-center">
          {winner === 'player' ? (
            <>
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#45f3ff]/20 to-[#45f3ff]/40 flex items-center justify-center text-[#45f3ff] border border-[#45f3ff]/30 mx-auto mb-3 shadow-[0_0_20px_rgba(69,243,255,0.3)] animate-pulse">
                <Trophy className="w-8 h-8" />
              </div>
              <h2 className="text-4xl font-black italic tracking-wider text-[#45f3ff] drop-shadow-[0_0_15px_rgba(69,243,255,0.6)]">
                VICTORY!
              </h2>
              <p className="text-xs text-gray-500 font-bold tracking-widest mt-1 uppercase">You knocked out the opponent</p>
            </>
          ) : winner === 'opponent' ? (
            <>
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#ff007f]/20 to-[#ff007f]/40 flex items-center justify-center text-[#ff007f] border border-[#ff007f]/30 mx-auto mb-3 shadow-[0_0_20px_rgba(255,0,127,0.3)] animate-pulse">
                <Swords className="w-8 h-8" />
              </div>
              <h2 className="text-4xl font-black italic tracking-wider text-[#ff007f] drop-shadow-[0_0_15px_rgba(255,0,127,0.6)]">
                DEFEATED
              </h2>
              <p className="text-xs text-gray-500 font-bold tracking-widest mt-1 uppercase">You were knocked out</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 border border-gray-700 mx-auto mb-3">
                <Swords className="w-8 h-8" />
              </div>
              <h2 className="text-4xl font-black italic tracking-wider text-gray-300">
                DRAW MATCH
              </h2>
              <p className="text-xs text-gray-500 font-bold tracking-widest mt-1 uppercase">Points are equal</p>
            </>
          )}
        </div>

        {/* Stats card */}
        <div className="bg-[#1f2833]/20 border border-[#1f2833]/40 rounded-2xl w-full p-4 mb-4 space-y-3 shadow-inner">
          <div className="flex justify-between items-center pb-2 border-b border-[#1f2833]/30">
            <span className="text-xs text-gray-400 font-bold tracking-wider flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-yellow-500" /> TOTAL SCORE
            </span>
            <span className="text-xl font-black text-white font-mono tabular-nums">{score}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400 font-bold tracking-wider flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-blue-400" /> ACCURACY
            </span>
            <span className="text-sm font-extrabold text-white font-mono">{accuracy}%</span>
          </div>

          <div className="flex justify-between items-center text-xs text-gray-500 pl-5">
            <span>Punches Landed / Thrown</span>
            <span className="font-semibold text-gray-300 font-mono">{punchesLanded} / {punchesThrown}</span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-[#1f2833]/20">
            <span className="text-xs text-gray-400 font-bold tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#ff007f]" /> LONGEST COMBO
            </span>
            <span className="text-sm font-extrabold text-white font-mono">{maxCombo} HITS</span>
          </div>
        </div>

        {/* Coach Corner Review Card */}
        <div className="w-full bg-black/40 border border-[#45f3ff]/20 rounded-2xl p-4 mb-6 shadow-[inset_0_0_15px_rgba(69,243,255,0.05)]">
          <span className="text-[10px] font-black tracking-widest text-[#45f3ff] uppercase block mb-1">
            🥊 COACH MICK'S CORNER
          </span>
          {loadingCoach ? (
            <div className="flex items-center gap-2 py-2 text-xs text-gray-500 font-semibold animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-[#45f3ff] animate-ping" />
              Mick is looking over the scorecards...
            </div>
          ) : coachReview ? (
            <p className="text-xs font-semibold text-gray-300 italic leading-relaxed font-sans">
              "{coachReview}"
            </p>
          ) : (
            <p className="text-xs font-semibold text-gray-500 italic">
              "Fists up, kid! Get back in the ring and show me some speed."
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={() => {
              resetGame();
              startCountdown();
            }}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#45f3ff] to-blue-600 hover:from-sky-400 hover:to-blue-500 text-black font-extrabold text-sm tracking-widest py-3 px-6 rounded-xl shadow-[0_0_20px_rgba(69,243,255,0.2)] hover:scale-102 hover:shadow-[0_0_25px_rgba(69,243,255,0.3)] transition-all cursor-pointer uppercase"
          >
            <RefreshCw className="w-4 h-4 animate-spin-slow" /> FIGHT AGAIN
          </button>
          
          <button
            onClick={() => {
              resetGame();
              router.push('/');
            }}
            className="flex items-center justify-center gap-2 bg-[#1f2833] hover:bg-[#1f2833]/80 border border-[#45f3ff]/20 text-[#c5c6c7] hover:text-white font-extrabold text-sm tracking-widest py-3 px-6 rounded-xl transition-all cursor-pointer uppercase"
          >
            <Home className="w-4 h-4" /> EXIT ARENA
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScoreBoard;
