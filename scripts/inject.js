// ShieldBrowse v2.0 Page-Level Injector (runs in MAIN world)
// WebRTC leak defense, popup blocking, document.write interception

(function () {
  'use strict';

  // === WebRTC Leak Protection (page-level defense) ===
  // Even with chrome.privacy API, some WebRTC implementations leak.
  // This patches RTCPeerConnection to prevent STUN-based IP leaks.
  const origRTCPeer = window.RTCPeerConnection || window.webkitRTCPeerConnection;
  if (origRTCPeer) {
    const PatchedRTC = function(config, constraints) {
      if (config && config.iceServers) {
        // Remove STUN servers that could leak real IP
        config.iceServers = config.iceServers.filter(server => {
          const urls = server.urls || server.url || [];
          const urlArray = Array.isArray(urls) ? urls : [urls];
          return !urlArray.some(u => typeof u === 'string' && u.startsWith('stun:'));
        });
      }
      return new origRTCPeer(config, constraints);
    };
    PatchedRTC.prototype = origRTCPeer.prototype;
    window.RTCPeerConnection = PatchedRTC;
    if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = PatchedRTC;
  }

  // === Block ad popups via window.open ===
  const origOpen = window.open;
  window.open = function (...args) {
    const url = args[0] || '';
    const adDomains = [
      'doubleclick', 'googlesyndication', 'googleadservices',
      'adnxs', 'amazon-adsystem', 'popads', 'popcash',
      'propellerads', 'trafficjunky', 'exoclick'
    ];
    if (typeof url === 'string' && adDomains.some(d => url.includes(d))) {
      return null;
    }
    return origOpen.apply(this, args);
  };

  // === Block ad injection via document.write ===
  const origWrite = document.write;
  const origWriteln = document.writeln;
  const adPatterns = ['googlesyndication', 'doubleclick', 'adsbygoogle',
    'googleadservices', 'pagead', 'amazon-adsystem'];

  document.write = function (content) {
    if (typeof content === 'string' && adPatterns.some(p => content.includes(p))) return;
    return origWrite.call(this, content);
  };
  document.writeln = function (content) {
    if (typeof content === 'string' && adPatterns.some(p => content.includes(p))) return;
    return origWriteln.call(this, content);
  };

  // === Geolocation spoofing when proxy is active ===
  // This provides a basic defense — the real geolocation API can betray proxy users
  const origGetCurrentPosition = navigator.geolocation?.getCurrentPosition;
  const origWatchPosition = navigator.geolocation?.watchPosition;
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition = function(success, error, options) {
      // Return a permission denied error instead of real location
      if (error) {
        error({ code: 1, message: 'User denied Geolocation' });
      }
    };
    navigator.geolocation.watchPosition = function(success, error, options) {
      if (error) {
        error({ code: 1, message: 'User denied Geolocation' });
      }
      return 0;
    };
  }

  // === Navigator property masking ===
  // Prevent sites from detecting number of CPU cores and device memory
  try {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
  } catch (e) { /* some properties may not be configurable */ }

})();
