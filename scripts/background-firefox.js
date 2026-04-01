// ── ShieldBrowse Firefox Background Script ──────────────────────────────────
// Uses webRequest.onBeforeRequest (Manifest V2) instead of declarativeNetRequest

// ── Default Settings ────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  adBlockEnabled: true,
  proxyEnabled: false,
  proxyMode: 'manual',
  proxyType: 'https',
  proxyHost: '',
  proxyPort: '',
  proxyUsername: '',
  proxyPassword: '',
  stats: {
    totalBlocked: 0,
    sessionBlocked: 0,
    sitesBlocked: {}
  },
  whitelist: [],
  blockedSitesList: [],
  autoProxyPatterns: [],
  customFilterRules: []
};

// ── Ad domain blocklist ─────────────────────────────────────────────────────
const AD_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'adservice.google.com', 'pagead2.googlesyndication.com',
  'ads.yahoo.com', 'analytics.yahoo.com',
  'adnxs.com', 'adsrvr.org', 'advertising.com',
  'taboola.com', 'outbrain.com',
  'criteo.com', 'criteo.net', 'moatads.com',
  'amazon-adsystem.com', 'scorecardresearch.com',
  'quantserve.com', 'rubiconproject.com', 'pubmatic.com',
  'openx.net', 'casalemedia.com', 'sharethrough.com',
  'smartadserver.com', 'turn.com', 'serving-sys.com',
  '2mdn.net', 'bidswitch.net', 'demdex.net',
  'mathtag.com', 'contextweb.com', 'spotxchange.com',
  'yieldmanager.com', 'betrad.com', 'bluekai.com',
  'exelator.com', 'eyeota.net', 'hotjar.com',
  'mixpanel.com', 'popads.net', 'popcash.net',
  'propellerads.com', 'revcontent.com', 'adcolony.com',
  'admob.com', 'mopub.com', 'adform.net',
  'rlcdn.com', 'teads.tv', 'mgid.com',
  'medianet.com', 'media.net', 'carbonads.com',
  'buysellads.com', 'zedo.com', 'bidvertiser.com',
  'trafficjunky.com', 'exoclick.com', 'juicyads.com',
  'intellitxt.com', 'inmobi.com', 'smaato.net',
  'adtech.de', 'googletagservices.com',
  'ads-twitter.com', 'ads.reddit.com', 'alb.reddit.com',
  'imasdk.googleapis.com', 's0.2mdn.net', 'yt.moatads.com',
  'segment.io', 'amplitude.com', 'fullstory.com',
  'mouseflow.com', 'luckyorange.com', 'crazyegg.com',
  'optimizely.com', 'consensu.org', 'cookiebot.com'
];

// YouTube-specific ad URL patterns
const YT_AD_PATTERNS = [
  '/pagead/', '/ptracking', '/api/stats/ads',
  '/get_midroll_info', '/api/stats/playback',
  '/generate_204', '/log_interaction'
];

