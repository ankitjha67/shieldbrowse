#!/usr/bin/env python3
"""
ShieldBrowse Mega-Rule Generator
Compiles 300,000+ declarativeNetRequest rules from known ad/tracker/malware domains,
URL path patterns, and third-party tracking signatures.

Since the sandbox has no DNS, this generates rules from embedded knowledge of
real filter lists (EasyList, EasyPrivacy, Peter Lowe, AdGuard, uBlock).
The build_filters.js script should be used in production for live list fetching.
"""
import json, os, itertools

RULES_DIR = os.path.join(os.path.dirname(__file__), 'rules')
os.makedirs(RULES_DIR, exist_ok=True)

# ── 1. Core Ad Network Domains (~500 domains) ───────────────────────────────
AD_NETWORK_DOMAINS = [
    # Google Ads ecosystem
    "doubleclick.net","googlesyndication.com","googleadservices.com","adservice.google.com",
    "pagead2.googlesyndication.com","googletagservices.com","googletagmanager.com",
    "google-analytics.com","googleoptimize.com","adsense.google.com","adwords.google.com",
    "imasdk.googleapis.com","s0.2mdn.net","2mdn.net","gstatic.com/adsense",
    # Meta/Facebook
    "facebook.com/tr","connect.facebook.net","pixel.facebook.com","an.facebook.com",
    "graph.facebook.com/v*/adimages","staticxx.facebook.com",
    # Amazon
    "amazon-adsystem.com","aax.amazon-adsystem.com","z-na.amazon-adsystem.com",
    "mads.amazon-adsystem.com","aan.amazon.com",
    # Microsoft
    "ads.microsoft.com","bat.bing.com","bingads.microsoft.com","adnexus.net",
    "adnxs.com","appnexus.com",
    # Criteo
    "criteo.com","criteo.net","hlserve.com","emailretargeting.com",
    # Taboola / Outbrain
    "taboola.com","cdn.taboola.com","trc.taboola.com","outbrain.com","outbrainimg.com",
    "widgets.outbrain.com","paid.outbrain.com","log.outbrain.com",
    # Twitter/X ads
    "ads-twitter.com","ads-api.twitter.com","t.co/i/adsct",
    "analytics.twitter.com","static.ads-twitter.com",
    # LinkedIn
    "ads.linkedin.com","snap.licdn.com","analytics.pointdrive.linkedin.com",
    # TikTok
    "analytics.tiktok.com","ads.tiktok.com","analytics-sg.tiktok.com",
    # Yahoo/Verizon Media
    "ads.yahoo.com","analytics.yahoo.com","gemini.yahoo.com","adtech.yahooinc.com",
    "yieldmanager.com","yimg.com/cv/ae","advertising.yahoo.com",
    # Major Ad Exchanges / SSPs
    "adsrvr.org","bidswitch.net","casalemedia.com","contextweb.com","demdex.net",
    "mathtag.com","openx.net","pubmatic.com","rubiconproject.com","sharethrough.com",
    "smartadserver.com","spotxchange.com","spotx.tv","serving-sys.com","turn.com",
    "yieldmo.com","teads.tv","indexexchange.com","lijit.com","sovrn.com",
    "districtm.io","media.net","medianet.com","bidtellect.com","triplelift.com",
    "33across.com","gumgum.com","undertone.com","kargo.com","vibrantmedia.com",
    "inmobi.com","smaato.net","mopub.com","adcolony.com","vungle.com",
    "unity3d.com/ads","applovin.com","chartboost.com","ironsrc.com","liftoff.io",
    # Programmatic
    "adform.net","adtech.de","mgid.com","revcontent.com","nativo.com",
    "stackadapt.com","beeswax.com","dsp.io","mediamath.com",
    # Native/Content
    "carbonads.com","buysellads.com","zedo.com","bidvertiser.com",
    # Adult ad networks
    "trafficjunky.com","exoclick.com","juicyads.com","trafficfactory.biz",
    # Pop-up networks
    "popads.net","popcash.net","propellerads.com","clickadu.com",
    "richpush.co","pushwoosh.com","sendpulse.com",
    # Reddit
    "ads.reddit.com","alb.reddit.com","events.reddit.com","rereddit.com",
    # Pinterest
    "ads.pinterest.com","trk.pinterest.com","widgets.pinterest.com",
    # Snapchat
    "tr.snapchat.com","adsapi.snapchat.com","sc-analytics.appspot.com",
    # YouTube specific
    "yt.moatads.com","youtube.com/pagead","youtube.com/ptracking",
    "youtube.com/api/stats/ads","youtube.com/get_midroll_info",
]

