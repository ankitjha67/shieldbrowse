#!/usr/bin/env node
/**
 * ShieldBrowse Filter List Compiler
 * 
 * Fetches 12+ community filter lists, parses EasyList/AdBlock Plus syntax,
 * converts to Chrome declarativeNetRequest JSON format, and splits across
 * multiple ruleset files to fit within Chrome's 330,000 static rule limit.
 * 
 * Usage: node build_filters.js
 * Output: rules/ruleset_*.json + updated manifest snippet
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ── Filter List Sources ─────────────────────────────────────────────────────
const FILTER_LISTS = [
  {
    name: 'EasyList',
    url: 'https://easylist.to/easylist/easylist.txt',
    category: 'ads'
  },
  {
    name: 'EasyPrivacy',
    url: 'https://easylist.to/easylist/easyprivacy.txt',
    category: 'privacy'
  },
  {
    name: 'Peter Lowe Adservers',
    url: 'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=0',
    category: 'ads'
  },
  {
    name: 'AdGuard Base',
    url: 'https://filters.adtidy.org/extension/chromium/filters/2.txt',
    category: 'ads'
  },
  {
    name: 'AdGuard Tracking Protection',
    url: 'https://filters.adtidy.org/extension/chromium/filters/3.txt',
    category: 'privacy'
  },
  {
    name: 'AdGuard Annoyances',
    url: 'https://filters.adtidy.org/extension/chromium/filters/14.txt',
    category: 'annoyances'
  },
  {
    name: 'AdGuard Social Media',
    url: 'https://filters.adtidy.org/extension/chromium/filters/4.txt',
    category: 'social'
  },
  {
    name: 'Fanboy Annoyances',
    url: 'https://secure.fanboy.co.nz/fanboy-annoyance.txt',
    category: 'annoyances'
  },
  {
    name: 'Fanboy Social',
    url: 'https://easylist.to/easylist/fanboy-social.txt',
    category: 'social'
  },
  {
    name: 'uBlock Filters',
    url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt',
    category: 'ads'
  },
  {
    name: 'uBlock Privacy',
    url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt',
    category: 'privacy'
  },
  {
    name: 'uBlock Badware',
    url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt',
    category: 'malware'
  },
  {
    name: 'uBlock Annoyances',
    url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/annoyances-others.txt',
    category: 'annoyances'
  },
  {
    name: 'Malware Domain List',
    url: 'https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-online.txt',
    category: 'malware'
  },
  {
    name: 'NoCoin (Crypto Miners)',
    url: 'https://raw.githubusercontent.com/nickkaczmarek/ios-content-blocker/master/nicklist.txt',
    category: 'miners'
  },
  {
    name: 'AdGuard DNS',
    url: 'https://filters.adtidy.org/extension/chromium/filters/15.txt',
    category: 'ads'
  }
];

// ── Resource type mapping ───────────────────────────────────────────────────
const ALL_RESOURCE_TYPES = [
  'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
  'font', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other'
];

const RESOURCE_TYPE_MAP = {
  'script': ['script'],
  'image': ['image'],
  'stylesheet': ['stylesheet'],
  'font': ['font'],
  'xmlhttprequest': ['xmlhttprequest'],
  'media': ['media'],
  'websocket': ['websocket'],
  'subdocument': ['sub_frame'],
  'document': ['main_frame'],
  'popup': ['main_frame'],
  'ping': ['ping'],
  'other': ['other']
};

// ── HTTP(S) fetch helper ────────────────────────────────────────────────────
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 30000, headers: { 'User-Agent': 'ShieldBrowse/2.0 FilterCompiler' } }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ── EasyList/ABP Filter Parser ──────────────────────────────────────────────
function parseFilterLine(line) {
  const trimmed = line.trim();

  // Skip empty lines, comments, cosmetic rules, exceptions
  if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('[Adblock')) return null;
  if (trimmed.includes('##') || trimmed.includes('#@#') || trimmed.includes('#?#')) return null;
  if (trimmed.startsWith('@@')) return null;  // exception rules
  if (trimmed.includes('$generichide') || trimmed.includes('$elemhide')) return null;

  // Parse options ($)
  let pattern = trimmed;
  let options = {};
  const dollarIndex = trimmed.lastIndexOf('$');
  if (dollarIndex > 0 && !trimmed.substring(dollarIndex).includes('/')) {
    pattern = trimmed.substring(0, dollarIndex);
    const optStr = trimmed.substring(dollarIndex + 1);
    for (const opt of optStr.split(',')) {
      const [key, val] = opt.split('=');
      if (key.startsWith('~')) continue; // negated options are complex
      options[key] = val || true;
    }
  }

  // Skip rules we can't convert
  if (options.csp || options.redirect || options.rewrite || options.removeparam) return null;
  if (options.replace || options.header) return null;

  // Determine resource types
  let resourceTypes = null;
  const typeKeys = Object.keys(options).filter(k => RESOURCE_TYPE_MAP[k]);
  if (typeKeys.length > 0) {
    resourceTypes = [];
    for (const k of typeKeys) {
      resourceTypes.push(...RESOURCE_TYPE_MAP[k]);
    }
  }

  // Parse the URL pattern
  let urlFilter = pattern;

  // Remove regex rules (too complex for DNR)
  if (urlFilter.startsWith('/') && urlFilter.endsWith('/')) return null;

  // Handle domain anchors: ||domain.com^
  // Already in DNR format (||)

  // Remove separator ^ (DNR doesn't use it, but it's close to *)
  urlFilter = urlFilter.replace(/\^/g, '');

  // Skip empty patterns
  if (!urlFilter || urlFilter === '||' || urlFilter === '*') return null;

  // Skip patterns that are just too broad
  if (urlFilter.length < 4 && !urlFilter.startsWith('||')) return null;

  // Build domain restriction
  let domains = null;
  if (options.domain) {
    const domainParts = options.domain.split('|');
    const included = domainParts.filter(d => !d.startsWith('~'));
    if (included.length > 0) {
      domains = included;
    }
  }

  return {
    urlFilter,
    resourceTypes: resourceTypes || ['script', 'image', 'xmlhttprequest', 'sub_frame', 'media', 'other'],
    domains,
    thirdParty: options['third-party'] ? true : (options['~third-party'] ? false : undefined)
  };
}

// ── Convert parsed rule to DNR format ───────────────────────────────────────
function toDNR(parsed, id) {
  const rule = {
    id,
    priority: 1,
    action: { type: 'block' },
    condition: {
      urlFilter: parsed.urlFilter,
      resourceTypes: parsed.resourceTypes
    }
  };

  if (parsed.domains && parsed.domains.length > 0 && parsed.domains.length <= 10) {
    rule.condition.initiatorDomains = parsed.domains;
  }

  if (parsed.thirdParty === true) {
    rule.condition.domainType = 'thirdParty';
  } else if (parsed.thirdParty === false) {
    rule.condition.domainType = 'firstParty';
  }

  return rule;
}

// ── Main build pipeline ─────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   ShieldBrowse Filter List Compiler                 ║');
  console.log('║   Target: 300,000+ declarativeNetRequest rules      ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const rulesDir = path.join(__dirname, 'rules');
  if (!fs.existsSync(rulesDir)) fs.mkdirSync(rulesDir, { recursive: true });

  const allRules = [];
  const seenPatterns = new Set();
  let nextId = 1;

  for (const list of FILTER_LISTS) {
    process.stdout.write(`  Fetching ${list.name}... `);
    try {
      const text = await fetchUrl(list.url);
      const lines = text.split('\n');
      let count = 0;

      for (const line of lines) {
        const parsed = parseFilterLine(line);
        if (!parsed) continue;

        // Deduplicate
        const key = parsed.urlFilter + '|' + (parsed.resourceTypes || []).join(',');
        if (seenPatterns.has(key)) continue;
        seenPatterns.add(key);

        const dnr = toDNR(parsed, nextId++);
        allRules.push(dnr);
        count++;
      }

      console.log(`${count} rules (${lines.length} lines parsed)`);
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
    }
  }

  console.log(`\n  Total unique rules: ${allRules.length}`);

  // ── Split into rulesets (max ~50,000 per file for reliability) ─────────
  const RULES_PER_FILE = 50000;
  const rulesets = [];
  const manifestRuleResources = [];

  for (let i = 0; i < allRules.length; i += RULES_PER_FILE) {
    const chunk = allRules.slice(i, i + RULES_PER_FILE);
    // Re-index IDs within each chunk (must be unique within ruleset)
    chunk.forEach((rule, idx) => { rule.id = idx + 1; });

    const fileIndex = Math.floor(i / RULES_PER_FILE);
    const filename = `ruleset_${fileIndex}.json`;
    const rulesetId = `ruleset_${fileIndex}`;

    const filePath = path.join(rulesDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(chunk));

    const fileSize = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);
    console.log(`  Written: rules/${filename} — ${chunk.length} rules (${fileSize} MB)`);

    rulesets.push({ id: rulesetId, file: filename, count: chunk.length });
    manifestRuleResources.push({
      id: rulesetId,
      enabled: true,
      path: `rules/${filename}`
    });
  }

  // ── Generate manifest snippet ─────────────────────────────────────────
  const manifestSnippet = {
    declarative_net_request: {
      rule_resources: manifestRuleResources
    }
  };

  fs.writeFileSync(
    path.join(rulesDir, 'manifest_snippet.json'),
    JSON.stringify(manifestSnippet, null, 2)
  );

  // ── Generate stats ────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   Build Complete                                     ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║   Total rules:     ${String(allRules.length).padStart(8)}                       ║`);
  console.log(`║   Ruleset files:   ${String(rulesets.length).padStart(8)}                       ║`);
  console.log(`║   Filter lists:    ${String(FILTER_LISTS.length).padStart(8)}                       ║`);
  console.log(`║   Dedup patterns:  ${String(seenPatterns.size).padStart(8)}                       ║`);
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('\n  Manifest snippet written to: rules/manifest_snippet.json');
  console.log('  Copy the "declarative_net_request" block into manifest.json\n');

  // ── Summary by category ───────────────────────────────────────────────
  return { totalRules: allRules.length, rulesets: rulesets.length, lists: FILTER_LISTS.length };
}

main().catch(e => { console.error('Build failed:', e); process.exit(1); });
