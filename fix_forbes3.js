const fs = require("fs");
const dir = "D:\\Extensions\\shieldbrowse\\rules";

// Forbes URLs that are being wrongly blocked
const forbesURLs = [
  "https://www.forbes.com/assets/stub.js",
  "https://i.forbesimg.com/0x0.jpg?format=jpg&width=1100",
  "https://www.forbes.com/assets/common-41b82cfda8d5c83fe31e.js",
  "https://www.forbes.com/assets/homepage-7743b17675cc152813f6.js",
  "https://www.forbes.com/assets/frase-high-res.png",
  "https://www.forbes.com/assets/pinpoint.png",
  "https://www.forbes.com/assets/48X48-F.png"
];

// Test if a urlFilter pattern matches a URL
function matchesUrl(filter, url) {
  // Convert urlFilter to a regex
  let pattern = filter;
  // || = domain anchor (match domain start)
  if (pattern.startsWith("||")) {
    pattern = pattern.substring(2);
    // Check if URL contains this domain/path
    const domainPart = url.replace(/^https?:\/\//, "");
    return domainPart.includes(pattern.replace(/\*/g, "").replace(/\^/g, ""));
  }
  // * = wildcard
  const escaped = pattern.replace(/[.+?{}()[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\^/g, "[^a-zA-Z0-9_.%-]?");
  try {
    return new RegExp(escaped, "i").test(url);
  } catch(e) {
    return false;
  }
}

// Simple substring check (faster, catches most cases)
function couldMatch(filter, url) {
  const clean = filter.replace(/^\|\|/, "").replace(/\*/g, "").replace(/\^/g, "");
  if (clean.length < 3) return false;
  return url.toLowerCase().includes(clean.toLowerCase());
}

console.log("Searching 305K rules for Forbes false positives...\n");

let totalKilled = 0;

fs.readdirSync(dir).filter(f => f.startsWith("ruleset_") && f.endsWith(".json")).forEach(file => {
  const filePath = dir + "\\" + file;
  const rules = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const clean = [];
  let killed = 0;

  for (const rule of rules) {
    const f = rule.condition?.urlFilter || "";
    
    // Check if this rule would match ANY of the Forbes URLs
    const matchesForbes = forbesURLs.some(url => couldMatch(f, url));
    
    if (matchesForbes) {
      // Only remove if it's a broad rule (no domain restriction)
      // Rules targeting specific ad domains are fine
      const hasDomainRestriction = rule.condition.initiatorDomains || 
                                    rule.condition.requestDomains;
      if (!hasDomainRestriction) {
        console.log("  REMOVING from " + file + ": [" + f + "]");
        killed++;
        continue;
      }
    }
    
    rule.id = clean.length + 1;
    clean.push(rule);
  }

  if (killed > 0) {
    fs.writeFileSync(filePath, JSON.stringify(clean));
    totalKilled += killed;
  }
});

console.log("\nRemoved " + totalKilled + " false-positive rules");

// === FIX CSP: Remove inline script injection from content.js entirely ===
const contentPath = "D:\\Extensions\\shieldbrowse\\scripts\\content.js";
let content = fs.readFileSync(contentPath, "utf8");

// Replace the entire applyFingerprintProtection function
// with a version that does NOT create inline <script> tags
const oldFn = /function applyFingerprintProtection\(\)[\s\S]*?script\.remove\(\);\s*\}/;
const newFn = `function applyFingerprintProtection() {
    // Fingerprint protection moved to stealth.js (runs in MAIN world via manifest)
    // Inline script injection removed — breaks on CSP-strict sites like Forbes
  }`;

content = content.replace(oldFn, newFn);
fs.writeFileSync(contentPath, content);
console.log("CSP fix: removed inline script injection from content.js");

// Verify stealth.js already has fingerprint protection
const stealthPath = "D:\\Extensions\\shieldbrowse\\scripts\\stealth.js";
const stealth = fs.readFileSync(stealthPath, "utf8");
const hasCanvas = stealth.includes("toDataURL");
const hasWebGL = stealth.includes("getParameter");
console.log("stealth.js has canvas protection: " + hasCanvas);
console.log("stealth.js has WebGL protection: " + hasWebGL);
if (hasCanvas && hasWebGL) {
  console.log("Fingerprint protection is handled by stealth.js (MAIN world) - safe from CSP");
}

console.log("\nDone. Reload extension and hard-refresh Forbes.");
