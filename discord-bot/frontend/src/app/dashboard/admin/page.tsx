'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { ShieldCheck, Server, Globe, DollarSign, Activity, AlertOctagon, RefreshCw, Cpu } from 'lucide-react';

export default function AdminPage() {
  const { showNotification } = useAppStore();

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [featureFlags, setFeatureFlags] = useState([
    { key: 'ai-voice-synthesis', name: 'AI Voice Synthesis Engine', enabled: true },
    { key: 'canvas-gpu-acceleration', name: 'GPU Canvas Pre-rendering', enabled: true },
    { key: 'bullmq-concurrency-high', name: 'High-Concurrency Queue Workers', enabled: true },
  ]);

  const toggleFlag = (key: string) => {
    setFeatureFlags((prev) =>
      prev.map((f) => {
        if (f.key === key) {
          const nextState = !f.enabled;
          showNotification(`Global feature flag "${f.name}" set to ${nextState}`);
          return { ...f, enabled: nextState };
        }
        return f;
      })
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6 text-discord-blurple" />
            <span>Admin SaaS Control Center</span>
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">Global multi-tenant platform metrics, sharding status, and feature flags.</p>
        </div>

        <button
          onClick={() => {
            setMaintenanceMode(!maintenanceMode);
            showNotification(maintenanceMode ? 'System maintenance mode disabled' : 'MAINTENANCE MODE ENGAGED GLOBALLY', 'error');
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 border ${
            maintenanceMode
              ? 'bg-rose-500 text-white border-rose-600 shadow-lg shadow-rose-500/30'
              : 'glass-panel text-slate-300 border-white/10 hover:bg-white/10'
          }`}
        >
          <AlertOctagon className="w-4 h-4" />
          <span>{maintenanceMode ? 'Maintenance Engaged' : 'Engage Maintenance Mode'}</span>
        </button>
      </div>

      {/* Global SaaS Platform Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Guilds</span>
            <Server className="w-5 h-5 text-discord-blurple" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-4">12,480</div>
          <p className="text-[11px] text-discord-green mt-1">+140 guilds joined today</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Registered Users</span>
            <Globe className="w-5 h-5 text-discord-fuchsia" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-4">4.2M</div>
          <p className="text-[11px] text-slate-400 mt-1">Multi-tenant OAuth sessions</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monthly Recurring Revenue</span>
            <DollarSign className="w-5 h-5 text-discord-green" />
          </div>
          <div className="text-3xl font-extrabold text-discord-green mt-4">$48,920</div>
          <p className="text-[11px] text-slate-400 mt-1">Stripe & Crypto active subs</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Bot Shards</span>
            <Activity className="w-5 h-5 text-discord-yellow" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-4">16 Shards</div>
          <p className="text-[11px] text-discord-green mt-1">Cluster 100% healthy</p>
        </div>
      </div>

      {/* Global Feature Flags */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-discord-fuchsia" />
          <span>Global Feature Flags & Engine Toggles</span>
        </h3>

        <div className="space-y-3">
          {featureFlags.map((flag) => (
            <div key={flag.key} className="p-4 bg-discord-card rounded-xl border border-white/10 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">{flag.name}</p>
                <p className="text-[10px] font-mono text-slate-400">Flag Key: {flag.key}</p>
              </div>

              <button
                onClick={() => toggleFlag(flag.key)}
                className={`w-11 h-6 rounded-full p-1 transition ${flag.enabled ? 'bg-discord-green justify-end' : 'bg-slate-700 justify-start'} flex items-center`}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow-md" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
