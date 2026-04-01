// ShieldBrowse Stealth Loader — injects stealth.js into page world
// Runs at document_start in MAIN world to beat all detection scripts

// If running in MAIN world (MV3 world: "MAIN"), the stealth code is already here.
// If running in isolated world (fallback), we inject via <script src>.
try {
  // Test if we're in page world by checking for chrome.runtime
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
    // We're in the content script isolated world — inject into page
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('scripts/stealth.js');
    script.onload = function () { this.remove(); };
    (document.head || document.documentElement).prepend(script);
  }
} catch (e) {
  // We're in MAIN world or something else — stealth.js handles itself
}
