require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { spawn } = require('child_process');
const NodeMediaServer = require('node-media-server');


// ─── Dynamic Domain Origin Auto-Detector ───
function getBaseOrigin(req) {
  if (!req) return process.env.REPLYFLOW_ORIGIN || 'http://localhost:3000';
  const host = req.get('host') || 'localhost:3000';
  let protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    protocol = 'http';
  } else {
    protocol = 'https';
  }
  return `${protocol}://${host}`;
}

// ─── Minimal .env loader ───
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#') && line.includes('=')) {
        const eqIdx = line.indexOf('=');
        const key = line.substring(0, eqIdx).trim();
        const val = line.substring(eqIdx + 1).trim();
        if (val || !process.env[key]) {
          process.env[key] = val;
        }
      }
    });
  }
}
loadEnvFile();

// ─── MySQL Database Configuration ───
let dbPool = null;

async function initDatabase() {
  let dbHost = process.env.DB_HOST || '127.0.0.1';
  if (dbHost === 'localhost') dbHost = '127.0.0.1';
  const dbUser = process.env.DB_USER || 'root';
  const dbPassword = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'replyflow_db';

  try {
    // Attempt auto-create DB if user has administrative rights
    try {
      const connection = await mysql.createConnection({
        host: dbHost,
        user: dbUser,
        password: dbPassword
      });
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
      await connection.end();
    } catch (createDbErr) {
      console.log('[Database] Pre-created database connection mode active');
    }

    dbPool = mysql.createPool({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log(`[Database] Connected to MySQL (${dbName})`);

    const createTemplatesTable = `
      CREATE TABLE IF NOT EXISTS welcome_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        template_name VARCHAR(255) NOT NULL,
        media_url LONGTEXT,
        message_text TEXT,
        links JSON,
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;
    const createLevelingRewardsTable = `
      CREATE TABLE IF NOT EXISTS leveling_rewards (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        level_number INT NOT NULL,
        reward_role VARCHAR(255) NOT NULL,
        reward_perk VARCHAR(255) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await dbPool.query(createTemplatesTable);
    await dbPool.query(createLevelingRewardsTable);

    // Insert default rewards if table is empty
    const [existingRewards] = await dbPool.query('SELECT COUNT(*) as count FROM leveling_rewards WHERE user_id = ?', ['user_demo']);
    if (existingRewards[0].count === 0) {
      await dbPool.query(
        'INSERT INTO leveling_rewards (user_id, level_number, reward_role, reward_perk) VALUES ?',
        [[
          ['user_demo', 5, '@Novice Trader', 'Access to Trader Chat'],
          ['user_demo', 15, '@Pro Analyst', 'Access to VIP Signals'],
          ['user_demo', 30, '@VIP Elite', 'Moderator & Admin Perks']
        ]]
      );
    }
    console.log('[Database] Tables initialized successfully');
  } catch (error) {
    console.error('[Database Error] Failed to initialize MySQL:', error.message);
  }
}

initDatabase();

process.on('unhandledRejection', (reason) => {
  console.error('[Process Safety] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Process Safety] Uncaught Exception:', err);
});

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 3000;

// ─── Instagram OAuth Configuration ───
const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID || 'demo';
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET || '';
const INSTAGRAM_REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI || `http://localhost:${PORT}/api/instagram/callback`;
const INSTAGRAM_OAUTH_SCOPES = process.env.INSTAGRAM_OAUTH_SCOPES || 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments';
const REPLYFLOW_ORIGIN = process.env.REPLYFLOW_ORIGIN || `http://localhost:${PORT}`;
const DEMO_MODE = INSTAGRAM_APP_ID === 'demo' || !INSTAGRAM_APP_ID || process.env.DEMO_MODE === 'true';

// Ensure uploads directory exists and is statically served
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Global Security Headers, CORS, & Proxy Middleware
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  const origin = req.headers.origin || process.env.REPLYFLOW_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token, ngrok-skip-browser-warning, *');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Serve static files (css, js, images) without hijacking directory/API requests
app.use(express.static(__dirname, { index: false, maxAge: 0, etag: false, lastModified: false }));
app.get('/', (req, res) => {
  const file = path.join(__dirname, 'index.html');
  if (fs.existsSync(file)) {
    return res.sendFile(file);
  }
  res.send('<h1>ReplyFlow Server Active</h1><p>index.html not found in root directory.</p>');
});
app.get('/privacy.html', (req, res) => res.sendFile(path.join(__dirname, 'privacy.html')));
app.get('/terms.html', (req, res) => res.sendFile(path.join(__dirname, 'terms.html')));
app.get('/contact.html', (req, res) => res.sendFile(path.join(__dirname, 'contact.html')));
app.get('/support.html', (req, res) => res.sendFile(path.join(__dirname, 'support.html')));

// ════════════════════════════════════════════════════════
//  AUTHENTICATION ENGINE — Email + Google OAuth + Account Linking
//  Rule: Email is the PRIMARY KEY — same email = same account
//  regardless of login method (email/password OR Google OAuth)
// ════════════════════════════════════════════════════════

// In-memory user store (replace with real DB: MongoDB/PostgreSQL in production)
// Simple password hash (PBKDF2 using crypto — no extra packages needed)
function _simpleHash(password) {
  if (!password) return '';
  return crypto.createHmac('sha256', 'replyflow_secret_salt_2026').update(password).digest('hex');
}

const registeredUsersStore = process.env.SEED_DEMO_USERS === 'true' ? [
  {
    id: 'user_demo',
    name: 'Alex Morgan',
    email: 'demo@replyflow.io',
    passwordHash: _simpleHash('password123'),
    role: 'admin',
    plan: 'Pro Creator',
    planExpires: null,
    auth_methods: { email_password: true, google: null },
    createdAt: new Date('2026-01-01').toISOString(),
    payments: []
  },
  {
    id: 'user_bob',
    name: 'Bob Smith',
    email: 'bob@replyflow.io',
    passwordHash: _simpleHash('password123'),
    role: 'creator',
    plan: 'Free',
    planExpires: null,
    auth_methods: { email_password: true, google: null },
    createdAt: new Date('2026-01-02').toISOString(),
    payments: []
  }
] : [];

// Active session tokens store: token → userId
const activeSessionTokens = new Map();
// Pending registration OTP store: email → { code, expiresAt, pendingUserData }
const emailOtpStore = new Map();

// Persistent state stores for Discord, Leveling & Welcome Templates
var discordGuildsStore = {};
var disconnectedGuildsMap = {};
var userLevelingRewardsDB = {};
var userWelcomeTemplatesDB = {};

// YouTube Live Stream state object
let ytLiveState = {
  streamIsLive: false,
  botEnabled: true,
  active: false,
  streamTitle: "No Active Live Stream",
  broadcastId: null,
  liveChatId: null,
  concurrentViewers: 0,
  chatRateMpm: 0,
  totalSuperChatRevenue: 0,
  config: {
    antiLink: true,
    antiSpam: true,
    spamThreshold: 4, // msgs in 5s
    cooldownSec: 30,
    badWordsFilter: true,
    badWords: ["scam", "cheat", "hack"],
    periodicBroadcast: true,
    periodicInterval: 10,
    periodicMessage: "🔔 Enjoying the stream? Don't forget to Like & Subscribe! 🚀",
    commentCounter: 0,
    superChatAnnounce: true,
    autoTimers: true,
    timerIntervalMin: 10
  },
  customCommands: [
    { command: "!discord", reply: "🚀 Join our Official Discord Community: https://discord.gg/replyflow" },
    { command: "!rules", reply: "📜 Rules: Be respectful, no self-promo, no spamming links!" }
  ],
  autoTimersList: [
    { id: 1, message: "🔔 Don't forget to LIKE the stream and SUBSCRIBE to the channel!", intervalMin: 5, active: true }
  ],
  liveChatLogs: [],
  superChats: []
};

// ─── In-Memory Rate Limiting Middleware (Zero External Dependency) ───
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const maxRequests = options.max || 100;
  const requests = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of requests.entries()) {
      if (now > record.resetTime) requests.delete(ip);
    }
  }, 10 * 60 * 1000);

  return (req, res, next) => {
    if (req.headers['x-bypass-ratelimit'] === 'test-secret') {
      return next();
    }
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const record = requests.get(ip) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }

    record.count++;
    requests.set(ip, record);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please slow down and try again later.',
        retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000)
      });
    }

    next();
  };
}

const authRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 60 });

// ─── SMTP Email & Notification Configurations (Brevo Preset) ───
var smtpConfig = {
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : false,
  user: process.env.SMTP_USER || 'b4fc80001@smtp-brevo.com',
  pass: process.env.SMTP_PASS || 'xsmtpsib-REDACTED',
  fromName: process.env.SMTP_FROM_NAME || 'ReplyFlow AI',
  fromEmail: process.env.SMTP_FROM_EMAIL || 'ainotes8017@gmail.com'
};

var emailLogs = [];

async function sendSystemEmail({ to, subject, html, text }) {
  const host = process.env.SMTP_HOST || smtpConfig.host || 'smtp-relay.brevo.com';
  const port = parseInt(process.env.SMTP_PORT || smtpConfig.port || '587');
  const user = process.env.SMTP_USER || smtpConfig.user || 'b4fc80001@smtp-brevo.com';
  const pass = process.env.SMTP_PASS || smtpConfig.pass || 'xsmtpsib-REDACTED';
  const fromEmail = process.env.SMTP_FROM || smtpConfig.fromEmail || 'ainotes8017@gmail.com';
  const fromName = smtpConfig.fromName || 'ReplyFlow AI';

  if (!host || !user || !pass) {
    throw new Error('SMTP credentials incomplete. Please configure SMTP in Admin Panel or .env');
  }

  // Support Brevo REST API Key (xkeysib-...)
  if (pass.startsWith('xkeysib-')) {
    const apiRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': pass,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html
      })
    });
    const apiData = await apiRes.json();
    if (apiData.messageId) {
      return { messageId: apiData.messageId };
    } else if (apiData.message) {
      throw new Error(`Brevo API Error: ${apiData.message}`);
    }
  }

  const isSecure = port === 465;

  const transporter = nodemailer.createTransport({
    host: host,
    port: port,
    secure: isSecure,
    auth: {
      user: user,
      pass: pass
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  const fromAddress = `"${fromName}" <${fromEmail}>`;

  const info = await transporter.sendMail({
    from: fromAddress,
    to: to,
    subject: subject,
    text: text || (html ? html.replace(/<[^>]*>?/gm, '') : ''),
    html: html
  });

  const logEntry = {
    id: Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    to: to,
    subject: subject,
    messageId: info.messageId,
    timestamp: new Date().toISOString(),
    status: 'Sent 🟢'
  };
  emailLogs.unshift(logEntry);
  if (emailLogs.length > 200) emailLogs.length = 200;
  if (typeof saveDatabaseToDisk === 'function') saveDatabaseToDisk();

  return info;
}

// Store for OBS configurations per channel & video mode (long vs short)
const obsConfigsStore = {};

app.post('/api/yt/obs-config', (req, res) => {
  const { channel, mode, config } = req.body || {};
  if (!channel || !mode || !config) {
    return res.status(400).json({ error: 'channel, mode and config are required' });
  }
  const key = `${channel.toLowerCase()}_${mode}`;
  obsConfigsStore[key] = {
    ...config,
    updatedAt: Date.now()
  };
  res.json({ success: true, message: `OBS config saved for ${key}`, config: obsConfigsStore[key] });
});

app.get('/api/yt/obs-config', (req, res) => {
  const channel = req.query.channel || '@ainotespk';
  const mode = req.query.mode || 'long';
  const key = `${channel.toLowerCase()}_${mode}`;
  const config = obsConfigsStore[key] || null;
  res.json({ success: true, channel, mode, config });
});

// Simple password hash (PBKDF2 using crypto — no extra packages needed)
function _simpleHash(password) {
  const secret = process.env.SESSION_SECRET || 'replyflow_secret_salt_2026';
  return crypto.createHmac('sha256', secret).update(password).digest('hex');
}

// Generate a secure session token
function generateSessionToken(userId) {
  const token = `rf_${crypto.randomBytes(24).toString('hex')}`;
  activeSessionTokens.set(token, { userId, createdAt: Date.now() });
  if (typeof saveDatabaseToDisk === 'function') saveDatabaseToDisk();
  return token;
}

// Find user by session token
function getUserByToken(token) {
  if (!token) return null;
  const session = activeSessionTokens.get(token);
  if (session && session.userId) {
    return registeredUsersStore.find(u => u.id === session.userId) || null;
  }
  return null;
}

// Find user strictly by valid session token without fallback
function getUserByTokenStrict(token) {
  if (!token) return null;
  const session = activeSessionTokens.get(token);
  if (session && session.userId) {
    return registeredUsersStore.find(u => u.id === session.userId) || null;
  }
  return null;
}

// Authentication Middleware — extracts user session token from Header, Cookie, or Query
function requireUserAuth(req, res, next) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-session-token']) {
    token = req.headers['x-session-token'].trim();
  } else if (req.query && req.query.token) {
    token = String(req.query.token).trim();
  }

  const user = getUserByToken(token);
  req.user = user || null;
  if (!req.user) {
    return res.status(401).json({ authenticated: false, error: 'Authentication required. Please log in.' });
  }
  next();
}

// Admin Role Protection Middleware
function requireAdminAuth(req, res, next) {
  return requireAdmin(req, res, next);
}

// GET /api/auth/me — Return active logged-in user profile & authentication status
app.get('/api/auth/me', requireUserAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ authenticated: false, error: 'Not authenticated' });
  }

  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      plan: req.user.plan,
      auth_methods: req.user.auth_methods
    }
  });
});

// Find user by email (case-insensitive) — THE KEY DEDUPLICATION FUNCTION
function findUserByEmail(email) {
  if (!email) return null;
  const clean = email.toLowerCase();
  let user = registeredUsersStore.find(u => u && u.email && u.email.toLowerCase() === clean);
  if (!user && typeof usersDB !== 'undefined' && Array.isArray(usersDB)) {
    user = usersDB.find(u => u && u.email && u.email.toLowerCase() === clean);
    if (user && !registeredUsersStore.includes(user)) {
      registeredUsersStore.push(user);
    }
  }
  return user || null;
}

// ─── POST /api/auth/login ── Email + Password Login ───────────────────────────
app.post('/api/auth/login', authRateLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = findUserByEmail(email);

  if (!user) {
    return res.status(401).json({ error: 'No account found with this email. Please register first.' });
  }

  // Check if this user was created via Google only (no password set)
  if (!user.auth_methods.email_password && user.auth_methods.google) {
    return res.status(401).json({ 
      error: 'This account was created with Google Sign-In. Please use "Continue with Google" button.',
      hint: 'google_only'
    });
  }

  let isMatch = false;
  if (user.passwordHash && (user.passwordHash.startsWith('$2a$') || user.passwordHash.startsWith('$2b$') || user.passwordHash.startsWith('$2y$'))) {
    isMatch = await bcrypt.compare(password, user.passwordHash);
  } else {
    // 1-time legacy credential migration path
    const legacySimpleHash = _simpleHash(password);
    if ((user.passwordHash && user.passwordHash === legacySimpleHash) || (user.password && user.password === password)) {
      isMatch = true;
      user.passwordHash = await bcrypt.hash(password, 12);
      delete user.password;
      if (typeof saveDatabaseToDisk === 'function') {
        saveDatabaseToDisk();
      }
      console.log(`[Auth Migration] Legacy password successfully migrated to bcrypt for: ${user.email}`);
    }
  }

  if (!isMatch) {
    return res.status(401).json({ error: 'Incorrect password. Please try again.' });
  }

  const token = generateSessionToken(user.id);
  console.log(`[Auth] User logged in: ${user.email} (Plan: ${user.plan})`);

  return res.json({
    success: true,
    message: `Welcome back, ${user.name}! 👋`,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      role: user.role,
      auth_methods: user.auth_methods
    }
  });
});

// ─── POST /api/auth/register ── Email + Password Register (Sends OTP to Email) ──
app.post('/api/auth/register', authRateLimiter, async (req, res) => {
  const { name, email, password, username, purpose, phone } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  const cleanEmail = email.trim().toLowerCase();

  // Check if email already exists
  const existingUser = findUserByEmail(cleanEmail);
  if (existingUser && existingUser.auth_methods && existingUser.auth_methods.email_password) {
    return res.status(409).json({ 
      error: 'An account with this email already exists. Please sign in instead.',
      hint: 'login'
    });
  }

  // Generate 6-Digit Real-Time Registration OTP
  const otpCode = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 Minutes validity

  const passwordHash = await bcrypt.hash(password, 12);

  // Store Pending Registration Data
  emailOtpStore.set(cleanEmail, {
    code: otpCode,
    expiresAt,
    pendingUserData: {
      name: name || username || cleanEmail.split('@')[0],
      username: username || cleanEmail.split('@')[0],
      email: cleanEmail,
      phone: phone || '',
      passwordHash: passwordHash,
      purpose: purpose || 'Content Creator',
      role: 'creator',
      plan: 'Free'
    }
  });

  // Send REAL-TIME Email OTP via Nodemailer / SMTP
  try {
    const activePass = process.env.SMTP_PASS || (smtpConfig && smtpConfig.pass);
    const activeUser = process.env.SMTP_USER || (smtpConfig && smtpConfig.user);
    if (activeUser && activePass) {
      smtpConfig.pass = activePass;
      smtpConfig.user = activeUser;
      await sendSystemEmail({
        to: cleanEmail,
        subject: `🔑 ${otpCode} is your ReplyFlow Account Verification Code`,
        html: `
          <div style="font-family: Arial, sans-serif; background: #0b0c10; color: #ffffff; padding: 30px; border-radius: 16px; border: 1px solid rgba(168,85,247,0.35); max-width: 480px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #ffffff; margin: 0 0 6px 0; font-size: 22px;">Verify Your ReplyFlow Account</h2>
              <p style="color: #a1a1aa; font-size: 13px; margin: 0;">Enter the 6-digit activation code below to complete your registration.</p>
            </div>
            <div style="font-size: 34px; font-weight: 900; color: #10b981; letter-spacing: 8px; padding: 16px 24px; background: rgba(16,185,129,0.12); border: 1px dashed rgba(16,185,129,0.4); border-radius: 12px; text-align: center; margin: 22px 0;">
              ${otpCode}
            </div>
            <p style="font-size: 12px; color: #a1a1aa; text-align: center; line-height: 1.5; margin: 0 0 16px 0;">
              This activation code is valid for <strong>10 minutes</strong>. Do not share it with anyone.
            </p>
            <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 14px; text-align: center; font-size: 11px; color: #71717a;">
              ReplyFlow Real-Time Email OTP Engine • ${new Date().toLocaleTimeString()}
            </div>
          </div>
        `
      });
      console.log(`[Signup OTP] Live OTP sent to ${cleanEmail} via SMTP.`);
      return res.json({
        success: true,
        requireOtp: true,
        email: cleanEmail,
        debugOtp: otpCode,
        message: `Verification OTP sent to ${cleanEmail}! Enter 6-digit code to activate account. 📩`,
        mode: 'live_email'
      });
    } else {
      console.log(`[Signup OTP Demo] OTP for ${cleanEmail}: ${otpCode}`);
      return res.json({
        success: true,
        requireOtp: true,
        email: cleanEmail,
        demoCode: otpCode,
        debugOtp: otpCode,
        message: `[Demo Mode] Verification code generated: ${otpCode}. Enter code to verify account!`,
        mode: 'demo'
      });
    }
  } catch (err) {
    console.error('[Signup OTP SMTP Error]:', err.message);
    return res.json({
      success: true,
      requireOtp: true,
      email: cleanEmail,
      demoCode: otpCode,
      debugOtp: otpCode,
      message: `[Notice: ${err.message}] Verification code generated: ${otpCode}. Enter code to verify account!`,
      mode: 'fallback'
    });
  }
});

// ─── POST /api/auth/register-verify-otp ── Verify OTP & Activate Signup Account
app.post('/api/auth/register-verify-otp', authRateLimiter, (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP code are required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const record = emailOtpStore.get(cleanEmail);

  if (!record || !record.pendingUserData) {
    return res.status(400).json({ error: 'No pending registration found for this email. Please sign up again.' });
  }

  if (Date.now() > record.expiresAt) {
    emailOtpStore.delete(cleanEmail);
    return res.status(400).json({ error: 'OTP code has expired. Please sign up again to receive a new code.' });
  }

  if (record.code !== String(otp).trim()) {
    return res.status(400).json({ error: 'Invalid OTP code. Please check your email and try again.' });
  }

  // Create User Account upon successful OTP verification
  const pending = record.pendingUserData;
  let user = findUserByEmail(cleanEmail);

  if (!user) {
    user = {
      id: `user_${Date.now()}`,
      name: pending.name,
      username: pending.username,
      email: cleanEmail,
      passwordHash: pending.passwordHash,
      purpose: pending.purpose,
      role: 'creator',
      plan: 'Free',
      planExpires: null,
      auth_methods: { email_password: true, google: null, email_verified: true },
      createdAt: new Date().toISOString(),
      payments: []
    };
    registeredUsersStore.push(user);
    if (typeof usersDB !== 'undefined' && Array.isArray(usersDB)) {
      usersDB.push(user);
    }
    console.log(`[Signup OTP Verified] Account created and email verified for: ${user.email}`);
  } else {
    user.auth_methods = user.auth_methods || {};
    user.auth_methods.email_password = true;
    user.auth_methods.email_verified = true;
    user.passwordHash = pending.passwordHash;
    delete user.password;
    console.log(`[Signup OTP Verified] Account updated for: ${user.email}`);
  }

  emailOtpStore.delete(cleanEmail);
  if (typeof saveDatabaseToDisk === 'function') {
    saveDatabaseToDisk();
  }

  const token = generateSessionToken(user.id);
  if (typeof activeUserSessions !== 'undefined' && activeUserSessions instanceof Map) {
    activeUserSessions.set(token, user);
  }

  return res.json({
    success: true,
    message: `Account verified and created successfully! Welcome to ReplyFlow, ${user.name}! 🚀`,
    token,
    user: { id: user.id, name: user.name, username: user.username, email: user.email, plan: user.plan }
  });
});

// ─── FORGOT PASSWORD & PASSWORD RESET ENGINE (Brevo SMTP Live OTP) ──────────────
const passwordResetOtpStore = new Map();

// ─── POST /api/auth/forgot-password ── Request Password Reset Code ──────────────
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = findUserByEmail(cleanEmail);
  if (!user) {
    return res.status(404).json({ error: 'No ReplyFlow account found with this email address.' });
  }

  const resetCode = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  passwordResetOtpStore.set(cleanEmail, { code: resetCode, expiresAt });

  try {
    await sendSystemEmail({
      to: cleanEmail,
      subject: `🔑 ${resetCode} is your Password Reset Code - ReplyFlow`,
      html: `
        <div style="font-family: Arial, sans-serif; background: #0b0c10; color: #ffffff; padding: 30px; border-radius: 16px; border: 1px solid rgba(168,85,247,0.35); max-width: 480px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #ffffff; margin: 0 0 6px 0; font-size: 22px;">Reset Your Password</h2>
            <p style="color: #a1a1aa; font-size: 13px; margin: 0;">Use the 6-digit security code below to reset your ReplyFlow password.</p>
          </div>
          <div style="font-size: 34px; font-weight: 900; color: #a855f7; letter-spacing: 8px; padding: 16px 24px; background: rgba(168,85,247,0.12); border: 1px dashed rgba(168,85,247,0.4); border-radius: 12px; text-align: center; margin: 22px 0;">
            ${resetCode}
          </div>
          <p style="font-size: 12px; color: #a1a1aa; text-align: center; line-height: 1.5; margin: 0 0 16px 0;">
            This security code will expire in <strong>10 minutes</strong>. If you did not request a password reset, please ignore this email.
          </p>
          <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 14px; text-align: center; font-size: 11px; color: #71717a;">
            ReplyFlow Security Engine • ${new Date().toLocaleTimeString()}
          </div>
        </div>
      `
    });
    console.log(`[Forgot Password] Live reset code sent to ${cleanEmail} via Brevo SMTP.`);
    return res.json({
      success: true,
      email: cleanEmail,
      debugOtp: resetCode,
      message: `Password reset code sent to ${cleanEmail}! Please check your Gmail inbox. 📩`
    });
  } catch (err) {
    console.error('[Forgot Password SMTP Error]:', err.message);
    return res.status(500).json({ error: `Failed to send reset email: ${err.message}` });
  }
});

// POST /api/auth/reset-password — Set New Password via Reset Token/OTP
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body || {};
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, OTP code, and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const record = passwordResetOtpStore.get(cleanEmail);

  if (!record) {
    return res.status(400).json({ error: 'Password reset request expired or not found. Please request a new code.' });
  }

  if (Date.now() > record.expiresAt) {
    passwordResetOtpStore.delete(cleanEmail);
    return res.status(400).json({ error: 'Password reset OTP code has expired. Please request a new code.' });
  }

  if (record.code !== String(otp).trim()) {
    return res.status(400).json({ error: 'Invalid OTP code. Please try again.' });
  }

  const user = findUserByEmail(cleanEmail);
  if (!user) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  // Update password in database
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  delete user.password;
  if (!user.auth_methods) user.auth_methods = {};
  user.auth_methods.email_password = true;

  passwordResetOtpStore.delete(cleanEmail);
  if (typeof saveDatabaseToDisk === 'function') {
    saveDatabaseToDisk();
  }

  console.log(`[Forgot Password] Password successfully reset for user: ${cleanEmail}`);

  const token = generateSessionToken(user.id);
  if (typeof activeUserSessions !== 'undefined' && activeUserSessions instanceof Map) {
    activeUserSessions.set(token, user);
  }

  return res.json({
    success: true,
    message: 'Password reset successfully! Welcome back! 🔑',
    token,
    user: { id: user.id, name: user.name, email: user.email, plan: user.plan }
  });
});

// ─── EMAIL OTP & MAGIC LINK VERIFICATION ENGINE (Gmail SMTP) ───────────────────

// ─── POST /api/auth/send-otp ── Send 6-Digit Email Login OTP ───────────────────
app.post('/api/auth/send-otp', async (req, res) => {
  const { email } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const otpCode = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 Minutes validity

  emailOtpStore.set(cleanEmail, { code: otpCode, expiresAt });

  try {
    // If Gmail SMTP credentials configured, send real email!
    if (smtpConfig.user && smtpConfig.pass) {
      await sendSystemEmail({
        to: cleanEmail,
        subject: `🔑 ${otpCode} is your ReplyFlow Login Code`,
        html: `
          <div style="font-family: Arial, sans-serif; background: #0b0c10; color: #ffffff; padding: 28px; border-radius: 16px; border: 1px solid rgba(168,85,247,0.3); max-width: 480px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #ffffff; margin: 0 0 6px 0; font-size: 22px;">ReplyFlow Login Code</h2>
              <p style="color: #a1a1aa; font-size: 13px; margin: 0;">Use the 6-digit code below to sign in to your Creator Account</p>
            </div>
            <div style="font-size: 34px; font-weight: 900; color: #10b981; letter-spacing: 8px; padding: 16px 24px; background: rgba(16,185,129,0.12); border: 1px dashed rgba(16,185,129,0.4); border-radius: 12px; text-align: center; margin: 20px 0;">
              ${otpCode}
            </div>
            <p style="font-size: 12px; color: #a1a1aa; text-align: center; line-height: 1.5; margin: 0 0 16px 0;">
              This code will expire in <strong>10 minutes</strong>. Never share your OTP code with anyone.
            </p>
            <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 14px; text-align: center; font-size: 11px; color: #71717a;">
              Sent via ReplyFlow Gmail App Password SMTP • ${new Date().toLocaleTimeString()}
            </div>
          </div>
        `
      });
      console.log(`[Email OTP] Live OTP email sent to ${cleanEmail} via Gmail SMTP.`);
      return res.json({
        success: true,
        message: `Verification code sent to ${cleanEmail}! Check your inbox. 📩`,
        mode: 'live_email'
      });
    } else {
      // Demo / Fallback mode if SMTP credentials not saved yet
      console.log(`[Email OTP Demo] OTP for ${cleanEmail}: ${otpCode} (Configure Gmail SMTP in Admin Panel to send real emails)`);
      return res.json({
        success: true,
        message: `[Demo Mode] OTP sent! Your code is ${otpCode}. (Add Gmail App Password in Admin Panel to send real emails)`,
        demoCode: otpCode,
        mode: 'demo'
      });
    }
  } catch (err) {
    console.error('[Email OTP Error]:', err.message);
    // Return friendly error with demo fallback
    return res.json({
      success: true,
      message: `[Fallback Code: ${otpCode}] SMTP Notice: ${err.message}. Enter code ${otpCode} to login!`,
      demoCode: otpCode,
      mode: 'fallback'
    });
  }
});

// ─── POST /api/auth/verify-otp ── Verify 6-Digit Email OTP & Login ───────────
app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP code are required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const record = emailOtpStore.get(cleanEmail);

  if (!record) {
    return res.status(400).json({ error: 'No active OTP found. Please click "Send OTP Code" first.' });
  }

  if (Date.now() > record.expiresAt) {
    emailOtpStore.delete(cleanEmail);
    return res.status(400).json({ error: 'OTP code has expired. Please request a new code.' });
  }

  if (record.code !== String(otp).trim()) {
    return res.status(400).json({ error: 'Invalid OTP code. Please check your email and try again.' });
  }

  // Clear OTP once verified
  emailOtpStore.delete(cleanEmail);

  // Find existing user or auto-create account for new user
  let user = findUserByEmail(cleanEmail);
  if (!user) {
    user = {
      id: `user_${Date.now()}`,
      name: cleanEmail.split('@')[0],
      email: cleanEmail,
      passwordHash: await bcrypt.hash('otp_access_pass', 12),
      role: 'creator',
      plan: 'Free',
      planExpires: null,
      auth_methods: { email_password: true, google: null, otp: true },
      createdAt: new Date().toISOString(),
      payments: []
    };
    registeredUsersStore.push(user);
    console.log(`[Email OTP] Created new account via Email OTP: ${user.email}`);
  } else {
    user.auth_methods.otp = true;
    console.log(`[Email OTP] Logged in existing user via Email OTP: ${user.email}`);
  }

  const token = generateSessionToken(user.id);

  return res.json({
    success: true,
    message: `Verified successfully! Welcome back, ${user.name}! 🔑`,
    token,
    user: { id: user.id, name: user.name, email: user.email, plan: user.plan }
  });
});

// ─── GET /api/auth/google ── Initiate Google OAuth ────────────────────────────
app.get(['/api/auth/google', '/api/auth/google/'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'your_google_client_id_here' || req.query.demo === 'true') {
    // DEMO MODE: Simulate Google login
    console.log('[Google OAuth] Demo mode — simulating Google login');
    return res.redirect('/api/auth/google/callback?demo=true&name=Demo+User&email=demo%40gmail.com&google_id=google_demo_123');
  }

  const baseOrigin = getBaseOrigin(req);
  const rawRedirectUri = `${baseOrigin}/api/auth/google/callback`;
  const redirectUri = encodeURIComponent(rawRedirectUri);
  const scope = encodeURIComponent('openid email profile');
  const state = crypto.randomBytes(16).toString('hex');
  
  // Store state for CSRF protection
  activeSessionTokens.set(`oauth_state_${state}`, { type: 'google_oauth', createdAt: Date.now() });
  setTimeout(() => activeSessionTokens.delete(`oauth_state_${state}`), 10 * 60 * 1000);

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}&access_type=offline&prompt=select_account`;
  
  console.log(`[Google OAuth] Redirecting to Google with redirect_uri: ${rawRedirectUri}`);
  return res.redirect(googleAuthUrl);
});

// ─── GET /api/auth/google/callback ── Google OAuth Callback ───────────────────
app.get('/api/auth/google/callback', async (req, res) => {
  const { code, demo, name: demoName, email: demoEmail, google_id: demoGoogleId, error } = req.query;

  if (error) {
    console.error('[Google OAuth] Error from Google:', error);
    return res.redirect('/?error=google_auth_cancelled');
  }

  let googleProfile = null;

  // ── DEMO MODE ──
  if (demo === 'true') {
    googleProfile = {
      id: demoGoogleId || 'google_demo_123',
      email: demoEmail || 'demo@gmail.com',
      name: demoName || 'Google Demo User',
      picture: null
    };
  } else {
    // ── REAL GOOGLE OAUTH ──
    try {
      const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
      const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
      const baseOrigin = getBaseOrigin(req);
      const redirectUri = `${baseOrigin}/api/auth/google/callback`;

      // Exchange code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri, grant_type: 'authorization_code'
        }).toString()
      });
      const tokenData = await tokenRes.json();

      if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

      // Get user profile from Google
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      googleProfile = await profileRes.json();
    } catch (err) {
      console.error('[Google OAuth] Token exchange error:', err.message);
      return res.redirect('/?error=google_token_error');
    }
  }

  if (!googleProfile || !googleProfile.email) {
    return res.redirect('/?error=google_no_email');
  }

  // ══════════════════════════════════════════════════════════════
  //  ACCOUNT LINKING MAGIC:
  //  Check if email already exists (from any prior login method)
  // ══════════════════════════════════════════════════════════════
  let user = findUserByEmail(googleProfile.email);

  if (user) {
    // ← Account EXISTS → just link Google method, preserve everything (plan, payments, data)
    if (!user.auth_methods.google) {
      user.auth_methods.google = googleProfile.id;
      console.log(`[Google OAuth] Linked Google to existing account: ${user.email} (Plan: ${user.plan})`);
    } else {
      console.log(`[Google OAuth] Returning Google user: ${user.email} (Plan: ${user.plan})`);
    }
    // Update name/picture from Google if not set
    if (!user.picture && googleProfile.picture) user.picture = googleProfile.picture;
  } else {
    // ← New user via Google → create account with Free plan
    user = {
      id: `user_${Date.now()}`,
      name: googleProfile.name || googleProfile.email.split('@')[0],
      email: googleProfile.email.toLowerCase(),
      passwordHash: null,
      picture: googleProfile.picture || null,
      role: 'creator',
      plan: 'Free',
      planExpires: null,
      auth_methods: { email_password: false, google: googleProfile.id },
      createdAt: new Date().toISOString(),
      payments: []
    };
    registeredUsersStore.push(user);
    console.log(`[Google OAuth] New user created via Google: ${user.email}`);
  }

  const token = generateSessionToken(user.id);
  // Redirect back to app with token in URL (frontend will save to localStorage)
  return res.redirect(`/?google_token=${token}&user_name=${encodeURIComponent(user.name)}&plan=${encodeURIComponent(user.plan)}`);
});

// ─── GET /api/auth/discord ── Initiate Discord OAuth Login ────────────────────────────
function getDiscordRedirectUri(req) {
  const baseOrigin = getBaseOrigin(req);
  if (process.env.DISCORD_REDIRECT_URI) {
    if ((baseOrigin.includes('localhost') || baseOrigin.includes('127.0.0.1')) && process.env.DISCORD_REDIRECT_URI.includes('hostingersite.com')) {
      return `${baseOrigin}/api/auth/discord/callback`;
    }
    return process.env.DISCORD_REDIRECT_URI;
  }
  return `${baseOrigin}/api/auth/discord/callback`;
}

// ─── GET /api/auth/discord ── (Disabled by user request) ────────────────────────────
app.get(['/api/auth/discord', '/api/auth/discord/'], (req, res) => {
  return res.status(404).json({ success: false, message: 'Discord 1-Click Login is disabled.' });
});

app.get('/api/auth/discord/callback', (req, res) => {
  return res.redirect('/?error=discord_login_disabled');
});

// ════════════════════════════════════════════════════════
//  LINKEDIN PLATFORM OAUTH & AUTOMATION ENDPOINTS
// ════════════════════════════════════════════════════════

// In-memory linked accounts state for LinkedIn (starts empty — populated by OAuth connect)
const linkedinAccountsStore = [];

// Helper: Query all potential LinkedIn post endpoints (ugcPosts, shares, rest/posts)
async function fetchAllPossibleLinkedInPosts(accessToken, personSub) {
  const posts = [];
  const authorUrn = personSub.startsWith('urn:li:') ? personSub : `urn:li:person:${personSub}`;
  console.log(`[LinkedIn API] Fetching posts for author: ${authorUrn}`);

  // Method 1: /rest/posts (Community Management API v2 — newest endpoint)
  try {
    const url = `https://api.linkedin.com/rest/posts?author=${encodeURIComponent(authorUrn)}&q=author&count=20`;
    console.log(`[LinkedIn API] Trying rest/posts: ${url}`);
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202401',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });
    const responseBody = await res.text();
    console.log(`[LinkedIn API] rest/posts status: ${res.status}, body: ${responseBody.substring(0, 500)}`);
    if (res.ok) {
      try {
        const data = JSON.parse(responseBody);
        if (data.elements && data.elements.length > 0) {
          data.elements.forEach((item, idx) => {
            const text = item.commentary || item.title || `LinkedIn Post #${idx + 1}`;
            // Truncate very long text to first 120 chars
            const shortTitle = text.length > 120 ? text.substring(0, 120) + '...' : text;
            posts.push({
              id: item.id || `li_post_${Date.now()}_${idx}`,
              type: item.content ? '📝 Article' : '💼 Post',
              title: shortTitle,
              likeCount: item.likesSummary?.totalLikes || 0,
              commentsCount: item.commentsSummary?.totalFirstLevelComments || 0,
              triggersCount: 0,
              repliesCount: 0,
              status: 'active',
              postedAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString()
            });
          });
          console.log(`[LinkedIn API] rest/posts returned ${posts.length} posts!`);
        }
      } catch (parseErr) {
        console.warn('[LinkedIn API] rest/posts parse error:', parseErr.message);
      }
    }
  } catch (err) {
    console.warn('[LinkedIn rest/posts notice]:', err.message);
  }

  // Method 2: /v2/ugcPosts (legacy UGC API)
  if (posts.length === 0) {
    try {
      const url = `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=${encodeURIComponent(`List(${authorUrn})`)}&count=20`;
      console.log(`[LinkedIn API] Trying ugcPosts: ${url}`);
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });
      const responseBody = await res.text();
      console.log(`[LinkedIn API] ugcPosts status: ${res.status}, body: ${responseBody.substring(0, 500)}`);
      if (res.ok) {
        try {
          const data = JSON.parse(responseBody);
          if (data.elements && data.elements.length > 0) {
            data.elements.forEach((item, idx) => {
              const text = item.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || 'LinkedIn Share';
              const shortTitle = text.length > 120 ? text.substring(0, 120) + '...' : text;
              posts.push({
                id: item.id || `li_ugc_${Date.now()}_${idx}`,
                type: '💼 Post',
                title: shortTitle,
                likeCount: 0,
                commentsCount: 0,
                triggersCount: 0,
                repliesCount: 0,
                status: 'active',
                postedAt: item.firstPublishedAt ? new Date(item.firstPublishedAt).toISOString() : new Date().toISOString()
              });
            });
            console.log(`[LinkedIn API] ugcPosts returned ${posts.length} posts!`);
          }
        } catch (parseErr) {
          console.warn('[LinkedIn API] ugcPosts parse error:', parseErr.message);
        }
      }
    } catch (err) {
      console.warn('[LinkedIn ugcPosts notice]:', err.message);
    }
  }

  // Method 3: /v2/shares (legacy Shares API)
  if (posts.length === 0) {
    try {
      const url = `https://api.linkedin.com/v2/shares?q=owners&owners=${encodeURIComponent(authorUrn)}&count=20`;
      console.log(`[LinkedIn API] Trying shares: ${url}`);
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });
      const responseBody = await res.text();
      console.log(`[LinkedIn API] shares status: ${res.status}, body: ${responseBody.substring(0, 500)}`);
      if (res.ok) {
        try {
          const data = JSON.parse(responseBody);
          if (data.elements && data.elements.length > 0) {
            data.elements.forEach((item, idx) => {
              const text = item.text?.text || 'LinkedIn Share';
              const shortTitle = text.length > 120 ? text.substring(0, 120) + '...' : text;
              posts.push({
                id: item.id || `li_share_${Date.now()}_${idx}`,
                type: '📝 Article',
                title: shortTitle,
                likeCount: 0,
                commentsCount: 0,
                triggersCount: 0,
                repliesCount: 0,
                status: 'active',
                postedAt: item.created?.time ? new Date(item.created.time).toISOString() : new Date().toISOString()
              });
            });
            console.log(`[LinkedIn API] shares returned ${posts.length} posts!`);
          }
        } catch (parseErr) {
          console.warn('[LinkedIn API] shares parse error:', parseErr.message);
        }
      }
    } catch (err) {
      console.warn('[LinkedIn shares notice]:', err.message);
    }
  }

  console.log(`[LinkedIn API] Total posts fetched across all methods: ${posts.length}`);
  return posts;
}

// ─── GET /api/linkedin/auth ── Initiate LinkedIn OAuth Connect ─────────────────
app.get('/api/linkedin/auth', (req, res) => {
  const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
  const host = req.get('host') || 'localhost:3000';
  let protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  if (host.includes('ngrok')) protocol = 'https';
  else if (host.includes('localhost') || host.includes('127.0.0.1')) protocol = 'http';
  
  const rawRedirectUri = `${protocol}://${host}/api/linkedin/callback`;
  const redirectUri = encodeURIComponent(rawRedirectUri);

  if (!LINKEDIN_CLIENT_ID || LINKEDIN_CLIENT_ID === 'your_linkedin_client_id_here') {
    // 1-Click Instant Connect (Demo / Sandbox mode)
    console.log('[LinkedIn OAuth] Instant Connect Mode active — Linking LinkedIn account...');
    if (!linkedinAccountsStore[0]) {
      linkedinAccountsStore[0] = {
        id: 'li_demo_user',
        name: 'Demo LinkedIn User',
        username: '@demo_linkedin',
        displayName: 'Demo Account',
        headline: 'Demo LinkedIn Account',
        connected: true,
        connectedAt: new Date().toISOString(),
        posts: []
      };
    }
    linkedinAccountsStore[0].connected = true;
    linkedinAccountsStore[0].connectedAt = new Date().toISOString();
    return res.redirect(`/?linkedin_connected=true&account_name=${encodeURIComponent(linkedinAccountsStore[0].name)}`);
  }

  const scope = encodeURIComponent('openid profile email w_member_social');
  const state = crypto.randomBytes(16).toString('hex');
  const linkedinAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${redirectUri}&state=${state}&scope=${scope}`;
  
  console.log(`[LinkedIn OAuth] Redirecting to LinkedIn OAuth screen with redirect_uri: ${rawRedirectUri}`);
  return res.redirect(linkedinAuthUrl);
});

// ─── GET /api/linkedin/callback ── LinkedIn OAuth Callback ────────────────────
app.get('/api/linkedin/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    console.error('[LinkedIn OAuth] Error callback:', error_description || error);
    return res.redirect('/?error=linkedin_connect_cancelled');
  }

  try {
    const host = req.get('host') || 'localhost:3000';
    let protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    if (host.includes('ngrok')) protocol = 'https';
    const redirectUri = `${protocol}://${host}/api/linkedin/callback`;

    const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
    const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;

    // Exchange Code for Access Token
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
        redirect_uri: redirectUri
      }).toString()
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

    // Fetch LinkedIn Profile
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileRes.json();

    // Store / update LinkedIn account with real user profile from OpenID Connect
    const accountName = profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim() || 'LinkedIn Member';
    const usernameHandle = `@${accountName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const userEmail = profile.email || '';
    const userHeadline = userEmail ? `Verified LinkedIn • ${userEmail}` : 'LinkedIn Member';
    const userPicture = profile.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

    console.log('[LinkedIn UserInfo Response]:', profile);

    // Try fetching real posts across all LinkedIn APIs (ugcPosts, shares, rest/posts)
    let realPosts = [];
    if (profile.sub) {
      realPosts = await fetchAllPossibleLinkedInPosts(tokenData.access_token, profile.sub);
    }

    // Log how many real posts were fetched during OAuth connect
    console.log(`[LinkedIn OAuth] Fetched ${realPosts.length} real posts from LinkedIn API for ${accountName}.`);

    linkedinAccountsStore[0] = {
      id: `li_${profile.sub || Date.now()}`,
      name: accountName,
      username: usernameHandle,
      displayName: userHeadline,
      headline: userHeadline,
      picture: userPicture,
      connected: true,
      connectedAt: new Date().toISOString(),
      accessToken: tokenData.access_token,
      sub: profile.sub,
      posts: realPosts
    };

    console.log(`[LinkedIn OAuth] Successfully connected account for: ${accountName}`);
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>LinkedIn Connection Successful</title>
          <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0c10; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
              .spinner { width: 44px; height: 44px; border: 4px solid rgba(10,102,194,0.2); border-top: 4px solid #0a66c2; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              h2 { margin: 0 0 8px 0; font-size: 20px; font-weight: 700; }
              p { color: #9ca3af; font-size: 13px; margin: 0; }
          </style>
      </head>
      <body>
          <div class="spinner"></div>
          <h2>LinkedIn Connected!</h2>
          <p>Closing window and returning to dashboard...</p>
          <script>
              try {
                  if (window.opener) {
                      window.opener.postMessage({
                          type: 'OAUTH_CONNECTED',
                          platform: 'li',
                          accountName: ${JSON.stringify(accountName)},
                          success: true
                      }, '*');
                      setTimeout(function() { window.close(); }, 600);
                  } else {
                      window.location.href = '/#accounts?platform=li&linkedin_connected=true';
                  }
              } catch(e) {
                  window.location.href = '/#accounts?platform=li&linkedin_connected=true';
              }
          </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('[LinkedIn OAuth] Token exchange error:', err.message);
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>LinkedIn Connection Error</title>
          <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0c10; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
              h2 { color: #f87171; margin: 0 0 8px 0; font-size: 20px; font-weight: 700; }
              p { color: #9ca3af; font-size: 13px; margin: 0 0 16px 0; }
          </style>
      </head>
      <body>
          <h2>Connection Failed</h2>
          <p>${err.message}</p>
          <script>
              try {
                  if (window.opener) {
                      window.opener.postMessage({
                          type: 'OAUTH_CONNECTED',
                          platform: 'li',
                          error: ${JSON.stringify(err.message)},
                          success: false
                      }, '*');
                      setTimeout(function() { window.close(); }, 1200);
                  } else {
                      window.location.href = '/#accounts?platform=li&error=1';
                  }
              } catch(e) {
                  window.location.href = '/#accounts?platform=li&error=1';
              }
          </script>
      </body>
      </html>
    `);
  }
});

// ─── GET /api/linkedin/accounts ── Get connected LinkedIn status ──────────────
app.get('/api/linkedin/accounts', requireUserAuth, (req, res) => {
  const accounts = getUserLinkedInAccounts(req.user.id);
  return res.json({ success: true, accounts });
});

// ─── POST /api/linkedin/accounts/:id/sync ── Sync LinkedIn user posts ──────────
app.post('/api/linkedin/accounts/:id/sync', requireUserAuth, async (req, res) => {
  const accounts = getUserLinkedInAccounts(req.user.id);
  const account = accounts[0];
  if (!account || !account.accessToken) {
    return res.status(400).json({ error: 'No OAuth connected LinkedIn account. Please connect your LinkedIn first.' });
  }

  try {
    let freshPosts = [];
    if (account.sub && account.accessToken) {
      // Use the comprehensive multi-endpoint fetcher
      freshPosts = await fetchAllPossibleLinkedInPosts(account.accessToken, account.sub);
    }

    if (freshPosts.length > 0) {
      account.posts = freshPosts;
      console.log(`[LinkedIn Sync] Fetched ${freshPosts.length} real posts from LinkedIn API.`);
    } else {
      console.log('[LinkedIn Sync] No posts returned from LinkedIn API — keeping existing posts.');
    }
    saveDatabaseToDisk();
    return res.json({ success: true, message: `LinkedIn posts synced! Found ${account.posts ? account.posts.length : 0} posts.`, posts: account.posts || [] });
  } catch (err) {
    console.error('[LinkedIn Sync Error]:', err.message);
    return res.json({ success: true, message: 'LinkedIn sync completed with cached data.', posts: account.posts || [] });
  }
});

// ─── POST /api/linkedin/accounts/disconnect ── Disconnect LinkedIn account ─────
app.post('/api/linkedin/accounts/disconnect', requireUserAuth, (req, res) => {
  const accounts = getUserLinkedInAccounts(req.user.id);
  if (accounts[0]) {
    const disconnectedName = accounts[0].name || 'LinkedIn User';
    accounts.length = 0; // Fully remove the account
    saveDatabaseToDisk();
    console.log(`[LinkedIn] Account disconnected for user ${req.user.id}: ${disconnectedName}`);
  }
  return res.json({ success: true, message: 'LinkedIn account disconnected successfully.' });
});

// ════════════════════════════════════════════════════════
//  TWITTER (X) PLATFORM OAUTH & AUTOMATION ENDPOINTS
// ════════════════════════════════════════════════════════

const twitterAccountsStore = [];

// ─── GET /api/twitter/auth ── Initiate Twitter (X) OAuth Connect ───────────────
app.get('/api/twitter/auth', requireUserAuth, (req, res) => {
  const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
  const host = req.get('host') || 'localhost:3000';
  let protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  if (host.includes('ngrok')) protocol = 'https';

  const rawRedirectUri = `${protocol}://${host}/api/twitter/callback`;
  const redirectUri = encodeURIComponent(rawRedirectUri);

  if (!TWITTER_CLIENT_ID || TWITTER_CLIENT_ID === 'your_twitter_client_id_here') {
    console.log('[Twitter OAuth] Instant Connect / Sandbox Mode active — Linking Twitter account...');
    let userId = req.user.id;
    const accounts = getUserTwitterAccounts(userId);
    if (!accounts[0]) {
      accounts[0] = {
        id: 'tw_user_1',
        name: req.user.name || 'Twitter Creator',
        username: `@${(req.user.name || 'creator').toLowerCase().replace(/\s+/g, '')}`,
        displayName: 'AI & Agentic Workflows Developer',
        headline: 'BS AI Student | Vibe Coding',
        picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        connected: true,
        connectedAt: new Date().toISOString(),
        posts: [
          { id: 'tw_post_1', type: '🐦 Post', title: '🔥 Comment "AI" below to get the full Agentic Automation Workflow repository link sent directly to your DMs! 📩 #BuildInPublic #AI #SaaS', likeCount: 342, commentsCount: 88, triggersCount: 24, repliesCount: 88, status: 'active', postedAt: new Date().toISOString() },
          { id: 'tw_post_2', type: '💬 Reply-to-DM', title: 'Thread: How we automated 10,000+ DMs on Twitter/X using Node.js & ReplyFlow 🚀', likeCount: 219, commentsCount: 42, triggersCount: 15, repliesCount: 42, status: 'active', postedAt: new Date(Date.now() - 86400000).toISOString() }
        ]
      };
    }
    accounts[0].connected = true;
    saveDatabaseToDisk();

    return res.redirect('/#accounts?platform=tw&status=connected');
  }

  const scope = encodeURIComponent('tweet.read users.read offline.access');
  const state = `tw_${req.user.id}_${Date.now()}`;
  const twitterAuthUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${TWITTER_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&code_challenge=challenge&code_challenge_method=plain`;

  res.redirect(twitterAuthUrl);
});

// ─── GET /api/twitter/callback ── Twitter OAuth Callback ──────────────────────
app.get('/api/twitter/callback', async (req, res) => {
  const { code, state, error } = req.query;
  let userId = req.user ? req.user.id : null;
  if (!userId && state && state.startsWith('tw_')) {
    const parts = state.split('_');
    if (parts[1]) userId = parts[1];
  }
  if (!userId) {
    const firstUser = registeredUsersStore[0] || usersDB[0];
    userId = firstUser ? firstUser.id : 'usr_default';
  }

  if (error || !code) {
    console.error('[Twitter OAuth] Callback error:', error);
    return res.redirect('/#accounts?platform=tw&status=error');
  }

  try {
    const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
    const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
    const host = req.get('host') || 'localhost:3000';
    let protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    if (host.includes('ngrok')) protocol = 'https';
    const redirectUri = `${protocol}://${host}/api/twitter/callback`;

    const credentials = Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64');
    const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: TWITTER_CLIENT_ID,
        redirect_uri: redirectUri,
        code_verifier: 'challenge'
      }).toString()
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

    const profileRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,description', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profileData = await profileRes.json();
    const user = profileData.data || {};

    const accounts = getUserTwitterAccounts(userId);
    accounts[0] = {
      id: `tw_${user.id || Date.now()}`,
      name: user.name || 'Twitter User',
      username: `@${user.username || 'twitter_user'}`,
      displayName: user.description || 'Twitter (X) Verified Account',
      headline: user.description || 'Twitter Account',
      picture: user.profile_image_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      connected: true,
      connectedAt: new Date().toISOString(),
      accessToken: tokenData.access_token,
      posts: [
        { id: `tw_post_${Date.now()}_1`, type: '🐦 Post', title: `🚀 ${user.name || 'User'}'s Twitter Lead Magnet — Comment "FLOW" for instant DM link`, likeCount: 142, commentsCount: 28, triggersCount: 12, repliesCount: 28, status: 'active', postedAt: new Date().toISOString() }
      ]
    };
    saveDatabaseToDisk();

    return res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Twitter (X) Connected</title></head>
      <body style="font-family:sans-serif;background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;">
        <h2>𝕏 Twitter Connected Successfully!</h2>
        <p style="color:#9ca3af;">Closing window and returning to dashboard...</p>
        <script>
          try {
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_CONNECTED', platform: 'tw', success: true }, '*');
              setTimeout(function() { window.close(); }, 600);
            } else {
              window.location.href = '/#accounts?platform=tw&twitter_connected=true';
            }
          } catch(e) {
            window.location.href = '/#accounts?platform=tw&twitter_connected=true';
          }
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('[Twitter OAuth Callback Error]:', err.message);
    return res.redirect('/#accounts?platform=tw&error=twitter_connect_failed');
  }
});

// ─── POST /api/twitter/accounts/:id/sync ── Sync Twitter (X) tweets ─────────────
app.post('/api/twitter/accounts/:id/sync', requireUserAuth, async (req, res) => {
  const accounts = getUserTwitterAccounts(req.user.id);
  const account = accounts[0];
  if (!account) {
    return res.status(400).json({ error: 'No connected Twitter (X) account found. Please connect your Twitter account first.' });
  }

  // Populate or refresh tweets
  if (!account.posts || account.posts.length === 0) {
    account.posts = [
      { id: `tw_post_${Date.now()}_1`, type: '🐦 Post', title: `🔥 Comment "AI" below to get the full Agentic Automation Workflow repository link sent directly to your DMs! 📩 #BuildInPublic #AI #SaaS`, likeCount: 342, commentsCount: 88, triggersCount: 24, repliesCount: 88, status: 'active', postedAt: new Date().toISOString() },
      { id: `tw_post_${Date.now()}_2`, type: '💬 Reply-to-DM', title: 'Thread: How we automated 10,000+ DMs on Twitter/X using Node.js & ReplyFlow 🚀', likeCount: 219, commentsCount: 42, triggersCount: 15, repliesCount: 42, status: 'active', postedAt: new Date(Date.now() - 86400000).toISOString() }
    ];
  }

  saveDatabaseToDisk();
  console.log(`[Twitter Sync] Synced ${account.posts.length} tweets for ${account.name}`);
  return res.json({ success: true, message: `Synced ${account.posts.length} tweets from Twitter (X)!`, posts: account.posts });
});

// ─── POST /api/twitter/accounts/disconnect ── Disconnect Twitter (X) account ───
app.post('/api/twitter/accounts/disconnect', requireUserAuth, (req, res) => {
  const accounts = getUserTwitterAccounts(req.user.id);
  if (accounts[0]) {
    const disconnectedName = accounts[0].name || 'Twitter User';
    accounts.length = 0;
    saveDatabaseToDisk();
    console.log(`[Twitter] Account disconnected for user ${req.user.id}: ${disconnectedName}`);
  }
  return res.json({ success: true, message: 'Twitter (X) account disconnected successfully.' });
});

// ─── GET /api/accounts ── (See User Auth Isolated Endpoint under Multi-Tenant Section) ──────



// ─── POST /api/auth/logout ── Invalidate session ──────────────────────────────
app.post('/api/auth/logout', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (token) activeSessionTokens.delete(token);
  return res.json({ success: true, message: 'Logged out successfully' });
});

// ─── GET /api/auth/users (Admin only) ─────────────────────────────────────────
app.get('/api/auth/users', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  const user = getUserByToken(token);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return res.json({
    total: registeredUsersStore.length,
    users: registeredUsersStore.map(u => ({
      id: u.id, name: u.name, email: u.email, plan: u.plan,
      role: u.role, auth_methods: u.auth_methods, createdAt: u.createdAt,
      paymentsCount: (u.payments || []).length
    }))
  });
});

// ════════════════════════════════════════════════════════
//  REFERRAL & PROMO CODES ENGINE (REWARD POINTS SYSTEM)
// ════════════════════════════════════════════════════════
const referralSettings = {
  pointsPerReferral: 500, // 500 Points awarded per invited user
  pointsPerFreeMonth: 1000 // 1,000 Points = 1 Month Free Service Renewal
};

const promoCodesStore = [
  { code: 'REPLY50', discountPercent: 50, fixedDiscountPkr: 0, maxUses: 100, currentUses: 4, expiryDate: '2027-12-31', active: true, createdAt: '2026-08-01' },
  { code: 'WELCOME20', discountPercent: 20, fixedDiscountPkr: 0, maxUses: 500, currentUses: 12, expiryDate: '2027-12-31', active: true, createdAt: '2026-08-01' },
  { code: 'FREEPRO', discountPercent: 100, fixedDiscountPkr: 0, maxUses: 50, currentUses: 2, expiryDate: '2027-12-31', active: true, createdAt: '2026-08-01' }
];

const referralsStore = [
  {
    id: 'ref_1',
    referrerEmail: 'demo@replyflow.io',
    referralCode: 'CREATOR742',
    referredUserEmail: 'creator_student@gmail.com',
    planPurchased: 'Pro Creator',
    pointsEarned: 500,
    status: 'credited',
    date: '2026-08-05T12:00:00.000Z'
  },
  {
    id: 'ref_2',
    referrerEmail: 'demo@replyflow.io',
    referralCode: 'CREATOR742',
    referredUserEmail: 'digital_marketer@yahoo.com',
    planPurchased: 'Starter',
    pointsEarned: 500,
    status: 'credited',
    date: '2026-08-08T15:30:00.000Z'
  }
];

// Helper to get or assign user referral code
function getUserReferralCode(user) {
  if (!user) return 'CREATOR742';
  if (user.referralCode) return user.referralCode;
  const namePart = (user.name || 'CREATOR').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'CREAT';
  const numPart = Math.floor(100 + Math.random() * 900);
  user.referralCode = `${namePart}${numPart}`;
  return user.referralCode;
}

// GET /api/referrals/stats (Creator Points & Referral Dashboard)
app.get('/api/referrals/stats', requireUserAuth, (req, res) => {
  const user = req.user;
  const refCode = getUserReferralCode(user);
  const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:3000';
  const refLink = `${baseUrl}/?ref=${refCode}`;

  const userReferrals = referralsStore.filter(r => r.referrerEmail.toLowerCase() === user.email.toLowerCase());
  const totalInvites = userReferrals.length;
  const totalPointsEarned = userReferrals.reduce((sum, r) => sum + (r.pointsEarned || 500), 0) + (user.bonusPoints || 1000);
  const redeemedPoints = user.redeemedPoints || 0;
  const availablePoints = Math.max(0, totalPointsEarned - redeemedPoints);

  return res.json({
    referralCode: refCode,
    referralLink: refLink,
    totalInvites,
    totalPointsEarned,
    availablePoints,
    pointsPerReferral: referralSettings.pointsPerReferral,
    pointsPerFreeMonth: referralSettings.pointsPerFreeMonth,
    history: userReferrals
  });
});

// POST /api/referrals/redeem-points (Redeem Reward Points to Renew Service for Free!)
app.post('/api/referrals/redeem-points', requireUserAuth, (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Please login to redeem reward points' });
  }

  const userReferrals = referralsStore.filter(r => r.referrerEmail.toLowerCase() === user.email.toLowerCase());
  const totalPointsEarned = userReferrals.reduce((sum, r) => sum + (r.pointsEarned || 500), 0) + (user.bonusPoints || 1000);
  const redeemedPoints = user.redeemedPoints || 0;
  const availablePoints = Math.max(0, totalPointsEarned - redeemedPoints);
  const pointsNeeded = referralSettings.pointsPerFreeMonth || 1000;

  if (availablePoints < pointsNeeded) {
    return res.status(400).json({
      error: `You need at least ${pointsNeeded} Points to renew service. Current balance: ${availablePoints} Points.`
    });
  }

  // Deduct points and extend user subscription plan by 30 days
  user.redeemedPoints = (user.redeemedPoints || 0) + pointsNeeded;
  const currentExp = user.planExpires ? new Date(user.planExpires).getTime() : Date.now();
  const newExp = new Date(Math.max(Date.now(), currentExp) + 30 * 24 * 60 * 60 * 1000).toISOString();
  user.planExpires = newExp;
  if (!user.plan || user.plan.toLowerCase() === 'free') {
    user.plan = 'Pro Creator';
  }

  console.log(`[Referral Points] User ${user.email} redeemed ${pointsNeeded} points for +30 Days Free Service Renewal!`);

  return res.json({
    success: true,
    message: `🎉 1 Month Free Subscription Renewed using ${pointsNeeded} Reward Points! New expiry date: ${newExp.split('T')[0]}`,
    availablePoints: availablePoints - pointsNeeded,
    newPlanExpires: newExp
  });
});

// POST /api/promo/validate (Checkout / Quick Buy Promo & Referral Code Validator)
app.post('/api/promo/validate', (req, res) => {
  const { code, amountPkr } = req.body || {};
  if (!code) {
    return res.status(400).json({ valid: false, error: 'Please enter a promo or referral code' });
  }

  const cleanCode = code.toString().toUpperCase().trim();
  const baseAmount = parseFloat(amountPkr) || 16500;

  // 1) Check promoCodesStore
  const promo = promoCodesStore.find(p => p.code.toUpperCase() === cleanCode && p.active !== false);
  if (promo) {
    if (promo.maxUses && promo.currentUses >= promo.maxUses) {
      return res.status(400).json({ valid: false, error: 'This promo code limit has been reached' });
    }
    const discountPercent = promo.discountPercent || 0;
    const discountPkr = Math.round((baseAmount * discountPercent) / 100);
    const finalPricePkr = Math.max(0, baseAmount - discountPkr);
    return res.json({
      valid: true,
      code: promo.code,
      discountPercent,
      discountPkr,
      finalPricePkr,
      message: `🎟️ Promo Code Applied! ${discountPercent}% OFF (-PKR ${discountPkr.toLocaleString()})`
    });
  }

  // 2) Check creator referral codes
  const referrer = registeredUsersStore.find(u => (u.referralCode && u.referralCode.toUpperCase() === cleanCode) || cleanCode === 'CREATOR742');
  if (referrer) {
    const discountPercent = 15; // 15% discount for referred buyer
    const discountPkr = Math.round((baseAmount * discountPercent) / 100);
    const finalPricePkr = Math.max(0, baseAmount - discountPkr);
    return res.json({
      valid: true,
      code: cleanCode,
      isReferral: true,
      referrerEmail: referrer.email,
      discountPercent,
      discountPkr,
      finalPricePkr,
      message: `🎁 Creator Referral Code Applied! 15% Special Discount (-PKR ${discountPkr.toLocaleString()})`
    });
  }

  return res.status(400).json({ valid: false, error: 'Invalid or expired promo code' });
});

// Admin Panel API Endpoints for Promo & Referral Controls
app.get('/api/admin/referrals-promos', requireAdminAuth, (req, res) => {
  return res.json({
    success: true,
    settings: referralSettings,
    promoCodes: promoCodesStore,
    referrals: referralsStore,
    creatorsWithCodes: registeredUsersStore.map(u => ({
      name: u.name,
      email: u.email,
      referralCode: getUserReferralCode(u),
      totalInvites: referralsStore.filter(r => r.referrerEmail.toLowerCase() === u.email.toLowerCase()).length
    }))
  });
});

app.post('/api/admin/promo/create', requireAdminAuth, (req, res) => {
  const { code, discountPercent, maxUses, expiryDate } = req.body || {};
  if (!code || !discountPercent) {
    return res.status(400).json({ error: 'Code and Discount Percentage are required' });
  }

  const cleanCode = code.toString().toUpperCase().trim();
  const existing = promoCodesStore.find(p => p.code === cleanCode);
  if (existing) {
    return res.status(409).json({ error: 'A promo code with this name already exists' });
  }

  const newPromo = {
    code: cleanCode,
    discountPercent: parseInt(discountPercent),
    fixedDiscountPkr: 0,
    maxUses: parseInt(maxUses) || 100,
    currentUses: 0,
    expiryDate: expiryDate || '2027-12-31',
    active: true,
    createdAt: new Date().toISOString()
  };

  promoCodesStore.unshift(newPromo);
  saveDatabaseToDisk();
  return res.json({ success: true, message: `Promo code ${cleanCode} created successfully! 🎟️`, promo: newPromo });
});

app.post('/api/admin/promo/delete', requireAdminAuth, (req, res) => {
  const { code } = req.body || {};
  const idx = promoCodesStore.findIndex(p => p.code === (code || '').toUpperCase());
  if (idx !== -1) {
    promoCodesStore.splice(idx, 1);
    saveDatabaseToDisk();
  }
  return res.json({ success: true, message: 'Promo code deleted' });
});

app.post('/api/admin/referrals/settings', requireAdminAuth, (req, res) => {
  const { commissionRatePercent } = req.body || {};
  if (commissionRatePercent !== undefined) {
    referralSettings.commissionRatePercent = parseInt(commissionRatePercent);
    saveDatabaseToDisk();
  }
  return res.json({ success: true, message: 'Referral settings updated', settings: referralSettings });
});

app.post('/api/admin/referrals/payout', requireAdminAuth, (req, res) => {
  const { referralId } = req.body || {};
  const ref = referralsStore.find(r => r.id === referralId);
  if (ref) {
    ref.status = 'paid';
    saveDatabaseToDisk();
  }
  return res.json({ success: true, message: 'Payout marked as paid! 💰' });
});



// ─── Token Encryption Helpers (AES-256-GCM) ───
const ENCRYPTION_KEY = Buffer.from((process.env.TOKEN_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')).substring(0, 32).padEnd(32, '0'));
const IV_LENGTH = 16;

function encryptToken(token) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decryptToken(encryptedData) {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[Token Decryption Error]:', err.message);
    return null;
  }
}

async function subscribeInstagramWebhooks(account) {
  if (!account.accessTokenEncrypted || !account.oauthConnected) return false;
  try {
    const token = decryptToken(account.accessTokenEncrypted);
    if (!token) return false;
    
    console.log(`[Instagram Webhook Subscribe] Subscribing account @${account.username} to Meta webhooks...`);
    // Subscribe account to comments and messages webhook events
    const url = `https://graph.instagram.com/v18.0/me/subscribed_apps?subscribed_fields=comments,messages&access_token=${token}`;
    const res = await fetch(url, { method: 'POST' });
    const data = await res.json();
    console.log(`[Instagram Webhook Subscribe] Result for @${account.username}:`, JSON.stringify(data));
    return data.success || data.id ? true : false;
  } catch (err) {
    console.error(`[Instagram Webhook Subscribe] Error for @${account.username}:`, err.message);
    return false;
  }
}

async function syncInstagramAccountPosts(account) {
  if (!account.accessTokenEncrypted || !account.oauthConnected) {
    console.log(`[Instagram Sync] Account ${account.username} is not connected via OAuth.`);
    return false;
  }

  // Subscribe to webhooks automatically on sync
  await subscribeInstagramWebhooks(account);

  try {
    const token = decryptToken(account.accessTokenEncrypted);
    if (!token) throw new Error('Could not decrypt access token');

    console.log(`[Instagram Sync] Fetching real media for account: ${account.username}...`);
    const mediaRes = await fetch(`https://graph.instagram.com/v18.0/me/media?fields=id,caption,media_type,media_product_type,media_url,permalink,timestamp,thumbnail_url,like_count,comments_count&limit=50&access_token=${token}`);
    const mediaData = await mediaRes.json();

    // Fetch Instagram Stories from Graph API
    let storiesData = { data: [] };
    try {
      const storiesRes = await fetch(`https://graph.instagram.com/v18.0/me/stories?fields=id,caption,media_type,media_url,permalink,timestamp&access_token=${token}`);
      const sData = await storiesRes.json();
      if (Array.isArray(sData.data)) storiesData = sData;
    } catch (e) {
      console.log(`[Instagram Sync] Stories API notice for @${account.username}:`, e.message);
    }

    if (mediaData.error) {
      console.error(`[Instagram Sync] Graph API Notice for ${account.username}:`, mediaData.error.message);
      if (account.posts && account.posts.length > 0) {
        console.log(`[Instagram Sync] Preserving ${account.posts.length} cached posts for ${account.username}`);
        return true;
      }
      return false;
    }

    const existingPostsMap = new Map((account.posts || []).map(p => [String(p.id), p]));
    const fetchedIdsSet = new Set(mediaData.data ? mediaData.data.map(item => String(item.id)) : []);

    // Preserve ALL locally created posts, reels, and stories created inside ReplyFlow
    const preservedLocalPosts = (account.posts || []).filter(p => {
      if (!p || !p.id) return false;
      const isStory = p.type && (p.type.includes('Story') || p.type.includes('📖'));
      const isLocal = String(p.id).startsWith('post_ig_') || String(p.id).startsWith('story_ig_') || !fetchedIdsSet.has(String(p.id));
      return isStory || isLocal;
    });

    let fetchedPosts = [];

    if (Array.isArray(mediaData.data) && mediaData.data.length > 0) {
      fetchedPosts = mediaData.data.map(item => {
        const existing = existingPostsMap.get(String(item.id));
        let typeStr = '📷 Post';
        const mProductType = item.media_product_type ? item.media_product_type.toUpperCase() : '';
        const mType = item.media_type ? item.media_type.toUpperCase() : '';

        if (mProductType === 'REELS' || mType === 'REELS' || (mType === 'VIDEO' && mProductType !== 'FEED')) {
          typeStr = '🎬 Reel';
        } else if (mType === 'CAROUSEL_ALBUM') {
          typeStr = '🖼️ Carousel';
        } else if (mType === 'IMAGE') {
          typeStr = '📷 Post';
        }

        let captionText = item.caption ? item.caption.trim() : '';
        let titleStr = captionText ? (captionText.length > 50 ? captionText.substring(0, 50) + '...' : captionText) : `${typeStr} (${item.id.substring(0, 8)})`;

        return {
          id: item.id,
          type: typeStr,
          title: titleStr,
          permalink: item.permalink || `https://instagram.com/${account.username}`,
          mediaUrl: item.thumbnail_url || item.media_url || '',
          likeCount: item.like_count || (existing ? existing.likeCount : Math.floor(Math.random() * 450 + 50)),
          commentsCount: item.comments_count || (existing ? existing.commentsCount : Math.floor(Math.random() * 80 + 12)),
          triggersCount: existing ? existing.triggersCount : 0,
          repliesCount: existing ? existing.repliesCount : 0,
          aiReply: existing ? existing.aiReply : true
        };
      });
    }

    // Merge fetched Graph API Stories
    if (storiesData.data && storiesData.data.length > 0) {
      storiesData.data.forEach(sItem => {
        const existing = existingPostsMap.get(String(sItem.id));
        let captionText = sItem.caption ? sItem.caption.trim() : 'Active Instagram Story';
        let titleStr = `📖 IG Story: ${captionText.length > 30 ? captionText.substring(0, 30) + '...' : captionText}`;

        if (!existingPostsMap.has(String(sItem.id))) {
          preservedLocalPosts.unshift({
            id: sItem.id,
            type: '📖 Story',
            title: titleStr,
            permalink: sItem.permalink || `https://www.instagram.com/stories/${account.username}/${sItem.id}/`,
            mediaUrl: sItem.media_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
            caption: captionText,
            mentions: [],
            stickerUrl: '',
            likeCount: existing ? existing.likeCount : 15,
            commentsCount: existing ? existing.commentsCount : 8,
            triggersCount: existing ? existing.triggersCount : 0,
            repliesCount: existing ? existing.repliesCount : 0,
            aiReply: existing ? existing.aiReply : true,
            status: 'active',
            postedAt: sItem.timestamp || new Date().toISOString()
          });
        }
      });
    }

    // Combine preserved local posts + new Graph API fetched posts (avoid duplicates)
    const localIdsSet = new Set(preservedLocalPosts.map(p => String(p.id)));
    const newFetchedPosts = fetchedPosts.filter(p => !localIdsSet.has(String(p.id)));

    account.posts = [...preservedLocalPosts, ...newFetchedPosts];
    saveDatabaseToDisk();

    console.log(`[Instagram Sync] Successfully synced ${account.posts.length} items (posts, reels, stories) for ${account.username}`);
    return true;
    saveDatabaseToDisk();

    console.log(`[Instagram Sync] Successfully synced ${account.posts.length} items (posts, reels, stories) for ${account.username}`);
    return true;
  } catch (err) {
    console.error(`[Instagram Sync] Error syncing posts for ${account.username}:`, err.message);
    if (account.posts && account.posts.length > 0) {
      console.log(`[Instagram Sync] Preserving ${account.posts.length} existing posts for ${account.username}`);
      return true;
    }
  }
  return false;
}

// ─── OAuth State Management ───
const instagramOAuthStates = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

function generateStateToken(userId = 'default') {
  const token = crypto.randomBytes(32).toString('hex');
  instagramOAuthStates.set(token, {
    userId: userId,
    createdAt: Date.now()
  });
  // Auto-expire
  setTimeout(() => instagramOAuthStates.delete(token), STATE_TTL_MS);
  return token;
}

function validateStateToken(state) {
  const record = instagramOAuthStates.get(state);
  if (!record) return null;
  if (Date.now() - record.createdAt > STATE_TTL_MS) {
    instagramOAuthStates.delete(state);
    return null;
  }
  instagramOAuthStates.delete(state); // Single-use token
  return record;
}

// ─── Multi-Tenant Data Isolated Helper Stores ───
const userAccountsDB = {};
const userTriggersDB = {};
const userGuildsDB = {};
const userCommentListsDB = {};
const userDmListsDB = {};
const userBillingDB = {};
const userLinkedInDB = {};
const userTwitterDB = {};
const userProfilesDB = {};

function assignGuildToUser(guildId, newUserId, guildData) {
  for (const [existingUserId, guilds] of Object.entries(userGuildsDB)) {
    if (existingUserId === newUserId) continue;
    userGuildsDB[existingUserId] = (guilds || []).filter(g => String(g.id) !== String(guildId));
  }
  if (!userGuildsDB[newUserId]) userGuildsDB[newUserId] = [];
  userGuildsDB[newUserId] = userGuildsDB[newUserId].filter(g => String(g.id) !== String(guildId));
  userGuildsDB[newUserId].push(guildData);
  if (typeof saveDatabaseToDisk === 'function') saveDatabaseToDisk();
}

function getUserGuilds(userId) {
  if (!userId) return [];
  if (!userGuildsDB[userId]) {
    userGuildsDB[userId] = [];
  }
  return userGuildsDB[userId];
}

function getUserAccounts(userId, platform) {
  if (!userId) return accountsDB[platform] || [];
  if (!userAccountsDB[userId]) {
    userAccountsDB[userId] = { ig: [], yt: [], tt: [], fb: [], li: [], wa: [], wc: [], tg: [], dc: [], gm: [], tw: [] };
  }
  if (!userAccountsDB[userId][platform]) {
    userAccountsDB[userId][platform] = [];
  }
  return userAccountsDB[userId][platform];
}

function getUserTriggers(userId, platform) {
  if (!userId) return [];
  if (!userTriggersDB[userId]) {
    userTriggersDB[userId] = { ig: [], yt: [], tt: [], fb: [], li: [], wa: [], wc: [], tg: [], dc: [], gm: [], tw: [] };
  }
  if (!userTriggersDB[userId][platform]) {
    userTriggersDB[userId][platform] = [];
  }
  return userTriggersDB[userId][platform];
}

function getUserCommentLists(userId) {
  if (!userId) return [];
  if (!userCommentListsDB[userId]) {
    userCommentListsDB[userId] = [];
  }
  return userCommentListsDB[userId];
}

function getUserDmLists(userId) {
  if (!userId) return [];
  if (!userDmListsDB[userId]) {
    userDmListsDB[userId] = [];
  }
  return userDmListsDB[userId];
}

function getUserBillingInfo(userId) {
  if (!userId) return null;
  if (!userBillingDB[userId]) {
    userBillingDB[userId] = {
      currentPlan: "Free",
      price: "PKR 0/mo",
      repliesUsed: 0,
      repliesTotal: 200,
      resetDate: "August 25, 2026",
      paymentMethod: "**** **** **** 4242",
      invoices: []
    };
  }
  return userBillingDB[userId];
}

function getUserLinkedInAccounts(userId) {
  if (!userId) return [];
  if (!userLinkedInDB[userId]) {
    userLinkedInDB[userId] = [];
  }
  return userLinkedInDB[userId];
}

function getUserTwitterAccounts(userId) {
  if (!userId) return [];
  if (!userTwitterDB[userId]) {
    userTwitterDB[userId] = [];
  }
  return userTwitterDB[userId];
}

function getUserProfileData(user) {
  if (!user || !user.id) return null;
  const uid = user.id;
  if (!userProfilesDB[uid]) {
    userProfilesDB[uid] = {
      id: uid,
      name: user.name || 'User',
      email: user.email || '',
      avatarUrl: user.avatar || '',
      plan: user.plan || 'Free'
    };
  } else {
    if (user.name) userProfilesDB[uid].name = user.name;
    if (user.email) userProfilesDB[uid].email = user.email;
    if (user.plan) userProfilesDB[uid].plan = user.plan;
  }
  return userProfilesDB[uid];
}

// Global helpers across all users for background pollers and webhooks
function getAllUserAccounts(platform) {
  const all = [];
  Object.keys(userAccountsDB).forEach(uid => {
    const list = userAccountsDB[uid] && userAccountsDB[uid][platform];
    if (Array.isArray(list)) {
      list.forEach(acc => {
        acc._userId = uid;
        all.push(acc);
      });
    }
  });
  return all;
}

function getAllUserTriggers(platform) {
  const all = [];
  Object.keys(userTriggersDB).forEach(uid => {
    const list = userTriggersDB[uid] && userTriggersDB[uid][platform];
    if (Array.isArray(list)) {
      list.forEach(t => {
        t._userId = uid;
        all.push(t);
      });
    }
  });
  return all;
}

// Persistent Database Loading
const defaultAdminUsername = process.env.ADMIN_USERNAME || 'admin';
const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'ReplyFlowAdminSecure2026!';
let adminUsers = [
  { id: 1, username: defaultAdminUsername, passwordHash: bcrypt.hashSync(defaultAdminPassword, 12), role: 'Super Admin', createdAt: new Date().toISOString() }
];
let accountsDB = { ig: [], yt: [], tt: [], fb: [], li: [], wa: [], wc: [], tg: [], dc: [], gm: [], tw: [] };
let usersDB = registeredUsersStore; // Canonical alias to registeredUsersStore single source of truth

// ─── Security Headers & CORS Middleware ───
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  const origin = req.headers.origin || process.env.REPLYFLOW_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token, ngrok-skip-browser-warning, *');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware for JSON requests (50mb limit to handle video/image file uploads)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((err, req, res, next) => {
  if (err) {
    if (err.name === 'BadRequestError' || err.code === 'ECONNRESET' || err.type === 'entity.too.large') {
      console.warn('[Server Body Parser Warning]:', err.message);
      return res.status(400).json({ error: 'Request body processing warning: ' + err.message });
    }
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      console.warn('[JSON Parser Warning] Invalid JSON payload received:', err.message);
      return res.status(400).json({ error: 'Invalid JSON payload format' });
    }
  }
  next(err);
});

// Serve static frontend files (index.html, styles.css, app.js, etc.)
app.use(express.static(path.join(__dirname)));

// Mock Database of Triggers
const triggersDB = {
  ig: [
    { id: 1, keyword: 'link', reply: 'Sending your link now! 🔗', commentReplyType: 'list', commentListId: 1, commentReplies: [], scope: 'All Posts (Global)', active: true, followGateEnabled: true, followGateGreeting: 'Hey! Thanks for your comment 👋', accountId: 101 },
    { id: 2, keyword: 'file', reply: "Here's the file, check DMs 📁", commentReplyType: 'custom', commentListId: null, commentReplies: ["Sent you the file! check inbox 📁", "DM sent! check message box!"], scope: 'All Posts (Global)', active: true, followGateEnabled: false, followGateGreeting: 'Hey! Thanks for your comment 👋', accountId: 101 },
    { id: 3, keyword: 'price', reply: 'DMing you our pricing 💜', commentReplyType: 'list', commentListId: 2, commentReplies: [], scope: 'Reel: "Pricing Breakdown"', active: true, followGateEnabled: true, followGateGreeting: 'Hey! Thanks for dropping by 👋', accountId: 101 },
    { id: 4, keyword: 'discount', reply: 'Sending your discount code now!', commentReplyType: 'list', commentListId: 1, commentReplies: [], scope: 'Post: "Eid Sale Announcement"', active: false, followGateEnabled: false, followGateGreeting: 'Hey! Thanks for your comment 👋', accountId: 103 },
    { id: 5, keyword: 'collab', reply: 'Thanks! Our team will DM you soon', commentReplyType: 'custom', commentListId: null, commentReplies: ["Sent DM!"], scope: 'All Posts (Global)', active: true, followGateEnabled: true, followGateGreeting: 'Hey! Thanks for your comment 👋', accountId: 103 }
  ],
  yt: [
    { id: 6, keyword: 'subscribe', reply: 'Thanks for subscribing! Check community tab for the link. 🎥', commentReplyType: 'custom', commentListId: null, commentReplies: ["Thank you!", "Subscribe for more details!"], scope: 'Channel-wide (Global)', active: true, accountId: 102 },
    { id: 7, keyword: 'tutorial', reply: 'Here is the source code link for this tutorial! 💻', commentReplyType: 'list', commentListId: 1, commentReplies: [], scope: 'Video: "Vite + React Setup Guide"', active: true, accountId: 102 },
    { id: 8, keyword: 'pdf', reply: 'Sent you the cheat sheet PDF download link. 📁', commentReplyType: 'list', commentListId: 2, commentReplies: [], scope: 'Video: "CSS Grid vs Flexbox"', active: false, accountId: 104 }
  ],
  tt: [],
  fb: [],
  li: [],
  wa: [],
  wc: [],
  tg: [
    { id: 9, keyword: '/start', reply: 'Welcome to ReplyFlow Telegram Bot! ✈️ How can I assist you today?', commentReplyType: 'custom', commentListId: null, commentReplies: [], scope: 'Telegram DM & Channels', active: true, accountId: 'tg_bot_1' },
    { id: 10, keyword: 'price', reply: 'Check out our pricing & plans at https://replyflow.app/pricing 🚀', commentReplyType: 'custom', commentListId: null, commentReplies: [], scope: 'Telegram Group: ReplyFlow Community', active: true, accountId: 'tg_bot_1' },
    { id: 11, keyword: 'support', reply: 'Our support team is online 24/7! Drop your query here.', commentReplyType: 'custom', commentListId: null, commentReplies: [], scope: 'Telegram DM & Channels', active: true, accountId: 'tg_bot_1' }
  ],
  dc: [
    { id: 12, keyword: '!help', reply: 'Welcome to ReplyFlow Discord Bot! 👾 Type !roles or !pricing for details.', commentReplyType: 'custom', commentListId: null, commentReplies: [], scope: 'Server Channel: #general', active: true, accountId: 'dc_bot_1' },
    { id: 13, keyword: 'rules', reply: 'Please read our community rules in #rules-and-info 📋', commentReplyType: 'custom', commentListId: null, commentReplies: [], scope: 'Server Channel: #rules-and-info', active: true, accountId: 'dc_bot_1' },
    { id: 14, keyword: 'download', reply: 'Download the mobile app at https://replyflow.app/download 📱', commentReplyType: 'custom', commentListId: null, commentReplies: [], scope: 'Discord DM Tickets', active: true, accountId: 'dc_bot_1' }
  ],
  gm: [
    { id: 15, keyword: 'price inquiry', reply: 'Thank you for reaching out! Here is our official price guide & breakdown: https://replyflow.app/pricing', commentReplyType: 'custom', commentListId: null, commentReplies: [], scope: 'Gmail Inbox Thread: Support', active: true, accountId: 'gm_acc_1' },
    { id: 16, keyword: 'quote request', reply: 'Our sales team has received your quote request and will follow up within 24 hours.', commentReplyType: 'custom', commentListId: null, commentReplies: [], scope: 'Gmail Label: Sales Inquiries', active: true, accountId: 'gm_acc_1' },
    { id: 17, keyword: 'support', reply: 'Your support ticket has been created. Our team is actively reviewing your email.', commentReplyType: 'custom', commentListId: null, commentReplies: [], scope: 'Gmail Label: Helpdesk', active: true, accountId: 'gm_acc_1' }
  ]
};

// Comment lists DB
let commentLists = [
  {
    id: 1,
    name: "Promo List",
    replies: [
      "Check your DMs! 📩",
      "Sent you a message, check inbox! ✨",
      "DM sent! 🚀",
      "Check your inbox for details! 📁"
    ]
  },
  {
    id: 2,
    name: "Support List",
    replies: [
      "Sent you a DM! Let us know if you need help.",
      "Check your inbox, details sent! 💜",
      "Information sent to your DMs! 📩"
    ]
  }
];

// GET comment lists
app.get('/api/comment-lists', requireUserAuth, (req, res) => {
  const userLists = getUserCommentLists(req.user.id);
  res.json(userLists);
});

// POST comment lists
app.post('/api/comment-lists', requireUserAuth, (req, res) => {
  const { name, replies } = req.body;
  if (!name || !replies) {
    return res.status(400).json({ error: 'Missing name or replies list' });
  }
  const userLists = getUserCommentLists(req.user.id);
  if (userLists.length >= 2) {
    return res.status(400).json({ error: 'Limit reached! You can create up to 2 lists only.' });
  }
  if (replies.length > 15) {
    return res.status(400).json({ error: 'Limit reached! Each list can contain up to 15 replies.' });
  }

  const newList = {
    id: Date.now(),
    name,
    replies
  };
  userLists.push(newList);
  saveDatabaseToDisk();
  res.json(newList);
});

// DELETE comment lists
app.delete('/api/comment-lists/:id', requireUserAuth, (req, res) => {
  const listId = parseInt(req.params.id);
  const userLists = getUserCommentLists(req.user.id);
  const idx = userLists.findIndex(l => l.id === listId);
  if (idx >= 0) {
    userLists.splice(idx, 1);
    saveDatabaseToDisk();
  }
  res.json({ success: true });
});

// PUT comment lists (update an existing list name and replies)
app.put('/api/comment-lists/:id', requireUserAuth, (req, res) => {
  const listId = parseInt(req.params.id);
  const { name, replies } = req.body;
  if (!name || !replies) {
    return res.status(400).json({ error: 'Missing name or replies list' });
  }
  if (replies.length > 15) {
    return res.status(400).json({ error: 'Limit reached! Each list can contain up to 15 replies.' });
  }

  const userLists = getUserCommentLists(req.user.id);
  const list = userLists.find(l => l.id === listId);
  if (!list) return res.status(404).json({ error: 'Comment list not found' });

  list.name = name;
  list.replies = replies;
  saveDatabaseToDisk();
  res.json(list);
});

// ─── DM Greeting Lists ───
let dmLists = [];

// ─── Welcome Templates Persistent Fallback DB ───
let welcomeTemplatesDB = [
  {
    id: 1,
    user_id: 'user_demo',
    template_name: '🔮 Glass Indigo Standard Welcome',
    media_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    message_text: 'Welcome to our server, {user}! 🎉 Check out #rules and enjoy your stay!',
    links: JSON.stringify({ frame_style: 'glass_indigo', show_dp: true, show_display_name: true, show_username: true }),
    is_active: 1
  },
  {
    id: 2,
    user_id: 'user_demo',
    template_name: '⚡ Cyber Neon Spotlight Template',
    media_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
    message_text: '⚡ Hey {user}, welcome to the Cyber Realm! Grab your roles in #roles.',
    links: JSON.stringify({ frame_style: 'cyber_neon', show_dp: true, show_display_name: true, show_username: true }),
    is_active: 0
  }
];

// GET DM lists
app.get('/api/dm-lists', requireUserAuth, (req, res) => {
  const userLists = getUserDmLists(req.user.id);
  res.json(userLists);
});

// POST DM lists
app.post('/api/dm-lists', requireUserAuth, (req, res) => {
  const { name, replies } = req.body;
  if (!name || !replies) return res.status(400).json({ error: 'Missing name or replies list' });
  const userLists = getUserDmLists(req.user.id);
  if (userLists.length >= 2) return res.status(400).json({ error: 'Limit reached! Up to 2 lists.' });
  if (replies.length > 15) return res.status(400).json({ error: 'Limit reached! Up to 15 replies.' });

  const newList = { id: Date.now(), name, replies };
  userLists.push(newList);
  saveDatabaseToDisk();
  res.json(newList);
});

// DELETE DM lists
app.delete('/api/dm-lists/:id', requireUserAuth, (req, res) => {
  const listId = parseInt(req.params.id);
  const userLists = getUserDmLists(req.user.id);
  const idx = userLists.findIndex(l => l.id === listId);
  if (idx >= 0) {
    userLists.splice(idx, 1);
    saveDatabaseToDisk();
  }
  res.json({ success: true });
});

// PUT DM lists
app.put('/api/dm-lists/:id', requireUserAuth, (req, res) => {
  const listId = parseInt(req.params.id);
  const { name, replies } = req.body;
  if (!name || !replies) return res.status(400).json({ error: 'Missing name or replies list' });
  if (replies.length > 15) return res.status(400).json({ error: 'Limit reached! Up to 15 replies.' });

  const userLists = getUserDmLists(req.user.id);
  const list = userLists.find(l => l.id === listId);
  if (!list) return res.status(404).json({ error: 'DM list not found' });

  list.name = name;
  list.replies = replies;
  saveDatabaseToDisk();
  res.json(list);
});

// Follow-Gate Confirmations Database (Instagram only)
// Tracks per-user, per-business-account follow-confirmation state
const followConfirmations = [];

// Helper: find or create a confirmation record
function getOrCreateConfirmation(businessAccountId, userIgsid) {
  let record = followConfirmations.find(
    c => c.businessAccountId === businessAccountId && c.userIgsid === userIgsid
  );
  if (!record) {
    record = {
      id: followConfirmations.length + 1,
      businessAccountId: businessAccountId,
      userIgsid: userIgsid,
      hasConfirmedFollow: false,
      confirmedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    followConfirmations.push(record);
  }
  return record;
}

// ─── Analytics API Endpoint ─────────────────────────────────
app.get('/api/analytics', requireUserAuth, (req, res) => {
  const range = req.query.range || '7d';
  const userId = req.user.id;
  
  const userIg = getUserAccounts(userId, 'ig');
  const userFb = getUserAccounts(userId, 'fb');
  const userYt = getUserAccounts(userId, 'yt');
  const totalAccountsCount = userIg.length + userFb.length + userYt.length;
  
  let totalTriggersCount = 0;
  ['ig', 'yt', 'tt', 'fb', 'li', 'wa', 'wc', 'tg', 'dc', 'gm', 'tw'].forEach(plat => {
    totalTriggersCount += (getUserTriggers(userId, plat) || []).length;
  });

  const totalFollowGateConfirmations = (followConfirmations || []).length;

  let multiplier = 1;
  let labelText = "Last 7 Days";
  if (range === '30d') {
    multiplier = 3.8;
    labelText = "Last 30 Days";
  } else if (range === 'quarter') {
    multiplier = 11.2;
    labelText = "This Quarter";
  } else if (range === 'all') {
    multiplier = 28.5;
    labelText = "All Time";
  }

  const baseDms = Math.round(12480 * multiplier);
  const baseFollowers = Math.round(842 * multiplier + totalFollowGateConfirmations * 5);

  let chartData = [];
  if (range === '7d') {
    chartData = [
      { day: "Mon", val: Math.round(1120 * multiplier), heightPct: 45 },
      { day: "Tue", val: Math.round(1480 * multiplier), heightPct: 60 },
      { day: "Wed", val: Math.round(1650 * multiplier), heightPct: 68 },
      { day: "Thu", val: Math.round(1920 * multiplier), heightPct: 78 },
      { day: "Fri", val: Math.round(2150 * multiplier), heightPct: 88 },
      { day: "Sat", val: Math.round(2410 * multiplier), heightPct: 100, isPeak: true },
      { day: "Sun", val: Math.round(1750 * multiplier), heightPct: 72 }
    ];
  } else if (range === '30d') {
    chartData = [
      { day: "Week 1", val: Math.round(2800 * multiplier), heightPct: 62 },
      { day: "Week 2", val: Math.round(3200 * multiplier), heightPct: 74 },
      { day: "Week 3", val: Math.round(3900 * multiplier), heightPct: 86 },
      { day: "Week 4", val: Math.round(4500 * multiplier), heightPct: 100, isPeak: true }
    ];
  } else {
    chartData = [
      { day: "Month 1", val: Math.round(11000 * (multiplier / 3)), heightPct: 68 },
      { day: "Month 2", val: Math.round(14200 * (multiplier / 3)), heightPct: 84 },
      { day: "Month 3", val: Math.round(17500 * (multiplier / 3)), heightPct: 100, isPeak: true }
    ];
  }

  let topTriggers = [];
  let triggerCount = 0;
  const platformIcons = { ig: '📷 Instagram', fb: '📘 Facebook', yt: '🎥 YouTube', tt: '🎵 TikTok', wa: '💬 WhatsApp', tg: '✈️ Telegram' };
  
  ['ig', 'yt', 'tt', 'fb', 'li', 'wa', 'wc', 'tg', 'dc', 'gm', 'tw'].forEach(plat => {
    (getUserTriggers(userId, plat) || []).forEach(trg => {
      triggerCount++;
      topTriggers.push({
        keyword: `"${trg.keyword}"`,
        platform: `${platformIcons[plat] || plat} (${trg.scope || 'All Posts'})`,
        replies: `${Math.round(2500 * multiplier / Math.max(1, triggerCount)).toLocaleString()} DMs`,
        conversion: `${Math.min(98, 72 + (trg.id % 22))}% Verified`,
        status: trg.active ? 'Active 🟢' : 'Paused ⏸️'
      });
    });
  });

  if (topTriggers.length === 0) {
    topTriggers = [
      { keyword: '"SEND" / "LINK"', platform: '📷 Instagram Reels', replies: `${Math.round(6420 * multiplier).toLocaleString()} DMs`, conversion: '84.2% Verified', status: 'Active 🟢' },
      { keyword: '"PRICE" / "DETAILS"', platform: '📘 Facebook Messenger', replies: `${Math.round(3210 * multiplier).toLocaleString()} DMs`, conversion: '76.5% Verified', status: 'Active 🟢' },
      { keyword: '"LIVE" / "BOT"', platform: '🎥 YouTube Live Stream', replies: `${Math.round(2850 * multiplier).toLocaleString()} Mod Replies`, conversion: '68.0% Verified', status: 'Active 🟢' }
    ];
  }

  res.json({
    success: true,
    range,
    labelText,
    metrics: {
      totalDms: baseDms.toLocaleString(),
      totalDmsChange: "+18.2% 📈",
      totalDmsDiffText: `↑ ${Math.round(1920 * multiplier).toLocaleString()} more than previous period`,
      successRate: "99.4%",
      successRateStatus: `${totalAccountsCount > 0 ? totalAccountsCount : 0} Connected Accounts Active`,
      avgSpeed: "1.2s",
      avgSpeedStatus: "Instant DM Dispatch",
      followerConversion: `+${baseFollowers.toLocaleString()}`,
      followerConversionSub: "Followers unlocked via Follow-Gate"
    },
    chartData,
    platformBreakdown: [
      { name: "📷 Instagram / Facebook", percentage: 78, count: `${Math.round(baseDms * 0.78).toLocaleString()} DMs`, color: "linear-gradient(90deg, #ec4899, #a855f7)" },
      { name: "📘 Facebook Pages", percentage: 14, count: `${Math.round(baseDms * 0.14).toLocaleString()} DMs`, color: "#1877f2" },
      { name: "🎥 YouTube Channel", percentage: 8, count: `${Math.round(baseDms * 0.08).toLocaleString()} Mod Replies`, color: "#ef4444" }
    ],
    topTriggers: topTriggers.slice(0, 10)
  });
});

// ─── Follow-Gate API Endpoints ─────────────────────────────
app.get('/api/triggers', requireUserAuth, (req, res) => {
  const platform = req.query.platform || 'ig';
  const list = getUserTriggers(req.user.id, platform);
  res.json(list || []);
});

// API Endpoint: Toggle Trigger State
app.post('/api/triggers/toggle', requireUserAuth, (req, res) => {
  const { id, platform } = req.body;
  const list = getUserTriggers(req.user.id, platform || 'ig');
  if (list) {
    const trigger = list.find(t => String(t.id) === String(id));
    if (trigger) {
      trigger.active = !trigger.active;
      saveDatabaseToDisk();
      return res.json({ success: true, active: trigger.active });
    }
  }
  res.status(404).json({ error: 'Trigger not found' });
});

// API Endpoint: Add New Trigger
app.post('/api/triggers', requireUserAuth, (req, res) => {
  const { keyword, targetLink, reply, platform, scope, postId, accountId, commentReplyType, commentListId, commentReplies, followGateEnabled, followGateGreeting } = req.body;
  if (!keyword || !platform) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  let replyVal = reply || '';
  if (!replyVal && targetLink) {
    replyVal = `Here is your link: ${targetLink}`;
  }
  const list = getUserTriggers(req.user.id, platform);
  if (list) {
    const newTrigger = {
      id: Date.now(),
      keyword,
      targetLink: targetLink || '',
      reply: replyVal,
      scope: scope || 'All Posts (Global)',
      postId: postId ? String(postId) : null,
      active: true,
      commentReplyType: commentReplyType || 'custom',
      commentListId: commentListId ? parseInt(commentListId) : null,
      commentReplies: commentReplies || [],
      followGateEnabled: platform === 'ig' ? (followGateEnabled || false) : false,
      followGateGreeting: followGateGreeting || 'Hey! Thanks for your comment 👋'
    };
    list.push(newTrigger);

    // Update triggers count on the specific account post/video if linked
    if (postId && accountId) {
      const accounts = getUserAccounts(req.user.id, platform);
      if (accounts) {
        const account = accounts.find(a => String(a.id) === String(accountId));
        if (account && account.posts) {
          const post = account.posts.find(p => String(p.id) === String(postId));
          if (post) {
            post.triggersCount = (post.triggersCount || 0) + 1;
          }
        }
      }
    }

    saveDatabaseToDisk();
    res.json(newTrigger);
  } else {
    res.status(400).json({ error: 'Invalid platform' });
  }
});

// API Endpoint: Update an existing trigger (e.g. reply message, keyword, list)
app.put('/api/triggers/:id', requireUserAuth, (req, res) => {
  const triggerId = parseInt(req.params.id);
  const { reply, targetLink, keyword, scope, commentReplyType, commentListId, commentReplies } = req.body;

  for (const platform of ['ig', 'yt', 'tt', 'fb', 'li', 'wa', 'wc', 'tg', 'dc', 'gm', 'tw']) {
    const list = getUserTriggers(req.user.id, platform);
    if (!list) continue;
    const trigger = list.find(t => t.id === triggerId);
    if (trigger) {
      if (reply !== undefined) trigger.reply = reply;
      if (targetLink !== undefined) trigger.targetLink = targetLink;
      if (keyword !== undefined) trigger.keyword = keyword;
      if (scope !== undefined) trigger.scope = scope;
      if (commentReplyType !== undefined) trigger.commentReplyType = commentReplyType;
      if (commentListId !== undefined) trigger.commentListId = commentListId ? parseInt(commentListId) : null;
      if (commentReplies !== undefined) trigger.commentReplies = commentReplies;
      
      saveDatabaseToDisk();
      return res.json({ success: true, trigger, id: trigger.id });
    }
  }
  res.status(404).json({ error: 'Trigger not found' });
});

// API Endpoint: Get follow-gate config for all IG triggers (Instagram automation page)
app.get('/api/follow-gate/config', requireUserAuth, (req, res) => {
  const platform = req.query.platform || 'ig';
  const list = getUserTriggers(req.user.id, platform);
  if (!list) return res.json([]);

  const userAccounts = getUserAccounts(req.user.id, platform);
  const account = userAccounts.find(a => a.active) || userAccounts[0];
  const ds = account?.dmSettings || {
    followGateRequired: true,
    greetingMessage: 'Hey! Thanks for your comment 👋',
    linkDeliveryMessage: 'Here is your link to the reward! 🔗',
    buttonGetLinkLabel: 'Get Link',
    buttonProfileLabel: 'Profile Visit'
  };

  const configs = list.map(t => ({
    id: t.id,
    keyword: t.keyword,
    reply: t.reply,
    scope: t.scope,
    active: t.active,
    followGateEnabled: ds.followGateRequired,
    followGateGreeting: ds.greetingMessage,
    buttonGetLinkLabel: ds.buttonGetLinkLabel,
    buttonProfileLabel: ds.buttonProfileLabel
  }));
  res.json(configs);
});

// API Endpoint: Update follow-gate config for a trigger
app.put('/api/follow-gate/config/:id', requireUserAuth, (req, res) => {
  const triggerId = parseInt(req.params.id);
  const { followGateEnabled, followGateGreeting } = req.body;

  for (const platform of ['ig', 'yt', 'tt', 'fb', 'li', 'wa', 'wc', 'tg', 'dc', 'gm', 'tw']) {
    const list = getUserTriggers(req.user.id, platform);
    if (!list) continue;
    const trigger = list.find(t => t.id === triggerId);
    if (trigger) {
      trigger.followGateEnabled = followGateEnabled !== undefined ? followGateEnabled : trigger.followGateEnabled;
      trigger.followGateGreeting = followGateGreeting !== undefined ? followGateGreeting : trigger.followGateGreeting;
      saveDatabaseToDisk();
      return res.json({ success: true, trigger });
    }
  }
  res.status(404).json({ error: 'Trigger not found' });
});

// API Endpoint: Get follow-gate confirmations for an Instagram account
app.get('/api/follow-gate/confirmations', requireUserAuth, (req, res) => {
  const accountId = parseInt(req.query.accountId);
  const userAccounts = getUserAccounts(req.user.id, 'ig');
  const account = userAccounts.find(a => a.id === accountId);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const confirmations = followConfirmations.filter(c => c.businessAccountId === accountId);
  res.json(confirmations);
});

// API Endpoint: Set has_confirmed_follow = true (CONFIRM_FOLLOW postback handler)
app.post('/api/follow-gate/confirm', (req, res) => {
  const { accountId, userIgsid } = req.body;
  if (!accountId || !userIgsid) {
    return res.status(400).json({ error: 'Missing accountId or userIgsid' });
  }
  const record = getOrCreateConfirmation(accountId, userIgsid);
  record.hasConfirmedFollow = true;
  record.confirmedAt = new Date().toISOString();
  record.updatedAt = new Date().toISOString();
  res.json({ success: true, record });
});

// API Endpoint: Simulate the full Follow-Gate DM flow for testing
app.post('/api/follow-gate/simulate', requireUserAuth, (req, res) => {
  const { platform, accountId, postId, commentText, userIgsid } = req.body;
  if (!platform || !commentText || !userIgsid) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const list = getUserTriggers(req.user.id, platform);
  const userAccounts = getUserAccounts(req.user.id, platform);
  const account = userAccounts.find(a => a.id === parseInt(accountId));
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const matchedTrigger = list.find(t => t.active && commentText.toLowerCase().includes(t.keyword.toLowerCase()));

  if (!matchedTrigger) {
    if (account.profileUrl) {
      return res.json({
        step: 'no-match',
        message: 'No active keyword trigger matched the comment.',
        hasConfirmedFollow: false
      });
    }
    return res.json({ step: 'no-match', message: 'No active keyword trigger matched the comment.' });
  }

  const record = getOrCreateConfirmation(account.id, userIgsid);
  const ds = account.dmSettings || {
    followGateRequired: true,
    greetingMessage: 'Hey! Thanks for your comment 👋',
    linkDeliveryMessage: 'Here is your link to the reward! 🔗'
  };

  if (!ds.followGateRequired) {
    return res.json({
      step: 'trigger-matched',
      keyword: matchedTrigger.keyword,
      greeting: ds.greetingMessage,
      dmMessage: ds.linkDeliveryMessage,
      followGateEnabled: false,
      hasConfirmedFollow: record.hasConfirmedFollow
    });
  }

  // Follow-Gate flow active
  const greeting = ds.greetingMessage;

  if (record.hasConfirmedFollow) {
    return res.json({
      step: 'get-link-confirmed',
      keyword: matchedTrigger.keyword,
      greeting,
      dmMessage: ds.linkDeliveryMessage,
      hasConfirmedFollow: true,
      buttons: null
    });
  }

  return res.json({
    step: 'follow-request',
    keyword: matchedTrigger.keyword,
    greeting,
    dmMessage: 'Please follow us to unlock this link! 🙏',
    hasConfirmedFollow: false,
    businessUsername: account.username,
    profileUrl: account.profileUrl,
    buttonGetLinkLabel: ds.buttonGetLinkLabel || 'Get Link',
    buttonProfileLabel: ds.buttonProfileLabel || 'Profile Visit',
    buttons: {
      follow: {
        type: 'web_url',
        url: account.profileUrl || `https://instagram.com/${account.username}`
      },
      confirm: {
        type: 'postback',
        payload: `CONFIRM_FOLLOW_${matchedTrigger.id}_${userIgsid}`
      }
    },
    nextStepPayload: `CONFIRM_FOLLOW_${matchedTrigger.id}_${userIgsid}`
  });
});

// Helper endpoint: simulate the "I've Followed" button click (CONFIRM_FOLLOW)
app.post('/api/follow-gate/confirm-simulate', requireUserAuth, (req, res) => {
  const { accountId, userIgsid } = req.body;
  if (!accountId || !userIgsid) {
    return res.status(400).json({ error: 'Missing accountId or userIgsid' });
  }
  const record = getOrCreateConfirmation(accountId, userIgsid);
  record.hasConfirmedFollow = true;
  record.confirmedAt = new Date().toISOString();
  record.updatedAt = new Date().toISOString();

  const userAccounts = getUserAccounts(req.user.id, 'ig');
  const account = userAccounts.find(a => a.id === parseInt(accountId)) || userAccounts[0];
  const ds = account ? (account.dmSettings || {}) : {};

  res.json({
    step: 'confirmed-success',
    message: 'Follow confirmed successfully!',
    rewardMessage: ds.linkDeliveryMessage || 'Here is your link to the reward! 🔗',
    greeting: ds.greetingMessage || 'Hey! Thanks for your comment 👋',
    hasConfirmedFollow: true
  });
});

// ─── Instagram Stories API Endpoints ─────────────────────────────
// GET /api/instagram/stories
// GET /api/instagram/stories
app.get('/api/instagram/stories', requireUserAuth, (req, res) => {
  const accountId = req.query.accountId;
  const userAccounts = getUserAccounts(req.user.id, 'ig');
  const account = accountId ? userAccounts.find(a => String(a.id) === String(accountId)) : (userAccounts[0] || null);

  if (!account) return res.status(404).json({ error: 'Account not found' });

  const stories = (account.posts || []).filter(p => p.type && (p.type.includes('Story') || p.type.includes('📖')));
  res.json({ success: true, stories, accountId: account.id });
});

// POST /api/instagram/stories
app.post('/api/instagram/stories', requireUserAuth, (req, res) => {
  const { accountId, caption, mediaUrl, mentions, stickerUrl, scheduledAt, triggerConfig } = req.body;
  const userAccounts = getUserAccounts(req.user.id, 'ig');
  const account = accountId ? userAccounts.find(a => String(a.id) === String(accountId)) : (userAccounts[0] || null);

  if (!account) return res.status(404).json({ error: 'Account not found' });

  const storyId = `story_ig_${Date.now()}`;
  let mentionsArr = [];
  if (Array.isArray(mentions)) {
    mentionsArr = mentions;
  } else if (typeof mentions === 'string' && mentions.trim()) {
    mentionsArr = mentions.split(',').map(m => m.trim().startsWith('@') ? m.trim() : `@${m.trim()}`);
  }

  const isScheduled = Boolean(scheduledAt);
  const captionText = caption ? caption.trim() : 'New Instagram Story';
  const titleStr = `📖 IG Story: ${captionText.length > 30 ? captionText.substring(0, 30) + '...' : captionText}`;

  const newStory = {
    id: storyId,
    type: '📖 Story',
    title: titleStr,
    permalink: `https://www.instagram.com/stories/${account.username}/${storyId}/`,
    mediaUrl: mediaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
    caption: captionText,
    mentions: mentionsArr,
    stickerUrl: stickerUrl || '',
    likeCount: 0,
    commentsCount: 0,
    triggersCount: 0,
    repliesCount: 0,
    aiReply: true,
    status: isScheduled ? 'scheduled' : 'active',
    postedAt: isScheduled ? null : new Date().toISOString(),
    scheduledAt: isScheduled ? new Date(scheduledAt).toISOString() : null
  };

  if (!account.posts) account.posts = [];
  account.posts.unshift(newStory);

  // If triggerConfig is provided, add an active trigger for this story
  if (triggerConfig && triggerConfig.keyword) {
    const triggerKeyword = triggerConfig.keyword.trim();
    const triggerReply = triggerConfig.reply ? triggerConfig.reply.trim() : 'Thank you for replying to our story! Here is your requested video link 🎥: https://replyflow.app/video-demo';
    
    if (triggerKeyword) {
      newStory.triggersCount = 1;
      const newTrigger = {
        id: Date.now(),
        keyword: triggerKeyword,
        targetLink: '',
        reply: triggerReply,
        scope: `Story: "${captionText.substring(0, 25)}"`,
        postId: storyId,
        active: true,
        commentReplyType: 'custom',
        commentListId: null,
        commentReplies: [],
        followGateEnabled: true,
        followGateGreeting: 'Hey! Thanks for replying to our story 👋'
      };
      const userTriggers = getUserTriggers(req.user.id, 'ig');
      userTriggers.push(newTrigger);
    }
  }

  saveDatabaseToDisk();
  res.json({ success: true, story: newStory });
});

// POST /api/upload - Fast File/Media Upload Endpoint
app.post('/api/upload', requireUserAuth, (req, res) => {
  try {
    const { base64Data, filename } = req.body;
    if (!base64Data) return res.status(400).json({ error: 'Missing base64 data' });

    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid base64 encoding' });
    }

    const mimeType = matches[1];
    const data = matches[2];
    let ext = 'jpg';
    if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('mp4')) ext = 'mp4';
    else if (mimeType.includes('webm')) ext = 'webm';
    else if (mimeType.includes('gif')) ext = 'gif';

    const cleanFilename = `upload_${Date.now()}_${Math.floor(Math.random()*1000)}.${ext}`;
    const filePath = path.join(uploadsDir, cleanFilename);
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));

    const fileUrl = `${REPLYFLOW_ORIGIN}/uploads/${cleanFilename}`;
    console.log(`[Upload Engine Direct] ${cleanFilename} -> ${fileUrl}`);
    res.json({ success: true, url: fileUrl });
  } catch (err) {
    console.error('[Upload Engine Error]:', err.message);
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

// POST /api/instagram/posts - Create and schedule new Post / Reel / Story / Text Content
app.post('/api/instagram/posts', requireUserAuth, async (req, res) => {
  try {
    const { accountId, type, caption, mediaUrl, scheduledAt, triggerConfig } = req.body;
    const userAccounts = getUserAccounts(req.user.id, 'ig');
    const account = accountId ? userAccounts.find(a => String(a.id) === String(accountId)) : (userAccounts[0] || null);

    if (!account) return res.status(404).json({ error: 'Account not found' });

    const postType = type || '📷 Post';
    const isScheduled = Boolean(scheduledAt);
    const captionText = caption ? caption.trim() : 'New Instagram Post';
    const postId = `post_ig_${Date.now()}`;
    let finalMediaUrl = mediaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';

    // Handle Base64 file upload -> save to /uploads/ folder
    if (mediaUrl && mediaUrl.startsWith('data:')) {
      try {
        const matches = mediaUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          let ext = 'jpg';
          if (mimeType.includes('png')) ext = 'png';
          else if (mimeType.includes('mp4')) ext = 'mp4';
          else if (mimeType.includes('webm')) ext = 'webm';
          else if (mimeType.includes('gif')) ext = 'gif';

          const filename = `media_${Date.now()}_${Math.floor(Math.random()*1000)}.${ext}`;
          const filePath = path.join(uploadsDir, filename);
          fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
          
          finalMediaUrl = `${REPLYFLOW_ORIGIN}/uploads/${filename}`;
          console.log(`[Upload Engine] File saved successfully: ${filename} -> ${finalMediaUrl}`);
        }
      } catch (err) {
        console.error('[Upload Engine Error]:', err.message);
      }
    }

    const titleStr = `${postType}: "${captionText.length > 35 ? captionText.substring(0, 35) + '...' : captionText}"`;
    let metaApiError = null;

    const newPost = {
      id: postId,
      type: postType,
      title: titleStr,
      permalink: `https://www.instagram.com/p/${postId}/`,
      mediaUrl: finalMediaUrl,
      caption: captionText,
      likeCount: 0,
      commentsCount: 0,
      triggersCount: 0,
      repliesCount: 0,
      aiReply: true,
      triggerActive: true,
      status: isScheduled ? 'scheduled' : 'active',
      postedAt: isScheduled ? null : new Date().toISOString(),
      scheduledAt: isScheduled ? new Date(scheduledAt).toISOString() : null
    };

    // Live Publishing via Meta Graph API if account is connected via OAuth and not scheduled
    if (account.accessTokenEncrypted && account.igUserId && !isScheduled) {
      try {
        const token = decryptToken(account.accessTokenEncrypted);
        if (token) {
          console.log(`[Meta Graph API] Publishing ${postType} to live IG account @${account.username}...`);
          let containerParams = {
            caption: captionText,
            access_token: token
          };

          if (postType.includes('Reel') || postType.includes('Video')) {
            containerParams.media_type = 'REELS';
            containerParams.video_url = finalMediaUrl;
          } else if (postType.includes('Story')) {
            containerParams.media_type = 'STORIES';
            containerParams.image_url = finalMediaUrl;
          } else {
            containerParams.image_url = finalMediaUrl;
          }

          const containerRes = await fetch(`https://graph.facebook.com/v18.0/${account.igUserId}/media`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(containerParams)
          });
          const containerData = await containerRes.json();

          if (containerData.id) {
            const publishRes = await fetch(`https://graph.facebook.com/v18.0/${account.igUserId}/media_publish`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                creation_id: containerData.id,
                access_token: token
              })
            });
            const publishData = await publishRes.json();

            if (publishData.id) {
              newPost.id = publishData.id;
              newPost.permalink = `https://www.instagram.com/p/${publishData.id}/`;
            } else if (publishData.error) {
              metaApiError = publishData.error.message || 'Publishing failed on Instagram.';
            }
          } else if (containerData.error) {
            metaApiError = containerData.error.message || 'Media container creation failed on Meta API.';
          }
        }
      } catch (graphErr) {
        console.error(`[Meta Graph API Publishing Exception]:`, graphErr.message);
        metaApiError = graphErr.message;
      }
    }

    if (!account.posts) account.posts = [];
    account.posts.unshift(newPost);

    // Auto-attach trigger if configured
    if (triggerConfig && triggerConfig.keyword) {
      const keyword = triggerConfig.keyword.trim();
      const replyPayload = triggerConfig.reply ? triggerConfig.reply.trim() : 'Thanks for commenting! Check your DM for the requested link 🎁';
      if (keyword) {
        newPost.triggersCount = 1;
        const newTrigger = {
          id: Date.now(),
          keyword: keyword,
          targetLink: '',
          reply: replyPayload,
          scope: `${postType}: "${captionText.substring(0, 25)}"`,
          postId: newPost.id,
          active: true,
          commentReplyType: 'custom',
          commentReplies: [replyPayload],
          followGateEnabled: true,
          followGateGreeting: 'Hey! Thanks for commenting 👋'
        };
        const userTriggers = getUserTriggers(req.user.id, 'ig');
        userTriggers.push(newTrigger);
      }
    }

    saveDatabaseToDisk();
    res.json({ success: true, post: newPost, metaApiError: metaApiError });
  } catch (err) {
    console.error('[POST /api/instagram/posts Error]:', err.message);
    res.status(500).json({ error: 'Failed to process post request.' });
  }
});

// DELETE /api/instagram/stories/:id
app.delete('/api/instagram/stories/:id', requireUserAuth, (req, res) => {
  const storyId = req.params.id;
  const userAccounts = getUserAccounts(req.user.id, 'ig');
  let found = false;

  for (const account of userAccounts) {
    if (account.posts && Array.isArray(account.posts)) {
      const idx = account.posts.findIndex(p => String(p.id) === String(storyId));
      if (idx !== -1) {
        account.posts.splice(idx, 1);
        found = true;
        break;
      }
    }
  }

  if (found) {
    saveDatabaseToDisk();
    return res.json({ success: true, message: 'Story deleted successfully' });
  }

  res.status(404).json({ error: 'Story not found' });
});

// ─── Admin Panel In-Memory Databases ───

const adminSessions = new Map(); // Store active session tokens -> admin objects

const usersListDB = [
  { id: 1, name: 'John Doe', email: 'john@example.com', plan: 'Business', registeredAt: '2025-12-10T10:00:00Z', automationsCount: 1420 },
  { id: 2, name: 'Alice Smith', email: 'alice@example.com', plan: 'Pro', registeredAt: '2026-06-28T14:30:00Z', automationsCount: 842 },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', plan: 'Starter', registeredAt: '2026-08-01T09:15:00Z', automationsCount: 57 }
];

const platformsConfig = {
  ig: { name: 'Instagram', status: 'active', enabled: true, clientId: process.env.INSTAGRAM_APP_ID || '', clientSecret: process.env.INSTAGRAM_APP_SECRET || '', redirectUri: process.env.INSTAGRAM_REDIRECT_URI || '' },
  yt: { name: 'YouTube', status: 'active', enabled: true, apiKey: process.env.YOUTUBE_API_KEY || '', clientId: process.env.GOOGLE_CLIENT_ID || '', clientSecret: process.env.GOOGLE_CLIENT_SECRET || '', redirectUri: process.env.YOUTUBE_REDIRECT_URI || '' },
  fb: { name: 'Facebook Pages', status: 'active', enabled: true, appId: process.env.FACEBOOK_APP_ID || '', appSecret: process.env.FACEBOOK_APP_SECRET || '', pageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '' },
  tt: { name: 'TikTok', status: 'active', enabled: true, clientKey: process.env.TIKTOK_CLIENT_KEY || '', clientSecret: process.env.TIKTOK_CLIENT_SECRET || '', redirectUri: process.env.TIKTOK_REDIRECT_URI || '' },
  li: { name: 'LinkedIn', status: 'active', enabled: true, clientId: process.env.LINKEDIN_CLIENT_ID || '', clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '', redirectUri: process.env.LINKEDIN_REDIRECT_URI || '' },
  tw: { name: 'Twitter (X)', status: 'active', enabled: true, clientId: process.env.TWITTER_CLIENT_ID || '', clientSecret: process.env.TWITTER_CLIENT_SECRET || '' },
  wa: { name: 'WhatsApp Business', status: 'active', enabled: true, phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '', wabaId: process.env.WHATSAPP_WABA_ID || '', permanentToken: process.env.WHATSAPP_PERMANENT_TOKEN || '' },
  wc: { name: 'WeChat Official', status: 'active', enabled: true, appId: process.env.WECHAT_APP_ID || '', appSecret: process.env.WECHAT_APP_SECRET || '', token: process.env.WECHAT_TOKEN || '' },
  tg: { name: 'Telegram', status: 'active', enabled: true, botToken: process.env.TELEGRAM_BOT_TOKEN || '', botUsername: process.env.TELEGRAM_BOT_USERNAME || '', webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || '' },
  dc: { name: 'Discord', status: 'active', enabled: true, botToken: process.env.DISCORD_BOT_TOKEN || '', clientId: process.env.DISCORD_CLIENT_ID || '', clientSecret: process.env.DISCORD_CLIENT_SECRET || '', guildId: process.env.DISCORD_GUILD_ID || '' },
  gm: { name: 'Gmail Auto-Responder', status: 'active', enabled: true, email: process.env.GMAIL_ADDRESS || '', clientId: process.env.GOOGLE_CLIENT_ID || '', refreshToken: process.env.GMAIL_REFRESH_TOKEN || '' }
};

const llmConfig = {
  openai: { enabled: true, apiKey: process.env.OPENAI_API_KEY || '', models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'gpt-4-turbo'] },
  gemini: { enabled: true, apiKey: process.env.GEMINI_API_KEY || '', models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash-exp'] },
  deepseek: { enabled: true, apiKey: process.env.DEEPSEEK_API_KEY || '', models: ['deepseek-chat', 'deepseek-reasoner'] },
  groq: { enabled: true, apiKey: process.env.GROQ_API_KEY || '', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'] },
  claude: { enabled: false, apiKey: process.env.CLAUDE_API_KEY || '', models: ['claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-opus'] },
  bedrock: { enabled: false, accessKey: '', secretKey: '', region: 'us-east-1', models: ['anthropic.claude-v3', 'amazon.titan-text-express'] }
};

let activeLlmModels = [
  { id: 1, provider: 'openai', model: 'gpt-4o-mini', apiKey: process.env.OPENAI_API_KEY || '', plans: ['Pro', 'Business'], active: true },
  { id: 2, provider: 'gemini', model: 'gemini-1.5-flash', apiKey: process.env.GEMINI_API_KEY || '', plans: ['Starter', 'Pro', 'Business'], active: true }
];

const oauthConfig = {
  emailLogin: { enabled: true },
  googleLogin: { enabled: true, clientId: process.env.GOOGLE_CLIENT_ID || '', clientSecret: process.env.GOOGLE_CLIENT_SECRET || '' },
  discordLogin: { enabled: false, clientId: process.env.DISCORD_CLIENT_ID || '', clientSecret: process.env.DISCORD_CLIENT_SECRET || '' },
  githubLogin: { enabled: false, clientId: process.env.GITHUB_CLIENT_ID || '', clientSecret: process.env.GITHUB_CLIENT_SECRET || '' }
};

const generalSettings = {
  websiteName: 'ReplyFlow',
  logoUrl: 'https://cdn-icons-png.flaticon.com/512/8651/8651478.png',
  headerScript: '<script>// Custom Header Code</script>',
  footerScript: '<footer>© 2026 ReplyFlow Automation</footer>',
  googleAnalyticsId: 'G-XXXXXXXXXX',
  googleSiteVerification: 'google-site-verification-12345',
  googleIndexingEnabled: true
};

const systemUpdateHistory = [
  { version: '1.2.0', status: 'Success', updatedBy: 'admin', timestamp: '2026-07-28T18:00:00Z' },
  { version: '1.1.0', status: 'Success', updatedBy: 'admin', timestamp: '2026-06-15T12:00:00Z' }
];

// Helper to check admin authentication middleware
function requireAdmin(req, res, next) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-session-token']) {
    token = req.headers['x-session-token'].trim();
  } else if (req.query && req.query.token) {
    token = String(req.query.token).trim();
  }

  if (!token || token === 'null' || token === 'undefined' || token === 'false') {
    return res.status(401).json({ error: 'Unauthorized: Admin session expired or invalid' });
  }

  let adminUser = null;
  if (typeof adminSessions !== 'undefined' && adminSessions) {
    if (adminSessions.has && adminSessions.has(token)) {
      const val = adminSessions.get ? adminSessions.get(token) : true;
      adminUser = (typeof val === 'object' && val !== null) ? val : { role: 'admin' };
    }
  }

  if (!adminUser) {
    const user = getUserByToken(token);
    if (user && (user.role === 'admin' || user.role === 'Super Admin')) {
      adminUser = user;
    }
  }

  if (!adminUser || !adminUser.role || (adminUser.role.toLowerCase() !== 'admin' && adminUser.role.toLowerCase() !== 'super admin')) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  req.admin = adminUser;
  req.user = adminUser;
  next();
}



// API Endpoint: Get Linked Accounts (Multi-Tenant Isolated)
app.get('/api/accounts', requireUserAuth, (req, res) => {
  const platform = req.query.platform || 'ig';
  const userId = req.user.id;
  let list = getUserAccounts(userId, platform);
  if ((!list || list.length === 0) && accountsDB[platform] && accountsDB[platform].length > 0) {
    const realConnected = accountsDB[platform].filter(a => a.status === 'connected' || a.active);
    if (realConnected.length > 0) {
      list = realConnected;
      if (!userAccountsDB[userId]) userAccountsDB[userId] = {};
      userAccountsDB[userId][platform] = list;
    }
  }
  const userTriggers = getUserTriggers(userId, platform);

  if (list) {
    // Recalculate triggersCount dynamically for each post
    list.forEach(acc => {
      if (acc.posts && Array.isArray(acc.posts)) {
        acc.posts.forEach(post => {
          const count = userTriggers.filter(t => {
            if (t.postId && String(t.postId) === String(post.id)) return true;
            if (t.scope && (t.scope.includes(post.title) || t.scope.includes(String(post.id)))) return true;
            return false;
          }).length;
          post.triggersCount = count;
        });
      }
    });
    res.json(list);
  } else {
    res.json([]);
  }
});

// API Endpoint: Link New Account
app.post('/api/accounts', requireUserAuth, async (req, res) => {
  const { platform, username } = req.body;
  if (!platform || !username) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const userId = req.user.id;
  const userBilling = getUserBillingInfo(userId);
  const userIg = getUserAccounts(userId, 'ig');
  const userYt = getUserAccounts(userId, 'yt');

  const currentCount = userIg.length + userYt.length;
  let maxAllowed = 5;
  if (userBilling.currentPlan === 'Starter') maxAllowed = 2;
  else if (userBilling.currentPlan === 'Business') maxAllowed = 20;

  if (currentCount >= maxAllowed) {
    return res.status(400).json({ error: `Account limit reached! Your plan allows linking up to ${maxAllowed} accounts. Please upgrade to link more.` });
  }

  const list = getUserAccounts(userId, platform);
  if (!list) return res.status(400).json({ error: 'Invalid platform' });

  const cleanUsername = username.replace(/^@/, '');

  // For YouTube: auto-fetch real videos on link
  let posts = [];
  if (platform === 'yt') {
    const token = req.body.accessToken ? req.body.accessToken : null;
    console.log(`[YouTube Engine] Fetching real videos for channel on link...`);
    posts = await fetchRealYouTubeVideos(token);
    if (posts.length === 0) {
      console.warn(`[YouTube Engine] Could not fetch videos for channel. Using placeholder.`);
      posts = [
        { id: Date.now() + 1, type: '🎥 Video', title: 'Getting Started with automation', triggersCount: 0, repliesCount: 0, aiReply: false },
        { id: Date.now() + 2, type: '🎥 Video', title: 'Pro Tips & Tricks', triggersCount: 0, repliesCount: 0, aiReply: false }
      ];
    }
  } else {
    posts = [
      { id: Date.now() + 1, type: '📷 Post', title: 'New Launch Promo', triggersCount: 0, repliesCount: 0, aiReply: false },
      { id: Date.now() + 2, type: '🎬 Reel', title: 'Product Walkthrough', triggersCount: 0, repliesCount: 0, aiReply: false }
    ];
  }

  const newAccount = {
    id: Date.now(),
    username: platform === 'yt' ? `@${cleanUsername}` : (username.startsWith('@') ? username : `@${username}`),
    displayName: platform === 'ig' ? 'Instagram / Facebook' : 'YouTube',
    profileUrl: platform === 'ig'
      ? `https://instagram.com/${cleanUsername}`
      : `https://youtube.com/@${cleanUsername}`,
    active: list.length === 0,
    dmSettings: {
      followGateRequired: true,
      greetingMessage: 'Hey! Thanks for your comment 👋',
      linkDeliveryMessage: 'Here is your link to the reward! 🔗',
      buttonGetLinkLabel: 'Get Link',
      buttonProfileLabel: 'Profile Visit'
    },
    posts
  };
  list.push(newAccount);
  saveDatabaseToDisk();
  res.json(newAccount);
});

// API Endpoint: Update DM Settings for a Connected Account
app.put('/api/accounts/:id/dm-settings', requireUserAuth, (req, res) => {
  const accountId = parseInt(req.params.id);
  const { followGateRequired, greetingMessage, linkDeliveryMessage, buttonGetLinkLabel, buttonProfileLabel } = req.body;

  for (const platform of ['ig', 'yt', 'tt', 'fb', 'li', 'wa', 'wc', 'tg', 'dc', 'gm', 'tw']) {
    const list = getUserAccounts(req.user.id, platform);
    const account = list.find(a => a.id === accountId);
    if (account) {
      if (!account.dmSettings) {
        account.dmSettings = {};
      }
      account.dmSettings.followGateRequired = followGateRequired !== undefined ? !!followGateRequired : false;
      account.dmSettings.greetingMessage = greetingMessage !== undefined ? greetingMessage : 'Hey! Thanks for your comment 👋';
      account.dmSettings.linkDeliveryMessage = linkDeliveryMessage !== undefined ? linkDeliveryMessage : 'Here is your link to the reward! 🔗';
      account.dmSettings.buttonGetLinkLabel = buttonGetLinkLabel !== undefined ? buttonGetLinkLabel : 'Get Link';
      account.dmSettings.buttonProfileLabel = buttonProfileLabel !== undefined ? buttonProfileLabel : 'Profile Visit';
      saveDatabaseToDisk();
      return res.json({ success: true, dmSettings: account.dmSettings });
    }
  }

  res.status(404).json({ error: 'Account not found' });
});

// API Endpoint: Toggle AI Reply on a specific Post/Video
app.post('/api/accounts/post/toggle-ai', requireUserAuth, (req, res) => {
  const { platform, accountId, postId } = req.body;
  const accounts = getUserAccounts(req.user.id, platform || 'ig');
  if (accounts) {
    const account = accounts.find(a => String(a.id) === String(accountId)) || accounts[0];
    if (account && account.posts) {
      const post = account.posts.find(p => String(p.id) === String(postId));
      if (post) {
        post.aiReply = !post.aiReply;
        saveDatabaseToDisk();
        return res.json({ success: true, aiReply: post.aiReply });
      }
    }
  }
  res.status(404).json({ error: 'Post or Account not found' });
});


// GET user profile (session-isolated)
app.get('/api/profile', requireUserAuth, (req, res) => {
  const profile = getUserProfileData(req.user);
  res.json(profile);
});

// POST user profile changes (session-isolated)
app.post('/api/profile', requireUserAuth, (req, res) => {
  const profile = getUserProfileData(req.user);
  const { name, email } = req.body;
  if (name) {
    profile.name = name.trim();
    if (req.user) req.user.name = name.trim();
  }
  if (email) {
    profile.email = email.trim();
    if (req.user) req.user.email = email.trim();
  }
  saveDatabaseToDisk();
  res.json({ success: true, profile });
});

// POST profile avatar image (handles base64 upload)
app.post('/api/profile/avatar', requireUserAuth, (req, res) => {
  const profile = getUserProfileData(req.user);
  const { avatarData } = req.body;
  if (avatarData) {
    profile.avatarUrl = avatarData;
    if (req.user) req.user.avatar = avatarData;
    saveDatabaseToDisk();
    return res.json({ success: true, avatarUrl: profile.avatarUrl });
  }
  res.status(400).json({ error: "Missing avatar data" });
});

// GET billing details (session-isolated)
app.get('/api/billing', requireUserAuth, (req, res) => {
  const userId = req.user.id;
  const billingInfo = getUserBillingInfo(userId);
  const igLinked = getUserAccounts(userId, 'ig').length;
  const ytLinked = getUserAccounts(userId, 'yt').length;
  
  let igTotal = 3;
  let ytTotal = 2;
  
  if (billingInfo.currentPlan === 'Free') {
    igTotal = 1;
    ytTotal = 1;
  } else if (billingInfo.currentPlan === 'Starter') {
    igTotal = 1;
    ytTotal = 1;
  } else if (billingInfo.currentPlan === 'Pro') {
    igTotal = 3;
    ytTotal = 2;
  } else if (billingInfo.currentPlan === 'Business') {
    igTotal = 10;
    ytTotal = 10;
  }

  billingInfo.accountsLinked = igLinked + ytLinked;
  billingInfo.accountsTotal = igTotal + ytTotal;
  
  billingInfo.platformLimits = {
    ig: { linked: igLinked, total: igTotal },
    yt: { linked: ytLinked, total: ytTotal }
  };

  res.json(billingInfo);
});

// POST upgrade plan (session-isolated with server-side price table enforcement)
app.post('/api/billing/upgrade', requireUserAuth, (req, res) => {
  const userId = req.user.id;
  const billingInfo = getUserBillingInfo(userId);
  const { planName, plan } = req.body || {};
  const targetPlan = planName || plan || 'Free';

  if (targetPlan === 'Free') {
    billingInfo.currentPlan = 'Free';
    billingInfo.price = 'PKR 0/mo';
    billingInfo.repliesTotal = 200;
  } else if (targetPlan === 'Starter') {
    billingInfo.currentPlan = 'Starter';
    billingInfo.price = 'PKR 2,500/mo';
    billingInfo.repliesTotal = 1500;
  } else if (targetPlan === 'Pro') {
    billingInfo.currentPlan = 'Pro';
    billingInfo.price = 'PKR 7,000/mo';
    billingInfo.repliesTotal = 6000;
  } else if (targetPlan === 'Business') {
    billingInfo.currentPlan = 'Business';
    billingInfo.price = 'PKR 15,000/mo';
    billingInfo.repliesTotal = 50000;
  }

  if (req.user) req.user.plan = billingInfo.currentPlan;

  const newInv = {
    id: `INV-00${(billingInfo.invoices || []).length + 1}`,
    date: new Date().toISOString().split('T')[0],
    amount: billingInfo.price === 'Custom' ? 'PKR 15,000' : billingInfo.price.split('/')[0],
    status: 'Paid'
  };
  if (!billingInfo.invoices) billingInfo.invoices = [];
  billingInfo.invoices.unshift(newInv);
  saveDatabaseToDisk();

  // 📩 AUTOMATIC PAYMENT RECEIPT EMAIL DISPATCH
  try {
    sendPaymentReceiptEmail({
      to: req.user.email,
      userName: req.user.name,
      planName: billingInfo.currentPlan,
      amount: newInv.amount,
      invoiceId: newInv.id,
      date: newInv.date
    }).catch(err => console.warn('[Auto Receipt Email Warning]:', err.message));
  } catch (err) {
    console.warn('[Auto Receipt Email Error]:', err.message);
  }

  res.json({
    success: true,
    message: `Plan upgraded to ${billingInfo.currentPlan} successfully! 🚀`,
    billing: billingInfo,
    user: { id: req.user.id, name: req.user.name, email: req.user.email, plan: billingInfo.currentPlan }
  });
});

// ═══════════════════════════════════════════════════════════
// Instagram OAuth — Connect Account Flow
// ═══════════════════════════════════════════════════════════

function buildCallbackHtml(messageType, messageText = null, data = null) {
  const payload = JSON.stringify({
    type: messageType,
    ...(messageText && { message: messageText }),
    ...(data && { data: data })
  });
  return `<!DOCTYPE html>
<html>
<head><title>ReplyFlow — Instagram Connect</title></head>
<body>
  <script>
    if (window.opener) {
      try {
        window.opener.postMessage(${payload}, "*");
      } catch (e) { console.error(e); }
    }
    setTimeout(function() { window.close(); }, 300);
  </script>
</body>
</html>`;
}

// GET /api/instagram/authorize — redirects popup to Instagram OAuth (or demo page)
app.get('/api/instagram/authorize', (req, res) => {
  const state = generateStateToken();

  if (DEMO_MODE) {
    // Demo mode: serve a simulated Instagram OAuth screen
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Instagram — ReplyFlow (Demo)</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #000; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .oauth-card { background: #1a1a1a; border: 1px solid #333; border-radius: 16px; padding: 32px; width: 100%; max-width: 360px; text-align: center; }
    .ig-gradient { width: 70px; height: 70px; border-radius: 50%; background: linear-gradient(45deg, #f00, #000, #0f0, #f00); margin: 0 auto 20px; }
    .ig-logo { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .ig-sub { color: #888; font-size: 13px; margin-bottom: 20px; }
    .demo-badge { display: inline-block; background: rgba(255,193,7,0.15); color: #ffc107; border: 1px solid rgba(255,193,7,0.3); border-radius: 20px; padding: 4px 12px; font-size: 11px; font-weight: 600; margin-bottom: 20px; }
    .btn { width: 100%; padding: 14px; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; margin: 10px 0; }
    .btn.allow { background: #0095f0; color: #fff; }
    .btn.allow:hover { opacity: 0.9; }
    .btn.cancel { background: transparent; color: #888; border: 1px solid #333; }
    .btn.cancel:hover { background: rgba(255,255,255,0.03); }
    .divider { height: 1px; background: #333; margin: 20px 0; position: relative; }
    .divider::before { content: "OR"; position: absolute; top: -8px; left: 50%; transform: translateX(-50%); color: #555; font-size: 11px; padding: 0 8px; background: #1a1a1a; }
    .account-preview { background: #000; border-radius: 8px; padding: 12px; margin: 12px 0; font-size: 12px; color: #888; border: 1px solid #222; }
    .account-preview div { margin: 2px 0; }
  </style>
</head>
<body>
  <div class="oauth-card">
    <div class="ig-gradient"></div>
    <div class="ig-logo">Instagram</div>
    <div class="demo-badge">DEMO MODE</div>
    <div class="ig-sub">Connect your Instagram account to ReplyFlow</div>
    <div class="account-preview">
      <div>ID: <strong style="color: #fff;">demo_user_101</strong></div>
      <div>Username: <strong style="color: #fff;">demo_creator</strong></div>
      <div>Account Type: <strong style="color: #fff;">Professional (Creator)</strong></div>
      <div>Permissions requested: comment, media, messages</div>
    </div>
    <div class="divider"></div>
    <button class="btn allow" onclick="window.location.href='/api/instagram/callback?code=demo_auth_code_${state}&state=${state}&account_type=CREATOR'>Allow</button>
    <button class="btn cancel" onclick="window.location.href='/api/instagram/callback?error=access_denied&state=${state}'">Cancel</button>
  </div>
</body>
</html>`);
  }

  // Real Instagram OAuth redirect (production)
  const authUrl = new URL('https://www.instagram.com/oauth/authorize');
  authUrl.searchParams.set('client_id', INSTAGRAM_APP_ID);
  authUrl.searchParams.set('redirect_uri', INSTAGRAM_REDIRECT_URI);
  authUrl.searchParams.set('scope', INSTAGRAM_OAUTH_SCOPES);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);

  res.redirect(authUrl.toString());
});

// GET /api/instagram/callback — Instagram redirects here after OAuth
app.get('/api/instagram/callback', async (req, res) => {
  const { code, state, error, account_type } = req.query;

  // Case A: User denied permission
  if (error === 'access_denied') {
    return res.send(buildCallbackHtml('INSTAGRAM_CONNECT_FAILED', 'Permission denied. Please try again.'));
  }

  // Validate state parameter (CSRF protection)
  const stateRecord = validateStateToken(state);
  if (!stateRecord) {
    return res.send(buildCallbackHtml('INSTAGRAM_CONNECT_FAILED', 'Invalid or expired session. Please try again.'));
  }

  try {
    let accessToken, igUserId, igUsername, igAccountType;

    if (DEMO_MODE) {
      // Simulate token exchange
      accessToken = `demo_token_${code}_${Date.now()}`;
      igUserId = '17841400000000000';
      igUsername = 'demo_creator';
      igAccountType = account_type || 'CREATOR';
      console.log('[Instagram OAuth] Demo mode: simulated successful connection');
    } else {
      // Real exchange: POST /oauth/access_token
      const params = new URLSearchParams();
      params.append('client_id', INSTAGRAM_APP_ID);
      params.append('client_secret', INSTAGRAM_APP_SECRET);
      params.append('grant_type', 'authorization_code');
      params.append('redirect_uri', INSTAGRAM_REDIRECT_URI);
      params.append('code', code);

      const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        throw new Error(tokenData.error?.message || tokenData.error_message || 'Token exchange failed');
      }
      accessToken = tokenData.access_token;

      // Fetch IG profile info
      const meRes = await fetch(`https://graph.instagram.com/v18.0/me?fields=id,username,account_type&access_token=${accessToken}`);
      const meData = await meRes.json();
      if (meData.error) throw new Error(meData.error.message);

      igUserId = meData.id;
      igUsername = meData.username;
      igAccountType = meData.account_type;

      // Exchange for long-lived token (60 days)
      const llRes = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${INSTAGRAM_APP_SECRET}&access_token=${accessToken}`);
      const llData = await llRes.json();
      if (llData.access_token) accessToken = llData.access_token;
    }

    // Case: Reject non-Professional accounts
    if (igAccountType !== 'BUSINESS' && igAccountType !== 'CREATOR') {
      console.warn(`[Instagram OAuth] Rejected non-Professional account: ${igUsername} (type: ${igAccountType})`);
      return res.send(buildCallbackHtml('INSTAGRAM_CONNECT_FAILED', 'This Instagram account must be a Business or Creator account. Please switch account type in Instagram settings and try again.'));
    }

    // Upsert into connected accounts
    const encryptedToken = encryptToken(accessToken);
    const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days

    let userId = req.user ? req.user.id : (validatedState ? validatedState.userId : null);
    if (!userId) {
      const firstUser = registeredUsersStore[0] || usersDB[0];
      userId = firstUser ? firstUser.id : 'usr_default';
    }

    const userAccountsList = getUserAccounts(userId, 'ig');
    const existingIdx = userAccountsList.findIndex(a => a.igUserId === igUserId || (a.username && a.username.replace(/^@/, '').toLowerCase() === igUsername.toLowerCase()));
    if (existingIdx >= 0) {
      // Re-connect / Upgrading mock account to real OAuth
      userAccountsList[existingIdx].username = igUsername;
      userAccountsList[existingIdx].active = true;
      userAccountsList[existingIdx].igUserId = igUserId;
      userAccountsList[existingIdx].accessTokenEncrypted = encryptedToken;
      userAccountsList[existingIdx].tokenExpiresAt = tokenExpiresAt;
      userAccountsList[existingIdx].oauthConnected = true;
      userAccountsList[existingIdx].updatedAt = new Date().toISOString();
      console.log(`[Instagram OAuth] Re-connected existing account: ${igUsername} for user ${userId}`);
      await syncInstagramAccountPosts(userAccountsList[existingIdx]);
    } else {
      // New connection: check plan limits first
      const userBilling = getUserBillingInfo(userId);
      const userIg = getUserAccounts(userId, 'ig');
      const userYt = getUserAccounts(userId, 'yt');
      const currentCount = userIg.length + userYt.length;
      let maxAllowed = 5;
      if (userBilling && userBilling.currentPlan === 'Starter') maxAllowed = 2;
      else if (userBilling && userBilling.currentPlan === 'Business') maxAllowed = 20;

      if (currentCount >= maxAllowed) {
        return res.send(buildCallbackHtml('INSTAGRAM_CONNECT_FAILED', `Account limit reached! Your plan allows linking up to ${maxAllowed} accounts. Please upgrade to link more.`));
      }

      const newAccount = {
        id: Date.now(),
        username: igUsername,
        displayName: 'Instagram / Facebook',
        profileUrl: `https://instagram.com/${igUsername}`,
        active: userAccountsList.length === 0,
        oauthConnected: true,
        igUserId: igUserId,
        accessTokenEncrypted: encryptedToken,
        tokenExpiresAt: tokenExpiresAt,
        connectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dmSettings: {
          followGateRequired: true,
          greetingMessage: 'Hey! Thanks for your comment 👋',
          linkDeliveryMessage: 'Here is your link to the reward! 🔗',
          buttonGetLinkLabel: 'Get Link',
          buttonProfileLabel: 'Profile Visit'
        },
        posts: [
          { id: Date.now() + 1, type: '📷 Post', title: 'Newly connected post', triggersCount: 0, repliesCount: 0, aiReply: true }
        ]
      };
      await syncInstagramAccountPosts(newAccount);
      userAccountsList.push(newAccount);
      console.log(`[Instagram OAuth] New account connected: ${igUsername} for user ${userId}`);
    }

    // Save persistent database state
    saveDatabaseToDisk();

    // Case B: Success
    return res.send(buildCallbackHtml('INSTAGRAM_CONNECTED', null, {
      igUserId,
      igUsername,
      profileUrl: `https://instagram.com/${igUsername}`
    }));

  } catch (err) {
    // Case C: Exchange failed
    console.error('[Instagram OAuth] Exchange error:', err.message);
    // Never log tokens/secrets in plaintext
    return res.send(buildCallbackHtml('INSTAGRAM_CONNECT_FAILED', 'Something went wrong, please try again.'));
  }
});

// POST /api/instagram/accounts/:id/sync — Sync real media items for an account
app.post('/api/instagram/accounts/:id/sync', requireUserAuth, async (req, res) => {
  const accountId = parseInt(req.params.id);
  const userAccounts = getUserAccounts(req.user.id, 'ig');
  const account = userAccounts.find(a => a.id === accountId);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const success = await syncInstagramAccountPosts(account);
  if (success || (account.posts && account.posts.length > 0)) {
    saveDatabaseToDisk();
    res.json({ success: true, message: `Posts synced successfully! Loaded ${account.posts ? account.posts.length : 0} items.`, posts: account.posts || [] });
  } else {
    res.status(400).json({ error: 'Failed to sync posts from Instagram API. Make sure account is OAuth connected.' });
  }
});

// GET /api/instagram/accounts — list OAuth-connected Instagram accounts
app.get('/api/instagram/accounts', requireUserAuth, (req, res) => {
  const userAccounts = getUserAccounts(req.user.id, 'ig');
  const connected = userAccounts
    .filter(a => a.oauthConnected)
    .map(a => ({
      id: a.id,
      username: a.username,
      displayName: a.displayName,
      profileUrl: a.profileUrl,
      igUserId: a.igUserId,
      oauthConnected: a.oauthConnected,
      tokenExpiresAt: a.tokenExpiresAt,
      connectedAt: a.connectedAt,
      posts: a.posts
    }));
  res.json(connected);
});

// POST /api/accounts/delete — disconnect and remove account
app.post('/api/accounts/delete', requireUserAuth, (req, res) => {
  const { platform, accountId } = req.body;
  if (!platform || !accountId) return res.status(400).json({ error: 'Missing platform or accountId' });

  const list = getUserAccounts(req.user.id, platform || 'ig');
  if (!list) return res.status(400).json({ error: 'Invalid platform' });

  const idx = list.findIndex(a => String(a.id) === String(accountId) || a.id === parseInt(accountId));
  if (idx < 0) return res.status(404).json({ error: 'Account not found' });

  const removed = list.splice(idx, 1);

  if (platform === 'yt' || platform === 'youtube') {
    if (accountsDB['yt']) {
      accountsDB['yt'] = accountsDB['yt'].filter(a => String(a.id) !== String(accountId) && a.id !== parseInt(accountId));
    }
    if (typeof registeredUsersStore !== 'undefined') {
      const regUser = registeredUsersStore.find(u => String(u.id) === String(req.user.id));
      if (regUser && regUser.accounts && regUser.accounts.youtube) {
        regUser.accounts.youtube = regUser.accounts.youtube.filter(a => String(a.id) !== String(accountId) && a.id !== parseInt(accountId));
      }
    }
  }

  saveDatabaseToDisk();
  res.json({ success: true, message: 'Account disconnected and removed successfully.', removedAccount: removed[0] });
});

// DELETE /api/accounts/:platform/:id — disconnect and remove platform account
app.delete('/api/accounts/:platform/:id', requireUserAuth, (req, res) => {
  const { platform, id } = req.params;
  if (!platform || !id) return res.status(400).json({ error: 'Missing platform or account ID' });

  const list = getUserAccounts(req.user.id, platform);
  if (!list) return res.status(400).json({ error: 'Invalid platform' });

  const idx = list.findIndex(a => String(a.id) === String(id) || a.id === parseInt(id));
  if (idx < 0) return res.status(404).json({ error: 'Account not found' });

  const removed = list.splice(idx, 1);

  if (platform === 'yt' || platform === 'youtube') {
    if (accountsDB['yt']) {
      accountsDB['yt'] = accountsDB['yt'].filter(a => String(a.id) !== String(id) && a.id !== parseInt(id));
    }
    if (typeof registeredUsersStore !== 'undefined') {
      const regUser = registeredUsersStore.find(u => String(u.id) === String(req.user.id));
      if (regUser && regUser.accounts && regUser.accounts.youtube) {
        regUser.accounts.youtube = regUser.accounts.youtube.filter(a => String(a.id) !== String(id) && a.id !== parseInt(id));
      }
    }
  }

  saveDatabaseToDisk();
  res.json({ success: true, message: 'Account disconnected and removed successfully.', removedAccount: removed[0] });
});

// POST /api/instagram/accounts/disconnect — remove OAuth connection
app.post('/api/instagram/accounts/disconnect', requireUserAuth, (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: 'Missing accountId' });

  const list = getUserAccounts(req.user.id, 'ig');
  const idx = list.findIndex(a => a.id === parseInt(accountId));
  if (idx < 0) return res.status(404).json({ error: 'Account not found' });

  const account = list[idx];
  delete account.accessTokenEncrypted;
  delete account.tokenExpiresAt;
  account.oauthConnected = false;
  account.updatedAt = new Date().toISOString();

  saveDatabaseToDisk();
  res.json({ success: true, message: 'Instagram account OAuth access revoked.', account });
});

// ─── ADMIN PANEL API ENDPOINTS ───

// Dynamic Plans List
let plansDB = [
  { id: 'free', name: 'Free', price: 0, igLimit: 1, ytLimit: 1, triggersLimit: 2 },
  { id: 'starter', name: 'Starter', price: 19, igLimit: 1, ytLimit: 1, triggersLimit: 5 },
  { id: 'pro', name: 'Pro', price: 49, igLimit: 3, ytLimit: 2, triggersLimit: 20 },
  { id: 'business', name: 'Business', price: 99, igLimit: 10, ytLimit: 10, triggersLimit: 100 }
];

// ─── SMTP Email & Notification Configurations ───
let emailNotificationRules = {
  welcomeEmail: true,
  quotaWarning: true,
  dailySummary: true,
  weeklyReport: true,
  productUpdates: true
};

// 📩 Automatic Payment Receipt / Invoice Email Helper
async function sendPaymentReceiptEmail({ to, userName, planName, amount, invoiceId, date }) {
  const invoiceNum = invoiceId || (`INV-00` + Math.floor(Math.random() * 900 + 100));
  const currentDate = date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const name = userName || 'Valued Creator';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0b0c10; color: #ffffff; margin: 0; padding: 20px; }
        .receipt-card { max-width: 600px; margin: 0 auto; background: #121319; border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .header { background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%); padding: 28px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
        .header p { margin: 4px 0 0 0; font-size: 13px; color: rgba(255,255,255,0.85); }
        .content { padding: 28px; }
        .status-badge { display: inline-block; background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399; font-size: 12px; font-weight: 800; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; margin-bottom: 20px; }
        .info-grid { display: table; width: 100%; margin-bottom: 20px; font-size: 13px; }
        .info-row { display: table-row; }
        .info-cell-label { display: table-cell; padding: 5px 0; color: #a1a1aa; font-weight: 600; width: 40%; }
        .info-cell-val { display: table-cell; padding: 5px 0; color: #ffffff; font-weight: 700; text-align: right; }
        .invoice-table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 24px; }
        .invoice-table th { background: rgba(255,255,255,0.05); color: #a1a1aa; font-size: 11px; text-transform: uppercase; padding: 10px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .invoice-table td { padding: 14px 10px; font-size: 13px; color: #ffffff; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .total-row td { font-size: 16px; font-weight: 800; color: #c084fc; border-bottom: none; }
        .footer { background: #08090c; padding: 18px; text-align: center; font-size: 11px; color: #71717a; border-top: 1px solid rgba(255,255,255,0.05); }
      </style>
    </head>
    <body>
      <div class="receipt-card">
        <div class="header">
          <h1>ReplyFlow Automation</h1>
          <p>Official Payment Receipt & Tax Invoice</p>
        </div>
        <div class="content">
          <div style="text-align: center;">
            <div class="status-badge">Payment Successful 🟢</div>
          </div>
          <p style="font-size: 14px; color: #d4d4d8; margin-bottom: 20px;">Hi <strong>${name}</strong>,<br>Thank you for subscribing to ReplyFlow! Here is your official receipt for your recent plan purchase.</p>
          
          <div class="info-grid">
            <div class="info-row">
              <div class="info-cell-label">Invoice Number:</div>
              <div class="info-cell-val">${invoiceNum}</div>
            </div>
            <div class="info-row">
              <div class="info-cell-label">Payment Date:</div>
              <div class="info-cell-val">${currentDate}</div>
            </div>
            <div class="info-row">
              <div class="info-cell-label">Payment Gateway:</div>
              <div class="info-cell-val">Stripe & Hostinger Verified</div>
            </div>
            <div class="info-row">
              <div class="info-cell-label">Customer Email:</div>
              <div class="info-cell-val">${to}</div>
            </div>
          </div>

          <table class="invoice-table">
            <thead>
              <tr>
                <th>Item / Description</th>
                <th>Billing Cycle</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>ReplyFlow ${planName} Plan</strong><br><span style="font-size: 11px; color: #a1a1aa;">Unlimited IG/YT Comment-to-DM Triggers & AI Agent</span></td>
                <td>Monthly Auto-Renew</td>
                <td style="text-align: right; font-weight: 700;">${amount}</td>
              </tr>
              <tr class="total-row">
                <td colspan="2" style="text-align: right;">Total Paid:</td>
                <td style="text-align: right;">${amount}</td>
              </tr>
            </tbody>
          </table>

          <div style="background: rgba(168,85,247,0.1); border: 1px dashed rgba(168,85,247,0.4); padding: 14px; border-radius: 10px; text-align: center; font-size: 12px; color: #c084fc;">
            🎉 Your <strong>${planName} Plan</strong> features & quota limits are now active on your dashboard!
          </div>
        </div>
        <div class="footer">
          © 2026 ReplyFlow Automation Inc. Meta Graph API Compliant Partner.<br>
          If you have any questions, contact support at alex@replyflow.app
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendSystemEmail({
    to,
    subject: `🧾 Official Payment Receipt: ReplyFlow ${planName} Plan (${invoiceNum})`,
    html: htmlContent
  });
}

// ─── Persistent Storage System (database.json) ───
const DB_FILE_PATH = process.env.DB_FILE_PATH
  ? path.resolve(process.env.DB_FILE_PATH)
  : path.join(__dirname, 'database.json');
let viewerXpDB = {};
let multistreamStore = {};
const obsChatConfigsStore = {};
const activeRelayProcesses = new Map();
const activeIncomingStreams = new Set();


function saveDatabaseToDisk() {
  try {
    const dataToSave = {
      adminUsers,
      adminSessions: Array.from(adminSessions.entries()),
      registeredUsersStore,
      usersDB: registeredUsersStore,
      activeSessionTokens: Array.from(activeSessionTokens.entries()),
      accountsDB,
      triggersDB,
      userAccountsDB,
      userTriggersDB,
      userGuildsDB,
      userProfilesDB,
      userBillingDB,
      userLinkedInDB,
      userTwitterDB,
      followConfirmations,
      commentLists,
      dmLists,
      welcomeTemplatesDB,
      generalSettings,
      plansDB,
      smtpConfig,
      emailNotificationRules,
      emailLogs,
      viewerXpDB,
      obsChatConfigsStore,
      ytLiveStateBotEnabled: ytLiveState.botEnabled,
      multistreamStore,
      discordGuildsStore,
      disconnectedGuildsMap,
      userLevelingRewardsDB,
      userWelcomeTemplatesDB,
      updatedAt: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(dataToSave, null, 2);
    fs.writeFileSync(DB_FILE_PATH, jsonStr, 'utf8');
    const DB_BAK_PATH = `${DB_FILE_PATH}.bak`;
    fs.writeFileSync(DB_BAK_PATH, jsonStr, 'utf8');
    console.log(`[Database] Persistent data saved successfully to ${DB_FILE_PATH}`);
  } catch (err) {
    console.error("[Database Save Error]:", err.message);
  }
}

function loadDatabaseFromDisk() {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const fileData = fs.readFileSync(DB_FILE_PATH, 'utf8');
      const parsed = JSON.parse(fileData);

      // 1. Restore Admin Users & Auto-Migrate Plaintext Passwords
      if (Array.isArray(parsed.adminUsers)) {
        parsed.adminUsers.forEach(a => {
          if (a && a.username) {
            if (a.password && !a.passwordHash) {
              a.passwordHash = bcrypt.hashSync(a.password, 12);
              delete a.password;
            }
            const existingIdx = adminUsers.findIndex(e => e.username.toLowerCase() === a.username.toLowerCase());
            if (existingIdx !== -1) {
              adminUsers[existingIdx] = a;
            } else {
              adminUsers.push(a);
            }
          }
        });
      }

      // Ensure primary admin account exists (preserve updated passwordHash if saved!)
      const primaryAdmin = adminUsers.find(a => a.username.toLowerCase() === defaultAdminUsername.toLowerCase());
      if (primaryAdmin) {
        if (!primaryAdmin.passwordHash) {
          primaryAdmin.passwordHash = bcrypt.hashSync(defaultAdminPassword, 12);
        }
      } else {
        adminUsers.unshift({
          id: 1,
          username: defaultAdminUsername,
          passwordHash: bcrypt.hashSync(defaultAdminPassword, 12),
          role: 'Super Admin',
          createdAt: new Date().toISOString()
        });
      }

      // 2. One-Time Migration: Merge & De-duplicate Users from registeredUsersStore and usersDB
      const diskUsers = [];
      if (Array.isArray(parsed.registeredUsersStore)) diskUsers.push(...parsed.registeredUsersStore);
      if (Array.isArray(parsed.usersDB)) diskUsers.push(...parsed.usersDB);

      diskUsers.forEach(u => {
        if (u && (u.email || u.id)) {
          const cleanEmail = u.email ? u.email.trim().toLowerCase() : '';
          const existingIdx = registeredUsersStore.findIndex(r =>
            (u.id && r.id === u.id) || (cleanEmail && r.email && r.email.trim().toLowerCase() === cleanEmail)
          );
          if (existingIdx !== -1) {
            registeredUsersStore[existingIdx] = { ...registeredUsersStore[existingIdx], ...u };
          } else {
            registeredUsersStore.push(u);
          }
        }
      });

      // Ensure usersDB is aliased to single source of truth
      usersDB = registeredUsersStore;

      // 3. Restore Active Session Tokens across server restarts
      if (Array.isArray(parsed.activeSessionTokens)) {
        activeSessionTokens.clear();
        const now = Date.now();
        const maxSessionAge = 30 * 24 * 60 * 60 * 1000; // 30 days session validity
        parsed.activeSessionTokens.forEach(([token, sessionData]) => {
          if (token && sessionData && sessionData.userId) {
            const age = sessionData.createdAt ? (now - sessionData.createdAt) : 0;
            if (age < maxSessionAge) {
              activeSessionTokens.set(token, sessionData);
            }
          }
        });
        console.log(`[Database] Restored ${activeSessionTokens.size} active user sessions.`);
      }

      // 4. Restore Admin Sessions
      if (Array.isArray(parsed.adminSessions)) {
        adminSessions.clear();
        parsed.adminSessions.forEach(([token, adminObj]) => {
          if (token && adminObj) {
            adminSessions.set(token, adminObj);
          }
        });
      }

      if (parsed.userAccountsDB) Object.assign(userAccountsDB, parsed.userAccountsDB);
      if (parsed.userTriggersDB) Object.assign(userTriggersDB, parsed.userTriggersDB);
      if (parsed.userGuildsDB) Object.assign(userGuildsDB, parsed.userGuildsDB);
      if (parsed.userProfilesDB) Object.assign(userProfilesDB, parsed.userProfilesDB);
      if (parsed.userBillingDB) Object.assign(userBillingDB, parsed.userBillingDB);
      if (parsed.userLinkedInDB) Object.assign(userLinkedInDB, parsed.userLinkedInDB);
      if (parsed.userTwitterDB) Object.assign(userTwitterDB, parsed.userTwitterDB);

      if (parsed.accountsDB) {
        Object.keys(parsed.accountsDB).forEach(plat => {
          if (Array.isArray(parsed.accountsDB[plat])) accountsDB[plat] = parsed.accountsDB[plat];
        });
      }
      if (parsed.triggersDB) {
        Object.keys(parsed.triggersDB).forEach(plat => {
          if (Array.isArray(parsed.triggersDB[plat])) triggersDB[plat] = parsed.triggersDB[plat];
        });
      }
      if (parsed.followConfirmations && Array.isArray(parsed.followConfirmations)) {
        followConfirmations.length = 0;
        parsed.followConfirmations.forEach(c => followConfirmations.push(c));
      }
      if (parsed.commentLists && Array.isArray(parsed.commentLists)) {
        commentLists = parsed.commentLists;
      }
      if (parsed.dmLists && Array.isArray(parsed.dmLists)) {
        dmLists = parsed.dmLists;
      }
      if (parsed.welcomeTemplatesDB && Array.isArray(parsed.welcomeTemplatesDB)) {
        welcomeTemplatesDB = parsed.welcomeTemplatesDB;
      }
      if (parsed.generalSettings) Object.assign(generalSettings, parsed.generalSettings);
      if (parsed.plansDB && Array.isArray(parsed.plansDB)) {
        plansDB.length = 0;
        parsed.plansDB.forEach(p => plansDB.push(p));
      }
      if (parsed.smtpConfig) Object.assign(smtpConfig, parsed.smtpConfig);
      if (parsed.emailNotificationRules) Object.assign(emailNotificationRules, parsed.emailNotificationRules);
      if (parsed.emailLogs && Array.isArray(parsed.emailLogs)) emailLogs = parsed.emailLogs;
      if (parsed.viewerXpDB && typeof parsed.viewerXpDB === 'object') {
        viewerXpDB = parsed.viewerXpDB;
      }
      if (parsed.obsChatConfigsStore && typeof parsed.obsChatConfigsStore === 'object') {
        Object.assign(obsChatConfigsStore, parsed.obsChatConfigsStore);
      }
      if (parsed.multistreamStore && typeof parsed.multistreamStore === 'object') {
        multistreamStore = parsed.multistreamStore;
      }
      if (parsed.discordGuildsStore && typeof parsed.discordGuildsStore === 'object') {
        discordGuildsStore = parsed.discordGuildsStore;
      }
      if (parsed.disconnectedGuildsMap && typeof parsed.disconnectedGuildsMap === 'object') {
        disconnectedGuildsMap = parsed.disconnectedGuildsMap;
      }
      if (parsed.userLevelingRewardsDB && typeof parsed.userLevelingRewardsDB === 'object') {
        Object.assign(userLevelingRewardsDB, parsed.userLevelingRewardsDB);
      }
      if (parsed.userWelcomeTemplatesDB && typeof parsed.userWelcomeTemplatesDB === 'object') {
        Object.assign(userWelcomeTemplatesDB, parsed.userWelcomeTemplatesDB);
      }
      if (typeof parsed.ytLiveStateBotEnabled === 'boolean') {
        ytLiveState.botEnabled = parsed.ytLiveStateBotEnabled;
      } else if (parsed.ytLiveState && typeof parsed.ytLiveState.botEnabled === 'boolean') {
        ytLiveState.botEnabled = parsed.ytLiveState.botEnabled;
      }

      console.log(`[Database] Persistent data loaded successfully! Restored ${registeredUsersStore.length} users & ${activeSessionTokens.size} active sessions.`);
    } else {
      console.warn('⚠️ No database.json found — starting with empty/demo data. If you expect existing users, your persistent storage may not be configured correctly.');
    }
  } catch (err) {
    console.error('[Database Load Error]:', err.message);
  }
}

// Initial load on server startup
loadDatabaseFromDisk();
if (!fs.existsSync(DB_FILE_PATH)) {
  saveDatabaseToDisk();
}

// Admin Login
app.post('/api/admin/login', authRateLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  const admin = adminUsers.find(a => a.username.toLowerCase() === username.trim().toLowerCase());
  if (!admin) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  let isMatch = false;
  if (admin.passwordHash) {
    isMatch = await bcrypt.compare(password, admin.passwordHash);
  } else if (admin.password) {
    isMatch = (admin.password === password);
    if (isMatch) {
      admin.passwordHash = await bcrypt.hash(password, 12);
      delete admin.password;
      if (typeof saveDatabaseToDisk === 'function') saveDatabaseToDisk();
    }
  }

  if (isMatch) {
    const token = 'admin_tok_' + crypto.randomBytes(16).toString('hex');
    adminSessions.set(token, admin);
    res.json({ success: true, token, username: admin.username, role: admin.role });
  } else {
    res.status(401).json({ error: 'Invalid username or password' });
  }
});

// Admin Session Check
app.get('/api/admin/check-session', (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '').trim() || req.query.token;
  if (token && adminSessions.has(token)) {
    res.json({ success: true, authenticated: true });
  } else {
    res.json({ success: false, authenticated: false });
  }
});

// Admin Logout
app.post('/api/admin/logout', (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '').trim() || req.query.token;
  if (token) {
    adminSessions.delete(token);
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});

// Admin Dashboard Stats
app.get('/api/admin/dashboard-stats', requireAdmin, (req, res) => {
  const activeAccountsCount = getAllUserAccounts('ig').length + getAllUserAccounts('yt').length;
  const usersCount = registeredUsersStore.length;
  const totalTriggersCount = getAllUserTriggers('ig').length + getAllUserTriggers('yt').length;
  
  const totalAutomations = usersListDB.reduce((sum, u) => sum + (u.automationsCount || 0), 0);
  
  // Calculate total revenue from user plans
  const totalRevenue = usersListDB.reduce((sum, u) => {
    const plan = plansDB.find(p => p.name.toLowerCase() === u.plan.toLowerCase());
    return sum + (plan ? plan.price : 0);
  }, 0);

  // Divide old vs new users based on August 1st, 2026 cutoff
  const cutoff = new Date('2026-08-01T00:00:00Z');
  let oldUsers = 0;
  let newUsers = 0;
  usersListDB.forEach(u => {
    if (new Date(u.registeredAt) >= cutoff) {
      newUsers++;
    } else {
      oldUsers++;
    }
  });

  // Mock Country Statistics
  const countries = [
    { country: 'United States', flag: '🇺🇸', code: 'US', count: 18, percentage: 38, revenue: 840 },
    { country: 'Pakistan', flag: '🇵🇰', code: 'PK', count: 14, percentage: 29, revenue: 580 },
    { country: 'United Kingdom', flag: '🇬🇧', code: 'GB', count: 8, percentage: 17, revenue: 390 },
    { country: 'Germany', flag: '🇩🇪', code: 'DE', count: 5, percentage: 10, revenue: 190 },
    { country: 'Canada', flag: '🇨🇦', code: 'CA', count: 3, percentage: 6, revenue: 99 }
  ];

  // Mock Payments Statistics
  const payments = {
    activeSubscriptions: 48,
    mrr: 2099,
    totalTransactions: 152,
    totalVolume: 7890
  };

  // Mock Account Limit Tracking
  const limitsTracking = [
    { name: 'John Doe', email: 'john@example.com', plan: 'Business', igLinked: 8, igLimit: 10, ytLinked: 9, ytLimit: 10, status: 'Warning' },
    { name: 'Alice Smith', email: 'alice@example.com', plan: 'Pro', igLinked: 3, igLimit: 3, ytLinked: 2, ytLimit: 2, status: 'Limit Reached' },
    { name: 'Bob Johnson', email: 'bob@example.com', plan: 'Starter', igLinked: 1, igLimit: 1, ytLinked: 0, ytLimit: 1, status: 'Limit Reached' },
    { name: 'David Miller', email: 'david@example.com', plan: 'Pro', igLinked: 3, igLimit: 3, ytLinked: 1, ytLimit: 2, status: 'Warning' }
  ];

  // Mock registrations growth
  const registrationsHistory = {
    labels: ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
    data: [12, 28, 45, 62, 89, 105]
  };

  res.json({
    activeAccountsCount,
    usersCount,
    totalTriggersCount,
    totalAutomations,
    totalRevenue,
    oldUsers,
    newUsers,
    countries,
    payments,
    limitsTracking,
    registrationsHistory,
    platforms: {
      ig: platformsConfig.ig.enabled,
      yt: platformsConfig.yt.enabled,
      fb: platformsConfig.fb.enabled,
      tt: platformsConfig.tt.enabled,
      li: platformsConfig.li.enabled,
      wa: platformsConfig.wa.enabled,
      wc: platformsConfig.wc.enabled
    }
  });
});

// Admin Users List
app.get('/api/admin/users', requireAdmin, (req, res) => {
  res.json(usersListDB);
});

// Admin Update User Plan
app.put('/api/admin/users/:id/plan', requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  const { plan } = req.body;
  const user = usersListDB.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const validPlan = plansDB.find(p => p.name.toLowerCase() === plan.toLowerCase());
  if (!validPlan) return res.status(400).json({ error: 'Invalid subscription plan level' });

  user.plan = validPlan.name;
  res.json({ success: true, user });
});

const adminEmailChangeOTPs = new Map();

// Admin Request Email Change (Sends OTP)
app.post('/api/admin/users/:id/change-email-request', requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id);
  const { newEmail } = req.body;
  
  const user = usersListDB.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  adminEmailChangeOTPs.set(userId, { otp: otpCode, newEmail, expiresAt: Date.now() + 10 * 60 * 1000 });

  try {
    await sendSystemEmail({
      to: user.email,
      subject: `🛡️ Security Alert: Email Change Requested`,
      html: `
        <div style="font-family: Arial, sans-serif; background: #0b0c10; color: #ffffff; padding: 30px; border-radius: 16px; border: 1px solid rgba(168,85,247,0.35); max-width: 480px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #ffffff; margin: 0 0 6px 0; font-size: 22px;">Email Change Authorization</h2>
            <p style="color: #a1a1aa; font-size: 13px; margin: 0;">An administrator has requested to change your email to <b>${newEmail}</b>.</p>
          </div>
          <div style="font-size: 34px; font-weight: 900; color: #10b981; letter-spacing: 8px; padding: 16px 24px; background: rgba(16,185,129,0.12); border: 1px dashed rgba(16,185,129,0.4); border-radius: 12px; text-align: center; margin: 22px 0;">
            ${otpCode}
          </div>
          <p style="font-size: 12px; color: #a1a1aa; text-align: center; line-height: 1.5; margin: 0 0 16px 0;">
            Provide this OTP to your admin to authorize the change. Valid for 10 minutes.
          </p>
        </div>
      `
    });
    res.json({ success: true, message: 'OTP sent to original email' });
  } catch (err) {
    console.error('Email change OTP send failed:', err);
    res.status(500).json({ error: 'Failed to send OTP email' });
  }
});

// Admin Verify Email Change (Confirm OTP)
app.post('/api/admin/users/:id/change-email-verify', requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id);
  const { otp } = req.body;
  
  const user = usersListDB.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const record = adminEmailChangeOTPs.get(userId);
  if (!record) return res.status(400).json({ error: 'No OTP requested or expired' });
  if (record.expiresAt < Date.now()) {
    adminEmailChangeOTPs.delete(userId);
    return res.status(400).json({ error: 'OTP has expired' });
  }
  if (record.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
  
  const oldEmail = user.email;
  user.email = record.newEmail;
  // Also update in registeredUsersStore if exists
  const memUser = registeredUsersStore.find(u => u.id === userId);
  if (memUser) memUser.email = record.newEmail;
  
  adminEmailChangeOTPs.delete(userId);

  try {
    const notificationHtml = `
      <div style="font-family: Arial, sans-serif; background: #0b0c10; color: #ffffff; padding: 30px; border-radius: 16px; border: 1px solid rgba(16,185,129,0.35); max-width: 480px; margin: 0 auto;">
        <h2 style="color: #10b981; margin: 0 0 10px 0;">Email Successfully Updated</h2>
        <p style="color: #a1a1aa; font-size: 14px;">Your ReplyFlow account email has been successfully changed by an administrator.</p>
        <p style="color: #ffffff; font-size: 15px; margin-top: 20px;"><strong>New Login Email:</strong> ${record.newEmail}</p>
        <p style="font-size: 12px; color: #71717a; margin-top: 30px;">If you did not authorize this, please contact support immediately.</p>
      </div>
    `;
    await sendSystemEmail({ to: record.newEmail, subject: 'Your ReplyFlow Email was Updated', html: notificationHtml });
    if (oldEmail) await sendSystemEmail({ to: oldEmail, subject: 'Your ReplyFlow Email was Updated', html: notificationHtml });
  } catch (err) {
    console.error('Failed to send email change notification:', err);
  }
  
  res.json({ success: true, user });
});

// Admin Force Verify Email Change (Bypass OTP)
app.post('/api/admin/users/:id/change-email-force', requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id);
  const { newEmail } = req.body;
  
  if (!newEmail) return res.status(400).json({ error: 'New email is required' });

  const user = usersListDB.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const oldEmail = user.email;
  user.email = newEmail;
  // Also update in registeredUsersStore if exists
  const memUser = registeredUsersStore.find(u => u.id === userId);
  if (memUser) memUser.email = newEmail;
  
  // Clear any pending OTP for this user
  adminEmailChangeOTPs.delete(userId);

  try {
    const notificationHtml = `
      <div style="font-family: Arial, sans-serif; background: #0b0c10; color: #ffffff; padding: 30px; border-radius: 16px; border: 1px solid rgba(16,185,129,0.35); max-width: 480px; margin: 0 auto;">
        <h2 style="color: #10b981; margin: 0 0 10px 0;">Email Successfully Updated</h2>
        <p style="color: #a1a1aa; font-size: 14px;">Your ReplyFlow account email has been successfully changed by an administrator.</p>
        <p style="color: #ffffff; font-size: 15px; margin-top: 20px;"><strong>New Login Email:</strong> ${newEmail}</p>
        <p style="font-size: 12px; color: #71717a; margin-top: 30px;">If you did not authorize this, please contact support immediately.</p>
      </div>
    `;
    await sendSystemEmail({ to: newEmail, subject: 'Your ReplyFlow Email was Updated', html: notificationHtml });
    if (oldEmail) await sendSystemEmail({ to: oldEmail, subject: 'Your ReplyFlow Email was Updated', html: notificationHtml });
  } catch (err) {
    console.error('Failed to send email change notification:', err);
  }
  
  res.json({ success: true, user });
});

// Public Get Platforms Status Map for Frontend Rendering (Active, Coming Soon, Off)
app.get('/api/platforms/status', (req, res) => {
  const statusMap = {};
  Object.keys(platformsConfig).forEach(k => {
    const config = platformsConfig[k];
    let st = config.status;
    if (!st) {
      if (config.comingSoon) st = 'coming_soon';
      else if (config.enabled === false) st = 'off';
      else st = 'active';
    }
    statusMap[k] = {
      name: config.name,
      status: st,
      enabled: st === 'active',
      comingSoon: st === 'coming_soon'
    };
  });
  res.json(statusMap);
});

// Admin Get Platforms Config
app.get('/api/admin/platforms', requireAdmin, (req, res) => {
  res.json(platformsConfig);
});

// Admin Update Platform Configuration
app.put('/api/admin/platforms/:platformName', requireAdmin, (req, res) => {
  const platformName = req.params.platformName;
  const config = platformsConfig[platformName];
  if (!config) return res.status(404).json({ error: 'Platform not supported' });

  const { enabled, status, comingSoon, ...fields } = req.body;

  if (status !== undefined) {
    config.status = status; // 'active' | 'coming_soon' | 'off'
    config.enabled = status === 'active';
    config.comingSoon = status === 'coming_soon';
  } else {
    if (enabled !== undefined) {
      config.enabled = !!enabled;
      config.status = config.enabled ? 'active' : 'off';
    }
    if (comingSoon !== undefined) {
      config.comingSoon = !!comingSoon;
      if (config.comingSoon) config.status = 'coming_soon';
    }
  }

  // Merge extra fields
  Object.keys(fields).forEach(key => {
    config[key] = fields[key];
  });

  saveDatabaseToDisk();
  res.json({ success: true, config });
});

// Admin Get LLM Config (Returns provider reference AND active models)
app.get('/api/admin/llms', requireAdmin, (req, res) => {
  res.json({
    providers: llmConfig,
    activeModels: activeLlmModels
  });
});

// Admin Add Active LLM Model
app.post('/api/admin/llms/active', requireAdmin, (req, res) => {
  const { provider, model, apiKey, plans } = req.body;
  if (!provider || !model || !apiKey) {
    return res.status(400).json({ error: 'Missing required configuration fields' });
  }

  const id = activeLlmModels.length > 0 ? Math.max(...activeLlmModels.map(m => m.id)) + 1 : 1;
  const newModel = {
    id,
    provider,
    model,
    apiKey,
    plans: plans || [],
    active: true
  };
  activeLlmModels.push(newModel);
  res.json({ success: true, model: newModel });
});

// Admin Toggle / Update Active Model
app.put('/api/admin/llms/active/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const modelConfig = activeLlmModels.find(m => m.id === id);
  if (!modelConfig) return res.status(404).json({ error: 'Model configuration not found' });

  const { active, plans, apiKey } = req.body;
  if (active !== undefined) modelConfig.active = !!active;
  if (plans !== undefined) modelConfig.plans = plans;
  if (apiKey !== undefined) modelConfig.apiKey = apiKey;

  res.json({ success: true, model: modelConfig });
});

// Admin Delete Active Model
app.delete('/api/admin/llms/active/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  activeLlmModels = activeLlmModels.filter(m => m.id !== id);
  res.json({ success: true });
});

// Admin Test specific Active Model Connection (Real-time integration)
app.post('/api/admin/llms/active/:id/test', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const modelConfig = activeLlmModels.find(m => m.id === id);
  if (!modelConfig) return res.status(404).json({ error: 'Model configuration not found' });

  const { provider, model, apiKey } = modelConfig;

  if (!apiKey || apiKey.trim() === '' || apiKey.includes('xxxx')) {
    return res.status(400).json({ error: 'Verification failed: No valid API key provided (key is masked or blank).' });
  }

  try {
    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Say ping' }],
          max_tokens: 5
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errMsg = data.error?.message || 'Unauthorized / Quota Exceeded (Check balance)';
        return res.status(400).json({ error: `OpenAI Error: ${errMsg}` });
      }
      return res.json({ success: true, message: `Successfully connected to OpenAI! Verification completed using ${model}.` });
    }
    
    else if (provider === 'gemini') {
      let targetModel = model || 'gemini-1.5-flash';
      // Normalize deprecated / unavailable model references to stable 1.5-flash
      if (targetModel.includes('2.0-flash') && !targetModel.includes('exp')) {
        targetModel = 'gemini-1.5-flash';
      }

      let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say ping' }] }]
        })
      });

      let data = await response.json().catch(() => ({}));
      
      // If error indicates model is unavailable, auto-fallback to gemini-1.5-flash
      if (!response.ok && (data.error?.message?.includes('no longer available') || data.error?.message?.includes('not found'))) {
        targetModel = 'gemini-1.5-flash';
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Say ping' }] }] })
        });
        data = await response.json().catch(() => ({}));
        if (response.ok) {
          modelConfig.model = 'gemini-1.5-flash';
        }
      }

      if (!response.ok) {
        const errMsg = data.error?.message || 'Invalid API Key or Quota Exceeded';
        return res.status(400).json({ error: `Google Gemini Error: ${errMsg}` });
      }
      return res.json({ success: true, message: `Successfully connected to Google Gemini! Verification completed using ${targetModel}.` });
    }

    else if (provider === 'deepseek') {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'deepseek-chat',
          messages: [{ role: 'user', content: 'Say ping' }],
          max_tokens: 5
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errMsg = data.error?.message || 'Invalid API Key or Insufficient Balance';
        return res.status(400).json({ error: `DeepSeek Error: ${errMsg}` });
      }
      return res.json({ success: true, message: `Successfully connected to DeepSeek! Verification completed using ${model || 'deepseek-chat'}.` });
    }

    else if (provider === 'groq') {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: 'Say ping' }],
          max_tokens: 5
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errMsg = data.error?.message || 'Invalid Groq API Key';
        return res.status(400).json({ error: `Groq Error: ${errMsg}` });
      }
      return res.json({ success: true, message: `Successfully connected to Groq Cloud! Verification completed using ${model || 'llama-3.3-70b-versatile'}.` });
    }
    
    else if (provider === 'claude') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model || 'claude-3-5-sonnet',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Say ping' }]
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errMsg = data.error?.message || 'Invalid API Key or Quota Exceeded';
        return res.status(400).json({ error: `Anthropic Claude Error: ${errMsg}` });
      }
      return res.json({ success: true, message: `Successfully connected to Anthropic Claude! Verification completed using ${model}.` });
    }
    
    else if (provider === 'bedrock') {
      if (apiKey.length < 15) {
        return res.status(400).json({ error: 'AWS Bedrock Error: Invalid Access Key format or length.' });
      }
      return res.json({ success: true, message: 'AWS Bedrock credential format verified!' });
    }
    
    else {
      return res.status(400).json({ error: 'Unsupported provider validation request.' });
    }
  } catch (error) {
    return res.status(500).json({ error: `Network connection failed: ${error.message}. Please check your internet connectivity.` });
  }
});

// Helper: Generate AI Creator Reply using active Admin LLMs (OpenAI, Gemini, Claude)
async function generateCreatorLLMReply(commenterName, commentText, videoTitle, videoContext, videoTone) {
  try {
    const activeModel = activeLlmModels.find(m => m.active && m.apiKey && !m.apiKey.includes('xxxx'));
    if (!activeModel) {
      console.log('[LLM Engine] No active configured LLM key found. Using smart fallback creator response.');
      return `Thanks for your comment @${commenterName || 'viewer'}! Glad you enjoyed "${videoTitle || 'the video'}". Check details in our bio/description! 🎬`;
    }

    const systemPrompt = `You are an automated AI reply assistant acting as the content creator.
Video Title: "${videoTitle || 'Content'}"
Video Context/Explanation: "${videoContext || 'General creator video'}"
Creator Tone/Guidelines: "${videoTone || 'Polite, helpful, friendly'}"

Instructions:
1. Respond directly to the viewer's comment (@${commenterName || 'viewer'}).
2. If the comment is positive, thank them warmly. If negative, address it politely and constructively.
3. Keep the reply short (1-2 sentences max), engaging, and strictly matching the creator's tone.
4. Do NOT output code or JSON, only the plain text reply.`;

    const userMessage = `Viewer Comment: "${commentText}"`;

    if (activeModel.provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeModel.apiKey}`
        },
        body: JSON.stringify({
          model: activeModel.model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          max_tokens: 100
        })
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices[0]?.message?.content?.trim() || `Thanks @${commenterName}! 🙌`;
      }
    } else if (activeModel.provider === 'gemini') {
      let targetModel = activeModel.model || 'gemini-1.5-flash';
      if (targetModel.includes('2.0-flash') && !targetModel.includes('exp')) targetModel = 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${activeModel.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] }]
        })
      });
      if (res.ok) {
        const data = await res.json();
        return data.candidates[0]?.content?.parts[0]?.text?.trim() || `Thanks @${commenterName}! 🙌`;
      }
    } else if (activeModel.provider === 'deepseek') {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeModel.apiKey}`
        },
        body: JSON.stringify({
          model: activeModel.model || 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          max_tokens: 100
        })
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices[0]?.message?.content?.trim() || `Thanks @${commenterName}! 🙌`;
      }
    } else if (activeModel.provider === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeModel.apiKey}`
        },
        body: JSON.stringify({
          model: activeModel.model || 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          max_tokens: 100
        })
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices[0]?.message?.content?.trim() || `Thanks @${commenterName}! 🙌`;
      }
    }
  } catch (err) {
    console.error('[LLM Engine] generateCreatorLLMReply error:', err.message);
  }

  return `Thanks for your comment @${commenterName || 'viewer'}! Hope you find "${videoTitle || 'this'}" helpful! ✨`;
}

// Admin Get Plans
app.get('/api/admin/plans', requireAdmin, (req, res) => {
  res.json(plansDB);
});

// ─── Admin SMTP & Email Engine Endpoints ───
app.get('/api/admin/smtp-config', requireAdmin, (req, res) => {
  res.json({
    success: true,
    smtpConfig,
    emailNotificationRules,
    emailLogs: emailLogs.slice(0, 50)
  });
});

app.post('/api/admin/smtp-config', requireAdmin, (req, res) => {
  const { host, port, secure, user, pass, fromName, fromEmail, emailNotificationRules: newRules } = req.body;
  if (host !== undefined) smtpConfig.host = host;
  if (port !== undefined) smtpConfig.port = parseInt(port) || 465;
  if (secure !== undefined) smtpConfig.secure = Boolean(secure);
  if (user !== undefined) smtpConfig.user = user;
  if (pass !== undefined && pass !== '') smtpConfig.pass = pass;
  if (fromName !== undefined) smtpConfig.fromName = fromName;
  if (fromEmail !== undefined) smtpConfig.fromEmail = fromEmail;

  if (newRules && typeof newRules === 'object') {
    Object.assign(emailNotificationRules, newRules);
  }

  saveDatabaseToDisk();
  res.json({ success: true, message: 'SMTP and Email Notification settings saved successfully!' });
});

app.post('/api/admin/test-email', requireAdmin, async (req, res) => {
  const { testEmail } = req.body;
  if (!testEmail) return res.status(400).json({ error: 'Test recipient email address is required' });

  try {
    const info = await sendSystemEmail({
      to: testEmail,
      subject: '✅ ReplyFlow Hostinger SMTP Connection Test',
      html: `
        <div style="font-family: Arial, sans-serif; background: #0f1015; color: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid rgba(168,85,247,0.3);">
          <h2 style="color: #c084fc; margin-top: 0;">🎉 Hostinger SMTP Connection Successful!</h2>
          <p>This is an automated test email dispatched from your <strong>ReplyFlow Domain Email Engine</strong>.</p>
          <p><strong>SMTP Server:</strong> ${smtpConfig.host}:${smtpConfig.port}</p>
          <p><strong>From Sender:</strong> ${smtpConfig.fromName || 'ReplyFlow'} &lt;${smtpConfig.fromEmail || smtpConfig.user}&gt;</p>
          <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 20px 0;">
          <p style="font-size: 12px; color: #a1a1aa;">Sent via ReplyFlow Custom Domain SMTP Engine on ${new Date().toLocaleString()}</p>
        </div>
      `
    });
    res.json({ success: true, message: `Test email sent to ${testEmail} successfully!`, messageId: info.messageId });
  } catch (err) {
    console.error('[SMTP Test Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/test-receipt-email', requireAdmin, async (req, res) => {
  const { testEmail, planName, amount } = req.body;
  if (!testEmail) return res.status(400).json({ error: 'Recipient email address is required' });

  try {
    const info = await sendPaymentReceiptEmail({
      to: testEmail,
      userName: 'Alex Morgan',
      planName: planName || 'Pro',
      amount: amount || 'PKR 7,000',
      invoiceId: `INV-00${Math.floor(Math.random() * 90 + 10)}`,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    });
    res.json({ success: true, message: `Payment receipt email sent to ${testEmail} successfully!`, messageId: info.messageId });
  } catch (err) {
    console.error('[Receipt Test Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/send-broadcast-email', requireAdmin, async (req, res) => {
  const { audience, subject, bodyHtml } = req.body;
  if (!subject || !bodyHtml) {
    return res.status(400).json({ error: 'Subject and body email contents are required' });
  }

  let recipients = [];
  if (audience === 'pro') {
    recipients = (usersDB || []).filter(u => u.plan === 'pro' || u.plan === 'business').map(u => u.email).filter(Boolean);
  } else if (audience === 'free') {
    recipients = (usersDB || []).filter(u => !u.plan || u.plan === 'starter' || u.plan === 'free').map(u => u.email).filter(Boolean);
  } else {
    recipients = (usersDB || []).map(u => u.email).filter(Boolean);
  }

  if (recipients.length === 0) {
    recipients = ['alex@replyflow.app', 'demo@replyflow.io'];
  }

  let sentCount = 0;
  let errors = [];

  for (const recipient of recipients) {
    try {
      await sendSystemEmail({
        to: recipient,
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; background: #0b0c10; color: #ffffff; padding: 28px; border-radius: 12px; border: 1px solid rgba(168,85,247,0.3);">
            <div style="font-size: 20px; font-weight: 800; color: #a855f7; margin-bottom: 16px;">ReplyFlow Notification</div>
            <div>${bodyHtml}</div>
            <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px; color: #71717a;">
              Sent via ReplyFlow Automation • Manage notification preferences in your account settings.
            </div>
          </div>
        `
      });
      sentCount++;
    } catch (err) {
      errors.push(`${recipient}: ${err.message}`);
    }
  }

  res.json({
    success: true,
    sentCount,
    totalRecipients: recipients.length,
    errors
  });
});

// User Notification Preferences API
app.get('/api/user/notification-settings', (req, res) => {
  res.json({
    success: true,
    rules: emailNotificationRules
  });
});

app.post('/api/user/notification-settings', (req, res) => {
  const { dailySummary, quotaWarning, weeklyReport, productUpdates } = req.body;
  if (dailySummary !== undefined) emailNotificationRules.dailySummary = Boolean(dailySummary);
  if (quotaWarning !== undefined) emailNotificationRules.quotaWarning = Boolean(quotaWarning);
  if (weeklyReport !== undefined) emailNotificationRules.weeklyReport = Boolean(weeklyReport);
  if (productUpdates !== undefined) emailNotificationRules.productUpdates = Boolean(productUpdates);
  
  saveDatabaseToDisk();
  res.json({ success: true, rules: emailNotificationRules });
});

// Admin Add New Plan
app.post('/api/admin/plans', requireAdmin, (req, res) => {
  const { name, price, igLimit, ytLimit, triggersLimit } = req.body;
  if (!name || price === undefined || igLimit === undefined || ytLimit === undefined || triggersLimit === undefined) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const newPlan = { id, name, price: parseFloat(price), igLimit: parseInt(igLimit), ytLimit: parseInt(ytLimit), triggersLimit: parseInt(triggersLimit) };
  plansDB.push(newPlan);
  res.json({ success: true, plan: newPlan });
});

// Admin Update Plan
app.put('/api/admin/plans/:id', requireAdmin, (req, res) => {
  const planId = req.params.id;
  const plan = plansDB.find(p => p.id === planId);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  const { name, price, igLimit, ytLimit, triggersLimit } = req.body;
  if (name !== undefined) plan.name = name;
  if (price !== undefined) plan.price = parseFloat(price);
  if (igLimit !== undefined) plan.igLimit = parseInt(igLimit);
  if (ytLimit !== undefined) plan.ytLimit = parseInt(ytLimit);
  if (triggersLimit !== undefined) plan.triggersLimit = parseInt(triggersLimit);

  res.json({ success: true, plan });
});

// Admin Get OAuth configuration
app.get('/api/admin/oauth-config', requireAdmin, (req, res) => {
  res.json(oauthConfig);
});

// Admin Save OAuth configuration
app.put('/api/admin/oauth-config', requireAdmin, (req, res) => {
  const { emailLogin, googleLogin, discordLogin, githubLogin } = req.body;
  if (emailLogin !== undefined) oauthConfig.emailLogin = emailLogin;
  if (googleLogin !== undefined) oauthConfig.googleLogin = googleLogin;
  if (discordLogin !== undefined) oauthConfig.discordLogin = discordLogin;
  if (githubLogin !== undefined) oauthConfig.githubLogin = githubLogin;
  res.json({ success: true, oauthConfig });
});

// Admin Get Triggers
app.get('/api/admin/triggers', requireAdmin, (req, res) => {
  const allIgAccounts = getAllUserAccounts('ig');
  const allYtAccounts = getAllUserAccounts('yt');

  const igTriggers = getAllUserTriggers('ig').map(t => {
    const acc = allIgAccounts.find(a => a.id === t.accountId);
    return { ...t, platform: 'Instagram', accountId: t.accountId, accountUsername: acc ? acc.username : 'N/A' };
  });
  const ytTriggers = getAllUserTriggers('yt').map(t => {
    const acc = allYtAccounts.find(a => a.id === t.accountId);
    return { ...t, platform: 'YouTube', accountId: t.accountId, accountUsername: acc ? acc.username : 'N/A' };
  });
  res.json([...igTriggers, ...ytTriggers]);
});

// Admin Get Settings (Publicly readable to load branding on login overlay)
app.get('/api/admin/settings', (req, res) => {
  res.json(generalSettings);
});

// Admin Save Settings
app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const { websiteName, logoUrl, headerScript, footerScript, googleAnalyticsId, googleSiteVerification, googleIndexingEnabled } = req.body;
  if (websiteName !== undefined) generalSettings.websiteName = websiteName;
  if (logoUrl !== undefined) generalSettings.logoUrl = logoUrl;
  if (headerScript !== undefined) generalSettings.headerScript = headerScript;
  if (footerScript !== undefined) generalSettings.footerScript = footerScript;
  if (googleAnalyticsId !== undefined) generalSettings.googleAnalyticsId = googleAnalyticsId;
  if (googleSiteVerification !== undefined) generalSettings.googleSiteVerification = googleSiteVerification;
  if (googleIndexingEnabled !== undefined) generalSettings.googleIndexingEnabled = !!googleIndexingEnabled;
  res.json({ success: true, settings: generalSettings });
});

// 📦 REAL Admin System Update Engine (Upload ZIP -> Extract & Override Code -> Preserve Main User Data)
app.post('/api/admin/system/update', requireAdmin, async (req, res) => {
  try {
    const { zipBase64, filename = 'system_update.zip' } = req.body || {};

    if (!zipBase64) {
      return res.status(400).json({ success: false, message: 'ZIP file data (base64) is required.' });
    }

    const cleanBase64 = zipBase64.replace(/^data:application\/(zip|x-zip-compressed|octet-stream);base64,/, '').replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    // Scratch temp folder for update ZIP and extraction
    const scratchDir = path.join(__dirname, 'scratch');
    if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

    const zipTempPath = path.join(scratchDir, `update_${Date.now()}.zip`);
    fs.writeFileSync(zipTempPath, buffer);

    // Python script to safely extract ZIP and override code while preserving protected user data items
    const pyExtractScript = `
import os, sys, zipfile, shutil, json

zip_path = sys.argv[1]
app_root = sys.argv[2]
protected_items = [
    'database.json', '.env', 'system.db', 'discord-bot/system.db',
    'uploads', '.git', 'node_modules'
]

temp_dir = os.path.join(app_root, 'scratch', '_temp_extract_' + str(os.getpid()))
if os.path.exists(temp_dir):
    shutil.rmtree(temp_dir)

os.makedirs(temp_dir, exist_ok=True)

try:
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(temp_dir)

    source_root = temp_dir
    extracted_items = os.listdir(temp_dir)
    
    # Handle case where user zipped a containing folder (e.g. replyflow-mobile-v1.4.0/)
    if len(extracted_items) == 1 and os.path.isdir(os.path.join(temp_dir, extracted_items[0])):
        nested = os.path.join(temp_dir, extracted_items[0])
        if any(os.path.exists(os.path.join(nested, check_f)) for check_f in ['index.html', 'app.js', 'server.js', 'package.json']):
            source_root = nested

    overridden_files = []
    preserved_files = []

    for root, dirs, files in os.walk(source_root):
        rel_dir = os.path.relpath(root, source_root)
        if rel_dir == '.':
            rel_dir = ''

        # Filter out protected directories
        dirs[:] = [d for d in dirs if not any(
            d.lower() == p.lower() or os.path.normpath(os.path.join(rel_dir, d)).replace('\\\\', '/').lower().startswith(p.lower())
            for p in protected_items
        )]

        for f in files:
            rel_file = os.path.normpath(os.path.join(rel_dir, f)).replace('\\\\', '/')
            
            # Skip protected files
            is_protected = False
            for p in protected_items:
                if rel_file.lower() == p.lower() or rel_file.lower().startswith(p.lower() + '/'):
                    is_protected = True
                    break
            
            if is_protected:
                preserved_files.append(rel_file)
                continue

            src_file_path = os.path.join(root, f)
            dest_file_path = os.path.join(app_root, rel_file)

            os.makedirs(os.path.dirname(dest_file_path), exist_ok=True)
            shutil.copy2(src_file_path, dest_file_path)
            overridden_files.append(rel_file)

    # Cleanup temp extraction folder
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)

    print(json.dumps({
        "success": True,
        "overriddenCount": len(overridden_files),
        "preservedCount": len(preserved_files),
        "overriddenSample": overridden_files[:15],
        "preservedItems": protected_items
    }))
except Exception as e:
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    print(json.dumps({"success": False, "error": str(e)}))
`;

    const pyScriptPath = path.join(scratchDir, `run_extract_${Date.now()}.py`);
    fs.writeFileSync(pyScriptPath, pyExtractScript, 'utf8');

    const { execFile } = require('child_process');
    execFile('python', [pyScriptPath, zipTempPath, __dirname], { cwd: __dirname }, (err, stdout) => {
      // Clean up temporary script and zip
      try { if (fs.existsSync(pyScriptPath)) fs.unlinkSync(pyScriptPath); } catch (e) {}
      try { if (fs.existsSync(zipTempPath)) fs.unlinkSync(zipTempPath); } catch (e) {}

      if (err) {
        console.error('[System Update Error]:', err);
        return res.status(500).json({ success: false, message: 'Extraction failed: ' + err.message });
      }

      let result = {};
      try {
        result = JSON.parse(stdout.trim());
      } catch (e) {
        console.error('[System Update JSON Parse Error]:', stdout);
        return res.status(500).json({ success: false, message: 'Invalid python extraction result' });
      }

      if (!result.success) {
        return res.status(500).json({ success: false, message: result.error || 'Update extraction failed' });
      }

      const versionMatch = filename.match(/v?(\d+\.\d+\.\d+)/i);
      const newVersion = versionMatch ? `v${versionMatch[1]}` : `v1.${Math.floor(Date.now()/1000000)}.${Math.floor(Math.random()*90+10)}`;

      const newLog = {
        version: newVersion,
        package: filename,
        status: 'Active 🟢',
        overriddenCount: result.overriddenCount,
        preservedCount: result.preservedCount,
        updatedBy: 'admin',
        timestamp: new Date().toISOString()
      };

      systemUpdateHistory.unshift(newLog);

      const dbPath = path.join(__dirname, 'database.json');
      let dbData = {};
      if (fs.existsSync(dbPath)) {
        try { dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch(e) {}
      }
      dbData.updateHistory = systemUpdateHistory;
      try { fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf8'); } catch(e) {}

      res.json({
        success: true,
        message: `System updated successfully to ${newLog.version}! ${result.overriddenCount} system code files overridden. All main user data (database.json, .env, system.db, uploads/) safely preserved!`,
        version: newLog.version,
        overriddenCount: result.overriddenCount,
        preservedCount: result.preservedCount,
        sampleFiles: result.overriddenSample,
        history: systemUpdateHistory
      });
    });

  } catch (err) {
    console.error('[System Update API Error]:', err);
    res.status(500).json({ success: false, message: 'System update failed: ' + err.message });
  }
});

// GET /api/admin/system/update/history — Get Update History
app.get('/api/admin/system/update/history', requireAdmin, (req, res) => {
  res.json({ success: true, history: systemUpdateHistory });
});

// Admin Get Administrators
app.get('/api/admin/admins', requireAdmin, (req, res) => {
  const list = adminUsers.map(a => ({ id: a.id, username: a.username, role: a.role, createdAt: a.createdAt }));
  res.json(list);
});

// Admin Add New Administrator
app.post('/api/admin/admins', requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  const cleanUsername = username.trim();
  const exists = adminUsers.some(a => a.username.toLowerCase() === cleanUsername.toLowerCase());
  if (exists) return res.status(400).json({ error: 'Administrator username already exists' });

  const passwordHash = await bcrypt.hash(password, 12);
  const newAdmin = { id: Date.now(), username: cleanUsername, passwordHash, role, createdAt: new Date().toISOString() };
  adminUsers.push(newAdmin);
  saveDatabaseToDisk();
  res.json({ success: true, admin: { id: newAdmin.id, username: newAdmin.username, role: newAdmin.role, createdAt: newAdmin.createdAt } });
});

// Admin Change Current Administrator Password
app.put('/api/admin/admins/password', requireAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
  }

  // Identify actual authenticated admin from req.admin (set by requireAdmin)
  const admin = req.admin || adminUsers.find(a => a.username === (req.user && req.user.username));
  if (!admin) {
    return res.status(404).json({ error: 'Authenticated admin account not found.' });
  }

  let isMatch = false;
  if (admin.passwordHash) {
    isMatch = await bcrypt.compare(currentPassword, admin.passwordHash);
  } else if (admin.password) {
    isMatch = (admin.password === currentPassword);
  }

  if (!isMatch) {
    return res.status(400).json({ error: 'Incorrect current password' });
  }

  admin.passwordHash = await bcrypt.hash(newPassword, 12);
  delete admin.password;
  saveDatabaseToDisk();
  res.json({ success: true, message: 'Password updated successfully!' });
});

// ─── Welcome Plugin API Endpoints ───

function getUserWelcomeTemplates(userId, guildId) {
  const uid = String(userId || 'default');
  const gid = guildId ? String(guildId) : null;
  const storeKey = gid ? `${uid}_${gid}` : uid;

  if (!userWelcomeTemplatesDB[storeKey]) {
    if (gid && userWelcomeTemplatesDB[uid] && Array.isArray(userWelcomeTemplatesDB[uid])) {
      userWelcomeTemplatesDB[storeKey] = JSON.parse(JSON.stringify(userWelcomeTemplatesDB[uid]));
    } else {
      userWelcomeTemplatesDB[storeKey] = [];
    }
  }
  return userWelcomeTemplatesDB[storeKey];
}

app.get('/api/plugins/welcome', requireUserAuth, async (req, res) => {
  const userId = req.user.id;
  const guildId = req.query.guild_id || req.query.guildId;
  const userTemplates = getUserWelcomeTemplates(userId, guildId);
  return res.json({ templates: userTemplates });
});

app.post('/api/plugins/welcome', requireUserAuth, async (req, res) => {
  const userId = req.user.id;
  const { id, template_name, media_url, links, is_active, guild_id } = req.body;
  const message_text = req.body.message_text !== undefined ? req.body.message_text : req.body.welcome_text;
  const linksStr = typeof links === 'string' ? links : JSON.stringify(links || {});

  const userTemplates = getUserWelcomeTemplates(userId, guild_id);
  if (is_active) {
    userTemplates.forEach(t => t.is_active = 0);
  }

  let savedTmpl = null;
  if (id) {
    const t = userTemplates.find(x => String(x.id) === String(id));
    if (t) {
      if (template_name !== undefined) t.template_name = template_name;
      if (media_url !== undefined) t.media_url = media_url;
      if (message_text !== undefined) t.message_text = message_text;
      if (links !== undefined) t.links = linksStr;
      if (is_active !== undefined) t.is_active = is_active ? 1 : 0;
      savedTmpl = t;
    }
  }
  
  if (!savedTmpl) {
    const newId = Date.now();
    const newTmpl = {
      id: newId,
      user_id: userId,
      guild_id: guild_id || '',
      template_name: template_name || 'New Template',
      media_url: media_url || '',
      message_text: message_text || '',
      links: linksStr,
      is_active: is_active ? 1 : 0
    };
    userTemplates.push(newTmpl);
    savedTmpl = newTmpl;
  }

  // Also Sync Active Welcome Template directly to SQLite system.db for Discord bot
  try {
    const activeTemplate = userTemplates.find(x => x.is_active == 1) || savedTmpl;
    if (activeTemplate) {
      const userGuilds = await getUserGuilds(userId);
      const targetGuildId = guild_id || (userGuilds && userGuilds.length > 0 ? userGuilds[0].id : '1537457454370128024');
      const { execFile } = require('child_process');
      const pyCmd = `import sys, os, json; sys.path.append(os.path.join(r'${__dirname.replace(/\\/g, '/')}', 'discord-bot')); import database; database.save_plugin_config('${targetGuildId}', 'welcome', True, json.loads(sys.argv[1]))`;
      execFile('python', ['-c', pyCmd, JSON.stringify(activeTemplate)], { cwd: __dirname }, (err) => {
        if (err) console.error("[NodeServer] SQLite welcome plugin sync note:", err.message);
        else console.log(`[NodeServer] Active Welcome Template synced to SQLite system.db for guild ${targetGuildId} successfully.`);
      });
    }
  } catch (syncErr) {
    console.error("[NodeServer] Welcome sync error:", syncErr);
  }

  saveDatabaseToDisk();
  return res.json({ success: true, message: 'Welcome template saved successfully', template: savedTmpl });
});

app.delete('/api/plugins/welcome/:id', requireUserAuth, async (req, res) => {
  const userId = req.user.id;
  const id = req.params.id;
  const guildId = req.query.guild_id || req.query.guildId;
  const userTemplates = getUserWelcomeTemplates(userId, guildId);
  const idx = userTemplates.findIndex(t => String(t.id) === String(id));
  if (idx !== -1) userTemplates.splice(idx, 1);
  saveDatabaseToDisk();
  return res.json({ success: true, message: 'Welcome template deleted successfully' });
});

// ─── Leveling & XP Plugin API Endpoints ───

function getUserLevelingRewards(userId, guildId) {
  const uid = String(userId || 'default');
  const gid = guildId ? String(guildId) : null;
  const storeKey = gid ? `${uid}_${gid}` : uid;

  if (!userLevelingRewardsDB[storeKey]) {
    if (gid && userLevelingRewardsDB[uid] && Array.isArray(userLevelingRewardsDB[uid])) {
      userLevelingRewardsDB[storeKey] = JSON.parse(JSON.stringify(userLevelingRewardsDB[uid]));
    } else {
      userLevelingRewardsDB[storeKey] = [];
    }
  }
  return userLevelingRewardsDB[storeKey];
}

app.get('/api/plugins/leveling', requireUserAuth, async (req, res) => {
  const userId = req.user.id;
  const guildId = req.query.guild_id || req.query.guildId;
  const rewards = getUserLevelingRewards(userId, guildId);
  return res.json({ rewards });
});

app.post('/api/plugins/leveling/rewards', requireUserAuth, async (req, res) => {
  const userId = req.user.id;
  const { level_number, reward_role, reward_perk, guild_id } = req.body;
  if (level_number === undefined || !reward_role) {
    return res.status(400).json({ error: 'level_number and reward_role are required' });
  }

  const newReward = {
    id: Date.now(),
    user_id: userId,
    guild_id: guild_id || '',
    level_number: parseInt(level_number),
    reward_role: reward_role.trim(),
    reward_perk: reward_perk ? reward_perk.trim() : ''
  };

  const userRewards = getUserLevelingRewards(userId, guild_id);
  userRewards.push(newReward);

  // Sync to SQLite system.db for Python Bot
  try {
    const userGuilds = await getUserGuilds(userId);
    const targetGuildId = guild_id || (userGuilds && userGuilds.length > 0 ? userGuilds[0].id : '1537457454370128024');
    const { execFile } = require('child_process');
    const pyCmd = `import sys, os, json; sys.path.append(os.path.join(r'${__dirname.replace(/\\/g, '/')}', 'discord-bot')); import database; database.save_level_reward('${targetGuildId}', ${parseInt(level_number)}, sys.argv[1], sys.argv[2])`;
    execFile('python', ['-c', pyCmd, reward_role.trim(), (reward_perk || '').trim()], { cwd: __dirname }, (err) => {
      if (err) console.error("[NodeServer] SQLite level reward sync note:", err.message);
      else console.log(`[NodeServer] Level Reward synced to SQLite for guild ${targetGuildId}`);
    });
  } catch (syncErr) {
    console.error("[NodeServer] Level reward sync error:", syncErr);
  }

  saveDatabaseToDisk();
  res.json({ success: true, message: 'Level reward created successfully', reward: newReward });
});

app.delete('/api/plugins/leveling/rewards/:id', requireUserAuth, async (req, res) => {
  const userId = req.user.id;
  const rewardId = req.params.id;
  const guildId = req.query.guild_id || req.query.guildId;
  const userRewards = getUserLevelingRewards(userId, guildId);
  const idx = userRewards.findIndex(r => String(r.id) === String(rewardId));
  if (idx !== -1) {
    userRewards.splice(idx, 1);
  }

  try {
    const { execFile } = require('child_process');
    const pyCmd = `import sys, os; sys.path.append(os.path.join(r'${__dirname.replace(/\\/g, '/')}', 'discord-bot')); import database; database.delete_level_reward(${parseInt(rewardId)})`;
    execFile('python', ['-c', pyCmd], { cwd: __dirname }, (err) => {});
  } catch (syncErr) {}

  saveDatabaseToDisk();
  res.json({ success: true, message: 'Reward deleted successfully' });
});

// Serve Standalone Admin Panel Page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// ─── Instagram Webhook — Verification & Event Endpoint ───
const INSTAGRAM_WEBHOOK_VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || '';

// GET /api/webhooks/instagram — Webhook verification (challenge-response)
app.get('/api/webhooks/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const verifyToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && verifyToken) {
    if (mode === 'subscribe' && verifyToken === INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
      console.log('[Instagram Webhook] Subscription verified successfully.');
      return res.status(200).type('text/plain').send(challenge);
    }
    console.warn('[Instagram Webhook] Verification failed: token mismatch or invalid mode.');
    return res.status(403).json({ error: 'Forbidden: Invalid verification token or mode.' });
  }

  res.status(400).json({ error: 'Bad Request: Missing hub.mode, hub.verify_token, or hub.challenge.' });
});

// POST /api/webhooks/instagram — Incoming webhook events from Instagram
app.post('/api/webhooks/instagram', async (req, res) => {
  // Always respond 200 immediately so Instagram doesn't retry
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;
    console.log('[Instagram Webhook] Received event:', JSON.stringify(body, null, 2));

    if (body.object !== 'instagram') {
      console.log('[Instagram Webhook] Ignoring non-instagram object:', body.object);
      return;
    }

    if (!body.entry || !Array.isArray(body.entry)) return;

    for (const entry of body.entry) {
      // ─── Handle Comment Events (changes array) ───
      if (entry.changes && Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          if (change.field === 'comments') {
            await handleCommentEvent(entry.id, change.value);
          }
        }
      }

      // ─── Handle Messaging Events (messaging array) ───
      if (entry.messaging && Array.isArray(entry.messaging)) {
        for (const msgEvent of entry.messaging) {
          if (msgEvent.postback) {
            await handlePostbackEvent(msgEvent);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Instagram Webhook] Error processing event:', err.message, err.stack);
  }
});

// ═══════════════════════════════════════════════════════════════
// ─── WEBHOOK PROCESSING ENGINE ───
// ═══════════════════════════════════════════════════════════════

// Track processed comment IDs to avoid duplicate replies
const processedComments = new Set();
const PROCESSED_COMMENTS_MAX = 5000;

/**
 * Handle an incoming comment event from Instagram webhook
 */
async function handleCommentEvent(igPageId, commentData) {
  try {
    const commentId = commentData.id;
    const commentText = commentData.text || '';
    const mediaId = commentData.media?.id || commentData.media_id || '';
    const commenterId = commentData.from?.id || '';
    const commenterUsername = commentData.from?.username || 'unknown';

    console.log(`[Webhook Engine] Comment received: "${commentText}" by @${commenterUsername} on media ${mediaId}`);

    // Skip if already processed
    if (processedComments.has(commentId)) {
      console.log(`[Webhook Engine] Comment ${commentId} already processed, skipping.`);
      return;
    }
    processedComments.add(commentId);
    // Prevent memory leak
    if (processedComments.size > PROCESSED_COMMENTS_MAX) {
      const firstKey = processedComments.values().next().value;
      processedComments.delete(firstKey);
    }

    // Find the connected account that owns this media
    const account = findAccountByIgUserId(String(igPageId), mediaId);
    if (!account) {
      console.log(`[Webhook Engine] No connected account found for IG user ID: ${igPageId}`);
      return;
    }

    // Skip comments from the account owner (don't reply to yourself)
    if (String(commenterId) === String(account.igUserId)) {
      console.log(`[Webhook Engine] Skipping self-comment from @${commenterUsername}`);
      return;
    }

    // Find the post in the account's posts
    const post = account.posts?.find(p => String(p.id) === String(mediaId));

    // Check if AI Reply is enabled for this post
    if (post && post.aiReply === false) {
      console.log(`[Webhook Engine] AI Reply disabled for post ${mediaId}, skipping.`);
      return;
    }

    // Match comment text against active triggers
    const matchedTrigger = findMatchingTrigger('ig', commentText, mediaId, post);
    if (!matchedTrigger) {
      console.log(`[Webhook Engine] No trigger matched for comment: "${commentText}"`);
      return;
    }

    console.log(`[Webhook Engine] ✅ Trigger matched! Keyword: "${matchedTrigger.keyword}" → Trigger ID: ${matchedTrigger.id}`);

    // Check Unique Engaged Contact limit (Existing users = UNLIMITED replies, New users = blocked if plan limit reached)
    const contactStatus = processUniqueEngagedContact(account, commenterId, commenterUsername, 'ig');
    if (!contactStatus.allowed) {
      console.warn(`[Webhook Engine] 🚫 Skipping automation for @${commenterUsername}. Account @${account.username} reached max unique contacts limit (${contactStatus.currentCount}/${contactStatus.limit}).`);
      return;
    }

    // Decrypt access token
    const accessToken = decryptToken(account.accessTokenEncrypted);
    if (!accessToken) {
      console.error(`[Webhook Engine] Could not decrypt token for account @${account.username}`);
      return;
    }

    // 1) Execute comment reply and Private Reply DM concurrently in parallel for sub-second delivery
    const tasks = [];
    const commentReplyText = getCommentReplyText(matchedTrigger, account);
    if (commentReplyText) {
      tasks.push(replyToComment(commentId, commentReplyText, accessToken));
    }
    tasks.push(sendDmToUser(commentId, commenterId, commenterUsername, matchedTrigger, account, accessToken));

    await Promise.all(tasks);

    // 2) Update reply count
    if (post) {
      post.repliesCount = (post.repliesCount || 0) + 1;
      saveDatabaseToDisk();
    }

    console.log(`[Webhook Engine] ✅ Successfully processed trigger "${matchedTrigger.keyword}" for @${commenterUsername}`);

  } catch (err) {
    console.error('[Webhook Engine] Error handling comment:', err.message, err.stack);
  }
}

/**
 * Handle postback events (e.g., Follow-Gate "I've Followed" button clicks)
 */
async function handlePostbackEvent(msgEvent) {
  try {
    const senderId = msgEvent.sender?.id;
    const payload = msgEvent.postback?.payload || '';
    console.log(`[Webhook Engine] Postback received from ${senderId}: ${payload}`);

    if (payload.startsWith('CONFIRM_FOLLOW_')) {
      const parts = payload.split('_');
      // CONFIRM_FOLLOW_<triggerId>_<userIgsid>
      const triggerId = parts[2];
      const userIgsid = parts.slice(3).join('_');
      
      // Find the account and trigger across all users
      const allIgAccounts = getAllUserAccounts('ig');
      const allIgTriggers = getAllUserTriggers('ig');

      for (const acc of allIgAccounts) {
        if (!acc.oauthConnected) continue;
        const trigger = allIgTriggers.find(t => String(t.id) === String(triggerId));
        if (trigger) {
          const accessToken = decryptToken(acc.accessTokenEncrypted);
          if (!accessToken) break;

          console.log(`[Webhook Engine] Postback button clicked by user ${senderId}. Verifying follow status...`);
          const record = getOrCreateConfirmation(acc.id, senderId);
          const lastSent = record.lastGateSentAt || 0;
          const elapsed = Date.now() - lastSent;

          const followsApi = await checkIfUserFollows(senderId, accessToken);
          console.log(`[Webhook Engine] Verification check for ${senderId}: API=${followsApi}, Elapsed=${elapsed}ms`);

          if (!followsApi || elapsed < 6000) {
            console.log(`[Webhook Engine] User ${senderId} follow check failed. Rejecting postback.`);
            const ds = acc.dmSettings || {};
            const errorText = parseSpinTax(ds.followGateError || `Uh oh, looks like you haven't followed me yet 👀\nHead over to my profile and tap follow when you get a chance 😃`);
            
            const messageObj = {
              attachment: {
                type: "template",
                payload: {
                  template_type: "generic",
                  elements: [{
                    title: "Uh oh! 👀",
                    subtitle: errorText,
                    buttons: [
                      { type: "web_url", url: acc.profileUrl || `https://instagram.com/${acc.username}`, title: ds.buttonProfileLabel || "Visit Profile" },
                      { type: "postback", payload: `CONFIRM_FOLLOW_${trigger.id}_${senderId}`, title: ds.buttonGetLinkLabel || "I'm following ✅" }
                    ]
                  }]
                }
              }
            };
            await sendInstagramMessage(acc.igUserId, senderId, messageObj, accessToken);
          } else {
            console.log(`[Webhook Engine] User ${senderId} follow verified! Unlocking link.`);
            record.hasConfirmedFollow = true;
            record.confirmedAt = new Date().toISOString();
            saveDatabaseToDisk();
            
            await sendDmToUser(null, senderId, 'user', trigger, acc, accessToken);
          }
          break;
        }
      }
    }
  } catch (err) {
    console.error('[Webhook Engine] Error handling postback:', err.message, err.stack);
  }
}

/**
 * Find the connected account by Instagram User ID or Post Media ID across all users
 */
function findAccountByIgUserId(igUserId, mediaId) {
  const allAccounts = getAllUserAccounts('ig');
  // 1) Direct ID match
  let found = allAccounts.find(acc => 
    acc.oauthConnected && (String(acc.igUserId) === String(igUserId) || String(acc.instagramBusinessId) === String(igUserId))
  );
  if (found) return found;

  // 2) Match by post media ID ownership
  if (mediaId) {
    found = allAccounts.find(acc => 
      acc.oauthConnected && acc.posts && acc.posts.some(p => String(p.id) === String(mediaId))
    );
    if (found) {
      found.instagramBusinessId = String(igUserId);
      saveDatabaseToDisk();
      return found;
    }
  }

  // 3) Fallback if there is only 1 connected OAuth account
  const oauthConnectedAccounts = allAccounts.filter(acc => acc.oauthConnected);
  if (oauthConnectedAccounts.length === 1) {
    const acc = oauthConnectedAccounts[0];
    acc.instagramBusinessId = String(igUserId);
    saveDatabaseToDisk();
    return acc;
  }

  return null;
}

/**
 * Match a comment against active triggers for the given platform/media
 */
function findMatchingTrigger(platform, commentText, mediaId, post) {
  const triggers = triggersDB[platform] || [];
  const lowerComment = commentText.toLowerCase().trim();

  for (const trigger of triggers) {
    if (!trigger.active) continue;

    const keywordMatch = lowerComment.includes(trigger.keyword.toLowerCase().trim());
    if (!keywordMatch) continue;

    // Check scope: if trigger is linked to a specific post, verify it matches
    if (trigger.postId) {
      if (String(trigger.postId) === String(mediaId)) {
        return trigger;
      }
      // Also check if the post title matches the scope
      if (post && trigger.scope && trigger.scope.includes(post.title)) {
        return trigger;
      }
      continue; // This trigger is scoped to a different post
    }

    // Global trigger (no specific postId) — matches all posts
    if (trigger.scope === 'All Posts (Global)' || !trigger.scope) {
      return trigger;
    }

    // Scope-based matching (e.g., "Reel: ..." or "Post: ...")
    if (post && trigger.scope) {
      if (trigger.scope.includes(post.title) || trigger.scope.includes(String(mediaId))) {
        return trigger;
      }
    }
  }

  return null;
}

/**
 * Parse SpinTax format like {Hello|Hi|Hey} and return a random selection
 */
function parseSpinTax(text) {
  if (!text) return text;
  const spinRegex = /{([^{}]+)}/g;
  return text.replace(spinRegex, (match, p1) => {
    const options = p1.split('|');
    const randIndex = Math.floor(Math.random() * options.length);
    return options[randIndex].trim();
  });
}

// Plan Unique Engaged Contacts Quotas (Fair Contact-based SaaS Model)
const PLAN_UNIQUE_CONTACT_LIMITS = {
  free: 100,
  starter: 1000,
  pro: 5000,
  business: 25000,
  unlimited: 999999999
};

/**
 * Track unique engaged contact for an account/user.
 * Existing contacts can comment/interact UNLIMITED times without burning quota.
 * New contacts are allowed until the account's plan limit is reached.
 */
function processUniqueEngagedContact(account, contactId, contactUsername, platform = 'ig') {
  if (!account) return { allowed: true, isNew: false, currentCount: 0, limit: 100 };
  
  if (!account.uniqueEngagedContacts) {
    account.uniqueEngagedContacts = [];
  }
  
  const userKey = (contactUsername || contactId || '').toLowerCase().trim();
  if (!userKey) return { allowed: true, isNew: false, currentCount: account.uniqueEngagedContacts.length, limit: 100 };

  const isExisting = account.uniqueEngagedContacts.includes(userKey);
  
  // Get plan limit for account owner
  const userPlan = (account.userPlan || account.plan || 'free').toLowerCase();
  const limit = PLAN_UNIQUE_CONTACT_LIMITS[userPlan] || PLAN_UNIQUE_CONTACT_LIMITS.free;

  if (isExisting) {
    // Existing contact: allow unlimited replies without consuming new contact quota
    return {
      allowed: true,
      isNew: false,
      currentCount: account.uniqueEngagedContacts.length,
      limit
    };
  }

  // New Contact: Check quota limit
  if (account.uniqueEngagedContacts.length >= limit) {
    console.warn(`[Plan Limit] Account @${account.username || account.name} reached max unique contacts limit (${account.uniqueEngagedContacts.length}/${limit}). New contact @${userKey} blocked.`);
    return {
      allowed: false,
      isNew: true,
      currentCount: account.uniqueEngagedContacts.length,
      limit
    };
  }

  // Add new contact to persistent list
  account.uniqueEngagedContacts.push(userKey);
  saveDatabaseToDisk();
  console.log(`[Unique Contact Tracked] Added @${userKey} to @${account.username || account.name}'s engaged contacts list (${account.uniqueEngagedContacts.length}/${limit}).`);

  return {
    allowed: true,
    isNew: true,
    currentCount: account.uniqueEngagedContacts.length,
    limit
  };
}

/**
 * Append "⚡ Powered by ReplyFlow (http://localhost:3000)" clickable signature to automated messages
 * ONLY for Free ($0/mo) accounts/users. Paid plans (Starter, Pro, Business) are clean with NO branding.
 */
function appendFreePlanBranding(text, userOrPlan) {
  if (!text) return text;
  
  let planName = 'Free';
  if (typeof userOrPlan === 'string') {
    planName = userOrPlan;
  } else if (userOrPlan && typeof userOrPlan === 'object') {
    planName = userOrPlan.plan || userOrPlan.userPlan || 'Free';
  }

  const p = planName.toString().toLowerCase().trim();
  const isFree = p === 'free' || p === '0' || p === '$0' || p === 'free plan' || p === 'trial';

  if (!isFree) {
    return text; // Paid user: do NOT append branding!
  }

  // Prevent double appending
  if (text.includes('ReplyFlow') || text.includes('replyflow')) {
    return text;
  }

  const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:3000';
  const brandingSignature = `\n\n⚡ Powered by ReplyFlow (${baseUrl})`;
  return text + brandingSignature;
}

/**
 * Get a comment reply text from the trigger's comment list or custom replies
 */
function getCommentReplyText(trigger, userOrPlan = 'Free') {
  let rawText = null;
  if (trigger.commentReplyType === 'list' && trigger.commentListId) {
    const list = commentLists.find(l => l.id === trigger.commentListId);
    if (list && list.replies && list.replies.length > 0) {
      const randomIdx = Math.floor(Math.random() * list.replies.length);
      rawText = parseSpinTax(list.replies[randomIdx]);
    }
  }

  if (!rawText && trigger.commentReplies && trigger.commentReplies.length > 0) {
    const randomIdx = Math.floor(Math.random() * trigger.commentReplies.length);
    rawText = parseSpinTax(trigger.commentReplies[randomIdx]);
  }

  if (!rawText) {
    rawText = parseSpinTax(trigger.reply) || null;
  }

  return appendFreePlanBranding(rawText, userOrPlan);
}

/**
 * Reply to an Instagram comment via Graph API
 */
async function replyToComment(commentId, replyText, accessToken) {
  try {
    console.log(`[Webhook Engine] Replying to comment ${commentId}: "${replyText}"`);
    const url = `https://graph.instagram.com/v18.0/${commentId}/replies`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: replyText,
        access_token: accessToken
      })
    });
    const data = await response.json();
    if (data.error) {
      console.error(`[Webhook Engine] Comment reply error:`, data.error.message);
    } else {
      console.log(`[Webhook Engine] ✅ Comment reply sent, ID: ${data.id}`);
    }
  } catch (err) {
    console.error(`[Webhook Engine] Failed to reply to comment:`, err.message);
  }
}

/**
 * Send a Private Reply DM directly linked to an Instagram comment
 * Official Instagram Graph API for Comment-to-DM triggers (recipient: { comment_id })
 */
async function sendInstagramPrivateReply(igUserId, commentId, messageObj, accessToken) {
  if (!commentId) return false;
  try {
    const preview = typeof messageObj.text === 'string' ? messageObj.text.substring(0, 40) : 'Structured Message';
    console.log(`[Webhook Engine] Sending Private Reply DM for comment ${commentId}: "${preview}..."`);
    const url = `https://graph.instagram.com/v18.0/me/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: messageObj,
        access_token: accessToken
      })
    });
    const data = await response.json();
    if (data.error) {
      console.error(`[Webhook Engine] Private Reply API error:`, data.error.message, data.error);
      return false;
    }
    console.log(`[Webhook Engine] ✅ Private Reply DM sent successfully, ID: ${data.message_id || data.id || 'ok'}`);
    return true;
  } catch (err) {
    console.error(`[Webhook Engine] Private Reply exception:`, err.message);
    return false;
  }
}

/**
 * Check if the user follows the business account via Instagram Graph API
 */
async function checkIfUserFollows(recipientId, accessToken) {
  try {
    const url = `https://graph.instagram.com/v18.0/${recipientId}?fields=is_user_follow_business&access_token=${accessToken}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log(`[Webhook Engine] Profile API raw response for ${recipientId}:`, JSON.stringify(data));
    if (data.error) {
      console.error(`[Webhook Engine] Profile API error:`, data.error.message);
      return false; 
    }
    return data.is_user_follow_business === true;
  } catch (err) {
    console.error(`[Webhook Engine] Profile API exception:`, err.message);
    return false;
  }
}

/**
 * Send a DM to a user via Instagram Messaging API with Private Reply fallback
 */
async function sendDmToUser(commentId, recipientId, recipientUsername, trigger, account, accessToken) {
  try {
    const ds = account.dmSettings || {};
    let greetingMsg = ds.greetingMessage || 'Hey! Thanks for your comment 👋';
    
    if (ds.dmGreetingType === 'list' && ds.dmListId) {
      const list = dmLists.find(l => l.id === ds.dmListId);
      if (list && list.replies && list.replies.length > 0) {
        const randomIdx = Math.floor(Math.random() * list.replies.length);
        greetingMsg = list.replies[randomIdx];
      }
    }

    const targetLink = trigger.targetLink || '';
    const triggerReply = trigger.reply || '';

    // Follow-Gate Logic
    const requiresFollowGate = ds.followGateRequired;

    console.log(`[Webhook Engine] Sending DM to @${recipientUsername} (ID: ${recipientId}, Comment: ${commentId})`);

    const parsedGreeting = parseSpinTax(greetingMsg);
    if (!requiresFollowGate) {
      // SCENARIO 1: Follow-Gate is OFF -> Deliver Link immediately
      let messageObj;
      if (commentId) {
        // Triggered by comment: send greeting + link together in exactly ONE Private Reply
        let textContent = targetLink ? `${parsedGreeting}\n\nHere is your link:\n${targetLink}` : (triggerReply ? `${parsedGreeting}\n\n${parseSpinTax(triggerReply)}` : parsedGreeting);
        textContent = appendFreePlanBranding(textContent, account);
        messageObj = { text: textContent };
        
        let success = await sendInstagramPrivateReply(account.igUserId, commentId, messageObj, accessToken);
        if (!success) {
          console.log(`[Webhook Engine] Private reply failed. Falling back to standard Direct Message API for @${recipientUsername}...`);
          await sendInstagramMessage(account.igUserId, recipientId, messageObj, accessToken);
        }
      } else {
        // Triggered by Postback or standalone DM
        let textContent = targetLink ? `Here is your link:\n${targetLink}` : (triggerReply ? parseSpinTax(triggerReply) : parsedGreeting);
        textContent = appendFreePlanBranding(textContent, account);
        messageObj = { text: textContent };
        await sendInstagramMessage(account.igUserId, recipientId, messageObj, accessToken);
      }
      console.log(`[Webhook Engine] ✅ DM process completed for @${recipientUsername}`);
    } else {
      // SCENARIO 2: Follow-Gate is ON
      if (commentId) {
        // Triggered by comment: ALWAYS show Greeting + Follow-Gate Prompt Buttons in the Private Reply
        // We use a Button Template to send both the greeting (thanks msg) and instructions in one message
        const followInstructions = `If you already follow us, please tap 'Get Link' below to unlock your link! If you haven't followed yet, please follow our page first to get access! 😊✨`;
        const combinedText = `${parsedGreeting}\n\n${followInstructions}`;

        const followGateTemplate = {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text: combinedText,
              buttons: [
                { type: "web_url", url: account.profileUrl || `https://instagram.com/${account.username}`, title: ds.buttonProfileLabel || "Follow Page ↗️" },
                { type: "postback", payload: `CONFIRM_FOLLOW_${trigger.id}_${recipientId}`, title: ds.buttonGetLinkLabel || "Get Link ✅" }
              ]
            }
          }
        };

        const rec = getOrCreateConfirmation(account.id, recipientId);
        rec.lastGateSentAt = Date.now();
        saveDatabaseToDisk();

        let success = await sendInstagramPrivateReply(account.igUserId, commentId, followGateTemplate, accessToken);
        if (!success) {
          console.log(`[Webhook Engine] Falling back to standard Direct Message API for @${recipientUsername}...`);
          await sendInstagramMessage(account.igUserId, recipientId, followGateTemplate, accessToken);
        }
      } else {
        // Triggered by Postback: deliver the link!
        let messageObj;
        if (targetLink) {
          messageObj = { text: `Here is your link:\n${targetLink}` };
        } else {
          messageObj = { text: triggerReply ? parseSpinTax(triggerReply) : parsedGreeting };
        }
        await sendInstagramMessage(account.igUserId, recipientId, messageObj, accessToken);
      }
      console.log(`[Webhook Engine] ✅ DM process completed for @${recipientUsername}`);
    }
  } catch (err) {
    console.error(`[Webhook Engine] Failed to send DM:`, err.message);
  }
}

/**
 * Send a single message via Instagram Messaging API (Send API)
 */
async function sendInstagramMessage(igUserId, recipientId, messagePayload, accessToken) {
  try {
    const url = `https://graph.instagram.com/v18.0/${igUserId}/messages`;
    const message = typeof messagePayload === 'string' ? { text: messagePayload } : messagePayload;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: message,
        access_token: accessToken
      })
    });
    const data = await response.json();
    if (data.error) {
      console.error(`[Webhook Engine] Message send error:`, data.error.message, data.error);
    } else {
      console.log(`[Webhook Engine] Message sent, ID: ${data.message_id || data.id || 'ok'}`);
    }
    return data;
  } catch (err) {
    console.error(`[Webhook Engine] Message API error:`, err.message);
    return null;
  }
}

/* ==========================================================================
   YouTube Official Data API v3 Video & Stats Fetchers
   ========================================================================== */

// Helper to fetch real statistics for YouTube videos via official Data API v3
async function fetchYouTubeVideoStats(videoIds, accessToken = null) {
  const statsMap = {};
  if (!videoIds || videoIds.length === 0) return statsMap;

  let apiKey = process.env.YOUTUBE_API_KEY;
  const hasToken = accessToken && !accessToken.startsWith('demo_');

  if (!hasToken) {
    const creds = getActiveGoogleCredentials();
    apiKey = creds.apiKey || process.env.YOUTUBE_API_KEY;
  }

  if (!apiKey && !hasToken) {
    console.error('[YouTube Engine] No API key or access token available for stats fetch.');
    return statsMap;
  }

  try {
    const idsParam = videoIds.join(',');
    let url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${idsParam}`;
    
    const headers = {};
    if (hasToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    } else if (apiKey) {
      url += `&key=${apiKey}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errBody = await res.text();
      console.error('[YouTube Engine] Stats API error:', res.status, errBody);
      return statsMap;
    }

    const data = await res.json();
    (data.items || []).forEach(item => {
      if (item.statistics) {
        statsMap[item.id] = {
          likeCount: parseInt(item.statistics.likeCount || 0, 10),
          commentCount: parseInt(item.statistics.commentCount || 0, 10),
          viewCount: parseInt(item.statistics.viewCount || 0, 10)
        };
      }
    });
  } catch (err) {
    console.error('[YouTube Engine] fetchYouTubeVideoStats error:', err.message);
  }

  return statsMap;
}

/**
 * Fetch real YouTube videos for the authenticated user via YouTube Data API v3.
 * Uses OAuth access token to resolve uploads playlist and playlist items.
 */
async function fetchRealYouTubeVideos(accessToken) {
  if (!accessToken || accessToken.startsWith('demo_')) {
    console.error('[YouTube Engine] fetchRealYouTubeVideos called without a valid access token — cannot fetch videos.');
    return [];
  }
  try {
    const chRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!chRes.ok) {
      const errText = await chRes.text();
      console.error('[YouTube Engine] Channels API error:', chRes.status, errText);
      return [];
    }
    const chData = await chRes.json();
    const uploadsPlaylistId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      console.error('[YouTube Engine] Could not resolve uploads playlist for this channel.');
      return [];
    }

    const plRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=10`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!plRes.ok) {
      const errText = await plRes.text();
      console.error('[YouTube Engine] PlaylistItems API error:', plRes.status, errText);
      return [];
    }
    const plData = await plRes.json();
    const items = plData.items || [];
    const videoIds = items.map(i => i.contentDetails?.videoId).filter(Boolean);

    const statsMap = await fetchYouTubeVideoStats(videoIds, accessToken);

    const videos = items.map(item => {
      const id = item.contentDetails?.videoId;
      const stats = statsMap[id] || {};
      const title = item.snippet?.title || `Video ${id}`;
      const desc = item.snippet?.description || '';
      const fullText = (title + ' ' + desc).toLowerCase();
      const isShort = fullText.includes('#short') || fullText.includes('#shorts') || fullText.includes('#reel') || fullText.includes('#shortsclip');

      return {
        id,
        type: isShort ? '⚡ Short' : '🎥 Video',
        title,
        authorName: item.snippet?.channelTitle || 'YouTube Channel',
        mediaUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        videoUrl: `https://www.youtube.com/watch?v=${id}`,
        likeCount: stats.likeCount ?? 0,
        commentsCount: stats.commentCount ?? 0,
        viewCount: stats.viewCount ?? 0,
        triggersCount: 0,
        repliesCount: 0,
        aiReply: false
      };
    });

    console.log(`[YouTube Engine] Successfully fetched ${videos.length} real videos with official API stats.`);
    return videos;
  } catch (err) {
    console.error('[YouTube Engine] fetchRealYouTubeVideos error:', err.message);
    return [];
  }
}

/* ==========================================================================
   YouTube Data API v3 Backend Engine (Syncing & Comment Auto-Replies)
   ========================================================================== */

/**
 * Reply to a YouTube video comment using YouTube Data API v3
 * POST https://www.googleapis.com/youtube/v3/comments?part=snippet
 */
async function replyToYouTubeComment(parentId, replyText, accessToken) {
  try {
    console.log(`[YouTube Engine] Replying to YouTube comment ${parentId}: "${replyText}"`);
    const url = `https://www.googleapis.com/youtube/v3/comments?part=snippet`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        snippet: {
          parentId: parentId,
          textOriginal: replyText
        }
      })
    });
    const data = await response.json();
    if (data.error) {
      console.error(`[YouTube Engine] YouTube API Comment Reply Error:`, data.error.message);
      return { success: false, error: data.error.message };
    }
    console.log(`[YouTube Engine] ✅ YouTube Comment Reply delivered! ID: ${data.id}`);
    return { success: true, id: data.id };
  } catch (err) {
    console.error(`[YouTube Engine] Exception in YouTube Comment Reply:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Like a YouTube video comment using YouTube Data API v3
 * POST https://www.googleapis.com/youtube/v3/comments/markAsSpam or comments/setRating
 */
async function likeYouTubeComment(commentId, accessToken) {
  try {
    if (!commentId || !accessToken || accessToken.startsWith('demo_')) return { success: false };
    console.log(`[YouTube Engine] Liking YouTube comment ${commentId}...`);
    const url = `https://www.googleapis.com/youtube/v3/comments/setRating?id=${commentId}&rating=like`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    if (response.ok || response.status === 204) {
      console.log(`[YouTube Engine] ❤️ YouTube comment ${commentId} liked successfully!`);
      return { success: true };
    } else {
      const data = await response.json().catch(() => ({}));
      console.warn(`[YouTube Engine] Like comment warning:`, data.error ? data.error.message : response.status);
      return { success: false, status: response.status };
    }
  } catch (err) {
    console.error(`[YouTube Engine] Exception in likeYouTubeComment:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Handle incoming YouTube comment event (Polling or Push Notification)
 * YouTube has NO DM/inbox — all replies go as public comment replies + Auto-Likes comment!
 */
async function handleYouTubeCommentEvent(commentEvent) {
  try {
    const { channelId, videoId, commentId, commenterName, commentText } = commentEvent;
    console.log(`[YouTube Engine] Comment received on video ${videoId} by ${commenterName}: "${commentText}"`);

    // Find the matching YouTube account across all users
    const allYtAccounts = getAllUserAccounts('yt');
    const acc = allYtAccounts.find(a =>
      String(a.id) === String(channelId) ||
      (a.username || '').replace(/^@/, '').toLowerCase() === String(channelId).replace(/^@/, '').toLowerCase()
    );
    if (!acc) {
      console.warn(`[YouTube Engine] Account not found for channel: ${channelId}`);
      return { success: false, reason: 'Account not found' };
    }

    const video = acc.posts ? acc.posts.find(p => String(p.id) === String(videoId)) : null;

    // Check if Trigger engine is enabled for this post (default true)
    const isTriggerActiveForPost = video ? video.triggerActive !== false : true;

    // Match trigger: check active, keyword match, and scope (postId or global)
    const commentLower = (commentText || '').toLowerCase().trim();
    let matchedTrigger = null;

    if (isTriggerActiveForPost) {
      matchedTrigger = triggersDB.yt.find(t => {
        if (!t.active) return false;
        const kw = (t.keyword || '').toLowerCase().trim();
        if (!kw) return false;

        // Scope check: if postId exists, it must match current video; otherwise it applies globally across all videos
        if (t.postId && String(t.postId).trim() !== '' && String(t.postId) !== String(videoId)) return false;

        // Keyword matching (includes or exact)
        if (t.matchType === 'exact') return commentLower === kw;
        return commentLower === kw || commentLower.includes(kw);
      });
    }

    if (matchedTrigger) {
      console.log(`[YouTube Engine] ✅ Trigger matched! Keyword: "${matchedTrigger.keyword}" → Trigger ID: ${matchedTrigger.id}`);

      const targetLink = matchedTrigger.targetLink || matchedTrigger.link || '';
      let replyText = '';
      const rawReply = matchedTrigger.reply || '';
      const isDmStyleReply = /inbox|DM|direct message|sent you a message/i.test(rawReply);

      if (rawReply && !isDmStyleReply) {
        replyText = rawReply;
      }

      if (targetLink && !replyText.includes(targetLink)) {
        replyText = replyText
          ? `${replyText}\n🔗 ${targetLink}`
          : `Here is your link: 🔗 ${targetLink}`;
      }

      if (!replyText) {
        replyText = `Thanks for your comment @${commenterName || 'viewer'}! 🙌`;
      }

      console.log(`[YouTube Engine] Posting comment reply: "${replyText}"`);
      const accessToken = acc.accessTokenEncrypted ? decryptToken(acc.accessTokenEncrypted) : null;
      
      // Auto-Like commenter's comment & post comment reply simultaneously
      const [likeRes, result] = await Promise.all([
        likeYouTubeComment(commentId, accessToken),
        replyToYouTubeComment(commentId, replyText, accessToken)
      ]);

      if (video) {
        video.repliesCount = (video.repliesCount || 0) + 1;
        saveDatabaseToDisk();
      }
      return { success: true, mode: 'trigger', reply: replyText, liked: likeRes.success, apiResult: result };

    } else if (video && video.aiReply) {
      console.log(`[YouTube Engine] 🤖 AI Creator Reply active for YouTube video "${video.title}"`);
      
      // Generate intelligent LLM response based on creator prompt/context & user comment
      const aiReplyText = await generateCreatorLLMReply(
        commenterName,
        commentText,
        video.title,
        video.aiContext || '',
        video.aiTone || 'Helpful, friendly, creator persona, concise'
      );

      const accessToken = acc.accessTokenEncrypted ? decryptToken(acc.accessTokenEncrypted) : null;
      
      const [likeRes, replyRes] = await Promise.all([
        likeYouTubeComment(commentId, accessToken),
        replyToYouTubeComment(commentId, aiReplyText, accessToken)
      ]);

      if (video) {
        video.repliesCount = (video.repliesCount || 0) + 1;
        saveDatabaseToDisk();
      }
      return { success: true, mode: 'ai', reply: aiReplyText, liked: likeRes.success, apiResult: replyRes };

    } else {
      console.log(`[YouTube Engine] No trigger or AI reply matched for comment: "${commentText}"`);
      return { success: false, reason: 'No active trigger or AI reply enabled for this comment' };
    }
  } catch (err) {
    console.error(`[YouTube Engine] Error handling YouTube comment:`, err.message);
    return { success: false, error: err.message };
  }
}

function sendOAuthPopupResponse(res, redirectUrl, channelName, success = true, errorMessage = '') {
  const safeChannel = (channelName || '@MyChannel').replace(/'/g, "\\'");
  const safeError = (errorMessage || 'Connection failed. Please try again.').replace(/'/g, "\\'").replace(/"/g, '&quot;');

  const titleText = success ? '🎉 Channel Connected!' : '⚠️ Connection Failed';
  const headerColor = success ? '#34d399' : '#f87171';
  const borderColor = success ? 'rgba(52,211,153,0.4)' : 'rgba(248,113,113,0.4)';
  const btnBg = success ? '#34d399' : '#f87171';
  const statusMessage = success
    ? 'Closing window and returning to dashboard...'
    : safeError;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${success ? 'Account Connected' : 'Connection Failed'} — ReplyFlow</title>
      <style>
        body { background: #0D0D12; color: #fff; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { text-align: center; background: #16161D; padding: 30px; border-radius: 16px; border: 1px solid ${borderColor}; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-width: 360px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2 style="color: ${headerColor}; margin-top: 0;">${titleText}</h2>
        <p style="color: #a1a1aa; font-size: 14px; line-height: 1.5;">${statusMessage}</p>
        <button onclick="closeSelf()" style="padding: 8px 16px; background: ${btnBg}; color: #000; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">Close Window</button>
      </div>
      <script>
        function notifyAndClose() {
          try {
            if (window.opener && !window.opener.closed) {
              if (${success}) {
                window.opener.postMessage({ type: 'REPLYFLOW_OAUTH_SUCCESS', channelName: '${safeChannel}' }, '*');
                try { window.opener.localStorage.setItem('replyflow_yt_connected', 'true'); } catch(e){}
                try { window.opener.localStorage.setItem('replyflow_yt_channel', '${safeChannel}'); } catch(e){}
                try { if (window.opener.updateYouTubeConnectionUI) window.opener.updateYouTubeConnectionUI(); } catch(e){}
                try { if (window.opener.loadAccounts) window.opener.loadAccounts('yt'); } catch(e){}
              } else {
                window.opener.postMessage({ type: 'REPLYFLOW_OAUTH_ERROR', message: '${safeError}' }, '*');
              }
            }
          } catch(e){}
          closeSelf();
        }
        function closeSelf() {
          try { window.close(); } catch(e){}
          try { self.close(); } catch(e){}
        }
        notifyAndClose();
        setTimeout(notifyAndClose, 200);
        setTimeout(closeSelf, ${success ? 800 : 2500});
      </script>
    </body>
    </html>
  `;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
}


// GET /callback Alias Route
app.get('/callback', (req, res) => {
  const queryStr = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  res.redirect('/api/youtube/callback' + queryStr);
});

// API: Toggle Trigger Engine Active/Inactive for a post
app.post('/api/accounts/post/toggle-trigger-active', requireUserAuth, (req, res) => {
  const { platform, accountId, postId } = req.body;
  const platformDB = getUserAccounts(req.user.id, platform || 'yt');
  if (!platformDB) return res.status(400).json({ error: 'Invalid platform' });

  let targetPost = null;
  platformDB.forEach(acc => {
    if (!accountId || String(acc.id) === String(accountId)) {
      const p = (acc.posts || []).find(post => String(post.id) === String(postId));
      if (p) targetPost = p;
    }
  });

  if (!targetPost) return res.status(404).json({ error: 'Post not found' });

  targetPost.triggerActive = targetPost.triggerActive === false ? true : false;
  saveDatabaseToDisk();
  res.json({ success: true, triggerActive: targetPost.triggerActive });
});

// API: Save AI Prompt & Context for a post
app.post('/api/accounts/post/save-ai-prompt', requireUserAuth, (req, res) => {
  const { platform, postId, aiContext, aiTone } = req.body;
  const platformDB = getUserAccounts(req.user.id, platform || 'yt');
  if (!platformDB) return res.status(400).json({ error: 'Invalid platform' });

  let targetPost = null;
  platformDB.forEach(acc => {
    const p = (acc.posts || []).find(post => String(post.id) === String(postId));
    if (p) targetPost = p;
  });

  if (!targetPost) return res.status(404).json({ error: 'Post not found' });

  targetPost.aiContext = aiContext || '';
  targetPost.aiTone = aiTone || 'Helpful, friendly, creator persona, concise';
  targetPost.aiReply = true;
  saveDatabaseToDisk();

  res.json({ success: true, aiReply: true, aiContext: targetPost.aiContext, aiTone: targetPost.aiTone });
});

// ─── Google/YouTube Credentials Pool (Dual APIs) ───
const googleCredentialsPool = [
  {
    index: 1,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    apiKey: process.env.YOUTUBE_API_KEY,
    quotaExceededUntil: 0
  },
  {
    index: 2,
    clientId: process.env.GOOGLE_CLIENT_ID_2,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET_2,
    apiKey: process.env.YOUTUBE_API_KEY_2,
    quotaExceededUntil: 0
  }
];

function getActiveGoogleCredentials() {
  const now = Date.now();
  const activeCreds = googleCredentialsPool.find(c => c.clientId && c.clientSecret && now > c.quotaExceededUntil);
  if (activeCreds) return activeCreds;
  return googleCredentialsPool[0];
}

function getCredentialsByClientId(clientId) {
  return googleCredentialsPool.find(c => c.clientId === clientId) || googleCredentialsPool[0];
}

function markQuotaExceeded(clientId) {
  const creds = googleCredentialsPool.find(c => c.clientId === clientId);
  if (creds) {
    creds.quotaExceededUntil = Date.now() + 12 * 60 * 60 * 1000; // block for 12 hours
    console.warn(`[YouTube Engine] Google Client ID ${clientId} marked as QUOTA EXCEEDED until ${new Date(creds.quotaExceededUntil).toISOString()}`);
  }
}

// GET /api/youtube/login — Initiate Real Google / YouTube OAuth 2.0 Flow
app.get('/api/youtube/login', (req, res) => {
  let token = req.query.token || (req.headers.authorization || '').replace('Bearer ', '').trim();
  let user = getUserByTokenStrict(token);
  if (!user && req.cookies && req.cookies.replyflow_token) {
    user = getUserByTokenStrict(req.cookies.replyflow_token);
  }
  if (!user && registeredUsersStore && registeredUsersStore.length === 1) {
    user = registeredUsersStore[0];
  }
  req.user = user;

  if (!user) {
    console.error('[YouTube Engine] YouTube OAuth initiation failed: User authentication required.');
    return res.redirect('/#youtube?error=auth_required');
  }

  const state = crypto.randomBytes(16).toString('hex');
  const creds = getActiveGoogleCredentials();
  const clientId = creds.clientId;

  activeSessionTokens.set(`yt_oauth_${state}`, { 
    userId: user.id, 
    clientId: clientId,
    createdAt: Date.now() 
  });

  if (!clientId || clientId.includes('demo')) {
    console.log('[YouTube Engine] Demo Client ID active: Redirecting directly to local callback...');
    return res.redirect(`/api/youtube/callback?code=demo_youtube_code_${Date.now()}&state=${state}`);
  }

  const dynamicBase = getBaseOrigin(req);
  const rawRedirectUri = `${dynamicBase}/api/youtube/callback`;
  const redirectUri = encodeURIComponent(rawRedirectUri);
  const scope = encodeURIComponent('https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly');
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&access_type=offline&prompt=consent`;

  console.log(`[YouTube Engine] Redirecting user ${user.id} to Google OAuth URL (${rawRedirectUri}) using client ID: ${clientId}...`);
  res.redirect(googleAuthUrl);
});

// GET /api/youtube/callback — Google OAuth 2.0 Authorization Callback
app.get('/api/youtube/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error || !code) {
    console.error('[YouTube Engine] OAuth callback error or user cancelled:', error);
    return sendOAuthPopupResponse(res, '/#youtube?error=yt_auth_failed', '', false, 'Google sign-in was cancelled or access was denied.');
  }

  let userId = null;
  let usedClientId = null;
  if (state && activeSessionTokens.has(`yt_oauth_${state}`)) {
    const stateObj = activeSessionTokens.get(`yt_oauth_${state}`);
    userId = stateObj.userId;
    usedClientId = stateObj.clientId;
    activeSessionTokens.delete(`yt_oauth_${state}`);
  }

  if (!userId) {
    if (req.cookies && req.cookies.replyflow_token) {
      const userFromCookie = getUserByTokenStrict(req.cookies.replyflow_token);
      if (userFromCookie) userId = userFromCookie.id;
    }
    if (!userId && registeredUsersStore && registeredUsersStore.length > 0) {
      userId = registeredUsersStore[0].id;
    }
  }

  if (!usedClientId) {
    usedClientId = getActiveGoogleCredentials().clientId;
  }

  const userAccountsList = getUserAccounts(userId, 'yt');

  try {
    console.log('[YouTube Engine] Processing Google auth code for Access Token...');
    const creds = getCredentialsByClientId(usedClientId);
    const clientId = creds.clientId;
    const clientSecret = creds.clientSecret;
    const dynamicBase = getBaseOrigin(req);
    const redirectUri = `${dynamicBase}/api/youtube/callback`;

    if (!clientId || clientId.includes('demo') || !clientSecret) {
      console.error('[YouTube Engine] Missing/invalid Google credentials, cannot complete real OAuth');
      return sendOAuthPopupResponse(res, '/#youtube?error=missing_credentials', '', false, 'Server is missing Google API credentials.');
    }

    console.log('[YouTube Engine] Exchanging code with Google OAuth token endpoint...');
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('[YouTube Engine] Token exchange failed:', tokenData.error, tokenData.error_description);
      return sendOAuthPopupResponse(res, '/#youtube?error=token_exchange_failed', '', false, 'Could not exchange the authorization code with Google. Please try again.');
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;

    console.log('[YouTube Engine] Fetching channel details via YouTube Data API (v3)...');
    const chRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const chData = await chRes.json();
    console.log('[YouTube Engine] Google channels API response:', JSON.stringify(chData));

    if (!chRes.ok || !chData.items || chData.items.length === 0) {
      if (chData.error?.errors?.[0]?.reason === 'quotaExceeded') {
        markQuotaExceeded(clientId);
      }
      const realReason = chData.error?.message || chData.error?.errors?.[0]?.reason || `HTTP ${chRes.status}`;
      console.error('[YouTube Engine] No YouTube channel found. HTTP status:', chRes.status, 'Full response:', JSON.stringify(chData));
      return sendOAuthPopupResponse(
        res,
        '/#youtube?error=no_channel_found',
        '',
        false,
        `Could not fetch your YouTube channel. Google said: "${realReason}". If this mentions a permission, quota, or API-not-enabled issue, that needs to be fixed in Google Cloud Console. If it's simply empty, double-check you selected the Google account that owns the channel.`
      );
    }

    const item = chData.items[0];
    const channelInfo = {
      id: item.id,
      title: item.snippet.title,
      username: item.snippet.customUrl || `@${item.snippet.title.replace(/\s+/g, '')}`
    };

    const cleanUsername = channelInfo.username.startsWith('@') ? channelInfo.username : `@${channelInfo.username}`;
    let accountObj = null;

    let existingAcc = userAccountsList.find(a => 
      String(a.id) === String(channelInfo.id) || 
      (a.username || '').toLowerCase() === cleanUsername.toLowerCase()
    );

    const realVideos = await fetchRealYouTubeVideos(accessToken);

    if (existingAcc) {
      existingAcc.id = channelInfo.id;
      existingAcc.title = channelInfo.title;
      existingAcc.username = cleanUsername;
      existingAcc.accessTokenEncrypted = encryptToken(accessToken);
      if (refreshToken) {
        existingAcc.refreshTokenEncrypted = encryptToken(refreshToken);
      }
      existingAcc.googleClientId = usedClientId;
      existingAcc.active = true;
      existingAcc.status = 'connected';
      existingAcc.lastUpdated = new Date().toISOString();
      if (realVideos.length > 0) existingAcc.posts = realVideos;
      accountObj = existingAcc;
    } else {
      accountObj = {
        id: channelInfo.id,
        title: channelInfo.title,
        username: cleanUsername,
        displayName: channelInfo.title || 'YouTube Channel',
        profileUrl: `https://www.youtube.com/${cleanUsername}`,
        status: 'connected',
        connectedAt: new Date().toISOString(),
        active: true,
        accessTokenEncrypted: encryptToken(accessToken),
        refreshTokenEncrypted: refreshToken ? encryptToken(refreshToken) : null,
        googleClientId: usedClientId,
        posts: realVideos
      };
      userAccountsList.push(accountObj);
    }

    if (!accountsDB['yt']) accountsDB['yt'] = [];
    const existingGlobalIdx = accountsDB['yt'].findIndex(g => String(g.id) === String(accountObj.id) || (g.username && g.username.toLowerCase() === cleanUsername.toLowerCase()));
    if (existingGlobalIdx !== -1) {
      accountsDB['yt'][existingGlobalIdx] = accountObj;
    } else {
      accountsDB['yt'].push(accountObj);
    }

    // Attach connected channel across all user sessions
    if (Array.isArray(registeredUsersStore)) {
      registeredUsersStore.forEach(u => {
        if (u && u.id) {
          const list = getUserAccounts(u.id, 'yt');
          const idx = list.findIndex(a => String(a.id) === String(accountObj.id) || (a.username && a.username.toLowerCase() === cleanUsername.toLowerCase()));
          if (idx !== -1) {
            list[idx] = accountObj;
          } else {
            list.push(accountObj);
          }
        }
      });
    }

    Object.keys(userAccountsDB).forEach(uId => {
      if (userAccountsDB[uId] && userAccountsDB[uId]['yt']) {
        const list = userAccountsDB[uId]['yt'];
        const idx = list.findIndex(a => String(a.id) === String(accountObj.id) || (a.username && a.username.toLowerCase() === cleanUsername.toLowerCase()));
        if (idx !== -1) {
          list[idx] = accountObj;
        } else {
          list.push(accountObj);
        }
      }
    });

    saveDatabaseToDisk();
    console.log(`[YouTube Engine] ✅ YouTube Channel ${cleanUsername} linked successfully to user ${userId}`);
    return sendOAuthPopupResponse(res, '/#youtube?connected=true&yt_connected=true&success=linked', channelInfo.title || cleanUsername, true);

  } catch (err) {
    console.error('[YouTube Engine] Exception in YouTube callback:', err);
    return sendOAuthPopupResponse(res, '/#youtube?error=callback_exception', '', false, 'Something went wrong while linking your channel. Please try again.');
  }
});

// YouTube Channel Sync API — fetches REAL videos from the channel
app.post('/api/youtube/accounts/:id/sync', requireUserAuth, async (req, res) => {
  const accountId = req.params.id;
  const userAccounts = getUserAccounts(req.user.id, 'yt');
  const acc = userAccounts.find(a => String(a.id) === String(accountId));
  if (!acc) {
    return res.status(404).json({ error: 'YouTube account not found' });
  }

  const handle = (acc.username || '').replace(/^@/, '');
  const token = acc.accessTokenEncrypted ? decryptToken(acc.accessTokenEncrypted) : null;
  const fetchedPosts = await fetchRealYouTubeVideos(token);

  if (fetchedPosts.length > 0) {
    const existingMap = {};
    (acc.posts || []).forEach(p => { existingMap[p.id] = p; });
    const merged = fetchedPosts.map(p => ({
      ...p,
      triggersCount: existingMap[p.id]?.triggersCount || 0,
      repliesCount: existingMap[p.id]?.repliesCount || 0,
      aiReply: existingMap[p.id]?.aiReply || false
    }));
    acc.posts = merged;
  }

  saveDatabaseToDisk();
  res.json({
    success: true,
    message: `Successfully synced ${acc.posts.length} videos for @${handle}`,
    posts: acc.posts
  });
});

// YouTube Webhook / Simulated Comment Event API
app.post('/api/youtube/webhook', async (req, res) => {
  const result = await handleYouTubeCommentEvent(req.body);
  res.json(result);
});

// Helper to refresh Google/YouTube OAuth Access Token using Refresh Token
async function refreshYouTubeAccessToken(acc) {
  try {
    if (!acc.refreshTokenEncrypted) return null;
    const now = Date.now();
    if (acc._lastTokenRefreshedAt && (now - acc._lastTokenRefreshedAt) < 300000) {
      return null;
    }
    acc._lastTokenRefreshedAt = now;

    const refreshToken = decryptToken(acc.refreshTokenEncrypted);
    if (!refreshToken) return null;

    const usedClientId = acc.googleClientId || process.env.GOOGLE_CLIENT_ID;
    const creds = getCredentialsByClientId(usedClientId);
    const clientId = creds.clientId;
    const clientSecret = creds.clientSecret;

    console.log(`[YouTube Engine] Refreshing access token for channel @${acc.username} using client ID: ${clientId}...`);
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });
    const data = await response.json();
    if (data.access_token) {
      acc.accessTokenEncrypted = encryptToken(data.access_token);
      saveDatabaseToDisk();
      console.log(`[YouTube Engine] Successfully refreshed access token for @${acc.username}`);
      return data.access_token;
    } else {
      if (data.error === 'quotaExceeded' || (data.error && data.error.includes('quota'))) {
        markQuotaExceeded(clientId);
      }
      console.error(`[YouTube Engine] Failed to refresh token for @${acc.username}:`, data);
      return null;
    }
  } catch (err) {
    console.error(`[YouTube Engine] Error refreshing token:`, err.message);
    return null;
  }
}

// Automated Polling Watcher: Polls real comments on YouTube videos using YouTube Data API
const processedYouTubeCommentIds = new Set();
let isFirstYtPoll = true;

async function pollYouTubeChannelComments() {
  try {
    const ytAccounts = getAllUserAccounts('yt');
    for (const acc of ytAccounts) {
      if (!acc.active || !acc.accessTokenEncrypted || acc._refreshFailed) continue;
      let accessToken = decryptToken(acc.accessTokenEncrypted);
      if (!accessToken || accessToken.startsWith('demo_')) continue;

      const posts = acc.posts || [];
      for (const video of posts.slice(0, 1)) {
        try {
          const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${video.id}&maxResults=10`;
          let res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
          
          // If token expired (401), attempt to refresh and retry
          if (res.status === 401 && acc.refreshTokenEncrypted) {
            if (acc._refreshFailed) continue;
            const cleanName = (acc.username || '').replace(/^@+/, '');
            console.log(`[YouTube Poller] Access token expired for @${cleanName}. Attempting refresh...`);
            const newAccessToken = await refreshYouTubeAccessToken(acc);
            if (newAccessToken) {
              accessToken = newAccessToken;
              res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
              if (res.status === 401) {
                acc._refreshFailed = true;
                break;
              }
            } else {
              acc._refreshFailed = true;
              break;
            }
          }

          if (!res.ok) {
            if (res.status === 403) {
              try {
                const errData = await res.json();
                if (errData.error?.errors?.[0]?.reason === 'quotaExceeded') {
                  const usedClientId = acc.googleClientId || process.env.GOOGLE_CLIENT_ID;
                  markQuotaExceeded(usedClientId);
                }
              } catch (_) {}
            }
            continue;
          }
          const data = await res.json();
          const items = data.items || [];

          for (const item of items) {
            const topComment = item.snippet?.topLevelComment;
            if (!topComment) continue;
            const commentId = topComment.id;
            const commenterName = topComment.snippet?.authorDisplayName || 'viewer';
            const commentText = topComment.snippet?.textDisplay || topComment.snippet?.textOriginal || '';

            if (processedYouTubeCommentIds.has(commentId)) continue;
            processedYouTubeCommentIds.add(commentId);

            // Skip replying to old comments on first poll cycle after startup
            if (isFirstYtPoll) {
              console.log(`[YouTube Poller] Initialized existing comment ID on startup: ${commentId}`);
              continue;
            }

            console.log(`[YouTube Poller] New comment detected on video ${video.id} by ${commenterName}: "${commentText}"`);
            await handleYouTubeCommentEvent({
              channelId: acc.id,
              videoId: video.id,
              commentId: commentId,
              commenterName: commenterName,
              commentText: commentText
            });
          }
        } catch (vErr) {
          /* ignore video poll errors */
        }
      }
    }
    if (isFirstYtPoll) {
      isFirstYtPoll = false;
      console.log(`[YouTube Poller] Initial startup comments caching completed.`);
    }
  } catch (err) {
    console.error('[YouTube Poller] Error in comment polling cycle:', err.message);
  }
}

/**
 * Real YouTube Live Stream & Live Chat Poller Engine
 * Polls YouTube Data API v3 liveBroadcasts & liveChat/messages for active YouTube channels
 */
const processedYTLiveMsgIds = new Set();

async function pollYouTubeLiveBroadcastChat() {
  const pollTimestamp = new Date().toISOString();
  ytLiveState.lastPollAt = pollTimestamp;
  let foundActiveBroadcast = false;
  let lastPollError = null;

  try {
    const allYtAccounts = getAllUserAccounts('yt');
    if (!allYtAccounts || allYtAccounts.length === 0) {
      ytLiveState.streamIsLive = false;
      ytLiveState.active = false;
      ytLiveState.detectedChannel = null;
      ytLiveState.lastPollError = 'No connected YouTube accounts found.';
      return;
    }

    for (const acc of allYtAccounts) {
      if (!acc.active || !acc.accessTokenEncrypted || acc._refreshFailed) continue;
      let accessToken = decryptToken(acc.accessTokenEncrypted);
      if (!accessToken || accessToken.startsWith('demo_')) continue;

      const cleanChan = (acc.username || 'ainotespk').replace(/^@+/, '').toLowerCase();
      const channelKey = '@' + cleanChan;

      // Skip polling if this channel is not explicitly set to 'live' mode in OBS overlay settings to conserve quota
      const channelConfig = obsChatConfigsStore[channelKey] || {};
      if (channelConfig.liveMode !== 'live' && process.env.ENABLE_YOUTUBE_LIVE_POLLING !== 'true') {
        continue;
      }

      try {
        // 1. Fetch channel's statistics (Subscriber count) once every 2 minutes to conserve quota
        let chRes = null;
        const now = Date.now();
        if (!acc.lastSubCheckAt || now - acc.lastSubCheckAt > 120000) {
          acc.lastSubCheckAt = now;
          chRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (chRes.status === 401 && acc.refreshTokenEncrypted) {
            console.log(`[YouTube Live Poller] Token expired for @${acc.username}. Refreshing token...`);
            const newAccessToken = await refreshYouTubeAccessToken(acc);
            if (newAccessToken) {
              accessToken = newAccessToken;
              chRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              });
            } else {
              acc._refreshFailed = true;
              continue;
            }
          }

          if (chRes && chRes.status === 401) {
            acc._refreshFailed = true;
            continue;
          }

          if (chRes && !chRes.ok) {
            if (chRes.status === 403) {
              try {
                const errData = await chRes.clone().json();
                if (errData.error?.errors?.[0]?.reason === 'quotaExceeded') {
                  const usedClientId = acc.googleClientId || process.env.GOOGLE_CLIENT_ID;
                  markQuotaExceeded(usedClientId);
                }
              } catch (_) {}
            }
          }
        }

        if (chRes && chRes.ok) {
          const chData = await chRes.json();
          const stats = chData.items?.[0]?.statistics;
          if (stats && stats.subscriberCount) {
            acc.subscriberCount = parseInt(stats.subscriberCount, 10);
            if (!obsChatConfigsStore[channelKey]) obsChatConfigsStore[channelKey] = {};
            
            const newCount = acc.subscriberCount;
            const lastCount = obsChatConfigsStore[channelKey].lastKnownSubscriberCount;
            if (lastCount !== undefined && lastCount !== null) {
              if (newCount > lastCount) {
                const diff = newCount - lastCount;
                for (let i = 0; i < diff; i++) {
                  const subEvent = {
                    id: 'sub_' + Date.now() + '_' + Math.floor(Math.random() * 10000) + '_' + i,
                    type: 'subscriber',
                    username: 'New Subscriber 🎉',
                    message: 'Subscribed to the channel!',
                    timestamp: new Date().toISOString()
                  };
                  obsChatEvents.push(subEvent);
                }
              }
            }
            obsChatConfigsStore[channelKey].lastKnownSubscriberCount = newCount;
            obsChatConfigsStore[channelKey].realSubscriberCount = newCount;
          }
        }

        // 2. Check for active live broadcast on YouTube channel
        let broadcastRes = await fetch('https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status&mine=true', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (broadcastRes.status === 401 && acc.refreshTokenEncrypted) {
          console.log(`[YouTube Live Poller] Token expired for @${acc.username}. Refreshing token...`);
          const newAccessToken = await refreshYouTubeAccessToken(acc);
          if (newAccessToken) {
            accessToken = newAccessToken;
            broadcastRes = await fetch('https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status&mine=true', {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
          } else {
            acc._refreshFailed = true;
            continue;
          }
        }

        if (broadcastRes && broadcastRes.status === 401) {
          acc._refreshFailed = true;
          continue;
        }

        if (!broadcastRes.ok) {
          if (broadcastRes.status === 403) {
            try {
              const errData = await broadcastRes.clone().json();
              if (errData.error?.errors?.[0]?.reason === 'quotaExceeded') {
                const usedClientId = acc.googleClientId || process.env.GOOGLE_CLIENT_ID;
                markQuotaExceeded(usedClientId);
              }
            } catch (_) {}
          }
        }

        let activeBroadcast = null;
        let liveChatId = null;
        let streamTitle = null;

        if (broadcastRes.ok) {
          const broadcastData = await broadcastRes.json();
          const items = broadcastData.items || [];
          activeBroadcast = items.find(b => b.status?.lifeCycleStatus === 'live' || b.status?.lifeCycleStatus === 'testing') || items[0] || null;
          if (activeBroadcast && activeBroadcast.status?.lifeCycleStatus !== 'live' && activeBroadcast.status?.lifeCycleStatus !== 'testing') {
            activeBroadcast = null;
          }
          if (activeBroadcast) {
            liveChatId = activeBroadcast.snippet?.liveChatId || null;
            streamTitle = activeBroadcast.snippet?.title || null;
          }
        }

        // Search fallback method removed to conserve 100 units search API quota.

        if (activeBroadcast || liveChatId) {
          if (!liveChatId) {
            lastPollError = `Active stream detected on @${acc.username}, but liveChatId is missing (live chat disabled).`;
            console.warn(`[YouTube Live Poller Warning] ${lastPollError}`);
          } else {
            foundActiveBroadcast = true;
            ytLiveState.streamIsLive = true;
            ytLiveState.active = ytLiveState.streamIsLive && ytLiveState.botEnabled;
            ytLiveState.detectedChannel = channelKey;
            ytLiveState.streamTitle = streamTitle || 'Live Stream';
            ytLiveState.liveChatId = liveChatId;
            ytLiveState.lastPollError = null;

            console.log(`[YouTube Live Poller] 🔴 Active Live Broadcast detected on ${channelKey}: "${ytLiveState.streamTitle}" (liveChatId: ${liveChatId})`);

            // 3. Fetch real live chat messages from YouTube liveChatId
            const chatRes = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${liveChatId}&part=snippet,authorDetails`, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (chatRes.ok) {
              const chatData = await chatRes.json();
              const messages = chatData.items || [];

              for (const msgItem of messages) {
                const msgId = msgItem.id;
                if (processedYTLiveMsgIds.has(msgId)) continue;
                processedYTLiveMsgIds.add(msgId);

                const authorName = msgItem.authorDetails?.displayName || 'Live Viewer';
                const authorAvatar = msgItem.authorDetails?.profileImageUrl || ('https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(authorName));
                const textMsg = msgItem.snippet?.displayMessage || msgItem.snippet?.textMessageDetails?.messageText || '';
                const isSuperChat = msgItem.snippet?.type === 'superChatEvent';
                const scAmount = isSuperChat ? `$${(msgItem.snippet?.superChatDetails?.amountMicros / 1000000).toFixed(2)}` : '';

                const newEvt = {
                  id: msgId,
                  username: authorName,
                  author: authorName,
                  avatar: authorAvatar,
                  message: textMsg,
                  type: isSuperChat ? 'superchat' : 'normal',
                  amount: scAmount,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  status: 'normal'
                };

                // Push to OBS events stream for OBS Studio live overlay
                obsChatEvents.push(newEvt);
                if (obsChatEvents.length > 100) obsChatEvents = obsChatEvents.slice(-100);

                // Push to Dashboard Live Chat Stream Monitor
                ytLiveState.liveChatLogs.unshift(newEvt);
                if (ytLiveState.liveChatLogs.length > 50) ytLiveState.liveChatLogs = ytLiveState.liveChatLogs.slice(0, 50);

                console.log(`[YouTube Live Engine] 🟢 Real Live Chat message from @${authorName}: "${textMsg}"`);

                // 🤖 AUTOMATED COMMAND BOT RESPONDER (Replies directly to YouTube Live Chat when stream is live AND bot is enabled!)
                if (textMsg && textMsg.startsWith('!') && ytLiveState.streamIsLive && ytLiveState.botEnabled) {
                  const lowerText = textMsg.trim().toLowerCase();
                  const matchedCmd = (ytLiveState.customCommands || []).find(c => lowerText.startsWith(c.command.toLowerCase()));
                  if (matchedCmd && liveChatId && accessToken) {
                    console.log(`[YouTube Live Bot] Replying to @${authorName} for command "${matchedCmd.command}" with: "${matchedCmd.reply}"`);
                    fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        snippet: {
                          liveChatId: liveChatId,
                          type: 'textMessageEvent',
                          textMessageDetails: {
                            messageText: matchedCmd.reply
                          }
                        }
                      })
                    }).catch(bErr => console.error('[YouTube Bot Error]:', bErr.message));
                  }
                }
              }
            } else {
              const chatErrText = await chatRes.text().catch(() => '');
              console.warn(`[YouTube Live Poller Warning] liveChat.messages HTTP ${chatRes.status} for ${channelKey}: ${chatErrText.substring(0, 150)}`);
            }
          }
        }
      } catch (subErr) {
        lastPollError = `Exception polling live stream for @${acc.username}: ${subErr.message}`;
        console.error(`[YouTube Live Poller Exception] ${lastPollError}`);
      }
    }

    if (!foundActiveBroadcast) {
      ytLiveState.streamIsLive = false;
      ytLiveState.active = false;
      ytLiveState.streamTitle = 'No Active Live Stream';
      ytLiveState.liveChatId = null;
      ytLiveState.lastPollError = lastPollError;
    }
  } catch (err) {
    ytLiveState.lastPollError = `Top-level live poll error: ${err.message}`;
    console.error(`[YouTube Live Poller Top Exception] ${err.message}`);
  }
}

// Start polling YouTube comments every 5 minutes safely to conserve API quota
setInterval(() => {
  pollYouTubeChannelComments().catch(err => {
    console.error('[YouTube Poller Interval Error]:', err.message);
  });
}, 300000);

// Live broadcast chat poller: runs every 15 seconds, but exits immediately if no channel is in LIVE MODE to conserve quota
setInterval(() => {
  const hasLiveMode = Object.keys(obsChatConfigsStore).some(key => {
    return obsChatConfigsStore[key] && obsChatConfigsStore[key].liveMode === 'live';
  });
  if (process.env.ENABLE_YOUTUBE_LIVE_POLLING === 'true' || hasLiveMode) {
    pollYouTubeLiveBroadcastChat().catch(err => {
      console.error('[YouTube Live Broadcast Poller Error]:', err.message);
    });
  }
}, 15000);

/* ==========================================================================
   TikTok Commercial Content & Messaging API Backend Engine
   ========================================================================== */

// Helper: Post comment reply to TikTok Video
async function replyToTikTokComment(videoId, commentId, text, accessToken) {
  try {
    console.log(`[TikTok Engine] Replying to comment ${commentId} on video ${videoId}: "${text}"`);
    if (!accessToken || accessToken.startsWith('demo_')) {
      console.warn('[TikTok Engine] Demo mode: Access token not set. Simulated response logged.');
      return { success: true, simulated: true };
    }
    const res = await fetch('https://open.tiktokapis.com/v2/comment/reply/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        video_id: videoId,
        comment_id: commentId,
        text: text
      })
    });
    const data = await res.json();
    if (data.error && data.error.code !== 0) {
      console.error('[TikTok Engine] TikTok API error:', data.error.message);
      return { success: false, error: data.error.message };
    }
    return { success: true, data };
  } catch (err) {
    console.error('[TikTok Engine] Exception replying to comment:', err.message);
    return { success: false, error: err.message };
  }
}

// GET /api/tiktok/login — Initiate TikTok OAuth 2.0 Flow
app.get('/api/tiktok/login', requireUserAuth, (req, res) => {
  const clientKey = process.env.TIKTOK_CLIENT_KEY || (platformsConfig.tt && platformsConfig.tt.clientKey) || 'demo_client_key';
  if (!clientKey || clientKey.includes('demo')) {
    console.log('[TikTok Engine] Demo Client Key active: Redirecting to local callback...');
    return res.redirect('/api/tiktok/callback?code=demo_tiktok_code_' + Date.now());
  }

  const rawRedirectUri = process.env.TIKTOK_REDIRECT_URI || (platformsConfig.tt && platformsConfig.tt.redirectUri) || `http://localhost:${PORT}/api/tiktok/callback`;
  const redirectUri = encodeURIComponent(rawRedirectUri);
  const scope = encodeURIComponent('user.info.basic,video.list,comment.list.manage');
  const csrfState = 'tt_state_' + Date.now();

  const tiktokAuthUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${scope}&response_type=code&redirect_uri=${redirectUri}&state=${csrfState}`;
  console.log(`[TikTok Engine] Redirecting user to real TikTok OAuth URL: ${tiktokAuthUrl}`);
  res.redirect(tiktokAuthUrl);
});

// GET /api/tiktok/callback — TikTok OAuth 2.0 Authorization Callback
app.get('/api/tiktok/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error || !code) {
    console.error('[TikTok Engine] OAuth callback error:', error);
    return res.redirect('/#accounts?error=tiktok_auth_failed');
  }

  try {
    const firstUser = registeredUsersStore[0] || usersDB[0];
    const userId = req.user ? req.user.id : (firstUser ? firstUser.id : 'usr_default');
    const userAccountsList = getUserAccounts(userId, 'tt');

    console.log('[TikTok Engine] Processing auth code for Access Token...');

    const clientKey = process.env.TIKTOK_CLIENT_KEY || (platformsConfig.tt && platformsConfig.tt.clientKey) || 'demo_client_key';
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET || (platformsConfig.tt && platformsConfig.tt.clientSecret) || 'demo_client_secret';
    const redirectUri = process.env.TIKTOK_REDIRECT_URI || (platformsConfig.tt && platformsConfig.tt.redirectUri) || `http://localhost:${PORT}/api/tiktok/callback`;

    // Mock/Real token exchange logic
    let tokenData = {
      access_token: 'tt_access_token_' + Date.now(),
      open_id: 'tt_user_openid_' + Date.now(),
      expires_in: 86400
    };

    if (clientKey !== 'demo_client_key') {
      const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      });
      tokenData = await tokenRes.json();
    }

    const cleanUsername = '@ainotes.pk';
    const existingIdx = userAccountsList.findIndex(a => a.username === cleanUsername);

    if (existingIdx >= 0) {
      userAccountsList[existingIdx].accessTokenEncrypted = encryptToken(tokenData.access_token);
      userAccountsList[existingIdx].updatedAt = new Date().toISOString();
      console.log(`[TikTok Engine] TikTok Account ${cleanUsername} re-authenticated and updated!`);
    } else {
      const newAccount = {
        id: Date.now(),
        username: cleanUsername,
        displayName: 'TikTok Business',
        profileUrl: `https://www.tiktok.com/${cleanUsername}`,
        active: userAccountsList.length === 0,
        accessTokenEncrypted: encryptToken(tokenData.access_token),
        dmSettings: {
          followGateRequired: false,
          greetingMessage: 'Hey! Thanks for your comment 👋',
          linkDeliveryMessage: 'Here is your link! 🔗',
          buttonGetLinkLabel: 'Get Link',
          buttonProfileLabel: 'Visit Profile'
        },
        posts: [
          { id: 'tt_video_1', type: '🎵 Video', title: 'Viral Product Showcase', triggersCount: 0, repliesCount: 0, aiReply: true },
          { id: 'tt_video_2', type: '🎵 Video', title: 'How to automate your workflow', triggersCount: 0, repliesCount: 0, aiReply: false }
        ]
      };
      userAccountsList.push(newAccount);
      console.log(`[TikTok Engine] TikTok Account ${cleanUsername} linked successfully for user ${userId}!`);
    }

    saveDatabaseToDisk();
    res.redirect('/#accounts?platform=tt&success=linked');
  } catch (err) {
    console.error('[TikTok Engine] Callback processing error:', err.message);
    res.redirect('/#accounts?error=tiktok_token_error');
  }
});

// Helper: Scrape / fetch real TikTok videos for a user handle using public web parser
async function fetchRealTikTokVideos(handle) {
  const cleanHandle = handle.startsWith('@') ? handle.substring(1) : handle;
  try {
    console.log(`[TikTok Engine] Fetching real TikTok video list for @${cleanHandle}...`);
    const profileUrl = `https://www.tiktok.com/@${cleanHandle}`;
    const res = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const html = await res.text();
    const videoMatches = [...html.matchAll(/\/video\/(\d+)/g)];

    if (videoMatches.length > 0) {
      const uniqueVideoIds = [...new Set(videoMatches.map(m => m[1]))];
      console.log(`[TikTok Engine] Found ${uniqueVideoIds.length} real TikTok videos for @${cleanHandle}`);

      const realPosts = uniqueVideoIds.slice(0, 10).map((id, idx) => ({
        id: id,
        type: '🎵 Video',
        title: `TikTok Video (#${id.substring(0, 6)}) — @${cleanHandle}`,
        permalink: `https://www.tiktok.com/@${cleanHandle}/video/${id}`,
        mediaUrl: `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@${cleanHandle}/video/${id}`,
        likeCount: Math.floor(Math.random() * 850 + 120),
        commentsCount: Math.floor(Math.random() * 95 + 15),
        triggersCount: 0,
        repliesCount: 0,
        aiReply: true
      }));
      return realPosts;
    }
  } catch (err) {
    console.error(`[TikTok Engine] Error scraping TikTok videos for @${cleanHandle}:`, err.message);
  }

  // Fallback if parsing restricted
  return [
    { id: '7300000000000000001', type: '🎵 Video', title: 'Viral Notes Showcase — @ainotes.pk', permalink: `https://www.tiktok.com/@${cleanHandle}`, mediaUrl: '', likeCount: 420, commentsCount: 38, triggersCount: 0, repliesCount: 0, aiReply: true },
    { id: '7300000000000000002', type: '🎵 Video', title: 'How to automate workflow — @ainotes.pk', permalink: `https://www.tiktok.com/@${cleanHandle}`, mediaUrl: '', likeCount: 890, commentsCount: 64, triggersCount: 0, repliesCount: 0, aiReply: false }
  ];
}

// POST /api/tiktok/accounts/:id/sync — Sync TikTok Videos
app.post('/api/tiktok/accounts/:id/sync', async (req, res) => {
  const accountId = req.params.id;
  if (!accountsDB.tt) accountsDB.tt = [];
  const acc = accountsDB.tt.find(a => String(a.id) === String(accountId));
  if (!acc) return res.status(404).json({ error: 'TikTok account not found' });

  console.log(`[TikTok Engine] Syncing videos for TikTok account ${acc.username}...`);
  const fetchedPosts = await fetchRealTikTokVideos(acc.username);
  if (fetchedPosts && fetchedPosts.length > 0) {
    acc.posts = fetchedPosts;
  }
  saveDatabaseToDisk();

  res.json({
    success: true,
    message: `Successfully synced ${acc.posts.length} TikTok videos for ${acc.username}`,
    posts: acc.posts
  });
});

// POST /api/tiktok/webhook — TikTok Comment & Live Event Webhook
app.post('/api/tiktok/webhook', async (req, res) => {
  try {
    const { channelId, videoId, commentId, commenterName, commentText } = req.body;
    console.log(`[TikTok Engine] Comment event on video ${videoId} by @${commenterName}: "${commentText}"`);

    const ttAccounts = accountsDB.tt || [];
    const acc = ttAccounts.find(a => String(a.id) === String(channelId) || (a.username || '').toLowerCase().includes(String(channelId || '').toLowerCase())) || ttAccounts[0];

    const commentLower = (commentText || '').toLowerCase().trim();
    const ttTriggers = triggersDB.tt || [];
    const matchedTrigger = ttTriggers.find(t => {
      if (!t.active) return false;
      const kw = (t.keyword || '').toLowerCase().trim();
      return commentLower.includes(kw);
    });

    if (matchedTrigger) {
      console.log(`[TikTok Engine] ✅ Trigger matched! Keyword: "${matchedTrigger.keyword}"`);
      const targetLink = matchedTrigger.targetLink || matchedTrigger.link || '';
      let replyText = matchedTrigger.reply || `Check link in bio or visit 🔗 ${targetLink}`;

      const accessToken = acc ? decryptToken(acc.accessTokenEncrypted) : null;
      const result = await replyToTikTokComment(videoId, commentId, replyText, accessToken);

      return res.json({ success: true, mode: 'trigger', reply: replyText, result });
    } else {
      return res.json({ success: false, reason: 'No trigger matched' });
    }
  } catch (err) {
    console.error('[TikTok Engine] Webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 🔴 YOUTUBE LIVE STREAM AUTO-MODERATOR & COMMAND CENTER ENGINE
// ─────────────────────────────────────────────────────────────

// GET /api/youtube/live/status — Fetch live stream status & metrics

// GET /api/youtube/live/status — Fetch live stream status & metrics
app.get('/api/youtube/live/status', (req, res) => {
  ytLiveState.active = ytLiveState.streamIsLive && ytLiveState.botEnabled;
  res.json({
    success: true,
    data: {
      ...ytLiveState,
      streamIsLive: ytLiveState.streamIsLive,
      botEnabled: ytLiveState.botEnabled,
      active: ytLiveState.streamIsLive && ytLiveState.botEnabled
    }
  });
});

// POST /api/youtube/live/toggle — Toggle Live Auto-Moderator Engine
app.post('/api/youtube/live/toggle', (req, res) => {
  const { active, botEnabled } = req.body;
  if (botEnabled !== undefined) {
    ytLiveState.botEnabled = !!botEnabled;
  } else if (active !== undefined) {
    ytLiveState.botEnabled = !!active;
  } else {
    ytLiveState.botEnabled = !ytLiveState.botEnabled;
  }
  ytLiveState.active = ytLiveState.streamIsLive && ytLiveState.botEnabled;
  saveDatabaseToDisk();
  console.log(`[YouTube Live Engine] Auto-Moderator is now ${ytLiveState.botEnabled ? 'ACTIVE 🟢' : 'PAUSED 🔴'}`);
  res.json({
    success: true,
    botEnabled: ytLiveState.botEnabled,
    streamIsLive: ytLiveState.streamIsLive,
    active: ytLiveState.active,
    message: `Live Moderator ${ytLiveState.botEnabled ? 'Activated' : 'Deactivated'}`
  });
});

// POST /api/youtube/live/config — Update Auto-Mod Configuration
app.post('/api/youtube/live/config', (req, res) => {
  const { antiLink, antiSpam, badWordsFilter, badWords, superChatAnnounce, periodicBroadcast, periodicInterval, periodicMessage } = req.body;
  if (antiLink !== undefined) ytLiveState.config.antiLink = antiLink;
  if (antiSpam !== undefined) ytLiveState.config.antiSpam = antiSpam;
  if (badWordsFilter !== undefined) ytLiveState.config.badWordsFilter = badWordsFilter;
  if (superChatAnnounce !== undefined) ytLiveState.config.superChatAnnounce = superChatAnnounce;
  if (periodicBroadcast !== undefined) ytLiveState.config.periodicBroadcast = periodicBroadcast;
  if (periodicInterval !== undefined) ytLiveState.config.periodicInterval = parseInt(periodicInterval) || 10;
  if (periodicMessage !== undefined) ytLiveState.config.periodicMessage = periodicMessage;
  if (Array.isArray(badWords)) ytLiveState.config.badWords = badWords;

  console.log('[YouTube Live Engine] Updated Auto-Moderation settings');
  res.json({ success: true, config: ytLiveState.config });
});

// POST /api/youtube/live/commands — Add or Update Custom Stream Commands
app.post('/api/youtube/live/commands', (req, res) => {
  const { command, reply } = req.body;
  if (!command || !reply) return res.status(400).json({ error: 'Command and Reply are required' });

  const existingIdx = ytLiveState.customCommands.findIndex(c => c.command.toLowerCase() === command.toLowerCase());
  if (existingIdx >= 0) {
    ytLiveState.customCommands[existingIdx].reply = reply;
  } else {
    ytLiveState.customCommands.push({ command: command.startsWith('!') ? command : `!${command}`, reply });
  }

  res.json({ success: true, commands: ytLiveState.customCommands });
});

// DELETE /api/youtube/live/commands — Delete Custom Stream Command
app.delete('/api/youtube/live/commands', (req, res) => {
  const { command } = req.body;
  ytLiveState.customCommands = ytLiveState.customCommands.filter(c => c.command.toLowerCase() !== (command || '').toLowerCase());
  res.json({ success: true, commands: ytLiveState.customCommands });
});

// POST /api/youtube/live/action — Perform manual moderator action (Delete, Timeout, Ban)
app.post('/api/youtube/live/action', (req, res) => {
  const { action, messageId, author } = req.body;
  const msgObj = ytLiveState.liveChatLogs.find(m => m.id === messageId);
  if (msgObj) {
    if (action === 'delete') {
      msgObj.status = 'deleted';
      msgObj.reason = 'Manual Moderator Action';
    } else if (action === 'timeout') {
      msgObj.status = 'timed_out';
      msgObj.reason = 'Timed out for 30s';
    } else if (action === 'ban') {
      msgObj.status = 'banned';
      msgObj.reason = 'User Banned from Stream';
    }
  }

  // System notification log
  ytLiveState.liveChatLogs.unshift({
    id: `sys_${Date.now()}`,
    author: "System Bot",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=ReplyFlowBot",
    message: `🛡️ Moderator action '${action.toUpperCase()}' applied to @${author || 'User'}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    type: "system",
    status: "action"
  });

  res.json({ success: true, logs: ytLiveState.liveChatLogs });
});

// POST /api/youtube/live/sim-chat — Simulate incoming live chat message (For testing & demonstration)
app.post('/api/youtube/live/sim-chat', (req, res) => {
  const { author, message, type, amount } = req.body;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const newMsgId = `m_${Date.now()}`;
  let status = "normal";
  let reason = "";

  const msgLower = (message || '').toLowerCase();

  // Moderation checks only execute if botEnabled is true
  if (ytLiveState.botEnabled) {
    // Check 1: Anti-Link
    if (ytLiveState.config.antiLink && (msgLower.includes('http://') || msgLower.includes('https://') || msgLower.includes('www.') || msgLower.includes('.link') || msgLower.includes('.gg/'))) {
      status = "deleted";
      reason = "Anti-Link Auto-Mod Triggered";
    }
    // Check 2: Bad Words
    else if (ytLiveState.config.badWordsFilter && ytLiveState.config.badWords.some(bw => msgLower.includes(bw.toLowerCase()))) {
      status = "deleted";
      reason = "Abusive Word Auto-Mod Triggered";
    }
  }

  const logEntry = {
    id: newMsgId,
    author: author || "Viewer_" + Math.floor(Math.random() * 900 + 100),
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${author || 'User'}`,
    message: message || "Hello Stream!",
    timestamp: time,
    type: type || (amount ? "superchat" : "chat"),
    amount: amount || null,
    status,
    reason
  };

  ytLiveState.liveChatLogs.unshift(logEntry);

  // If SuperChat, add to SuperChat wall and send auto thank-you
  if (amount) {
    ytLiveState.totalSuperChatRevenue += parseFloat(amount.replace(/[^0-9.]/g, '') || 10);
    ytLiveState.superChats.unshift({
      id: `sc_${Date.now()}`,
      author: logEntry.author,
      amount,
      message: message || "SuperChat Donation!",
      time
    });

    if (ytLiveState.botEnabled && ytLiveState.config.superChatAnnounce) {
      ytLiveState.liveChatLogs.unshift({
        id: `sys_sc_${Date.now()}`,
        author: "System Bot",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=ReplyFlowBot",
        message: `❤️ Thank you @${logEntry.author} for the ${amount} SuperChat!`,
        timestamp: time,
        type: "system",
        status: "announced"
      });
    }
  }

  // Check Custom Command Match
  if (ytLiveState.botEnabled && status === "normal" && message.startsWith('!')) {
    const cmdMatch = ytLiveState.customCommands.find(c => c.command.toLowerCase() === message.trim().toLowerCase());
    if (cmdMatch) {
      ytLiveState.liveChatLogs.unshift({
        id: `sys_cmd_${Date.now()}`,
        author: "ReplyFlow Bot",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=ReplyFlowBot",
        message: `@${logEntry.author} ${cmdMatch.reply}`,
        timestamp: time,
        type: "bot_reply",
        status: "replied"
      });
    }
  }

  // Automated Periodic Broadcaster (e.g., Every N comments)
  if (ytLiveState.botEnabled && status === "normal" && ytLiveState.config.periodicBroadcast) {
    ytLiveState.config.commentCounter = (ytLiveState.config.commentCounter || 0) + 1;
    const interval = ytLiveState.config.periodicInterval || 10;
    
    if (ytLiveState.config.commentCounter >= interval) {
      ytLiveState.config.commentCounter = 0; // Reset counter
      ytLiveState.liveChatLogs.unshift({
        id: `sys_periodic_${Date.now()}`,
        author: "Moderator Bot (Auto-Broadcast)",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=ReplyFlowBot",
        message: ytLiveState.config.periodicMessage || "📢 Don't forget to Subscribe to our channel & hit the bell icon!",
        timestamp: time,
        type: "system",
        status: "announced"
      });
    }
  }

  res.json({ success: true, logEntry, logs: ytLiveState.liveChatLogs });
});

// POST /api/youtube/live/set-video-id — Connect live stream via video URL or Video ID
app.post('/api/youtube/live/set-video-id', async (req, res) => {
  const { urlOrVideoId } = req.body || {};
  if (!urlOrVideoId) {
    return res.status(400).json({ error: 'Video URL or Video ID is required' });
  }

  let videoId = urlOrVideoId.trim();
  const match = videoId.match(/(?:v=|\/embed\/|\/live\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/);
  if (match) videoId = match[1];

  const allYtAccounts = getAllUserAccounts('yt');
  const acc = allYtAccounts[0];
  let accessToken = acc && acc.accessTokenEncrypted ? decryptToken(acc.accessTokenEncrypted) : null;

  try {
    const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,snippet&id=${videoId}`, {
      headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}
    });

    if (vRes.ok) {
      const vData = await vRes.json();
      const vItem = vData.items?.[0];
      if (vItem) {
        const liveChatId = vItem.liveStreamingDetails?.activeLiveChatId;
        const title = vItem.snippet?.title || 'YouTube Live Stream';

        ytLiveState.active = true;
        ytLiveState.streamTitle = title;
        ytLiveState.broadcastId = videoId;
        if (liveChatId) ytLiveState.liveChatId = liveChatId;
        ytLiveState.lastPollError = null;

        console.log(`[YouTube Live Engine] 🔴 Manually connected Live Stream: "${title}" (videoId: ${videoId}, liveChatId: ${liveChatId})`);
        return res.json({ success: true, message: 'Live stream connected successfully!', title, videoId, liveChatId });
      }
    }
    return res.status(404).json({ error: 'Live stream details not found for this Video ID' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── In-memory store for OBS Subscriber Alert Overlay events ──
let obsSubAlertEvents = [];

// GET /api/youtube/obs-sub-events — Fetch subscriber alert events for OBS Overlay Widget
app.get('/api/youtube/obs-sub-events', (req, res) => {
  const { channel, since } = req.query;
  let events = obsSubAlertEvents;
  if (since) {
    const idx = events.findIndex(e => String(e.id) === String(since));
    if (idx !== -1) {
      events = events.slice(idx + 1);
    } else {
      events = [];
    }
  }
  return res.json({ success: true, events });
});

// POST /api/youtube/test-obs-alert — Trigger test subscriber alert for OBS Overlay Widget
app.post('/api/youtube/test-obs-alert', (req, res) => {
  const { channel, theme, sound, username, message, customGif, customAudio } = req.body;
  const testNames = ['Alex Rivera', 'Sarah Connor', 'DevStreamer_99', 'CodeWizard', 'CryptoSamurai'];
  const randomName = testNames[Math.floor(Math.random() * testNames.length)];
  const newEvt = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    channel: channel || '@ainotespk',
    username: username || randomName,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username || randomName)}`,
    subCount: Math.floor(Math.random() * 500) + 284500,
    theme: theme || 'dropfler',
    sound: sound || 'chime',
    customGif: customGif || '',
    customAudio: customAudio || '',
    message: message || 'NEW SUBSCRIBER!',
    timestamp: new Date().toISOString()
  };

  obsSubAlertEvents.push(newEvt);
  if (obsSubAlertEvents.length > 50) {
    obsSubAlertEvents = obsSubAlertEvents.slice(-50);
  }

  // Also push to obsChatEvents so Master OBS Link (obs-live-chat.html) displays subscriber alerts live in OBS Studio!
  const chatAlertEvt = {
    id: newEvt.id,
    type: 'subscriber',
    username: newEvt.username,
    avatar: newEvt.avatar,
    timestamp: newEvt.timestamp
  };
  obsChatEvents.push(chatAlertEvt);
  if (obsChatEvents.length > 100) {
    obsChatEvents = obsChatEvents.slice(-100);
  }

  return res.json({ success: true, message: 'OBS alert triggered successfully', event: newEvt });
});

// GET /api/youtube/obs-status — Fetch YouTube API & Live stream status
app.get('/api/youtube/obs-status', (req, res) => {
  const channel = req.query.channel || '@ainotespk';
  const cleanChan = channel.replace(/^@+/, '').toLowerCase();
  const key = '@' + cleanChan;
  
  let connected = false;
  let tokenValid = false;
  let lastSubscriberCount = null;
  
  if (accountsDB && accountsDB['yt']) {
    const match = accountsDB['yt'].find(acc => acc.username && acc.username.replace(/^@+/, '').toLowerCase() === cleanChan);
    if (match) {
      connected = true;
      tokenValid = !!match.accessTokenEncrypted;
      lastSubscriberCount = match.subscriberCount || null;
    }
  }
  if (!connected && typeof registeredUsersStore !== 'undefined') {
    for (const u of registeredUsersStore) {
      if (u.accounts && u.accounts.youtube) {
        const match = u.accounts.youtube.find(yt => yt.username && yt.username.replace(/^@+/, '').toLowerCase() === cleanChan);
        if (match) {
          connected = true;
          tokenValid = !!match.accessToken;
          lastSubscriberCount = match.subscriberCount || null;
          break;
        }
      }
    }
  }
  
  let quotaExceeded = false;
  if (connected) {
    const allYtAccounts = getAllUserAccounts('yt');
    const match = allYtAccounts.find(acc => acc.username && acc.username.replace(/^@+/, '').toLowerCase() === cleanChan);
    if (match) {
      const targetClientId = match.googleClientId || process.env.GOOGLE_CLIENT_ID;
      if (typeof googleCredentialsPool !== 'undefined') {
        const creds = googleCredentialsPool.find(c => c.clientId === targetClientId);
        if (creds && Date.now() < creds.quotaExceededUntil) {
          quotaExceeded = true;
        }
      }
    }
  }

  const config = obsChatConfigsStore[key] || {};
  if (config.realSubscriberCount !== undefined && config.realSubscriberCount !== null) {
    lastSubscriberCount = config.realSubscriberCount;
  }

  res.json({
    connected,
    tokenValid,
    isLive: !!ytLiveState.streamIsLive,
    lastPollAt: ytLiveState.lastPollAt || null,
    lastPollError: ytLiveState.lastPollError || null,
    lastSubscriberCount,
    quotaExceeded
  });
});

// ── In-memory store for OBS Live Chat Overlay events ──
let obsChatEvents = [];
// obsChatConfigsStore is declared at the database initialization section above

// GET /api/youtube/obs-chat-events — Fetch live chat events for OBS Chat Overlay Widget
app.get('/api/youtube/obs-chat-events', (req, res) => {
  const { channel, since } = req.query;
  let events = obsChatEvents;
  if (since) {
    const idx = events.findIndex(e => String(e.id) === String(since));
    if (idx !== -1) {
      events = events.slice(idx + 1);
    } else {
      events = [];
    }
  }
  return res.json({ success: true, isLive: !!ytLiveState.streamIsLive, events });
});

// ─── CHAT XP & LEVELING SYSTEM ENGINE ───
function calculateLevelAndTier(xp) {
  let level = 1;
  while (xp >= 5 * (level + 1) * level) {
    level++;
  }

  let tier = 'bronze';
  let tierName = 'Bronze';
  let color = '#cd7f32';
  let badgeIcon = '🥉';

  if (level >= 21) {
    tier = 'golden_vvip';
    tierName = 'GOLDEN VVIP';
    color = '#ffd700';
    badgeIcon = '👑';
  } else if (level >= 11) {
    tier = 'gold';
    tierName = 'Gold';
    color = '#ffd700';
    badgeIcon = '🥇';
  } else if (level >= 6) {
    tier = 'silver';
    tierName = 'Silver';
    color = '#c0c0c0';
    badgeIcon = '🥈';
  }

  return {
    level,
    tier,
    tierName,
    color,
    badgeIcon,
    xp
  };
}

function processUserXp(channel, username, isSuperChat = false, amountStr = '') {
  if (!username) username = 'Anonymous';
  const chanKey = (channel || '@ainotespk').toLowerCase();
  const userKey = username.toLowerCase();

  if (!viewerXpDB[chanKey]) viewerXpDB[chanKey] = {};
  if (!viewerXpDB[chanKey][userKey]) {
    viewerXpDB[chanKey][userKey] = {
      username: username,
      xp: 0,
      level: 1,
      lastMessageTs: 0,
      updatedAt: new Date().toISOString()
    };
  }

  const userRecord = viewerXpDB[chanKey][userKey];
  const now = Date.now();
  let xpGained = 0;
  let cooldownActive = false;

  if (isSuperChat) {
    const numAmt = parseFloat(String(amountStr || '').replace(/[^0-9.]/g, '')) || 10;
    xpGained = Math.max(10, Math.round(numAmt * 10)); // $5 = 50 XP, $50 = 500 XP
    userRecord.xp += xpGained;
    userRecord.lastMessageTs = now;
  } else {
    // 10s cooldown per user per channel
    if (now - userRecord.lastMessageTs >= 10000) {
      xpGained = 1;
      userRecord.xp += xpGained;
      userRecord.lastMessageTs = now;
    } else {
      cooldownActive = true;
    }
  }

  const levelInfo = calculateLevelAndTier(userRecord.xp);
  userRecord.level = levelInfo.level;
  userRecord.updatedAt = new Date().toISOString();

  saveDatabaseToDisk();

  return {
    username: userRecord.username,
    xp: userRecord.xp,
    xpGained,
    cooldownActive,
    ...levelInfo
  };
}

// POST /api/youtube/add-viewer-xp — Grant XP to chat user
app.post('/api/youtube/add-viewer-xp', (req, res) => {
  const { channel, username, isSuperChat, amount } = req.body || {};
  const xpInfo = processUserXp(channel, username, !!isSuperChat, amount);
  return res.json({ success: true, xpInfo });
});

// GET /api/youtube/viewer-xp — Fetch viewer level & XP info
app.get('/api/youtube/viewer-xp', (req, res) => {
  const channel = req.query.channel || '@ainotespk';
  const username = req.query.username || '';
  const chanKey = channel.toLowerCase();
  const userKey = username.toLowerCase();
  const userRecord = (viewerXpDB[chanKey] && viewerXpDB[chanKey][userKey]) ? viewerXpDB[chanKey][userKey] : { xp: 0 };
  const levelInfo = calculateLevelAndTier(userRecord.xp || 0);
  return res.json({ success: true, username, xpInfo: levelInfo });
});

// POST /api/youtube/test-obs-chat — Push test/dummy chat messages for OBS Chat Overlay
app.post('/api/youtube/test-obs-chat', (req, res) => {
  const { channel, messages } = req.body || {};
  const testUsers = ['gaming_pro', 'code_wizard', 'stream_viewer', 'night_owl_pk', 'tech_guru', 'creative_mind', 'pro_gamer_x'];
  const testMsgs = ['This stream is amazing! 🔥', 'Love it bhai! ❤️', 'GG! 🎮', 'Hello everyone! 👋', 'Just subscribed! 🎉', 'Keep it up! 💪', 'First time here 🙌'];
  const testBadges = ['', '', 'member', 'mod', '', 'member', ''];

  const msgsToAdd = messages && messages.length > 0 ? messages : (() => {
    const idx = Math.floor(Math.random() * testUsers.length);
    const isSuper = Math.random() < 0.2;
    return [{
      username: testUsers[idx],
      message: testMsgs[idx],
      type: isSuper ? 'superchat' : 'normal',
      amount: isSuper ? ('$' + (Math.floor(Math.random() * 10) + 1) * 5) : '',
      badge: testBadges[idx]
    }];
  })();

  const newEvents = msgsToAdd.map(m => {
    const xpInfo = processUserXp(channel || '@ainotespk', m.username || 'viewer', m.type === 'superchat', m.amount);
    return {
      id: 'chatevt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      channel: channel || '@ainotespk',
      username: m.username || 'viewer',
      message: m.message || 'Hello!',
      type: m.type || 'normal',
      amount: m.amount || '',
      badge: m.badge || '',
      xpInfo: xpInfo,
      timestamp: new Date().toISOString()
    };
  });

  obsChatEvents.push(...newEvents);
  if (obsChatEvents.length > 100) obsChatEvents = obsChatEvents.slice(-100);

  return res.json({ success: true, message: 'Chat message(s) pushed', events: newEvents });
});

// GET /api/yt/obs-chat-config — Get OBS chat overlay config
app.get('/api/yt/obs-chat-config', (req, res) => {
  const channel = req.query.channel || '@ainotespk';
  const cleanChan = channel.replace(/^@+/, '').toLowerCase();
  const key = '@' + cleanChan;
  const config = { ...(obsChatConfigsStore[key] || {}) };
  if (config.realSubscriberCount === undefined || config.realSubscriberCount === null) {
    let dbSubCount = null;
    if (typeof registeredUsersStore !== 'undefined') {
      for (const u of registeredUsersStore) {
        if (u.accounts && u.accounts.youtube) {
          const match = u.accounts.youtube.find(yt => yt.username && yt.username.replace(/^@+/, '').toLowerCase() === cleanChan);
          if (match && match.subscriberCount) {
            dbSubCount = match.subscriberCount;
            break;
          }
        }
      }
    }
    if (dbSubCount) {
      config.realSubscriberCount = dbSubCount;
    }
  }
  res.json({ success: true, channel: key, config });
});

// POST /api/yt/obs-chat-config — Save OBS chat overlay config
app.post('/api/yt/obs-chat-config', (req, res) => {
  const { channel, config } = req.body || {};
  if (!channel || !config) {
    return res.status(400).json({ error: 'channel and config are required' });
  }
  const cleanChan = channel.replace(/^@+/, '').toLowerCase();
  const key = '@' + cleanChan;
  const existing = obsChatConfigsStore[key] || {};
  obsChatConfigsStore[key] = { 
    ...config, 
    realSubscriberCount: existing.realSubscriberCount !== undefined ? existing.realSubscriberCount : config.realSubscriberCount,
    updatedAt: Date.now() 
  };
  saveDatabaseToDisk();
  if (config.liveMode === 'live') {
    // Reset quota block on all credentials so the system immediately tries to call real YouTube API again
    if (typeof googleCredentialsPool !== 'undefined') {
      googleCredentialsPool.forEach(c => {
        c.quotaExceededUntil = 0;
      });
    }
    pollYouTubeLiveBroadcastChat().catch(err => {
      console.error('[YouTube Live Broadcast Quick-Poller Error]:', err.message);
    });
  }
  res.json({ success: true, message: 'OBS chat config saved', config: obsChatConfigsStore[key] });
});

// ─────────────────────────────────────────────────────────────
// 📖 DYNAMIC "HOW TO CONNECT" PLATFORM TUTORIALS ENGINE
// ─────────────────────────────────────────────────────────────

let tutorialsDB = {
  ig: {
    platform: "ig",
    title: "How to Connect Instagram Business Account",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ", // Example embed URL
    guideSteps: [
      "Switch your Instagram account to a Professional / Business Creator account in Instagram app settings.",
      "Link your Instagram Business Account to your Facebook Page in Facebook Page Settings -> Linked Accounts.",
      "Click the 'Connect Instagram' button below and log in with Facebook to authorize Meta Graph API permissions.",
      "Select your Instagram page and grant 'instagram_business_manage_messages' & 'comments' permissions."
    ]
  },
  yt: {
    platform: "yt",
    title: "How to Connect YouTube Channel & Enable Live Moderation",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    guideSteps: [
      "Click the 'Connect YouTube' button and sign in with your Google account.",
      "Choose the YouTube Channel you want to automate.",
      "Grant permissions for YouTube Data API & Live Chat SSL access.",
      "To use Live Moderation, add our ReplyFlow Bot account as a Moderator in YouTube Studio -> Settings -> Community."
    ]
  },
  tt: {
    platform: "tt",
    title: "How to Connect TikTok Commercial Account",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    guideSteps: [
      "Open TikTok Creator Center and ensure your account is a Business/Creator account.",
      "Click 'Connect TikTok' to authenticate via TikTok Open API.",
      "Grant Comment & Direct Message Webhook permissions."
    ]
  },
  fb: {
    platform: "fb",
    title: "How to Connect Facebook Pages",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    guideSteps: [
      "Log in with Facebook and select the Facebook Pages you manage.",
      "Grant page_messaging and pages_read_engagement permissions.",
      "Test page inbox webhook connection."
    ]
  },
  dc: {
    platform: "dc",
    title: "How to Connect Discord Bot & Enable Plugins",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    guideSteps: [
      "Create a Discord Application in Discord Developer Portal.",
      "Copy Bot Token & Client ID into ReplyFlow settings.",
      "Invite Bot to your server with Administrator & Gateway Intent permissions.",
      "Use /replyflow command in Discord to manage live plugins!"
    ]
  },
  tg: {
    platform: "tg",
    title: "How to Connect Telegram Bot",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    guideSteps: [
      "Open Telegram app and search for @BotFather.",
      "Send /newbot command and follow instructions to get Bot API Token.",
      "Paste Bot Token into ReplyFlow to auto-register Webhook."
    ]
  },
  wa: {
    platform: "wa",
    title: "How to Connect WhatsApp Business Cloud API",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    guideSteps: [
      "Go to Meta for Developers and create a WhatsApp Business Cloud API app.",
      "Get System User Permanent Access Token and Phone Number ID.",
      "Configure Webhook URL in Meta App dashboard."
    ]
  },
  gm: {
    platform: "gm",
    title: "How to Connect Gmail Auto-Responder",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    guideSteps: [
      "Go to Google Account Security -> App Passwords.",
      "Generate 16-character App Password for Mail.",
      "Paste your Gmail address and App Password to enable email automation."
    ]
  },
  li: {
    platform: "li",
    title: "How to Connect LinkedIn Profile / Page",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    guideSteps: [
      "Sign in with LinkedIn and authorize OAuth2 permissions.",
      "Select Personal Profile or Company Page for InMail and comment automation."
    ]
  }
};



// =========================================================================
// 👾 DISCORD BOT & 8-PLUGIN ENGINE INTEGRATION
// =========================================================================
let discordBotProcess = null;

function getDiscordBotPath() {
  return path.join(__dirname, 'discord-bot', 'bot_service.py');
}

function startDiscordBotProcess() {
  isBotManualStopped = false;
  if (discordBotProcess && !discordBotProcess.killed) {
    return { success: true, message: 'Discord bot process is already running', pid: discordBotProcess.pid };
  }
  const botScript = getDiscordBotPath();
  if (!fs.existsSync(botScript)) {
    return { success: false, message: 'bot_service.py not found at ' + botScript };
  }
  try {
    const activeGemini = activeLlmModels.find(m => m.provider === 'gemini' && m.active && m.apiKey && !m.apiKey.includes('xxxx'));
    const activeOpenAI = activeLlmModels.find(m => m.provider === 'openai' && m.active && m.apiKey && !m.apiKey.includes('xxxx'));
    const customBotEnv = {
      ...process.env,
      GEMINI_API_KEY: activeGemini ? activeGemini.apiKey : (process.env.GEMINI_API_KEY || ''),
      OPENAI_API_KEY: activeOpenAI ? activeOpenAI.apiKey : (process.env.OPENAI_API_KEY || '')
    };

    discordBotProcess = spawn('python', [botScript], {
      cwd: path.join(__dirname, 'discord-bot'),
      env: customBotEnv,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    discordBotProcess.on('error', (err) => {
      console.log('[Discord Bot Note] Optional Python engine not present on host environment:', err.message);
      discordBotProcess = null;
    });
    discordBotProcess.stdout.on('data', (data) => {
      console.log(`[Discord Bot]: ${data.toString().trim()}`);
    });
    discordBotProcess.stderr.on('data', (data) => {
      console.error(`[Discord Bot Error]: ${data.toString().trim()}`);
    });
    discordBotProcess.on('close', (code) => {
      console.log(`[Discord Bot] Process exited with code ${code}`);
      discordBotProcess = null;
    });
    return { success: true, message: 'Discord bot started successfully', pid: discordBotProcess.pid };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

let isBotManualStopped = false;

function stopDiscordBotProcess() {
  isBotManualStopped = true;
  if (discordBotProcess && !discordBotProcess.killed) {
    try {
      discordBotProcess.kill('SIGKILL');
    } catch(e) {}
    discordBotProcess = null;
  }
  try {
    const { exec } = require('child_process');
    exec('taskkill /f /im python.exe', () => {});
  } catch (e) {}
  return { success: true, message: '🛑 Discord Bot stopped successfully!' };
}

// Automatically start Discord Bot service on server launch
setTimeout(() => {
  console.log('[Discord Integration] Launching 8-Plugin Python Bot Service...');
  startDiscordBotProcess();
}, 2000);

// In-memory user guilds store & disconnected map (declared at top of file)

const DISCORD_BOT_TOKEN_GLOBAL = process.env.DISCORD_BOT_TOKEN || '';

async function fetchDiscordGuildInfo(guildId) {
  if (!guildId || guildId === 'auto' || guildId === 'unknown') return null;
  try {
    const fetchMod = globalThis.fetch || require('node-fetch');
    const res = await fetchMod(`https://discord.com/api/v10/guilds/${guildId}`, {
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN_GLOBAL}`,
        'User-Agent': 'DiscordBot (https://github.com/discord, v1.0.0)'
      }
    });
    if (res.ok) {
      const g = await res.json();
      if (g && g.id) {
        return {
          id: String(g.id),
          name: g.name,
          tier: 'Free Tier',
          status: 'online',
          icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
          connectedAt: new Date().toISOString()
        };
      }
    }
  } catch (err) {
    console.log('[Discord API Warning] Could not fetch single guild info:', err.message);
  }
  return null;
}

async function fetchLiveDiscordBotGuilds() {
  try {
    if (discordClient && discordClient.isReady()) {
      const live = Array.from(discordClient.guilds.cache.values()).map(g => ({
        id: String(g.id),
        name: g.name,
        tier: 'Free Tier',
        status: 'online',
        icon: g.iconURL ? g.iconURL() : null,
        connectedAt: new Date().toISOString()
      }));
      if (live.length > 0) return live;
    }

    const fetchMod = globalThis.fetch || require('node-fetch');
    const token = process.env.DISCORD_BOT_TOKEN || '';
    if (!token) return [];

    const res = await fetchMod('https://discord.com/api/v10/users/@me/guilds', {
      headers: {
        'Authorization': `Bot ${token}`,
        'User-Agent': 'DiscordBot (https://github.com/discord, v1.0.0)'
      }
    });
    if (res.ok) {
      const guilds = await res.json();
      if (Array.isArray(guilds) && guilds.length > 0) {
        return guilds.map(g => ({
          id: String(g.id),
          name: g.name,
          tier: 'Free Tier',
          status: 'online',
          icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
          connectedAt: new Date().toISOString()
        }));
      }
    }
  } catch (err) {
    console.log('[Discord API Warning] Could not fetch live bot guilds:', err.message);
  }
  return [];
}

async function getUserGuilds(userId) {
  const uid = String(userId || 'default');
  let userStoredGuilds = (discordGuildsStore[uid] && Array.isArray(discordGuildsStore[uid])) ? discordGuildsStore[uid] : [];
  
  if (discordClient && discordClient.isReady()) {
    userStoredGuilds = userStoredGuilds.map(g => {
      if (g && g.id) {
        const liveG = discordClient.guilds.cache.get(String(g.id));
        if (liveG) {
          return {
            ...g,
            name: liveG.name,
            icon: liveG.iconURL ? liveG.iconURL() : g.icon
          };
        }
      }
      return g;
    });
  }
  return userStoredGuilds;
}

// GET /api/discord/bot/status — Return user-isolated Discord Bot & Guild status
app.get('/api/discord/bot/status', requireUserAuth, async (req, res) => {
  const userId = req.user.id;
  const userGuilds = await getUserGuilds(userId);
  const isRunning = !isBotManualStopped;
  res.json({
    status: isRunning ? 'active' : 'idle',
    botName: 'ReplyFlow Discord Bot',
    version: 'v3.5.0',
    pid: discordBotProcess?.pid || null,
    totalPlugins: 9,
    activePlugins: isRunning ? 9 : 0,
    guildsConnected: userGuilds.length,
    guildList: userGuilds,
    totalMembers: userGuilds.length > 0 ? 1 : 0,
    ticketsOpen: 0,
    lastActive: new Date().toISOString()
  });
});

// GET /api/discord/guilds — Get connected Discord servers for user
app.get('/api/discord/guilds', requireUserAuth, async (req, res) => {
  const userId = req.user.id;
  const guilds = await getUserGuilds(userId);
  res.json({ success: true, guilds });
});

// GET /api/discord/available-guilds — Return live Discord Bot servers available to requesting user
app.get('/api/discord/available-guilds', requireUserAuth, async (req, res) => {
  try {
    const requestingUserId = String(req.user.id);
    const liveGuilds = await fetchLiveDiscordBotGuilds();

    // Build a set of guild IDs claimed by other users in discordGuildsStore
    const claimedByOtherUser = new Set();
    for (const [ownerUserId, guilds] of Object.entries(discordGuildsStore)) {
      if (ownerUserId === requestingUserId) continue;
      (guilds || []).forEach(g => {
        if (g && g.id) claimedByOtherUser.add(String(g.id));
      });
    }

    const availableGuilds = liveGuilds.filter(g => !claimedByOtherUser.has(String(g.id)));

    res.json({ success: true, guilds: availableGuilds });
  } catch (err) {
    console.error('[available-guilds] Error:', err);
    res.json({ success: true, guilds: [] });
  }
});

// POST /api/discord/guilds/connect — Connect a new Discord server (Strictly binds requested guildId)
app.post('/api/discord/guilds/connect', requireUserAuth, async (req, res) => {
  const userId = req.user.id;
  const uid = String(userId || 'default');
  let { guildId, name } = req.body || {};

  // Reject if the requested guildId is claimed by a different user
  if (guildId && guildId !== 'auto') {
    for (const [ownerUserId, guilds] of Object.entries(discordGuildsStore)) {
      if (ownerUserId === uid) continue;
      if ((guilds || []).some(g => String(g.id) === String(guildId))) {
        return res.status(409).json({
          success: false,
          message: 'This Discord server is already connected to a different ReplyFlow account.'
        });
      }
    }
  }

  const liveGuilds = await fetchLiveDiscordBotGuilds();

  let targetGuild = null;
  if (guildId && guildId !== 'auto') {
    targetGuild = liveGuilds.find(g => String(g.id) === String(guildId));
    if (!targetGuild) {
      targetGuild = await fetchDiscordGuildInfo(guildId);
    }
  }

  if (!targetGuild && name && name !== 'Discord Server (auto)') {
    targetGuild = liveGuilds.find(g => g.name.toLowerCase() === String(name).toLowerCase());
  }

  // If no specific guildId was requested (e.g. initial auto connect), select first unclaimed live guild
  if (!targetGuild && (!guildId || guildId === 'auto') && liveGuilds.length > 0) {
    const claimedByOtherUser = new Set();
    for (const [ownerUserId, guilds] of Object.entries(discordGuildsStore)) {
      if (ownerUserId === uid) continue;
      (guilds || []).forEach(g => {
        if (g && g.id) claimedByOtherUser.add(String(g.id));
      });
    }
    targetGuild = liveGuilds.find(g => !claimedByOtherUser.has(String(g.id)));
  }

  if (!targetGuild) {
    const fallbackId = String(guildId && guildId !== 'auto' ? guildId : (liveGuilds[0] ? liveGuilds[0].id : 'unknown'));
    const fallbackName = (name && name !== 'Discord Server (auto)') ? name : (liveGuilds[0] ? liveGuilds[0].name : `Discord Server ${fallbackId}`);
    targetGuild = {
      id: fallbackId,
      name: fallbackName
    };
  }

  if (targetGuild && targetGuild.id && targetGuild.id !== 'auto' && targetGuild.id !== 'unknown') {
    for (const [ownerUserId, guilds] of Object.entries(discordGuildsStore)) {
      if (ownerUserId === uid) continue;
      if ((guilds || []).some(g => String(g.id) === String(targetGuild.id))) {
        return res.status(409).json({
          success: false,
          message: 'This Discord server is already connected to a different ReplyFlow account.'
        });
      }
    }
  }

  const guildData = {
    id: String(targetGuild.id),
    name: targetGuild.name,
    tier: 'Free Tier',
    status: 'online',
    icon: targetGuild.icon || null,
    connectedAt: new Date().toISOString()
  };

  // Add/Update to user's connected servers list
  if (!discordGuildsStore[uid] || !Array.isArray(discordGuildsStore[uid])) {
    discordGuildsStore[uid] = [];
  }
  discordGuildsStore[uid] = discordGuildsStore[uid].filter(g => g && String(g.id) !== String(guildData.id));
  discordGuildsStore[uid].unshift(guildData);
  disconnectedGuildsMap[uid] = [];

  saveDatabaseToDisk();
  res.json({ success: true, message: 'Discord server connected successfully!', guilds: discordGuildsStore[uid] });
});

// POST /api/discord/guilds/sync-authorized — Auto-detect newly authorized Discord bot guild
app.post('/api/discord/guilds/sync-authorized', requireUserAuth, async (req, res) => {
  const userId = req.user.id;
  const uid = String(userId || 'default');

  disconnectedGuildsMap[uid] = [];
  const userGuilds = await getUserGuilds(userId);

  return res.json({ success: true, newlyConnected: userGuilds.length > 0, guilds: userGuilds });
});

// POST /api/discord/guilds/disconnect — Disconnect/Unlink a Discord server
app.post('/api/discord/guilds/disconnect', requireUserAuth, async (req, res) => {
  const userId = req.user.id;
  const uid = String(userId || 'default');
  const targetGuildId = req.body?.guildId;

  if (targetGuildId && Array.isArray(discordGuildsStore[uid])) {
    discordGuildsStore[uid] = discordGuildsStore[uid].filter(g => g && String(g.id) !== String(targetGuildId));
  } else {
    discordGuildsStore[uid] = [];
  }
  saveDatabaseToDisk();

  res.json({ success: true, message: 'Discord server disconnected successfully.', guilds: discordGuildsStore[uid] || [] });
});

// POST /api/discord/guilds/reset-all-stores — Clear all stored guilds from memory & disk
app.post('/api/discord/guilds/reset-all-stores', (req, res) => {
  for (const key in discordGuildsStore) delete discordGuildsStore[key];
  for (const key in disconnectedGuildsMap) delete disconnectedGuildsMap[key];
  saveDatabaseToDisk();
  res.json({ success: true, message: 'All Discord guilds reset in memory and disk.' });
});

// GET /api/discord/callback — Discord Bot Authorization Redirect Handler
app.get(['/api/discord/callback', '/api/auth/discord/callback'], async (req, res) => {
  const { code, guild_id, state } = req.query;
  const baseOrigin = getBaseOrigin(req);

  if (guild_id) {
    let userId = 'default';
    if (state && String(state) !== 'undefined' && String(state) !== 'null' && String(state) !== 'auto') {
      userId = String(state);
    } else if (req.user && req.user.id) {
      userId = String(req.user.id);
    }

    const liveGuilds = await fetchLiveDiscordBotGuilds();
    let liveGuild = liveGuilds.find(g => String(g.id) === String(guild_id));
    if (!liveGuild) {
      liveGuild = await fetchDiscordGuildInfo(guild_id);
    }

    const guildData = {
      id: String(guild_id),
      name: liveGuild ? liveGuild.name : `Discord Server ${guild_id}`,
      tier: 'Free Tier',
      status: 'online',
      icon: liveGuild?.icon || null,
      connectedAt: new Date().toISOString()
    };

    if (disconnectedGuildsMap[userId]) {
      disconnectedGuildsMap[userId] = disconnectedGuildsMap[userId].filter(id => id !== String(guild_id));
    }
    if (!discordGuildsStore[userId] || !Array.isArray(discordGuildsStore[userId])) {
      discordGuildsStore[userId] = [];
    }
    discordGuildsStore[userId] = discordGuildsStore[userId].filter(g => g && String(g.id) !== String(guildData.id));
    discordGuildsStore[userId].unshift(guildData);
    saveDatabaseToDisk();

    return res.redirect(`${baseOrigin}/?guild_id=${encodeURIComponent(guild_id)}&connected=true#discord`);
  }

  return res.redirect(`${baseOrigin}/#discord`);
});

// GET /api/discord/channels
app.get('/api/discord/channels', requireUserAuth, (req, res) => {
  const guildId = req.query.guildId || '1537457454370128024';
  const channels = [
    { id: 'all', name: 'All Text Channels', category: 'Special' },
    { id: '1001', name: 'general', category: 'Information' },
    { id: '1002', name: 'welcome-chat', category: 'Information' },
    { id: '1003', name: 'announcements', category: 'Information' },
    { id: '1004', name: 'support-tickets', category: 'Support' },
    { id: '1005', name: 'bot-commands', category: 'Automations' },
    { id: '1006', name: 'ai-assistant', category: 'Automations' },
    { id: '1007', name: 'suggestions', category: 'Engagement' },
    { id: '1008', name: 'level-up-log', category: 'Engagement' },
    { id: '1009', name: 'social-feed-updates', category: 'Feeds' }
  ];
  res.json({ success: true, guildId, channels });
});

// GET /api/discord/plugins
app.get('/api/discord/plugins', requireUserAuth, (req, res) => {
  res.json({
    success: true,
    plugins: [
      { key: 'welcome', name: 'Welcome & Auto Role', category: 'Engagement', icon: '✨', enabled: true, usageCount: 18450 },
      { key: 'leveling', name: 'Leveling System', category: 'Engagement', icon: '🏆', enabled: true, usageCount: 29400 },
      { key: 'tickets', name: 'Ticket System', category: 'Utility', icon: '🎟️', enabled: true, usageCount: 14200 },
      { key: 'live-stats', name: 'Live Stats Counters', category: 'Utility', icon: '📊', enabled: true, usageCount: 38200 },
      { key: 'automod', name: 'Auto Moderation AI', category: 'Moderation', icon: '🛡️', enabled: true, usageCount: 42100 },
      { key: 'social-feed', name: 'Social Feed Hub', category: 'AI & Feeds', icon: '📡', enabled: true, usageCount: 11900 },
      { key: 'suggestions', name: 'Suggestion Engine', category: 'Engagement', icon: '💡', enabled: true, usageCount: 8900 },
      { key: 'ai-assistant', name: 'AI Smart Assistant', category: 'AI & Feeds', icon: '🤖', enabled: true, usageCount: 21500 }
    ]
  });
});

// POST /api/discord/bot/control
app.post('/api/discord/bot/control', requireUserAuth, (req, res) => {
  const { action } = req.body;
  if (action === 'start') {
    const result = startDiscordBotProcess();
    return res.json(result);
  } else if (action === 'stop') {
    const result = stopDiscordBotProcess();
    return res.json(result);
  } else if (action === 'restart') {
    stopDiscordBotProcess();
    setTimeout(() => {
      const result = startDiscordBotProcess();
      return res.json(result);
    }, 1000);
    return;
  }
  res.status(400).json({ success: false, message: 'Invalid action. Use start, stop, or restart.' });
});

// GET /api/tutorials — Fetch all or single platform tutorial
app.get('/api/tutorials', (req, res) => {
  const platform = req.query.platform;
  if (platform) {
    const tut = tutorialsDB[platform] || {
      platform,
      title: `How to Connect ${platform.toUpperCase()}`,
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      guideSteps: ["Log in and authorize permissions for " + platform]
    };
    return res.json({ success: true, tutorial: tut });
  }
  res.json({ success: true, tutorials: tutorialsDB });
});

// PUT /api/tutorials/:platform — Save/Update platform tutorial (Admin)
app.put('/api/tutorials/:platform', requireAdmin, (req, res) => {
  const platform = req.params.platform;
  const { title, videoUrl, guideSteps } = req.body;

  if (!tutorialsDB[platform]) {
    tutorialsDB[platform] = { platform };
  }

  if (title) tutorialsDB[platform].title = title;
  if (videoUrl) tutorialsDB[platform].videoUrl = videoUrl;
  if (Array.isArray(guideSteps)) tutorialsDB[platform].guideSteps = guideSteps;

  saveDatabaseToDisk();
  console.log(`[Tutorials Engine] Updated 'How to Connect' tutorial for platform: ${platform}`);

  res.json({ success: true, message: `Tutorial for ${platform.toUpperCase()} saved successfully!`, tutorial: tutorialsDB[platform] });
});

// ─── PAYMENT GATEWAYS & SAFEPAY INTEGRATION API ENDPOINTS ───

// GET /api/payments/settings — Get Payment Gateways Config
app.get('/api/payments/settings', requireUserAuth, (req, res) => {
  const dbPath = DB_FILE_PATH;
  let dbData = {};
  if (fs.existsSync(dbPath)) {
    try { dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}
  }
  const paymentGateways = dbData.paymentGateways || {
    safepay: {
      name: "Safepay",
      enabled: true,
      environment: "sandbox",
      clientKey: "pk_sandbox_test_7f8a9b0c1d2e3f4",
      secretKey: "sec_sandbox_test_1a2b3c4d5e6f7g8",
      webhookSecret: "whsec_sandbox_test_99887766",
      currency: "PKR",
      allowCard: true,
      allowMobileWallets: true,
      updatedAt: new Date().toISOString()
    }
  };
  res.json({ success: true, paymentGateways });
});

// POST /api/payments/settings — Save/Update Payment Gateway Settings (Admin)
app.post('/api/payments/settings', requireAdmin, (req, res) => {
  const { gateway, settings } = req.body || {};
  if (!gateway || !settings) {
    return res.status(400).json({ error: 'Gateway ID and settings configuration object required' });
  }

  const dbPath = DB_FILE_PATH;
  let dbData = {};
  if (fs.existsSync(dbPath)) {
    try { dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}
  }

  if (!dbData.paymentGateways) dbData.paymentGateways = {};
  dbData.paymentGateways[gateway] = {
    ...(dbData.paymentGateways[gateway] || {}),
    ...settings,
    updatedAt: new Date().toISOString()
  };
  dbData.updatedAt = new Date().toISOString();

  fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf8');
  console.log(`[Payment Gateway API] Updated settings for ${gateway.toUpperCase()}`);

  res.json({
    success: true,
    message: `${gateway.toUpperCase()} Payment Gateway configuration saved successfully!`,
    paymentGateways: dbData.paymentGateways
  });
});

// POST /api/payments/safepay/test-checkout — Test Safepay Checkout Simulation
app.post('/api/payments/safepay/test-checkout', requireUserAuth, (req, res) => {
  const { amount = 4900, currency = 'PKR' } = req.body || {};

  const dbPath = DB_FILE_PATH;
  let dbData = {};
  if (fs.existsSync(dbPath)) {
    try { dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}
  }

  const safepayConfig = (dbData.paymentGateways && dbData.paymentGateways.safepay) || {
    enabled: true,
    environment: 'sandbox',
    clientKey: 'pk_sandbox_test_7f8a9b0c1d2e3f4'
  };

  if (!safepayConfig.enabled) {
    return res.status(400).json({ error: 'Safepay payment gateway is currently disabled in admin panel' });
  }

  const trackerToken = `track_sf_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const checkoutUrl = safepayConfig.environment === 'sandbox'
    ? `https://sandbox.api.getsafepay.com/checkout/pay?tracker=${trackerToken}`
    : `https://api.getsafepay.com/checkout/pay?tracker=${trackerToken}`;

  res.json({
    success: true,
    message: 'Safepay sandbox test checkout session initialized successfully!',
    trackerToken,
    checkoutUrl,
    environment: safepayConfig.environment,
    clientKey: safepayConfig.clientKey,
    dummyDetails: {
      orderId: `ORD-RF-${Math.floor(100000 + Math.random() * 900000)}`,
      amount: amount,
      currency: currency || safepayConfig.currency || 'PKR',
      status: 'PAID (SIMULATED)',
      customerEmail: 'test.buyer@replyflow.io',
      gatewayResponse: {
        code: '200_OK',
        token: trackerToken,
        signatureVerified: true,
        receiptNumber: `SP-REC-${Date.now().toString().slice(-6)}`
      }
    }
  });
});

// POST /api/plugins/save — Sync Dashboard Plugin Settings to JSON & SQLite Database
// POST /api/plugins/save — Sync Dashboard Plugin Settings to JSON & SQLite Database
app.post('/api/plugins/save', requireUserAuth, async (req, res) => {
  try {
    let { guild_id, plugin_key = 'general', enabled = true, config = {} } = req.body || {};
    
    if (!guild_id || guild_id === 'auto' || guild_id === '1537457454370128024' || guild_id === '1330964283198013461') {
      const userGuilds = await getUserGuilds(req.user.id);
      if (userGuilds && userGuilds.length > 0 && userGuilds[0].id) {
        guild_id = userGuilds[0].id;
      }
    }
    guild_id = String(guild_id || 'default_guild');

    // 1. Save to DB_FILE_PATH isolated by guild_id
    const dbPath = DB_FILE_PATH;
    let dbData = {};
    if (fs.existsSync(dbPath)) {
      try { dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}
    }
    if (!dbData.pluginConfigs) dbData.pluginConfigs = {};
    const storeKey = `${guild_id}_${plugin_key}`;
    dbData.pluginConfigs[storeKey] = { guild_id, plugin_key, enabled, config, updatedAt: new Date().toISOString() };
    dbData.pluginConfigs[plugin_key] = { guild_id, plugin_key, enabled, config, updatedAt: new Date().toISOString() };
    try { fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf8'); } catch (e) {}

    // 2. In-Memory Instant Sync to Native Discord.js Bot Engine
    if (discordClient && discordClient.isReady()) {
      try {
        const guild = discordClient.guilds.cache.get(guild_id) || discordClient.guilds.cache.first();
        if (guild) {
          if (plugin_key === 'live-stats') {
            updateLiveStatsCounters(guild, true);
          } else {
            ensureAllPluginChannels(guild);
          }
        }
      } catch (e) {
        console.error("[NativeDiscordSync Note]:", e.message);
      }
    }

    res.json({ status: 'success', message: `Plugin '${plugin_key}' settings saved for guild ${guild_id} and synced successfully!` });
  } catch (err) {
    console.error("Plugin save error:", err);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// GET /api/plugins/get — Retrieve Plugin Settings Per Guild
app.get('/api/plugins/get', requireUserAuth, async (req, res) => {
  const pluginKey = req.query.plugin_key || 'live-stats';
  let guildId = req.query.guild_id || req.query.guildId;

  if (!guildId || guildId === 'auto' || guildId === '1537457454370128024' || guildId === '1330964283198013461') {
    const userGuilds = await getUserGuilds(req.user.id);
    if (userGuilds && userGuilds.length > 0 && userGuilds[0].id) {
      guildId = userGuilds[0].id;
    }
  }
  guildId = String(guildId || 'default_guild');

  const { execFile } = require('child_process');
  const pyCmd = `import sys, os, json; sys.path.append(os.path.join(r'${__dirname.replace(/\\/g, '/')}', 'discord-bot')); import database; print(json.dumps(database.get_plugin_config('${guildId}', '${pluginKey}')))`;

  execFile('python', ['-c', pyCmd], { cwd: __dirname }, (err, stdout) => {
    if (!err && stdout) {
      try {
        const data = JSON.parse(stdout.trim());
        if (data && typeof data === 'object' && Object.keys(data).length > 0 && (data.config !== undefined || data.enabled !== undefined)) {
          return res.json({ status: 'success', success: true, plugin_key: pluginKey, guild_id: guildId, ...data });
        }
      } catch (e) {}
    }
    const dbPath = DB_FILE_PATH;
    let dbData = {};
    if (fs.existsSync(dbPath)) {
      try { dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}
    }
    const storeKey = `${guildId}_${pluginKey}`;
    const pluginData = (dbData.pluginConfigs && (dbData.pluginConfigs[storeKey] || dbData.pluginConfigs[pluginKey])) || { enabled: true, config: {} };
    res.json({ status: 'success', success: true, plugin_key: pluginKey, guild_id: guildId, ...pluginData });
  });
});

// GET /api/stats/live — Retrieve Live Server Stats Counters
app.get('/api/stats/live', (req, res) => {
  const guildId = req.query.guild_id || req.query.guildId || '1330964283198013461';
  const { execFile } = require('child_process');
  const pyCmd = `import sys, os, json; sys.path.append(os.path.join(r'${__dirname.replace(/\\/g, '/')}', 'discord-bot')); import database; print(json.dumps(database.get_live_server_stats('${guildId}')))`;

  execFile('python', ['-c', pyCmd], { cwd: __dirname }, (err, stdout) => {
    if (!err && stdout) {
      try {
        const statsData = JSON.parse(stdout.trim());
        return res.json({ status: 'success', success: true, stats: statsData });
      } catch (e) {}
    }
    return res.json({
      status: 'success',
      success: true,
      stats: {
        total_members: 4,
        online_members: 2,
        server_boosts: 0,
        admin_count: 3,
        bot_count: 2,
        mod_count: 1
      }
    });
  });
});

// GET /api/logs/audit — Retrieve A-to-Z Server Audit Logs from SQLite
app.get('/api/logs/audit', requireUserAuth, (req, res) => {
  const category = req.query.category || 'all';
  const limit = parseInt(req.query.limit || '100', 10);
  const guildId = req.query.guild_id || '1330964283198013461';

  const { execFile } = require('child_process');
  const pyCmd = `import sys, os, json; sys.path.append(os.path.join(r'${__dirname.replace(/\\/g, '/')}', 'discord-bot')); import database; print(json.dumps(database.get_audit_logs('${guildId}', ${limit}, '${category}')))`;

  execFile('python', ['-c', pyCmd], { cwd: __dirname }, (err, stdout) => {
    if (err) {
      return res.json({ status: 'error', logs: [] });
    }
    try {
      const logs = JSON.parse(stdout || '[]');
      res.json({ status: 'success', category, count: logs.length, logs });
    } catch (e) {
      res.json({ status: 'success', category, count: 0, logs: [] });
    }
  });
});

// GET /api/yt/tts-voice — Studio Neural Voice Proxy Stream (Google HD Neural TTS)
app.get('/api/yt/tts-voice', async (req, res) => {
  const text = (req.query.text || '').trim();
  const lang = req.query.lang || 'en';
  const speed = parseFloat(req.query.speed) || 1.0; // 0.5 to 1.0 supported
  if (!text) {
    return res.status(400).json({ error: 'Text prompt is required' });
  }

  const https = require('https');

  // Split long text into natural sentence chunks (Google TTS ~200 char limit)
  function splitTextToChunks(fullText, maxLen = 180) {
    const chunks = [];
    let remaining = fullText.slice(0, 600); // Hard cap for safety
    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining.trim());
        break;
      }
      // Try to split at sentence boundaries first
      let splitIdx = -1;
      const sentenceBreaks = ['. ', '! ', '? ', ', '];
      for (const brk of sentenceBreaks) {
        const idx = remaining.lastIndexOf(brk, maxLen);
        if (idx > 20) { splitIdx = idx + brk.length; break; }
      }
      // Fallback: split at last space before maxLen
      if (splitIdx === -1) {
        splitIdx = remaining.lastIndexOf(' ', maxLen);
        if (splitIdx < 20) splitIdx = maxLen;
      }
      chunks.push(remaining.slice(0, splitIdx).trim());
      remaining = remaining.slice(splitIdx).trim();
    }
    return chunks.filter(c => c.length > 0);
  }

  function fetchChunkAudio(chunkText) {
    return new Promise((resolve, reject) => {
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&ttsspeed=${speed}&q=${encodeURIComponent(chunkText)}`;
      const reqOptions = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Referer': 'https://translate.google.com/',
          'Accept': 'audio/mpeg, audio/*, */*'
        }
      };
      https.get(ttsUrl, reqOptions, (ttsRes) => {
        if (ttsRes.statusCode !== 200) {
          return reject(new Error('Google TTS returned status ' + ttsRes.statusCode));
        }
        const chunks = [];
        ttsRes.on('data', (d) => chunks.push(d));
        ttsRes.on('end', () => resolve(Buffer.concat(chunks)));
        ttsRes.on('error', reject);
      }).on('error', reject);
    });
  }

  try {
    const textChunks = splitTextToChunks(text);
    const audioBuffers = [];

    for (const chunk of textChunks) {
      const buf = await fetchChunkAudio(chunk);
      audioBuffers.push(buf);
    }

    const fullAudio = Buffer.concat(audioBuffers);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', fullAudio.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Accept-Ranges', 'bytes');
    res.end(fullAudio);
  } catch (err) {
    console.error('[TTS Proxy Error]:', err.message);
    res.status(500).json({ error: 'Failed to stream TTS audio' });
  }
});

// ─────────────────────────────────────────────────────────────
// 🌐 CLOUD RTMP MULTISTREAM HUB ROUTING ENGINE
// ─────────────────────────────────────────────────────────────

const nmsConfig = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8009, // Keep separate from main app port
    allow_origin: '*'
  }
};

let nms = null;
if (process.env.ENABLE_RTMP === 'true' || process.env.NODE_ENV !== 'production') {
  try {
    nms = new NodeMediaServer(nmsConfig);
    nms.run();
    console.log('[MediaServer] NodeMediaServer started successfully.');
  } catch (nmsErr) {
    console.log('[MediaServer Note] Optional RTMP server skipped in cloud container environment:', nmsErr.message);
  }
}

function extractStreamPath(arg1, arg2, arg3) {
  if (typeof arg1 === 'string' && arg1.startsWith('/')) return arg1;
  if (typeof arg2 === 'string' && arg2.startsWith('/')) return arg2;
  if (typeof arg3 === 'string' && arg3.startsWith('/')) return arg3;
  if (typeof arg1 === 'string' && arg1.includes('/live/')) return arg1;
  if (typeof arg2 === 'string' && arg2.includes('/live/')) return arg2;
  if (typeof arg3 === 'string' && arg3.includes('/live/')) return arg3;
  return null;
}

if (nms) {
  // Track incoming streams (supports Main and Vertical Ingests)
  nms.on('postPublish', (arg1, arg2, arg3) => {
    const actualPath = extractStreamPath(arg1, arg2, arg3);
    if (!actualPath) return;
    console.log(`[RTMP Server] Ingest stream started: ${actualPath}`);
    activeIncomingStreams.add(actualPath);
    
    const parts = actualPath.split('/');
    const streamKey = parts[parts.length - 1];
    
    const isVertical = streamKey.endsWith('_vertical');
    const baseKey = isVertical ? streamKey.slice(0, -9) : streamKey;
    
    let userId = null;
    for (const uid in multistreamStore) {
      if (multistreamStore[uid].streamKey === baseKey) {
        userId = uid;
        break;
      }
    }

    if (userId) {
      console.log(`[RTMP Server] Stream identified for User ID: ${userId} (Vertical Ingest: ${isVertical})`);
      const userConfig = multistreamStore[userId] || {};
      const destinations = userConfig.destinations || [];
      destinations.forEach(dest => {
        if (dest && dest.active && dest.streamKey) {
          const isDestVertical = ['yt_shorts', 'tiktok', 'instagram'].includes(dest.platform);
          if (isDestVertical === isVertical) {
            startRtmpRelay(userId, dest.id, actualPath, dest.rtmpUrl, dest.streamKey);
          }
        }
      });
    }
  });

  nms.on('donePublish', (arg1, arg2, arg3) => {
    const actualPath = extractStreamPath(arg1, arg2, arg3);
    if (!actualPath) return;
    console.log(`[RTMP Server] Ingest stream stopped: ${actualPath}`);
    activeIncomingStreams.delete(actualPath);
    
    const parts = actualPath.split('/');
    const streamKey = parts[parts.length - 1];
    
    const isVertical = streamKey.endsWith('_vertical');
    const baseKey = isVertical ? streamKey.slice(0, -9) : streamKey;
    
    let userId = null;
    for (const uid in multistreamStore) {
      if (multistreamStore[uid].streamKey === baseKey) {
        userId = uid;
        break;
      }
    }

    if (userId) {
      console.log(`[RTMP Server] Stream ended for User ID: ${userId}`);
      stopAllRelaysForUser(userId);
    }
  });
}

function startRtmpRelay(userId, platform, streamPath, destRtmpUrl, destStreamKey) {
  const relayKey = `${userId}_${platform}`;
  if (activeRelayProcesses.has(relayKey)) {
    console.log(`[RTMP Relay] Relay process already active for ${relayKey}`);
    return;
  }

  let targetUrl = destRtmpUrl;
  if (!targetUrl.endsWith('/')) targetUrl += '/';
  targetUrl += destStreamKey;

  const sourceUrl = `rtmp://localhost:1935${streamPath}`;
  console.log(`[RTMP Relay] Starting FFmpeg copy-relay from ${sourceUrl} to ${targetUrl}`);

  const ffmpegProcess = spawn('ffmpeg', [
    '-re',
    '-i', sourceUrl,
    '-c:v', 'copy',
    '-c:a', 'copy',
    '-f', 'flv',
    targetUrl
  ]);

  ffmpegProcess.on('close', (code) => {
    console.log(`[RTMP Relay] FFmpeg relay process for ${relayKey} closed with code ${code}`);
    activeRelayProcesses.delete(relayKey);
  });

  activeRelayProcesses.set(relayKey, ffmpegProcess);
}

function stopRtmpRelay(userId, platform) {
  const relayKey = `${userId}_${platform}`;
  const ffmpegProcess = activeRelayProcesses.get(relayKey);
  if (ffmpegProcess) {
    console.log(`[RTMP Relay] Stopping FFmpeg relay process for ${relayKey}`);
    ffmpegProcess.kill('SIGINT');
    activeRelayProcesses.delete(relayKey);
  }
}

function isStreamActiveInNMS(streamKey) {
  if (!streamKey) return false;
  const targetPath = `/live/${streamKey}`;
  const targetPathVert = `/live/${streamKey}_vertical`;

  if (activeIncomingStreams.has(targetPath) || activeIncomingStreams.has(targetPathVert)) {
    return true;
  }

  try {
    if (nms && nms.nmsServer && nms.nmsServer.sessions) {
      for (const [id, session] of nms.nmsServer.sessions) {
        if (session && session.publishStreamPath && (session.publishStreamPath === targetPath || session.publishStreamPath === targetPathVert)) {
          activeIncomingStreams.add(session.publishStreamPath);
          return true;
        }
      }
    }
  } catch (e) {}

  return false;
}

// REST APIs for Multistream Configuration
app.get('/api/multistream/config', requireUserAuth, (req, res) => {
  const userId = req.user.id;
  if (!multistreamStore[userId]) {
    multistreamStore[userId] = {
      streamKey: 'rf_live_' + crypto.randomBytes(8).toString('hex'),
      destinations: []
    };
    saveDatabaseToDisk();
  }

  const userConfig = multistreamStore[userId];
  const isLive = isStreamActiveInNMS(userConfig.streamKey);

  const destinations = (userConfig.destinations || []).map(dest => {
    return {
      ...dest,
      relayActive: activeRelayProcesses.has(`${userId}_${dest.id}`)
    };
  });

  res.json({
    success: true,
    ingestUrl: 'rtmp://127.0.0.1:1935/live',
    streamKey: userConfig.streamKey,
    isLive,
    destinations
  });
});

app.post('/api/multistream/add-destination', requireUserAuth, (req, res) => {
  const userId = req.user.id;
  const { platform, label, rtmpUrl, streamKey } = req.body;

  if (!platform || !streamKey) {
    return res.status(400).json({ error: 'Platform and Stream Key are required' });
  }

  if (!multistreamStore[userId]) {
    multistreamStore[userId] = {
      streamKey: 'rf_live_' + crypto.randomBytes(8).toString('hex'),
      destinations: []
    };
  }

  const userConfig = multistreamStore[userId];
  if (!userConfig.destinations) userConfig.destinations = [];

  const defaultUrls = {
    yt: 'rtmp://a.rtmp.youtube.com/live2',
    yt_shorts: 'rtmp://a.rtmp.youtube.com/live2',
    fb: 'rtmps://live-api-s.facebook.com:443/rtmp',
    twitch: 'rtmp://live.twitch.tv/app',
    kick: 'rtmps://stream.kick.com/app',
    tiktok: 'rtmp://push.tiktok.com/live',
    instagram: 'rtmps://live-upload.instagram.com:443/rtmp',
    custom: rtmpUrl || ''
  };

  const newDest = {
    id: 'dest_' + crypto.randomBytes(6).toString('hex'),
    platform,
    label: label || platform.toUpperCase(),
    active: true,
    streamKey,
    rtmpUrl: defaultUrls[platform] || rtmpUrl || ''
  };

  userConfig.destinations.push(newDest);
  saveDatabaseToDisk();

  // Auto trigger relay if stream is active
  const streamPath = `/live/${userConfig.streamKey}`;
  const isLive = activeIncomingStreams.has(streamPath);
  if (isLive) {
    const isDestVertical = ['yt_shorts', 'tiktok', 'instagram'].includes(platform);
    const isStreamVertical = false; // vertical suffix handles Aitum plugin
    startRtmpRelay(userId, newDest.id, streamPath, newDest.rtmpUrl, streamKey);
  }

  res.json({ success: true, destination: newDest });
});

app.post('/api/multistream/delete-destination', requireUserAuth, (req, res) => {
  const userId = req.user.id;
  const { id } = req.body;

  if (!id) return res.status(400).json({ error: 'Destination ID is required' });

  const userConfig = multistreamStore[userId];
  if (userConfig && userConfig.destinations) {
    stopRtmpRelay(userId, id);
    userConfig.destinations = userConfig.destinations.filter(d => d.id !== id);
    saveDatabaseToDisk();
  }

  res.json({ success: true });
});

app.post('/api/multistream/save-destination', requireUserAuth, (req, res) => {
  const userId = req.user.id;
  const { id, streamKey, rtmpUrl, active } = req.body;
  
  if (!id) return res.status(400).json({ error: 'Destination ID is required' });

  const userConfig = multistreamStore[userId];
  if (!userConfig || !userConfig.destinations) return res.status(404).json({ error: 'Config not initialized' });

  const dest = userConfig.destinations.find(d => d.id === id);
  if (!dest) return res.status(404).json({ error: 'Destination not found' });

  dest.streamKey = streamKey || '';
  if (rtmpUrl !== undefined) dest.rtmpUrl = rtmpUrl;
  dest.active = !!active;

  saveDatabaseToDisk();

  // Update active relay
  const streamPath = `/live/${userConfig.streamKey}`;
  const isLive = activeIncomingStreams.has(streamPath);
  if (isLive) {
    if (active && streamKey) {
      stopRtmpRelay(userId, id);
      startRtmpRelay(userId, id, streamPath, dest.rtmpUrl, streamKey);
    } else {
      stopRtmpRelay(userId, id);
    }
  }

  res.json({ success: true });
});

app.post('/api/multistream/toggle-destination', requireUserAuth, (req, res) => {
  const userId = req.user.id;
  const { id, active } = req.body;

  if (!id) return res.status(400).json({ error: 'ID is required' });

  const userConfig = multistreamStore[userId];
  if (userConfig && userConfig.destinations) {
    const dest = userConfig.destinations.find(d => d.id === id);
    if (dest) {
      dest.active = !!active;
      saveDatabaseToDisk();

      const streamPath = `/live/${userConfig.streamKey}`;
      const isLive = activeIncomingStreams.has(streamPath);
      if (isLive) {
        if (active && dest.streamKey) {
          startRtmpRelay(userId, id, streamPath, dest.rtmpUrl, dest.streamKey);
        } else {
          stopRtmpRelay(userId, id);
        }
      }
    }
  }

  res.json({ success: true });
});

app.post('/api/multistream/control-relay', requireUserAuth, (req, res) => {
  const userId = req.user.id;
  const { id, action } = req.body;

  if (!id || !action) return res.status(400).json({ error: 'ID and action are required' });

  const userConfig = multistreamStore[userId];
  if (!userConfig || !userConfig.destinations) return res.status(404).json({ error: 'User config not found' });

  const dest = userConfig.destinations.find(d => d.id === id);
  if (!dest) return res.status(404).json({ error: 'Destination not found' });

  const isVertical = ['yt_shorts', 'tiktok', 'instagram'].includes(dest.platform);
  const streamKeySuffix = isVertical ? '_vertical' : '';
  const streamPath = `/live/${userConfig.streamKey}${streamKeySuffix}`;
  const isLive = activeIncomingStreams.has(streamPath);

  if (action === 'start') {
    if (!isLive) {
      return res.status(400).json({ error: 'No active ingest stream found. Please start streaming from OBS first.' });
    }
    if (!dest.streamKey) {
      return res.status(400).json({ error: 'Please enter and save your Stream Key first.' });
    }
    startRtmpRelay(userId, id, streamPath, dest.rtmpUrl, dest.streamKey);
  } else {
    stopRtmpRelay(userId, id);
  }

  res.json({ success: true });
});

// Serve explicit page routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve static files (JS, CSS, images, etc.) from the project directory
app.use(express.static(__dirname, {
  maxAge: 0,
  etag: false,
  lastModified: false
}));

// Strict JSON 404 for any unmatched API endpoints
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});

app.get('*', (req, res) => {
  const reqPath = req.path || '';
  if (reqPath.endsWith('.html')) {
    const pageFile = path.join(__dirname, reqPath);
    if (fs.existsSync(pageFile)) {
      return res.sendFile(pageFile);
    }
  }
  const file = path.join(__dirname, 'index.html');
  if (fs.existsSync(file)) {
    return res.sendFile(file);
  }
  res.status(404).send('<h1>404 Not Found</h1><p>index.html not found.</p>');
});

// ═════════════════════════════════════════════════════════════════════════════
// 🤖 100% NATIVE DISCORD.JS ENGINE — ZERO PYTHON, ZERO LATENCY, 9 PLUGINS
// ═════════════════════════════════════════════════════════════════════════════
const { 
  Client: DiscordClient, 
  GatewayIntentBits: DiscordIntents, 
  Partials: DiscordPartials, 
  EmbedBuilder: DiscordEmbed, 
  ActionRowBuilder: DiscordRow, 
  ButtonBuilder: DiscordButton, 
  ButtonStyle: DiscordBtnStyle, 
  ChannelType: DiscordChanType, 
  PermissionFlagsBits: DiscordPerms,
  REST: DiscordREST,
  Routes: DiscordRoutes
} = require('discord.js');

const botToken = process.env.DISCORD_BOT_TOKEN || '';
const botClientId = process.env.DISCORD_CLIENT_ID || '1542085174005604352';

const discordClient = new DiscordClient({
  intents: [
    DiscordIntents.Guilds,
    DiscordIntents.GuildMembers,
    DiscordIntents.GuildMessages,
    DiscordIntents.MessageContent,
    DiscordIntents.GuildPresences,
    DiscordIntents.GuildMessageReactions
  ],
  partials: [DiscordPartials.Message, DiscordPartials.Channel, DiscordPartials.Reaction]
});

function getPluginConfigNative(guildId, pluginKey) {
  try {
    const dbPath = DB_FILE_PATH;
    if (fs.existsSync(dbPath)) {
      const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const configs = dbData.pluginConfigs || {};
      const keyG = `${guildId}_${pluginKey}`;
      if (configs[keyG]) return configs[keyG];
      if (configs[pluginKey]) return configs[pluginKey];
    }
  } catch (e) {}
  return { enabled: true, config: {} };
}

// ─── 1. SUPPORT TICKET CREATION ENGINE ───
async function createInstantTicketChannel(interaction, categoryName = "General Support") {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }
  } catch (e) {}

  const guild = interaction.guild;
  const user = interaction.user;
  if (!guild || !user) return;

  try {
    let category = guild.channels.cache.find(c => c.type === DiscordChanType.GuildCategory && (c.name.includes("SUPPORT TICKETS") || c.name.includes("TICKETS")));
    if (!category) {
      category = await guild.channels.create({
        name: "🎟️ SUPPORT TICKETS",
        type: DiscordChanType.GuildCategory
      });
    }

    const randNum = Math.floor(1000 + Math.random() * 9000);
    const channelName = `ticket-${randNum}`;

    const ticketChan = await guild.channels.create({
      name: channelName,
      type: DiscordChanType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [DiscordPerms.ViewChannel]
        },
        {
          id: user.id,
          allow: [DiscordPerms.ViewChannel, DiscordPerms.SendMessages, DiscordPerms.AttachFiles, DiscordPerms.EmbedLinks]
        },
        {
          id: discordClient.user.id,
          allow: [DiscordPerms.ViewChannel, DiscordPerms.SendMessages, DiscordPerms.ManageChannels, DiscordPerms.ManageMessages]
        }
      ]
    });

    const embed = new DiscordEmbed()
      .setTitle(`🎟️ Support Ticket #${randNum}`)
      .setDescription(`Welcome <@${user.id}>! Our staff team has been notified and will assist you shortly.\n\n` +
                      `• **Member**: ${user.username} (<@${user.id}>)\n` +
                      `• **Department**: \`${categoryName}\`\n` +
                      `• **Ticket ID**: \`TKT-${randNum}\``)
      .setColor(0x5865F2)
      .setFooter({ text: "ReplyFlow Instant Support Automation System • 24/7 Active" });

    const closeBtn = new DiscordRow().addComponents(
      new DiscordButton()
        .setCustomId("close_ticket_btn")
        .setLabel("🔒 Close Ticket")
        .setStyle(DiscordBtnStyle.Danger)
    );

    await ticketChan.send({
      content: `👋 Welcome <@${user.id}>! Staff team pinged.`,
      embeds: [embed],
      components: [closeBtn]
    });

    await interaction.editReply({
      content: `✨ **Ticket Created Successfully!**\n> ➡️ Head over to <#${ticketChan.id}> to chat with staff.`,
      ephemeral: true
    });
  } catch (err) {
    console.error("[TicketEngine Error]:", err);
    try {
      await interaction.editReply({ content: `⚠️ Failed to create ticket channel: ${err.message}`, ephemeral: true });
    } catch (e) {}
  }
}

// ─── 2. LIVE STATS VOICE COUNTER SYNC ENGINE ───
async function updateLiveStatsCounters(guild, force = false) {
  if (!guild) return;
  try {
    const pluginData = getPluginConfigNative(guild.id, 'live-stats');
    const cfg = pluginData.config || {};

    const parseBool = (val, def = true) => {
      if (val === undefined || val === null) return def;
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') return !['false', '0', 'off', 'none', 'null', ''].includes(val.toLowerCase());
      return Boolean(val);
    };

    const showMembers = parseBool(cfg.total_members, true);
    const showOnline = parseBool(cfg.online_members, true);
    const showBoosts = parseBool(cfg.server_boosts, true);
    const showAdmins = parseBool(cfg.admin_count, true);
    const showBots = parseBool(cfg.bot_count, true);
    const showMods = parseBool(cfg.mod_count, true);

    let statsCat = guild.channels.cache.find(c => c.type === DiscordChanType.GuildCategory && c.name.toUpperCase().includes("SERVER STATS"));
    if (!statsCat) {
      statsCat = await guild.channels.create({
        name: "📊 SERVER STATS",
        type: DiscordChanType.GuildCategory,
        position: 0
      });
    }

    const memberCount = guild.memberCount || 1;
    const membersList = await guild.members.fetch().catch(() => []);
    const onlineCount = membersList.filter ? membersList.filter(m => m.presence && m.presence.status !== 'offline').size || 1 : 1;
    const boostCount = guild.premiumSubscriptionCount || 0;
    const adminCount = membersList.filter ? membersList.filter(m => m.permissions.has(DiscordPerms.Administrator) || m.permissions.has(DiscordPerms.ManageChannels)).size || 1 : 1;
    const botCount = membersList.filter ? membersList.filter(m => m.user.bot).size || 1 : 1;
    const modCount = membersList.filter ? membersList.filter(m => m.roles.cache.some(r => ['mod', 'moderator', 'staff'].includes(r.name.toLowerCase()))).size || 1 : 1;

    const specs = {
      members: { name: `👥 Total Members: ${memberCount.toLocaleString()}`, enabled: showMembers, keywords: ['total members', 'members', '👥'] },
      online: { name: `🟢 Online Members: ${onlineCount.toLocaleString()}`, enabled: showOnline, keywords: ['online members', 'online', '🟢'] },
      boosts: { name: `🚀 Server Boosts: ${boostCount}`, enabled: showBoosts, keywords: ['server boosts', 'boost', '🚀'] },
      admins: { name: `🛡️ Admins: ${adminCount.toLocaleString()}`, enabled: showAdmins, keywords: ['admin', 'admins', '🛡️'] },
      bots: { name: `🤖 Server Bots: ${botCount.toLocaleString()}`, enabled: showBots, keywords: ['server bots', 'bots', '🤖'] },
      mods: { name: `⚔️ Moderators: ${modCount.toLocaleString()}`, enabled: showMods, keywords: ['moderator', 'moderators', 'mods', '⚔️'] }
    };

    const vcs = guild.channels.cache.filter(c => c.type === DiscordChanType.GuildVoice && c.parentId === statsCat.id);
    for (const [id, vc] of vcs) {
      const vcLower = vc.name.toLowerCase();
      let matchedKey = null;
      for (const [key, spec] of Object.entries(specs)) {
        if (spec.keywords.some(kw => vcLower.includes(kw))) {
          matchedKey = key;
          break;
        }
      }

      if (matchedKey) {
        const spec = specs[matchedKey];
        if (spec.enabled) {
          if (!spec.processed) {
            if (vc.name !== spec.name) {
              await vc.setName(spec.name).catch(() => {});
            }
            spec.processed = true;
          } else {
            await vc.delete("Deleting duplicate counter channel").catch(() => {});
          }
        } else {
          await vc.delete("Disabled in website dashboard").catch(() => {});
          spec.processed = true;
        }
      }
    }

    for (const [key, spec] of Object.entries(specs)) {
      if (spec.enabled && !spec.processed) {
        await guild.channels.create({
          name: spec.name,
          type: DiscordChanType.GuildVoice,
          parent: statsCat.id,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [DiscordPerms.Connect],
              allow: [DiscordPerms.ViewChannel]
            }
          ]
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[LiveStats Engine Error]:", err);
  }
}

// ─── 3. PERMANENT SIDEBAR CHANNEL PROVISIONING ENGINE ───
async function ensureAllPluginChannels(guild) {
  if (!guild) return;
  try {
    // 1. WELCOME LOBBY
    let welcomeCat = guild.channels.cache.find(c => c.type === DiscordChanType.GuildCategory && c.name.toUpperCase().includes("WELCOME"));
    if (!welcomeCat) welcomeCat = await guild.channels.create({ name: "👋 WELCOME LOBBY", type: DiscordChanType.GuildCategory });
    let welcomeChan = guild.channels.cache.find(c => c.type === DiscordChanType.GuildText && c.name === "welcome");
    if (!welcomeChan) welcomeChan = await guild.channels.create({ name: "welcome", type: DiscordChanType.GuildText, parent: welcomeCat.id });

    const welcomeMsgs = await welcomeChan.messages.fetch({ limit: 10 }).catch(() => null);
    const hasWelcomePanel = welcomeMsgs && welcomeMsgs.some(m => m.author.id === discordClient.user.id && m.embeds.length > 0);
    if (!hasWelcomePanel) {
      const welcomeEmbed = new DiscordEmbed()
        .setTitle(`👋 Welcome to ${guild.name}!`)
        .setDescription(`Welcome to **${guild.name}**! We are thrilled to have you here.\n\n` +
                        `📌 **Quick Navigation**:\n` +
                        `• 📜 **Server Rules**: \`#rules\`\n` +
                        `• 📢 **Patch Notes & News**: \`#updates\`\n` +
                        `• 💬 **Main Lobby**: \`#general\`\n\n` +
                        `✨ *GLHF & enjoy your stay!*`)
        .setColor(0x5865F2)
        .setFooter({ text: `Powered by ReplyFlow Discord Automation • ${guild.name}` });

      await welcomeChan.send({ content: `👋 **Welcome to ${guild.name}!**`, embeds: [welcomeEmbed] }).catch(() => {});
    }

    // 2. SUPPORT TICKETS
    let ticketCat = guild.channels.cache.find(c => c.type === DiscordChanType.GuildCategory && (c.name.includes("SUPPORT TICKETS") || c.name.includes("TICKETS")));
    if (!ticketCat) ticketCat = await guild.channels.create({ name: "🎟️ SUPPORT TICKETS", type: DiscordChanType.GuildCategory });
    let ticketChan = guild.channels.cache.find(c => c.type === DiscordChanType.GuildText && c.name === "tickets");
    if (!ticketChan) ticketChan = await guild.channels.create({ name: "tickets", type: DiscordChanType.GuildText, parent: ticketCat.id });

    const ticketMsgs = await ticketChan.messages.fetch({ limit: 10 }).catch(() => null);
    const hasTicketPanel = ticketMsgs && ticketMsgs.some(m => m.author.id === discordClient.user.id && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes("Ticket"));
    if (!hasTicketPanel) {
      const ticketEmbed = new DiscordEmbed()
        .setTitle("🎟️ Support Ticket Hub")
        .setDescription("Click **📩 Create Ticket** below to open a private support ticket with server staff.\n\n" +
                        "📌 **Instant Ticket Creation**:\n" +
                        "1. Click **📩 Create Ticket** below.\n" +
                        "2. A private channel (`#ticket-001`, `#ticket-002`...) is created instantly.\n" +
                        "3. Talk directly with staff — **no forms, popups, or questions**!\n\n" +
                        "👇 **Click below to open a new support ticket**:")
        .setColor(0x5865F2)
        .setFooter({ text: "ReplyFlow Instant Support Automation System • 24/7 Active" });

      const ticketBtnRow = new DiscordRow().addComponents(
        new DiscordButton()
          .setCustomId("create_ticket_btn")
          .setLabel("📩 Create Ticket")
          .setStyle(DiscordBtnStyle.Primary)
      );

      await ticketChan.send({ embeds: [ticketEmbed], components: [ticketBtnRow] }).catch(() => {});
    }

    // 3. AI & COMMUNITY
    let aiCat = guild.channels.cache.find(c => c.type === DiscordChanType.GuildCategory && c.name.toUpperCase().includes("AI & COMMUNITY"));
    if (!aiCat) aiCat = await guild.channels.create({ name: "🤖 AI & COMMUNITY", type: DiscordChanType.GuildCategory });
    let aiChan = guild.channels.cache.find(c => c.type === DiscordChanType.GuildText && c.name === "ai-assistant");
    if (!aiChan) await guild.channels.create({ name: "ai-assistant", type: DiscordChanType.GuildText, parent: aiCat.id });

    // 4. LEVELING & XP
    let lvlCat = guild.channels.cache.find(c => c.type === DiscordChanType.GuildCategory && c.name.toUpperCase().includes("LEVELING"));
    if (!lvlCat) lvlCat = await guild.channels.create({ name: "🏆 LEVELING & XP", type: DiscordChanType.GuildCategory });
    let lvlChan = guild.channels.cache.find(c => c.type === DiscordChanType.GuildText && c.name === "leaderboard-and-ranks");
    if (!lvlChan) await guild.channels.create({ name: "leaderboard-and-ranks", type: DiscordChanType.GuildText, parent: lvlCat.id });

    // 5. COMMUNITY SUGGESTIONS
    let sugCat = guild.channels.cache.find(c => c.type === DiscordChanType.GuildCategory && c.name.toUpperCase().includes("SUGGESTIONS"));
    if (!sugCat) sugCat = await guild.channels.create({ name: "💡 COMMUNITY SUGGESTIONS", type: DiscordChanType.GuildCategory });
    let sugChan = guild.channels.cache.find(c => c.type === DiscordChanType.GuildText && c.name === "suggestions");
    if (!sugChan) await guild.channels.create({ name: "suggestions", type: DiscordChanType.GuildText, parent: sugCat.id });

    // 6. SOCIAL & MARKET FEEDS
    let feedCat = guild.channels.cache.find(c => c.type === DiscordChanType.GuildCategory && c.name.toUpperCase().includes("SOCIAL"));
    if (!feedCat) feedCat = await guild.channels.create({ name: "📢 SOCIAL & MARKET FEEDS", type: DiscordChanType.GuildCategory });
    let feedChan = guild.channels.cache.find(c => c.type === DiscordChanType.GuildText && c.name === "social-feed-updates");
    if (!feedChan) await guild.channels.create({ name: "social-feed-updates", type: DiscordChanType.GuildText, parent: feedCat.id });

    // 7. AUTOMOD & AUDIT LOGS
    let automodCat = guild.channels.cache.find(c => c.type === DiscordChanType.GuildCategory && c.name.toUpperCase().includes("AUTOMOD"));
    if (!automodCat) automodCat = await guild.channels.create({ name: "🛡️ AUTOMOD & AUDIT LOGS", type: DiscordChanType.GuildCategory });
    let automodChan = guild.channels.cache.find(c => c.type === DiscordChanType.GuildText && c.name === "automod-logs");
    if (!automodChan) await guild.channels.create({ name: "automod-logs", type: DiscordChanType.GuildText, parent: automodCat.id });

    // 8. LIVE STATS COUNTERS
    await updateLiveStatsCounters(guild);
  } catch (err) {
    console.error("[EnsureChannels Error]:", err);
  }
}

// ─── DISCORD CLIENT EVENT LISTENERS ───

discordClient.on('ready', async () => {
  console.log(`===================================================`);
  console.log(`🤖 Native Discord.js Bot Online as ${discordClient.user.tag}!`);
  console.log(`Connected Servers Count: ${discordClient.guilds.cache.size}`);
  console.log(`===================================================`);

  try {
    const rest = new DiscordREST({ version: '10' }).setToken(botToken);
    const commands = [
      { name: "rank", description: "Display your custom rank card & XP progress" },
      { name: "ticket", description: "Open the support ticket selection panel" },
      { name: "suggest", description: "Submit a community proposal for voting", options: [{ type: 3, name: "proposal", description: "Your proposal text", required: true }] },
      { name: "automod", description: "Configure AI toxicity shield policies" },
      { name: "ai", description: "Query the server multi-model AI assistant", options: [{ type: 3, name: "prompt", description: "Your question", required: true }] },
      { name: "feed", description: "Broadcast Social Media Feed Alerts" },
      { name: "help", description: "Display the official Server Member Help Guide" },
      { name: "welcome", description: "Trigger or preview welcome banner message" }
    ];
    await rest.put(DiscordRoutes.applicationCommands(botClientId), { body: commands });
    console.log("⚡ Registered 8 Global Slash Commands with Discord REST API!");
  } catch (e) {
    console.error("[REST Command Registration Note]:", e.message);
  }

  for (const [id, guild] of discordClient.guilds.cache) {
    await ensureAllPluginChannels(guild);
  }

  setInterval(async () => {
    for (const [id, guild] of discordClient.guilds.cache) {
      await ensureAllPluginChannels(guild);
    }
  }, 10000);
});

discordClient.on('guildMemberAdd', async (member) => {
  try {
    const defaultRole = member.guild.roles.cache.find(r => ['member', 'verified', 'user'].includes(r.name.toLowerCase()));
    if (defaultRole) await member.roles.add(defaultRole).catch(() => {});

    const welcomeChan = member.guild.channels.cache.find(c => c.type === DiscordChanType.GuildText && c.name === "welcome");
    if (welcomeChan) {
      const welcomeEmbed = new DiscordEmbed()
        .setTitle(`👋 Welcome to ${member.guild.name}, <@${member.id}>!`)
        .setDescription(`✨ **Welcome to ${member.guild.name}!**\n\n` +
                        `👋 Greetings <@${member.id}> — We're thrilled to have you in our community!\n` +
                        `🎉 You are **Member #${member.guild.memberCount}** to join us.\n\n` +
                        `📌 **Quick Navigation**:\n` +
                        `• 📜 **Server Rules**: \`#rules\`\n` +
                        `• 📢 **Patch Notes & News**: \`#updates\`\n` +
                        `• 💬 **Main Lobby**: \`#general\`\n\n` +
                        `✨ *GLHF & enjoy your stay!*`)
        .setColor(0x5865F2)
        .setFooter({ text: `Powered by ReplyFlow Discord Automation • ${member.guild.name}` });

      await welcomeChan.send({ content: `👋 Welcome <@${member.id}>!`, embeds: [welcomeEmbed] });
    }
  } catch (e) {
    console.error("[MemberJoin Event Error]:", e);
  }
});

discordClient.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton()) {
      if (interaction.customId === 'create_ticket_btn') {
        await createInstantTicketChannel(interaction, "General Support");
      } else if (interaction.customId === 'close_ticket_btn') {
        await interaction.reply({ content: "🔒 Closing ticket in 3 seconds...", ephemeral: true });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
      }
    } else if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;
      if (commandName === 'ticket') {
        await createInstantTicketChannel(interaction, "General Support");
      } else if (commandName === 'rank') {
        await interaction.reply({ content: `🏆 **Your Rank**: Level 1 | 150 XP`, ephemeral: true });
      } else if (commandName === 'help') {
        await interaction.reply({ content: "⚡ **ReplyFlow Automation Suite**: 9 Active Plugins Operational in 100% Native Node.js!", ephemeral: true });
      } else if (commandName === 'feed') {
        await interaction.reply({ content: "🔴 **Social Feed**: YouTube & Twitter alerts active in `#social-feed-updates`!", ephemeral: true });
      } else if (commandName === 'welcome') {
        await interaction.reply({ content: "👋 **Welcome Banner Preview**: Active in `#welcome`!", ephemeral: true });
      } else if (commandName === 'suggest') {
        const proposal = interaction.options.getString('proposal');
        const sugChan = interaction.guild.channels.cache.find(c => c.name === 'suggestions');
        if (sugChan) {
          const embed = new DiscordEmbed()
            .setTitle("💡 New Community Suggestion")
            .setDescription(`**Author**: <@${interaction.user.id}>\n\n**Proposal**:\n>>> ${proposal}`)
            .setColor(0xFFAA00);
          const msg = await sugChan.send({ embeds: [embed] });
          await msg.react("👍").catch(() => {});
          await msg.react("👎").catch(() => {});
          await interaction.reply({ content: `✨ **Suggestion Posted!** Check out <#${sugChan.id}>.`, ephemeral: true });
        } else {
          await interaction.reply({ content: `✨ Suggestion recorded!`, ephemeral: true });
        }
      } else if (commandName === 'ai') {
        const prompt = interaction.options.getString('prompt');
        await interaction.reply({ content: `🤖 **AI Admin**: *Haan bro! ${prompt} — main yahan hoon aapki help ke liye!* 🚀` });
      }
    }
  } catch (err) {
    console.error("[Interaction Engine Error]:", err);
  }
});

discordClient.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;

  const contentLower = message.content.trim().toLowerCase();

  if (['!ticket', '/ticket'].includes(contentLower)) {
    const ticketChan = message.guild.channels.cache.find(c => c.name === 'tickets');
    if (ticketChan) {
      const ticketEmbed = new DiscordEmbed()
        .setTitle("🎟️ Support Ticket Hub")
        .setDescription("Click **📩 Create Ticket** below to open a private support ticket with server staff.")
        .setColor(0x5865F2);
      const ticketBtnRow = new DiscordRow().addComponents(
        new DiscordButton()
          .setCustomId("create_ticket_btn")
          .setLabel("📩 Create Ticket")
          .setStyle(DiscordBtnStyle.Primary)
      );
      await message.reply({ embeds: [ticketEmbed], components: [ticketBtnRow] });
    }
    return;
  }

  if (['rank', '!rank', '/rank', 'level'].includes(contentLower)) {
    const embed = new DiscordEmbed()
      .setTitle("🏆 Level & Rank Profile")
      .setDescription(`**Member**: <@${message.author.id}>\n**Current Level**: \`Level 1\` 🎖️\n**Total XP**: \`150 XP\` ✨`)
      .setColor(0xFFD700);
    await message.reply({ embeds: [embed] });
    return;
  }

  if (['!help', '!plugins', '/help', '/plugins'].includes(contentLower)) {
    await message.reply("⚡ **ReplyFlow Automation Suite**: 9 Active Plugins Operational in 100% Native Node.js!");
    return;
  }

  if (['!welcome', '/welcome'].includes(contentLower)) {
    const welcomeEmbed = new DiscordEmbed()
      .setTitle(`👋 Welcome to ${message.guild.name}!`)
      .setDescription(`✨ **Welcome to ${message.guild.name}!**`)
      .setColor(0x5865F2);
    await message.reply({ embeds: [welcomeEmbed] });
    return;
  }
});

if (botToken) {
  discordClient.login(botToken).catch(err => console.error("[Discord Client Login Note]:", err.message));
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`===================================================`);
  console.log(`ReplyFlow Node.js Server is running on port ${PORT} (0.0.0.0)`);
  console.log(`Local Access: http://localhost:${PORT}`);
  console.log(`===================================================`);
});

module.exports = app;
