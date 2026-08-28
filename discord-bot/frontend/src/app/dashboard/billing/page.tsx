'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Receipt, Check, Zap, Sparkles, CreditCard, Download } from 'lucide-react';

export default function BillingPage() {
  const { showNotification } = useAppStore();
  const [activePlan, setActivePlan] = useState<'FREE' | 'PRO' | 'ENTERPRISE'>('ENTERPRISE');

  const plans = [
    {
      tier: 'FREE',
      price: '$0',
      period: 'Forever Free',
      description: 'Essential bot features for small gaming servers.',
      features: ['Up to 1,000 members', 'Leveling & Basic Welcomes', 'AutoModeration (5 Rules)', 'Standard Support'],
    },
    {
      tier: 'PRO',
      price: '$9',
      period: 'per month',
      description: 'Advanced analytics, tickets, and custom canvas graphics.',
      features: [
        'Up to 15,000 members',
        'Unlimited Canvas Rank Cards',
        'Multi-Department Ticket Panel',
        '100K AI Assistant Tokens / mo',
        'Priority Shard Queue',
      ],
    },
    {
      tier: 'ENTERPRISE',
      price: '$29',
      period: 'per month',
      description: 'Uncapped scaling, multi-model AI, and dedicated BullMQ worker clusters.',
      features: [
        'Unlimited Server Members',
        'Visual Automation Builder (Unlimited)',
        '500K AI Tokens (OpenAI + Gemini + DeepSeek)',
        'Custom Webhooks & Subdomains',
        'Dedicated 24/7 SLA Support',
      ],
    },
  ];

  const handleUpgrade = (tier: 'FREE' | 'PRO' | 'ENTERPRISE') => {
    setActivePlan(tier);
    showNotification(`Subscription tier updated to ${tier}! Checkout completed successfully.`);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Receipt className="w-6 h-6 text-discord-green" />
            <span>Billing & Quota Management</span>
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">Manage SaaS subscription plans, invoice PDF downloads, and feature quotas.</p>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((p) => {
          const isCurrent = activePlan === p.tier;
          return (
            <div
              key={p.tier}
              className={`glass-panel p-8 rounded-2xl border flex flex-col justify-between relative overflow-hidden ${
                isCurrent ? 'border-discord-blurple shadow-2xl shadow-discord-blurple/20' : 'border-white/10'
              }`}
            >
              {isCurrent && (
                <div className="absolute top-0 right-0 px-4 py-1 bg-discord-blurple text-[10px] font-extrabold text-white rounded-bl-xl uppercase tracking-wider">
                  Current Plan
                </div>
              )}

              <div>
                <h3 className="text-xl font-extrabold text-white">{p.tier}</h3>
                <p className="text-slate-400 text-xs mt-1 mb-6">{p.description}</p>

                <div className="flex items-baseline space-x-1 mb-6">
                  <span className="text-4xl font-extrabold text-white">{p.price}</span>
                  <span className="text-xs text-slate-400 font-medium">{p.period}</span>
                </div>

                <div className="space-y-3 mb-8">
                  {p.features.map((f, i) => (
                    <div key={i} className="flex items-center space-x-2.5 text-xs text-slate-300">
                      <Check className="w-4 h-4 text-discord-green shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleUpgrade(p.tier as any)}
                className={`w-full py-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
                  isCurrent
                    ? 'bg-discord-green/20 text-discord-green border border-discord-green/30 cursor-default'
                    : 'bg-discord-blurple hover:bg-discord-blurple/90 text-white shadow-lg shadow-discord-blurple/25'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>{isCurrent ? 'Active Subscription' : `Upgrade to ${p.tier}`}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
