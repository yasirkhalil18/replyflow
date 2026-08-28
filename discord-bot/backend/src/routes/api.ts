import { Router, Request, Response } from 'express';
import { MOCK_SERVERS, MOCK_PLUGINS, MOCK_AUTOMATIONS } from '../mockData';

const router = Router();

// Cache in-memory for live interactions
let servers = [...MOCK_SERVERS];
let plugins = [...MOCK_PLUGINS];
let automations = [...MOCK_AUTOMATIONS];

// --- AUTH & USER ---
router.get('/auth/me', (req: Request, res: Response) => {
  res.json({
    user: {
      id: '98471928471928471',
      username: 'CyberNetRunner',
      discriminator: '0001',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      email: 'runner@cyberpunk.io',
      isAdmin: true,
    }
  });
});

// --- GUILDS ---
router.get('/guilds', (req: Request, res: Response) => {
  res.json({ guilds: servers });
});

router.get('/guilds/:guildId', (req: Request, res: Response) => {
  const guild = servers.find((s) => s.id === req.params.guildId) || servers[0];
  res.json({ guild });
});

// --- PLUGINS ---
router.get('/guilds/:guildId/plugins', (req: Request, res: Response) => {
  res.json({ plugins });
});

router.post('/guilds/:guildId/plugins/:pluginKey/toggle', (req: Request, res: Response) => {
  const { pluginKey } = req.params;
  const { enabled } = req.body;
  
  const plugin = plugins.find((p) => p.key === pluginKey);
  if (plugin) {
    plugin.enabled = enabled;
  }
  
  res.json({ success: true, plugin });
});

router.put('/guilds/:guildId/plugins/:pluginKey/config', (req: Request, res: Response) => {
  const { pluginKey } = req.params;
  const { config } = req.body;
  
  const plugin = plugins.find((p) => p.key === pluginKey);
  if (plugin) {
    plugin.config = { ...plugin.config, ...config };
  }
  
  res.json({ success: true, plugin });
});

// --- ANALYTICS ---
router.get('/guilds/:guildId/analytics', (req: Request, res: Response) => {
  res.json({
    memberGrowth: [
      { date: 'Mon', total: 24100, joins: 140, leaves: 20 },
      { date: 'Tue', total: 24220, joins: 160, leaves: 40 },
      { date: 'Wed', total: 24400, joins: 210, leaves: 30 },
      { date: 'Thu', total: 24550, joins: 190, leaves: 40 },
      { date: 'Fri', total: 24700, joins: 240, leaves: 90 },
      { date: 'Sat', total: 24820, joins: 310, leaves: 190 },
      { date: 'Sun', total: 24890, joins: 280, leaves: 210 },
    ],
    messageActivity: [
      { time: '00:00', messages: 1420 },
      { time: '04:00', messages: 680 },
      { time: '08:00', messages: 2940 },
      { time: '12:00', messages: 5410 },
      { time: '16:00', messages: 8900 },
      { time: '20:00', messages: 11200 },
    ],
    voiceHours: 1480,
    activeTickets: 14,
    automodInterventions: 382,
    aiTokensConsumed: 149200,
  });
});

// --- AI ASSISTANT SANDBOX ---
router.post('/ai/chat', (req: Request, res: Response) => {
  const { message, model } = req.body;
  
  const responses: Record<string, string> = {
    'gpt-4o': `[OpenAI GPT-4o Response]: I parsed your command "${message}". Cyberpunk Syndicate bot protocols are running with 99.9% uptime.`,
    'gemini-1.5-pro': `[Gemini 1.5 Pro Response]: Processing query "${message}". Multi-tenant vector knowledge index accessed successfully.`,
    'claude-3-sonnet': `[Claude 3.5 Sonnet Response]: Synthesizing server rules for "${message}". Moderation guidelines enforced across all voice & text channels.`,
    'deepseek-r1': `[DeepSeek R1 Response]: Reasoning steps completed. High speed analysis for prompt: "${message}".`,
  };

  const responseText = responses[model] || responses['gpt-4o'];
  
  res.json({
    reply: responseText,
    tokens: Math.floor(Math.random() * 150) + 50,
    model: model || 'gpt-4o',
  });
});

// --- AUTOMATIONS ---
router.get('/guilds/:guildId/automations', (req: Request, res: Response) => {
  res.json({ automations });
});

router.post('/guilds/:guildId/automations', (req: Request, res: Response) => {
  const newAutomation = {
    id: `auto-${Date.now()}`,
    name: req.body.name || 'New Custom Automation',
    enabled: true,
    runCount: 0,
    trigger: req.body.trigger || { type: 'MEMBER_JOIN', condition: 'Always' },
    actions: req.body.actions || [],
  };
  automations.push(newAutomation);
  res.json({ success: true, automation: newAutomation });
});

// --- TICKETS DEMO ---
let demoTickets = [
  { id: 'TKT-1049', subject: 'VIP Tier Role Missing', department: 'Billing', status: 'OPEN', author: 'NeonViper#0091', createdAt: '10 mins ago' },
  { id: 'TKT-1048', subject: 'Report User for Mass Mention Spam', department: 'Moderation', status: 'CLAIMED', author: 'GlitchMaster#1337', createdAt: '1 hour ago' },
  { id: 'TKT-1047', subject: 'Custom Bot Prefix Question', department: 'General', status: 'CLOSED', author: 'SynthWave#4040', createdAt: '3 hours ago', closedBy: 'Admin (ModSarah)', closedRole: 'admin' },
  { id: 'TKT-1046', subject: 'Discord Role Colors', department: 'General Inquiry', status: 'CLOSED', author: 'CyberPawn#9901', createdAt: '1 day ago', closedBy: 'Person (CyberPawn)', closedRole: 'person' },
];

router.get('/guilds/:guildId/tickets', (req: Request, res: Response) => {
  const { status } = req.query;
  let filtered = demoTickets;
  if (status === 'active') {
    filtered = demoTickets.filter(t => t.status !== 'CLOSED');
  } else if (status === 'closed') {
    filtered = demoTickets.filter(t => t.status === 'CLOSED');
  }
  res.json({ tickets: filtered });
});

router.post('/guilds/:guildId/tickets/:ticketId/close', (req: Request, res: Response) => {
  const { ticketId } = req.params;
  const { closedByRole, closedByName } = req.body;

  const ticket = demoTickets.find(t => t.id === ticketId);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  const role = closedByRole === 'admin' ? 'admin' : 'person';
  const label = role === 'admin' ? `Admin (${closedByName || 'Staff'})` : `Person (${closedByName || ticket.author})`;

  ticket.status = 'CLOSED';
  (ticket as any).closedBy = label;
  (ticket as any).closedRole = role;

  res.json({
    success: true,
    message: `Ticket ${ticketId} closed by ${role === 'admin' ? 'Admin' : 'Person'}`,
    ticket
  });
});

export default router;

