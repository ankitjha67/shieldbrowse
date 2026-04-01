// ShieldBrowse v2.0 Background Service Worker
// Fixed: onRuleMatchedDebug (dev-only), MV3 auth, stats race, PAC XSS,
// Added: WebRTC protect, filter list import, UTM strip, crypto-miner block

const DEFAULT_SETTINGS = {
  adBlockEnabled: true, proxyEnabled: false, proxyMode: 'manual',
  proxyType: 'https', proxyHost: '', proxyPort: '',
  proxyUsername: '', proxyPassword: '',
  stats: { totalBlocked: 0, sessionBlocked: 0, sitesBlocked: {} },
  whitelist: [], blockedSitesList: [], customFilterRules: [],
  webrtcPolicy: 'disable_non_proxied_udp',
  stripTrackingParams: true, blockCryptoMiners: true,
  blockMalware: true, antiFingerprint: true,
  filterListUrls: [
    'https://easylist.to/easylist/easylist.txt',
    'https://easylist.to/easylist/easyprivacy.txt',
    'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=0',
    'https://filters.adtidy.org/extension/chromium/filters/2.txt',
    'https://filters.adtidy.org/extension/chromium/filters/3.txt',
    'https://raw.githubusercontent.com/nickkaczmarek/ios-content-blocker/master/nicklist.txt',
    'https://easylist.to/easylist/fanboy-social.txt',
    'https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-online.txt',
    'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt',
    'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt',
    'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt',
    'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/annoyances-others.txt'
  ],
  filterListLastUpdate: 0, filterListUpdateInterval: 86400000
};

const TRACKING_PARAMS = [
  'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
  'utm_id','utm_cid','fbclid','gclid','gclsrc','dclid','gbraid',
  'wbraid','msclkid','twclid','li_fat_id','igshid','mc_cid','mc_eid',
  '_hsenc','_hsmi','hsCtaTracking','mkt_tok','oly_anon_id','oly_enc_id',
  'otc','vero_conv','vero_id','s_cid','icid','ef_id','_openstat',
  'yclid','ymclid','rb_clickid','wickedid','soc_src','soc_trk'
];

const CRYPTO_MINER_DOMAINS = [
  'coinhive.com','coin-hive.com','authedmine.com','crypto-loot.com',
  'cryptoloot.pro','coinerra.com','coin-have.com','minero.cc',
  'monerominer.rocks','cdn.monerominer.rocks','ppoi.org','projectpoi.com',
  'mineralt.io','webminepool.com','jsecoin.com','coinimp.com',
  'webmine.cz','cryptonight.wasm'
];

// === STATS LOCK (FIX: race condition on concurrent writes) ===
let statsBuffer = { totalBlocked: 0, sessionBlocked: 0, sitesBlocked: {} };
let statsDirty = false;

async function loadStatsBuffer() {
  const { settings } = await chrome.storage.local.get('settings');
  if (settings?.stats) statsBuffer = { ...settings.stats };
}

function incrementStat(domain, count = 1) {
  statsBuffer.totalBlocked += count;
  statsBuffer.sessionBlocked += count;
  if (domain) {
    statsBuffer.sitesBlocked[domain] = (statsBuffer.sitesBlocked[domain] || 0) + count;
  }
  statsDirty = true;
}

async function flushStats() {
  if (!statsDirty) return;
  statsDirty = false;
  const { settings } = await chrome.storage.local.get('settings');
  if (settings) {
    settings.stats = { ...statsBuffer };
    await chrome.storage.local.set({ settings });
  }
}
setInterval(flushStats, 5000);

// === INITIALIZATION ===
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get('settings');
  if (!existing.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  } else {
    const merged = { ...DEFAULT_SETTINGS, ...existing.settings };
    merged.stats = { ...DEFAULT_SETTINGS.stats, ...(existing.settings.stats || {}) };
    await chrome.storage.local.set({ settings: merged });
  }
  chrome.contextMenus.create({ id: 'sb-whitelist-domain', title: 'ShieldBrowse: Whitelist this site', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'sb-block-element', title: 'ShieldBrowse: Block this element', contexts: ['page','image','video','frame'] });
  await loadStatsBuffer();
  await applyWebRTCPolicy();
  await applyCustomFilters();
  await applyTrackingParamRules();
  await applyCryptoMinerRules();
  await fetchAndApplyFilterLists();
});
loadStatsBuffer();