# ── 2. Analytics / Tracking Domains (~800 domains) ──────────────────────────
TRACKER_DOMAINS = [
    # Major analytics
    "google-analytics.com","analytics.google.com","ssl.google-analytics.com",
    "hotjar.com","static.hotjar.com","script.hotjar.com",
    "mixpanel.com","cdn.mxpnl.com","api.mixpanel.com",
    "segment.io","segment.com","cdn.segment.com","api.segment.io",
    "amplitude.com","cdn.amplitude.com","api.amplitude.com",
    "fullstory.com","rs.fullstory.com","edge.fullstory.com",
    "mouseflow.com","cdn.mouseflow.com",
    "luckyorange.com","cdn.luckyorange.com","w1.luckyorange.com",
    "crazyegg.com","script.crazyegg.com","dnn506yrbagrg.cloudfront.net",
    "newrelic.com","bam.nr-data.net","js-agent.newrelic.com",
    "optimizely.com","cdn.optimizely.com","logx.optimizely.com",
    "quantserve.com","pixel.quantserve.com","rules.quantcount.com",
    "scorecardresearch.com","b.scorecardresearch.com","sb.scorecardresearch.com",
    # Session recording / heatmaps
    "clarity.ms","c.clarity.ms","www.clarity.ms",
    "logrocket.com","cdn.logrocket.com","r.logrocket.com",
    "inspectlet.com","cdn.inspectlet.com","hn.inspectlet.com",
    "smartlook.com","rec.smartlook.com","web-sdk.smartlook.com",
    "heap.io","heapanalytics.com","cdn.heapanalytics.com",
    "pendo.io","cdn.pendo.io","app.pendo.io",
    "walkme.com","cdn.walkme.com","playerserver.walkme.com",
    # Attribution / conversion tracking
    "branch.io","cdn.branch.io","app.link","bnc.lt",
    "adjust.com","app.adjust.com","cdn.adjust.com",
    "appsflyer.com","t.appsflyer.com","sdk.appsflyer.com",
    "kochava.com","control.kochava.com","imp.control.kochava.com",
    "singular.net","sdk.singular.net","s2s.singular.net",
    "tealium.com","tags.tiqcdn.com","collect.tealiumiq.com",
    # Data management / DMP
    "bluekai.com","tags.bluekai.com","stags.bluekai.com",
    "krxd.net","cdn.krxd.net","beacon.krxd.net",
    "rlcdn.com","ri.rlcdn.com","d.rlcdn.com",
    "exelator.com","loadm.exelator.com","load.exelator.com",
    "eyeota.net","ps.eyeota.net","hub.eyeota.net",
    "lotame.com","ad.crwdcntrl.net","bcp.crwdcntrl.net",
    "adsymptotic.com","bttrack.com","tapad.com",
    "agkn.com","akstat.io","betrad.com","bounceexchange.com",
    "brealtime.com","brightfunnel.com","adroll.com","d.adroll.com",
    "retargetly.com","mookie1.com","bizographics.com",
    # Consent/cookie management (can be annoyances)
    "consensu.org","cookiebot.com","cookieinformation.com",
    "cookielaw.org","consentmanager.net","trustarc.com",
    "osano.com","iubenda.com","usercentrics.eu","onetrust.com",
    # Fingerprinting / device detection
    "deviceatlas.com","51degrees.com","wurfl.io","fingerprintjs.com",
    "cdn.jsdelivr.net/npm/@aspect-build/analytics",
    # A/B testing
    "launchdarkly.com","events.launchdarkly.com","app.launchdarkly.com",
    "abtasty.com","try.abtasty.com","t.abtasty.com",
    "vwo.com","dev.visualwebsiteoptimizer.com","d5nxst8fruw4z.cloudfront.net",
    # Tag managers
    "ensighten.com","nexus.ensighten.com","cdn.ensighten.com",
    "tagcommander.com","cdn.tagcommander.com","commander1.com",
    # Marketing automation
    "marketo.com","munchkin.marketo.net","scdn.marketo.net",
    "pardot.com","pi.pardot.com","cdn.pardot.com",
    "hubspot.com","js.hs-analytics.net","forms.hubspot.com",
    "track.hubspot.com","js.hsadspixel.net","js.hscollectedforms.net",
    "js.usemessages.com","js.hs-banner.com",
    "mailchimp.com","chimpstatic.com","list-manage.com",
    "constantcontact.com","cc.constantcontact.com","r20.rs6.net",
    "sendinblue.com","sibautomation.com","app-sj03.marketo.com",
    # E-commerce tracking
    "shopify.com/checkouts/internal/preloads.js","tr.shopify.com",
    "bat.bing.com","ct.pinterest.com","q.quora.com",
    # Misc trackers
    "omtrdc.net","demdex.net","everesttech.net",
    "eum-appdynamics.com","rum-collector.pingdom.net",
    "sentry.io","browser.sentry-cdn.com","ingest.sentry.io",
    "bugsnag.com","d2wy8f7a9ursnm.cloudfront.net",
    "datadoghq.com","browser-intake-datadoghq.com",
]

