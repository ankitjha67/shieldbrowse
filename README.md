# ShieldBrowse

**Ad Blocker & Free VPN Proxy Extension** — 306,000+ filter rules, 9-layer stealth engine, built-in VPN proxy, reader mode.

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Install-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/shieldbrowse-ad-blocker-p/fjpiikehggmlpkccnhjjmejeiefdcnhj)
[![Edge Add-ons](https://img.shields.io/badge/Edge-Install-0078D7?logo=microsoftedge&logoColor=white)](https://microsoftedge.microsoft.com/addons)
[![Firefox Add-ons](https://img.shields.io/badge/Firefox-Install-FF7139?logo=firefox&logoColor=white)](https://addons.mozilla.org/addon/shieldbrowse-ad-blocker-proxy/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Rules](https://img.shields.io/badge/rules-306K+-brightgreen)](rules/)

## Install

- **Chrome, Brave, Vivaldi, Arc**: [Chrome Web Store](https://chromewebstore.google.com/detail/shieldbrowse-ad-blocker-p/fjpiikehggmlpkccnhjjmejeiefdcnhj)
- **Microsoft Edge**: [Edge Add-ons](https://microsoftedge.microsoft.com/addons)
- **Firefox**: [Firefox Add-ons](https://addons.mozilla.org/addon/shieldbrowse-ad-blocker-proxy/)

## Features

- **306,000+ filter rules** from 16 community filter lists (EasyList, EasyPrivacy, AdGuard, uBlock filters)
- **9-layer stealth engine** that neutralizes anti-adblock detection (FuckAdBlock, BlockAdBlock, Admiral, PageFair)
- **Built-in VPN proxy** (HTTP/HTTPS/SOCKS5) with WebRTC leak protection
- **Video ad blocking** for pre-roll, mid-roll, overlay, and short-form video ads
- **Reader Mode** that strips pages down to the article content
- **Anti-fingerprinting** (canvas, WebGL, AudioContext masking)
- **Cookie auto-clear** (same as Safari ITP)
- **Referrer control** and tracking parameter stripping
- **Zero data collection** — 100% local, no telemetry, no accounts, no "acceptable ads"

## Build from source

```bash
git clone https://github.com/ankitjha67/shieldbrowse.git
cd shieldbrowse
node build_filters.js
```

Then load the folder as an unpacked extension in Chrome's developer mode, or use `about:debugging` in Firefox.

## License

MIT License. See [LICENSE](LICENSE) for details.
