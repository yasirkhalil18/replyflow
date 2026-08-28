'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Sparkles, Image as ImageIcon, Bot, Send, Save, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function WelcomePluginPage() {
  const { showNotification } = useAppStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [titleText, setTitleText] = useState('WELCOME TO THE SYNDICATE');
  const [subtitleText, setSubtitleText] = useState('Member #24,890 • Cyberpunk Syndicate');
  const [colorGradient, setColorGradient] = useState('cyber');
  const [dmWelcome, setDmWelcome] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('Generates a futuristic cyberpunk greeting with emojis');
  const [generatedAiWelcome, setGeneratedAiWelcome] = useState('⚡ Greetings Operative! Welcome to the Syndicate network. Gear up and review #rules.');

  // Live Canvas Card Generator
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background Gradient
    let grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    if (colorGradient === 'cyber') {
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#5865F2');
      grad.addColorStop(1, '#EB459E');
    } else if (colorGradient === 'emerald') {
      grad.addColorStop(0, '#022c22');
      grad.addColorStop(1, '#10b981');
    } else {
      grad.addColorStop(0, '#31104b');
      grad.addColorStop(1, '#701a75');
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, 24);
    ctx.fill();

    // Dark Overlay Card
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.roundRect(20, 20, canvas.width - 40, canvas.height - 40, 16);
    ctx.fill();

    // Border Glow
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Mock Avatar Circle
    ctx.fillStyle = '#5865F2';
    ctx.beginPath();
    ctx.arc(100, canvas.height / 2, 45, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#57F287';
    ctx.stroke();

    // Text Content
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(titleText, 170, canvas.height / 2 - 8);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(subtitleText, 170, canvas.height / 2 + 20);
  }, [titleText, subtitleText, colorGradient]);

  const handleSave = () => {
    showNotification('Welcome plugin configuration saved successfully!');
  };

  const handleGenerateAI = () => {
    setGeneratedAiWelcome('🚀 Welcome aboard legendary runner! Your presence elevates our node frequency. Step inside!');
    showNotification('AI Welcome message generated!', 'info');
  };

  return (
    <div className="space-y-8">
      {/* Header Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/dashboard/plugins" className="p-2 rounded-xl glass-panel hover:bg-white/10 text-slate-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
              <Sparkles className="w-6 h-6 text-discord-blurple" />
              <span>Welcome & Auto Role Plugin</span>
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">Design dynamic canvas welcome graphics and automated welcome flows.</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl font-bold text-xs bg-discord-blurple hover:bg-discord-blurple/90 text-white transition flex items-center space-x-2 shadow-lg shadow-discord-blurple/25"
        >
          <Save className="w-4 h-4" />
          <span>Save Changes</span>
        </button>
      </div>

      {/* Main Grid: Settings vs Live Canvas Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Settings Form */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          <h3 className="text-base font-bold text-white pb-3 border-b border-white/10 flex items-center space-x-2">
            <ImageIcon className="w-4 h-4 text-discord-fuchsia" />
            <span>Canvas Card Customizer</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Welcome Banner Title</label>
              <input
                type="text"
                value={titleText}
                onChange={(e) => setTitleText(e.target.value)}
                className="w-full bg-discord-card border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-discord-blurple"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Subtitle / Member Format</label>
              <input
                type="text"
                value={subtitleText}
                onChange={(e) => setSubtitleText(e.target.value)}
                className="w-full bg-discord-card border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-discord-blurple"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Card Background Gradient Theme</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setColorGradient('cyber')}
                  className={`p-3 rounded-xl border text-xs font-bold transition ${
                    colorGradient === 'cyber' ? 'border-discord-blurple bg-discord-blurple/20 text-white' : 'border-white/10 glass-panel text-slate-400'
                  }`}
                >
                  Cyber Blurple
                </button>
                <button
                  onClick={() => setColorGradient('emerald')}
                  className={`p-3 rounded-xl border text-xs font-bold transition ${
                    colorGradient === 'emerald' ? 'border-discord-green bg-discord-green/20 text-white' : 'border-white/10 glass-panel text-slate-400'
                  }`}
                >
                  Neon Emerald
                </button>
                <button
                  onClick={() => setColorGradient('purple')}
                  className={`p-3 rounded-xl border text-xs font-bold transition ${
                    colorGradient === 'purple' ? 'border-discord-fuchsia bg-discord-fuchsia/20 text-white' : 'border-white/10 glass-panel text-slate-400'
                  }`}
                >
                  Deep Synth
                </button>
              </div>
            </div>
          </div>

          <h3 className="text-base font-bold text-white pt-4 pb-3 border-t border-b border-white/10 flex items-center space-x-2">
            <Bot className="w-4 h-4 text-discord-yellow" />
            <span>AI Welcome Message Generator</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">AI Greeting Style Prompt</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="flex-1 bg-discord-card border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-discord-blurple"
                />
                <button
                  onClick={handleGenerateAI}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-discord-yellow text-slate-950 hover:bg-discord-yellow/90 transition flex items-center space-x-1 shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Generate</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-discord-sidebar rounded-xl border border-white/10 text-xs text-slate-200 font-mono">
              {generatedAiWelcome}
            </div>
          </div>
        </div>

        {/* Live Canvas Preview Panel */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 block">
            Realtime Canvas Preview (Generated on GPU/Canvas)
          </span>

          <div className="w-full max-w-lg aspect-[600/220] rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative">
            <canvas ref={canvasRef} width={600} height={220} className="w-full h-full object-cover" />
          </div>

          <p className="text-slate-400 text-xs mt-6 max-w-sm">
            This card is automatically synthesized whenever a new member joins your Discord server and posted to the designated welcome channel.
          </p>
        </div>
      </div>
    </div>
  );
}
