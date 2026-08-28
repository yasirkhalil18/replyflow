'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { 
  Users, 
  MessageSquare, 
  Mic, 
  Ticket, 
  Bot, 
  Zap, 
  ShieldCheck, 
  TrendingUp, 
  ArrowUpRight, 
  Radio, 
  Clock, 
  CheckCircle2, 
  Sparkles,
  Settings
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

const mockChartData = [
  { day: 'Mon', members: 24100, messages: 14200 },
  { day: 'Tue', members: 24220, messages: 16800 },
  { day: 'Wed', members: 24400, messages: 19100 },
  { day: 'Thu', members: 24550, messages: 18400 },
  { day: 'Fri', members: 24700, messages: 22900 },
  { day: 'Sat', members: 24820, messages: 28400 },
  { day: 'Sun', members: 24890, messages: 31200 },
];

export default function OverviewPage() {
  const { currentGuild, showNotification } = useAppStore();
  const [botOnline, setBotOnline] = useState(true);

  return (
    <div className="space-y-8">
      {/* Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-3">
            <span>Server Overview</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-discord-green/10 text-discord-green border border-discord-green/20 font-mono font-normal">
              Active Sync
            </span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Real-time performance metrics and bot cluster connection state for <strong className="text-white">{currentGuild?.name}</strong>.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setBotOnline(!botOnline);
              showNotification(botOnline ? 'Bot cluster paused' : 'Bot cluster synchronized & active');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 border ${
              botOnline
                ? 'bg-discord-green/10 text-discord-green border-discord-green/30 hover:bg-discord-green/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${botOnline ? 'animate-pulse' : ''}`} />
            <span>{botOnline ? 'Bot Engine Online' : 'Bot Engine Paused'}</span>
          </button>
        </div>
      </div>

      {/* Top 4 Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Members</span>
            <div className="w-9 h-9 rounded-xl bg-discord-blurple/20 flex items-center justify-center text-discord-blurple">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-white">{currentGuild?.memberCount?.toLocaleString()}</div>
            <span className="text-xs font-semibold text-discord-green flex items-center">
              +12% <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">8,420 users currently online</div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Messages Today</span>
            <div className="w-9 h-9 rounded-xl bg-discord-fuchsia/20 flex items-center justify-center text-discord-fuchsia">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-white">31,200</div>
            <span className="text-xs font-semibold text-discord-green flex items-center">
              +24% <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Peak: 11,200 msg/hr at 20:00</div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tickets Resolved</span>
            <div className="w-9 h-9 rounded-xl bg-discord-green/20 flex items-center justify-center text-discord-green">
              <Ticket className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-white">142</div>
            <span className="text-xs font-semibold text-discord-green flex items-center">
              98.4% CSAT
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Avg response time: 4 mins</div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Tokens Used</span>
            <div className="w-9 h-9 rounded-xl bg-discord-yellow/20 flex items-center justify-center text-discord-yellow">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-white">149.2K</div>
            <span className="text-xs font-mono text-slate-400">/ 500K Max</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">GPT-4o & DeepSeek R1 Models</div>
        </div>
      </div>

      {/* Main Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-discord-blurple" />
                <span>Member Growth & Activity Trends</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Weekly comparison of joined members vs message volume.</p>
            </div>
            <div className="flex items-center space-x-2 text-xs font-medium">
              <span className="flex items-center space-x-1 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-discord-blurple inline-block" />
                <span>Members</span>
              </span>
              <span className="flex items-center space-x-1 text-slate-300 ml-4">
                <span className="w-2.5 h-2.5 rounded-full bg-discord-fuchsia inline-block" />
                <span>Messages</span>
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockChartData}>
                <defs>
                  <linearGradient id="colorMembers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5865F2" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#5865F2" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EB459E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#EB459E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#161922', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                />
                <Area type="monotone" dataKey="members" stroke="#5865F2" strokeWidth={3} fillOpacity={1} fill="url(#colorMembers)" />
                <Area type="monotone" dataKey="messages" stroke="#EB459E" strokeWidth={2} fillOpacity={1} fill="url(#colorMessages)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Audit Log Feed */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col">
          <h3 className="text-base font-bold text-white mb-4 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-discord-green" />
            <span>Recent Audit Logs</span>
          </h3>

          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs space-y-1">
              <div className="flex items-center justify-between text-slate-300 font-semibold">
                <span className="text-discord-green font-mono">AUTOMOD_FLAG</span>
                <span className="text-[10px] text-slate-500">2 mins ago</span>
              </div>
              <p className="text-slate-400">Timed out user <strong className="text-white">User#9012</strong> for Toxicity Score 0.94</p>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs space-y-1">
              <div className="flex items-center justify-between text-slate-300 font-semibold">
                <span className="text-discord-blurple font-mono">TICKET_CLOSED</span>
                <span className="text-[10px] text-slate-500">14 mins ago</span>
              </div>
              <p className="text-slate-400">Ticket #1047 closed by staff <strong className="text-white">AdminAlex</strong> (PDF Transcript saved)</p>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs space-y-1">
              <div className="flex items-center justify-between text-slate-300 font-semibold">
                <span className="text-discord-fuchsia font-mono">AUTOMATION_EXEC</span>
                <span className="text-[10px] text-slate-500">45 mins ago</span>
              </div>
              <p className="text-slate-400">Triggered "VIP Welcome Onboarding" for <strong className="text-white">CyberViper</strong></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