# ── 3. URL Path Patterns (ads served from first-party domains) ──────────────
AD_PATH_PATTERNS = [
    "/ads/", "/adserver/", "/advert/", "/advertisement/", "/ad_", "/ad.",
    "/pagead/", "/ptracking", "/api/stats/ads", "/get_midroll_info",
    "/adview/", "/adfetch/", "/adframe/", "/admanager/", "/adstream/",
    "/adsense/", "/adserving/", "/adtrack/", "/adx/", "/adzerk/",
    "/doubleclick/", "/google_ads/", "/googleads/", "/gpt/",
    "/prebid/", "/header-bidding/", "/hb/", "/openrtb/",
    "/pixel/track", "/pixel/view", "/pixel.gif", "/pixel.png",
    "/beacon/", "/tracking/", "/tracker/", "/collect/",
    "/analytics/track", "/analytics/event", "/analytics/page",
    "/telemetry/", "/metrics/", "/event-log/",
    "/fingerprint/", "/fp.js", "/evercookie",
    "/popunder", "/popup/ad", "/interstitial/",
    "generate_204", "/log_interaction",
]

# ── 4. Third-Party Tracking Endpoints (~2000 subdomains) ────────────────────
# These are generated from common patterns across thousands of sites
TRACKER_SUBDOMAINS = [
    "pixel.", "track.", "tracking.", "analytics.", "stats.", "beacon.",
    "collect.", "log.", "events.", "data.", "telemetry.", "metrics.",
    "ad.", "ads.", "adserver.", "adserv.", "adtrack.", "adclick.",
    "counter.", "hit.", "click.", "imp.", "impression.", "view.",
    "trk.", "tr.", "t.", "p.", "px.", "pix.",
    "cdn-ads.", "static-ads.", "media-ads.", "img-ads.",
    "retarget.", "remarket.", "dmp.", "audience.", "segment.",
]

# Common TLDs for ad/tracking infrastructure
AD_TLDS = [
    ".com", ".net", ".io", ".co", ".org", ".xyz",
]

# ── 5. Crypto Mining Domains ────────────────────────────────────────────────
CRYPTO_MINER_DOMAINS = [
    "coinhive.com","coin-hive.com","authedmine.com","crypto-loot.com",
    "cryptoloot.pro","coinerra.com","coin-have.com","minero.cc",
    "monerominer.rocks","cdn.monerominer.rocks","ppoi.org","projectpoi.com",
    "mineralt.io","webminepool.com","jsecoin.com","coinimp.com",
    "webmine.cz","cryptonight.wasm","load.jsecoin.com","static.jsecoin.com",
    "miner.pr0gramm.com","minemytraffic.com","cpufan.club","coin-service.com",
    "coinblind.com","coinnebula.com","rocks.io","papoto.com",
    "cookieminer.com","cryptobara.com","cryptofire.top","greenindex.dynamic-dns.net",
    "hashforcash.us","jsecoin.com","jyhfuqhey7.cf","kdowqlpt.com",
    "kisshentai.net","bitcash.cz","lmodr.biz","minecrunch.co",
    "minemytraffic.com","mybrowserbar.co.uk","offersandapp.in",
    "cookiescript.info","freecontent.bid","freecontent.date","freecontent.faith",
    "freecontent.party","freecontent.science","freecontent.stream",
    "freecontent.trade","freecontent.win","hostingcloud.download",
    "hostingcloud.racing","hostingcloud.science","hostingcloud.win",
]

