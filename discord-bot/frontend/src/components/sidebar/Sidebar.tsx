'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import {
  LayoutDashboard,
  Grid,
  BarChart3,
  ShieldAlert,
  Award,
  Ticket,
  Bot,
  Workflow,
  Receipt,
  Settings,
  ChevronDown,
  Sparkles,
  UserCheck,
  Check,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const { currentGuild, guilds, setCurrentGuild } = useAppStore();
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  const navItems = [
    { label: 'Overview', href: '/dashboard/overview', icon: LayoutDashboard },
    { label: 'Plugins Marketplace', href: '/dashboard/plugins', icon: Grid },
    { label: 'Analytics Suite', href: '/dashboard/analytics', icon: BarChart3 },
    { label: 'Auto Moderation', href: '/dashboard/plugins/automod', icon: ShieldAlert },
    { label: 'Leveling & XP', href: '/dashboard/plugins/leveling', icon: Award },
    { label: 'Ticket Hub', href: '/dashboard/plugins/tickets', icon: Ticket },
    { label: 'AI Smart Assistant', href: '/dashboard/plugins/ai-assistant', icon: Bot },
    { label: 'Visual Automations', href: '/dashboard/automation', icon: Workflow },
    { label: 'Billing & Quotas', href: '/dashboard/billing', icon: Receipt },
    { label: 'Admin Control Center', href: '/dashboard/admin', icon: ShieldCheck },
  ];

  return (
    <aside className="w-72 bg-discord-sidebar border-r border-white/10 flex flex-col h-screen sticky top-0 z-40 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-discord-blurple to-discord-fuchsia flex items-center justify-center shadow-md shadow-discord-blurple/30">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight leading-none">Discord Automation</h1>
            <span className="text-[10px] font-semibold text-discord-blurple tracking-wider uppercase">Cloud SaaS</span>
          </div>
        </Link>
      </div>

      {/* Guild Selector Dropdown */}
      <div className="px-4 py-4 border-b border-white/10 relative">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2 px-1">
          Active Server
        </label>
        
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full glass-panel p-2.5 rounded-xl flex items-center justify-between text-left hover:bg-white/5 transition border border-white/10"
        >
          <div className="flex items-center space-x-3 truncate">
            {currentGuild?.icon ? (
              <img
                src={currentGuild.icon}
                alt={currentGuild.name}
                className="w-8 h-8 rounded-lg object-cover ring-2 ring-discord-blurple/50"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-discord-blurple/20 flex items-center justify-center text-xs font-bold text-discord-blurple">
                {currentGuild?.name?.substring(0, 2) || 'GU'}
              </div>
            )}
            <div className="truncate">
              <p className="text-xs font-bold text-white truncate">{currentGuild?.name}</p>
              <p className="text-[10px] text-slate-400">{currentGuild?.memberCount?.toLocaleString()} members</p>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Options */}
        {dropdownOpen && (
          <div className="absolute top-full left-4 right-4 mt-2 glass-panel rounded-xl overflow-hidden shadow-2xl border border-white/10 z-50 py-1 max-h-60 overflow-y-auto">
            {guilds.map((guild) => (
              <button
                key={guild.id}
                onClick={() => {
                  setCurrentGuild(guild);
                  setDropdownOpen(false);
                }}
                className={`w-full px-3 py-2.5 flex items-center justify-between text-xs font-medium hover:bg-white/10 transition ${
                  currentGuild?.id === guild.id ? 'bg-discord-blurple/20 text-white' : 'text-slate-300'
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate">
                  <img src={guild.icon} alt={guild.name} className="w-6 h-6 rounded-md object-cover" />
                  <span className="truncate">{guild.name}</span>
                </div>
                {currentGuild?.id === guild.id && <Check className="w-3.5 h-3.5 text-discord-green shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Main Console
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                isActive
                  ? 'bg-gradient-to-r from-discord-blurple to-discord-blurple/80 text-white shadow-md shadow-discord-blurple/20'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Footer Profile */}
      <div className="p-4 border-t border-white/10 glass-panel">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                alt="CyberNetRunner"
                className="w-9 h-9 rounded-full object-cover ring-2 ring-discord-green"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-discord-green rounded-full ring-2 ring-discord-sidebar" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">CyberNetRunner</p>
              <p className="text-[10px] text-discord-green font-medium">Enterprise Admin</p>
            </div>
          </div>
          <Link href="/" className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition">
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
