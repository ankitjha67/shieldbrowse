const fs = require("fs");

// === FIX 1: Find and remove rules that catch Forbes own resources ===
const dir = "D:\\Extensions\\shieldbrowse\\rules";

// These patterns are matching Forbes' legitimate resources
const falsePositivePatterns = [
  "0x0",        // catches Forbes 0x0.jpg images
  "stub.js",    // catches Forbes stub.js
  "48X48",      // catches Forbes favicon
  "pinpoint",   // catches Forbes pinpoint.png
  "/frase",     // catches Forbes frase-high-res.png
];

let totalRemoved = 0;

fs.readdirSync(dir).filter(f => f.startsWith("ruleset_") && f.endsWith(".json")).forEach(file => {
  const filePath = dir + "\\" + file;
  const rules = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const clean = [];
  let removed = 0;

  for (const rule of rules) {
    const f = rule.condition?.urlFilter || "";
    // Remove rules that are just these short broad patterns
    const isFalsePositive = falsePositivePatterns.some(p => {
      // Only remove if the urlFilter IS the pattern (not a domain containing it)
      return f === p || f === "||" + p || f === "*" + p || f === "/" + p;
    });

    if (isFalsePositive) {
      removed++;
    } else {
      rule.id = clean.length + 1;
      clean.push(rule);
    }
  }

  if (removed > 0) {
    fs.writeFileSync(filePath, JSON.stringify(clean));
    console.log(file + ": removed " + removed + " false-positive rules");
    totalRemoved += removed;
  }
});
console.log("False-positive rules removed: " + totalRemoved);

// === FIX 2: Patch stealth.js to not use inline scripts (CSP fix) ===
const stealthPath = "D:\\Extensions\\shieldbrowse\\scripts\\stealth.js";
const contentPath = "D:\\Extensions\\shieldbrowse\\scripts\\content.js";

// Read stealth.js
let stealth = fs.readFileSync(stealthPath, "utf8");

// The stealth engine already runs in MAIN world via manifest, 
// but the content.js fingerprint protection uses inline <script> tags.
// Fix: wrap the injection so it fails silently on CSP-strict sites
let content = fs.readFileSync(contentPath, "utf8");

// Replace the fingerprint script injection to use try-catch
const oldInject = "    (document.head || document.documentElement).prepend(script);\n    script.remove();";
const newInject = "    try { (document.head || document.documentElement).prepend(script); script.remove(); } catch(e) { /* CSP blocked inline script - fingerprint protection skipped on this site */ }";
content = content.replace(oldInject, newInject);

// Also fix stealth.js CSS injection
let stealthContent = fs.readFileSync(stealthPath, "utf8");
const oldCssInject = "  (document.head || document.documentElement).appendChild(styleEl);";
const newCssInject = "  try { (document.head || document.documentElement).appendChild(styleEl); } catch(e) {}";
stealthContent = stealthContent.replace(oldCssInject, newCssInject);

fs.writeFileSync(contentPath, content);
fs.writeFileSync(stealthPath, stealthContent);
console.log("\nCSP fix applied to content.js and stealth.js");

console.log("\nDone. Reload extension and hard-refresh Forbes.");