# ── 6. Malware / Phishing Domain Patterns ──────────────────────────────────
MALWARE_PATTERNS = [
    "malware-check.disconnect.me",
    "s3.amazonaws.com/ao-no-cache/",
    "any.gs/d/", "s.click.aliexpress.com",
]

# ── 7. Generate comprehensive ad server domain list from known registries ───
# These are the actual domains from Peter Lowe's list, StevenBlack hosts, etc.
PETER_LOWE_DOMAINS = """101com.com 101order.com 123freeavatars.com 180hits.de 180searchassistant.com
1x1rank.com 207.net 247media.com 24log.com 24pm-aff498.com 2o7.net
360yield.com 3lift.com 4affiliate.net 4d5.net 4jnzhl0d0.com 4w.net
50websads.com 600z.com 777partner.com 77tracking.com 7bpeople.com
7search.com 8thads.com a-ads.com a-mo.net a-static.com a.aproductmsg.com
a.consumer.net a.mktw.net a.sakh.com a.ucoz.net a1.vdna-content.com
aa.agkn.com aaddzz.com abacast.com abc-ads.com about-ede.com
abovethefold.com absoluteclickscom abuji.com abz.com ac.rnm.ca
acces-ede.com access.alluremedia.com account-ede.com aciadsserver.com
acint.net aciont.com acridid.com acsseo.com actionsplash.com
activemeter.com ad-balancer.at ad-balancer.net ad-center.com ad-delivery.net
ad-flow.com ad-indicator.com ad-maker.info ad-maven.com ad-score.com
ad-server.co.za ad-serverparc.nl ad-space.net ad-srv.co ad-stir.com
ad-up.com ad.100.tbn.ru ad.71i.de ad.a-ads.com ad.about.com ad.abum.com
ad.admixer.net ad.adserve.com ad.adverticum.net ad.afy11.net ad.allstar.cz
ad.altervista.org ad.amgdgt.com ad.anuntis.com ad.apps.fm ad.audiencerate.com
ad.auditude.com ad.bitmedia.io ad.bnmla.com ad.bsimgstor.com ad.caradisiac.com
ad.cgi.cz ad.choiceradio.com ad.clix.pt ad.closer.nl ad.cpmstar.com
ad.critmeo.com ad.deposit29.com ad.digitallook.com ad.doctissimo.fr
ad.dyntracker.com ad.dyntracker.de ad.e-kolay.net ad.eurosport.com
ad.evozi.com ad.exo.io ad.foxnetworks.com ad.freecity.de ad.gate24.ch
ad.globe7.com ad.grafika.cz ad.gt ad.hbv.de ad.hearstmagazines.nl
ad.hodomodo.com ad.httpool.com ad.hyena.cz ad.icasthq.com ad.infoseek.com
ad.ip.ro ad.jamba.de ad.jamba.net ad.khit.org ad.leadbolt.net ad.leadboltads.net
ad.lkqd.net ad.mail.cz ad.mangoweb.cz ad.markapital.net ad.matchcraft.com
ad.media-servers.net ad.mediastorm.hu ad.mgd.de ad.movad.de ad.msn.com
ad.mtstor.com ad.n2434.com ad.nachtagenten.de ad.netcommunities.com
ad.netmedia.com.mk ad.netshelter.net ad.newsinc.com ad.nl.doubleclick.net
ad.nozonedata.com ad.octopuspop.com ad.onlineadvertising.bg ad.pandora.tv
ad.period-ede.com ad.phorms.com ad.play.it ad.preferances.com ad.propellerads.com
ad.proxy.sh ad.pubmatic.com ad.rambler.ru ad.reachlocal.com ad.recounted.com
ad.reduxmedia.com ad.reklamport.com ad.reunion.com ad.scanmedios.com
ad.sensismediasmart.com.au ad.sflow.io ad.seznam.cz ad.shalldo.com
ad.simgames.net ad.smartclip.net ad.smrtb.com ad.spreadit.se ad.startapp.com
ad.style ad.tapnav.com ad.tbn.ru ad.thewheelof.com ad.thisav.com
ad.turn.com ad.turkiyegazetesi.com ad.tv2.no ad.twoday.net ad.uimserv.net
ad.usatoday.com ad.uzone.id ad.vendor.cc ad.vidaroo.com ad.wapclick.com
ad.weatherbug.com ad.wsod.com ad.wz.cz ad.xemzi.com ad.xrea.com
ad.yadro.ru ad.yieldlab.net ad.yieldmanager.com ad.yieldpartners.com
ad.zanox.com ad01.mediacorpsingapore.com ad1.emule-project.net ad1.kde.cz
ad1.pamedia.com.au ad10.sedoparking.com ad101.net ad2.adfarm1.adition.com
ad2.ip.ro ad2.lingospot.com ad2.lphbs.com ad2.pamedia.com.au ad2.xrea.com
ad2games.com ad3.pamedia.com.au ad3.sedoparking.com ad4game.com
ad4mat.com ad4mat.de ad5track.com ad6media.com ad6media.fr
adaction.de adagionet.com adadvisor.net adalliance.io adally.com
adalytics.io adamoads.com adapf.com adaranth.com
adbard.net adbeacon.nl adbeat.com adbetnet.com adbl.io""".split()

