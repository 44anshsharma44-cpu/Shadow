'use client';

import React, { useEffect } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import { useSettingsStore } from '@/stores/SettingsStore';
import { useUserStore } from '@/stores/UserStore';

// Internal coordinator to sync NextAuth session with Zustand UserStore
function StoreSessionInitializer({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const setUser = useUserStore((s) => s.setUser);
  const loadStats = useUserStore((s) => s.loadStats);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    // Initial load from localStorage (settings & local guest stats)
    loadSettings();
    loadStats();
  }, [loadSettings, loadStats]);

  useEffect(() => {
    if (session?.user) {
      setUser({
        id: (session.user as any).id || '',
        name: session.user.name || '',
        email: session.user.email || '',
      });
      
      // Sync DB settings to store if logged in
      const fetchDbSettings = async () => {
        try {
          const res = await fetch('/api/settings');
          if (res.ok) {
            const data = await res.json();
            // Sync values to Zustand
            useSettingsStore.setState({
              difficulty: data.difficulty,
              volume: data.volume,
              sensitivity: data.sensitivity,
              cameraId: data.cameraId,
            });
          }
        } catch (e) {
          console.warn('Failed to load database settings:', e);
        }
      };
      fetchDbSettings();
    } else {
      setUser(null);
    }
  }, [session, setUser]);

  return <>{children}</>;
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <StoreSessionInitializer>{children}</StoreSessionInitializer>
    </SessionProvider>
  );
}

export default ClientLayout;
