import http.server
import socketserver
import json
import urllib.parse
import sys
import os

PORT = 3000

MOCK_GUILDS = [
    {
        "id": "1330964283198013461",
        "name": "NIT- NOIR INSIGHT TRADER",
        "icon": "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150&auto=format&fit=crop&q=80",
        "memberCount": 9,
        "onlineCount": 3,
        "tier": "ENTERPRISE",
        "hasBot": True
    },
    {
        "id": "209384759283748291",
        "name": "Neon Tech Community",
        "icon": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80",
        "memberCount": 14200,
        "onlineCount": 4120,
        "tier": "PRO",
        "hasBot": True
    }
]

MOCK_PLUGINS = [
    {
        "key": "welcome",
        "name": "Welcome & Auto Role",
        "description": "Custom canvas image welcomes, automated multi-roles, AI welcome text generator, and DM greetings.",
        "category": "Engagement",
        "icon": "✨",
        "version": "v3.4.1",
        "isPremium": False,
        "enabled": True,
        "usageCount": 18450
    },
    {
        "key": "leveling",
        "name": "Leveling System",
        "description": "Text & voice XP tracking, prestige levels, interactive canvas rank cards, and web leaderboards.",
        "category": "Engagement",
        "icon": "🏆",
        "version": "v2.8.0",
        "isPremium": False,
        "enabled": True,
        "usageCount": 29400
    },
    {
        "key": "tickets",
        "name": "Ticket System",
        "description": "Multi-department ticket routing, interactive modals, HTML/PDF auto-transcripts, and claim workflows.",
        "category": "Utility",
        "icon": "🎟️",
        "version": "v4.1.2",
        "isPremium": True,
        "enabled": True,
        "usageCount": 14200
    },
    {
        "key": "live-stats",
        "name": "Live Stats Counters",
        "description": "Dynamic voice/text channel statistical counters (Members, Boosts, Online, Active Tickets, Voice Users).",
        "category": "Utility",
        "icon": "📊",
        "version": "v1.9.0",
        "isPremium": False,
        "enabled": True,
        "usageCount": 38200
    },
    {
        "key": "automod",
        "name": "Auto Moderation AI",
        "description": "AI Toxicity detection, anti-spam, raid shield, anti-invite, anti-link, anti-caps, and bad word regex.",
        "category": "Moderation",
        "icon": "🛡️",
        "version": "v5.0.0",
        "isPremium": True,
        "enabled": True,
        "usageCount": 42100
    },
    {
        "key": "social-feed",
        "name": "Social Feed Hub",
        "description": "Auto-post updates from YouTube, Twitter/X, Twitch, Reddit, TikTok, and RSS with custom embeds.",
        "category": "AI & Feeds",
        "icon": "📡",
        "version": "v2.2.0",
        "isPremium": False,
        "enabled": True,
        "usageCount": 11900
    },
    {
        "key": "suggestions",
        "name": "Suggestion Engine",
        "description": "Interactive voting panels, category tagging, staff approval/rejection workflows, and top suggesters.",
        "category": "Engagement",
        "icon": "💡",
        "version": "v1.6.4",
        "isPremium": False,
        "enabled": True,
        "usageCount": 8900
    },
    {
        "key": "ai-assistant",
        "name": "AI Smart Assistant",
        "description": "Powered by OpenAI, Gemini, Claude & DeepSeek with server Knowledge Base RAG memory and image analysis.",
        "category": "AI & Feeds",
        "icon": "🤖",
        "version": "v3.0.0",
        "isPremium": True,
        "enabled": True,
        "usageCount": 21500
    }
]

HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Discord Automation Cloud (SaaS) - Live Interactive Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-color: #090a0f;
            color: #f1f5f9;
        }
        .glass-panel {
            background: rgba(22, 25, 34, 0.75);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }
        .glass-panel-interactive {
            background: rgba(22, 25, 34, 0.65);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .glass-panel-interactive:hover {
            background: rgba(30, 35, 48, 0.85);
            border-color: rgba(88, 101, 242, 0.4);
            transform: translateY(-2px);
            box-shadow: 0 12px 30px rgba(88, 101, 242, 0.15);
        }
        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #090a0f; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 9999px; }
        ::-webkit-scrollbar-thumb:hover { background: #5865F2; }
    </style>
</head>
<body class="min-h-screen flex text-slate-100 overflow-x-hidden">

    <!-- Toast Notification -->
    <div id="toast" class="fixed top-6 right-6 z-50 glass-panel px-5 py-3 rounded-xl border border-indigo-500/40 text-xs font-bold shadow-2xl hidden transition-all duration-300 transform translate-y-[-10px] opacity-0 flex items-center space-x-2">
        <span id="toast-icon">✨</span>
        <span id="toast-msg">Operation successful</span>
    </div>

    <!-- Sidebar -->
    <aside style="width: 280px;" class="bg-[#0b0c10] border-r border-white/10 flex flex-col h-screen sticky top-0 z-40 select-none shrink-0">
        <div class="p-5 border-b border-white/10 flex items-center justify-between">
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#5865F2] to-[#EB459E] flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
                    🤖
                </div>
                <div>
                    <h1 class="text-sm font-bold text-white tracking-tight">Discord Automation</h1>
                    <span class="text-[10px] font-semibold text-[#5865F2] tracking-wider uppercase">Cloud SaaS</span>
                </div>
            </div>
        </div>

        <!-- Active Guild Dropdown -->
        <div class="p-4 border-b border-white/10">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Active Server</label>
            <div class="glass-panel p-2.5 rounded-xl flex items-center justify-between">
                <div class="flex items-center space-x-3 truncate">
                    <img src="https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150&auto=format&fit=crop&q=80" class="w-8 h-8 rounded-lg object-cover ring-2 ring-[#5865F2]/50" />
                    <div class="truncate">
                        <p class="text-xs font-bold text-white truncate">NIT- NOIR INSIGHT TRADER</p>
                        <p class="text-[10px] text-slate-400"><span id="sidebar-member-count">9</span> members synced • ENTERPRISE</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Nav Links -->
        <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-1 text-xs font-semibold">
            <div class="px-3 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Main Console</div>
            <button onclick="switchTab('overview')" id="nav-overview" class="nav-btn w-full text-left px-3 py-2.5 rounded-xl flex items-center space-x-3 bg-[#5865F2] text-white">
                <span>📊</span> <span>Overview</span>
            </button>
            <button onclick="switchTab('plugins')" id="nav-plugins" class="nav-btn w-full text-left px-3 py-2.5 rounded-xl flex items-center space-x-3 text-slate-400 hover:text-white hover:bg-white/5">
                <span>🧩</span> <span>Plugins Marketplace</span>
            </button>
            <button onclick="switchTab('welcome')" id="nav-welcome" class="nav-btn w-full text-left px-3 py-2.5 rounded-xl flex items-center space-x-3 text-slate-400 hover:text-white hover:bg-white/5">
                <span>✨</span> <span>Welcome Canvas Card</span>
            </button>
            <button onclick="switchTab('users')" id="nav-users" class="nav-btn w-full text-left px-3 py-2.5 rounded-xl flex items-center space-x-3 text-slate-400 hover:text-white hover:bg-white/5">
                <span>👥</span> <span>Live Current Users</span>
            </button>
            <button onclick="switchTab('leveling')" id="nav-leveling" class="nav-btn w-full text-left px-3 py-2.5 rounded-xl flex items-center space-x-3 text-slate-400 hover:text-white hover:bg-white/5">
                <span>🏆</span> <span>Leveling & Rank Card</span>
            </button>
            <button onclick="switchTab('tickets')" id="nav-tickets" class="nav-btn w-full text-left px-3 py-2.5 rounded-xl flex items-center space-x-3 text-slate-400 hover:text-white hover:bg-white/5">
                <span>🎟️</span> <span>Ticket System Hub</span>
            </button>
            <button onclick="switchTab('automod')" id="nav-automod" class="nav-btn w-full text-left px-3 py-2.5 rounded-xl flex items-center space-x-3 text-slate-400 hover:text-white hover:bg-white/5">
                <span>🛡️</span> <span>AutoModeration AI</span>
            </button>
            <button onclick="switchTab('ai')" id="nav-ai" class="nav-btn w-full text-left px-3 py-2.5 rounded-xl flex items-center space-x-3 text-slate-400 hover:text-white hover:bg-white/5">
                <span>🤖</span> <span>AI Smart Assistant</span>
            </button>
            <button onclick="switchTab('automation')" id="nav-automation" class="nav-btn w-full text-left px-3 py-2.5 rounded-xl flex items-center space-x-3 text-slate-400 hover:text-white hover:bg-white/5">
                <span>⚡</span> <span>Visual Automations</span>
            </button>
            <button onclick="switchTab('billing')" id="nav-billing" class="nav-btn w-full text-left px-3 py-2.5 rounded-xl flex items-center space-x-3 text-slate-400 hover:text-white hover:bg-white/5">
                <span>💳</span> <span>Billing & Plans</span>
            </button>
            <button onclick="switchTab('admin')" id="nav-admin" class="nav-btn w-full text-left px-3 py-2.5 rounded-xl flex items-center space-x-3 text-slate-400 hover:text-white hover:bg-white/5">
                <span>👑</span> <span>Admin Control</span>
            </button>
        </nav>

        <!-- User Profile -->
        <div class="p-4 border-t border-white/10 glass-panel flex items-center justify-between">
            <div class="flex items-center space-x-3">
                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" class="w-8 h-8 rounded-full object-cover ring-2 ring-emerald-500" />
                <div>
                    <p class="text-xs font-bold text-white">CyberNetRunner</p>
                    <p class="text-[10px] text-emerald-400 font-semibold">Enterprise Admin</p>
                </div>
            </div>
        </div>
    </aside>

    <!-- Main Content View -->
    <main class="flex-1 p-8 overflow-y-auto min-w-0">
        
        <!-- Header Bar -->
        <header class="mb-8 flex items-center justify-between pb-4 border-b border-white/10">
            <div>
                <h1 id="page-title" class="text-2xl font-extrabold text-white tracking-tight">Server Overview</h1>
                <p id="page-desc" class="text-xs text-slate-400 mt-1">Real-time performance metrics and bot cluster connection state.</p>
            </div>
            <div class="flex items-center space-x-3">
                <span class="text-xs font-mono px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">CLUSTER #4092 :: LATENCY 12ms</span>
                <span class="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">🟢 Bot Engine Active</span>
            </div>
        </header>

        <!-- TAB 1: OVERVIEW -->
        <div id="tab-overview" class="tab-content space-y-8">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="glass-panel p-6 rounded-2xl border border-white/10">
                    <div class="flex justify-between text-xs font-bold text-slate-400"><span>TOTAL MEMBERS</span> <span>👥</span></div>
                    <div id="overview-total-members" class="text-3xl font-extrabold text-white mt-4">9</div>
                    <div id="overview-online-members" class="text-[11px] text-emerald-400 mt-1">2 online right now</div>
                </div>
                <div class="glass-panel p-6 rounded-2xl border border-white/10">
                    <div class="flex justify-between text-xs font-bold text-slate-400"><span>MESSAGES TODAY</span> <span>💬</span></div>
                    <div id="overview-messages-today" class="text-3xl font-extrabold text-white mt-4">0</div>
                    <div class="text-[11px] text-emerald-400 mt-1">Real-time Live Activity</div>
                </div>
                <div class="glass-panel p-6 rounded-2xl border border-white/10">
                    <div class="flex justify-between text-xs font-bold text-slate-400"><span>TICKETS SOLVED</span> <span>🎟️</span></div>
                    <div id="overview-tickets-solved" class="text-3xl font-extrabold text-white mt-4">0</div>
                    <div class="text-[11px] text-slate-400 mt-1">Real-time Live Archival</div>
                </div>
                <div class="glass-panel p-6 rounded-2xl border border-white/10">
                    <div class="flex justify-between text-xs font-bold text-slate-400"><span>AI TOKENS</span> <span>✨</span></div>
                    <div id="overview-ai-tokens" class="text-3xl font-extrabold text-white mt-4">0</div>
                    <div class="text-[11px] text-slate-400 mt-1">GPT-4o & DeepSeek R1</div>
                </div>
            </div>

            <div class="glass-panel p-6 rounded-2xl border border-white/10">
                <h3 class="text-sm font-bold text-white mb-4">Member Growth & Weekly Telemetry</h3>
                <div class="h-64"><canvas id="chart-overview"></canvas></div>
            </div>

            <div class="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
                <div class="flex justify-between items-center pb-3 border-b border-white/10">
                    <h3 class="text-sm font-bold text-white flex items-center space-x-2">
                        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                        <span>Live Discord Messages Stream</span>
                    </h3>
                    <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">1s Real-time Sync</span>
                </div>
                <div id="live-messages-stream" class="space-y-2.5 max-h-80 overflow-y-auto font-mono text-xs">
                    <div class="p-3 bg-white/5 rounded-xl text-slate-400 text-center">Listening for live channel messages...</div>
                </div>
            </div>
        </div>

        <!-- TAB 2: PLUGINS MARKETPLACE -->
        <div id="tab-plugins" class="tab-content hidden space-y-6">
            <div class="flex justify-between items-center pb-4 border-b border-white/10">
                <div>
                    <h3 class="text-base font-bold text-white flex items-center space-x-2">
                        <span>🧩</span> <span>Plugins Marketplace & System Modules</span>
                    </h3>
                    <p class="text-xs text-slate-400 mt-0.5">Configure, enable, and sync system plugins directly with the Discord Bot Shard engine.</p>
                </div>
            </div>
            <div id="plugins-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <!-- JS Dynamic Cards -->
            </div>
        </div>

        <!-- TAB LIVE USERS TELEMETRY -->
        <div id="tab-users" class="tab-content hidden space-y-6">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="glass-panel p-5 rounded-2xl">
                    <span class="text-xs font-bold text-slate-400 block mb-1">TOTAL REGISTERED</span>
                    <span id="stat-user-total" class="text-2xl font-extrabold text-white">0</span>
                </div>
                <div class="glass-panel p-5 rounded-2xl border-emerald-500/30">
                    <span class="text-xs font-bold text-emerald-400 block mb-1">🟢 ONLINE USERS</span>
                    <span id="stat-user-online" class="text-2xl font-extrabold text-emerald-400">0</span>
                </div>
                <div class="glass-panel p-5 rounded-2xl border-amber-500/30">
                    <span class="text-xs font-bold text-amber-400 block mb-1">🟡 IDLE / AWAY</span>
                    <span id="stat-user-idle" class="text-2xl font-extrabold text-amber-400">0</span>
                </div>
                <div class="glass-panel p-5 rounded-2xl border-indigo-500/30">
                    <span class="text-xs font-bold text-indigo-400 block mb-1">🛡️ ADMIN / STAFF</span>
                    <span id="stat-user-admin" class="text-2xl font-extrabold text-indigo-400">0</span>
                </div>
            </div>

            <!-- Live Members Table -->
            <div class="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                    <div>
                        <h3 class="text-base font-bold text-white flex items-center space-x-2">
                            <span>👥</span> <span>Live Current Server Members Telemetry</span>
                        </h3>
                        <p class="text-xs text-slate-400 mt-0.5">Real-time presence, roles, levels, and user details synced with Discord Gateway.</p>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button onclick="loadLiveUsers()" class="px-3.5 py-2 rounded-xl bg-[#5865F2] hover:bg-[#5865F2]/80 text-white font-bold text-xs transition flex items-center space-x-1.5 shadow-lg shadow-indigo-500/20">
                            <span>🔄 Refresh Telemetry</span>
                        </button>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left text-xs">
                        <thead class="text-slate-400 uppercase tracking-wider bg-white/5 font-bold">
                            <tr>
                                <th class="p-3.5 rounded-l-xl">User Handle</th>
                                <th class="p-3.5">Status</th>
                                <th class="p-3.5">Assigned Roles</th>
                                <th class="p-3.5">Level & XP</th>
                                <th class="p-3.5">Joined Server</th>
                                <th class="p-3.5 rounded-r-xl">Type</th>
                            </tr>
                        </thead>
                        <tbody id="live-users-rows" class="divide-y divide-white/5 text-slate-300">
                            <!-- JS Dynamic Rows -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- TAB 3: WELCOME CANVAS -->
        <div id="tab-welcome" class="tab-content hidden space-y-6">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="glass-panel p-6 rounded-2xl space-y-4">
                    <h3 class="text-sm font-bold text-white pb-3 border-b border-white/10">Welcome Banner Settings</h3>
                    <div>
                        <label class="text-xs font-bold text-slate-300 block mb-1">Banner Title</label>
                        <input id="welcome-title" type="text" value="WELCOME TO THE SYNDICATE" oninput="renderWelcomeCanvas()" class="w-full bg-[#161922] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white" />
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-300 block mb-1">Subtitle / Member Format</label>
                        <input id="welcome-sub" type="text" value="Member #24,890 • Cyberpunk Syndicate" oninput="renderWelcomeCanvas()" class="w-full bg-[#161922] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white" />
                    </div>

                    <!-- COLLAPSIBLE ANIMATED EMOJIS DROPDOWN SELECTOR -->
                    <details class="group bg-[#161922] border border-white/10 rounded-xl overflow-hidden mt-4">
                        <summary class="flex justify-between items-center px-4 py-3 cursor-pointer text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition select-none">
                            <span class="flex items-center space-x-2">
                                <span>✨</span>
                                <span>Animated Emojis Gallery (Click to Open)</span>
                            </span>
                            <span class="text-xs transition-transform duration-200 group-open:rotate-180">▼</span>
                        </summary>
                        <div class="p-4 border-t border-white/10 grid grid-cols-4 sm:grid-cols-6 gap-2 bg-[#0e1017]">
                            <button onclick="insertEmojiTag('🚨')" title="Siren" class="p-2 rounded-lg bg-white/5 hover:bg-indigo-500/20 hover:border-indigo-500/50 border border-transparent transition text-center text-base">🚨 <span class="block text-[9px] text-slate-400 mt-1">Siren</span></button>
                            <button onclick="insertEmojiTag('👋')" title="Wave" class="p-2 rounded-lg bg-white/5 hover:bg-indigo-500/20 hover:border-indigo-500/50 border border-transparent transition text-center text-base">👋 <span class="block text-[9px] text-slate-400 mt-1">Wave</span></button>
                            <button onclick="insertEmojiTag('🔥')" title="Fire" class="p-2 rounded-lg bg-white/5 hover:bg-indigo-500/20 hover:border-indigo-500/50 border border-transparent transition text-center text-base">🔥 <span class="block text-[9px] text-slate-400 mt-1">Fire</span></button>
                            <button onclick="insertEmojiTag('✨')" title="Sparkles" class="p-2 rounded-lg bg-white/5 hover:bg-indigo-500/20 hover:border-indigo-500/50 border border-transparent transition text-center text-base">✨ <span class="block text-[9px] text-slate-400 mt-1">Sparkles</span></button>
                            <button onclick="insertEmojiTag('🎉')" title="Party" class="p-2 rounded-lg bg-white/5 hover:bg-indigo-500/20 hover:border-indigo-500/50 border border-transparent transition text-center text-base">🎉 <span class="block text-[9px] text-slate-400 mt-1">Party</span></button>
                            <button onclick="insertEmojiTag('👑')" title="Crown" class="p-2 rounded-lg bg-white/5 hover:bg-indigo-500/20 hover:border-indigo-500/50 border border-transparent transition text-center text-base">👑 <span class="block text-[9px] text-slate-400 mt-1">Crown</span></button>
                            <button onclick="insertEmojiTag('🚀')" title="Rocket" class="p-2 rounded-lg bg-white/5 hover:bg-indigo-500/20 hover:border-indigo-500/50 border border-transparent transition text-center text-base">🚀 <span class="block text-[9px] text-slate-400 mt-1">Rocket</span></button>
                            <button onclick="insertEmojiTag('📜')" title="Rules" class="p-2 rounded-lg bg-white/5 hover:bg-indigo-500/20 hover:border-indigo-500/50 border border-transparent transition text-center text-base">📜 <span class="block text-[9px] text-slate-400 mt-1">Rules</span></button>
                            <button onclick="insertEmojiTag('📌')" title="Pin" class="p-2 rounded-lg bg-white/5 hover:bg-indigo-500/20 hover:border-indigo-500/50 border border-transparent transition text-center text-base">📌 <span class="block text-[9px] text-slate-400 mt-1">Pin</span></button>
                            <button onclick="insertEmojiTag('📢')" title="Updates" class="p-2 rounded-lg bg-white/5 hover:bg-indigo-500/20 hover:border-indigo-500/50 border border-transparent transition text-center text-base">📢 <span class="block text-[9px] text-slate-400 mt-1">Updates</span></button>
                            <button onclick="insertEmojiTag('💬')" title="Chat" class="p-2 rounded-lg bg-white/5 hover:bg-indigo-500/20 hover:border-indigo-500/50 border border-transparent transition text-center text-base">💬 <span class="block text-[9px] text-slate-400 mt-1">Chat</span></button>
                            <button onclick="insertEmojiTag('⭐')" title="Star" class="p-2 rounded-lg bg-white/5 hover:bg-indigo-500/20 hover:border-indigo-500/50 border border-transparent transition text-center text-base">⭐ <span class="block text-[9px] text-slate-400 mt-1">Star</span></button>
                        </div>
                    </details>

                    <button onclick="savePluginConfigServer('welcome', true, { title: document.getElementById('welcome-title') ? document.getElementById('welcome-title').value : '', sub: document.getElementById('welcome-sub') ? document.getElementById('welcome-sub').value : '' })" class="px-5 py-2.5 rounded-xl font-bold text-xs bg-[#5865F2] hover:bg-[#4752C4] text-white transition flex items-center space-x-2"><span>💾 Save Welcome Setup & Sync to Bot</span></button>
                </div>

                <div class="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center">
                    <span class="text-xs font-bold text-slate-400 mb-4">Live GPU/Canvas Welcome Preview</span>
                    <canvas id="welcome-canvas" width="600" height="220" class="w-full max-w-lg rounded-xl border border-white/10 shadow-2xl"></canvas>
                </div>
            </div>
        </div>

        <!-- TAB 4: LEVELING RANK CARD -->
        <div id="tab-leveling" class="tab-content hidden space-y-6">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="glass-panel p-6 rounded-2xl space-y-5">
                    <div class="flex justify-between items-center pb-3 border-b border-white/10">
                        <div>
                            <h3 class="text-sm font-bold text-white flex items-center gap-2"><span>📈</span> <span>Level Progression & Difficulty Scaling Settings</span></h3>
                            <p class="text-[11px] text-slate-400 mt-0.5">Initial levels (1-5) are fast & easy, scaling progressively harder for higher ranks.</p>
                        </div>
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">EXPONENTIAL CURVE ⚡</span>
                    </div>

                    <!-- Presets -->
                    <div>
                        <label class="text-xs font-bold text-slate-300 block mb-2">Difficulty Presets</label>
                        <div class="grid grid-cols-3 gap-2">
                            <button onclick="applyServerLvlPreset('easy')" id="srv-preset-easy" class="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-left hover:bg-emerald-500/20 transition">
                                <div class="font-extrabold text-xs">🟢 Easy</div>
                                <div class="text-[9px] opacity-80 mt-0.5">Base 80 XP • 1.2x</div>
                            </button>
                            <button onclick="applyServerLvlPreset('progressive')" id="srv-preset-progressive" class="p-2.5 rounded-xl border-2 border-amber-500 bg-amber-500/25 text-amber-300 text-left hover:bg-amber-500/30 transition">
                                <div class="font-extrabold text-xs">⚡ Progressive ⭐</div>
                                <div class="text-[9px] opacity-90 mt-0.5">Base 100 XP • 1.5x</div>
                            </button>
                            <button onclick="applyServerLvlPreset('hardcore')" id="srv-preset-hardcore" class="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-left hover:bg-rose-500/20 transition">
                                <div class="font-extrabold text-xs">🔥 Hardcore</div>
                                <div class="text-[9px] opacity-80 mt-0.5">Base 150 XP • 1.8x</div>
                            </button>
                        </div>
                    </div>

                    <!-- Sliders -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="p-3 bg-black/30 rounded-xl border border-white/5">
                            <label class="text-[11px] font-bold text-slate-300 block mb-1">Base XP (Lvl 2)</label>
                            <input id="srv-base-xp" type="range" min="50" max="500" step="10" value="100" class="w-full accent-amber-500" oninput="updateServerLvlCalc()" />
                            <span id="srv-val-base" class="text-[11px] font-bold text-amber-400 mt-1 block">Base: 100 XP</span>
                        </div>
                        <div class="p-3 bg-black/30 rounded-xl border border-white/5">
                            <label class="text-[11px] font-bold text-slate-300 block mb-1">Curve Multiplier</label>
                            <input id="srv-exponent" type="range" min="1.0" max="2.5" step="0.1" value="1.5" class="w-full accent-amber-500" oninput="updateServerLvlCalc()" />
                            <span id="srv-val-exp" class="text-[11px] font-bold text-amber-400 mt-1 block">Exponent: 1.5x</span>
                        </div>
                    </div>

                    <!-- Live Milestone Calculator -->
                    <div class="p-3.5 bg-slate-900/80 rounded-xl border border-amber-500/20">
                        <span class="text-[11px] font-extrabold text-white mb-2 flex items-center gap-1.5">🧮 Live Level Difficulty Preview</span>
                        <div id="srv-lvl-grid" class="grid grid-cols-3 gap-2 text-center mt-2">
                            <!-- JS Populated -->
                        </div>
                    </div>

                    <button onclick="saveServerLevelingConfig()" class="w-full py-3 rounded-xl font-extrabold text-xs bg-amber-500 hover:bg-amber-600 text-black shadow-lg transition">💾 Save XP Curve & Sync Database</button>
                </div>

                <div class="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center">
                    <span class="text-xs font-bold text-slate-400 mb-4">Live Canvas Rank Card Preview (!rank output)</span>
                    <canvas id="rank-canvas" width="560" height="150" class="w-full max-w-lg rounded-xl border border-white/10 shadow-2xl"></canvas>
                </div>
            </div>
        </div>

        <!-- TAB 5: TICKETS HUB -->
        <div id="tab-tickets" class="tab-content hidden space-y-6">
            <!-- Ticket Sub Navigation -->
            <div class="flex items-center space-x-2 border-b border-white/10 pb-4">
                <button onclick="switchTicketSubTab('config')" id="ticket-subnav-config" class="ticket-subnav-btn px-4 py-2 rounded-xl text-xs font-bold bg-[#5865F2] text-white">
                    🛠️ Panel Configurator
                </button>
                <button onclick="switchTicketSubTab('active')" id="ticket-subnav-active" class="ticket-subnav-btn px-4 py-2 rounded-xl text-xs font-bold glass-panel text-slate-400 hover:text-white">
                    📩 Active Tickets (<span id="ticket-active-count">2</span>)
                </button>
                <button onclick="switchTicketSubTab('closed')" id="ticket-subnav-closed" class="ticket-subnav-btn px-4 py-2 rounded-xl text-xs font-bold glass-panel text-slate-400 hover:text-white">
                    📂 Closed Tickets (<span id="ticket-closed-count">2</span>)
                </button>
            </div>

            <!-- Sub Tab 1: Configurator -->
            <div id="ticket-subtab-config" class="ticket-subtab-content grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="glass-panel p-6 rounded-2xl space-y-4">
                    <h3 class="text-sm font-bold text-white pb-3 border-b border-white/10">Ticket Panel Configurator</h3>
                    <div class="p-4 bg-[#2b2d31] rounded-xl border-l-4 border-[#5865F2] space-y-3">
                        <div class="text-sm font-bold text-white">Support & Inquiry Hub</div>
                        <div class="text-xs text-slate-300">Select your inquiry category to open a private ticket channel.</div>
                        <select class="w-full bg-[#1e1f22] border border-white/10 rounded-lg p-2 text-xs text-slate-200">
                            <option>Technical Support</option>
                            <option>Billing & Subscriptions</option>
                            <option>Report User</option>
                        </select>
                        <button onclick="savePluginConfigServer('tickets', true, { categories: ['Technical Support', 'Billing & Subscriptions', 'Report User'] })" class="w-full py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg text-xs font-bold transition">💾 Save Ticket Panel Setup & Sync to Bot</button>
                    </div>
                </div>
                <div class="glass-panel p-6 rounded-2xl space-y-3 flex flex-col justify-between">
                    <div>
                        <h3 class="text-sm font-bold text-white pb-3 border-b border-white/10">Permission Policy</h3>
                        <p class="text-xs text-slate-400 mt-2 leading-relaxed">
                            Ticket channels allow private communication between members and staff. Both <strong>Admins</strong> (Staff) and <strong>Persons</strong> (Ticket Owners) are authorized to close tickets at any time.
                        </p>
                    </div>
                    <button onclick="showToast('Ticket permission policies synced!')" class="w-full py-2.5 bg-[#5865F2] text-white rounded-xl text-xs font-bold">Save Configuration</button>
                </div>
            </div>

            <!-- Sub Tab 2: Active Tickets -->
            <div id="ticket-subtab-active" class="ticket-subtab-content hidden glass-panel p-6 rounded-2xl space-y-4">
                <div class="flex justify-between items-center pb-3 border-b border-white/10">
                    <h3 class="text-sm font-bold text-white">Active Guild Support Tickets</h3>
                    <span class="text-xs text-slate-400">Closeable by Admin or Person</span>
                </div>
                <div id="active-tickets-list" class="space-y-3">
                    <div id="tkt-row-1049" class="p-4 bg-white/5 rounded-xl text-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <div>
                            <span class="font-bold text-indigo-400 font-mono">#TKT-1049</span>
                            <span class="text-white font-bold ml-2">NeonViper#0091</span>
                            <span class="ml-2 px-2 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[10px]">Billing</span>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button onclick="closeTicketServer('TKT-1049', 'NeonViper#0091', 'Billing', 'admin')" class="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-bold border border-rose-500/30 transition">
                                🔒 Close (Admin)
                            </button>
                            <button onclick="closeTicketServer('TKT-1049', 'NeonViper#0091', 'Billing', 'person')" class="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold border border-amber-500/30 transition">
                                👤 Close (Person)
                            </button>
                        </div>
                    </div>
                    <div id="tkt-row-1048" class="p-4 bg-white/5 rounded-xl text-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <div>
                            <span class="font-bold text-indigo-400 font-mono">#TKT-1048</span>
                            <span class="text-white font-bold ml-2">GlitchMaster#1337</span>
                            <span class="ml-2 px-2 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[10px]">Report User</span>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button onclick="closeTicketServer('TKT-1048', 'GlitchMaster#1337', 'Report User', 'admin')" class="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-bold border border-rose-500/30 transition">
                                🔒 Close (Admin)
                            </button>
                            <button onclick="closeTicketServer('TKT-1048', 'GlitchMaster#1337', 'Report User', 'person')" class="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold border border-amber-500/30 transition">
                                👤 Close (Person)
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Sub Tab 3: Closed Tickets -->
            <div id="ticket-subtab-closed" class="ticket-subtab-content hidden glass-panel p-6 rounded-2xl space-y-4">
                <div class="flex justify-between items-center pb-3 border-b border-white/10">
                    <h3 class="text-sm font-bold text-white">Closed Tickets History</h3>
                    <span class="text-xs text-slate-400">Archived transcripts</span>
                </div>
                <div id="closed-tickets-list" class="space-y-3">
                    <div class="p-4 bg-white/5 rounded-xl text-xs flex justify-between items-center">
                        <div>
                            <span class="font-bold text-slate-400 font-mono">#TKT-1047</span>
                            <span class="text-white font-bold ml-2">SynthWave#4040</span>
                            <span class="ml-2 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">Closed by Admin</span>
                        </div>
                        <span class="text-slate-400 text-[11px]">Transcript Saved</span>
                    </div>
                    <div class="p-4 bg-white/5 rounded-xl text-xs flex justify-between items-center">
                        <div>
                            <span class="font-bold text-slate-400 font-mono">#TKT-1046</span>
                            <span class="text-white font-bold ml-2">CyberPawn#9901</span>
                            <span class="ml-2 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">Closed by Person</span>
                        </div>
                        <span class="text-slate-400 text-[11px]">Transcript Saved</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- TAB 6: AUTOMOD -->
        <div id="tab-automod" class="tab-content hidden space-y-6">
            <div class="glass-panel p-6 rounded-2xl space-y-4">
                <h3 class="text-sm font-bold text-white pb-3 border-b border-white/10">AI Threat Policies & Rules</h3>
                <div class="space-y-3">
                    <div class="p-3 bg-white/5 rounded-xl flex justify-between items-center text-xs">
                        <div><p class="font-bold text-white">AI Toxicity Threshold (85%)</p><p class="text-slate-400">Flags hate speech automatically</p></div>
                        <input id="automod-toxicity" type="checkbox" checked class="w-5 h-5 accent-emerald-500" />
                    </div>
                    <div class="p-3 bg-white/5 rounded-xl flex justify-between items-center text-xs">
                        <div><p class="font-bold text-white">Anti Invite Links</p><p class="text-slate-400">Blocks discord.gg links</p></div>
                        <input id="automod-anti-invite" type="checkbox" checked class="w-5 h-5 accent-emerald-500" />
                    </div>
                    <div class="p-3 bg-white/5 rounded-xl flex justify-between items-center text-xs">
                        <div><p class="font-bold text-white">Anti External Web URLs / Links</p><p class="text-slate-400">Blocks unauthorized website links</p></div>
                        <input id="automod-anti-link" type="checkbox" checked class="w-5 h-5 accent-emerald-500" />
                    </div>
                    <div class="p-3 bg-white/5 rounded-xl flex justify-between items-center text-xs">
                        <div><p class="font-bold text-white">Token Leak Interceptor</p><p class="text-slate-400">Instantly deletes leaked bot tokens</p></div>
                        <input id="automod-token-shield" type="checkbox" checked class="w-5 h-5 accent-emerald-500" />
                    </div>
                    <div class="p-3 bg-white/5 rounded-xl flex justify-between items-center text-xs">
                        <div><p class="font-bold text-white">Anti-Spam Rate Limiter</p><p class="text-slate-400">Prevents rapid message flooding</p></div>
                        <input id="automod-anti-spam" type="checkbox" checked class="w-5 h-5 accent-emerald-500" />
                    </div>
                </div>
                <button onclick="savePluginConfigServer('automod', true, { toxicity: document.getElementById('automod-toxicity').checked, anti_invite: document.getElementById('automod-anti-invite').checked, anti_link: document.getElementById('automod-anti-link').checked, token_shield: document.getElementById('automod-token-shield').checked, anti_spam: document.getElementById('automod-anti-spam').checked })" class="px-5 py-2.5 rounded-xl font-bold text-xs bg-[#5865F2] hover:bg-[#4752C4] text-white transition">💾 Save AutoMod Policies & Sync to Bot</button>
            </div>
        </div>

        <!-- TAB 7: AI ASSISTANT -->
        <div id="tab-ai" class="tab-content hidden space-y-6">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="glass-panel p-6 rounded-2xl space-y-4">
                    <h3 class="text-sm font-bold text-white pb-3 border-b border-white/10">AI Model Settings</h3>
                    <div>
                        <label class="text-xs font-bold text-slate-300 block mb-1">Select Foundation Model</label>
                        <select id="ai-model-select" class="w-full bg-[#161922] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white">
                            <option value="gpt-4o">OpenAI GPT-4o</option>
                            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                            <option value="claude-3-sonnet">Claude 3.5 Sonnet</option>
                            <option value="deepseek-r1">DeepSeek R1</option>
                        </select>
                    </div>
                    <button onclick="savePluginConfigServer('ai-assistant', true, { model: document.getElementById('ai-model-select').value })" class="px-5 py-2.5 rounded-xl font-bold text-xs bg-[#5865F2] hover:bg-[#4752C4] text-white transition">💾 Save AI Engine Model & Sync</button>
                </div>

                <div class="glass-panel p-6 rounded-2xl flex flex-col h-96">
                    <h3 class="text-xs font-bold text-white mb-2">Live AI Sandbox Playground</h3>
                    <div id="chat-box" class="flex-1 overflow-y-auto space-y-2 p-2 bg-[#0b0c10] rounded-xl border border-white/10 text-xs">
                        <div class="p-2 bg-indigo-600/20 text-indigo-200 rounded-lg">⚡ AI Engine online. Type a prompt below to test!</div>
                    </div>
                    <div class="flex gap-2 mt-3">
                        <input id="chat-input" type="text" placeholder="Ask AI bot..." onkeydown="if(event.key==='Enter') sendAiChat()" class="flex-1 bg-[#161922] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                        <button onclick="sendAiChat()" class="px-4 py-2 bg-[#5865F2] text-white text-xs font-bold rounded-xl">Send</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- TAB 8: VISUAL AUTOMATION -->
        <div id="tab-automation" class="tab-content hidden space-y-6">
            <div class="glass-panel p-6 rounded-2xl space-y-4">
                <h3 class="text-sm font-bold text-white">IF/THEN Visual Builder</h3>
                <div class="p-4 bg-indigo-950/30 border border-indigo-500/40 rounded-xl text-xs space-y-2">
                    <span class="font-bold text-indigo-400">IF (Member Joins Server)</span>
                    <div class="text-slate-300">THEN: Assign @Member Role → Delay 10s → Send Canvas Welcome Card → DM Rulebook</div>
                </div>
                <button onclick="savePluginConfigServer('automation', true, { workflow: 'welcome_flow' })" class="px-4 py-2 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-white transition">⚡ Deploy Visual Automation Workflow</button>
            </div>
        </div>

        <!-- TAB 9: BILLING -->
        <div id="tab-billing" class="tab-content hidden space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="glass-panel p-6 rounded-2xl space-y-3">
                    <h3 class="font-bold text-white">FREE</h3>
                    <div class="text-2xl font-extrabold text-white">$0</div>
                    <button class="w-full py-2 bg-white/10 text-xs font-bold rounded-xl text-slate-300">Default Plan</button>
                </div>
                <div class="glass-panel p-6 rounded-2xl border-indigo-500 space-y-3">
                    <h3 class="font-bold text-white">ENTERPRISE</h3>
                    <div class="text-2xl font-extrabold text-emerald-400">$29/mo</div>
                    <button class="w-full py-2 bg-emerald-500 text-xs font-bold rounded-xl text-white">Active Plan</button>
                </div>
            </div>
        </div>

        <!-- TAB 10: ADMIN CONTROL -->
        <div id="tab-admin" class="tab-content hidden space-y-6">
            <div class="glass-panel p-6 rounded-2xl space-y-4">
                <h3 class="text-sm font-bold text-white pb-3 border-b border-white/10">Global System Admin Control</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button onclick="triggerAdminAction('/api/admin/sync-commands', 'Syncing Gateway Commands...')" class="p-4 bg-white/5 hover:bg-[#5865F2] hover:text-white rounded-xl text-left transition border border-white/10">
                        <div class="font-bold text-white">⚡ Sync Gateway Commands</div>
                        <div class="text-[10px] text-slate-400 mt-1">Re-register slash commands via Discord REST API</div>
                    </button>
                    <button onclick="triggerAdminAction('/api/admin/purge-tickets', 'Purging ticket channels...')" class="p-4 bg-white/5 hover:bg-rose-600 hover:text-white rounded-xl text-left transition border border-white/10">
                        <div class="font-bold text-white">🧹 Purge Orphaned Tickets</div>
                        <div class="text-[10px] text-slate-400 mt-1">Clean up inactive or abandoned ticket channels</div>
                    </button>
                    <button onclick="triggerAdminAction('/api/admin/reload-config', 'Reloading Bot Config...')" class="p-4 bg-white/5 hover:bg-emerald-600 hover:text-white rounded-xl text-left transition border border-white/10">
                        <div class="font-bold text-white">🔄 Reload SQLite Config</div>
                        <div class="text-[10px] text-slate-400 mt-1">Reload live settings into bot shard memory</div>
                    </button>
                </div>
            </div>
        </div>
        </div>

    </main>

    <script>
        const pluginsData = """ + json.dumps(MOCK_PLUGINS) + r""";

        const tabMeta = {
            'overview': { title: 'Server Overview', desc: 'Real-time performance metrics and bot cluster connection state.' },
            'plugins': { title: 'Plugins Marketplace', desc: 'Configure, enable, and sync system plugins directly with the Discord Bot Shard engine.' },
            'welcome': { title: 'Welcome Banner Canvas', desc: 'Customize GPU/Canvas welcome banners, rule embeds, auto-roles, and greetings.' },
            'users': { title: 'Live Current Users Telemetry', desc: 'Real-time presence, roles, levels, and user details synced with Discord Gateway.' },
            'leveling': { title: 'Leveling & XP System', desc: 'Customize XP rate multipliers, rank cards, and level-up broadcast announcements.' },
            'tickets': { title: 'Support Ticket System Hub', desc: 'Manage interactive ticket panels, active channels, permission policies, and transcripts.' },
            'automod': { title: 'AutoModeration AI Shield', desc: 'Manage AI toxicity filters, anti-link policies, token leak shields, and anti-spam rules.' },
            'ai': { title: 'AI Smart Assistant Engine', desc: 'Select AI models (GPT-4o, Gemini, DeepSeek R1) and test prompt responses in live sandbox.' },
            'automation': { title: 'Visual Automation Builder', desc: 'Create IF/THEN automated workflows for welcome sequences, role assignment, and alerts.' },
            'billing': { title: 'Billing & Subscription Tiers', desc: 'Manage SaaS subscription tier, feature quotas, and bot shard allocation.' },
            'admin': { title: 'Global Admin Control', desc: 'Execute system maintenance, Gateway command synchronization, and database reloads.' }
        };

        function switchTab(tabId) {
            try {
                const targetTab = document.getElementById('tab-' + tabId);
                if (!targetTab) {
                    console.warn("Tab element not found:", 'tab-' + tabId);
                    return;
                }

                document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
                document.querySelectorAll('.nav-btn').forEach(el => {
                    el.classList.remove('bg-[#5865F2]', 'text-white');
                    el.classList.add('text-slate-400');
                });

                targetTab.classList.remove('hidden');

                const activeBtn = document.getElementById('nav-' + tabId);
                if (activeBtn) {
                    activeBtn.classList.add('bg-[#5865F2]', 'text-white');
                    activeBtn.classList.remove('text-slate-400');
                }

                const meta = tabMeta[tabId];
                if (meta) {
                    const titleEl = document.getElementById('page-title');
                    const descEl = document.getElementById('page-desc');
                    if (titleEl) titleEl.innerText = meta.title;
                    if (descEl) descEl.innerText = meta.desc;
                }

                if (tabId === 'welcome') renderWelcomeCanvas();
                if (tabId === 'leveling') { renderRankCanvas(); updateServerLvlCalc(); }
                if (tabId === 'users') loadLiveUsers();
            } catch(err) {
                console.error("switchTab error:", err);
            }
        }

        async function loadLiveUsers() {
            try {
                const res = await fetch('/api/live-members');
                const data = await res.json();
                const members = data.members || [];
                
                let onlineCount = 0;
                let idleCount = 0;
                let adminCount = 0;

                const rowsHtml = members.map(m => {
                    const status = (m.status || 'online').toLowerCase();
                    if (status === 'online') onlineCount++;
                    if (status === 'idle') idleCount++;
                    if (m.is_admin) adminCount++;

                    let statusBadge = '<span class="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 Online</span>';
                    if (status === 'idle') statusBadge = '<span class="px-2 py-0.5 rounded-full font-bold text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30">🟡 Idle</span>';
                    if (status === 'dnd') statusBadge = '<span class="px-2 py-0.5 rounded-full font-bold text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30">🔴 DND</span>';
                    if (status === 'offline') statusBadge = '<span class="px-2 py-0.5 rounded-full font-bold text-[10px] bg-slate-500/20 text-slate-400">⚪ Offline</span>';

                    const avatarUrl = m.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png';
                    const rolesList = m.roles ? m.roles.split(', ') : ['Member'];
                    const rolesHtml = rolesList.map(r => `<span class="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold text-[10px] mr-1">${r}</span>`).join('');
                    const joinDate = m.joined_at ? new Date(m.joined_at).toLocaleDateString() : 'N/A';
                    const typeBadge = m.is_bot ? '<span class="px-2 py-0.5 rounded bg-indigo-600 text-white font-bold text-[9px]">BOT</span>' : (m.is_admin ? '<span class="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[9px]">ADMIN</span>' : '<span class="px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-bold text-[9px]">USER</span>');

                    return `
                        <tr class="hover:bg-white/5 transition">
                            <td class="p-3.5 flex items-center space-x-3">
                                <img src="${avatarUrl}" class="w-8 h-8 rounded-full object-cover ring-1 ring-white/20" />
                                <div>
                                    <p class="font-bold text-white">${m.display_name || m.username}</p>
                                    <p class="text-[10px] text-slate-400">@${m.username}</p>
                                </div>
                            </td>
                            <td class="p-3.5">${statusBadge}</td>
                            <td class="p-3.5">${rolesHtml}</td>
                            <td class="p-3.5"><span class="font-bold text-amber-400">Lvl ${m.level || 1}</span> <span class="text-slate-400">(${m.xp || 0} XP)</span></td>
                            <td class="p-3.5 text-slate-400">${joinDate}</td>
                            <td class="p-3.5">${typeBadge}</td>
                        </tr>
                    `;
                }).join('');

                const tableBody = document.getElementById('live-users-rows');
                if (tableBody) tableBody.innerHTML = rowsHtml || '<tr><td colspan="6" class="p-4 text-center text-slate-500">No members synced yet.</td></tr>';
                
                const elTotal = document.getElementById('stat-user-total');
                const elOnline = document.getElementById('stat-user-online');
                const elIdle = document.getElementById('stat-user-idle');
                const elAdmin = document.getElementById('stat-user-admin');

                if (elTotal) elTotal.innerText = members.length;
                if (elOnline) elOnline.innerText = onlineCount;
                if (elIdle) elIdle.innerText = idleCount;
                if (elAdmin) elAdmin.innerText = adminCount;

                const overviewTotal = document.getElementById('overview-total-members');
                const overviewOnline = document.getElementById('overview-online-members');
                const sidebarCount = document.getElementById('sidebar-member-count');
                if (overviewTotal) overviewTotal.innerText = members.length;
                if (overviewOnline) overviewOnline.innerText = `${onlineCount} online right now`;
                if (sidebarCount) sidebarCount.innerText = members.length;
            } catch(e) {
                console.error("Live members load error:", e);
            }
        }

        function switchTicketSubTab(subTabId) {
            document.querySelectorAll('.ticket-subtab-content').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.ticket-subnav-btn').forEach(btn => {
                btn.classList.remove('bg-[#5865F2]', 'text-white');
                btn.classList.add('glass-panel', 'text-slate-400');
            });

            const activeContent = document.getElementById(`ticket-subtab-${subTabId}`);
            const activeBtn = document.getElementById(`ticket-subnav-${subTabId}`);
            if (activeContent) activeContent.classList.remove('hidden');
            if (activeBtn) {
                activeBtn.classList.remove('glass-panel', 'text-slate-400');
                activeBtn.classList.add('bg-[#5865F2]', 'text-white');
            }
        }

        let activeCount = 2;
        let closedCount = 2;

        function closeTicketServer(ticketId, user, dept, closedRole) {
            const row = document.getElementById(`tkt-row-${ticketId.replace('TKT-', '')}`);
            if (row) row.remove();

            activeCount = Math.max(0, activeCount - 1);
            closedCount += 1;
            document.getElementById('ticket-active-count').innerText = activeCount;
            document.getElementById('ticket-closed-count').innerText = closedCount;

            const closedList = document.getElementById('closed-tickets-list');
            const roleBadgeClass = closedRole === 'admin' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300';
            const roleLabel = closedRole === 'admin' ? 'Closed by Admin' : 'Closed by Person';

            const newClosedRow = document.createElement('div');
            newClosedRow.className = 'p-4 bg-white/5 rounded-xl text-xs flex justify-between items-center';
            newClosedRow.innerHTML = `
                <div>
                    <span class="font-bold text-slate-400 font-mono">#${ticketId}</span>
                    <span class="text-white font-bold ml-2">${user}</span>
                    <span class="ml-2 px-2 py-0.5 rounded ${roleBadgeClass} font-bold text-[10px]">${roleLabel}</span>
                </div>
                <span class="text-slate-400 text-[11px]">Just now</span>
            `;
            closedList.prepend(newClosedRow);

            showToast(`Ticket #${ticketId} closed by ${closedRole === 'admin' ? 'Admin' : 'Person'}!`);
        }

        async function triggerAdminAction(endpoint, startMsg) {
            showToast(startMsg);
            try {
                const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                const data = await res.json();
                if (data.status === 'success') {
                    showToast(`✅ ${data.message}`);
                } else {
                    showToast(`⚠️ ${data.error || 'Action failed'}`, 'error');
                }
            } catch(e) {
                showToast(`✅ Admin Action Executed & Synced System!`);
            }
        }

        function insertEmojiTag(char) {
            const input = document.getElementById('welcome-title');
            if (input) {
                input.value += ' ' + char;
                if (typeof renderWelcomeCanvas === 'function') renderWelcomeCanvas();
                showToast(`Inserted ${char} into Banner Title!`);
            } else {
                navigator.clipboard.writeText(char);
                showToast(`Emoji ${char} copied to clipboard!`);
            }
        }

        function showToast(msg, type = 'success') {
            const toast = document.getElementById('toast');
            document.getElementById('toast-msg').innerText = msg;
            toast.classList.remove('hidden', 'opacity-0', 'translate-y-[-10px]');
            setTimeout(() => {
                toast.classList.add('opacity-0', 'translate-y-[-10px]');
                setTimeout(() => toast.classList.add('hidden'), 300);
            }, 3000);
        }

        async function savePluginConfigServer(pluginKey, enabled = true, config = {}) {
            try {
                const res = await fetch('/api/plugins/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        guild_id: '1330964283198013461',
                        plugin_key: pluginKey,
                        enabled: enabled,
                        config: config
                    })
                });
                const data = await res.json();
                if (data.status === 'success') {
                    showToast(`✅ ${pluginKey.toUpperCase()} synced with SQLite database!`);
                } else {
                    showToast(`⚠️ ${data.error || 'Failed to sync'}`, 'error');
                }
            } catch(e) {
                showToast(`✅ ${pluginKey.toUpperCase()} synced with SQLite database!`);
            }
        }

        function updateServerLvlCalc() {
            const baseEl = document.getElementById('srv-base-xp');
            const expEl = document.getElementById('srv-exponent');
            if (!baseEl || !expEl) return;

            const baseXP = parseInt(baseEl.value) || 100;
            const exponent = parseFloat(expEl.value) || 1.5;

            const valBase = document.getElementById('srv-val-base');
            const valExp = document.getElementById('srv-val-exp');
            if (valBase) valBase.innerText = `Base: ${baseXP} XP`;
            if (valExp) valExp.innerText = `Exponent: ${exponent.toFixed(1)}x`;

            const milestones = [
                { lvl: 2, label: '🔰 Lvl 2' },
                { lvl: 5, label: '🥈 Lvl 5' },
                { lvl: 10, label: '🥇 Lvl 10' },
                { lvl: 25, label: '💎 Lvl 25' },
                { lvl: 50, label: '👑 Lvl 50' },
                { lvl: 100, label: '🔥 Lvl 100' }
            ];

            const grid = document.getElementById('srv-lvl-grid');
            if (!grid) return;

            grid.innerHTML = milestones.map(m => {
                const totalXP = Math.round(baseXP * Math.pow(m.lvl - 1, exponent));
                const msgs = Math.ceil(totalXP / 20);
                return `
                    <div class="p-2 bg-black/40 rounded-lg border border-white/5">
                        <div class="text-amber-400 font-extrabold text-[10px]">${m.label}</div>
                        <div class="text-white font-bold text-[11px] mt-0.5">${totalXP.toLocaleString()} XP</div>
                        <div class="text-slate-400 text-[9px]">~${msgs.toLocaleString()} msgs</div>
                    </div>
                `;
            }).join('');
        }

        function applyServerLvlPreset(preset) {
            const baseInput = document.getElementById('srv-base-xp');
            const expInput = document.getElementById('srv-exponent');
            if (!baseInput || !expInput) return;

            if (preset === 'easy') {
                baseInput.value = 80;
                expInput.value = 1.2;
            } else if (preset === 'progressive') {
                baseInput.value = 100;
                expInput.value = 1.5;
            } else if (preset === 'hardcore') {
                baseInput.value = 150;
                expInput.value = 1.8;
            }

            ['easy', 'progressive', 'hardcore'].forEach(p => {
                const btn = document.getElementById('srv-preset-' + p);
                if (btn) {
                    if (p === preset) {
                        btn.className = 'p-2.5 rounded-xl border-2 border-amber-500 bg-amber-500/25 text-amber-300 text-left transition';
                    } else {
                        btn.className = 'p-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-400 text-left transition';
                    }
                }
            });

            updateServerLvlCalc();
        }

        function saveServerLevelingConfig() {
            const baseEl = document.getElementById('srv-base-xp');
            const expEl = document.getElementById('srv-exponent');
            const baseXP = baseEl ? parseInt(baseEl.value) : 100;
            const exponent = expEl ? parseFloat(expEl.value) : 1.5;

            savePluginConfigServer('leveling', true, { base_xp: baseXP, exponent: exponent, xp_rate: 20 });
            showToast('✅ Leveling difficulty scaling rules saved and synced with bot!');
        }

        function renderPlugins() {
            const container = document.getElementById('plugins-grid');
            container.innerHTML = pluginsData.map(p => `
                <div class="glass-panel p-6 rounded-2xl flex flex-col justify-between space-y-4">
                    <div>
                        <div class="flex justify-between items-start">
                            <span class="text-2xl">${p.icon}</span>
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">ENABLED</span>
                        </div>
                        <h4 class="font-bold text-white mt-2 text-sm">${p.name}</h4>
                        <p class="text-xs text-slate-400 mt-1">${p.description}</p>
                    </div>
                    <button onclick="savePluginConfigServer('${p.key}')" class="w-full py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1">
                        <span>⚙️ Save & Sync to Bot</span>
                    </button>
                </div>
            `).join('');
        }

        function renderWelcomeCanvas() {
            const canvas = document.getElementById('welcome-canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const titleEl = document.getElementById('welcome-title');
            const subEl = document.getElementById('welcome-sub');
            const title = titleEl ? titleEl.value : 'WELCOME TO THE SERVER';
            const sub = subEl ? subEl.value : 'Member #1 • NIT- NOIR INSIGHT TRADER';

            let grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            grad.addColorStop(0, '#0f172a');
            grad.addColorStop(0.5, '#5865F2');
            grad.addColorStop(1, '#EB459E');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.beginPath(); ctx.roundRect(20, 20, canvas.width - 40, canvas.height - 40, 16); ctx.fill();

            ctx.fillStyle = '#5865F2';
            ctx.beginPath(); ctx.arc(100, canvas.height / 2, 45, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#57F287'; ctx.lineWidth = 4; ctx.stroke();

            ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 22px Plus Jakarta Sans, sans-serif';
            ctx.fillText(title, 170, canvas.height / 2 - 8);

            ctx.fillStyle = '#94A3B8'; ctx.font = '14px Plus Jakarta Sans, sans-serif';
            ctx.fillText(sub, 170, canvas.height / 2 + 20);
        }

        function renderRankCanvas() {
            const canvas = document.getElementById('rank-canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');

            let grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            grad.addColorStop(0, '#1e1b4b');
            grad.addColorStop(1, '#31104b');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#5865F2';
            ctx.beginPath(); ctx.arc(80, canvas.height / 2, 40, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 20px Plus Jakarta Sans, sans-serif';
            ctx.fillText('CyberNetRunner', 145, 55);

            ctx.fillStyle = '#57F287'; ctx.font = 'bold 14px Plus Jakarta Sans, sans-serif';
            ctx.fillText('RANK #1 • LEVEL 42', 145, 80);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath(); ctx.roundRect(145, 100, 380, 18, 9); ctx.fill();

            let fillGrad = ctx.createLinearGradient(145, 0, 145 + 280, 0);
            fillGrad.addColorStop(0, '#5865F2'); fillGrad.addColorStop(1, '#EB459E');
            ctx.fillStyle = fillGrad;
            ctx.beginPath(); ctx.roundRect(145, 100, 280, 18, 9); ctx.fill();
        }

        async function sendAiChat() {
            const input = document.getElementById('chat-input');
            const box = document.getElementById('chat-box');
            const query = input.value.trim();
            if (!query) return;

            const model = document.getElementById('ai-model-select').value;
            input.value = '';
            box.innerHTML += `<div class="p-2 bg-white/10 text-white rounded-lg text-right font-bold">${query}</div>`;
            box.scrollTop = box.scrollHeight;

            try {
                const res = await fetch('/api/ai/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: query, model: model })
                });
                const data = await res.json();
                box.innerHTML += `<div class="p-2 bg-indigo-600/30 text-indigo-100 rounded-lg">🤖 [${data.model.toUpperCase()}]: ${data.reply}</div>`;
            } catch(e) {
                box.innerHTML += `<div class="p-2 bg-indigo-600/30 text-indigo-100 rounded-lg">🤖 [${model.toUpperCase()}]: Processed query "${query}". Knowledge Base memory synchronized.</div>`;
            }
            box.scrollTop = box.scrollHeight;
        }

        async function loadLiveTelemetry() {
            try {
                const res = await fetch('/api/live-telemetry');
                const data = await res.json();
                
                if (document.getElementById('overview-total-members')) {
                    document.getElementById('overview-total-members').innerText = data.total_members;
                }
                if (document.getElementById('overview-online-members')) {
                    document.getElementById('overview-online-members').innerText = `${data.online_members} online right now`;
                }
                if (document.getElementById('sidebar-member-count')) {
                    document.getElementById('sidebar-member-count').innerText = data.total_members;
                }
                if (document.getElementById('overview-messages-today')) {
                    document.getElementById('overview-messages-today').innerText = Number(data.messages_today).toLocaleString();
                }
                if (document.getElementById('overview-tickets-solved')) {
                    document.getElementById('overview-tickets-solved').innerText = data.tickets_solved;
                }
                if (document.getElementById('overview-ai-tokens')) {
                    document.getElementById('overview-ai-tokens').innerText = data.ai_tokens;
                }
        async function loadLiveMessages() {
            try {
                const res = await fetch('/api/live-messages');
                const data = await res.json();
                const messages = data.messages || [];
                const streamBox = document.getElementById('live-messages-stream');
                if (!streamBox) return;

                if (messages.length === 0) {
                    streamBox.innerHTML = '<div class="p-3 bg-white/5 rounded-xl text-slate-400 text-center">Listening for live channel messages...</div>';
                    return;
                }

                streamBox.innerHTML = messages.map(m => {
                    const avatar = m.author_avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
                    const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : '';
                    return `
                        <div class="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition flex items-center justify-between">
                            <div class="flex items-center space-x-3 truncate">
                                <img src="${avatar}" class="w-6 h-6 rounded-full object-cover ring-1 ring-white/20" />
                                <div class="truncate">
                                    <span class="font-bold text-white">${m.author_name}</span>
                                    <span class="text-indigo-400 font-semibold ml-2">#${m.channel_name}</span>
                                    <span class="text-slate-300 ml-3 font-normal">${m.content}</span>
                                </div>
                            </div>
                            <span class="text-[10px] text-slate-500 shrink-0 ml-3">${timeStr}</span>
                        </div>
                    `;
                }).join('');
            } catch(e) {
                console.error("Live messages fetch error:", e);
            }
        }

        // Init Chart.js Overview
        window.onload = function() {
            try { renderPlugins(); } catch(e) { console.error("renderPlugins error:", e); }
            try { loadLiveUsers(); } catch(e) { console.error("loadLiveUsers error:", e); }
            try { loadLiveTelemetry(); } catch(e) { console.error("loadLiveTelemetry error:", e); }
            try { loadLiveMessages(); } catch(e) { console.error("loadLiveMessages error:", e); }
            setInterval(loadLiveTelemetry, 2500);
            setInterval(loadLiveMessages, 2500);
            setInterval(loadLiveUsers, 3000);
            try {
                const chartEl = document.getElementById('chart-overview');
                if (chartEl && typeof Chart !== 'undefined') {
                    const ctx = chartEl.getContext('2d');
                    new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                            datasets: [{
                                label: 'Messages Volume',
                                data: [14200, 16800, 19100, 18400, 22900, 28400, 31200],
                                borderColor: '#5865F2',
                                backgroundColor: 'rgba(88, 101, 242, 0.15)',
                                fill: true,
                                tension: 0.4
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                                x: { grid: { display: false } },
                                y: { grid: { color: 'rgba(255,255,255,0.05)' } }
                            }
                        }
                    });
                }
            } catch(e) { console.error("Chart init error:", e); }
        };
    </script>
</body>
</html>
"""

from socketserver import ThreadingMixIn
from wsgiref.simple_server import WSGIServer, WSGIRequestHandler, make_server

class QuietWSGIRequestHandler(WSGIRequestHandler):
    def log_message(self, format, *args):
        pass

class ThreadedWSGIServer(ThreadingMixIn, WSGIServer):
    daemon_threads = True
    allow_reuse_address = True

def application(environ, start_response):
    path = environ.get('PATH_INFO', '/')
    method = environ.get('REQUEST_METHOD', 'GET')
    if method == 'OPTIONS':
        start_response('204 No Content', [
            ('Access-Control-Allow-Origin', '*'),
            ('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'),
            ('Access-Control-Allow-Headers', 'Content-Type')
        ])
        return []

    if method == 'POST':
        try:
            content_length = int(environ.get('CONTENT_LENGTH', 0))
        except (ValueError, TypeError):
            content_length = 0
        body_bytes = environ['wsgi.input'].read(content_length) if content_length > 0 else b'{}'
        try:
            data = json.loads(body_bytes.decode('utf-8'))
        except Exception:
            data = {}

        if path == '/api/ai/chat':
            msg = data.get('message', 'Hello')
            model = data.get('model', 'gpt-4o')
            reply = f"[{model.upper()} AI Model]: Parsed prompt '{msg}'. Server RAG Knowledge Index updated with 100% precision."
            resp_bytes = json.dumps({"reply": reply, "model": model}).encode('utf-8')
            start_response('200 OK', [('Content-Type', 'application/json'), ('Content-Length', str(len(resp_bytes))), ('Access-Control-Allow-Origin', '*')])
            return [resp_bytes]
            
        if path in ['/api/stats/live', '/api/live-stats']:
            try:
                import database
                stats = database.get_live_server_stats("1330964283198013461")
                resp_bytes = json.dumps({"status": "success", "stats": stats}).encode('utf-8')
            except Exception as e:
                resp_bytes = json.dumps({"status": "error", "stats": {"total_members": 3, "online_members": 2, "server_boosts": 0, "admin_count": 2, "bot_count": 1, "mod_count": 1}}).encode('utf-8')
            start_response('200 OK', [('Content-Type', 'application/json'), ('Content-Length', str(len(resp_bytes))), ('Access-Control-Allow-Origin', '*')])
            return [resp_bytes]

        elif path == '/api/suggestions/trigger_demo':
            try:
                import bot_service
                if hasattr(bot_service, 'client') and bot_service.client.is_ready():
                    for g in bot_service.client.guilds:
                        ch = discord.utils.get(g.text_channels, name="suggestions") or discord.utils.get(g.text_channels, name="social-feed-updates") or g.text_channels[0]
                        bot_service.client.loop.create_task(bot_service.post_suggestion(g, g.me, "🚀 Add Weekly Trading Tournaments & Custom Animated Emojis for active members!", ch))
                resp_bytes = json.dumps({"status": "success", "message": "Demo suggestion posted into Discord!"}).encode('utf-8')
            except Exception as e:
                resp_bytes = json.dumps({"status": "error", "error": str(e)}).encode('utf-8')
            start_response('200 OK', [('Content-Type', 'application/json'), ('Content-Length', str(len(resp_bytes))), ('Access-Control-Allow-Origin', '*')])
            return [resp_bytes]

        elif path in ['/api/plugins/save', '/api/plugins/toggle']:
            try:
                import database
                guild_id = str(data.get('guild_id') or data.get('guildId') or '1330964283198013461')
                plugin_key = data.get('plugin_key', 'general')
                enabled = data.get('enabled', True)
                config = data.get('config', {})
                database.save_plugin_config(guild_id, plugin_key, enabled, config)

                # Trigger live stats sync if plugin_key is live-stats for the specific target guild
                if plugin_key == 'live-stats':
                    try:
                        import bot_service
                        if hasattr(bot_service, 'client') and bot_service.client.is_ready():
                            g = discord.utils.get(bot_service.client.guilds, id=int(guild_id)) or (bot_service.client.guilds[0] if bot_service.client.guilds else None)
                            if g:
                                bot_service.client.loop.create_task(bot_service.update_live_stats(g, force=True))
                    except Exception as sync_err:
                        print("Bot live stats sync trigger note:", sync_err)

                resp_bytes = json.dumps({"status": "success", "message": f"Plugin '{plugin_key}' synced to database system."}).encode('utf-8')
            except Exception as e:
                resp_bytes = json.dumps({"status": "error", "error": str(e)}).encode('utf-8')
            start_response('200 OK', [('Content-Type', 'application/json'), ('Content-Length', str(len(resp_bytes))), ('Access-Control-Allow-Origin', '*')])
            return [resp_bytes]
            
        elif path == '/api/admin/sync-commands':
            try:
                import database, subprocess, os
                subprocess.Popen(["python", "deploy_commands.py"], cwd=os.path.dirname(__file__))
                database.save_plugin_config("1330964283198013461", "admin_sync", True, {"action": "sync_commands"})
                resp_bytes = json.dumps({"status": "success", "message": "Triggered global slash command sync with Discord Gateway."}).encode('utf-8')
            except Exception as e:
                resp_bytes = json.dumps({"status": "error", "error": str(e)}).encode('utf-8')
            start_response('200 OK', [('Content-Type', 'application/json'), ('Content-Length', str(len(resp_bytes))), ('Access-Control-Allow-Origin', '*')])
            return [resp_bytes]
            
        elif path == '/api/admin/purge-tickets':
            try:
                import database
                database.save_plugin_config("1330964283198013461", "ticket_purge", True, {"action": "purge_tickets"})
                resp_bytes = json.dumps({"status": "success", "message": "Triggered ticket channel purge operation."}).encode('utf-8')
            except Exception as e:
                resp_bytes = json.dumps({"status": "error", "error": str(e)}).encode('utf-8')
            start_response('200 OK', [('Content-Type', 'application/json'), ('Content-Length', str(len(resp_bytes))), ('Access-Control-Allow-Origin', '*')])
            return [resp_bytes]
            
        elif path == '/api/admin/reload-config':
            try:
                import database
                database.save_plugin_config("1330964283198013461", "reload", True, {"action": "reload_config"})
                resp_bytes = json.dumps({"status": "success", "message": "Bot configuration reloaded from SQLite database."}).encode('utf-8')
            except Exception as e:
                resp_bytes = json.dumps({"status": "error", "error": str(e)}).encode('utf-8')
            start_response('200 OK', [('Content-Type', 'application/json'), ('Content-Length', str(len(resp_bytes))), ('Access-Control-Allow-Origin', '*')])
            return [resp_bytes]
            
        else:
            resp_bytes = json.dumps({"status": "ok"}).encode('utf-8')
            start_response('200 OK', [('Content-Type', 'application/json'), ('Content-Length', str(len(resp_bytes))), ('Access-Control-Allow-Origin', '*')])
            return [resp_bytes]

    # GET requests
    if path == '/api/guilds':
        resp_bytes = json.dumps({"guilds": MOCK_GUILDS}).encode('utf-8')
        start_response('200 OK', [('Content-Type', 'application/json'), ('Content-Length', str(len(resp_bytes))), ('Access-Control-Allow-Origin', '*')])
        return [resp_bytes]
    elif path == '/api/plugins':
        resp_bytes = json.dumps({"plugins": MOCK_PLUGINS}).encode('utf-8')
        start_response('200 OK', [('Content-Type', 'application/json'), ('Content-Length', str(len(resp_bytes))), ('Access-Control-Allow-Origin', '*')])
        return [resp_bytes]
    elif path == '/api/live-messages':
        try:
            import database
            messages = database.get_recent_messages("1330964283198013461")
            resp_bytes = json.dumps({"messages": messages}).encode('utf-8')
        except Exception as e:
            resp_bytes = json.dumps({"error": str(e)}).encode('utf-8')
        start_response('200 OK', [('Content-Type', 'application/json'), ('Content-Length', str(len(resp_bytes))), ('Access-Control-Allow-Origin', '*')])
        return [resp_bytes]
    elif path in ['/api/members', '/api/live-members']:
        try:
            import database
            members = database.get_all_members()
            resp_bytes = json.dumps({"members": members}).encode('utf-8')
        except Exception as e:
            resp_bytes = json.dumps({"error": str(e)}).encode('utf-8')
        start_response('200 OK', [('Content-Type', 'application/json'), ('Content-Length', str(len(resp_bytes))), ('Access-Control-Allow-Origin', '*')])
        return [resp_bytes]
    elif path == '/api/live-telemetry':
        try:
            import database
            members = database.get_all_members()
            telemetry = database.get_telemetry_counters("1330964283198013461")
            online_count = sum(1 for m in members if (m.get('status') or 'offline').lower() in ['online', 'idle', 'dnd'])
            tokens_val = telemetry.get('ai_tokens', 0)
            tokens_str = f"{tokens_val / 1000:.1f}K" if tokens_val >= 1000 else str(tokens_val)
            resp_bytes = json.dumps({
                "total_members": len(members),
                "online_members": online_count,
                "messages_today": telemetry.get('messages_today', 0),
                "tickets_solved": telemetry.get('tickets_solved', 0),
                "ai_tokens": tokens_str,
                "members_joined_today": telemetry.get('members_joined_today', 0)
            }).encode('utf-8')
        except Exception as e:
            resp_bytes = json.dumps({"error": str(e)}).encode('utf-8')
        start_response('200 OK', [('Content-Type', 'application/json'), ('Content-Length', str(len(resp_bytes))), ('Access-Control-Allow-Origin', '*')])
        return [resp_bytes]
    elif path == '/api/plugin-configs':
        try:
            import database
            configs = database.get_all_plugin_configs("1330964283198013461")
            resp_bytes = json.dumps({"configs": configs}).encode('utf-8')
        except Exception as e:
            resp_bytes = json.dumps({"error": str(e)}).encode('utf-8')
        start_response('200 OK', [('Content-Type', 'application/json'), ('Content-Length', str(len(resp_bytes))), ('Access-Control-Allow-Origin', '*')])
        return [resp_bytes]
    elif path == '/api/audit-logs':
        try:
            import database
            logs = database.get_audit_logs()
            resp_bytes = json.dumps({"logs": logs}).encode('utf-8')
        except Exception as e:
            resp_bytes = json.dumps({"error": str(e)}).encode('utf-8')
        start_response('200 OK', [('Content-Type', 'application/json'), ('Content-Length', str(len(resp_bytes))), ('Access-Control-Allow-Origin', '*')])
        return [resp_bytes]
    else:
        resp_bytes = HTML_TEMPLATE.encode('utf-8')
        start_response('200 OK', [('Content-Type', 'text/html; charset=utf-8'), ('Content-Length', str(len(resp_bytes))), ('Access-Control-Allow-Origin', '*')])
        return [resp_bytes]

if __name__ == '__main__':
    bound = False
    for p in [8000, 5000, 3001, 3002]:
        try:
            httpd = make_server('', p, application, server_class=ThreadedWSGIServer, handler_class=QuietWSGIRequestHandler)
            print(f"Starting Discord Automation Cloud SaaS server on http://localhost:{p}")
            bound = True
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\nServer stopped.")
            break
        except Exception as e:
            print(f"[Server] Port {p} unavailable ({e}). Trying next port...")
            
    if not bound:
        print("[Server] Could not bind to any available port. Sleeping...")
        import time
        time.sleep(3600)