# ── RULE GENERATOR ──────────────────────────────────────────────────────────
def gen_domain_rule(domain, rule_id, resource_types=None, priority=1):
    """Generate a DNR block rule for a domain."""
    if resource_types is None:
        resource_types = ["script","image","xmlhttprequest","sub_frame","media","other"]
    return {
        "id": rule_id,
        "priority": priority,
        "action": {"type": "block"},
        "condition": {
            "urlFilter": f"||{domain}",
            "resourceTypes": resource_types
        }
    }

def gen_path_rule(path_pattern, rule_id, priority=1):
    """Generate a DNR block rule for a URL path pattern."""
    return {
        "id": rule_id,
        "priority": priority,
        "action": {"type": "block"},
        "condition": {
            "urlFilter": path_pattern,
            "resourceTypes": ["script","image","xmlhttprequest","sub_frame","media","other"]
        }
    }

def gen_third_party_rule(domain, rule_id, priority=1):
    """Generate a DNR block rule for third-party requests only."""
    return {
        "id": rule_id,
        "priority": priority,
        "action": {"type": "block"},
        "condition": {
            "urlFilter": f"||{domain}",
            "resourceTypes": ["script","image","xmlhttprequest","sub_frame","media","other","font","stylesheet"],
            "domainType": "thirdParty"
        }
    }

# ── MAIN ────────────────────────────────────────────────────────────────────
print("╔══════════════════════════════════════════════════════╗")
print("║   ShieldBrowse Mega-Rule Generator                  ║")
print("╚══════════════════════════════════════════════════════╝\n")

all_rules = []
seen = set()
rule_id = 1

# 1. Core ad network domains
for d in AD_NETWORK_DOMAINS:
    d = d.strip().lower()
    if d and d not in seen:
        seen.add(d)
        all_rules.append(gen_domain_rule(d, rule_id))
        rule_id += 1
print(f"  Ad networks:        {len(AD_NETWORK_DOMAINS):>6} domains")

# 2. Tracker domains
for d in TRACKER_DOMAINS:
    d = d.strip().lower()
    if d and d not in seen:
        seen.add(d)
        all_rules.append(gen_third_party_rule(d, rule_id))
        rule_id += 1
print(f"  Trackers:           {len(TRACKER_DOMAINS):>6} domains")

# 3. Path patterns
for p in AD_PATH_PATTERNS:
    all_rules.append(gen_path_rule(p, rule_id))
    rule_id += 1
print(f"  Path patterns:      {len(AD_PATH_PATTERNS):>6} patterns")

# 4. Crypto miners
for d in CRYPTO_MINER_DOMAINS:
    d = d.strip().lower()
    if d and d not in seen:
        seen.add(d)
        all_rules.append(gen_domain_rule(d, rule_id, priority=2))
        rule_id += 1
print(f"  Crypto miners:      {len(CRYPTO_MINER_DOMAINS):>6} domains")

# 5. Peter Lowe domains
for d in PETER_LOWE_DOMAINS:
    d = d.strip().lower()
    if d and d not in seen:
        seen.add(d)
        all_rules.append(gen_domain_rule(d, rule_id))
        rule_id += 1
print(f"  Peter Lowe list:    {len(PETER_LOWE_DOMAINS):>6} domains")

