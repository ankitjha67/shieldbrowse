// ── ShieldBrowse Popup Controller ────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {

  // ── DOM References ──────────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Stats
  const totalBlockedEl   = $('#totalBlocked');
  const sessionBlockedEl = $('#sessionBlocked');
  const domainsBlockedEl = $('#domainsBlocked');
  const topDomainsEl     = $('#topDomains');

  // Toggles
  const adBlockToggle = $('#adBlockToggle');
  const proxyToggle   = $('#proxyToggle');

  // Proxy config
  const proxyModeEl   = $('#proxyMode');
  const proxyTypeEl   = $('#proxyType');
  const proxyHostEl   = $('#proxyHost');
  const proxyPortEl   = $('#proxyPort');
  const proxyUserEl   = $('#proxyUser');
  const proxyPassEl   = $('#proxyPass');

  // Status
  const statusDot        = $('#statusDot');
  const statusText       = $('#statusText');
  const proxyStatusIcon  = $('#proxyStatusIcon');
  const proxyStatusText  = $('#proxyStatusText');

  // ── Tab Navigation ────────────────────────────────────────────────────
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach(t => t.classList.remove('active'));
      $$('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      $(`#tab-${tab.dataset.tab}`).classList.add('active');
    });
  });

  // ── Load Settings ─────────────────────────────────────────────────────
  function sendMessage(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, resolve);
    });
  }

  async function loadSettings() {
    const response = await sendMessage({ type: 'GET_SETTINGS' });
    if (!response?.settings) return null;
    return response.settings;
  }

  async function saveSettings(payload) {
    return sendMessage({ type: 'UPDATE_SETTINGS', payload });
  }

  const settings = await loadSettings();
  if (!settings) return;

  // ── Populate UI ───────────────────────────────────────────────────────
  adBlockToggle.checked = settings.adBlockEnabled;
  proxyToggle.checked   = settings.proxyEnabled;
  proxyModeEl.value     = settings.proxyMode || 'manual';
  proxyTypeEl.value     = settings.proxyType || 'https';
  proxyHostEl.value     = settings.proxyHost || '';
  proxyPortEl.value     = settings.proxyPort || '';
  proxyUserEl.value     = settings.proxyUsername || '';
  proxyPassEl.value     = settings.proxyPassword || '';

  updateGlobalStatus(settings);
  updateProxyStatus(settings);
  updateStats(settings.stats);
  renderWhitelist(settings.whitelist || []);
  renderBlockedSites(settings.blockedSitesList || []);
  loadDetectedSites();

  // ── Stats Display ─────────────────────────────────────────────────────
  function updateStats(stats) {
    totalBlockedEl.textContent   = formatNumber(stats.totalBlocked || 0);
    sessionBlockedEl.textContent = formatNumber(stats.sessionBlocked || 0);
    domainsBlockedEl.textContent = Object.keys(stats.sitesBlocked || {}).length;

    // Top domains
    const sorted = Object.entries(stats.sitesBlocked || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    if (sorted.length === 0) {
      topDomainsEl.innerHTML = '<li class="empty-state">No blocked domains yet</li>';
    } else {
      topDomainsEl.innerHTML = sorted.map(([domain, count]) => `
        <li class="domain-item">
          <span class="domain-name">${escapeHtml(domain)}</span>
          <span class="domain-count">${formatNumber(count)}</span>
        </li>
      `).join('');
    }
  }

  function formatNumber(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Status Indicators ─────────────────────────────────────────────────
  function updateGlobalStatus(s) {
    if (s.adBlockEnabled) {
      statusDot.classList.remove('inactive');
      statusText.textContent = 'Active';
      statusText.style.color = 'var(--accent)';
    } else {
      statusDot.classList.add('inactive');
      statusText.textContent = 'Paused';
      statusText.style.color = 'var(--text-muted)';
    }
  }

  function updateProxyStatus(s) {
    if (s.proxyEnabled && s.proxyHost) {
      proxyStatusIcon.classList.add('connected');
      proxyStatusIcon.classList.remove('disconnected');
      const mode = s.proxyMode === 'auto' ? 'Auto' : 'Full';
      proxyStatusText.textContent = `Connected (${mode})`;
      proxyStatusText.style.color = 'var(--accent)';
    } else {
      proxyStatusIcon.classList.add('disconnected');
      proxyStatusIcon.classList.remove('connected');
      proxyStatusText.textContent = 'Proxy Disconnected';
      proxyStatusText.style.color = 'var(--text-muted)';
    }
  }

  // ── Event: Ad Block Toggle ────────────────────────────────────────────
  adBlockToggle.addEventListener('change', async () => {
    const result = await saveSettings({ adBlockEnabled: adBlockToggle.checked });
    if (result?.settings) {
      updateGlobalStatus(result.settings);
    }
  });

  // ── Event: Proxy Toggle ───────────────────────────────────────────────
  proxyToggle.addEventListener('change', async () => {
    const result = await saveSettings({
      proxyEnabled: proxyToggle.checked
    });
    if (result?.settings) {
      updateProxyStatus(result.settings);
    }
  });

  // ── Event: Save Proxy Config ──────────────────────────────────────────
  $('#saveProxyBtn').addEventListener('click', async () => {
    const host = proxyHostEl.value.trim();
    const port = proxyPortEl.value.trim();

    if (!host || !port) {
      proxyHostEl.style.borderColor = !host ? 'var(--danger)' : '';
      proxyPortEl.style.borderColor = !port ? 'var(--danger)' : '';
      return;
    }

    proxyHostEl.style.borderColor = '';
    proxyPortEl.style.borderColor = '';

    const result = await saveSettings({
      proxyEnabled: true,
      proxyMode: proxyModeEl.value,
      proxyType: proxyTypeEl.value,
      proxyHost: host,
      proxyPort: port,
      proxyUsername: proxyUserEl.value.trim(),
      proxyPassword: proxyPassEl.value
    });

    if (result?.settings) {
      proxyToggle.checked = true;
      updateProxyStatus(result.settings);
      $('#saveProxyBtn').textContent = 'Connected!';
      setTimeout(() => {
        $('#saveProxyBtn').textContent = 'Save & Connect';
      }, 2000);
    }
  });

  // ── Event: Reset Stats ────────────────────────────────────────────────
  $('#resetStatsBtn').addEventListener('click', async () => {
    await sendMessage({ type: 'RESET_STATS' });
    updateStats({ totalBlocked: 0, sessionBlocked: 0, sitesBlocked: {} });
  });

  // ── Whitelist Management ──────────────────────────────────────────────
  function renderWhitelist(list) {
    const container = $('#whitelistChips');
    if (list.length === 0) {
      container.innerHTML = '<span class="empty-state" style="font-size:11px;">No whitelisted sites</span>';
      return;
    }
    container.innerHTML = list.map(domain => `
      <span class="chip">
        ${escapeHtml(domain)}
        <button class="chip-remove" data-domain="${escapeHtml(domain)}" data-action="remove-whitelist">&times;</button>
      </span>
    `).join('');

    container.querySelectorAll('[data-action="remove-whitelist"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await sendMessage({ type: 'REMOVE_FROM_WHITELIST', domain: btn.dataset.domain });
        const s = await loadSettings();
        renderWhitelist(s.whitelist || []);
      });
    });
  }

  $('#addWhitelistBtn').addEventListener('click', async () => {
    const input = $('#whitelistInput');
    const domain = input.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!domain) return;
    await sendMessage({ type: 'ADD_TO_WHITELIST', domain });
    input.value = '';
    const s = await loadSettings();
    renderWhitelist(s.whitelist || []);
  });

  $('#whitelistInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#addWhitelistBtn').click();
  });

  // ── Blocked Sites (Auto-Proxy) Management ─────────────────────────────
  function renderBlockedSites(list) {
    const container = $('#blockedSitesList');
    if (list.length === 0) {
      container.innerHTML = '<span class="empty-state" style="font-size:11px;">No blocked sites added</span>';
      return;
    }
    container.innerHTML = list.map(domain => `
      <span class="chip">
        ${escapeHtml(domain)}
        <button class="chip-remove" data-domain="${escapeHtml(domain)}" data-action="remove-blocked">&times;</button>
      </span>
    `).join('');

    container.querySelectorAll('[data-action="remove-blocked"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await sendMessage({ type: 'REMOVE_BLOCKED_SITE', domain: btn.dataset.domain });
        const s = await loadSettings();
        renderBlockedSites(s.blockedSitesList || []);
      });
    });
  }

  $('#addBlockedSiteBtn').addEventListener('click', async () => {
    const input = $('#blockedSiteInput');
    const domain = input.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!domain) return;
    await sendMessage({ type: 'ADD_BLOCKED_SITE', domain });
    input.value = '';
    const s = await loadSettings();
    renderBlockedSites(s.blockedSitesList || []);
  });

  $('#blockedSiteInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#addBlockedSiteBtn').click();
  });

  // ── Detected Blocked Sites ────────────────────────────────────────────
  async function loadDetectedSites() {
    const response = await sendMessage({ type: 'GET_DETECTED_BLOCKED' });
    const sites = response?.sites || [];
    const section = $('#detectedSection');
    const container = $('#detectedChips');

    if (sites.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';
    container.innerHTML = sites.map(domain => `
      <span class="chip" style="cursor: pointer;" data-domain="${escapeHtml(domain)}" data-action="add-detected">
        + ${escapeHtml(domain)}
      </span>
    `).join('');

    container.querySelectorAll('[data-action="add-detected"]').forEach(chip => {
      chip.addEventListener('click', async () => {
        await sendMessage({ type: 'ADD_BLOCKED_SITE', domain: chip.dataset.domain });
        chip.remove();
        const s = await loadSettings();
        renderBlockedSites(s.blockedSitesList || []);
      });
    });
  }

  // ── Current Page Actions ──────────────────────────────────────────────
  async function getCurrentDomain() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url) {
          try {
            const url = new URL(tabs[0].url);
            resolve(url.hostname.replace(/^www\./, ''));
          } catch (e) {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
  }

  $('#whitelistCurrentBtn').addEventListener('click', async () => {
    const domain = await getCurrentDomain();
    if (!domain) return;
    await sendMessage({ type: 'ADD_TO_WHITELIST', domain });
    const s = await loadSettings();
    renderWhitelist(s.whitelist || []);
    $('#whitelistCurrentBtn').textContent = `Added: ${domain}`;
    setTimeout(() => {
      $('#whitelistCurrentBtn').textContent = 'Whitelist This Site';
    }, 2000);
  });

  $('#proxyCurrentBtn').addEventListener('click', async () => {
    const domain = await getCurrentDomain();
    if (!domain) return;
    await sendMessage({ type: 'ADD_BLOCKED_SITE', domain });
    const s = await loadSettings();
    renderBlockedSites(s.blockedSitesList || []);
    $('#proxyCurrentBtn').textContent = `Added: ${domain}`;
    setTimeout(() => {
      $('#proxyCurrentBtn').textContent = 'Add to Proxy';
    }, 2000);
  });

  // ── Auto-refresh stats every 3s ───────────────────────────────────────
  setInterval(async () => {
    const response = await sendMessage({ type: 'GET_STATS' });
    if (response?.stats) {
      updateStats(response.stats);
    }
  }, 3000);

});

  // ── Reader Mode ───────────────────────────────────────────────────────
  const readerBtn = document.getElementById('readerModeBtn');
  if (readerBtn) {
    readerBtn.addEventListener('click', async () => {
      const [tab] = await new Promise(r => chrome.tabs.query({ active: true, currentWindow: true }, r));
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_READER_MODE' }, (resp) => {
          if (resp?.success) {
            window.close();
          } else {
            readerBtn.textContent = 'No article found';
            setTimeout(() => { readerBtn.textContent = 'Reader Mode'; }, 2000);
          }
        });
      }
    });
  }

  // ── Archive Links ─────────────────────────────────────────────────────
  const archiveBtn = document.getElementById('archiveLinksBtn');
  if (archiveBtn) {
    archiveBtn.addEventListener('click', async () => {
      const [tab] = await new Promise(r => chrome.tabs.query({ active: true, currentWindow: true }, r));
      if (tab?.url) {
        const url = tab.url;
        const links = [
          { name: 'Google Cache', url: 'https://webcache.googleusercontent.com/search?q=cache:' + encodeURIComponent(url) },
          { name: 'Wayback Machine', url: 'https://web.archive.org/web/' + url },
          { name: 'Google Text', url: 'https://www.google.com/search?q=cache:' + encodeURIComponent(url) + '&strip=1' }
        ];
        // Open first available in new tab
        chrome.tabs.create({ url: links[1].url }); // Wayback Machine is most reliable
        window.close();
      }
    });
  }
