'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUserStore } from '@/stores/UserStore';
import { User, Activity, Percent, Flame, Swords, Calendar, Mail, Trophy, Loader2 } from 'lucide-react';

interface HistoryRecord {
  id: string;
  score: number;
  accuracy: number;
  comboCount: number;
  result: string;
  duration: number;
  createdAt: string;
}

interface ProfileStats {
  name: string;
  email: string;
  createdAt: string;
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  accuracy: number;
  bestCombo: number;
  highestScore: number;
  history: HistoryRecord[];
}

export default function ProfilePage() {
  const { user, isGuest, stats: localStats, guestName, loadStats } = useUserStore();
  const [profile, setProfile] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    if (isGuest || !user) {
      // Load Guest local stats
      const total = localStats.totalMatches;
      const wr = total > 0 ? Math.round((localStats.wins / total) * 100) : 0;
      const acc = total > 0 ? Math.round(localStats.accuracySum / total) : 0;

      setProfile({
        name: guestName,
        email: 'Local Guest Client',
        createdAt: new Date().toISOString(),
        totalMatches: total,
        wins: localStats.wins,
        losses: localStats.losses,
        winRate: wr,
        accuracy: acc,
        bestCombo: localStats.bestCombo,
        highestScore: localStats.highestScore,
        history: [], // guest mode doesn't record a detailed history array locally
      });
      setLoading(false);
    } else {
      // Fetch from API
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        } else {
          console.error('Failed to load profile.');
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
  }, [user, isGuest, guestName, localStats]);

  useEffect(() => {
    loadStats();
    loadProfile();
  }, [loadProfile, loadStats]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#0b0c10] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#45f3ff] animate-spin mb-2" />
        <span className="text-xs text-gray-500 font-bold tracking-widest uppercase">Analyzing boxing records...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#0b0c10] flex items-center justify-center text-gray-400">
        No profile session active.
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0b0c10] p-4 sm:p-6 md:p-8 flex flex-col items-center">
      <div className="max-w-4xl w-full z-10 space-y-6">
        
        {/* Profile Card Header */}
        <div className="bg-[#0f111a] border border-[#1f2833] rounded-3xl p-6 shadow-2xl flex flex-col sm:flex-row items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#1f2833] to-[#45f3ff]/40 flex items-center justify-center border-2 border-[#45f3ff]/30 text-white font-black text-3xl shadow-[0_0_20px_rgba(69,243,255,0.2)]">
            {profile.name.charAt(0).toUpperCase()}
          </div>
          
          <div className="flex-1 text-center sm:text-left space-y-1">
            <h1 className="text-3xl font-black italic tracking-wider text-white uppercase">{profile.name}</h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-gray-400 font-semibold mt-1">
              <span className="flex items-center justify-center sm:justify-start gap-1">
                <Mail className="w-4 h-4 text-gray-600" /> {profile.email}
              </span>
              <span className="flex items-center justify-center sm:justify-start gap-1">
                <Calendar className="w-4 h-4 text-gray-600" /> Joined{' '}
                {new Date(profile.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#0f111a] border border-[#1f2833]/60 rounded-2xl p-4 flex flex-col items-center justify-center shadow-md">
            <Swords className="w-6 h-6 text-blue-400 mb-2" />
            <span className="text-[10px] font-black text-gray-500 tracking-wider uppercase">Matches Played</span>
            <span className="text-2xl font-black text-white mt-1 font-mono">{profile.totalMatches}</span>
            <div className="text-[10px] text-gray-400 mt-0.5 font-bold tracking-wide">
              {profile.wins}W / {profile.losses}L
            </div>
          </div>

          <div className="bg-[#0f111a] border border-[#1f2833]/60 rounded-2xl p-4 flex flex-col items-center justify-center shadow-md">
            <Activity className="w-6 h-6 text-[#ff007f] mb-2 animate-pulse" />
            <span className="text-[10px] font-black text-gray-500 tracking-wider uppercase">Win Rate</span>
            <span className="text-2xl font-black text-white mt-1 font-mono">{profile.winRate}%</span>
            <div className="w-full bg-black/60 h-1.5 rounded-full overflow-hidden mt-1.5 p-0.5 border border-[#1f2833]">
              <div className="bg-[#ff007f] h-full rounded-full" style={{ width: `${profile.winRate}%` }} />
            </div>
          </div>

          <div className="bg-[#0f111a] border border-[#1f2833]/60 rounded-2xl p-4 flex flex-col items-center justify-center shadow-md">
            <Percent className="w-6 h-6 text-[#45f3ff] mb-2" />
            <span className="text-[10px] font-black text-gray-500 tracking-wider uppercase">Avg Accuracy</span>
            <span className="text-2xl font-black text-white mt-1 font-mono">{profile.accuracy}%</span>
            <div className="w-full bg-black/60 h-1.5 rounded-full overflow-hidden mt-1.5 p-0.5 border border-[#1f2833]">
              <div className="bg-[#45f3ff] h-full rounded-full" style={{ width: `${profile.accuracy}%` }} />
            </div>
          </div>

          <div className="bg-[#0f111a] border border-[#1f2833]/60 rounded-2xl p-4 flex flex-col items-center justify-center shadow-md">
            <Trophy className="w-6 h-6 text-yellow-500 mb-2" />
            <span className="text-[10px] font-black text-gray-500 tracking-wider uppercase">High Score</span>
            <span className="text-2xl font-black text-white mt-1 font-mono">{profile.highestScore}</span>
            <div className="text-[10px] text-gray-400 mt-0.5 font-bold tracking-wide">
              Combo Peak: {profile.bestCombo}
            </div>
          </div>
        </div>

        {/* Match History Table (Only visible if non-guest / has records) */}
        {!isGuest && (
          <div className="bg-[#0f111a] border border-[#1f2833] rounded-3xl p-5 shadow-2xl space-y-4">
            <h3 className="text-md font-black italic tracking-widest text-[#45f3ff] uppercase flex items-center gap-1.5">
              <Activity className="w-5 h-5" /> MATCH HISTORY REPORT
            </h3>

            {profile.history.length === 0 ? (
              <p className="text-xs text-gray-500 font-medium text-center py-8">No session history saved yet. Go fight in the Arena!</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#1f2833] text-[9px] font-black tracking-widest text-gray-500 uppercase">
                      <th className="py-3 px-4">Result</th>
                      <th className="py-3 px-4">Score</th>
                      <th className="py-3 px-4 text-center">Accuracy</th>
                      <th className="py-3 px-4 text-center">Peak Combo</th>
                      <th className="py-3 px-4 text-center">Duration</th>
                      <th className="py-3 px-4 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f2833]/30 text-xs font-semibold">
                    {profile.history.map((match) => (
                      <tr key={match.id} className="hover:bg-[#1f2833]/10 transition-all text-white">
                        <td className="py-3.5 px-4 font-extrabold">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest ${
                              match.result === 'WIN'
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                : match.result === 'LOSS'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-gray-800 text-gray-300'
                            }`}
                          >
                            {match.result}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-black text-sm">{match.score}</td>
                        <td className="py-3.5 px-4 text-center font-mono text-gray-300">{match.accuracy}%</td>
                        <td className="py-3.5 px-4 text-center font-mono text-gray-300">{match.comboCount} hits</td>
                        <td className="py-3.5 px-4 text-center font-mono text-gray-500">{match.duration}s</td>
                        <td className="py-3.5 px-4 text-right font-mono text-gray-500">
                          {new Date(match.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
