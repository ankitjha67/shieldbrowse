// ── ShieldBrowse Stealth Engine v2.0 ─────────────────────────────────────────
// Injected into PAGE world (not content script) to intercept detection at source.
// Neutralizes: FuckAdBlock, BlockAdBlock, Admiral, PageFair, CMP walls,
//              bait elements, request probes, overlay locks, and custom detectors.
//
// This script MUST run at document_start BEFORE any site JS executes.

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. BAIT ELEMENT DEFENSE
  //    Sites create elements with ad-related class/ID names and check if they
  //    get hidden. We intercept getComputedStyle and offsetHeight/offsetWidth
  //    so bait elements always appear visible to detection scripts.
  // ═══════════════════════════════════════════════════════════════════════════

  const BAIT_SIGNATURES = [
    'ad-banner', 'ad-placeholder', 'ad_banner', 'ad_placeholder',
    'adsbox', 'ads-banner', 'ad-test', 'ad-unit', 'adbanner',
    'adBanner', 'adUnit', 'ad-block', 'ad-detect', 'advert-banner',
    'adsbygoogle', 'ad-slot', 'adcontainer', 'ad-container',
    'doubleclick', 'advert', 'google-ad', 'textads', 'text-ad',
    'banner_ad', 'banner-ad', 'bannerAd', 'pub_300x250',
    'sponsor-ad', 'sponsored-ad', 'carbonads', 'AdHeader',
    'AdSense', 'ad-sense', 'ad-header', 'ad-footer', 'ad-sidebar',
    'pagead', 'page-ad', 'tester', 'prebid', 'adtester',
  ];

  function isBaitElement(el) {
    if (!el) return false;
    const id = (el.id || '').toLowerCase();
    const cls = (el.className || '').toString().toLowerCase();
    return BAIT_SIGNATURES.some(sig => id.includes(sig) || cls.includes(sig));
  }

  // Spoof getComputedStyle for bait elements
  const origGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = function (el, pseudoElt) {
    const style = origGetComputedStyle.call(this, el, pseudoElt);
    if (isBaitElement(el)) {
      return new Proxy(style, {
        get(target, prop) {
          if (prop === 'display') return 'block';
          if (prop === 'visibility') return 'visible';
          if (prop === 'opacity') return '1';
          if (prop === 'height') return '250px';
          if (prop === 'width') return '300px';
          if (prop === 'maxHeight') return 'none';
          if (prop === 'overflow') return 'visible';
          if (prop === 'position') return 'static';
          if (prop === 'clip') return 'auto';
          if (prop === 'clipPath') return 'none';
          const val = target[prop];
          return typeof val === 'function' ? val.bind(target) : val;
        }
      });
    }
    return style;
  };

  // Spoof offsetHeight/offsetWidth/clientHeight/clientWidth for bait elements
  const dimensionProps = ['offsetHeight', 'offsetWidth', 'clientHeight', 'clientWidth',
                          'scrollHeight', 'scrollWidth'];
  for (const prop of dimensionProps) {
    const origDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop);
    if (origDesc && origDesc.get) {
      const origGetter = origDesc.get;
      Object.defineProperty(HTMLElement.prototype, prop, {
        get() {
          if (isBaitElement(this)) {
            return prop.includes('Height') ? 250 : 300;
          }
          return origGetter.call(this);
        },
        configurable: true
      });
    }
  }

  // Spoof getBoundingClientRect for bait elements
  const origGetBCR = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    const rect = origGetBCR.call(this);
    if (isBaitElement(this)) {
      return new DOMRect(rect.x || 0, rect.y || 0, 300, 250);
    }
    return rect;
  };


  // ═══════════════════════════════════════════════════════════════════════════
  // 2. FUCKADBLOCK / BLOCKADBLOCK NEUTRALIZER
  //    These libraries define global objects (fuckAdBlock, blockAdBlock, etc.)
  //    and call callbacks when ads are "blocked." We define them first with
  //    the "not detected" state so the site's callback never fires.
  // ═══════════════════════════════════════════════════════════════════════════

  function createFakeAdBlockChecker() {
    const noopFn = function () { return this; };
    return {
      _options: { checkOnLoad: false, resetOnEnd: false },
      _var: { detected: false, event: { detected: [], notDetected: [] } },
      _bait: null,
      _cr498jie39cjaf: false,  // internal flag used by FAB
      check: noopFn,
      emitEvent: noopFn,
      clearEvent: noopFn,
      on: function (type, fn) {
        if (type === 'notDetected' || type === false) {
          try { fn(); } catch (e) {}
        }
        return this;
      },
      onDetected: noopFn,
      onNotDetected: function (fn) {
        try { fn(); } catch (e) {}
        return this;
      },
      setOption: noopFn,
      _addHandler: noopFn,
      _removeHandler: noopFn,
      onCreate: noopFn,
      create: noopFn,
      destroy: noopFn,
      isDetected: function () { return false; }
    };
  }

  // Pre-define before any site script can claim them
  const fakeChecker = createFakeAdBlockChecker();

  const adblockGlobals = [
    'fuckAdBlock', 'blockAdBlock', 'sniffAdBlock', 'capolygon',
    'FuckAdBlock', 'BlockAdBlock', 'SniffAdBlock',
    'fAB', 'bAB', 'FAB', 'BAB',
    '_adb', 'adbDetect', 'adBlockDetected',
    'adblockDetector', 'AdBlockDetector',
    'adblock_detector', 'adBlock',
  ];

  for (const name of adblockGlobals) {
    try {
      Object.defineProperty(window, name, {
        get: () => fakeChecker,
        set: () => true,  // silently ignore overwrites
        configurable: false,
        enumerable: false
      });
    } catch (e) {
      // Already defined by another script
      try { window[name] = fakeChecker; } catch (e2) {}
    }
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // 3. AD REQUEST PROBE SPOOFING
  //    Sites try to fetch ad scripts and check if they loaded. We intercept
  //    XMLHttpRequest and fetch to make ad-domain requests appear successful.
  // ═══════════════════════════════════════════════════════════════════════════

  const AD_PROBE_PATTERNS = [
    'pagead2.googlesyndication.com', 'pagead/js/adsbygoogle.js',
    'doubleclick.net', 'googleadservices.com', 'adsbygoogle',
    'fundingchoicesmessages.google.com', 'securepubads.g.doubleclick.net',
    '/ads.js', '/ad.js', '/ads/ga-audiences', 'amazon-adsystem.com',
    'widgets.outbrain.com/outbrain.js', 'cdn.taboola.com/libtrc',
    'connect.facebook.net/en_US/fbevents.js',
  ];

  function isAdProbe(url) {
    if (typeof url !== 'string') return false;
    return AD_PROBE_PATTERNS.some(p => url.includes(p));
  }

  // Patch XMLHttpRequest to spoof ad probe responses
  const origXHRSend = XMLHttpRequest.prototype.send;
  const origXHROpen = XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._sbUrl = url;
    this._sbIsAdProbe = isAdProbe(url);
    if (this._sbIsAdProbe) {
      // Redirect to data URL to avoid actual network request
      return origXHROpen.call(this, method, 'data:text/javascript,');
    }
    return origXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    if (this._sbIsAdProbe) {
      // Simulate successful load
      Object.defineProperty(this, 'status', { get: () => 200 });
      Object.defineProperty(this, 'readyState', { get: () => 4 });
      Object.defineProperty(this, 'responseText', { get: () => '' });
      Object.defineProperty(this, 'response', { get: () => '' });
      setTimeout(() => {
        this.dispatchEvent(new Event('load'));
        this.dispatchEvent(new Event('loadend'));
        if (typeof this.onload === 'function') this.onload();
        if (typeof this.onreadystatechange === 'function') this.onreadystatechange();
      }, 10);
      return;
    }
    return origXHRSend.apply(this, arguments);
  };

  // Patch fetch for ad probes
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    if (isAdProbe(url)) {
      return Promise.resolve(new Response('', {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'text/javascript' })
      }));
    }
    return origFetch.apply(this, arguments);
  };


  // ═══════════════════════════════════════════════════════════════════════════
  // 4. SCRIPT ELEMENT INJECTION SPOOFING
  //    Sites create <script> elements pointing to ad URLs and check onerror.
  //    We intercept script element creation so ad-probing scripts fire onload
  //    instead of onerror.
  // ═══════════════════════════════════════════════════════════════════════════

  const origCreateElement = document.createElement;
  document.createElement = function (tagName) {
    const el = origCreateElement.call(this, tagName);

    if (tagName.toLowerCase() === 'script') {
      // Intercept src setter to catch ad probe scripts
      const origSrcDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
      let _fakeSrc = '';

      Object.defineProperty(el, 'src', {
        get() { return _fakeSrc || origSrcDesc.get.call(this); },
        set(val) {
          _fakeSrc = val;
          if (isAdProbe(val)) {
            // Don't actually set the src — the script won't load, won't error
            // Instead, fire onload after a delay
            setTimeout(() => {
              el.dispatchEvent(new Event('load'));
              if (typeof el.onload === 'function') el.onload();
            }, 50);
            return;
          }
          origSrcDesc.set.call(this, val);
        },
        configurable: true
      });
    }

    return el;
  };

  // Also handle scripts added via innerHTML/insertAdjacentHTML
  // that check for ad domains
  const origSetInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (origSetInnerHTML && origSetInnerHTML.set) {
    Object.defineProperty(Element.prototype, 'innerHTML', {
      get: origSetInnerHTML.get,
      set(val) {
        // If the innerHTML contains an ad detection script, let it through
        // but the network-level blocking + our fetch/XHR patches will handle it
        origSetInnerHTML.set.call(this, val);
      },
      configurable: true
    });
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // 5. OVERLAY / WALL REMOVER
  //    Runs periodically to detect and remove anti-adblock overlay walls.
  //    Restores scroll, removes blur, removes visibility: hidden on <body>.
  // ═══════════════════════════════════════════════════════════════════════════

  function removeWalls() {
    // Remove known anti-adblock overlay selectors
    const wallSelectors = [
      '[class*="anti-adblock"]', '[class*="adblock-detect"]',
      '[class*="adblock-notice"]', '[class*="adblock-modal"]',
      '[class*="adblock-overlay"]', '[class*="adblock-wall"]',
      '[class*="ab-message"]', '[class*="ab-overlay"]',
      '[id*="anti-adblock"]', '[id*="adblock-detect"]',
      '[id*="adblock-notice"]', '[id*="adblock-modal"]',
      '[id*="adblock-overlay"]', '[id*="adblock-wall"]',
      '[class*="disable-adblock"]', '[class*="turn-off-adblock"]',
      '[class*="AdblockMessage"]', '[class*="adblockMessage"]',
      // Admiral-specific
      '[class*="admiral"]', '[id*="admiral"]',
      '[class*="pwAdblock"]', '[class*="pw-adblock"]',
      // Generic overlay patterns used by anti-adblock
      'div[style*="z-index"][style*="fixed"][style*="background"]',
    ];

    for (const sel of wallSelectors) {
      try {
        document.querySelectorAll(sel).forEach(el => {
          // Only remove if it looks like a blocking overlay (not just any element)
          const style = origGetComputedStyle.call(window, el);
          const isOverlay = (
            style.position === 'fixed' ||
            style.position === 'absolute' ||
            style.zIndex > 999 ||
            parseInt(style.zIndex) > 999
          );
          const isFullScreen = (
            el.offsetWidth > window.innerWidth * 0.5 &&
            el.offsetHeight > window.innerHeight * 0.3
          );

          if (isOverlay || isFullScreen) {
            el.remove();
          }
        });
      } catch (e) {}
    }

    // Restore scroll on body if it was locked
    if (document.body) {
      const bs = origGetComputedStyle.call(window, document.body);
      if (bs.overflow === 'hidden' || bs.overflowY === 'hidden') {
        // Check if there's a suspicious fullscreen overlay
        const suspicious = document.querySelector(
          'div[style*="z-index: 9999"], div[style*="z-index:9999"], ' +
          'div[style*="z-index: 999999"], div[style*="z-index:999999"]'
        );
        if (suspicious) {
          document.body.style.setProperty('overflow', 'auto', 'important');
          document.body.style.setProperty('overflow-y', 'auto', 'important');
          document.body.style.removeProperty('pointer-events');
          document.documentElement.style.setProperty('overflow', 'auto', 'important');
          suspicious.remove();
        }
      }
    }

    // Remove blur from main content (some sites blur content when detecting adblocker)
    document.querySelectorAll('[style*="blur"], [style*="filter"]').forEach(el => {
      if (el.style.filter && el.style.filter.includes('blur')) {
        el.style.removeProperty('filter');
      }
    });

    // Remove visibility:hidden from main content containers
    document.querySelectorAll('main, article, .content, .post, #content, #main').forEach(el => {
      if (el.style.visibility === 'hidden' || el.style.display === 'none') {
        el.style.removeProperty('visibility');
        el.style.removeProperty('display');
      }
    });
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // 6. TIMER / INTERVAL INTERCEPTION
  //    Many detection scripts use setInterval to repeatedly check for ad
  //    blockers. We intercept these to neuter detection loops.
  // ═══════════════════════════════════════════════════════════════════════════

  const origSetInterval = window.setInterval;
  const origSetTimeout = window.setTimeout;

  window.setInterval = function (fn, delay) {
    const fnStr = typeof fn === 'function' ? fn.toString() : String(fn);
    // Check if this interval is an adblock detection loop
    const detectionKeywords = [
      'adblock', 'AdBlock', 'adBlock', 'adblocker', 'ad-block',
      'fuckAdBlock', 'blockAdBlock', 'adDetect', 'adblockDetect',
      'adsBlocked', 'isBlocked', 'adsBygoogle', 'sponsor',
      'offsetHeight', 'clientHeight',  // bait element checks
      'getComputedStyle',  // style-based detection
    ];

    // If the function code contains detection keywords AND is a short interval
    if (delay < 5000 && detectionKeywords.some(kw => fnStr.includes(kw))) {
      // Replace with a no-op interval
      return origSetInterval.call(this, function () {}, 999999);
    }
    return origSetInterval.apply(this, arguments);
  };

  window.setTimeout = function (fn, delay) {
    const fnStr = typeof fn === 'function' ? fn.toString() : String(fn);
    const detectionKeywords = [
      'adblock', 'AdBlock', 'fuckAdBlock', 'blockAdBlock',
      'adDetect', 'adblockDetect', 'adsBlocked',
    ];

    if (delay < 10000 && detectionKeywords.some(kw => fnStr.includes(kw))) {
      return origSetTimeout.call(this, function () {}, 999999);
    }
    return origSetTimeout.apply(this, arguments);
  };


  // ═══════════════════════════════════════════════════════════════════════════
  // 7. EVENT LISTENER DEFENSE
  //    Block DOMContentLoaded and load listeners from detection scripts
  //    that would check for ad presence after page load.
  // ═══════════════════════════════════════════════════════════════════════════

  // We don't block ALL event listeners — only those whose callback code
  // contains adblock-detection signatures
  const origAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if ((type === 'DOMContentLoaded' || type === 'load') && typeof listener === 'function') {
      const code = listener.toString();
      if (code.includes('adblock') || code.includes('AdBlock') ||
          code.includes('fuckAdBlock') || code.includes('blockAdBlock') ||
          code.includes('admiral')) {
        // Replace with no-op
        return origAddEventListener.call(this, type, function () {}, options);
      }
    }
    return origAddEventListener.call(this, type, listener, options);
  };


  // ═══════════════════════════════════════════════════════════════════════════
  // 8. CSS INJECTION — ensure ad bait elements stay "visible"
  // ═══════════════════════════════════════════════════════════════════════════

  const styleEl = document.createElement('style');
  styleEl.textContent = [
    // Keep bait elements visible to detection scripts
    // (our actual hiding uses data-sb-hidden attribute, not these classes)
    '.ads-banner, .ad-placeholder, .adsbox, .ad-test, #ad-test,',
    '.textads, .ad-unit, .ad_unit, .adbanner, #adbanner,',
    '.adBanner, .adUnit, #adUnit, .pub_300x250, .pub_728x90,',
    '.AdHeader, .AdSense, .ad-sense, .ad-header, .ad-footer {',
    '  display: block !important;',
    '  visibility: visible !important;',
    '  height: 1px !important;',
    '  width: 1px !important;',
    '  position: absolute !important;',
    '  opacity: 0 !important;',
    '  pointer-events: none !important;',
    '  overflow: hidden !important;',
    '  z-index: -1 !important;',
    '}',
    // Kill anti-adblock overlays via CSS
    '[class*="adblock-overlay"], [class*="adblock-wall"],',
    '[class*="anti-adblock"], [class*="adblock-modal"],',
    '[class*="disable-adblock"], [id*="adblock-overlay"],',
    '[class*="AdblockMessage"], [class*="adblock-notice-wrapper"] {',
    '  display: none !important;',
    '  pointer-events: none !important;',
    '  z-index: -1 !important;',
    '}',
  ].join('\n');
  (document.head || document.documentElement).appendChild(styleEl);


  // ═══════════════════════════════════════════════════════════════════════════
  // 9. RUN WALL REMOVER PERIODICALLY
  // ═══════════════════════════════════════════════════════════════════════════

  // Run after DOM is ready and periodically
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      origSetTimeout.call(window, removeWalls, 500);
      origSetTimeout.call(window, removeWalls, 2000);
      origSetTimeout.call(window, removeWalls, 5000);
    });
  } else {
    origSetTimeout.call(window, removeWalls, 100);
    origSetTimeout.call(window, removeWalls, 1500);
    origSetTimeout.call(window, removeWalls, 4000);
  }

  // Periodic sweep for walls that appear dynamically
  origSetInterval.call(window, removeWalls, 8000);

})();
