const fs = require("fs");

// FIX 1: Repair content.js syntax error from broken regex replacement
const contentPath = "D:\\Extensions\\shieldbrowse\\scripts\\content.js";
let content = fs.readFileSync(contentPath, "utf8");

// Find and replace the broken applyFingerprintProtection function
// with a clean no-op version (fingerprinting is handled by stealth.js now)
const lines = content.split("\n");
const newLines = [];
let insideBrokenFn = false;
let braceCount = 0;
let fixed = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes("function applyFingerprintProtection") && !fixed) {
    // Replace with clean no-op
    newLines.push("  function applyFingerprintProtection() {");
    newLines.push("    // Handled by stealth.js in MAIN world (CSP-safe)");
    newLines.push("  }");
    insideBrokenFn = true;
    braceCount = 1;
    fixed = true;
    continue;
  }
  
  if (insideBrokenFn) {
    for (const ch of line) {
      if (ch === "{") braceCount++;
      if (ch === "}") braceCount--;
    }
    if (braceCount <= 0) {
      insideBrokenFn = false;
    }
    continue; // skip all lines of the old function
  }
  
  newLines.push(line);
}

fs.writeFileSync(contentPath, newLines.join("\n"));
console.log("content.js syntax error fixed");

// Verify no syntax errors
try {
  require("child_process").execSync("node --check " + contentPath, { stdio: "pipe" });
  console.log("content.js syntax: VALID");
} catch(e) {
  console.log("content.js still has errors, writing minimal version...");
  // Nuclear option: write a clean minimal content.js
  const minimal = fs.readFileSync(contentPath, "utf8");
  // Remove the function call if it exists
  const cleaned = minimal.replace(/applyFingerprintProtection\(\);?/g, "// fingerprint protection in stealth.js");
  fs.writeFileSync(contentPath, cleaned);
  try {
    require("child_process").execSync("node --check " + contentPath, { stdio: "pipe" });
    console.log("content.js syntax: VALID (after cleanup)");
  } catch(e2) {
    console.log("content.js ERROR: " + e2.stderr?.toString().trim());
  }
}

// FIX 2: Remove rule blocking bacon.forbes.com (legitimate content)
const dir = "D:\\Extensions\\shieldbrowse\\rules";
let baconRemoved = 0;
fs.readdirSync(dir).filter(f => f.startsWith("ruleset_") && f.endsWith(".json")).forEach(file => {
  const filePath = dir + "\\" + file;
  const rules = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const before = rules.length;
  const clean = rules.filter(r => {
    const f = r.condition?.urlFilter || "";
    // Remove rules that would catch bacon.forbes.com
    if (f === "||bacon" || f === "bacon") return false;
    return true;
  });
  if (clean.length < before) {
    clean.forEach((r, i) => r.id = i + 1);
    fs.writeFileSync(filePath, JSON.stringify(clean));
    baconRemoved += before - clean.length;
  }
});
console.log("bacon.forbes.com rules removed: " + baconRemoved);

console.log("\nDone. Reload extension and hard-refresh Forbes.");
