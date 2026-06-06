'use client';

import React from 'react';
import { useGameStore } from '@/stores/GameStore';
import { usePoseStore } from '@/stores/PoseStore';
import { useSettingsStore } from '@/stores/SettingsStore';
import { Flame, Shield, Camera, Activity } from 'lucide-react';

export function HUD() {
  const { player, opponent, score, round, maxRounds, roundTime, status, countdown } = useGameStore();
  const fps = usePoseStore((s) => s.fps);
  const isCameraActive = usePoseStore((s) => s.isCameraActive);
  const difficulty = useSettingsStore((s) => s.difficulty);

  // Format seconds to MM:SS
  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getDifficultyColor = (diff: string) => {
    if (diff === 'EASY') return 'border-green-500/20 text-green-400 bg-green-500/5';
    if (diff === 'HARD') return 'border-red-500/20 text-red-400 bg-red-500/5';
    return 'border-blue-500/20 text-blue-400 bg-blue-500/5';
  };

  const getCountdownLabel = (count: number) => {
    const ceil = Math.ceil(count);
    if (ceil === 0) return 'FIGHT!';
    return String(ceil);
  };

  const healthPercent = (hp: number, maxHp: number) => {
    if (maxHp <= 0) return 0;
    return Math.max(0, Math.min(100, (hp / maxHp) * 100));
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10 flex flex-col justify-between p-4 sm:p-6">
      {/* --- TOP HUD ROW: Health bars, Round, Timer, Score --- */}
      <div className="flex justify-between items-start w-full gap-4">
        {/* Player Side (Left) */}
        <div className="flex flex-col w-5/12 max-w-[350px]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-extrabold tracking-wider text-[#45f3ff] drop-shadow-[0_0_5px_rgba(69,243,255,0.4)] flex items-center gap-1.5">
              PLAYER {player.state === 'BLOCKING' && <Shield className="w-3.5 h-3.5 animate-pulse" />}
            </span>
            <span className="text-xs font-bold text-gray-400">{Math.round(player.hp)} / {player.maxHp} HP</span>
          </div>
          <div className="h-4 w-full bg-black/60 border border-[#1f2833] rounded-full overflow-hidden shadow-2xl p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 via-sky-400 to-[#45f3ff] transition-all duration-150 shadow-[0_0_10px_rgba(69,243,255,0.6)]"
              style={{ width: `${healthPercent(player.hp, player.maxHp)}%` }}
            />
          </div>
          {player.state !== 'IDLE' && player.state !== 'VICTORY' && player.state !== 'KNOCKED_OUT' && (
            <span className="text-[10px] text-gray-500 font-extrabold tracking-widest mt-1 text-left uppercase animate-pulse">
              STATE: <span className="text-white">{player.state}</span>
            </span>
          )}
        </div>

        {/* Center Round / Clock Info */}
        <div className="flex flex-col items-center bg-black/80 border border-[#1f2833]/80 rounded-2xl px-4 py-2 shadow-2xl min-w-[100px] sm:min-w-[140px]">
          <span className="text-[10px] font-black text-gray-500 tracking-widest uppercase">
            ROUND {round} / {maxRounds}
          </span>
          <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-wider tabular-nums">
            {status === 'FINISHED' ? '0:00' : formatTime(roundTime)}
          </span>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border mt-1 tracking-widest uppercase ${getDifficultyColor(difficulty)}`}>
            {difficulty}
          </span>
        </div>

        {/* Opponent Side (Right) */}
        <div className="flex flex-col w-5/12 max-w-[350px] items-end">
          <div className="flex items-center justify-between w-full mb-1">
            <span className="text-xs font-bold text-gray-400">{Math.round(opponent.hp)} / {opponent.maxHp} HP</span>
            <span className="text-sm font-extrabold tracking-wider text-[#ff007f] drop-shadow-[0_0_5px_rgba(255,0,127,0.4)] flex items-center gap-1.5">
              OPPONENT AI {opponent.state === 'BLOCKING' && <Shield className="w-3.5 h-3.5 animate-pulse" />}
            </span>
          </div>
          <div className="h-4 w-full bg-black/60 border border-[#1f2833] rounded-full overflow-hidden shadow-2xl p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-l from-rose-600 via-pink-400 to-[#ff007f] transition-all duration-150 shadow-[0_0_10px_rgba(255,0,127,0.6)]"
              style={{ width: `${healthPercent(opponent.hp, opponent.maxHp)}%`, marginLeft: 'auto' }}
            />
          </div>
          {opponent.state !== 'IDLE' && opponent.state !== 'VICTORY' && opponent.state !== 'KNOCKED_OUT' && (
            <span className="text-[10px] text-gray-500 font-extrabold tracking-widest mt-1 text-right uppercase animate-pulse">
              STATE: <span className="text-white">{opponent.state}</span>
            </span>
          )}
        </div>
      </div>

      {/* --- CENTER FLOATING COUNTDOWN --- */}
      {status === 'COUNTDOWN' && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
          <div className="text-8xl sm:text-9xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-[#45f3ff] via-white to-[#ff007f] drop-shadow-[0_0_20px_rgba(69,243,255,0.7)] animate-bounce select-none">
            {getCountdownLabel(countdown)}
          </div>
        </div>
      )}

      {/* --- BOTTOM HUD ROW: Score scoreboard, FPS, tracking info --- */}
      <div className="flex justify-between items-end w-full">
        {/* Status Metrics (Left) */}
        <div className="flex flex-col gap-1 text-[10px] font-bold tracking-widest text-gray-500 bg-black/60 border border-[#1f2833]/40 p-2 rounded-xl backdrop-blur-sm shadow-2xl">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#45f3ff]" />
            FRAME RATE: <span className="text-white font-mono">{fps} FPS</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-[#45f3ff]" />
            WEBCAM: <span className={isCameraActive ? 'text-green-400' : 'text-red-400'}>{isCameraActive ? 'ACTIVE' : 'OFFLINE'}</span>
          </span>
        </div>

        {/* Score Indicator (Right) */}
        <div className="flex flex-col items-end bg-gradient-to-t from-black/80 to-black/60 border border-[#1f2833] rounded-2xl px-5 py-2.5 shadow-2xl">
          <span className="text-[10px] font-black text-gray-400 tracking-widest uppercase flex items-center gap-1">
            SCORE <Flame className="w-3.5 h-3.5 text-[#ff007f] animate-pulse" />
          </span>
          <span className="text-2xl sm:text-3xl font-black text-white tracking-widest font-mono tabular-nums">
            {String(score).padStart(6, '0')}
          </span>
        </div>
      </div>
    </div>
  );
}

export default HUD;
