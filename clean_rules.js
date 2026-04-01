const fs = require("fs");
const path = require("path");
const dir = "D:\\Extensions\\shieldbrowse\\rules";

function isValid(f) {
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
    if (isValid(f)) {
      rule.condition.urlFilter = f;
      rule.id = clean.length + 1;
      clean.push(rule);
    } else { removed++; }
  }
  fs.writeFileSync(filePath, JSON.stringify(clean));
  console.log(file + ": kept " + clean.length + ", removed " + removed);
  grandTotal += clean.length;
});
console.log("\nTotal clean rules: " + grandTotal);
