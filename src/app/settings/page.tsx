'use client';

import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '@/stores/SettingsStore';
import { useUserStore } from '@/stores/UserStore';
import { useCamera } from '@/hooks/useCamera';
import { Settings, Volume2, Shield, Eye, Camera, Activity, Save, Loader2, Sparkles } from 'lucide-react';

export default function SettingsPage() {
  const { user, isGuest } = useUserStore();
  const {
    difficulty,
    volume,
    sensitivity,
    cameraId,
    showOverlay,
    setDifficulty,
    setVolume,
    setSensitivity,
    setCameraId,
    toggleOverlay,
  } = useSettingsStore();

  const { devices, refreshDevices } = useCamera(cameraId);
  
  const [saving, setSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  // Grab active camera inputs when mounting
  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  const handleSave = async () => {
    setSaving(true);
    setSaveBanner(null);

    if (user && !isGuest) {
      // Sync to SQLite
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            difficulty,
            volume,
            sensitivity,
            cameraId,
          }),
        });

        if (res.ok) {
          setSaveBanner('Database settings synced successfully!');
        } else {
          setSaveBanner('Local settings updated. Failed to sync online database.');
        }
      } catch (e) {
        console.error('Failed to sync settings:', e);
        setSaveBanner('Local settings updated. Network sync failed.');
      }
    } else {
      setSaveBanner('Guest settings updated locally!');
    }

    setSaving(false);
    setTimeout(() => setSaveBanner(null), 3500);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0b0c10] p-4 sm:p-6 md:p-8 flex flex-col items-center">
      <div className="max-w-2xl w-full z-10 space-y-6">
        
        {/* Title */}
        <div className="flex justify-between items-center border-b border-[#1f2833]/40 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 h-11 w-11 rounded-xl bg-gradient-to-tr from-[#45f3ff]/20 to-[#45f3ff]/40 flex items-center justify-center text-[#45f3ff] border border-[#45f3ff]/30 shadow-[0_0_15px_rgba(69,243,255,0.2)]">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-black italic tracking-wider text-white uppercase">
                SETTINGS
              </h1>
              <p className="text-xs text-gray-500 font-bold tracking-widest uppercase mt-0.5">Configure Shadow Arena</p>
            </div>
          </div>
        </div>

        {saveBanner && (
          <div className="bg-[#45f3ff]/10 border border-[#45f3ff]/20 text-[#45f3ff] text-xs py-3 px-4 rounded-2xl font-bold animate-pulse">
            {saveBanner}
          </div>
        )}

        <div className="bg-[#0f111a] border border-[#1f2833] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {/* 1. Camera input */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 tracking-widest uppercase flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#45f3ff]" /> PREFERRED CAMERA INPUT
            </label>
            {devices.length === 0 ? (
              <p className="text-xs text-gray-500 font-medium">No cameras detected. Grant permissions in browser first.</p>
            ) : (
              <select
                value={cameraId}
                onChange={(e) => setCameraId(e.target.value)}
                className="w-full bg-[#0b0c10] border border-[#1f2833] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#45f3ff] cursor-pointer"
              >
                <option value="">Default System Webcam</option>
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 2. Difficulty */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 tracking-widest uppercase flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#45f3ff]" /> FIGHT DIFFICULTY LEVEL
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['EASY', 'MEDIUM', 'HARD'].map((level) => {
                const isActive = difficulty === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level as any)}
                    className={`py-3.5 text-center text-xs font-black tracking-widest uppercase rounded-xl transition-all cursor-pointer border ${
                      isActive
                        ? level === 'HARD'
                          ? 'bg-red-500/10 text-red-400 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                          : level === 'EASY'
                          ? 'bg-green-500/10 text-green-400 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.15)]'
                          : 'bg-[#45f3ff]/10 text-[#45f3ff] border-[#45f3ff] shadow-[0_0_15px_rgba(69,243,255,0.15)]'
                        : 'bg-black/40 text-gray-400 border-[#1f2833]/60 hover:text-white hover:border-gray-700'
                    }`}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-500 font-medium">
              * Difficulty adjusts AI opponent attack rates, block chances, and strike speeds.
            </p>
          </div>

          {/* 3. Sensitivity */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-gray-400 tracking-widest uppercase flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#45f3ff]" /> POSE SENSITIVITY
              </label>
              <span className="text-xs font-extrabold text-white font-mono">{Math.round(sensitivity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={sensitivity}
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
              className="w-full accent-[#45f3ff] cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-gray-500 font-bold uppercase tracking-wider">
              <span>Slower Movements (Harder)</span>
              <span>Lighter / Swift (Easier)</span>
            </div>
          </div>

          {/* 4. Volume */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-gray-400 tracking-widest uppercase flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-[#45f3ff]" /> AUDIO VOLUME
              </label>
              <span className="text-xs font-extrabold text-white font-mono">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full accent-[#45f3ff] cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-gray-500 font-bold uppercase tracking-wider">
              <span>Muted</span>
              <span>Maximum Volume</span>
            </div>
          </div>

          {/* 5. Skeleton Overlay toggle */}
          <div className="flex items-center justify-between border-t border-[#1f2833]/40 pt-5">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-gray-500" />
              <div>
                <span className="text-xs font-black tracking-widest text-gray-300 uppercase block">
                  SHOW AI SKELETON OVERLAY
                </span>
                <span className="text-[10px] text-gray-500 font-medium">Draw joint tracking vectors on camera feed.</span>
              </div>
            </div>
            <button
              onClick={toggleOverlay}
              className={`w-12 h-6 rounded-full transition-all relative ${
                showOverlay ? 'bg-[#45f3ff]' : 'bg-gray-800'
              } cursor-pointer`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-black transition-all ${
                  showOverlay ? 'left-6' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {/* Save Action */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-[#45f3ff] hover:bg-sky-400 text-black font-extrabold text-xs tracking-widest py-3.5 rounded-xl shadow-[0_0_15px_rgba(69,243,255,0.15)] hover:scale-102 transition-all cursor-pointer uppercase border-none mt-8"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving Settings...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Configuration
              </>
            )}
          </button>

        </div>
      </div>
    </div>
  );
}