// === STATS TRACKING (FIX: replaces broken onRuleMatchedDebug) ===
chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (details.error === 'net::ERR_BLOCKED_BY_CLIENT') {
      try { incrementStat(new URL(details.url).hostname); }
      catch (e) { incrementStat(null); }
    }
  },
  { urls: ['<all_urls>'] }
);

// === TOGGLE AD BLOCKING ===
async function toggleAdBlocking(enabled) {
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets(
      enabled ? { enableRulesetIds: ['ad_rules'] } : { disableRulesetIds: ['ad_rules'] }
    );
  } catch (e) { console.warn('[ShieldBrowse] Ruleset toggle error:', e); }
}

// === PROXY MANAGEMENT ===
async function setProxy(settings) {
  if (!settings.proxyEnabled) {
    await chrome.proxy.settings.set({ value: { mode: 'direct' }, scope: 'regular' });
    return;
  }
  if (!settings.proxyHost || !settings.proxyPort) return;
  const scheme = settings.proxyType === 'socks5' ? 'socks5' : settings.proxyType === 'http' ? 'http' : 'https';
  await chrome.proxy.settings.set({
    value: {
      mode: 'fixed_servers',
      rules: {
        singleProxy: { scheme, host: settings.proxyHost, port: parseInt(settings.proxyPort, 10) },
        bypassList: ['localhost','127.0.0.1','10.0.0.0/8','172.16.0.0/12','192.168.0.0/16','<local>']
      }
    },
    scope: 'regular'
  });
}

// === PAC SCRIPT (FIX: sanitized domain injection, no XSS) ===
async function setAutoProxy(settings) {
  if (!settings.proxyEnabled || settings.proxyMode !== 'auto') return;
  if (!settings.proxyHost || !settings.proxyPort) return;
  const domains = (settings.blockedSitesList || [])
    .map(d => d.trim().toLowerCase().replace(/[^a-z0-9.\-]/g, ''))
    .filter(Boolean);
  if (domains.length === 0) return setProxy(settings);
  const scheme = settings.proxyType === 'socks5' ? 'SOCKS5' : settings.proxyType === 'http' ? 'PROXY' : 'HTTPS';
  const safeHost = settings.proxyHost.replace(/[^a-zA-Z0-9.\-]/g, '');
  const safePort = String(parseInt(settings.proxyPort, 10));
  const proxyStr = `${scheme} ${safeHost}:${safePort}`;
  const domainJSON = JSON.stringify(domains);
  const pac = `function FindProxyForURL(url, host) {
  var d = ${domainJSON}; host = host.toLowerCase();
  for (var i = 0; i < d.length; i++) { if (dnsDomainIs(host, d[i]) || dnsDomainIs(host, "." + d[i])) return "${proxyStr}"; }
  return "DIRECT"; }`;
  await chrome.proxy.settings.set({ value: { mode: 'pac_script', pacScript: { data: pac } }, scope: 'regular' });
}

// === PROXY AUTH (FIX: MV3 uses asyncBlocking, not blocking) ===
try {
  chrome.webRequest.onAuthRequired.addListener(
    (details, callback) => {
      chrome.storage.local.get('settings').then(({ settings }) => {
        if (settings?.proxyEnabled && settings?.proxyUsername) {
          callback({ authCredentials: { username: settings.proxyUsername, password: settings.proxyPassword || '' } });
        } else { callback({}); }
      });
    },
    { urls: ['<all_urls>'] },
    ['asyncBlocking']
  );
} catch (e) { console.warn('[ShieldBrowse] asyncBlocking not supported:', e.message); }

