// ShieldBrowse v2.0 Content Script — Cosmetic Ad Hiding + Anti-Fingerprint
// FIX: Debounced MutationObserver (was firing thousands/sec on dynamic pages)
// NEW: Canvas/WebGL/AudioContext fingerprint protection

(function () {
  'use strict';

  const AD_SELECTORS = [
    '[id*="google_ads"]','[class*="google-ad"]','[id*="ad-container"]',
    '[class*="ad-container"]','[class*="ad-wrapper"]','[class*="ad-banner"]',
    '[class*="ad-slot"]','[class*="adsbygoogle"]','ins.adsbygoogle',
    '[data-ad]','[data-ad-slot]','[data-ad-client]','[data-google-query-id]',
    '.ad','.ads','.advertisement','.ad-unit','.ad-placement','.ad-zone',
    '.ad-leaderboard','.ad-sidebar','.ad-footer','.ad-header','.ad-inline',
    '.sponsored-content','.sponsored-post','.promoted-content','.promoted-post',
    'iframe[src*="doubleclick"]','iframe[src*="googlesyndication"]',
    'iframe[src*="googleadservices"]','iframe[src*="amazon-adsystem"]',
    'iframe[src*="adnxs.com"]','iframe[src*="2mdn.net"]',
    'iframe[id*="google_ads"]','iframe[name*="google_ads"]',
    '[id*="taboola"]','[class*="taboola"]','.trc_related_container','.trc_rbox',
    '[id*="outbrain"]','[class*="outbrain"]','.ob-widget',
    '[data-testid="promoted"]','[data-promoted]','.is-promoted','.promoted','.sponsored',
    '[class*="cookie-banner"]','[class*="cookie-consent"]','[id*="cookie-banner"]',
    '[id*="cookie-consent"]','[class*="consent-banner"]','#onetrust-consent-sdk',
    '.cc-banner','#CybotCookiebotDialog',
    'div[aria-label="advertisement"]','div[aria-label="Advertisement"]',
    '[data-native-ad]','[data-ad-unit]','[data-dfp-ad]','.dfp-ad',
    '[class*="popup-ad"]','[class*="modal-ad"]','[class*="interstitial-ad"]',
    '[class*="stickyad"]','[class*="sticky-ad"]',
    '[class*="anti-adblock"]','[class*="adblock-detect"]','[class*="adblock-notice"]',
    '[id*="anti-adblock"]','[id*="adblock-detect"]','[class*="ab-message"]'
  ];

  let isWhitelisted = false;
  let adBlockEnabled = true;
  let antiFingerprint = true;
  let blockedCount = 0;

  chrome.runtime.sendMessage({ type: 'IS_WHITELISTED', domain: location.hostname }, (r) => {
    if (r?.whitelisted) isWhitelisted = true;
  });
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (r) => {
    if (r?.settings) {
      adBlockEnabled = r.settings.adBlockEnabled;
      antiFingerprint = r.settings.antiFingerprint !== false;
    }
  });

  // === COSMETIC AD HIDING ===
  function hideAds() {
    if (isWhitelisted || !adBlockEnabled) return;
    const selector = AD_SELECTORS.join(', ');
    let newBlocked = 0;
    document.querySelectorAll(selector).forEach(el => {
      if (!el.dataset.sbHidden) {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('height', '0', 'important');
        el.style.setProperty('min-height', '0', 'important');
        el.style.setProperty('overflow', 'hidden', 'important');
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        el.dataset.sbHidden = 'true';
        newBlocked++;
      }
    });
    if (newBlocked > 0) {
      blockedCount += newBlocked;
      chrome.runtime.sendMessage({ type: 'INCREMENT_BLOCK_COUNT', count: newBlocked, domain: location.hostname });
    }
  }

  // === ANTI-ADBLOCK BYPASS ===
  function removeAntiAdblock() {
    if (isWhitelisted || !adBlockEnabled) return;
    document.querySelectorAll('[class*="anti-adblock"],[class*="adblock-detect"],[class*="adblock-notice"],[id*="anti-adblock"],[id*="adblock-detect"],[class*="ab-message"]')
      .forEach(el => el.style.setProperty('display', 'none', 'important'));
    if (document.body) {
      const bs = window.getComputedStyle(document.body);
      if (bs.overflow === 'hidden' || bs.overflowY === 'hidden') {
        const overlay = document.querySelector('[class*="overlay"][style*="z-index"],[class*="modal"][style*="z-index"]');
        if (overlay && (overlay.querySelector('[class*="adblock"]') || overlay.querySelector('[class*="subscribe"]'))) {
          document.body.style.setProperty('overflow', 'auto', 'important');
          overlay.style.setProperty('display', 'none', 'important');
        }
      }
    }
  }

  // === ANTI-FINGERPRINTING (canvas, WebGL, AudioContext) ===
  function applyFingerprintProtection() {
    if (!antiFingerprint) return;
    const script = document.createElement('script');
    script.textContent = `(function(){
      // Canvas fingerprint defense: add subtle noise to toDataURL/toBlob
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type) {
        const ctx = this.getContext('2d');
        if (ctx && this.width > 0 && this.height > 0) {
          try {
            const imageData = ctx.getImageData(0, 0, Math.min(this.width, 2), Math.min(this.height, 2));
            imageData.data[0] = (imageData.data[0] + 1) % 256;
            ctx.putImageData(imageData, 0, 0);
          } catch(e) {}
        }
        return origToDataURL.apply(this, arguments);
      };

      // WebGL fingerprint defense: randomize renderer/vendor strings
      const getParam = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(param) {
        if (param === 37445) return 'ShieldBrowse GPU';
        if (param === 37446) return 'ShieldBrowse Renderer';
        return getParam.apply(this, arguments);
      };
      if (typeof WebGL2RenderingContext !== 'undefined') {
        const getParam2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(param) {
          if (param === 37445) return 'ShieldBrowse GPU';
          if (param === 37446) return 'ShieldBrowse Renderer';
          return getParam2.apply(this, arguments);
        };
      }

      // AudioContext fingerprint defense
      const origGetFloatFrequencyData = AnalyserNode.prototype.getFloatFrequencyData;
      AnalyserNode.prototype.getFloatFrequencyData = function(array) {
        origGetFloatFrequencyData.call(this, array);
        for (let i = 0; i < Math.min(array.length, 3); i++) {
          array[i] = array[i] + (Math.random() * 0.0001 - 0.00005);
        }
      };
    })();`;
    (document.head || document.documentElement).prepend(script);
    script.remove();
  }

  // === DEBOUNCED MUTATION OBSERVER (FIX: was firing thousands/sec) ===
  let pendingRun = false;
  function scheduleAdHide() {
    if (pendingRun) return;
    pendingRun = true;
    requestAnimationFrame(() => {
      pendingRun = false;
      hideAds();
      removeAntiAdblock();
    });
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes.length > 0) { scheduleAdHide(); return; }
    }
  });

  function startObserving() {
    observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
  }

  // === INIT ===
  hideAds();
  removeAntiAdblock();
  applyFingerprintProtection();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { hideAds(); removeAntiAdblock(); startObserving(); });
  } else {
    startObserving();
  }

  window.addEventListener('load', () => { setTimeout(hideAds, 500); setTimeout(hideAds, 2000); });
  setInterval(() => { hideAds(); removeAntiAdblock(); }, 10000);
})();
