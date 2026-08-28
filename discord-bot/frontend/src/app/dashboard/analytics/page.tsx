'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { BarChart3, TrendingUp, MessageSquare, Mic, ShieldAlert, Cpu, Calendar } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts';

const messageVolumeData = [
  { hour: '00:00', messages: 1420, voiceUsers: 45 },
  { hour: '04:00', messages: 680, voiceUsers: 18 },
  { hour: '08:00', messages: 2940, voiceUsers: 82 },
  { hour: '12:00', messages: 5410, voiceUsers: 140 },
  { hour: '16:00', messages: 8900, voiceUsers: 210 },
  { hour: '20:00', messages: 11200, voiceUsers: 340 },
];

const pluginUsageData = [
  { name: 'Welcome', usage: 18450 },
  { name: 'Leveling', usage: 29400 },
  { name: 'Tickets', usage: 1420 },
  { name: 'Live Stats', usage: 38200 },
  { name: 'AutoMod', usage: 42100 },
  { name: 'AI Assistant', usage: 21500 },
];

export default function AnalyticsPage() {
  const { currentGuild } = useAppStore();

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <BarChart3 className="w-6 h-6 text-discord-blurple" />
            <span>Analytics Suite</span>
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">Deep telemetry for server message volume, voice activity, and plugin adoption.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Hourly Activity Breakdown */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-discord-blurple" />
            <span>Hourly Message & Voice Activity</span>
          </h3>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={messageVolumeData}>
                <defs>
                  <linearGradient id="colorMsg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5865F2" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#5865F2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#161922', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                <Area type="monotone" dataKey="messages" stroke="#5865F2" strokeWidth={3} fillOpacity={1} fill="url(#colorMsg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plugin Usage Bar Chart */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-discord-fuchsia" />
            <span>Plugin Execution Distribution</span>
          </h3>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pluginUsageData}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#161922', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                <Bar dataKey="usage" fill="#EB459E" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
