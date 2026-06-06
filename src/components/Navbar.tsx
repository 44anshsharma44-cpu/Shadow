'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useUserStore } from '@/stores/UserStore';
import { useGameStore } from '@/stores/GameStore';
import { Trophy, User, Settings, Swords, LogOut, Flame } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  
  const { user, isGuest, guestName, logout: storeLogout } = useUserStore();
  const gameStatus = useGameStore((s) => s.status);

  // If in active fighting state, simplify or hide navbar to maximize focus
  const isFighting = gameStatus === 'FIGHTING' || gameStatus === 'COUNTDOWN';

  const handleLogout = async () => {
    if (isGuest) {
      storeLogout();
      router.push('/');
    } else {
      storeLogout();
      await signOut({ callbackUrl: '/' });
    }
  };

  const navLinks = [
    { href: '/play', label: 'Arena', icon: Swords },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { href: '/profile', label: 'Profile', icon: User },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  const displayName = user ? (user.name || user.email.split('@')[0]) : isGuest ? guestName : null;

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${
      isFighting 
        ? 'opacity-0 h-0 overflow-hidden pointer-events-none' 
        : 'bg-[#0f111a]/80 backdrop-blur-md border-b border-[#1f2833]/40 shadow-[0_4px_20px_rgba(0,0,0,0.4)]'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="bg-gradient-to-br from-[#45f3ff] to-[#ff007f] p-1.5 rounded-lg shadow-[0_0_15px_rgba(69,243,255,0.4)] transition-all group-hover:scale-115">
                <Flame className="w-5 h-5 text-black animate-pulse" />
              </div>
              <span className="font-extrabold text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-[#45f3ff] to-[#ff007f] group-hover:shadow-glow duration-300">
                SHADOW BOXING AI
              </span>
            </Link>
          </div>

          {/* Navigation Links */}
          {displayName && (
            <nav className="hidden md:flex items-center space-x-1">
              {navLinks.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold tracking-wide transition-all duration-200 ${
                      isActive
                        ? 'bg-[#1f2833]/40 text-[#45f3ff] border border-[#45f3ff]/20 shadow-[0_0_10px_rgba(69,243,255,0.15)]'
                        : 'text-[#c5c6c7] hover:bg-[#1f2833]/20 hover:text-white hover:border hover:border-[#1f2833]/30'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Profile & Logout controls */}
          <div className="flex items-center gap-4">
            {displayName ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs text-gray-500 font-medium tracking-wider">
                    {isGuest ? 'GUEST FIGHTER' : 'RANKED BOXER'}
                  </span>
                  <span className="text-sm font-bold text-white tracking-wide">{displayName}</span>
                </div>
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#1f2833] to-[#45f3ff]/30 flex items-center justify-center border border-[#45f3ff]/20 text-white font-extrabold text-sm shadow-[0_0_10px_rgba(69,243,255,0.1)]">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <button
                  onClick={handleLogout}
                  title="Logout / Exit Session"
                  className="p-2 rounded-xl text-gray-400 hover:text-[#ff007f] hover:bg-[#ff007f]/5 border border-transparent hover:border-[#ff007f]/20 transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/"
                className="bg-[#1f2833] border border-[#45f3ff]/20 text-[#45f3ff] hover:bg-[#45f3ff]/10 px-4 py-2 rounded-xl text-sm font-bold tracking-wide transition-all shadow-[0_0_10px_rgba(69,243,255,0.1)]"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Nav Links */}
      {displayName && (
        <div className="md:hidden border-t border-[#1f2833]/30 flex justify-around py-2 px-4 bg-[#0f111a]/90">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-semibold ${
                  isActive ? 'text-[#45f3ff]' : 'text-gray-400'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}

export default Navbar;