// === WEBRTC LEAK PROTECTION ===
async function applyWebRTCPolicy() {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) return;
  try {
    if (settings.proxyEnabled && settings.webrtcPolicy) {
      await chrome.privacy.network.webRTCIPHandlingPolicy.set({ value: settings.webrtcPolicy });
    } else {
      await chrome.privacy.network.webRTCIPHandlingPolicy.clear({});
    }
  } catch (e) { /* privacy API may not be available */ }
}

// === UTM / TRACKING PARAM STRIPPING (via DNR redirect) ===
async function applyTrackingParamRules() {
  const { settings } = await chrome.storage.local.get('settings');
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const oldIds = existing.filter(r => r.id >= 50000 && r.id < 51000).map(r => r.id);
  if (!settings?.stripTrackingParams) {
    if (oldIds.length > 0) await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds });
    return;
  }
  const rules = TRACKING_PARAMS.slice(0, 40).map((p, i) => ({
    id: 50000 + i, priority: 1,
    action: { type: 'redirect', redirect: { transform: { queryTransform: { removeParams: [p] } } } },
    condition: { urlFilter: `*`, resourceTypes: ['main_frame'], excludedRequestDomains: [] }
  }));
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds, addRules: rules });
}

// === CRYPTO MINER BLOCKING ===
async function applyCryptoMinerRules() {
  const { settings } = await chrome.storage.local.get('settings');
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const oldIds = existing.filter(r => r.id >= 51000 && r.id < 52000).map(r => r.id);
  if (!settings?.blockCryptoMiners) {
    if (oldIds.length > 0) await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds });
    return;
  }
  const rules = CRYPTO_MINER_DOMAINS.map((d, i) => ({
    id: 51000 + i, priority: 2, action: { type: 'block' },
    condition: { urlFilter: `||${d}`, resourceTypes: ['script','xmlhttprequest','sub_frame','other'] }
  }));
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds, addRules: rules });
}

// === CUSTOM FILTER ENGINE ===
async function applyCustomFilters() {
  const { settings } = await chrome.storage.local.get('settings');
  const rules = (settings?.customFilterRules || []).filter(r => r && !r.startsWith('#') && !r.startsWith('!'));
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const oldIds = existing.filter(r => r.id >= 10000 && r.id < 20000).map(r => r.id);
  const dnr = rules.slice(0, 500).map((rule, i) => ({
    id: 10000 + i, priority: 2, action: { type: 'block' },
    condition: { urlFilter: `||${rule}`, resourceTypes: ['script','image','xmlhttprequest','sub_frame','media','other'] }
  }));
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds, addRules: dnr });
}

// === COMMUNITY FILTER LIST ENGINE (EasyList/EasyPrivacy import) ===
async function fetchAndApplyFilterLists() {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) return;
  const now = Date.now();
  const cached = await chrome.storage.local.get('cachedFilterRules');
  if (cached.cachedFilterRules && (now - (settings.filterListLastUpdate||0) < (settings.filterListUpdateInterval||86400000))) {
    await applyFilterListRules(cached.cachedFilterRules);
    return;
  }
  const urls = settings.filterListUrls || [];
  if (urls.length === 0) return;
  const allDomains = new Set();
  for (const url of urls) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!resp.ok) continue;
      const text = await resp.text();
      for (const line of text.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('!') || t.startsWith('[') || t.includes('##') || t.includes('#@#') || t.includes('@@') || t.includes('$')) continue;
        const m = t.match(/^\|\|([a-zA-Z0-9.\-]+)\^?$/);
        if (m) allDomains.add(m[1].toLowerCase());
      }
    } catch (e) { console.warn('[ShieldBrowse] Filter list fetch failed:', url); }
  }
  const arr = [...allDomains].slice(0, 28000);
  await chrome.storage.local.set({ cachedFilterRules: arr });
  settings.filterListLastUpdate = now;
  await chrome.storage.local.set({ settings });
  await applyFilterListRules(arr);
  console.log(`[ShieldBrowse] Applied ${arr.length} community filter rules.`);
}

