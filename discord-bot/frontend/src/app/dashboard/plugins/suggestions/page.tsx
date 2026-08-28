'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Lightbulb, Save, ArrowLeft, ThumbsUp, ThumbsDown, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function SuggestionsPluginPage() {
  const { showNotification } = useAppStore();

  const [suggestions, setSuggestions] = useState([
    { id: 'SUG-101', title: 'Add a weekly Apex Legends Tournament', author: 'CyberRunner', upvotes: 42, downvotes: 3, status: 'APPROVED' },
    { id: 'SUG-102', title: 'Enable AI Voice Replies in General', author: 'NeonViper', upvotes: 18, downvotes: 12, status: 'PENDING' },
    { id: 'SUG-103', title: 'Remove level 5 rank requirement for giveaways', author: 'Anonymous', upvotes: 4, downvotes: 28, status: 'REJECTED' },
  ]);

  const updateStatus = (id: string, newStatus: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
    );
    showNotification(`Suggestion ${id} marked as ${newStatus}!`);
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
              <Lightbulb className="w-6 h-6 text-discord-yellow" />
              <span>Suggestion Engine</span>
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">Interactive voting panels, staff approval actions, and top suggester rankings.</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
        <h3 className="text-base font-bold text-white">Submitted Community Suggestions</h3>

        <div className="divide-y divide-white/10">
          {suggestions.map((s) => (
            <div key={s.id} className="py-4 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-3">
                  <span className="font-mono text-xs font-bold text-discord-yellow">{s.id}</span>
                  <span className="text-sm font-bold text-white">{s.title}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                    s.status === 'APPROVED' ? 'bg-discord-green/20 text-discord-green' :
                    s.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-400' : 'bg-discord-yellow/20 text-discord-yellow'
                  }`}>
                    {s.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center space-x-4">
                  <span>Submitted by: <strong className="text-slate-200">{s.author}</strong></span>
                  <span className="flex items-center text-discord-green font-bold">
                    <ThumbsUp className="w-3 h-3 mr-1" /> {s.upvotes}
                  </span>
                  <span className="flex items-center text-rose-400 font-bold">
                    <ThumbsDown className="w-3 h-3 mr-1" /> {s.downvotes}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => updateStatus(s.id, 'APPROVED')}
                  className="px-3 py-1.5 rounded-xl bg-discord-green/10 hover:bg-discord-green/20 text-discord-green text-xs font-bold transition flex items-center space-x-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve</span>
                </button>
                <button
                  onClick={() => updateStatus(s.id, 'REJECTED')}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition flex items-center space-x-1"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
