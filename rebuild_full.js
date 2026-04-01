const fs = require("fs");
const path = require("path");

const buildDir = "E:\\Prompts\\ShieldBrowse_v2\\source\\shieldbrowse";
const liveDir = "D:\\Extensions\\shieldbrowse";
const publishDir = "D:\\Extensions\\shieldbrowse-publish-full";

// STEP 1: Re-run build_filters.js to get fresh 323K rules
console.log("=== REBUILDING 323K+ RULES FROM SCRATCH ===\n");
console.log("Running build_filters.js...\n");
require("child_process").execSync("node build_filters.js", { 
  cwd: buildDir, 
  stdio: "inherit" 
});

// STEP 2: Validate every rule across all files
console.log("\n=== VALIDATING ALL RULES ===\n");

const rulesDir = path.join(buildDir, "rules");

function isValidFilter(f) {
  if (!f || f.length < 4) return false;
  if (/[^\x20-\x7E]/.test(f)) return false;
  if (/\s/.test(f)) return false;
  if (/[\{\}\[\]\(\)\+\!\@\#\$\%\&\=\<\>\"\'\\]/.test(f)) return false;
  if (/\|\|[^a-zA-Z0-9]/.test(f)) return false;
  if (f.includes("**")) return false;
  if (f === "||" || f === "||^" || f === "|" || f === "^" || f === "*") return false;
  if (!/[a-zA-Z0-9]/.test(f)) return false;
  return true;
}

function isAsciiDomain(d) {
  return typeof d === "string" && d.length > 0 && /^[a-zA-Z0-9.\-]+$/.test(d);
}

const BLACKLIST = new Set([
  "||com","||net","||org","||io","||co","||de","||ru","||cn",
  "||forbes.com","||cfd","||xyz","||top","||info","||biz",
  "||google.com","||youtube.com","||facebook.com","||twitter.com",
  "||reddit.com","||amazon.com","||microsoft.com","||apple.com",
  "||github.com","||stackoverflow.com","||wikipedia.org",
  "||linkedin.com","||instagram.com","||netflix.com",
  "||bbc.com","||cnn.com","||nytimes.com",
]);

let grandTotal = 0;
let grandRemoved = 0;

const ruleFiles = fs.readdirSync(rulesDir)
  .filter(f => f.startsWith("ruleset_") && f.endsWith(".json"))
  .sort();

for (const file of ruleFiles) {
  const filePath = path.join(rulesDir, file);
  const rules = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const clean = [];
  let removed = 0;

  for (const rule of rules) {
    let f = rule.condition?.urlFilter || "";

    // Auto-fix known bad patterns
    f = f.replace(/^\|\|\*\./, "||");
    f = f.replace(/^\|\|\*/, "||");
    f = f.replace(/\*\*/g, "*");

    // Validate urlFilter
    if (!isValidFilter(f)) { removed++; continue; }

    // Block catastrophic rules
    if (BLACKLIST.has(f)) { removed++; continue; }

    // Clean all domain arrays (remove non-ASCII)
    for (const key of ["initiatorDomains","excludedInitiatorDomains","requestDomains","excludedRequestDomains"]) {
      if (rule.condition[key]) {
        rule.condition[key] = rule.condition[key].filter(isAsciiDomain);
        if (rule.condition[key].length === 0) delete rule.condition[key];
      }
    }

    rule.condition.urlFilter = f;
    rule.id = clean.length + 1;
    clean.push(rule);
  }

  fs.writeFileSync(filePath, JSON.stringify(clean));
  console.log(file + ": " + clean.length + " valid (" + removed + " removed)");
  grandTotal += clean.length;
  grandRemoved += removed;
}

console.log("\n  Total valid rules: " + grandTotal);
console.log("  Total removed:     " + grandRemoved);

// STEP 3: Copy validated rules to live extension
console.log("\n=== COPYING TO LIVE EXTENSION ===\n");

// Copy validated rulesets
for (const file of ruleFiles) {
  fs.copyFileSync(
    path.join(rulesDir, file),
    path.join(liveDir, "rules", file)
  );
}

// Also copy the antidetect ruleset
const antidetectSrc = path.join(rulesDir, "ruleset_antidetect.json");
if (fs.existsSync(antidetectSrc)) {
  fs.copyFileSync(antidetectSrc, path.join(liveDir, "rules", "ruleset_antidetect.json"));
}

// STEP 4: Update manifest with all rulesets
const snippet = JSON.parse(fs.readFileSync(path.join(rulesDir, "manifest_snippet.json"), "utf8"));
const manifestPath = path.join(liveDir, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

manifest.declarative_net_request = snippet.declarative_net_request;

// Add antidetect ruleset back
manifest.declarative_net_request.rule_resources.push({
  id: "ruleset_antidetect",
  enabled: true,
  path: "rules/ruleset_antidetect.json"
});

// Fix the name (prevent mojibake)
manifest.name = "ShieldBrowse - Ad Blocker & Proxy";

// Write with clean UTF-8
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log("Manifest updated: " + manifest.declarative_net_request.rule_resources.length + " rulesets");
console.log("Name: " + manifest.name);

// STEP 5: Final count
console.log("\n=== FINAL COUNT ===\n");
let finalTotal = 0;
const liveRulesDir = path.join(liveDir, "rules");
for (const file of fs.readdirSync(liveRulesDir).filter(f => f.startsWith("ruleset_") && f.endsWith(".json"))) {
  const count = JSON.parse(fs.readFileSync(path.join(liveRulesDir, file), "utf8")).length;
  finalTotal += count;
  console.log("  " + file + ": " + count + " rules");
}
console.log("\n  GRAND TOTAL: " + finalTotal + " rules");
console.log("\n  Ready to reload in Chrome and package for publishing.");
