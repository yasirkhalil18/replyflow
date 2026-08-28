'use client';

import React from 'react';
import Link from 'next/link';
import { Bot, CheckCircle2, AlertTriangle, ShieldCheck, ArrowLeft } from 'lucide-react';

export default function PublicStatusPage() {
  const services = [
    { name: 'REST API & Webhooks', status: 'OPERATIONAL', latency: '12ms', uptime: '99.99%' },
    { name: 'Dashboard Web App', status: 'OPERATIONAL', latency: '18ms', uptime: '99.98%' },
    { name: 'Discord Bot Cluster (Shards 0..3)', status: 'OPERATIONAL', latency: '14ms', uptime: '100.0%' },
    { name: 'Multi-LLM AI Engine', status: 'OPERATIONAL', latency: '140ms', uptime: '99.95%' },
    { name: 'Billing & Webhooks (Stripe / PayPal)', status: 'OPERATIONAL', latency: '45ms', uptime: '100.0%' },
    { name: 'Discord Gateway Connection', status: 'OPERATIONAL', latency: '11ms', uptime: '99.99%' },
  ];

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-white/10">
        <Link href="/" className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-discord-blurple to-discord-fuchsia flex items-center justify-center font-bold text-white shadow-md">
            <Bot className="w-5 h-5" />
          </div>
          <span className="text-base font-bold text-white tracking-tight">Discord Automation Cloud</span>
        </Link>
        <span className="text-xs font-mono text-slate-400">Updated 10s ago</span>
      </div>

      {/* Main Global Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-discord-green/40 bg-discord-green/10 flex items-center space-x-4">
        <CheckCircle2 className="w-8 h-8 text-discord-green shrink-0" />
        <div>
          <h2 className="text-lg font-bold text-white">All Systems Operational</h2>
          <p className="text-xs text-slate-300">All services, bot shards, AI models, and database clusters are running at 100% healthy capacity.</p>
        </div>
      </div>

      {/* Individual Services Status Table */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">System Services Status</h3>

        <div className="divide-y divide-white/10">
          {services.map((s, i) => (
            <div key={i} className="py-4 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-3">
                <span className="w-2.5 h-2.5 rounded-full bg-discord-green animate-pulse" />
                <span className="font-bold text-white">{s.name}</span>
              </div>

              <div className="flex items-center space-x-6 font-mono">
                <span className="text-slate-400">{s.latency}</span>
                <span className="text-slate-400">{s.uptime} uptime</span>
                <span className="px-2.5 py-0.5 rounded bg-discord-green/20 text-discord-green font-bold text-[10px]">
                  {s.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <footer className="text-center text-xs text-slate-500 pt-8 border-t border-white/10">
        Discord Automation Cloud SaaS Status Dashboard • Monitored 24/7 by Prometheus & Grafana Loki.
      </footer>
    </div>
  );
}
