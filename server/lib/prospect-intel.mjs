/**
 * Prospecting intelligence.
 *
 * Important: this deliberately does NOT scrape Instagram, Google or any
 * private source. Unauthorised scraping breaks platform terms and produces
 * bad data. Instead it (a) generates a precise, repeatable search playbook,
 * (b) scores leads you legitimately collect (CSV export from your own
 * research, referrals, networking, or an authorised API such as Google
 * Places / Instagram Graph API), and (c) drafts personalised outreach.
 */

const FIT_NICHES = /caf|food|restaurant|beauty|skin|wellness|yoga|fitness|fashion|boutique|interior|architect|hotel|hospitality|d2c|retail|craft|studio|jewel|bakery|salon|home|local|small business/i;

export function scoreProspect(p = {}) {
  const reasons = [];
  let score = 18;
  const add = (points, reason) => { score += points; reasons.push({ points, reason }); };
  const text = `${p.niche || ""} ${p.signal || ""} ${p.notes || ""} ${p.name || ""}`;
  const lastPost = Number(p.lastPostDays || 0);
  const postsPerWeek = Number(p.postsPerWeek || 0);
  const followers = Number(p.followers || 0);

  if (FIT_NICHES.test(p.niche || "")) add(14, "Industry fits the studio's best-fit segments");
  else if (p.niche) add(4, "Adjacent industry — worth a light touch");
  if (p.hasWebsite === false || p.website === "no" || p.website === false) add(10, "No website → likely needs a visual identity");
  else if (p.website && p.website !== "yes") add(6, "Website present; audit for brand consistency");
  if (lastPost >= 14) add(12, `Dormant page (last post ${lastPost} days ago)`);
  else if (lastPost > 0 && lastPost <= 3) add(4, "Active page — already investing in content");
  if (postsPerWeek > 0 && postsPerWeek <= 2) add(8, "Low posting frequency → consistency gap");
  if (/launch|new|opening|rebrand|inconsisten|no strategy|dated|dormant|no content/i.test(text)) add(11, "Explicit trigger signal in research notes");
  if (followers >= 500 && followers <= 25000) add(8, "Right-size audience for an independent studio");
  if (followers > 100000) add(-8, "Large account — likely has an in-house team");
  if (lastPost > 90) add(-6, "Page may be abandoned; verify business is active");
  if (p.email) add(8, "Direct email available");
  else if (p.instagram) add(4, "Instagram handle available for a DM");
  if (["contacted", "replied"].includes(p.status)) add(6, "Outreach already in motion");
  if (p.status === "replied") add(10, "They replied — highest intent signal");
  if (p.status === "skipped" || p.status === "converted") add(-100, "Closed / not active");

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, grade: score >= 68 ? "hot" : score >= 42 ? "warm" : "cool", reasons: reasons.sort((a, b) => b.points - a.points) };
}

const SEGMENTS = [
  { name: "Just opened / about to launch", why: "They need an identity and a launch grid now, and have budget allocated.", where: "Grand-opening posts, local event listings, new-business registries" },
  { name: "Good offline business, weak Instagram", why: "Clear gap you can show in a 60-second audit — the easiest first conversation.", where: "Google Maps listings with 4+ stars and a quiet linked Instagram" },
  { name: "Posting often, no visual system", why: "They already value content and will pay to make it consistent.", where: "High-frequency pages with mismatched templates and captions" },
  { name: "Founder-led D2C brand", why: "Packaging, templates and a calendar are recurring needs, not a one-off.", where: "Launch announcements, marketplace storefronts, founder posts" },
];

