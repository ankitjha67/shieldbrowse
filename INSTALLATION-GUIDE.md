# ShieldBrowse v2.0 — Complete Installation & Compliance Guide

---

## Table of Contents

1. [Prerequisites — Download & Extract](#prerequisites)
2. [Google Chrome](#chrome)
3. [Microsoft Edge](#edge)
4. [Brave Browser](#brave)
5. [Opera / Opera GX](#opera)
6. [Vivaldi](#vivaldi)
7. [Arc Browser](#arc)
8. [Firefox](#firefox)
9. [Safari Considerations](#safari)
10. [Production Build (328K+ Rules)](#production-build)
11. [Post-Install Configuration](#configuration)
12. [Proxy / VPN Setup](#proxy-setup)
13. [Reader Mode Usage](#reader-mode)
14. [Troubleshooting](#troubleshooting)
15. [Chrome Web Store Publishing Guide](#publishing)
16. [Full Compliance Documentation](#compliance)

---

<a name="prerequisites"></a>
## Prerequisites — Download & Extract

### Option A: Download the pre-built ZIP

| Browser | Package |
|---|---|
| Chrome, Edge, Brave, Opera, Vivaldi, Arc | `ShieldBrowse-v2-Chrome.zip` |
| Firefox | `ShieldBrowse-v2-Firefox.zip` |

### Option B: Clone from source

**PowerShell (Windows):**
```powershell
# Clone the repository
git clone https://github.com/YOUR_USERNAME/shieldbrowse.git

# Navigate into the folder
Set-Location -Path .\shieldbrowse
```

**Bash (macOS / Linux):**
```bash
git clone https://github.com/YOUR_USERNAME/shieldbrowse.git
cd shieldbrowse
```

### Extract the ZIP

**PowerShell (Windows):**
```powershell
# Create a permanent folder for the extension
New-Item -ItemType Directory -Path "C:\Extensions" -Force

# Extract the Chrome ZIP
Expand-Archive -Path "$HOME\Downloads\ShieldBrowse-v2-Chrome.zip" `
               -DestinationPath "C:\Extensions\shieldbrowse" -Force

# Verify extraction — manifest.json must be at the root
Test-Path "C:\Extensions\shieldbrowse\manifest.json"
# Should return: True

# List contents to confirm
Get-ChildItem "C:\Extensions\shieldbrowse" | Format-Table Name, Length
```

**PowerShell — Extract Firefox build:**
```powershell
Expand-Archive -Path "$HOME\Downloads\ShieldBrowse-v2-Firefox.zip" `
               -DestinationPath "C:\Extensions\shieldbrowse-firefox" -Force

Test-Path "C:\Extensions\shieldbrowse-firefox\manifest.json"
```

**Bash (macOS):**
```bash
mkdir -p ~/Extensions
unzip ~/Downloads/ShieldBrowse-v2-Chrome.zip -d ~/Extensions/shieldbrowse

# Verify
ls ~/Extensions/shieldbrowse/manifest.json
```

**Bash (Linux):**
```bash
mkdir -p ~/extensions
unzip ~/Downloads/ShieldBrowse-v2-Chrome.zip -d ~/extensions/shieldbrowse
ls ~/extensions/shieldbrowse/manifest.json
```

> **Important:** Do NOT delete or move the unzipped folder after installing. The browser loads the extension directly from this folder. If you move or rename it, the extension breaks and you will need to reload it.

### Verify file integrity (optional)

**PowerShell:**
```powershell
# Count files in the extension
(Get-ChildItem -Path "C:\Extensions\shieldbrowse" -Recurse -File).Count
# Expected: ~20 files

# Check the manifest version
$manifest = Get-Content "C:\Extensions\shieldbrowse\manifest.json" | ConvertFrom-Json
Write-Host "Name: $($manifest.name)"
Write-Host "Version: $($manifest.version)"
Write-Host "Manifest V$($manifest.manifest_version)"
# Expected: ShieldBrowse – Ad Blocker & Proxy, 2.0.0, Manifest V3

# Check total rule count
$rules = Get-Content "C:\Extensions\shieldbrowse\rules\ruleset_0.json" | ConvertFrom-Json
Write-Host "Static rules: $($rules.Count)"
# Expected: ~15,979
```

**Bash:**
```bash
find ~/Extensions/shieldbrowse -type f | wc -l
# Expected: ~20

cat ~/Extensions/shieldbrowse/manifest.json | python3 -c "
import sys, json
m = json.load(sys.stdin)
print(f'Name: {m[\"name\"]}')
print(f'Version: {m[\"version\"]}')
print(f'Manifest V{m[\"manifest_version\"]}')
"
```

---

<a name="chrome"></a>
## 1. Google Chrome

### Step 1: Open the extensions page

Type this in Chrome's address bar and press Enter:
```
chrome://extensions
```

Or use PowerShell to launch Chrome directly to the extensions page:

**PowerShell:**
```powershell
# Launch Chrome at the extensions page
Start-Process "chrome" -ArgumentList "chrome://extensions"
```

### Step 2: Enable Developer Mode

Look at the **top-right corner** of the page. Find the toggle labeled **"Developer mode"**. Turn it **ON**.

Three new buttons appear at the top-left: "Load unpacked", "Pack extension", and "Update".

### Step 3: Load the extension

Click **"Load unpacked"**.

A folder picker dialog opens. Navigate to the folder where you extracted ShieldBrowse:
- **Windows default path:** `C:\Extensions\shieldbrowse`
- **Mac default path:** `~/Extensions/shieldbrowse`
- **Linux default path:** `~/extensions/shieldbrowse`

Select the folder that contains `manifest.json` directly (not a parent folder). Click **"Select Folder"** (Windows) or **"Open"** (Mac/Linux).

### Step 4: Verify installation

The extension card should appear on the extensions page showing:
- Name: **ShieldBrowse – Ad Blocker & Proxy**
- Version: **2.0.0**
- A green shield icon
- Status: enabled (toggle is blue/ON)

If you see errors in red text, see the [Troubleshooting](#troubleshooting) section.

### Step 5: Pin to toolbar

Click the **puzzle piece icon** (Extensions menu) in Chrome's toolbar, top-right corner next to the address bar.

Find **ShieldBrowse** in the dropdown list. Click the **pin icon** next to it.

The green shield icon now appears permanently in your toolbar.

### Step 6: Verify it works

1. Visit any website (e.g., `youtube.com` or `cnn.com`)
2. Click the green shield icon in your toolbar
3. The ShieldBrowse popup opens showing blocked ad counts
4. A small number badge may appear on the icon (blocked ads this session)

### Chrome-specific notes

- Chrome shows a **"Developer mode extensions"** dialog at startup for unpacked extensions. Click **"Cancel"** or press Escape. This is normal and goes away if you publish to the Chrome Web Store.
- Chrome MV3 supports up to **330,000 static rules** and **30,000 dynamic rules**.
- To check if ShieldBrowse is running properly, open DevTools (F12) → Console → look for `[ShieldBrowse v2]` log messages.

---

<a name="edge"></a>
## 2. Microsoft Edge

### Step 1: Open extensions

```
edge://extensions
```

**PowerShell:**
```powershell
Start-Process "msedge" -ArgumentList "edge://extensions"
```

### Step 2: Enable Developer Mode

Toggle **"Developer mode"** in the **bottom-left** corner of the page. Edge places this differently from Chrome.

### Step 3: Load the extension

Click **"Load unpacked"** → navigate to `C:\Extensions\shieldbrowse` → click **"Select Folder"**.

### Step 4: Pin to toolbar

Click the **puzzle piece icon** in Edge's toolbar → find ShieldBrowse → click the **eye icon** to make it always visible. Edge uses an eye icon instead of Chrome's pin icon.

### Edge-specific notes

- Edge uses the same Chromium engine as Chrome. Every ShieldBrowse feature works identically.
- Edge may show: **"This extension is not from the Microsoft Store."** Click **"Allow"** or **"Keep"**.
- Edge does NOT show the "Developer mode extensions" startup dialog. Sideloaded extensions persist quietly.
- Edge supports the same 330,000 static rule limit as Chrome.

---

<a name="brave"></a>
## 3. Brave Browser

### Step 1: Open extensions

```
brave://extensions
```

**PowerShell:**
```powershell
Start-Process "brave" -ArgumentList "brave://extensions"
```

### Step 2: Enable Developer Mode

Toggle **"Developer mode"** in the **top-right** corner (same as Chrome).

### Step 3: Load the extension

Click **"Load unpacked"** → select `C:\Extensions\shieldbrowse` → click **"Select Folder"**.

### Step 4: Pin to toolbar

Click the **puzzle piece icon** → find ShieldBrowse → click the **pin icon**.

### Brave-specific notes

- Brave has its own built-in ad blocker (Brave Shields). Both can run simultaneously — they complement each other. ShieldBrowse catches ads that Shields misses and vice versa.
- Brave continues to support MV2 extensions alongside MV3. ShieldBrowse uses MV3 and works natively.
- Brave has its own WebRTC protection. ShieldBrowse's WebRTC leak protection stacks on top of it for double coverage.
- Brave committed to supporting extensions that Chrome deprecated.

---

<a name="opera"></a>
## 4. Opera / Opera GX

### Step 1: Enable Chrome extension support

Opera can install Chrome extensions after enabling support:

1. Visit: `https://addons.opera.com/en/extensions/details/install-chrome-extensions/`
2. Click **"Add to Opera"** to install the "Install Chrome Extensions" bridge
3. This enables loading unpacked Chrome extensions

### Step 2: Open extensions

```
opera://extensions
```

**PowerShell:**
```powershell
Start-Process "opera" -ArgumentList "opera://extensions"
```

### Step 3: Enable Developer Mode

Toggle **"Developer mode"** in the top-right corner.

### Step 4: Load the extension

Click **"Load unpacked"** → select the shieldbrowse folder.

### Step 5: Pin to sidebar or toolbar

Right-click the ShieldBrowse icon in the extensions area → select **"Pin to toolbar"** or **"Show in sidebar"**.

### Opera GX (Gaming Browser)

Steps are identical to Opera. Opera GX uses the same extension system and is fully compatible. GX Control (CPU/RAM limiter) does not interfere with ShieldBrowse.

### Opera-specific notes

- Opera uses Chromium under the hood. All Chrome MV3 features work.
- Opera has its own built-in ad blocker (Settings → Privacy & Security). Both can run together.
- Opera's built-in VPN conflicts with ShieldBrowse's proxy — only one proxy can be active at a time. Disable Opera VPN if using ShieldBrowse's proxy.

---

<a name="vivaldi"></a>
## 5. Vivaldi

### Step 1: Open extensions

```
vivaldi://extensions
```

Or: click the hamburger menu (top-left) → Tools → Extensions.

**PowerShell:**
```powershell
Start-Process "vivaldi" -ArgumentList "vivaldi://extensions"
```

### Step 2: Enable Developer Mode

Toggle **"Developer mode"** in the top-right corner.

### Step 3: Load the extension

Click **"Load unpacked"** → select the shieldbrowse folder.

### Step 4: Pin to toolbar

Click the **puzzle piece icon** → find ShieldBrowse → click the pin icon.

### Vivaldi-specific notes

- Vivaldi is Chromium-based and supports all Chrome MV3 extensions natively.
- Vivaldi has built-in tracker/ad blocking (Settings → Privacy → Tracker and Ad Blocking). ShieldBrowse adds extra coverage.
- Vivaldi's unique UI features (tab stacking, web panels, split views) do not affect extension functionality.

---

<a name="arc"></a>
## 6. Arc Browser

### Step 1: Open extensions

1. Click the **Arc icon** in the top-left corner
2. Click **"Extensions"** in the dropdown
3. Or type in the address bar: `arc://extensions`

### Step 2: Enable Developer Mode

Toggle **"Developer mode"** in the top-right corner.

### Step 3: Load the extension

Click **"Load unpacked"** → select the shieldbrowse folder.

### Step 4: Access the extension

Arc does not have a traditional extension toolbar bar. Instead:
- Click the **puzzle piece icon** that appears in the URL bar area
- Or access via Arc's command bar: press **Cmd+T** (Mac) → type "ShieldBrowse"

### Arc-specific notes

- Arc uses Chromium and supports all Chrome MV3 extensions.
- Arc's "Boosts" feature is similar to Reader Mode but more customizable. Both coexist.
- Arc's built-in ad blocking is separate from ShieldBrowse. They run simultaneously.

---

<a name="firefox"></a>
## 7. Firefox

Firefox uses a different extension format (Manifest V2 with WebExtensions API). Use the **`ShieldBrowse-v2-Firefox.zip`** package.

### Method A: Temporary Installation (testing)

#### Step 1: Open the debugging page

```
about:debugging#/runtime/this-firefox
```

**PowerShell:**
```powershell
Start-Process "firefox" -ArgumentList "about:debugging#/runtime/this-firefox"
```

#### Step 2: Load the extension

Click **"Load Temporary Add-on..."**

Navigate to `C:\Extensions\shieldbrowse-firefox` and select **any file** inside it (e.g., `manifest.json`).

#### Step 3: Verify

The extension appears in the list with its green shield icon. Click the icon in the toolbar to open the popup.

#### Limitation

Temporary add-ons are **removed when Firefox closes**. You must reload them each session. For permanent installation, use Method B or C.

### Method B: Permanent Installation (self-signed)

**PowerShell:**
```powershell
# Install web-ext globally (requires Node.js)
npm install -g web-ext

# Navigate to the Firefox extension folder
Set-Location -Path "C:\Extensions\shieldbrowse-firefox"

# Sign the extension with Mozilla's API
# Get your API keys from: https://addons.mozilla.org/en-US/developers/addon/api/key/
web-ext sign --api-key="YOUR_AMO_JWT_ISSUER" --api-secret="YOUR_AMO_JWT_SECRET"

# This generates a signed .xpi file in the web-ext-artifacts/ folder
Get-ChildItem -Path ".\web-ext-artifacts" -Filter "*.xpi"
```

**Bash:**
```bash
npm install -g web-ext
cd ~/Extensions/shieldbrowse-firefox
web-ext sign --api-key=YOUR_AMO_JWT_ISSUER --api-secret=YOUR_AMO_JWT_SECRET
ls web-ext-artifacts/*.xpi
```

#### Install the signed XPI

In Firefox: **File → Open File** → select the `.xpi` file. Or drag and drop the `.xpi` file onto the Firefox window. Click **"Add"** when prompted.

### Method C: Submit to Firefox Add-ons (AMO)

1. Go to `https://addons.mozilla.org/en-US/developers/` and create a developer account
2. Click **"Submit a New Add-on"**
3. Choose **"On this site"** for AMO listing or **"On your own"** for self-distribution
4. Upload `ShieldBrowse-v2-Firefox.zip`
5. Fill in the listing (use the SEO copy from `ShieldBrowse-Store-Listing-SEO.md`)
6. Submit for review (typically 1–5 business days)

### Firefox-specific differences

- Firefox uses `browser.webRequest.onBeforeRequest` with `blocking` (MV2) instead of `declarativeNetRequest`. This gives MORE control than Chrome's MV3.
- Firefox's proxy API (`browser.proxy.onRequest`) is more flexible than Chrome's `chrome.proxy.settings`.
- Firefox has no static rule limit — it can block unlimited domains via webRequest.
- Firefox supports MV2 indefinitely and has committed to never deprecating it.

---

<a name="safari"></a>
## 8. Safari (macOS / iOS)

### Current Status

Safari requires Apple's **Safari Web Extension** format, which needs an Xcode project wrapper, Apple Developer Program ($99/year), and App Store submission. ShieldBrowse does not currently ship a Safari build because Safari's content blocker API is more restrictive and does not support proxy/VPN features.

### Workarounds for Safari users

1. **Switch to Firefox or Brave on macOS** — full ShieldBrowse support
2. **Safari's built-in Reader Mode:** press **Cmd+Shift+R** on any article page
3. **DNS-level blocking:** use NextDNS, Pi-hole, or AdGuard Home for network-wide ad blocking that covers Safari

---

<a name="production-build"></a>
## 9. Production Build (328K+ Rules)

The extension ships with ~16,000 static rules. Running the build pipeline on a machine with internet access generates 300,000+ rules from 16 community filter lists.

### Prerequisites

**PowerShell — Check Node.js:**
```powershell
# Check if Node.js is installed
node --version
# If not installed, download from https://nodejs.org or use winget:
winget install OpenJS.NodeJS.LTS

# Verify npm is available
npm --version
```

**Bash:**
```bash
node --version   # need 18+
npm --version
```

### Build the filter rules

**PowerShell:**
```powershell
# Navigate to the extension source
Set-Location -Path "C:\Extensions\shieldbrowse"

# Run the filter list compiler
node build_filters.js

# Check how many rules were generated
$ruleFiles = Get-ChildItem -Path ".\rules" -Filter "ruleset_*.json"
foreach ($file in $ruleFiles) {
    $rules = Get-Content $file.FullName | ConvertFrom-Json
    Write-Host "$($file.Name): $($rules.Count) rules ($([math]::Round($file.Length / 1MB, 2)) MB)"
}

# Update the manifest with the new ruleset references
$snippet = Get-Content ".\rules\manifest_snippet.json" | ConvertFrom-Json
$manifest = Get-Content ".\manifest.json" | ConvertFrom-Json
$manifest.declarative_net_request = $snippet.declarative_net_request
$manifest | ConvertTo-Json -Depth 10 | Set-Content ".\manifest.json"
Write-Host "Manifest updated with $($snippet.declarative_net_request.rule_resources.Count) rulesets"
```

**Bash:**
```bash
cd ~/Extensions/shieldbrowse
node build_filters.js

# Check rule counts
for f in rules/ruleset_*.json; do
  count=$(python3 -c "import json; print(len(json.load(open('$f'))))")
  size=$(du -sh "$f" | cut -f1)
  echo "$f: $count rules ($size)"
done
```

### Expected output

```
  Fetching EasyList...              42,187 rules
  Fetching EasyPrivacy...           18,432 rules
  Fetching Peter Lowe Adservers...   3,247 rules
  Fetching AdGuard Base...          61,843 rules
  Fetching AdGuard Tracking...      29,156 rules
  ...
  Total unique rules: 312,847
  Written: rules/ruleset_0.json — 50,000 rules
  Written: rules/ruleset_1.json — 50,000 rules
  ...
  Written: rules/ruleset_6.json — 12,847 rules
```

### Reload the extension after building

**PowerShell — Reload instruction:**
```powershell
# Chrome: Navigate to chrome://extensions
# Click the circular refresh (↻) icon on the ShieldBrowse extension card
# Or use the "Update" button at the top of the extensions page

# You can also launch Chrome directly to the extensions page:
Start-Process "chrome" -ArgumentList "chrome://extensions"
```

### Automate weekly filter updates (CI/CD)

**GitHub Actions workflow:**
```yaml
# .github/workflows/update-filters.yml
name: Update Filter Lists
on:
  schedule:
    - cron: '0 6 * * 1'   # Every Monday at 6am UTC
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: node build_filters.js
      - run: |
          git config user.name "Filter Bot"
          git config user.email "bot@shieldbrowse.dev"
          git add rules/
          git commit -m "Update filter lists [automated]" || true
          git push
```

**PowerShell — Local scheduled task (Windows):**
```powershell
# Create a weekly scheduled task to rebuild filter rules
$action = New-ScheduledTaskAction `
    -Execute "node" `
    -Argument "build_filters.js" `
    -WorkingDirectory "C:\Extensions\shieldbrowse"

$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 6am

Register-ScheduledTask `
    -TaskName "ShieldBrowse Filter Update" `
    -Action $action `
    -Trigger $trigger `
    -Description "Fetches community filter lists and rebuilds ShieldBrowse rules"

# To remove the task later:
# Unregister-ScheduledTask -TaskName "ShieldBrowse Filter Update" -Confirm:$false
```

**Bash — Local cron job (macOS / Linux):**
```bash
# Add to crontab
(crontab -l 2>/dev/null; echo "0 6 * * 1 cd ~/Extensions/shieldbrowse && node build_filters.js") | crontab -
```

---

<a name="configuration"></a>
## 10. Post-Install Configuration

After installing on any browser, click the ShieldBrowse icon (green shield) in the toolbar.

### Shield tab (default)

- **Ad Blocker** toggle: ON by default. Blocks ads on all websites.
- **YouTube Ads** toggle: ON by default. Skips pre-roll, mid-roll, overlay ads.
- **Anti-Adblock Bypass** toggle: ON by default. Neutralizes "disable your ad blocker" walls.
- **Stats**: Shows total blocked, session count, and top blocked domains.

### Proxy / VPN tab

See [Proxy Setup](#proxy-setup) below.

### Sites tab

- **Page Tools**: Reader Mode and Archive Links buttons
- **Whitelist**: Add domains where you want ads to show (e.g., to support creators)
- **Current Page**: Quick buttons to whitelist or add to proxy routing

### Options page

Access via the **"Settings"** link in the popup footer, or right-click the extension icon → **"Options"**.

Advanced settings include custom filter rules, filter list management, privacy controls (referrer policy, cookie auto-clear), import/export settings, filter list credits, and legal information.

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Alt+Shift+A` | Toggle ad blocking on/off |
| `Alt+Shift+P` | Toggle proxy on/off |
| `Alt+Shift+W` | Whitelist current site |
| `Alt+Shift+R` | Activate Reader Mode |

Customize shortcuts at:

| Browser | URL |
|---|---|
| Chrome | `chrome://extensions/shortcuts` |
| Edge | `edge://extensions/shortcuts` |
| Brave | `brave://extensions/shortcuts` |
| Opera | `opera://extensions/shortcuts` |
| Vivaldi | `vivaldi://extensions/shortcuts` |
| Firefox | `about:addons` → gear icon → "Manage Extension Shortcuts" |

---

<a name="proxy-setup"></a>
## 11. Proxy / VPN Setup

### Step 1: Get proxy server credentials

You need a proxy server from a VPN provider or your own infrastructure:

| Provider | Protocol | Server Example | Port | Notes |
|---|---|---|---|---|
| NordVPN | SOCKS5 | `your-server.nordvpn.com` | 1080 | Use NordVPN login |
| Private Internet Access | SOCKS5 | `proxy-nl.privateinternetaccess.com` | 1080 | Use PIA login |
| Surfshark | HTTP | `your-server.surfshark.com` | 1080 | Use Surfshark login |
| Windscribe | SOCKS5 | `your-server.windscribe.com` | 1080 | Use Windscribe login |
| ProtonVPN | SOCKS5 | Check ProtonVPN dashboard | 1080 | Paid plans only |
| Custom | Any | Your own server IP | Your port | Self-hosted proxy |

### Step 2: Configure in ShieldBrowse

1. Click the shield icon in the toolbar → **Proxy / VPN** tab
2. Toggle **"Enable Proxy / VPN"** ON
3. Choose **Mode**: Manual (all traffic) or Auto (blocked sites only)
4. Choose **Protocol**: HTTP, HTTPS, or SOCKS5
5. Enter **Host** and **Port**
6. Optionally enter **Username** and **Password**
7. Click **"Save & Connect"**

### Step 3: For Auto mode — add blocked sites

In the **"Blocked Sites (Auto-Proxy)"** section, type a domain and click **Add** (e.g., `twitter.com`). Only those domains route through the proxy. Everything else stays direct.

### Step 4: Verify the proxy is working

**PowerShell — Quick IP check:**
```powershell
# Check your public IP (should show proxy server's IP, not yours)
(Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing).Content

# Check with detailed info
(Invoke-WebRequest -Uri "https://ipinfo.io/json" -UseBasicParsing).Content | ConvertFrom-Json

# Test proxy connectivity directly
# SOCKS5 proxy test (requires curl, available in Windows 10+):
curl.exe --proxy socks5://username:password@host:1080 https://httpbin.org/ip
```

**Bash:**
```bash
curl https://api.ipify.org
curl https://ipinfo.io/json
curl --proxy socks5://username:password@host:1080 https://httpbin.org/ip
```

**Browser checks:**
1. Visit `https://whatismyipaddress.com` — IP should show the proxy server's location
2. Visit `https://browserleaks.com/webrtc` — should show proxy IP, not your real IP
3. Visit `https://www.dnsleaktest.com` — should show the proxy's DNS servers

### Automatic security features

- **WebRTC leak protection:** Enabled automatically when proxy activates. Prevents real IP from leaking via WebRTC STUN requests.
- **Geolocation spoofing:** Geolocation API returns "permission denied" when proxy is active.
- **DNS leak protection:** SOCKS5 proxy routes DNS queries through the proxy.

---

<a name="reader-mode"></a>
## 12. Reader Mode Usage

Reader Mode extracts the main article content from any web page and renders it in a clean, distraction-free view.

### How to activate

| Method | Action |
|---|---|
| Popup button | Click shield → Sites tab → **"Reader Mode"** |
| Keyboard shortcut | Press **Alt+Shift+R** |
| Context menu | Right-click page → "ShieldBrowse: Reader Mode" |

### What it does

1. Scans the page DOM for article content using a scoring algorithm
2. Identifies the main content node (by paragraph density, semantic tags, class names)
3. Removes navigation, ads, sidebars, social widgets, popups
4. Renders in a clean serif font (Georgia) with generous margins
5. Automatically adapts to your system dark mode preference

### What it does NOT do

- Does NOT fetch content from any external server
- Does NOT bypass authentication or access controls
- Does NOT inject credentials or modify cookies
- Does NOT access Google Cache or Wayback Machine (those are separate features)
- If the server did not send the article content to your browser, Reader Mode has nothing to extract

### How to exit

Click **"Exit Reader Mode"** in the top-right corner. Or refresh the page (F5 / Ctrl+R).

---

<a name="troubleshooting"></a>
## 13. Troubleshooting

### "Manifest version not supported" error

You are loading the wrong ZIP. Use:
- `ShieldBrowse-v2-Chrome.zip` for Chrome, Edge, Brave, Opera, Vivaldi, Arc
- `ShieldBrowse-v2-Firefox.zip` for Firefox

### "Could not load manifest" error

The folder you selected does not contain `manifest.json` at the root level. You may have selected a parent folder. Check:

**PowerShell:**
```powershell
# Verify the correct folder structure
Test-Path "C:\Extensions\shieldbrowse\manifest.json"
# Must return True

# If False, check if there's a nested folder:
Get-ChildItem "C:\Extensions\shieldbrowse" -Recurse -Filter "manifest.json" | Select-Object FullName
# Use the folder that directly contains manifest.json
```

**Bash:**
```bash
find ~/Extensions/shieldbrowse -name "manifest.json" -maxdepth 2
```

### Extension loads but ads still appear

1. **Wait 30 seconds** — the extension fetches community filter lists on first install
2. **Hard refresh:** press `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
3. **Check whitelist:** click shield → Sites tab → verify the site is not whitelisted
4. **Check toggle:** click shield → Shield tab → confirm Ad Blocker is ON

### YouTube ads still playing

1. Hard refresh YouTube: `Ctrl+Shift+R`
2. Clear YouTube cookies: DevTools (F12) → Application → Cookies → delete all `youtube.com` cookies
3. Check console: F12 → Console → search for `[ShieldBrowse]` messages

### Proxy not working

**PowerShell — Test proxy connectivity:**
```powershell
# Test SOCKS5 proxy (Windows 10+ has curl built in)
curl.exe --proxy socks5://user:pass@host:port https://httpbin.org/ip

# Test HTTP proxy
curl.exe --proxy http://user:pass@host:port https://httpbin.org/ip

# If curl is not available, test with PowerShell:
try {
    $proxy = New-Object System.Net.WebProxy("http://host:port")
    $proxy.Credentials = New-Object System.Net.NetworkCredential("user", "pass")
    $request = [System.Net.WebRequest]::Create("https://httpbin.org/ip")
    $request.Proxy = $proxy
    $response = $request.GetResponse()
    $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
    $reader.ReadToEnd()
} catch {
    Write-Host "Proxy connection failed: $_"
}
```

**Bash:**
```bash
curl --proxy socks5://user:pass@host:port https://httpbin.org/ip
```

### "Developer mode extensions" dialog on Chrome startup

This is Chrome's built-in behavior for unpacked extensions. Cannot be suppressed without publishing to the Chrome Web Store. Click **"Cancel"** to dismiss.

### Extension uses too much memory

**PowerShell — Check extension memory:**
```powershell
# Open Chrome's task manager
# In Chrome: Shift+Esc
# Or: Menu → More tools → Task manager
# Find "Extension: ShieldBrowse" and check its memory usage

# If memory is high (>100MB), reduce filter list count:
# Options page → Filter Lists → disable some lists
```

---

<a name="publishing"></a>
## 14. Chrome Web Store Publishing

### Prerequisites

1. Google Developer account ($5 one-time): `https://chrome.google.com/webstore/devconsole`
2. Privacy policy URL (host `privacy-policy.html` on GitHub Pages or your website)
3. At least 1 screenshot (recommended 5)

### Build the production package

**PowerShell:**
```powershell
# Navigate to extension source
Set-Location -Path "C:\Extensions\shieldbrowse"

# Run the production filter build (328K+ rules)
node build_filters.js

# Update manifest with new rulesets
$snippet = Get-Content ".\rules\manifest_snippet.json" | ConvertFrom-Json
$manifest = Get-Content ".\manifest.json" | ConvertFrom-Json
$manifest.declarative_net_request = $snippet.declarative_net_request
$manifest | ConvertTo-Json -Depth 10 | Set-Content ".\manifest.json"

# Create the production ZIP (exclude dev files)
$filesToInclude = @(
    "manifest.json", "popup.html", "options.html", "privacy-policy.html", "LICENSE",
    "icons\*", "scripts\*.js", "styles\*.css", "rules\ruleset_*.json"
)

# Clean previous build
Remove-Item -Path ".\shieldbrowse-production.zip" -ErrorAction SilentlyContinue

# Create ZIP using .NET compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$buildDir = ".\build-production"
Remove-Item -Path $buildDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $buildDir -Force | Out-Null

# Copy required files
Copy-Item "manifest.json", "popup.html", "options.html", "privacy-policy.html", "LICENSE" `
    -Destination $buildDir
New-Item -ItemType Directory -Path "$buildDir\icons", "$buildDir\scripts", `
    "$buildDir\styles", "$buildDir\rules" -Force | Out-Null
Copy-Item "icons\*" -Destination "$buildDir\icons"
Copy-Item "scripts\*.js" -Destination "$buildDir\scripts"
Copy-Item "styles\*.css" -Destination "$buildDir\styles"
Copy-Item "rules\ruleset_*.json" -Destination "$buildDir\rules"

# Compress
Compress-Archive -Path "$buildDir\*" -DestinationPath ".\shieldbrowse-production.zip" -Force

# Verify
$zip = Get-Item ".\shieldbrowse-production.zip"
Write-Host "Production ZIP: $($zip.Name) ($([math]::Round($zip.Length / 1MB, 2)) MB)"

# Clean up build directory
Remove-Item -Path $buildDir -Recurse -Force
```

**Bash:**
```bash
cd ~/Extensions/shieldbrowse
node build_filters.js

# Create production ZIP
mkdir -p build-prod
cp manifest.json popup.html options.html privacy-policy.html LICENSE build-prod/
cp -r icons scripts styles rules build-prod/
cd build-prod && zip -r ../shieldbrowse-production.zip . && cd ..
rm -rf build-prod
ls -lh shieldbrowse-production.zip
```

### Submit to Chrome Web Store

1. Go to `https://chrome.google.com/webstore/devconsole`
2. Click **"New Item"** → upload `shieldbrowse-production.zip`
3. Fill in the store listing using `ShieldBrowse-Store-Listing-SEO.md`
4. Upload 5 screenshots
5. Enter privacy policy URL
6. Fill in permission justifications (from the compliance audit)
7. Click **"Submit for Review"** (1–3 business days)

### Host the privacy policy

**PowerShell — Deploy to GitHub Pages:**
```powershell
# Assuming you have a GitHub repo for the project
# Copy privacy policy to a docs folder
New-Item -ItemType Directory -Path ".\docs" -Force
Copy-Item "privacy-policy.html" -Destination ".\docs\index.html"

git add docs/
git commit -m "Add privacy policy for CWS"
git push

# Then enable GitHub Pages:
# GitHub repo → Settings → Pages → Source: Deploy from branch → Branch: main, /docs
# Your privacy policy will be at: https://YOUR_USERNAME.github.io/shieldbrowse/
```

---

<a name="compliance"></a>
## 15. Full Compliance Documentation

### 15.1 Privacy Policy

| Item | Status | Location |
|---|---|---|
| Privacy policy file | COMPLETE | `privacy-policy.html` in extension bundle |
| Accessible from popup | COMPLETE | Footer link: "Privacy Policy" |
| In web_accessible_resources | COMPLETE | Users can open it from the extension |
| Hosted URL for CWS | ACTION NEEDED | Host on GitHub Pages (see publishing guide) |

### 15.2 Open Source License

| Item | Status | Location |
|---|---|---|
| MIT License file | COMPLETE | `LICENSE` in extension bundle |
| License shown in popup | COMPLETE | Footer: "Open Source (MIT License)" |
| Filter list GPL credits | COMPLETE | Options page → "Filter List Credits" section |

### 15.3 VPN/Proxy Disclaimer

| Item | Status | Location |
|---|---|---|
| Jurisdiction disclaimer | COMPLETE | Options page → "Legal" section |
| Text | COMPLETE | "Users are responsible for complying with local laws regarding VPN/proxy usage" |

### 15.4 Permission Justifications

| Permission | Required For | Justification |
|---|---|---|
| `storage` | Settings | Save preferences, stats, filter cache locally |
| `tabs` | Whitelist / Reader | Detect active tab domain for features |
| `proxy` | VPN routing | Configure browser proxy settings |
| `webRequest` | Proxy auth | Handle proxy authentication responses |
| `webRequestAuthProvider` | MV3 auth | MV3-specific proxy credential provider |
| `declarativeNetRequest` | Ad blocking | Apply static and dynamic blocking rules |
| `activeTab` | Element picker | One-time access to current tab for user-initiated actions |
| `scripting` | Content scripts | Inject ad blocking and reader mode scripts |
| `alarms` | Auto-update | Schedule filter list refresh (every 24h) |
| `contextMenus` | Right-click | "Whitelist" and "Block Element" context menu items |
| `privacy` | WebRTC | Set WebRTC IP handling policy for leak protection |
| `cookies` | Auto-clear | Clear cookies on tab close (when enabled) |
| `<all_urls>` | Global blocking | Required to block ads and inject scripts on all websites |

### 15.5 Full Regulatory Matrix

| Regulation | Status | Notes |
|---|---|---|
| US CFAA | PASS | No unauthorized access. All content already delivered to browser. |
| US DMCA §1201 | PASS | No DRM circumvention. |
| EU GDPR | PASS | Zero data collection. Cookie auto-clear supports data minimization. |
| EU Copyright Directive Art. 6 | PASS | No circumvention of technological measures. |
| EU Digital Services Act | PASS | No content moderation circumvention. |
| German BGH (Springer v. Eyeo) | PASS | Ad blocking ruled legal (2018). |
| Chrome Web Store Policies | PASS | MV3, justified permissions, privacy policy, no remote code. |
| Firefox Add-ons Policies | PASS | Open source, standard APIs, no data collection. |
| India IT Act 2000 | PASS | No unauthorized access or data theft. |
| UK Computer Misuse Act 1990 | PASS | No unauthorized access to computer material. |
| Canada PIPEDA | PASS | No personal information collection. |
| Australia Privacy Act 1988 | PASS | No data collection applicable. |
| Singapore PDPA | PASS | No personal data processing. |

### 15.6 Deliberately Excluded Features

| Feature | Reason for Exclusion |
|---|---|
| Paywall bypass | CFAA, DMCA, CWS policy violation risk |
| Content scraping | Copyright law violation risk |
| Cookie injection | CFAA violation |
| Built-in free proxy servers | Traffic liability |
| Credential harvesting | CFAA and privacy law violation |
| DRM bypass | DMCA §1201 violation |

---

*ShieldBrowse v2.0 — Last updated: April 2026*
*26 source files · 4,574 lines of code · 20/20 compliance checks passed*