async function applyFilterListRules(domains) {
  if (!domains?.length) return;
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const oldIds = existing.filter(r => r.id >= 20000 && r.id < 50000).map(r => r.id);
  const rules = domains.slice(0, 28000).map((d, i) => ({
    id: 20000 + i, priority: 1, action: { type: 'block' },
    condition: { urlFilter: `||${d}`, resourceTypes: ['script','image','xmlhttprequest','sub_frame','media','other','font','stylesheet'] }
  }));
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds, addRules: rules });
}

// === BLOCKED SITE AUTO-DETECTION ===
chrome.webRequest.onErrorOccurred.addListener(
  async (details) => {
    const errs = ['net::ERR_CONNECTION_RESET','net::ERR_CONNECTION_REFUSED','net::ERR_CONNECTION_TIMED_OUT','net::ERR_NAME_NOT_RESOLVED','net::ERR_TIMED_OUT','net::ERR_SSL_PROTOCOL_ERROR'];
    if (details.type === 'main_frame' && errs.includes(details.error)) {
      const { settings } = await chrome.storage.local.get('settings');
      if (settings?.proxyEnabled && settings?.proxyMode === 'auto' && settings?.proxyHost) {
        try {
          const domain = new URL(details.url).hostname.replace(/^www\./, '');
          if (!(settings.blockedSitesList||[]).includes(domain)) {
            chrome.action.setBadgeText({ text: '!' });
            chrome.action.setBadgeBackgroundColor({ color: '#e74c3c' });
            const det = await chrome.storage.local.get('detectedBlockedSites');
            const sites = det.detectedBlockedSites || [];
            if (!sites.includes(domain)) { sites.push(domain); await chrome.storage.local.set({ detectedBlockedSites: sites }); }
          }
        } catch (e) {}
      }
    }
  },
  { urls: ['<all_urls>'] }
);

// === MESSAGE HANDLER ===
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const { settings } = await chrome.storage.local.get('settings');
    switch (msg.type) {
      case 'GET_SETTINGS':
        if (settings) settings.stats = { ...statsBuffer };
        sendResponse({ settings });
        break;
      case 'UPDATE_SETTINGS': {
        const u = { ...settings, ...msg.payload };
        await chrome.storage.local.set({ settings: u });
        await toggleAdBlocking(u.adBlockEnabled);
        if (u.proxyEnabled) { await applyWebRTCPolicy(); u.proxyMode==='auto' ? await setAutoProxy(u) : await setProxy(u); }
        else { await setProxy(u); try{await chrome.privacy.network.webRTCIPHandlingPolicy.clear({});}catch(e){} }
        if (msg.payload.customFilterRules!==undefined) await applyCustomFilters();
        if (msg.payload.stripTrackingParams!==undefined) await applyTrackingParamRules();
        if (msg.payload.blockCryptoMiners!==undefined) await applyCryptoMinerRules();
        sendResponse({ success: true, settings: u });
        break;
      }
      case 'GET_STATS': sendResponse({ stats: {...statsBuffer} }); break;
      case 'RESET_STATS': statsBuffer={totalBlocked:0,sessionBlocked:0,sitesBlocked:{}}; statsDirty=true; await flushStats(); sendResponse({success:true}); break;
      case 'ADD_TO_WHITELIST': if(!settings.whitelist.includes(msg.domain)){settings.whitelist.push(msg.domain);await chrome.storage.local.set({settings});} sendResponse({success:true}); break;
      case 'REMOVE_FROM_WHITELIST': settings.whitelist=settings.whitelist.filter(d=>d!==msg.domain); await chrome.storage.local.set({settings}); sendResponse({success:true}); break;
      case 'IS_WHITELISTED': sendResponse({whitelisted:(settings?.whitelist||[]).some(d=>msg.domain===d||msg.domain.endsWith('.'+d))}); break;
      case 'ADD_BLOCKED_SITE': if(!settings.blockedSitesList.includes(msg.domain)){settings.blockedSitesList.push(msg.domain);await chrome.storage.local.set({settings});if(settings.proxyEnabled&&settings.proxyMode==='auto')await setAutoProxy(settings);} sendResponse({success:true}); break;
      case 'REMOVE_BLOCKED_SITE': settings.blockedSitesList=settings.blockedSitesList.filter(d=>d!==msg.domain);await chrome.storage.local.set({settings});if(settings.proxyEnabled&&settings.proxyMode==='auto')await setAutoProxy(settings); sendResponse({success:true}); break;
      case 'INCREMENT_BLOCK_COUNT': incrementStat(msg.domain,msg.count||1); sendResponse({success:true}); break;
      case 'GET_DETECTED_BLOCKED': {const d=await chrome.storage.local.get('detectedBlockedSites');sendResponse({sites:d.detectedBlockedSites||[]});break;}
      case 'FORCE_FILTER_UPDATE': settings.filterListLastUpdate=0;await chrome.storage.local.set({settings});await fetchAndApplyFilterLists();sendResponse({success:true}); break;
      case 'GET_FILTER_LIST_STATUS': {const c=await chrome.storage.local.get('cachedFilterRules');sendResponse({ruleCount:c.cachedFilterRules?.length||0,lastUpdate:settings.filterListLastUpdate||0,urls:settings.filterListUrls||[]});break;}
      default: sendResponse({error:'Unknown message type'});
    }
  })();
  return true;
});