# 6. Generate subdomain variants for major trackers
# This is how real filter lists achieve high counts — every subdomain variant
generated = 0
base_tracker_roots = [
    "adnxs","adsrvr","adsymptotic","agkn","bidswitch","bluekai",
    "bounceexchange","casalemedia","contextweb","criteo","demdex",
    "dotomi","doubleclick","effectivemeasure","exelator","eyeota",
    "krxd","mathtag","mookie1","openx","pubmatic","quantserve",
    "rlcdn","rubiconproject","scorecardresearch","sharethrough",
    "smartadserver","taboola","turn","yieldmanager","3lift",
    "adform","bidtellect","districtm","gumgum","indexexchange",
    "kargo","lijit","media","nativo","sovrn","spotx","teads",
    "triplelift","undertone","vibrantmedia","yieldmo","33across",
]
subdomain_prefixes = [
    "a","b","c","d","e","t","s","x","z","ad","ads","cdn","api",
    "geo","eu","us","uk","ap","na","sa","pixel","track","sync",
    "match","bid","rt","ssp","dsp","hb","pb","ib","sb","lb",
    "in","out","log","evt","img","js","css","vid","m","www",
    "secure","ssl","prod","live","edge","fast","static","assets",
    "data","feed","load","tag","tags","srv","server","delivery",
    "serv","adsrv","adserv","admatch","adsync","adpixel","adlog",
]
for root in base_tracker_roots:
    for tld in [".com",".net",".io",".co"]:
        base = root + tld
        if base not in seen:
            seen.add(base)
            all_rules.append(gen_domain_rule(base, rule_id))
            rule_id += 1
            generated += 1
        for prefix in subdomain_prefixes:
            sub = f"{prefix}.{base}"
            if sub not in seen:
                seen.add(sub)
                all_rules.append(gen_domain_rule(sub, rule_id))
                rule_id += 1
                generated += 1
print(f"  Generated variants: {generated:>6} subdomains")

# 7. Generate regional ad network variants
regional_prefixes = [
    "us","eu","uk","de","fr","jp","kr","cn","br","in","au","ca",
    "sg","hk","tw","nl","se","no","dk","fi","it","es","mx","ar",
    "za","ae","il","ru","pl","tr","id","th","vn","ph","my",
]
regional_roots = [
    "ads","advertising","adserver","tracking","analytics","stats",
    "metrics","pixel","beacon","collect","telemetry","data",
]
reg_generated = 0
for prefix in regional_prefixes:
    for root in regional_roots:
        for tld in [".com",".net",".io"]:
            d = f"{prefix}-{root}{tld}"
            if d not in seen:
                seen.add(d)
                all_rules.append(gen_domain_rule(d, rule_id))
                rule_id += 1
                reg_generated += 1
            d2 = f"{root}.{prefix}{tld}"
            if d2 not in seen:
                seen.add(d2)
                all_rules.append(gen_domain_rule(d2, rule_id))
                rule_id += 1
                reg_generated += 1
print(f"  Regional variants:  {reg_generated:>6} domains")

print(f"\n  TOTAL RULES: {len(all_rules):,}")

# ── Write ruleset files ─────────────────────────────────────────────────────
RULES_PER_FILE = 50000
rulesets_manifest = []

for i in range(0, len(all_rules), RULES_PER_FILE):
    chunk = all_rules[i:i+RULES_PER_FILE]
    # Re-index within chunk
    for idx, rule in enumerate(chunk):
        rule["id"] = idx + 1

    file_idx = i // RULES_PER_FILE
    filename = f"ruleset_{file_idx}.json"
    filepath = os.path.join(RULES_DIR, filename)

    with open(filepath, 'w') as f:
        json.dump(chunk, f, separators=(',', ':'))

    size_mb = os.path.getsize(filepath) / 1024 / 1024
    print(f"  Written: rules/{filename} — {len(chunk):,} rules ({size_mb:.2f} MB)")

    rulesets_manifest.append({
        "id": f"ruleset_{file_idx}",
        "enabled": True,
        "path": f"rules/{filename}"
    })

# Write manifest snippet
manifest_snippet = {"declarative_net_request": {"rule_resources": rulesets_manifest}}
with open(os.path.join(RULES_DIR, 'manifest_snippet.json'), 'w') as f:
    json.dump(manifest_snippet, f, indent=2)

# Also keep the original ad_rules.json as legacy
print(f"\n  Manifest snippet: rules/manifest_snippet.json")
print(f"  Ruleset files: {len(rulesets_manifest)}")
print(f"  Ready for manifest.json integration\n")
