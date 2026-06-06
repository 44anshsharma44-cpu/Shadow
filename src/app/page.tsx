'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { useUserStore } from '@/stores/UserStore';
import { Flame, Swords, Shield, Eye, Trophy, ArrowRight, UserPlus, LogIn, Sparkles } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const { isGuest, setGuest, guestName } = useUserStore();

  const [tab, setTab] = useState<'signin' | 'signup' | 'guest'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [customGuestName, setCustomGuestName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // If already logged in, skip landing page
  useEffect(() => {
    if (authStatus === 'authenticated' || isGuest) {
      router.push('/play');
    }
  }, [authStatus, isGuest, router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        router.push('/play');
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to sign up.');
      } else {
        setSuccessMsg('Account created successfully! Signing in...');
        // Auto sign in
        const signInRes = await signIn('credentials', {
          redirect: false,
          email,
          password,
        });
        if (signInRes?.error) {
          setTab('signin');
          setErrorMsg('Registration succeeded, but auto-login failed. Please sign in manually.');
        } else {
          router.push('/play');
        }
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = (e: React.FormEvent) => {
    e.preventDefault();
    setGuest(true, customGuestName.trim() || 'Guest Boxer');
    router.push('/play');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0b0c10] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
      {/* Decorative Neon Blurs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-[#45f3ff]/5 rounded-full filter blur-[80px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-[#ff007f]/5 rounded-full filter blur-[80px] pointer-events-none" />

      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
        
        {/* Left Side: Pitch Showcase & How it works */}
        <div className="lg:col-span-7 flex flex-col justify-center text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[#45f3ff]/10 to-[#ff007f]/10 border border-[#45f3ff]/20 text-[#45f3ff] text-xs font-bold tracking-widest uppercase mb-4 self-start shadow-[0_0_15px_rgba(69,243,255,0.1)]">
            <Sparkles className="w-3.5 h-3.5 animate-spin-slow" /> AI MOTION CONTROLS
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black italic tracking-tighter text-white leading-none mb-4 uppercase">
            SHADOW BOXING <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#45f3ff] to-[#ff007f]">AI</span>
          </h1>
          
          <p className="text-sm sm:text-base text-gray-400 font-medium tracking-wide max-w-lg mb-8 leading-relaxed">
            Stand in front of your webcam, punch the air, and watch your movements translate directly into strikes inside an animated boxing game. Challenge an AI-controlled opponent in real time using your own speed and reflexes.
          </p>

          {/* Feature details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            <div className="bg-[#0f111a] border border-[#1f2833]/50 rounded-2xl p-4 flex gap-3 shadow-md hover:border-[#45f3ff]/30 transition-all duration-300">
              <div className="p-2 h-9 w-9 rounded-lg bg-[#45f3ff]/10 flex items-center justify-center text-[#45f3ff]">
                <Swords className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">Punch Classification</h4>
                <p className="text-xs text-gray-500 mt-0.5 font-medium leading-snug">Track Jabs, Hooks, and Uppercuts dynamically using Z-axis coordinates.</p>
              </div>
            </div>

            <div className="bg-[#0f111a] border border-[#1f2833]/50 rounded-2xl p-4 flex gap-3 shadow-md hover:border-[#ff007f]/30 transition-all duration-300">
              <div className="p-2 h-9 w-9 rounded-lg bg-[#ff007f]/10 flex items-center justify-center text-[#ff007f]">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">Blocks & Ducks</h4>
                <p className="text-xs text-gray-500 mt-0.5 font-medium leading-snug">Cover your face to block attacks, or lower your head to duck under strikes.</p>
              </div>
            </div>

            <div className="bg-[#0f111a] border border-[#1f2833]/50 rounded-2xl p-4 flex gap-3 shadow-md hover:border-blue-500/30 transition-all duration-300">
              <div className="p-2 h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">Dynamic Opponent</h4>
                <p className="text-xs text-gray-500 mt-0.5 font-medium leading-snug">Compete against an AI FSM that blocks, lunges, and counter-attacks.</p>
              </div>
            </div>

            <div className="bg-[#0f111a] border border-[#1f2833]/50 rounded-2xl p-4 flex gap-3 shadow-md hover:border-yellow-500/30 transition-all duration-300">
              <div className="p-2 h-9 w-9 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-400">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">Live Leaderboard</h4>
                <p className="text-xs text-gray-500 mt-0.5 font-medium leading-snug">Save high scores and accuracy ratings to compete on ranked boards.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Container */}
        <div className="lg:col-span-5 bg-[#0f111a] border border-[#1f2833] rounded-3xl p-6 sm:p-8 shadow-[0_0_35px_rgba(0,0,0,0.6)]">
          {/* Tab Selector */}
          <div className="flex border-b border-[#1f2833] pb-3 mb-6 gap-2">
            <button
              onClick={() => { setTab('signin'); setErrorMsg(null); }}
              className={`flex-1 py-2 text-center text-xs font-black tracking-widest uppercase rounded-lg transition-all cursor-pointer ${
                tab === 'signin' 
                  ? 'bg-[#1f2833]/80 text-[#45f3ff] shadow-inner' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('signup'); setErrorMsg(null); }}
              className={`flex-1 py-2 text-center text-xs font-black tracking-widest uppercase rounded-lg transition-all cursor-pointer ${
                tab === 'signup' 
                  ? 'bg-[#1f2833]/80 text-[#45f3ff] shadow-inner' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
            <button
              onClick={() => { setTab('guest'); setErrorMsg(null); }}
              className={`flex-1 py-2 text-center text-xs font-black tracking-widest uppercase rounded-lg transition-all cursor-pointer ${
                tab === 'guest' 
                  ? 'bg-[#1f2833]/80 text-[#ff007f] shadow-inner' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Guest Mode
            </button>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-2.5 px-3.5 rounded-xl mb-4 font-bold">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs py-2.5 px-3.5 rounded-xl mb-4 font-bold animate-pulse">
              {successMsg}
            </div>
          )}

          {/* Form Content */}
          {tab === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-500 tracking-widest uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="boxer@shadow.ai"
                  className="w-full bg-[#0b0c10] border border-[#1f2833] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#45f3ff] transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 tracking-widest uppercase mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#0b0c10] border border-[#1f2833] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#45f3ff] transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#45f3ff] hover:bg-sky-400 text-black font-extrabold text-xs tracking-widest py-3.5 rounded-xl shadow-[0_0_15px_rgba(69,243,255,0.15)] hover:scale-102 hover:shadow-[0_0_20px_rgba(69,243,255,0.25)] transition-all cursor-pointer uppercase mt-6"
              >
                {loading ? 'Entering Arena...' : 'Sign In To Battle'} <LogIn className="w-4 h-4" />
              </button>
            </form>
          )}

          {tab === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-500 tracking-widest uppercase mb-1">Boxer Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tyson"
                  className="w-full bg-[#0b0c10] border border-[#1f2833] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#45f3ff] transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 tracking-widest uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="boxer@shadow.ai"
                  className="w-full bg-[#0b0c10] border border-[#1f2833] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#45f3ff] transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 tracking-widest uppercase mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  minLength={8}
                  className="w-full bg-[#0b0c10] border border-[#1f2833] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#45f3ff] transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#45f3ff] hover:bg-sky-400 text-black font-extrabold text-xs tracking-widest py-3.5 rounded-xl shadow-[0_0_15px_rgba(69,243,255,0.15)] hover:scale-102 hover:shadow-[0_0_20px_rgba(69,243,255,0.25)] transition-all cursor-pointer uppercase mt-6"
              >
                {loading ? 'Creating Account...' : 'Create Ranked Account'} <UserPlus className="w-4 h-4" />
              </button>
            </form>
          )}

          {tab === 'guest' && (
            <form onSubmit={handleGuestMode} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-500 tracking-widest uppercase mb-1">Temp Fighter Name</label>
                <input
                  type="text"
                  value={customGuestName}
                  onChange={(e) => setCustomGuestName(e.target.value)}
                  placeholder="Guest Boxer (Optional)"
                  maxLength={15}
                  className="w-full bg-[#0b0c10] border border-[#1f2833] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#ff007f] transition-all"
                />
                <p className="text-[10px] text-gray-500 mt-1.5 font-medium leading-relaxed">
                  * Note: Guest Mode scores and stats will persist locally on this browser but will not be ranked on global server boards.
                </p>
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-[#ff007f] hover:bg-pink-600 text-white font-extrabold text-xs tracking-widest py-3.5 rounded-xl shadow-[0_0_15px_rgba(255,0,127,0.15)] hover:scale-102 hover:shadow-[0_0_20px_rgba(255,0,127,0.25)] transition-all cursor-pointer uppercase mt-6"
              >
                Start Guest Fight <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
