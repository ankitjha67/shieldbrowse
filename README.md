# ShieldBrowse — Ad Blocker & Proxy Extension

A Chrome/Edge/Brave extension that blocks ads everywhere (including YouTube pre-roll, mid-roll, and overlay ads) and routes traffic through a proxy/VPN to bypass geo-restrictions.

---

## Features

### Ad Blocking
- **100 declarativeNetRequest rules** covering all major ad networks (Google Ads, DoubleClick, Facebook Pixel, Amazon Ads, Taboola, Outbrain, Criteo, and 60+ more)
- **Cosmetic filtering** — hides ad DOM elements via CSS and JS across all websites
- **YouTube-specific blocking** — skips pre-roll/mid-roll video ads, hides overlay ads, removes promoted content, blocks masthead ads, and intercepts ad-related API calls
- **Anti-adblock bypass** — removes "please disable your adblocker" overlays
- **Popup/window.open blocking** — prevents ad popups from opening
- **Real-time stats** — tracks total ads blocked, per-domain breakdown, and session counts

### Proxy / VPN
- **Manual mode** — routes ALL traffic through your proxy server
- **Auto mode** — routes ONLY blocked/geo-restricted sites through proxy (PAC script)
- **Protocol support** — HTTP, HTTPS, and SOCKS5 proxies
- **Authentication** — username/password proxy auth support
- **Blocked site detection** — automatically detects sites that fail to load (potential geo-blocks) and suggests adding them to auto-proxy
- **Per-site proxy routing** — add specific domains that should go through the proxy
- **Bypass list** — localhost, private IPs, and local addresses always go direct

### Site Management
- **Whitelist** — disable ad blocking on specific sites
- **Current page actions** — one-click whitelist or proxy-add for the active tab
- **Detected blocked sites** — auto-detection of potentially blocked sites

---

## Installation

### Chrome / Edge / Brave (Developer Mode)

1. Download or clone this repository
2. Open your browser and navigate to:
   - **Chrome**: `chrome://extensions/`
   - **Edge**: `edge://extensions/`
   - **Brave**: `brave://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **"Load unpacked"**
5. Select the `shieldbrowse` folder
6. The extension icon (green shield) will appear in your toolbar

### Firefox (with modifications)

Firefox uses Manifest V2. You would need to:
1. Change `manifest_version` to `2` in `manifest.json`
2. Replace `declarativeNetRequest` with `webRequest` blocking
3. Load as temporary add-on via `about:debugging`

---

## Proxy Configuration

### Using with Free/Paid Proxy Services

1. Click the ShieldBrowse icon in your toolbar
2. Go to the **Proxy / VPN** tab
3. Enter your proxy server details:
   - **Host**: proxy server address (e.g., `us-proxy.example.com`)
   - **Port**: proxy port (e.g., `8080`)
   - **Protocol**: HTTP, HTTPS, or SOCKS5
4. Choose a mode:
   - **Manual**: All traffic goes through proxy
   - **Auto**: Only sites you add to the blocked list go through proxy
5. Click **Save & Connect**

### Using with VPN Providers That Offer Proxy

Many VPN providers offer SOCKS5/HTTP proxy access:
- **NordVPN**: SOCKS5 proxy available
- **Private Internet Access**: SOCKS5 proxy
- **Surfshark**: HTTP proxy
- **Windscribe**: SOCKS5 proxy

Use your VPN credentials in the proxy configuration.

### Auto-Proxy for Geo-Restricted Sites

1. Set mode to **Auto**
2. Add blocked domains in the **Blocked Sites** section
3. Only those specific domains will route through the proxy
4. All other traffic goes direct (faster browsing)

---

## Architecture

```
shieldbrowse/
├── manifest.json              # Extension manifest (MV3)
├── popup.html                 # Popup UI
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── scripts/
│   ├── background.js          # Service worker (proxy, stats, rules)
│   ├── content.js             # Cosmetic ad hiding (all sites)
│   ├── youtube.js             # YouTube-specific ad blocking
│   ├── popup.js               # Popup UI controller
│   └── inject.js              # Page-context ad interception
├── styles/
│   └── content.css            # CSS ad hiding rules
└── rules/
    └── ad_rules.json          # declarativeNetRequest ad rules
```

---

## How It Works

### Ad Blocking (3 Layers)

1. **Network-level** (`declarativeNetRequest`): Blocks requests to 100 known ad/tracker domains before they even load
2. **DOM-level** (content scripts + CSS): Hides ad elements that slip through network blocking using 70+ CSS selectors
3. **Script-level** (page injection): Intercepts `XMLHttpRequest`, `fetch`, `window.open`, and `document.write` calls to ad endpoints

### YouTube Ads (4 Layers)

1. **Network blocking**: Blocks YouTube ad API endpoints (`/pagead/`, `/ptracking`, `/get_midroll_info`, IMA SDK)
2. **DOM hiding**: Removes 25+ YouTube-specific ad element types
3. **Video ad skipping**: Detects `ad-showing` class on player, fast-forwards to end, clicks skip button
4. **Data interception**: Strips `adPlacements`, `adSlots`, `playerAds` from `ytInitialPlayerResponse`

### Proxy Routing

- **Manual mode**: Uses Chrome's `chrome.proxy` API to set a fixed proxy server
- **Auto mode**: Generates a PAC (Proxy Auto-Config) script that routes only specified domains through the proxy
- **Auth**: Handles proxy authentication via `webRequest.onAuthRequired`
- **Detection**: Monitors `webRequest.onErrorOccurred` for connection failures that suggest geo-blocking

---

## Privacy

- **No data collection**: ShieldBrowse does not send any data externally
- **Local storage only**: All settings and stats are stored in `chrome.storage.local`
- **No analytics**: No tracking scripts, beacons, or telemetry
- **Open source**: Full source code is available for audit

---

## License

MIT License — free to use, modify, and distribute.
