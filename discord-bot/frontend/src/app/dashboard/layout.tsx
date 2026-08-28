'use client';

import React from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { useAppStore } from '@/store/useAppStore';
import { Bell, Sparkles, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { notification, currentGuild } = useAppStore();

  return (
    <div className="flex min-h-screen bg-[#090a0f] text-slate-100">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-white/10 glass-panel sticky top-0 z-30 px-8 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-discord-blurple/10 text-discord-blurple border border-discord-blurple/20">
              CLUSTER #4092 :: LATENCY 12ms
            </span>
            <span className="text-slate-500 text-xs">•</span>
            <span className="text-xs font-semibold text-slate-400">
              Editing: <span className="text-white font-bold">{currentGuild?.name}</span>
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <button className="relative p-2 rounded-xl glass-panel hover:bg-white/10 text-slate-300 hover:text-white transition border border-white/10">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-discord-fuchsia animate-ping" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-discord-fuchsia" />
            </button>

            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-discord-blurple/20 to-discord-fuchsia/20 border border-discord-blurple/30">
              <Sparkles className="w-3.5 h-3.5 text-discord-yellow" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Enterprise Plan</span>
            </div>
          </div>
        </header>

        {/* Floating Notification Banner */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-20 right-8 z-50 glass-panel p-4 rounded-xl shadow-2xl border border-discord-blurple/40 flex items-center space-x-3 bg-discord-card/90"
            >
              {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-discord-green" />}
              {notification.type === 'error' && <AlertCircle className="w-5 h-5 text-discord-red" />}
              {notification.type === 'info' && <Info className="w-5 h-5 text-discord-blurple" />}
              <span className="text-xs font-bold text-white">{notification.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Page View */}
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
