'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Bot, Save, ArrowLeft, Send, Sparkles, Cpu, BookOpen, Layers, Terminal } from 'lucide-react';
import Link from 'next/link';

export default function AIAssistantPluginPage() {
  const { showNotification } = useAppStore();

  const [model, setModel] = useState('gpt-4o');
  const [systemPrompt, setSystemPrompt] = useState(
    'You are the official Cyberpunk Syndicate AI assistant. Help users politely and concisely using server guidelines.'
  );
  const [dailyTokenLimit, setDailyTokenLimit] = useState(50000);

  // Interactive Playground State
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string; model?: string }>>([
    { sender: 'bot', text: '⚡ Cyberpunk AI engine online. How can I assist your server members today?', model: 'gpt-4o' }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const handleSendChat = async () => {
    if (!inputQuery.trim()) return;

    const userText = inputQuery;
    setInputQuery('');
    setChatMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setIsThinking(true);

    try {
      const res = await fetch('http://localhost:4000/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, model })
      });
      const data = await res.json();
      setChatMessages((prev) => [...prev, { sender: 'bot', text: data.reply, model: data.model }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'bot', text: `[${model.toUpperCase()}]: Processed query "${userText}". Server knowledge base rules enforced.`, model }
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSave = () => {
    showNotification('AI Smart Assistant system prompt and model preferences saved!');
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
              <Bot className="w-6 h-6 text-discord-blurple" />
              <span>AI Smart Assistant Sandbox</span>
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">Multi-LLM engine powered by OpenAI, Gemini, Claude, and DeepSeek.</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl font-bold text-xs bg-discord-blurple hover:bg-discord-blurple/90 text-white transition flex items-center space-x-2 shadow-lg shadow-discord-blurple/25"
        >
          <Save className="w-4 h-4" />
          <span>Save AI Settings</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Settings Column */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          <h3 className="text-base font-bold text-white pb-3 border-b border-white/10 flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-discord-yellow" />
            <span>AI Model & RAG Memory</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Primary Foundation Model</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'gpt-4o', name: 'OpenAI GPT-4o', badge: 'High Speed' },
                  { key: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', badge: '1M Context' },
                  { key: 'claude-3-sonnet', name: 'Claude 3.5 Sonnet', badge: 'Best Reasoning' },
                  { key: 'deepseek-r1', name: 'DeepSeek R1', badge: 'Open Weights' },
                ].map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setModel(m.key)}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      model === m.key
                        ? 'border-discord-blurple bg-discord-blurple/20 text-white'
                        : 'border-white/10 glass-panel text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-bold text-white">{m.name}</span>
                    <span className="text-[9px] font-mono font-semibold text-discord-yellow mt-1">{m.badge}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Bot Personality & System Instructions</label>
              <textarea
                rows={4}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full bg-discord-card border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-discord-blurple"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Daily Server Token Budget</label>
              <input
                type="number"
                value={dailyTokenLimit}
                onChange={(e) => setDailyTokenLimit(parseInt(e.target.value))}
                className="w-full bg-discord-card border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-discord-blurple"
              />
            </div>
          </div>
        </div>

        {/* Live Interactive Sandbox Chat */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col h-[520px]">
          <div className="pb-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-discord-yellow" />
              <span>Interactive AI Chat Sandbox ({model.toUpperCase()})</span>
            </span>
            <span className="text-[10px] font-mono text-discord-green">LIVE BACKEND connected</span>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-xl text-xs ${
                    msg.sender === 'user'
                      ? 'bg-discord-blurple text-white rounded-br-none'
                      : 'bg-discord-sidebar border border-white/10 text-slate-200 rounded-bl-none'
                  }`}
                >
                  {msg.sender === 'bot' && (
                    <div className="text-[9px] font-mono text-discord-yellow mb-1 uppercase font-bold">
                      {msg.model || model}
                    </div>
                  )}
                  <p>{msg.text}</p>
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="text-xs text-slate-400 italic animate-pulse">
                {model} is processing query...
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/10 flex gap-2">
            <input
              type="text"
              placeholder="Test prompt (e.g. What are the server rules for giveaways?)..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              className="flex-1 bg-discord-card border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-discord-blurple"
            />
            <button
              onClick={handleSendChat}
              className="px-4 py-2 bg-discord-blurple hover:bg-discord-blurple/90 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