// === KEYBOARD COMMANDS ===
chrome.commands?.onCommand?.addListener(async (cmd) => {
  const { settings } = await chrome.storage.local.get('settings');
  if (cmd==='toggle-ad-block') { settings.adBlockEnabled=!settings.adBlockEnabled; await chrome.storage.local.set({settings}); await toggleAdBlocking(settings.adBlockEnabled); chrome.action.setBadgeText({text:settings.adBlockEnabled?'':'OFF'}); }
  else if (cmd==='toggle-proxy') { settings.proxyEnabled=!settings.proxyEnabled; await chrome.storage.local.set({settings}); settings.proxyEnabled?(settings.proxyMode==='auto'?await setAutoProxy(settings):await setProxy(settings)):await setProxy(settings); }
  else if (cmd==='whitelist-current') { const [tab]=await chrome.tabs.query({active:true,currentWindow:true}); if(tab?.url){try{const d=new URL(tab.url).hostname.replace(/^www\./,'');if(!settings.whitelist.includes(d)){settings.whitelist.push(d);await chrome.storage.local.set({settings});}}catch(e){}} }
});

// === CONTEXT MENUS ===
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId==='sb-whitelist-domain'&&tab?.url) { try{const d=new URL(tab.url).hostname.replace(/^www\./,'');const{settings}=await chrome.storage.local.get('settings');if(!settings.whitelist.includes(d)){settings.whitelist.push(d);await chrome.storage.local.set({settings});}}catch(e){} }
  if (info.menuItemId==='sb-block-element'&&tab?.id) { chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{const o=document.createElement('div');o.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;cursor:crosshair;background:rgba(0,0,0,0.1);';document.body.appendChild(o);o.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();o.remove();const el=document.elementFromPoint(e.clientX,e.clientY);if(el)el.style.setProperty('display','none','important');});document.addEventListener('keydown',e=>{if(e.key==='Escape')o.remove();},{once:true});}}); }
});

// === ALARMS ===
chrome.alarms.create('updateBadge', { periodInMinutes: 1 });
chrome.alarms.create('filterListUpdate', { periodInMinutes: 360 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name==='updateBadge') { const{settings}=await chrome.storage.local.get('settings'); if(settings?.adBlockEnabled){const c=statsBuffer.sessionBlocked||0;chrome.action.setBadgeText({text:c>999?'999+':c>0?String(c):''});chrome.action.setBadgeBackgroundColor({color:'#10b981'});} }
  if (alarm.name==='filterListUpdate') await fetchAndApplyFilterLists();
});

