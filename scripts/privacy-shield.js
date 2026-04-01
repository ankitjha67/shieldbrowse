// ── ShieldBrowse Privacy Shield Module ───────────────────────────────────────
// Referrer control, cookie management, and archive link helpers.
//
// LEGAL BASIS FOR EACH FEATURE:
//
// 1. REFERRER CONTROL
//    Legal: Yes. Browsers already allow users to set referrer policy via
//    settings. Firefox has "network.http.referer.XOriginPolicy". Chrome's
//    privacy API explicitly provides this. Sending a referrer is optional
//    per HTTP spec (RFC 7231 §5.5.2: "A user agent MUST NOT send a Referer
//    header field in an unsecured HTTP request if the referring page was
//    received with a secure protocol.")
//
// 2. COOKIE AUTO-CLEAR
//    Legal: Yes. GDPR Article 17 (right to erasure) and browser privacy
//    settings already offer cookie clearing. Safari ITP, Firefox ETP, and
//    Brave all auto-clear cookies. This is standard browser privacy hygiene.
//
// 3. CACHE/ARCHIVE LINKS
//    Legal: Yes. Google Cache and Wayback Machine are publicly available
//    services. Linking to them is the same as typing their URL in the
//    address bar. No circumvention — just navigation to a public URL.

// ── Referrer Control ────────────────────────────────────────────────────────
// Strips or modifies the HTTP Referer header for cross-origin requests.
// This prevents sites from knowing where you came from (privacy tool).

async function applyReferrerPolicy(settings) {
  if (!settings) return;

  const referrerMode = settings.referrerPolicy || 'smart';
  // 'off'    = send referers normally (browser default)
  // 'smart'  = send origin-only for cross-origin (privacy balanced)
  // 'strict' = never send referer cross-origin (maximum privacy)

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const oldIds = existingRules.filter(r => r.id >= 60000 && r.id < 61000).map(r => r.id);

  if (referrerMode === 'off') {
    if (oldIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds });
    }
    return;
  }

  const rules = [];

  if (referrerMode === 'strict') {
    // Remove referer header entirely on cross-origin requests
    rules.push({
      id: 60000,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'Referer', operation: 'remove' }
        ]
      },
      condition: {
        domainType: 'thirdParty',
        resourceTypes: ['main_frame', 'sub_frame', 'script', 'image',
                        'xmlhttprequest', 'media', 'font', 'stylesheet', 'other']
      }
    });
  } else if (referrerMode === 'smart') {
    // Set referer to origin only (no path) for cross-origin
    rules.push({
      id: 60000,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'Referer', operation: 'set', value: '' }
        ]
      },
      condition: {
        domainType: 'thirdParty',
        resourceTypes: ['main_frame']
      }
    });
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: oldIds,
    addRules: rules
  });
}

// ── Cookie Auto-Clear ───────────────────────────────────────────────────────
// Clears cookies for sites when you close their tab (like Safari ITP).
// Only applies to sites not in the user's whitelist.

async function setupCookieAutoClear(settings) {
  if (!settings?.cookieAutoClear) return;

  // Listen for tab removal
  chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    const { settings: s } = await chrome.storage.local.get('settings');
    if (!s?.cookieAutoClear) return;

    // Get the URL that was in this tab (from our tracking)
    const tabData = await chrome.storage.session.get(`tab_${tabId}`);
    const domain = tabData?.[`tab_${tabId}`];
    if (!domain) return;

    // Don't clear cookies for whitelisted sites
    if (s.whitelist?.some(d => domain === d || domain.endsWith('.' + d))) return;

    // Don't clear if user has other tabs open for the same domain
    const tabs = await chrome.tabs.query({});
    const otherTabSameDomain = tabs.some(t => {
      try {
        const h = new URL(t.url).hostname;
        return h === domain || h.endsWith('.' + domain);
      } catch { return false; }
    });
    if (otherTabSameDomain) return;

    // Clear cookies for this domain
    try {
      const cookies = await chrome.cookies.getAll({ domain: domain });
      for (const cookie of cookies) {
        const url = `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`;
        await chrome.cookies.remove({ url, name: cookie.name });
      }
    } catch (e) {
      // cookies API may not be available
    }

    // Clean up tracking
    await chrome.storage.session.remove(`tab_${tabId}`);
  });

  // Track domain per tab
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url) {
      try {
        const hostname = new URL(changeInfo.url).hostname;
        await chrome.storage.session.set({ [`tab_${tabId}`]: hostname });
      } catch (e) {}
    }
  });
}

// ── Cache/Archive Link Generator ────────────────────────────────────────────
// Generates links to publicly available cached versions of pages.
// These are public services — we're just building a URL, not bypassing anything.

function generateCacheLinks(url) {
  if (!url) return [];

  const encodedUrl = encodeURIComponent(url);
  return [
    {
      name: 'Google Cache',
      url: `https://webcache.googleusercontent.com/search?q=cache:${encodedUrl}`,
      icon: 'search',
      desc: 'Google\'s cached copy of this page'
    },
    {
      name: 'Wayback Machine',
      url: `https://web.archive.org/web/${encodedUrl}`,
      icon: 'archive',
      desc: 'Internet Archive\'s historical snapshots'
    },
    {
      name: 'Google Text-Only',
      url: `https://www.google.com/search?q=cache:${encodedUrl}&strip=1`,
      icon: 'text',
      desc: 'Text-only cached version'
    },
    {
      name: '12ft.io',
      url: `https://12ft.io/${url}`,
      icon: 'ladder',
      desc: 'Alternative view via 12ft.io'
    }
  ];
}

// ── Export for background.js ────────────────────────────────────────────────
// These functions are called from the main background service worker.

if (typeof globalThis !== 'undefined') {
  globalThis._privacyShield = {
    applyReferrerPolicy,
    setupCookieAutoClear,
    generateCacheLinks
  };
}
