'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Bot, 
  ShieldCheck, 
  Zap, 
  Sparkles, 
  Ticket, 
  BarChart3, 
  Cpu, 
  ArrowRight, 
  CheckCircle2, 
  Layers, 
  Workflow, 
  Globe 
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#090a0f] text-slate-100 overflow-hidden">
      {/* Background Animated Neon Orbs */}
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-discord-blurple/20 rounded-full blur-[140px] pointer-events-none animate-pulse-glow" />
      <div className="absolute top-[40%] right-[-5%] w-[600px] h-[600px] bg-discord-fuchsia/15 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[10%] w-[450px] h-[450px] bg-discord-green/15 rounded-full blur-[130px] pointer-events-none" />

      {/* Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-discord-blurple to-discord-fuchsia flex items-center justify-center shadow-lg shadow-discord-blurple/30">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Discord Automation <span className="text-discord-blurple">Cloud</span>
            </span>
          </div>

          <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition">Plugins</a>
            <a href="#automation" className="hover:text-white transition">Automation Workflow</a>
            <a href="#ai" className="hover:text-white transition">AI Engine</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard/overview"
              className="group relative inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-discord-blurple hover:bg-discord-blurple/90 transition shadow-lg shadow-discord-blurple/25"
            >
              <span>Continue with Discord</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-36 pb-24 px-6 relative">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-discord-blurple/10 text-discord-blurple border border-discord-blurple/30 mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Next-Gen Enterprise Discord SaaS Engine</span>
            </span>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight mb-8">
              Automate Your Discord Guild With <br />
              <span className="bg-gradient-to-r from-discord-blurple via-discord-fuchsia to-discord-green bg-clip-text text-transparent">
                Ultra-Modular AI Plugins
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
              The multi-tenant automation suite built for high-scale servers. Instantly deploy AI toxicity filtering, interactive canvas rank cards, multi-department tickets, and visual drag-and-drop automations.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/dashboard/overview"
                className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-base bg-gradient-to-r from-discord-blurple to-discord-fuchsia hover:opacity-95 transition shadow-xl shadow-discord-blurple/30 flex items-center justify-center space-x-3"
              >
                <Zap className="w-5 h-5" />
                <span>Launch Dashboard</span>
              </Link>
              
              <Link
                href="/dashboard/plugins"
                className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold text-base glass-panel hover:bg-white/5 transition border border-white/10 flex items-center justify-center space-x-2"
              >
                <Layers className="w-5 h-5 text-discord-blurple" />
                <span>Explore Plugins Marketplace</span>
              </Link>
            </div>
          </motion.div>

          {/* Interactive Feature Stats Bar */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 p-6 glass-panel rounded-2xl border border-white/10"
          >
            <div>
              <div className="text-3xl font-extrabold text-white">99.99%</div>
              <div className="text-xs font-medium text-slate-400 mt-1">Bot Cluster Uptime</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-discord-green">2.4M+</div>
              <div className="text-xs font-medium text-slate-400 mt-1">Automated Actions / Day</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-discord-fuchsia">&lt; 15ms</div>
              <div className="text-xs font-medium text-slate-400 mt-1">Redis Command Latency</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-discord-blurple">8+</div>
              <div className="text-xs font-medium text-slate-400 mt-1">Core Modular Plugins</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Plugin Marketplace Highlights */}
      <section id="features" className="py-20 px-6 relative bg-white/[0.01] border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
              Everything Your Community Needs In One Ecosystem
            </h2>
            <p className="text-slate-400 text-base md:text-lg">
              Enable only what you need. Configure every plugin independently through live interactive canvas previews and instant zero-reboot updates.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass-panel-interactive p-8 rounded-2xl relative overflow-hidden group">
              <div className="w-12 h-12 rounded-xl bg-discord-blurple/20 flex items-center justify-center mb-6 text-discord-blurple">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Welcome & Auto Role</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Generate dynamic welcome cards with HTML5 Canvas avatar overlays, AI greetings, account age checks, and instant role triggers.
              </p>
              <Link href="/dashboard/plugins/welcome" className="text-xs font-semibold text-discord-blurple flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                <span>Configure Welcome Builder</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="glass-panel-interactive p-8 rounded-2xl relative overflow-hidden group">
              <div className="w-12 h-12 rounded-xl bg-discord-fuchsia/20 flex items-center justify-center mb-6 text-discord-fuchsia">
                <Ticket className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Ticket System</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Multi-department dropdown routing, button claim actions, staff notes, and automatic HTML & PDF transcript exports.
              </p>
              <Link href="/dashboard/plugins/tickets" className="text-xs font-semibold text-discord-fuchsia flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                <span>View Ticket Settings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="glass-panel-interactive p-8 rounded-2xl relative overflow-hidden group">
              <div className="w-12 h-12 rounded-xl bg-discord-green/20 flex items-center justify-center mb-6 text-discord-green">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Auto Moderation AI</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Real-time AI toxicity scores, anti-spam shields, bad word regex filters, ghost ping triggers, and automated escalation logs.
              </p>
              <Link href="/dashboard/plugins/automod" className="text-xs font-semibold text-discord-green flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                <span>Customize Shield Rules</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Automation Engine Section */}
      <section id="automation" className="py-20 px-6 relative">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-discord-fuchsia text-sm font-semibold uppercase tracking-wider">No-Code Visual Logic</span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mt-2 mb-6">
              Build Powerful IF/THEN Workflows Without Writing Code
            </h2>
            <p className="text-slate-400 text-base leading-relaxed mb-8">
              Chain events like member joins, reaction role triggers, keyword flags, and ticket openings into multi-step automated pipelines.
            </p>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-discord-green shrink-0 mt-0.5" />
                <span className="text-slate-300 text-sm">Visual step sequence with time delays and conditional checks.</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-discord-green shrink-0 mt-0.5" />
                <span className="text-slate-300 text-sm">Direct DM triggers, embed dispatch, role grants, and staff alerts.</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-discord-green shrink-0 mt-0.5" />
                <span className="text-slate-300 text-sm">Real-time execution logs and error recovery queues via BullMQ.</span>
              </div>
            </div>
            <div className="mt-8">
              <Link
                href="/dashboard/automation"
                className="px-6 py-3 rounded-xl font-semibold bg-white/10 hover:bg-white/15 transition border border-white/10 inline-flex items-center space-x-2"
              >
                <Workflow className="w-4 h-4 text-discord-fuchsia" />
                <span>Open Visual Automation Builder</span>
              </Link>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-rose-500" />
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
              </div>
              <span className="text-xs font-mono text-slate-400">Workflow: Onboarding_Flow_v2</span>
            </div>

            <div className="p-4 bg-discord-sidebar/80 rounded-xl border border-white/5 space-y-2">
              <div className="text-xs font-bold text-discord-blurple uppercase">IF (Trigger)</div>
              <div className="text-sm text-slate-200">New User joins Discord Server</div>
            </div>

            <div className="w-0.5 h-6 bg-discord-blurple/50 mx-auto" />

            <div className="p-4 bg-discord-sidebar/80 rounded-xl border border-white/5 space-y-2">
              <div className="text-xs font-bold text-discord-fuchsia uppercase">THEN (Step 1)</div>
              <div className="text-sm text-slate-200">Grant @Member Role & Send Custom Canvas Welcome Card</div>
            </div>

            <div className="w-0.5 h-6 bg-discord-fuchsia/50 mx-auto" />

            <div className="p-4 bg-discord-sidebar/80 rounded-xl border border-white/5 space-y-2">
              <div className="text-xs font-bold text-discord-green uppercase">THEN (Step 2 - Delay 5m)</div>
              <div className="text-sm text-slate-200">Send Direct Message with Rulebook PDF & Verification Code</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10 px-6 text-center text-slate-500 text-sm">
        <p>© 2026 Discord Automation Cloud SaaS. Production-ready multi-tenant bot platform.</p>
      </footer>
    </div>
  );
}
