'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { ShieldAlert, Save, ArrowLeft, ShieldCheck, Zap, AlertTriangle, Terminal, Sliders, Lock } from 'lucide-react';
import Link from 'next/link';

export default function AutoModPluginPage() {
  const { showNotification } = useAppStore();

  const [aiToxicity, setAiToxicity] = useState(0.85);
  const [antiLink, setAntiLink] = useState(true);
  const [antiInvite, setAntiInvite] = useState(true);
  const [antiSpam, setAntiSpam] = useState(true);
  const [actionType, setActionType] = useState('TIMEOUT');
  const [timeoutMinutes, setTimeoutMinutes] = useState(15);

  const violationLogs = [
    { id: '1', user: 'SpamBot#9012', rule: 'Anti-Invite Link', action: 'TIMEOUT (15m)', time: '2m ago', content: 'Join discord.gg/fake-nitro for free gifts!' },
    { id: '2', user: 'ToxicUser#4019', rule: 'AI Toxicity (0.94)', action: 'TIMEOUT (60m)', time: '14m ago', content: '[Violent hate speech detected by AI Engine]' },
    { id: '3', user: 'MassPing#1337', rule: 'Anti-Mention Spam', action: 'KICK', time: '1h ago', content: '@everyone @here check this out!' },
  ];

  const handleSave = () => {
    showNotification('Auto Moderation AI shield rules updated!');
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
              <ShieldAlert className="w-6 h-6 text-discord-green" />
              <span>Auto Moderation AI Shield</span>
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">Real-time threat detection, AI toxicity scoring, anti-spam, and automated punishments.</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl font-bold text-xs bg-discord-blurple hover:bg-discord-blurple/90 text-white transition flex items-center space-x-2 shadow-lg shadow-discord-blurple/25"
        >
          <Save className="w-4 h-4" />
          <span>Save Shield Rules</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Threat Rule Controls */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          <h3 className="text-base font-bold text-white pb-3 border-b border-white/10 flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-discord-green" />
            <span>AI Filters & Detection Thresholds</span>
          </h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="text-slate-300">AI Toxicity Sensitivity Threshold</span>
                <span className="text-discord-green font-mono">{(aiToxicity * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.50"
                max="0.99"
                step="0.01"
                value={aiToxicity}
                onChange={(e) => setAiToxicity(parseFloat(e.target.value))}
                className="w-full accent-discord-green bg-discord-card rounded-lg h-2"
              />
              <p className="text-[11px] text-slate-500 mt-1">Messages scoring above {(aiToxicity * 100).toFixed(0)}% toxicity are automatically flagged.</p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3 glass-panel rounded-xl border border-white/10">
                <div>
                  <p className="text-xs font-bold text-white">Anti Discord Invite Links</p>
                  <p className="text-[10px] text-slate-400">Block unauthorized discord.gg invites</p>
                </div>
                <button
                  onClick={() => setAntiInvite(!antiInvite)}
                  className={`w-11 h-6 rounded-full p-1 transition ${antiInvite ? 'bg-discord-green justify-end' : 'bg-slate-700 justify-start'} flex items-center`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 glass-panel rounded-xl border border-white/10">
                <div>
                  <p className="text-xs font-bold text-white">Anti External URL Links</p>
                  <p className="text-[10px] text-slate-400">Filter untrusted phising & scam domain links</p>
                </div>
                <button
                  onClick={() => setAntiLink(!antiLink)}
                  className={`w-11 h-6 rounded-full p-1 transition ${antiLink ? 'bg-discord-green justify-end' : 'bg-slate-700 justify-start'} flex items-center`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 glass-panel rounded-xl border border-white/10">
                <div>
                  <p className="text-xs font-bold text-white">Rapid Spam & Mention Shield</p>
                  <p className="text-[10px] text-slate-400">Prevent mass pings and repeated identical text</p>
                </div>
                <button
                  onClick={() => setAntiSpam(!antiSpam)}
                  className={`w-11 h-6 rounded-full p-1 transition ${antiSpam ? 'bg-discord-green justify-end' : 'bg-slate-700 justify-start'} flex items-center`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Punishment Settings & Log Stream */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          <h3 className="text-base font-bold text-white pb-3 border-b border-white/10 flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-discord-blurple" />
            <span>Violation Punishment Rules</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Action on Violation Flag</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="w-full bg-discord-card border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-discord-blurple"
              >
                <option value="TIMEOUT">Mute / Timeout User</option>
                <option value="KICK">Kick from Server</option>
                <option value="BAN">Ban User Permanently</option>
                <option value="WARN">Issue Warning Record Only</option>
              </select>
            </div>

            {actionType === 'TIMEOUT' && (
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Timeout Duration (Minutes)</label>
                <input
                  type="number"
                  value={timeoutMinutes}
                  onChange={(e) => setTimeoutMinutes(parseInt(e.target.value))}
                  className="w-full bg-discord-card border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-discord-blurple"
                />
              </div>
            )}

            <div className="pt-4 border-t border-white/10">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">Live Violation Stream</span>
              <div className="space-y-2">
                {violationLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-discord-card rounded-xl border border-white/5 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="font-bold text-rose-400">{log.user}</span>
                      <span className="text-[10px] font-mono text-slate-500">{log.time}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">{log.rule}</span>
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-mono font-bold text-[10px]">{log.action}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