// ── Initialization ──────────────────────────────────────────────────────────
browser.runtime.onInstalled.addListener(async () => {
  const existing = await browser.storage.local.get('settings');
  if (!existing.settings) {
    await browser.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
});

// ── Ad Blocking via webRequest ──────────────────────────────────────────────
browser.webRequest.onBeforeRequest.addListener(
  async (details) => {
    const data = await browser.storage.local.get('settings');
    const settings = data.settings || DEFAULT_SETTINGS;

    if (!settings.adBlockEnabled) return {};

    try {
      const url = new URL(details.url);
      const hostname = url.hostname;

      // Check whitelist
      if (settings.whitelist.some(d => hostname === d || hostname.endsWith('.' + d))) {
        return {};
      }

      // Check ad domains
      const isAdDomain = AD_DOMAINS.some(d =>
        hostname === d || hostname.endsWith('.' + d)
      );

      // Check YouTube ad patterns
      const isYTAd = hostname.includes('youtube.com') &&
        YT_AD_PATTERNS.some(p => details.url.includes(p));

      // Check custom filters
      const customRules = settings.customFilterRules || [];
      const isCustomBlocked = customRules.some(rule => {
        if (!rule || rule.startsWith('#') || rule.startsWith('!')) return false;
        if (rule.includes('/')) {
          return details.url.includes(rule);
        }
        return hostname === rule || hostname.endsWith('.' + rule);
      });

      if (isAdDomain || isYTAd || isCustomBlocked) {
        // Update stats
        settings.stats.totalBlocked++;
        settings.stats.sessionBlocked++;
        settings.stats.sitesBlocked[hostname] =
          (settings.stats.sitesBlocked[hostname] || 0) + 1;
        browser.storage.local.set({ settings });

        return { cancel: true };
      }
    } catch (e) {
      // ignore malformed URLs
    }

    return {};
  },
  { urls: ['<all_urls>'] },
  ['blocking']
);

// ── Proxy Configuration (Firefox uses proxy.onRequest) ──────────────────────
browser.proxy.onRequest.addListener(
  async (requestInfo) => {
    const data = await browser.storage.local.get('settings');
    const settings = data.settings || DEFAULT_SETTINGS;

    if (!settings.proxyEnabled || !settings.proxyHost || !settings.proxyPort) {
      return { type: 'direct' };
    }

    const proxyInfo = {
      type: settings.proxyType === 'socks5' ? 'socks' : settings.proxyType,
      host: settings.proxyHost,
      port: parseInt(settings.proxyPort, 10),
      proxyDNS: settings.proxyType === 'socks5'
    };

    if (settings.proxyUsername) {
      proxyInfo.username = settings.proxyUsername;
      proxyInfo.password = settings.proxyPassword || '';
    }

    // Auto mode: only proxy blocked sites
    if (settings.proxyMode === 'auto') {
      try {
        const url = new URL(requestInfo.url);
        const hostname = url.hostname.replace(/^www\./, '');
        const isBlocked = (settings.blockedSitesList || []).some(d =>
          hostname === d || hostname.endsWith('.' + d)
        );
        return isBlocked ? proxyInfo : { type: 'direct' };
      } catch (e) {
        return { type: 'direct' };
      }
    }

    // Manual mode: proxy everything
    // Bypass local addresses
    try {
      const url = new URL(requestInfo.url);
      const host = url.hostname;
      if (host === 'localhost' || host === '127.0.0.1' ||
          host.startsWith('192.168.') || host.startsWith('10.') ||
          host.startsWith('172.16.')) {
        return { type: 'direct' };
      }
    } catch (e) {}

    return proxyInfo;
  },
  { urls: ['<all_urls>'] }
);

// ── Proxy Auth Handler ──────────────────────────────────────────────────────
browser.webRequest.onAuthRequired.addListener(
  async (details) => {
    const data = await browser.storage.local.get('settings');
    const settings = data.settings || DEFAULT_SETTINGS;

    if (settings.proxyEnabled && settings.proxyUsername) {
      return {
        authCredentials: {
          username: settings.proxyUsername,
          password: settings.proxyPassword || ''
        }
      };
    }
    return {};
  },
  { urls: ['<all_urls>'] },
  ['blocking']
);

// ── Message Handler ─────────────────────────────────────────────────────────
browser.runtime.onMessage.addListener((message, sender) => {
  return (async () => {
    const data = await browser.storage.local.get('settings');
    const settings = data.settings || DEFAULT_SETTINGS;

    switch (message.type) {
      case 'GET_SETTINGS':
        return { settings };

      case 'UPDATE_SETTINGS':
        const updated = { ...settings, ...message.payload };
        await browser.storage.local.set({ settings: updated });
        return { success: true, settings: updated };

      case 'GET_STATS':
        return { stats: settings.stats };

      case 'RESET_STATS':
        settings.stats = { totalBlocked: 0, sessionBlocked: 0, sitesBlocked: {} };
        await browser.storage.local.set({ settings });
        return { success: true };

      case 'ADD_TO_WHITELIST':
        if (!settings.whitelist.includes(message.domain)) {
          settings.whitelist.push(message.domain);
          await browser.storage.local.set({ settings });
        }
        return { success: true };

      case 'REMOVE_FROM_WHITELIST':
        settings.whitelist = settings.whitelist.filter(d => d !== message.domain);
        await browser.storage.local.set({ settings });
        return { success: true };

      case 'IS_WHITELISTED':
        return {
          whitelisted: settings.whitelist.some(d =>
            message.domain === d || message.domain.endsWith('.' + d)
          )
        };

      case 'ADD_BLOCKED_SITE':
        if (!settings.blockedSitesList.includes(message.domain)) {
          settings.blockedSitesList.push(message.domain);
          await browser.storage.local.set({ settings });
        }
        return { success: true };

      case 'REMOVE_BLOCKED_SITE':
        settings.blockedSitesList = settings.blockedSitesList.filter(d => d !== message.domain);
        await browser.storage.local.set({ settings });
        return { success: true };

      case 'INCREMENT_BLOCK_COUNT':
        settings.stats.totalBlocked += (message.count || 1);
        settings.stats.sessionBlocked += (message.count || 1);
        if (message.domain) {
          settings.stats.sitesBlocked[message.domain] =
            (settings.stats.sitesBlocked[message.domain] || 0) + (message.count || 1);
        }
        await browser.storage.local.set({ settings });
        return { success: true };

      case 'GET_DETECTED_BLOCKED':
        const detected = await browser.storage.local.get('detectedBlockedSites');
        return { sites: detected.detectedBlockedSites || [] };

      default:
        return { error: 'Unknown message type' };
    }
  })();
});

// ── Badge Update ────────────────────────────────────────────────────────────
setInterval(async () => {
  const data = await browser.storage.local.get('settings');
  const settings = data.settings || DEFAULT_SETTINGS;
  if (settings.adBlockEnabled) {
    const count = settings.stats.sessionBlocked || 0;
    const text = count > 999 ? '999+' : count > 0 ? String(count) : '';
    browser.browserAction.setBadgeText({ text });
    browser.browserAction.setBadgeBackgroundColor({ color: '#10b981' });
  }
}, 60000);

console.log('[ShieldBrowse Firefox] Background script loaded.');
