'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Award, Zap, Save, ArrowLeft, Trophy, Sliders, Users, Search } from 'lucide-react';
import Link from 'next/link';

export default function LevelingPluginPage() {
  const { showNotification } = useAppStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [xpRate, setXpRate] = useState(1.5);
  const [dailyXP, setDailyXP] = useState(250);
  const [voiceXP, setVoiceXP] = useState(true);

  // Leaderboard Mock Data
  const leaderboardUsers = [
    { rank: 1, name: 'CyberNetRunner', level: 42, xp: 148200, prestige: 2, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80' },
    { rank: 2, name: 'NeonViper', level: 38, xp: 124100, prestige: 1, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80' },
    { rank: 3, name: 'SynthLord', level: 34, xp: 98400, prestige: 1, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80' },
    { rank: 4, name: 'GlitchMaster', level: 29, xp: 71200, prestige: 0, avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80' },
  ];

  // Live Rank Card Canvas Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background Card
    let grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(1, '#31104b');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, 20);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(235, 69, 158, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Avatar Circle
    ctx.fillStyle = '#5865F2';
    ctx.beginPath();
    ctx.arc(80, canvas.height / 2, 40, 0, Math.PI * 2);
    ctx.fill();

    // Username & Level Badge
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('CyberNetRunner', 145, 55);

    ctx.fillStyle = '#57F287';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('RANK #1 • LEVEL 42', 145, 80);

    // XP Progress Bar Track
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(145, 100, 380, 18, 9);
    ctx.fill();

    // XP Progress Fill
    let fillWidth = (148200 / 200000) * 380;
    let fillGrad = ctx.createLinearGradient(145, 0, 145 + fillWidth, 0);
    fillGrad.addColorStop(0, '#5865F2');
    fillGrad.addColorStop(1, '#EB459E');
    ctx.fillStyle = fillGrad;
    ctx.beginPath();
    ctx.roundRect(145, 100, fillWidth, 18, 9);
    ctx.fill();

    // Progress Text
    ctx.fillStyle = '#94A3B8';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('148,200 / 200,000 XP', 410, 92);
  }, []);

  const handleSave = () => {
    showNotification('Leveling system settings updated!');
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/dashboard/plugins" className="p-2 rounded-xl glass-panel hover:bg-white/10 text-slate-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
              <Award className="w-6 h-6 text-discord-fuchsia" />
              <span>Leveling & XP System</span>
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">Custom canvas rank cards, voice XP multipliers, and web leaderboards.</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl font-bold text-xs bg-discord-blurple hover:bg-discord-blurple/90 text-white transition flex items-center space-x-2 shadow-lg shadow-discord-blurple/25"
        >
          <Save className="w-4 h-4" />
          <span>Save Leveling Rules</span>
        </button>
      </div>

      {/* Grid: Config Controls & Live Rank Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          <h3 className="text-base font-bold text-white pb-3 border-b border-white/10 flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-discord-green" />
            <span>XP Rates & Rewards</span>
          </h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="text-slate-300">Text Message XP Multiplier</span>
                <span className="text-discord-green font-mono">{xpRate}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={xpRate}
                onChange={(e) => setXpRate(parseFloat(e.target.value))}
                className="w-full accent-discord-green bg-discord-card rounded-lg h-2"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Daily Bonus XP Amount</label>
              <input
                type="number"
                value={dailyXP}
                onChange={(e) => setDailyXP(parseInt(e.target.value))}
                className="w-full bg-discord-card border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-discord-blurple"
              />
            </div>

            <div className="flex items-center justify-between p-3 glass-panel rounded-xl border border-white/10">
              <div>
                <p className="text-xs font-bold text-white">Enable Voice Channel XP</p>
                <p className="text-[10px] text-slate-400">Award XP for active minutes in voice channels</p>
              </div>
              <button
                onClick={() => setVoiceXP(!voiceXP)}
                className={`w-11 h-6 rounded-full p-1 transition ${voiceXP ? 'bg-discord-green justify-end' : 'bg-slate-700 justify-start'} flex items-center`}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow-md" />
              </button>
            </div>
          </div>
        </div>

        {/* Canvas Rank Card Live Preview */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col items-center justify-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 block">
            Canvas Rank Card Preview (`!rank` command output)
          </span>

          <div className="w-full max-w-lg aspect-[560/150] rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            <canvas ref={canvasRef} width={560} height={150} className="w-full h-full object-cover" />
          </div>
        </div>
      </div>

      {/* Web Leaderboard Preview Table */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-discord-yellow" />
            <span>Web Leaderboard Live View</span>
          </h3>
          <span className="text-xs font-mono text-slate-400">Updated every 5 mins</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 uppercase font-semibold">
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Level</th>
                <th className="py-3 px-4">Total XP</th>
                <th className="py-3 px-4">Prestige</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {leaderboardUsers.map((u) => (
                <tr key={u.rank} className="hover:bg-white/5 transition">
                  <td className="py-3 px-4 font-bold text-discord-yellow">#{u.rank}</td>
                  <td className="py-3 px-4 flex items-center space-x-3">
                    <img src={u.avatar} alt={u.name} className="w-7 h-7 rounded-full object-cover" />
                    <span className="font-semibold text-white">{u.name}</span>
                  </td>
                  <td className="py-3 px-4 font-bold text-discord-green">Lvl {u.level}</td>
                  <td className="py-3 px-4 text-slate-300 font-mono">{u.xp.toLocaleString()} XP</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-discord-fuchsia/20 text-discord-fuchsia font-bold text-[10px]">
                      P{u.prestige}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
