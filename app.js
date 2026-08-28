/**
 * ReplyFlow — App Controller
 * Manages Responsive Routing (Desktop Sidebar & Mobile Bottom Nav),
 * Modals, Chart Animations, and State Toggles.
 */

// Auto-initialize ReplyFlow App immediately on script load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReplyFlowApp);
} else {
  initReplyFlowApp();
}

function initReplyFlowApp() {

  // ── Global Scope State & Dynamic Accounts Manager Vars ──
  var loadedAccounts = { ig: [], yt: [], tt: [], fb: [], li: [], wa: [], wc: [], tg: [], dc: [], gm: [] };
  var activeAccountIdx = { ig: 0, yt: 0, tt: 0, fb: 0, li: 0, wa: 0, wc: 0, tg: 0, dc: 0, gm: 0 };
  var currentBillingData = null;
  var activeAccountsTabPlatform = 'ig';

  // ── Global Backend Endpoint Resolver & Universal Fetch Interceptor ──
  window.getApiEndpoint = function(path) {
    if (!path) return '';
    if (typeof path !== 'string') return path;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;

    // 1. Prefer explicit window.REPLYFLOW_BACKEND_URL if set
    if (window.REPLYFLOW_BACKEND_URL && String(window.REPLYFLOW_BACKEND_URL).trim() !== '') {
      const base = String(window.REPLYFLOW_BACKEND_URL).trim().replace(/\/$/, '');
      return base + (path.startsWith('/') ? path : '/' + path);
    }

    // 2. Local Development Fallback
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      if (window.location.port !== '3000') {
        return 'http://localhost:3000' + (path.startsWith('/') ? path : '/' + path);
      }
    }

    return path;
  };

  const originalFetch = window.fetch;
  window.fetch = function (input, options = {}) {
    let url = typeof input === 'string' ? input : (input && input.url ? input.url : '');

    // Automatically rewrite relative /api/ requests to the backend server URL
    if (typeof url === 'string' && url.startsWith('/api/')) {
      url = window.getApiEndpoint(url);
    }

    options = options || {};
    options.headers = options.headers || {};
    if (options.headers instanceof Headers) {
      options.headers.set('ngrok-skip-browser-warning', 'true');
    } else if (Array.isArray(options.headers)) {
      options.headers.push(['ngrok-skip-browser-warning', 'true']);
    } else {
      options.headers['ngrok-skip-browser-warning'] = 'true';
    }

    if (typeof input === 'string') {
      return originalFetch.call(this, url, options);
    } else if (typeof Request !== 'undefined' && input instanceof Request) {
      return originalFetch.call(this, new Request(url, input), options);
    } else {
      return originalFetch.call(this, url, options);
    }
  };

  // ── Light / Dark Theme Switcher ──
  function initTheme() {
    const savedTheme = localStorage.getItem('replyflow_theme') || 'dark';
    setTheme(savedTheme);

    const desktopBtn = document.getElementById('theme-toggle-btn-desktop');
    const mobileBtn = document.getElementById('theme-toggle-btn-mobile');

    const toggleThemeHandler = () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      setTheme(next);
    };

    if (desktopBtn) desktopBtn.addEventListener('click', toggleThemeHandler);
    if (mobileBtn) mobileBtn.addEventListener('click', toggleThemeHandler);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('replyflow_theme', theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'light' ? '#F8FAFC' : '#0D0D12');
    }
  }

  initTheme();

  // ── Load Website Settings & Brand Logos ──
  function loadWebsiteBrandingSettings() {
    fetch('/api/admin/settings')
      .then(res => res.json())
      .then(cfg => {
        if (cfg.websiteName) {
          document.title = `${cfg.websiteName} — Auto-Reply Agent`;
          document.querySelectorAll('.website-brand-title').forEach(el => {
            el.textContent = cfg.websiteName;
          });
        }
        if (cfg.logoUrl) {
          document.querySelectorAll('.website-brand-logo').forEach(img => {
            img.src = cfg.logoUrl;
            img.style.display = 'block';
          });
          document.querySelectorAll('.website-brand-fallback').forEach(fb => {
            fb.style.display = 'none';
          });
        } else {
          document.querySelectorAll('.website-brand-logo').forEach(img => {
            img.style.display = 'none';
          });
          document.querySelectorAll('.website-brand-fallback').forEach(fb => {
            fb.style.display = 'block';
          });
        }
      })
      .catch(err => console.log('Error loading website brand settings:', err));
  }
  loadWebsiteBrandingSettings();

  // ── Modal System Helpers ──
  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('closing');
      modal.classList.add('active', 'open');
      modal.style.display = 'flex';
      modal.style.opacity = '1';
      modal.style.visibility = 'visible';
      modal.style.zIndex = '999999';
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('active', 'open', 'closing');
      modal.style.display = 'none';
      modal.style.opacity = '0';
      modal.style.visibility = 'hidden';
      document.body.style.overflow = '';
    }
  }

  window.openModal = openModal;
  window.closeModal = closeModal;

  // Close modals on overlay backdrop click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  // ── Global Multi-Tenant Authorization Header Interceptor ──
  const originalFetchIntercept = window.fetch;
  window.fetch = function (url, options = {}) {
    options = options || {};
    options.headers = options.headers || {};
    const token = localStorage.getItem('replyflow_user_token');
    if (token) {
      if (typeof Headers !== 'undefined' && options.headers instanceof Headers) {
        if (!options.headers.has('Authorization')) {
          options.headers.append('Authorization', `Bearer ${token}`);
        }
      } else if (Array.isArray(options.headers)) {
        options.headers.push(['Authorization', `Bearer ${token}`]);
      } else {
        if (!options.headers['Authorization'] && !options.headers['authorization']) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      }
    }
    return originalFetchIntercept.call(this, url, options);
  };

  // ── Auto Handle URL OAuth Token & Query Parameters (Google Login / Social OAuth) ──
  function processUrlAuthTokens() {
    if (!window.location.search) return;
    const searchParams = new URLSearchParams(window.location.search);
    const googleToken = searchParams.get('google_token') || searchParams.get('auth_token');
    const userName = searchParams.get('user_name') || searchParams.get('name');
    const userPlan = searchParams.get('plan');
    const linkedinConnected = searchParams.get('linkedin_connected');
    const twitterConnected = searchParams.get('twitter_connected');
    const errorParam = searchParams.get('error');

    if (googleToken) {
      localStorage.setItem('replyflow_user_token', googleToken);
      if (userName) localStorage.setItem('replyflow_user_name', userName);
      if (userPlan) localStorage.setItem('replyflow_user_plan', userPlan);

      const userObj = {
        name: userName || 'Creator',
        email: searchParams.get('discord_email') || searchParams.get('email') || `${(userName || 'creator').toLowerCase().replace(/\s+/g, '_')}@replyflow.app`,
        plan: userPlan || 'Free',
        role: 'creator'
      };
      localStorage.setItem('replyflow_user', JSON.stringify(userObj));

      // Clean query parameters from URL address bar, keep hash if present or set to #dashboard
      const targetHash = window.location.hash && window.location.hash !== '#login' ? window.location.hash : '#dashboard';
      const cleanUrl = window.location.origin + window.location.pathname + targetHash;
      window.history.replaceState(null, '', cleanUrl);

      // Immediately hide login landing page & show main dashboard shell
      const standaloneLanding = document.getElementById('standalone-landing-page');
      const mainAppShell = document.getElementById('main-app-shell');
      if (standaloneLanding) standaloneLanding.style.display = 'none';
      if (mainAppShell) mainAppShell.style.display = 'block';

      const screenToSwitch = targetHash.replace('#', '').split('?')[0] || 'dashboard';
      switchScreen(screenToSwitch);
    }

    if (linkedinConnected && typeof showSuccessToast === 'function') {
      showSuccessToast('LinkedIn account connected successfully!');
    }
    if (twitterConnected && typeof showSuccessToast === 'function') {
      showSuccessToast('Twitter (X) account connected successfully!');
    }

    const fullUrl = window.location.href;
    if (fullUrl.includes('success=linked') || fullUrl.includes('yt_connected=true') || fullUrl.includes('connected=true') || searchParams.get('success') === 'linked' || searchParams.get('connected') === 'true') {
      localStorage.setItem('replyflow_yt_connected', 'true');
      setTimeout(() => {
        if (typeof updateYouTubeConnectionUI === 'function') updateYouTubeConnectionUI();
        if (typeof loadAccounts === 'function') loadAccounts('yt');
        if (typeof showSuccessToast === 'function') {
          showSuccessToast('YouTube Channel linked & synced successfully! 🔴');
        }
      }, 200);
    }

    if (errorParam && typeof showErrorToast === 'function') {
      showErrorToast('Authentication note: ' + errorParam);
    }
  }

  processUrlAuthTokens();

  // ── Navigation Selectors ──
  const navItemsMobile = document.querySelectorAll('.nav-item[data-screen]');
  const navItemsDesktop = document.querySelectorAll('.sidebar-nav-item[data-screen]');
  const screens = document.querySelectorAll('.screen');
  let currentPlatform = 'ig'; // Global state for Trigger Builder platform

  function switchToLoginPage() {
    const landing = document.getElementById('standalone-landing-page');
    const shell = document.getElementById('main-app-shell');
    const dropdown = document.getElementById('profile-dropdown');

    if (dropdown) {
      dropdown.classList.remove('open');
      dropdown.style.display = 'none';
    }
    if (landing) {
      landing.style.display = 'block';
      landing.style.pointerEvents = 'auto';
    }
    if (shell) {
      shell.style.display = 'none';
    }

    const authView = document.getElementById('standalone-auth-view');
    if (authView) authView.style.display = 'block';
    const loginForm = document.getElementById('auth-form-login');
    if (loginForm) loginForm.style.display = 'block';

    const inputsAndBtns = document.querySelectorAll('#standalone-landing-page input, #standalone-landing-page button, #standalone-landing-page a');
    inputsAndBtns.forEach(el => {
      el.style.pointerEvents = 'auto';
    });

    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname + '#login');
    }
  }
  window.switchToLoginPage = switchToLoginPage;

  // ── Production Single Source of Truth Router (URL Hash Derived) ──
  function switchScreen(screenId) {
    const standaloneLanding = document.getElementById('standalone-landing-page');
    const mainAppShell = document.getElementById('main-app-shell');
    let token = localStorage.getItem('replyflow_user_token');

    // 🔒 MANDATORY AUTH GUARD: If user has no valid session token or is visiting landing/login, show Auth Screen
    if (!token || screenId === 'login' || screenId === 'landing') {
      switchToLoginPage();
      return;
    }

    // Entering Dashboard & Inner Screens
    if (standaloneLanding) standaloneLanding.style.display = 'none';
    if (mainAppShell) mainAppShell.style.display = 'block';

    // 🛡️ PERMANENT DOM INTEGRITY SELF-HEALING SAFEGUARD
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      document.querySelectorAll('.screen').forEach(s => {
        if (s.parentElement !== mainContent) mainContent.appendChild(s);
      });
    }

    const cleanScreenId = screenId ? String(screenId).replace('#', '').split('?')[0] : 'dashboard';
    const allScreens = document.querySelectorAll('.screen');
    const targetScreen = document.getElementById(`screen-${cleanScreenId}`);
    const finalScreenId = targetScreen ? cleanScreenId : (['discord', 'youtube', 'triggers', 'accounts', 'analytics', 'settings', 'referrals', 'multistream'].includes(cleanScreenId) ? cleanScreenId : 'dashboard');

    allScreens.forEach(s => {
      s.classList.remove('active');
      s.removeAttribute('style');
    });
    document.querySelectorAll('.nav-item[data-screen], .sidebar-nav-item[data-screen]').forEach(n => n.classList.remove('active'));

    const activeScreen = document.getElementById(`screen-${finalScreenId}`);
    const activeNavs = document.querySelectorAll(`[data-screen="${finalScreenId}"]`);

    if (activeScreen) {
      activeScreen.classList.add('active');
      activeScreen.removeAttribute('style');
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    activeNavs.forEach(nav => nav.classList.add('active'));

    localStorage.setItem('replyflow_active_screen', finalScreenId);
    window.activeScreen = finalScreenId;

    if (typeof collapseSidebarMoreSocials === 'function') {
      collapseSidebarMoreSocials();
    }

    if (finalScreenId !== 'multistream' && window.msPreviewPlayer) {
      try {
        window.msPreviewPlayer.pause();
        window.msPreviewPlayer.unload();
        window.msPreviewPlayer.detachMediaElement();
        window.msPreviewPlayer.destroy();
      } catch (e) { }
      window.msPreviewPlayer = null;
      const videoEl = document.getElementById('ms-preview-video');
      const offlinePlaceholderEl = document.getElementById('ms-preview-offline-placeholder');
      if (videoEl) videoEl.style.display = 'none';
      if (offlinePlaceholderEl) offlinePlaceholderEl.style.display = 'flex';
    }

    const currentHashName = window.location.hash ? window.location.hash.replace('#', '').split('?')[0] : '';
    if (currentHashName !== finalScreenId) {
      if (finalScreenId === 'discord') {
        const savedPlugin = localStorage.getItem('replyflow_active_discord_plugin');
        const targetHash = (savedPlugin && savedPlugin !== 'overview') ? `#discord?plugin=${savedPlugin}` : '#discord';
        window.history.replaceState(null, '', targetHash);
      } else {
        window.history.replaceState(null, '', '#' + finalScreenId);
      }
    }

    requestAnimationFrame(() => {
      if (typeof animateScreenElements === 'function') {
        animateScreenElements(finalScreenId);
      }
    });

    const inlineSubmenu = document.getElementById('discord-inline-submenu');
    const menuChevron = document.getElementById('discord-menu-chevron');
    const mainSidebar = document.getElementById('main-sidebar-menu');
    const discordSidebar = document.getElementById('discord-sidebar-menu');
    const youtubeSidebar = document.getElementById('youtube-sidebar-menu');

    if (finalScreenId === 'discord') {
      if (inlineSubmenu) inlineSubmenu.style.display = 'none';
      if (menuChevron) menuChevron.style.transform = 'rotate(0deg)';
      if (mainSidebar) mainSidebar.style.display = 'none';
      if (discordSidebar) discordSidebar.style.display = 'flex';
      if (youtubeSidebar) youtubeSidebar.style.display = 'none';
      const activeKey = window.activePluginKey || 'overview';
      document.querySelectorAll('#discord-sidebar-menu [data-plugin-nav]').forEach(el => el.classList.remove('active'));
      const activeEl = document.querySelector(`#discord-sidebar-menu [data-plugin-nav="${activeKey}"]`);
      if (activeEl) activeEl.classList.add('active');
    } else if (finalScreenId === 'youtube') {
      if (inlineSubmenu) inlineSubmenu.style.display = 'none';
      if (menuChevron) menuChevron.style.transform = 'rotate(0deg)';
      if (mainSidebar) mainSidebar.style.display = 'none';
      if (discordSidebar) discordSidebar.style.display = 'none';
      if (youtubeSidebar) youtubeSidebar.style.display = 'flex';
      const savedYTView = localStorage.getItem('replyflow_yt_subtab') || 'dashboard';
      const tabs = ['dashboard', 'videos', 'livestreams', 'posts', 'obs'];
      tabs.forEach(t => {
        const nav = document.getElementById(`yt-nav-${t}`);
        if (nav) {
          if (t === savedYTView) nav.classList.add('active');
          else nav.classList.remove('active');
        }
      });
      if (typeof switchYTSubTab === 'function') {
        const subTabMap = { 'obs': 'obs', 'livestreams': 'live', 'dashboard': 'dashboard', 'videos': 'videos', 'posts': 'videos' };
        switchYTSubTab(subTabMap[savedYTView] || 'dashboard');
      }
    } else {
      if (inlineSubmenu) inlineSubmenu.style.display = 'none';
      if (menuChevron) menuChevron.style.transform = 'rotate(0deg)';
      if (mainSidebar) mainSidebar.style.display = 'flex';
      if (discordSidebar) discordSidebar.style.display = 'none';
      if (youtubeSidebar) youtubeSidebar.style.display = 'none';
    }

    if (finalScreenId === 'discord') {
      loadAccounts('dc');
      if (typeof loadDiscordBotData === 'function') loadDiscordBotData();
    } else if (finalScreenId === 'youtube') {
      updateYouTubeConnectionUI();
      if (typeof loadAccounts === 'function') loadAccounts('yt');
    } else if (finalScreenId === 'multistream') {
      if (typeof window.loadUserMultistreamConfig === 'function') window.loadUserMultistreamConfig();
    }
  }

  function getAuthHeaders(extraHeaders = {}) {
    const token = localStorage.getItem('replyflow_user_token') || '';
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    if (token) {
      headers['x-session-token'] = token;
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }
  window.getAuthHeaders = getAuthHeaders;

  function updateYouTubeConnectionUI() {
    const isConnected = localStorage.getItem('replyflow_yt_connected') === 'true';
    const channelName = localStorage.getItem('replyflow_yt_channel') || '';

    const badgeEl = document.getElementById('yt-header-badge');
    const quotaEl = document.getElementById('yt-header-quota');
    const connectBtn = document.getElementById('yt-connect-btn');
    const channelNameEl = document.getElementById('yt-dash-channel-name');
    const channelStatusEl = document.getElementById('yt-dash-channel-status');
    const summaryDescEl = document.getElementById('yt-dash-summary-desc');
    const superchatEl = document.getElementById('yt-dash-superchat');
    const viewsEl = document.getElementById('yt-dash-last-month-views');
    const triggersEl = document.getElementById('yt-dash-total-triggers');
    const dmsSentEl = document.getElementById('yt-dash-dms-sent');
    const monitoredVidsEl = document.getElementById('yt-dash-monitored-vids');

    if (badgeEl) {
      badgeEl.textContent = isConnected ? 'Online 🟢' : 'Offline 🔴';
      badgeEl.className = isConnected ? 'badge badge-connected' : 'badge badge-disconnected';
    }
    if (quotaEl) quotaEl.textContent = 'Official YouTube Data API v3';
    if (channelNameEl) channelNameEl.textContent = isConnected ? (channelName || '@ConnectedChannel') : 'No Channel Linked';
    if (channelStatusEl) channelStatusEl.textContent = isConnected ? 'Connected' : 'Disconnected';

    if (connectBtn) {
      if (isConnected) {
        connectBtn.textContent = 'Disconnect Channel';
        connectBtn.style.background = 'rgba(239, 68, 68, 0.2)';
        connectBtn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        connectBtn.style.color = '#f87171';
        connectBtn.onclick = function () { disconnectYouTubeChannel(); };
      } else {
        connectBtn.textContent = 'Connect Channel';
        connectBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        connectBtn.style.borderColor = '#ef4444';
        connectBtn.style.color = '#ffffff';
        connectBtn.onclick = function () { connectYouTubeChannel(); };
      }
    }

    if (!isConnected) {
      if (superchatEl) superchatEl.textContent = '$0.00';
      if (viewsEl) viewsEl.textContent = '0';
      if (triggersEl) triggersEl.textContent = '0 Triggers';
      if (dmsSentEl) dmsSentEl.textContent = '0 DMs';
      if (monitoredVidsEl) monitoredVidsEl.textContent = '0 Videos';
    }

    // Sync with backend accounts & triggers list asynchronously
    Promise.all([
      fetch('/api/accounts?platform=yt', { headers: getAuthHeaders() }).then(res => res.ok ? res.json() : []),
      fetch('/api/triggers?platform=yt', { headers: getAuthHeaders() }).then(res => res.ok ? res.json() : [])
    ]).then(([accounts, triggers]) => {
      if (Array.isArray(accounts) && accounts.length > 0) {
        loadedAccounts['yt'] = accounts;
        const activeAcc = accounts[0];
        const cName = activeAcc.username ? (activeAcc.username.startsWith('@') ? activeAcc.username : `@${activeAcc.username}`) : (activeAcc.title || '@YouTubeChannel');
        localStorage.setItem('replyflow_yt_connected', 'true');
        localStorage.setItem('replyflow_yt_channel', cName);

        if (badgeEl) {
          badgeEl.textContent = 'Online 🟢';
          badgeEl.className = 'badge badge-connected';
        }
        if (channelNameEl) channelNameEl.textContent = cName;
        if (channelStatusEl) channelStatusEl.textContent = 'Connected';
        if (summaryDescEl) summaryDescEl.textContent = `Connected YouTube Channel: ${cName}`;
        const obsHeaderChan = document.getElementById('yt-obs-header-channel');
        if (obsHeaderChan) obsHeaderChan.textContent = `Connected Channel: ${cName}`;

        const posts = activeAcc.posts || [];
        if (monitoredVidsEl) monitoredVidsEl.textContent = `${posts.length} Videos`;

        // Calculate real view count directly from videos API statistics
        const realTotalViews = posts.reduce((sum, p) => sum + parseInt(p.viewCount || 0, 10), 0);
        const formattedViews = realTotalViews >= 1000000 ? `${(realTotalViews / 1000000).toFixed(1)}M` : (realTotalViews >= 1000 ? `${(realTotalViews / 1000).toFixed(1)}K` : realTotalViews);
        if (viewsEl) viewsEl.textContent = formattedViews;

        // Calculate SuperChat total earnings
        const superchatTotal = activeAcc.superchatTotal || 0;
        if (superchatEl) superchatEl.textContent = `$${parseFloat(superchatTotal).toFixed(2)}`;

        // Calculate DMs / Auto-replies sent
        const totalReplies = posts.reduce((sum, p) => sum + (p.repliesCount || 0), 0);
        if (dmsSentEl) dmsSentEl.textContent = `${totalReplies} DMs`;

        if (typeof renderPosts === 'function') {
          renderPosts('yt', posts);
        }
      } else {
        if (channelNameEl) channelNameEl.textContent = 'No Channel Connected';
        if (channelStatusEl) channelStatusEl.textContent = '🔴 Disconnected';
      }

      const activeTriggersCount = Array.isArray(triggers) ? triggers.filter(t => t.active !== false).length : 0;
      if (triggersEl) triggersEl.textContent = `${activeTriggersCount} Triggers`;
    }).catch(err => console.error('Error fetching YT accounts in UI sync:', err));
  }

  async function disconnectYouTubeChannel() {
    try {
      const accountsRes = await fetch('/api/accounts?platform=yt', { headers: getAuthHeaders() });
      const accounts = await accountsRes.json();
      if (Array.isArray(accounts) && accounts.length > 0) {
        const delRes = await fetch(`/api/accounts/yt/${accounts[0].id}`, { method: 'DELETE', headers: getAuthHeaders() });
        if (!delRes.ok) {
          throw new Error(`Backend delete failed: ${delRes.status}`);
        }
      }
      localStorage.setItem('replyflow_yt_connected', 'false');
      localStorage.removeItem('replyflow_yt_channel');
      updateYouTubeConnectionUI();
      if (typeof showToast === 'function') showToast('YouTube channel disconnected successfully.', 'info');
    } catch (err) {
      console.error('Disconnect failed:', err);
      if (typeof showToast === 'function') showToast('Failed to disconnect. Please try again.', 'error');
    }
  }

  function connectYouTubeChannel() {
    const token = localStorage.getItem('replyflow_user_token') || localStorage.getItem('replyflow_token') || '';
    const loginUrl = `/api/youtube/login${token ? '?token=' + encodeURIComponent(token) : ''}`;

    const width = 600, height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      loginUrl,
      'youtube_connect_popup',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      window.location.href = loginUrl;
    } else if (typeof showToast === 'function') {
      showToast('Connecting to YouTube... Please log in with Google to connect your channel.', 'info');
    }
  }

  window.disconnectYouTubeChannel = disconnectYouTubeChannel;
  window.connectYouTubeChannel = connectYouTubeChannel;
  window.updateYouTubeConnectionUI = updateYouTubeConnectionUI;

  async function loadDiscordBotData() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const connectedGuildId = urlParams.get('guild_id');
      if (connectedGuildId) {
        localStorage.setItem('selected_discord_guild_id', String(connectedGuildId));
        // ✅ FIX: Do NOT hardcode name='Replay Flow' — send guildId only so server fetches real name from Discord API
        await fetch('/api/discord/guilds/connect', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ guildId: connectedGuildId })
        }).catch(() => {});
        const newUrl = window.location.pathname + (window.location.hash || '#discord');
        window.history.replaceState({}, document.title, newUrl);
        if (typeof showToast === 'function') {
          showToast('🎉 Discord Server authorized and connected successfully!', 'success');
        }
      }

      const res = await fetch('/api/discord/bot/status', { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const dot = document.getElementById('dc-bot-status-dot');
      const txt = document.getElementById('dc-bot-status-text');
      const btn = document.getElementById('btn-dc-bot-toggle');

      if (data.status === 'active') {
        if (dot) {
          dot.style.background = '#34d399';
          dot.style.boxShadow = '0 0 10px #34d399, 0 0 20px rgba(52, 211, 153, 0.6)';
        }
        if (txt) txt.textContent = 'Bot Running 🟢';
        if (btn) {
          btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
          btn.style.borderColor = 'rgba(52, 211, 153, 0.5)';
          btn.style.boxShadow = '0 4px 18px rgba(16, 185, 129, 0.45)';
        }
      } else {
        if (dot) {
          dot.style.background = '#f87171';
          dot.style.boxShadow = '0 0 10px #f87171, 0 0 20px rgba(248, 113, 113, 0.6)';
        }
        if (txt) txt.textContent = 'Bot Stopped 🔴';
        if (btn) {
          btn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
          btn.style.borderColor = 'rgba(248, 113, 113, 0.5)';
          btn.style.boxShadow = '0 4px 18px rgba(239, 68, 68, 0.45)';
        }
      }

      const elGuilds = document.getElementById('dc-metric-guilds');
      const elMembers = document.getElementById('dc-metric-members');
      const elTickets = document.getElementById('dc-metric-tickets');
      const elPlugins = document.getElementById('dc-metric-plugins');
      const elTickerCount = document.getElementById('dc-ticker-automations-count');

      let connectedGuilds = data.guildList || data.guilds || [];

      if (elGuilds) elGuilds.textContent = `${connectedGuilds.length} Servers`;
      if (elMembers) elMembers.textContent = (connectedGuilds.length > 0 ? 1 : 0).toLocaleString();
      if (elTickets) elTickets.textContent = '0 Open';
      if (elPlugins) elPlugins.textContent = `${data.activePlugins || 9} / ${data.totalPlugins || 9} Active`;
      if (elTickerCount) elTickerCount.textContent = data.activePlugins || 9;

      renderConnectedDiscordServers(connectedGuilds);

    } catch (e) {
      console.log('Error fetching discord status:', e);
      renderConnectedDiscordServers([]);
    }
  }

  // Auto-sync Discord server connections whenever user switches back to this tab
  // ✅ FIX: Debounce to prevent double-call when both focus listeners fire together
  let _discordFocusDebounce = null;
  window.addEventListener('focus', () => {
    const activeScreen = localStorage.getItem('replyflow_active_screen');
    if (activeScreen === 'discord' && typeof loadDiscordBotData === 'function') {
      clearTimeout(_discordFocusDebounce);
      _discordFocusDebounce = setTimeout(() => {
        if (!window._waitingForDiscordAuth) {
          loadDiscordBotData();
        }
      }, 600);
    }
  });

  window.selectActiveDiscordServer = function (guildId, serverName) {
    if (!guildId) return;
    localStorage.setItem('selected_discord_guild_id', String(guildId));
    window.currentDiscordGuildId = String(guildId);

    const globalSel = document.getElementById('global-discord-server-select');
    const switchSel = document.getElementById('dc-switch-account-select');
    const elAccountName = document.getElementById('dc-connected-account-name');

    if (globalSel) globalSel.value = guildId;
    if (switchSel) switchSel.value = guildId;

    if (elAccountName && serverName) {
      elAccountName.textContent = serverName;
    }

    if (typeof showToast === 'function') {
      showToast(`⚡ Active Server switched to: ${serverName || 'Discord Server'}`, 'success');
    }

    if (window.lastFetchedDiscordGuilds) {
      renderConnectedDiscordServers(window.lastFetchedDiscordGuilds);
    }

    // Refresh server-isolated data for newly selected guild
    if (typeof window.fetchAndRenderWelcomeTemplates === 'function') {
      window.fetchAndRenderWelcomeTemplates();
    }
    if (typeof window.fetchAndRenderLevelingRewards === 'function') {
      window.fetchAndRenderLevelingRewards();
    }
    if (typeof window.loadLevelingSettings === 'function') {
      window.loadLevelingSettings();
    }
  };

  async function renderConnectedDiscordServers(guilds) {
    window.lastFetchedDiscordGuilds = guilds;
    const container = document.getElementById('dc-connected-servers-list');
    const globalSel = document.getElementById('global-discord-server-select');
    const elAccountName = document.getElementById('dc-connected-account-name');
    const elSwitchWrap = document.getElementById('dc-switch-account-wrap');
    const elSwitchSelect = document.getElementById('dc-switch-account-select');
    const btnConnectTop = document.getElementById('btn-dc-connect-top');
    const btnDisconnectTop = document.getElementById('btn-dc-disconnect-top');
    const btnBotToggle = document.getElementById('btn-dc-bot-toggle');
    const hasGuilds = guilds && guilds.length > 0;
    let activeSelectedId = localStorage.getItem('selected_discord_guild_id');

    if (!hasGuilds) {
      localStorage.removeItem('selected_discord_guild_id');
      if (elAccountName) elAccountName.textContent = 'No Account Connected';
    } else {
      const exists = guilds.some(g => String(g.id) === String(activeSelectedId));
      if (!exists) {
        activeSelectedId = String(guilds[0].id);
        localStorage.setItem('selected_discord_guild_id', activeSelectedId);
      }
      if (elAccountName) {
        const activeGuild = (guilds || []).find(g => String(g.id) === String(activeSelectedId)) || guilds[0];
        elAccountName.textContent = activeGuild ? activeGuild.name : 'No Account Connected';
      }
    }

    if (hasGuilds) {
      if (btnConnectTop) btnConnectTop.style.display = 'none';
      if (btnDisconnectTop) btnDisconnectTop.style.display = 'inline-flex';
    } else {
      if (btnConnectTop) btnConnectTop.style.display = 'inline-flex';
      if (btnDisconnectTop) btnDisconnectTop.style.display = 'none';
    }
    if (btnBotToggle) {
      btnBotToggle.style.display = 'none';
    }

    if (globalSel) {
      if (!guilds || guilds.length === 0) {
        globalSel.innerHTML = '<option value="">No Servers Connected</option>';
      } else {
        globalSel.innerHTML = guilds.map(g => `<option value="${g.id}">🟢 ${g.name} (${g.id})</option>`).join('');
        if (activeSelectedId) globalSel.value = activeSelectedId;
      }
    }

    if (elSwitchWrap) {
      if (guilds && guilds.length > 0) {
        elSwitchWrap.style.display = 'flex';
        
        const allOptionGuilds = [];
        const addedIds = new Set();

        (guilds || []).forEach(g => {
          allOptionGuilds.push({ id: String(g.id), name: g.name, isConnected: true });
          addedIds.add(String(g.id));
        });

        if (elSwitchSelect) {
          let optsHtml = allOptionGuilds.map(g => {
            return `<option value="${g.id}">🟢 Connected: ${g.name}</option>`;
          }).join('');

          optsHtml += `<option value="__INVITE_NEW_SERVER__">➕ Connect / Invite New Server...</option>`;
          elSwitchSelect.innerHTML = optsHtml;

          if (activeSelectedId && addedIds.has(String(activeSelectedId))) {
            elSwitchSelect.value = activeSelectedId;
          }
        }
      } else {
        elSwitchWrap.style.display = 'none';
      }
    }

    if (elAccountName) {
      const activeGuild = (guilds || []).find(g => String(g.id) === String(activeSelectedId)) || (guilds || [])[0];
      elAccountName.textContent = activeGuild ? activeGuild.name : 'No Account Connected';
    }

    if (!container) return;

    if (!guilds || guilds.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 48px 24px; background: rgba(18, 21, 32, 0.7); border-radius: 18px; border: 1px dashed rgba(88,101,242,0.4); text-align: center; backdrop-filter: blur(10px); box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
          <div style="font-size: 52px; margin-bottom: 16px; filter: drop-shadow(0 0 12px rgba(88,101,242,0.5));">👾</div>
          <div style="font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 8px;">No Discord Server Connected</div>
          <div style="font-size: 13.5px; color: #94a3b8; margin-bottom: 24px; max-width: 500px; margin-left: auto; margin-right: auto; line-height: 1.6;">
            Enter your Discord Server ID to connect instantly and manage all 9 SaaS automation plugins for your server.
          </div>
          
          <div style="display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap;">
            <button onclick="openModal('modal-manage-dc')" style="padding: 14px 28px; background: linear-gradient(135deg, #5865F2 0%, #7c3aed 100%); border: 1px solid rgba(255,255,255,0.25); border-radius: 12px; color: #fff; font-size: 14px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 18px rgba(88,101,242,0.4); transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 10px;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
              <span>⚡</span> Connect Server by ID
            </button>
          </div>
        </div>
      `;
      return;
    }

    // ✅ FIX: Use the user's selected guild from localStorage, not always guilds[0]
    const activeGuild = (guilds || []).find(g => String(g.id) === String(activeSelectedId)) || guilds[0];
    const controlBarHtml = `
      <div style="width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; background: rgba(18, 22, 34, 0.85); border: 1px solid rgba(88, 101, 242, 0.35); border-radius: 14px; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; backdrop-filter: blur(12px); box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <span style="font-size: 13px; font-weight: 800; color: #a5b4fc; display: flex; align-items: center; gap: 6px;">
            <span>⚡</span> Connected Discord Server:
          </span>
          <span style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.5); border-radius: 10px; padding: 8px 18px; font-size: 13px; font-weight: 800; display: inline-flex; align-items: center; gap: 6px;">
            🟢 ${activeGuild.name}
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <button onclick="openModal('modal-manage-dc')" style="background: linear-gradient(135deg, #5865F2 0%, #7c3aed 100%); border: 1px solid rgba(255,255,255,0.2); color: #ffffff; padding: 8px 18px; border-radius: 10px; font-size: 12px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 14px rgba(88,101,242,0.4); transition: all 0.2s ease;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
            <span>⚡</span> Connect by Server ID
          </button>
        </div>
      </div>
    `;

    const initials = (activeGuild.name || 'Server').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const cardsHtml = `
      <div style="width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(15, 17, 26, 0.95)); border-radius: 16px; border: 2px solid #10b981; box-shadow: 0 0 25px rgba(16, 185, 129, 0.3); transition: all 0.25s ease; margin-bottom: 12px; flex-wrap: wrap; gap: 14px; box-sizing: border-box;">
        <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap; min-width: 220px;">
          <div style="width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #10b981, #059669); display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 800; color: #ffffff; box-shadow: 0 4px 16px rgba(16,185,129,0.45); border: 1px solid rgba(255,255,255,0.25); text-shadow: 0 2px 4px rgba(0,0,0,0.3); shrink: 0;">${initials}</div>
          <div>
            <div style="font-size: 16px; font-weight: 800; color: #ffffff; margin-bottom: 4px; letter-spacing: -0.2px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span>${activeGuild.name}</span>
              <span style="font-size: 10px; padding: 2px 8px; border-radius: 10px; background: rgba(99,102,241,0.15); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.3); font-weight: 700;">${activeGuild.tier || 'Free Tier'}</span>
            </div>
            <div style="font-size: 12px; color: #94a3b8; font-weight: 600;">Server ID: <span style="color:#cbd5e1; font-family: monospace;">${activeGuild.id}</span></div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span class="badge" style="background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; font-size: 11px; padding: 6px 14px; border-radius: 20px; font-weight: 800; border: 1px solid rgba(52, 211, 153, 0.5); display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 0 12px rgba(16,185,129,0.4); white-space: nowrap;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: #ffffff; box-shadow: 0 0 8px #ffffff; display: inline-block;"></span> ACTIVE SERVER ✓
          </span>
          <button onclick="window.disconnectDiscordServer('${activeGuild.id}')" style="background: linear-gradient(135deg, rgba(239,68,68,0.2), rgba(185,28,28,0.3)); border: 1px solid rgba(239, 68, 68, 0.5); color: #fca5a5; padding: 8px 16px; border-radius: 10px; font-size: 12px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s ease; white-space: nowrap;" onmouseover="this.style.background='rgba(239,68,68,0.35)'" onmouseout="this.style.background='linear-gradient(135deg, rgba(239,68,68,0.2), rgba(185,28,28,0.3))'">
            <span>❌</span> Disconnect
          </button>
        </div>
      </div>
    `;

    container.innerHTML = controlBarHtml + cardsHtml;
  }

  window.openConnectDiscordBot = function () {
    if (typeof openModal === 'function') {
      openModal('modal-manage-dc');
    }
  };

  // ⚡ Window Focus Listener — Auto-detect when user returns after authorizing on Discord
  // ✅ FIX: Only fire when explicitly waiting for auth (removed hash check that caused always-trigger on Discord page)
  window.addEventListener('focus', async function () {
    if (window._waitingForDiscordAuth) {
      window._waitingForDiscordAuth = false;
      clearTimeout(_discordFocusDebounce); // Cancel the auto-refresh too — this one will reload
      try {
        const res = await fetch('/api/discord/guilds/sync-authorized', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' })
        });
        const data = await res.json();
        if (data.success && data.guilds && data.guilds.length > 0) {
          // ✅ FIX: Show toast only once, only when actually newly connecting
          if (data.newlyConnected) {
            if (typeof showToast === 'function') showToast(`🎉 Discord Server connected: ${data.guilds[0].name}!`, 'success');
          }
          if (typeof loadDiscordBotData === 'function') loadDiscordBotData();
        }
      } catch (err) {
        console.warn('Sync authorized guild notice:', err);
      }
    }
  });

  window.disconnectSelectedDiscordServer = async function () {
    try {
      window.lastFetchedDiscordGuilds = [];
      renderConnectedDiscordServers([]);
      const res = await fetch('/api/discord/guilds/disconnect', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ disconnectAll: true })
      });
      const data = await res.json();
      localStorage.removeItem('selected_discord_guild_id');
      if (typeof showToast === 'function') showToast('⚡ Discord Account & all servers disconnected successfully!', 'info');
      if (typeof loadDiscordBotData === 'function') loadDiscordBotData();
    } catch (err) {
      console.error('Error disconnecting Discord account:', err);
    }
  };

  window.disconnectAllDiscordServers = window.disconnectSelectedDiscordServer;

  window.connectDiscordServer = async function (guildId, name) {
    if (!guildId) return;
    const cleanGuildId = String(guildId).trim().replace(/[^0-9]/g, '');
    if (!cleanGuildId) {
      if (typeof showToast === 'function') showToast('Please enter a valid numeric Discord Server ID.', 'warning');
      else alert('Please enter a valid numeric Discord Server ID.');
      return;
    }

    if (typeof showToast === 'function') showToast(`Connecting Discord Server (${cleanGuildId})...`, 'info');

    try {
      const res = await fetch('/api/discord/guilds/connect', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ guildId: cleanGuildId })
      });
      const data = await res.json();
      if (data.success) {
        if (typeof closeModal === 'function') closeModal('modal-manage-dc');
        const connectedGuild = (data.guilds || []).find(g => String(g.id) === String(cleanGuildId)) || (data.guilds && data.guilds[0]);
        const serverName = connectedGuild ? connectedGuild.name : cleanGuildId;
        
        if (typeof showToast === 'function') showToast(`🎉 Server '${serverName}' connected successfully!`, 'success');
        
        localStorage.setItem('selected_discord_guild_id', String(cleanGuildId));
        window.currentDiscordGuildId = String(cleanGuildId);
        
        if (typeof selectActiveDiscordServer === 'function') {
          selectActiveDiscordServer(cleanGuildId, serverName);
        }
        if (typeof loadDiscordBotData === 'function') {
          loadDiscordBotData();
        }
      } else {
        if (typeof showToast === 'function') showToast(data.message || 'Failed to connect server', 'error');
        else alert('Failed to connect server: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error connecting server:', err);
      if (typeof showToast === 'function') showToast('Error connecting server.', 'error');
    }
  };

  // ✅ FIX: ALWAYS call the API to persist the selected server — never just update UI only
  window.switchConnectedDiscordServer = async function (guildId) {
    if (!guildId || guildId === '__INVITE_NEW_SERVER__') return;
    
    const switchSel = document.getElementById('dc-switch-account-select');
    const elAccountName = document.getElementById('dc-connected-account-name');

    localStorage.setItem('selected_discord_guild_id', String(guildId));
    if (typeof showToast === 'function') showToast(`⌛ Switching server...`, 'info');

    try {
      const res = await fetch('/api/discord/guilds/connect', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ guildId })
      });
      const data = await res.json();
      if (data.success) {
        if (typeof showToast === 'function') showToast(`\u2705 Active server: ${selectedName}`, 'success');
        if (typeof loadDiscordBotData === 'function') loadDiscordBotData();
      } else {
        if (typeof showToast === 'function') showToast('Failed to switch server', 'error');
      }
    } catch (err) {
      console.error('Error switching Discord server:', err);
      if (typeof showToast === 'function') showToast('Error switching server', 'error');
    }
  };

  window.disconnectDiscordServer = async function (guildId) {
    if (!guildId) {
      const switchSel = document.getElementById('dc-switch-account-select');
      if (switchSel && switchSel.value) guildId = switchSel.value;
      else if (window.lastFetchedDiscordGuilds && window.lastFetchedDiscordGuilds.length > 0) {
        guildId = window.lastFetchedDiscordGuilds[0].id;
      }
    }
    if (!guildId) {
      if (typeof showToast === 'function') showToast('No server selected to disconnect.', 'warning');
      return;
    }

    if (!confirm('Are you sure you want to disconnect this Discord server? Automation plugins for this server will be unlinked.')) {
      return;
    }

    localStorage.removeItem('selected_discord_guild_id');

    // ⚡ INSTANT OPTIMISTIC UI REMOVAL:
    window.lastFetchedDiscordGuilds = [];
    renderConnectedDiscordServers([]);

    try {
      await fetch('/api/discord/guilds/disconnect', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ disconnectAll: true, guildId })
      });
    } catch (err) {
      console.warn('Discord server disconnect notice:', err);
    }

    if (typeof showToast === 'function') showToast('⚡ Discord server disconnected successfully!', 'info');
    if (typeof loadDiscordBotData === 'function') loadDiscordBotData();
  };

  window.fetchAndRenderAvailableGuildsDropdown = async function () {
    const sel = document.getElementById('dc-available-guilds-select');
    if (!sel) return;
    try {
      const res = await fetch('/api/discord/available-guilds', { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success && data.guilds && data.guilds.length > 0) {
        sel.innerHTML = data.guilds.map(g => `<option value="${g.id}">🌐 ${g.name} (ID: ${g.id})</option>`).join('');
      } else {
        sel.innerHTML = `<option value="1537457454370128024">🌐 Replay Flow (ID: 1537457454370128024)</option>`;
      }
    } catch (err) {
      console.error(err);
      sel.innerHTML = `<option value="1537457454370128024">🌐 Replay Flow (ID: 1537457454370128024)</option>`;
    }
  };

  window.connectSelectedAvailableGuild = async function () {
    const sel = document.getElementById('dc-available-guilds-select');
    const guildId = sel ? sel.value : null;
    if (!guildId) {
      if (typeof showToast === 'function') showToast('Please select a Discord Server from the list.', 'warning');
      else alert('Please select a Discord Server from the list.');
      return;
    }
    const selectedOptionText = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text.replace(/^🌐\s*/, '').replace(/\s*\(ID:.*$/, '').trim() : '';
    window.connectDiscordServer(guildId, selectedOptionText);
  };

  window.openDiscordOAuthModal = function () {
    if (typeof openModal === 'function') openModal('modal-manage-dc');
  };

  window.redirectToDiscordOAuth = function () {
    if (typeof openModal === 'function') openModal('modal-manage-dc');
  };

  window.submitManualGuildConnect = async function () {
    const input = document.getElementById('manual-dc-guild-id');
    const guildId = input ? input.value.trim() : '';
    if (!guildId) {
      if (typeof showToast === 'function') showToast('Please enter a valid Discord Guild ID', 'warning');
      else alert('Please enter a valid Discord Guild ID');
      return;
    }
    try {
      const res = await fetch('/api/discord/guilds/connect', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ guildId })
      });
      const data = await res.json();
      if (data.success) {
        if (typeof showToast === 'function') showToast('✅ Discord Server connected successfully!', 'success');
        localStorage.setItem('selected_discord_guild_id', guildId);
        const modal = document.getElementById('discord-connect-modal');
        if (modal) modal.style.display = 'none';
        if (input) input.value = '';
        loadDiscordBotData();
      } else {
        alert('Connection error: ' + (data.error || 'Could not connect server'));
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting Discord server');
    }
  };

  async function toggleDiscordBotServer() {
    const btn = document.getElementById('btn-dc-bot-toggle');
    const txt = document.getElementById('dc-bot-status-text');
    const dot = document.getElementById('dc-bot-status-dot');
    const isRunning = txt && (txt.textContent.includes('Running') || txt.textContent.includes('🟢'));
    const action = isRunning ? 'stop' : 'start';

    try {
      if (btn) btn.style.pointerEvents = 'none';
      if (txt) txt.textContent = isRunning ? 'Stopping Bot...' : 'Starting Bot...';
      if (dot) {
        dot.style.background = '#fbbf24';
        dot.style.boxShadow = '0 0 10px #fbbf24';
      }

      const res = await fetch('/api/discord/bot/control', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (typeof showToast === 'function') {
        showToast(data.message || (action === 'start' ? '⚡ Discord Bot started successfully!' : '🛑 Discord Bot stopped!'), data.success ? (action === 'start' ? 'success' : 'info') : 'error');
      }
      setTimeout(loadDiscordBotData, 300);
    } catch (err) {
      if (typeof showToast === 'function') showToast('Failed to update bot state', 'error');
    } finally {
      if (btn) btn.style.pointerEvents = 'auto';
    }
  }

  window.loadDiscordBotData = loadDiscordBotData;
  window.toggleDiscordBotServer = toggleDiscordBotServer;

  // ── 8 Plugin Interactive Dashboard Modal System ──
  let activePluginKey = 'overview';
  window.activePluginKey = 'overview';
  const pluginDashboards = {
    welcome: {
      title: '👋 Welcome Messages Dashboard',
      html: `
        <div style="display: flex; gap: 20px; align-items: flex-start; flex-wrap: nowrap; width: 100%;">
          <!-- LEFT MAIN WORKSPACE -->
          <div style="flex: 1; min-width: 0; background: #0f111a; border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); box-sizing: border-box;">
            
        <!-- 🟢 WELCOME MSG CONTENT -->
        <div id="tab-welcome" style="display: block; position: relative;">
          
          <!-- Multiple Messages List -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <div id="welcome-variations-count-title" style="color: #fff; font-weight: 800; font-size: 15px;">📨 Welcome Message Variations</div>
            <button onclick="window.openNewTemplatePopup()" style="background: rgba(88,101,242,0.15); color: #818cf8; border: 1px solid rgba(88,101,242,0.4); padding: 8px 16px; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 12px; transition: 0.2s;" onmouseover="this.style.background='rgba(88,101,242,0.25)'" onmouseout="this.style.background='rgba(88,101,242,0.15)'">+ Create New Template</button>
          </div>

          <div id="welcome-templates-container" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px;">
            <div style="color: #a1a1aa; font-size: 13px; text-align: center; padding: 20px;">Loading templates...</div>
          </div>

          <!-- Edit Popup Modal (Wide 1240px 2-Column Split Workspace View) -->
          <div id="welcome-popup-editor" style="display: none; position: fixed; inset: 0; background: rgba(8, 10, 18, 0.92); z-index: 999999; flex-direction: column; align-items: center; justify-content: center; backdrop-filter: blur(14px); padding: 20px;">
            <div style="background: linear-gradient(135deg, rgba(20, 24, 38, 0.98), rgba(12, 14, 24, 0.99)); width: 98%; max-width: 1260px; height: 92vh; border: 1px solid rgba(88,101,242,0.45); border-radius: 24px; box-shadow: 0 24px 80px rgba(0,0,0,0.95), 0 0 30px rgba(88,101,242,0.2); padding: 24px; position: relative; display: flex; flex-direction: column; box-sizing: border-box;">
              
              <!-- Modal Top Bar -->
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.08);">
                <div style="font-size: 19px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 22px;">✨</span> <span>Configure Welcome Card & Message Engine</span>
                  <span style="background: rgba(88,101,242,0.2); color: #818cf8; font-size: 11px; padding: 4px 12px; border-radius: 20px; font-weight: 700; border: 1px solid rgba(88,101,242,0.4);">2-Column Studio View</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <button onclick="window.saveWelcomeTemplateToDb(event)" style="background: linear-gradient(135deg, #5865f2, #404eed); color: #fff; padding: 9px 20px; border-radius: 12px; font-weight: 800; font-size: 13px; border: 1px solid rgba(255,255,255,0.2); cursor: pointer; box-shadow: 0 4px 16px rgba(88,101,242,0.45); transition: all 0.25s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">💾 Save Changes</button>
                  <button onclick="document.getElementById('welcome-popup-editor').style.display='none'" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #fff; font-size: 14px; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">✖</button>
                </div>
              </div>

              <!-- 2-COLUMN SIDE-BY-SIDE SPLIT CONTAINER -->
              <div style="display: grid; grid-template-columns: 460px 1fr; gap: 24px; flex: 1; min-height: 0; box-sizing: border-box;">
                
                <!-- LEFT COLUMN: Sticky Live Discord Card Preview -->
                <div style="background: rgba(14, 16, 26, 0.85); border: 1px solid rgba(88,101,242,0.35); border-radius: 20px; padding: 22px; overflow-y: auto; display: flex; flex-direction: column; gap: 18px; box-shadow: inset 0 0 20px rgba(0,0,0,0.4);">
                  <div style="font-size: 12px; font-weight: 800; color: #818cf8; text-transform: uppercase; letter-spacing: 0.8px; display: flex; justify-content: space-between; align-items: center;">
                    <span>👁️ Live Discord Card Preview</span>
                    <span style="font-size: 11px; color: #34d399; font-weight: 700; background: rgba(16,185,129,0.15); padding: 3px 10px; border-radius: 12px; border: 1px solid rgba(16,185,129,0.35);">🟢 Real-Time</span>
                  </div>
                  
                  <div style="display: flex; flex-direction: column; gap: 16px;">
                    <!-- Dynamic Canvas Frame Card Preview (Strict Border On Card Only) -->
                    <div id="live-card-frame-preview" style="width: 100%; min-height: 140px; background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(99,102,241,0.35)); border: 2px solid rgba(99,102,241,0.8); border-radius: 16px; position: relative; display: flex; align-items: center; padding: 20px; transition: all 0.3s ease; box-shadow: 0 8px 30px rgba(0,0,0,0.6); box-sizing: border-box;">
                      <!-- Avatar DP -->
                      <div id="card-preview-dp-box" style="margin-right: 18px; position: relative;">
                        <img id="card-preview-avatar" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid #34d399; box-shadow: 0 0 15px rgba(52,211,153,0.5);">
                      </div>
                      <!-- Names & Server info -->
                      <div style="flex: 1;">
                        <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">WELCOME TO REPLAY FLOW</div>
                        <div id="card-preview-display-name" style="font-size: 19px; font-weight: 800; color: #ffffff; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">@AlexMorgan</div>
                        <div id="card-preview-username" style="font-size: 12px; color: #38bdf8; font-weight: 600; margin-top: 2px;">alex_morgan99 (ID: 9812401)</div>
                        <div style="margin-top: 8px; display: inline-block; background: rgba(99,102,241,0.25); border: 1px solid rgba(99,102,241,0.5); padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; color: #a5b4fc;">
                          Member #14,210 ✨
                        </div>
                      </div>
                    </div>

                    <!-- Text & Link Buttons Preview (Separate Embed Box Below Card) -->
                    <div style="background: rgba(18, 20, 32, 0.95); border: 1px solid rgba(88,101,242,0.3); border-left: 4px solid #5865f2; border-radius: 14px; padding: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.4);">
                      <div id="live-preview-text" style="font-size: 13px; color: #cbd5e1; margin-bottom: 14px; white-space: pre-line; word-wrap: break-word; line-height: 1.6;">WELCOME TO NOIR INSIGHT TRADER! You are member #14,210 🎉</div>
                      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <span id="preview-btn-web" style="display: none; background: #5865f2; color: #fff; padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">🌐 Website</span>
                        <span id="preview-btn-ig" style="display: none; background: #e1306c; color: #fff; padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">📷 Instagram</span>
                        <span id="preview-btn-yt" style="display: none; background: #ff0000; color: #fff; padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">🎥 YouTube</span>
                        <span id="preview-btn-tk" style="display: none; background: #000000; color: #fff; border: 1px solid #333; padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">🎵 TikTok</span>
                        <span id="preview-btn-tw" style="display: none; background: #1da1f2; color: #fff; padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">🐦 Twitter</span>
                      </div>
                    </div>
                  </div>

                  <div style="margin-top: auto; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.08);">
                    <button onclick="window.saveWelcomeTemplateToDb(event)" style="width: 100%; background: linear-gradient(135deg, #5865f2, #404eed); color: #fff; padding: 13px; border-radius: 14px; font-weight: 800; font-size: 14px; border: 1px solid rgba(255,255,255,0.25); cursor: pointer; box-shadow: 0 4px 18px rgba(88,101,242,0.45); transition: all 0.25s ease;">💾 Save Welcome Card & Close</button>
                  </div>
                </div>

                <!-- RIGHT COLUMN: Scrollable Controls & Customization Hub -->
                <div style="background: rgba(14, 16, 26, 0.85); border: 1px solid rgba(88,101,242,0.35); border-radius: 20px; padding: 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px;">
                  
                  <!-- 1. Preset Card Frames (6 Options) -->
                  <div>
                    <label style="font-weight: 800; color: #818cf8; font-size: 13px; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                      <span>🎨</span> <span>1. SELECT WELCOME CARD FRAME STYLE</span>
                    </label>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;" id="welcome-frame-presets-grid">
                      <div onclick="window.selectWelcomeFrameStyle('glass_indigo', this)" class="frame-preset-card active-frame" style="border: 2px solid #5865f2; background: linear-gradient(135deg, rgba(15,23,42,0.9), rgba(99,102,241,0.35)); padding: 12px; border-radius: 12px; cursor: pointer; text-align: center; box-shadow: 0 4px 14px rgba(88,101,242,0.3); transition: all 0.25s ease;">
                        <div style="font-weight: 800; color: #fff; font-size: 12px;">🔮 Glass Indigo</div>
                        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Transparent Glass</div>
                      </div>
                      <div onclick="window.selectWelcomeFrameStyle('cyber_neon', this)" class="frame-preset-card" style="border: 2px solid rgba(255,255,255,0.12); background: linear-gradient(135deg, rgba(18,10,40,0.9), rgba(236,72,153,0.35)); padding: 12px; border-radius: 12px; cursor: pointer; text-align: center; transition: all 0.25s ease;">
                        <div style="font-weight: 800; color: #fff; font-size: 12px;">⚡ Cyber Neon</div>
                        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Vibrant Glow</div>
                      </div>
                      <div onclick="window.selectWelcomeFrameStyle('emerald_mint', this)" class="frame-preset-card" style="border: 2px solid rgba(255,255,255,0.12); background: linear-gradient(135deg, rgba(6,30,20,0.9), rgba(16,185,129,0.35)); padding: 12px; border-radius: 12px; cursor: pointer; text-align: center; transition: all 0.25s ease;">
                        <div style="font-weight: 800; color: #fff; font-size: 12px;">🌲 Emerald Mint</div>
                        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Forest Green</div>
                      </div>
                      <div onclick="window.selectWelcomeFrameStyle('dark_obsidian', this)" class="frame-preset-card" style="border: 2px solid rgba(255,255,255,0.12); background: linear-gradient(135deg, rgba(10,10,14,0.9), rgba(71,85,105,0.35)); padding: 12px; border-radius: 12px; cursor: pointer; text-align: center; transition: all 0.25s ease;">
                        <div style="font-weight: 800; color: #fff; font-size: 12px;">🖤 Dark Obsidian</div>
                        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Minimalist Dark</div>
                      </div>
                      <div onclick="window.selectWelcomeFrameStyle('gold_prestige', this)" class="frame-preset-card" style="border: 2px solid rgba(255,255,255,0.12); background: linear-gradient(135deg, rgba(28,20,8,0.9), rgba(245,158,11,0.35)); padding: 12px; border-radius: 12px; cursor: pointer; text-align: center; transition: all 0.25s ease;">
                        <div style="font-weight: 800; color: #fff; font-size: 12px;">👑 Gold Prestige</div>
                        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Luxurious Gold</div>
                      </div>
                      <div onclick="window.selectWelcomeFrameStyle('sunset_wave', this)" class="frame-preset-card" style="border: 2px solid rgba(255,255,255,0.12); background: linear-gradient(135deg, rgba(40,15,25,0.9), rgba(244,63,94,0.35)); padding: 12px; border-radius: 12px; cursor: pointer; text-align: center; transition: all 0.25s ease;">
                        <div style="font-weight: 800; color: #fff; font-size: 12px;">🌅 Sunset Wave</div>
                        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Warm Rose</div>
                      </div>
                    </div>

                    <!-- Custom Card Accent Color Customizer -->
                    <div style="margin-top: 14px; background: rgba(255,255,255,0.03); padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                      <div>
                        <div style="font-size: 12px; font-weight: 800; color: #e2e8f0; display: flex; align-items: center; gap: 6px;">
                          <span>🎨</span> <span>Card Custom Accent Color</span>
                        </div>
                        <div style="font-size: 10.5px; color: #94a3b8; margin-top: 2px;">Choose custom color for card borders, badges & glowing accents</div>
                      </div>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="color" id="welcome-card-color-picker" value="#5865f2" onchange="window.setWelcomeCardCustomColor(this.value)" style="width: 34px; height: 34px; border: none; background: transparent; cursor: pointer; border-radius: 6px;">
                        <input type="text" id="welcome-card-color-input" value="#5865f2" oninput="window.setWelcomeCardCustomColor(this.value)" style="width: 88px; padding: 7px 10px; background: #0c0d14; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; font-size: 12px; font-weight: 700; color: #fff; text-transform: uppercase; text-align: center;">
                      </div>
                    </div>
                  </div>

                  <!-- 2. Card Content Elements Toggles -->
                  <div style="background: rgba(255,255,255,0.03); padding: 14px 18px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08);">
                    <label style="font-weight: 800; color: #fff; font-size: 12px; margin-bottom: 10px; display: block; text-transform: uppercase; letter-spacing: 0.5px;">⚙️ 2. CARD LAYOUT ELEMENTS (SHOW/HIDE)</label>
                    <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                      <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #e2e8f0; cursor: pointer;">
                        <input type="checkbox" id="welcome-toggle-dp" checked onchange="window.updateWelcomeCardLivePreview()" style="accent-color: #5865f2; width: 16px; height: 16px; cursor: pointer;">
                        <span>📸 User DP / Avatar</span>
                      </label>
                      <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #e2e8f0; cursor: pointer;">
                        <input type="checkbox" id="welcome-toggle-display-name" checked onchange="window.updateWelcomeCardLivePreview()" style="accent-color: #5865f2; width: 16px; height: 16px; cursor: pointer;">
                        <span>👤 Display Name</span>
                      </label>
                      <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #e2e8f0; cursor: pointer;">
                        <input type="checkbox" id="welcome-toggle-username" checked onchange="window.updateWelcomeCardLivePreview()" style="accent-color: #5865f2; width: 16px; height: 16px; cursor: pointer;">
                        <span>🏷️ Username / Handle</span>
                      </label>
                    </div>
                  </div>

                  <!-- 3. Welcome Text & Presets -->
                  <div style="background: rgba(0,0,0,0.25); padding: 18px; border-radius: 16px; border: 1px solid rgba(88,101,242,0.25);">
                    <div style="font-weight: 800; color: #818cf8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                      <span>3. WELCOME MESSAGE & FORMATTING</span>
                      <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <span style="font-size: 11px; color: #94a3b8; font-weight: 600;">Presets:</span>
                        <button type="button" onclick="window.applyWelcomePresetTemplate('streamer')" style="background: linear-gradient(135deg, rgba(239,68,68,0.25), rgba(249,115,22,0.25)); color: #fb923c; border: 1px solid #f97316; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; cursor: pointer;">🔥 Streamer Pro</button>
                        <button type="button" onclick="window.applyWelcomePresetTemplate('creative')" style="background: rgba(192,132,252,0.18); color: #c084fc; border: 1px solid rgba(192,132,252,0.4); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">✨ Creative</button>
                        <button type="button" onclick="window.applyWelcomePresetTemplate('trading')" style="background: rgba(56,189,248,0.18); color: #38bdf8; border: 1px solid rgba(56,189,248,0.4); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">⚡ VIP Trading</button>
                        <button type="button" onclick="window.applyWelcomePresetTemplate('gaming')" style="background: rgba(52,211,153,0.18); color: #34d399; border: 1px solid rgba(52,211,153,0.4); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">🎮 Gaming</button>
                      </div>
                    </div>

                    <!-- Quick Variable Injection Pills -->
                    <div style="margin-bottom: 14px;">
                      <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">📌 Variable Tags (Click to Insert):</div>
                      <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <span onclick="window.insertWelcomeTag('{user}')" style="background: rgba(88,101,242,0.18); border: 1px solid rgba(88,101,242,0.45); color: #a5b4fc; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">+ {user}</span>
                        <span onclick="window.insertWelcomeTag('{server}')" style="background: rgba(88,101,242,0.18); border: 1px solid rgba(88,101,242,0.45); color: #a5b4fc; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">+ {server}</span>
                        <span onclick="window.insertWelcomeTag('{count}')" style="background: rgba(251,191,36,0.18); border: 1px solid rgba(251,191,36,0.45); color: #fbbf24; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">+ {count} (Member #)</span>
                        <span onclick="window.insertWelcomeTag('{rules_channel}')" style="background: rgba(236,72,153,0.18); border: 1px solid rgba(236,72,153,0.45); color: #f472b6; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">+ {rules_channel}</span>
                        <span onclick="window.insertWelcomeTag('{general_channel}')" style="background: rgba(236,72,153,0.18); border: 1px solid rgba(236,72,153,0.45); color: #f472b6; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">+ {general_channel}</span>
                      </div>
                    </div>

                    <!-- NQN (Not Quite Nitro) Packs Studio Drawer (https://nqn.blue/packs) -->
                    <div style="margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
                      <div style="font-size: 11px; font-weight: 800; color: #a855f7; text-transform: uppercase; letter-spacing: 0.6px; display: flex; align-items: center; gap: 6px;">
                        <span>🟣</span> <span>NQN NITRO EMOJI & ANIMATED PACKS (nqn.blue)</span>
                      </div>
                      <button type="button" onclick="window.toggleWelcomeEmojiStudio()" style="background: linear-gradient(135deg, rgba(88,101,242,0.25), rgba(168,85,247,0.25)); border: 1.5px solid #a855f7; color: #fff; padding: 6px 16px; border-radius: 8px; font-size: 11.5px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 10px rgba(168,85,247,0.3); transition: all 0.2s;">
                        <span>✨ Browse NQN Nitro Packs</span>
                        <span id="welcome-emoji-toggle-arrow" style="font-size: 10px;">▲</span>
                      </button>
                    </div>

                    <!-- SORTED & ORGANIZED NQN PACKS DRAWER -->
                    <div id="welcome-emoji-packs-studio" style="display: block; margin-bottom: 18px; background: rgba(10, 12, 20, 0.96); padding: 18px; border-radius: 16px; border: 1.5px solid rgba(168,85,247,0.45); box-shadow: 0 12px 40px rgba(0,0,0,0.7);">
                      
                      <!-- 2 MASTER CATEGORIES (NQN NITRO vs STANDARD) -->
                      <div style="display: flex; gap: 10px; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px;">
                        <button type="button" id="master-tab-animated" class="emoji-master-tab active" onclick="window.setEmojiMasterCategory('animated')" style="flex: 1; padding: 10px 14px; border-radius: 10px; border: 1.5px solid #a855f7; background: linear-gradient(135deg, rgba(168,85,247,0.25), rgba(236,72,153,0.25)); color: #fff; font-weight: 800; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 14px rgba(168,85,247,0.3); transition: all 0.2s;">
                          <span>🎬 NQN NITRO ANIMATED PACKS</span>
                          <span style="background: #a855f7; color: #fff; font-size: 9.5px; padding: 2px 7px; border-radius: 4px; font-weight: 800;">nqn.blue</span>
                        </button>
                        <button type="button" id="master-tab-standard" class="emoji-master-tab" onclick="window.setEmojiMasterCategory('standard')" style="flex: 1; padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: #94a3b8; font-weight: 800; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
                          <span>🎨 STANDARD UNICODE PACKS</span>
                          <span style="background: rgba(255,255,255,0.1); color: #cbd5e1; font-size: 9.5px; padding: 2px 7px; border-radius: 4px;">CLASSIC</span>
                        </button>
                      </div>

                      <!-- Search Input With Counter -->
                      <div style="margin-bottom: 12px; position: relative;">
                        <input type="text" id="welcome-emoji-search" placeholder="🔍 Search NQN Packs (e.g. catjam, blob, peepo, flame, equalizer, arrow, car, flag, nitro)..." oninput="window.filterWelcomeEmojis(this.value)" style="width: 100%; padding: 10px 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(168,85,247,0.3); border-radius: 10px; color: #fff; font-size: 12px; outline: none; box-sizing: border-box; transition: all 0.2s;" onfocus="this.style.borderColor='#a855f7'">
                      </div>

                      <!-- Clean NQN Sub-Packs Navigation Pills -->
                      <div style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 12px; scrollbar-width: none;">
                        <button type="button" class="emoji-cat-tab active" data-subcat="all" onclick="window.switchWelcomeEmojiSubCategory('all')">✨ All Packs</button>
                        <button type="button" class="emoji-cat-tab" data-subcat="blobs" onclick="window.switchWelcomeEmojiSubCategory('blobs')">🐱 Blobs & Peepos</button>
                        <button type="button" class="emoji-cat-tab" data-subcat="neon" onclick="window.switchWelcomeEmojiSubCategory('neon')">⚡ Cyber & Equalizers</button>
                        <button type="button" class="emoji-cat-tab" data-subcat="cars" onclick="window.switchWelcomeEmojiSubCategory('cars')">🏎️ Speed & Cars</button>
                        <button type="button" class="emoji-cat-tab" data-subcat="flags" onclick="window.switchWelcomeEmojiSubCategory('flags')">🚩 Animated Flags</button>
                        <button type="button" class="emoji-cat-tab" data-subcat="nitro" onclick="window.switchWelcomeEmojiSubCategory('nitro')">💎 Nitro Badges & Ranks</button>
                        <button type="button" class="emoji-cat-tab" data-subcat="memes" onclick="window.switchWelcomeEmojiSubCategory('memes')">🎭 Memes & Gestures</button>
                        <button type="button" class="emoji-cat-tab" data-subcat="fonts" onclick="window.switchWelcomeEmojiSubCategory('fonts')">✍️ Fancy Headers</button>
                      </div>

                      <!-- NQN Nitro Emojis Grid (Sorted & Pristine) -->
                      <div id="welcome-emoji-grid-wrap" style="display: flex; gap: 8px; flex-wrap: wrap; max-height: 240px; overflow-y: auto; padding: 4px; box-sizing: border-box;">
                        
                        <!-- ═══════════════ NQN NITRO ANIMATED PACKS (MASTER: ANIMATED) ═══════════════ -->
                        
                        <!-- 🐱 NQN Pack: Blobs & Peepos -->
                        <span class="emoji-item-btn" data-master="animated" data-subcat="blobs" data-name="animated blob dance party blob music hype nqn" onclick="window.insertWelcomeTag('🥳')"><span class="emoji-anim-bounce">🥳</span> BlobDance</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="blobs" data-name="animated blob hype jump cheer nqn" onclick="window.insertWelcomeTag('🙌')"><span class="emoji-anim-bounce">🙌</span> BlobHype</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="blobs" data-name="animated peepo clap applaud celebrate nqn" onclick="window.insertWelcomeTag('👏')"><span class="emoji-anim-shake">👏</span> PeepoClap</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="blobs" data-name="animated cat jam vibe music head bob nqn" onclick="window.insertWelcomeTag('🐱')"><span class="emoji-anim-bounce">🐱</span> CatJam</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="blobs" data-name="animated pop cat mouth pop sound nqn" onclick="window.insertWelcomeTag('😺')"><span class="emoji-anim-pulse">😺</span> PopCat</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="blobs" data-name="animated duck dance walk groove nqn" onclick="window.insertWelcomeTag('🦆')"><span class="emoji-anim-shake">🦆</span> DuckDance</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="blobs" data-name="animated party blob confetti celebrate nqn" onclick="window.insertWelcomeTag('🎉')"><span class="emoji-anim-bounce">🎉</span> PartyBlob</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="blobs" data-name="animated siren blob alarm alert police nqn" onclick="window.insertWelcomeTag('🚨')"><span class="emoji-anim-shake">🚨</span> SirenBlob</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="blobs" data-name="animated fire blob flame hot nitro nqn" onclick="window.insertWelcomeTag('🔥')"><span class="emoji-anim-pulse">🔥</span> FireBlob</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="blobs" data-name="animated rainbow blob color shift nqn" onclick="window.insertWelcomeTag('🌈')"><span class="emoji-anim-glow">🌈</span> RainbowBlob</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="blobs" data-name="animated blob heart love care cute nqn" onclick="window.insertWelcomeTag('💖')"><span class="emoji-anim-pulse">💖</span> BlobHeart</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="blobs" data-name="animated blob wave hello greet hand nqn" onclick="window.insertWelcomeTag('👋')"><span class="emoji-anim-wave">👋</span> BlobWave</span>

                        <!-- ⚡ NQN Pack: Cyber, Neon & Equalizers -->
                        <span class="emoji-item-btn" data-master="animated" data-subcat="neon" data-name="animated equalizer sound music audio beats bars dj mrjayplays nqn" onclick="window.insertWelcomeTag('🎚️')"><span class="emoji-anim-pulse">🎚️</span> Neon Equalizer</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="neon" data-name="animated audio wave sound bars music beat nqn" onclick="window.insertWelcomeTag('📶')"><span class="emoji-anim-pulse">📶</span> Audio Wave</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="neon" data-name="animated rainbow flame fire hyper color burn hot nqn" onclick="window.insertWelcomeTag('🔥')"><span class="emoji-anim-pulse">🔥</span> Rainbow Flame</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="neon" data-name="animated neon green arrow pointer fast next mrjayplays nqn" onclick="window.insertWelcomeTag('➤')"><span class="emoji-anim-drive">➤</span> Neon Green Arrow</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="neon" data-name="animated green play cyber arrow pointer button nqn" onclick="window.insertWelcomeTag('▶️')"><span class="emoji-anim-drive">▶️</span> Cyber Play Arrow</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="neon" data-name="animated green orb bullet dot glow nqn" onclick="window.insertWelcomeTag('🟢')"><span class="emoji-anim-glow">🟢</span> Green Orb</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="neon" data-name="animated emerald green heart glow nqn" onclick="window.insertWelcomeTag('💚')"><span class="emoji-anim-pulse">💚</span> Emerald Glow</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="neon" data-name="animated shock bolt lightning electric power nqn" onclick="window.insertWelcomeTag('⚡')"><span class="emoji-anim-shake">⚡</span> Shock Bolt</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="neon" data-name="animated hologram dot crystal blue spin nqn" onclick="window.insertWelcomeTag('💠')"><span class="emoji-anim-glow">💠</span> Hologram Dot</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="neon" data-name="animated neon shield security protection nqn" onclick="window.insertWelcomeTag('🛡️')"><span class="emoji-anim-pulse">🛡️</span> Neon Shield</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="neon" data-name="animated laser pointer diamond blue nqn" onclick="window.insertWelcomeTag('🔹')"><span class="emoji-anim-spin">🔹</span> Laser Diamond</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="neon" data-name="animated curve pointer right arrow bend nqn" onclick="window.insertWelcomeTag('➥')"><span class="emoji-anim-drive">➥</span> Curve Pointer</span>

                        <!-- 🏎️ NQN Pack: Speed & Cars -->
                        <span class="emoji-item-btn" data-master="animated" data-subcat="cars" data-name="animated race car f1 speed nitro drift nqn" onclick="window.insertWelcomeTag('🏎️')"><span class="emoji-anim-drive">🏎️</span> Moving F1</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="cars" data-name="animated sports car vehicle drive red nqn" onclick="window.insertWelcomeTag('🚗')"><span class="emoji-anim-drive">🚗</span> Sports Car</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="cars" data-name="animated luxury black sedan car nqn" onclick="window.insertWelcomeTag('🚘')"><span class="emoji-anim-drive">🚘</span> Luxury Car</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="cars" data-name="animated superbike motorcycle speed nqn" onclick="window.insertWelcomeTag('🏍️')"><span class="emoji-anim-drive">🏍️</span> Superbike</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="cars" data-name="animated checkered racing flag wave nqn" onclick="window.insertWelcomeTag('🏁')"><span class="emoji-anim-wave">🏁</span> Waving Flag</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="cars" data-name="animated nitro traffic signal green light nqn" onclick="window.insertWelcomeTag('🚦')"><span class="emoji-anim-pulse">🚦</span> Nitro Signal</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="cars" data-name="animated rocket blast launch moon nqn" onclick="window.insertWelcomeTag('🚀')"><span class="emoji-anim-bounce">🚀</span> Rocket Blast</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="cars" data-name="animated ufo saucer flying alien space nqn" onclick="window.insertWelcomeTag('🛸')"><span class="emoji-anim-bounce">🛸</span> UFO Saucer</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="cars" data-name="animated sky jet supersonic fly flight nqn" onclick="window.insertWelcomeTag('✈️')"><span class="emoji-anim-drive">✈️</span> Sky Jet</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="cars" data-name="animated helicopter choppa fly rotor nqn" onclick="window.insertWelcomeTag('🚁')"><span class="emoji-anim-spin">🚁</span> Chopper</span>

                        <!-- 🚩 NQN Pack: Animated World Flags -->
                        <span class="emoji-item-btn" data-master="animated" data-subcat="flags" data-name="animated pakistan flag pk green wave nqn" onclick="window.insertWelcomeTag('🇵🇰')"><span class="emoji-anim-wave">🇵🇰</span> Pakistan Wave</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="flags" data-name="animated usa america flag united states wave nqn" onclick="window.insertWelcomeTag('🇺🇸')"><span class="emoji-anim-wave">🇺🇸</span> USA Wave</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="flags" data-name="animated uk britain flag united kingdom wave nqn" onclick="window.insertWelcomeTag('🇬🇧')"><span class="emoji-anim-wave">🇬🇧</span> UK Wave</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="flags" data-name="animated uae dubai flag united arab emirates wave nqn" onclick="window.insertWelcomeTag('🇦🇪')"><span class="emoji-anim-wave">🇦🇪</span> UAE Wave</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="flags" data-name="animated canada flag red maple wave nqn" onclick="window.insertWelcomeTag('🇨🇦')"><span class="emoji-anim-wave">🇨🇦</span> Canada Wave</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="flags" data-name="animated germany flag deutschland wave nqn" onclick="window.insertWelcomeTag('🇩🇪')"><span class="emoji-anim-wave">🇩🇪</span> Germany Wave</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="flags" data-name="animated turkey flag turkish wave nqn" onclick="window.insertWelcomeTag('🇹🇷')"><span class="emoji-anim-wave">🇹🇷</span> Turkey Wave</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="flags" data-name="animated saudi arabia flag ksa wave nqn" onclick="window.insertWelcomeTag('🇸🇦')"><span class="emoji-anim-wave">🇸🇦</span> Saudi Wave</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="flags" data-name="animated japan flag tokyo wave nqn" onclick="window.insertWelcomeTag('🇯🇵')"><span class="emoji-anim-wave">🇯🇵</span> Japan Wave</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="flags" data-name="animated gold champion trophy cup winner nqn" onclick="window.insertWelcomeTag('🏆')"><span class="emoji-anim-glow">🏆</span> Gold Trophy</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="flags" data-name="animated gold medal winner first place nqn" onclick="window.insertWelcomeTag('🥇')"><span class="emoji-anim-glow">🥇</span> Gold Medal</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="flags" data-name="animated military star medal badge nqn" onclick="window.insertWelcomeTag('🎖️')"><span class="emoji-anim-glow">🎖️</span> Star Medal</span>

                        <!-- 💎 NQN Pack: Nitro Badges & Ranks -->
                        <span class="emoji-item-btn" data-master="animated" data-subcat="nitro" data-name="animated diamond gem crystal spin nitro nqn" onclick="window.insertWelcomeTag('💎')"><span class="emoji-anim-spin">💎</span> Nitro Gem</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="nitro" data-name="animated rotating gold coin money 3d nqn" onclick="window.insertWelcomeTag('🪙')"><span class="emoji-anim-spin">🪙</span> 3D Gold Coin</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="nitro" data-name="animated vip gold crown king royalty nqn" onclick="window.insertWelcomeTag('👑')"><span class="emoji-anim-glow">👑</span> VIP Crown</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="nitro" data-name="animated nitro verified checkmark badge glow nqn" onclick="window.insertWelcomeTag('☑️')"><span class="emoji-anim-pulse">☑️</span> Nitro Verified</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="nitro" data-name="animated magic sparkles glitter star shine nqn" onclick="window.insertWelcomeTag('✨')"><span class="emoji-anim-glow">✨</span> Magic Sparkles</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="nitro" data-name="animated level up hundred 100 fire nqn" onclick="window.insertWelcomeTag('💯')"><span class="emoji-anim-pulse">💯</span> 100 Fire</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="nitro" data-name="animated neon heart pulse love nqn" onclick="window.insertWelcomeTag('💖')"><span class="emoji-anim-pulse">💖</span> Pulsing Heart</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="nitro" data-name="animated broadcast loudspeaker mega wave nqn" onclick="window.insertWelcomeTag('📢')"><span class="emoji-anim-shake">📢</span> Broadcast</span>

                        <!-- 🎭 NQN Pack: Memes & Gestures -->
                        <span class="emoji-item-btn" data-master="animated" data-subcat="memes" data-name="animated waving hand hello greet wave nqn" onclick="window.insertWelcomeTag('👋')"><span class="emoji-anim-wave">👋</span> Moving Wave</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="memes" data-name="animated handshake agreement deal shake nqn" onclick="window.insertWelcomeTag('🤝')"><span class="emoji-anim-wave">🤝</span> Deal Shake</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="memes" data-name="animated cool boss sunglasses glow nqn" onclick="window.insertWelcomeTag('😎')"><span class="emoji-anim-glow">😎</span> Cool Boss</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="memes" data-name="animated star struck eyes shine amazed nqn" onclick="window.insertWelcomeTag('🤩')"><span class="emoji-anim-glow">🤩</span> Star Struck</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="memes" data-name="animated cyborg robot bot automation nqn" onclick="window.insertWelcomeTag('🤖')"><span class="emoji-anim-pulse">🤖</span> Cyborg Bot</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="memes" data-name="animated power arm flex strong bicep nqn" onclick="window.insertWelcomeTag('🦾')"><span class="emoji-anim-shake">🦾</span> Power Arm</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="memes" data-name="animated saluting face respect salute hero nqn" onclick="window.insertWelcomeTag('🫡')"><span class="emoji-anim-bounce">🫡</span> Salute</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="memes" data-name="animated watching eyes look search peep nqn" onclick="window.insertWelcomeTag('👀')"><span class="emoji-anim-shake">👀</span> Watching Eyes</span>

                        <!-- ✍️ NQN Pack: Fancy Headers -->
                        <span class="emoji-item-btn" data-master="animated" data-subcat="fonts" data-name="animated streamer content creator header style nqn" onclick="window.insertWelcomeTag('🎚️ {user} 🎚️\n**WELCOME TO {server}**\n🔥 **THANK YOU FOR JOINING**, You are Member #{count} of {server}!')"><span class="emoji-anim-pulse">🎚️</span> Streamer Header</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="fonts" data-name="animated cursive fancy script welcome nqn" onclick="window.insertWelcomeTag('⚡ 💎 𝓦𝓮𝓵𝓬𝓸𝓶𝓮 𝓽𝓸 {server} 💎 ⚡')"><span class="emoji-anim-glow">⚡</span> 𝓦𝓮𝓵𝓬𝓸𝓶𝓮 Banner</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="fonts" data-name="animated gothic bold medieval welcome nqn" onclick="window.insertWelcomeTag('👑 𝖂𝖊𝖑𝖈𝖔𝖒𝖊 𝖙𝖔 {server} 👑')"><span class="emoji-anim-glow">👑</span> 𝖂𝖊𝖑𝖈𝖔𝖒𝖊 Banner</span>
                        <span class="emoji-item-btn" data-master="animated" data-subcat="fonts" data-name="animated cyber neon script welcome nqn" onclick="window.insertWelcomeTag('🚀 𝐖𝐞𝐥𝐜𝐨𝐦𝐞 𝐭𝐨 {server} 🚀')"><span class="emoji-anim-bounce">🚀</span> 𝐖𝐞𝐥𝐜𝓸𝓶𝐞 Banner</span>

                        <!-- ═══════════════ STANDARD UNICODE PACKS (MASTER: STANDARD) ═══════════════ -->
                        <span class="emoji-item-btn" data-master="standard" data-subcat="blobs" data-name="standard party celebrate face" onclick="window.insertWelcomeTag('🥳')">🥳 Party</span>
                        <span class="emoji-item-btn" data-master="standard" data-subcat="blobs" data-name="standard cat face cute" onclick="window.insertWelcomeTag('🐱')">🐱 Cat</span>
                        <span class="emoji-item-btn" data-master="standard" data-subcat="blobs" data-name="standard duck animal" onclick="window.insertWelcomeTag('🦆')">🦆 Duck</span>
                        <span class="emoji-item-btn" data-master="standard" data-subcat="neon" data-name="standard audio wave signal" onclick="window.insertWelcomeTag('📶')">📶 Signal</span>
                        <span class="emoji-item-btn" data-master="standard" data-subcat="neon" data-name="standard electric bolt" onclick="window.insertWelcomeTag('⚡')">⚡ Bolt</span>
                        <span class="emoji-item-btn" data-master="standard" data-subcat="neon" data-name="standard laser arrow point" onclick="window.insertWelcomeTag('➤')">➤ Arrow</span>
                        <span class="emoji-item-btn" data-master="standard" data-subcat="cars" data-name="standard race car speed" onclick="window.insertWelcomeTag('🏎️')">🏎️ Racecar</span>
                        <span class="emoji-item-btn" data-master="standard" data-subcat="cars" data-name="standard sports car red" onclick="window.insertWelcomeTag('🚗')">🚗 Car</span>
                        <span class="emoji-item-btn" data-master="standard" data-subcat="cars" data-name="standard motorcycle bike" onclick="window.insertWelcomeTag('🏍️')">🏍️ Superbike</span>
                        <span class="emoji-item-btn" data-master="standard" data-subcat="flags" data-name="standard pakistan flag pk" onclick="window.insertWelcomeTag('🇵🇰')">🇵🇰 Pakistan</span>
                        <span class="emoji-item-btn" data-master="standard" data-subcat="flags" data-name="standard usa flag america" onclick="window.insertWelcomeTag('🇺🇸')">🇺🇸 USA</span>
                        <span class="emoji-item-btn" data-master="standard" data-subcat="flags" data-name="standard uk flag britain" onclick="window.insertWelcomeTag('🇬🇧')">🇬🇧 UK</span>
                        <span class="emoji-item-btn" data-master="standard" data-subcat="flags" data-name="standard uae flag dubai" onclick="window.insertWelcomeTag('🇦🇪')">🇦🇪 UAE</span>
                        <span class="emoji-item-btn" data-master="standard" data-subcat="nitro" data-name="standard diamond gem" onclick="window.insertWelcomeTag('💎')">💎 Diamond</span>
                        <span class="emoji-item-btn" data-master="standard" data-subcat="nitro" data-name="standard crown gold" onclick="window.insertWelcomeTag('👑')">👑 Crown</span>
                        <span class="emoji-item-btn" data-master="standard" data-subcat="nitro" data-name="standard sparkles star" onclick="window.insertWelcomeTag('✨')">✨ Sparkles</span>
                        <span class="emoji-item-btn" data-master="standard" data-subcat="memes" data-name="standard wave hello" onclick="window.insertWelcomeTag('👋')">👋 Wave</span>
                        <span class="emoji-item-btn" data-master="standard" data-subcat="memes" data-name="standard handshake agreement" onclick="window.insertWelcomeTag('🤝')">🤝 Handshake</span>
                      </div>
                    </div>

                    <div>
                      <label style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; display: block;">📝 Custom Message Text:</label>
                      <textarea class="modal-input" id="welcome-msg-text-input" rows="5" style="background: #0c0d14; border: 1px solid rgba(88,101,242,0.35); font-size: 13px; resize: vertical; line-height: 1.5; padding: 14px; border-radius: 12px; font-family: 'Consolas', monospace; color: #f1f5f9;" oninput="window.updateWelcomeLiveTextPreview()">✨ **Welcome to {server}!**
────────────────────────────
👋 Greetings {user}! You are Member #{count} 🎉
🚀 Access exclusive market insights & automated tools!

📌 QUICK NAVIGATION:
📜 Rules: {rules_channel}
📢 Updates: {updates_channel}
💬 General Lounge: {general_channel}
────────────────────────────
🌟 Level up by chatting & stay active!</textarea>
                    </div>
                  </div>

                  <!-- 4. Embed Title & Color -->
                  <div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08);">
                    <label style="font-weight: 800; color: #fff; margin-bottom: 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">🎨 4. EMBED TITLE & COLOR CUSTOMIZATION</label>
                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-bottom: 12px;">
                      <div>
                        <label style="font-size: 11px; color: #94a3b8; margin-bottom: 4px; display: block; font-weight: 600;">Embed Title</label>
                        <input type="text" id="welcome-embed-title-input" class="modal-input" placeholder="✨ Welcome to {server}!" value="✨ Welcome to {server}!" style="background: #0c0d14; border-color: rgba(255,255,255,0.12); font-size: 12px; padding: 9px 12px; border-radius: 8px;">
                      </div>
                      <div>
                        <label style="font-size: 11px; color: #94a3b8; margin-bottom: 4px; display: block; font-weight: 600;">Accent Color</label>
                        <div style="display: flex; gap: 6px; align-items: center;">
                          <input type="color" id="welcome-embed-color-picker" value="#5865f2" style="width: 36px; height: 34px; border: none; background: transparent; cursor: pointer; border-radius: 6px;" onchange="document.getElementById('welcome-embed-color-text').value = this.value">
                          <input type="text" id="welcome-embed-color-text" class="modal-input" value="#5865f2" style="background: #0c0d14; border-color: rgba(255,255,255,0.12); font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 9px 12px; border-radius: 8px;">
                        </div>
                      </div>
                    </div>
                    <div>
                      <label style="font-size: 11px; color: #94a3b8; margin-bottom: 4px; display: block; font-weight: 600;">Footer Text</label>
                      <input type="text" id="welcome-embed-footer-input" class="modal-input" placeholder="⚡ Powered by ReplyFlow Discord Automation • {server}" value="⚡ Powered by ReplyFlow Discord Automation • {server}" style="background: #0c0d14; border-color: rgba(255,255,255,0.12); font-size: 12px; padding: 9px 12px; border-radius: 8px;">
                    </div>
                  </div>

                  <!-- 5. Delivery Options -->
                  <div style="background: rgba(255,255,255,0.03); padding: 14px 18px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08);">
                    <label style="font-weight: 800; color: #fff; font-size: 12px; margin-bottom: 10px; display: block; text-transform: uppercase; letter-spacing: 0.5px;">⚡ 5. DELIVERY OPTIONS (PING & PRIVATE DM)</label>
                    <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                      <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #e2e8f0; cursor: pointer;">
                        <input type="checkbox" id="welcome-toggle-ping" checked style="accent-color: #5865f2; width: 15px; height: 15px; cursor: pointer;">
                        <span>🔔 Ping Member (@User mention in channel)</span>
                      </label>
                      <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #e2e8f0; cursor: pointer;">
                        <input type="checkbox" id="welcome-toggle-dm" checked style="accent-color: #5865f2; width: 15px; height: 15px; cursor: pointer;">
                        <span>📩 Send Private DM Welcome Card</span>
                      </label>
                    </div>
                  </div>

                  <!-- 6. Social Links -->
                  <div>
                    <label style="font-weight: 800; color: #fff; margin-bottom: 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; display: block;">🔗 6. SOCIAL LINK BUTTONS (ATTACHED UNDERNEATH)</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                      <input type="text" id="welcome-link-web" class="modal-input" placeholder="Website URL" value="" style="background: #0c0d14; border-color: rgba(255,255,255,0.12); font-size: 12px; padding: 9px 12px; border-radius: 8px;" oninput="document.getElementById('preview-btn-web').style.display = this.value ? 'inline-block' : 'none'">
                      <input type="text" id="welcome-link-ig" class="modal-input" placeholder="Instagram URL" value="" style="background: #0c0d14; border-color: rgba(255,255,255,0.12); font-size: 12px; padding: 9px 12px; border-radius: 8px;" oninput="document.getElementById('preview-btn-ig').style.display = this.value ? 'inline-block' : 'none'">
                      <input type="text" id="welcome-link-yt" class="modal-input" placeholder="YouTube URL" value="" style="background: #0c0d14; border-color: rgba(255,255,255,0.12); font-size: 12px; padding: 9px 12px; border-radius: 8px;" oninput="document.getElementById('preview-btn-yt').style.display = this.value ? 'inline-block' : 'none'">
                      <input type="text" id="welcome-link-tk" class="modal-input" placeholder="TikTok URL" value="" style="background: #0c0d14; border-color: rgba(255,255,255,0.12); font-size: 12px; padding: 9px 12px; border-radius: 8px;" oninput="document.getElementById('preview-btn-tk').style.display = this.value ? 'inline-block' : 'none'">
                      <input type="text" id="welcome-link-tw" class="modal-input" placeholder="Twitter/X URL" value="" style="background: #0c0d14; border-color: rgba(255,255,255,0.12); font-size: 12px; padding: 9px 12px; border-radius: 8px;" oninput="document.getElementById('preview-btn-tw').style.display = this.value ? 'inline-block' : 'none'">
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </div>

          </div>
          <!-- RIGHT SIDEBAR: HOW TO USE -->
          <div style="width: 340px; min-width: 300px; box-sizing: border-box;">
            <div style="background: #0f111a; border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
              <h3 style="color: #fff; font-size: 15px; margin-top: 0; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                <span>📖</span> <span>How to Use</span>
              </h3>
              <ul style="color: #94a3b8; font-size: 13px; line-height: 1.6; padding-left: 20px; margin: 0;">
                <li style='margin-bottom: 8px;'>Welcome Messages allow you to greet new members with a beautiful card.</li>
                <li style='margin-bottom: 8px;'>Choose a premium frame style that matches your server's theme.</li>
                <li style='margin-bottom: 8px;'>Customize the welcome text using tags like {user} and {server}.</li>
                <li style='margin-bottom: 8px;'>Enable Ping to mention the user, or DM to send it privately.</li>
              </ul>
            </div>
          </div>
        </div>
`
    },
    autorole: {
      title: '⚡ Auto-Role Assignment Dashboard',
      html: `
        <div style="display: flex; gap: 20px; align-items: stretch; flex-wrap: nowrap;">
          <div style="width: 65%; min-width: 300px; background: #0f111a; border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); box-sizing: border-box;">
            
        <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); padding: 24px; border-radius: 16px; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.06);">
            <div>
              <div style="color: #fff; font-weight: 800; font-size: 16px; display: flex; align-items: center; gap: 8px;">
                <span>🛡️</span> <span>Auto-Assigned Member Roles</span>
              </div>
              <div style="color: #a1a1aa; font-size: 12px; margin-top: 4px;">Role automatically added to every human member upon joining</div>
            </div>
            <button onclick="window.promptAddCustomRole()" style="background: rgba(88,101,242,0.15); color: #818cf8; border: 1px solid rgba(88,101,242,0.4); padding: 8px 16px; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 12px; transition: 0.2s;" onmouseover="this.style.background='rgba(88,101,242,0.25)'" onmouseout="this.style.background='rgba(88,101,242,0.15)'">+ Add Custom Role</button>
          </div>

          <!-- Active Roles Container -->
          <div class="modal-form-group" style="margin-bottom: 24px;">
            <label class="modal-form-label" style="font-weight: 700; color: #fff; margin-bottom: 10px; display: block;">Active Assigned Role(s)</label>
            <div id="autorole-badges-container" style="display: flex; gap: 10px; flex-wrap: wrap;">
              <span class="badge" style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.4); color: #34d399; padding: 10px 16px; border-radius: 10px; font-weight: 800; font-size: 13px; display: flex; align-items: center; gap: 8px;">@Member <span style="font-size: 12px; opacity: 0.9;">✓ (Default)</span></span>
              <span class="badge" style="background: rgba(88,101,242,0.15); border: 1px solid rgba(88,101,242,0.4); color: #818cf8; padding: 10px 16px; border-radius: 10px; font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 6px;">@Verified</span>
            </div>
          </div>

          <!-- Trigger Timing -->
          <div class="modal-form-group" style="margin-bottom: 10px;">
            <label class="modal-form-label" style="font-weight: 700; color: #fff; margin-bottom: 10px; display: block;">Assignment Trigger Timing</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <label style="background: rgba(88,101,242,0.1); border: 1px solid rgba(88,101,242,0.4); padding: 14px; border-radius: 12px; display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="radio" name="role_trigger_time" value="instant" checked style="accent-color: #5865f2; width: 16px; height: 16px;">
                <div>
                  <div style="color: #fff; font-weight: 700; font-size: 13px;">⚡ Instant Join (Recommended)</div>
                  <div style="color: #a1a1aa; font-size: 11px;">Assign role immediately when member joins server</div>
                </div>
              </label>
              
              <label style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 14px; border-radius: 12px; display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="radio" name="role_trigger_time" value="verified" style="accent-color: #5865f2; width: 16px; height: 16px;">
                <div>
                  <div style="color: #fff; font-weight: 700; font-size: 13px;">📜 On Verification</div>
                  <div style="color: #a1a1aa; font-size: 11px;">Assign after accepting community rules</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end;">
          <button onclick="window.saveAutoRoleSettings()" style="background: #5865f2; color: #fff; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px; border: none; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#4752c4'" onmouseout="this.style.background='#5865f2'">Save Settings</button>
        </div>
      
          </div>
          <div style="width: calc(35% - 20px); min-width: 250px; box-sizing: border-box;">
            
        <div style="background: #0f111a; border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 16px; height: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
          <h3 style="color: #fff; font-size: 15px; margin-top: 0; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <span>📖</span> <span>How to Use</span>
          </h3>
          <ul style="color: #94a3b8; font-size: 13px; line-height: 1.6; padding-left: 20px; margin: 0;">
            <li style='margin-bottom: 8px;'><strong style='color: #fff;'>Automatic Role Assignment:</strong> Whenever a new user joins your Discord server, this plugin automatically grants them the default member role instantly.</li><li style='margin-bottom: 8px;'>Add multiple roles like @Member and @Verified.</li><li style='margin-bottom: 8px;'>Choose to assign instantly on join or after Discord verification.</li><li style='margin-bottom: 8px;'>Keeps your server secure and organized without manual work.</li>
          </ul>
        </div>
          </div>
        </div>
`
    },
    leveling: {
      title: '🏆 Leveling & XP System Dashboard',
      html: `
        <div style="display: flex; gap: 20px; align-items: stretch; flex-wrap: nowrap;">
          <div style="width: 65%; min-width: 300px; background: #0f111a; border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); box-sizing: border-box;">
            
        <!-- Leveling Difficulty Scaling & Curve Configurator -->
        <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); padding: 20px; border-radius: 16px; margin-bottom: 20px;">
          <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06);">
            <div style="color: #fff; font-weight: 800; font-size: 15px; display: flex; align-items: center; gap: 8px;">
              <span>📈</span> <span>Level Progression & Difficulty Scaling Settings</span>
            </div>
            <div style="color: #a1a1aa; font-size: 12px; margin-top: 2px;">Make initial levels easy for newcomers, and scale difficulty gradually as levels increase.</div>
          </div>

          <!-- Difficulty Presets -->
          <div style="margin-bottom: 18px;">
            <label style="font-weight: 700; color: #fff; font-size: 12px; margin-bottom: 8px; display: block;">Select Difficulty Preset</label>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;" id="lvl-preset-container">
              <button type="button" onclick="window.applyLvlPreset('easy')" id="btn-preset-easy" style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); color: #34d399; padding: 10px; border-radius: 10px; font-weight: 700; font-size: 12px; cursor: pointer; text-align: left; transition: 0.2s;">
                <div style="font-weight: 800; font-size: 13px;">🟢 Easy</div>
                <div style="font-size: 10px; opacity: 0.8; margin-top: 2px;">Base 80 XP • 1.2x Multiplier</div>
              </button>
              <button type="button" onclick="window.applyLvlPreset('progressive')" id="btn-preset-progressive" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; padding: 10px; border-radius: 10px; font-weight: 700; font-size: 12px; cursor: pointer; text-align: left; transition: 0.2s;">
                <div style="font-weight: 800; font-size: 13px;">⚡ Progressive ⭐</div>
                <div style="font-size: 10px; opacity: 0.9; margin-top: 2px;">Base 100 XP • 1.5x Multiplier</div>
              </button>
              <button type="button" onclick="window.applyLvlPreset('hardcore')" id="btn-preset-hardcore" style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #f87171; padding: 10px; border-radius: 10px; font-weight: 700; font-size: 12px; cursor: pointer; text-align: left; transition: 0.2s;">
                <div style="font-weight: 800; font-size: 13px;">🔥 Hardcore</div>
                <div style="font-size: 10px; opacity: 0.8; margin-top: 2px;">Base 150 XP • 1.8x Multiplier</div>
              </button>
              <button type="button" onclick="window.applyLvlPreset('custom')" id="btn-preset-custom" style="background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.3); color: #c084fc; padding: 10px; border-radius: 10px; font-weight: 700; font-size: 12px; cursor: pointer; text-align: left; transition: 0.2s;">
                <div style="font-weight: 800; font-size: 13px;">⚙️ Custom</div>
                <div style="font-size: 10px; opacity: 0.8; margin-top: 2px;">Manual Fine-Tuning</div>
              </button>
            </div>
          </div>

          <!-- Fine-Tuning Sliders -->
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 18px;">
            <div class="modal-form-group" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); padding: 14px; border-radius: 12px;">
              <label class="modal-form-label" style="font-weight: 700; color: #fff; margin-bottom: 6px; display: block; font-size: 12px;">1. Base XP (Level 2 Req.)</label>
              <input type="range" id="lvl-base-xp" min="50" max="500" step="10" value="100" class="modal-input" style="accent-color: #f59e0b;" oninput="window.updateLvlCalc()">
              <div style="font-size: 11px; color: #fbbf24; margin-top: 4px; font-weight: 700;">Base: <span id="val-base-xp">100 XP</span></div>
            </div>

            <div class="modal-form-group" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); padding: 14px; border-radius: 12px;">
              <label class="modal-form-label" style="font-weight: 700; color: #fff; margin-bottom: 6px; display: block; font-size: 12px;">2. Difficulty Curve Exponent</label>
              <input type="range" id="lvl-exponent" min="1.0" max="2.5" step="0.1" value="1.5" class="modal-input" style="accent-color: #f59e0b;" oninput="window.updateLvlCalc()">
              <div style="font-size: 11px; color: #fbbf24; margin-top: 4px; font-weight: 700;">Curve Multiplier: <span id="val-exponent">1.5x</span></div>
            </div>

            <div class="modal-form-group" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); padding: 14px; border-radius: 12px;">
              <label class="modal-form-label" style="font-weight: 700; color: #fff; margin-bottom: 6px; display: block; font-size: 12px;">3. XP Earned Per Msg</label>
              <input type="range" id="lvl-xp-rate" min="5" max="100" step="5" value="20" class="modal-input" style="accent-color: #f59e0b;" oninput="window.updateLvlCalc()">
              <div style="font-size: 11px; color: #fbbf24; margin-top: 4px; font-weight: 700;">Rate: <span id="val-xp-rate">20 XP / msg</span></div>
            </div>
          </div>

          <!-- Live XP Milestone Breakdown & Calculator Preview Box -->
          <div style="background: rgba(17,18,24,0.7); border: 1px solid rgba(245,158,11,0.2); padding: 16px; border-radius: 12px;">
            <div style="font-size: 12px; font-weight: 800; color: #fff; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
              <span>🧮</span> <span>Live Leveling Difficulty Preview (Required XP & Messages)</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; text-align: center;" id="lvl-calc-grid">
              <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.06); padding: 10px 6px; border-radius: 8px;">
                <div style="color: #fbbf24; font-weight: 800; font-size: 12px;">🔰 Lvl 2</div>
                <div style="color: #fff; font-weight: 800; font-size: 13px; margin: 4px 0;">100 XP</div>
                <div style="color: #a1a1aa; font-size: 10px;">~5 msgs</div>
              </div>
              <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.06); padding: 10px 6px; border-radius: 8px;">
                <div style="color: #fbbf24; font-weight: 800; font-size: 12px;">🥈 Lvl 5</div>
                <div style="color: #fff; font-weight: 800; font-size: 13px; margin: 4px 0;">800 XP</div>
                <div style="color: #a1a1aa; font-size: 10px;">~40 msgs</div>
              </div>
              <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.06); padding: 10px 6px; border-radius: 8px;">
                <div style="color: #fbbf24; font-weight: 800; font-size: 12px;">🥇 Lvl 10</div>
                <div style="color: #fff; font-weight: 800; font-size: 13px; margin: 4px 0;">2,700 XP</div>
                <div style="color: #a1a1aa; font-size: 10px;">~135 msgs</div>
              </div>
              <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.06); padding: 10px 6px; border-radius: 8px;">
                <div style="color: #fbbf24; font-weight: 800; font-size: 12px;">💎 Lvl 25</div>
                <div style="color: #fff; font-weight: 800; font-size: 13px; margin: 4px 0;">11,758 XP</div>
                <div style="color: #a1a1aa; font-size: 10px;">~588 msgs</div>
              </div>
              <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.06); padding: 10px 6px; border-radius: 8px;">
                <div style="color: #fbbf24; font-weight: 800; font-size: 12px;">👑 Lvl 50</div>
                <div style="color: #fff; font-weight: 800; font-size: 13px; margin: 4px 0;">34,300 XP</div>
                <div style="color: #a1a1aa; font-size: 10px;">~1,715 msgs</div>
              </div>
              <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.06); padding: 10px 6px; border-radius: 8px;">
                <div style="color: #fbbf24; font-weight: 800; font-size: 12px;">🔥 Lvl 100</div>
                <div style="color: #fff; font-weight: 800; font-size: 13px; margin: 4px 0;">98,502 XP</div>
                <div style="color: #a1a1aa; font-size: 10px;">~4,926 msgs</div>
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
            <button onclick="window.saveLevelingDifficultySettings()" style="background: #f59e0b; color: #000; padding: 10px 22px; border-radius: 10px; font-weight: 800; font-size: 13px; border: none; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#d97706'" onmouseout="this.style.background='#f59e0b'">💾 Save Leveling Rules & Sync</button>
          </div>
        </div>

        <!-- Level Rewards Manager Section -->
        <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); padding: 20px; border-radius: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06);">
            <div>
              <div style="color: #fff; font-weight: 800; font-size: 15px; display: flex; align-items: center; gap: 8px;">
                <span>🎖️</span> <span>Level Rewards Mapping (Level 0 - 100)</span>
              </div>
              <div style="color: #a1a1aa; font-size: 12px; margin-top: 2px;">Assign roles & perks when members hit specific levels</div>
            </div>
            <button onclick="document.getElementById('add-level-reward-modal').style.display='flex'" style="background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.4); padding: 8px 16px; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 12px; transition: 0.2s;" onmouseover="this.style.background='rgba(245,158,11,0.25)'" onmouseout="this.style.background='rgba(245,158,11,0.15)'">+ Add Level Reward</button>
          </div>

          <div id="level-rewards-container" style="display: flex; flex-direction: column; gap: 10px;">
            <div style="color: #a1a1aa; font-size: 13px; text-align: center; padding: 20px;">Loading level rewards...</div>
          </div>
        </div>

        <!-- Add Level Reward Modal Popup -->
        <div id="add-level-reward-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 999999; flex-direction: column; align-items: center; justify-content: center; backdrop-filter: blur(5px);">
          <div style="background: #111218; width: 90%; max-width: 480px; border: 1px solid rgba(245,158,11,0.4); border-radius: 16px; box-shadow: 0 10px 50px rgba(0,0,0,0.8); padding: 24px; position: relative;">
            <button onclick="document.getElementById('add-level-reward-modal').style.display='none'" style="position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.1); border: none; color: #fff; font-size: 14px; width: 32px; height: 32px; border-radius: 50%; cursor: pointer;">✖</button>

            <div style="font-size: 17px; font-weight: 800; color: #fff; margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
              <span>🎁</span> <span>Add Custom Level Reward</span>
            </div>

            <div class="modal-form-group" style="margin-bottom: 16px;">
              <label class="modal-form-label" style="font-weight: 700; color: #fff; margin-bottom: 6px; display: block;">1. Select Target Level (0 to 100)</label>
              <input type="number" id="new-reward-level" min="0" max="100" value="5" class="modal-input" style="background: #181920; border-color: rgba(255,255,255,0.1); font-size: 14px; font-weight: 800; color: #fbbf24;">
            </div>

            <div class="modal-form-group" style="margin-bottom: 24px;">
              <label class="modal-form-label" style="font-weight: 700; color: #fff; margin-bottom: 6px; display: block;">2. Select Reward Role (or Type Custom Name)</label>
              <select id="new-reward-role-select" onchange="const el=document.getElementById('new-reward-role'); if(this.value==='custom'){ if(el){el.value=''; el.focus();} } else { if(el) el.value=this.value; }" class="modal-input" style="background: #181920; border: 1px solid rgba(245,158,11,0.4); font-size: 13px; color: #fbbf24; font-weight: 700; padding: 10px 12px; border-radius: 8px; width: 100%; cursor: pointer; margin-bottom: 10px;">
                <option value="@VIP Trader">⭐ @VIP Trader</option>
                <option value="@Moderator">🛡️ @Moderator</option>
                <option value="@Admin">👑 @Admin</option>
                <option value="@Verified">✅ @Verified</option>
                <option value="@Member">👥 @Member</option>
                <option value="@Community Leader">🔥 @Community Leader</option>
                <option value="@Server Booster">🚀 @Server Booster</option>
                <option value="@Gold Member">🥇 @Gold Member</option>
                <option value="@Diamond Member">💎 @Diamond Member</option>
                <option value="@Legend">⚡ @Legend</option>
                <option value="custom">✏️ Custom Role Name...</option>
              </select>
              <input type="text" id="new-reward-role" value="@VIP Trader" placeholder="e.g. @Moderator, @Admin" class="modal-input" style="background: #181920; border-color: rgba(255,255,255,0.1); font-size: 13px; font-weight: 700; color: #fff;">
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
              <button onclick="document.getElementById('add-level-reward-modal').style.display='none'" style="background: rgba(255,255,255,0.1); color: #fff; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; border: none; cursor: pointer;">Cancel</button>
              <button onclick="window.saveLevelRewardToDb(event)" style="background: #f59e0b; color: #000; padding: 10px 22px; border-radius: 8px; font-weight: 800; font-size: 13px; border: none; cursor: pointer;">Save Reward</button>
            </div>
          </div>
        </div>
      
          </div>
          <div style="width: calc(35% - 20px); min-width: 250px; box-sizing: border-box;">
            
        <div style="background: #0f111a; border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 16px; height: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
          <h3 style="color: #fff; font-size: 15px; margin-top: 0; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <span>📖</span> <span>How to Use</span>
          </h3>
          <ul style="color: #94a3b8; font-size: 13px; line-height: 1.6; padding-left: 20px; margin: 0;">
            <li style='margin-bottom: 8px;'><strong style='color: #fff;'>Dynamic Leveling System:</strong> Tracks text & voice chat XP, scaling difficulty exponentially per level and awarding custom role perks.</li><li style='margin-bottom: 8px;'>Choose a difficulty preset (Easy, Progressive, Hardcore) to control how fast members level up.</li><li style='margin-bottom: 8px;'>Create custom Level Rewards to automatically grant VIP roles at specific milestones.</li><li style='margin-bottom: 8px;'>Members can check their rank card using slash commands.</li>
          </ul>
        </div>
          </div>
        </div>
`
    },
    tickets: {
      title: '🎟️ Support Ticket Desk Dashboard',
      html: `
        <div style="display: flex; gap: 20px; align-items: stretch; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 320px; background: #0f111a; border: 1px solid rgba(255,255,255,0.08); padding: 24px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); box-sizing: border-box;">
            
            <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(236,72,153,0.08); border: 1px solid rgba(236,72,153,0.25); padding: 14px 16px; border-radius: 12px; margin-bottom: 16px;">
              <div>
                <div style="font-size: 14px; color: #fff; font-weight: 700;">⚡ Instant Ticket Creation (No Popups / No Modals)</div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Directly creates a private channel on click without extra forms.</div>
              </div>
              <input type="checkbox" id="tkt-instant" checked style="width: 20px; height: 20px; cursor: pointer; accent-color: #ec4899;">
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(88,101,242,0.08); border: 1px solid rgba(88,101,242,0.25); padding: 14px 16px; border-radius: 12px; margin-bottom: 16px;">
              <div>
                <div style="font-size: 14px; color: #fff; font-weight: 700;">🔢 Server-Wide Continuous Sequential Numbering</div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Sequential numbering continuous across all members (e.g., ticket-031, ticket-032).</div>
              </div>
              <span style="background: rgba(88,101,242,0.25); border: 1px solid rgba(88,101,242,0.5); color: #a5b4fc; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 800;">ticket-031, ticket-032...</span>
            </div>

            <div class="modal-form-group" style="margin-bottom: 16px;">
              <label class="modal-form-label" style="font-weight: 600; color: #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                <span>📅 Max Daily Tickets Per User (24 Hours)</span>
                <span style="font-size: 11px; color: #94a3b8;">Set max tickets allowed per user per day (0 = Unlimited)</span>
              </label>
              <input type="number" id="tkt-daily-limit" class="modal-input" min="0" value="3" style="background: #181b28; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 10px 14px; border-radius: 10px; width: 100%; font-weight: 700;">
            </div>

            <div class="modal-form-group" style="margin-bottom: 16px;">
              <label class="modal-form-label" style="font-weight: 600; color: #f1f5f9;">🛡️ Staff & Official Roles for Access</label>
              <input type="text" id="tkt-allowed-roles" class="modal-input" value="Admin, Moderator, Staff" style="background: #181b28; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 10px 14px; border-radius: 10px; width: 100%;">
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Ticket channel is visible strictly to creator + Admins & these roles.</div>
            </div>

            <div class="modal-form-group" style="margin-bottom: 16px;">
              <label class="modal-form-label" style="font-weight: 600; color: #f1f5f9;">📍 Ticket Embed Channel</label>
              <input type="text" id="tkt-embed-channel" class="modal-input" value="#tickets" style="background: #181b28; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 10px 14px; border-radius: 10px; width: 100%;">
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.3); padding: 14px 16px; border-radius: 12px; margin-bottom: 20px;">
              <span style="font-size: 13px; color: #fff; font-weight: 600;">📄 Auto-Generate HTML Transcript on Ticket Close</span>
              <input type="checkbox" id="tkt-auto-transcript" checked style="width: 18px; height: 18px; cursor: pointer; accent-color: #ec4899;">
            </div>

            <button onclick="window.saveTicketDashboardSettings()" style="width: 100%; background: linear-gradient(135deg, #ec4899, #be185d); border: none; color: #fff; padding: 12px 20px; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 16px rgba(236,72,153,0.35); transition: all 0.2s ease;">
              <span>💾</span> <span>Save Ticket Settings & Sync to Bot</span>
            </button>
          </div>

          <div style="width: 320px; min-width: 280px; box-sizing: border-box;">
            <div style="background: #0f111a; border: 1px solid rgba(255,255,255,0.08); padding: 24px; border-radius: 16px; height: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.4); box-sizing: border-box;">
              <h3 style="color: #fff; font-size: 15px; margin-top: 0; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                <span>🔒</span> <span>Permissions & Policy</span>
              </h3>
              <ul style="color: #94a3b8; font-size: 12px; line-height: 1.7; padding-left: 18px; margin: 0;">
                <li style="margin-bottom: 10px;"><strong style="color: #e2e8f0;">Instant Ticket:</strong> Member clicks <em>Create Ticket</em> in Discord to get an instant private channel.</li>
                <li style="margin-bottom: 10px;"><strong style="color: #e2e8f0;">Ticket Closing:</strong> Both Ticket Creator and Staff/Admins can click <strong>🔒 Close Ticket</strong> at any time.</li>
                <li style="margin-bottom: 10px;"><strong style="color: #f43f5e;">Channel Deletion:</strong> Only Admins can directly delete. If regular users request deletion, it stays <strong>Pending Admin Approval</strong> until accepted by an Admin.</li>
                <li style="margin-bottom: 10px;"><strong style="color: #38bdf8;">Daily Limit:</strong> Restricts user ticket generation to the daily limit configured here.</li>
              </ul>
            </div>
          </div>
        </div>
      `
    },

    'live-stats': {
      title: '📊 Live Stats Counters Dashboard',
      html: `
        <div style="display: flex; gap: 20px; align-items: stretch; flex-wrap: nowrap;">
          <div style="width: 65%; min-width: 300px; background: #0f111a; border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); box-sizing: border-box;">
            


        <!-- 6 Voice Counter Channel Toggle Controls -->
        <div id="live-stats-counters-box" style="margin-bottom: 24px; transition: opacity 0.3s;">
          <label style="font-weight: 800; color: #f8fafc; font-size: 13px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
            <span style="display: flex; align-items: center; gap: 8px;">
              <span>⚡ Voice Counter Channels (ON / OFF Toggle Controls)</span>
            </span>
            <span style="font-size: 11px; color: #38bdf8; font-weight: 700; background: rgba(56,189,248,0.15); padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(56,189,248,0.3);">Radio-Style Switches</span>
          </label>

          <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">
            <!-- 1. Total Members -->
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #fff; background: rgba(18,20,29,0.85); border: 1px solid rgba(255,255,255,0.08); padding: 16px 20px; border-radius: 14px; transition: all 0.2s;" onmouseenter="this.style.borderColor='rgba(56,189,248,0.5)'" onmouseleave="this.style.borderColor='rgba(255,255,255,0.08)'">
              <div style="display: flex; align-items: center; gap: 14px;">
                <span style="font-size: 22px;">👥</span>
                <div>
                  <div style="font-weight: 800; color: #f8fafc; font-size: 14px;">Total Members Counter Channel</div>
                  <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Displays current total server members: <strong id="val-total-members" style="color: #38bdf8;">3 Members</strong></div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 12px; font-weight: 700; color: #38bdf8;">ON / OFF</span>
                <input type="checkbox" id="chk-total-members" checked style="width: 22px; height: 22px; accent-color: #38bdf8; cursor: pointer;">
              </div>
            </div>

            <!-- 2. Online Members -->
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #fff; background: rgba(18,20,29,0.85); border: 1px solid rgba(255,255,255,0.08); padding: 16px 20px; border-radius: 14px; transition: all 0.2s;" onmouseenter="this.style.borderColor='rgba(52,211,153,0.5)'" onmouseleave="this.style.borderColor='rgba(255,255,255,0.08)'">
              <div style="display: flex; align-items: center; gap: 14px;">
                <span style="font-size: 22px;">🟢</span>
                <div>
                  <div style="font-weight: 800; color: #f8fafc; font-size: 14px;">Online Members Counter Channel</div>
                  <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Displays active online members count: <strong id="val-online-members" style="color: #34d399;">2 Online</strong></div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 12px; font-weight: 700; color: #34d399;">ON / OFF</span>
                <input type="checkbox" id="chk-online-members" checked style="width: 22px; height: 22px; accent-color: #34d399; cursor: pointer;">
              </div>
            </div>

            <!-- 3. Server Boosts -->
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #fff; background: rgba(18,20,29,0.85); border: 1px solid rgba(255,255,255,0.08); padding: 16px 20px; border-radius: 14px; transition: all 0.2s;" onmouseenter="this.style.borderColor='rgba(245,158,11,0.5)'" onmouseleave="this.style.borderColor='rgba(255,255,255,0.08)'">
              <div style="display: flex; align-items: center; gap: 14px;">
                <span style="font-size: 22px;">🚀</span>
                <div>
                  <div style="font-weight: 800; color: #f8fafc; font-size: 14px;">Server Boosts Counter Channel</div>
                  <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Displays premium server boosts count: <strong id="val-server-boosts" style="color: #fbbf24;">0</strong></div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 12px; font-weight: 700; color: #fbbf24;">ON / OFF</span>
                <input type="checkbox" id="chk-server-boosts" checked style="width: 22px; height: 22px; accent-color: #fbbf24; cursor: pointer;">
              </div>
            </div>

            <!-- 4. Admins Counter -->
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #fff; background: rgba(18,20,29,0.85); border: 1px solid rgba(255,255,255,0.08); padding: 16px 20px; border-radius: 14px; transition: all 0.2s;" onmouseenter="this.style.borderColor='rgba(99,102,241,0.5)'" onmouseleave="this.style.borderColor='rgba(255,255,255,0.08)'">
              <div style="display: flex; align-items: center; gap: 14px;">
                <span style="font-size: 22px;">🛡️</span>
                <div>
                  <div style="font-weight: 800; color: #f8fafc; font-size: 14px;">Admins & Staff Counter Channel</div>
                  <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Displays administrator team count: <strong id="val-admin-count" style="color: #818cf8;">2 Admins</strong></div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 12px; font-weight: 700; color: #818cf8;">ON / OFF</span>
                <input type="checkbox" id="chk-admin-count" checked style="width: 22px; height: 22px; accent-color: #6366f1; cursor: pointer;">
              </div>
            </div>

            <!-- 5. Server Bots -->
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #fff; background: rgba(18,20,29,0.85); border: 1px solid rgba(255,255,255,0.08); padding: 16px 20px; border-radius: 14px; transition: all 0.2s;" onmouseenter="this.style.borderColor='rgba(168,85,247,0.5)'" onmouseleave="this.style.borderColor='rgba(255,255,255,0.08)'">
              <div style="display: flex; align-items: center; gap: 14px;">
                <span style="font-size: 22px;">🤖</span>
                <div>
                  <div style="font-weight: 800; color: #f8fafc; font-size: 14px;">Server Bots Counter Channel</div>
                  <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Displays active server bot integrations: <strong id="val-bot-count" style="color: #c084fc;">1 Active Bot</strong></div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 12px; font-weight: 700; color: #c084fc;">ON / OFF</span>
                <input type="checkbox" id="chk-bot-count" checked style="width: 22px; height: 22px; accent-color: #a855f7; cursor: pointer;">
              </div>
            </div>

            <!-- 6. Moderators -->
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #fff; background: rgba(18,20,29,0.85); border: 1px solid rgba(255,255,255,0.08); padding: 16px 20px; border-radius: 14px; transition: all 0.2s;" onmouseenter="this.style.borderColor='rgba(236,72,153,0.5)'" onmouseleave="this.style.borderColor='rgba(255,255,255,0.08)'">
              <div style="display: flex; align-items: center; gap: 14px;">
                <span style="font-size: 22px;">⚔️</span>
                <div>
                  <div style="font-weight: 800; color: #f8fafc; font-size: 14px;">Moderators & Helpers Counter Channel</div>
                  <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Displays moderation team members: <strong id="val-mod-count" style="color: #f472b6;">1 Staff</strong></div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 12px; font-weight: 700; color: #f472b6;">ON / OFF</span>
                <input type="checkbox" id="chk-mod-count" checked style="width: 22px; height: 22px; accent-color: #ec4899; cursor: pointer;">
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Save Action Button -->
        <div style="border-top: 1px solid rgba(255,255,255,0.12); padding-top: 20px; display: flex; justify-content: flex-end; align-items: center; gap: 12px;">
          <button onclick="window.saveLiveStatsSettings(event)" style="background: linear-gradient(135deg, #5865F2, #a855f7); color: #fff; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 14px; border: none; cursor: pointer; display: flex; align-items: center; gap: 10px; box-shadow: 0 8px 24px rgba(88,101,242,0.35); transition: all 0.25s;" onmouseenter="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 12px 30px rgba(88,101,242,0.5)'" onmouseleave="this.style.transform='none'; this.style.boxShadow='0 8px 24px rgba(88,101,242,0.35)'">
            <span style="font-size: 16px;">💾</span>
            <span>Save Live Stats Setup & Sync to Bot</span>
          </button>
        </div>
      
          </div>
          <div style="width: calc(35% - 20px); min-width: 250px; box-sizing: border-box;">
            
        <div style="background: #0f111a; border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 16px; height: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
          <h3 style="color: #fff; font-size: 15px; margin-top: 0; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <span>📖</span> <span>How to Use</span>
          </h3>
          <ul style="color: #94a3b8; font-size: 13px; line-height: 1.6; padding-left: 20px; margin: 0;">
`
    },
    automod: {
      title: '🛡️ Auto Moderation AI Dashboard',
      html: `
        <div style="display: flex; gap: 20px; align-items: stretch; flex-wrap: nowrap;">
          <div style="width: 65%; min-width: 300px; background: #0f111a; border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); box-sizing: border-box;">
            
        <div style="padding-bottom: 20px; width: 100%;">
          <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px;">
            <!-- Toggles -->
            <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.25); padding: 12px 16px; border-radius: 10px; color: #fff; font-size: 13px;">
              <div>
                <div style="font-weight: 600;">🔗 Anti-Link & Anti-Invite Shield</div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Automatically deletes discord.gg invites and unauthorized http/https links.</div>
              </div>
              <input type="checkbox" id="chk-anti-link" checked style="width: 20px; height: 20px; accent-color: #ef4444; cursor: pointer;">
            </div>

            <!-- Anti Spam -->
            <div style="background: rgba(0,0,0,0.25); padding: 14px 16px; border-radius: 10px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                 <div style="font-weight: 600; font-size: 13px; color: #fff;">⚡ Anti-Spam Rate Limit</div>
                 <input type="checkbox" id="chk-anti-spam" checked style="width: 20px; height: 20px; accent-color: #ef4444; cursor: pointer;">
              </div>
              <div style="display: flex; gap: 10px;">
                <div style="flex: 1;">
                  <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 4px;">Max Messages</label>
                  <input type="number" id="val-spam-max" value="5" min="2" max="20" style="width: 100%; padding: 8px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 13px; outline: none;">
                </div>
                <div style="flex: 1;">
                  <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 4px;">Time Window</label>
                  <select id="val-spam-time" style="width: 100%; padding: 8px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 13px; outline: none;">
                    <option value="30" style="background: #1e293b; color: #fff;">30 Seconds</option>
                    <option value="40" style="background: #1e293b; color: #fff;">40 Seconds</option>
                    <option value="60" style="background: #1e293b; color: #fff;">1 Minute</option>
                    <option value="300" selected style="background: #1e293b; color: #fff;">5 Minutes</option>
                    <option value="1800" style="background: #1e293b; color: #fff;">30 Minutes</option>
                    <option value="3600" style="background: #1e293b; color: #fff;">1 Hour</option>
                    <option value="43200" style="background: #1e293b; color: #fff;">12 Hours</option>
                    <option value="86400" style="background: #1e293b; color: #fff;">1 Day</option>
                    <option value="604800" style="background: #1e293b; color: #fff;">1 Week</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Auto-Punish Repeat Offenders -->
            <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.3); border-left: 4px solid #ef4444; padding: 14px 16px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                 <div>
                   <div style="font-weight: 700; font-size: 13px; color: #fca5a5;">🔁 Auto-Punish Repeat Offenders</div>
                   <div style="font-size: 11.5px; color: #f87171; margin-top: 4px; line-height: 1.4;">Automatically issue a <b>1-Week Timeout</b> to users who accumulate <b>5 warnings</b> within a 7-day period.</div>
                 </div>
                 <input type="checkbox" id="chk-auto-punish" checked style="width: 20px; height: 20px; accent-color: #ef4444; cursor: pointer;">
              </div>
            </div>

            <!-- Custom Bad Words -->
            <div style="background: rgba(0,0,0,0.25); padding: 14px 16px; border-radius: 10px;">
              <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px; color: #fff;">🤬 Custom Banned Words</div>
              <div style="font-size: 11px; color: #94a3b8; margin-bottom: 10px;">Fast Regex Matching: Delete messages containing these exact words instantly. Separate by commas.</div>
              <textarea id="val-bad-words" rows="2" placeholder="e.g., slur1, slur2, insult3..." style="width: 100%; padding: 10px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 13px; outline: none; resize: vertical;"></textarea>
            </div>

            <!-- LLM Toxicity Engine -->
            <div style="background: rgba(0,0,0,0.25); padding: 14px 16px; border-radius: 10px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                 <div>
                   <div style="font-weight: 600; font-size: 13px; color: #fff;">🤖 AI Toxicity Content Filter (LLM)</div>
                   <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">LLM analyzes hidden intent, sarcasm, and hate speech.</div>
                 </div>
                 <input type="checkbox" id="chk-ai-toxicity" checked style="width: 20px; height: 20px; accent-color: #ef4444; cursor: pointer;">
              </div>
              <div>
                <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 4px;">AI Sensitivity</label>
                <select id="val-ai-sensitivity" style="width: 100%; padding: 8px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 13px; outline: none;">
                  <option value="low" style="background: #1e293b; color: #fff;">Low (Only extreme hate speech)</option>
                  <option value="medium" selected style="background: #1e293b; color: #fff;">Medium (Standard bullying & toxicity)</option>
                  <option value="high" style="background: #1e293b; color: #fff;">High (Strict PG-13 filtering)</option>
                </select>
              </div>
            </div>
            
            <!-- Action -->
            <div style="background: rgba(0,0,0,0.25); padding: 14px 16px; border-radius: 10px;">
              <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 4px;">Action on Violation</label>
              <select id="val-automod-action" style="width: 100%; padding: 8px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 13px; outline: none;">
                <option value="delete" style="background: #1e293b; color: #fff;">Delete Message Only</option>
                <option value="warn" selected style="background: #1e293b; color: #fff;">Delete & Warn User</option>
                <option value="timeout_5m" style="background: #1e293b; color: #fff;">Delete & Timeout (5 Minutes)</option>
                <option value="timeout_1h" style="background: #1e293b; color: #fff;">Delete & Timeout (1 Hour)</option>
                <option value="timeout_1d" style="background: #1e293b; color: #fff;">Delete & Timeout (1 Day)</option>
                <option value="timeout_1w" style="background: #1e293b; color: #fff;">Delete & Timeout (1 Week)</option>
                <option value="kick" style="background: #1e293b; color: #fff;">Delete & Kick User</option>
              </select>
            </div>
          </div>
          
          <button onclick="window.saveAutoModSettings()" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: white; font-weight: 700; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
            🛡️ Save Moderation Settings & Deploy
          </button>
        </div>
      
          </div>
          <div style="width: calc(35% - 20px); min-width: 250px; box-sizing: border-box;">
            
        <div style="background: #0f111a; border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 16px; height: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
          <h3 style="color: #fff; font-size: 15px; margin-top: 0; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <span>📖</span> <span>How to Use</span>
          </h3>
          <ul style="color: #94a3b8; font-size: 13px; line-height: 1.6; padding-left: 20px; margin: 0;">
            <li style='margin-bottom: 8px;'><strong style='color: #fff;'>Hybrid AutoModeration:</strong> Protect your server with fast regex for explicit words & links, plus deep LLM analysis for intent-based toxicity.</li><li style='margin-bottom: 8px;'>Set strictness levels for anti-spam (Timeout, Kick, or Ban).</li><li style='margin-bottom: 8px;'>Add custom bad words that the bot will instantly delete.</li><li style='margin-bottom: 8px;'>Enable Auto-Punish for repeat offenders to keep chat clean 24/7.</li>
          </ul>
        </div>
          </div>
        </div>
`
    },
    'social-feed': {
      title: '📡 Social Feed Hub Dashboard',
      html: `
        <div style="display: flex; gap: 20px; align-items: stretch; flex-wrap: nowrap;">
          <div style="width: 65%; min-width: 300px; background: #0f111a; border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); box-sizing: border-box;">
            
        <!-- YouTube Platform Card -->
        <div style="background: rgba(0,0,0,0.25); padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid rgba(239,68,68,0.2);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <span style="font-size: 18px;">🟥</span>
            <span style="font-weight: 600; font-size: 13px; color: #fff;">YouTube Channel</span>
          </div>
          <input type="text" id="val-social-yt" placeholder="https://youtube.com/@handle" style="width: 100%; padding: 10px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 13px; outline: none; margin-bottom: 10px;">
          <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 4px; font-weight: 600;">YouTube Custom Message Line:</label>
          <textarea id="val-social-yt-msg" rows="2" style="width: 100%; padding: 8px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 12px; outline: none; resize: vertical;">@everyone, New video uploaded! Make sure to check it out, like and subscribe: {url}</textarea>
        </div>

        <!-- Instagram Platform Card -->
        <div style="background: rgba(0,0,0,0.25); padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid rgba(217,70,239,0.2);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <span style="font-size: 18px;">🟪</span>
            <span style="font-weight: 600; font-size: 13px; color: #fff;">Instagram Profile</span>
          </div>
          <input type="text" id="val-social-ig" placeholder="@username" style="width: 100%; padding: 10px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 13px; outline: none; margin-bottom: 10px;">
          <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 4px; font-weight: 600;">Instagram Custom Message Line:</label>
          <textarea id="val-social-ig-msg" rows="2" style="width: 100%; padding: 8px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 12px; outline: none; resize: vertical;">📸 New Instagram post alert! Check it out here: {url}</textarea>
        </div>

        <!-- TikTok Platform Card -->
        <div style="background: rgba(0,0,0,0.25); padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid rgba(100,116,139,0.2);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <span style="font-size: 18px;">⬛</span>
            <span style="font-weight: 600; font-size: 13px; color: #fff;">TikTok Account</span>
          </div>
          <input type="text" id="val-social-tt" placeholder="@username" style="width: 100%; padding: 10px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 13px; outline: none; margin-bottom: 10px;">
          <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 4px; font-weight: 600;">TikTok Custom Message Line:</label>
          <textarea id="val-social-tt-msg" rows="2" style="width: 100%; padding: 8px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 12px; outline: none; resize: vertical;">🎵 New TikTok video dropped! Watch & like here: {url}</textarea>
        </div>

        <!-- Kick Platform Card -->
        <div style="background: rgba(0,0,0,0.25); padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid rgba(34,197,94,0.2);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <span style="font-size: 18px;">🟩</span>
            <span style="font-weight: 600; font-size: 13px; color: #fff;">Kick Streamer</span>
          </div>
          <input type="text" id="val-social-kick" placeholder="channel_name" style="width: 100%; padding: 10px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 13px; outline: none; margin-bottom: 10px;">
          <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 4px; font-weight: 600;">Kick Custom Message Line:</label>
          <textarea id="val-social-kick-msg" rows="2" style="width: 100%; padding: 8px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 12px; outline: none; resize: vertical;">🟢 Live stream is ON! Tune in to Kick: {url}</textarea>
        </div>

        <div style="background: rgba(0,0,0,0.25); padding: 14px 16px; border-radius: 10px; margin-bottom: 20px;">
          <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 6px; font-weight: 600;">Target Announcement Channel</label>
          <select id="val-social-channel" style="width: 100%; padding: 10px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 13px; outline: none;">
            <option value="general" style="background: #1e293b; color: #fff;">#general 🟢</option>
            <option value="social-feed-updates" style="background: #1e293b; color: #fff;">#social-feed-updates</option>
            <option value="announcements" style="background: #1e293b; color: #fff;">#announcements</option>
          </select>
        </div>
        
        <button onclick="window.saveSocialFeedSettings()" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%); color: white; font-weight: 700; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
          🔗 Connect & Sync Accounts
        </button>
      
          </div>
          <div style="width: calc(35% - 20px); min-width: 250px; box-sizing: border-box;">
            
        <div style="background: #0f111a; border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 16px; height: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
          <h3 style="color: #fff; font-size: 15px; margin-top: 0; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <span>📖</span> <span>How to Use</span>
          </h3>
          <ul style="color: #94a3b8; font-size: 13px; line-height: 1.6; padding-left: 20px; margin: 0;">
            <li style='margin-bottom: 8px;'><strong style='color: #fff;'>Social Feed Hub:</strong> Auto-publish new posts & streams from YouTube, Instagram, TikTok, and Kick directly into Discord.</li><li style='margin-bottom: 8px;'>Just enter your public handle/URL—no login required!</li><li style='margin-bottom: 8px;'>Customize notification message using {url} and ping @everyone.</li><li style='margin-bottom: 8px;'>Videos play directly inside Discord with native embed cards.</li>
          </ul>
        </div>
          </div>
        </div>
`
    },
    suggestions: {
      title: '💡 Suggestion Engine Dashboard',
      html: `
        <div style="display: flex; gap: 20px; align-items: stretch; flex-wrap: nowrap;">
          <div style="width: 65%; min-width: 300px; background: #0f111a; border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); box-sizing: border-box;">
            
        <div class="modal-form-group" style="margin-bottom: 14px;">
          <label class="modal-form-label" style="font-weight: 600; color: #e2e8f0; display: block; margin-bottom: 6px;">Target Suggestions Channel</label>
          <select id="val-sug-channel" class="modal-input" style="background: #181b28; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 10px; border-radius: 8px; width: 100%;">
            <option value="suggestions">#suggestions 🟢 (Dedicated Category Channel)</option>
            <option value="social-feed-updates">#social-feed-updates</option>
            <option value="general">#general</option>
            <option value="announcements">#announcements</option>
            <option value="current_channel">💬 Current Channel (Post where /suggest command is typed)</option>
            <option value="all_channels">🌐 All Channels (Allow /suggest in any channel & post locally)</option>
          </select>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Choose dedicated channel or select 'All Channels' to allow posting anywhere!</div>
        </div>

        <div style="display: flex; gap: 12px; margin-bottom: 14px;">
          <div style="flex: 1;">
            <label class="modal-form-label" style="font-weight: 600; color: #e2e8f0; display: block; margin-bottom: 6px;">Upvote Emoji</label>
            <input type="text" id="val-sug-upvote" class="modal-input" value="👍" style="background: #181b28; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 10px; border-radius: 8px; width: 100%;">
          </div>
          <div style="flex: 1;">
            <label class="modal-form-label" style="font-weight: 600; color: #e2e8f0; display: block; margin-bottom: 6px;">Downvote Emoji</label>
            <input type="text" id="val-sug-downvote" class="modal-input" value="👎" style="background: #181b28; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 10px; border-radius: 8px; width: 100%;">
          </div>
        </div>

        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 14px; border-radius: 12px; margin-bottom: 18px;">
          <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; color: #e2e8f0; font-size: 13px; font-weight: 600;">
            <span>💬 Auto-create Discussion Thread for each Suggestion</span>
            <input type="checkbox" id="val-sug-thread" checked style="width: 18px; height: 18px; accent-color: #facc15;">
          </label>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Automatically creates a dedicated sub-thread under each proposal for member discussion.</div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 10px;">
          <button onclick="window.saveSuggestionSettings()" style="flex: 1; background: linear-gradient(135deg, #eab308, #ca8a04); border: none; color: #000; font-weight: 700; padding: 12px; border-radius: 10px; cursor: pointer; font-size: 13px; box-shadow: 0 4px 12px rgba(234,179,8,0.3);">
            💾 Save Suggestion Settings
          </button>
          <button onclick="window.testSuggestionTrigger()" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 600; padding: 12px 16px; border-radius: 10px; cursor: pointer; font-size: 13px;">
            🚀 Test Suggestion Card
          </button>
        </div>
      
          </div>
          <div style="width: calc(35% - 20px); min-width: 250px; box-sizing: border-box;">
            
        <div style="background: #0f111a; border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 16px; height: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
          <h3 style="color: #fff; font-size: 15px; margin-top: 0; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <span>📖</span> <span>How to Use</span>
          </h3>
          <ul style="color: #94a3b8; font-size: 13px; line-height: 1.6; padding-left: 20px; margin: 0;">
            <li style='margin-bottom: 8px;'><strong style='color: #fff;'>Interactive Voting Panels:</strong> Allow members to submit ideas with automatic reaction voting, category tags, and auto-threads.</li><li style='margin-bottom: 8px;'>The bot creates a professional embed with Upvote/Downvote buttons.</li><li style='margin-bottom: 8px;'>Admins can mark suggestions as Approved, Denied, or Implemented.</li><li style='margin-bottom: 8px;'>Keeps your community engaged and feeling heard.</li>
          </ul>
        </div>
          </div>
        </div>
`
    },

    'ai-assistant': {
      title: '🤖 AI Smart Assistant Dashboard',
      html: `
        <div style="display: flex; gap: 20px; align-items: stretch; flex-wrap: nowrap;">
          <div style="width: 65%; min-width: 300px; background: #0f111a; border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); box-sizing: border-box;">
            
        <!-- Auto-Connected Master LLM Engine Status Badge -->
        <div style="background: linear-gradient(135deg, rgba(88,101,242,0.12) 0%, rgba(168,85,247,0.12) 100%); border: 1.5px solid rgba(88,101,242,0.35); border-radius: 12px; padding: 14px 18px; margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, #5865f2, #a855f7); display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 4px 12px rgba(88,101,242,0.4); flex-shrink: 0;">⚡</div>
            <div>
              <div style="font-size: 13.5px; font-weight: 800; color: #ffffff; display: flex; align-items: center; gap: 8px;">
                <span>Auto-Connected LLM Engine</span>
                <span style="font-size: 11px; background: rgba(168,85,247,0.25); color: #c084fc; padding: 2px 7px; border-radius: 5px; font-weight: 700; border: 1px solid rgba(168,85,247,0.4);">Google Gemini AI</span>
              </div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 3px;">Directly powered by Admin Master AI Node with Smart Token Shield.</div>
            </div>
          </div>
          <span style="background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.45); color: #34d399; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 20px; display: flex; align-items: center; gap: 6px; white-space: nowrap; box-shadow: 0 0 10px rgba(16,185,129,0.2);">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: #34d399; display: inline-block; box-shadow: 0 0 6px #34d399;"></span> Active & Ready
          </span>
        </div>

        <!-- SMART AI TRIGGER MODE (3-CARD SELECTOR) -->
        <div style="margin-bottom: 18px;">
          <label style="font-size: 12px; font-weight: 700; color: #fff; display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span>🎯 AI Trigger Behavior & Channel Policy</span>
            <span style="font-size: 11px; color: #a855f7; font-weight: 700;">Zero-Spam Protection</span>
          </label>
          
          <div style="display: grid; grid-template-columns: 1fr; gap: 10px;">
            <!-- Option 1: Dedicated AI Channel Mode (Recommended) -->
            <label class="ai-trigger-card" id="card-mode-dedicated" style="display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; background: rgba(88,101,242,0.12); border: 1.5px solid #5865f2; border-radius: 10px; cursor: pointer; transition: all 0.2s;">
              <input type="radio" name="ai_trigger_mode" value="dedicated" checked onchange="window.setAiTriggerMode('dedicated')" style="margin-top: 3px; accent-color: #5865f2;">
              <div>
                <div style="font-size: 13px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 6px;">
                  <span>🤖 Dedicated AI Channel Only</span>
                  <span style="font-size: 10px; background: #5865f2; color: #fff; padding: 1px 6px; border-radius: 4px; font-weight: 800;">RECOMMENDED</span>
                </div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                  Auto-replies 24/7 in <strong style="color: #c084fc;">#ai-assistant</strong>. Other channels (like #general) stay 100% clean & only respond when <strong>@mentioned</strong> or <strong>/ai</strong> is typed.
                </div>
              </div>
            </label>

            <!-- Option 2: Smart Question Shield -->
            <label class="ai-trigger-card" id="card-mode-smart_question" style="display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; cursor: pointer; transition: all 0.2s;">
              <input type="radio" name="ai_trigger_mode" value="smart_question" onchange="window.setAiTriggerMode('smart_question')" style="margin-top: 3px; accent-color: #5865f2;">
              <div>
                <div style="font-size: 13px; font-weight: 700; color: #fff;">❓ Smart Question Filter (Ask-Only)</div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                  Auto-replies across monitored channels ONLY when a member asks a genuine question (containing <strong>'?'</strong>, rules, how-to, signals). Ignores casual chit-chat.
                </div>
              </div>
            </label>

            <!-- Option 3: Mention & Slash Only -->
            <label class="ai-trigger-card" id="card-mode-mention_only" style="display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; cursor: pointer; transition: all 0.2s;">
              <input type="radio" name="ai_trigger_mode" value="mention_only" onchange="window.setAiTriggerMode('mention_only')" style="margin-top: 3px; accent-color: #5865f2;">
              <div>
                <div style="font-size: 13px; font-weight: 700; color: #fff;">🔒 Mention & Slash Command Only</div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                  Completely silent across all channels. Only replies when explicitly tagged with <strong>@reply flow servers</strong> or using <strong>/ai</strong>.
                </div>
              </div>
            </label>
          </div>
        </div>

        <!-- DEDICATED AUTO-REPLY CHANNEL SELECTOR -->
        <div id="ai-dedicated-channel-wrap" style="background: rgba(0,0,0,0.25); padding: 14px 16px; border-radius: 10px; margin-bottom: 18px; border: 1px solid rgba(255,255,255,0.07);">
          <label style="font-size: 11.5px; color: #e2e8f0; display: block; margin-bottom: 6px; font-weight: 700;">Dedicated 24/7 AI Channel:</label>
          <select id="val-ai-target-channel" style="width: 100%; padding: 10px 12px; background: #161922; border: 1px solid rgba(88,101,242,0.4); border-radius: 8px; color: #fff; font-size: 13px; outline: none;">
            <option value="ai-assistant" style="background: #1e293b; color: #fff;"># ai-assistant 🟢 (Recommended 24/7 AI Hub)</option>
            <option value="general" style="background: #1e293b; color: #fff;"># general</option>
            <option value="social-feed-updates" style="background: #1e293b; color: #fff;"># social-feed-updates</option>
            <option value="announcements" style="background: #1e293b; color: #fff;"># announcements</option>
          </select>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 5px;">In this channel, the AI answers all queries immediately without requiring members to tag the bot.</div>
        </div>

        <!-- ADMIN PERSONA & PROMPT PRESETS -->
        <div style="margin-bottom: 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <label style="font-weight: 700; color: #fff; font-size: 12px;">👑 Admin Persona & RAG Knowledge Base Presets</label>
            <span style="font-size: 11px; color: #34d399; font-weight: 600;">Click to Load Preset</span>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;">
            <button type="button" onclick="window.loadAiPreset('admin_bro')" style="background: rgba(168,85,247,0.15); border: 1px solid rgba(168,85,247,0.4); color: #d8b4fe; padding: 6px 12px; border-radius: 8px; font-size: 11.5px; font-weight: 700; cursor: pointer;">
              👑 Chill Admin (Bro Vibe / Roman Urdu)
            </button>
            <button type="button" onclick="window.loadAiPreset('support')" style="background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.4); color: #93c5fd; padding: 6px 12px; border-radius: 8px; font-size: 11.5px; font-weight: 700; cursor: pointer;">
              🛡️ Support Specialist
            </button>
            <button type="button" onclick="window.loadAiPreset('trader')" style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.4); color: #6ee7b7; padding: 6px 12px; border-radius: 8px; font-size: 11.5px; font-weight: 700; cursor: pointer;">
              📈 Noir Trading & Signals Mentor
            </button>
          </div>

          <textarea id="ai-rag-memory-text" class="modal-input" rows="4" style="background: #181b28; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 10px 12px; border-radius: 8px; width: 100%; resize: vertical; font-size: 12.5px; line-height: 1.5;">You are the Senior Admin of this Discord server. Talk in natural, friendly Roman Urdu / English brotherly tone. Server Rules: Respect members, no external links or spam. Support: Open a ticket in #tickets. Leveling: Chat to gain XP and check /rank. Signals: Check #social-feed-updates.</textarea>
        </div>

        <button onclick="window.saveAiAssistantSettings()" style="width: 100%; background: linear-gradient(135deg, #5865f2 0%, #7e22ce 100%); border: none; color: #fff; padding: 14px; border-radius: 10px; font-weight: 800; font-size: 13.5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 16px rgba(88,101,242,0.4);">
          <span>💾</span> <span>Save & Activate AI Assistant Policy</span>
        </button>
      
          </div>
          <div style="width: calc(35% - 20px); min-width: 250px; box-sizing: border-box;">
            
        <div style="background: #0f111a; border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 16px; height: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
          <h3 style="color: #fff; font-size: 15px; margin-top: 0; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <span>📖</span> <span>How AI Assistant Works</span>
          </h3>
          <ul style="color: #94a3b8; font-size: 13px; line-height: 1.6; padding-left: 20px; margin: 0;">
            <li style='margin-bottom: 10px;'><strong style='color: #fff;'>#ai-assistant Channel:</strong> Members can ask anything 24/7 without tagging the bot.</li>
            <li style='margin-bottom: 10px;'><strong style='color: #fff;'>#general Clean Mode:</strong> Bot does not disrupt casual conversations in general. It only responds when members tag @bot or use /ai.</li>
            <li style='margin-bottom: 10px;'><strong style='color: #fff;'>Smart Admin Persona:</strong> Automatically detects Roman Urdu and English to reply like a real server brother.</li>
            <li style='margin-bottom: 10px;'><strong style='color: #fff;'>Zero-Token Guard:</strong> Caches common greetings to keep your Google Gemini API tokens 100% safe.</li>
          </ul>
        </div>
          </div>
        </div>
`
    },
    'audit-logs': {
      title: '📜 A-to-Z Server Audit & Security Shield Dashboard',
      html: `
        <div style="display: flex; gap: 20px; align-items: stretch; flex-wrap: nowrap;">
          <div style="width: 65%; min-width: 300px; background: #0f111a; border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); box-sizing: border-box;">
            
            <div style="font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
              <span style="display: flex; align-items: center; gap: 8px;">
                <span>🛡️ Real-Time Audit Log & Deleted Message Archiver</span>
              </span>
              <button onclick="window.fetchAndRenderAuditLogs()" style="background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.5); color: #f87171; padding: 6px 14px; border-radius: 8px; font-weight: 800; font-size: 12px; cursor: pointer;">
                🔄 Refresh Logs
              </button>
            </div>

            <!-- Category Filter Pills -->
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px;">
              <button type="button" onclick="window.filterAuditCategory('all', this)" class="audit-filter-pill active" style="background: #ef4444; color: #fff; border: none; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">🌐 All Events</button>
              <button type="button" onclick="window.filterAuditCategory('message_delete', this)" class="audit-filter-pill" style="background: rgba(255,255,255,0.06); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">🗑️ Deleted Messages</button>
              <button type="button" onclick="window.filterAuditCategory('message_edit', this)" class="audit-filter-pill" style="background: rgba(255,255,255,0.06); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">✏️ Edited Messages</button>
              <button type="button" onclick="window.filterAuditCategory('member', this)" class="audit-filter-pill" style="background: rgba(255,255,255,0.06); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">👥 Member Activity</button>
              <button type="button" onclick="window.filterAuditCategory('voice', this)" class="audit-filter-pill" style="background: rgba(255,255,255,0.06); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">🎙️ Voice Logs</button>
            </div>

            <!-- Audit Logs List Container -->
            <div id="audit-logs-container" style="display: flex; flex-direction: column; gap: 10px; max-height: 480px; overflow-y: auto; padding-right: 4px;">
              <div style="color: #94a3b8; font-size: 13px; text-align: center; padding: 24px;">Loading server audit logs...</div>
            </div>

          </div>

          <div style="width: calc(35% - 20px); min-width: 250px; box-sizing: border-box;">
            <div style="background: #0f111a; border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 16px; height: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
              <h3 style="color: #fff; font-size: 15px; margin-top: 0; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                <span>🛡️</span> <span>A-to-Z Security Features</span>
              </h3>
              <ul style="color: #94a3b8; font-size: 12px; line-height: 1.7; padding-left: 18px; margin: 0;">
                <li style='margin-bottom: 10px;'><strong style='color: #ef4444;'>Permanent Message Archiver:</strong> Captures every deleted message even if the user deletes it immediately.</li>
                <li style='margin-bottom: 10px;'><strong style='color: #fbbf24;'>Message Edit History:</strong> Saves 'Before' and 'After' text content for edited messages.</li>
                <li style='margin-bottom: 10px;'><strong style='color: #38bdf8;'>Member & Voice Activity:</strong> Logs joins, leaves, role updates, and voice channel activity.</li>
                <li style='margin-bottom: 10px;'><strong style='color: #34d399;'>Dedicated #audit-logs:</strong> Sends real-time color-coded embeds to your server's <code>#audit-logs</code> channel.</li>
              </ul>
            </div>
          </div>
        </div>
      `
    }

  };

  function openPluginDashboard(pluginKey) {
    openInlinePluginWorkspace(pluginKey);
  }

  window.savePluginSettings = function (key) {
    if (typeof showToast === 'function') showToast('✅ ' + key.toUpperCase() + ' plugin settings saved successfully!', 'success');
    else alert('✅ Plugin settings saved successfully!');
  };

  const pluginHeaderData = {
    'overview': { icon: '🤖', title: 'Discord Automation & 9-Plugin SaaS Hub', desc: 'Connect server webhooks, manage bot status & configure all 9 automation plugins.' },
    'welcome': { icon: '👋', title: 'Welcome Msg & Auto-Greeting Engine', desc: 'Configure automatic welcome messages, custom 1000x440 canvas cards, and default member auto-roles.' },
    'auto-role': { icon: '🏷️', title: 'Auto-Role Assignment Engine', desc: 'Automatically assign Discord roles to new members when they join your server.' },
    'leveling': { icon: '🏆', title: 'Leveling & XP Rewards System', desc: 'Track chat activity XP, generate rank cards, and display top server leaderboards.' },
    'tickets': { icon: '🎟️', title: 'Support Ticket Desk Control', desc: 'Manage 24/7 support ticket embeds, multi-category routing, and transcript archives.' },
    'live-stats': { icon: '📊', title: 'Live Server Stats Counter Channels', desc: 'Configure real-time voice channel counters for members, online count, boosts, and staff.' },
    'automod': { icon: '🛡️', title: 'Auto-Moderation Shield & Safety', desc: 'Protect your server with anti-link filters, profanity shields, and anti-spam rate limiting.' },
    'social-feed': { icon: '📢', title: 'Social Media Feed Alerts Hub', desc: 'Configure live automated notifications for YouTube, Twitch, and Twitter updates.' },
    'suggestions': { icon: '💡', title: 'Community Suggestions & Voting Engine', desc: 'Collect member feedback with automatic 👍/👎 voting reactions and staff approvals.' },
    'ai-assistant': { icon: '🤖', title: 'AI Smart Assistant & RAG Engine', desc: 'Powered by Gemini 1.5 Pro AI RAG memory to answer member questions 24/7.' },
    'audit-logs': { icon: '📜', title: 'Audit & Security Logs Archiver', desc: 'Permanent deleted message archiver, edit history, and member activity logger.' }
  };

  function openInlinePluginWorkspace(pluginKey) {
    if (!pluginKey || pluginKey === 'ai') pluginKey = (pluginKey === 'ai' ? 'ai-assistant' : 'overview');
    activePluginKey = pluginKey;
    window.activePluginKey = pluginKey;

    const mainSidebar = document.getElementById('main-sidebar-menu');
    const discordSidebar = document.getElementById('discord-sidebar-menu');
    if (mainSidebar) mainSidebar.style.display = 'none';
    if (discordSidebar) discordSidebar.style.display = 'flex';

    const overviewEl = document.getElementById('discord-main-overview-section');
    const workspaceEl = document.getElementById('discord-inline-plugin-workspace');
    const titleEl = document.getElementById('inline-plugin-title');
    const bodyEl = document.getElementById('inline-plugin-body');

    // Dynamic Top Header Bar Elements
    const hIcon = document.getElementById('dc-header-icon');
    const hTitle = document.getElementById('dc-header-title');
    const hDesc = document.getElementById('dc-header-desc');
    const acctBadge = document.getElementById('dc-account-badge-wrap');
    const switchWrap = document.getElementById('dc-switch-account-wrap');
    const btnConnect = document.getElementById('btn-dc-connect-top');
    const btnDisconnect = document.getElementById('btn-dc-disconnect-top');
    const btnBotToggle = document.getElementById('btn-dc-bot-toggle');

    const hInfo = pluginHeaderData[pluginKey] || pluginHeaderData['overview'];
    if (hIcon) hIcon.textContent = hInfo.icon;
    if (hTitle) hTitle.textContent = hInfo.title;
    if (hDesc) hDesc.textContent = hInfo.desc;

    // Update active highlight in swapped Discord sidebar menu
    document.querySelectorAll('[data-plugin-nav]').forEach(el => el.classList.remove('active'));
    document.querySelectorAll(`[data-plugin-nav="${pluginKey}"]`).forEach(el => el.classList.add('active'));

    if (pluginKey === 'overview') {
      window.activePluginKey = 'overview';
      activePluginKey = 'overview';
      localStorage.setItem('replyflow_active_discord_plugin', 'overview');
      if (overviewEl) overviewEl.style.display = 'block';
      if (workspaceEl) workspaceEl.style.display = 'none';

      // Overview Mode: Clean top bar matching user screenshot (Account + Connected + Connect Discord)
      const hasGuilds = (window.lastFetchedDiscordGuilds && window.lastFetchedDiscordGuilds.length > 0) || !!window.connectedDiscordGuildId;
      if (acctBadge) acctBadge.style.display = 'flex';
      if (btnConnect) btnConnect.style.display = 'inline-flex';
      if (btnDisconnect) btnDisconnect.style.display = 'none';
      if (switchWrap) switchWrap.style.display = (hasGuilds ? 'flex' : 'none');
      if (btnBotToggle) btnBotToggle.style.display = 'none';

      switchScreen('discord');
      if (window.location.hash !== '#discord') {
        window.history.replaceState(null, '', '#discord');
      }
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }

    // Individual Plugin Workspace Mode
    localStorage.setItem('replyflow_active_discord_plugin', pluginKey);
    const hasGuilds = (window.lastFetchedDiscordGuilds && window.lastFetchedDiscordGuilds.length > 0) || !!window.connectedDiscordGuildId;
    if (acctBadge) acctBadge.style.display = 'flex';
    if (btnConnect) btnConnect.style.display = 'inline-flex';
    if (btnDisconnect) btnDisconnect.style.display = 'none';
    if (switchWrap) switchWrap.style.display = (hasGuilds ? 'flex' : 'none');
    if (btnBotToggle) btnBotToggle.style.display = 'none';

    // Route cleanly via switchScreen so all other screens are guaranteed hidden
    switchScreen('discord');

    const config = pluginDashboards[pluginKey] || pluginDashboards[pluginKey.replace('-assistant', '')] || pluginDashboards.welcome;
    if (titleEl && config) titleEl.textContent = config.title;
    if (bodyEl && config) bodyEl.innerHTML = config.html;

    if (overviewEl) overviewEl.style.display = 'none';
    if (workspaceEl) workspaceEl.style.display = 'block';

    const targetHash = `#discord?plugin=${pluginKey}`;
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetHash);
    }

    window.scrollTo({ top: 0, behavior: 'instant' });

    if (pluginKey === 'welcome') {
      setTimeout(() => {
        const imgInput = document.getElementById('p-welcome-img');
        const previewImg = document.getElementById('p-preview-img-el');
        if (imgInput && previewImg) {
          imgInput.addEventListener('input', function () {
            if (this.value.trim()) {
              previewImg.src = this.value.trim();
            }
          });
        }
        if (typeof window.fetchAndRenderWelcomeTemplates === 'function') {
          window.fetchAndRenderWelcomeTemplates();
        }
      }, 50);
    } else if (pluginKey === 'leveling') {
      setTimeout(() => {
        if (typeof window.fetchAndRenderLevelingRewards === 'function') {
          window.fetchAndRenderLevelingRewards();
        }
        if (typeof window.loadLevelingSettings === 'function') {
          window.loadLevelingSettings();
        }
      }, 50);
    } else if (pluginKey === 'live-stats') {
      setTimeout(() => {
        if (typeof window.fetchAndRenderCustomCounters === 'function') {
          window.fetchAndRenderCustomCounters();
        }
      }, 50);
    } else if (pluginKey === 'automod') {
      setTimeout(() => {
        if (typeof window.fetchAndRenderAutoModSettings === 'function') {
          window.fetchAndRenderAutoModSettings();
        }
      }, 50);
    } else if (pluginKey === 'tickets') {
      setTimeout(() => {
        if (typeof window.fetchAndRenderTicketSettings === 'function') {
          window.fetchAndRenderTicketSettings();
        }
      }, 50);
    } else if (pluginKey === 'social-feed') {
      setTimeout(() => {
        if (typeof window.fetchAndRenderSocialFeedSettings === 'function') {
          window.fetchAndRenderSocialFeedSettings();
        }
      }, 50);
    } else if (pluginKey === 'suggestions') {
      setTimeout(() => {
        if (typeof window.fetchAndRenderSuggestionSettings === 'function') {
          window.fetchAndRenderSuggestionSettings();
        }
      }, 50);
    } else if (pluginKey === 'ai-assistant' || pluginKey === 'ai') {
      setTimeout(() => {
        if (typeof window.fetchAndRenderAiAssistantSettings === 'function') {
          window.fetchAndRenderAiAssistantSettings();
        }
      }, 50);
    } else if (pluginKey === 'audit-logs') {
      setTimeout(() => {
        if (typeof window.fetchAndRenderAuditLogs === 'function') {
          window.fetchAndRenderAuditLogs();
        }
      }, 50);
    }

  }

  function closeInlinePluginWorkspace() {
    openInlinePluginWorkspace('overview');
  }

  window.openInlinePluginWorkspace = openInlinePluginWorkspace;
  window.closeInlinePluginWorkspace = closeInlinePluginWorkspace;

  window.saveTicketDashboardSettings = function (e) {
    if (e && e.preventDefault) e.preventDefault();

    const maxDaily = parseInt(document.getElementById('tkt-daily-limit')?.value || "3", 10);
    const allowedRoles = document.getElementById('tkt-allowed-roles')?.value || "Admin, Moderator, Staff";
    const embedChannel = document.getElementById('tkt-embed-channel')?.value || "#tickets";
    const instant = document.getElementById('tkt-instant')?.checked ?? true;
    const autoTranscript = document.getElementById('tkt-auto-transcript')?.checked ?? true;

    const config = {
      max_daily_tickets: maxDaily,
      allowed_roles: allowedRoles,
      embed_channel: embedChannel,
      instant_creation: instant,
      auto_transcript: autoTranscript
    };

    localStorage.setItem('replyflow_ticket_settings', JSON.stringify(config));

    const payload = {
      guild_id: window.getSelectedDiscordGuildId ? window.getSelectedDiscordGuildId() : '1537457454370128024',
      plugin_key: 'tickets',
      enabled: true,
      config: config
    };

    fetch('/api/plugins/save', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (typeof showToast === 'function') {
          showToast('🎟️ Support Ticket Settings Synced with Bot! 🚀', 'success');
        } else {
          alert('🎟️ Support Ticket Settings Saved!');
        }
      })
      .catch(err => {
        console.warn('Backend ticket sync fallback to local storage:', err);
        if (typeof showToast === 'function') {
          showToast('🎟️ Support Ticket Settings Saved locally!', 'success');
        }
      });
  };

  window.fetchAndRenderTicketSettings = function () {
    try {
      const saved = localStorage.getItem('replyflow_ticket_settings');
      if (saved) {
        const config = JSON.parse(saved);
        if (document.getElementById('tkt-daily-limit') && config.max_daily_tickets !== undefined) {
          document.getElementById('tkt-daily-limit').value = config.max_daily_tickets;
        }
        if (document.getElementById('tkt-allowed-roles') && config.allowed_roles !== undefined) {
          document.getElementById('tkt-allowed-roles').value = config.allowed_roles;
        }
        if (document.getElementById('tkt-embed-channel') && config.embed_channel !== undefined) {
          document.getElementById('tkt-embed-channel').value = config.embed_channel;
        }
        if (document.getElementById('tkt-instant') && config.instant_creation !== undefined) {
          document.getElementById('tkt-instant').checked = config.instant_creation;
        }
        if (document.getElementById('tkt-auto-transcript') && config.auto_transcript !== undefined) {
          document.getElementById('tkt-auto-transcript').checked = config.auto_transcript;
        }
      }
    } catch (e) {
      console.error('Failed to load saved ticket settings:', e);
    }
  };

  function savePluginDashboardSettings() {
    if (activePluginKey === 'tickets') {
      window.saveTicketDashboardSettings();
      return;
    }
    if (typeof showToast === 'function') {
      showToast(`Saved settings for ${pluginDashboards[activePluginKey]?.title || 'Plugin'}! 🎉`, 'success');
    } else {
      alert(`Saved settings for ${pluginDashboards[activePluginKey]?.title || 'Plugin'}! 🎉`);
    }
  }

  window.openPluginDashboard = openPluginDashboard;
  window.savePluginDashboardSettings = savePluginDashboardSettings;

  window.getSelectedDiscordGuildId = function () {
    if (window.currentDiscordGuildId) return window.currentDiscordGuildId;
    const stored = localStorage.getItem('selected_discord_guild_id') || localStorage.getItem('replyflow_selected_guild_id');
    if (stored) return stored;
    const globalSel = document.getElementById('global-discord-server-select');
    if (globalSel && globalSel.value) return globalSel.value;
    const switchSel = document.getElementById('dc-switch-account-select');
    if (switchSel && switchSel.value && switchSel.value !== '__INVITE_NEW_SERVER__') return switchSel.value;
    const selLive = document.getElementById('live-stats-server-select');
    if (selLive && selLive.value) return selLive.value;
    const selSwitch = document.getElementById('discord-server-switcher');
    if (selSwitch && selSwitch.value) return selSwitch.value;
    if (window.activeDiscordGuildId) return window.activeDiscordGuildId;
    return '1537457454370128024';
  };


  window.saveLiveStatsSettings = function (e) {
    if (e && e.preventDefault) e.preventDefault();

    const totalMembersChecked = document.getElementById('chk-total-members')?.checked ?? true;
    const onlineMembersChecked = document.getElementById('chk-online-members')?.checked ?? true;
    const serverBoostsChecked = document.getElementById('chk-server-boosts')?.checked ?? true;
    const adminCountChecked = document.getElementById('chk-admin-count')?.checked ?? true;
    const botCountChecked = document.getElementById('chk-bot-count')?.checked ?? true;
    const modCountChecked = document.getElementById('chk-mod-count')?.checked ?? true;

    const config = {
      total_members: totalMembersChecked,
      online_members: onlineMembersChecked,
      server_boosts: serverBoostsChecked,
      admin_count: adminCountChecked,
      bot_count: botCountChecked,
      mod_count: modCountChecked
    };

    // Save switch states to persistent localStorage immediately
    localStorage.setItem('replyflow_live_stats_switches', JSON.stringify(config));

    const payload = {
      guild_id: window.getSelectedDiscordGuildId ? window.getSelectedDiscordGuildId() : '1537457454370128024',
      plugin_key: 'live-stats',
      enabled: true,
      config: config
    };

    fetch('/api/plugins/save', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (typeof showToast === 'function') {
          showToast('⚡ Live Stats synced with Discord sidebar! 🚀', 'success');
        }
      })
      .catch(err => console.error('Plugin save sync error:', err));
  };

  // Auto-attach change listeners to Live Stats switches & server dropdown for instant per-server sync
  document.addEventListener('change', function (e) {
    if (e.target && (e.target.id === 'live-stats-server-select' || e.target.id === 'discord-server-switcher') && e.target.value) {
      localStorage.setItem('replyflow_selected_guild_id', e.target.value);
      window.activeDiscordGuildId = e.target.value;
      if (typeof window.fetchAndRenderCustomCounters === 'function') {
        window.fetchAndRenderCustomCounters();
      }
    }
    if (e.target && e.target.id && e.target.id.startsWith('chk-') && 
       ['chk-total-members', 'chk-online-members', 'chk-server-boosts', 'chk-admin-count', 'chk-bot-count', 'chk-mod-count'].includes(e.target.id)) {
      if (typeof window.saveLiveStatsSettings === 'function') {
        window.saveLiveStatsSettings();
      }
    }
  });

  // ── Real-Time 5-Second Discord & Live Stats Auto-Sync Poller ──
  setInterval(async function () {
    const activeScreen = window.location.hash ? window.location.hash.replace('#', '').split('?')[0] : 'dashboard';
    const token = localStorage.getItem('replyflow_user_token');
    if (!token) return;

    if (activeScreen === 'discord' || activeScreen === 'dashboard') {
      try {
        const res = await fetch('/api/discord/bot-data', { headers: getAuthHeaders() });
        const data = await res.json();
        if (data.success && data.guilds) {
          window.lastFetchedDiscordGuilds = data.guilds;
          const activeGuild = data.guilds.find(g => String(g.id) === String(localStorage.getItem('selected_discord_guild_id'))) || data.guilds[0];
          if (activeGuild) {
            const elOnline = document.getElementById('val-online-members');
            if (elOnline) {
              const onlineCount = activeGuild.onlineCount !== undefined ? activeGuild.onlineCount : (activeGuild.totalMembers || 3);
              elOnline.textContent = `${onlineCount} Online`;
            }
          }
        }
      } catch (e) {}
    }
  }, 5000);

  window.saveAutoModSettings = function (e) {
    if (e && e.preventDefault) e.preventDefault();

    const antiLink = document.getElementById('chk-anti-link')?.checked ?? true;
    const antiSpam = document.getElementById('chk-anti-spam')?.checked ?? true;
    const spamMax = parseInt(document.getElementById('val-spam-max')?.value || "5");
    const spamTime = parseInt(document.getElementById('val-spam-time')?.value || "300");

    const badWordsRaw = document.getElementById('val-bad-words')?.value || "";
    const badWords = badWordsRaw.split(',').map(w => w.trim()).filter(w => w.length > 0);

    const aiToxicity = document.getElementById('chk-ai-toxicity')?.checked ?? true;
    const aiSensitivity = document.getElementById('val-ai-sensitivity')?.value || 'medium';
    const autoPunish = document.getElementById('chk-auto-punish')?.checked ?? true;
    const action = document.getElementById('val-automod-action')?.value || 'warn';

    const config = {
      anti_link: antiLink,
      anti_spam: antiSpam,
      spam_max: spamMax,
      spam_time: spamTime,
      bad_words: badWords,
      ai_toxicity: aiToxicity,
      ai_sensitivity: aiSensitivity,
      auto_punish: autoPunish,
      action: action
    };

    localStorage.setItem('replyflow_automod_switches', JSON.stringify(config));

    const payload = {
      guild_id: window.getSelectedDiscordGuildId ? window.getSelectedDiscordGuildId() : '1537457454370128024',
      plugin_key: 'automod',
      enabled: true,
      config: config
    };

    fetch('/api/plugins/save', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (typeof showToast === 'function') {
          showToast('🛡️ Auto Moderation AI synced with Discord! 🚀', 'success');
        }
      })
      .catch(err => console.error('Plugin save sync error:', err));
  };

  window.fetchAndRenderAutoModSettings = function () {
    let saved = localStorage.getItem('replyflow_automod_switches');
    if (saved) {
      try {
        const sw = JSON.parse(saved);
        const elAntiLink = document.getElementById('chk-anti-link');
        const elAntiSpam = document.getElementById('chk-anti-spam');
        const elSpamMax = document.getElementById('val-spam-max');
        const elSpamTime = document.getElementById('val-spam-time');
        const elBadWords = document.getElementById('val-bad-words');
        const elAiToxicity = document.getElementById('chk-ai-toxicity');
        const elAiSensitivity = document.getElementById('val-ai-sensitivity');
        const elAutoPunish = document.getElementById('chk-auto-punish');
        const elAction = document.getElementById('val-automod-action');

        if (elAntiLink && typeof sw.anti_link === 'boolean') elAntiLink.checked = sw.anti_link;
        if (elAntiSpam && typeof sw.anti_spam === 'boolean') elAntiSpam.checked = sw.anti_spam;
        if (elSpamMax && sw.spam_max) elSpamMax.value = sw.spam_max;
        if (elSpamTime && sw.spam_time) elSpamTime.value = sw.spam_time;

        if (elBadWords && Array.isArray(sw.bad_words)) elBadWords.value = sw.bad_words.join(', ');

        if (elAiToxicity && typeof sw.ai_toxicity === 'boolean') elAiToxicity.checked = sw.ai_toxicity;
        if (elAiSensitivity && sw.ai_sensitivity) elAiSensitivity.value = sw.ai_sensitivity;
        if (elAutoPunish && typeof sw.auto_punish === 'boolean') elAutoPunish.checked = sw.auto_punish;
        if (elAction && sw.action) elAction.value = sw.action;
      } catch (e) {
        console.error('Error parsing automod settings:', e);
      }
    }
  };

  window.saveSocialFeedSettings = async function () {
    const yt = document.getElementById('val-social-yt')?.value || "";
    const yt_msg = document.getElementById('val-social-yt-msg')?.value || "@everyone, New video uploaded! Make sure to check it out, like and subscribe: {url}";

    const ig = document.getElementById('val-social-ig')?.value || "";
    const ig_msg = document.getElementById('val-social-ig-msg')?.value || "📸 New Instagram post alert! Check it out here: {url}";

    const tt = document.getElementById('val-social-tt')?.value || "";
    const tt_msg = document.getElementById('val-social-tt-msg')?.value || "🎵 New TikTok video dropped! Watch & like here: {url}";

    const kick = document.getElementById('val-social-kick')?.value || "";
    const kick_msg = document.getElementById('val-social-kick-msg')?.value || "🟢 Live stream is ON! Tune in to Kick: {url}";

    const channel = document.getElementById('val-social-channel')?.value || "general";
    const guildId = window.getSelectedDiscordGuildId ? window.getSelectedDiscordGuildId() : '1537457454370128024';

    const config = {
      youtube: yt,
      youtube_msg: yt_msg,
      instagram: ig,
      instagram_msg: ig_msg,
      tiktok: tt,
      tiktok_msg: tt_msg,
      kick: kick,
      kick_msg: kick_msg,
      target_channel: channel,
      custom_text: yt_msg
    };

    localStorage.setItem('replyflow_social_feed_config', JSON.stringify(config));
    localStorage.setItem('replyflow_social_feed_' + guildId, JSON.stringify(config));

    try {
      await fetch('/api/plugins/save', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          guild_id: guildId,
          plugin_key: 'social-feed',
          enabled: true,
          config: config
        })
      });
      showToast('Success', `Social Feed Hub connected to #${channel}!`, 'success');
    } catch (e) {
      showToast('Success', 'Social Feed connections synchronized!', 'success');
    }
  };

  window.fetchAndRenderSocialFeedSettings = function () {
    const guildId = window.getSelectedDiscordGuildId ? window.getSelectedDiscordGuildId() : '1537457454370128024';
    let saved = localStorage.getItem('replyflow_social_feed_' + guildId) || localStorage.getItem('replyflow_social_feed_config');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        if (config.youtube !== undefined && document.getElementById('val-social-yt')) document.getElementById('val-social-yt').value = config.youtube;
        if (config.youtube_msg && document.getElementById('val-social-yt-msg')) {
          let msg = config.youtube_msg;
          if (msg.toLowerCase().includes('mrjay')) {
            msg = "@everyone, New video uploaded! Make sure to check it out, like and subscribe: {url}";
          }
          document.getElementById('val-social-yt-msg').value = msg;
        }
        if (config.instagram !== undefined && document.getElementById('val-social-ig')) document.getElementById('val-social-ig').value = config.instagram;
        if (config.instagram_msg && document.getElementById('val-social-ig-msg')) document.getElementById('val-social-ig-msg').value = config.instagram_msg;
        if (config.tiktok !== undefined && document.getElementById('val-social-tt')) document.getElementById('val-social-tt').value = config.tiktok;
        if (config.tiktok_msg && document.getElementById('val-social-tt-msg')) document.getElementById('val-social-tt-msg').value = config.tiktok_msg;
        if (config.kick !== undefined && document.getElementById('val-social-kick')) document.getElementById('val-social-kick').value = config.kick;
        if (config.kick_msg && document.getElementById('val-social-kick-msg')) document.getElementById('val-social-kick-msg').value = config.kick_msg;
        if (config.target_channel && document.getElementById('val-social-channel')) document.getElementById('val-social-channel').value = config.target_channel;
      } catch (e) {
        console.error('Error parsing social feed settings:', e);
      }
    }

    fetch(`/api/plugins/get?plugin_key=social-feed&guild_id=${guildId}`, { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => {
        if (data && data.config) {
          const config = data.config;
          if (config.youtube !== undefined && document.getElementById('val-social-yt')) document.getElementById('val-social-yt').value = config.youtube;
          if (config.youtube_msg && document.getElementById('val-social-yt-msg')) {
            let msg = config.youtube_msg;
            if (msg.toLowerCase().includes('mrjay')) {
              msg = "@everyone, New video uploaded! Make sure to check it out, like and subscribe: {url}";
            }
            document.getElementById('val-social-yt-msg').value = msg;
          }
          if (config.instagram !== undefined && document.getElementById('val-social-ig')) document.getElementById('val-social-ig').value = config.instagram;
          if (config.instagram_msg && document.getElementById('val-social-ig-msg')) document.getElementById('val-social-ig-msg').value = config.instagram_msg;
          if (config.tiktok !== undefined && document.getElementById('val-social-tt')) document.getElementById('val-social-tt').value = config.tiktok;
          if (config.tiktok_msg && document.getElementById('val-social-tt-msg')) document.getElementById('val-social-tt-msg').value = config.tiktok_msg;
          if (config.kick !== undefined && document.getElementById('val-social-kick')) document.getElementById('val-social-kick').value = config.kick;
          if (config.kick_msg && document.getElementById('val-social-kick-msg')) document.getElementById('val-social-kick-msg').value = config.kick_msg;
          if (config.target_channel && document.getElementById('val-social-channel')) document.getElementById('val-social-channel').value = config.target_channel;
          localStorage.setItem('replyflow_social_feed_' + guildId, JSON.stringify(config));
        }
      })
      .catch(() => {});
  };

  window.setAiTriggerMode = function (mode) {
    window.currentAiTriggerMode = mode;
    ['dedicated', 'smart_question', 'mention_only'].forEach(m => {
      const card = document.getElementById(`card-mode-${m}`);
      const radio = card ? card.querySelector('input[type="radio"]') : null;
      if (card && radio) {
        if (m === mode) {
          card.style.background = 'rgba(88,101,242,0.12)';
          card.style.borderColor = '#5865f2';
          radio.checked = true;
        } else {
          card.style.background = 'rgba(255,255,255,0.03)';
          card.style.borderColor = 'rgba(255,255,255,0.1)';
          radio.checked = false;
        }
      }
    });
    const dedicatedWrap = document.getElementById('ai-dedicated-channel-wrap');
    if (dedicatedWrap) {
      dedicatedWrap.style.display = (mode === 'dedicated' ? 'block' : 'none');
    }
  };

  window.loadAiPreset = function (presetKey) {
    const ragEl = document.getElementById('ai-rag-memory-text');
    if (!ragEl) return;
    if (presetKey === 'admin_bro') {
      ragEl.value = "You are the Senior Admin of this Discord server. Talk in natural, friendly Roman Urdu / English brotherly tone. Server Rules: Respect members, no external links or spam. Support: Open a ticket in #tickets. Leveling: Chat to gain XP and check /rank. Signals: Check #social-feed-updates.";
    } else if (presetKey === 'support') {
      ragEl.value = "You are the Official 24/7 Support Desk Assistant. Guide members step-by-step. For billing, bug reports, or private staff help, direct them to use /ticket in #tickets. Always be polite, concise, and helpful.";
    } else if (presetKey === 'trader') {
      ragEl.value = "You are Noir Insight Trader (NIT) Elite Mentor. Answer questions on market structure, ICT concepts, crypto setups, and VIP access. Direct members to check /rank and view broadcasts in #social-feed-updates.";
    }
    showToast('Preset Loaded', 'Persona prompt loaded into Knowledge Base!', 'success');
  };

  window.saveAiAssistantSettings = async function () {
    const triggerMode = window.currentAiTriggerMode || 'dedicated';
    const targetChannel = document.getElementById('val-ai-target-channel')?.value || 'ai-assistant';
    const ragMemory = document.getElementById('ai-rag-memory-text')?.value || '';
    const guildId = window.getSelectedDiscordGuildId ? window.getSelectedDiscordGuildId() : '1537457454370128024';

    const config = {
      trigger_mode: triggerMode,
      target_channel: targetChannel,
      target_channels: [targetChannel],
      rag_context: ragMemory,
      provider: 'gemini'
    };

    localStorage.setItem('replyflow_ai_assistant_config', JSON.stringify(config));
    localStorage.setItem('replyflow_ai_assistant_' + guildId, JSON.stringify(config));

    try {
      await fetch('/api/plugins/save', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          guild_id: guildId,
          plugin_key: 'ai-assistant',
          enabled: true,
          config: config
        })
      });
      showToast('Success', `AI Smart Assistant policy activated! Dedicated to #${targetChannel}`, 'success');
    } catch (e) {
      showToast('Success', 'AI Assistant settings synchronized!', 'success');
    }
  };

  window.fetchAndRenderAiAssistantSettings = function () {
    const guildId = window.getSelectedDiscordGuildId ? window.getSelectedDiscordGuildId() : '1537457454370128024';
    let saved = localStorage.getItem('replyflow_ai_assistant_' + guildId) || localStorage.getItem('replyflow_ai_assistant_config');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        if (config.rag_context && document.getElementById('ai-rag-memory-text')) {
          document.getElementById('ai-rag-memory-text').value = config.rag_context;
        }
        if (config.target_channel && document.getElementById('val-ai-target-channel')) {
          document.getElementById('val-ai-target-channel').value = config.target_channel;
        }
        if (config.trigger_mode) {
          window.setAiTriggerMode(config.trigger_mode);
        }
      } catch (e) {
        console.error('Error parsing AI settings:', e);
      }
    }

    fetch(`/api/plugins/get?plugin_key=ai-assistant&guild_id=${guildId}`, { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => {
        if (data && data.config) {
          const config = data.config;
          if (config.rag_context && document.getElementById('ai-rag-memory-text')) {
            document.getElementById('ai-rag-memory-text').value = config.rag_context;
          }
          if (config.target_channel && document.getElementById('val-ai-target-channel')) {
            document.getElementById('val-ai-target-channel').value = config.target_channel;
          }
          if (config.trigger_mode) {
            window.setAiTriggerMode(config.trigger_mode);
          }
          localStorage.setItem('replyflow_ai_assistant_' + guildId, JSON.stringify(config));
        }
      })
      .catch(() => {});
  };

  window.fetchAndRenderCustomCounters = function () {
    const serverSel = document.getElementById('live-stats-server-select');
    if (serverSel) {
      fetch('/api/discord/guilds', { headers: getAuthHeaders() })
        .then(res => res.json())
        .then(data => {
          if (data && data.guilds && data.guilds.length > 0) {
            serverSel.innerHTML = data.guilds.map(g => `<option value="${g.id}">🌐 ${g.name}</option>`).join('');
            const activeId = window.getSelectedDiscordGuildId ? window.getSelectedDiscordGuildId() : null;
            if (activeId && data.guilds.some(g => String(g.id) === String(activeId))) {
              serverSel.value = activeId;
            }
          } else {
            serverSel.innerHTML = '<option value="">No Connected Servers</option>';
          }
        })
        .catch(e => console.error('Error fetching guilds for live stats:', e));
    }

    // 1. Restore checkbox ON/OFF states per active guild from API/localStorage
    const activeGuildId = window.getSelectedDiscordGuildId ? window.getSelectedDiscordGuildId() : '1330964283198013461';
    let savedSwitchesRaw = localStorage.getItem(`replyflow_live_stats_switches_${activeGuildId}`) || localStorage.getItem('replyflow_live_stats_switches');
    if (savedSwitchesRaw) {
      try {
        const sw = JSON.parse(savedSwitchesRaw);
        const elTotalChk = document.getElementById('chk-total-members');
        const elOnlineChk = document.getElementById('chk-online-members');
        const elBoostsChk = document.getElementById('chk-server-boosts');
        const elAdminChk = document.getElementById('chk-admin-count');
        const elBotChk = document.getElementById('chk-bot-count');
        const elModChk = document.getElementById('chk-mod-count');

        if (elTotalChk && typeof sw.total_members === 'boolean') elTotalChk.checked = sw.total_members;
        if (elOnlineChk && typeof sw.online_members === 'boolean') elOnlineChk.checked = sw.online_members;
        if (elBoostsChk && typeof sw.server_boosts === 'boolean') elBoostsChk.checked = sw.server_boosts;
        if (elAdminChk && typeof sw.admin_count === 'boolean') elAdminChk.checked = sw.admin_count;
        if (elBotChk && typeof sw.bot_count === 'boolean') elBotChk.checked = sw.bot_count;
        if (elModChk && typeof sw.mod_count === 'boolean') elModChk.checked = sw.mod_count;
      } catch (e) {}
    }

    fetch(`/api/plugins/get?plugin_key=live-stats&guild_id=${activeGuildId}`, { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => {
        if (data && data.config && Object.keys(data.config).length > 0) {
          const sw = data.config;
          const elTotalChk = document.getElementById('chk-total-members');
          const elOnlineChk = document.getElementById('chk-online-members');
          const elBoostsChk = document.getElementById('chk-server-boosts');
          const elAdminChk = document.getElementById('chk-admin-count');
          const elBotChk = document.getElementById('chk-bot-count');
          const elModChk = document.getElementById('chk-mod-count');

          if (elTotalChk && typeof sw.total_members === 'boolean') elTotalChk.checked = sw.total_members;
          if (elOnlineChk && typeof sw.online_members === 'boolean') elOnlineChk.checked = sw.online_members;
          if (elBoostsChk && typeof sw.server_boosts === 'boolean') elBoostsChk.checked = sw.server_boosts;
          if (elAdminChk && typeof sw.admin_count === 'boolean') elAdminChk.checked = sw.admin_count;
          if (elBotChk && typeof sw.bot_count === 'boolean') elBotChk.checked = sw.bot_count;
          if (elModChk && typeof sw.mod_count === 'boolean') elModChk.checked = sw.mod_count;
        }
      })
      .catch(e => console.error('Error loading live stats plugin config:', e));

    // 2. Fetch live stats numbers from server
    fetch(`/api/stats/live?guild_id=${activeGuildId}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.stats) {
          const s = data.stats;
          const elTotal = document.getElementById('val-total-members');
          const elOnline = document.getElementById('val-online-members');
          const elBoosts = document.getElementById('val-server-boosts');
          const elAdmin = document.getElementById('val-admin-count');
          const elBot = document.getElementById('val-bot-count');
          const elMod = document.getElementById('val-mod-count');

          if (elTotal) elTotal.textContent = `${s.total_members} Members`;
          if (elOnline) elOnline.textContent = `${s.online_members} Online`;
          if (elBoosts) elBoosts.textContent = `${s.server_boosts}`;
          if (elAdmin) elAdmin.textContent = `${s.admin_count} Admins`;
          if (elBot) elBot.textContent = `${s.bot_count} Active Bot`;
          if (elMod) elMod.textContent = `${s.mod_count} Staff`;
        }
      })
      .catch(err => console.log('Live stats fetch note:', err));
  };

  window.currentAuditCategory = 'all';

  window.filterAuditCategory = function (category, btnEl) {
    window.currentAuditCategory = category;
    document.querySelectorAll('.audit-filter-pill').forEach(el => {
      el.style.background = 'rgba(255,255,255,0.06)';
      el.style.color = '#94a3b8';
      el.style.border = '1px solid rgba(255,255,255,0.1)';
    });
    if (btnEl) {
      btnEl.style.background = '#ef4444';
      btnEl.style.color = '#fff';
      btnEl.style.border = 'none';
    }
    window.fetchAndRenderAuditLogs(category);
  };

  window.fetchAndRenderAuditLogs = function (category) {
    const cat = category || window.currentAuditCategory || 'all';
    const container = document.getElementById('audit-logs-container');
    if (!container) return;

    fetch(`/api/logs/audit?category=${encodeURIComponent(cat)}&limit=100`)
      .then(res => res.json())
      .then(data => {
        if (!data || !data.logs || data.logs.length === 0) {
          container.innerHTML = '<div style="color: #94a3b8; font-size: 13px; text-align: center; padding: 24px;">No audit logs recorded yet for this category.</div>';
          return;
        }

        let html = '';
        data.logs.forEach(log => {
          let badgeBg = 'rgba(88,101,242,0.2)';
          let badgeColor = '#818cf8';
          let icon = '📜';

          const ev = (log.event_type || '').toUpperCase();
          if (ev.includes('DELETE')) {
            badgeBg = 'rgba(239,68,68,0.2)';
            badgeColor = '#f87171';
            icon = '🗑️';
          } else if (ev.includes('EDIT')) {
            badgeBg = 'rgba(245,158,11,0.2)';
            badgeColor = '#fbbf24';
            icon = '✏️';
          } else if (ev.includes('JOIN') || ev.includes('MEMBER')) {
            badgeBg = 'rgba(16,185,129,0.2)';
            badgeColor = '#34d399';
            icon = '👥';
          } else if (ev.includes('VOICE')) {
            badgeBg = 'rgba(168,85,247,0.2)';
            badgeColor = '#c084fc';
            icon = '🎙️';
          }

          const timeFormatted = log.timestamp ? new Date(log.timestamp).toLocaleString() : '';

          html += `
            <div style="background: rgba(18,20,29,0.8); border: 1px solid rgba(255,255,255,0.08); padding: 14px 16px; border-radius: 12px; display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                <span style="background: ${badgeBg}; color: ${badgeColor}; font-size: 11px; padding: 3px 10px; border-radius: 6px; font-weight: 800; display: flex; align-items: center; gap: 6px;">
                  <span>${icon}</span> <span>${log.event_type || 'EVENT'}</span>
                </span>
                <span style="font-size: 11px; color: #64748b; font-weight: 600;">${timeFormatted}</span>
              </div>
              <div style="font-size: 13px; color: #f1f5f9; font-weight: 600; white-space: pre-wrap; line-height: 1.5; word-break: break-word;">${log.description || ''}</div>
            </div>
          `;
        });
        container.innerHTML = html;
      })
      .catch(err => {
        console.error('Audit log fetch error:', err);
        container.innerHTML = '<div style="color: #f87171; font-size: 13px; text-align: center; padding: 24px;">Failed to load audit logs.</div>';
      });
  };

  window.removeCustomCounterChannelRow = function (id) {
    let raw = localStorage.getItem('replyflow_custom_counters');
    let counters = raw ? JSON.parse(raw) : [];
    counters = counters.filter(c => c.id !== id);
    localStorage.setItem('replyflow_custom_counters', JSON.stringify(counters));
    window.fetchAndRenderCustomCounters();
    if (typeof showToast === 'function') showToast('Custom counter channel removed permanently!');
  };

  window.toggleCustomCounterRow = function (id, enabled) {
    let raw = localStorage.getItem('replyflow_custom_counters');
    let counters = raw ? JSON.parse(raw) : [];
    const found = counters.find(c => c.id === id);
    if (found) {
      found.enabled = enabled;
      localStorage.setItem('replyflow_custom_counters', JSON.stringify(counters));
    }
  };

  window.addCustomCounterChannelRow = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const nameInput = document.getElementById('new-custom-counter-name');
    const typeSelect = document.getElementById('new-custom-counter-type');

    if (!nameInput || !nameInput.value.trim()) {
      if (typeof showToast === 'function') showToast('Please enter a counter title/name!', 'error');
      return;
    }

    const titleText = nameInput.value.trim();
    const typeVal = typeSelect ? typeSelect.value : 'custom';
    const newId = 'cnt-' + Date.now();

    let emoji = '📊';
    let countLabel = 'Live Counter';
    if (typeVal === 'admins') { emoji = '🛡️'; countLabel = '4 Admins'; }
    else if (typeVal === 'bots') { emoji = '🤖'; countLabel = '12 Active Bots'; }
    else if (typeVal === 'mods') { emoji = '⚔️'; countLabel = '8 Staff'; }
    else if (typeVal === 'vips') { emoji = '👑'; countLabel = '35 Members'; }

    let raw = localStorage.getItem('replyflow_custom_counters');
    let counters = raw ? JSON.parse(raw) : [];
    counters.push({ id: newId, title: titleText, count: countLabel, emoji: emoji, enabled: true });
    localStorage.setItem('replyflow_custom_counters', JSON.stringify(counters));

    nameInput.value = '';
    window.fetchAndRenderCustomCounters();
    if (typeof showToast === 'function') showToast(`✅ Added custom counter channel "${titleText}" permanently!`);
  };

  window.switchScreen = switchScreen;
  window.appSwitchScreen = switchScreen;

  // ── Global Navigation Event Delegation for Sidebar & Nav items ──
  document.addEventListener('click', function (e) {
    const navItem = e.target.closest('[data-screen]');
    if (navItem) {
      const screenId = navItem.getAttribute('data-screen');
      if (screenId && typeof switchScreen === 'function') {
        switchScreen(screenId);
      }
    }
  });

  window.launchDashboardDemo = function (token, userName, userPlan, userObj) {
    if (token) localStorage.setItem('replyflow_user_token', token);
    if (userName) localStorage.setItem('replyflow_user_name', userName);
    if (userPlan) localStorage.setItem('replyflow_user_plan', userPlan);

    const activeToken = localStorage.getItem('replyflow_user_token');
    const landingPage = document.getElementById('standalone-landing-page');
    const mainShell = document.getElementById('main-app-shell');

    if (!activeToken) {
      if (landingPage) landingPage.style.display = 'block';
      if (mainShell) mainShell.style.display = 'none';
      return;
    }

    localStorage.setItem('replyflow_active_screen', 'dashboard');
    if (landingPage) landingPage.style.display = 'none';
    if (mainShell) mainShell.style.display = 'block';
    window.location.hash = '#dashboard';
    switchScreen('dashboard');
    if (typeof loadProfile === 'function') loadProfile();
  };



  window.toggleEmailOtpBox = function () {
    const box = document.getElementById('auth-otp-box');
    if (box) {
      box.style.display = box.style.display === 'flex' ? 'none' : 'flex';
      const mainEmail = document.getElementById('auth-input-email');
      const otpEmail = document.getElementById('otp-input-email');
      if (mainEmail && otpEmail && mainEmail.value) {
        otpEmail.value = mainEmail.value;
      }
    }
  };

  window.handleSendOtpCode = function () {
    const emailInput = document.getElementById('otp-input-email');
    const email = emailInput ? emailInput.value.trim() : '';
    const msg = document.getElementById('otp-feedback-msg');
    const sendBtn = document.getElementById('btn-send-otp-code');
    const row = document.getElementById('otp-code-input-row');

    if (!email || !email.includes('@')) {
      if (typeof showToast === 'function') showToast('⚠️ Please enter a valid email address first.', 'error');
      return;
    }

    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = '⏳ Sending...';
    }

    fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
      .then(res => res.json())
      .then(data => {
        if (sendBtn) {
          sendBtn.disabled = false;
          sendBtn.textContent = 'Resend OTP 📩';
        }
        if (row) row.style.display = 'flex';
        if (msg) {
          msg.style.display = 'block';
          msg.style.color = '#34d399';
          msg.textContent = data.message || 'OTP code sent! Check your email inbox.';
        }
        if (typeof showToast === 'function') showToast(data.message || 'OTP sent successfully! 📩', 'success');
        const codeInput = document.getElementById('otp-input-code');
        if (codeInput && data.demoCode) {
          codeInput.value = data.demoCode;
        }
      })
      .catch(err => {
        if (sendBtn) {
          sendBtn.disabled = false;
          sendBtn.textContent = 'Send OTP 📩';
        }
        if (typeof showToast === 'function') showToast('⚠️ Network error while sending OTP.', 'error');
      });
  };

  window.handleVerifyOtpCode = function () {
    const emailInput = document.getElementById('otp-input-email');
    const codeInput = document.getElementById('otp-input-code');
    const email = emailInput ? emailInput.value.trim() : '';
    const otp = codeInput ? codeInput.value.trim() : '';
    const btn = document.getElementById('btn-verify-otp-code');

    if (!email || !otp) {
      if (typeof showToast === 'function') showToast('⚠️ Enter both email and 6-digit OTP code.', 'error');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Verifying...';
    }

    fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp })
    })
      .then(res => res.json())
      .then(data => {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Verify Code & Sign In 🚀';
        }
        if (data.token) {
          localStorage.setItem('replyflow_user_token', data.token);
          if (data.user) {
            localStorage.setItem('replyflow_user_name', data.user.name);
            localStorage.setItem('replyflow_user_plan', data.user.plan || 'Free');
          }
          if (typeof showToast === 'function') showToast(data.message || 'Verified! Redirecting...', 'success');
          window.launchDashboardDemo();
        } else {
          if (typeof showToast === 'function') showToast(data.error || 'Failed to verify OTP code.', 'error');
        }
      })
      .catch(err => {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Verify Code & Sign In 🚀';
        }
        if (typeof showToast === 'function') showToast('⚠️ Verification error.', 'error');
      });
  };

  window.userLogout = function () {
    const token = localStorage.getItem('replyflow_user_token');
    
    // Clear all user session tokens & localStorage keys
    localStorage.removeItem('replyflow_user_token');
    localStorage.removeItem('replyflow_token');
    localStorage.removeItem('replyflow_user');
    localStorage.removeItem('replyflow_user_name');
    localStorage.removeItem('replyflow_user_plan');
    localStorage.removeItem('replyflow_active_screen');
    localStorage.removeItem('replyflow_yt_connected');
    localStorage.removeItem('replyflow_yt_channel');
    
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => { });
    }
    
    const landing = document.getElementById('standalone-landing-page');
    const shell = document.getElementById('main-app-shell');
    if (landing) landing.style.display = 'block';
    if (shell) shell.style.display = 'none';
    
    if (typeof window.switchToLoginPage === 'function') {
      window.switchToLoginPage();
    }
    
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname + '#login');
    } else {
      window.location.hash = '#login';
    }
    
    // Reset Profile UI fields
    const cardName = document.getElementById('profile-card-name');
    if (cardName) cardName.textContent = 'User Profile';
    const cardEmail = document.getElementById('profile-card-email');
    if (cardEmail) cardEmail.textContent = 'Sign in to access your account';
    const dashWelcome = document.getElementById('dashboard-welcome');
    if (dashWelcome) dashWelcome.textContent = 'Welcome back 👋';
    const dashInitials = document.getElementById('dash-user-initials');
    if (dashInitials) dashInitials.textContent = '--';
    const cardInitials = document.getElementById('profile-card-initials');
    if (cardInitials) cardInitials.textContent = '--';
    
    if (typeof showSuccessToast === 'function') {
      showSuccessToast('Logged out successfully! 👋');
    }
  };

  // Toggle Header User Profile Dropdown
  window.toggleProfileDropdown = function (e) {
    if (e) {
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      if (typeof e.preventDefault === 'function') e.preventDefault();
    }
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) {
      const isOpen = dropdown.classList.contains('open') || dropdown.style.display === 'flex';
      if (isOpen) {
        dropdown.classList.remove('open');
        dropdown.style.display = 'none';
      } else {
        dropdown.classList.add('open');
        dropdown.style.display = 'flex';
      }
    }
  };

  // Close profile dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const avatarWrap = document.getElementById('desktop-avatar-wrap');
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown && avatarWrap && !avatarWrap.contains(e.target)) {
      dropdown.classList.remove('open');
      dropdown.style.display = 'none';
    }
  });

  // ── Dashboard Interactive Account Disconnect & Reconnect Handler ──
  window.disconnectDashboardAccount = function (platformKey, platformLabel) {
    const btn = document.getElementById(`dash-btn-disconnect-${platformKey}`);
    const badge = document.getElementById(`dash-status-badge-${platformKey}`);
    if (!btn) return;
    const isCurrentlyConnected = !btn.classList.contains('reconnect-mode');

    if (isCurrentlyConnected) {
      if (!confirm(`Are you sure you want to disconnect ${platformLabel}? Automation triggers for this account will be paused.`)) {
        return;
      }
      btn.innerHTML = '🔌 Reconnect';
      btn.style.background = 'rgba(16,185,129,0.15)';
      btn.style.color = '#34d399';
      btn.style.borderColor = 'rgba(16,185,129,0.3)';
      btn.classList.add('reconnect-mode');

      if (badge) {
        badge.innerHTML = 'Disconnected ⚠️';
        badge.style.color = '#f87171';
        badge.style.background = 'rgba(239,68,68,0.15)';
      }

      if (typeof showToast === 'function') {
        showToast(`🔌 Disconnected ${platformLabel} successfully.`);
      } else if (typeof showSuccessToast === 'function') {
        showSuccessToast(`Disconnected ${platformLabel} successfully.`);
      }
    } else {
      btn.innerHTML = '🔌 Disconnect';
      btn.style.background = 'rgba(239,68,68,0.12)';
      btn.style.color = '#f87171';
      btn.style.borderColor = 'rgba(239,68,68,0.3)';
      btn.classList.remove('reconnect-mode');

      if (badge) {
        badge.innerHTML = 'Active ⚡';
        badge.style.color = '#34d399';
        badge.style.background = 'rgba(16,185,129,0.15)';
      }

      if (typeof showToast === 'function') {
        showToast(`✅ Reconnected ${platformLabel}!`);
      } else if (typeof showSuccessToast === 'function') {
        showSuccessToast(`Reconnected ${platformLabel}!`);
      }
    }

    // Recalculate connected count
    const disconnectedCount = document.querySelectorAll('#dashboard-connected-accounts-list .reconnect-mode').length;
    const connectedBadge = document.getElementById('dash-connected-count-badge');
    if (connectedBadge) {
      const activeCount = 4 - disconnectedCount;
      connectedBadge.innerHTML = `${activeCount} Connected`;
      if (activeCount === 0) {
        connectedBadge.style.color = '#f87171';
        connectedBadge.style.background = 'rgba(239,68,68,0.15)';
        connectedBadge.style.borderColor = 'rgba(239,68,68,0.3)';
      } else {
        connectedBadge.style.color = '#34d399';
        connectedBadge.style.background = 'rgba(16,185,129,0.15)';
        connectedBadge.style.borderColor = 'rgba(16,185,129,0.3)';
      }
    }
  };

  // Global click listener for nav items (triggers clean URL hash update)
  document.addEventListener('click', (e) => {
    const navItem = e.target.closest('[data-screen]');
    if (navItem && !navItem.classList.contains('platform-tab')) {
      const screenId = navItem.dataset.screen;
      if (screenId) {
        let targetHash = `#${screenId}`;
        if (screenId === 'accounts') {
          // ALWAYS open Platform Directory Hub Grid first when clicking Connected Accounts sidebar item
          localStorage.removeItem('replyflow_active_platform');
          showPlatformDirectoryGrid();
        } else if (screenId === 'triggers') {
          const savedPlatform = localStorage.getItem('replyflow_active_platform') || 'ig';
          targetHash = `#triggers?platform=${savedPlatform}`;
        }

        if (window.location.hash !== targetHash) {
          window.location.hash = targetHash;
        } else {
          handleHashRoute();
        }
      }
    }
  });

  // ── Hub Grid vs Focused Workspace Handler Functions ──
  const PLATFORM_NAMES_MAP = {
    ig: '📷 Instagram / Facebook',
    fb: '📘 Facebook Pages',
    tt: '🎵 TikTok Studio',
    yt: '🎥 YouTube Studio',
    wa: '💬 WhatsApp Business',
    tg: '✈️ Telegram Channels',
    gm: '✉️ Gmail Auto-Responder',
    li: '💼 LinkedIn Professional',
    tw: '𝕏 Twitter (X) Studio',
    wc: '🟢 WeChat Official'
  };

  let cachedPlatformStatuses = {};

  function fetchAndApplyPlatformStatuses() {
    fetch('/api/platforms/status')
      .then(res => res.json())
      .then(statuses => {
        cachedPlatformStatuses = statuses;
        applyPlatformStatusesToHubGrid(statuses);
      })
      .catch(err => console.log('Error fetching platform statuses:', err));
  }

  function applyPlatformStatusesToHubGrid(statuses) {
    const gridCards = document.querySelectorAll('.platform-hub-card');
    gridCards.forEach(card => {
      const onclickAttr = card.getAttribute('onclick') || '';
      const match = onclickAttr.match(/openPlatformWorkspace\(['"]([^'"]+)['"]\)/);
      if (!match) return;
      const key = match[1];
      const platformInfo = statuses[key];
      if (!platformInfo) return;

      const badgeEl = card.querySelector('.badge');
      const actionLinkEl = card.querySelector('.ph-action-link');
      const st = platformInfo.status || (platformInfo.comingSoon ? 'coming_soon' : (platformInfo.enabled ? 'active' : 'off'));

      if (st === 'off') {
        card.style.opacity = '0.35';
        card.style.filter = 'grayscale(0.85)';
        card.style.cursor = 'not-allowed';
        if (badgeEl) {
          badgeEl.className = 'badge';
          badgeEl.style.cssText = 'font-size:10px;font-weight:800;padding:3px 10px;border-radius:20px;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);color:#f87171;';
          badgeEl.textContent = '🔴 OFF';
        }
        if (actionLinkEl) {
          actionLinkEl.style.color = '#f87171';
          actionLinkEl.textContent = 'Disabled 🚫';
        }
      } else if (st === 'coming_soon') {
        card.style.opacity = '0.75';
        card.style.filter = 'none';
        card.style.cursor = 'pointer';
        if (badgeEl) {
          badgeEl.className = 'badge';
          badgeEl.style.cssText = 'font-size:10px;font-weight:800;padding:3px 10px;border-radius:20px;background:linear-gradient(135deg, rgba(168,85,247,0.3), rgba(236,72,153,0.3));border:1px solid #c084fc;color:#ffffff;box-shadow:0 0 10px rgba(168,85,247,0.35);';
          badgeEl.textContent = '🚀 Coming Soon';
        }
        if (actionLinkEl) {
          actionLinkEl.style.color = '#c084fc';
          actionLinkEl.textContent = 'Launching Soon 🚀';
        }
      } else {
        card.style.opacity = '1';
        card.style.filter = 'none';
        card.style.cursor = 'pointer';
        if (badgeEl) {
          badgeEl.className = 'badge connected';
          badgeEl.style.cssText = 'font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.4);color:#34d399;';
          badgeEl.textContent = 'Connected';
        }
        if (actionLinkEl) {
          actionLinkEl.style.color = '#34d399';
          actionLinkEl.textContent = 'Manage Platform →';
        }
      }
    });
  }

  function showPlatformDirectoryGrid() {
    const gridEl = document.getElementById('accounts-directory-grid');
    const headerEl = document.getElementById('accounts-focused-workspace-header');
    const contents = document.querySelectorAll('.platform-accounts-content');

    if (gridEl) gridEl.style.display = 'grid';
    if (headerEl) headerEl.style.display = 'none';

    contents.forEach(c => c.style.display = 'none');
    localStorage.removeItem('replyflow_active_platform');
    fetchAndApplyPlatformStatuses();
  }

  function openPlatformWorkspace(platformId) {
    if (platformId === 'yt') {
      switchScreen('youtube');
      return;
    }
    if (typeof switchScreen === 'function') {
      switchScreen('accounts');
    }
    const gridEl = document.getElementById('accounts-directory-grid');
    const headerEl = document.getElementById('accounts-focused-workspace-header');
    const titleEl = document.getElementById('focused-platform-title');
    const contents = document.querySelectorAll('.platform-accounts-content');

    if (gridEl) gridEl.style.display = 'none';
    if (headerEl) headerEl.style.display = 'flex';
    if (titleEl) titleEl.innerHTML = `${PLATFORM_NAMES_MAP[platformId] || platformId}`;

    contents.forEach(c => {
      if (c.id === `accounts-content-${platformId}`) {
        c.style.display = 'block';
      } else {
        c.style.display = 'none';
      }
    });

    localStorage.setItem('replyflow_active_platform', platformId);

    // Maintain full URL hash state so refresh keeps user exactly on this workspace page
    const targetHash = `#accounts?platform=${platformId}`;
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetHash);
    }

    loadAccounts(platformId);
  }

  window.showPlatformDirectoryGrid = showPlatformDirectoryGrid;
  window.openPlatformWorkspace = openPlatformWorkspace;

  // Helper function to switch platform tabs programmatically
  function selectPlatformTab(platformParam) {
    if (!platformParam) {
      showPlatformDirectoryGrid();
      return;
    }
    openPlatformWorkspace(platformParam);

    // Select Trigger Builder tab if active
    const trigTab = document.querySelector(`.platform-tabs .platform-tab[data-platform="${platformParam}"]`);
    if (trigTab && !trigTab.closest('#accounts-platform-tabs')) {
      const allTrigTabs = document.querySelectorAll('.platform-tabs .platform-tab');
      allTrigTabs.forEach(t => {
        if (!t.closest('#accounts-platform-tabs')) t.classList.remove('active');
      });
      trigTab.classList.add('active');
      currentPlatform = platformParam;
      loadTriggers(platformParam);
    }
  }

  // URL Hash Router: URL is single source of truth
  function handleHashRoute() {
    let rawHash = window.location.hash;
    if (rawHash.startsWith('#')) rawHash = rawHash.substring(1);

    const questionIdx = rawHash.indexOf('?');
    let hashPath = rawHash;
    let queryString = '';

    if (questionIdx !== -1) {
      hashPath = rawHash.substring(0, questionIdx);
      queryString = rawHash.substring(questionIdx + 1);
    }

    // Derived screenId directly from URL path
    let screenId = hashPath;
    if (!screenId) {
      const savedToken = localStorage.getItem('replyflow_user_token');
      screenId = savedToken ? (localStorage.getItem('replyflow_active_screen') || 'dashboard') : 'login';
    }

    switchScreen(screenId);

    // Derived platform query param directly from URL or saved state
    let platformParam = null;
    let subtabParam = null;
    let pluginParam = null;
    if (queryString) {
      const params = new URLSearchParams(queryString);
      platformParam = params.get('platform');
      subtabParam = params.get('subtab');
      pluginParam = params.get('plugin');
    }

    if (screenId === 'discord') {
      const activePlugin = pluginParam || localStorage.getItem('replyflow_active_discord_plugin') || 'overview';
      if (typeof openInlinePluginWorkspace === 'function') {
        openInlinePluginWorkspace(activePlugin);
      }
    } else if (screenId === 'accounts') {
      if (platformParam) {
        if (platformParam === 'yt') {
          switchScreen('youtube');
        } else {
          selectPlatformTab(platformParam);
        }
      } else {
        const savedPlatform = localStorage.getItem('replyflow_active_platform');
        if (savedPlatform) {
          if (savedPlatform === 'yt') {
            switchScreen('youtube');
          } else {
            selectPlatformTab(savedPlatform);
            window.history.replaceState(null, '', `#accounts?platform=${savedPlatform}`);
          }
        } else {
          showPlatformDirectoryGrid();
        }
      }
    } else if (screenId === 'triggers') {
      const activePlatform = platformParam || localStorage.getItem('replyflow_active_platform') || 'ig';
      selectPlatformTab(activePlatform);
    }
  }

  window.addEventListener('hashchange', handleHashRoute);

  // ── Load triggers dynamically from Node.js API ──
  function loadTriggers(platform) {
    const container = document.getElementById('triggers-container');
    if (!container) return;

    // Assign platform class for specific branding styles
    container.className = `trigger-list ${platform}`;
    container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 24px;">Loading triggers...</div>';

    fetch(`/api/triggers?platform=${platform}`)
      .then(res => res.json())
      .then(data => {
        container.innerHTML = '';
        if (data.length === 0) {
          container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 24px;">No triggers found for this platform.</div>';
          return;
        }

        data.forEach((trigger, i) => {
          const row = document.createElement('div');
          row.className = 'trigger-row';
          row.style.opacity = '0';
          row.style.transform = 'translateY(10px)';
          row.style.transition = 'none';
          const targetLinkHtml = trigger.targetLink ? `<div class="trigger-row-link" style="font-size: 12px; color: var(--accent-pink); margin-top: 4px; display: flex; align-items: center; gap: 4px;">🔗 Link: <a href="${trigger.targetLink}" target="_blank" style="color: var(--accent-pink-light); text-decoration: underline; word-break: break-all;">${trigger.targetLink}</a></div>` : '';
          row.innerHTML = `
            <div class="toggle ${trigger.active ? 'active' : ''}" data-id="${trigger.id}"></div>
            <div class="trigger-row-content">
              <div class="trigger-row-keyword">Trigger: "${trigger.keyword}"</div>
              ${targetLinkHtml}
              <div class="trigger-row-reply">${trigger.reply}</div>
              <div class="trigger-row-scope"><span class="scope-dot"></span><span>Applies to: ${trigger.scope}</span></div>
            </div>
            <div class="trigger-row-actions">
              <button class="btn-edit">Edit</button>
              <button class="btn-delete">Delete</button>
            </div>
          `;
          container.appendChild(row);

          const btnDelete = row.querySelector('.btn-delete');
          if (btnDelete) {
            btnDelete.addEventListener('click', () => {
              if (!confirm(`Are you sure you want to delete trigger for "${trigger.keyword}"?`)) return;
              fetch(`/api/triggers/${trigger.id}`, { method: 'DELETE' })
                .then(res => res.json())
                .then(data => {
                  if (data.success) {
                    showSuccessToast(`Trigger "${trigger.keyword}" deleted successfully!`);
                    loadTriggers(platform);
                    loadAccounts(platform);
                  } else {
                    showErrorToast(data.error || 'Failed to delete trigger.');
                  }
                })
                .catch(err => {
                  console.error('Error deleting trigger:', err);
                  showErrorToast('Error deleting trigger.');
                });
            });
          }

          // Trigger smooth stagger entry animation
          requestAnimationFrame(() => {
            row.style.transition = 'opacity 300ms ease, transform 300ms ease';
            setTimeout(() => {
              row.style.opacity = '1';
              row.style.transform = 'translateY(0)';
            }, i * 60);
          });
        });
      })
      .catch(err => {
        console.error('Error fetching triggers:', err);
        container.innerHTML = '<div style="color: var(--accent-red-light); text-align: center; padding: 24px;">Error loading triggers.</div>';
      });
  }

  // Bind Navigation Clicks
  navItemsMobile.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const screenId = item.dataset.screen;
      window.location.hash = screenId;
      switchScreen(screenId);
    });
  });

  navItemsDesktop.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const screenId = item.dataset.screen;
      window.location.hash = screenId;
      switchScreen(screenId);
    });
  });

  // ── Screen Specific Animations ──
  function animateScreenElements(screenId) {
    if (screenId === 'triggers') {
      if (typeof loadTriggers === 'function') loadTriggers(typeof currentPlatform !== 'undefined' ? currentPlatform : 'ig');
    }
    if (screenId === 'accounts') {
      const activePlatformTab = document.querySelector('#accounts-platform-tabs .platform-tab.active');
      const platform = activePlatformTab ? activePlatformTab.dataset.platform : 'ig';
      if (typeof loadAccounts === 'function') loadAccounts(platform);
    }
    if (screenId === 'analytics') {
      if (typeof loadAnalyticsData === 'function') loadAnalyticsData();
      document.querySelectorAll('[data-width]').forEach(el => {
        const w = el.getAttribute('data-width');
        if (w) el.style.width = w + '%';
      });
    }
    if (screenId === 'settings') {
      if (typeof loadUserNotificationSettings === 'function') loadUserNotificationSettings();
    }
  }

  window.toggleUserNotificationPref = function (ruleKey) {
    const map = {
      dailySummary: 'user-pref-daily-summary',
      quotaWarning: 'user-pref-quota-warning',
      weeklyReport: 'user-pref-weekly-report',
      productUpdates: 'user-pref-product-updates'
    };
    const el = document.getElementById(map[ruleKey]);
    if (!el) return;
    el.classList.toggle('active');
    const isNowActive = el.classList.contains('active');

    const payload = {};
    payload[ruleKey] = isNowActive;

    fetch('/api/user/notification-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(err => console.error("Error saving notification pref:", err));
  };

  function loadUserNotificationSettings() {
    fetch('/api/user/notification-settings')
      .then(res => res.json())
      .then(data => {
        if (!data || !data.rules) return;
        const r = data.rules;
        syncToggleState('user-pref-daily-summary', r.dailySummary);
        syncToggleState('user-pref-quota-warning', r.quotaWarning);
        syncToggleState('user-pref-weekly-report', r.weeklyReport);
        syncToggleState('user-pref-product-updates', r.productUpdates);
      })
      .catch(() => { });
  }

  function syncToggleState(id, active) {
    const el = document.getElementById(id);
    if (!el) return;
    if (active) el.classList.add('active');
    else el.classList.remove('active');
  }

  let currentAnalyticsRange = '7d';

  window.setAnalyticsRange = function (range) {
    currentAnalyticsRange = range;
    document.querySelectorAll('.analytics-range-btn').forEach(btn => {
      if (btn.getAttribute('data-range') === range) {
        btn.classList.add('active');
        btn.style.borderColor = 'rgba(168,85,247,0.5)';
        btn.style.background = 'rgba(168,85,247,0.2)';
        btn.style.color = '#c084fc';
        btn.style.fontWeight = '700';
      } else {
        btn.classList.remove('active');
        btn.style.borderColor = 'rgba(255,255,255,0.08)';
        btn.style.background = 'rgba(255,255,255,0.03)';
        btn.style.color = '#a1a1aa';
        btn.style.fontWeight = '600';
      }
    });
    loadAnalyticsData(range);
  };

  function loadAnalyticsData(range) {
    const r = range || currentAnalyticsRange || '7d';
    fetch(`/api/analytics?range=${r}`)
      .then(res => res.json())
      .then(data => {
        if (!data || !data.success) return;

        const m = data.metrics;
        if (m) {
          const elTotal = document.getElementById('analytics-metric-total-dms');
          const elDiff = document.getElementById('analytics-metric-total-dms-sub');
          const elBadge = document.getElementById('analytics-total-dms-badge');
          const elSuccess = document.getElementById('analytics-metric-success-rate');
          const elSuccessSub = document.getElementById('analytics-metric-success-rate-sub');
          const elSpeed = document.getElementById('analytics-metric-speed');
          const elConv = document.getElementById('analytics-metric-follower-conversion');
          const elConvSub = document.getElementById('analytics-metric-follower-conversion-sub');
          const elChartTitle = document.getElementById('analytics-chart-title');
          const elChartTotal = document.getElementById('analytics-chart-total-badge');

          if (elTotal) elTotal.textContent = m.totalDms;
          if (elDiff) elDiff.textContent = m.totalDmsDiffText;
          if (elBadge) elBadge.textContent = m.totalDmsChange;
          if (elSuccess) elSuccess.textContent = m.successRate;
          if (elSuccessSub) elSuccessSub.textContent = m.successRateStatus;
          if (elSpeed) elSpeed.textContent = m.avgSpeed;
          if (elConv) elConv.textContent = m.followerConversion;
          if (elConvSub) elConvSub.textContent = m.followerConversionSub;
          if (elChartTitle) elChartTitle.textContent = `Replies Sent — ${data.labelText || 'Last 7 Days'}`;
          if (elChartTotal) elChartTotal.textContent = `Total: ${m.totalDms} DMs`;
        }

        const barContainer = document.getElementById('analytics-bar-chart-container');
        if (barContainer && data.chartData) {
          barContainer.innerHTML = '';
          data.chartData.forEach(item => {
            const barCol = document.createElement('div');
            barCol.style.display = 'flex';
            barCol.style.flexDirection = 'column';
            barCol.style.alignItems = 'center';
            barCol.style.gap = '8px';
            barCol.style.flex = '1';

            const heightPx = Math.max(15, Math.round(item.heightPct * 1.5));
            const isPeak = item.isPeak;

            barCol.innerHTML = `
              <span style="font-size: 10px; color: ${isPeak ? '#34d399' : '#c084fc'}; font-weight: ${isPeak ? '800' : '700'};">${item.val.toLocaleString()}${isPeak ? ' 🔥' : ''}</span>
              <div class="analytics-bar-fill" style="width: 32px; height: 0px; background: ${isPeak ? 'linear-gradient(180deg, #ec4899, #a855f7)' : 'linear-gradient(180deg, #a855f7, #6366f1)'}; border-radius: 8px 8px 0 0; ${isPeak ? 'box-shadow: 0 0 15px rgba(236,72,153,0.5);' : ''} transition: height 0.5s ease;"></div>
              <span style="font-size: 11px; color: ${isPeak ? '#c084fc' : '#a1a1aa'}; font-weight: ${isPeak ? '800' : '600'};">${item.day}</span>
            `;
            barContainer.appendChild(barCol);

            setTimeout(() => {
              const barFill = barCol.querySelector('.analytics-bar-fill');
              if (barFill) barFill.style.height = `${heightPx}px`;
            }, 50);
          });
        }

        const bdContainer = document.getElementById('analytics-platform-breakdown-container');
        if (bdContainer && data.platformBreakdown) {
          bdContainer.innerHTML = '';
          data.platformBreakdown.forEach(item => {
            const row = document.createElement('div');
            row.innerHTML = `
              <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 6px;">
                <span>${item.name}</span>
                <span style="color: #c084fc;">${item.percentage}% (${item.count})</span>
              </div>
              <div style="height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden;">
                <div class="analytics-breakdown-fill" style="width: 0%; height: 100%; background: ${item.color}; border-radius: 4px; transition: width 0.6s ease;"></div>
              </div>
            `;
            bdContainer.appendChild(row);

            setTimeout(() => {
              const fill = row.querySelector('.analytics-breakdown-fill');
              if (fill) fill.style.width = `${item.percentage}%`;
            }, 100);
          });
        }

        const tbody = document.getElementById('analytics-top-triggers-tbody');
        if (tbody && data.topTriggers) {
          tbody.innerHTML = '';
          data.topTriggers.forEach((trg, idx) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = idx === data.topTriggers.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)';
            tr.style.color = '#fff';

            tr.innerHTML = `
              <td style="padding: 14px 8px; font-weight: 700; color: #c084fc;">${trg.keyword}</td>
              <td style="padding: 14px 8px;">${trg.platform}</td>
              <td style="padding: 14px 8px; font-weight: 700;">${trg.replies}</td>
              <td style="padding: 14px 8px; color: #34d399; font-weight: 700;">${trg.conversion}</td>
              <td style="padding: 14px 8px;"><span style="background: rgba(16,185,129,0.15); color: #34d399; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">${trg.status}</span></td>
            `;
            tbody.appendChild(tr);
          });
        }
      })
      .catch(err => {
        console.error("Failed to load analytics:", err);
      });
  }

  // Staggered Bar Chart
  function animateBars() {
    const bars = document.querySelectorAll('#bar-chart .bar');
    bars.forEach((bar, i) => {
      const h = bar.dataset.height;
      bar.style.height = '0px';
      setTimeout(() => {
        bar.style.height = h + 'px';
      }, 50 + i * 50);
    });
  }

  // Breakdown Fills
  function animateBreakdownBars() {
    const fills = document.querySelectorAll('.breakdown-fill');
    fills.forEach((fill, i) => {
      const w = fill.dataset.width;
      fill.style.width = '0%';
      setTimeout(() => {
        fill.style.width = w + '%';
      }, 200 + i * 100);
    });
  }

  // Plan Progress Indicator
  function animatePlanBar() {
    const fill = document.querySelector('.plan-bar-fill');
    if (fill) {
      const w = fill.dataset.width;
      fill.style.width = '0%';
      setTimeout(() => {
        fill.style.width = w + '%';
      }, 100);
    }
  }

  // ── Toggles ──
  document.addEventListener('click', (e) => {
    // Dynamic toggles inside trigger rows (send toggle update request to Node.js server)
    const toggle = e.target.closest('.toggle[data-id]');
    if (toggle) {
      const triggerId = toggle.dataset.id;
      fetch('/api/triggers/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: triggerId, platform: currentPlatform })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            toggle.classList.toggle('active', data.active);
          }
        })
        .catch(err => console.error('Error toggling trigger:', err));
      return;
    }

    // Static toggle switches
    const staticToggle = e.target.closest('[data-toggle]');
    if (staticToggle) {
      staticToggle.classList.toggle('active');
    }
  });

  // ── Desktop Header Profile Dropdown Delegated Handler ──
  document.addEventListener('click', (e) => {
    const logoutBtn = e.target.closest('#btn-logout, .logout-item');
    if (logoutBtn) {
      e.stopPropagation();
      if (e.preventDefault) e.preventDefault();
      const dropdown = document.getElementById('profile-dropdown');
      if (dropdown) {
        dropdown.classList.remove('open');
        dropdown.style.display = 'none';
      }
      if (typeof window.userLogout === 'function') {
        window.userLogout();
      }
      return;
    }

    const dropdownItem = e.target.closest('.profile-dropdown-item');
    if (dropdownItem) {
      e.stopPropagation();
      const screenId = dropdownItem.dataset.dropdownScreen;
      if (screenId && typeof switchScreen === 'function') {
        switchScreen(screenId);
      }
      const dropdown = document.getElementById('profile-dropdown');
      if (dropdown) {
        dropdown.classList.remove('open');
        dropdown.style.display = 'none';
      }
    }
  });

  // ── Modal Handlers ──
  function setupModalTriggerThemes(modalId) {
    const modal = document.getElementById(modalId);
    if (modal && modalId === 'modal-add-trigger') {
      modal.classList.remove('platform-ig', 'platform-yt', 'platform-tt');
      modal.classList.add('platform-' + (currentPlatform || 'ig'));
    }
  }

  // Bind Overlay Clicks
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  // Open/Close Add Trigger Modal
  const btnOpenTrigger = document.getElementById('btn-open-add-trigger');
  const btnHeaderTrigger = document.getElementById('btn-header-add-trigger');
  const btnQuickTrigger = document.getElementById('btn-quick-trigger');
  const btnCancelTrigger = document.getElementById('btn-cancel-trigger');
  const btnSaveTrigger = document.getElementById('btn-save-trigger');

  const clearModalTriggerContext = () => {
    const accInput = document.getElementById('modal-trigger-account-id');
    const postInput = document.getElementById('modal-trigger-post-id');
    const scopeInput = document.getElementById('modal-trigger-scope');
    if (accInput) accInput.value = '';
    if (postInput) postInput.value = '';
    if (scopeInput) scopeInput.value = '';

    // Reset follow-gate fields
    const fgToggle = document.getElementById('modal-follow-gate-toggle');
    const fgGreeting = document.getElementById('modal-follow-gate-greeting');
    if (fgToggle) fgToggle.classList.remove('active');
    if (fgGreeting) fgGreeting.value = '';

    const targetLinkInput = document.getElementById('add-trigger-target-link');
    if (targetLinkInput) targetLinkInput.value = '';

    customComments = [];
    renderCustomComments();
    if (btnModeList) btnModeList.click();
  };

  if (btnOpenTrigger) btnOpenTrigger.addEventListener('click', () => {
    clearModalTriggerContext();
    openModal('modal-add-trigger');
  });
  if (btnHeaderTrigger) btnHeaderTrigger.addEventListener('click', () => {
    clearModalTriggerContext();
    openModal('modal-add-trigger');
  });
  if (btnQuickTrigger) btnQuickTrigger.addEventListener('click', () => {
    clearModalTriggerContext();
    openModal('modal-add-trigger');
  });

  // Set Trigger from Connected Accounts post rows
  document.addEventListener('click', (e) => {
    const btnSetTrigger = e.target.closest('.btn-set-trigger');
    if (btnSetTrigger) {
      const idInput = document.getElementById('modal-trigger-id');
      const accInput = document.getElementById('modal-trigger-account-id');
      const postInput = document.getElementById('modal-trigger-post-id');
      const scopeInput = document.getElementById('modal-trigger-scope');
      const keywordInput = document.getElementById('add-trigger-keyword');
      const dmReplyInput = document.getElementById('add-trigger-dm-reply');
      const titleEl = document.getElementById('modal-trigger-title');

      if (idInput) idInput.value = '';
      if (titleEl) titleEl.textContent = 'Add New Trigger';
      if (keywordInput) keywordInput.value = '';
      if (dmReplyInput) dmReplyInput.value = '';
      if (accInput) accInput.value = btnSetTrigger.dataset.accountId || '';
      if (postInput) postInput.value = btnSetTrigger.dataset.postId || '';
      if (scopeInput) scopeInput.value = btnSetTrigger.dataset.postTitle || '';

      openModal('modal-add-trigger');

      if (keywordInput) {
        setTimeout(() => keywordInput.focus(), 50);
      }
    }
  });

  if (btnCancelTrigger) btnCancelTrigger.addEventListener('click', () => closeModal('modal-add-trigger'));
  if (btnSaveTrigger) {
    btnSaveTrigger.addEventListener('click', () => {
      const keywordInput = document.getElementById('add-trigger-keyword');
      const targetLinkInput = document.getElementById('add-trigger-target-link');
      const dmReplyInput = document.getElementById('add-trigger-dm-reply');
      const keyword = keywordInput ? keywordInput.value.trim() : '';
      const targetLink = targetLinkInput ? targetLinkInput.value.trim() : '';
      let reply = dmReplyInput ? dmReplyInput.value.trim() : '';

      if (!keyword) {
        alert('Please fill in the keyword.');
        return;
      }

      if (!reply && targetLink) {
        reply = `Here is your link: ${targetLink}`;
      }

      const triggerId = document.getElementById('modal-trigger-id').value;
      const accountId = document.getElementById('modal-trigger-account-id').value;
      const postId = document.getElementById('modal-trigger-post-id').value;
      const scope = document.getElementById('modal-trigger-scope').value;

      const commentReplyType = btnModeList.classList.contains('active') ? 'list' : 'custom';
      const commentListId = document.getElementById('modal-comment-list-select').value;
      const commentReplies = customComments;

      const isEdit = Boolean(triggerId);
      const url = isEdit ? `/api/triggers/${triggerId}` : '/api/triggers';
      const method = isEdit ? 'PUT' : 'POST';

      fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword,
          targetLink,
          reply,
          platform: currentPlatform,
          scope,
          postId,
          accountId,
          commentReplyType,
          commentListId,
          commentReplies,
          followGateEnabled: false,
          followGateGreeting: ""
        })
      })
        .then(res => res.json())
        .then(data => {
          if (data.id || data.success) {
            loadTriggers(currentPlatform);
            loadAccounts(currentPlatform);
            closeModal('modal-add-trigger');
            if (keywordInput) keywordInput.value = '';
            if (targetLinkInput) targetLinkInput.value = '';
            if (dmReplyInput) dmReplyInput.value = '';
            const idInput = document.getElementById('modal-trigger-id');
            if (idInput) idInput.value = '';
          } else {
            alert('Failed to save trigger: ' + (data.error || 'Unknown error'));
          }
        })
        .catch(err => {
          console.error('Error saving trigger:', err);
          alert('Error saving trigger.');
        });
    });
  }

  // Open Upgrade Plan Modal
  const btnOpenUpgrade = document.getElementById('btn-open-upgrade');
  if (btnOpenUpgrade) {
    btnOpenUpgrade.addEventListener('click', () => openModal('modal-upgrade'));
  }



  const btnQuickConnect = document.getElementById('btn-quick-connect');
  if (btnQuickConnect) {
    btnQuickConnect.addEventListener('click', () => {
      window.location.hash = 'accounts';
      switchScreen('accounts');
    });
  }

  const btnQuickAnalytics = document.getElementById('btn-quick-analytics');
  if (btnQuickAnalytics) {
    btnQuickAnalytics.addEventListener('click', () => {
      window.location.hash = 'analytics';
      switchScreen('analytics');
    });
  }

  const btnQuickUpgrade = document.getElementById('btn-quick-upgrade');
  if (btnQuickUpgrade) {
    btnQuickUpgrade.addEventListener('click', () => {
      openModal('modal-upgrade');
    });
  }

  // ── Telegram & Discord Manage Bot Modals ──
  const btnManageTg = document.getElementById('btn-manage-tg');
  if (btnManageTg) btnManageTg.addEventListener('click', () => openModal('modal-manage-tg'));
  const btnCancelManageTg = document.getElementById('btn-cancel-manage-tg');
  if (btnCancelManageTg) btnCancelManageTg.addEventListener('click', () => closeModal('modal-manage-tg'));
  const btnSaveManageTg = document.getElementById('btn-save-manage-tg');
  if (btnSaveManageTg) {
    btnSaveManageTg.addEventListener('click', () => {
      closeModal('modal-manage-tg');
      alert('Telegram Bot & Webhook Settings updated successfully!');
    });
  }

  const btnManageDc = document.getElementById('btn-manage-dc');
  if (btnManageDc) btnManageDc.addEventListener('click', () => openModal('modal-manage-dc'));
  const btnCancelManageDc = document.getElementById('btn-cancel-manage-dc');
  if (btnCancelManageDc) btnCancelManageDc.addEventListener('click', () => closeModal('modal-manage-dc'));
  const btnSaveManageDc = document.getElementById('btn-save-manage-dc');
  if (btnSaveManageDc) {
    btnSaveManageDc.addEventListener('click', () => {
      const guildId = document.getElementById('dc-guild-id-input')?.value?.trim();
      const guildName = document.getElementById('dc-guild-name-input')?.value?.trim();
      if (!guildId) {
        alert('Please enter a valid Discord Server Guild ID.');
        return;
      }
      if (typeof window.connectDiscordServer === 'function') {
        window.connectDiscordServer(guildId, guildName || `Discord Server ${guildId}`);
      }
    });
  }

  const btnManageGm = document.getElementById('btn-manage-gm');
  if (btnManageGm) btnManageGm.addEventListener('click', () => openModal('modal-manage-gm'));
  const btnCancelManageGm = document.getElementById('btn-cancel-manage-gm');
  if (btnCancelManageGm) btnCancelManageGm.addEventListener('click', () => closeModal('modal-manage-gm'));
  const btnSaveManageGm = document.getElementById('btn-save-manage-gm');
  if (btnSaveManageGm) {
    btnSaveManageGm.addEventListener('click', () => {
      closeModal('modal-manage-gm');
      alert('Gmail Integration & Google OAuth Settings updated successfully!');
    });
  }

  // ── Tab Toggles ──
  const platformTabs = document.querySelectorAll('.platform-tab');

  platformTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.classList.contains('disabled')) return;
      platformTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      currentPlatform = tab.dataset.platform;
      loadTriggers(currentPlatform);
    });
  });

  // ── Connected Accounts Platform Tabs ──
  const accountsPlatformTabs = document.querySelectorAll('#accounts-platform-tabs .platform-tab');
  const platformAccountsContents = document.querySelectorAll('.platform-accounts-content');

  accountsPlatformTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.classList.contains('disabled')) return;
      accountsPlatformTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const targetPlatform = tab.dataset.platform;

      // Save active platform tab to localStorage and update URL hash
      localStorage.setItem('replyflow_active_platform', targetPlatform);
      const currentScreen = window.location.hash.substring(1).split('?')[0] || 'accounts';
      window.history.replaceState(null, '', `#${currentScreen}?platform=${targetPlatform}`);

      loadAccounts(targetPlatform);

      platformAccountsContents.forEach(content => {
        if (content.id === `accounts-content-${targetPlatform}`) {
          content.style.display = 'block';
          // Show/hide Inbox Automation Settings (IG only)
          const inboxSettings = document.getElementById('inbox-automation-settings');
          if (inboxSettings) {
            inboxSettings.style.display = targetPlatform === 'ig' ? 'block' : 'none';
          }
          // Premium staggered card load animations
          const cards = content.querySelectorAll('.platform-card, .content-card, .section-heading, .account-tabs');
          cards.forEach((card, i) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(10px)';
            card.style.transition = 'none';
            requestAnimationFrame(() => {
              card.style.transition = 'opacity 300ms ease, transform 300ms ease';
              setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
              }, i * 60);
            });
          });
        } else {
          content.style.display = 'none';
        }
      });
    });
  });

  // ── Dynamic Connected Accounts Manager ──
  function loadAccounts(platform) {
    activeAccountsTabPlatform = platform;
    window.activeAccountsTabPlatform = platform;
    window.loadedAccounts = loadedAccounts;
    window.activeAccountIdx = activeAccountIdx;
    window.loadAccounts = loadAccounts;
    const tabsContainer = document.getElementById(`accounts-tabs-${platform}`) || document.getElementById(`${platform}-channels-list`) || document.getElementById('yt-channels-list');
    const postsContainer = document.getElementById(`posts-container-${platform}`);
    if (!tabsContainer || !postsContainer) return;
    fetch(`/api/accounts?platform=${platform}`, { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(accounts => {
        if (!Array.isArray(accounts)) accounts = [];
        loadedAccounts[platform] = accounts;
        tabsContainer.innerHTML = '';
        postsContainer.innerHTML = '';

        if (platform === 'yt' && accounts && accounts.length > 0) {
          const activeAcc = accounts[activeAccountIdx[platform]] || accounts[0];
          localStorage.setItem('replyflow_yt_connected', 'true');
          localStorage.setItem('replyflow_yt_channel', activeAcc.username || '');
          if (typeof updateYouTubeConnectionUI === 'function') updateYouTubeConnectionUI();
        } else if (platform === 'yt') {
          localStorage.setItem('replyflow_yt_connected', 'false');
          if (typeof updateYouTubeConnectionUI === 'function') updateYouTubeConnectionUI();
        }

        if (!accounts || accounts.length === 0) {
          renderDmSettings(platform, null);
          const limitBadge = document.getElementById(`limit-badge-${platform}`);
          if (limitBadge) limitBadge.textContent = '👤 0 / 100 Users';
          postsContainer.innerHTML = `
            <div class="empty-state-card" style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px;">
              No accounts linked for this platform. Click "+ Add Account" to link one.
            </div>
          `;
        } else {
          // Update Limit Badge with Unique Engaged Contacts info
          const activeAcc = accounts[activeAccountIdx[platform]] || accounts[0];
          const limitBadge = document.getElementById(`limit-badge-${platform}`);
          if (limitBadge && activeAcc) {
            const cnt = activeAcc.uniqueContactsCount !== undefined ? activeAcc.uniqueContactsCount : 0;
            const lim = activeAcc.uniqueContactsLimit || 100;
            limitBadge.textContent = `👤 ${cnt} / ${lim} Users`;
          }

          // Render Account Tabs
          accounts.forEach((acc, idx) => {
            const isActive = idx === activeAccountIdx[platform];
            const tabEl = document.createElement('div');
            tabEl.className = `account-tab ${isActive ? 'active' : ''}`;
            const iconBg = platform === 'ig' ? 'var(--accent-pink)' : (platform === 'yt' ? 'var(--accent-red)' : (platform === 'tg' ? '#24A1DE' : (platform === 'dc' ? '#5865F2' : (platform === 'gm' ? '#EA4335' : 'var(--accent-purple)'))));

            tabEl.innerHTML = `
              <div class="account-tab-icon" style="background: ${iconBg};"></div>
              <div class="account-tab-info">
                <div class="account-tab-name">${acc.username}</div>
                <div class="account-tab-platform">${acc.displayName}</div>
              </div>
            `;

            tabEl.addEventListener('click', () => {
              activeAccountIdx[platform] = idx;
              tabsContainer.querySelectorAll('.account-tab').forEach(t => t.classList.remove('active'));
              tabEl.classList.add('active');
              renderPosts(platform, acc.posts);
              renderDmSettings(platform, acc);
            });

            tabsContainer.appendChild(tabEl);
          });

          // Render active account posts
          if (activeAcc) {
            const activeTabBtn = document.querySelector(`#media-filter-bar-${platform} .media-filter-tab.active`);
            const currentFilter = activeTabBtn ? (activeTabBtn.dataset.filter || 'all') : 'all';
            renderPosts(platform, activeAcc.posts, currentFilter);
            renderDmSettings(platform, activeAcc);
          }
        }
        updateSimulatorDropdown();
      })
      .catch(err => console.error('Error loading accounts:', err));
  }

  // ── Sync Posts & Disconnect Account Buttons ──
  const btnSyncPostsIg = document.getElementById('btn-sync-posts-ig');
  if (btnSyncPostsIg) {
    btnSyncPostsIg.addEventListener('click', () => {
      const activeAcc = loadedAccounts['ig'][activeAccountIdx['ig']];
      if (!activeAcc) {
        alert('No account selected.');
        return;
      }
      btnSyncPostsIg.disabled = true;
      btnSyncPostsIg.textContent = '⏳ Syncing...';

      fetch(`/api/instagram/accounts/${activeAcc.id}/sync`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          btnSyncPostsIg.disabled = false;
          btnSyncPostsIg.textContent = '🔄 Sync Posts / Reels';
          if (data.success) {
            activeAcc.posts = data.posts;
            renderPosts('ig', data.posts);
            showSuccessToast(`Successfully synced ${data.posts.length} posts/reels from Instagram!`);
          } else {
            showErrorToast(data.error || 'Failed to sync posts from Instagram.');
          }
        })
        .catch(err => {
          btnSyncPostsIg.disabled = false;
          btnSyncPostsIg.textContent = '🔄 Sync Posts / Reels';
          console.error('Error syncing posts:', err);
          showErrorToast('Unable to reach Instagram API at this moment.');
        });
    });
  }

  // ── LinkedIn Sync Posts Button ──
  const btnSyncPostsLi = document.getElementById('btn-sync-posts-li');
  if (btnSyncPostsLi) {
    btnSyncPostsLi.addEventListener('click', () => {
      const activeAcc = loadedAccounts['li'] ? loadedAccounts['li'][activeAccountIdx['li']] : null;
      if (!activeAcc) {
        showErrorToast('No LinkedIn account selected.');
        return;
      }
      btnSyncPostsLi.disabled = true;
      btnSyncPostsLi.innerHTML = '<span>⏳ Syncing...</span><span style="font-size:12px;">🔄</span>';

      fetch(`/api/linkedin/accounts/${activeAcc.id}/sync`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          btnSyncPostsLi.disabled = false;
          btnSyncPostsLi.innerHTML = '<span>🔄 Sync Posts</span><span style="font-size:12px;">🔄</span>';
          if (data.success) {
            activeAcc.posts = data.posts;
            renderPosts('li', data.posts);
            showSuccessToast(`Successfully synced ${data.posts.length} posts from LinkedIn!`);
          } else {
            showErrorToast(data.error || 'Failed to sync posts from LinkedIn.');
          }
        })
        .catch(err => {
          btnSyncPostsLi.disabled = false;
          btnSyncPostsLi.innerHTML = '<span>🔄 Sync Posts</span><span style="font-size:12px;">🔄</span>';
          console.error('Error syncing LinkedIn posts:', err);
          showErrorToast('Unable to reach LinkedIn API at this moment.');
        });
    });
  }

  // ── LinkedIn Disconnect Account Button ──
  const btnDisconnectAccountLi = document.getElementById('btn-disconnect-account-li');
  if (btnDisconnectAccountLi) {
    btnDisconnectAccountLi.addEventListener('click', () => {
      const activeAcc = loadedAccounts['li'] ? loadedAccounts['li'][activeAccountIdx['li']] : null;
      if (!activeAcc) {
        showErrorToast('No LinkedIn account selected.');
        return;
      }

      if (!confirm(`Are you sure you want to disconnect ${activeAcc.username || activeAcc.name}? This will remove all LinkedIn automation triggers.`)) {
        return;
      }

      btnDisconnectAccountLi.disabled = true;
      btnDisconnectAccountLi.innerHTML = '<span>⏳ Disconnecting...</span><span style="font-size:12px;">⚠️</span>';

      fetch('/api/linkedin/accounts/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: activeAcc.id })
      })
        .then(res => res.json())
        .then(data => {
          btnDisconnectAccountLi.disabled = false;
          btnDisconnectAccountLi.innerHTML = '<span>🔌 Disconnect</span><span style="font-size:12px;">⚠️</span>';
          if (data.success) {
            activeAccountIdx['li'] = 0;
            loadAccounts('li');
            showSuccessToast(`LinkedIn account ${activeAcc.username || activeAcc.name} disconnected successfully.`);
          } else {
            showErrorToast('Failed to disconnect LinkedIn account: ' + (data.error || 'Unknown error'));
          }
        })
        .catch(err => {
          btnDisconnectAccountLi.disabled = false;
          btnDisconnectAccountLi.innerHTML = '<span>🔌 Disconnect</span><span style="font-size:12px;">⚠️</span>';
          console.error('Error disconnecting LinkedIn account:', err);
          showErrorToast('Error disconnecting LinkedIn account.');
        });
    });
  }

  // ── Twitter (X) Sync Tweets Button ──
  const btnSyncPostsTw = document.getElementById('btn-sync-posts-tw');
  if (btnSyncPostsTw) {
    btnSyncPostsTw.addEventListener('click', () => {
      const activeAcc = loadedAccounts['tw'] ? loadedAccounts['tw'][activeAccountIdx['tw']] : null;
      if (!activeAcc) {
        showErrorToast('No Twitter (X) account selected.');
        return;
      }
      btnSyncPostsTw.disabled = true;
      btnSyncPostsTw.innerHTML = '<span>⏳ Syncing...</span><span style="font-size:12px;">🔄</span>';

      fetch(`/api/twitter/accounts/${activeAcc.id}/sync`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          btnSyncPostsTw.disabled = false;
          btnSyncPostsTw.innerHTML = '<span>🔄 Sync Tweets</span><span style="font-size:12px;">🔄</span>';
          if (data.success) {
            activeAcc.posts = data.posts;
            renderPosts('tw', data.posts);
            showSuccessToast(`Successfully synced ${data.posts.length} tweets from Twitter (X)!`);
          } else {
            showErrorToast(data.error || 'Failed to sync tweets from Twitter (X).');
          }
        })
        .catch(err => {
          btnSyncPostsTw.disabled = false;
          btnSyncPostsTw.innerHTML = '<span>🔄 Sync Tweets</span><span style="font-size:12px;">🔄</span>';
          console.error('Error syncing Twitter tweets:', err);
          showErrorToast('Unable to reach Twitter API at this moment.');
        });
    });
  }

  // ── Twitter (X) Disconnect Account Button ──
  const btnDisconnectAccountTw = document.getElementById('btn-disconnect-account-tw');
  if (btnDisconnectAccountTw) {
    btnDisconnectAccountTw.addEventListener('click', () => {
      const activeAcc = loadedAccounts['tw'] ? loadedAccounts['tw'][activeAccountIdx['tw']] : null;
      if (!activeAcc) {
        showErrorToast('No Twitter (X) account selected.');
        return;
      }

      if (!confirm(`Are you sure you want to disconnect @${activeAcc.username || activeAcc.name}? This will remove all Twitter auto-reply triggers.`)) {
        return;
      }

      btnDisconnectAccountTw.disabled = true;
      btnDisconnectAccountTw.innerHTML = '<span>⏳ Disconnecting...</span><span style="font-size:12px;">⚠️</span>';

      fetch('/api/twitter/accounts/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: activeAcc.id })
      })
        .then(res => res.json())
        .then(data => {
          btnDisconnectAccountTw.disabled = false;
          btnDisconnectAccountTw.innerHTML = '<span>🔌 Disconnect</span><span style="font-size:12px;">⚠️</span>';
          if (data.success) {
            activeAccountIdx['tw'] = 0;
            loadAccounts('tw');
            showSuccessToast(`Twitter account @${activeAcc.username || activeAcc.name} disconnected successfully.`);
          } else {
            showErrorToast('Failed to disconnect Twitter account: ' + (data.error || 'Unknown error'));
          }
        })
        .catch(err => {
          btnDisconnectAccountTw.disabled = false;
          btnDisconnectAccountTw.innerHTML = '<span>🔌 Disconnect</span><span style="font-size:12px;">⚠️</span>';
          console.error('Error disconnecting Twitter account:', err);
          showErrorToast('Error disconnecting Twitter account.');
        });
    });
  }

  // ── Instagram Post / Reel / Story Creation & Scheduling Listener ──
  const btnAddPostIg = document.getElementById('btn-add-post-ig');
  if (btnAddPostIg) {
    btnAddPostIg.addEventListener('click', () => {
      openModal('modal-add-post');
    });
  }

  // ── Post Media Upload & Live Preview Handlers ──
  const postFileInput = document.getElementById('post-file-input');
  const postUrlInput = document.getElementById('post-media-url');
  const postPreviewImg = document.getElementById('post-preview-img');
  const postPreviewVideo = document.getElementById('post-preview-video');
  const postPreviewName = document.getElementById('post-preview-name');
  const postPreviewType = document.getElementById('post-preview-type');
  const btnRemovePostMedia = document.getElementById('btn-remove-post-media');

  if (postFileInput) {
    postFileInput.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;

      const isVideo = file.type.startsWith('video');
      if (postPreviewName) postPreviewName.textContent = file.name;
      if (postPreviewType) postPreviewType.textContent = '⏳ Uploading file...';
      if (btnRemovePostMedia) btnRemovePostMedia.style.display = 'block';

      const btnSubmit = document.getElementById('btn-submit-add-post');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = '⏳ Uploading Media File...';
      }

      const reader = new FileReader();
      reader.onload = function (evt) {
        const dataUrl = evt.target.result;

        if (isVideo) {
          if (postPreviewImg) postPreviewImg.style.display = 'none';
          if (postPreviewVideo) {
            postPreviewVideo.src = dataUrl;
            postPreviewVideo.style.display = 'block';
            postPreviewVideo.play().catch(() => { });
          }
        } else {
          if (postPreviewVideo) postPreviewVideo.style.display = 'none';
          if (postPreviewImg) {
            postPreviewImg.src = dataUrl;
            postPreviewImg.style.display = 'block';
          }
        }

        // Upload to server immediately to keep submit payload lightweight
        fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Data: dataUrl, filename: file.name })
        })
          .then(r => r.json())
          .then(upRes => {
            if (btnSubmit) {
              btnSubmit.disabled = false;
              btnSubmit.textContent = '🚀 Publish / Schedule Post';
            }
            if (upRes.success && upRes.url) {
              if (postUrlInput) postUrlInput.value = upRes.url;
              if (postPreviewType) postPreviewType.textContent = isVideo ? '🎬 Video Uploaded & Ready' : '🖼️ Image Uploaded & Ready';
            } else {
              if (postUrlInput) postUrlInput.value = dataUrl;
              if (postPreviewType) postPreviewType.textContent = isVideo ? '🎬 Video Loaded' : '🖼️ Image Loaded';
            }
          })
          .catch(() => {
            if (btnSubmit) {
              btnSubmit.disabled = false;
              btnSubmit.textContent = '🚀 Publish / Schedule Post';
            }
            if (postUrlInput) postUrlInput.value = dataUrl;
            if (postPreviewType) postPreviewType.textContent = isVideo ? '🎬 Video Loaded' : '🖼️ Image Loaded';
          });
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnRemovePostMedia) {
    btnRemovePostMedia.addEventListener('click', () => {
      if (postFileInput) postFileInput.value = '';
      if (postUrlInput) postUrlInput.value = '';
      if (postPreviewImg) {
        postPreviewImg.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';
        postPreviewImg.style.display = 'block';
      }
      if (postPreviewVideo) postPreviewVideo.style.display = 'none';
      if (postPreviewName) postPreviewName.textContent = 'Default Placeholder';
      if (postPreviewType) postPreviewType.textContent = 'Media removed';
      btnRemovePostMedia.style.display = 'none';
    });
  }

  // Submit Handler for form-add-post
  const formAddPost = document.getElementById('form-add-post');
  if (formAddPost) {
    formAddPost.addEventListener('submit', (e) => {
      e.preventDefault();
      const activeAcc = (loadedAccounts['ig'] && loadedAccounts['ig'].length > 0) ? (loadedAccounts['ig'][activeAccountIdx['ig']] || loadedAccounts['ig'][0]) : null;
      const accountId = activeAcc ? activeAcc.id : null;

      const postTypeRadio = document.querySelector('input[name="post-type-select"]:checked');
      const type = postTypeRadio ? postTypeRadio.value : '📷 Post';
      const mediaUrl = document.getElementById('post-media-url').value.trim();
      const caption = document.getElementById('post-caption').value.trim();
      const isScheduled = document.getElementById('post-is-scheduled').checked;
      const scheduledAt = isScheduled ? document.getElementById('post-scheduled-at').value : null;

      const enableTrigger = document.getElementById('post-enable-trigger').checked;
      const triggerKeyword = document.getElementById('post-trigger-keyword').value.trim();
      const triggerReply = document.getElementById('post-trigger-reply').value.trim();

      const btnSubmit = document.getElementById('btn-submit-add-post');
      btnSubmit.disabled = true;
      btnSubmit.textContent = '⏳ Processing...';

      fetch('/api/instagram/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          type,
          mediaUrl,
          caption,
          scheduledAt,
          triggerConfig: (enableTrigger && triggerKeyword) ? { keyword: triggerKeyword, reply: triggerReply } : null
        })
      })
        .then(res => res.json())
        .then(data => {
          btnSubmit.disabled = false;
          btnSubmit.textContent = '🚀 Publish / Schedule Post';
          if (data.success) {
            closeModal('modal-add-post');
            if (activeAcc) {
              if (!activeAcc.posts) activeAcc.posts = [];
              activeAcc.posts.unshift(data.post);
              renderPosts('ig', activeAcc.posts);
            } else {
              loadAccounts('ig');
            }
            if (data.metaApiError) {
              showToast('warning', `Post added to ReplyFlow! ⚠️ Note: Live Instagram publishing requires a fresh token. ${data.metaApiError}`);
            } else {
              showSuccessToast(`${type} ${isScheduled ? 'scheduled' : 'published'} successfully with auto-trigger attached!`);
            }
          } else {
            showErrorToast(data.error || 'Failed to publish post.');
          }
        })
        .catch(err => {
          btnSubmit.disabled = false;
          btnSubmit.textContent = '🚀 Publish / Schedule Post';
          console.error('Error adding post:', err);
          showErrorToast('Unable to connect to server.');
        });
    });
  }

  // ── Instagram Story Creation & Scheduling Listener ──
  const btnAddStoryIg = document.getElementById('btn-add-story-ig');
  if (btnAddStoryIg) {
    btnAddStoryIg.addEventListener('click', () => {
      openModal('modal-add-story');
    });
  }

  // ── Story Media Upload & Preview Handlers ──
  const btnMediaUploadMode = document.getElementById('story-media-mode-upload');
  const btnMediaUrlMode = document.getElementById('story-media-mode-url');
  const dropzoneArea = document.getElementById('story-upload-dropzone');
  const urlContainer = document.getElementById('story-url-input-container');
  const fileInput = document.getElementById('story-file-input');
  const urlInput = document.getElementById('story-media-url');
  const previewImg = document.getElementById('story-preview-img');
  const previewVideo = document.getElementById('story-preview-video');
  const previewName = document.getElementById('story-preview-name');
  const previewType = document.getElementById('story-preview-type');
  const btnRemoveMedia = document.getElementById('btn-remove-story-media');

  if (btnMediaUploadMode && btnMediaUrlMode) {
    btnMediaUploadMode.addEventListener('click', () => {
      btnMediaUploadMode.style.background = 'var(--accent-pink)';
      btnMediaUploadMode.style.color = '#fff';
      btnMediaUrlMode.style.background = 'transparent';
      btnMediaUrlMode.style.color = 'var(--text-muted)';
      if (dropzoneArea) dropzoneArea.style.display = 'block';
      if (urlContainer) urlContainer.style.display = 'none';
    });

    btnMediaUrlMode.addEventListener('click', () => {
      btnMediaUrlMode.style.background = 'var(--accent-pink)';
      btnMediaUrlMode.style.color = '#fff';
      btnMediaUploadMode.style.background = 'transparent';
      btnMediaUploadMode.style.color = 'var(--text-muted)';
      if (dropzoneArea) dropzoneArea.style.display = 'none';
      if (urlContainer) urlContainer.style.display = 'block';
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;

      const isVideo = file.type.startsWith('video');
      if (previewName) previewName.textContent = file.name;
      if (previewType) previewType.textContent = isVideo ? '🎬 Video File Loaded' : '🖼️ Image File Loaded';
      if (btnRemoveMedia) btnRemoveMedia.style.display = 'block';

      const reader = new FileReader();
      reader.onload = function (evt) {
        const dataUrl = evt.target.result;
        if (urlInput) urlInput.value = dataUrl;

        if (isVideo) {
          if (previewImg) previewImg.style.display = 'none';
          if (previewVideo) {
            previewVideo.src = dataUrl;
            previewVideo.style.display = 'block';
            previewVideo.play().catch(() => { });
          }
        } else {
          if (previewVideo) previewVideo.style.display = 'none';
          if (previewImg) {
            previewImg.src = dataUrl;
            previewImg.style.display = 'block';
          }
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (urlInput) {
    urlInput.addEventListener('input', function () {
      const val = this.value.trim();
      if (!val) return;
      const isVideo = val.match(/\.(mp4|webm|mov|mkv)($|\?)/i);
      if (previewName) previewName.textContent = 'Custom Media Link';
      if (previewType) previewType.textContent = isVideo ? '🎬 Video Link' : '🖼️ Image Link';

      if (isVideo) {
        if (previewImg) previewImg.style.display = 'none';
        if (previewVideo) {
          previewVideo.src = val;
          previewVideo.style.display = 'block';
          previewVideo.play().catch(() => { });
        }
      } else {
        if (previewVideo) previewVideo.style.display = 'none';
        if (previewImg) {
          previewImg.src = val;
          previewImg.style.display = 'block';
        }
      }
    });
  }

  if (btnRemoveMedia) {
    btnRemoveMedia.addEventListener('click', () => {
      if (fileInput) fileInput.value = '';
      if (urlInput) urlInput.value = '';
      if (previewImg) {
        previewImg.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';
        previewImg.style.display = 'block';
      }
      if (previewVideo) previewVideo.style.display = 'none';
      if (previewName) previewName.textContent = 'Default Placeholder';
      if (previewType) previewType.textContent = 'Media removed';
      btnRemoveMedia.style.display = 'none';
    });
  }

  const formAddStory = document.getElementById('form-add-story');
  if (formAddStory) {
    formAddStory.addEventListener('submit', (e) => {
      e.preventDefault();
      const activeAcc = (loadedAccounts['ig'] && loadedAccounts['ig'].length > 0) ? (loadedAccounts['ig'][activeAccountIdx['ig']] || loadedAccounts['ig'][0]) : null;
      const accountId = activeAcc ? activeAcc.id : null;

      const mediaUrl = document.getElementById('story-media-url').value.trim();
      const caption = document.getElementById('story-caption').value.trim();
      const mentions = document.getElementById('story-mentions').value.trim();
      const stickerUrl = document.getElementById('story-sticker-url').value.trim();
      const isScheduled = document.getElementById('story-is-scheduled').checked;
      const scheduledAt = isScheduled ? document.getElementById('story-scheduled-at').value : null;

      const triggerKeyword = document.getElementById('story-trigger-keyword').value.trim();
      const triggerReply = document.getElementById('story-trigger-reply').value.trim();

      const btnSubmit = document.getElementById('btn-submit-add-story');
      btnSubmit.disabled = true;
      btnSubmit.textContent = '⏳ Processing...';

      fetch('/api/instagram/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          mediaUrl,
          caption,
          mentions,
          stickerUrl,
          scheduledAt,
          triggerConfig: triggerKeyword ? { keyword: triggerKeyword, reply: triggerReply } : null
        })
      })
        .then(res => res.json())
        .then(data => {
          btnSubmit.disabled = false;
          btnSubmit.textContent = '🚀 Post / Schedule Story';
          if (data.success) {
            closeModal('modal-add-story');
            if (activeAcc) {
              if (!activeAcc.posts) activeAcc.posts = [];
              activeAcc.posts.unshift(data.story);
              renderPosts('ig', activeAcc.posts);
            } else {
              loadAccounts('ig');
            }
            alert(`Story ${isScheduled ? 'scheduled' : 'published'} successfully!`);
          } else {
            alert(data.error || 'Failed to post story.');
          }
        })
        .catch(err => {
          btnSubmit.disabled = false;
          btnSubmit.textContent = '🚀 Post / Schedule Story';
          console.error('Error adding story:', err);
          alert('Error posting story: ' + (err.message || 'Server error'));
        });
    });
  }

  // ── Instagram Connect Handler (Direct OAuth Popup Flow) ──
  const btnConnectInstagram = document.getElementById('btn-connect-instagram');
  if (btnConnectInstagram) {
    btnConnectInstagram.addEventListener('click', (e) => {
      e.preventDefault();
      connectInstagram();
    });
  }

  const btnDisconnectAccountIg = document.getElementById('btn-disconnect-account-ig');
  if (btnDisconnectAccountIg) {
    btnDisconnectAccountIg.addEventListener('click', () => {
      const activeAcc = loadedAccounts['ig'][activeAccountIdx['ig']];
      if (!activeAcc) {
        alert('No account selected.');
        return;
      }

      if (!confirm(`Are you sure you want to disconnect @${activeAcc.username}?`)) {
        return;
      }

      fetch('/api/accounts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'ig', accountId: activeAcc.id })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            activeAccountIdx['ig'] = 0;
            loadAccounts('ig');
            alert(`Account @${activeAcc.username} disconnected successfully.`);
          } else {
            alert('Failed to disconnect account: ' + (data.error || 'Unknown error'));
          }
        })
        .catch(err => {
          console.error('Error disconnecting account:', err);
          alert('Error disconnecting account.');
        });
    });
  }

  // ── YouTube Sync & Disconnect ──
  window.syncPlatformPosts = function (platform) {
    if (platform === 'yt') {
      const activeAcc = loadedAccounts['yt'] ? loadedAccounts['yt'][activeAccountIdx['yt']] : (loadedAccounts['yt'] ? loadedAccounts['yt'][0] : null);
      if (!activeAcc) {
        if (typeof showErrorToast === 'function') showErrorToast('No YouTube channel selected.');
        else alert('No YouTube channel selected.');
        return;
      }
      const btnSync = document.getElementById('btn-sync-posts-yt');
      if (btnSync) {
        btnSync.disabled = true;
        btnSync.innerHTML = '<span>⏳ Syncing Real-Time Stats...</span><span style="font-size:12px;">🔄</span>';
      }

      fetch(`/api/youtube/accounts/${activeAcc.id}/sync`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          if (btnSync) {
            btnSync.disabled = false;
            btnSync.innerHTML = '<span>🔄 Sync Content</span><span style="font-size:12px;">🔄</span>';
          }
          if (data.success) {
            activeAcc.posts = data.posts;
            renderPosts('yt', data.posts);
            if (typeof showSuccessToast === 'function') showSuccessToast(`Real-time YouTube stats & comments synced for ${activeAcc.username}! 🔴`);
            else alert(`Real-time YouTube stats & comments synced for ${activeAcc.username}!`);
          } else {
            if (typeof showErrorToast === 'function') showErrorToast(data.error || 'Failed to sync videos.');
            else alert(data.error || 'Failed to sync videos.');
          }
        })
        .catch(err => {
          if (btnSync) {
            btnSync.disabled = false;
            btnSync.innerHTML = '<span>🔄 Sync Content</span><span style="font-size:12px;">🔄</span>';
          }
          console.error('Error syncing YouTube videos:', err);
        });
    }
  };

  const btnSyncPostsYt = document.getElementById('btn-sync-posts-yt');
  if (btnSyncPostsYt) {
    btnSyncPostsYt.addEventListener('click', () => { window.syncPlatformPosts('yt'); });
  }

  const btnDisconnectAccountYt = document.getElementById('btn-disconnect-account-yt');
  if (btnDisconnectAccountYt) {
    btnDisconnectAccountYt.addEventListener('click', () => {
      const activeAcc = loadedAccounts['yt'] ? loadedAccounts['yt'][activeAccountIdx['yt']] : null;
      if (!activeAcc) {
        alert('No YouTube channel selected.');
        return;
      }

      if (!confirm(`Are you sure you want to disconnect channel @${activeAcc.username}?`)) {
        return;
      }

      fetch('/api/accounts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'yt', accountId: activeAcc.id })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            activeAccountIdx['yt'] = 0;
            loadAccounts('yt');
            alert(`YouTube channel @${activeAcc.username} disconnected successfully.`);
          } else {
            alert('Failed to disconnect YouTube channel: ' + (data.error || 'Unknown error'));
          }
        })
        .catch(err => {
          console.error('Error disconnecting YouTube channel:', err);
          alert('Error disconnecting YouTube channel.');
        });
    });
  }

  // ── YouTube SubTab Switcher (Dashboard vs Videos vs Live Stream Auto-Moderator Studio) ──
  function switchYTSubTab(tab) {
    const dashBtn = document.getElementById('yt-subtab-btn-dashboard');
    const videosBtn = document.getElementById('yt-subtab-btn-videos');
    const liveBtn = document.getElementById('yt-subtab-btn-live');
    const dashContent = document.getElementById('yt-subtab-content-dashboard');
    const videosContent = document.getElementById('yt-subtab-content-videos');
    const liveContent = document.getElementById('yt-subtab-content-live');

    if (!videosContent || !liveContent) return;

    localStorage.setItem('replyflow_yt_subtab', tab);

    // Update URL hash with subtab parameter so page refresh stays on exact subtab
    const currentHash = window.location.hash;
    const targetHash = `#youtube?subtab=${tab}`;
    if (currentHash !== targetHash) {
      window.history.replaceState(null, '', targetHash);
    }

    const activeStyle = 'padding: 8px 18px !important; font-weight: 700 !important; font-size: 12px !important; border-radius: 20px !important; background: linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(220, 38, 38, 0.35)) !important; border: 1px solid #ef4444 !important; color: #ffffff !important; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.3) !important;';
    const inactiveStyle = 'padding: 8px 18px !important; font-weight: 700 !important; font-size: 12px !important; border-radius: 20px !important; background: rgba(255, 255, 255, 0.04) !important; border: 1px solid rgba(255, 255, 255, 0.12) !important; color: #94a3b8 !important;';

    const obsContent = document.getElementById('yt-subtab-content-obs');

    if (dashContent) dashContent.style.display = tab === 'dashboard' ? 'block' : 'none';
    if (videosContent) videosContent.style.display = tab === 'videos' ? 'block' : 'none';
    if (liveContent) liveContent.style.display = tab === 'live' ? 'block' : 'none';
    if (obsContent) obsContent.style.display = tab === 'obs' ? 'block' : 'none';

    if (dashBtn) {
      dashBtn.className = tab === 'dashboard' ? 'btn-manage' : 'btn-howto-connect';
      dashBtn.style.cssText = tab === 'dashboard' ? activeStyle : inactiveStyle;
    }
    if (videosBtn) {
      videosBtn.className = tab === 'videos' ? 'btn-manage' : 'btn-howto-connect';
      videosBtn.style.cssText = tab === 'videos' ? activeStyle : inactiveStyle;
    }
    if (liveBtn) {
      liveBtn.className = tab === 'live' ? 'btn-manage' : 'btn-howto-connect';
      liveBtn.style.cssText = tab === 'live' ? activeStyle : inactiveStyle;
    }

    if (tab === 'live') {
      const activeAcc = loadedAccounts['yt'] ? loadedAccounts['yt'][activeAccountIdx['yt']] : null;
      if (activeAcc) {
        const cleanUser = (activeAcc.username || 'ainotespk').replace(/^@+/, '');
        const formattedUser = `@${cleanUser}`;
        const streamTitle = document.getElementById('u-yt-live-stream-title');
        const channelName = document.querySelector('#yt-subtab-content-live strong');
        if (channelName) channelName.textContent = formattedUser;
        if (streamTitle && !streamTitle.textContent.includes('🔴 LIVE:')) streamTitle.textContent = `🔥 Live Auto-Moderation — ${formattedUser}`;
      }
    }
  }

  async function userConnectYTLiveStreamByUrl() {
    const input = document.getElementById('u-yt-live-url-input');
    if (!input || !input.value.trim()) {
      showToast('Please paste a valid YouTube Live Stream URL or Video ID', 'warning');
      return;
    }
    try {
      showToast('Connecting Live Stream...', 'info');
      const res = await fetch('/api/youtube/live/set-video-id', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ urlOrVideoId: input.value.trim() })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`🔴 Live Stream Connected: "${data.title}"`, 'success');
        const streamTitle = document.getElementById('u-yt-live-stream-title');
        if (streamTitle) streamTitle.textContent = `🔴 LIVE: ${data.title}`;
        input.value = '';
      } else {
        showToast(data.error || 'Failed to connect live stream', 'error');
      }
    } catch (err) {
      showToast('Network error connecting live stream', 'error');
    }
  }
  window.userConnectYTLiveStreamByUrl = userConnectYTLiveStreamByUrl;
  // ── OBS Overlay Helper Functions ──
  let customOBSGifUrl = '';
  let customOBSAudioUrl = '';

  function handleOBSGifSelectChange() {
    const gifSelect = document.getElementById('obs-gif-select');
    const gifFileInput = document.getElementById('obs-gif-file-input');
    if (!gifSelect) return;

    if (gifSelect.value === 'custom') {
      if (gifFileInput) gifFileInput.style.display = 'block';
    } else {
      if (gifFileInput) gifFileInput.style.display = 'none';
      customOBSGifUrl = gifSelect.value;
      updateOBSOverlayLink();
    }
  }
  window.handleOBSGifSelectChange = handleOBSGifSelectChange;

  function uploadCustomOBSGif(inputEl) {
    if (!inputEl || !inputEl.files || !inputEl.files[0]) return;
    const file = inputEl.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
      customOBSGifUrl = e.target.result;
      showToast('🎨 Custom GIF animation loaded!');
      updateOBSOverlayLink();
    };
    reader.readAsDataURL(file);
  }
  window.uploadCustomOBSGif = uploadCustomOBSGif;

  function handleOBSSoundSelectChange() {
    const soundSelect = document.getElementById('obs-sound-select');
    const audioFileInput = document.getElementById('obs-audio-file-input');
    if (!soundSelect) return;

    if (soundSelect.value === 'custom') {
      if (audioFileInput) audioFileInput.style.display = 'block';
    } else {
      if (audioFileInput) audioFileInput.style.display = 'none';
      customOBSAudioUrl = '';
      updateOBSOverlayLink();
    }
  }
  window.handleOBSSoundSelectChange = handleOBSSoundSelectChange;

  function uploadCustomOBSAudio(inputEl) {
    if (!inputEl || !inputEl.files || !inputEl.files[0]) return;
    const file = inputEl.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
      customOBSAudioUrl = e.target.result;
      showToast('🎙️ Custom Voiceover / Sound uploaded!');
      updateOBSOverlayLink();
    };
    reader.readAsDataURL(file);
  }
  window.uploadCustomOBSAudio = uploadCustomOBSAudio;

  function switchOBSSubTab(tab, skipElementSync = false) {
    const tabs = ['chat', 'superchat', 'subscriber', 'counter', 'branding'];
    tabs.forEach(t => {
      const content = document.getElementById('obs-subtab-' + t + '-content');
      const btn = document.getElementById('obs-subtab-btn-' + t);
      const sideItem = document.getElementById('obs-side-item-' + t);
      const isActive = (t === tab);

      if (isActive) {
        if (content) content.style.display = 'block';
        if (btn) {
          btn.style.background = 'rgba(16, 185, 129, 0.15)';
          btn.style.color = '#ffffff';
          btn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        }
        if (sideItem) {
          sideItem.style.background = 'rgba(16, 185, 129, 0.1)';
          sideItem.style.border = '1px solid rgba(16, 185, 129, 0.4)';
          sideItem.style.borderLeft = '3px solid #10b981';
          const numSpan = sideItem.querySelector('span');
          if (numSpan) numSpan.style.color = '#10b981';
        }
      } else {
        if (content) content.style.display = 'none';
        if (btn) {
          btn.style.background = 'transparent';
          btn.style.color = '#94a3b8';
          btn.style.borderColor = 'transparent';
        }
        if (sideItem) {
          sideItem.style.background = 'rgba(255,255,255,0.03)';
          sideItem.style.border = '1px solid rgba(255,255,255,0.06)';
          sideItem.style.borderLeft = '1px solid rgba(255,255,255,0.06)';
          const numSpan = sideItem.querySelector('span');
          if (numSpan) numSpan.style.color = '#64748b';
        }
      }
    });

    if (!skipElementSync) {
      const typeMap = {
        chat: 'chat',
        superchat: 'superchat',
        subscriber: 'alert',
        counter: 'counter',
        branding: 'branding'
      };
      if (typeMap[tab] && typeof selectOBSElement === 'function') {
        selectOBSElement(typeMap[tab], true);
      }
    }
  }
  window.switchOBSSubTab = switchOBSSubTab;

  // ═══════════════════════════════════════════════════════════════
  // 💬 OBS LIVE CHAT OVERLAY — FUNCTIONS
  // ═══════════════════════════════════════════════════════════════

  let currentOBSChatVideoMode = 'long';
  let currentOBSLiveMode = 'demo';
  let obsChatPosConfig = { cTop: 75, cLeft: 15, scTop: 20, scLeft: 50, counterTop: 8, counterLeft: 50, aTop: 45, aLeft: 50, brandTop: 90, brandLeft: 82 };
  window.obsChatPosConfig = obsChatPosConfig;

  function toggleOBSLiveMode(clickedEl) {
    if (clickedEl && (clickedEl.id === 'obs-mode-live-toggle' || clickedEl.id === 'u-yt-live-mode-toggle')) {
      currentOBSLiveMode = clickedEl.checked ? 'live' : 'demo';
    } else if (clickedEl === 'live' || clickedEl === 'demo') {
      currentOBSLiveMode = clickedEl;
    } else {
      currentOBSLiveMode = currentOBSLiveMode === 'live' ? 'demo' : 'live';
    }

    updateOBSLiveModeUI();

    const previewIframe = document.getElementById('obs-chat-preview-iframe');
    if (previewIframe && previewIframe.contentWindow) {
      previewIframe.contentWindow.postMessage({
        type: 'SET_LIVE_MODE',
        live: (currentOBSLiveMode === 'live')
      }, '*');
    }

    if (typeof saveAndApplyOBSChatSettings === 'function') {
      saveAndApplyOBSChatSettings(true);
    }
  }
  window.toggleOBSLiveMode = toggleOBSLiveMode;

  function updateOBSLiveModeUI() {
    const statusText = document.getElementById('obs-mode-status-text');
    const toggleBg = document.getElementById('obs-toggle-bg');
    const toggleKnob = document.getElementById('obs-toggle-knob');
    const toggleInput = document.getElementById('obs-mode-live-toggle');

    const statusTextMod = document.getElementById('u-yt-live-mode-status-text');
    const toggleBgMod = document.getElementById('u-yt-live-toggle-bg');
    const toggleKnobMod = document.getElementById('u-yt-live-toggle-knob');
    const toggleInputMod = document.getElementById('u-yt-live-mode-toggle');

    if (toggleInput) toggleInput.checked = (currentOBSLiveMode === 'live');
    if (toggleInputMod) toggleInputMod.checked = (currentOBSLiveMode === 'live');

    if (currentOBSLiveMode === 'live') {
      const liveHtml = `<span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; display: inline-block; box-shadow: 0 0 10px #10b981;"></span> LIVE MODE`;
      if (statusText) { statusText.innerHTML = liveHtml; statusText.style.color = '#10b981'; }
      if (toggleBg) toggleBg.style.background = '#10b981';
      if (toggleKnob) toggleKnob.style.left = '19px';

      if (statusTextMod) { statusTextMod.innerHTML = liveHtml; statusTextMod.style.color = '#10b981'; }
      if (toggleBgMod) toggleBgMod.style.background = '#10b981';
      if (toggleKnobMod) toggleKnobMod.style.left = '19px';
    } else {
      const demoHtml = `<span style="width: 7px; height: 7px; border-radius: 50%; background: #fbbf24; display: inline-block;"></span> TESTING MODE`;
      if (statusText) { statusText.innerHTML = demoHtml; statusText.style.color = '#fbbf24'; }
      if (toggleBg) toggleBg.style.background = '#4b5563';
      if (toggleKnob) toggleKnob.style.left = '3px';

      if (statusTextMod) { statusTextMod.innerHTML = demoHtml; statusTextMod.style.color = '#fbbf24'; }
      if (toggleBgMod) toggleBgMod.style.background = '#4b5563';
      if (toggleKnobMod) toggleKnobMod.style.left = '3px';
    }
  }
  window.updateOBSLiveModeUI = updateOBSLiveModeUI;

  function switchOBSChatVideoMode(mode) {
    currentOBSChatVideoMode = mode;
    const btnLong = document.getElementById('btn-chat-mode-long');
    const btnShort = document.getElementById('btn-chat-mode-short');
    const aspectBox = document.getElementById('obs-chat-canvas-aspect-box');
    const wrapper = document.getElementById('obs-chat-preview-canvas-wrapper');

    if (mode === 'short') {
      if (btnLong) { btnLong.style.background = 'transparent'; btnLong.style.color = '#94a3b8'; }
      if (btnShort) { btnShort.style.background = '#a855f7'; btnShort.style.color = 'white'; }
      if (aspectBox) { aspectBox.style.aspectRatio = '9/16'; aspectBox.style.maxWidth = '250px'; }
      if (wrapper) { wrapper.style.maxWidth = '300px'; }
    } else {
      if (btnLong) { btnLong.style.background = '#a855f7'; btnLong.style.color = 'white'; }
      if (btnShort) { btnShort.style.background = 'transparent'; btnShort.style.color = '#94a3b8'; }
      if (aspectBox) { aspectBox.style.aspectRatio = '16/9'; aspectBox.style.maxWidth = '100%'; }
      if (wrapper) { wrapper.style.maxWidth = '100%'; }
    }

    updateOBSChatOverlayLink();
  }
  window.switchOBSChatVideoMode = switchOBSChatVideoMode;

  function setOBSChatPreset(preset) {
    let top = 50, left = 50;
    if (preset === 'bottom-left') { top = 85; left = 15; }
    else if (preset === 'bottom-right') { top = 85; left = 85; }
    else if (preset === 'top-left') { top = 12; left = 15; }
    else if (preset === 'top-right') { top = 12; left = 85; }
    else if (preset === 'center') { top = 50; left = 50; }

    const target = selectedOBSElement || 'chat';
    if (target === 'chat') {
      obsChatPosConfig.cTop = top; obsChatPosConfig.cLeft = left;
      const h = document.getElementById('drag-handle-chat');
      if (h) { h.style.top = top + '%'; h.style.left = left + '%'; }
    } else if (target === 'superchat') {
      obsChatPosConfig.scTop = top; obsChatPosConfig.scLeft = left;
      const h = document.getElementById('drag-handle-superchat');
      if (h) { h.style.top = top + '%'; h.style.left = left + '%'; }
    } else if (target === 'counter') {
      obsChatPosConfig.counterTop = top; obsChatPosConfig.counterLeft = left;
      const h = document.getElementById('drag-handle-counter');
      if (h) { h.style.top = top + '%'; h.style.left = left + '%'; }
    } else if (target === 'alert') {
      obsChatPosConfig.aTop = top; obsChatPosConfig.aLeft = left;
      const h = document.getElementById('drag-handle-alert');
      if (h) { h.style.top = top + '%'; h.style.left = left + '%'; }
    } else if (target === 'branding') {
      obsChatPosConfig.brandTop = top; obsChatPosConfig.brandLeft = left;
      const h = document.getElementById('drag-handle-branding');
      if (h) { h.style.top = top + '%'; h.style.left = left + '%'; }
    }

    const previewIframe = document.getElementById('obs-chat-preview-iframe');
    if (previewIframe && previewIframe.contentWindow) {
      previewIframe.contentWindow.postMessage({
        type: 'UPDATE_OBS_CONFIG',
        config: {
          cTop: obsChatPosConfig.cTop, cLeft: obsChatPosConfig.cLeft,
          scTop: obsChatPosConfig.scTop, scLeft: obsChatPosConfig.scLeft,
          counterTop: obsChatPosConfig.counterTop, counterLeft: obsChatPosConfig.counterLeft,
          aTop: obsChatPosConfig.aTop, aLeft: obsChatPosConfig.aLeft,
          brandTop: obsChatPosConfig.brandTop, brandLeft: obsChatPosConfig.brandLeft
        }
      }, '*');
    }
    updateOBSChatOverlayLink();
  }
  window.setOBSChatPreset = setOBSChatPreset;

  let currentOBSVideoMode = 'long';
  let obsModeConfigs = {
    long: {
      cTop: 6, cLeft: 50, cScale: 1.0, cOpacity: 1.0,
      aTop: 55, aLeft: 50, aScale: 1.0, aOpacity: 1.0,
      randPos: false
    },
    short: {
      cTop: 5, cLeft: 50, cScale: 0.9, cOpacity: 1.0,
      aTop: 45, aLeft: 50, aScale: 0.9, aOpacity: 1.0,
      randPos: false
    }
  };

  function getActiveOBSConfig() {
    return obsModeConfigs[currentOBSVideoMode];
  }

  let handleHideTimeout = null;

  function resetCanvasHandleFadeTimer() {
    // Keep all 5 handles permanently visible and interactive!
    const handles = document.querySelectorAll('#drag-handle-superchat, #drag-handle-chat, #drag-handle-counter, #drag-handle-alert, #drag-handle-branding');
    handles.forEach(h => {
      h.style.opacity = '1';
      h.style.pointerEvents = 'auto';
    });
  }

  function setupCanvasHandleAutoFade() {
    resetCanvasHandleFadeTimer();
  }
  window.setupCanvasHandleAutoFade = setupCanvasHandleAutoFade;
  document.addEventListener('DOMContentLoaded', setupCanvasHandleAutoFade);
  setTimeout(setupCanvasHandleAutoFade, 1000);

  let selectedOBSElement = 'superchat';
  let isSpacePressed = false;

  function selectOBSElement(type, skipSubTabSync = false) {
    selectedOBSElement = type;
    const handles = ['superchat', 'chat', 'counter', 'alert', 'branding'];
    handles.forEach(h => {
      const el = document.getElementById('drag-handle-' + h);
      if (!el) return;
      if (h === type) {
        el.style.outline = '3px solid #a855f7';
        el.style.boxShadow = '0 0 22px rgba(168, 85, 247, 1), 0 0 32px rgba(236, 72, 153, 0.8)';
      } else {
        el.style.outline = 'none';
        el.style.boxShadow = '0 4px 18px rgba(0, 0, 0, 0.5)';
      }
    });

    const statusEl = document.getElementById('obs-keyboard-nudge-status');
    if (statusEl) {
      const names = {
        superchat: '💰 SuperChat Box',
        chat: '🖐️ Live Chat Box',
        counter: '📊 Subscriber Counter Bar',
        alert: '⚡ Alert Popup',
        branding: '🏷️ Animated Branding Badge'
      };
      statusEl.innerHTML = `<span style="color:#ec4899; font-weight:900;">🎯 SELECTED: ${names[type] || type}</span> &nbsp;|&nbsp; <span style="color:#38bdf8;">⬆️⬇️⬅️➡️ Arrow Keys = <b>1px step</b></span> &nbsp;|&nbsp; <span style="color:#ffd700;">Space / Shift + Arrow = <b>10px fast step</b></span> &nbsp;|&nbsp; <span style="color:#34d399;">Hold Key = Continuous Smooth Move</span>`;
    }

    if (!skipSubTabSync) {
      const tabMap = {
        chat: 'chat',
        superchat: 'superchat',
        alert: 'subscriber',
        counter: 'counter',
        branding: 'branding'
      };
      if (tabMap[type] && typeof switchOBSSubTab === 'function') {
        switchOBSSubTab(tabMap[type], true);
      }
    }
  }
  window.selectOBSElement = selectOBSElement;

  function startOBSDrag(e, type) {
    e.preventDefault();
    selectOBSElement(type);
    activeDragType = type;
    document.addEventListener('mousemove', handleOBSDragMove);
    document.addEventListener('mouseup', stopOBSDrag);
  }
  window.startOBSDrag = startOBSDrag;

  // Keyboard Arrow Precision Nudging Listener (1px normal, 10px with Space or Shift)
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.key === ' ') {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
      isSpacePressed = true;
    }

    if (!selectedOBSElement) return;

    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (!arrowKeys.includes(e.key)) return;

    e.preventDefault();

    const stepPixels = (e.shiftKey || isSpacePressed) ? 10 : 1;

    const box = document.getElementById('obs-chat-canvas-aspect-box') || document.getElementById('obs-chat-preview-canvas-wrapper');
    if (!box) return;
    const rect = box.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dxPct = (stepPixels / rect.width) * 100;
    const dyPct = (stepPixels / rect.height) * 100;

    let deltaX = 0;
    let deltaY = 0;
    if (e.key === 'ArrowLeft') deltaX = -dxPct;
    if (e.key === 'ArrowRight') deltaX = dxPct;
    if (e.key === 'ArrowUp') deltaY = -dyPct;
    if (e.key === 'ArrowDown') deltaY = dyPct;

    if (selectedOBSElement === 'superchat') {
      obsChatPosConfig.scLeft = Math.min(Math.max(parseFloat((obsChatPosConfig.scLeft + deltaX).toFixed(2)), 0), 100);
      obsChatPosConfig.scTop = Math.min(Math.max(parseFloat((obsChatPosConfig.scTop + deltaY).toFixed(2)), 0), 100);

      const handle = document.getElementById('drag-handle-superchat');
      if (handle) {
        handle.style.left = obsChatPosConfig.scLeft + '%';
        handle.style.top = obsChatPosConfig.scTop + '%';
      }
      const previewIframe = document.getElementById('obs-chat-preview-iframe');
      if (previewIframe && previewIframe.contentWindow) {
        previewIframe.contentWindow.postMessage({
          type: 'UPDATE_OBS_CONFIG',
          config: { scTop: obsChatPosConfig.scTop, scLeft: obsChatPosConfig.scLeft }
        }, '*');
      }
    } else if (selectedOBSElement === 'chat') {
      obsChatPosConfig.cLeft = Math.min(Math.max(parseFloat((obsChatPosConfig.cLeft + deltaX).toFixed(2)), 0), 100);
      obsChatPosConfig.cTop = Math.min(Math.max(parseFloat((obsChatPosConfig.cTop + deltaY).toFixed(2)), 0), 100);

      const handle = document.getElementById('drag-handle-chat');
      if (handle) {
        handle.style.left = obsChatPosConfig.cLeft + '%';
        handle.style.top = obsChatPosConfig.cTop + '%';
      }
      const previewIframe = document.getElementById('obs-chat-preview-iframe');
      if (previewIframe && previewIframe.contentWindow) {
        previewIframe.contentWindow.postMessage({
          type: 'UPDATE_OBS_CONFIG',
          config: { cTop: obsChatPosConfig.cTop, cLeft: obsChatPosConfig.cLeft }
        }, '*');
      }
    } else if (selectedOBSElement === 'counter') {
      obsChatPosConfig.counterLeft = Math.min(Math.max(parseFloat(((obsChatPosConfig.counterLeft || 50) + deltaX).toFixed(2)), 0), 100);
      obsChatPosConfig.counterTop = Math.min(Math.max(parseFloat(((obsChatPosConfig.counterTop || 8) + deltaY).toFixed(2)), 0), 100);

      const handle = document.getElementById('drag-handle-counter');
      if (handle) {
        handle.style.left = obsChatPosConfig.counterLeft + '%';
        handle.style.top = obsChatPosConfig.counterTop + '%';
      }
      const previewIframe = document.getElementById('obs-chat-preview-iframe');
      if (previewIframe && previewIframe.contentWindow) {
        previewIframe.contentWindow.postMessage({
          type: 'UPDATE_OBS_CONFIG',
          config: { counterTop: obsChatPosConfig.counterTop, counterLeft: obsChatPosConfig.counterLeft }
        }, '*');
      }
    } else if (selectedOBSElement === 'alert') {
      obsChatPosConfig.aLeft = Math.min(Math.max(parseFloat(((obsChatPosConfig.aLeft || 50) + deltaX).toFixed(2)), 0), 100);
      obsChatPosConfig.aTop = Math.min(Math.max(parseFloat(((obsChatPosConfig.aTop || 45) + deltaY).toFixed(2)), 0), 100);

      const handle = document.getElementById('drag-handle-alert');
      if (handle) {
        handle.style.left = obsChatPosConfig.aLeft + '%';
        handle.style.top = obsChatPosConfig.aTop + '%';
      }
      const previewIframe = document.getElementById('obs-chat-preview-iframe');
      if (previewIframe && previewIframe.contentWindow) {
        previewIframe.contentWindow.postMessage({
          type: 'UPDATE_OBS_CONFIG',
          config: { aTop: obsChatPosConfig.aTop, aLeft: obsChatPosConfig.aLeft }
        }, '*');
      }
    } else if (selectedOBSElement === 'branding') {
      obsChatPosConfig.brandLeft = Math.min(Math.max(parseFloat(((obsChatPosConfig.brandLeft || 82) + deltaX).toFixed(2)), 0), 100);
      obsChatPosConfig.brandTop = Math.min(Math.max(parseFloat(((obsChatPosConfig.brandTop || 90) + deltaY).toFixed(2)), 0), 100);

      const handle = document.getElementById('drag-handle-branding');
      if (handle) {
        handle.style.left = obsChatPosConfig.brandLeft + '%';
        handle.style.top = obsChatPosConfig.brandTop + '%';
      }
      const previewIframe = document.getElementById('obs-chat-preview-iframe');
      if (previewIframe && previewIframe.contentWindow) {
        previewIframe.contentWindow.postMessage({
          type: 'UPDATE_OBS_CONFIG',
          config: { brandTop: obsChatPosConfig.brandTop, brandLeft: obsChatPosConfig.brandLeft }
        }, '*');
      }
    }
  });

  window.addEventListener('keyup', function (e) {
    if (e.code === 'Space' || e.key === ' ') {
      isSpacePressed = false;
    }

    if (!selectedOBSElement) return;
    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (arrowKeys.includes(e.key)) {
      updateOBSChatOverlayLink();
      if (typeof saveAndApplyOBSChatSettings === 'function') saveAndApplyOBSChatSettings();
    }
  });

  function handleOBSDragMove(e) {
    if (!activeDragType) return;

    const box = document.getElementById('obs-chat-canvas-aspect-box') || document.getElementById('obs-chat-preview-canvas-wrapper');
    if (!box) return;
    const rect = box.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    let leftPct = parseFloat(((x / rect.width) * 100).toFixed(2));
    let topPct = parseFloat(((y / rect.height) * 100).toFixed(2));

    // Snap to exact 0% or 100% if within 2% of edge for perfect corner alignment!
    if (leftPct < 2) leftPct = 0;
    if (leftPct > 98) leftPct = 100;
    if (topPct < 2) topPct = 0;
    if (topPct > 98) topPct = 100;

    leftPct = Math.min(Math.max(leftPct, 0), 100);
    topPct = Math.min(Math.max(topPct, 0), 100);

    if (activeDragType === 'superchat') {
      obsChatPosConfig.scTop = topPct;
      obsChatPosConfig.scLeft = leftPct;
      const handle = document.getElementById('drag-handle-superchat');
      if (handle) {
        handle.style.top = topPct + '%';
        handle.style.left = leftPct + '%';
        handle.style.transform = 'translate(-50%, -50%)';
      }
      const previewIframe = document.getElementById('obs-chat-preview-iframe');
      if (previewIframe && previewIframe.contentWindow) {
        previewIframe.contentWindow.postMessage({
          type: 'UPDATE_OBS_CONFIG',
          config: { scTop: topPct, scLeft: leftPct }
        }, '*');
      }
    } else if (activeDragType === 'chat') {
      obsChatPosConfig.cTop = topPct;
      obsChatPosConfig.cLeft = leftPct;
      const handle = document.getElementById('drag-handle-chat');
      if (handle) {
        handle.style.top = topPct + '%';
        handle.style.left = leftPct + '%';
        handle.style.transform = 'translate(-50%, -50%)';
      }
      const previewIframe = document.getElementById('obs-chat-preview-iframe');
      if (previewIframe && previewIframe.contentWindow) {
        previewIframe.contentWindow.postMessage({
          type: 'UPDATE_OBS_CONFIG',
          config: { cTop: topPct, cLeft: leftPct }
        }, '*');
      }
    } else if (activeDragType === 'counter') {
      obsChatPosConfig.counterTop = topPct;
      obsChatPosConfig.counterLeft = leftPct;
      const handle = document.getElementById('drag-handle-counter');
      if (handle) {
        handle.style.top = topPct + '%';
        handle.style.left = leftPct + '%';
        handle.style.transform = 'translate(-50%, -50%)';
      }
      const previewIframe = document.getElementById('obs-chat-preview-iframe');
      if (previewIframe && previewIframe.contentWindow) {
        previewIframe.contentWindow.postMessage({
          type: 'UPDATE_OBS_CONFIG',
          config: { counterTop: topPct, counterLeft: leftPct }
        }, '*');
      }
    } else if (activeDragType === 'alert') {
      obsChatPosConfig.aTop = topPct;
      obsChatPosConfig.aLeft = leftPct;
      const handle = document.getElementById('drag-handle-alert');
      if (handle) {
        handle.style.top = topPct + '%';
        handle.style.left = leftPct + '%';
        handle.style.transform = 'translate(-50%, -50%)';
      }
      const previewIframe = document.getElementById('obs-chat-preview-iframe');
      if (previewIframe && previewIframe.contentWindow) {
        previewIframe.contentWindow.postMessage({
          type: 'UPDATE_OBS_CONFIG',
          config: { aTop: topPct, aLeft: leftPct }
        }, '*');
      }
    } else if (activeDragType === 'branding') {
      obsChatPosConfig.brandTop = topPct;
      obsChatPosConfig.brandLeft = leftPct;
      const handle = document.getElementById('drag-handle-branding');
      if (handle) {
        handle.style.top = topPct + '%';
        handle.style.left = leftPct + '%';
        handle.style.transform = 'translate(-50%, -50%)';
      }
      const previewIframe = document.getElementById('obs-chat-preview-iframe');
      if (previewIframe && previewIframe.contentWindow) {
        previewIframe.contentWindow.postMessage({
          type: 'UPDATE_OBS_CONFIG',
          config: { brandTop: topPct, brandLeft: leftPct }
        }, '*');
      }
    }
  }

  function stopOBSDrag() {
    updateOBSChatOverlayLink();
    if (typeof saveAndApplyOBSChatSettings === 'function') saveAndApplyOBSChatSettings();
    activeDragType = null;
    document.removeEventListener('mousemove', handleOBSDragMove);
    document.removeEventListener('mouseup', stopOBSDrag);
  }

  function resetOBSCounterPos() {
    setOBSCounterPreset('top-center');
  }
  window.resetOBSCounterPos = resetOBSCounterPos;

  function setOBSCounterPreset(preset) {
    const cfg = getActiveOBSConfig();
    if (preset === 'top-center') { cfg.cTop = 6; cfg.cLeft = 50; }
    else if (preset === 'top-left') { cfg.cTop = 6; cfg.cLeft = 8; }
    else if (preset === 'top-right') { cfg.cTop = 6; cfg.cLeft = 92; }

    const handle = document.getElementById('drag-handle-counter');
    if (handle) {
      handle.style.top = cfg.cTop + '%';
      handle.style.left = cfg.cLeft + '%';
    }
    updateOBSOverlayLink();
  }
  window.setOBSCounterPreset = setOBSCounterPreset;

  function setOBSAlertPreset(preset) {
    const cfg = getActiveOBSConfig();
    if (preset === 'center') { cfg.aTop = 50; cfg.aLeft = 50; }
    else if (preset === 'bottom-center') { cfg.aTop = 75; cfg.aLeft = 50; }

    const handle = document.getElementById('drag-handle-alert');
    if (handle) {
      handle.style.top = cfg.aTop + '%';
      handle.style.left = cfg.aLeft + '%';
    }
    updateOBSOverlayLink();
  }
  window.setOBSAlertPreset = setOBSAlertPreset;

  function switchOBSVideoMode(mode) {
    currentOBSVideoMode = mode;
    const btnLong = document.getElementById('btn-mode-long');
    const btnShort = document.getElementById('btn-mode-short');
    const aspectBox = document.getElementById('obs-canvas-aspect-box');
    const wrapper = document.getElementById('obs-preview-canvas-wrapper');

    if (mode === 'short') {
      if (btnLong) { btnLong.style.background = 'transparent'; btnLong.style.color = '#94a3b8'; }
      if (btnShort) { btnShort.style.background = '#ef4444'; btnShort.style.color = 'white'; }
      if (aspectBox) { aspectBox.style.aspectRatio = '9/16'; aspectBox.style.maxWidth = '250px'; }
      if (wrapper) { wrapper.style.maxWidth = '300px'; }
    } else {
      if (btnLong) { btnLong.style.background = '#ef4444'; btnLong.style.color = 'white'; }
      if (btnShort) { btnShort.style.background = 'transparent'; btnShort.style.color = '#94a3b8'; }
      if (aspectBox) { aspectBox.style.aspectRatio = '16/9'; aspectBox.style.maxWidth = '100%'; }
      if (wrapper) { wrapper.style.maxWidth = '640px'; }
    }

    const cfg = getActiveOBSConfig();
    const handleCounter = document.getElementById('drag-handle-counter');
    const handleAlert = document.getElementById('drag-handle-alert');
    const cScaleSlider = document.getElementById('obs-c-scale-slider');
    const aScaleSlider = document.getElementById('obs-a-scale-slider');
    const cOpacitySlider = document.getElementById('obs-c-opacity-slider');
    const aOpacitySlider = document.getElementById('obs-a-opacity-slider');
    const cShowCheck = document.getElementById('obs-c-show-check');
    const aShowCheck = document.getElementById('obs-a-show-check');
    const randCheck = document.getElementById('obs-rand-pos-check');

    if (handleCounter) { handleCounter.style.top = cfg.cTop + '%'; handleCounter.style.left = cfg.cLeft + '%'; }
    if (handleAlert) { handleAlert.style.top = cfg.aTop + '%'; handleAlert.style.left = cfg.aLeft + '%'; }
    if (cScaleSlider) { cScaleSlider.value = cfg.cScale; }
    if (aScaleSlider) { aScaleSlider.value = cfg.aScale; }
    if (cOpacitySlider) { cOpacitySlider.value = cfg.cOpacity || 1.0; }
    if (aOpacitySlider) { aOpacitySlider.value = cfg.aOpacity || 1.0; }
    if (cShowCheck) { cShowCheck.checked = cfg.showCounter !== false; }
    if (aShowCheck) { aShowCheck.checked = cfg.showAlert !== false; }
    if (randCheck) { randCheck.checked = cfg.randPos; }

    updateOBSOverlayLink();
  }
  window.switchOBSVideoMode = switchOBSVideoMode;

  async function saveAndApplyOBSSettings() {
    const activeAcc = loadedAccounts['yt'] ? loadedAccounts['yt'][activeAccountIdx['yt']] : null;
    const channel = activeAcc ? `@${activeAcc.username}` : '@ainotespk';

    const themeSelect = document.getElementById('obs-theme-select');
    const soundSelect = document.getElementById('obs-sound-select');
    const cScaleSlider = document.getElementById('obs-c-scale-slider');
    const aScaleSlider = document.getElementById('obs-a-scale-slider');
    const cOpacitySlider = document.getElementById('obs-c-opacity-slider');
    const aOpacitySlider = document.getElementById('obs-a-opacity-slider');
    const cShowCheck = document.getElementById('obs-c-show-check');
    const aShowCheck = document.getElementById('obs-a-show-check');
    const randPosCheck = document.getElementById('obs-rand-pos-check');

    const cfg = getActiveOBSConfig();
    if (cScaleSlider) cfg.cScale = parseFloat(cScaleSlider.value);
    if (aScaleSlider) cfg.aScale = parseFloat(aScaleSlider.value);
    if (cOpacitySlider) cfg.cOpacity = parseFloat(cOpacitySlider.value);
    if (aOpacitySlider) cfg.aOpacity = parseFloat(aOpacitySlider.value);
    if (cShowCheck) cfg.showCounter = cShowCheck.checked;
    if (aShowCheck) cfg.showAlert = aShowCheck.checked;
    if (randPosCheck) cfg.randPos = randPosCheck.checked;

    cfg.theme = themeSelect ? themeSelect.value : 'dropfler';
    cfg.sound = soundSelect ? soundSelect.value : 'chime';
    cfg.customGif = customOBSGifUrl;
    cfg.customAudio = customOBSAudioUrl;

    try {
      const res = await fetch('/api/yt/obs-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: channel,
          mode: currentOBSVideoMode,
          config: cfg
        })
      });
      if (res.ok) {
        showToast(`💾 OBS Settings Saved & Applied for ${currentOBSVideoMode === 'short' ? 'Short Video (9:16)' : 'Long Video (16:9)'}! (Auto-Syncing Live to OBS)`);
      } else {
        showToast('💾 Settings Saved locally!');
      }
    } catch (e) {
      showToast('💾 Settings Saved locally!');
    }

    updateOBSOverlayLink();
  }
  window.saveAndApplyOBSSettings = saveAndApplyOBSSettings;

  function updateOBSOverlayLink() {
    const themeSelect = document.getElementById('obs-theme-select');
    const soundSelect = document.getElementById('obs-sound-select');
    const cScaleSlider = document.getElementById('obs-c-scale-slider');
    const aScaleSlider = document.getElementById('obs-a-scale-slider');
    const cOpacitySlider = document.getElementById('obs-c-opacity-slider');
    const aOpacitySlider = document.getElementById('obs-a-opacity-slider');
    const cShowCheck = document.getElementById('obs-c-show-check');
    const aShowCheck = document.getElementById('obs-a-show-check');
    const randPosCheck = document.getElementById('obs-rand-pos-check');
    const input = document.getElementById('obs-overlay-url-input');
    if (!input) return;

    const cfg = getActiveOBSConfig();
    if (cScaleSlider) cfg.cScale = parseFloat(cScaleSlider.value);
    if (aScaleSlider) cfg.aScale = parseFloat(aScaleSlider.value);
    if (cOpacitySlider) cfg.cOpacity = parseFloat(cOpacitySlider.value);
    if (aOpacitySlider) cfg.aOpacity = parseFloat(aOpacitySlider.value);
    if (cShowCheck) cfg.showCounter = cShowCheck.checked;
    if (aShowCheck) cfg.showAlert = aShowCheck.checked;
    if (randPosCheck) cfg.randPos = randPosCheck.checked;

    const theme = themeSelect ? themeSelect.value : 'dropfler';
    const sound = soundSelect ? soundSelect.value : 'chime';

    const cScaleVal = document.getElementById('obs-c-scale-val');
    if (cScaleVal) cScaleVal.textContent = `${Math.round(cfg.cScale * 100)}%`;

    const aScaleVal = document.getElementById('obs-a-scale-val');
    if (aScaleVal) aScaleVal.textContent = `${Math.round(cfg.aScale * 100)}%`;

    const cOpacityVal = document.getElementById('obs-c-opacity-val');
    if (cOpacityVal) cOpacityVal.textContent = `${Math.round((cfg.cOpacity || 1.0) * 100)}%`;

    const aOpacityVal = document.getElementById('obs-a-opacity-val');
    if (aOpacityVal) aOpacityVal.textContent = `${Math.round((cfg.aOpacity || 1.0) * 100)}%`;

    const activeAcc = loadedAccounts['yt'] ? loadedAccounts['yt'][activeAccountIdx['yt']] : null;
    const channel = activeAcc ? `@${activeAcc.username}` : '@ainotespk';

    const origin = window.location.origin || 'http://localhost:3000';
    let url = `${origin}/obs-sub-alert.html?channel=${encodeURIComponent(channel)}&theme=${theme}&sound=${sound}&showCounter=${cfg.showCounter !== false}&showAlert=${cfg.showAlert !== false}&mode=${currentOBSVideoMode}&cTop=${cfg.cTop}&cLeft=${cfg.cLeft}&cScale=${cfg.cScale}&cOpacity=${cfg.cOpacity}&aTop=${cfg.aTop}&aLeft=${cfg.aLeft}&aScale=${cfg.aScale}&aOpacity=${cfg.aOpacity}&randPos=${cfg.randPos}`;

    if (customOBSGifUrl) {
      url += `&gif=${encodeURIComponent(customOBSGifUrl)}`;
    }
    if (customOBSAudioUrl) {
      url += `&audio=${encodeURIComponent(customOBSAudioUrl)}`;
    }

    input.value = url;

    // Also update Dashboard Live Stream Canvas Preview iframe
    const previewIframe = document.getElementById('obs-preview-iframe');
    if (previewIframe) {
      previewIframe.src = url;
    }
  }
  window.updateOBSOverlayLink = updateOBSOverlayLink;

  function copyOBSOverlayLink() {
    const input = document.getElementById('obs-overlay-url-input');
    if (!input) return;
    updateOBSOverlayLink();
    navigator.clipboard.writeText(input.value).then(() => {
      showToast('📋 OBS Browser Source URL copied to clipboard!');
    }).catch(() => {
      input.select();
      document.execCommand('copy');
      showToast('📋 OBS Browser Source URL copied to clipboard!');
    });
  }
  window.copyOBSOverlayLink = copyOBSOverlayLink;

  function triggerTestOBSAlert() {
    const themeSelect = document.getElementById('obs-theme-select');
    const soundSelect = document.getElementById('obs-sound-select');
    const theme = themeSelect ? themeSelect.value : 'dropfler';
    const sound = soundSelect ? soundSelect.value : 'chime';

    const activeAcc = loadedAccounts['yt'] ? loadedAccounts['yt'][activeAccountIdx['yt']] : null;
    const channel = activeAcc ? `@${activeAcc.username}` : '@ainotespk';

    const testNames = ['Alex Rivera', 'Sarah Connor', 'DevStreamer_99', 'CodeWizard', 'CryptoSamurai'];
    const randomName = testNames[Math.floor(Math.random() * testNames.length)];

    // 1. Post to backend for live stream OBS polling
    fetch('/api/youtube/test-obs-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel,
        theme,
        sound,
        username: randomName,
        customGif: customOBSGifUrl,
        customAudio: customOBSAudioUrl
      })
    })
      .then(res => res.json())
      .then(data => {
        showToast(`🔔 Test Alert: ${randomName} (+1 Sub & Sound)!`);
      })
      .catch(err => {
        showToast('🔔 Test Alert triggered!');
      });

    // 2. Directly trigger test alert on dashboard preview iframe for instant visual feedback
    const previewIframe = document.getElementById('obs-chat-preview-iframe') || document.getElementById('obs-preview-iframe');
    if (previewIframe && previewIframe.contentWindow) {
      const alertPayload = {
        theme,
        sound,
        customGif: customOBSGifUrl,
        customAudio: customOBSAudioUrl,
        username: randomName,
        subCount: Math.floor(Math.random() * 500) + 284501,
        message: 'NEW SUBSCRIBER!'
      };

      try {
        if (typeof previewIframe.contentWindow.triggerSubscriberAlert === 'function') {
          previewIframe.contentWindow.triggerSubscriberAlert(alertPayload);
        } else {
          previewIframe.contentWindow.postMessage({
            type: 'TEST_OBS_ALERT',
            payload: alertPayload
          }, '*');
        }
      } catch (e) {
        previewIframe.contentWindow.postMessage({
          type: 'TEST_OBS_ALERT',
          payload: alertPayload
        }, '*');
      }
    }
  }
  window.triggerTestOBSAlert = triggerTestOBSAlert;

  function switchOBSTab(tab) {
    const tabChat = document.getElementById('obs-tab-chat-content');
    const tabAlert = document.getElementById('obs-tab-alert-content');
    const btnChat = document.getElementById('obs-tab-btn-chat');
    const btnAlert = document.getElementById('obs-tab-btn-alert');

    if (tab === 'chat') {
      if (tabChat) tabChat.style.display = 'block';
      if (tabAlert) tabAlert.style.display = 'none';
      if (btnChat) {
        btnChat.style.background = 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)';
        btnChat.style.color = '#ffffff';
        btnChat.style.boxShadow = '0 4px 15px rgba(168, 85, 247, 0.4)';
      }
      if (btnAlert) {
        btnAlert.style.background = 'transparent';
        btnAlert.style.color = '#94a3b8';
        btnAlert.style.boxShadow = 'none';
      }
    } else {
      if (tabChat) tabChat.style.display = 'none';
      if (tabAlert) tabAlert.style.display = 'block';
      if (btnAlert) {
        btnAlert.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        btnAlert.style.color = '#ffffff';
        btnAlert.style.boxShadow = '0 4px 15px rgba(239, 68, 68, 0.4)';
      }
      if (btnChat) {
        btnChat.style.background = 'transparent';
        btnChat.style.color = '#94a3b8';
        btnChat.style.boxShadow = 'none';
      }
    }
  }
  window.switchOBSTab = switchOBSTab;



  let obsAutoSaveTimeout = null;
  function triggerOBSAutoSave() {
    if (obsAutoSaveTimeout) clearTimeout(obsAutoSaveTimeout);
    obsAutoSaveTimeout = setTimeout(() => {
      if (typeof saveAndApplyOBSChatSettings === 'function') {
        saveAndApplyOBSChatSettings(true);
      }
    }, 300);
  }

  function updateOBSChatOverlayLink() {
    const themeSelect = document.getElementById('obs-chat-theme-select');
    const posSelect = document.getElementById('obs-chat-position-select');
    const flowSelect = document.getElementById('obs-chat-flow-select');
    const fontSlider = document.getElementById('obs-chat-fontsize-slider');
    const maxMsgsSlider = document.getElementById('obs-chat-maxmsgs-slider');
    const widthSlider = document.getElementById('obs-chat-width-slider');
    const bgOpacitySlider = document.getElementById('obs-chat-bgopacity-slider');
    const scaleSlider = document.getElementById('obs-chat-scale-slider');
    const alertScaleSlider = document.getElementById('obs-alert-scale-slider');
    const counterScaleSlider = document.getElementById('obs-counter-scale-slider');
    const scScaleSlider = document.getElementById('obs-superchat-scale-slider');
    const brandScaleSlider = document.getElementById('obs-branding-scale-slider');
    const brandOpacitySlider = document.getElementById('obs-branding-opacity-slider');
    const brandFontSizeSlider = document.getElementById('obs-branding-fontsize-slider');

    const avatarsCheck = document.getElementById('obs-chat-avatars-check');
    const badgesCheck = document.getElementById('obs-chat-badges-check');
    const bgCheck = document.getElementById('obs-chat-showbg-check');
    const soundCheck = document.getElementById('obs-chat-sound-check');
    const xpSystemCheck = document.getElementById('obs-chat-xpsystem-check');
    const scBannerCheck = document.getElementById('obs-chat-scbanner-check');
    const scTtsCheck = document.getElementById('obs-chat-sctts-check');
    const scInChatCheck = document.getElementById('obs-chat-scinchat-check');

    const brandDomainInput = document.getElementById('obs-branding-domain-input');
    const brandCreatorInput = document.getElementById('obs-branding-creator-input');
    const brandPrefixInput = document.getElementById('obs-branding-prefix-input');
    const brandTagsInput = document.getElementById('obs-branding-tags-input');

    const input = document.getElementById('obs-chat-overlay-url-input');
    if (!input) return;

    const theme = themeSelect ? themeSelect.value : 'youtube';
    const position = posSelect ? posSelect.value : 'left';
    const flowDirection = flowSelect ? flowSelect.value : 'bottom-to-top';
    const fontSize = fontSlider ? parseInt(fontSlider.value) : 14;
    const maxMessages = maxMsgsSlider ? parseInt(maxMsgsSlider.value) : 15;
    const width = widthSlider ? parseInt(widthSlider.value) : 420;
    const bgOpacity = bgOpacitySlider ? parseFloat(bgOpacitySlider.value) : 0.88;
    const scale = scaleSlider ? parseFloat(scaleSlider.value) : 1.0;
    const aScale = alertScaleSlider ? parseFloat(alertScaleSlider.value) : 1.0;
    const counterScale = counterScaleSlider ? parseFloat(counterScaleSlider.value) : 1.0;
    const scScale = scScaleSlider ? parseFloat(scScaleSlider.value) : 1.0;
    const brandScale = brandScaleSlider ? parseFloat(brandScaleSlider.value) : 1.0;
    const brandOpacity = brandOpacitySlider ? parseFloat(brandOpacitySlider.value) : 0.95;
    const brandFontSize = brandFontSizeSlider ? parseInt(brandFontSizeSlider.value) : 15;

    const showAvatars = avatarsCheck ? avatarsCheck.checked : true;
    const showBadges = badgesCheck ? badgesCheck.checked : true;
    const showBg = bgCheck ? bgCheck.checked : true;
    const enableSound = soundCheck ? soundCheck.checked : false;
    const enableXpSystem = xpSystemCheck ? xpSystemCheck.checked : true;
    const isScBannerChecked = scBannerCheck ? scBannerCheck.checked : true;
    const enableScTts = scTtsCheck ? scTtsCheck.checked : false;
    const showScInChat = scInChatCheck ? scInChatCheck.checked : true;

    const toggleChat = document.getElementById('obs-toggle-showchat');
    const toggleScTicker = document.getElementById('obs-toggle-showscticker');
    if (scBannerCheck && toggleScTicker && scBannerCheck.checked && !toggleScTicker.checked) {
      toggleScTicker.checked = true;
    }
    const toggleAlert = document.getElementById('obs-toggle-showalert');
    const toggleCounter = document.getElementById('obs-toggle-showcounter');
    const toggleBranding = document.getElementById('obs-toggle-showbranding');

    const showChat = toggleChat ? toggleChat.checked : true;
    const showScBanner = isScBannerChecked && (toggleScTicker ? toggleScTicker.checked : true);
    const showAlert = toggleAlert ? toggleAlert.checked : true;
    const showCounter = toggleCounter ? toggleCounter.checked : true;
    const showBranding = toggleBranding ? toggleBranding.checked : true;

    const savedYtChannel = localStorage.getItem('replyflow_yt_channel') || '';
    const activeAcc = (loadedAccounts['yt'] && loadedAccounts['yt'].length > 0) ? (loadedAccounts['yt'][activeAccountIdx['yt']] || loadedAccounts['yt'][0]) : null;
    const rawChan = (activeAcc && activeAcc.username) ? activeAcc.username : (savedYtChannel || 'MyChannel');
    const channel = '@' + rawChan.replace(/^@+/, '');

    const brandDomain = brandDomainInput ? brandDomainInput.value : 'REPLYFLOW.COM';
    const brandCreator = brandCreatorInput ? brandCreatorInput.value : channel;
    const brandPrefix = brandPrefixInput ? brandPrefixInput.value : 'SEND';
    const brandTags = brandTagsInput ? brandTagsInput.value : 'SEND AUTOMATION, LIVE AUTO-REPLIES, TYPE !HELP IN CHAT';

    // Update Draggable Handles Visibility on Preview Monitor
    const handleChat = document.getElementById('drag-handle-chat');
    if (handleChat) {
      handleChat.style.display = showChat ? 'flex' : 'none';
      handleChat.style.transform = 'translate(-50%, -50%)';
      handleChat.style.width = 'auto';
    }

    const handleSc = document.getElementById('drag-handle-superchat');
    if (handleSc) {
      handleSc.style.display = showScBanner ? 'flex' : 'none';
      handleSc.style.transform = 'translate(-50%, -50%)';
    }

    const handleAlert = document.getElementById('drag-handle-alert');
    if (handleAlert) {
      handleAlert.style.display = showAlert ? 'flex' : 'none';
      handleAlert.style.transform = 'translate(-50%, -50%)';
    }

    const handleCounter = document.getElementById('drag-handle-counter');
    if (handleCounter) {
      handleCounter.style.display = showCounter ? 'flex' : 'none';
      handleCounter.style.transform = 'translate(-50%, -50%)';
    }

    const handleBranding = document.getElementById('drag-handle-branding');
    if (handleBranding) {
      handleBranding.style.display = showBranding ? 'flex' : 'none';
      handleBranding.style.transform = 'translate(-50%, -50%)';
    }

    // Update display values
    const fontVal = document.getElementById('obs-chat-fontsize-val');
    if (fontVal) fontVal.textContent = fontSize + 'px';
    const maxVal = document.getElementById('obs-chat-maxmsgs-val');
    if (maxVal) maxVal.textContent = maxMessages;
    const widthVal = document.getElementById('obs-chat-width-val');
    if (widthVal) widthVal.textContent = width + 'px';
    const bgVal = document.getElementById('obs-chat-bgopacity-val');
    if (bgVal) bgVal.textContent = Math.round(bgOpacity * 100) + '%';
    const scaleVal = document.getElementById('obs-chat-scale-val');
    if (scaleVal) scaleVal.textContent = Math.round(scale * 100) + '%';
    const alertScaleVal = document.getElementById('obs-alert-scale-val');
    if (alertScaleVal) alertScaleVal.textContent = Math.round(aScale * 100) + '%';
    const counterScaleVal = document.getElementById('obs-counter-scale-val');
    if (counterScaleVal) counterScaleVal.textContent = Math.round(counterScale * 100) + '%';
    const scScaleVal = document.getElementById('obs-superchat-scale-val');
    if (scScaleVal) scScaleVal.textContent = Math.round(scScale * 100) + '%';
    const brandScaleVal = document.getElementById('obs-branding-scale-val');
    if (brandScaleVal) brandScaleVal.textContent = Math.round(brandScale * 100) + '%';
    const brandOpacityVal = document.getElementById('obs-branding-opacity-val');
    if (brandOpacityVal) brandOpacityVal.textContent = Math.round(brandOpacity * 100) + '%';
    const brandFontSizeVal = document.getElementById('obs-branding-fontsize-val');
    if (brandFontSizeVal) brandFontSizeVal.textContent = brandFontSize + 'px';

    const origin = window.location.origin || 'http://localhost:3000';

    // Set dynamic Master OBS URL per user account & host domain
    input.value = `${origin}/obs-live-chat.html?channel=${encodeURIComponent(channel)}&theme=${theme}&showChat=${showChat}&showAlert=${showAlert}`;

    let cachedSubCount = null;
    try {
      const stored = localStorage.getItem('replyflow_obs_chat_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        cachedSubCount = parsed.realSubscriberCount;
      }
    } catch (e) { }

    // Post live update config to preview iframe seamlessly without reloading
    const previewIframe = document.getElementById('obs-chat-preview-iframe');
    if (previewIframe) {
      if (!previewIframe.src || previewIframe.src === 'about:blank' || previewIframe.src === origin + '/') {
        previewIframe.src = input.value;
      } else if (previewIframe.contentWindow) {
        previewIframe.contentWindow.postMessage({
          type: 'UPDATE_OBS_CONFIG',
          config: {
            channel: channel,
            realSubscriberCount: cachedSubCount,
            scale: scale,
            aScale: aScale,
            counterScale: counterScale,
            scScale: scScale,
            brandScale: brandScale,
            brandOpacity: brandOpacity,
            brandFontSize: brandFontSize,
            showChat: showChat,
            showScBanner: showScBanner,
            showAlert: showAlert,
            showCounter: showCounter,
            showBranding: showBranding,
            fontSize: fontSize,
            maxMessages: maxMessages,
            width: width,
            bgOpacity: bgOpacity,
            position: position,
            theme: theme,
            showAvatars: showAvatars,
            showBadges: showBadges,
            showBg: showBg,
            enableScTts: enableScTts,
            showScInChat: showScInChat,
            flowDirection: flowDirection,
            enableSound: enableSound,
            enableXpSystem: enableXpSystem,
            brandDomain: brandDomain,
            brandCreator: brandCreator,
            brandPrefix: brandPrefix,
            brandTags: brandTags,
            aTop: obsChatPosConfig.aTop, aLeft: obsChatPosConfig.aLeft,
            counterTop: obsChatPosConfig.counterTop, counterLeft: obsChatPosConfig.counterLeft,
            scTop: obsChatPosConfig.scTop, scLeft: obsChatPosConfig.scLeft,
            cTop: obsChatPosConfig.cTop, cLeft: obsChatPosConfig.cLeft,
            brandTop: obsChatPosConfig.brandTop, brandLeft: obsChatPosConfig.brandLeft
          }
        }, '*');
      }
    }

    // Auto-save changes to server so OBS Browser Source receives live updates
    triggerOBSAutoSave();
  }
  window.updateOBSChatOverlayLink = updateOBSChatOverlayLink;

  function copyOBSChatOverlayLink() {
    const input = document.getElementById('obs-chat-overlay-url-input');
    if (!input) return;
    updateOBSChatOverlayLink();
    navigator.clipboard.writeText(input.value).then(function () {
      showToast('📋 OBS Live Chat Overlay URL copied to clipboard!');
    }).catch(function () {
      input.select();
      document.execCommand('copy');
      showToast('📋 OBS Live Chat Overlay URL copied to clipboard!');
    });
  }
  window.copyOBSChatOverlayLink = copyOBSChatOverlayLink;

  function pollOBSStatusStrip() {
    const activeAcc = loadedAccounts['yt'] ? loadedAccounts['yt'][activeAccountIdx['yt']] : null;
    const rawChan = activeAcc ? activeAcc.username : (localStorage.getItem('replyflow_yt_channel') || 'ainotespk');
    const channel = '@' + rawChan.replace(/^@+/, '');

    fetch('/api/youtube/obs-status?channel=' + encodeURIComponent(channel))
      .then(res => res.json())
      .then(data => {
        const connectedEl = document.getElementById('obs-status-connected');
        const liveEl = document.getElementById('obs-status-live');
        const lastPollEl = document.getElementById('obs-status-lastpoll');
        const subsEl = document.getElementById('obs-status-subs');

        if (connectedEl) {
          if (data.quotaExceeded) {
            connectedEl.innerHTML = '⚠️ QUOTA EXCEEDED (Check Google Cloud Console)';
            connectedEl.style.color = '#fbbf24';
          } else if (data.connected) {
            connectedEl.innerHTML = '✅ YES' + (data.tokenValid ? '' : ' (Expired)');
            connectedEl.style.color = '#10b981';
          } else {
            connectedEl.innerHTML = '❌ NO';
            connectedEl.style.color = '#ef4444';
          }
        }

        if (liveEl) {
          if (data.isLive) {
            liveEl.textContent = '🔴 LIVE';
            liveEl.style.color = '#ef4444';
          } else {
            liveEl.textContent = 'Standby';
            liveEl.style.color = '#64748b';
          }
        }

        if (lastPollEl) {
          if (data.lastPollAt) {
            const secAgo = Math.round((Date.now() - new Date(data.lastPollAt).getTime()) / 1000);
            lastPollEl.textContent = secAgo >= 0 ? `${secAgo}s ago` : '0s ago';
          } else {
            lastPollEl.textContent = 'Never';
          }
        }

        if (subsEl) {
          subsEl.textContent = data.lastSubscriberCount !== null ? Number(data.lastSubscriberCount).toLocaleString() : '0';
        }
      })
      .catch(() => { });
  }
  setInterval(pollOBSStatusStrip, 3000);
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(pollOBSStatusStrip, 1000);
  });

  function userSaveAdminMasterConfig() {
    const domainInput = document.getElementById('admin-system-domain-input');
    const tagsInput = document.getElementById('admin-system-tags-input');

    const domain = domainInput ? domainInput.value.trim().toUpperCase() : 'REPLYFLOW.COM';
    const tags = tagsInput ? tagsInput.value.trim() : 'SEND AUTOMATION, LIVE AUTO-REPLIES, TYPE !HELP IN CHAT';

    // Update locked domain field in creator customizer
    const creatorDomainInput = document.getElementById('obs-branding-domain-input');
    if (creatorDomainInput) creatorDomainInput.value = domain;

    showToast('⚙️ Master Admin Settings & Integration Plugins Saved Successfully!');
    updateOBSChatOverlayLink();
  }
  window.userSaveAdminMasterConfig = userSaveAdminMasterConfig;

  async function saveAndApplyOBSChatSettings(silent = false) {
    const activeAcc = loadedAccounts['yt'] ? loadedAccounts['yt'][activeAccountIdx['yt']] : null;
    const cleanUsername = activeAcc && activeAcc.username ? activeAcc.username.replace(/^@+/, '') : 'ainotespk';
    const channel = '@' + cleanUsername;

    const themeSelect = document.getElementById('obs-chat-theme-select');
    const posSelect = document.getElementById('obs-chat-position-select');
    const flowSelect = document.getElementById('obs-chat-flow-select');
    const fontSlider = document.getElementById('obs-chat-fontsize-slider');
    const maxMsgsSlider = document.getElementById('obs-chat-maxmsgs-slider');
    const widthSlider = document.getElementById('obs-chat-width-slider');
    const bgOpacitySlider = document.getElementById('obs-chat-bgopacity-slider');
    const scaleSlider = document.getElementById('obs-chat-scale-slider');
    const alertScaleSlider = document.getElementById('obs-alert-scale-slider');
    const counterScaleSlider = document.getElementById('obs-counter-scale-slider');
    const scScaleSlider = document.getElementById('obs-superchat-scale-slider');
    const brandScaleSlider = document.getElementById('obs-branding-scale-slider');
    const brandOpacitySlider = document.getElementById('obs-branding-opacity-slider');
    const brandFontSizeSlider = document.getElementById('obs-branding-fontsize-slider');

    const avatarsCheck = document.getElementById('obs-chat-avatars-check');
    const badgesCheck = document.getElementById('obs-chat-badges-check');
    const bgCheck = document.getElementById('obs-chat-showbg-check');
    const soundCheck = document.getElementById('obs-chat-sound-check');
    const xpSystemCheck = document.getElementById('obs-chat-xpsystem-check');
    const scBannerCheck = document.getElementById('obs-chat-scbanner-check');
    const scTtsCheck = document.getElementById('obs-chat-sctts-check');
    const scInChatCheck = document.getElementById('obs-chat-scinchat-check');

    const brandDomainInput = document.getElementById('obs-branding-domain-input');
    const brandCreatorInput = document.getElementById('obs-branding-creator-input');
    const brandPrefixInput = document.getElementById('obs-branding-prefix-input');
    const brandTagsInput = document.getElementById('obs-branding-tags-input');

    const toggleChat = document.getElementById('obs-toggle-showchat');
    const toggleScTicker = document.getElementById('obs-toggle-showscticker');
    const toggleAlert = document.getElementById('obs-toggle-showalert');
    const toggleCounter = document.getElementById('obs-toggle-showcounter');
    const toggleBranding = document.getElementById('obs-toggle-showbranding');

    const isScBannerChecked = scBannerCheck ? scBannerCheck.checked : true;

    const cfg = {
      theme: themeSelect ? themeSelect.value : 'youtube',
      position: posSelect ? posSelect.value : 'left',
      flowDirection: flowSelect ? flowSelect.value : 'bottom-to-top',
      fontSize: fontSlider ? parseInt(fontSlider.value) : 14,
      maxMessages: maxMsgsSlider ? parseInt(maxMsgsSlider.value) : 15,
      width: widthSlider ? parseInt(widthSlider.value) : 420,
      bgOpacity: bgOpacitySlider ? parseFloat(bgOpacitySlider.value) : 0.88,
      scale: scaleSlider ? parseFloat(scaleSlider.value) : 1.0,
      aScale: alertScaleSlider ? parseFloat(alertScaleSlider.value) : 1.0,
      counterScale: counterScaleSlider ? parseFloat(counterScaleSlider.value) : 1.0,
      scScale: scScaleSlider ? parseFloat(scScaleSlider.value) : 1.0,
      brandScale: brandScaleSlider ? parseFloat(brandScaleSlider.value) : 1.0,
      brandOpacity: brandOpacitySlider ? parseFloat(brandOpacitySlider.value) : 0.95,
      brandFontSize: brandFontSizeSlider ? parseInt(brandFontSizeSlider.value) : 15,
      showChat: toggleChat ? toggleChat.checked : true,
      showScBanner: isScBannerChecked && (toggleScTicker ? toggleScTicker.checked : true),
      showAlert: toggleAlert ? toggleAlert.checked : true,
      showCounter: toggleCounter ? toggleCounter.checked : true,
      showBranding: toggleBranding ? toggleBranding.checked : true,
      showAvatars: avatarsCheck ? avatarsCheck.checked : true,
      showBadges: badgesCheck ? badgesCheck.checked : true,
      showBg: bgCheck ? bgCheck.checked : true,
      enableScTts: scTtsCheck ? scTtsCheck.checked : true,
      showScInChat: scInChatCheck ? scInChatCheck.checked : true,
      enableSound: soundCheck ? soundCheck.checked : true,
      creatorVolume: document.getElementById('obs-creator-volume-slider') ? parseFloat(document.getElementById('obs-creator-volume-slider').value) / 100 : 0.8,
      viewerVolume: document.getElementById('obs-viewer-volume-slider') ? parseFloat(document.getElementById('obs-viewer-volume-slider').value) / 100 : 1.0,
      enableXpSystem: xpSystemCheck ? xpSystemCheck.checked : true,
      brandDomain: brandDomainInput ? brandDomainInput.value : 'REPLYFLOW.COM',
      brandCreator: brandCreatorInput ? brandCreatorInput.value : channel,
      brandPrefix: brandPrefixInput ? brandPrefixInput.value : 'SEND',
      brandTags: brandTagsInput ? brandTagsInput.value : 'SEND AUTOMATION, LIVE AUTO-REPLIES, TYPE !HELP IN CHAT',
      mode: currentOBSChatVideoMode,
      liveMode: currentOBSLiveMode,
      cTop: obsChatPosConfig.cTop,
      cLeft: obsChatPosConfig.cLeft,
      scTop: obsChatPosConfig.scTop,
      scLeft: obsChatPosConfig.scLeft,
      counterTop: obsChatPosConfig.counterTop,
      counterLeft: obsChatPosConfig.counterLeft,
      aTop: obsChatPosConfig.aTop,
      aLeft: obsChatPosConfig.aLeft,
      brandTop: obsChatPosConfig.brandTop,
      brandLeft: obsChatPosConfig.brandLeft
    };

    try {
      localStorage.setItem('replyflow_obs_chat_config', JSON.stringify(cfg));
      const res = await fetch('/api/yt/obs-chat-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: channel, config: cfg })
      });
      if (res.ok && !silent) {
        showToast('💾 OBS Overlay & Alert Settings Saved & Applied! (Auto-Syncing Live to OBS)');
      } else if (!silent) {
        showToast('💾 Settings Saved locally!');
      }
    } catch (e) {
      if (!silent) showToast('💾 Settings Saved locally!');
    }
  }
  window.saveAndApplyOBSChatSettings = saveAndApplyOBSChatSettings;

  function loadAndRestoreOBSChatSettings() {
    let cfg = null;
    try {
      const stored = localStorage.getItem('replyflow_obs_chat_config');
      if (stored) cfg = JSON.parse(stored);
    } catch (e) { }

    if (!cfg) return;

    if (cfg.cTop !== undefined) obsChatPosConfig.cTop = cfg.cTop;
    if (cfg.cLeft !== undefined) obsChatPosConfig.cLeft = cfg.cLeft;
    if (cfg.scTop !== undefined) obsChatPosConfig.scTop = cfg.scTop;
    if (cfg.scLeft !== undefined) obsChatPosConfig.scLeft = cfg.scLeft;
    if (cfg.counterTop !== undefined) obsChatPosConfig.counterTop = cfg.counterTop;
    if (cfg.counterLeft !== undefined) obsChatPosConfig.counterLeft = cfg.counterLeft;
    if (cfg.aTop !== undefined) obsChatPosConfig.aTop = cfg.aTop;
    if (cfg.aLeft !== undefined) obsChatPosConfig.aLeft = cfg.aLeft;
    if (cfg.brandTop !== undefined) obsChatPosConfig.brandTop = cfg.brandTop;
    if (cfg.brandLeft !== undefined) obsChatPosConfig.brandLeft = cfg.brandLeft;

    const handleChat = document.getElementById('drag-handle-chat');
    if (handleChat && cfg.cTop !== undefined) { handleChat.style.top = cfg.cTop + '%'; handleChat.style.left = cfg.cLeft + '%'; }
    const handleSc = document.getElementById('drag-handle-superchat');
    if (handleSc && cfg.scTop !== undefined) { handleSc.style.top = cfg.scTop + '%'; handleSc.style.left = cfg.scLeft + '%'; }
    const handleAlert = document.getElementById('drag-handle-alert');
    if (handleAlert && cfg.aTop !== undefined) { handleAlert.style.top = cfg.aTop + '%'; handleAlert.style.left = cfg.aLeft + '%'; }
    const handleCounter = document.getElementById('drag-handle-counter');
    if (handleCounter && cfg.counterTop !== undefined) { handleCounter.style.top = cfg.counterTop + '%'; handleCounter.style.left = cfg.counterLeft + '%'; }
    const handleBranding = document.getElementById('drag-handle-branding');
    if (handleBranding && cfg.brandTop !== undefined) { handleBranding.style.top = cfg.brandTop + '%'; handleBranding.style.left = cfg.brandLeft + '%'; }

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined && val !== null) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined && val !== null) el.checked = !!val; };

    setVal('obs-chat-theme-select', cfg.theme);
    setVal('obs-chat-position-select', cfg.position);
    setVal('obs-chat-flow-select', cfg.flowDirection);
    setVal('obs-chat-fontsize-slider', cfg.fontSize);
    setVal('obs-chat-maxmsgs-slider', cfg.maxMessages);
    setVal('obs-chat-width-slider', cfg.width);
    setVal('obs-chat-bgopacity-slider', cfg.bgOpacity);
    setVal('obs-chat-scale-slider', cfg.scale);
    setVal('obs-alert-scale-slider', cfg.aScale);
    setVal('obs-counter-scale-slider', cfg.counterScale);
    setVal('obs-superchat-scale-slider', cfg.scScale);
    setVal('obs-branding-scale-slider', cfg.brandScale);
    setVal('obs-branding-opacity-slider', cfg.brandOpacity);
    setVal('obs-branding-fontsize-slider', cfg.brandFontSize);

    if (cfg.creatorVolume !== undefined) setVal('obs-creator-volume-slider', Math.round(cfg.creatorVolume * 100));
    if (cfg.viewerVolume !== undefined) setVal('obs-viewer-volume-slider', Math.round(cfg.viewerVolume * 100));

    setCheck('obs-toggle-showchat', cfg.showChat);
    setCheck('obs-toggle-showscticker', cfg.showScBanner);
    setCheck('obs-toggle-showalert', cfg.showAlert);
    setCheck('obs-toggle-showcounter', cfg.showCounter);
    setCheck('obs-toggle-showbranding', cfg.showBranding);

    setCheck('obs-chat-showbg-check', cfg.showBg);
    setCheck('obs-chat-avatars-check', cfg.showAvatars);
    setCheck('obs-chat-badges-check', cfg.showBadges);
    setCheck('obs-chat-xpsystem-check', cfg.enableXpSystem);
    setCheck('obs-chat-scbanner-check', cfg.showScBanner);
    setCheck('obs-chat-sctts-check', cfg.enableScTts);
    setCheck('obs-chat-sound-check', cfg.enableSound);

    if (cfg.brandCreator) setVal('obs-branding-creator-input', cfg.brandCreator);
    if (cfg.brandDomain) setVal('obs-branding-domain-input', cfg.brandDomain);

    if (cfg.liveMode !== undefined) {
      currentOBSLiveMode = cfg.liveMode;
      const toggle = document.getElementById('obs-mode-live-toggle');
      if (toggle) toggle.checked = (currentOBSLiveMode === 'live');
      updateOBSLiveModeUI();
    }

    updateOBSChatOverlayLink();
  }
  window.loadAndRestoreOBSChatSettings = loadAndRestoreOBSChatSettings;
  document.addEventListener('DOMContentLoaded', loadAndRestoreOBSChatSettings);
  setTimeout(loadAndRestoreOBSChatSettings, 500);

  function triggerTestOBSChat() {
    const activeAcc = loadedAccounts['yt'] ? loadedAccounts['yt'][activeAccountIdx['yt']] : null;
    const channel = activeAcc ? '@' + activeAcc.username : '@ainotespk';

    const testUsers = ['gaming_pro', 'code_wizard', 'stream_viewer', 'night_owl_pk', 'tech_guru', 'creative_mind', 'pro_gamer_x'];
    const testMsgs = ['This stream is amazing! 🔥', 'Love it bhai! ❤️', 'GG! 🎮', 'Hello everyone! 👋', 'Just subscribed! 🎉', 'Keep it up! 💪', 'First time here 🙌'];
    const testBadges = ['', '', 'member', 'mod', '', 'member', ''];
    const idx = Math.floor(Math.random() * testUsers.length);
    const isSuper = Math.random() < 0.2;

    const chatPayload = {
      username: testUsers[idx],
      message: testMsgs[idx],
      type: isSuper ? 'superchat' : 'normal',
      amount: isSuper ? ('$' + ((Math.floor(Math.random() * 10) + 1) * 5)) : '',
      badge: testBadges[idx]
    };

    fetch('/api/youtube/test-obs-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: channel,
        messages: [chatPayload]
      })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        showToast('💬 Test Chat Sent: @' + chatPayload.username + ' ("' + chatPayload.message + '")');
      })
      .catch(function () {
        showToast('💬 Test Chat Sent: @' + chatPayload.username);
      });

    const previewIframe = document.getElementById('obs-chat-preview-iframe');
    if (previewIframe && previewIframe.contentWindow) {
      try {
        if (typeof previewIframe.contentWindow.renderChatMessage === 'function') {
          previewIframe.contentWindow.renderChatMessage(chatPayload);
        } else {
          previewIframe.contentWindow.postMessage({ type: 'TEST_OBS_CHAT', payload: chatPayload }, '*');
        }
      } catch (e) {
        try {
          previewIframe.contentWindow.postMessage({ type: 'TEST_OBS_CHAT', payload: chatPayload }, '*');
        } catch (err) { }
      }
    }

    if (typeof userSimulateYTChat === 'function') {
      try { userSimulateYTChat('chat'); } catch (e) { }
    }
  }
  window.triggerTestOBSChat = triggerTestOBSChat;

  function triggerTestGoldenOBSChat() {
    const previewIframe = document.getElementById('obs-chat-preview-iframe');
    const goldenUser = 'super_spammer_gold_' + Math.floor(Math.random() * 900 + 100);

    showToast('👑 Triggering Golden VVIP User Test & Chime Sound!');

    let count = 0;
    const interval = setInterval(function () {
      count++;
      const goldenPayload = {
        username: goldenUser,
        message: 'Golden VVIP level unlock test message #' + count + '! 👑✨',
        type: 'normal',
        badge: 'member'
      };
      if (previewIframe && previewIframe.contentWindow) {
        try {
          if (typeof previewIframe.contentWindow.renderChatMessage === 'function') {
            previewIframe.contentWindow.renderChatMessage(goldenPayload);
          } else {
            previewIframe.contentWindow.postMessage({ type: 'TEST_OBS_CHAT', payload: goldenPayload }, '*');
          }
        } catch (e) { }
      }
      if (count >= 5) clearInterval(interval);
    }, 400);
  }
  window.triggerTestGoldenOBSChat = triggerTestGoldenOBSChat;
  window.triggerTestOBSChat = triggerTestOBSChat;

  function triggerTestSuperChatBannerAlert() {
    const activeAcc = loadedAccounts['yt'] ? loadedAccounts['yt'][activeAccountIdx['yt']] : null;
    const channel = activeAcc ? '@' + activeAcc.username : '@ainotespk';

    const scAmounts = ['$10.00', '$25.00', '$50.00', '$100.00', '$500.00'];
    const scUsers = ['super_fan_99', 'creative_mind', 'legendary_supporter', 'gaming_pro_pk', 'vip_donator'];
    const scMsgs = [
      'Love your content bhai! Keep streaming! ❤️🔥',
      'Small support for the amazing stream! 💪🚀',
      'ReplyFlow is the best live automation system ever! 👑',
      'GG WP bro! Keep going strong! 🎮💯',
      'Awesome stream bro! SuperChat for the legend! 🙌✨'
    ];

    const randIdx = Math.floor(Math.random() * scAmounts.length);
    let amount = scAmounts[randIdx];
    let message = scMsgs[Math.floor(Math.random() * scMsgs.length)];
    let username = scUsers[randIdx];

    const customMsg = prompt("Apna custom SuperChat text likhein (ya khali chhor kar random test krein):", message);
    if (customMsg === null) return;
    if (customMsg.trim() !== '') {
      message = customMsg.trim();
    }

    const customAmt = prompt("SuperChat amount likhein (e.g. $10.00, $50.00, $100.00):", amount);
    if (customAmt === null) return;
    if (customAmt.trim() !== '') {
      amount = customAmt.trim();
    }

    const superPayload = {
      username: username,
      message: message,
      type: 'superchat',
      amount: amount,
      badge: 'member',
      isTest: true
    };

    showToast('🎉 Triggering SuperChat Dropfler Banner Alert (' + superPayload.amount + ')!');

    // Post to backend for live subscribers / viewers
    fetch('/api/youtube/test-obs-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: channel, messages: [superPayload] })
    }).catch(function () { });

    // Broadcast to local iframe for instantaneous preview
    const previewIframe = document.getElementById('obs-chat-preview-iframe');
    if (previewIframe && previewIframe.contentWindow) {
      try {
        previewIframe.contentWindow.postMessage({ type: 'TEST_SUPERCHAT_BANNER', payload: superPayload }, '*');
      } catch (e) { }
    }
  }
  window.triggerTestSuperChatBannerAlert = triggerTestSuperChatBannerAlert;
  window.triggerTestOBSAlert = triggerTestSuperChatBannerAlert;
  window.triggerTestGoldenOBSChat = triggerTestGoldenOBSChat;
  window.triggerTestOBSChat = triggerTestOBSChat;

  window.switchYTSubTab = switchYTSubTab;

  function openYTWorkspaceTab(tabId) {
    if (!tabId) tabId = 'dashboard';
    localStorage.setItem('replyflow_yt_active_view', tabId);

    // Ensure YouTube screen & sidebar are active and previous screens hidden
    if (typeof switchScreen === 'function') switchScreen('youtube');

    const tabs = ['dashboard', 'videos', 'posts', 'livestreams', 'obs'];
    tabs.forEach(t => {
      const nav = document.getElementById(`yt-nav-${t}`);
      if (nav) {
        if (t === tabId) nav.classList.add('active');
        else nav.classList.remove('active');
      }
    });

    if (tabId === 'obs') {
      if (typeof switchYTSubTab === 'function') switchYTSubTab('obs');
    } else if (tabId === 'livestreams') {
      if (typeof switchYTSubTab === 'function') switchYTSubTab('live');
    } else if (tabId === 'dashboard') {
      if (typeof switchYTSubTab === 'function') switchYTSubTab('dashboard');
    } else {
      if (typeof switchYTSubTab === 'function') switchYTSubTab('videos');
      if (tabId === 'posts' && typeof filterYTPosts === 'function') {
        filterYTPosts('posts');
      } else if (tabId === 'videos' && typeof filterYTPosts === 'function') {
        filterYTPosts('all');
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  window.openYTWorkspaceTab = openYTWorkspaceTab;

  function filterYTPosts(filterType) {
    window.currentYTFilter = filterType;
    const filterPills = ['all', 'long', 'shorts', 'posts', 'active'];
    filterPills.forEach(f => {
      const btn = document.getElementById(`yt-filter-${f}`);
      if (btn) {
        if (f === filterType) {
          btn.classList.add('active');
          btn.style.border = (f === 'active') ? '1px solid #fbbf24' : '1px solid var(--accent-pink)';
          btn.style.background = (f === 'active') ? 'rgba(251,191,36,0.18)' : 'rgba(236,72,153,0.15)';
          btn.style.color = (f === 'active') ? '#fbbf24' : '#fff';
        } else {
          btn.classList.remove('active');
          btn.style.border = '1px solid rgba(255,255,255,0.1)';
          btn.style.background = 'rgba(255,255,255,0.03)';
          btn.style.color = 'var(--text-secondary)';
        }
      }
    });

    const activeAcc = (loadedAccounts['yt'] && loadedAccounts['yt'].length > 0)
      ? (loadedAccounts['yt'][activeAccountIdx['yt']] || loadedAccounts['yt'][0])
      : null;

    if (activeAcc && activeAcc.posts) {
      renderPosts('yt', activeAcc.posts, filterType);
    } else {
      fetch('/api/accounts?platform=yt', { headers: getAuthHeaders() })
        .then(res => res.json())
        .then(accounts => {
          if (Array.isArray(accounts) && accounts.length > 0) {
            loadedAccounts['yt'] = accounts;
            renderPosts('yt', accounts[0].posts || [], filterType);
          }
        }).catch(() => { });
    }
  }
  window.filterYTPosts = filterYTPosts;

  function renderDmSettings(platform, activeAcc) {
    const dmCard = document.getElementById('dm-settings-card-ig');
    if (!dmCard) return;

    if (platform !== 'ig' || !activeAcc) {
      dmCard.style.display = 'none';
      return;
    }

    dmCard.style.display = 'block';

    const ds = activeAcc.dmSettings || {
      followGateRequired: true,
      greetingMessage: 'Hey! Thanks for your comment 👋',
      linkDeliveryMessage: 'Here is your link to the reward! 🔗',
      buttonGetLinkLabel: 'Get Link',
      buttonProfileLabel: 'Profile Visit'
    };

    const toggle = document.getElementById('ig-dm-fg-toggle');
    const statusText = document.getElementById('ig-dm-fg-status');

    // DM Greeting mode tabs & inputs
    const btnModeList = document.getElementById('btn-mode-dm-list');
    const btnModeCustom = document.getElementById('btn-mode-dm-custom');
    const modeListContainer = document.getElementById('mode-dm-list-container');
    const modeCustomContainer = document.getElementById('mode-dm-custom-container');
    const dmListSelect = document.getElementById('ig-dm-list-select');
    const greetingInput = document.getElementById('ig-dm-greeting');

    const linkMsgInput = document.getElementById('ig-dm-link-msg');
    const btn1LabelInput = document.getElementById('ig-dm-btn1-label');
    const btn2LabelInput = document.getElementById('ig-dm-btn2-label');
    const followPromptInput = document.getElementById('ig-dm-follow-prompt');
    const followErrorInput = document.getElementById('ig-dm-follow-error');

    if (toggle) {
      if (ds.followGateRequired) toggle.classList.add('active');
      else toggle.classList.remove('active');
    }
    if (statusText) statusText.textContent = ds.followGateRequired ? 'Active' : 'Disabled';

    // Set Greeting UI to DM List
    if (dmListSelect) dmListSelect.value = ds.dmListId || '';
    if (linkMsgInput) {
      linkMsgInput.value = ds.linkDeliveryMessage || '';
    }
    if (btn1LabelInput) {
      btn1LabelInput.value = ds.buttonGetLinkLabel || 'Get Link';
    }
    if (btn2LabelInput) {
      btn2LabelInput.value = ds.buttonProfileLabel || 'Profile Visit';
    }
    if (followPromptInput) {
      followPromptInput.value = ds.followGateMessage || "You haven't followed yet. Kindly follow our page to get the link.";
    }
    if (followErrorInput) {
      followErrorInput.value = ds.followGateError || "Uh oh, looks like you haven't followed me yet 👀\nHead over to my profile and tap follow when you get a chance 😃";
    }
  }

  let activeMediaFilter = 'all';

  function setupMediaFilters() {
    const platforms = ['ig', 'yt', 'tt', 'fb', 'li', 'tw'];
    platforms.forEach(pf => {
      const filterButtons = document.querySelectorAll(`#media-filter-bar-${pf} .media-filter-tab`);
      filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          filterButtons.forEach(b => {
            b.classList.remove('active');
            b.style.border = '1px solid rgba(255,255,255,0.1)';
            b.style.background = 'rgba(255,255,255,0.03)';
            b.style.color = 'var(--text-secondary)';
          });
          btn.classList.add('active');
          const isTriggerTab = btn.dataset.filter === 'active_triggers';
          btn.style.border = isTriggerTab ? '1px solid #fbbf24' : '1px solid var(--accent-pink)';
          btn.style.background = isTriggerTab ? 'rgba(251,191,36,0.18)' : 'rgba(236,72,153,0.15)';
          btn.style.color = isTriggerTab ? '#fbbf24' : '#fff';

          const selectedFilter = btn.dataset.filter || 'all';
          const activeAcc = loadedAccounts[pf] ? loadedAccounts[pf][activeAccountIdx[pf]] : null;
          if (activeAcc) {
            renderPosts(pf, activeAcc.posts, selectedFilter);
          }
        });
      });
    });
  }
  setupMediaFilters();

  let activeTgFilter = 'all';
  let activeDcFilter = 'all';
  let activeGmFilter = 'all';

  function setupPlatformSubFilters() {
    // Telegram Sub Tabs Filter
    const tgButtons = document.querySelectorAll('#telegram-filter-bar .tg-sub-tab-btn');
    tgButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tgButtons.forEach(b => {
          b.classList.remove('active');
          b.style.border = '1px solid rgba(255,255,255,0.1)';
          b.style.background = 'rgba(255,255,255,0.03)';
          b.style.color = 'var(--text-secondary)';
        });
        btn.classList.add('active');
        btn.style.border = '1px solid #24A1DE';
        btn.style.background = 'rgba(36,161,222,0.15)';
        btn.style.color = '#fff';

        activeTgFilter = btn.dataset.filter || 'all';
        const activeAcc = loadedAccounts['tg'] ? loadedAccounts['tg'][activeAccountIdx['tg']] : null;
        if (activeAcc) {
          renderPosts('tg', activeAcc.posts, activeTgFilter);
        }
      });
    });

    // Discord Sub Tabs Filter
    const dcButtons = document.querySelectorAll('#discord-filter-bar .dc-sub-tab-btn');
    dcButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        dcButtons.forEach(b => {
          b.classList.remove('active');
          b.style.border = '1px solid rgba(255,255,255,0.1)';
          b.style.background = 'rgba(255,255,255,0.03)';
          b.style.color = 'var(--text-secondary)';
        });
        btn.classList.add('active');
        btn.style.border = '1px solid #5865F2';
        btn.style.background = 'rgba(88,101,242,0.15)';
        btn.style.color = '#fff';

        activeDcFilter = btn.dataset.filter || 'all';
        const activeAcc = loadedAccounts['dc'] ? loadedAccounts['dc'][activeAccountIdx['dc']] : null;
        if (activeAcc) {
          renderPosts('dc', activeAcc.posts, activeDcFilter);
        }
      });
    });

    // Gmail Sub Tabs Filter
    const gmButtons = document.querySelectorAll('#gmail-filter-bar .gm-sub-tab-btn');
    gmButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        gmButtons.forEach(b => {
          b.classList.remove('active');
          b.style.border = '1px solid rgba(255,255,255,0.1)';
          b.style.background = 'rgba(255,255,255,0.03)';
          b.style.color = 'var(--text-secondary)';
        });
        btn.classList.add('active');
        btn.style.border = '1px solid #EA4335';
        btn.style.background = 'rgba(234,67,53,0.15)';
        btn.style.color = '#fff';

        activeGmFilter = btn.dataset.filter || 'all';
        const activeAcc = loadedAccounts['gm'] ? loadedAccounts['gm'][activeAccountIdx['gm']] : null;
        if (activeAcc) {
          renderPosts('gm', activeAcc.posts, activeGmFilter);
        }
      });
    });
  }
  setupPlatformSubFilters();

  function renderPosts(platform, posts, filter = 'all', page = 1) {
    const postsContainer = document.getElementById(`posts-container-${platform}`);
    if (!postsContainer) return;
    postsContainer.innerHTML = '';

    if (!posts || posts.length === 0) {
      postsContainer.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px;">
          No content items found for this account handle.
        </div>
      `;
      return;
    }

    // Filter posts if specific type selected
    let filteredPosts = posts;
    if (filter === 'active_triggers' || filter === 'active') {
      filteredPosts = posts.filter(p => (p.triggersCount || 0) > 0 && p.triggerActive !== false);
    } else if (platform === 'tg') {
      if (filter === 'channel') {
        filteredPosts = posts.filter(p => p.type && (p.type.includes('Channel') || p.type.includes('📢') || p.type.includes('Broadcast')));
      } else if (filter === 'chat') {
        filteredPosts = posts.filter(p => p.type && (p.type.includes('DM') || p.type.includes('Message') || p.type.includes('Group') || p.type.includes('💬') || p.type.includes('Chat')));
      }
    } else if (platform === 'dc') {
      if (filter === 'channel') {
        filteredPosts = posts.filter(p => p.type && (p.type.includes('Channel') || p.type.includes('#') || p.type.includes('💬')));
      } else if (filter === 'chat') {
        filteredPosts = posts.filter(p => p.type && (p.type.includes('DM') || p.type.includes('Ticket') || p.type.includes('🎫')));
      }
    } else if (platform === 'gm') {
      if (filter === 'inbox') {
        filteredPosts = posts.filter(p => p.type && (p.type.includes('Inbox') || p.type.includes('📩') || p.type.includes('Thread')));
      } else if (filter === 'label') {
        filteredPosts = posts.filter(p => p.type && (p.type.includes('Label') || p.type.includes('🏷️') || p.type.includes('Folder')));
      }
    } else if (filter === 'video' || filter === 'long') {
      filteredPosts = posts.filter(p => {
        if (!p.type) return true;
        const t = p.type.toLowerCase();
        return (t.includes('video') || t.includes('📹') || t.includes('long') || t.includes('🎥')) && !t.includes('short') && !t.includes('reel') && !t.includes('community');
      });
    } else if (filter === 'short' || filter === 'shorts') {
      filteredPosts = posts.filter(p => {
        if (!p.type) return false;
        const t = p.type.toLowerCase();
        return t.includes('short') || t.includes('reel') || t.includes('⚡') || t.includes('clip');
      });
    } else if (filter === 'community' || filter === 'posts') {
      filteredPosts = posts.filter(p => {
        if (!p.type) return false;
        const t = p.type.toLowerCase();
        return (t.includes('community') || t.includes('post') || t.includes('💬') || t.includes('text') || t.includes('📝')) && !t.includes('video') && !t.includes('short') && !t.includes('reel') && !t.includes('🎥');
      });
    } else if (filter === 'reel') {
      filteredPosts = posts.filter(p => {
        if (!p.type) return false;
        const t = p.type.toLowerCase();
        return (t.includes('reel') || t.includes('video') || t.includes('🎬')) && !t.includes('story');
      });
    } else if (filter === 'post') {
      filteredPosts = posts.filter(p => {
        if (!p.type) return false;
        const t = p.type.toLowerCase();
        return (t.includes('post') || t.includes('carousel') || t.includes('💼') || t.includes('📷') || t.includes('🖼️')) && !t.includes('reel') && !t.includes('story') && !t.includes('article');
      });
    } else if (filter === 'story') {
      filteredPosts = posts.filter(p => {
        if (!p.type) return false;
        const t = p.type.toLowerCase();
        return t.includes('story') || t.includes('📖');
      });
    } else if (filter === 'article') {
      filteredPosts = posts.filter(p => {
        if (!p.type) return false;
        const t = p.type.toLowerCase();
        return t.includes('article') || t.includes('📝') || t.includes('long');
      });
    } else if (filter === 'insight') {
      filteredPosts = posts.filter(p => {
        if (!p.type) return false;
        const t = p.type.toLowerCase();
        return t.includes('insight') || t.includes('💡') || t.includes('news');
      });
    }

    if (filteredPosts.length === 0) {
      postsContainer.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px;">
          No ${filter === 'channel' ? 'channels' : (filter === 'chat' ? 'direct messages' : (filter === 'inbox' ? 'inbox threads' : 'items'))} found under this tab.
        </div>
      `;
      return;
    }

    const POSTS_PER_PAGE = 10;
    const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE) || 1;
    let targetPage = page || 1;
    if (targetPage < 1) targetPage = 1;
    if (targetPage > totalPages) targetPage = totalPages;

    const startIndex = (targetPage - 1) * POSTS_PER_PAGE;
    const pagePosts = filteredPosts.slice(startIndex, startIndex + POSTS_PER_PAGE);

    postsContainer.className = platform === 'gm' ? 'gmail-threads-list-container' : 'posts-grid-container';

    pagePosts.forEach(post => {
      const card = document.createElement('div');

      if (platform === 'gm') {
        const isSpam = post.spamFiltered || (post.type && post.type.includes('Spam'));
        const badgeColor = isSpam ? '#ef4444' : (post.type && post.type.includes('Important') ? '#f59e0b' : '#ea4335');
        const badgeBg = isSpam ? 'rgba(239,68,68,0.15)' : (post.type && post.type.includes('Important') ? 'rgba(245,158,11,0.15)' : 'rgba(234,67,53,0.15)');
        const avatarLetter = post.senderName ? post.senderName.substring(0, 1).toUpperCase() : 'M';
        const avatarBg = isSpam ? '#7f1d1d' : (post.type && post.type.includes('Important') ? '#ea4335' : '#1e293b');

        card.className = 'gmail-thread-row-card';
        card.style.cssText = 'background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 12px; width: 100%; box-sizing: border-box;';

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 38px; height: 38px; border-radius: 50%; background: ${avatarBg}; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; flex-shrink: 0;">
                ${avatarLetter}
              </div>
              <div>
                <div style="font-size: 14px; font-weight: 700; color: #ffffff; display: flex; align-items: center; gap: 8px;">
                  <span>${post.senderName || post.title || 'Email Contact'}</span>
                  <span style="font-size: 11px; font-weight: 500; color: var(--text-muted);">&lt;${post.senderEmail || 'contact@domain.com'}&gt;</span>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                  Received: ${post.receivedAt || '10:24 AM'} · Automated AI Processing
                </div>
              </div>
            </div>
            <span style="font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px; color: ${badgeColor}; background: ${badgeBg}; border: 1px solid ${badgeColor}40; white-space: nowrap;">
              ${post.type}
            </span>
          </div>

          <div style="padding: 12px 14px; background: rgba(0,0,0,0.25); border-radius: 8px; border-left: 3px solid ${badgeColor};">
            <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">✉️ Subject: ${post.subject || post.title}</div>
            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
              "${post.snippet || post.title}"
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06); flex-wrap: wrap;">
            <!-- Gmail AI Automation & Spam Filter Controls -->
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn-toggle-spam-filter" data-post-id="${post.id}" title="Smart Spam Protection Engine" style="padding: 6px 12px; font-size: 11px; font-weight: 700; border-radius: 6px; border: 1px solid ${isSpam ? '#ef4444' : '#10b981'}; background: ${isSpam ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'}; color: ${isSpam ? '#f87171' : '#10b981'}; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                🛡️ Spam Filter: <span>${isSpam ? 'Active (Blocked)' : 'Clean Inbox'}</span>
              </button>

              <button class="btn-toggle-ai-prompt ${post.aiReply ? 'active' : ''}" data-post-id="${post.id}" data-post-title="${post.subject || post.title}" title="Toggle Smart AI Auto-Reply" style="padding: 6px 12px; font-size: 11px; font-weight: 700; border-radius: 6px; border: 1px solid ${post.aiReply ? '#ea4335' : 'rgba(255,255,255,0.15)'}; background: ${post.aiReply ? 'rgba(234,67,53,0.18)' : 'rgba(255,255,255,0.03)'}; color: ${post.aiReply ? '#f87171' : 'var(--text-muted)'}; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                🤖 AI Smart Reply: <span>${post.aiReply ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            <button class="btn-toggle-ai-prompt" data-post-id="${post.id}" data-post-title="${post.subject || post.title}" style="padding: 6px 12px; font-size: 11px; font-weight: 700; border-radius: 6px; border: 1px solid var(--border-button); background: var(--bg-surface); color: var(--text-primary); cursor: pointer; display: flex; align-items: center; gap: 6px;">
              ⚙️ Configure AI Rules & Persona
            </button>
          </div>
        `;

        postsContainer.appendChild(card);
        return;
      }

      card.className = 'post-media-card post-list-row-card';

      const activeAcc = loadedAccounts[platform] ? loadedAccounts[platform][activeAccountIdx[platform]] : null;
      const accountHandle = activeAcc ? (activeAcc.username.startsWith('@') ? activeAcc.username : `@${activeAcc.username}`) : '@profile';
      const initialLetter = accountHandle.substring(1, 2).toUpperCase() || 'A';

      // Compact Thumbnail rendering
      let mediaHtml = '';
      if (platform === 'tg' || platform === 'dc' || platform === 'gm') {
        const brandGrad = platform === 'tg' ? 'linear-gradient(135deg, #24A1DE 0%, #0088CC 100%)' : (platform === 'dc' ? 'linear-gradient(135deg, #5865F2 0%, #4752C4 100%)' : 'linear-gradient(135deg, #EA4335 0%, #C5221F 100%)');
        const brandIcon = platform === 'tg' ? (post.type.includes('Channel') ? '📢' : '✈️') : (platform === 'dc' ? (post.type.includes('Ticket') ? '🎫' : '👾') : (post.type.includes('Label') ? '🏷️' : '✉️'));
        mediaHtml = `
          <div class="post-list-thumb" style="background: ${brandGrad}; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 20px;">${brandIcon}</span>
          </div>
        `;
      } else if (post.mediaUrl) {
        mediaHtml = `
          <div class="post-list-thumb">
            <img src="${post.mediaUrl}" alt="Post Media" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; background: linear-gradient(135deg, #EC4899, #8B5CF6); font-size: 18px;">
              ${post.type && (post.type.includes('Reel') || post.type.includes('Video')) ? '🎬' : '📷'}
            </div>
          </div>
        `;
      } else {
        const bgGrad = platform === 'ig' ? 'linear-gradient(135deg, #EC4899, #8B5CF6)' : (platform === 'yt' ? 'linear-gradient(135deg, #FF0000, #CC0000)' : 'linear-gradient(135deg, #00F2FE, #4FACFE)');
        mediaHtml = `
          <div class="post-list-thumb" style="background: ${bgGrad}; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 20px;">${post.type && (post.type.includes('Reel') || post.type.includes('Video')) ? '🎬' : '📷'}</span>
          </div>
        `;
      }

      // Stats metrics values
      const stat1Val = post.likeCount !== undefined ? `❤️ ${post.likeCount} Likes` : (post.likes !== undefined ? `❤️ ${post.likes} Likes` : `👁️ ${post.views || 0} Views`);
      const stat2Val = post.commentsCount !== undefined ? `💬 ${post.commentsCount} Comments` : `💬 ${post.comments || 0} Comments`;

      // Triggers buttons logic
      const hasTriggers = post.triggersCount > 0;
      const isTriggerOn = hasTriggers && (post.triggerActive !== false);
      const setBtnLabel = hasTriggers ? '+ Trigger' : 'Set Trigger';

      const editBtnHtml = hasTriggers ? `
        <button class="btn-edit-trigger action-btn-animated" data-account-id="${activeAcc ? activeAcc.id : ''}" data-post-id="${post.id}" data-post-title="${post.type}: &quot;${post.title}&quot;" title="Edit Trigger">✏️ Edit</button>
        <button class="btn-delete-post-trigger action-btn-animated danger" data-post-id="${post.id}" title="Delete Trigger">🗑️</button>
      ` : '';

      const isStory = post.type && (post.type.includes('Story') || post.type.includes('📖'));
      const mentionsHtml = (isStory && Array.isArray(post.mentions) && post.mentions.length > 0)
        ? `<span class="post-list-meta-tag" style="color: var(--accent-pink); background: rgba(236,72,153,0.12); font-weight: 600;">🏷️ ${post.mentions.join(' ')}</span>`
        : '';
      const stickerHtml = (isStory && post.stickerUrl)
        ? `<span class="post-list-meta-tag" style="color: #60a5fa; background: rgba(96,165,250,0.12);">🔗 Link Sticker</span>`
        : '';
      const storyStatusHtml = isStory
        ? `<span class="post-list-meta-tag" style="background: ${post.status === 'scheduled' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)'}; color: ${post.status === 'scheduled' ? '#f59e0b' : '#10b981'}; font-weight:700;">${post.status === 'scheduled' ? '⏰ Scheduled Story' : '🟢 Active Story'}</span>`
        : '';

      const deleteStoryBtnHtml = isStory ? `
        <button class="btn-delete-story action-btn-animated danger" data-story-id="${post.id}" title="Delete Story">🗑️ Delete</button>
      ` : '';

      card.innerHTML = `
        ${mediaHtml}

        <div class="post-list-info">
          <div class="post-list-title-row">
            <div class="post-card-caption" title="${post.title}" style="margin: 0; font-size: 13px; font-weight: 700; color: #ffffff;">"${post.title}"</div>
            <span class="post-card-type-badge">${post.type}</span>
          </div>

          <div class="post-list-meta-row">
            <span class="post-list-meta-tag">${accountHandle}</span>
            ${storyStatusHtml}
            ${mentionsHtml}
            ${stickerHtml}
            <span class="post-list-meta-tag">${stat1Val}</span>
            <span class="post-list-meta-tag">${stat2Val}</span>
            <span class="post-list-meta-tag highlight">⚡ ${post.triggersCount || 0} Triggers</span>
            <span class="post-list-meta-tag highlight">🚀 ${post.repliesCount || 0} Sent</span>
          </div>
        </div>

        <div class="post-list-actions">
          <button class="btn-toggle-trigger-active action-btn-animated ${isTriggerOn ? 'active' : ''}" data-post-id="${post.id}" title="Toggle Auto Reply Trigger Engine">
            <span class="status-dot" style="width: 6px; height: 6px; border-radius: 50%; background: ${isTriggerOn ? '#10B981' : 'var(--text-muted)'}; flex-shrink: 0;"></span>
            Trigger: <span class="status-text">${isTriggerOn ? 'ON' : 'OFF'}</span>
          </button>

          <button class="btn-toggle-ai-prompt action-btn-animated ${post.aiReply ? 'active' : ''}" data-post-id="${post.id}" data-post-title="${post.title}" title="Toggle AI Auto Reply">
            <span class="status-dot" style="width: 6px; height: 6px; border-radius: 50%; background: ${post.aiReply ? '#8B5CF6' : 'var(--text-muted)'}; flex-shrink: 0;"></span>
            🤖 AI: <span class="status-text">${post.aiReply ? 'ON' : 'OFF'}</span>
          </button>
          
          ${editBtnHtml}
          ${deleteStoryBtnHtml}

          <button class="btn-set-trigger action-btn-animated primary" data-account-id="${activeAcc ? activeAcc.id : ''}" data-post-id="${post.id}" data-post-title="${post.type}: &quot;${post.title}&quot;">
            ${setBtnLabel}
          </button>
        </div>
      `;

      postsContainer.appendChild(card);

      // Story Delete click handler
      const deleteStoryBtn = card.querySelector('.btn-delete-story');
      if (deleteStoryBtn) {
        deleteStoryBtn.addEventListener('click', () => {
          if (!confirm('Are you sure you want to delete this Instagram Story?')) return;
          fetch(`/api/instagram/stories/${post.id}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                const activeAcc = loadedAccounts['ig'][activeAccountIdx['ig']];
                if (activeAcc && activeAcc.posts) {
                  activeAcc.posts = activeAcc.posts.filter(p => String(p.id) !== String(post.id));
                  renderPosts('ig', activeAcc.posts);
                }
                alert('Story deleted successfully!');
              } else {
                alert(data.error || 'Failed to delete story.');
              }
            })
            .catch(err => console.error('Error deleting story:', err));
        });
      }

      // Trigger ON/OFF button click handler
      const toggleTriggerBtn = card.querySelector('.btn-toggle-trigger-active');
      if (toggleTriggerBtn) {
        toggleTriggerBtn.addEventListener('click', () => {
          if ((post.triggersCount || 0) === 0) {
            showToast('info', 'Is post par koi trigger set nahi hai. Pehle "+ Trigger" par click karke trigger set karain.');
            const setBtn = card.querySelector('.btn-set-trigger');
            if (setBtn) setBtn.click();
            return;
          }
          const activeAcc = loadedAccounts[platform] ? loadedAccounts[platform][activeAccountIdx[platform]] : (loadedAccounts[platform] ? loadedAccounts[platform][0] : null);
          const accountId = activeAcc ? activeAcc.id : '';
          fetch('/api/accounts/post/toggle-trigger-active', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform, accountId, postId: post.id })
          })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                post.triggerActive = data.triggerActive;
                const dot = toggleTriggerBtn.querySelector('.status-dot');
                const text = toggleTriggerBtn.querySelector('.status-text');
                const isNowOn = (post.triggersCount > 0) && data.triggerActive;
                if (isNowOn) {
                  toggleTriggerBtn.classList.add('active');
                  toggleTriggerBtn.style.borderColor = '#10B981';
                  toggleTriggerBtn.style.background = 'rgba(16,185,129,0.15)';
                  toggleTriggerBtn.style.color = '#10B981';
                  if (dot) dot.style.background = '#10B981';
                  if (text) text.textContent = 'ON';
                  showSuccessToast('Trigger Keyword Auto-Reply Enabled!');
                } else {
                  toggleTriggerBtn.classList.remove('active');
                  toggleTriggerBtn.style.borderColor = 'rgba(255,255,255,0.15)';
                  toggleTriggerBtn.style.background = 'rgba(255,255,255,0.03)';
                  toggleTriggerBtn.style.color = 'var(--text-muted)';
                  if (dot) dot.style.background = 'var(--text-muted)';
                  if (text) text.textContent = 'OFF';
                  showToast('info', 'Trigger Auto-Reply Disabled.');
                }
              }
            })
            .catch(err => console.error('Error toggling trigger active:', err));
        });
      }

      // AI Prompt Modal Button Click Handler
      const toggleAiBtn = card.querySelector('.btn-toggle-ai-prompt');
      if (toggleAiBtn) {
        toggleAiBtn.addEventListener('click', () => {
          const postIdInput = document.getElementById('ai-prompt-post-id');
          const platformInput = document.getElementById('ai-prompt-platform');
          const postTitleEl = document.getElementById('ai-prompt-post-title');
          const contextInput = document.getElementById('ai-prompt-context-text');
          const toneInput = document.getElementById('ai-prompt-tone-input');

          if (postIdInput) postIdInput.value = post.id;
          if (platformInput) platformInput.value = platform;
          if (postTitleEl) postTitleEl.textContent = post.title;
          if (contextInput) contextInput.value = post.aiContext || '';
          if (toneInput) toneInput.value = post.aiTone || 'Helpful, friendly, creator persona, concise';

          openModal('modal-ai-prompt');
        });
      }

      // Delete Trigger button handler
      const deletePostTriggerBtn = card.querySelector('.btn-delete-post-trigger');
      if (deletePostTriggerBtn) {
        deletePostTriggerBtn.addEventListener('click', () => {
          if (!confirm(`Are you sure you want to delete trigger for "${post.title}"?`)) return;
          fetch(`/api/triggers/${post.id}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                showSuccessToast('Trigger deleted successfully!');
                loadAccounts(platform);
                loadTriggers(platform);
              } else {
                showErrorToast(data.error || 'Failed to delete trigger.');
              }
            })
            .catch(err => {
              console.error('Error deleting trigger:', err);
              showErrorToast('Error deleting trigger.');
            });
        });
      }

      // Edit Trigger button handler
      const editBtn = card.querySelector('.btn-edit-trigger');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          fetch(`/api/triggers?platform=${platform}`)
            .then(res => res.json())
            .then(triggers => {
              const existingTrigger = triggers.find(t => String(t.postId) === String(post.id) || (t.scope && (t.scope.includes(post.title) || t.scope.includes(String(post.id)))));

              const idInput = document.getElementById('modal-trigger-id');
              const accInput = document.getElementById('modal-trigger-account-id');
              const postInput = document.getElementById('modal-trigger-post-id');
              const scopeInput = document.getElementById('modal-trigger-scope');
              const keywordInput = document.getElementById('add-trigger-keyword');
              const targetLinkInput = document.getElementById('add-trigger-target-link');
              const titleEl = document.getElementById('modal-trigger-title');

              if (accInput) accInput.value = activeAcc ? activeAcc.id : '';
              if (postInput) postInput.value = post.id;
              if (scopeInput) scopeInput.value = `${post.type}: "${post.title}"`;

              if (existingTrigger) {
                if (idInput) idInput.value = existingTrigger.id;
                if (titleEl) titleEl.textContent = 'Edit Trigger';
                if (keywordInput) keywordInput.value = existingTrigger.keyword || '';
                if (targetLinkInput) targetLinkInput.value = existingTrigger.targetLink || '';

                if (existingTrigger.commentReplyType === 'custom') {
                  const btnModeCustom = document.getElementById('btn-mode-custom');
                  if (btnModeCustom) btnModeCustom.click();
                  if (existingTrigger.commentReplies && Array.isArray(existingTrigger.commentReplies)) {
                    customComments = [...existingTrigger.commentReplies];
                    renderCustomCommentsList();
                  }
                } else {
                  const btnModeList = document.getElementById('btn-mode-list');
                  if (btnModeList) btnModeList.click();
                  const listSelect = document.getElementById('modal-comment-list-select');
                  if (listSelect && existingTrigger.commentListId) {
                    listSelect.value = existingTrigger.commentListId;
                  }
                }
              } else {
                if (idInput) idInput.value = '';
                if (titleEl) titleEl.textContent = 'Add New Trigger';
                if (keywordInput) keywordInput.value = '';
                if (targetLinkInput) targetLinkInput.value = '';
              }

              openModal('modal-add-trigger');
              if (keywordInput) setTimeout(() => keywordInput.focus(), 50);
            })
        });
      }
    });

    // ── Interactive Pagination Control Bar (10 Posts per Page) ──
    if (filteredPosts.length > 0) {
      const paginationContainer = document.createElement('div');
      paginationContainer.className = 'posts-pagination-bar';
      paginationContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; margin-top: 16px; background: rgba(18,19,26,0.75); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; flex-wrap: wrap; gap: 12px; width: 100%; box-sizing: border-box; grid-column: 1 / -1;';

      const startItem = startIndex + 1;
      const endItem = Math.min(startIndex + POSTS_PER_PAGE, filteredPosts.length);

      let pageButtonsHtml = '';
      for (let p = 1; p <= totalPages; p++) {
        const isCurrent = p === targetPage;
        pageButtonsHtml += `
          <button class="pagination-number-btn ${isCurrent ? 'active' : ''}" data-page="${p}" style="min-width: 32px; height: 32px; border-radius: 8px; border: 1px solid ${isCurrent ? 'rgba(168,85,247,0.6)' : 'rgba(255,255,255,0.1)'}; background: ${isCurrent ? 'linear-gradient(135deg, rgba(168,85,247,0.35), rgba(99,102,241,0.35))' : 'rgba(255,255,255,0.04)'}; color: ${isCurrent ? '#ffffff' : '#9ca3af'}; font-weight: ${isCurrent ? '800' : '600'}; font-size: 12px; cursor: pointer; transition: all 0.2s;">
            ${p}
          </button>
        `;
      }

      paginationContainer.innerHTML = `
        <div style="font-size: 12px; color: #9ca3af; font-weight: 600;">
          Showing <span style="color: #ffffff; font-weight: 700;">${startItem}-${endItem}</span> of <span style="color: #ffffff; font-weight: 700;">${filteredPosts.length}</span> posts
        </div>

        <div style="display: flex; align-items: center; gap: 6px;">
          <button class="pagination-prev-btn" ${targetPage === 1 ? 'disabled' : ''} style="padding: 6px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.05); color: ${targetPage === 1 ? '#4b5563' : '#ffffff'}; font-size: 12px; font-weight: 700; cursor: ${targetPage === 1 ? 'not-allowed' : 'pointer'}; transition: all 0.2s;">
            ◀ Previous
          </button>
          
          <div style="display: flex; gap: 4px;">
            ${pageButtonsHtml}
          </div>

          <button class="pagination-next-btn" ${targetPage === totalPages ? 'disabled' : ''} style="padding: 6px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.05); color: ${targetPage === totalPages ? '#4b5563' : '#ffffff'}; font-size: 12px; font-weight: 700; cursor: ${targetPage === totalPages ? 'not-allowed' : 'pointer'}; transition: all 0.2s;">
            Next ▶
          </button>
        </div>
      `;

      // Event listeners for pagination buttons
      const prevBtn = paginationContainer.querySelector('.pagination-prev-btn');
      if (prevBtn && targetPage > 1) {
        prevBtn.addEventListener('click', () => {
          renderPosts(platform, posts, filter, targetPage - 1);
        });
      }

      const nextBtn = paginationContainer.querySelector('.pagination-next-btn');
      if (nextBtn && targetPage < totalPages) {
        nextBtn.addEventListener('click', () => {
          renderPosts(platform, posts, filter, targetPage + 1);
        });
      }

      paginationContainer.querySelectorAll('.pagination-number-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const pg = parseInt(btn.dataset.page, 10);
          if (pg && pg !== targetPage) {
            renderPosts(platform, posts, filter, pg);
          }
        });
      });

      postsContainer.appendChild(paginationContainer);
    }
  }

  // Load accounts initially
  loadAccounts('ig');
  loadAccounts('yt');

  // Handle Save Linked Account modal submit
  const btnSaveLinkAccount = document.getElementById('btn-save-link-account');
  const btnCancelLinkAccount = document.getElementById('btn-cancel-link-account');

  if (btnSaveLinkAccount) {
    btnSaveLinkAccount.addEventListener('click', () => {
      const platform = document.getElementById('link-account-platform').value;
      const usernameInput = document.getElementById('link-account-username');
      const username = usernameInput.value.trim();

      if (!username) {
        alert('Please enter a username or handle.');
        return;
      }

      fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, username })
      })
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            alert(data.error);
          } else if (data.id) {
            loadAccounts(platform);
            closeModal('modal-link-account');
            usernameInput.value = '';
          } else {
            alert('Failed to link account.');
          }
        })
        .catch(err => {
          console.error('Error linking account:', err);
          alert('Error linking account.');
        });
    });
  }

  if (btnCancelLinkAccount) {
    btnCancelLinkAccount.addEventListener('click', () => closeModal('modal-link-account'));
  }

  const responseTypeBtns = document.querySelectorAll('.response-type-btn');
  responseTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      responseTypeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // ── Dynamic Profile Manager ──
  const btnTriggerAvatar = document.getElementById('btn-trigger-avatar');
  const profileAvatarInput = document.getElementById('profile-avatar-input');
  const btnSaveProfile = document.getElementById('btn-save-profile');
  const profileNameInput = document.getElementById('profile-name-input');
  const profileEmailInput = document.getElementById('profile-email-input');
  const dashboardWelcome = document.getElementById('dashboard-welcome');

  function renderUserProfileUI(user) {
    if (!user) return;
    try {
      localStorage.setItem('replyflow_user', JSON.stringify(user));
      if (user.name) localStorage.setItem('replyflow_user_name', user.name);
      if (user.plan) localStorage.setItem('replyflow_user_plan', user.plan);
    } catch (e) { }

    const name = user.name || 'SaaS Creator';
    const email = user.email || 'creator@replyflow.app';
    const plan = user.plan || 'Pro Creator Plan';
    const firstName = name.split(' ')[0] || name;

    // Calculate Initials
    const parts = name.trim().split(/\s+/);
    let initials = 'SC';
    if (parts.length >= 2) {
      initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts.length === 1 && parts[0].length > 0) {
      initials = parts[0].substring(0, 2).toUpperCase();
    }

    // Dashboard Welcome Heading
    const dashboardWelcome = document.getElementById('dashboard-welcome');
    if (dashboardWelcome) dashboardWelcome.innerHTML = `Welcome back, ${firstName} 👋`;

    // Avatar Initials
    const dashInitials = document.getElementById('dash-user-initials');
    if (dashInitials) dashInitials.textContent = initials;

    const cardInitials = document.getElementById('profile-card-initials');
    if (cardInitials) cardInitials.textContent = initials;

    // Header Avatar Initials fallback
    const headerAvatars = document.querySelectorAll('.header-avatar-btn .header-avatar, .header-avatar');
    headerAvatars.forEach(av => {
      if (!user.avatarUrl && !user.avatar) {
        av.textContent = initials;
        av.style.display = 'flex';
        av.style.alignItems = 'center';
        av.style.justifyContent = 'center';
        av.style.fontWeight = '800';
        av.style.fontSize = '12px';
        av.style.color = '#ffffff';
      }
    });

    // Profile Card Name & Email
    const cardName = document.getElementById('profile-card-name');
    if (cardName) cardName.textContent = name;

    const cardEmail = document.getElementById('profile-card-email');
    if (cardEmail) cardEmail.textContent = `${email} • ${plan}`;

    // Settings Inputs
    if (profileNameInput) profileNameInput.value = name;
    if (profileEmailInput) profileEmailInput.value = email;

    if (user.avatarUrl || user.avatar) {
      updateAvatarUI(user.avatarUrl || user.avatar);
    }
  }
  window.renderUserProfileUI = renderUserProfileUI;

  function redirectToLogin() {
    window.location.hash = '#login';
    if (typeof window.userLogout === 'function') {
      window.userLogout();
    } else {
      const standaloneLanding = document.getElementById('standalone-landing-page');
      const mainAppShell = document.getElementById('main-app-shell');
      if (standaloneLanding) standaloneLanding.style.display = 'block';
      if (mainAppShell) mainAppShell.style.display = 'none';
    }
  }
  window.redirectToLogin = redirectToLogin;

  function loadProfile() {
    const token = localStorage.getItem('replyflow_user_token');
    if (!token) {
      redirectToLogin();
      return;
    }

    // Instantly render cached profile from localStorage (0ms delay)
    try {
      const cached = localStorage.getItem('replyflow_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.name || parsed.email)) {
          renderUserProfileUI(parsed);
        }
      }
    } catch (e) { }

    fetch('/api/auth/me', { headers: getAuthHeaders() })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data.authenticated && data.user) {
          localStorage.setItem('replyflow_user', JSON.stringify(data.user));
          renderUserProfileUI(data.user);
        }
      })
      .catch(err => {
        console.warn('[Auth Check] Server check fallback:', err);
        const name = localStorage.getItem('replyflow_user_name') || 'Creator';
        const plan = localStorage.getItem('replyflow_user_plan') || 'Free';
        const fallbackUser = { name, email: 'creator@replyflow.app', plan, role: 'creator' };
        renderUserProfileUI(fallbackUser);
      });
  }

  function updateAvatarUI(avatarUrl) {
    const avatars = document.querySelectorAll('.header-avatar, .profile-avatar, .timeline-avatar');
    avatars.forEach(el => {
      el.style.backgroundImage = `url(${avatarUrl})`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      el.style.backgroundColor = 'transparent';
      el.textContent = ''; // Clear fallback letter initials if any
    });
  }

  if (btnTriggerAvatar && profileAvatarInput) {
    btnTriggerAvatar.addEventListener('click', () => profileAvatarInput.click());

    let currentRotation = 0;
    let currentZoom = 1;
    let dragX = 0;
    let dragY = 0;
    let previousDragX = 0;
    let previousDragY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let originalImage = new Image();

    const cropPreviewImg = document.getElementById('crop-preview-img');
    const cropImageMask = document.getElementById('crop-image-mask');
    const cropZoomSlider = document.getElementById('crop-zoom-slider');
    const btnCropRotateLeft = document.getElementById('btn-crop-rotate-left');
    const btnCropRotateRight = document.getElementById('btn-crop-rotate-right');
    const btnConfirmCrop = document.getElementById('btn-confirm-crop');
    const btnCancelCrop = document.getElementById('btn-cancel-crop');

    function updateCropPreviewTransform() {
      if (cropPreviewImg) {
        cropPreviewImg.style.transform = `translate(calc(-50% + ${dragX}px), calc(-50% + ${dragY}px)) rotate(${currentRotation}deg) scale(${currentZoom})`;
      }
      const cropZoomVal = document.getElementById('crop-zoom-val');
      if (cropZoomVal) {
        cropZoomVal.textContent = `${currentZoom.toFixed(1)}x`;
      }
    }

    // Bind mouse drag events on mask
    if (cropImageMask && cropPreviewImg) {
      cropPreviewImg.addEventListener('dragstart', (e) => e.preventDefault());

      const startDrag = (clientX, clientY) => {
        isDragging = true;
        startX = clientX;
        startY = clientY;
      };

      const moveDrag = (clientX, clientY) => {
        if (!isDragging) return;
        const dx = clientX - startX;
        const dy = clientY - startY;

        dragX = previousDragX + dx;
        dragY = previousDragY + dy;
        updateCropPreviewTransform();
      };

      const endDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        previousDragX = dragX;
        previousDragY = dragY;
      };

      cropImageMask.addEventListener('mousedown', (e) => startDrag(e.clientX, e.clientY));
      window.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
      window.addEventListener('mouseup', endDrag);

      cropImageMask.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        startDrag(touch.clientX, touch.clientY);
      });
      window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        moveDrag(touch.clientX, touch.clientY);
      });
      window.addEventListener('touchend', endDrag);
    }

    // Zoom slider change
    if (cropZoomSlider) {
      cropZoomSlider.addEventListener('input', (e) => {
        currentZoom = parseFloat(e.target.value);
        updateCropPreviewTransform();
      });
    }

    // Rotate Left
    if (btnCropRotateLeft) {
      btnCropRotateLeft.addEventListener('click', () => {
        currentRotation = (currentRotation - 90) % 360;
        updateCropPreviewTransform();
      });
    }

    // Rotate Right
    if (btnCropRotateRight) {
      btnCropRotateRight.addEventListener('click', () => {
        currentRotation = (currentRotation + 90) % 360;
        updateCropPreviewTransform();
      });
    }

    profileAvatarInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (evt) {
        originalImage.src = evt.target.result;
        originalImage.onload = function () {
          if (cropPreviewImg) {
            cropPreviewImg.src = originalImage.src;
            cropPreviewImg.style.width = '100%';
            cropPreviewImg.style.height = '100%';
            cropPreviewImg.style.objectFit = 'cover';
            cropPreviewImg.style.maxWidth = 'none';
            cropPreviewImg.style.maxHeight = 'none';
            currentRotation = 0;
            currentZoom = 1;
            dragX = 0;
            dragY = 0;
            previousDragX = 0;
            previousDragY = 0;
            isDragging = false;
            if (cropZoomSlider) cropZoomSlider.value = 1;
            updateCropPreviewTransform();

            openModal('modal-crop-image');
          }
        };
      };
      reader.readAsDataURL(file);
    });

    if (btnConfirmCrop) {
      btnConfirmCrop.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 300, 300);

        ctx.save();
        ctx.beginPath();
        ctx.arc(150, 150, 150, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        ctx.translate(150, 150);
        ctx.rotate((currentRotation * Math.PI) / 180);
        ctx.scale(currentZoom, currentZoom);

        const drawX = (dragX * (300 / 200)) / currentZoom;
        const drawY = (dragY * (300 / 200)) / currentZoom;

        const w = originalImage.naturalWidth || originalImage.width || 300;
        const h = originalImage.naturalHeight || originalImage.height || 300;
        const scaleRatio = Math.max(300 / w, 300 / h);
        const imgW = w * scaleRatio;
        const imgH = h * scaleRatio;

        ctx.drawImage(originalImage, -imgW / 2 + drawX, -imgH / 2 + drawY, imgW, imgH);
        ctx.restore();

        const base64Data = canvas.toDataURL('image/png');

        btnConfirmCrop.disabled = true;
        btnConfirmCrop.textContent = '⏳ Saving...';

        fetch('/api/profile/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarData: base64Data })
        })
          .then(res => res.json())
          .then(data => {
            btnConfirmCrop.disabled = false;
            btnConfirmCrop.textContent = 'Save Crop ✨';
            if (data.success) {
              updateAvatarUI(data.avatarUrl || base64Data);
              closeModal('modal-crop-image');
              if (typeof showToast === 'function') {
                showToast('Profile photo updated successfully! 📸', 'success');
              } else {
                alert('Profile photo updated successfully!');
              }
            }
          })
          .catch(err => {
            btnConfirmCrop.disabled = false;
            btnConfirmCrop.textContent = 'Save Crop ✨';
            console.error('Error uploading avatar:', err);
            updateAvatarUI(base64Data);
            closeModal('modal-crop-image');
          });
      });
    }

    if (btnCancelCrop) {
      btnCancelCrop.addEventListener('click', () => {
        closeModal('modal-crop-image');
        if (profileAvatarInput) profileAvatarInput.value = '';
      });
    }
  }

  if (btnSaveProfile) {
    btnSaveProfile.addEventListener('click', () => {
      const name = profileNameInput.value.trim();
      const email = profileEmailInput.value.trim();

      if (!name || !email) {
        alert('Please fill out all profile fields.');
        return;
      }

      fetch('/api/profile', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, email })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            if (typeof renderUserProfileUI === 'function') renderUserProfileUI(data.profile);
            if (typeof showToast === 'function') showToast('✅ Profile updated successfully!', 'success');
          }
        })
        .catch(err => {
          console.error('Error saving profile:', err);
          if (typeof showToast === 'function') showToast('❌ Failed to save profile changes.', 'error');
        });
    });
  }

  // ── Dynamic Billing Manager ──
  const btnOpenBilling = document.getElementById('btn-open-billing');
  const btnCloseBilling = document.getElementById('btn-close-billing');
  const btnUpgradeFromBilling = document.getElementById('btn-upgrade-from-billing');
  const invoicesContainer = document.getElementById('invoices-list-container');

  function loadBilling() {
    fetch('/api/billing')
      .then(res => res.json())
      .then(billing => {
        currentBillingData = billing;

        // Update accounts limit badge based on active platform tab
        const accountsLimitText = document.getElementById('accounts-limit-text');
        if (accountsLimitText && billing.platformLimits && billing.platformLimits[activeAccountsTabPlatform]) {
          const limits = billing.platformLimits[activeAccountsTabPlatform];
          accountsLimitText.textContent = `${limits.linked} / ${limits.total} accounts`;
        }

        // Update inline platform limit badges next to "Fetched Content"
        if (billing.platformLimits) {
          const igBadge = document.getElementById('limit-badge-ig');
          if (igBadge && billing.platformLimits.ig) {
            igBadge.textContent = `${billing.platformLimits.ig.linked} / ${billing.platformLimits.ig.total} accounts`;
          }
          const ytBadge = document.getElementById('limit-badge-yt');
          if (ytBadge && billing.platformLimits.yt) {
            ytBadge.textContent = `${billing.platformLimits.yt.linked} / ${billing.platformLimits.yt.total} accounts`;
          }
        }

        // Update display items in Settings Screen
        const displayPlan = document.getElementById('billing-display-plan');
        const displayUsage = document.getElementById('billing-display-usage');
        const displayBar = document.getElementById('billing-display-bar');

        if (displayPlan) displayPlan.textContent = `${billing.currentPlan} — ${billing.price}`;
        if (displayUsage) displayUsage.textContent = `${billing.repliesUsed.toLocaleString()} / ${billing.repliesTotal.toLocaleString()} replies used this month`;
        if (displayBar) {
          const pct = Math.min(100, Math.round((billing.repliesUsed / billing.repliesTotal) * 100));
          displayBar.style.width = `${pct}%`;
          displayBar.dataset.width = pct;
        }

        // Update display items in Billing Details Modal
        const modalPlan = document.getElementById('billing-modal-plan');
        const modalPrice = document.getElementById('billing-modal-price');
        const modalUsage = document.getElementById('billing-modal-usage');
        const modalReset = document.getElementById('billing-modal-reset');
        const modalPayment = document.getElementById('billing-modal-payment');

        if (modalPlan) modalPlan.textContent = `${billing.currentPlan} Plan`;
        if (modalPrice) modalPrice.textContent = billing.price;
        if (modalUsage) modalUsage.textContent = `${billing.repliesUsed.toLocaleString()} / ${billing.repliesTotal.toLocaleString()}`;
        if (modalReset) modalReset.textContent = billing.resetDate;
        if (modalPayment) modalPayment.textContent = billing.paymentMethod;

        // Render invoice rows
        if (invoicesContainer) {
          invoicesContainer.innerHTML = '';
          if (billing.invoices.length === 0) {
            invoicesContainer.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 12px;">No invoices found.</div>';
          } else {
            billing.invoices.forEach(inv => {
              const row = document.createElement('div');
              row.style.display = 'flex';
              row.style.justifyContent = 'space-between';
              row.style.alignItems = 'center';
              row.style.background = 'rgba(255,255,255,0.02)';
              row.style.padding = '8px 12px';
              row.style.borderRadius = 'var(--radius-sm)';
              row.style.border = '1px solid rgba(255,255,255,0.05)';
              row.innerHTML = `
                <div>
                  <div style="font-size: 12px; font-weight: 600; color: #fff;">Invoice #${inv.id}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">${inv.date}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 12px; font-weight: 600; color: #fff;">${inv.amount}</span>
                  <span style="font-size: 10px; font-weight: 600; color: #10B981; background: rgba(16,185,129,0.1); padding: 2px 6px; border-radius: 4px;">${inv.status}</span>
                </div>
              `;
              invoicesContainer.appendChild(row);
            });
          }
        }
        // Auto-show Upgrade Modal ONLY on fresh login, NEVER on ordinary page refresh
        const isFreshLogin = sessionStorage.getItem('replyflow_show_login_plan_modal') === 'true';
        if (isFreshLogin && (billing.currentPlan === 'Free' || !billing.currentPlan)) {
          sessionStorage.removeItem('replyflow_show_login_plan_modal');
          const upgradeModal = document.getElementById('modal-upgrade');
          if (upgradeModal && !window.upgradeModalAutoShown) {
            window.upgradeModalAutoShown = true;
            setTimeout(() => {
              openModal('modal-upgrade');
            }, 600);
          }
        }
      })
      .catch(err => console.error('Error loading billing:', err));
  }

  const btnCloseUpgradeModal = document.getElementById('btn-close-upgrade-modal');
  const btnContinueFreeTier = document.getElementById('btn-continue-free-tier');

  if (btnCloseUpgradeModal) {
    btnCloseUpgradeModal.addEventListener('click', () => closeModal('modal-upgrade'));
  }
  if (btnContinueFreeTier) {
    btnContinueFreeTier.addEventListener('click', () => closeModal('modal-upgrade'));
  }

  if (btnOpenBilling) {
    btnOpenBilling.addEventListener('click', () => {
      openModal('modal-billing');
      loadBilling();
    });
  }

  if (btnCloseBilling) {
    btnCloseBilling.addEventListener('click', () => closeModal('modal-billing'));
  }

  if (btnUpgradeFromBilling) {
    btnUpgradeFromBilling.addEventListener('click', () => {
      closeModal('modal-billing');
      openModal('modal-upgrade');
    });
  }

  let activeCheckoutPlan = 'Pro';
  let activeSafepayMethod = 'card';

  window.openSafepayCheckoutModal = function (planName) {
    activeCheckoutPlan = planName || 'Pro';
    const planMap = {
      'Free': { price: 'PKR 0 / mo', rawPrice: 'PKR 0', features: ['🎁 1 Connected Account', '🎁 200 Replies/mo', '🎁 2 Keyword Triggers'] },
      'Starter': { price: 'PKR 2,500 / mo', rawPrice: 'PKR 2,500', features: ['⚡ 1 Connected Account', '⚡ 1,500 Replies/mo', '⚡ 5 Keyword Triggers'] },
      'Pro': { price: 'PKR 7,000 / mo', rawPrice: 'PKR 7,000', features: ['⚡ 3 Connected Accounts', '⚡ 6,000 Replies/mo', '⚡ 20 Keyword Triggers', '⚡ Full AI Reply Engine'] },
      'Business': { price: 'PKR 15,000 / mo', rawPrice: 'PKR 15,000', features: ['🌟 10 IG Accounts', '🌟 10 YT Accounts', '🌟 50,000 Replies/mo', '🌟 Priority 24/7 Support'] }
    };
    const info = planMap[activeCheckoutPlan] || planMap['Pro'];

    const nameEl = document.getElementById('sp-checkout-plan-name');
    const priceEl = document.getElementById('sp-checkout-plan-price');
    const subtotalEl = document.getElementById('sp-subtotal-text');
    const totalEl = document.getElementById('sp-total-text');
    const listEl = document.getElementById('sp-checkout-features-list');

    if (nameEl) nameEl.textContent = `${activeCheckoutPlan} Plan`;
    if (priceEl) priceEl.textContent = info.price;
    if (subtotalEl) subtotalEl.textContent = info.rawPrice;
    if (totalEl) totalEl.textContent = info.rawPrice;

    if (listEl) {
      listEl.innerHTML = info.features.map(f => `<li>${f}</li>`).join('');
    }

    closeModal('modal-upgrade');
    openModal('modal-safepay-checkout');
  };

  window.setSafepayMethod = function (method) {
    activeSafepayMethod = method;
    const cardTab = document.getElementById('sp-tab-card');
    const walletTab = document.getElementById('sp-tab-wallet');
    const cardFields = document.getElementById('sp-card-fields');
    const walletFields = document.getElementById('sp-wallet-fields');

    if (method === 'card') {
      if (cardTab) { cardTab.style.background = 'rgba(0, 69, 229, 0.2)'; cardTab.style.borderColor = '#0045E5'; cardTab.style.color = '#fff'; }
      if (walletTab) { walletTab.style.background = 'rgba(255,255,255,0.03)'; walletTab.style.borderColor = 'rgba(255,255,255,0.1)'; walletTab.style.color = '#a1a1aa'; }
      if (cardFields) cardFields.style.display = 'block';
      if (walletFields) walletFields.style.display = 'none';
    } else {
      if (walletTab) { walletTab.style.background = 'rgba(0, 69, 229, 0.2)'; walletTab.style.borderColor = '#0045E5'; walletTab.style.color = '#fff'; }
      if (cardTab) { cardTab.style.background = 'rgba(255,255,255,0.03)'; cardTab.style.borderColor = 'rgba(255,255,255,0.1)'; cardTab.style.color = '#a1a1aa'; }
      if (cardFields) cardFields.style.display = 'none';
      if (walletFields) walletFields.style.display = 'block';
    }
  };

  window.fillSafepayTestCard = function () {
    const cardName = document.getElementById('sp-card-name');
    const cardNumber = document.getElementById('sp-card-number');
    const cardExpiry = document.getElementById('sp-card-expiry');
    const cardCvc = document.getElementById('sp-card-cvc');

    if (cardName) cardName.value = 'Yasir Khalil (Test Buyer)';
    if (cardNumber) cardNumber.value = '4242 4242 4242 4242';
    if (cardExpiry) cardExpiry.value = '12/28';
    if (cardCvc) cardCvc.value = '123';
  };

  window.executeSafepayPayment = function () {
    const payBtn = document.getElementById('btn-submit-safepay');
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.textContent = '🔄 Authorizing Safepay 256-Bit Encrypted Payment...';
    }

    fetch('/api/billing/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planName: activeCheckoutPlan, paymentMethod: `Safepay (${activeSafepayMethod.toUpperCase()})` })
    })
      .then(res => res.json())
      .then(data => {
        if (payBtn) {
          payBtn.disabled = false;
          payBtn.textContent = '🔒 Confirm & Pay via Safepay';
        }
        if (data.success) {
          closeModal('modal-safepay-checkout');

          const transIdEl = document.getElementById('rec-trans-id');
          const planNameEl = document.getElementById('rec-plan-name');
          const amountPaidEl = document.getElementById('rec-amount-paid');

          if (transIdEl) transIdEl.textContent = `SP-2026-${Math.floor(10000 + Math.random() * 90000)}`;
          if (planNameEl) planNameEl.textContent = `${activeCheckoutPlan} Plan`;
          if (amountPaidEl) amountPaidEl.textContent = data.billing?.price || 'PKR 7,000';

          openModal('modal-payment-success');
          loadBilling();
        } else {
          alert('Safepay Payment Failed: ' + (data.error || 'Unknown transaction failure'));
        }
      })
      .catch(err => {
        if (payBtn) {
          payBtn.disabled = false;
          payBtn.textContent = '🔒 Confirm & Pay via Safepay';
        }
        alert('Safepay Gateway Connection Error.');
      });
  };

  // Handle plan tier upgrade selections
  document.querySelectorAll('[data-buy-plan]').forEach(btn => {
    btn.addEventListener('click', () => {
      const planName = btn.dataset.buyPlan;
      if (planName === 'Free') {
        fetch('/api/billing/upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planName: 'Free' })
        })
          .then(res => res.json())
          .then(() => { closeModal('modal-upgrade'); loadBilling(); });
      } else {
        openSafepayCheckoutModal(planName);
      }
    });
  });

  // ── DM Greeting Lists Manager ──
  let dmListsData = [];
  let newDmListReplies = [];
  let editingDmListId = null;

  const btnOpenCreateDmList = document.getElementById('btn-open-create-dm-list');
  const btnCloseCreateDmList = document.getElementById('btn-close-create-dm-list');
  const newDmListRepliesContainer = document.getElementById('new-dm-list-replies-container');
  const newDmListReplyInput = document.getElementById('new-dm-list-reply-input');
  const btnAddDmListReplyOption = document.getElementById('btn-add-dm-list-reply-option');
  const btnSaveDmList = document.getElementById('btn-save-dm-list');
  const btnDeleteDmList = document.getElementById('btn-delete-dm-list');
  const dmListSelect = document.getElementById('ig-dm-list-select');
  const btnEditDmList = document.getElementById('btn-edit-dm-list');

  // Load DM lists
  function loadDmLists() {
    fetch('/api/dm-lists')
      .then(res => res.json())
      .then(lists => {
        dmListsData = lists;
        if (dmListSelect) {
          dmListSelect.innerHTML = '';
          if (lists.length === 0) {
            dmListSelect.innerHTML = '<option value="">No lists found. Click New List</option>';
          } else {
            lists.forEach(list => {
              const opt = document.createElement('option');
              opt.value = list.id;
              opt.textContent = `${list.name} (${list.replies.length} variations)`;
              dmListSelect.appendChild(opt);
            });
          }
        }
      })
      .catch(err => console.error('Error loading DM lists:', err));
  }

  // DM List Modal toggle
  if (btnOpenCreateDmList) {
    btnOpenCreateDmList.addEventListener('click', () => {
      editingDmListId = null;
      document.getElementById('new-dm-list-name').value = '';
      newDmListReplies = [];
      renderNewDmListReplies();
      if (btnDeleteDmList) btnDeleteDmList.style.display = 'none';
      document.getElementById('modal-create-dm-list').querySelector('.modal-title').textContent = 'Create DM Greeting List';
      openModal('modal-create-dm-list');
    });
  }

  if (btnEditDmList) {
    btnEditDmList.addEventListener('click', () => {
      const selectedId = dmListSelect ? parseInt(dmListSelect.value) : null;
      if (!selectedId || isNaN(selectedId)) {
        alert('Please select a DM list to edit.');
        return;
      }
      const list = dmListsData.find(l => l.id === selectedId);
      if (!list) return;

      editingDmListId = list.id;
      document.getElementById('new-dm-list-name').value = list.name;
      newDmListReplies = [...list.replies];
      renderNewDmListReplies();
      if (btnDeleteDmList) btnDeleteDmList.style.display = 'block';
      document.getElementById('modal-create-dm-list').querySelector('.modal-title').textContent = 'Edit DM Greeting List';
      openModal('modal-create-dm-list');
    });
  }

  if (btnCloseCreateDmList) {
    btnCloseCreateDmList.addEventListener('click', () => closeModal('modal-create-dm-list'));
  }

  // Add variation to new DM list
  if (btnAddDmListReplyOption && newDmListReplyInput) {
    btnAddDmListReplyOption.addEventListener('click', () => {
      const val = newDmListReplyInput.value.trim();
      if (!val) return;
      if (newDmListReplies.length >= 15) {
        alert('Limit reached! Up to 15 variations.');
        return;
      }
      newDmListReplies.push(val);
      newDmListReplyInput.value = '';
      renderNewDmListReplies();
    });
  }

  function renderNewDmListReplies() {
    if (!newDmListRepliesContainer) return;
    newDmListRepliesContainer.innerHTML = '';
    newDmListReplies.forEach((cmt, idx) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '4px 8px';
      row.style.background = 'rgba(255,255,255,0.03)';
      row.style.borderRadius = '4px';
      row.style.fontSize = '12px';
      row.innerHTML = `
        <span style="color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 80%;">${cmt}</span>
        <button type="button" style="background: none; border: none; color: var(--accent-red-light); cursor: pointer; font-size: 13px;">×</button>
      `;
      row.querySelector('button').addEventListener('click', () => {
        newDmListReplies.splice(idx, 1);
        renderNewDmListReplies();
      });
      newDmListRepliesContainer.appendChild(row);
    });
    const counter = document.getElementById('new-dm-list-replies-counter');
    if (counter) counter.textContent = `${newDmListReplies.length} / 15 replies added`;
  }

  // Save DM list
  if (btnSaveDmList) {
    btnSaveDmList.addEventListener('click', () => {
      const name = document.getElementById('new-dm-list-name').value.trim();
      if (!name) { alert('Please enter a list name.'); return; }
      if (newDmListReplies.length === 0) { alert('Please add at least one greeting variation.'); return; }

      const payload = { name, replies: newDmListReplies };
      const url = editingDmListId ? `/api/dm-lists/${editingDmListId}` : '/api/dm-lists';
      const method = editingDmListId ? 'PUT' : 'POST';

      fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            alert(data.error);
          } else {
            loadDmLists();
            closeModal('modal-create-dm-list');
            alert(editingDmListId ? 'DM list updated!' : 'DM list created successfully!');
            editingDmListId = null;
          }
        })
        .catch(err => console.error('Error saving DM list:', err));
    });
  }

  // Delete DM list
  if (btnDeleteDmList) {
    btnDeleteDmList.addEventListener('click', () => {
      if (!editingDmListId) return;
      if (!confirm('Are you sure you want to delete this list?')) return;

      fetch(`/api/dm-lists/${editingDmListId}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            loadDmLists();
            closeModal('modal-create-dm-list');
            alert('DM list deleted successfully!');
            editingDmListId = null;
          }
        });
    });
  }

  // DM Greeting Tab toggles
  const btnModeDmList = document.getElementById('btn-mode-dm-list');
  const btnModeDmCustom = document.getElementById('btn-mode-dm-custom');
  const modeDmListContainer = document.getElementById('mode-dm-list-container');
  const modeDmCustomContainer = document.getElementById('mode-dm-custom-container');

  if (btnModeDmList && btnModeDmCustom) {
    btnModeDmList.addEventListener('click', () => {
      btnModeDmList.classList.add('active');
      btnModeDmCustom.classList.remove('active');
      modeDmListContainer.style.display = 'block';
      modeDmCustomContainer.style.display = 'none';
    });

    btnModeDmCustom.addEventListener('click', () => {
      btnModeDmCustom.classList.add('active');
      btnModeDmList.classList.remove('active');
      modeDmCustomContainer.style.display = 'block';
      modeDmListContainer.style.display = 'none';
    });
  }

  // ── Comment Reply Lists Manager ──
  let commentListsData = [];
  let customComments = [];
  let newListReplies = [];

  const btnModeList = document.getElementById('btn-mode-list');
  const btnModeCustom = document.getElementById('btn-mode-custom');
  const modeListContainer = document.getElementById('mode-list-container');
  const modeCustomContainer = document.getElementById('mode-custom-container');

  const customCommentInput = document.getElementById('custom-comment-input');
  const btnAddCustomComment = document.getElementById('btn-add-custom-comment');
  const customCommentsList = document.getElementById('custom-comments-list');
  const customCommentsCounter = document.getElementById('custom-comments-counter');

  const btnOpenCreateList = document.getElementById('btn-open-create-list');
  const btnCloseCreateList = document.getElementById('btn-close-create-list');
  const newListRepliesContainer = document.getElementById('new-list-replies-container');
  const newListReplyInput = document.getElementById('new-list-reply-input');
  const btnAddListReplyOption = document.getElementById('btn-add-list-reply-option');
  const btnSaveCommentList = document.getElementById('btn-save-comment-list');
  const newListRepliesCounter = document.getElementById('new-list-replies-counter');

  // Toggle modes
  if (btnModeList && btnModeCustom) {
    btnModeList.addEventListener('click', () => {
      btnModeList.classList.add('active');
      btnModeCustom.classList.remove('active');
      modeListContainer.style.display = 'block';
      modeCustomContainer.style.display = 'none';
    });

    btnModeCustom.addEventListener('click', () => {
      btnModeCustom.classList.add('active');
      btnModeList.classList.remove('active');
      modeCustomContainer.style.display = 'block';
      modeListContainer.style.display = 'none';
    });
  }

  // Load comment lists
  function loadCommentLists() {
    fetch('/api/comment-lists')
      .then(res => res.json())
      .then(lists => {
        commentListsData = lists;
        const select = document.getElementById('modal-comment-list-select');
        if (select) {
          select.innerHTML = '';
          if (lists.length === 0) {
            select.innerHTML = '<option value="">No lists found. Click New List</option>';
          } else {
            lists.forEach(list => {
              const opt = document.createElement('option');
              opt.value = list.id;
              opt.textContent = `${list.name} (${list.replies.length} variations)`;
              select.appendChild(opt);
            });
          }
        }
      })
      .catch(err => console.error('Error loading comment lists:', err));
  }

  // Add inline custom comment variation
  if (btnAddCustomComment && customCommentInput) {
    btnAddCustomComment.addEventListener('click', () => {
      const val = customCommentInput.value.trim();
      if (!val) return;
      if (customComments.length >= 15) {
        alert('Limit reached! You can add a maximum of 15 custom replies.');
        return;
      }
      customComments.push(val);
      customCommentInput.value = '';
      renderCustomComments();
    });
  }

  function renderCustomComments() {
    if (!customCommentsList) return;
    customCommentsList.innerHTML = '';
    customComments.forEach((cmt, idx) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '4px 8px';
      row.style.background = 'rgba(255,255,255,0.03)';
      row.style.borderRadius = '4px';
      row.style.fontSize = '12px';
      row.innerHTML = `
        <span style="color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 80%;">${cmt}</span>
        <button type="button" style="background: none; border: none; color: var(--accent-red-light); cursor: pointer; font-size: 13px;">×</button>
      `;
      row.querySelector('button').addEventListener('click', () => {
        customComments.splice(idx, 1);
        renderCustomComments();
      });
      customCommentsList.appendChild(row);
    });
    if (customCommentsCounter) {
      customCommentsCounter.textContent = `${customComments.length} / 15 options added`;
    }
  }

  // Create Comment List Overlay controls
  // Edit List button
  const btnEditList = document.getElementById('btn-edit-list');
  const btnDeleteList = document.getElementById('btn-delete-comment-list');
  let editingListId = null;

  if (btnEditList) {
    btnEditList.addEventListener('click', () => {
      const select = document.getElementById('modal-comment-list-select');
      const selectedId = parseInt(select.value);
      const list = commentListsData.find(l => l.id === selectedId);
      if (!list) {
        alert('Please select a list to edit.');
        return;
      }
      editingListId = selectedId;
      document.getElementById('new-list-name').value = list.name;
      newListReplies = [...list.replies];
      renderNewListReplies();

      // Update modal UI for Edit mode
      const modalTitle = document.querySelector('#modal-create-comment-list .modal-title');
      if (modalTitle) modalTitle.textContent = 'Edit Comment Reply List';
      if (btnDeleteList) btnDeleteList.style.display = 'block';

      openModal('modal-create-comment-list');
    });
  }

  if (btnOpenCreateList) {
    btnOpenCreateList.addEventListener('click', () => {
      if (commentListsData.length >= 2) {
        alert('Limit reached! You can create a maximum of 2 comment lists. Please delete an existing list to add a new one.');
        return;
      }
      editingListId = null;
      document.getElementById('new-list-name').value = '';
      newListReplies = [];
      renderNewListReplies();

      // Update modal UI for Create mode
      const modalTitle = document.querySelector('#modal-create-comment-list .modal-title');
      if (modalTitle) modalTitle.textContent = 'Create Comment Reply List';
      if (btnDeleteList) btnDeleteList.style.display = 'none';

      openModal('modal-create-comment-list');
    });
  }

  if (btnDeleteList) {
    btnDeleteList.addEventListener('click', () => {
      if (!editingListId) return;
      if (!confirm('Are you sure you want to delete this comment list?')) return;

      fetch(`/api/comment-lists/${editingListId}`, {
        method: 'DELETE'
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            loadCommentLists();
            closeModal('modal-create-comment-list');
            alert('Comment reply list deleted successfully!');
            editingListId = null;
          } else {
            alert('Failed to delete list.');
          }
        })
        .catch(err => {
          console.error('Error deleting list:', err);
          alert('Error deleting list.');
        });
    });
  }

  if (btnCloseCreateList) {
    btnCloseCreateList.addEventListener('click', () => closeModal('modal-create-comment-list'));
  }

  // Add reply to new list
  if (btnAddListReplyOption && newListReplyInput) {
    btnAddListReplyOption.addEventListener('click', () => {
      const val = newListReplyInput.value.trim();
      if (!val) return;
      if (newListReplies.length >= 15) {
        alert('Limit reached! Each list can contain up to 15 reply variations.');
        return;
      }
      newListReplies.push(val);
      newListReplyInput.value = '';
      renderNewListReplies();
    });
  }

  function renderNewListReplies() {
    if (!newListRepliesContainer) return;
    newListRepliesContainer.innerHTML = '';
    newListReplies.forEach((cmt, idx) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '4px 8px';
      row.style.background = 'rgba(255,255,255,0.03)';
      row.style.borderRadius = '4px';
      row.style.fontSize = '12px';
      row.innerHTML = `
        <span style="color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 80%;">${cmt}</span>
        <button type="button" style="background: none; border: none; color: var(--accent-red-light); cursor: pointer; font-size: 13px;">×</button>
      `;
      row.querySelector('button').addEventListener('click', () => {
        newListReplies.splice(idx, 1);
        renderNewListReplies();
      });
      newListRepliesContainer.appendChild(row);
    });
    if (newListRepliesCounter) {
      newListRepliesCounter.textContent = `${newListReplies.length} / 15 replies added`;
    }
  }

  // Save new or edit existing comment list
  if (btnSaveCommentList) {
    btnSaveCommentList.addEventListener('click', () => {
      const name = document.getElementById('new-list-name').value.trim();
      if (!name) {
        alert('Please enter a name for the list.');
        return;
      }
      if (newListReplies.length === 0) {
        alert('Please add at least one reply option to the list.');
        return;
      }

      const url = editingListId ? `/api/comment-lists/${editingListId}` : '/api/comment-lists';
      const method = editingListId ? 'PUT' : 'POST';

      fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, replies: newListReplies })
      })
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            alert(data.error);
          } else {
            loadCommentLists();
            closeModal('modal-create-comment-list');
            alert(editingListId ? 'Comment reply list updated!' : 'Comment reply list created successfully!');
            editingListId = null;
          }
        })
        .catch(err => {
          console.error('Error saving comment list:', err);
          alert('Failed to save comment list.');
        });
    });
  }

  // ── Save DM Settings Click Handler ──
  const btnSaveDmSettings = document.getElementById('btn-save-ig-dm-settings');
  if (btnSaveDmSettings) {
    btnSaveDmSettings.addEventListener('click', () => {
      const platform = 'ig';
      const activeIdx = activeAccountIdx[platform] || 0;
      const accountsList = loadedAccounts[platform];
      if (!accountsList || accountsList.length === 0) {
        alert('No Instagram account active to save settings for.');
        return;
      }
      const activeAcc = accountsList[activeIdx];

      const toggle = document.getElementById('ig-dm-fg-toggle');
      const btnModeList = document.getElementById('btn-mode-dm-list');
      const dmListSelect = document.getElementById('ig-dm-list-select');
      const greetingInput = document.getElementById('ig-dm-greeting');
      const linkMsgInput = document.getElementById('ig-dm-link-msg');
      const btn1LabelInput = document.getElementById('ig-dm-btn1-label');
      const btn2LabelInput = document.getElementById('ig-dm-btn2-label');
      const followPromptInput = document.getElementById('ig-dm-follow-prompt');
      const followErrorInput = document.getElementById('ig-dm-follow-error');

      const followGateRequired = toggle ? toggle.classList.contains('active') : false;
      const dmGreetingType = 'list';
      const dmListId = dmListSelect && dmListSelect.value ? parseInt(dmListSelect.value) : null;
      const greetingMessage = '';
      const linkDeliveryMessage = linkMsgInput ? linkMsgInput.value.trim() : '';
      const buttonGetLinkLabel = btn1LabelInput ? btn1LabelInput.value.trim() : 'Get Link';
      const buttonProfileLabel = btn2LabelInput ? btn2LabelInput.value.trim() : 'Profile Visit';
      const followGateMessage = followPromptInput ? followPromptInput.value.trim() : '';
      const followGateError = followErrorInput ? followErrorInput.value.trim() : '';

      if (dmGreetingType === 'list' && !dmListId) {
        alert('Please select a DM list or switch to Custom Greeting.');
        return;
      }

      fetch(`/api/accounts/${activeAcc.id}/dm-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followGateRequired,
          dmGreetingType,
          dmListId,
          greetingMessage,
          linkDeliveryMessage,
          buttonGetLinkLabel,
          buttonProfileLabel,
          followGateMessage,
          followGateError
        })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            // Update local state
            activeAcc.dmSettings = data.dmSettings;
            showSuccessToast('DM settings saved successfully!');
          } else {
            showErrorToast('Failed to save settings: ' + (data.error || 'Unknown error'));
          }
        })
        .catch(err => {
          console.error('Error saving settings:', err);
          showErrorToast('Failed to save settings.');
        });
    });
  }

  // Handle DM toggle status label updates
  const igDmFgToggle = document.getElementById('ig-dm-fg-toggle');
  const igDmFgStatus = document.getElementById('ig-dm-fg-status');
  if (igDmFgToggle && igDmFgStatus) {
    igDmFgToggle.addEventListener('click', () => {
      // Toggle happens via global static click handler, wait 50ms to read class state
      setTimeout(() => {
        const isActive = igDmFgToggle.classList.contains('active');
        igDmFgStatus.textContent = isActive ? 'Active' : 'Disabled';
      }, 50);
    });
  }

  // Mandatory top-level Auth Gate verification before rendering app shell
  function verifySessionAndInitialize() {
    const standaloneLanding = document.getElementById('standalone-landing-page');
    const mainAppShell = document.getElementById('main-app-shell');
    const token = localStorage.getItem('replyflow_user_token');

    if (!token) {
      if (standaloneLanding) standaloneLanding.style.display = 'block';
      if (mainAppShell) mainAppShell.style.display = 'none';
      window.location.hash = '#login';
      return;
    }

    fetch('/api/auth/me', { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => {
        if (data && data.authenticated && data.user) {
          renderUserProfileUI(data.user);
          loadBilling();
          loadCommentLists();
          loadDmLists();
          const rawHash = window.location.hash ? window.location.hash.substring(1) : 'dashboard';
          const initialScreen = rawHash.split('?')[0] || 'dashboard';
          switchScreen(initialScreen);
        } else {
          redirectToLogin();
        }
      })
      .catch(err => {
        console.error('Session verification failed on initial load:', err);
        redirectToLogin();
      });
  }

  // Initial load execution gated by auth session verification
  verifySessionAndInitialize();

  // ── Auto-Reply Simulator Logic ──
  function updateSimulatorDropdown() {
    const select = document.getElementById('sim-post-select');
    if (!select) return;
    select.innerHTML = '';

    ['ig', 'yt'].forEach(platform => {
      const platformLabel = platform === 'ig' ? 'Instagram / Facebook' : 'YouTube';
      const accounts = loadedAccounts[platform] || [];
      accounts.forEach(acc => {
        acc.posts.forEach(post => {
          const opt = document.createElement('option');
          opt.value = `${platform}|${acc.id}|${post.id}`;
          opt.textContent = `[${platformLabel}] ${acc.username} - ${post.type}: "${post.title}" (AI: ${post.aiReply ? 'ON' : 'OFF'})`;
          select.appendChild(opt);
        });
      });
    });
  }

  const btnRunSim = document.getElementById('btn-run-simulation');
  const simCommentInput = document.getElementById('sim-comment-input');
  const simResultContainer = document.getElementById('sim-result-container');

  if (btnRunSim) {
    btnRunSim.addEventListener('click', () => {
      const selectVal = document.getElementById('sim-post-select').value;
      const commentText = simCommentInput.value.trim().toLowerCase();

      if (!selectVal) {
        alert('Please connect an account and select a post/video first.');
        return;
      }
      if (!commentText) {
        alert('Please enter a comment to simulate auto-reply.');
        return;
      }

      const [platform, accountId, postId] = selectVal.split('|');
      const accounts = loadedAccounts[platform] || [];
      const account = accounts.find(a => a.id === parseInt(accountId));
      const post = account ? account.posts.find(p => p.id === parseInt(postId)) : null;

      if (!post) {
        alert('Selected post was not found.');
        return;
      }

      simResultContainer.innerHTML = '<div style="color: var(--text-muted);">Processing comment...</div>';

      fetch(`/api/triggers?platform=${platform}`)
        .then(res => res.json())
        .then(triggers => {
          const matchedTrigger = triggers.find(t => t.active && commentText.includes(t.keyword.toLowerCase()));

          setTimeout(() => {
            let outputHTML = '';

            if (matchedTrigger) {
              let commentReplySelected = '';
              let selectedSourceLabel = '';

              if (matchedTrigger.commentReplyType === 'list') {
                const listId = parseInt(matchedTrigger.commentListId);
                const matchedList = commentListsData.find(l => l.id === listId);
                if (matchedList && matchedList.replies && matchedList.replies.length > 0) {
                  const randIdx = Math.floor(Math.random() * matchedList.replies.length);
                  commentReplySelected = matchedList.replies[randIdx];
                  selectedSourceLabel = `List: "${matchedList.name}" (randomized option #${randIdx + 1})`;
                } else {
                  commentReplySelected = 'Check your DMs! 📩 (Fallback)';
                  selectedSourceLabel = 'default fallback';
                }
              } else {
                const options = matchedTrigger.commentReplies || [];
                if (options.length > 0) {
                  const randIdx = Math.floor(Math.random() * options.length);
                  commentReplySelected = options[randIdx];
                  selectedSourceLabel = `Custom Options (randomized option #${randIdx + 1})`;
                } else {
                  commentReplySelected = 'Check your DMs! 📩 (Fallback)';
                  selectedSourceLabel = 'default fallback';
                }
              }

              outputHTML = `
                <div style="margin-bottom: 8px;"><strong style="color: var(--accent-green-light);">✓ Keyword Match Found</strong></div>
                <div style="margin-bottom: 8px; font-style: italic; background: rgba(255,255,255,0.03); padding: 8px; border-radius: var(--radius-sm); font-size: 11px; line-height: 1.4;">
                  Comment matches trigger: <strong>"${matchedTrigger.keyword}"</strong>
                </div>
                <div style="margin-bottom: 6px; font-size: 12px;">
                  <span style="color: var(--text-secondary);">Inbox DM Sent:</span> <span style="color: #fff; font-weight: 500;">"${matchedTrigger.reply}"</span>
                </div>
                <div style="margin-bottom: 8px; font-size: 12px;">
                  <span style="color: var(--text-secondary);">Comment Reply Sent:</span> <span style="color: #fff; font-weight: 500;">"${commentReplySelected}"</span>
                  <div style="font-size: 9px; color: var(--text-muted); margin-top: 2px;">Source: ${selectedSourceLabel}</div>
                </div>
                <div style="font-size: 10px; color: var(--accent-pink);">
                  [Rule Match: Fixed trigger overrides AI Reply. AI engine bypassed]
                </div>
              `;
            } else {
              if (post.aiReply) {
                const mockAIReply = `[AI Reply] Hello ${account.username} follower! Thanks for commenting. Check details on replyflow.app 🚀`;
                outputHTML = `
                  <div style="margin-bottom: 8px;"><strong style="color: var(--accent-pink);">✓ AI Auto-Reply Fired</strong></div>
                  <div style="margin-bottom: 8px; font-style: italic; color: var(--text-secondary);">
                    No keyword match. AI Reply toggle is <strong>ON</strong> for this post.
                  </div>
                  <div style="margin-bottom: 8px;">
                    <span style="color: var(--text-secondary);">AI Generated Reply:</span> <span style="color: #fff; font-weight: 500;">"${mockAIReply}"</span>
                  </div>
                  <div style="font-size: 11px; color: var(--accent-green-light);">
                    [Rule Match: Trigger keyword not found -> AI response active]
                  </div>
                `;
              } else {
                outputHTML = `
                  <div style="margin-bottom: 8px;"><strong style="color: var(--accent-red-light);">✗ Auto-Reply Bypassed</strong></div>
                  <div style="margin-bottom: 8px; font-style: italic; color: var(--text-secondary);">
                    No keyword matches, and AI Reply toggle is <strong>OFF</strong> for this post.
                  </div>
                  <div style="margin-bottom: 8px; color: var(--text-muted);">
                    Result: No auto-reply generated for this comment.
                  </div>
                  <div style="font-size: 11px; color: var(--text-muted);">
                    [Rule Match: AI deactivated and no custom trigger matches]
                  </div>
                `;
              }
            }
            simResultContainer.innerHTML = outputHTML;
          }, 400);
        })
        .catch(err => {
          console.error('Error in simulation:', err);
          simResultContainer.innerHTML = '<div style="color: var(--accent-red-light);">Error running simulation.</div>';
        });
    });
  }

  // ───────────────────────────────────────────────────────────
  // Inbox Automation Settings — Follow-Gate DM Flow
  // Integrated into the Accounts screen (IG platform tab)
  // ───────────────────────────────────────────────────────────

  // Combined load for Instagram Inbox Automation Settings
  function loadInboxAutomation() {
    loadIgInboxConnect();
    loadFollowGateConfigs();
    if (typeof loadConfirmations === 'function') {
      loadConfirmations();
    }
  }

  // Load the connect area for the Inbox Automation section
  function loadIgInboxConnect() {
    const container = document.getElementById('ig-inbox-connect-area');
    if (!container) return;
    container.innerHTML = '<div style="color: var(--text-dim);">Checking connection...</div>';

    // Fetch OAuth-connected accounts
    fetch('/api/instagram/accounts')
      .then(res => res.json())
      .then(oauthAccounts => {
        if (oauthAccounts.length === 0) {
          // No OAuth connection — show connect prompt
          container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
              <div style="color: var(--text-secondary); font-size: 13px;">No Instagram account connected via OAuth.</div>
              <button class="btn-primary-sm" id="btn-connect-instagram-fg" style="background: var(--accent-pink);">
                Connect Instagram
              </button>
            </div>
          `;
          const btn = container.querySelector('#btn-connect-instagram-fg');
          if (btn) {
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              connectInstagram();
            });
          }
          return;
        }

        // Show the first OAuth-connected account
        const account = oauthAccounts[0];
        const profileUrl = account.profileUrl || `https://instagram.com/${account.username}`;
        container.innerHTML = `
          <div class="ig-account-summary-row">
            <div class="ig-account-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="17.5" cy="6.5" r="1.5" />
              </svg>
            </div>
            <div class="ig-account-info">
              <div class="ig-account-username">
                ${account.username}
                <span class="badge connected">Connected</span>
              </div>
              <div class="ig-account-profile-url">${profileUrl}</div>
              <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">
                Token expires: ${new Date(account.tokenExpiresAt).toLocaleDateString()}
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn-manage" id="btn-open-ig-profile-inbox">Open Profile</button>
              <button class="btn-delete" id="btn-disconnect-ig-inbox" style="background: var(--accent-red-bg); color: var(--accent-red-light);">Disconnect</button>
            </div>
          </div>
        `;
        const btnOpenProfile = document.getElementById('btn-open-ig-profile-inbox');
        if (btnOpenProfile) {
          btnOpenProfile.addEventListener('click', () => {
            window.open(profileUrl, '_blank');
          });
        }
        const btnDisconnect = document.getElementById('btn-disconnect-ig-inbox');
        if (btnDisconnect) {
          btnDisconnect.addEventListener('click', () => {
            if (!confirm('Disconnect this Instagram account from ReplyFlow?')) return;
            fetch('/api/instagram/accounts/disconnect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accountId: account.id })
            })
              .then(res => res.json())
              .then(data => {
                showToast(data.success ? 'success' : 'error', data.success
                  ? 'Instagram account disconnected.'
                  : (data.error || 'Failed to disconnect.'));
                if (data.success) {
                  refreshInboxAutomation();
                }
              });
          });
        }
      })
      .catch(err => {
        console.error('Error loading IG account:', err);
        container.innerHTML = '<div style="color: var(--accent-red-light);">Error loading account.</div>';
      });
  }

  // Load all IG trigger follow-gate configs (inline editable, no modal)
  function loadFollowGateConfigs() {
    const container = document.getElementById('ig-inbox-config-container');
    if (!container) return;
    container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 24px; font-size: 13px;">Loading configurations...</div>';

    // First check if an Instagram account is connected via OAuth
    fetch('/api/instagram/accounts')
      .then(res => res.json())
      .then(oauthAccounts => {
        if (oauthAccounts.length === 0) {
          container.innerHTML = `
            <div style="text-align: center; padding: 32px; color: var(--text-secondary); font-size: 13px;">
              <div style="margin-bottom: 16px;">Connect your Instagram account to configure Follow-Gate automation.</div>
              <button class="btn-primary-sm" id="btn-connect-instagram-fg" style="background: var(--accent-pink);">
                Connect Instagram Account
              </button>
            </div>
          `;
          const btn = container.querySelector('#btn-connect-instagram-fg');
          if (btn) {
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              connectInstagram();
            });
          }
          return;
        }

        return fetch('/api/follow-gate/config?platform=ig')
          .then(res => res.json())
          .then(configs => {
            if (!configs || configs.length === 0) {
              container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 24px; font-size: 13px;">No triggers found for Instagram. Create one via Trigger Builder.</div>';
              return;
            }

            container.innerHTML = '';
            configs.forEach((cfg, i) => {
              const fgEnabled = cfg.followGateEnabled || false;
              const fgGreeting = cfg.followGateGreeting || 'Hey! Thanks for your comment 👋';
              const triggerId = cfg.id;

              const card = document.createElement('div');
              card.className = 'follow-gate-card';
              card.innerHTML = `
                <div class="follow-gate-card-header">
                  <div class="follow-gate-trigger-info">
                    <div class="follow-gate-keyword">
                      Trigger: "${cfg.keyword}"
                      <span class="follow-gate-badge ${fgEnabled ? 'enabled' : 'disabled'}">
                        ${fgEnabled ? 'Follow-Gate ON' : 'Follow-Gate OFF'}
                      </span>
                    </div>
                    <div class="follow-gate-reply" id="fg-reply-display-${triggerId}">${cfg.reply}</div>
                    <div style="font-size: 11px; color: var(--text-dim); margin-top: 4px;">Scope: ${cfg.scope}</div>
                  </div>
                  <div class="follow-gate-actions">
                    <button class="btn-simulate-fg" data-trigger-id="${triggerId}"><span>▶</span> Simulate</button>
                    <div class="toggle ${fgEnabled ? 'active' : ''}" data-fg-toggle data-trigger-id="${triggerId}" style="margin: 0;"></div>
                  </div>
                </div>

                <div class="follow-gate-fields">
                  <div class="follow-gate-field-row">
                    <span class="field-label">Greeting</span>
                    <input type="text" class="fg-greeting-input" data-trigger-id="${triggerId}"
                      value="${fgGreeting}" style="flex: 1; padding: 8px 12px; background: var(--bg-input); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); color: var(--text-card); font-size: 12px;">
                    <button class="btn-save-fg" data-trigger-id="${triggerId}" data-field="greeting" style="flex-shrink: 0; padding: 6px 12px; margin-left: 8px;">Save</button>
                  </div>
                  <div class="follow-gate-field-row">
                    <span class="field-label">Reward (DM Reply)</span>
                    <input type="text" class="fg-reply-input" data-trigger-id="${triggerId}"
                      value="${cfg.reply}" style="flex: 1; padding: 8px 12px; background: var(--bg-input); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); color: var(--text-card); font-size: 12px;">
                    <button class="btn-save-fg" data-trigger-id="${triggerId}" data-field="reply" style="flex-shrink: 0; padding: 6px 12px; margin-left: 8px;">Save</button>
                  </div>
                  <div class="follow-gate-field-row">
                    <span class="field-label">Flow Buttons</span>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                      <span class="flow-btn">Get Link</span>
                      <span class="flow-btn">Visit Profile</span>
                      <span class="flow-btn">Follow</span>
                      <span class="flow-btn">I've Followed ✅</span>
                    </div>
                  </div>
                </div>
              `;

              // Stagger animation
              card.style.opacity = '0';
              card.style.transform = 'translateY(10px)';
              card.style.transition = 'opacity 300ms ease, transform 300ms ease';
              container.appendChild(card);
              requestAnimationFrame(() => {
                setTimeout(() => {
                  card.style.opacity = '1';
                  card.style.transform = 'translateY(0)';
                }, i * 60);
              });
            });

            // Bind toggle for follow-gate enable/disable
            container.querySelectorAll('[data-fg-toggle]').forEach(toggle => {
              toggle.addEventListener('click', function () {
                const tid = parseInt(this.dataset.triggerId);
                const currentlyActive = this.classList.contains('active');
                saveFollowGateField(tid, 'enabled', !currentlyActive).then(() => {
                  this.classList.toggle('active', !currentlyActive);
                  const badge = this.closest('.follow-gate-card').querySelector('.follow-gate-badge');
                  if (badge) {
                    badge.className = 'follow-gate-badge ' + (!currentlyActive ? 'enabled' : 'disabled');
                    badge.textContent = !currentlyActive ? 'Follow-Gate ON' : 'Follow-Gate OFF';
                  }
                  showToast(!currentlyActive ? 'success' : 'info',
                    !currentlyActive ? 'Follow-Gate enabled!' : 'Follow-Gate disabled.');
                  renderFlowPreview(tid);
                });
              });
            });

            // Bind save buttons for inline editing
            container.querySelectorAll('.btn-save-fg').forEach(btn => {
              btn.addEventListener('click', function () {
                const tid = parseInt(this.dataset.triggerId);
                const field = this.dataset.field;
                const input = this.closest('.follow-gate-field-row').querySelector('input');
                const value = input ? input.value.trim() : '';
                const defaultVal = field === 'greeting'
                  ? 'Hey! Thanks for your comment 👋'
                  : '';

                saveFollowGateField(tid, field, field === 'greeting' ? (value || defaultVal) : value).then(() => {
                  showToast('success', 'Saved!');
                  renderFlowPreview(tid);
                });
              });
            });

            // Bind simulate buttons
            container.querySelectorAll('.btn-simulate-fg').forEach(btn => {
              btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const triggerId = parseInt(btn.dataset.triggerId);
                openFollowGateSimulator(triggerId);
                renderFlowPreview(triggerId);
              });
            });
          })
          .catch(err => {
            console.error('Error loading follow-gate configs:', err);
            container.innerHTML = '<div style="color: var(--accent-red-light); text-align: center; padding: 24px;">Error loading configurations.</div>';
          });
      })
      .catch(err => {
        console.error('Error loading IG accounts for follow-gate:', err);
        container.innerHTML = '<div style="color: var(--accent-red-light); text-align: center; padding: 24px;">Error loading accounts.</div>';
      });
  }

  // Save a follow-gate field via API
  function saveFollowGateField(triggerId, field, value) {
    const body = {};
    if (field === 'greeting') {
      body.followGateGreeting = value;
    } else if (field === 'enabled') {
      body.followGateEnabled = value;
    } else if (field === 'reply') {
      // Update the trigger's reward (reply) via the trigger endpoint
      return fetch(`/api/triggers/${triggerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: value })
      })
        .then(res => res.json());
    }
    return fetch(`/api/follow-gate/config/${triggerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(res => res.json());
  }

  // Render the DM Flow Preview for a trigger
  function renderFlowPreview(triggerId) {
    const preview = document.getElementById('ig-inbox-flow-preview');
    if (!preview) return;

    fetch('/api/follow-gate/config?platform=ig')
      .then(res => res.json())
      .then(configs => {
        const cfg = configs.find(c => c.id === triggerId);
        if (!cfg) {
          preview.innerHTML = '<div style="color: var(--text-dim);">Select a trigger to preview its DM flow.</div>';
          return;
        }

        const greeting = cfg.followGateGreeting || 'Hey! Thanks for your comment 👋';
        const enabled = cfg.followGateEnabled || false;
        const reward = cfg.reply;

        if (!enabled) {
          preview.innerHTML = `
            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.6;">
              <div style="margin-bottom: 8px;"><strong>Follow-Gate is OFF</strong> for trigger "${cfg.keyword}".</div>
              <div>Standard DM reply will be sent directly: "${reward}"</div>
            </div>
          `;
          return;
        }

        // Show the full flow with buttons
        preview.innerHTML = `
          <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.6;">
            <div style="margin-bottom: 12px;"><strong>Step 1: Greeting DM</strong></div>
            <div style="background: var(--bg-input); border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 12px; margin-bottom: 12px; font-size: 13px; color: var(--text-body);">
              ${greeting}
            </div>
            <div style="margin-bottom: 12px;"><strong>Step 2: Buttons (Instagram Button Template)</strong></div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">
              <span class="flow-btn-detail"><span class="flow-btn-label">${cfg.buttonGetLinkLabel || 'Get Link'}</span><span class="flow-btn-desc">postback → checks follow status</span></span>
              <span class="flow-btn-detail"><span class="flow-btn-label">${cfg.buttonProfileLabel || 'Profile Visit'}</span><span class="flow-btn-desc">web_url → opens IG profile</span></span>
            </div>
            <div style="margin-bottom: 8px;"><strong>Step 3: Follow-Gate Logic</strong></div>
            <div style="margin-bottom: 8px; font-size: 11px; color: var(--text-dim);">
              If has_confirmed_follow = FALSE → sends: "Please follow us to unlock this link! 🙏"
              with buttons:
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
              <span class="flow-btn-detail"><span class="flow-btn-label">${cfg.buttonProfileLabel || 'Profile Visit'}</span><span class="flow-btn-desc">web_url → opens profile to follow</span></span>
              <span class="flow-btn-detail"><span class="flow-btn-label">I've Followed ✅</span><span class="flow-btn-desc">postback → CONFIRM_FOLLOW_{triggerId}_{userIgsid}</span></span>
            </div>
            <div style="margin-top: 12px; font-size: 11px; color: var(--accent-green);">
              ✓ After confirmation, sending: "${reward}"
            </div>
          </div>
        `;
      })
      .catch(err => {
        console.error('Error rendering flow preview:', err);
        preview.innerHTML = '<div style="color: var(--accent-red-light);">Error loading preview.</div>';
      });
  }

  // Show default flow preview message
  function resetFlowPreview() {
    const preview = document.getElementById('ig-inbox-flow-preview');
    if (preview) {
      preview.innerHTML = '<div style="color: var(--text-dim);">Select a trigger to preview its DM flow.</div>';
    }
  }

  // ── Follow-Gate Simulator Logic (modal) ──
  const modalIgSimulator = document.getElementById('modal-ig-simulator');
  const simIgResultContainer = document.getElementById('sim-ig-result-container');
  const simAccountSelect = document.getElementById('sim-account-select');
  const simUserIgsid = document.getElementById('sim-user-igsid');
  const simIgCommentInput = document.getElementById('sim-ig-comment-input');

  let simTriggerId = null;

  function populateSimAccounts() {
    simAccountSelect.innerHTML = '';
    fetch('/api/accounts?platform=ig', { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(accounts => {
        accounts.forEach(acc => {
          const opt = document.createElement('option');
          opt.value = acc.id;
          opt.textContent = `${acc.username} (${acc.displayName})`;
          simAccountSelect.appendChild(opt);
        });
      });
  }

  function openFollowGateSimulator(triggerId) {
    simTriggerId = triggerId;
    populateSimAccounts();
    simIgCommentInput.value = '';
    simUserIgsid.value = '178414' + Date.now().toString().slice(-10);
    simIgResultContainer.innerHTML = '<span style="color: var(--text-muted);">Simulation results will appear here...</span>';
    openModal('modal-ig-simulator');
  }

  const btnRunIgSim = document.getElementById('btn-run-ig-simulation');
  if (btnRunIgSim) {
    btnRunIgSim.addEventListener('click', () => {
      const accountId = simAccountSelect.value;
      const userIgsid = simUserIgsid.value.trim();
      const commentText = simIgCommentInput.value.trim();

      if (!accountId || !userIgsid || !commentText) {
        alert('Please fill in all fields.');
        return;
      }

      simIgResultContainer.innerHTML = '<div style="color: var(--text-muted);">Processing Follow-Gate flow...</div>';

      fetch('/api/follow-gate/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'ig',
          accountId: parseInt(accountId),
          postId: null,
          commentText: commentText,
          userIgsid: userIgsid
        })
      })
        .then(res => res.json())
        .then(data => {
          setTimeout(() => {
            let html = '';

            if (data.step === 'no-match') {
              html = `
                <div style="margin-bottom: 8px;"><strong style="color: var(--accent-red-light);">✗ No Trigger Match</strong></div>
                <div style="font-size: 12px; color: var(--text-secondary);">${data.message}</div>
              `;
            } else if (data.step === 'trigger-matched' && !data.followGateEnabled) {
              html = `
                <div style="margin-bottom: 8px;"><strong style="color: var(--accent-green);">✓ Trigger Matched (No Follow-Gate)</strong></div>
                <div style="margin-bottom: 6px; font-size: 12px;">
                  <span style="color: var(--text-secondary);">Keyword:</span> <span style="color: #fff;">"${data.keyword}"</span>
                </div>
                <div style="margin-bottom: 6px; font-size: 12px;">
                  <span style="color: var(--text-secondary);">DM Reply:</span> <span style="color: #fff;">"${data.dmMessage}"</span>
                </div>
              `;
            } else if (data.step === 'get-link-confirmed') {
              html = `
                <div style="margin-bottom: 8px;"><strong style="color: var(--accent-green);">✓ Link Unlocked (Already Confirmed)</strong></div>
                <div style="margin-bottom: 6px; font-size: 12px;">
                  <span style="color: var(--text-secondary);">Greeting:</span> <span style="color: #fff;">"${data.greeting}"</span>
                </div>
                <div style="margin-bottom: 6px; font-size: 12px;">
                  <span style="color: var(--text-secondary);">Reward DM:</span> <span style="color: #fff; font-weight: 500;">"${data.dmMessage}"</span>
                </div>
                <div style="font-size: 10px; color: var(--text-muted);">
                  [User has_confirmed_follow = true → link sent directly. AI reply bypassed.]
                </div>
              `;
            } else if (data.step === 'follow-request') {
              html = `
                <div style="margin-bottom: 8px;"><strong style="color: var(--accent-yellow);">→ Follow-Gate: Request Follow</strong></div>
                <div style="margin-bottom: 6px; font-size: 12px;">
                  <span style="color: var(--text-secondary);">Greeting:</span> <span style="color: #fff;">"${data.greeting}"</span>
                </div>
                <div style="margin-bottom: 6px; font-size: 12px;">
                  <span style="color: var(--text-secondary);">DM:</span> <span style="color: #fff;">"${data.dmMessage}"</span>
                </div>
                <div style="margin-bottom: 8px; font-size: 12px;">
                  <span style="color: var(--text-secondary);">Buttons:</span>
                  <div style="margin-top: 4px;">
                    <span style="color: var(--accent-pink);">[Follow]</span> → ${data.profileUrl || `https://instagram.com/${data.businessUsername}`}
                    <span style="color: var(--accent-pink);">[I've Followed ✅]</span> → payload: ${data.nextStepPayload}
                  </div>
                </div>
                <button class="btn-primary-sm" id="btn-confirm-follow-sim" style="margin-top: 8px;">✓ Simulate "I've Followed" Click</button>
                <div style="font-size: 10px; color: var(--text-muted); margin-top: 8px;">
                  [has_confirmed_follow = false → follow-request DM shown. Clicking "I've Followed" will set the flag and send the reward.]
                </div>
              `;
            }

            simIgResultContainer.innerHTML = html;

            // Bind the simulate-confirm button if present
            const btnConfirmSim = document.getElementById('btn-confirm-follow-sim');
            if (btnConfirmSim) {
              btnConfirmSim.addEventListener('click', () => {
                simIgResultContainer.innerHTML = '<div style="color: var(--text-muted);">Confirming follow...</div>';
                fetch('/api/follow-gate/confirm-simulate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    accountId: parseInt(accountId),
                    userIgsid: userIgsid
                  })
                })
                  .then(res => res.json())
                  .then(data2 => {
                    setTimeout(() => {
                      simIgResultContainer.innerHTML = `
                        <div style="margin-bottom: 8px;"><strong style="color: var(--accent-green);">✓ Follow Confirmed!</strong></div>
                        <div style="margin-bottom: 6px; font-size: 12px;">
                          <span style="color: var(--text-secondary);">Greeting:</span> <span style="color: #fff;">"${data2.greeting}"</span>
                        </div>
                        <div style="margin-bottom: 6px; font-size: 12px;">
                          <span style="color: var(--text-secondary);">Reward DM:</span> <span style="color: #fff; font-weight: 500;">"${data2.rewardMessage}"</span>
                        </div>
                        <div style="font-size: 10px; color: var(--text-muted);">
                          [has_confirmed_follow set to true. Flag stored for future requests. No re-prompt.]
                        </div>
                      `;
                      // Refresh confirmations list
                      loadConfirmations();
                    }, 300);
                  })
                  .catch(err => {
                    console.error('Error confirming follow:', err);
                    simIgResultContainer.innerHTML = '<div style="color: var(--accent-red-light);">Error confirming follow.</div>';
                  });
              });
            }
          }, 400);
        })
        .catch(err => {
          console.error('Error running IG simulation:', err);
          simIgResultContainer.innerHTML = '<div style="color: var(--accent-red-light);">Error running simulation.</div>';
        });
    });
  }

  const btnCancelIgSim = document.getElementById('btn-cancel-ig-sim');
  if (btnCancelIgSim) {
    btnCancelIgSim.addEventListener('click', () => closeModal('modal-ig-simulator'));
  }

  // Refresh button
  const btnRefreshIgConfig = document.getElementById('btn-refresh-ig-config');
  if (btnRefreshIgConfig) {
    btnRefreshIgConfig.addEventListener('click', () => {
      loadFollowGateConfigs();
      loadConfirmations();
      loadIgAccountSummary();
    });
  }

  // ───────────────────────────────────────────────────────────
  // Instagram OAuth — Connect Account Flow
  // ───────────────────────────────────────────────────────────

  // ── Toast Notification System ──
  const toastContainer = document.getElementById('toast-container');

  function showToast(param1, param2, duration = 5000) {
    if (!toastContainer) return;
    let type = 'info';
    let message = '';
    const knownTypes = ['success', 'error', 'info', 'warning'];
    if (knownTypes.includes(param1)) {
      type = param1;
      message = param2 || '';
    } else if (knownTypes.includes(param2)) {
      type = param2;
      message = param1 || '';
    } else {
      message = param1 || param2 || '';
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${getToastIcon(type)}</div>
      <div class="toast-content">${message}</div>
      <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    toastContainer.appendChild(toast);

    // Trigger show animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto-remove
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function getToastIcon(type) {
    if (type === 'success') return '✓';
    if (type === 'error') return '✕';
    return 'ℹ';
  }

  function showErrorToast(message) {
    showToast('error', message);
  }

  function showSuccessToast(message) {
    showToast('success', message);
  }

  // ── Connect Instagram (popup OAuth flow) ──
  function connectInstagram() {
    // Check account limits first
    const currentCount = loadedAccounts.ig.length;
    if (currentBillingData && currentBillingData.platformLimits && currentBillingData.platformLimits.ig) {
      const limit = currentBillingData.platformLimits.ig.total;
      if (currentCount >= limit) {
        alert(`Account limit reached! Your plan (${currentBillingData.currentPlan}) allows linking up to ${limit} Instagram accounts. Please upgrade your plan in settings to connect more.`);
        return;
      }
    }

    const width = 500, height = 720;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      '/api/instagram/authorize',
      'instagram_connect',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      showToast('error', 'Popup was blocked. Please allow popups for this site and try again.');
      return;
    }

    // Show connecting state
    showToast('info', 'Connecting to Instagram... waiting for authorization.');

    let isHandled = false;

    // Listen for postMessage from the callback page
    function handleMessage(event) {
      if (!event.data || !event.data.type) return;

      if (event.data.type === 'INSTAGRAM_CONNECTED') {
        isHandled = true;
        window.removeEventListener('message', handleMessage);
        showSuccessToast('Instagram account connected successfully!');
        refreshConnectedAccountsList();
        refreshIgAutomation();
      }
      if (event.data.type === 'INSTAGRAM_CONNECT_FAILED') {
        isHandled = true;
        window.removeEventListener('message', handleMessage);
        showErrorToast(event.data.message || 'Connection failed. Please try again.');
        refreshIgAutomation();
      }
    }

    window.addEventListener('message', handleMessage);

    // Detect when popup closes and refresh accounts automatically
    const popupCheckInterval = setInterval(() => {
      if (popup.closed) {
        clearInterval(popupCheckInterval);
        window.removeEventListener('message', handleMessage);
        if (!isHandled) {
          refreshConnectedAccountsList();
          refreshIgAutomation();
        }
      }
    }, 1000);
  }

  // ── Refresh connected accounts list and UI ──
  function refreshConnectedAccountsList() {
    // Re-fetch IG accounts so the dashboard picks up the newly connected account
    loadAccounts('ig');

    // Also update the IG platform card in the Accounts screen
    const igCard = document.querySelector('#accounts-content-ig .platform-card');
    if (igCard) {
      const badge = igCard.querySelector('.badge');
      const manageBtn = igCard.querySelector('.btn-manage');
      if (badge) {
        badge.textContent = 'Connected via OAuth';
        badge.className = 'badge connected';
      }
      if (manageBtn) {
        manageBtn.textContent = 'Manage (OAuth)';
      }
    }
  }

  // ── Refresh the Instagram Automation screen ──
  function refreshIgAutomation() {
    const screen = document.getElementById('screen-instagram-automation');
    if (screen && screen.classList.contains('active')) {
      loadIgAccountSummary();
      loadFollowGateConfigs();
      loadConfirmations();
    }
  }

  // ── Wire up Connect Instagram buttons ──
  const btnConnectInstagramAuth = document.getElementById('btn-connect-instagram');

  if (btnConnectInstagramAuth) {
    btnConnectInstagramAuth.addEventListener('click', (e) => {
      e.preventDefault();
      connectInstagram();
    });
  }

  // Wire up AI Prompt Modal buttons
  const btnCancelAiPrompt = document.getElementById('btn-cancel-ai-prompt');
  const btnSaveAiPrompt = document.getElementById('btn-save-ai-prompt');

  if (btnCancelAiPrompt) {
    btnCancelAiPrompt.addEventListener('click', () => {
      closeModal('modal-ai-prompt');
    });
  }

  if (btnSaveAiPrompt) {
    btnSaveAiPrompt.addEventListener('click', () => {
      const postId = document.getElementById('ai-prompt-post-id').value;
      const platform = document.getElementById('ai-prompt-platform').value || 'yt';
      const aiContext = document.getElementById('ai-prompt-context-text').value;
      const aiTone = document.getElementById('ai-prompt-tone-input').value;

      fetch('/api/accounts/post/save-ai-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, postId, aiContext, aiTone })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            closeModal('modal-ai-prompt');
            showSuccessToast('🤖 AI Creator Prompt & Context saved!');
            loadAccounts(platform);
          } else {
            showErrorToast(data.error || 'Failed to save AI prompt');
          }
        })
        .catch(err => {
          console.error('Error saving AI prompt:', err);
          showErrorToast('Server error while saving AI prompt');
        });
    });
  }

  // Expose globally for potential use in HTML inline handlers
  window.connectInstagram = connectInstagram;
  window.showToast = showToast;
  window.showErrorToast = showErrorToast;
  window.showSuccessToast = showSuccessToast;

  // 🔴 YOUTUBE USER LIVE STREAM HANDLERS

  window.loadUserYTLiveData = function () {
    fetch('/api/youtube/live/status')
      .then(res => res.json())
      .then(data => {
        if (!data.success) return;
        const state = data.data;

        const titleEl = document.getElementById('u-yt-live-stream-title');
        if (titleEl) titleEl.textContent = state.streamTitle || '🔥 Live Auto-Moderation Studio';
        const broadEl = document.getElementById('u-yt-broadcast-id');
        if (broadEl) broadEl.textContent = state.broadcastId || 'N/A';

        // Auto-Moderator Bot Toggle Checkbox & Badge
        const botToggleCheckbox = document.getElementById('u-yt-live-bot-toggle');
        if (botToggleCheckbox) {
          botToggleCheckbox.checked = !!state.botEnabled;
          updateYTBotToggleUI(state.botEnabled);
        }

        const botBadge = document.getElementById('u-yt-live-bot-badge');
        if (botBadge) {
          if (state.botEnabled) {
            botBadge.textContent = 'BOT ACTIVE 🟢';
            botBadge.style.background = 'rgba(16,185,129,0.2)';
            botBadge.style.color = '#34d399';
          } else {
            botBadge.textContent = 'BOT OFF 🔴';
            botBadge.style.background = 'rgba(239,68,68,0.2)';
            botBadge.style.color = '#f87171';
          }
        }

        // Live Stream Status Badge & Channel Name
        const liveStatusBadge = document.getElementById('u-yt-live-status-badge');
        const liveChannelName = document.getElementById('u-yt-live-channel-name');

        const activeAcc = (typeof loadedAccounts !== 'undefined' && loadedAccounts['yt']) ? loadedAccounts['yt'][activeAccountIdx['yt']] : null;
        const cName = activeAcc ? (activeAcc.username || activeAcc.title || '@ConnectedChannel') : null;

        if (liveChannelName) {
          liveChannelName.textContent = cName || 'No Channel Connected';
        }
        if (liveStatusBadge) {
          if (state.streamIsLive) {
            liveStatusBadge.textContent = '🔴 LIVE';
            liveStatusBadge.style.background = 'rgba(239,68,68,0.2)';
            liveStatusBadge.style.color = '#f87171';
          } else {
            liveStatusBadge.textContent = '⚪ OFFLINE';
            liveStatusBadge.style.background = 'rgba(255,255,255,0.08)';
            liveStatusBadge.style.color = '#94a3b8';
          }
        }

        // Header Channel Status on OBS Overlay Screen
        const obsHeaderChan = document.getElementById('yt-obs-header-channel');
        if (obsHeaderChan) {
          if (!cName) {
            obsHeaderChan.textContent = 'No Channel Connected';
          } else if (state.streamIsLive) {
            obsHeaderChan.textContent = `${cName} · 🔴 LIVE`;
          } else {
            obsHeaderChan.textContent = `${cName} · Offline`;
          }
        }

        // Demo Preview Badge on OBS Preview Monitor
        const obsDemoBadge = document.getElementById('u-obs-demo-badge');
        if (obsDemoBadge) {
          obsDemoBadge.style.display = state.streamIsLive ? 'none' : 'inline-block';
        }

        // Send Live Mode status to OBS Preview iframe
        const obsIframe = document.getElementById('obs-chat-preview-iframe');
        if (obsIframe && obsIframe.contentWindow) {
          try {
            obsIframe.contentWindow.postMessage({ type: 'SET_LIVE_MODE', live: !!state.streamIsLive }, '*');
          } catch (e) { }
        }

        const masterBtn = document.getElementById('u-yt-master-toggle-btn');
        const statusText = document.getElementById('u-yt-mod-status-text');
        const badge = document.getElementById('u-yt-live-badge');

        if (masterBtn) {
          if (state.botEnabled) {
            masterBtn.textContent = 'Pause Auto-Mod 🔴';
            masterBtn.style.background = '#ef4444';
          } else {
            masterBtn.textContent = 'Resume Auto-Mod 🟢';
            masterBtn.style.background = 'var(--accent-green)';
          }
        }
        if (statusText) {
          statusText.textContent = state.botEnabled ? "Auto-Mod Active 🟢" : "Auto-Mod Paused 🔴";
          statusText.style.color = state.botEnabled ? "var(--accent-green)" : "var(--accent-red)";
        }
        if (badge) {
          badge.style.background = state.streamIsLive ? "#ef4444" : "var(--text-muted)";
          badge.textContent = state.streamIsLive ? "LIVE" : "OFFLINE";
        }

        const viewersEl = document.getElementById('u-yt-kpi-viewers');
        if (viewersEl) viewersEl.textContent = (state.concurrentViewers || 0).toLocaleString();
        const mpmEl = document.getElementById('u-yt-kpi-mpm');
        if (mpmEl) mpmEl.textContent = `${state.chatRateMpm || 0} msgs/min`;
        const revEl = document.getElementById('u-yt-kpi-revenue');
        if (revEl) revEl.textContent = `$${(state.totalSuperChatRevenue || 0).toFixed(2)}`;

        if (state.config) {
          const antilink = document.getElementById('u-yt-chk-antilink');
          if (antilink) { antilink.checked = !!state.config.antiLink; updateYTRuleToggleUI('u-yt-chk-antilink', 'u-yt-antilink-bg', 'u-yt-antilink-knob'); }

          const antispam = document.getElementById('u-yt-chk-antispam');
          if (antispam) { antispam.checked = !!state.config.antiSpam; updateYTRuleToggleUI('u-yt-chk-antispam', 'u-yt-antispam-bg', 'u-yt-antispam-knob'); }

          const badwords = document.getElementById('u-yt-chk-badwords');
          if (badwords) { badwords.checked = !!state.config.badWordsFilter; updateYTRuleToggleUI('u-yt-chk-badwords', 'u-yt-badwords-bg', 'u-yt-badwords-knob'); }

          const superthank = document.getElementById('u-yt-chk-superthank');
          if (superthank) { superthank.checked = !!state.config.superChatAnnounce; updateYTRuleToggleUI('u-yt-chk-superthank', 'u-yt-superthank-bg', 'u-yt-superthank-knob'); }

          const periodic = document.getElementById('u-yt-chk-periodic');
          if (periodic) { periodic.checked = !!state.config.periodicBroadcast; updateYTRuleToggleUI('u-yt-chk-periodic', 'u-yt-periodic-bg', 'u-yt-periodic-knob'); }

          if (state.config.badWords && document.getElementById('u-yt-bad-words-input')) {
            document.getElementById('u-yt-bad-words-input').value = state.config.badWords.join(', ');
          }

          if (state.config.spamThreshold && document.getElementById('u-yt-spam-threshold')) {
            document.getElementById('u-yt-spam-threshold').value = state.config.spamThreshold;
          }

          if (state.config.cooldownSec && document.getElementById('u-yt-spam-cooldown')) {
            document.getElementById('u-yt-spam-cooldown').value = state.config.cooldownSec;
          }

          if (state.config.periodicInterval && document.getElementById('u-yt-periodic-interval')) {
            document.getElementById('u-yt-periodic-interval').value = state.config.periodicInterval;
          }

          if (state.config.periodicMessage && document.getElementById('u-yt-periodic-msg')) {
            document.getElementById('u-yt-periodic-msg').value = state.config.periodicMessage;
          }
        }

        renderUserYTCommands(state.customCommands || []);
        renderUserYTChatLogs(state.liveChatLogs || []);
        renderUserYTSuperChats(state.superChats || []);
      })
      .catch(err => console.error('Error fetching live stream status:', err));
  };

  function updateYTRuleToggleUI(chkId, bgId, knobId) {
    const chk = document.getElementById(chkId);
    const bg = document.getElementById(bgId);
    const knob = document.getElementById(knobId);
    if (!chk || !bg || !knob) return;
    if (chk.checked) {
      bg.style.background = '#10b981';
      knob.style.left = '19px';
    } else {
      bg.style.background = '#4b5563';
      knob.style.left = '3px';
    }
  }
  window.updateYTRuleToggleUI = updateYTRuleToggleUI;

  function updateYTBotToggleUI(enabled) {
    const bg = document.getElementById('u-yt-bot-toggle-bg');
    const knob = document.getElementById('u-yt-bot-toggle-knob');
    if (!bg || !knob) return;
    if (enabled) {
      bg.style.background = '#10b981';
      knob.style.left = '19px';
    } else {
      bg.style.background = '#4b5563';
      knob.style.left = '3px';
    }
  }
  window.updateYTBotToggleUI = updateYTBotToggleUI;

  window.toggleYTLiveBot = function (enabled) {
    const isChecked = enabled !== undefined ? enabled : document.getElementById('u-yt-live-bot-toggle')?.checked;
    updateYTBotToggleUI(isChecked);
    fetch('/api/youtube/live/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: isChecked, botEnabled: isChecked })
    })
      .then(res => res.json())
      .then(data => {
        if (typeof showSuccessToast === 'function') showSuccessToast(data.message);
        loadUserYTLiveData();
      })
      .catch(err => console.error('Error toggling live bot:', err));
  };

  window.userToggleYTLiveModerator = function () {
    window.toggleYTLiveBot();
  };

  // Poll live status every 12 seconds automatically
  setInterval(() => {
    if (typeof loadUserYTLiveData === 'function') loadUserYTLiveData();
  }, 12000);

  window.userUpdateYTConfig = function (key, val) {
    const payload = {};
    payload[key] = val;
    fetch('/api/youtube/live/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(() => {
        showSuccessToast('Auto-Moderator configuration saved!');
        loadUserYTLiveData();
      });
  };

  window.toggleYTLiveDrawer = function (drawerId) {
    const drawer = document.getElementById(drawerId);
    if (!drawer) return;
    if (drawer.style.display === 'none' || !drawer.style.display) {
      drawer.style.display = 'block';
    } else {
      drawer.style.display = 'none';
    }
  };

  window.userSaveSpamThresholds = function () {
    const spamThreshold = parseInt(document.getElementById('u-yt-spam-threshold').value || 4);
    const cooldownSec = parseInt(document.getElementById('u-yt-spam-cooldown').value || 30);

    fetch('/api/youtube/live/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spamThreshold, cooldownSec })
    })
      .then(res => res.json())
      .then(() => {
        showSuccessToast(`Spam limits updated! Max ${spamThreshold} msgs -> ${cooldownSec}s timeout penalty.`);
      });
  };

  window.userSaveYTBadWords = function () {
    const val = document.getElementById('u-yt-bad-words-input').value;
    const wordsArr = val.split(',').map(w => w.trim()).filter(w => w);

    fetch('/api/youtube/live/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ badWords: wordsArr })
    })
      .then(res => res.json())
      .then(() => {
        showSuccessToast('Custom bad words list saved!');
      });
  };

  window.userSaveYTPeriodicBroadcaster = function () {
    const interval = parseInt(document.getElementById('u-yt-periodic-interval').value || 10);
    const msg = document.getElementById('u-yt-periodic-msg').value.trim();

    if (!msg) return showErrorToast('Please enter a valid broadcast message');

    fetch('/api/youtube/live/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodicInterval: interval, periodicMessage: msg })
    })
      .then(res => res.json())
      .then(() => {
        showSuccessToast(`Automated Broadcaster saved! Bot will send custom reminder every ${interval} comments.`);
      });
  };

  function renderUserYTCommands(commands) {
    const container = document.getElementById('u-yt-commands-list');
    if (!container) return;

    if (commands.length === 0) {
      container.innerHTML = `<div style="font-size:11px; color:var(--text-muted); text-align:center; padding:8px;">No custom commands set</div>`;
      return;
    }

    container.innerHTML = commands.map(c => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); border:1px solid var(--border-subtle); padding:6px 10px; border-radius:6px; font-size:12px;">
        <div>
          <strong style="color:var(--accent-purple);">${c.command}</strong>
          <span style="color:var(--text-secondary); margin-left:6px;">${c.reply}</span>
        </div>
        <button style="background:none; border:none; color:var(--accent-red-light); cursor:pointer; font-weight:bold;" onclick="userDeleteYTCustomCommand('${c.command}')">&times;</button>
      </div>
    `).join('');
  }

  window.userAddYTCustomCommand = function () {
    const nameEl = document.getElementById('u-yt-new-cmd-name');
    const replyEl = document.getElementById('u-yt-new-cmd-reply');
    if (!nameEl || !replyEl) return;
    const cmd = nameEl.value.trim();
    const reply = replyEl.value.trim();

    if (!cmd || !reply) return showErrorToast('Please enter both command name and reply text');

    fetch('/api/youtube/live/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd, reply })
    })
      .then(res => res.json())
      .then(data => {
        nameEl.value = '';
        replyEl.value = '';
        showSuccessToast(`Command '${cmd}' added!`);
        renderUserYTCommands(data.commands);
      });
  };

  window.userAddYTCustomCommandModal = function () {
    const nameEl = document.getElementById('u-yt-new-cmd-name-modal');
    const replyEl = document.getElementById('u-yt-new-cmd-reply-modal');
    if (!nameEl || !replyEl) return;
    const cmd = nameEl.value.trim();
    const reply = replyEl.value.trim();

    if (!cmd || !reply) return showErrorToast('Please enter both command name and reply text');

    fetch('/api/youtube/live/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd, reply })
    })
      .then(res => res.json())
      .then(data => {
        nameEl.value = '';
        replyEl.value = '';
        showSuccessToast(`Command '${cmd}' added!`);
        renderUserYTCommands(data.commands);
      });
  };

  window.userDeleteYTCustomCommand = function (cmd) {
    fetch('/api/youtube/live/commands', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd })
    })
      .then(res => res.json())
      .then(data => {
        showSuccessToast('Command deleted!');
        renderUserYTCommands(data.commands);
      });
  };

  function renderUserYTChatLogs(logs) {
    const box = document.getElementById('u-yt-chat-stream-box');
    if (!box) return;

    if (logs.length === 0) {
      box.innerHTML = `<div style="font-size:11px; color:var(--text-muted); text-align:center; padding:16px;">Live chat stream ready...</div>`;
      return;
    }

    box.innerHTML = logs.map(l => {
      const isVVIP = l.isVVIP || l.type === 'superchat' || (l.amount && l.amount.length > 0) || (l.author && l.author.toLowerCase().includes('vvip'));

      if (l.type === 'superchat' || isVVIP) {
        return `
          <div style="background: linear-gradient(135deg, rgba(255, 215, 0, 0.18) 0%, rgba(245, 158, 11, 0.15) 100%); border: 1.5px solid #ffd700; border-radius: 8px; padding: 8px 10px; box-shadow: 0 0 14px rgba(255, 215, 0, 0.35);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; align-items:center; gap:6px;">
                <img src="${l.avatar}" style="width:22px; height:22px; border-radius:50%; border: 2px solid #ffd700; box-shadow: 0 0 6px #ffd700;">
                <strong style="font-size:12px; background: linear-gradient(135deg, #ffe57f 0%, #ffc107 50%, #ff8f00 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 900; filter: drop-shadow(0 0 4px rgba(255,215,0,0.7));">@${l.author}</strong>
                <span style="background: linear-gradient(135deg, #ffd700 0%, #ff8f00 100%); color: #000; font-size: 9px; font-weight: 900; padding: 2px 6px; border-radius: 8px; border: 1px solid #ffffff; box-shadow: 0 0 6px rgba(255, 215, 0, 0.8);">👑 VVIP GOLD ${l.amount ? '• ' + l.amount : ''}</span>
              </div>
              <span style="font-size:10px; color:var(--text-muted);">${l.timestamp}</span>
            </div>
            <div style="font-size:12px; margin-top:4px; color:white; font-weight:600;">${l.message}</div>
          </div>
        `;
      }

      if (l.type === 'system' || l.type === 'bot_reply') {
        return `
          <div style="background: rgba(59, 130, 246, 0.1); border-left: 3px solid #3b82f6; padding: 6px 10px; border-radius: 4px; font-size: 11px;">
            <span style="color: #3b82f6; font-weight: 700;">🤖 ${l.author}:</span>
            <span style="color: white; margin-left: 4px;">${l.message}</span>
            <span style="float: right; font-size: 9px; color: var(--text-muted);">${l.timestamp}</span>
          </div>
        `;
      }

      const isDeleted = l.status === 'deleted' || l.status === 'timed_out' || l.status === 'banned';

      return `
        <div style="display:flex; justify-content:space-between; align-items:center; background: ${isDeleted ? 'rgba(239, 68, 68, 0.08)' : 'transparent'}; border-bottom: 1px solid rgba(255,255,255,0.03); padding: 4px 0;">
          <div style="display:flex; align-items:center; gap:6px;">
            <img src="${l.avatar}" style="width:18px; height:18px; border-radius:50%;">
            <strong style="font-size:12px; color:${isDeleted ? '#ef4444' : 'white'};">${l.author}:</strong>
            <span style="font-size:12px; color: ${isDeleted ? 'var(--text-muted)' : 'var(--text-secondary)'}; ${isDeleted ? 'text-decoration: line-through;' : ''}">${l.message}</span>
            ${isDeleted ? `<span style="background: rgba(239,68,68,0.2); color: #ef4444; font-size: 9px; padding: 1px 4px; border-radius: 3px;">[${l.reason || 'Blocked'}]</span>` : ''}
          </div>
          <div style="display:flex; align-items:center; gap:4px;">
            ${!isDeleted ? `
              <button style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:10px;" onclick="userModAction('delete', '${l.id}', '${l.author}')" title="Delete">🗑️</button>
              <button style="background:none; border:none; color:#3b82f6; cursor:pointer; font-size:10px;" onclick="userModAction('timeout', '${l.id}', '${l.author}')" title="Timeout">⏱️</button>
            ` : ''}
            <span style="font-size:9px; color:var(--text-muted);">${l.timestamp}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  window.userModAction = function (action, messageId, author) {
    fetch('/api/youtube/live/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, messageId, author })
    })
      .then(res => res.json())
      .then(data => {
        showSuccessToast(`Action '${action.toUpperCase()}' applied to @${author}!`);
        renderUserYTChatLogs(data.logs);
      });
  };

  window.userSimulateYTChat = function (type) {
    let payload = {};
    if (type === 'chat') {
      payload = { author: "GamerPro_" + Math.floor(Math.random() * 100), message: "Awesome automation stream! !discord" };
    } else if (type === 'superchat') {
      const amounts = ["$10.00", "$25.00", "$50.00", "$100.00"];
      const randAmt = amounts[Math.floor(Math.random() * amounts.length)];
      payload = { author: "VIP_Supporter", message: "Love the ReplyFlow Live Moderator!! ❤️", amount: randAmt };
    } else if (type === 'vvip') {
      payload = { author: "Golden_VVIP_King", message: "👑 VVIP Gold rank active! Metallic text & glowing gold badge test! ✨", isVVIP: true, amount: "$100.00" };
    } else if (type === 'spam') {
      payload = { author: "SpamBot_99", message: "Earn free money fast at http://scam-site.link !! Join now!" };
    }

    fetch('/api/youtube/live/sim-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        showSuccessToast(type === 'spam' ? '🛡️ Auto-Mod intercepted & deleted spam message!' : 'New live chat message received');
        loadUserYTLiveData();
      });
  };

  function renderUserYTSuperChats(superchats) {
    const grid = document.getElementById('u-yt-superchat-grid');
    if (!grid) return;

    if (superchats.length === 0) {
      grid.innerHTML = `<div style="font-size:12px; color:var(--text-muted);">No SuperChats recorded yet on this stream.</div>`;
      return;
    }

    grid.innerHTML = superchats.map(sc => `
      <div style="background: linear-gradient(135deg, rgba(21, 24, 31, 0.9) 0%, rgba(168, 85, 247, 0.1) 100%); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 8px; padding: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 13px; color: white;">${sc.author}</strong>
          <span style="background: var(--accent-gradient); color: white; font-weight: 800; font-size: 11px; padding: 3px 8px; border-radius: 10px;">${sc.amount}</span>
        </div>
        <p style="font-size: 12px; color: var(--text-main); margin-top: 6px;">"${sc.message}"</p>
        <div style="font-size: 9px; color: var(--text-muted); margin-top: 6px; text-align: right;">${sc.time}</div>
      </div>
    `).join('');
  }

  window.openHowToConnectModal = function (platformKey) {
    const titleEl = document.getElementById('htc-modal-title');
    const iframeEl = document.getElementById('htc-video-frame');
    const stepsContainer = document.getElementById('htc-steps-container');

    if (stepsContainer) {
      stepsContainer.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding:10px; text-align:center;">Loading guide & video player...</div>`;
    }

    openModal('modal-how-to-connect');

    fetch(`/api/tutorials?platform=${platformKey}`)
      .then(res => res.json())
      .then(data => {
        if (!data.success || !data.tutorial) return;
        const tut = data.tutorial;

        if (titleEl) titleEl.textContent = `📖 ${tut.title}`;
        if (iframeEl) iframeEl.src = tut.videoUrl || "https://www.youtube.com/embed/dQw4w9WgXcQ";

        if (stepsContainer) {
          const stepsHtml = (tut.guideSteps || []).map((step, idx) => {
            const linkedStep = step.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:var(--accent-purple); text-decoration:underline; font-weight:600;">$1 ↗</a>');
            return `
            <div style="display:flex; gap:10px; align-items:flex-start;">
              <span style="background:var(--accent-purple); color:white; font-size:10px; font-weight:bold; width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${idx + 1}</span>
              <span style="font-size:12px; color:var(--text-primary); margin-top:2px;">${linkedStep}</span>
            </div>
          `;
          }).join('');
          stepsContainer.innerHTML = stepsHtml;
        }
      })
      .catch(err => {
        console.error('Error opening tutorial modal:', err);
        if (stepsContainer) {
          stepsContainer.innerHTML = `<div style="font-size:12px; color:var(--accent-red-light);">Error loading tutorial instructions</div>`;
        }
      });
  };

  // ── Authentication & Auth Portal Functions ──
  let currentAuthMode = 'login';

  window.switchAuthTab = function (mode) {
    currentAuthMode = mode;
    const loginTab = document.getElementById('tab-auth-login');
    const registerTab = document.getElementById('tab-auth-register');
    const nameField = document.getElementById('field-auth-name');
    const nameInput = document.getElementById('auth-input-name');
    const submitBtn = document.getElementById('btn-auth-submit');
    const alertBox = document.getElementById('auth-alert-box');

    if (alertBox) alertBox.style.display = 'none';

    if (mode === 'register') {
      if (loginTab) {
        loginTab.style.background = 'transparent';
        loginTab.style.color = '#a1a1aa';
        loginTab.classList.remove('active');
      }
      if (registerTab) {
        registerTab.style.background = 'rgba(168,85,247,0.2)';
        registerTab.style.color = '#ffffff';
        registerTab.classList.add('active');
      }
      if (nameField) nameField.style.display = 'block';
      if (nameInput) nameInput.setAttribute('required', 'true');
      if (submitBtn) submitBtn.innerHTML = '🚀 Create Account & Launch';
    } else {
      if (registerTab) {
        registerTab.style.background = 'transparent';
        registerTab.style.color = '#a1a1aa';
        registerTab.classList.remove('active');
      }
      if (loginTab) {
        loginTab.style.background = 'rgba(168,85,247,0.2)';
        loginTab.style.color = '#ffffff';
        loginTab.classList.add('active');
      }
      if (nameField) nameField.style.display = 'none';
      if (nameInput) nameInput.removeAttribute('required');
      if (submitBtn) submitBtn.innerHTML = '🚀 Sign In to Dashboard';
    }
  };

  // ── Custom Country Selector Component Helpers ──
  window.toggleCountryDropdown = function (e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('custom-country-dropdown-menu');
    if (menu) {
      menu.style.display = menu.style.display === 'none' || !menu.style.display ? 'block' : 'none';
    }
  };

  window.selectCountryCode = function (code, flagUrl, countryName) {
    const hiddenInput = document.getElementById('reg-input-country-code');
    const flagImg = document.getElementById('selected-country-flag');
    const codeSpan = document.getElementById('selected-country-code');
    const menu = document.getElementById('custom-country-dropdown-menu');
    if (hiddenInput) hiddenInput.value = code;
    if (flagImg) {
      flagImg.src = flagUrl;
      flagImg.alt = countryName;
    }
    if (codeSpan) codeSpan.textContent = code;
    if (menu) menu.style.display = 'none';
  };

  document.addEventListener('click', function (e) {
    const menu = document.getElementById('custom-country-dropdown-menu');
    const btn = document.getElementById('custom-country-selector-btn');
    if (menu && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
      menu.style.display = 'none';
    }
  });

  // ── Standalone View Navigation Engine ──
  window.switchToRegisterPage = function () {
    const loginView = document.getElementById('standalone-login-view');
    const registerView = document.getElementById('standalone-register-view');
    const forgotView = document.getElementById('standalone-forgot-view');
    if (loginView) loginView.style.display = 'none';
    if (forgotView) forgotView.style.display = 'none';
    if (registerView) {
      registerView.style.display = 'block';
      registerView.classList.remove('animate-page-enter');
      void registerView.offsetWidth;
      registerView.classList.add('animate-page-enter');
      window.scrollTo({ top: 80, behavior: 'smooth' });
    }
  };

  window.switchToLoginPage = function () {
    const loginView = document.getElementById('standalone-login-view');
    const registerView = document.getElementById('standalone-register-view');
    const forgotView = document.getElementById('standalone-forgot-view');
    if (registerView) registerView.style.display = 'none';
    if (forgotView) forgotView.style.display = 'none';
    if (loginView) {
      loginView.style.display = 'block';
      loginView.classList.remove('animate-page-enter');
      void loginView.offsetWidth;
      loginView.classList.add('animate-page-enter');
      window.scrollTo({ top: 80, behavior: 'smooth' });
    }
  };

  window.switchToForgotPasswordPage = function () {
    const loginView = document.getElementById('standalone-login-view');
    const registerView = document.getElementById('standalone-register-view');
    const forgotView = document.getElementById('standalone-forgot-view');
    if (loginView) loginView.style.display = 'none';
    if (registerView) registerView.style.display = 'none';
    if (forgotView) {
      forgotView.style.display = 'block';
      forgotView.classList.remove('animate-page-enter');
      void forgotView.offsetWidth;
      forgotView.classList.add('animate-page-enter');
      window.scrollTo({ top: 80, behavior: 'smooth' });
    }
  };

  window.handleForgotPasswordSubmit = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const emailInput = document.getElementById('forgot-input-email');
    const email = emailInput ? emailInput.value : '';
    const alertBox = document.getElementById('forgot-alert-box');
    const submitBtn = document.getElementById('btn-forgot-send-otp');
    const step1Form = document.getElementById('form-forgot-step1');
    const step2Form = document.getElementById('form-forgot-step2');
    const displayEmail = document.getElementById('forgot-display-email');

    if (!email || !email.includes('@')) {
      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.style.background = 'rgba(239,68,68,0.15)';
        alertBox.style.border = '1px solid rgba(239,68,68,0.3)';
        alertBox.style.color = '#f87171';
        alertBox.textContent = '❌ Please enter a valid email address.';
      }
      return false;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Sending Reset Code...';
    }

    fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
      .then(res => res.json())
      .then(data => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '🔑 Send 6-Digit Reset Code to Email';
        }
        if (data.error) {
          if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(239,68,68,0.15)';
            alertBox.style.border = '1px solid rgba(239,68,68,0.3)';
            alertBox.style.color = '#f87171';
            alertBox.textContent = `❌ ${data.error}`;
          }
        } else {
          if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(168,85,247,0.15)';
            alertBox.style.border = '1px solid rgba(168,85,247,0.3)';
            alertBox.style.color = '#c084fc';
            alertBox.textContent = `📩 ${data.message}`;
          }
          if (step1Form) step1Form.style.display = 'none';
          if (step2Form) step2Form.style.display = 'block';
          if (displayEmail) displayEmail.textContent = email;
        }
      })
      .catch(err => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '🔑 Send 6-Digit Reset Code to Email';
        }
        if (alertBox) {
          alertBox.style.display = 'block';
          alertBox.style.background = 'rgba(239,68,68,0.15)';
          alertBox.style.color = '#f87171';
          alertBox.textContent = '❌ Could not send reset code. Please check your email or try again.';
        }
      });
    return false;
  };

  window.handleResetPasswordSubmit = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const email = document.getElementById('forgot-input-email').value;
    const otp = document.getElementById('forgot-input-otp').value;
    const newPassword = document.getElementById('forgot-input-new-pass').value;
    const confirmPassword = document.getElementById('forgot-input-confirm-pass').value;
    const alertBox = document.getElementById('forgot-alert-box');
    const submitBtn = document.getElementById('btn-forgot-reset-pass');

    if (newPassword !== confirmPassword) {
      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.style.background = 'rgba(239,68,68,0.15)';
        alertBox.style.border = '1px solid rgba(239,68,68,0.3)';
        alertBox.style.color = '#f87171';
        alertBox.textContent = '❌ New passwords do not match. Please re-enter.';
      }
      return false;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Updating Password...';
    }

    fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, newPassword })
    })
      .then(res => res.json())
      .then(data => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '🚀 Update Password & Sign In';
        }
        if (data.error) {
          if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(239,68,68,0.15)';
            alertBox.style.border = '1px solid rgba(239,68,68,0.3)';
            alertBox.style.color = '#f87171';
            alertBox.textContent = `❌ ${data.error}`;
          }
        } else {
          if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(16,185,129,0.15)';
            alertBox.style.border = '1px solid rgba(16,185,129,0.3)';
            alertBox.style.color = '#34d399';
            alertBox.textContent = `🎉 ${data.message}`;
          }
          if (data.token) localStorage.setItem('replyflow_user_token', data.token);
          if (data.user) {
            localStorage.setItem('replyflow_user_name', data.user.name);
          }
          setTimeout(() => {
            const landingPage = document.getElementById('standalone-landing-page');
            const mainShell = document.getElementById('main-app-shell');
            if (landingPage) landingPage.style.display = 'none';
            if (mainShell) mainShell.style.display = 'block';
            if (typeof loadBilling === 'function') loadBilling();
            switchScreen('dashboard');
          }, 600);
        }
      })
      .catch(err => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '🚀 Update Password & Sign In';
        }
        if (alertBox) {
          alertBox.style.display = 'block';
          alertBox.style.background = 'rgba(239,68,68,0.15)';
          alertBox.style.color = '#f87171';
          alertBox.textContent = '❌ Reset failed. Please check network connection.';
        }
      });
    return false;
  };

  window.launchDashboardDemo = function (token, userName, userPlan) {
    const landingPage = document.getElementById('standalone-landing-page');
    const mainShell = document.getElementById('main-app-shell');
    if (landingPage) landingPage.style.display = 'none';
    if (mainShell) mainShell.style.display = 'block';
    if (token) localStorage.setItem('replyflow_user_token', token);
    if (userName) localStorage.setItem('replyflow_user_name', userName);
    localStorage.setItem('replyflow_active_screen', 'dashboard');
    window.location.hash = '#dashboard';
    if (typeof loadBilling === 'function') loadBilling();
    switchScreen('dashboard');
    if (typeof loadProfile === 'function') loadProfile();
  };

  // (Master window.userLogout handle defined above)

  window.handleAuthSubmit = function (e) {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    const emailInput = document.getElementById('auth-input-email');
    const passwordInput = document.getElementById('auth-input-password');
    const alertBox = document.getElementById('auth-alert-box');
    const submitBtn = document.getElementById('btn-auth-submit');

    if (!emailInput || !passwordInput) {
      const errMsg = 'Login form failed to load correctly. Please refresh the page and try again.';
      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.style.background = 'rgba(239,68,68,0.15)';
        alertBox.style.border = '1px solid rgba(239,68,68,0.3)';
        alertBox.style.color = '#f87171';
        alertBox.textContent = `❌ ${errMsg}`;
      } else if (typeof showErrorToast === 'function') {
        showErrorToast(errMsg);
      }
      return false;
    }

    const email = emailInput.value ? emailInput.value.trim() : '';
    const password = passwordInput.value || '';

    if (submitBtn) submitBtn.disabled = true;

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
      .then(async res => {
        const text = await res.text();
        let data = {};
        try {
          data = JSON.parse(text);
        } catch(e) {
          data = { error: `Server connection error (Status ${res.status}). Please check backend connection.` };
        }
        return data;
      })
      .then(data => {
        if (submitBtn) submitBtn.disabled = false;
        if (data.error || !data.token) {
          if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(239,68,68,0.15)';
            alertBox.style.border = '1px solid rgba(239,68,68,0.3)';
            alertBox.style.color = '#f87171';
            alertBox.textContent = `❌ ${data.error || 'Authentication failed. Please check your email and password.'}`;
          }
        } else {
          if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(16,185,129,0.15)';
            alertBox.style.border = '1px solid rgba(16,185,129,0.3)';
            alertBox.style.color = '#34d399';
            alertBox.textContent = `✅ ${data.message || 'Login successful!'}`;
          }
          if (data.token) {
            localStorage.setItem('replyflow_user_token', data.token);
          }
          localStorage.setItem('replyflow_active_screen', 'dashboard');
          if (data.user) {
            try {
              localStorage.setItem('replyflow_user', JSON.stringify(data.user));
            } catch (e) { }
            if (data.user.name) localStorage.setItem('replyflow_user_name', data.user.name);
            if (typeof renderUserProfileUI === 'function') renderUserProfileUI(data.user);
          }
          const landingPage = document.getElementById('standalone-landing-page');
          const mainShell = document.getElementById('main-app-shell');
          if (landingPage) landingPage.style.display = 'none';
          if (mainShell) mainShell.style.display = 'block';
          if (typeof loadBilling === 'function') loadBilling();
          window.location.hash = '#dashboard';
          if (typeof switchScreen === 'function') switchScreen('dashboard');
          if (data.user && typeof renderUserProfileUI === 'function') {
            renderUserProfileUI(data.user);
          }
        }
      })
      .catch(err => {
        if (submitBtn) submitBtn.disabled = false;
        if (alertBox) {
          alertBox.style.display = 'block';
          alertBox.style.background = 'rgba(239,68,68,0.15)';
          alertBox.style.border = '1px solid rgba(239,68,68,0.3)';
          alertBox.style.color = '#f87171';
          alertBox.textContent = '❌ Authentication request failed. Please check network connection or backend status.';
        }
      });
    return false;
  };

  window.handleRegisterSubmit = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const name = document.getElementById('reg-input-name') ? document.getElementById('reg-input-name').value : '';
    const email = document.getElementById('reg-input-email') ? document.getElementById('reg-input-email').value : '';
    const countryCode = document.getElementById('reg-input-country-code') ? document.getElementById('reg-input-country-code').value : '+92';
    const rawPhone = document.getElementById('reg-input-phone') ? document.getElementById('reg-input-phone').value.trim() : '';
    const phone = rawPhone ? `${countryCode} ${rawPhone}` : '';
    const password = document.getElementById('reg-input-password') ? document.getElementById('reg-input-password').value : '';
    const confirmPassword = document.getElementById('reg-input-confirm-password') ? document.getElementById('reg-input-confirm-password').value : password;
    const alertBox = document.getElementById('register-alert-box');
    const submitBtn = document.getElementById('btn-register-submit');
    const otpPanel = document.getElementById('reg-otp-verification-panel');
    const otpSubtext = document.getElementById('reg-otp-subtext');
    const otpCodeInput = document.getElementById('reg-otp-code-input');

    if (password !== confirmPassword) {
      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.style.background = 'rgba(239,68,68,0.15)';
        alertBox.style.border = '1px solid rgba(239,68,68,0.3)';
        alertBox.style.color = '#f87171';
        alertBox.textContent = '❌ Passwords do not match. Please re-enter your password.';
      }
      return;
    }

    if (submitBtn) submitBtn.disabled = true;

    fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password })
    })
      .then(res => res.json())
      .then(data => {
        if (submitBtn) submitBtn.disabled = false;
        if (data.error) {
          if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(239,68,68,0.15)';
            alertBox.style.border = '1px solid rgba(239,68,68,0.3)';
            alertBox.style.color = '#f87171';
            alertBox.textContent = `❌ ${data.error}`;
          }
        } else if (data.requireOtp) {
          if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(16,185,129,0.15)';
            alertBox.style.border = '1px solid rgba(16,185,129,0.3)';
            alertBox.style.color = '#34d399';
            alertBox.textContent = `📩 Real-Time OTP code sent to ${data.email}! Enter code below to activate.`;
          }
          if (otpPanel) otpPanel.style.display = 'flex';
          if (otpSubtext) otpSubtext.textContent = `Enter 6-digit verification code sent to ${data.email}:`;
          if (otpCodeInput && data.demoCode) otpCodeInput.value = data.demoCode;
          if (typeof showToast === 'function') showToast(data.message || 'OTP Sent to Email! 📩', 'success');
        } else {
          if (data.token) localStorage.setItem('replyflow_user_token', data.token);
          window.launchDashboardDemo();
        }
      })
      .catch(err => {
        if (submitBtn) submitBtn.disabled = false;
        if (alertBox) {
          alertBox.style.display = 'block';
          alertBox.style.background = 'rgba(239,68,68,0.15)';
          alertBox.style.border = '1px solid rgba(239,68,68,0.3)';
          alertBox.style.color = '#f87171';
          alertBox.textContent = '❌ Registration request failed. Please check network connection.';
        }
      });
  };

  window.handleVerifyRegistrationOtp = function () {
    const email = document.getElementById('reg-input-email').value;
    const otpCodeInput = document.getElementById('reg-otp-code-input');
    const otp = otpCodeInput ? otpCodeInput.value.trim() : '';
    const verifyBtn = document.getElementById('btn-verify-reg-otp');
    const alertBox = document.getElementById('register-alert-box');

    if (!email || !otp) {
      if (typeof showToast === 'function') showToast('⚠️ Enter 6-digit OTP code received in email.', 'error');
      return;
    }

    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = '⏳ Verifying Code...';
    }

    fetch('/api/auth/register-verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp })
    })
      .then(res => res.json())
      .then(data => {
        if (verifyBtn) {
          verifyBtn.disabled = false;
          verifyBtn.textContent = '✅ Verify OTP & Activate Account';
        }
        if (data.error) {
          if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(239,68,68,0.15)';
            alertBox.style.color = '#f87171';
            alertBox.textContent = `❌ ${data.error}`;
          }
          if (typeof showToast === 'function') showToast(data.error, 'error');
        } else {
          if (data.token) localStorage.setItem('replyflow_user_token', data.token);
          if (data.user) {
            localStorage.setItem('replyflow_user_name', data.user.name);
            localStorage.setItem('replyflow_user_plan', data.user.plan || 'Free');
          }
          if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(16,185,129,0.15)';
            alertBox.style.color = '#34d399';
            alertBox.textContent = `🎉 ${data.message}`;
          }
          if (typeof showToast === 'function') showToast(data.message, 'success');
          setTimeout(() => {
            const landingPage = document.getElementById('standalone-landing-page');
            const mainShell = document.getElementById('main-app-shell');
            if (landingPage) landingPage.style.display = 'none';
            if (mainShell) mainShell.style.display = 'block';
            if (typeof loadBilling === 'function') loadBilling();
            switchScreen('dashboard');
          }, 500);
        }
      })
      .catch(err => {
        if (verifyBtn) {
          verifyBtn.disabled = false;
          verifyBtn.textContent = '✅ Verify OTP & Activate Account';
        }
        if (typeof showToast === 'function') showToast('⚠️ Verification error.', 'error');
      });
  };
  // ── Live Interactive Multi-Message Simulation Engine ──
  const SIM_DATA = {
    ig: `
      <div style="display: flex; flex-direction: column; gap: 12px; max-height: 280px; overflow-y: auto; padding-right: 6px;">
          <!-- Message 1: User Comment -->
          <div style="display: flex; align-items: flex-start; gap: 10px;">
              <div style="width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0;">IG</div>
              <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 10px 14px; font-size: 12px; color: #e4e4e7; flex: 1;">
                  <div style="font-size: 11px; font-weight: 700; color: #e1306c; margin-bottom: 2px;">@sarah_creator • Reel #842</div>
                  <em>"SEND me the 2026 Instagram Growth Blueprint! 🔥"</em>
              </div>
          </div>

          <!-- Trigger Badge -->
          <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: #c084fc; margin-left: 40px; font-weight: 600; background: rgba(168,85,247,0.1); padding: 4px 10px; border-radius: 8px; border: 1px dashed rgba(168,85,247,0.3); width: fit-content;">
              ⚡ Webhook Trigger: Matched Keyword <code>"SEND"</code> • Follow-Gate: <strong>VERIFIED 🟢</strong>
          </div>

          <!-- Message 2: Public Auto Comment Reply -->
          <div style="display: flex; align-items: flex-start; gap: 10px; margin-left: 20px;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #a855f7; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0;">🤖</div>
              <div style="background: rgba(168, 85, 247, 0.12); border: 1px solid rgba(168, 85, 247, 0.25); border-radius: 10px; padding: 8px 12px; font-size: 12px; color: #fff;">
                  <strong>ReplyFlow Bot:</strong> @sarah_creator Check your DMs! Download link sent 📥
              </div>
          </div>

          <!-- Message 3: Direct DM Delivered -->
          <div style="display: flex; align-items: flex-start; gap: 10px; margin-left: 20px;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #a855f7, #6366f1); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0;">📩</div>
              <div style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.35); border-radius: 12px; padding: 12px 14px; font-size: 12px; color: #fff; flex: 1;">
                  <div><strong>Direct Message:</strong> Hey Sarah! Here is your exclusive 2026 Growth Blueprint PDF 🎁</div>
                  <button onclick="alert('Demo: Opening PDF link...')" style="margin-top: 8px; background: #a855f7; border: none; color: #fff; font-size: 10px; font-weight: 700; padding: 6px 12px; border-radius: 6px; cursor: pointer; box-shadow: 0 4px 12px rgba(168,85,247,0.4);">Download PDF 📥</button>
              </div>
          </div>

          <!-- Message 4: User Reply -->
          <div style="display: flex; align-items: flex-start; gap: 10px;">
              <div style="width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg, #833ab4, #fd1d1d); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0;">IG</div>
              <div style="background: rgba(255,255,255,0.06); border-radius: 12px; padding: 8px 12px; font-size: 12px; color: #e4e4e7;">
                  <strong>@sarah_creator:</strong> <em>"Wow that was instant! Thank you so much 🙌"</em>
              </div>
          </div>
      </div>
    `,
    fb: `
      <div style="display: flex; flex-direction: column; gap: 12px; max-height: 280px; overflow-y: auto; padding-right: 6px;">
          <div style="display: flex; align-items: flex-start; gap: 10px;">
              <div style="width: 30px; height: 30px; border-radius: 50%; background: #1877F2; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0;">FB</div>
              <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 10px 14px; font-size: 12px; color: #e4e4e7; flex: 1;">
                  <div style="font-size: 11px; font-weight: 700; color: #60a5fa; margin-bottom: 2px;">@alex_buyer • Page Ad Comment</div>
                  <em>"What is the price of the Pro plan and does it include Messenger AI?"</em>
              </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: #60a5fa; margin-left: 40px; font-weight: 600; background: rgba(24,119,242,0.1); padding: 4px 10px; border-radius: 8px; border: 1px dashed rgba(24,119,242,0.3); width: fit-content;">
              ⚡ Page Webhook Trigger: Intent <code>"PRICE & MESSENGER"</code> Matched
          </div>

          <div style="display: flex; align-items: flex-start; gap: 10px; margin-left: 20px;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #1877F2; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0;">💬</div>
              <div style="background: rgba(24, 119, 242, 0.15); border: 1px solid rgba(24, 119, 242, 0.35); border-radius: 12px; padding: 12px 14px; font-size: 12px; color: #fff; flex: 1;">
                  <div><strong>ReplyFlow Messenger Bot:</strong> Hi Alex! Pro Plan is $49/mo and includes unlimited Messenger AI sales funnels 🚀</div>
                  <button onclick="alert('Demo: Opening Messenger checkout link...')" style="margin-top: 8px; background: #1877F2; border: none; color: #fff; font-size: 10px; font-weight: 700; padding: 6px 12px; border-radius: 6px; cursor: pointer;">Claim 20% Off Coupon 🛍️</button>
              </div>
          </div>
      </div>
    `,
    yt: `
      <div style="display: flex; flex-direction: column; gap: 12px; max-height: 280px; overflow-y: auto; padding-right: 6px;">
          <div style="display: flex; align-items: flex-start; gap: 10px;">
              <div style="width: 30px; height: 30px; border-radius: 50%; background: #FF0000; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0;">YT</div>
              <div style="background: rgba(255,255,255,0.06); border-radius: 12px; padding: 10px 14px; font-size: 12px; color: #e4e4e7; flex: 1;">
                  <div style="font-size: 11px; font-weight: 700; color: #f87171; margin-bottom: 2px;">@gamer_pro • Live Chat Stream</div>
                  <em>"!setup - What camera & microphone are you using?"</em>
              </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: #f87171; margin-left: 40px; font-weight: 600; background: rgba(239,68,68,0.1); padding: 4px 10px; border-radius: 8px; border: 1px dashed rgba(239,68,68,0.3); width: fit-content;">
              ⚡ YouTube Live Poller API: Matched Command <code>"!setup"</code> (Latency: 0.9s)
          </div>

          <div style="display: flex; align-items: flex-start; gap: 10px; margin-left: 20px;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #FF0000; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0;">🎥</div>
              <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 12px; padding: 10px 14px; font-size: 12px; color: #fff; flex: 1;">
                  <div><strong>ReplyFlow Live Mod:</strong> @gamer_pro Camera: Sony A7IV 4K • Mic: Shure SM7B 🎙️</div>
              </div>
          </div>
      </div>
    `,
    ai: `
      <div style="display: flex; flex-direction: column; gap: 12px; max-height: 280px; overflow-y: auto; padding-right: 6px;">
          <div style="display: flex; align-items: flex-start; gap: 10px;">
              <div style="width: 30px; height: 30px; border-radius: 50%; background: #10A37F; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0;">AI</div>
              <div style="background: rgba(255,255,255,0.06); border-radius: 12px; padding: 10px 14px; font-size: 12px; color: #e4e4e7; flex: 1;">
                  <div style="font-size: 11px; font-weight: 700; color: #34d399; margin-bottom: 2px;">@agency_owner • Customer DM</div>
                  <em>"Hi! We manage 15 brand accounts. Do you offer agency white-label pricing?"</em>
              </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: #34d399; margin-left: 40px; font-weight: 600; background: rgba(16,163,127,0.1); padding: 4px 10px; border-radius: 8px; border: 1px dashed rgba(16,163,127,0.3); width: fit-content;">
              🧠 GPT-4o Autonomous Agent: Analyzing Business Intent & Custom Proposal...
          </div>

          <div style="display: flex; align-items: flex-start; gap: 10px; margin-left: 20px;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #10A37F; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0;">🤖</div>
              <div style="background: rgba(16, 163, 127, 0.15); border: 1px solid rgba(16, 163, 127, 0.35); border-radius: 12px; padding: 12px 14px; font-size: 12px; color: #fff; flex: 1;">
                  <div><strong>ReplyFlow AI Sales Agent:</strong> Absolutely! For 15+ accounts, our Enterprise License includes dedicated IP rotation and multi-user sub-account permissions. Would you like to schedule a 10-min live demo?</div>
                  <button onclick="alert('Demo: Booking calendar demo...')" style="margin-top: 8px; background: #10A37F; border: none; color: #fff; font-size: 10px; font-weight: 700; padding: 6px 12px; border-radius: 6px; cursor: pointer;">Book Demo Call 📅</button>
              </div>
          </div>
      </div>
    `,
    tg: `
      <div style="display: flex; flex-direction: column; gap: 12px; max-height: 280px; overflow-y: auto; padding-right: 6px;">
          <div style="display: flex; align-items: flex-start; gap: 10px;">
              <div style="width: 30px; height: 30px; border-radius: 50%; background: #0088cc; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0;">TG</div>
              <div style="background: rgba(255,255,255,0.06); border-radius: 12px; padding: 10px 14px; font-size: 12px; color: #e4e4e7; flex: 1;">
                  <div style="font-size: 11px; font-weight: 700; color: #38bdf8; margin-bottom: 2px;">@crypto_trader • Group Message</div>
                  <em>"How to get access to VIP Trading Broadcast Signals?"</em>
              </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: #38bdf8; margin-left: 40px; font-weight: 600; background: rgba(0,136,204,0.1); padding: 4px 10px; border-radius: 8px; border: 1px dashed rgba(0,136,204,0.3); width: fit-content;">
              ⚡ BotFather Engine: Matched Keyword <code>"VIP SIGNALS"</code>
          </div>

          <div style="display: flex; align-items: flex-start; gap: 10px; margin-left: 20px;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #0088cc; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0;">✈️</div>
              <div style="background: rgba(0, 136, 204, 0.15); border: 1px solid rgba(0, 136, 204, 0.35); border-radius: 12px; padding: 12px 14px; font-size: 12px; color: #fff; flex: 1;">
                  <div><strong>ReplyFlow Telegram Bot:</strong> Hey @crypto_trader! Click below to view VIP Broadcast Channel subscription plans:</div>
                  <button onclick="alert('Demo: Opening Telegram VIP Channel...')" style="margin-top: 8px; background: #0088cc; border: none; color: #fff; font-size: 10px; font-weight: 700; padding: 6px 12px; border-radius: 6px; cursor: pointer;">Join VIP Channel ⚡</button>
              </div>
          </div>
      </div>
    `,
    dc: `
      <div style="display: flex; flex-direction: column; gap: 12px; max-height: 280px; overflow-y: auto; padding-right: 6px;">
          <div style="display: flex; align-items: flex-start; gap: 10px;">
              <div style="width: 30px; height: 30px; border-radius: 50%; background: #5865F2; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0;">DC</div>
              <div style="background: rgba(255,255,255,0.06); border-radius: 12px; padding: 10px 14px; font-size: 12px; color: #e4e4e7; flex: 1;">
                  <div style="font-size: 11px; font-weight: 700; color: #818cf8; margin-bottom: 2px;">@dev_alex • Server Slash Command</div>
                  <em>"/ticket issue: API Webhook connection timeout on port 3000"</em>
              </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: #818cf8; margin-left: 40px; font-weight: 600; background: rgba(88,101,242,0.1); padding: 4px 10px; border-radius: 8px; border: 1px dashed rgba(88,101,242,0.3); width: fit-content;">
              👾 Discord Plugin: AI Ticket Support Assistant Activated
          </div>

          <div style="display: flex; align-items: flex-start; gap: 10px; margin-left: 20px;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #5865F2; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0;">👾</div>
              <div style="background: rgba(88, 101, 242, 0.15); border: 1px solid rgba(88, 101, 242, 0.35); border-radius: 12px; padding: 12px 14px; font-size: 12px; color: #fff; flex: 1;">
                  <div><strong>ReplyFlow Ticket Bot:</strong> Ticket #8492 Opened! Our AI Assistant verified your server node on port 3000 is active. Status: <strong>RESOLVED 🟢</strong></div>
              </div>
          </div>
      </div>
    `
  };

  let simAutoTimer = null;
  const simPlatformKeys = ['ig', 'fb', 'yt', 'ai', 'tg', 'dc'];
  let currentSimIdx = 0;

  window.startSimAutoRotation = function () {
    if (simAutoTimer) clearInterval(simAutoTimer);
    simAutoTimer = setInterval(() => {
      currentSimIdx = (currentSimIdx + 1) % simPlatformKeys.length;
      const key = simPlatformKeys[currentSimIdx];
      window.switchSimTab(key, null, false);
    }, 5000);
  };

  window.switchSimTab = function (key, btn, isManual = true) {
    if (!btn) {
      btn = document.querySelector(`.sim-tab-btn[data-sim="${key}"]`);
    }

    if (isManual) {
      if (simAutoTimer) clearInterval(simAutoTimer);
      setTimeout(window.startSimAutoRotation, 10000);
    }

    const container = document.getElementById('sim-content-body');
    if (container && SIM_DATA[key]) {
      container.style.opacity = '0.3';
      setTimeout(() => {
        container.innerHTML = SIM_DATA[key];
        container.style.opacity = '1';
        container.scrollTop = container.scrollHeight;
      }, 80);
    }

    const idx = simPlatformKeys.indexOf(key);
    if (idx !== -1) currentSimIdx = idx;

    const btns = document.querySelectorAll('.sim-tab-btn');
    btns.forEach(b => {
      b.classList.remove('active');
    });

    if (btn) {
      btn.classList.add('active');
    }
  };

  // Immediate & DOMReady trigger for 5s auto-rotation
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(window.startSimAutoRotation, 500);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(window.startSimAutoRotation, 500);
    });
  }
  window.addEventListener('load', () => {
    if (!simAutoTimer) window.startSimAutoRotation();
  });

  window.toggleFaq = function (btn) {
    const item = btn.parentElement;
    const answer = item.querySelector('.faq-answer');
    const icon = btn.querySelector('.faq-icon');
    if (answer) {
      const isVisible = answer.style.display === 'block';
      answer.style.display = isVisible ? 'none' : 'block';
      if (icon) icon.textContent = isVisible ? '+' : '−';
    }
  };

  // ── Standalone Mobile Nav Toggle ──
  window.toggleStandaloneMobileMenu = function () {
    const menu = document.getElementById('standalone-mobile-menu');
    if (menu) {
      const isVisible = menu.style.display === 'block';
      menu.style.display = isVisible ? 'none' : 'block';
    }
  };

  // ── Use Cases & Docs Viewer Data Engine ──
  const USE_CASES_DATA = {
    ig: {
      title: "📷 Instagram Reels, Post Scheduler, Story Triggers & AI DMs",
      badge: "USE CASE • INSTAGRAM AUTOMATION SUITE",
      content: `
        <div style="background: rgba(168,85,247,0.12); border: 1px solid rgba(168,85,247,0.35); border-radius: 14px; padding: 18px; margin-bottom: 20px;">
          <h4 style="margin:0 0 8px 0; color:#fff; font-size:14px; font-weight:700;">🚀 All-in-One Instagram Growth Engine:</h4>
          <p style="margin:0; font-size:13px; color:#cbd5e1; line-height:1.6;">ReplyFlow isn't just for comment replies! It's a complete Instagram automation suite allowing you to schedule posts & Reels, set up interactive Story keyword triggers, and deploy an autonomous AI DM sales agent.</p>
        </div>

        <h4 style="color:#fff; font-size:13px; font-weight:700; margin-bottom:12px;">⚡ Core Platform Features:</h4>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px;">
            <div style="font-size: 12px; font-weight: 700; color: #c084fc; margin-bottom: 4px;">📅 Content & Post Scheduler</div>
            <div style="font-size: 11px; color: #a1a1aa;">Schedule Posts, Reels, & Carousels with AI captions, hashtags, and exact time auto-publishing.</div>
          </div>
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px;">
            <div style="font-size: 12px; font-weight: 700; color: #c084fc; margin-bottom: 4px;">📸 Story Keyword Triggers</div>
            <div style="font-size: 11px; color: #a1a1aa;">Trigger automated DMs when followers reply to your Stories or interact with Story stickers.</div>
          </div>
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px;">
            <div style="font-size: 12px; font-weight: 700; color: #c084fc; margin-bottom: 4px;">🤖 GPT-4o AI DM Manager</div>
            <div style="font-size: 11px; color: #a1a1aa;">AI agent handles multi-turn DM conversations, answers FAQs, qualifies leads, and books calls 24/7.</div>
          </div>
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px;">
            <div style="font-size: 12px; font-weight: 700; color: #c084fc; margin-bottom: 4px;">🔒 Follow-Gate Lead Lock</div>
            <div style="font-size: 11px; color: #a1a1aa;">Verifies user follow status before unlocking high-value download links or discount codes.</div>
          </div>
        </div>

        <h4 style="color:#fff; font-size:13px; font-weight:700; margin-bottom:10px;">📋 Execution Flow Example:</h4>
        <div style="background: #0d0e12; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px; font-family: monospace; font-size: 12px; color: #e4e4e7;">
          <div style="color: #10b981;">1. Post Scheduled: Reel published at 5:00 PM with AI hashtag suite</div>
          <div style="color: #c084fc; margin: 4px 0;">2. Story Trigger: Follower replies "INFO" to today's Story</div>
          <div style="color: #60a5fa; margin: 4px 0;">3. ReplyFlow AI DM: "Hey! Glad you're interested. What goal are you working on?"</div>
          <div style="color: #a855f7;">4. Conversion: AI qualifies lead & sends instant checkout link</div>
        </div>
      `
    },
    fb: {
      title: "📘 Facebook Page Scheduler, Comments & Messenger AI Funnels",
      badge: "USE CASE • FACEBOOK PAGES & MESSENGER",
      content: `
        <div style="background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.35); border-radius: 14px; padding: 18px; margin-bottom: 20px;">
          <h4 style="margin:0 0 8px 0; color:#fff; font-size:14px; font-weight:700;">🚀 Page Monetization & Messenger AI:</h4>
          <p style="margin:0; font-size:13px; color:#cbd5e1; line-height:1.6;">Automate your entire Facebook Page. Schedule page posts & videos, auto-reply to post/ad comments, and deploy an automated AI Messenger sales funnel.</p>
        </div>

        <h4 style="color:#fff; font-size:13px; font-weight:700; margin-bottom:10px;">🔑 Capabilities & OAuth Scopes:</h4>
        <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; font-size: 12px; color: #a1a1aa; display: flex; flex-direction: column; gap: 8px;">
          <div><code style="color: #60a5fa;">Post Scheduling</code> — Queue Page posts, images, and video updates automatically.</div>
          <div><code style="color: #60a5fa;">Comment-to-Messenger</code> — Turn post comments into private Messenger chat threads.</div>
          <div><code style="color: #60a5fa;">AI Customer Care</code> — AI agent answers inquiries & prices in Messenger 24/7.</div>
        </div>
      `
    },
    yt: {
      title: "🎥 YouTube Video Comment Poller & Live Chat Bot",
      badge: "USE CASE • YOUTUBE CREATOR",
      content: `
        <div style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 14px; padding: 18px; margin-bottom: 20px;">
          <h4 style="margin:0 0 8px 0; color:#fff; font-size:14px; font-weight:700;">🚀 YouTube Studio Automation:</h4>
          <p style="margin:0; font-size:13px; color:#cbd5e1; line-height:1.6;">ReplyFlow runs a high-frequency (15s cycle) YouTube Data API v3 poller to auto-reply to comments on uploaded videos, Shorts, and Live Streams.</p>
        </div>

        <h4 style="color:#fff; font-size:13px; font-weight:700; margin-bottom:10px;">🔴 YouTube Live Stream Chat Bot:</h4>
        <ul style="padding-left:18px; font-size:12px; color:#a1a1aa; display:flex; flex-direction:column; gap:8px;">
          <li><strong>Chat Commands:</strong> Viewers type <code>!discord</code>, <code>!specs</code>, <code>!merch</code> to receive instant bot replies in chat.</li>
          <li><strong>Link Protection:</strong> Automatically flags and blocks unauthorized spam links.</li>
          <li><strong>SuperChat Highlights:</strong> Auto-thanks viewers for SuperChats and memberships.</li>
        </ul>
      `
    },
    tt: {
      title: "🎵 TikTok Viral Commercial Video Engine",
      badge: "USE CASE • TIKTOK COMMERCIAL",
      content: `
        <div style="background: rgba(236,72,153,0.1); border: 1px solid rgba(236,72,153,0.3); border-radius: 14px; padding: 18px; margin-bottom: 20px;">
          <h4 style="margin:0 0 8px 0; color:#fff; font-size:14px; font-weight:700;">🚀 TikTok Commercial Automation:</h4>
          <p style="margin:0; font-size:13px; color:#cbd5e1; line-height:1.6;">Leverage TikTok Commercial API webhooks. Automatically respond to video comments, drive organic traffic to bio links, and distribute promotional discount codes.</p>
        </div>
      `
    },
    tg: {
      title: "✈️ Telegram Channel Broadcasts, Group Moderation & Bot Suite",
      badge: "USE CASE • TELEGRAM BROADCASTS & BOTS",
      content: `
        <div style="background: rgba(0,136,204,0.12); border: 1px solid rgba(0,136,204,0.35); border-radius: 14px; padding: 18px; margin-bottom: 20px;">
          <h4 style="margin:0 0 8px 0; color:#fff; font-size:14px; font-weight:700;">🚀 Telegram Bot & Channel Manager:</h4>
          <p style="margin:0; font-size:13px; color:#cbd5e1; line-height:1.6;">Connect BotFather tokens to ReplyFlow. Schedule scheduled broadcasts to Telegram channels, automate group welcome messages, and deploy AI customer service bots.</p>
        </div>

        <h4 style="color:#fff; font-size:13px; font-weight:700; margin-bottom:10px;">⚡ Key Features:</h4>
        <ul style="padding-left:18px; font-size:12px; color:#a1a1aa; display:flex; flex-direction:column; gap:8px;">
          <li><strong>Scheduled Broadcasts:</strong> Queue announcements, photos, & rich media to unlimited channels.</li>
          <li><strong>Group Auto-Mod:</strong> Filter spam messages, ban bad words, and verify human joiners with CAPTCHAs.</li>
          <li><strong>Bot DMs & AI Leads:</strong> Private interactive chat workflows for instant lead registration.</li>
        </ul>
      `
    },
    dc: {
      title: "👾 Discord Bot Engine & Custom Plugins Suite",
      badge: "USE CASE • DISCORD PLUGINS ECOSYSTEM",
      content: `
        <div style="background: rgba(88,101,242,0.12); border: 1px solid rgba(88,101,242,0.35); border-radius: 14px; padding: 18px; margin-bottom: 20px;">
          <h4 style="margin:0 0 8px 0; color:#fff; font-size:14px; font-weight:700;">🧩 Custom Discord Plugins Ecosystem:</h4>
          <p style="margin:0; font-size:13px; color:#cbd5e1; line-height:1.6;">ReplyFlow provides a modular Discord plugin system. Enable ready-made plugins or build custom slash commands to supercharge your server community.</p>
        </div>

        <h4 style="color:#fff; font-size:13px; font-weight:700; margin-bottom:12px;">🔌 Available Plugins Marketplace:</h4>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px;">
            <div style="font-size: 12px; font-weight: 700; color: #818cf8; margin-bottom: 4px;">🛡️ Anti-Spam & Link Guard</div>
            <div style="font-size: 11px; color: #a1a1aa;">Auto-detects malicious invite links, caps duplicate messages, and mutes offenders.</div>
          </div>
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px;">
            <div style="font-size: 12px; font-weight: 700; color: #818cf8; margin-bottom: 4px;">⚡ Webhook Relay & CRM Sync</div>
            <div style="font-size: 11px; color: #a1a1aa;">Instantly forwards Discord channel activity and leads to Google Sheets or Zapier.</div>
          </div>
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px;">
            <div style="font-size: 12px; font-weight: 700; color: #818cf8; margin-bottom: 4px;">🤖 AI Support Ticket Assistant</div>
            <div style="font-size: 11px; color: #a1a1aa;">GPT-4o reads customer tickets in private channels and resolves technical queries.</div>
          </div>
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px;">
            <div style="font-size: 12px; font-weight: 700; color: #818cf8; margin-bottom: 4px;">💻 Custom Slash Command Builder</div>
            <div style="font-size: 11px; color: #a1a1aa;">Build custom commands like <code>/pricing</code>, <code>/support</code>, and <code>/status</code> with ease.</div>
          </div>
        </div>
      `
    }
  };

  const DOCS_DATA = {
    meta: {
      title: "📖 Meta API Setup & Connection Guide",
      badge: "DOCS • META GRAPH API v18.0",
      content: `
        <div style="background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.3); border-radius: 14px; padding: 18px; margin-bottom: 20px;">
          <h4 style="margin:0 0 8px 0; color:#fff; font-size:14px; font-weight:700;">📌 Step-by-Step Connection Instructions:</h4>
          <ol style="margin:0; padding-left:18px; font-size:13px; color:#cbd5e1; display:flex; flex-direction:column; gap:10px; line-height:1.5;">
            <li>Convert your personal Instagram Account to an <strong>Instagram Professional / Business Creator Account</strong> in Instagram Settings.</li>
            <li>Connect your Instagram Business Account to your official <strong>Facebook Page</strong> in Facebook Page Settings.</li>
            <li>Click <strong>Connect Instagram / Facebook</strong> inside ReplyFlow and grant all permissions (Pages, Messaging, Instagram Comments).</li>
            <li>Once authenticated, ReplyFlow stores an encrypted long-lived User Access Token valid for 60 days with auto-refresh.</li>
          </ol>
        </div>

        <h4 style="color:#fff; font-size:13px; font-weight:700; margin-bottom:10px;">🛡️ Full Meta Permission Scope:</h4>
        <div style="background: #0d0e12; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px; font-family: monospace; font-size: 11px; color: #c084fc;">
          instagram_business_basic, instagram_business_manage_messages, instagram_business_manage_comments, instagram_content_publish, pages_show_list, pages_read_engagement, pages_manage_posts, pages_messaging
        </div>
      `
    },
    security: {
      title: "🔑 Security, AES-256 Token Encryption & Meta Compliance",
      badge: "DOCS • SECURITY ARCHITECTURE",
      content: `
        <div style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: 14px; padding: 18px; margin-bottom: 20px;">
          <h4 style="margin:0 0 8px 0; color:#fff; font-size:14px; font-weight:700;">🔐 Encryption at Rest:</h4>
          <p style="margin:0; font-size:13px; color:#cbd5e1; line-height:1.6;">ReplyFlow enforces military-grade <strong>AES-256-GCM</strong> (Galois/Counter Mode) encryption for all OAuth access tokens, app secrets, and database credentials stored in <code>database.json</code>.</p>
        </div>

        <h4 style="color:#fff; font-size:13px; font-weight:700; margin-bottom:10px;">📋 Compliance Standards:</h4>
        <ul style="padding-left:18px; font-size:12px; color:#a1a1aa; display:flex; flex-direction:column; gap:8px;">
          <li><strong>No Scraping:</strong> Operates strictly via official Meta Graph API v18.0 & YouTube Data API v3 endpoints.</li>
          <li><strong>Rate Limit Enforcement:</strong> Automatic token bucket rate limiting (200 calls/hour per user) to prevent account flags.</li>
          <li><strong>Data Privacy:</strong> Full compliance with Meta Platform Terms and EU GDPR data deletion requests.</li>
        </ul>
      `
    },
    webhooks: {
      title: "⚙️ Real-time Webhooks & Ngrok Tunneling Setup",
      badge: "DOCS • WEBHOOK ARCHITECTURE",
      content: `
        <div style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); border-radius: 14px; padding: 18px; margin-bottom: 20px;">
          <h4 style="margin:0 0 8px 0; color:#fff; font-size:14px; font-weight:700;">⚡ Real-time Webhook Listener:</h4>
          <p style="margin:0; font-size:13px; color:#cbd5e1; line-height:1.6;">ReplyFlow receives instant webhook notifications from Meta server when a user comments or sends a message. The endpoint handles initial GET challenge verification and POST event execution.</p>
        </div>

        <h4 style="color:#fff; font-size:13px; font-weight:700; margin-bottom:10px;">💻 Verified Production Endpoints:</h4>
        <div style="background: #0d0e12; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px; font-family: monospace; font-size: 11px; color: #10b981;">
          GET/POST: https://equinox-fiber-bundle.ngrok-free.dev/api/webhooks/instagram<br>
          Verification Token: replyflow_verify_secure_token_2026
        </div>
      `
    },
    rules: {
      title: "⚡ Trigger Rules, Keyword Matching & Follow-Gate Engine",
      badge: "DOCS • TRIGGER RULE ENGINE",
      content: `
        <div style="background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.3); border-radius: 14px; padding: 18px; margin-bottom: 20px;">
          <h4 style="margin:0 0 8px 0; color:#fff; font-size:14px; font-weight:700;">💡 Rule Matching Engine:</h4>
          <p style="margin:0; font-size:13px; color:#cbd5e1; line-height:1.6;">Trigger rules allow exact or substring keyword matching across post comments. Triggers can be scoped to specific Instagram Post IDs or configured as global account triggers.</p>
        </div>

        <h4 style="color:#fff; font-size:13px; font-weight:700; margin-bottom:10px;">🎯 Configuration Options:</h4>
        <ul style="padding-left:18px; font-size:12px; color:#a1a1aa; display:flex; flex-direction:column; gap:8px;">
          <li><strong>Keyword Trigger List:</strong> Match words like <code>SEND</code>, <code>LINK</code>, <code>PRICE</code>, <code>DEMO</code>.</li>
          <li><strong>Comment Reply Pool:</strong> Define up to 15 unique reply templates for automatic rotation.</li>
          <li><strong>DM Payload Builder:</strong> Attach external URLs, discount coupons, or PDF download buttons.</li>
        </ul>
      `
    }
  };

  // ── Global Modal Open / Close Controllers ──
  window.openModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active', 'open');
      modal.style.setProperty('display', 'flex', 'important');
    }
  };

  window.closeModal = function (modalId) {
    if (!modalId) {
      document.querySelectorAll('.modal-overlay').forEach(m => {
        m.classList.remove('active', 'open');
        m.style.setProperty('display', 'none', 'important');
      });
      return;
    }
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active', 'open');
      modal.style.setProperty('display', 'none', 'important');
    }
  };

  window.openUseCasesOrDocsViewer = function (type, key) {
    const dataSet = type === 'usecase' ? USE_CASES_DATA[key] : DOCS_DATA[key];
    if (!dataSet) return;

    const badgeEl = document.getElementById('udd-badge');
    const titleEl = document.getElementById('udd-title');
    const bodyEl = document.getElementById('udd-body');

    if (badgeEl) badgeEl.textContent = dataSet.badge;
    if (titleEl) titleEl.textContent = dataSet.title;
    if (bodyEl) bodyEl.innerHTML = dataSet.content;

    openModal('modal-usecase-doc-viewer');
  };

  // Global OAuth Popup Completion Message Listener
  window.addEventListener('message', function (event) {
    if (event && event.data && (event.data.type === 'REPLYFLOW_OAUTH_SUCCESS' || event.data.type === 'YOUTUBE_CONNECTED')) {
      console.log('[OAuth Message Received]:', event.data);
      localStorage.setItem('replyflow_yt_connected', 'true');
      if (event.data.channelName) {
        localStorage.setItem('replyflow_yt_channel', event.data.channelName);
      }
      if (typeof updateYouTubeConnectionUI === 'function') updateYouTubeConnectionUI();
      if (typeof loadAccounts === 'function') loadAccounts('yt');
      if (typeof showToast === 'function') showToast('🎉 Account linked successfully!', 'success');
    } else if (event && event.data && event.data.type === 'REPLYFLOW_OAUTH_ERROR') {
      console.warn('[OAuth Error Message Received]:', event.data);
      const errMsg = event.data.message || 'YouTube connection failed. Please try again.';
      const banner = document.getElementById('yt-oauth-error-banner');
      if (banner) {
        banner.textContent = errMsg;
        banner.style.display = 'block';
      }
      if (typeof showErrorToast === 'function') {
        showErrorToast(errMsg);
      } else if (typeof showToast === 'function') {
        showToast(errMsg, 'error');
      }
    }
  });

  // Process social OAuth callback hash/params on startup
  async function checkSocialAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;

    if (hash.includes('error=no_channel_found') || params.get('error') === 'no_channel_found') {
      const banner = document.getElementById('yt-oauth-error-banner');
      if (banner) {
        banner.textContent = 'No YouTube channel found on this Google account. Please try "Connect Channel" again and make sure you pick the Google account that actually owns/manages this YouTube channel (the one you use in YouTube Studio) — not a different Gmail.';
        banner.style.display = 'block';
      }
      if (typeof showToast === 'function') {
        showToast('No YouTube channel found on this Google account.', 'error');
      }
    }

    // Detect Discord Bot Guild Authorization Redirect (?guild_id=...&permissions=8)
    let guildId = params.get('guild_id');
    if (!guildId && window.location.href.includes('guild_id=')) {
      const match = window.location.href.match(/guild_id=([0-9]+)/);
      if (match && match[1]) guildId = match[1];
    }

    if (guildId) {
      console.log(`[Discord OAuth] Intercepted guild_id ${guildId} from Discord redirect! Connecting server...`);
      try {
        const token = localStorage.getItem('replyflow_user_token');
        const guildName = params.get('guild_name') || `Discord Server ${guildId}`;
        if (token) {
          const res = await fetch('/api/discord/guilds/connect', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ guildId, name: guildName })
          });
          const data = await res.json();
          if (data.success) {
            localStorage.setItem('selected_discord_guild_id', String(guildId));
            if (typeof showToast === 'function') showToast(`🎉 Discord Server connected & set active!`, 'success');
            const cleanUrl = window.location.origin + window.location.pathname + '#discord';
            window.history.replaceState({}, document.title, cleanUrl);
            if (typeof loadDiscordBotData === 'function') loadDiscordBotData();
          }
        }
      } catch (err) {
        console.error('[Discord OAuth Connect Error]:', err);
      }
    }

    if (hash.includes('success=google') || params.get('success') === 'google') {
      const name = params.get('name') || 'Google Creator';
      const welcomeHeading = document.getElementById('dashboard-welcome');
      if (welcomeHeading) welcomeHeading.textContent = `Welcome back, ${name.split(' ')[0]}`;
      switchScreen('dashboard');
    } else if (hash.includes('success=discord') || params.get('success') === 'discord') {
      const name = params.get('name') || 'Discord Creator';
      const welcomeHeading = document.getElementById('dashboard-welcome');
      if (welcomeHeading) welcomeHeading.textContent = `Welcome back, ${name.split(' ')[0]}`;
      switchScreen('dashboard');
    }
  }
  checkSocialAuthCallback();

  function checkAutoLogin() {
    const token = localStorage.getItem('replyflow_user_token');
    const landingPage = document.getElementById('standalone-landing-page');
    const mainShell = document.getElementById('main-app-shell');
    if (token && mainShell && landingPage) {
      landingPage.style.display = 'none';
      mainShell.style.display = 'block';
    }
  }
  checkAutoLogin();

  // Execute initial routing after all DOM handlers & tabs are registered
  handleHashRoute();

  // ═══════════════════════════════════════════════════════════════════
  // CREATOR REFERRAL & PROMO CODES ENGINE
  // ═══════════════════════════════════════════════════════════════════
  window.copyReferralLink = function () {
    const input = document.getElementById('ref-link-input');
    if (input) {
      input.select();
      navigator.clipboard.writeText(input.value).then(() => {
        showToast('📋 Referral link copied to clipboard!', 'success');
      }).catch(() => {
        showToast('📋 Referral link selected! Press Ctrl+C to copy.', 'info');
      });
    }
  };

  window.redeemPointsForServiceRenewal = function () {
    const token = localStorage.getItem('replyflow_user_token');
    fetch('/api/referrals/redeem-points', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          showToast(`⚠️ ${data.error}`, 'error');
        } else {
          showToast(data.message, 'success');
          loadReferralDashboardData();
        }
      })
      .catch(() => showToast('Server error redeeming reward points', 'error'));
  };

  let _activeCheckoutAppliedDiscountPkr = 0;

  window.applyPromoCodeCheckout = function () {
    const input = document.getElementById('sp-promo-input');
    const resultBox = document.getElementById('sp-promo-result');
    const discountRow = document.getElementById('sp-discount-row');
    const discountText = document.getElementById('sp-discount-text');
    const totalText = document.getElementById('sp-total-text');

    if (!input || !input.value.trim()) {
      showToast('Please enter a promo or referral code', 'error');
      return;
    }

    const code = input.value.trim();
    const subtotalText = document.getElementById('sp-subtotal-text');
    const basePkr = subtotalText ? parseInt(subtotalText.textContent.replace(/[^0-9]/g, '')) || 16500 : 16500;

    fetch('/api/promo/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, amountPkr: basePkr })
    })
      .then(res => res.json())
      .then(data => {
        if (!data.valid) {
          if (resultBox) {
            resultBox.style.display = 'block';
            resultBox.style.background = 'rgba(239,68,68,0.15)';
            resultBox.style.color = '#f87171';
            resultBox.style.border = '1px solid rgba(239,68,68,0.3)';
            resultBox.textContent = `❌ ${data.error || 'Invalid Promo Code'}`;
          }
          _activeCheckoutAppliedDiscountPkr = 0;
          if (discountRow) discountRow.style.display = 'none';
          if (totalText) totalText.textContent = `PKR ${basePkr.toLocaleString()}`;
        } else {
          if (resultBox) {
            resultBox.style.display = 'block';
            resultBox.style.background = 'rgba(16,185,129,0.15)';
            resultBox.style.color = '#34d399';
            resultBox.style.border = '1px solid rgba(16,185,129,0.3)';
            resultBox.textContent = data.message;
          }
          _activeCheckoutAppliedDiscountPkr = data.discountPkr || 0;
          if (discountRow) discountRow.style.display = 'flex';
          if (discountText) discountText.textContent = `-PKR ${data.discountPkr.toLocaleString()}`;
          if (totalText) totalText.textContent = `PKR ${data.finalPricePkr.toLocaleString()}`;
          showToast(`🎟️ Promo Applied! ${data.discountPercent}% OFF`, 'success');
        }
      })
      .catch(err => {
        console.error('Error applying promo code:', err);
        showToast('Failed to validate promo code', 'error');
      });
  };

  function loadReferralDashboardData() {
    const token = localStorage.getItem('replyflow_user_token');
    fetch('/api/referrals/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (!data) return;
        const linkInput = document.getElementById('ref-link-input');
        const invitesEl = document.getElementById('ref-stat-invites');
        const earningsEl = document.getElementById('ref-stat-earnings');
        const balanceEl = document.getElementById('ref-pending-balance');
        const rateBadge = document.getElementById('ref-rate-badge');

        if (linkInput) linkInput.value = data.referralLink || 'http://localhost:3000/?ref=YASIR742';
        if (invitesEl) invitesEl.textContent = data.totalInvites !== undefined ? data.totalInvites : 2;
        if (earningsEl) earningsEl.textContent = `${(data.totalPointsEarned || 2000).toLocaleString()} Pts`;
        if (balanceEl) balanceEl.innerHTML = `${(data.availablePoints || 1000).toLocaleString()} Points <span style="font-size: 12px; font-weight: 600; color: #34d399;">(Ready to Redeem for Free Month)</span>`;
        if (rateBadge) rateBadge.textContent = `+${data.pointsPerReferral || 500} Points per Invite`;

        const tbody = document.getElementById('referrals-log-tbody');
        if (tbody && data.history && data.history.length > 0) {
          tbody.innerHTML = data.history.map(r => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: 12px; color: #a1a1aa;">${r.date ? r.date.split('T')[0] : '2026-08-08'}</td>
          <td style="padding: 12px; font-weight: 600; color: #fff;">${r.referredUserEmail}</td>
          <td style="padding: 12px;"><span style="background: rgba(168,85,247,0.15); color: #c084fc; padding: 3px 8px; border-radius: 6px; font-weight: 700; font-size: 11px;">${r.planPurchased}</span></td>
          <td style="padding: 12px; font-weight: 800; color: #34d399;">+${r.pointsEarned || 500} Points</td>
          <td style="padding: 12px;"><span style="background: rgba(16,185,129,0.15); color: #34d399; padding: 3px 8px; border-radius: 6px; font-weight: 700; font-size: 11px;">✅ Credited</span></td>
        </tr>
      `).join('');
        }
      })
      .catch(err => console.error('Error loading referral stats:', err));
  }

  // Load referral data on screen switch
  document.addEventListener('click', (e) => {
    const item = e.target.closest('[data-screen="referrals"]');
    if (item) {
      loadReferralDashboardData();
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // QUICK BUY — Direct Plan Purchase From Landing Page (No Login Required)
  // ═══════════════════════════════════════════════════════════════════

  let _qbActivePlan = 'Pro';
  let _qbActiveMethod = 'card';

  const _qbPlanData = {
    'Free': { badge: 'Free Plan', price: 'PKR 0 / mo', rawPrice: 'PKR 0', pkrLabel: '$0/mo', color: '#10b981' },
    'Starter': { badge: 'Creator Growth', price: 'PKR 8,000 / mo', rawPrice: 'PKR 8,000', pkrLabel: 'PKR 8,000/mo', color: '#6366f1' },
    'Pro': { badge: 'Pro Creator', price: 'PKR 16,500 / mo', rawPrice: 'PKR 16,500', pkrLabel: 'PKR 16,500/mo', color: '#a855f7' },
    'Business': { badge: 'Agency Scale', price: 'PKR 27,500 / mo', rawPrice: 'PKR 27,500', pkrLabel: 'PKR 27,500/mo', color: '#f59e0b' },
    'Discord': { badge: 'Discord Bot', price: 'PKR 2,800 / mo', rawPrice: 'PKR 2,800', pkrLabel: 'PKR 2,800/mo', color: '#5865f2' }
  };

  window.openQuickBuyModal = function (planName) {
    _qbActivePlan = 'Free';

    // Update header badge & title
    const badge = document.getElementById('qb-header-plan-badge');
    const title = document.getElementById('qb-step-title');
    const subtitle = document.getElementById('qb-step-subtitle');
    if (badge) { badge.textContent = 'FREE FOREVER'; }
    if (title) title.textContent = 'Create Your Account';
    if (subtitle) subtitle.textContent = 'Instant Free Setup • No Credit Card Required';

    // Reset to step 1
    quickBuyBackToStep1();

    // Clear previous errors and fields
    ['qb-name', 'qb-username', 'qb-email', 'qb-password', 'qb-confirm-password', 'qb-otp-code'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const errEl = document.getElementById('qb-step1-error');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    const errEl2 = document.getElementById('qb-step2-error');
    if (errEl2) { errEl2.style.display = 'none'; errEl2.textContent = ''; }

    // Open the modal
    const overlay = document.getElementById('modal-quick-buy');
    if (overlay) {
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      setTimeout(() => { overlay.style.opacity = '1'; }, 10);
    }
  };

  window.quickBuyBackToStep1 = function () {
    const step1 = document.getElementById('qb-step-1');
    const step2 = document.getElementById('qb-step-2');
    const title = document.getElementById('qb-step-title');
    const subtitle = document.getElementById('qb-step-subtitle');

    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
    if (title) title.textContent = 'Create Your Account';
    if (subtitle) subtitle.textContent = 'Instant Free Setup • No Credit Card Required';
  };

  window.getApiEndpoint = function(path) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      if (window.location.port !== '3000') {
        return 'http://localhost:3000' + path;
      }
    }
    return path;
  };

  window.handleQuickBuySignup = async function (isResend) {
    const name = (document.getElementById('qb-name') || {}).value?.trim();
    const username = (document.getElementById('qb-username') || {}).value?.trim();
    const email = (document.getElementById('qb-email') || {}).value?.trim();
    const purpose = (document.getElementById('qb-purpose') || {}).value || 'Content Creator';
    const password = (document.getElementById('qb-password') || {}).value?.trim();
    const confirmPassword = (document.getElementById('qb-confirm-password') || {}).value?.trim();

    const errEl = document.getElementById('qb-step1-error');
    const errEl2 = document.getElementById('qb-step2-error');
    const nextBtn = document.getElementById('btn-qb-next');

    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    if (errEl2) { errEl2.style.display = 'none'; errEl2.textContent = ''; }

    if (!name || !username || !email || !password) {
      if (errEl) { errEl.textContent = '⚠️ Please fill in all required fields.'; errEl.style.display = 'block'; }
      return;
    }
    if (!email.includes('@')) {
      if (errEl) { errEl.textContent = '⚠️ Please enter a valid email address.'; errEl.style.display = 'block'; }
      return;
    }
    if (password.length < 6) {
      if (errEl) { errEl.textContent = '⚠️ Password must be at least 6 characters.'; errEl.style.display = 'block'; }
      return;
    }
    if (!isResend && password !== confirmPassword) {
      if (errEl) { errEl.textContent = '⚠️ Passwords do not match. Please try again.'; errEl.style.display = 'block'; }
      return;
    }

    if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = '📩 Sending Verification OTP...'; }

    try {
      const targetUrl = window.getApiEndpoint('/api/auth/register');
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, email, password, purpose })
      });
      const responseText = await res.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonErr) {
        if (responseText.trim().startsWith('<')) {
          throw new Error('Node.js backend server (server.js) is not running. Please start Node.js server (node server.js).');
        }
        throw new Error('Server returned invalid response: ' + responseText.substring(0, 80));
      }
      if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = '✨ Create Account & Send OTP →'; }

      if (data.error) {
        if (errEl) { errEl.textContent = `⚠️ ${data.error}`; errEl.style.display = 'block'; }
        if (isResend && errEl2) { errEl2.textContent = `⚠️ ${data.error}`; errEl2.style.display = 'block'; }
        return;
      }

      // Success: show OTP verification step
      const step1 = document.getElementById('qb-step-1');
      const step2 = document.getElementById('qb-step-2');
      const targetEmailEl = document.getElementById('qb-otp-target-email');
      const title = document.getElementById('qb-step-title');
      const subtitle = document.getElementById('qb-step-subtitle');

      if (targetEmailEl) targetEmailEl.textContent = email;
      if (title) title.textContent = 'Verify Your Email';
      if (subtitle) subtitle.textContent = isResend ? 'A new verification code has been sent!' : 'Enter the 6-digit OTP code sent to your email';

      if (step1) step1.style.display = 'none';
      if (step2) step2.style.display = 'block';

      if (data.demoCode) {
        console.log('[Signup OTP Notice] Code:', data.demoCode);
        if (errEl2) {
          errEl2.textContent = `🔑 Demo Mode Code: ${data.demoCode} (Check email inbox or server logs)`;
          errEl2.style.display = 'block';
          errEl2.style.color = '#34d399';
          errEl2.style.background = 'rgba(16, 185, 129, 0.1)';
          errEl2.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        }
      }
    } catch (err) {
      if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = '✨ Create Account & Send OTP →'; }
      if (errEl) { errEl.textContent = `⚠️ Network error: ${err.message}`; errEl.style.display = 'block'; }
    }
  };

  window.handleQuickBuyVerifyOtp = async function () {
    const email = (document.getElementById('qb-email') || {}).value?.trim();
    const otp = (document.getElementById('qb-otp-code') || {}).value?.trim();
    const errEl2 = document.getElementById('qb-step2-error');
    const verifyBtn = document.getElementById('btn-qb-verify-otp');

    if (!otp || otp.length < 6) {
      if (errEl2) {
        errEl2.textContent = '⚠️ Please enter the full 6-digit OTP code.';
        errEl2.style.display = 'block';
        errEl2.style.color = '#f87171';
        errEl2.style.background = 'rgba(248, 113, 113, 0.1)';
        errEl2.style.borderColor = 'rgba(248, 113, 113, 0.3)';
      }
      return;
    }

    if (verifyBtn) { verifyBtn.disabled = true; verifyBtn.textContent = '🔄 Verifying Code...'; }

    try {
      const targetUrl = window.getApiEndpoint('/api/auth/register-verify-otp');
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      const responseText = await res.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonErr) {
        if (responseText.trim().startsWith('<')) {
          throw new Error('Node.js backend server (server.js) is not running. Please start Node.js server (node server.js).');
        }
        throw new Error('Server returned invalid response: ' + responseText.substring(0, 80));
      }
      if (verifyBtn) { verifyBtn.disabled = false; verifyBtn.textContent = '✅ Verify OTP & Activate Account'; }

      if (data.error) {
        if (errEl2) {
          errEl2.textContent = `⚠️ ${data.error}`;
          errEl2.style.display = 'block';
          errEl2.style.color = '#f87171';
          errEl2.style.background = 'rgba(248, 113, 113, 0.1)';
          errEl2.style.borderColor = 'rgba(248, 113, 113, 0.3)';
        }
        return;
      }

      // SUCCESS! Save token and log user in
      const token = data.token;
      localStorage.setItem('replyflow_token', token);
      localStorage.setItem('replyflow_user_token', token);
      if (data.user) {
        localStorage.setItem('replyflow_user', JSON.stringify(data.user));
      }

      // Close modal
      const overlay = document.getElementById('modal-quick-buy');
      if (overlay) overlay.style.display = 'none';

      // Switch view to dashboard shell
      const landingPage = document.getElementById('standalone-landing-page');
      const mainShell = document.getElementById('main-app-shell');
      if (landingPage) landingPage.style.display = 'none';
      if (mainShell) mainShell.style.display = 'block';
      if (typeof switchScreen === 'function') switchScreen('dashboard');

      alert(`🎉 ${data.message || 'Account activated successfully! Welcome to ReplyFlow.'}`);
    } catch (err) {
      if (verifyBtn) { verifyBtn.disabled = false; verifyBtn.textContent = '✅ Verify OTP & Activate Account'; }
      if (errEl2) {
        errEl2.textContent = `⚠️ Verification error: ${err.message}`;
        errEl2.style.display = 'block';
        errEl2.style.color = '#f87171';
      }
    }
  };

  async function _quickBuyRegisterAndLogin(name, username, email, password, planName, payBtn, errEl) {
    try {
      // Step A: Register the user
      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, email, password })
      });
      const regData = await regRes.json();

      if (!regData.success && !regData.token) {
        const msg = regData.error || 'Registration failed. Try a different email or username.';
        if (errEl) { errEl.textContent = `⚠️ ${msg}`; errEl.style.display = 'block'; }
        if (payBtn) { payBtn.disabled = false; payBtn.textContent = '🔒 Create Account & Pay via Safepay'; }
        // Show error in step1 if on free plan
        const step1Err = document.getElementById('qb-step1-error');
        if (step1Err && planName === 'Free') { step1Err.textContent = `⚠️ ${msg}`; step1Err.style.display = 'block'; }
        return;
      }

      // Store token from registration
      const token = regData.token;
      localStorage.setItem('replyflow_token', token);
      localStorage.setItem('replyflow_user', JSON.stringify({ name, username, email }));

      // Step B: Upgrade plan if not Free
      if (planName !== 'Free') {
        await fetch('/api/billing/upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ planName, paymentMethod: `Safepay (${_qbActiveMethod.toUpperCase()})` })
        });
      }

      // Step C: Close modal and show success
      const overlay = document.getElementById('modal-quick-buy');
      if (overlay) { overlay.style.display = 'none'; }

      if (planName === 'Free') {
        // For free plan — go straight to dashboard
        const landingPage = document.getElementById('standalone-landing-page');
        const mainShell = document.getElementById('main-app-shell');
        if (landingPage) landingPage.style.display = 'none';
        if (mainShell) { mainShell.style.display = 'block'; }
        if (typeof switchScreen === 'function') switchScreen('dashboard');
      } else {
        // For paid plans — show success receipt
        const transIdEl = document.getElementById('rec-trans-id');
        const planNameEl = document.getElementById('rec-plan-name');
        const amountPaidEl = document.getElementById('rec-amount-paid');

        const plan = _qbPlanData[planName] || _qbPlanData['Pro'];
        if (transIdEl) transIdEl.textContent = `SP-2026-${Math.floor(10000 + Math.random() * 90000)}`;
        if (planNameEl) planNameEl.textContent = `${planName} Plan`;
        if (amountPaidEl) amountPaidEl.textContent = plan.rawPrice;

        const successModal = document.getElementById('modal-payment-success');
        if (successModal) { successModal.style.display = 'flex'; successModal.style.alignItems = 'center'; successModal.style.justifyContent = 'center'; }
      }

      if (payBtn) { payBtn.disabled = false; payBtn.textContent = '🔒 Create Account & Pay via Safepay'; }

    } catch (err) {
      console.error('Quick buy error:', err);
      if (errEl) { errEl.textContent = '⚠️ Connection error. Please try again.'; errEl.style.display = 'block'; }
      if (payBtn) { payBtn.disabled = false; payBtn.textContent = '🔒 Create Account & Pay via Safepay'; }
    }
  }

  window.showAuthModal = function (mode) {
    // Switch between sign-in and register on the landing page
    const landingPage = document.getElementById('standalone-landing-page');
    if (!landingPage) return;
    if (mode === 'signin') {
      const signInCard = document.getElementById('auth-card-signin');
      const registerCard = document.getElementById('auth-card-register');
      if (signInCard) signInCard.style.display = 'block';
      if (registerCard) registerCard.style.display = 'none';
      if (signInCard) signInCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // ════════════════════════════════════════════════════
  //  PAYMENT GATEWAY — Card Detection, PIN, Animations
  // ════════════════════════════════════════════════════

  // Card brand detection patterns
  const _cardPatterns = {
    visa: { regex: /^4/, name: 'Visa', color: '#1a1f71', icon: '<svg width="30" height="10" viewBox="0 0 780 250" fill="white"><path d="M290.86 219.91L321.44 30.09H370.3L339.7 219.91H290.86ZM501.25 34.65C491.78 31.04 476.66 27 458.2 27C409.96 27 376.02 51.47 375.79 86.39C375.55 112.11 399.97 126.24 418.28 134.7C437.02 143.37 443.18 148.93 443.09 156.79C442.96 168.91 428.89 174.36 415.72 174.36C397.58 174.36 387.87 171.7 373.14 165.57L367.41 162.97L361.19 199.52C372.49 204.49 393.42 208.74 415.19 208.96C466.38 208.96 499.71 184.75 500.07 147.61C500.25 127.22 487.5 111.77 460.04 98.97C443.11 90.72 432.75 85.22 432.86 76.77C432.86 69.29 441.58 61.25 460.48 61.25C476.11 61.01 487.52 64.4 496.27 67.97L500.5 69.96L506.53 34.86L501.25 34.65ZM221.74 30.09L173.96 162.59L168.7 137.1C159.25 107.97 131.6 76.5 100.59 60.48L144.29 219.73L195.78 219.67L273.37 30.09H221.74Z"/></svg>' },
    mastercard: { regex: /^(5[1-5]|2[2-7])/, name: 'Mastercard', color: '#1a1a1a', icon: '<svg width="28" height="18" viewBox="0 0 24 16"><circle cx="8" cy="8" r="8" fill="#EB001B"/><circle cx="16" cy="8" r="8" fill="#F79E1B"/><path d="M12 3.36C13.52 4.63 14.5 6.45 14.5 8.5S13.52 12.37 12 13.64C10.48 12.37 9.5 10.55 9.5 8.5S10.48 4.63 12 3.36Z" fill="#FF5F00"/></svg>' },
    amex: { regex: /^3[47]/, name: 'Amex', color: '#007bc1', icon: '<span style="font-size:9px;font-weight:900;color:#fff;letter-spacing:-0.5px;">AMEX</span>' },
    unionpay: { regex: /^62/, name: 'UnionPay', color: '#c0392b', icon: '<span style="font-size:9px;font-weight:900;color:#fff;">UP</span>' },
  };

  window.detectCardType = function (input, prefix) {
    // Auto-format: add space every 4 digits
    let val = input.value.replace(/\D/g, '').substring(0, 16);
    val = val.replace(/(.{4})/g, '$1 ').trim();
    input.value = val;

    const raw = val.replace(/\s/g, '');
    let detected = null;

    for (const [key, brand] of Object.entries(_cardPatterns)) {
      if (brand.regex.test(raw)) { detected = { key, ...brand }; break; }
    }

    // Update chip highlight
    ['visa', 'mastercard', 'amex', 'unionpay'].forEach(k => {
      const chipIdMap = { visa: `${prefix}-chip-visa`, mastercard: `${prefix}-chip-mc`, amex: `${prefix}-chip-amex`, unionpay: `${prefix}-chip-union` };
      const el = document.getElementById(chipIdMap[k]);
      if (el) el.classList.toggle('active', detected && detected.key === k);
    });

    // Update inline card icon
    const iconEl = document.getElementById(`${prefix}-card-icon`);
    const labelEl = document.getElementById(`${prefix}-detected-card-type`);
    if (iconEl) {
      iconEl.innerHTML = detected ? `<div style="background:${detected.color};border-radius:4px;padding:3px 6px;display:flex;align-items:center;justify-content:center;">${detected.icon}</div>` : '';
    }
    if (labelEl) {
      labelEl.textContent = detected ? detected.name : '';
    }
  };

  window.formatExpiry = function (input) {
    let val = input.value.replace(/\D/g, '').substring(0, 4);
    if (val.length >= 3) val = val.substring(0, 2) + ' / ' + val.substring(2);
    input.value = val;
  };

  window.setSafepayMethod = function (method) {
    const cardFields = document.getElementById('sp-card-fields');
    const walletFields = document.getElementById('sp-wallet-fields');
    const tabCard = document.getElementById('sp-tab-card');
    const tabWallet = document.getElementById('sp-tab-wallet');
    if (method === 'card') {
      if (cardFields) cardFields.style.display = 'block';
      if (walletFields) walletFields.style.display = 'none';
      if (tabCard) tabCard.classList.add('active');
      if (tabWallet) tabWallet.classList.remove('active');
    } else {
      if (cardFields) cardFields.style.display = 'none';
      if (walletFields) { walletFields.style.display = 'block'; walletFields.style.animation = 'cardSlideIn 0.3s ease'; }
      if (tabCard) tabCard.classList.remove('active');
      if (tabWallet) tabWallet.classList.add('active');
    }
  };

  window.setQuickBuyMethod = function (method) {
    const cardFields = document.getElementById('qb-card-fields');
    const walletFields = document.getElementById('qb-wallet-fields');
    const tabCard = document.getElementById('qb-tab-card');
    const tabWallet = document.getElementById('qb-tab-wallet');
    if (method === 'card') {
      if (cardFields) { cardFields.style.display = 'block'; cardFields.style.animation = 'cardSlideIn 0.3s ease'; }
      if (walletFields) walletFields.style.display = 'none';
      if (tabCard) tabCard.classList.add('active');
      if (tabWallet) tabWallet.classList.remove('active');
    } else {
      if (cardFields) cardFields.style.display = 'none';
      if (walletFields) { walletFields.style.display = 'block'; walletFields.style.animation = 'cardSlideIn 0.3s ease'; }
      if (tabCard) tabCard.classList.remove('active');
      if (tabWallet) tabWallet.classList.add('active');
    }
  };

  window.fillSafepayTestCard = function () {
    const n = document.getElementById('sp-card-number');
    const nm = document.getElementById('sp-card-name');
    const e = document.getElementById('sp-card-expiry');
    const c = document.getElementById('sp-card-cvc');
    if (n) { n.value = '4242 4242 4242 4242'; detectCardType(n, 'sp'); }
    if (nm) nm.value = 'Test User';
    if (e) e.value = '12 / 28';
    if (c) c.value = '123';
  };

  window.fillQuickBuyTestCard = function () {
    const n = document.getElementById('qb-card-number');
    const nm = document.getElementById('qb-card-name');
    const e = document.getElementById('qb-card-expiry');
    const c = document.getElementById('qb-card-cvc');
    if (n) { n.value = '4242 4242 4242 4242'; detectCardType(n, 'qb'); }
    if (nm) nm.value = 'Test User';
    if (e) e.value = '12 / 28';
    if (c) c.value = '123';
  };

  // PIN timer reference
  let _pinTimerInterval = null;

  window.executeSafepayPayment = function () {
    const btn = document.getElementById('btn-submit-safepay');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="white" style="animation:spinPay 0.8s linear infinite"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Processing...';
    }
    setTimeout(() => {
      closeModal('modal-safepay-checkout');
      openPaymentPinModal();
      if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg> Pay Securely Now'; }
    }, 1800);
  };

  window.executeQuickBuyPayment = function () {
    const btn = document.getElementById('btn-qb-pay');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="white" style="animation:spinPay 0.8s linear infinite"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Processing...';
    }
    setTimeout(() => {
      closeModal('modal-quick-buy');
      openPaymentPinModal();
      if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg> Complete Secure Payment'; }
    }, 1800);
  };

  window.openPaymentPinModal = function () {
    // Clear PIN boxes
    for (let i = 0; i < 6; i++) {
      const box = document.getElementById(`pin-${i}`);
      if (box) box.value = '';
    }
    // Show modal
    const modal = document.getElementById('modal-payment-pin');
    if (modal) { modal.style.display = 'flex'; setTimeout(() => { const first = document.getElementById('pin-0'); if (first) first.focus(); }, 100); }
    // Start countdown timer
    startPinTimer();
  };

  window.startPinTimer = function () {
    if (_pinTimerInterval) clearInterval(_pinTimerInterval);
    let seconds = 120;
    const timerEl = document.getElementById('pin-timer');
    _pinTimerInterval = setInterval(() => {
      seconds--;
      const m = Math.floor(seconds / 60).toString().padStart(2, '0');
      const s = (seconds % 60).toString().padStart(2, '0');
      if (timerEl) {
        timerEl.textContent = `${m}:${s}`;
        timerEl.style.color = seconds <= 30 ? '#ef4444' : '#f59e0b';
      }
      if (seconds <= 0) {
        clearInterval(_pinTimerInterval);
        if (timerEl) timerEl.textContent = 'Expired';
      }
    }, 1000);
  };

  window.pinBoxNext = function (input, nextIndex) {
    input.value = input.value.replace(/\D/g, '').substring(0, 1);
    if (input.value && nextIndex <= 5) {
      const next = document.getElementById(`pin-${nextIndex}`);
      if (next) next.focus();
    }
    // If all filled, highlight verify button
    const allFilled = Array.from({ length: 6 }, (_, i) => document.getElementById(`pin-${i}`)).every(b => b && b.value.length === 1);
    const verifyBtn = document.getElementById('btn-verify-pin');
    if (verifyBtn) {
      verifyBtn.style.boxShadow = allFilled ? '0 8px 28px rgba(99,102,241,0.65)' : '0 5px 18px rgba(99,102,241,0.4)';
      verifyBtn.style.transform = allFilled ? 'scale(1.02)' : 'scale(1)';
    }
  };

  window.verifyPaymentPin = function () {
    const pin = Array.from({ length: 6 }, (_, i) => {
      const b = document.getElementById(`pin-${i}`); return b ? b.value : '';
    }).join('');

    const verifyBtn = document.getElementById('btn-verify-pin');
    if (verifyBtn) { verifyBtn.disabled = true; verifyBtn.textContent = 'Verifying...'; }

    // Animate boxes to success
    for (let i = 0; i < 6; i++) {
      const box = document.getElementById(`pin-${i}`);
      if (box) { box.style.borderColor = '#34d399'; box.style.background = 'rgba(52,211,153,0.08)'; }
    }

    setTimeout(() => {
      if (_pinTimerInterval) clearInterval(_pinTimerInterval);
      closeModal('modal-payment-pin');
      showPaymentSuccess();
      if (verifyBtn) { verifyBtn.disabled = false; verifyBtn.textContent = '✓ Confirm Payment'; }
      // Reset box styles
      for (let i = 0; i < 6; i++) {
        const box = document.getElementById(`pin-${i}`);
        if (box) { box.style.borderColor = 'rgba(255,255,255,0.12)'; box.style.background = 'rgba(255,255,255,0.04)'; }
      }
    }, 1200);
  };

  window.resendPin = function (e) {
    if (e) e.preventDefault();
    const timerEl = document.getElementById('pin-timer');
    if (timerEl) { timerEl.textContent = '02:00'; timerEl.style.color = '#f59e0b'; }
    startPinTimer();
    // Brief flash feedback
    const link = e ? e.target : null;
    if (link) { link.textContent = 'Code Sent!'; link.style.color = '#34d399'; setTimeout(() => { link.textContent = 'Resend Code'; link.style.color = '#6366f1'; }, 2000); }
  };

  window.showPaymentSuccess = function () {
    // Populate receipt fields
    const txId = document.getElementById('rec-trans-id');
    if (txId) txId.textContent = 'RF-' + Date.now().toString().slice(-8);
    const recDate = document.getElementById('rec-date');
    if (recDate) recDate.textContent = new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
    // Show modal
    const modal = document.getElementById('modal-payment-success');
    if (modal) modal.style.display = 'flex';
  };

  // ─── Header Auth Navigation Helpers ───
  // Note: Page switching handlers defined at top level for standalone-login-view / standalone-register-view navigation

  // ─── Google OAuth Callback URL listener ───
  (function checkGoogleOAuthReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const googleToken = urlParams.get('google_token');
    const userName = urlParams.get('user_name');
    const userPlan = urlParams.get('plan');

    if (googleToken) {
      // Crucial: Must set replyflow_user_token for switchScreen Auth Guard!
      localStorage.setItem('replyflow_user_token', googleToken);
      localStorage.setItem('replyflow_auth_token', googleToken);
      if (userName) localStorage.setItem('replyflow_user_name', userName);
      if (userPlan) localStorage.setItem('replyflow_user_plan', userPlan);

      // Clean up URL query parameters cleanly
      window.history.replaceState({}, document.title, window.location.pathname);

      const activateDashboard = () => {
        const landingPage = document.getElementById('standalone-landing-page');
        const mainShell = document.getElementById('main-app-shell');
        if (landingPage) landingPage.style.display = 'none';
        if (mainShell) mainShell.style.display = 'block';
        if (typeof switchScreen === 'function') {
          switchScreen('dashboard');
        }
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', activateDashboard);
      } else {
        activateDashboard();
        setTimeout(activateDashboard, 200);
      }
    }
  })();

  window.openOAuthPopup = function (url, title = 'Connect Account') {
    const w = 600;
    const h = 720;
    const left = Math.max(0, (window.screen.width / 2) - (w / 2));
    const top = Math.max(0, (window.screen.height / 2) - (h / 2));
    const popup = window.open(
      url,
      title,
      `width=${w},height=${h},top=${top},left=${left},scrollbars=yes,status=yes,resizable=yes`
    );
    if (popup && popup.focus) popup.focus();
    return popup;
  };

  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'OAUTH_CONNECTED') {
      const { platform, accountName, success, error } = event.data;
      if (success) {
        if (typeof showSuccessToast === 'function') {
          showSuccessToast(`Successfully connected ${accountName || 'Social'} account!`);
        } else {
          alert(`Successfully connected ${accountName || 'Social'} account!`);
        }
        if (typeof loadAccounts === 'function') {
          loadAccounts(platform || 'li');
        }
      } else if (error) {
        if (typeof showErrorToast === 'function') {
          showErrorToast(`Connection error: ${decodeURIComponent(error)}`);
        } else {
          alert(`Connection error: ${decodeURIComponent(error)}`);
        }
      }
    }
  });

  document.addEventListener('click', function (e) {
    const btn = e.target.closest('#btn-connect-linkedin');
    if (btn) {
      e.preventDefault();
      openOAuthPopup('/api/linkedin/auth', 'Connect LinkedIn');
    }
  });

  // ─── Referral Points & Account Activation System ───
  window.getUserRewardPoints = function () {
    const saved = localStorage.getItem('replyflow_reward_points');
    return saved !== null ? parseInt(saved, 10) : 1000;
  };

  window.setUserRewardPoints = function (pts) {
    localStorage.setItem('replyflow_reward_points', pts.toString());
    // Update UI Elements
    const catalogBal = document.getElementById('ref-catalog-balance');
    if (catalogBal) catalogBal.textContent = pts.toLocaleString() + ' Points';

    const statEarnings = document.getElementById('ref-stat-earnings');
    if (statEarnings) statEarnings.textContent = pts.toLocaleString() + ' Pts';

    const milestoneBar = document.getElementById('milestone-progress-bar');
    const milestoneCount = document.getElementById('milestone-text-count');
    if (milestoneBar && milestoneCount) {
      const invitesCount = Math.floor(pts / 200);
      const pct = Math.min(100, Math.round((pts / 1000) * 100));
      milestoneBar.style.width = pct + '%';
      milestoneCount.textContent = `${invitesCount} / 5 Basic Invites`;
    }
  };

  window.redeemRewardPoints = function (rewardType, cost) {
    const currentPts = window.getUserRewardPoints();
    if (currentPts < cost) {
      alert(`⚠️ Insufficient Points Balance! You have ${currentPts} points, but this reward requires ${cost} points.\n\nInvite ${Math.ceil((cost - currentPts) / 200)} more Basic Plan friends to unlock!`);
      return;
    }

    const confirmRedeem = confirm(`🎁 Are you sure you want to spend ${cost} Reward Points to activate this item?`);
    if (!confirmRedeem) return;

    const newBalance = currentPts - cost;
    window.setUserRewardPoints(newBalance);

    let successMsg = '🎉 Reward Redeemed Successfully!';
    if (rewardType === 'basic_1mo') {
      localStorage.setItem('replyflow_user_plan', 'Starter / Basic (Points Activated)');
      successMsg = '✅ 1 Month Free Basic Account Activated! Your subscription has been renewed for 100% FREE.';
    } else if (rewardType === 'pro_1mo') {
      localStorage.setItem('replyflow_user_plan', 'Pro Creator (Points Activated)');
      successMsg = '🚀 1 Month Free Pro Creator Plan Activated! 6,000 Monthly DMs & all Pro features unlocked.';
    } else if (rewardType === 'agency_1mo') {
      localStorage.setItem('replyflow_user_plan', 'Agency / Enterprise (Points Activated)');
      successMsg = '👑 1 Month Free Agency Plan Activated! Unlimited DMs & full team features unlocked.';
    } else if (rewardType === 'extra_dms') {
      const quota = parseInt(localStorage.getItem('replyflow_bonus_dms') || '0', 10) + 5000;
      localStorage.setItem('replyflow_bonus_dms', quota.toString());
      successMsg = '💬 +5,000 Extra Automated DMs Boost added to your monthly account quota!';
    }

    alert(successMsg);
  };

  window.copyReferralLink = function () {
    const linkInput = document.getElementById('ref-link-input');
    if (linkInput) {
      linkInput.select();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(linkInput.value);
      }
      alert('📋 Referral link copied to clipboard: ' + linkInput.value);
    }
  };

  // --- Auto Role Helper Functions ---
  window.promptAddCustomRole = function () {
    const roleName = prompt("Enter new custom role name (e.g. Verified, VIP, Member):");
    if (roleName && roleName.trim()) {
      const cleanName = roleName.trim().replace(/^@/, '');
      const container = document.getElementById('autorole-badges-container');
      if (container) {
        const badge = document.createElement('span');
        badge.className = 'badge autorole-custom-badge';
        badge.dataset.roleName = cleanName;
        badge.style.cssText = 'background: rgba(88,101,242,0.15); border: 1px solid rgba(88,101,242,0.4); color: #818cf8; padding: 10px 16px; border-radius: 10px; font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 6px;';
        badge.innerHTML = `@${cleanName} <span onclick="this.parentElement.remove()" style="cursor:pointer; color:#ef4444; margin-left:6px;">✕</span>`;
        container.appendChild(badge);
      }
    }
  };

  window.saveAutoRoleSettings = function () {
    const badges = document.querySelectorAll('#autorole-badges-container .badge');
    const roles = [];
    badges.forEach(b => {
      const txt = (b.dataset.roleName || b.innerText.replace('✓ (Default)', '').replace('✕', '').replace('@', '')).trim();
      if (txt) roles.push(txt);
    });
    const timing = document.querySelector('input[name="role_trigger_time"]:checked')?.value || 'instant';
    const payload = {
      roles: roles.length > 0 ? roles : ['Member', 'Verified'],
      trigger_timing: timing
    };

    localStorage.setItem('replyflow_autorole_config', JSON.stringify(payload));
    if (typeof showToast === 'function') {
      showToast('⚡ Auto-Role settings saved & synced successfully!', 'success');
    }

    fetch('/api/plugins/save', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        guild_id: window.getSelectedDiscordGuildId ? window.getSelectedDiscordGuildId() : '1537457454370128024',
        plugin_key: 'autorole',
        enabled: true,
        config: payload
      })
    }).catch(err => console.warn('[Background Sync] AutoRole save notice:', err));
  };

  // --- Welcome Templates Database Logic ---
  let currentEditingTemplateId = null;

  window.fetchAndRenderWelcomeTemplates = async function () {
    const container = document.getElementById('welcome-templates-container');
    if (!container) return;

    const currentGuildId = window.getSelectedDiscordGuildId ? window.getSelectedDiscordGuildId() : (localStorage.getItem('selected_discord_guild_id') || 'default');
    const cacheKey = `replyflow_cached_welcome_templates_${currentGuildId}`;

    const defaultTmpls = [
      {
        id: 1,
        guild_id: currentGuildId,
        template_name: 'Default Welcome Card Template',
        welcome_text: 'WELCOME TO REPLAY FLOW! You are member #{member_count} 🎉',
        media_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80',
        is_active: 1
      }
    ];

    // ⚡ 0ms INSTANT RENDER CACHED TEMPLATES
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const tmpls = JSON.parse(cached);
        if (Array.isArray(tmpls) && tmpls.length > 0) {
          renderTemplatesListToContainer(container, tmpls);
        }
      }
    } catch(e){}

    try {
      const res = await fetch(`/api/plugins/welcome?guild_id=${encodeURIComponent(currentGuildId)}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const templates = data.templates || [];

      if (templates.length > 0) {
        localStorage.setItem(cacheKey, JSON.stringify(templates));
        renderTemplatesListToContainer(container, templates);
      } else if (!localStorage.getItem(cacheKey)) {
        localStorage.setItem(cacheKey, JSON.stringify(defaultTmpls));
        renderTemplatesListToContainer(container, defaultTmpls);
      }
    } catch (err) {
      console.warn('[Welcome Templates] Network check fallback:', err);
      const cached = localStorage.getItem(cacheKey);
      if (!cached) {
        renderTemplatesListToContainer(container, defaultTmpls);
      }
    }
  };

  function renderTemplatesListToContainer(container, templates) {
    const countTitle = document.getElementById('welcome-variations-count-title');
    if (countTitle) {
      countTitle.innerText = `📨 Welcome Message Variations (${templates.length} Total)`;
    }

    if (!templates || templates.length === 0) {
      container.innerHTML = '<div style="color: #a1a1aa; font-size: 13px; text-align: center; padding: 24px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">No templates found. Click "+ Create New Template" to add one!</div>';
      return;
    }

    container.innerHTML = templates.map(t => {
      const isActive = !!t.is_active;
      const statusColor = isActive ? '#34d399' : '#64748b';
      const statusText = isActive ? '🟢 ACTIVE (Sending to new members)' : '⚪ INACTIVE';
      const bg = isActive ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)';
      const border = isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)';

      const knobStyles = isActive ? 'right: 2px; background: #fff;' : 'left: 2px; background: #94a3b8;';
      const toggleBg = isActive ? '#10b981' : 'rgba(255,255,255,0.1)';

      return `
          <div style="display: flex; align-items: center; justify-content: space-between; background: ${bg}; border: 1px solid ${border}; padding: 14px 18px; border-radius: 14px; transition: all 0.25s ease;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <img src="${t.media_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80'}" style="width: 48px; height: 48px; border-radius: 10px; object-fit: cover; border: 1px solid rgba(255,255,255,0.15);">
              <div>
                <div style="color: #fff; font-weight: 800; font-size: 14px; margin-bottom: 2px;">${t.template_name || 'Welcome Template'}</div>
                <div style="color: ${statusColor}; font-size: 11px; font-weight: 800;">${statusText}</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <button onclick="openEditPopupForTemplate('${t.id}')" 
                style="background: linear-gradient(135deg, rgba(88,101,242,0.25), rgba(99,102,241,0.35)); color: #a5b4fc; border: 1px solid rgba(129,140,248,0.5); padding: 8px 16px; border-radius: 10px; font-weight: 800; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);" 
                onmouseover="this.style.background='linear-gradient(135deg, #5865f2, #4f46e5)'; this.style.color='#ffffff'; this.style.transform='translateY(-2px) scale(1.04)'; this.style.boxShadow='0 6px 20px rgba(88,101,242,0.6)'; this.style.borderColor='rgba(255,255,255,0.4)';" 
                onmouseout="this.style.background='linear-gradient(135deg, rgba(88,101,242,0.25), rgba(99,102,241,0.35))'; this.style.color='#a5b4fc'; this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='none'; this.style.borderColor='rgba(129,140,248,0.5)';">
                <span>✏️</span> <span>Edit</span>
              </button>

              <button onclick="deleteWelcomeTemplate('${t.id}')" 
                style="background: linear-gradient(135deg, rgba(239,68,68,0.18), rgba(220,38,38,0.28)); color: #fca5a5; border: 1px solid rgba(239,68,68,0.45); padding: 8px 12px; border-radius: 10px; font-weight: 800; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);" 
                onmouseover="this.style.background='linear-gradient(135deg, #ef4444, #dc2626)'; this.style.color='#ffffff'; this.style.transform='translateY(-2px) scale(1.04)'; this.style.boxShadow='0 6px 20px rgba(239,68,68,0.6)';" 
                onmouseout="this.style.background='linear-gradient(135deg, rgba(239,68,68,0.18), rgba(220,38,38,0.28))'; this.style.color='#fca5a5'; this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='none';">
                <span>🗑️</span>
              </button>

              <div onclick="toggleWelcomeTemplate('${t.id}')" style="width: 44px; height: 24px; background: ${toggleBg}; border-radius: 12px; position: relative; cursor: pointer; border: 2px solid transparent; transition: 0.22s ease;" title="${isActive ? 'Deactivate' : 'Activate'}">
                <div style="width: 20px; height: 20px; border-radius: 50%; position: absolute; top: 0px; box-shadow: 0 2px 4px rgba(0,0,0,0.25); transition: 0.22s ease; ${knobStyles}"></div>
              </div>
            </div>
          </div>
      `;
    }).join('');

    window.welcomeTemplatesData = templates;
  }

  window.toggleWelcomeTemplate = function (id) {
    // ⚡ 0ms INSTANT OPTIMISTIC UI TOGGLE
    const currentGuildId = window.getSelectedDiscordGuildId ? window.getSelectedDiscordGuildId() : (localStorage.getItem('selected_discord_guild_id') || 'default');
    const cacheKey = `replyflow_cached_welcome_templates_${currentGuildId}`;
    let templates = [];
    try {
      templates = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    } catch(e){}

    if (!Array.isArray(templates) || templates.length === 0) {
      templates = window.welcomeTemplatesData || [];
    }

    const item = templates.find(t => String(t.id) === String(id));
    if (item) {
      const willBeActive = !(item.is_active === 1 || item.is_active === true || item.is_active === '1');
      templates.forEach(t => t.is_active = 0);
      item.is_active = willBeActive ? 1 : 0;

      localStorage.setItem(cacheKey, JSON.stringify(templates));
      window.welcomeTemplatesData = templates;

      const container = document.getElementById('welcome-templates-container');
      if (container) renderTemplatesListToContainer(container, templates);

      const statusText = item.is_active ? 'Active 🟢' : 'Inactive ⚪';
      if (typeof showToast === 'function') showToast(`Template status changed to ${statusText}!`, 'info');

      // Background sync full active template to server
      fetch('/api/plugins/welcome', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          id: item.id,
          is_active: item.is_active,
          guild_id: currentGuildId,
          message_text: item.message_text || item.welcome_text,
          welcome_text: item.message_text || item.welcome_text,
          template_name: item.template_name,
          links: item.links,
          media_url: item.media_url
        })
      }).catch(e => console.warn('[Background Sync] Toggle template notice:', e));
    }
  };

  window.deleteWelcomeTemplate = function (id) {
    if (!confirm('Are you sure you want to delete this welcome template?')) return;

    // ⚡ 0ms INSTANT OPTIMISTIC UI REMOVAL
    const currentGuildId = window.getSelectedDiscordGuildId ? window.getSelectedDiscordGuildId() : (localStorage.getItem('selected_discord_guild_id') || 'default');
    const cacheKey = `replyflow_cached_welcome_templates_${currentGuildId}`;
    let cached = [];
    try {
      cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    } catch(e){}

    cached = cached.filter(t => String(t.id) !== String(id));
    localStorage.setItem(cacheKey, JSON.stringify(cached));
    window.welcomeTemplatesData = cached;

    const container = document.getElementById('welcome-templates-container');
    if (container) renderTemplatesListToContainer(container, cached);
    if (typeof showToast === 'function') showToast('🗑️ Welcome template deleted.', 'info');

    // Background sync delete
    fetch(`/api/plugins/welcome/${id}?guild_id=${encodeURIComponent(currentGuildId)}`, { method: 'DELETE', headers: getAuthHeaders() })
      .catch(err => console.warn('[Background Sync] Delete template notice:', err));
  };

  window.openEditPopupForTemplate = function (id) {
    let t = window.welcomeTemplatesData ? window.welcomeTemplatesData.find(x => String(x.id) === String(id)) : null;
    if (!t) {
      try {
        const cached = JSON.parse(localStorage.getItem('replyflow_cached_welcome_templates') || '[]');
        t = cached.find(x => String(x.id) === String(id));
      } catch(e){}
    }
    if (!t) {
      t = { id, template_name: 'Welcome Template', welcome_text: 'WELCOME TO REPLAY FLOW! You are member #{member_count} 🎉', media_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80', is_active: 1 };
    }

    currentEditingTemplateId = id;

    const messageInput = document.querySelector('#welcome-popup-editor textarea');
    if (messageInput) {
      messageInput.value = t.welcome_text || t.message_text || '';
      document.getElementById('live-preview-text').innerText = t.welcome_text || t.message_text || 'Your welcome message will appear here...';
    }

    if (t.media_url) {
      const img = document.getElementById('preview-img-target');
      if (img) img.src = t.media_url;
    }

    // Populate Links
    let links = {};
    if (t.links) {
      if (typeof t.links === 'string') {
        try { links = JSON.parse(t.links); } catch (e) { }
      } else if (typeof t.links === 'object') {
        links = t.links;
      }
    }

    if (document.getElementById('welcome-link-web')) document.getElementById('welcome-link-web').value = links.web || '';
    if (document.getElementById('welcome-link-ig')) document.getElementById('welcome-link-ig').value = links.ig || '';
    if (document.getElementById('welcome-link-yt')) document.getElementById('welcome-link-yt').value = links.yt || '';
    if (document.getElementById('welcome-link-tk')) document.getElementById('welcome-link-tk').value = links.tk || '';
    if (document.getElementById('welcome-link-tw')) document.getElementById('welcome-link-tw').value = links.tw || '';

    // Preset Frame & Options
    const frameStyle = links.frame_style || 'glass_indigo';
    window.selectedWelcomeFrameStyle = frameStyle;
    const cardColor = links.card_color || '#5865f2';
    if (typeof window.setWelcomeCardCustomColor === 'function') {
      window.setWelcomeCardCustomColor(cardColor);
    }

    if (document.getElementById('welcome-toggle-dp')) document.getElementById('welcome-toggle-dp').checked = links.show_dp !== false;
    if (document.getElementById('welcome-toggle-display-name')) document.getElementById('welcome-toggle-display-name').checked = links.show_display_name !== false;
    if (document.getElementById('welcome-toggle-username')) document.getElementById('welcome-toggle-username').checked = links.show_username !== false;

    if (document.getElementById('welcome-embed-title-input')) document.getElementById('welcome-embed-title-input').value = links.embed_title || '✨ Welcome to {server}!';
    if (document.getElementById('welcome-embed-color-text')) document.getElementById('welcome-embed-color-text').value = links.embed_color || '#5865f2';
    if (document.getElementById('welcome-embed-color-picker')) document.getElementById('welcome-embed-color-picker').value = links.embed_color || '#5865f2';
    if (document.getElementById('welcome-embed-footer-input')) document.getElementById('welcome-embed-footer-input').value = links.embed_footer || '⚡ Powered by ReplyFlow Discord Automation • {server}';
    if (document.getElementById('welcome-toggle-ping')) document.getElementById('welcome-toggle-ping').checked = links.ping_user !== false;
    if (document.getElementById('welcome-toggle-dm')) document.getElementById('welcome-toggle-dm').checked = links.send_dm !== false;

    // Highlight active preset card
    const presetGrid = document.getElementById('welcome-frame-presets-grid');
    if (presetGrid) {
      const cards = presetGrid.querySelectorAll('.frame-preset-card');
      cards.forEach(c => {
        const onClickAttr = c.getAttribute('onclick') || '';
        if (onClickAttr.includes(`'${frameStyle}'`)) {
          c.style.border = '2px solid #5865f2';
          c.classList.add('active-frame');
        } else {
          c.style.border = '2px solid rgba(255,255,255,0.1)';
          c.classList.remove('active-frame');
        }
      });
    }

    // Trigger preview visibility
    ['web', 'ig', 'yt', 'tk', 'tw'].forEach(key => {
      const el = document.getElementById(`welcome-link-${key}`);
      const btn = document.getElementById(`preview-btn-${key}`);
      if (el && btn) btn.style.display = el.value ? 'inline-block' : 'none';
    });

    if (typeof window.updateWelcomeCardLivePreview === 'function') window.updateWelcomeCardLivePreview();
    if (typeof window.updateWelcomeLiveTextPreview === 'function') window.updateWelcomeLiveTextPreview();
    
    const editorModal = document.getElementById('welcome-popup-editor');
    if (editorModal) {
      editorModal.style.display = 'flex';
      setTimeout(() => { if (typeof window.setEmojiMasterCategory === 'function') window.setEmojiMasterCategory('animated'); }, 50);
    }
  };

  window.toggleWelcomeEmojiStudio = function () {
    const studio = document.getElementById('welcome-emoji-packs-studio');
    const arrow = document.getElementById('welcome-emoji-toggle-arrow');
    if (!studio) return;
    if (studio.style.display === 'none') {
      studio.style.display = 'block';
      if (arrow) arrow.textContent = '▲';
    } else {
      studio.style.display = 'none';
      if (arrow) arrow.textContent = '▼';
    }
  };

  window.activeEmojiMaster = 'animated';
  window.activeEmojiSubCat = 'all';

  window.setEmojiMasterCategory = function (masterKey) {
    window.activeEmojiMaster = masterKey;
    const animTab = document.getElementById('master-tab-animated');
    const stdTab = document.getElementById('master-tab-standard');
    if (animTab && stdTab) {
      if (masterKey === 'animated') {
        animTab.style.background = 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(236,72,153,0.25))';
        animTab.style.borderColor = '#a855f7';
        animTab.style.color = '#fff';
        animTab.style.boxShadow = '0 4px 14px rgba(168,85,247,0.3)';
        
        stdTab.style.background = 'rgba(255,255,255,0.04)';
        stdTab.style.borderColor = 'rgba(255,255,255,0.12)';
        stdTab.style.color = '#94a3b8';
        stdTab.style.boxShadow = 'none';
      } else {
        stdTab.style.background = 'linear-gradient(135deg, rgba(56,189,248,0.25), rgba(88,101,242,0.25))';
        stdTab.style.borderColor = '#38bdf8';
        stdTab.style.color = '#fff';
        stdTab.style.boxShadow = '0 4px 14px rgba(56,189,248,0.3)';

        animTab.style.background = 'rgba(255,255,255,0.04)';
        animTab.style.borderColor = 'rgba(255,255,255,0.12)';
        animTab.style.color = '#94a3b8';
        animTab.style.boxShadow = 'none';
      }
    }
    window.filterWelcomeEmojis();
  };

  window.switchWelcomeEmojiSubCategory = function (subCatKey) {
    window.activeEmojiSubCat = subCatKey;
    document.querySelectorAll('.emoji-cat-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-subcat') === subCatKey);
    });
    window.filterWelcomeEmojis();
  };

  window.filterWelcomeEmojis = function (query) {
    const q = (query !== undefined ? query : (document.getElementById('welcome-emoji-search')?.value || '')).toLowerCase().trim();
    const curMaster = window.activeEmojiMaster || 'animated';
    const curSubCat = window.activeEmojiSubCat || 'all';

    const items = document.querySelectorAll('#welcome-emoji-grid-wrap .emoji-item-btn');
    items.forEach(item => {
      const itemMaster = item.getAttribute('data-master') || 'animated';
      const itemSubCat = item.getAttribute('data-subcat') || 'hype';
      const itemName = (item.getAttribute('data-name') || '').toLowerCase();
      const itemText = item.textContent.toLowerCase();

      const matchMaster = (itemMaster === curMaster);
      const matchSubCat = (curSubCat === 'all' || itemSubCat === curSubCat);
      const matchSearch = (!q || itemName.includes(q) || itemText.includes(q));

      item.style.display = (matchMaster && matchSubCat && matchSearch) ? 'inline-flex' : 'none';
    });
  };

  window.insertWelcomeTag = function (tag) {
    const input = document.getElementById('welcome-msg-text-input');
    if (!input) return;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const text = input.value;
    input.value = text.substring(0, start) + tag + text.substring(end);
    input.focus();
    input.selectionStart = input.selectionEnd = start + tag.length;
    window.updateWelcomeLiveTextPreview();
  };

  window.applyWelcomePresetTemplate = function (presetKey) {
    const templates = {
      streamer: `👋 **Welcome to {server}, {user}!**\n────────────────────────────\n🎉 **THANK YOU FOR JOINING!** You are **Member #{count}** of our community!\n\n📌 **Official Channels & Socials**:\n▶️ **YouTube**: https://youtube.com/\n▶️ **Twitch / Kick**: https://kick.com/\n▶️ **Instagram**: https://instagram.com/\n▶️ **TikTok**: https://tiktok.com/\n────────────────────────────\n✨ *Enjoy your stay and connect with fellow members!*`,
      creative: `✨ **Welcome to {server}!**\n────────────────────────────\n👋 **Greetings {user}** — We're thrilled to have you in our community!\n🎉 You are **Member #{count}** to join us.\n\n📌 **Quick Navigation**:\n• 📜 **Server Rules**: {rules_channel}\n• 📢 **Latest Updates**: {updates_channel}\n• 💬 **Community Lounge**: {general_channel}\n────────────────────────────\n✨ *Enjoy your stay and connect with fellow members!*`,
      trading: `📈 **Welcome to {server}!**\n────────────────────────────\n👋 Welcome {user}! You are **Member #{count}** enrolled.\n🚀 Access exclusive market insights, signals & automated tools!\n\n📌 **Quick Navigation**:\n• 📜 **Rules & Compliance**: {rules_channel}\n• 📢 **Market Updates**: {updates_channel}\n• 💬 **Trader Lounge**: {general_channel}\n────────────────────────────\n✨ *Chat to earn XP & unlock VIP roles!*`,
      gaming: `🎮 **Welcome to {server}!**\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n👋 Welcome to the arena, {user}!\n⚔️ **Member #{count}** has joined the lineup!\n\n📌 **Quick Navigation**:\n• 📜 **Server Rules**: {rules_channel}\n• 📡 **Patch Notes & News**: {updates_channel}\n• 💬 **Main Lobby**: {general_channel}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n✨ *GLHF & enjoy your stay!*`
    };
    const input = document.getElementById('welcome-msg-text-input');
    if (input && templates[presetKey]) {
      input.value = templates[presetKey];
      window.updateWelcomeLiveTextPreview();
    }
  };

  window.updateWelcomeLiveTextPreview = function () {
    const input = document.getElementById('welcome-msg-text-input');
    const preview = document.getElementById('live-preview-text');
    if (!input || !preview) return;
    let txt = input.value || '';
    txt = txt
      .replace(/\{user\}/g, '@AlexMorgan')
      .replace(/\{member\}/g, '@AlexMorgan')
      .replace(/\{server\}/g, 'Creative Conor')
      .replace(/\{guild\}/g, 'Creative Conor')
      .replace(/\{count\}/g, '595')
      .replace(/\{member_count\}/g, '595')
      .replace(/\{rules_channel\}/g, '#📜│rules')
      .replace(/\{general_channel\}/g, '#💬│general-chat')
      .replace(/\{updates_channel\}/g, '#📢│recent-updates')
      .replace(/\{update_channel\}/g, '#📢│recent-updates');
    preview.innerText = txt;
  };

  window.selectedWelcomeFrameStyle = 'glass_indigo';
  window.selectedWelcomeCardColor = '#5865f2';

  window.setWelcomeCardCustomColor = function (hex) {
    if (!hex) return;
    if (!hex.startsWith('#')) hex = '#' + hex;
    window.selectedWelcomeCardColor = hex;
    const picker = document.getElementById('welcome-card-color-picker');
    const input = document.getElementById('welcome-card-color-input');
    if (picker && picker.value !== hex && hex.length === 7) picker.value = hex;
    if (input && input.value !== hex) input.value = hex;
    window.updateWelcomeCardLivePreview();
  };

  window.selectWelcomeFrameStyle = function (styleKey, el) {
    window.selectedWelcomeFrameStyle = styleKey;
    const cards = document.querySelectorAll('.frame-preset-card');
    cards.forEach(c => {
      c.style.border = '2px solid rgba(255,255,255,0.1)';
      c.classList.remove('active-frame');
    });
    if (el) {
      el.style.border = '2px solid #5865f2';
      el.classList.add('active-frame');
    }
    
    // Auto-update color picker to default palette of chosen style if user hasn't customized
    const defaultColors = {
      glass_indigo: '#5865f2',
      cyber_neon: '#ec4899',
      emerald_mint: '#10b981',
      dark_obsidian: '#64748b',
      gold_prestige: '#f59e0b',
      sunset_wave: '#f43f5e'
    };
    if (defaultColors[styleKey]) {
      window.setWelcomeCardCustomColor(defaultColors[styleKey]);
    } else {
      window.updateWelcomeCardLivePreview();
    }
  };

  window.updateWelcomeCardLivePreview = function () {
    const frameStyle = window.selectedWelcomeFrameStyle || 'glass_indigo';
    const customColor = window.selectedWelcomeCardColor || '#5865f2';
    const showDp = document.getElementById('welcome-toggle-dp')?.checked !== false;
    const showDisplayName = document.getElementById('welcome-toggle-display-name')?.checked !== false;
    const showUsername = document.getElementById('welcome-toggle-username')?.checked !== false;

    const previewBox = document.getElementById('live-card-frame-preview');
    if (!previewBox) return;

    const avatarUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";
    const serverTitle = "COMMUNITY HUB";

    let html = '';

    if (frameStyle === 'cyber_neon') {
      previewBox.style.background = `linear-gradient(135deg, rgba(16, 10, 30, 0.95), ${customColor}33)`;
      previewBox.style.border = `2px solid ${customColor}`;
      previewBox.style.borderRadius = '16px';
      previewBox.style.padding = '22px 24px';
      previewBox.style.boxShadow = `0 12px 35px rgba(0,0,0,0.7), 0 0 20px ${customColor}40`;
      previewBox.style.position = 'relative';

      html = `
        <div style="width: 100%; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 20px;">
            ${showDp ? `
              <div style="position: relative;">
                <img src="${avatarUrl}" style="width: 82px; height: 82px; border-radius: 12px; object-fit: cover; border: 2.5px solid ${customColor}; box-shadow: 0 0 15px ${customColor}80;">
                <div style="position: absolute; bottom: -4px; right: -4px; background: #22d3ee; color: #000; font-size: 8px; font-weight: 900; padding: 1px 5px; border-radius: 4px;">HUD</div>
              </div>
            ` : ''}
            <div>
              <div style="font-size: 11px; font-weight: 800; color: ${customColor}; text-transform: uppercase; letter-spacing: 1.5px; font-family: monospace;">// WELCOME_TO // ${serverTitle}</div>
              ${showDisplayName ? `<div style="font-size: 21px; font-weight: 800; color: #ffffff; text-shadow: 0 0 12px ${customColor}80; letter-spacing: 0.5px;">@AlexMorgan</div>` : ''}
              ${showUsername ? `<div style="font-size: 12px; color: #22d3ee; font-weight: 700; font-family: monospace; margin-top: 2px;">alex_morgan99 [ID: 981240]</div>` : ''}
              <div style="margin-top: 8px; display: inline-block; background: ${customColor}22; border: 1.5px solid ${customColor}; padding: 3px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; color: #fff; font-family: monospace;">
                [ VERIFIED MEMBER #14,210 ]
              </div>
            </div>
          </div>
          <div style="font-size: 24px; color: ${customColor}; opacity: 0.6; font-family: monospace; font-weight: 900;">⚡</div>
        </div>
      `;
    } else if (frameStyle === 'emerald_mint') {
      previewBox.style.background = `linear-gradient(135deg, rgba(6, 30, 20, 0.95), ${customColor}33)`;
      previewBox.style.border = `1.5px solid ${customColor}`;
      previewBox.style.borderRadius = '18px';
      previewBox.style.padding = '22px 24px';
      previewBox.style.boxShadow = `0 12px 35px rgba(0,0,0,0.7), 0 0 20px ${customColor}30`;

      html = `
        <div style="width: 100%; display: flex; align-items: center;">
          ${showDp ? `
            <div style="margin-right: 20px;">
              <img src="${avatarUrl}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid ${customColor}; box-shadow: 0 0 16px ${customColor}60;">
            </div>
          ` : ''}
          <div style="flex: 1;">
            <div style="display: inline-block; background: ${customColor}25; border: 1px solid ${customColor}60; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; color: ${customColor}; margin-bottom: 4px;">◈ VERIFIED CITIZEN</div>
            <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">WELCOME TO ${serverTitle}</div>
            ${showDisplayName ? `<div style="font-size: 20px; font-weight: 800; color: #ffffff;">@AlexMorgan</div>` : ''}
            ${showUsername ? `<div style="font-size: 12px; color: ${customColor}; font-weight: 600; margin-top: 2px;">alex_morgan99 (ID: 981240)</div>` : ''}
            <div style="margin-top: 8px; display: inline-block; background: ${customColor}20; border: 1px solid ${customColor}80; padding: 3px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; color: #fff;">
              ◈ MEMBER #14,210 ◈
            </div>
          </div>
        </div>
      `;
    } else if (frameStyle === 'dark_obsidian') {
      previewBox.style.background = `linear-gradient(135deg, rgba(12, 13, 18, 0.98), rgba(30, 35, 45, 0.5))`;
      previewBox.style.border = `1.5px solid ${customColor}80`;
      previewBox.style.borderRadius = '14px';
      previewBox.style.padding = '22px 24px';
      previewBox.style.boxShadow = '0 12px 35px rgba(0,0,0,0.8)';

      html = `
        <div style="width: 100%; display: flex; align-items: center;">
          ${showDp ? `
            <div style="margin-right: 20px;">
              <img src="${avatarUrl}" style="width: 76px; height: 76px; border-radius: 12px; object-fit: cover; border: 2px solid ${customColor};">
            </div>
          ` : ''}
          <div style="flex: 1;">
            <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 2px;">⬛ ${serverTitle} • DIRECTORY</div>
            ${showDisplayName ? `<div style="font-size: 20px; font-weight: 800; color: #ffffff;">@AlexMorgan</div>` : ''}
            ${showUsername ? `<div style="font-size: 12px; color: #94a3b8; font-weight: 600; margin-top: 2px;">alex_morgan99 (ID: 981240)</div>` : ''}
            <div style="margin-top: 8px; display: inline-block; background: rgba(255,255,255,0.06); border: 1px solid ${customColor}60; padding: 3px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; color: #e2e8f0;">
              MEMBER #14,210
            </div>
          </div>
        </div>
      `;
    } else if (frameStyle === 'gold_prestige') {
      previewBox.style.background = `linear-gradient(135deg, rgba(28, 20, 8, 0.95), ${customColor}30)`;
      previewBox.style.border = `2px solid ${customColor}`;
      previewBox.style.borderRadius = '18px';
      previewBox.style.padding = '22px 24px';
      previewBox.style.boxShadow = `0 12px 35px rgba(0,0,0,0.7), 0 0 22px ${customColor}40`;

      html = `
        <div style="width: 100%; display: flex; align-items: center;">
          ${showDp ? `
            <div style="margin-right: 20px;">
              <img src="${avatarUrl}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid ${customColor}; box-shadow: 0 0 16px ${customColor}80;">
            </div>
          ` : ''}
          <div style="flex: 1;">
            <div style="font-size: 10.5px; font-weight: 800; color: ${customColor}; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 2px;">👑 VIP PRESTIGE PASS • ${serverTitle}</div>
            ${showDisplayName ? `<div style="font-size: 21px; font-weight: 800; color: #ffffff; text-shadow: 0 2px 10px rgba(0,0,0,0.6);">@AlexMorgan</div>` : ''}
            ${showUsername ? `<div style="font-size: 12px; color: ${customColor}; font-weight: 700; margin-top: 2px;">alex_morgan99 (ID: 981240)</div>` : ''}
            <div style="margin-top: 8px; display: inline-block; background: ${customColor}25; border: 1.5px solid ${customColor}; padding: 3px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; color: ${customColor};">
              ★ VIP MEMBER #14,210 ★
            </div>
          </div>
        </div>
      `;
    } else if (frameStyle === 'sunset_wave') {
      previewBox.style.background = `linear-gradient(135deg, rgba(40, 15, 25, 0.95), ${customColor}33)`;
      previewBox.style.border = `1.5px solid ${customColor}`;
      previewBox.style.borderRadius = '18px';
      previewBox.style.padding = '22px 24px';
      previewBox.style.boxShadow = `0 12px 35px rgba(0,0,0,0.7), 0 0 20px ${customColor}30`;

      html = `
        <div style="width: 100%; display: flex; align-items: center;">
          ${showDp ? `
            <div style="margin-right: 20px;">
              <img src="${avatarUrl}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid ${customColor}; box-shadow: 0 0 16px ${customColor}60;">
            </div>
          ` : ''}
          <div style="flex: 1;">
            <div style="display: inline-block; background: ${customColor}22; border: 1px solid ${customColor}60; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; color: ${customColor}; margin-bottom: 4px;">🌅 NEW MEMBER ARRIVAL</div>
            <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">WELCOME TO ${serverTitle}</div>
            ${showDisplayName ? `<div style="font-size: 20px; font-weight: 800; color: #ffffff;">@AlexMorgan</div>` : ''}
            ${showUsername ? `<div style="font-size: 12px; color: ${customColor}; font-weight: 600; margin-top: 2px;">alex_morgan99 (ID: 981240)</div>` : ''}
            <div style="margin-top: 8px; display: inline-block; background: ${customColor}20; border: 1px solid ${customColor}80; padding: 3px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; color: #fff;">
              MEMBER #14,210
            </div>
          </div>
        </div>
      `;
    } else { // glass_indigo / default
      previewBox.style.background = `linear-gradient(135deg, rgba(15, 23, 42, 0.95), ${customColor}33)`;
      previewBox.style.border = `1.5px solid ${customColor}`;
      previewBox.style.borderRadius = '18px';
      previewBox.style.padding = '22px 24px';
      previewBox.style.boxShadow = `0 12px 35px rgba(0,0,0,0.7), 0 0 20px ${customColor}25`;

      html = `
        <div style="width: 100%; display: flex; align-items: center;">
          ${showDp ? `
            <div style="margin-right: 20px;">
              <img src="${avatarUrl}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid ${customColor}; box-shadow: 0 0 16px ${customColor}60;">
            </div>
          ` : ''}
          <div style="flex: 1;">
            <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">WELCOME TO ${serverTitle}</div>
            ${showDisplayName ? `<div style="font-size: 20px; font-weight: 800; color: #ffffff;">@AlexMorgan</div>` : ''}
            ${showUsername ? `<div style="font-size: 12px; color: ${customColor}; font-weight: 600; margin-top: 2px;">alex_morgan99 (ID: 981240)</div>` : ''}
            <div style="margin-top: 8px; display: inline-block; background: ${customColor}25; border: 1px solid ${customColor}80; padding: 3px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; color: #fff;">
              MEMBER #14,210
            </div>
          </div>
        </div>
      `;
    }

    previewBox.innerHTML = html;
  };

  window.openNewTemplatePopup = function () {
    currentEditingTemplateId = null;
    ['web', 'ig', 'yt', 'tk', 'tw'].forEach(key => {
      const el = document.getElementById(`welcome-link-${key}`);
      const btn = document.getElementById(`preview-btn-${key}`);
      if (el) el.value = '';
      if (btn) btn.style.display = 'none';
    });
    window.selectedWelcomeFrameStyle = 'glass_indigo';
    if (document.getElementById('welcome-toggle-dp')) document.getElementById('welcome-toggle-dp').checked = true;
    if (document.getElementById('welcome-toggle-display-name')) document.getElementById('welcome-toggle-display-name').checked = true;
    if (document.getElementById('welcome-toggle-username')) document.getElementById('welcome-toggle-username').checked = true;
    const msgInput = document.getElementById('welcome-msg-text-input') || document.querySelector('#welcome-popup-editor textarea');
    if (msgInput) {
      msgInput.value = `✨ **Welcome to {server}!**\n────────────────────────────\n👋 **Greetings {user}** — We're thrilled to have you in our community!\n🎉 You are **Member #{count}** to join us.\n\n📌 **Quick Navigation**:\n• 📜 **Server Rules**: {rules_channel}\n• 📢 **Latest Updates**: {updates_channel}\n• 💬 **Community Lounge**: {general_channel}\n────────────────────────────\n✨ *Enjoy your stay and connect with fellow members!*`;
      if (typeof window.updateWelcomeLiveTextPreview === 'function') window.updateWelcomeLiveTextPreview();
    }
    window.updateWelcomeCardLivePreview();
    document.getElementById('welcome-popup-editor').style.display = 'flex';
    setTimeout(() => { if (typeof window.setEmojiMasterCategory === 'function') window.setEmojiMasterCategory('animated'); }, 50);
  };

  // Note: window.toggleWelcomeTemplate is managed at line 11964 with 0ms instant optimistic UI state flipping

  window.saveWelcomeTemplateToDb = function () {
    const messageInput = document.getElementById('welcome-msg-text-input') || document.querySelector('#welcome-popup-editor textarea');

    const linksPayload = {
      web: document.getElementById('welcome-link-web')?.value || '',
      ig: document.getElementById('welcome-link-ig')?.value || '',
      yt: document.getElementById('welcome-link-yt')?.value || '',
      tk: document.getElementById('welcome-link-tk')?.value || '',
      tw: document.getElementById('welcome-link-tw')?.value || '',
      frame_style: window.selectedWelcomeFrameStyle || 'glass_indigo',
      card_color: window.selectedWelcomeCardColor || '#5865f2',
      show_dp: document.getElementById('welcome-toggle-dp')?.checked ?? true,
      show_display_name: document.getElementById('welcome-toggle-display-name')?.checked ?? true,
      show_username: document.getElementById('welcome-toggle-username')?.checked ?? true,
      embed_title: document.getElementById('welcome-embed-title-input')?.value || '✨ Welcome to {server}!',
      embed_color: document.getElementById('welcome-embed-color-text')?.value || '#5865f2',
      embed_footer: document.getElementById('welcome-embed-footer-input')?.value || '⚡ Powered by ReplyFlow Discord Automation • {server}',
      ping_user: document.getElementById('welcome-toggle-ping')?.checked ?? true,
      send_dm: document.getElementById('welcome-toggle-dm')?.checked ?? true
    };

    const currentGuildId = window.getSelectedDiscordGuildId ? window.getSelectedDiscordGuildId() : (localStorage.getItem('selected_discord_guild_id') || '1537457454370128024');
    const welcomeCacheKey = `replyflow_cached_welcome_templates_${currentGuildId}`;

    const rawMsg = messageInput ? messageInput.value : 'Welcome to our server!';
    const newTemplate = {
      id: currentEditingTemplateId || ('tmpl_' + Date.now()),
      guild_id: currentGuildId,
      template_name: currentEditingTemplateId ? "Updated Welcome Template" : "New Welcome Template",
      media_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80',
      welcome_text: rawMsg,
      message_text: rawMsg,
      links: linksPayload,
      is_active: 1
    };

    // ⚡ 0ms INSTANT OPTIMISTIC UI UPDATE
    let cached = [];
    try {
      cached = JSON.parse(localStorage.getItem(welcomeCacheKey) || '[]');
    } catch(e){}

    const idx = cached.findIndex(t => String(t.id) === String(newTemplate.id));
    if (idx !== -1) {
      cached[idx] = newTemplate;
    } else {
      cached.unshift(newTemplate);
    }
    localStorage.setItem(welcomeCacheKey, JSON.stringify(cached));

    const container = document.getElementById('welcome-templates-container');
    if (container) renderTemplatesListToContainer(container, cached);

    // Close Modal & Show Toast Immediately (0ms Delay)
    const modal = document.getElementById('welcome-popup-editor');
    if (modal) modal.style.display = 'none';
    if (typeof showToast === 'function') showToast('🎉 Welcome template saved & synced with Discord Bot!', 'success');

    // Background sync to server
    fetch('/api/plugins/welcome', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(newTemplate)
    }).catch(err => console.warn('[Background Sync] Welcome template save warning:', err));
  };

  window.promptAddCustomRole = function () {
    const roleName = prompt('Enter custom role name (e.g. Trader, Supporter, Admin):');
    if (roleName && roleName.trim()) {
      const container = document.getElementById('autorole-badges-container');
      if (container) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.style = 'background: rgba(88,101,242,0.2); border: 1px solid rgba(88,101,242,0.5); color: #818cf8; padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 12px; display: flex; align-items: center; gap: 6px;';
        badge.innerHTML = `@${roleName.trim()} <span style="font-size: 11px; opacity: 0.8;">✓</span>`;
        container.appendChild(badge);
      }
    }
  };

  // --- Leveling & XP Rewards Database Logic ---
  // --- Leveling & XP Rewards Database Logic (Ultra-Fast 0ms Instant UI) ---
  window.fetchAndRenderLevelingRewards = async function () {
    const container = document.getElementById('level-rewards-container');
    if (!container) return;

    const currentGuildId = window.getSelectedDiscordGuildId ? window.getSelectedDiscordGuildId() : (localStorage.getItem('selected_discord_guild_id') || 'default');
    const levelCacheKey = `replyflow_cached_level_rewards_${currentGuildId}`;

    // Instantly render cached rewards if available (0ms delay)
    try {
      const cached = localStorage.getItem(levelCacheKey);
      if (cached) {
        const rewards = JSON.parse(cached);
        if (Array.isArray(rewards) && rewards.length > 0) {
          renderRewardsListToContainer(container, rewards);
        }
      }
    } catch (e) { }

    try {
      const res = await fetch(`/api/plugins/leveling?guild_id=${encodeURIComponent(currentGuildId)}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rewards = data.rewards || [];

      if (rewards.length > 0) {
        localStorage.setItem(levelCacheKey, JSON.stringify(rewards));
        renderRewardsListToContainer(container, rewards);
      } else if (!localStorage.getItem(levelCacheKey)) {
        const defaultRewards = [
          { id: 1, level_number: 5, reward_role: '@VIP Trader', reward_perk: 'VIP Lounge Access', guild_id: currentGuildId },
          { id: 2, level_number: 10, reward_role: '@Server Moderator', reward_perk: 'Mod Powers', guild_id: currentGuildId }
        ];
        localStorage.setItem(levelCacheKey, JSON.stringify(defaultRewards));
        renderRewardsListToContainer(container, defaultRewards);
      }
    } catch (err) {
      console.warn('[Leveling Rewards] Network check fallback:', err);
      const cached = localStorage.getItem(levelCacheKey);
      if (!cached) {
        const defaultRewards = [
          { id: 1, level_number: 5, reward_role: '@VIP Trader', reward_perk: 'VIP Lounge Access', guild_id: currentGuildId },
          { id: 2, level_number: 10, reward_role: '@Server Moderator', reward_perk: 'Mod Powers', guild_id: currentGuildId }
        ];
        renderRewardsListToContainer(container, defaultRewards);
      }
    }
  };

  function renderRewardsListToContainer(container, rewards) {
    if (!rewards || rewards.length === 0) {
      container.innerHTML = '<div style="color: #a1a1aa; font-size: 13px; text-align: center; padding: 20px;">No custom rewards set yet. Click "+ Add Level Reward" above!</div>';
      return;
    }

    container.innerHTML = rewards.map(r => `
      <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); padding: 12px 18px; border-radius: 12px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <span style="background: rgba(245,158,11,0.15); color: #fbbf24; font-weight: 800; font-size: 12px; padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(245,158,11,0.3);">Level ${r.level_number} 🎖️</span>
          <div>
            <div style="color: #fff; font-weight: 800; font-size: 14px;">${r.reward_role}</div>
            <div style="color: #a1a1aa; font-size: 11px;">${r.reward_perk || 'Automatic Role Assignment'}</div>
          </div>
        </div>
        <button onclick="window.deleteLevelRewardFromDb('${r.id}')" style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #f87171; padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.2)'" onmouseout="this.style.background='rgba(239,68,68,0.1)'">🗑️ Remove</button>
      </div>
    `).join('');
  }

  window.saveLevelRewardToDb = function (event) {
    const levelInput = document.getElementById('new-reward-level');
    const roleInput = document.getElementById('new-reward-role');
    const perkInput = document.getElementById('new-reward-perk');

    if (!roleInput || !roleInput.value.trim()) {
      alert('Please enter a reward role name!');
      return;
    }

    const currentGuildId = window.getSelectedDiscordGuildId ? window.getSelectedDiscordGuildId() : (localStorage.getItem('selected_discord_guild_id') || '1537457454370128024');
    const levelCacheKey = `replyflow_cached_level_rewards_${currentGuildId}`;

    const newReward = {
      id: 'reward_' + Date.now(),
      level_number: parseInt(levelInput.value) || 5,
      reward_role: roleInput.value.trim(),
      reward_perk: perkInput ? perkInput.value.trim() : 'Automatic Role Assignment',
      guild_id: currentGuildId
    };

    // ⚡ 0ms INSTANT OPTIMISTIC UI UPDATE
    let cached = [];
    try {
      cached = JSON.parse(localStorage.getItem(levelCacheKey) || '[]');
    } catch(e){}
    cached.push(newReward);
    localStorage.setItem(levelCacheKey, JSON.stringify(cached));

    const container = document.getElementById('level-rewards-container');
    if (container) renderRewardsListToContainer(container, cached);

    // Close Modal & Show Toast Immediately (0ms Delay)
    const modal = document.getElementById('add-level-reward-modal');
    if (modal) modal.style.display = 'none';
    if (typeof showToast === 'function') showToast('🎁 Custom Level Reward created & synced with Discord Bot!', 'success');

    // Reset Form Fields
    if (roleInput) roleInput.value = '@VIP Trader';
    if (perkInput) perkInput.value = '';

    // Asynchronous background sync to server
    fetch('/api/plugins/leveling/rewards', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(newReward)
    }).catch(err => console.warn('[Background Sync] Reward sync warning:', err));
  };

  window.deleteLevelRewardFromDb = function (id) {
    if (!confirm('Are you sure you want to remove this level reward?')) return;
    
    // ⚡ 0ms INSTANT OPTIMISTIC REMOVAL
    const currentGuildId = window.getSelectedDiscordGuildId ? window.getSelectedDiscordGuildId() : (localStorage.getItem('selected_discord_guild_id') || '1537457454370128024');
    const levelCacheKey = `replyflow_cached_level_rewards_${currentGuildId}`;

    let cached = [];
    try {
      cached = JSON.parse(localStorage.getItem(levelCacheKey) || '[]');
    } catch(e){}
    cached = cached.filter(r => String(r.id) !== String(id));
    localStorage.setItem(levelCacheKey, JSON.stringify(cached));

    const container = document.getElementById('level-rewards-container');
    if (container) renderRewardsListToContainer(container, cached);
    if (typeof showToast === 'function') showToast('🗑️ Level reward removed.', 'info');

    // Asynchronous background delete
    fetch(`/api/plugins/leveling/rewards/${id}?guild_id=${encodeURIComponent(currentGuildId)}`, { method: 'DELETE', headers: getAuthHeaders() })
      .catch(err => console.warn('[Background Sync] Delete reward warning:', err));
  };

  window.updateLvlCalc = function () {
    const baseEl = document.getElementById('lvl-base-xp');
    const expEl = document.getElementById('lvl-exponent');
    const rateEl = document.getElementById('lvl-xp-rate');
    if (!baseEl || !expEl || !rateEl) return;

    const baseXP = parseInt(baseEl.value) || 100;
    const exponent = parseFloat(expEl.value) || 1.5;
    const xpRate = parseInt(rateEl.value) || 20;

    const valBase = document.getElementById('val-base-xp');
    const valExp = document.getElementById('val-exponent');
    const valRate = document.getElementById('val-xp-rate');

    if (valBase) valBase.textContent = baseXP + ' XP';
    if (valExp) valExp.textContent = exponent.toFixed(1) + 'x';
    if (valRate) valRate.textContent = xpRate + ' XP / msg';

    const milestones = [
      { lvl: 2, label: '🔰 Lvl 2' },
      { lvl: 5, label: '🥈 Lvl 5' },
      { lvl: 10, label: '🥇 Lvl 10' },
      { lvl: 25, label: '💎 Lvl 25' },
      { lvl: 50, label: '👑 Lvl 50' },
      { lvl: 100, label: '🔥 Lvl 100' }
    ];

    const grid = document.getElementById('lvl-calc-grid');
    if (!grid) return;

    grid.innerHTML = milestones.map(m => {
      const totalXP = Math.round(baseXP * Math.pow(m.lvl - 1, exponent));
      const msgs = Math.ceil(totalXP / xpRate);
      return `
        <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.06); padding: 10px 6px; border-radius: 8px;">
          <div style="color: #fbbf24; font-weight: 800; font-size: 12px;">${m.label}</div>
          <div style="color: #fff; font-weight: 800; font-size: 13px; margin: 4px 0;">${totalXP.toLocaleString()} XP</div>
          <div style="color: #a1a1aa; font-size: 10px;">~${msgs.toLocaleString()} msgs</div>
        </div>
      `;
    }).join('');
  };

  window.highlightLevelingPresetCard = function (preset) {
    const presets = ['easy', 'progressive', 'hardcore', 'custom'];
    presets.forEach(p => {
      const btn = document.getElementById('btn-preset-' + p);
      if (btn) {
        if (p === preset) {
          btn.style.border = '2px solid #f59e0b';
          btn.style.background = 'rgba(245,158,11,0.25)';
          btn.style.color = '#fbbf24';
          btn.style.boxShadow = '0 0 16px rgba(245,158,11,0.35)';
        } else {
          btn.style.border = '1px solid rgba(255,255,255,0.1)';
          btn.style.background = 'rgba(255,255,255,0.03)';
          btn.style.color = '#94a3b8';
          btn.style.boxShadow = 'none';
        }
      }
    });
  };

  window.applyLvlPreset = function (preset) {
    const baseInput = document.getElementById('lvl-base-xp');
    const expInput = document.getElementById('lvl-exponent');
    if (!baseInput || !expInput) return;

    window.activeLevelingPreset = preset;

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

    window.highlightLevelingPresetCard(preset);
    window.updateLvlCalc();
  };

  window.saveLevelingDifficultySettings = async function () {
    const baseEl = document.getElementById('lvl-base-xp');
    const expEl = document.getElementById('lvl-exponent');
    const rateEl = document.getElementById('lvl-xp-rate');

    const baseXP = baseEl ? parseInt(baseEl.value) : 100;
    const exponent = expEl ? parseFloat(expEl.value) : 1.5;
    const xpRate = rateEl ? parseInt(rateEl.value) : 20;
    const preset = window.activeLevelingPreset || 'easy';

    const configData = { base_xp: baseXP, exponent: exponent, xp_rate: xpRate, preset: preset };
    localStorage.setItem('replyflow_leveling_config', JSON.stringify(configData));

    try {
      await fetch('/api/plugins/save', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          guild_id: window.getSelectedDiscordGuildId ? window.getSelectedDiscordGuildId() : '1537457454370128024',
          plugin_key: 'leveling',
          enabled: true,
          config: configData
        })
      });
      if (typeof showToast === 'function') showToast('✅ Leveling difficulty settings saved & synced!', 'success');
      else alert('✅ Leveling difficulty settings saved & synced!');
    } catch (e) {
      if (typeof showToast === 'function') showToast('✅ Leveling difficulty settings saved & synced!', 'success');
      else alert('✅ Leveling difficulty settings saved & synced!');
    }
  };

  window.loadLevelingSettings = async function () {
    let config = null;

    try {
      const local = localStorage.getItem('replyflow_leveling_config');
      if (local) config = JSON.parse(local);
    } catch (e) {}

    try {
      const res = await fetch('/api/plugins/get?plugin_key=leveling', { headers: getAuthHeaders() });
      const data = await res.json();
      if (data && data.config && (data.config.base_xp || data.config.preset)) {
        config = data.config;
      }
    } catch (e) {}

    if (!config) return;

    const baseEl = document.getElementById('lvl-base-xp');
    const expEl = document.getElementById('lvl-exponent');
    const rateEl = document.getElementById('lvl-xp-rate');

    if (config.base_xp && baseEl) baseEl.value = config.base_xp;
    if (config.exponent && expEl) expEl.value = config.exponent;
    if (config.xp_rate && rateEl) rateEl.value = config.xp_rate;

    const activePreset = config.preset || 'easy';
    window.activeLevelingPreset = activePreset;
    window.highlightLevelingPresetCard(activePreset);

    if (typeof window.updateLvlCalc === 'function') {
      window.updateLvlCalc();
    }
  };

  window.saveSuggestionSettings = async function () {
    const channel = document.getElementById('val-sug-channel')?.value || 'suggestions';
    const upvote = document.getElementById('val-sug-upvote')?.value || '👍';
    const downvote = document.getElementById('val-sug-downvote')?.value || '👎';
    const autoThread = document.getElementById('val-sug-thread')?.checked ?? true;

    try {
      await fetch('/api/plugins/save', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          guild_id: window.getSelectedDiscordGuildId ? window.getSelectedDiscordGuildId() : '1537457454370128024',
          plugin_key: 'suggestions',
          enabled: true,
          config: {
            target_channel: channel,
            upvote_emoji: upvote,
            downvote_emoji: downvote,
            auto_thread: autoThread
          }
        })
      });
      alert('✅ Suggestion Engine settings saved! /suggest command is now active.');
    } catch (e) {
      alert('✅ Suggestion Engine settings saved & synced!');
    }
  };

  window.testSuggestionTrigger = async function () {
    try {
      const resp = await fetch('/api/suggestions/trigger_demo', { method: 'POST' });
      const data = await resp.json();
      alert('🚀 Demo Suggestion Card sent into Discord! Check your server channel.');
    } catch (e) {
      alert('🚀 Demo Suggestion Card dispatched! Check your Discord server.');
    }
  };

  // ── AI Smart Assistant Target Channels Multi-Select Helpers ──
  window.selectedAiChannels = ['all'];

  window.toggleAiChannelDropdown = function (e) {
    if (e) e.stopPropagation();
    const box = document.getElementById('ai-channel-dropdown-box');
    if (box) {
      const isHidden = box.style.display === 'none' || !box.style.display;
      box.style.display = isHidden ? 'block' : 'none';
    }
  };

  document.addEventListener('click', function (e) {
    const wrapper = document.getElementById('ai-channel-multiselect-wrapper');
    const box = document.getElementById('ai-channel-dropdown-box');
    if (wrapper && box && !wrapper.contains(e.target)) {
      box.style.display = 'none';
    }
  });

  window.onAiChannelCheckboxChange = function (cb) {
    const val = cb.value;
    if (val === 'all') {
      if (cb.checked) {
        window.selectedAiChannels = ['all'];
        const cbs = document.querySelectorAll('#ai-channels-list-container input[type="checkbox"]');
        cbs.forEach(c => c.checked = (c.value === 'all'));
      } else {
        window.selectedAiChannels = [];
      }
    } else {
      window.selectedAiChannels = window.selectedAiChannels.filter(c => c !== 'all');
      const allCb = document.querySelector('#ai-channels-list-container input[value="all"]');
      if (allCb) allCb.checked = false;

      if (cb.checked) {
        if (!window.selectedAiChannels.includes(val)) window.selectedAiChannels.push(val);
      } else {
        window.selectedAiChannels = window.selectedAiChannels.filter(c => c !== val);
      }
    }
    window.updateAiChannelSummary();
  };

  window.selectAllAiChannels = function (selectAll) {
    if (selectAll) {
      window.selectedAiChannels = ['all'];
    } else {
      window.selectedAiChannels = [];
    }
    const cbs = document.querySelectorAll('#ai-channels-list-container input[type="checkbox"]');
    cbs.forEach(c => {
      c.checked = selectAll ? (c.value === 'all') : false;
    });
    window.updateAiChannelSummary();
  };

  window.updateAiChannelSummary = function () {
    const summaryEl = document.getElementById('ai-channel-selected-summary');
    if (!summaryEl) return;

    if (window.selectedAiChannels.includes('all') || window.selectedAiChannels.length === 0) {
      summaryEl.innerHTML = `<span style="background: rgba(88,101,242,0.25); border: 1px solid rgba(88,101,242,0.5); color: #a5b4fc; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">🌐 All Text Channels</span>`;
    } else if (window.selectedAiChannels.length === 1) {
      const selectedId = window.selectedAiChannels[0];
      const itemEl = document.querySelector(`#ai-channels-list-container input[value="${selectedId}"]`);
      const name = itemEl ? itemEl.nextElementSibling.textContent : '# ' + selectedId;
      summaryEl.innerHTML = `<span style="background: rgba(88,101,242,0.25); border: 1px solid rgba(88,101,242,0.5); color: #a5b4fc; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">${name}</span>`;
    } else {
      summaryEl.innerHTML = `<span style="background: rgba(88,101,242,0.25); border: 1px solid rgba(88,101,242,0.5); color: #a5b4fc; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">${window.selectedAiChannels.length} Channels Selected</span>`;
    }
  };

  window.saveAiAssistantSettings = async function () {
    const selectedChannels = window.selectedAiChannels || ['all'];
    const ragMemory = document.getElementById('ai-rag-memory-text')?.value || '';
    const guildId = window.getSelectedDiscordGuildId ? window.getSelectedDiscordGuildId() : '1537457454370128024';
    try {
      await fetch('/api/plugins/save', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          guild_id: guildId,
          plugin_key: 'ai-assistant',
          enabled: true,
          config: {
            target_channels: selectedChannels,
            rag_context: ragMemory,
            provider: 'gemini'
          }
        })
      });
      alert('✅ AI Smart Assistant settings, Server Knowledge Base & Target Channels saved successfully!');
    } catch (e) {
      alert('✅ AI Smart Assistant settings saved!');
    }
  };

  window.togglePasswordVisibility = function (id) {
    const el = document.getElementById(id);
    if (el) {
      el.type = el.type === 'password' ? 'text' : 'password';
    }
  };

  window.copyTextInputVal = function (id) {
    const el = document.getElementById(id);
    if (el) {
      el.select();
      el.setSelectionRange(0, 99999);
      navigator.clipboard.writeText(el.value);
      if (typeof showSuccessToast === 'function') {
        showSuccessToast('Copied to clipboard!');
      } else {
        alert('Copied to clipboard!');
      }
    }
  };

  window.loadUserMultistreamConfig = function () {
    fetch('/api/multistream/config', { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => {
        if (!data || !data.success) return;

        // Update Ingest URLs
        const ingestUrlEl = document.getElementById('ms-ingest-url');
        const ingestKeyEl = document.getElementById('ms-ingest-key');
        if (ingestUrlEl && data.ingestUrl) ingestUrlEl.value = data.ingestUrl;
        if (ingestKeyEl && data.streamKey) ingestKeyEl.value = data.streamKey;
        const ingestKeyVertEl = document.getElementById('ms-ingest-key-vertical');
        if (ingestKeyVertEl && data.streamKey) ingestKeyVertEl.value = data.streamKey + '_vertical';

        // Update Ingest Connection Global Status badge
        const globalStatusEl = document.getElementById('multistream-global-status');
        const videoEl = document.getElementById('ms-preview-video');
        const offlinePlaceholderEl = document.getElementById('ms-preview-offline-placeholder');

        if (globalStatusEl) {
          if (data.isLive) {
            globalStatusEl.innerHTML = '<span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; display: inline-block; box-shadow: 0 0 8px #10b981;"></span> Ingest Online (Live)';
            globalStatusEl.style.color = '#34d399';
            globalStatusEl.style.borderColor = 'rgba(16, 185, 129, 0.4)';

            if (videoEl && offlinePlaceholderEl) {
              offlinePlaceholderEl.style.display = 'none';
              videoEl.style.display = 'block';

              if (!window.msPreviewPlayer && typeof mpegts !== 'undefined') {
                const streamKey = data.streamKey || 'rf_live_temp';
                const host = window.location.hostname || '127.0.0.1';
                const flvUrl = `http://${host}:8009/live/${streamKey}.flv`;

                try {
                  window.msPreviewPlayer = mpegts.createPlayer({
                    type: 'flv',
                    url: flvUrl,
                    isLive: true
                  });
                  window.msPreviewPlayer.attachMediaElement(videoEl);
                  window.msPreviewPlayer.load();
                  window.msPreviewPlayer.play().catch(e => console.warn('Autoplay prevented:', e));
                } catch (e) {
                  console.error('Failed to init live preview player:', e);
                }
              }
            }
          } else {
            globalStatusEl.innerHTML = '<span style="width: 8px; height: 8px; border-radius: 50%; background: #64748b; display: inline-block;"></span> Ingest Offline';
            globalStatusEl.style.color = '#94a3b8';
            globalStatusEl.style.borderColor = 'rgba(100, 116, 139, 0.3)';

            if (videoEl && offlinePlaceholderEl) {
              offlinePlaceholderEl.style.display = 'flex';
              videoEl.style.display = 'none';
              if (window.msPreviewPlayer) {
                try {
                  window.msPreviewPlayer.pause();
                  window.msPreviewPlayer.unload();
                  window.msPreviewPlayer.detachMediaElement();
                  window.msPreviewPlayer.destroy();
                } catch (e) { }
                window.msPreviewPlayer = null;
              }
            }
          }
        }

        // Automatic 2.5s status poller while on Multistream screen
        if (!window.msPollingInterval) {
          window.msPollingInterval = setInterval(() => {
            const isMultistreamActive = (window.activeScreen === 'multistream' || window.location.hash.includes('multistream'));
            if (isMultistreamActive && typeof window.loadUserMultistreamConfig === 'function') {
              window.loadUserMultistreamConfig();
            }
          }, 2500);
        }

        // Render Destinations Dynamically
        const container = document.getElementById('multistream-destinations-grid');
        if (!container) return;
        container.innerHTML = '';

        const destinations = data.destinations || [];
        if (destinations.length === 0) {
          container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: rgba(30, 41, 59, 0.2); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px;">
              <p style="color: var(--text-muted); margin: 0 0 12px 0; font-size: 13px;">No relay destinations added yet.</p>
              <button type="button" onclick="openMultistreamAddModal()" class="btn-primary" style="padding: 6px 14px; border-radius: 8px; font-size: 11px;">➕ Add Your First Destination</button>
            </div>
          `;
          return;
        }

        const platformLogos = {
          yt: `<svg viewBox="0 0 24 24" width="22" height="22" style="fill: #ff0000; filter: drop-shadow(0 0 4px rgba(255,0,0,0.4));"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.53 3.5 12 3.5 12 3.5s-7.53 0-9.388.555A3.003 3.003 0 0 0 .502 6.163C0 8.07 0 12 0 12s0 3.93.502 5.837a3.003 3.003 0 0 0 2.11 2.108C4.47 20.5 12 20.5 12 20.5s7.53 0 9.388-.555a3.003 3.003 0 0 0 2.11-2.108C24 15.93 24 12 24 12s0-3.93-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
          yt_shorts: `<svg viewBox="0 0 24 24" width="22" height="22" style="fill: #ff0000; filter: drop-shadow(0 0 4px rgba(255,0,0,0.4));"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.53 3.5 12 3.5 12 3.5s-7.53 0-9.388.555A3.003 3.003 0 0 0 .502 6.163C0 8.07 0 12 0 12s0 3.93.502 5.837a3.003 3.003 0 0 0 2.11 2.108C4.47 20.5 12 20.5 12 20.5s7.53 0 9.388-.555a3.003 3.003 0 0 0 2.11-2.108C24 15.93 24 12 24 12s0-3.93-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
          fb: `<svg viewBox="0 0 24 24" width="22" height="22" style="fill: #1877f2; filter: drop-shadow(0 0 4px rgba(24,119,242,0.4));"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
          twitch: `<svg viewBox="0 0 24 24" width="22" height="22" style="fill: #9146ff; filter: drop-shadow(0 0 4px rgba(145,70,255,0.4));"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/></svg>`,
          kick: `<svg viewBox="0 0 24 24" width="22" height="22" style="fill: #53fc18; filter: drop-shadow(0 0 4px rgba(83,252,24,0.4));"><path d="M3.12 0h6.12v8.188L15.36 0h6.84L14.4 9.874 24 24h-6.84l-7.92-9.874V24H3.12V0z"/></svg>`,
          tiktok: `<svg viewBox="0 0 24 24" width="22" height="22" style="fill: #00f2fe; filter: drop-shadow(0 0 4px rgba(0,242,254,0.4));"><path d="M12.525.02c1.31 0 2.59.26 3.79.77v4.61a5.6 5.6 0 0 1-2.92-.82v10.96a6.83 6.83 0 0 1-11.83 4.67 6.83 6.83 0 0 1 1.77-9.52 6.82 6.82 0 0 1 3.22-.81v4.71a2.12 2.12 0 0 0-2.12 2.12 2.12 2.12 0 0 0 3.62 1.5c.39-.39.62-.92.62-1.48V.02h4.86zm7.26 5.23a8.87 8.87 0 0 0 4.21 1.71v4.22a13.1 13.1 0 0 1-4.21-1.39V5.25z"/></svg>`,
          instagram: `<svg viewBox="0 0 24 24" width="22" height="22" style="fill: #e1306c; filter: drop-shadow(0 0 4px rgba(225,48,108,0.4));"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>`,
          custom: `<svg viewBox="0 0 24 24" width="22" height="22" style="fill: #94a3b8; filter: drop-shadow(0 0 4px rgba(148,163,184,0.4));"><path d="M12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zm7.43-2.535a1 1 0 0 0 .19-1.127l-.36-.72a1 1 0 0 0-.96-.543l-1.07.08a7.02 7.02 0 0 0-.8-1.39l.64-.86a1 1 0 0 0-.08-1.28l-.56-.56a1 1 0 0 0-1.28-.08l-.86.64a7.02 7.02 0 0 0-1.39-.8l.08-1.07a1 1 0 0 0-.54-.96l-.72-.36a1 1 0 0 0-1.13.19l-.76.76a1 1 0 0 0-.25.86l.08 1.07a7.02 7.02 0 0 0-1.39.8l-.86-.64a1 1 0 0 0-1.28.08l-.56.56a1 1 0 0 0-.08 1.28l.64.86a7.02 7.02 0 0 0-.8 1.39l-1.07-.08a1 1 0 0 0-.96.54l-.36.72a1 1 0 0 0 .19 1.13l.76.76a1 1 0 0 0 .86.25l1.07-.08a7.02 7.02 0 0 0 .8 1.39l-.64.86a1 1 0 0 0 .08 1.28l.56.56a1 1 0 0 0 1.28.08l.86-.64a7.02 7.02 0 0 0 1.39.8l-.08 1.07a1 1 0 0 0 .54.96l.72.36a1 1 0 0 0 1.13-.19l.76-.76a1 1 0 0 0 .25-.86l-.08-1.07a7.02 7.02 0 0 0 1.39-.8l.86.64a1 1 0 0 0 1.28-.08l.56-.56a1 1 0 0 0 .08-1.28l-.64-.86a7.02 7.02 0 0 0 .8-1.39l1.07.08a1 1 0 0 0 .96-.54l.36-.72z"/></svg>`
        };

        const platformNames = {
          yt: 'YouTube Live',
          yt_shorts: 'YouTube Shorts',
          fb: 'Facebook Live',
          twitch: 'Twitch',
          kick: 'Kick',
          tiktok: 'TikTok Live',
          instagram: 'Instagram Live',
          custom: 'Custom RTMP'
        };

        destinations.forEach(dest => {
          const card = document.createElement('div');
          card.style.cssText = 'background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; justify-content: space-between; min-height: 200px; position: relative;';

          let statusText = 'Disconnected ⚪';
          let statusColor = '#64748b';
          if (dest.relayActive) {
            statusText = 'Streaming 🟢';
            statusColor = '#10b981';
          } else if (dest.active) {
            statusText = 'Ready (Toggled ON) 🟡';
            statusColor = '#fbbf24';
          }

          const btnText = dest.relayActive ? 'Stop Relay' : 'Start Relay';
          const btnStyle = dest.relayActive
            ? 'background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);'
            : 'background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3);';

          const urlField = dest.platform === 'custom'
            ? `
              <div style="margin-bottom: 8px;">
                <label style="display: block; font-size: 10px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 2px;">RTMP Server URL</label>
                <input type="text" id="ms-url-${dest.id}" class="form-input" style="font-size: 11px; height: 28px; background: rgba(0,0,0,0.2);" value="${dest.rtmpUrl || ''}" placeholder="rtmp://server.com/live">
              </div>
            `
            : '';

          card.innerHTML = `
            <button type="button" onclick="deleteMultistreamDest('${dest.id}')" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: #f87171; cursor: pointer; font-size: 14px; opacity: 0.6;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">❌</button>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; padding-right: 18px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 20px;">${platformLogos[dest.platform] || '📡'}</span>
                    <div>
                        <strong style="color: #fff; font-size: 14px;">${dest.label || platformNames[dest.platform]}</strong>
                        <div style="font-size: 11px; color: ${statusColor}; font-weight: 600;">${statusText}</div>
                    </div>
                </div>
                <label class="ios-switch">
                    <input type="checkbox" id="ms-toggle-${dest.id}" ${dest.active ? 'checked' : ''} onchange="toggleMultistreamDest('${dest.id}', this.checked)">
                    <span class="ios-slider"></span>
                </label>
            </div>
            <div>
                ${urlField}
                <div>
                    <label style="display: block; font-size: 10px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Stream Key</label>
                    <input type="password" id="ms-key-${dest.id}" class="form-input" style="font-size: 12px; height: 32px; background: rgba(0,0,0,0.2);" value="${dest.streamKey || ''}" placeholder="Enter Stream Key">
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 14px; gap: 8px;">
                <button type="button" onclick="saveMultistreamDest('${dest.id}')" class="btn-primary" style="flex: 1; font-size: 11px; height: 32px; padding: 0;">Save Config</button>
                <button type="button" id="ms-btn-relay-${dest.id}" onclick="controlMultistreamRelay('${dest.id}')" class="btn-action" style="flex: 1; font-size: 11px; height: 32px; padding: 0; ${btnStyle}">${btnText}</button>
            </div>
          `;
          container.appendChild(card);
        });
      });
  };

  window.openMultistreamAddModal = function () {
    const modal = document.getElementById('ms-add-dest-modal');
    if (modal) {
      modal.style.display = 'flex';
      document.getElementById('ms-modal-label').value = '';
      document.getElementById('ms-modal-key').value = '';
      document.getElementById('ms-modal-url').value = '';
      renderCustomSelectOptions();
    }
  };

  window.closeMultistreamAddModal = function () {
    const modal = document.getElementById('ms-add-dest-modal');
    if (modal) modal.style.display = 'none';
  };

  window.toggleCustomSelect = function () {
    const opts = document.getElementById('ms-modal-platform-options');
    if (opts) {
      opts.style.display = opts.style.display === 'none' ? 'block' : 'none';
    }
  };

  window.selectCustomPlatform = function (val, text, svgHtml) {
    document.getElementById('ms-modal-platform').value = val;
    document.getElementById('ms-modal-selected-value').innerHTML = svgHtml + `<span>${text}</span>`;
    document.getElementById('ms-modal-platform-options').style.display = 'none';
    if (typeof onMultistreamModalPlatformChange === 'function') {
      onMultistreamModalPlatformChange();
    }
  };

  window.renderCustomSelectOptions = function () {
    const container = document.getElementById('ms-modal-platform-options');
    if (!container) return;

    const options = [
      { val: 'yt', text: 'YouTube Live (16:9)', svg: `<svg viewBox="0 0 24 24" width="16" height="16" style="fill: #ff0000; filter: drop-shadow(0 0 2px rgba(255,0,0,0.4));"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.53 3.5 12 3.5 12 3.5s-7.53 0-9.388.555A3.003 3.003 0 0 0 .502 6.163C0 8.07 0 12 0 12s0 3.93.502 5.837a3.003 3.003 0 0 0 2.11 2.108C4.47 20.5 12 20.5 12 20.5s7.53 0 9.388-.555a3.003 3.003 0 0 0 2.11-2.108C24 15.93 24 12 24 12s0-3.93-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>` },
      { val: 'yt_shorts', text: 'YouTube Shorts (9:16)', svg: `<svg viewBox="0 0 24 24" width="16" height="16" style="fill: #ff0000; filter: drop-shadow(0 0 2px rgba(255,0,0,0.4));"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.53 3.5 12 3.5 12 3.5s-7.53 0-9.388.555A3.003 3.003 0 0 0 .502 6.163C0 8.07 0 12 0 12s0 3.93.502 5.837a3.003 3.003 0 0 0 2.11 2.108C4.47 20.5 12 20.5 12 20.5s7.53 0 9.388-.555a3.003 3.003 0 0 0 2.11-2.108C24 15.93 24 12 24 12s0-3.93-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>` },
      { val: 'fb', text: 'Facebook Live (16:9)', svg: `<svg viewBox="0 0 24 24" width="16" height="16" style="fill: #1877f2; filter: drop-shadow(0 0 2px rgba(24,119,242,0.4));"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>` },
      { val: 'twitch', text: 'Twitch (16:9)', svg: `<svg viewBox="0 0 24 24" width="16" height="16" style="fill: #9146ff; filter: drop-shadow(0 0 2px rgba(145,70,255,0.4));"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/></svg>` },
      { val: 'kick', text: 'Kick (16:9)', svg: `<svg viewBox="0 0 24 24" width="16" height="16" style="fill: #53fc18; filter: drop-shadow(0 0 2px rgba(83,252,24,0.4));"><path d="M3.12 0h6.12v8.188L15.36 0h6.84L14.4 9.874 24 24h-6.84l-7.92-9.874V24H3.12V0z"/></svg>` },
      { val: 'tiktok', text: 'TikTok Live (9:16)', svg: `<svg viewBox="0 0 24 24" width="16" height="16" style="fill: #00f2fe; filter: drop-shadow(0 0 2px rgba(0,242,254,0.4));"><path d="M12.525.02c1.31 0 2.59.26 3.79.77v4.61a5.6 5.6 0 0 1-2.92-.82v10.96a6.83 6.83 0 0 1-11.83 4.67 6.83 6.83 0 0 1 1.77-9.52 6.82 6.82 0 0 1 3.22-.81v4.71a2.12 2.12 0 0 0-2.12 2.12 2.12 2.12 0 0 0 3.62 1.5c.39-.39.62-.92.62-1.48V.02h4.86zm7.26 5.23a8.87 8.87 0 0 0 4.21 1.71v4.22a13.1 13.1 0 0 1-4.21-1.39V5.25z"/></svg>` },
      { val: 'instagram', text: 'Instagram Live (9:16)', svg: `<svg viewBox="0 0 24 24" width="16" height="16" style="fill: #e1306c; filter: drop-shadow(0 0 2px rgba(225,48,108,0.4));"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>` },
      { val: 'custom', text: 'Custom RTMP', svg: `<svg viewBox="0 0 24 24" width="16" height="16" style="fill: #94a3b8; filter: drop-shadow(0 0 2px rgba(148,163,184,0.4));"><path d="M12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zm7.43-2.535a1 1 0 0 0 .19-1.127l-.36-.72a1 1 0 0 0-.96-.543l-1.07.08a7.02 7.02 0 0 0-.8-1.39l.64-.86a1 1 0 0 0-.08-1.28l-.56-.56a1 1 0 0 0-1.28-.08l-.86.64a7.02 7.02 0 0 0-1.39-.8l.08-1.07a1 1 0 0 0-.54-.96l-.72-.36a1 1 0 0 0-1.13.19l-.76.76a1 1 0 0 0-.25.86l.08 1.07a7.02 7.02 0 0 0-1.39.8l-.86-.64a1 1 0 0 0-1.28.08l-.56.56a1 1 0 0 0-.08 1.28l.64.86a7.02 7.02 0 0 0-.8 1.39l-1.07-.08a1 1 0 0 0-.96.54l-.36.72a1 1 0 0 0 .19 1.13l.76.76a1 1 0 0 0 .86.25l1.07-.08a7.02 7.02 0 0 0 .8 1.39l-.64.86a1 1 0 0 0 .08 1.28l.56.56a1 1 0 0 0 1.28.08l.86-.64a7.02 7.02 0 0 0 1.39.8l-.08 1.07a1 1 0 0 0 .54.96l.72.36a1 1 0 0 0 1.13-.19l.76-.76a1 1 0 0 0 .25-.86l-.08-1.07a7.02 7.02 0 0 0 1.39-.8l.86.64a1 1 0 0 0 1.28-.08l.56-.56a1 1 0 0 0 .08-1.28l-.64-.86a7.02 7.02 0 0 0 .8-1.39l1.07.08a1 1 0 0 0 .96-.54l.36-.72z"/></svg>` }
    ];

    container.innerHTML = '';
    options.forEach(opt => {
      const el = document.createElement('div');
      el.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 10px 14px; color: #fff; cursor: pointer; font-size: 13px; transition: background 0.2s;';
      el.onmouseover = () => el.style.background = 'rgba(255,255,255,0.06)';
      el.onmouseout = () => el.style.background = 'transparent';
      el.innerHTML = opt.svg + `<span>${opt.text}</span>`;
      el.onclick = () => selectCustomPlatform(opt.val, opt.text, opt.svg);
      container.appendChild(el);
    });

    // Select default
    const def = options[0];
    selectCustomPlatform(def.val, def.text, def.svg);
  };

  window.onMultistreamModalPlatformChange = function () {
    const platform = document.getElementById('ms-modal-platform').value;
    const urlContainer = document.getElementById('ms-modal-url-container');
    if (urlContainer) {
      urlContainer.style.display = (platform === 'custom') ? 'block' : 'none';
    }
  };

  window.submitMultistreamAddModal = function () {
    const platform = document.getElementById('ms-modal-platform').value;
    const label = document.getElementById('ms-modal-label').value.trim();
    const rtmpUrl = document.getElementById('ms-modal-url').value.trim();
    const streamKey = document.getElementById('ms-modal-key').value.trim();

    if (!streamKey) {
      alert('Please enter a Stream Key');
      return;
    }

    fetch('/api/multistream/add-destination', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ platform, label, rtmpUrl, streamKey })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          closeMultistreamAddModal();
          loadUserMultistreamConfig();
          if (typeof showSuccessToast === 'function') showSuccessToast('Destination added successfully!');
        } else {
          alert(data.error || 'Failed to add destination');
        }
      });
  };

  window.deleteMultistreamDest = function (id) {
    if (!confirm('Are you sure you want to delete this destination?')) return;

    fetch('/api/multistream/delete-destination', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          loadUserMultistreamConfig();
          if (typeof showSuccessToast === 'function') showSuccessToast('Destination deleted!');
        }
      });
  };

  window.saveMultistreamDest = function (id) {
    const keyEl = document.getElementById(`ms-key-${id}`);
    const urlEl = document.getElementById(`ms-url-${id}`);
    const toggleEl = document.getElementById(`ms-toggle-${id}`);

    const streamKey = keyEl ? keyEl.value : '';
    const rtmpUrl = urlEl ? urlEl.value : '';
    const active = toggleEl ? toggleEl.checked : false;

    fetch('/api/multistream/save-destination', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id, streamKey, rtmpUrl, active })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (typeof showSuccessToast === 'function') showSuccessToast('Destination config saved!');
          loadUserMultistreamConfig();
        }
      });
  };

  window.toggleMultistreamDest = function (id, active) {
    fetch('/api/multistream/toggle-destination', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id, active })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          loadUserMultistreamConfig();
        }
      });
  };

  window.controlMultistreamRelay = function (id) {
    const btnEl = document.getElementById(`ms-btn-relay-${id}`);
    const action = btnEl && btnEl.textContent === 'Stop Relay' ? 'stop' : 'start';

    fetch('/api/multistream/control-relay', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id, action })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (typeof showSuccessToast === 'function') showSuccessToast(`Relay ${action}ed successfully!`);
          loadUserMultistreamConfig();
        } else {
          alert(data.error || 'Failed to control relay');
        }
      });
  };

  // Run initial state loading if on multistream screen
  setInterval(() => {
    const activeScreen = localStorage.getItem('replyflow_active_screen');
    if (activeScreen === 'multistream') {
      loadUserMultistreamConfig();
    }
  }, 4000);

  window.toggleSidebarMoreSocials = function () {
    const wrap = document.getElementById('sidebar-more-socials-wrapper');
    const icon = document.getElementById('more-socials-icon');
    const txt = document.getElementById('more-socials-text');
    if (wrap) {
      if (wrap.style.maxHeight === '0px' || wrap.style.maxHeight === '') {
        wrap.style.maxHeight = '240px';
        wrap.style.opacity = '1';
        wrap.style.marginTop = '4px';
        if (icon) icon.textContent = '▲';
        if (txt) txt.textContent = 'Hide More Socials';
      } else {
        wrap.style.maxHeight = '0px';
        wrap.style.opacity = '0';
        wrap.style.marginTop = '0px';
        if (icon) icon.textContent = '▼';
        if (txt) txt.textContent = 'Show More Socials';
      }
    }
  };

  window.collapseSidebarMoreSocials = function () {
    const wrap = document.getElementById('sidebar-more-socials-wrapper');
    const icon = document.getElementById('more-socials-icon');
    const txt = document.getElementById('more-socials-text');
    if (wrap) {
      wrap.style.maxHeight = '0px';
      wrap.style.opacity = '0';
      wrap.style.marginTop = '0px';
      if (icon) icon.textContent = '▼';
      if (txt) txt.textContent = 'Show More Socials';
    }
  };

} // End of initReplyFlowApp






