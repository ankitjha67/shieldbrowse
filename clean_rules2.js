const fs = require("fs");
const path = require("path");
const dir = "D:\\Extensions\\shieldbrowse\\rules";

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

let grandTotal = 0;
fs.readdirSync(dir).filter(f => f.startsWith("ruleset_") && f.endsWith(".json")).forEach(file => {
  const filePath = path.join(dir, file);
  const rules = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const clean = [];
  let removed = 0;

  for (const rule of rules) {
    let f = rule.condition?.urlFilter || "";
    f = f.replace(/^\|\|\*\./, "||");
    f = f.replace(/^\|\|\*/, "||");
    f = f.replace(/\*\*/g, "*");

    if (!isValidFilter(f)) { removed++; continue; }

    // Clean initiatorDomains — remove non-ASCII entries
    if (rule.condition.initiatorDomains) {
      rule.condition.initiatorDomains = rule.condition.initiatorDomains.filter(isAsciiDomain);
      if (rule.condition.initiatorDomains.length === 0) {
        delete rule.condition.initiatorDomains;
      }
    }

    // Clean excludedInitiatorDomains too
    if (rule.condition.excludedInitiatorDomains) {
      rule.condition.excludedInitiatorDomains = rule.condition.excludedInitiatorDomains.filter(isAsciiDomain);
      if (rule.condition.excludedInitiatorDomains.length === 0) {
        delete rule.condition.excludedInitiatorDomains;
      }
    }

    // Clean requestDomains
    if (rule.condition.requestDomains) {
      rule.condition.requestDomains = rule.condition.requestDomains.filter(isAsciiDomain);
      if (rule.condition.requestDomains.length === 0) {
        delete rule.condition.requestDomains;
      }
    }

    // Clean excludedRequestDomains
    if (rule.condition.excludedRequestDomains) {
      rule.condition.excludedRequestDomains = rule.condition.excludedRequestDomains.filter(isAsciiDomain);
      if (rule.condition.excludedRequestDomains.length === 0) {
        delete rule.condition.excludedRequestDomains;
      }
    }

    rule.condition.urlFilter = f;
    rule.id = clean.length + 1;
    clean.push(rule);
  }

  fs.writeFileSync(filePath, JSON.stringify(clean));
  console.log(file + ": kept " + clean.length + ", removed " + removed);
  grandTotal += clean.length;
});
console.log("\nTotal clean rules: " + grandTotal);