// === READER MODE (keyboard shortcut handler) ===
chrome.commands?.onCommand?.addListener(async (cmd) => {
  if (cmd === 'reader-mode') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_READER_MODE' });
    }
  }
});

// === REFERRER CONTROL ===
// Uses DNR modifyHeaders to strip/minimize cross-origin referer headers.
// Legal: Identical to browser built-in referrer policy settings.
async function applyReferrerPolicy() {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) return;
  const mode = settings.referrerPolicy || 'smart';
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const oldIds = existing.filter(r => r.id >= 60000 && r.id < 61000).map(r => r.id);

  if (mode === 'off') {
    if (oldIds.length > 0) await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds });
    return;
  }

  const rules = [];
  if (mode === 'strict') {
    rules.push({
      id: 60000, priority: 1,
      action: { type: 'modifyHeaders', requestHeaders: [{ header: 'Referer', operation: 'remove' }] },
      condition: { domainType: 'thirdParty', resourceTypes: ['main_frame','sub_frame','script','image','xmlhttprequest','media','font','stylesheet','other'] }
    });
  } else if (mode === 'smart') {
    rules.push({
      id: 60000, priority: 1,
      action: { type: 'modifyHeaders', requestHeaders: [{ header: 'Referer', operation: 'remove' }] },
      condition: { domainType: 'thirdParty', resourceTypes: ['main_frame'] }
    });
  }
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds, addRules: rules });
}

// === COOKIE AUTO-CLEAR ===
// Clears cookies when a tab closes (if not whitelisted). Same as Safari ITP.
// Legal: GDPR Article 17 right to erasure. All major browsers offer this.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings?.cookieAutoClear) return;
  try {
    const tabData = await chrome.storage.session.get(`tab_${tabId}`);
    const domain = tabData?.[`tab_${tabId}`];
    if (!domain) return;
    if (settings.whitelist?.some(d => domain === d || domain.endsWith('.' + d))) return;
    // Check no other tabs have this domain open
    const tabs = await chrome.tabs.query({});
    const otherOpen = tabs.some(t => { try { return new URL(t.url).hostname.includes(domain); } catch { return false; } });
    if (otherOpen) return;
    const cookies = await chrome.cookies.getAll({ domain });
    for (const c of cookies) {
      await chrome.cookies.remove({ url: `http${c.secure?'s':''}://${c.domain}${c.path}`, name: c.name });
    }
    await chrome.storage.session.remove(`tab_${tabId}`);
  } catch (e) { /* cookies API may fail */ }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.url) {
    try { await chrome.storage.session.set({ [`tab_${tabId}`]: new URL(changeInfo.url).hostname }); }
    catch (e) {}
  }
});

// Handle new message types for privacy features
const origMessageListener = chrome.runtime.onMessage._listeners?.[0];
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case 'ACTIVATE_READER_MODE': {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_READER_MODE' });
        sendResponse({ success: true });
        break;
      }
      case 'GET_CACHE_LINKS': {
        const links = [
          { name: 'Google Cache', url: `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(msg.url)}` },
          { name: 'Wayback Machine', url: `https://web.archive.org/web/${msg.url}` },
          { name: 'Google Text-Only', url: `https://www.google.com/search?q=cache:${encodeURIComponent(msg.url)}&strip=1` }
        ];
        sendResponse({ links });
        break;
      }
      case 'UPDATE_REFERRER_POLICY': {
        const { settings } = await chrome.storage.local.get('settings');
        settings.referrerPolicy = msg.value;
        await chrome.storage.local.set({ settings });
        await applyReferrerPolicy();
        sendResponse({ success: true });
        break;
      }
      case 'TOGGLE_COOKIE_AUTOCLEAR': {
        const { settings } = await chrome.storage.local.get('settings');
        settings.cookieAutoClear = msg.value;
        await chrome.storage.local.set({ settings });
        sendResponse({ success: true });
        break;
      }
      default: return; // Let other listeners handle
    }
  })();
  return true;
});

// Apply referrer policy on startup
applyReferrerPolicy();

console.log('[ShieldBrowse v2] Service worker loaded.');