export function buildProspectCampaign(params = {}, settings = {}) {
  const niche = String(params.niche || "independent cafés and small D2C brands").trim();
  const city = String(params.city || "Kochi, Kerala").trim();
  const platform = String(params.platform || "Instagram").trim();
  const offer = String(params.offer || "a free 1-page creative brief").trim();
  const studio = settings.studioName || "KLYRO Creative Studio";
  const [shortCity] = city.split(",");

  const searchStrings = [
    { channel: "Google Maps", label: "Map search", query: `"${niche}" "${shortCity}" "opened recently"` },
    { channel: "Google", label: "Boolean search", query: `("${niche}") AND ("${shortCity}") AND ("new" OR "launch" OR "opening") -site:instagram.com` },
    { channel: platform, label: "Hashtag combination", query: `#${shortCity.trim().toLowerCase().replace(/\s+/g, "")} #${niche.toLowerCase().replace(/[^a-z ]/g, "").split(" ")[0]} #supportlocal #smallbusiness` },
    { channel: platform, label: "Local-tag audit", query: `Search recent posts tagged ${shortCity.trim()} → sort by "Recent" → note pages with strong photography but off-brand templates` },
    { channel: "Directories", label: "Local listings", query: `${shortCity.trim()} business directory / chamber of commerce / community boards → "${niche}"` },
    { channel: "Referrals", label: "Warm network", query: `Ask 3 past clients: "Who else in ${shortCity.trim()} is building something you like?"` },
  ];

  const qualificationSignals = [
    { signal: "Posted in the last 3 days", points: 4, meaning: "Active business, already investing in content" },
    { signal: "Last post 14+ days ago", points: 12, meaning: "Consistency gap you can fix" },
    { signal: "No website or a dated logo", points: 10, meaning: "Identity opportunity" },
    { signal: "500–25k followers", points: 8, meaning: "Right stage for an independent studio" },
    { signal: "Launch / rebrand / hiring announcement", points: 11, meaning: "Timing trigger — reach out this week" },
    { signal: "Direct email or a real founder name", points: 8, meaning: "Personal outreach possible" },
  ];

  const outreach = [
    {
      step: 1, when: "Day 0", channel: `${platform} DM / email`, label: "Notice + one useful observation",
      subject: `A small note about {{name}}'s Instagram`,
      body: `Hi {{first_name}} — I came across {{name}} while looking at ${niche.toLowerCase()} in ${city}. ${'{{observation}}'}\n\nI put together ${offer} for a few local brands this month — a one-page content + visual direction, no strings attached. Want me to send one over for {{name}}?\n\n— ${studio}`,
    },
    {
      step: 2, when: "Day 3", channel: "Email / DM", label: "Value follow-up",
      subject: `One idea for {{name}}`,
      body: `Hi {{first_name}}, following up with something usable rather than a nudge: three content pillars that tend to work for ${niche.toLowerCase()} are (1) behind the work, (2) a clear best-seller / offer, (3) customer proof. Even a simple repeating template for those three makes a grid look intentional.\n\nIf it's useful, I can sketch how that would look for {{name}} — 10 minutes, no cost.\n\n— ${studio}`,
    },
    {
      step: 3, when: "Day 7", channel: "Email / DM", label: "Polite close",
      subject: `Closing the loop, {{first_name}}`,
      body: `Hi {{first_name}} — I'll leave it here so I'm not filling your inbox. If ${'{{pain}}'} ever moves up the list, reply to this and I'll pick it straight back up.\n\nWishing {{name}} a good season.\n— ${studio}`,
    },
  ];

  const sampleTargets = [
    { name: `Recently opened ${niche} in ${shortCity.trim()}`, niche, city, signal: "Opening announcement this month", postsPerWeek: 1, lastPostDays: 3, followers: 850, hasWebsite: false },
    { name: `Established ${niche} with a stale grid`, niche, city, signal: "Strong reviews, inconsistent visuals", postsPerWeek: 1, lastPostDays: 21, followers: 6200, hasWebsite: true },
    { name: `Founder-led ${niche} planning a launch`, niche, city, signal: "Launch / rebrand trigger", postsPerWeek: 3, lastPostDays: 2, followers: 1900, hasWebsite: false },
    { name: `High-frequency ${niche} with no system`, niche, city, signal: "Posts daily, no visual consistency", postsPerWeek: 6, lastPostDays: 1, followers: 12000, hasWebsite: true },
  ].map((t) => ({ ...t, ...scoreProspect(t), sample: true }));

  return {
    createdAt: new Date().toISOString(),
    params: { niche, city, platform, offer },
    headline: `${niche} in ${city}: a 30-minute-a-day prospecting loop`,
    summary: `Find 10 qualified ${niche.toLowerCase()} businesses a week without scraping anything: use the searches below, record them in the Prospects table, and let the fit score decide who deserves a personal note first.`,
    segments: SEGMENTS,
    searchStrings,
    qualificationSignals,
    outreach,
    dailyWorkflow: [
      "10 min — run two of the searches above, add 3 new businesses to the Prospects table.",
      "10 min — open their last 9 posts; note one specific, kind observation (never a criticism).",
      "10 min — send 2 personal messages using step 1 with the observation filled in.",
      "Friday — review fit scores, mark replies, and move anyone warm into Enquiries.",
    ],
    compliance: "Use public business information and opt-in conversations only. Never bulk-DM, never scrape behind a login, and always honour an opt-out. For automated discovery at scale, connect an authorised API (Google Places, Instagram Graph API) and import the results as CSV.",
    sampleTargets,
  };
}

