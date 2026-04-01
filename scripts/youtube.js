// ShieldBrowse v2.0 YouTube Ad Blocker
// FIX: XHR/fetch patching now injected into PAGE world (not isolated content script)
// FIX: Player response interception runs before YouTube loads
// FIX: Debounced observer, resilient skip button detection

(function () {
  'use strict';
  let adBlockEnabled = true;

  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (r) => {
    if (r?.settings) adBlockEnabled = r.settings.adBlockEnabled;
  });

  const YT_AD_SELECTORS = [
    '.video-ads','.ytp-ad-module','.ytp-ad-overlay-container','.ytp-ad-overlay-slot',
    '.ytp-ad-text-overlay','.ytp-ad-image-overlay','.ytp-ad-skip-button-container',
    '.ytp-ad-player-overlay','.ytp-ad-player-overlay-instream-info',
    '.ytp-ad-action-interstitial','.ytp-ad-overlay-close-button',
    '.ytp-ad-badge','.ytp-ad-visit-advertiser-button','.ytp-ad-button',
    '.ytp-ad-progress-list','#masthead-ad','ytd-masthead-ad-renderer',
    'ytd-primetime-promo-renderer','ytd-promoted-sparkles-web-renderer',
    'ytd-promoted-video-renderer','ytd-display-ad-renderer','ytd-ad-slot-renderer',
    'ytd-in-feed-ad-layout-renderer','ytd-banner-promo-renderer',
    'ytd-statement-banner-renderer',
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]',
    '#player-ads','ytd-companion-slot-renderer','ytd-search-pyv-renderer',
    'ytd-mealbar-promo-renderer','tp-yt-paper-dialog.ytd-mealbar-promo-renderer',
    'ytd-movie-offer-module-renderer','.ytd-merch-shelf-renderer',
    '.ytd-enforcement-message-view-model'
  ];

  // === SKIP VIDEO ADS ===
  function skipVideoAd() {
    if (!adBlockEnabled) return;
    const player = document.querySelector('.html5-video-player');
    if (!player) return;
    const isAd = player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
    if (!isAd) return;

    const video = player.querySelector('video');
    if (video) {
      if (video.duration && isFinite(video.duration)) video.currentTime = video.duration;
      video.muted = true;
      video.playbackRate = 16; // fast-forward at max speed
    }

    // Click all known skip button variants
    const skipSelectors = [
      '.ytp-ad-skip-button','.ytp-ad-skip-button-modern','.ytp-skip-ad-button',
      'button.ytp-ad-skip-button','.ytp-ad-skip-button-container button',
      '.ytp-ad-skip-button-slot button','button[class*="skip"]',
      '.ytp-ad-overlay-close-button','.ytp-ad-overlay-close-container'
    ];
    for (const sel of skipSelectors) {
      const btn = document.querySelector(sel);
      if (btn && btn.offsetParent !== null) {
        btn.click();
        chrome.runtime.sendMessage({ type: 'INCREMENT_BLOCK_COUNT', count: 1, domain: 'youtube.com' });
        break;
      }
    }
  }

  // === HIDE AD DOM ELEMENTS ===
  let pendingHide = false;
  function hideYouTubeAds() {
    if (!adBlockEnabled) return;
    let newBlocked = 0;
    document.querySelectorAll(YT_AD_SELECTORS.join(',')).forEach(el => {
      if (!el.dataset.sbYtHidden) {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('height', '0', 'important');
        el.style.setProperty('overflow', 'hidden', 'important');
        el.dataset.sbYtHidden = 'true';
        newBlocked++;
      }
    });
    // Remove promoted items in feed
    document.querySelectorAll('ytd-video-renderer,ytd-rich-item-renderer').forEach(item => {
      const badge = item.querySelector('[badge-style="BADGE_STYLE_TYPE_AD"],.ytd-badge-supported-renderer');
      if (badge && badge.textContent?.toLowerCase().includes('ad') && !item.dataset.sbYtHidden) {
        item.style.setProperty('display', 'none', 'important');
        item.dataset.sbYtHidden = 'true';
        newBlocked++;
      }
    });
    if (newBlocked > 0) {
      chrome.runtime.sendMessage({ type: 'INCREMENT_BLOCK_COUNT', count: newBlocked, domain: 'youtube.com' });
    }
  }

  // === PAGE WORLD INJECTION (FIX: XHR/fetch patches must run in page world) ===
  // Content scripts run in an isolated world. YouTube's actual XHR/fetch calls
  // are in the MAIN world. We must inject a <script> to patch them there.
  function injectPageWorldScript() {
    const script = document.createElement('script');
    script.textContent = `(function(){
      'use strict';

      // --- Intercept XHR to ad endpoints ---
      const origXHROpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === 'string') {
          var adPats = ['/pagead/','/ptracking','/api/stats/ads','/get_midroll_info',
            'googlesyndication','doubleclick.net','googleadservices','/log_interaction',
            'generate_204','/api/stats/playback','/api/stats/watchtime'];
          for (var i = 0; i < adPats.length; i++) {
            if (url.indexOf(adPats[i]) !== -1) {
              return origXHROpen.call(this, method, 'data:text/plain,');
            }
          }
        }
        return origXHROpen.apply(this, arguments);
      };

      // --- Intercept fetch to ad endpoints ---
      var origFetch = window.fetch;
      window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        if (url) {
          var adPats = ['/pagead/','/ptracking','/api/stats/ads','get_midroll_info',
            'googlesyndication','doubleclick.net'];
          for (var i = 0; i < adPats.length; i++) {
            if (url.indexOf(adPats[i]) !== -1) {
              return Promise.resolve(new Response('', {status: 200}));
            }
          }
        }
        return origFetch.apply(this, arguments);
      };

      // --- Strip ad data from player response BEFORE YouTube reads it ---
      function stripAds(obj) {
        if (!obj || typeof obj !== 'object') return;
        delete obj.adPlacements;
        delete obj.adSlots;
        delete obj.playerAds;
        delete obj.adParams;
        delete obj.adBreakParams;
        if (obj.playerResponse) stripAds(obj.playerResponse);
      }

      // Intercept ytInitialPlayerResponse
      var _ytIPR;
      Object.defineProperty(window, 'ytInitialPlayerResponse', {
        configurable: true,
        get: function() { return _ytIPR; },
        set: function(v) { if (v) stripAds(v); _ytIPR = v; }
      });

      // Also intercept ytInitialData for feed ads
      var _ytID;
      Object.defineProperty(window, 'ytInitialData', {
        configurable: true,
        get: function() { return _ytID; },
        set: function(v) { _ytID = v; }
      });

      // Block window.open popups from ad scripts
      var origOpen = window.open;
      window.open = function() {
        var url = arguments[0] || '';
        if (typeof url === 'string' && (url.indexOf('doubleclick') !== -1 || url.indexOf('googlesyndication') !== -1 || url.indexOf('googleadservices') !== -1)) {
          return null;
        }
        return origOpen.apply(this, arguments);
      };
    })();`;
    // Must inject BEFORE YouTube's scripts run
    (document.head || document.documentElement).prepend(script);
    script.remove();
  }

  // Inject immediately (document_start means we run before YouTube's JS)
  injectPageWorldScript();

  // === DEBOUNCED OBSERVER ===
  let pendingRun = false;
  function scheduleRun() {
    if (pendingRun) return;
    pendingRun = true;
    requestAnimationFrame(() => {
      pendingRun = false;
      skipVideoAd();
      hideYouTubeAds();
    });
  }

  const observer = new MutationObserver(() => scheduleRun());
  function startObserving() {
    observer.observe(document.documentElement || document.body, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['class','style']
    });
  }

  hideYouTubeAds();
  skipVideoAd();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { hideYouTubeAds(); skipVideoAd(); startObserving(); });
  } else {
    startObserving();
  }

  // Periodic checks (ads load lazily, YouTube is a SPA)
  setInterval(skipVideoAd, 500);
  setInterval(hideYouTubeAds, 3000);

  // YouTube SPA navigation
  window.addEventListener('yt-navigate-finish', () => { setTimeout(hideYouTubeAds, 300); setTimeout(skipVideoAd, 500); });
  window.addEventListener('popstate', () => { setTimeout(hideYouTubeAds, 300); setTimeout(skipVideoAd, 500); });
})();
