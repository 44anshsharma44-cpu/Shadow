'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useUserStore } from '@/stores/UserStore';
import { Trophy, Search, ChevronLeft, ChevronRight, Loader2, Play, AlertCircle } from 'lucide-react';

interface LeaderboardRecord {
  id: string;
  rank: number;
  score: number;
  userName: string;
  createdAt: string;
}

export default function LeaderboardPage() {
  const { user, isGuest } = useUserStore();
  const [scores, setScores] = useState<LeaderboardRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  const fetchScores = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leaderboard?limit=${limit}&page=${page}`);
      if (!res.ok) {
        throw new Error('Failed to load leaderboard database.');
      }
      const data = await res.json();
      setScores(data.scores);
      setTotalPages(data.pagination.totalPages || 1);
    } catch (e: any) {
      setError(e.message || 'Something went wrong while fetching scores.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  // Client-side search filter
  const filteredScores = scores.filter((record) =>
    record.userName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0b0c10] p-4 sm:p-6 md:p-8 flex flex-col items-center">
      <div className="max-w-4xl w-full z-10 space-y-6">
        
        {/* Title Block */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#1f2833]/40 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 h-11 w-11 rounded-xl bg-gradient-to-tr from-[#45f3ff]/20 to-[#45f3ff]/40 flex items-center justify-center text-[#45f3ff] border border-[#45f3ff]/30 shadow-[0_0_15px_rgba(69,243,255,0.2)]">
              <Trophy className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-3xl font-black italic tracking-wider text-white uppercase">
                LEADERBOARDS
              </h1>
              <p className="text-xs text-gray-500 font-bold tracking-widest uppercase mt-0.5">Top Global Shadow Boxers</p>
            </div>
          </div>
          
          <Link
            href="/play"
            className="flex items-center gap-2 bg-[#45f3ff] hover:bg-sky-400 text-black font-extrabold text-xs tracking-widest py-3 px-5 rounded-xl transition-all shadow-[0_0_15px_rgba(69,243,255,0.15)] hover:scale-102 uppercase"
          >
            Enter Arena <Play className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Guest Warning */}
        {isGuest && (
          <div className="bg-yellow-500/5 border border-yellow-500/20 text-yellow-500/90 text-xs py-3 px-4 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold block mb-0.5 uppercase tracking-wider">Guest Mode Active</span>
              Your high scores are currently only saved in your local browser cache. To compete on the global rankings and persist scores permanently, please sign up for a ranked account!
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative w-full">
          <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fighter by name..."
            className="w-full bg-[#0f111a] border border-[#1f2833] rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#45f3ff] transition-all"
          />
        </div>

        {/* Leaderboard Table Container */}
        <div className="bg-[#0f111a] border border-[#1f2833]/70 rounded-3xl overflow-hidden shadow-2xl">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-[#45f3ff] animate-spin mb-2" />
              <span className="text-xs text-gray-500 font-bold tracking-widest uppercase">Fetching rankings...</span>
            </div>
          ) : error ? (
            <div className="py-16 text-center">
              <p className="text-sm font-bold text-red-400">{error}</p>
              <button
                onClick={fetchScores}
                className="text-xs text-[#45f3ff] hover:underline font-bold mt-2 cursor-pointer"
              >
                Try Again
              </button>
            </div>
          ) : filteredScores.length === 0 ? (
            <div className="py-16 text-center text-gray-500 text-sm font-medium">
              No ranked records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1f2833] bg-[#0b0c10]/50 text-[10px] font-black tracking-widest text-gray-500 uppercase">
                    <th className="py-4 px-6 text-center w-20">Rank</th>
                    <th className="py-4 px-6">Boxer Name</th>
                    <th className="py-4 px-6 text-right w-32">High Score</th>
                    <th className="py-4 px-6 text-right w-44">Date Achieved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f2833]/30">
                  {filteredScores.map((record) => {
                    const isCurrentUser = user && user.name === record.userName;
                    const rankStyle = (r: number) => {
                      if (r === 1) return 'text-[#ff007f] font-black drop-shadow-[0_0_8px_rgba(255,0,127,0.4)]';
                      if (r === 2) return 'text-[#e0a96d] font-black';
                      if (r === 3) return 'text-[#45f3ff] font-black';
                      return 'text-gray-400 font-bold';
                    };

                    return (
                      <tr
                        key={record.id}
                        className={`hover:bg-[#1f2833]/10 transition-all ${
                          isCurrentUser ? 'bg-[#45f3ff]/5 border-l-2 border-l-[#45f3ff]' : ''
                        }`}
                      >
                        <td className={`py-4 px-6 text-center font-mono ${rankStyle(record.rank)}`}>
                          #{record.rank}
                        </td>
                        <td className="py-4 px-6 text-sm font-extrabold text-white tracking-wide">
                          {record.userName}
                          {isCurrentUser && (
                            <span className="ml-2 text-[9px] font-bold tracking-widest bg-[#45f3ff]/20 text-[#45f3ff] px-2 py-0.5 rounded-full uppercase">
                              YOU
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right font-black font-mono text-white text-sm tracking-wide">
                          {record.score}
                        </td>
                        <td className="py-4 px-6 text-right text-xs text-gray-500 font-semibold font-mono">
                          {new Date(record.createdAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-2 pt-2">
            <span className="text-xs text-gray-500 font-semibold tracking-wide">
              Page <strong className="text-gray-300 font-bold">{page}</strong> of{' '}
              <strong className="text-gray-300 font-bold">{totalPages}</strong>
            </span>
            
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border border-[#1f2833] rounded-xl hover:bg-[#1f2833]/50 text-gray-400 hover:text-white transition-all disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 border border-[#1f2833] rounded-xl hover:bg-[#1f2833]/50 text-gray-400 hover:text-white transition-all disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
