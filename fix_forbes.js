const fs = require("fs");
const dir = "D:\\Extensions\\shieldbrowse\\rules";

// Domains whose own resources should never be blocked by first-party rules
// These are sites known to break with aggressive filtering
const protectedDomains = [
  "forbes.com", "i.forbesimg.com", "thumbor.forbes.com",
  "fortune.com", "businessinsider.com", "insider.com",
  "bloomberg.com", "reuters.com", "bbc.com", "bbc.co.uk",
  "nytimes.com", "washingtonpost.com", "theguardian.com",
  "cnn.com", "cnbc.com", "wsj.com", "ft.com",
  "wired.com", "techcrunch.com", "theverge.com",
  "arstechnica.com", "engadget.com", "zdnet.com"
];

let totalFixed = 0;

fs.readdirSync(dir).filter(f => f.startsWith("ruleset_") && f.endsWith(".json")).forEach(file => {
  const filePath = dir + "\\" + file;
  const rules = JSON.parse(fs.readFileSync(filePath, "utf8"));
  let fixed = 0;

  for (const rule of rules) {
    const c = rule.condition;
    
    // If the rule has no domain restriction, it blocks on ALL sites
    // Add excludedInitiatorDomains so it won't block first-party resources
    // on major news/content sites that are known to break
    if (!c.initiatorDomains && !c.excludedInitiatorDomains) {
      // Only for rules that block scripts/images (the ones causing breakage)
      const types = c.resourceTypes || [];
      if (types.includes("script") || types.includes("image")) {
        // Check if the urlFilter is a short/broad pattern (most likely to false-positive)
        const f = c.urlFilter || "";
        if (f.length < 15 && !f.startsWith("||")) {
          c.excludedInitiatorDomains = protectedDomains;
          fixed++;
        }
      }
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(rules));
  console.log(file + ": protected " + fixed + " broad rules");
  totalFixed += fixed;
});
console.log("\nTotal rules with site protection: " + totalFixed);
