'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { BarChart3, Save, ArrowLeft, RefreshCcw, Plus, Trash2, Hash, Volume2 } from 'lucide-react';
import Link from 'next/link';

export default function LiveStatsPluginPage() {
  const { showNotification } = useAppStore();

  const [intervalMin, setIntervalMin] = useState(10);
  const [counters, setCounters] = useState([
    { id: '1', type: 'total_members', format: '👥┆Members: {count}', value: '24,890' },
    { id: '2', type: 'online_members', format: '🟢┆Online: {count}', value: '8,420' },
    { id: '3', type: 'server_boosts', format: '🚀┆Boosts: Level {level}', value: 'Level 3' },
    { id: '4', type: 'voice_users', format: '🎙️┆In Voice: {count}', value: '142' }
  ]);

  const handleSave = () => {
    showNotification('Live Stats counter configurations saved!');
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/dashboard/plugins" className="p-2 rounded-xl glass-panel hover:bg-white/10 text-slate-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
              <BarChart3 className="w-6 h-6 text-discord-blurple" />
              <span>Live Stats Channel Counters</span>
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">Automated statistical channels updated in real-time.</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl font-bold text-xs bg-discord-blurple hover:bg-discord-blurple/90 text-white transition flex items-center space-x-2 shadow-lg shadow-discord-blurple/25"
        >
          <Save className="w-4 h-4" />
          <span>Save Stat Counters</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          <h3 className="text-base font-bold text-white pb-3 border-b border-white/10">Counter Settings</h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="text-slate-300">Auto Refresh Interval</span>
                <span className="text-discord-blurple font-mono">Every {intervalMin} minutes</span>
              </div>
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={intervalMin}
                onChange={(e) => setIntervalMin(parseInt(e.target.value))}
                className="w-full accent-discord-blurple bg-discord-card rounded-lg h-2"
              />
            </div>

            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-slate-300 block">Active Stat Channels</label>
              {counters.map((c, index) => (
                <div key={c.id} className="p-3 bg-discord-card rounded-xl border border-white/10 flex items-center justify-between gap-3">
                  <Volume2 className="w-4 h-4 text-discord-blurple shrink-0" />
                  <input
                    type="text"
                    value={c.format}
                    onChange={(e) => {
                      const updated = [...counters];
                      updated[index].format = e.target.value;
                      setCounters(updated);
                    }}
                    className="flex-1 bg-transparent border-b border-white/10 text-xs font-mono text-white focus:outline-none focus:border-discord-blurple"
                  />
                  <span className="text-[10px] text-discord-green font-mono px-2 py-1 bg-discord-green/10 rounded">
                    {c.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Channel Tree Preview */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 block">
            Discord Channel Tree Simulation
          </span>

          <div className="bg-[#2b2d31] p-4 rounded-xl space-y-2 border border-white/10">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">
              📊 Server Stats Category
            </div>
            {counters.map((c) => (
              <div key={c.id} className="flex items-center space-x-2 px-3 py-1.5 rounded bg-[#1e1f22] text-xs font-semibold text-slate-200">
                <Volume2 className="w-4 h-4 text-slate-400" />
                <span>{c.format.replace('{count}', c.value).replace('{level}', c.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Current Users & Telemetry Dashboard */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <span>👥</span>
              <span>Live Current Users & System Telemetry</span>
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">
              Real-time user presence, roles, levels, and activity synced live with Discord Gateway.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-discord-green/20 text-discord-green text-xs font-bold border border-discord-green/30 animate-pulse">
              ● Gateway Stream Live
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400 uppercase tracking-wider bg-white/5 font-bold">
              <tr>
                <th className="p-3.5 rounded-l-xl">Member Handle</th>
                <th class="p-3.5">Online Status</th>
                <th className="p-3.5">Assigned Roles</th>
                <th className="p-3.5">Level & XP</th>
                <th className="p-3.5">Joined Date</th>
                <th className="p-3.5 rounded-r-xl">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              <tr className="hover:bg-white/5 transition">
                <td className="p-3.5 flex items-center space-x-3">
                  <div className="relative">
                    <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" className="w-8 h-8 rounded-full object-cover ring-2 ring-emerald-500" />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-discord-green border-2 border-[#161922]"></span>
                  </div>
                  <div>
                    <p className="font-bold text-white">Alex Morgan</p>
                    <p className="text-[10px] text-slate-400">@alexmorgan</p>
                  </div>
                </td>
                <td className="p-3.5">
                  <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-discord-green/20 text-discord-green border border-discord-green/30">
                    🟢 Online
                  </span>
                </td>
                <td className="p-3.5">
                  <span className="px-2 py-0.5 rounded bg-discord-blurple/20 text-indigo-300 font-semibold text-[10px] mr-1">Admin</span>
                  <span className="px-2 py-0.5 rounded bg-white/10 text-slate-300 font-semibold text-[10px]">Member</span>
                </td>
                <td className="p-3.5"><span className="font-bold text-amber-400">Lvl 4</span> <span className="text-slate-400">(1,840 XP)</span></td>
                <td className="p-3.5 text-slate-400">2026-08-05</td>
                <td className="p-3.5"><span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[9px]">ADMIN</span></td>
              </tr>
              <tr className="hover:bg-white/5 transition">
                <td className="p-3.5 flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-discord-blurple flex items-center justify-center font-bold text-white text-xs">🤖</div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-discord-green border-2 border-[#161922]"></span>
                  </div>
                  <div>
                    <p className="font-bold text-white">Automation Bot</p>
                    <p className="text-[10px] text-slate-400">@automationbot</p>
                  </div>
                </td>
                <td className="p-3.5">
                  <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-discord-green/20 text-discord-green border border-discord-green/30">
                    🟢 Online
                  </span>
                </td>
                <td className="p-3.5">
                  <span className="px-2 py-0.5 rounded bg-discord-blurple/20 text-indigo-300 font-semibold text-[10px]">System Bot</span>
                </td>
                <td className="p-3.5"><span className="font-bold text-amber-400">Lvl 100</span> <span className="text-slate-400">(MAX)</span></td>
                <td className="p-3.5 text-slate-400">2026-08-05</td>
                <td className="p-3.5"><span className="px-2 py-0.5 rounded bg-discord-blurple text-white font-bold text-[9px]">BOT</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
