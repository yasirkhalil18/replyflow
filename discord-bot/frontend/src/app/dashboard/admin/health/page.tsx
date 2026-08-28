'use client';

import React from 'react';
import { Activity, Server, Radio, Database, Cpu, HardDrive, Zap, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function ShardHealthDashboardPage() {
  const shards = [
    { id: 0, status: 'ONLINE', latency: 12, ram: '142 MB', cpu: '1.2%', guilds: 1540, users: '420,000', eventsPerSec: 140, queueLength: 0 },
    { id: 1, status: 'ONLINE', latency: 14, ram: '158 MB', cpu: '1.4%', guilds: 1620, users: '480,000', eventsPerSec: 185, queueLength: 2 },
    { id: 2, status: 'ONLINE', latency: 11, ram: '139 MB', cpu: '1.1%', guilds: 1490, users: '390,000', eventsPerSec: 120, queueLength: 0 },
    { id: 3, status: 'ONLINE', latency: 16, ram: '164 MB', cpu: '1.8%', guilds: 1710, users: '510,000', eventsPerSec: 210, queueLength: 1 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Activity className="w-6 h-6 text-discord-green" />
            <span>Live Shard Cluster Telemetry & Health</span>
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">Real-time Shard 0..N performance, memory, queue length, and DB connection pool state.</p>
        </div>

        <span className="px-3 py-1.5 rounded-xl bg-discord-green/20 text-discord-green text-xs font-bold font-mono border border-discord-green/30">
          ALL 4 SHARDS HEALTHY
        </span>
      </div>

      {/* Cluster System Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-white/10">
          <div className="flex justify-between text-xs font-bold text-slate-400"><span>REDIS HA CACHE</span> <Radio className="w-4 h-4 text-discord-green" /></div>
          <div className="text-2xl font-extrabold text-white mt-3">6379 / ACTIVE</div>
          <p className="text-[11px] text-discord-green mt-1">0.4ms latency • 0 dropped msgs</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-white/10">
          <div className="flex justify-between text-xs font-bold text-slate-400"><span>POSTGRES DB POOL</span> <Database className="w-4 h-4 text-discord-blurple" /></div>
          <div className="text-2xl font-extrabold text-white mt-3">18 / 50 CONNS</div>
          <p className="text-[11px] text-slate-400 mt-1">PG16 Primary + Hot Replica</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-white/10">
          <div className="flex justify-between text-xs font-bold text-slate-400"><span>BULLMQ WORKERS</span> <Zap className="w-4 h-4 text-discord-yellow" /></div>
          <div className="text-2xl font-extrabold text-white mt-3">8 WORKERS</div>
          <p className="text-[11px] text-discord-green mt-1">3 jobs in queue • 0 stalled</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-white/10">
          <div className="flex justify-between text-xs font-bold text-slate-400"><span>CLUSTER EVENTS/SEC</span> <Activity className="w-4 h-4 text-discord-fuchsia" /></div>
          <div className="text-2xl font-extrabold text-white mt-3">655 EVT/SEC</div>
          <p className="text-[11px] text-slate-400 mt-1">Gateway Shard throughput</p>
        </div>
      </div>

      {/* Live Shards Detail Grid */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
        <h3 className="text-base font-bold text-white">Active ShardingManager Node Matrix</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 uppercase font-semibold">
                <th className="py-3 px-4">Shard ID</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Gateway Latency</th>
                <th className="py-3 px-4">RAM Footprint</th>
                <th className="py-3 px-4">CPU Load</th>
                <th className="py-3 px-4">Assigned Guilds</th>
                <th className="py-3 px-4">Throughput</th>
                <th className="py-3 px-4">Queue Depth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {shards.map((s) => (
                <tr key={s.id} className="hover:bg-white/5 transition">
                  <td className="py-3.5 px-4 font-bold text-discord-blurple">Shard #{s.id}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded bg-discord-green/20 text-discord-green font-bold text-[10px]">
                      {s.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-white font-bold">{s.latency} ms</td>
                  <td className="py-3.5 px-4 text-slate-300">{s.ram}</td>
                  <td className="py-3.5 px-4 text-slate-300">{s.cpu}</td>
                  <td className="py-3.5 px-4 text-white font-bold">{s.guilds.toLocaleString()}</td>
                  <td className="py-3.5 px-4 text-discord-fuchsia">{s.eventsPerSec} evt/s</td>
                  <td className="py-3.5 px-4 text-slate-400">{s.queueLength} jobs</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