/** Small, dependency-free CSV parser with quoted-field support. */
export function parseCsv(text = "") {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const src = String(text).replace(/\r\n?/g, "\n");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field.trim()); field = ""; }
    else if (ch === "\n") { row.push(field.trim()); if (row.some((c) => c !== "")) rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  row.push(field.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  return rows.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cells[i] || ""; });
    return obj;
  });
}

const COLUMN_ALIASES = {
  name: ["name", "business", "businessname", "company", "brand"],
  niche: ["niche", "industry", "category", "type"],
  city: ["city", "location", "area", "region"],
  instagram: ["instagram", "handle", "ighandle", "social"],
  website: ["website", "site", "url"],
  email: ["email", "emailaddress", "mail"],
  phone: ["phone", "contact", "mobile"],
  followers: ["followers", "followercount", "audience"],
  postsPerWeek: ["postsperweek", "posts", "frequency", "postingfrequency"],
  lastPostDays: ["lastpostdays", "lastpost", "daysincepost", "inactivedays"],
  signal: ["signal", "notes", "note", "observation", "pain", "research"],
  status: ["status", "stage"],
};

function aliasGet(row, key) {
  for (const alias of COLUMN_ALIASES[key] || [key]) {
    if (row[alias] !== undefined && row[alias] !== "") return row[alias];
  }
  return "";
}

export function csvToProspects(text = "") {
  return parseCsv(text).map((row) => {
    const raw = {};
    for (const key of Object.keys(COLUMN_ALIASES)) raw[key] = String(aliasGet(row, key)).trim();
    const p = {
      ...raw,
      followers: Number(raw.followers) || 0,
      postsPerWeek: Number(raw.postsPerWeek) || 0,
      lastPostDays: Number(raw.lastPostDays) || 0,
      hasWebsite: /^(no|false|0|)$/.test(raw.website.toLowerCase()) ? false : Boolean(raw.website),
      status: ["researched", "contacted", "replied", "converted", "skipped"].includes(raw.status.toLowerCase()) ? raw.status.toLowerCase() : "researched",
    };
    return p.name ? { ...p, ...scoreProspect(p) } : null;
  }).filter(Boolean);
}

export function fillOutreach(template = "", prospect = {}, observation = "") {
  const name = prospect.name || "your brand";
  const firstName = name.split(/\s+/)[0];
  return String(template)
    .replaceAll("{{name}}", name)
    .replaceAll("{{first_name}}", firstName)
    .replaceAll("{{observation}}", observation || `Your recent posts have a lovely sense of place — the visual system could carry that even further.`)
    .replaceAll("{{pain}}", "a more consistent visual presence");
}
