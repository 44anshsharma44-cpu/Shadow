'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/stores/GameStore';
import { useUserStore } from '@/stores/UserStore';
import { useGameLoop } from '@/hooks/useGameLoop';
import GameCanvas from '@/components/GameCanvas';
import CameraView from '@/components/CameraView';
import HUD from '@/components/HUD';
import ScoreBoard from '@/components/ScoreBoard';
import ComboCounter from '@/components/ComboCounter';
import { Swords, Eye, Shield, Zap, Sparkles } from 'lucide-react';

export default function PlayPage() {
  const router = useRouter();
  const { user, isGuest, loadStats } = useUserStore();
  const { status, initMatch, startCountdown } = useGameStore();

  // Run the 60 FPS update loop when fighting/countdown is active
  useGameLoop();

  // Redirect to landing if no active session
  useEffect(() => {
    loadStats();
    if (!user && !isGuest) {
      router.push('/');
    } else {
      initMatch();
    }
  }, [user, isGuest, router, initMatch, loadStats]);

  if (!user && !isGuest) {
    return null; // let redirect trigger
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0b0c10] flex flex-col p-4 sm:p-6 md:p-8 select-none relative overflow-hidden">
      
      {/* Dynamic Glows */}
      <div className="absolute top-1/2 left-1/4 w-80 h-80 bg-[#45f3ff]/5 rounded-full filter blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 w-80 h-80 bg-[#ff007f]/5 rounded-full filter blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start flex-1 z-10">
        
        {/* Left Side: Game Canvas & HUD overlay */}
        <div className="lg:col-span-8 flex flex-col gap-4 w-full">
          <div className="relative w-full">
            {/* The main 60 FPS interactive HTML5 Game Canvas */}
            <GameCanvas />
            
            {/* Real-time stats HUD */}
            <HUD />

            {/* floating combo notifier */}
            <ComboCounter />

            {/* Post-match summary card */}
            <ScoreBoard />

            {/* Lobby Play Button Overlay */}
            {status === 'LOBBY' && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 z-20">
                <div className="text-center max-w-sm">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#45f3ff]/10 border border-[#45f3ff]/20 text-[#45f3ff] text-[10px] font-black tracking-widest uppercase mb-3 shadow-[0_0_15px_rgba(69,243,255,0.15)] animate-pulse">
                    READY TO BRAWL
                  </div>
                  <h3 className="text-2xl font-black italic tracking-wider text-white uppercase mb-2">
                    ENTER THE RING
                  </h3>
                  <p className="text-xs text-gray-500 font-medium tracking-wide mb-6 leading-relaxed">
                    Position your camera, stand back so your upper body is fully visible, and click start below to begin.
                  </p>
                  <button
                    onClick={startCountdown}
                    className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-[#45f3ff] to-blue-600 hover:from-sky-400 hover:to-blue-500 text-black font-extrabold text-sm tracking-widest py-4 px-8 rounded-2xl shadow-[0_0_20px_rgba(69,243,255,0.3)] hover:scale-103 hover:shadow-[0_0_30px_rgba(69,243,255,0.45)] transition-all cursor-pointer uppercase"
                  >
                    Start Fight <Swords className="w-4 h-4 animate-bounce" />
                  </button>
                </div>
              </div>
            )}
            
            {/* Round Over Overlay */}
            {status === 'ROUND_OVER' && (
              <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 z-20">
                <div className="text-center">
                  <h3 className="text-4xl font-black italic tracking-widest text-[#ff007f] drop-shadow-[0_0_15px_rgba(255,0,127,0.5)] uppercase mb-2">
                    ROUND OVER
                  </h3>
                  <p className="text-sm text-gray-400 font-medium tracking-wide mb-6">Take a deep breath. Next round is starting.</p>
                  <button
                    onClick={() => useGameStore.getState().nextRound()}
                    className="flex items-center justify-center gap-2 bg-[#45f3ff] hover:bg-sky-400 text-black font-extrabold text-xs tracking-widest py-3.5 px-8 rounded-xl shadow-[0_0_15px_rgba(69,243,255,0.2)] hover:scale-102 transition-all cursor-pointer uppercase"
                  >
                    Begin Next Round
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Guide list under arena */}
          <div className="bg-[#0f111a] border border-[#1f2833]/40 rounded-3xl p-5 shadow-lg">
            <h4 className="text-xs font-black tracking-widest text-gray-400 uppercase mb-3 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#45f3ff]" /> FIGHTING MOVES & GESTURES
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <div className="bg-[#1f2833]/15 border border-[#1f2833]/30 rounded-xl p-2.5">
                <span className="text-[10px] text-gray-500 font-bold tracking-wider uppercase block">JAB</span>
                <span className="text-xs font-extrabold text-white uppercase mt-1 block">Punch Straight</span>
                <span className="text-[9px] text-[#45f3ff] font-medium tracking-wide mt-0.5 block">Velocity &gt; 1.1</span>
              </div>
              <div className="bg-[#1f2833]/15 border border-[#1f2833]/30 rounded-xl p-2.5">
                <span className="text-[10px] text-gray-500 font-bold tracking-wider uppercase block">HOOK</span>
                <span className="text-xs font-extrabold text-white uppercase mt-1 block">Bent Elbow Swing</span>
                <span className="text-[9px] text-[#45f3ff] font-medium tracking-wide mt-0.5 block">Angle 65°-130°</span>
              </div>
              <div className="bg-[#1f2833]/15 border border-[#1f2833]/30 rounded-xl p-2.5">
                <span className="text-[10px] text-gray-500 font-bold tracking-wider uppercase block">UPPERCUT</span>
                <span className="text-xs font-extrabold text-white uppercase mt-1 block">Ascend Vertical</span>
                <span className="text-[9px] text-[#45f3ff] font-medium tracking-wide mt-0.5 block">Up Accel &gt; 0.9</span>
              </div>
              <div className="bg-[#1f2833]/15 border border-[#1f2833]/30 rounded-xl p-2.5">
                <span className="text-[10px] text-gray-500 font-bold tracking-wider uppercase block">BLOCK</span>
                <span className="text-xs font-extrabold text-white uppercase mt-1 block">Hands Near Nose</span>
                <span className="text-[9px] text-[#45f3ff] font-medium tracking-wide mt-0.5 block">Both Hands Up</span>
              </div>
              <div className="bg-[#1f2833]/15 border border-[#1f2833]/30 rounded-xl p-2.5 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-gray-500 font-bold tracking-wider uppercase block">DUCK</span>
                <span className="text-xs font-extrabold text-white uppercase mt-1 block">Squat Head Down</span>
                <span className="text-[9px] text-[#45f3ff] font-medium tracking-wide mt-0.5 block">Height Drops &gt; 22%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Camera View Finder & instructions */}
        <div className="lg:col-span-4 flex flex-col gap-6 w-full">
          {/* Webcam Skeleton overlay processing card */}
          <CameraView />

          {/* Quick tips card */}
          <div className="bg-[#0f111a] border border-[#1f2833]/40 rounded-3xl p-5 shadow-lg">
            <h4 className="text-xs font-black tracking-widest text-[#ff007f] uppercase mb-2">
              PRO BOXER TIPS
            </h4>
            <ul className="text-xs text-gray-400 space-y-2 list-disc pl-4 leading-relaxed font-medium">
              <li>
                Maintain a distance of about <strong className="text-white">4 to 6 feet</strong> from your webcam so your head, shoulders, elbows, and hips are tracked clearly.
              </li>
              <li>
                Make sure your room has <strong className="text-white">good lighting</strong> to help the AI detect swift punch movements.
              </li>
              <li>
                Keep your guard up near your nose to block opponent punches, and squat down low to dodge hooks and jabs.
              </li>
              <li>
                Link punches together (Jab, then Hook, then Uppercut) to stack multipliers and score massive points.
              </li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
