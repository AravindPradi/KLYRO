/**
 * KLYRO Brief Engine — turns a few client answers (or a raw enquiry message)
 * into a complete, structured creative requirement document for graphic design
 * and Instagram curation.
 *
 * It is a local, explainable inference engine: lexical intent detection,
 * industry profiles, rule-based scope/pricing inference and templated
 * generation with deterministic variation. No API key, no network, no data
 * leaves the server. `server/lib/llm.mjs` can optionally replace the
 * narrative layer with an OpenAI-compatible model when configured.
 */
import { analyseEnquiry, extractKeywords } from "./lead-intel.mjs";

export const GOAL_OPTIONS = [
  "Get more enquiries / leads",
  "Increase product sales",
  "Grow an engaged following",
  "Launch a new brand or product",
  "Look more professional",
  "Post consistently",
  "Rebrand / refresh visuals",
  "Save time on content",
];

export const DESIGN_OPTIONS = [
  "Logo & brand identity",
  "Brand guidelines / kit",
  "Social post templates",
  "Packaging & labels",
  "Posters / flyers / ads",
  "Presentation deck",
];

export const INSTAGRAM_OPTIONS = [
  "Content strategy & pillars",
  "Monthly content calendar",
  "Caption writing",
  "Reel concepts",
  "Story templates",
  "Grid / visual system",
  "Hashtag & discovery research",
  "Monthly analytics review",
];

export const BUDGET_OPTIONS = ["Under ₹25,000", "₹25,000 – ₹60,000", "₹60,000+", "Not decided yet"];
export const TIMELINE_OPTIONS = ["Within 1 month", "1–3 months", "Flexible", "Exploring"];
export const STAGE_OPTIONS = ["Just starting", "Growing", "Established", "Relaunching"];
export const TONE_OPTIONS = ["Warm & editorial", "Minimal & calm", "Bold & energetic", "Playful & friendly", "Premium & refined"];

const INDUSTRY_PROFILES = {
  food: {
    match: /caf[eé]|coffee|restaurant|bakery|food|kitchen|roast|tea|brew|dessert|hotel|hostel|dine/i,
    label: "Food, café & hospitality",
    pillars: [
      { name: "Behind the counter", purpose: "Humanise the team and show craft", topics: ["A day in the kitchen", "How a signature dish is made", "Meet the people behind the brand", "Sourcing stories"] },
      { name: "The menu & the moment", purpose: "Drive visits and orders", topics: ["Seasonal special", "Best-seller spotlight", "What to order for a first visit", "Limited-time drop"] },
      { name: "Space & atmosphere", purpose: "Sell the experience", topics: ["A quiet corner of the space", "Evening ambience reel", "Before the doors open", "Customer moment"] },
      { name: "Community & proof", purpose: "Build trust and local reach", topics: ["Customer review card", "Local collaboration", "Event recap", "Milestone thank-you"] },
    ],
    palette: [{ name: "Espresso", hex: "#3B2B24", use: "primary text / dark grounds" }, { name: "Oat", hex: "#EFE6D5", use: "backgrounds" }, { name: "Brass", hex: "#B08D57", use: "accents & dividers" }, { name: "Olive", hex: "#6E7549", use: "secondary highlight" }],
    hashtags: ["#kochifoodie", "#keralacafe", "#localcoffee", "#cafeculture", "#supportlocal"],
    typography: "A high-contrast serif for headlines paired with a quiet, wide-tracked sans for menus and captions.",
  },
  beauty: {
    match: /skin|beauty|cosmetic|makeup|hair|wellness|spa|salon|fragrance|d2c|selfcare/i,
    label: "Beauty, wellness & D2C",
    pillars: [
      { name: "Ingredient & ritual", purpose: "Educate and build product confidence", topics: ["What's inside the formula", "A three-step evening ritual", "Ingredient myth vs fact", "How it's made"] },
      { name: "Results & proof", purpose: "Reduce purchase hesitation", topics: ["Real routine, real result", "Before / after story", "Customer review card", "Dermatologist note"] },
      { name: "Brand world", purpose: "Make the product recognisable", topics: ["Texture close-up", "Shelf styling", "Packaging detail", "Founder note"] },
      { name: "Offers & launches", purpose: "Convert attention to sales", topics: ["Launch countdown", "Bundle breakdown", "Restock alert", "Gift guide"] },
    ],
    palette: [{ name: "Porcelain", hex: "#F7F2EA", use: "backgrounds" }, { name: "Clay", hex: "#C98B72", use: "warm accents" }, { name: "Ink", hex: "#26211E", use: "text" }, { name: "Sage", hex: "#9AA88C", use: "calm highlight" }],
    hashtags: ["#cleanbeauty", "#skincareritual", "#madeinindia", "#slowbeauty", "#selfcareroutine"],
    typography: "An elegant light serif with generous spacing, restrained all-caps labels and lots of negative space.",
  },
  interiors: {
    match: /interior|architect|design studio|furniture|home decor|real estate|construction|space|landscape/i,
    label: "Interiors, architecture & spaces",
    pillars: [
      { name: "Project stories", purpose: "Show the thinking, not just the finish", topics: ["Before & after", "A detail worth keeping", "Material palette breakdown", "From sketch to site"] },
      { name: "Expert eye", purpose: "Establish authority", topics: ["Three ways to light a room", "Common layout mistake", "Material care guide", "Client question answered"] },
      { name: "Process & people", purpose: "Build trust before a big purchase", topics: ["Site visit notes", "Meet the team", "How a project starts", "Timeline explainer"] },
      { name: "Portfolio proof", purpose: "Convert inspiration into enquiries", topics: ["Completed project reel", "Client testimonial card", "Award / press mention", "Book a consultation"] },
    ],
    palette: [{ name: "Limestone", hex: "#E8E2D6", use: "backgrounds" }, { name: "Charcoal", hex: "#333330", use: "text" }, { name: "Brass", hex: "#B08D57", use: "accents" }, { name: "Moss", hex: "#5F6B54", use: "secondary" }],
    hashtags: ["#interiorsofindia", "#architecturekerala", "#designprocess", "#materialpalette", "#spacemaking"],
    typography: "A quiet geometric sans for body copy with a display serif reserved for project titles; grid-led layouts.",
  },
  wellness: {
    match: /yoga|fitness|gym|health|mindful|meditation|physio|clinic|coach|nutrition/i,
    label: "Wellness, fitness & coaching",
    pillars: [
      { name: "Practice & technique", purpose: "Give value first", topics: ["A 30-second form cue", "Beginner modification", "Breathing exercise", "Common mistake fixed"] },
      { name: "People & progress", purpose: "Create belonging", topics: ["Member milestone", "Instructor intro", "Community morning", "Transformation story"] },
      { name: "Everyday guidance", purpose: "Saveable, shareable content", topics: ["Weekly schedule card", "Three tips for recovery", "Myth vs fact", "Habit checklist"] },
      { name: "Invitation & offers", purpose: "Turn interest into bookings", topics: ["Trial class invite", "Workshop announcement", "What to expect", "Last few spots"] },
    ],
    palette: [{ name: "Bone", hex: "#F3F1E9", use: "backgrounds" }, { name: "Deep green", hex: "#3E5040", use: "primary" }, { name: "Sand", hex: "#D8C7AC", use: "warm neutral" }, { name: "Ink", hex: "#20231F", use: "text" }],
    hashtags: ["#yogakochi", "#mindfulmovement", "#wellnesscommunity", "#beginneryoga", "#movementdaily"],
    typography: "Rounded humanist sans, low-contrast colours, airy layouts and clear, calm hierarchy.",
  },
  fashion: {
    match: /fashion|clothing|apparel|jewel|boutique|textile|saree|accessor|handmade|craft/i,
    label: "Fashion, jewellery & craft",
    pillars: [
      { name: "The piece", purpose: "Show product detail", topics: ["Detail close-up", "How it's made", "Styling one piece three ways", "New drop"] },
      { name: "The maker", purpose: "Differentiate from mass market", topics: ["Studio process", "Artisan story", "Material sourcing", "Founder note"] },
      { name: "Style & story", purpose: "Inspire and get saved", topics: ["Lookbook reel", "Occasion edit", "Colour pairing", "Customer styling"] },
      { name: "Proof & purchase", purpose: "Convert", topics: ["Review card", "Restock alert", "Size / care guide", "Shop the edit"] },
    ],
    palette: [{ name: "Ivory", hex: "#F6F3EE", use: "backgrounds" }, { name: "Ink", hex: "#0D0D0F", use: "text" }, { name: "Oxblood", hex: "#7A3B3B", use: "accent" }, { name: "Gold", hex: "#B08D57", use: "jewellery highlight" }],
    hashtags: ["#slowfashion", "#handmadeinindia", "#wearcraft", "#boutiquefinds", "#stylingnotes"],
    typography: "Editorial serif headlines, generous white space, thin rules and uppercase micro-labels.",
  },
  tech: {
    match: /tech|saas|startup|app|software|agency|consult|finance|education|course|studio/i,
    label: "Tech, services & education",
    pillars: [
      { name: "Explain the value", purpose: "Make the offer legible", topics: ["One problem we solve", "How it works in 3 steps", "Feature → benefit card", "Who it's for"] },
      { name: "Proof & credibility", purpose: "De-risk the decision", topics: ["Client result", "Process walkthrough", "Founder insight", "Behind the build"] },
      { name: "Teach something", purpose: "Earn attention and saves", topics: ["Quick framework", "Checklist", "Myth vs fact", "Common mistake"] },
      { name: "Invitation", purpose: "Generate qualified enquiries", topics: ["Book a call", "What a first month looks like", "FAQ card", "Open slots"] },
    ],
    palette: [{ name: "Ink", hex: "#101014", use: "primary" }, { name: "Paper", hex: "#F5F5F2", use: "backgrounds" }, { name: "Electric", hex: "#5B6CFF", use: "accent" }, { name: "Slate", hex: "#8A8F98", use: "secondary text" }],
    hashtags: ["#buildinpublic", "#smallbusinessindia", "#designthinking", "#startupstory", "#servicebasedbusiness"],
    typography: "A precise neo-grotesk sans, tight headline tracking and a strict 8-point spacing grid.",
  },
};

const DEFAULT_PROFILE = {
  label: "Independent brand",
  pillars: [
    { name: "What we do", purpose: "Make the offer instantly clear", topics: ["The core offer", "A day in the work", "How to get started", "Frequently asked question"] },
    { name: "Why it matters", purpose: "Connect with the audience's problem", topics: ["A common frustration", "Before / after", "A belief we hold", "Myth vs fact"] },
    { name: "Proof & people", purpose: "Build trust", topics: ["Client story", "Review card", "Behind the scenes", "Milestone"] },
    { name: "Invitation", purpose: "Convert attention into enquiries", topics: ["Work with us", "What's included", "Limited availability", "Simple next step"] },
  ],
  palette: [{ name: "Ivory", hex: "#F6F3EE", use: "backgrounds" }, { name: "Ink", hex: "#0D0D0F", use: "text" }, { name: "Brass", hex: "#B08D57", use: "accent" }, { name: "Stone", hex: "#D9D3C9", use: "dividers" }],
  hashtags: ["#independentbrand", "#smallbusiness", "#madewithintent", "#supportlocal", "#brandstory"],
  typography: "A characterful display serif for headlines with a neutral sans for body copy; generous margins.",
};

const GOAL_METRICS = {
  "Get more enquiries / leads": { metric: "Profile-link clicks + DM enquiries per month", objective: "Turn the profile into a clear enquiry path" },
  "Increase product sales": { metric: "Product-page visits and attributed orders", objective: "Make the offer easy to understand and act on" },
  "Grow an engaged following": { metric: "Saves, shares and follower growth rate", objective: "Earn attention with saveable, shareable content" },
  "Launch a new brand or product": { metric: "Launch-week reach, waitlist signups and first orders", objective: "Build a coherent launch identity and content runway" },
  "Look more professional": { metric: "Consistency of visual assets and brand recall in DMs", objective: "Establish a recognisable, repeatable visual language" },
  "Post consistently": { metric: "Posts published per month against the calendar", objective: "Create a realistic, repeatable publishing rhythm" },
  "Rebrand / refresh visuals": { metric: "Assets migrated to the new system", objective: "Define and roll out a refreshed identity" },
  "Save time on content": { metric: "Hours spent per week on content", objective: "Systemise templates, captions and planning" },
};

const MOOD_MAP = {
  "Warm & editorial": { mood: "Warm, editorial and human — photography-led with quiet typography", layout: "Use wide margins, a single strong image per frame and short serif headlines." },
  "Minimal & calm": { mood: "Minimal, calm and spacious — nothing decorative without a reason", layout: "Stick to a two-colour palette, one type scale and lots of negative space." },
  "Bold & energetic": { mood: "Bold, energetic and high-contrast", layout: "Use oversized type, strong colour blocks and quick-cut reel pacing." },
  "Playful & friendly": { mood: "Playful, approachable and friendly", layout: "Rounded shapes, hand-written accents and conversational captions." },
  "Premium & refined": { mood: "Premium, refined and restrained", layout: "Fine rules, restrained type, subtle texture and deliberate pacing." },
};

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = seed || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (arr, r) => arr[Math.floor(r() * arr.length) % arr.length];
const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : String(value || "").split(",").map((s) => s.trim()).filter(Boolean));

export function profileFor(text = "") {
  return Object.values(INDUSTRY_PROFILES).find((p) => p.match.test(text)) || DEFAULT_PROFILE;
}

export function normaliseAnswers(raw = {}) {
  const a = { ...raw };
  a.goals = list(a.goals);
  a.designNeeds = list(a.designNeeds);
  a.instagramNeeds = list(a.instagramNeeds);
  a.postsPerMonth = Math.max(0, Math.min(60, Number(a.postsPerMonth) || 0));
  a.industry = String(a.industry || "").trim();
  a.brand = String(a.brand || "").trim() || "Your brand";
  a.notes = String(a.notes || "").trim();
  a.styleWords = String(a.styleWords || "").trim();
  a.audience = String(a.audience || "").trim();
  return a;
}

/** Infer structured answers from a free-text enquiry (used by Studio OS). */
export function answersFromEnquiry(lead = {}) {
  const text = [lead.message, lead.company, lead.service].filter(Boolean).join(" ");
  const analysis = analyseEnquiry(text);
  const lower = text.toLowerCase();
  const goals = [];
  if (/launch|opening|new brand|new product/.test(lower)) goals.push("Launch a new brand or product");
  if (/sales|orders|d2c|customers|bookings/.test(lower)) goals.push("Increase product sales");
  if (/leads|enquiries|more clients/.test(lower)) goals.push("Get more enquiries / leads");
  if (/followers|engagement|reach/.test(lower)) goals.push("Grow an engaged following");
  if (/consistent|inconsistent|posting|calendar|monthly/.test(lower)) goals.push("Post consistently");
  if (/rebrand|refresh|professional/.test(lower)) goals.push("Look more professional");
  if (!goals.length) goals.push("Look more professional", "Post consistently");

  const designNeeds = [];
  if (/logo|identity/.test(lower)) designNeeds.push("Logo & brand identity");
  if (/brand kit|guidelines|brand sheet/.test(lower)) designNeeds.push("Brand guidelines / kit");
  if (/template|post design|creatives/.test(lower)) designNeeds.push("Social post templates");
  if (/packaging|label/.test(lower)) designNeeds.push("Packaging & labels");
  if (/poster|flyer|ad /.test(lower)) designNeeds.push("Posters / flyers / ads");
  if (/deck|slides|presentation/.test(lower)) designNeeds.push("Presentation deck");

  const instagramNeeds = ["Content strategy & pillars"];
  if (/calendar|monthly|plan/.test(lower)) instagramNeeds.push("Monthly content calendar");
  if (/caption/.test(lower)) instagramNeeds.push("Caption writing");
  if (/reel/.test(lower)) instagramNeeds.push("Reel concepts");
  if (/story/.test(lower)) instagramNeeds.push("Story templates");
  if (/grid|consisten/.test(lower)) instagramNeeds.push("Grid / visual system");
  if (/analytic|report/.test(lower)) instagramNeeds.push("Monthly analytics review");

  const serviceKey = lead.serviceKey || (analysis.suggestedServices.length > 1 ? "both" : analysis.suggestedServices[0]);
  return normaliseAnswers({
    brand: lead.company || lead.name || "Your brand",
    handle: lead.instagram || "",
    goals,
    services: serviceKey,
    designNeeds: designNeeds.length ? designNeeds : designNeedsFor(serviceKey),
    instagramNeeds,
    postsPerMonth: /12 posts|12 creatives/.test(lower) ? 12 : /8 posts|8 creatives/.test(lower) ? 8 : 12,
    budget: lead.budget || "",
    timeline: lead.timeline || "",
    notes: lead.message || "",
    audience: "",
    tone: "Warm & editorial",
    stage: "Growing",
    industry: profileFor(text).label,
  });
}

function designNeedsFor(serviceKey) {
  if (serviceKey === "design") return ["Logo & brand identity", "Social post templates"];
  if (serviceKey === "instagram") return [];
  return ["Logo & brand identity", "Social post templates"];
}

function budgetToNumber(budget = "") {
  const raw = String(budget).toLowerCase();
  if (/not decided|unsure|flexible/.test(raw)) return 0;
  // Indian numbering and currency symbols: "₹25,000 – ₹60,000" → [25000, 60000].
  const numbers = (raw.replace(/,/g, "").match(/\d{3,7}/g) || []).map(Number);
  if (/under|below|less than|upto|up to/.test(raw)) return 18000;
  if (/lakh|lac/.test(raw)) return 100000;
  if (numbers.length >= 2 && numbers.some((n) => n <= 25000) && numbers.some((n) => n >= 60000)) return 42000;
  const max = Math.max(0, ...numbers);
  if (max >= 60000) return 80000;
  return max;
}

function inferPackage(answers, settings) {
  const packages = settings?.packages || {
    Starter: { min: 12000, max: 25000 },
    Growth: { min: 25000, max: 60000 },
    Signature: { min: 60000, max: 150000 },
  };
  const budget = budgetToNumber(answers.budget);
  const scopePoints = answers.designNeeds.length + answers.instagramNeeds.length + (answers.postsPerMonth > 16 ? 2 : 0);
  let name = "Growth";
  // A stated budget is the strongest signal; scope only decides when the
  // client hasn't given one (or when the scope is genuinely very large).
  if (budget >= 60000) name = "Signature";
  else if (budget >= 25000) name = scopePoints >= 9 ? "Signature" : "Growth";
  else if (budget > 0) name = "Starter";
  else if (scopePoints >= 9 || (answers.services === "both" && answers.postsPerMonth >= 16)) name = "Signature";
  else if (scopePoints <= 4 || answers.services === "unsure") name = "Starter";
  if (answers.timeline === "Exploring" && name === "Signature") name = "Growth";
  return { name, ...packages[name] };
}

function buildDeliverables(answers, services) {
  const out = [];
  const posts = answers.postsPerMonth || 12;
  if (services.design) {
    const quantityMap = {
      "Logo & brand identity": "1 primary + 1 secondary mark",
      "Brand guidelines / kit": "1 brand guide (12–20 pages)",
      "Social post templates": `${Math.max(4, Math.min(12, Math.round(posts / 2)))} editable templates`,
      "Packaging & labels": "Up to 6 label / pack layouts",
      "Posters / flyers / ads": "4 campaign creatives",
      "Presentation deck": "Up to 20 slide designs",
    };
    const defaults = ["Logo & brand identity", "Social post templates"];
    const needs = answers.designNeeds.length ? answers.designNeeds : defaults;
    for (const need of needs) out.push({ name: need, quantity: quantityMap[need] || "1 concept set", detail: "Two review rounds included; final files supplied in editable + export formats." });
  }
  if (services.instagram) {
    out.push({ name: "Creative brief & content pillars", quantity: "1 document", detail: "Positioning, audience, pillars, tone of voice and visual rules." });
    out.push({ name: "Monthly content calendar", quantity: `${posts} posts / month`, detail: "Week-by-week plan with format, pillar, hook, caption direction and CTA." });
    if (answers.instagramNeeds.includes("Reel concepts")) out.push({ name: "Reel concepts", quantity: `${Math.max(2, Math.round(posts / 4))} / month`, detail: "Shot list, hook, on-screen text and edit direction." });
    if (answers.instagramNeeds.includes("Caption writing")) out.push({ name: "Caption writing", quantity: `${posts} captions / month`, detail: "Hook, body, CTA and hashtag set per post." });
    if (answers.instagramNeeds.includes("Story templates")) out.push({ name: "Story templates", quantity: "6 editable frames", detail: "Announcement, poll, testimonial, offer, behind-the-scenes and link frames." });
    if (answers.instagramNeeds.includes("Monthly analytics review")) out.push({ name: "Monthly analytics review", quantity: "1 report / month", detail: "Reach, saves, shares, profile actions and next-month recommendations." });
  }
  return out;
}

function buildCalendar(answers, profile, services, random) {
  if (!services.instagram) return [];
  const postsPerMonth = answers.postsPerMonth || 12;
  const perWeek = Math.max(1, Math.min(7, Math.round(postsPerMonth / 4)));
  const days = ["Tue", "Thu", "Sat", "Mon", "Wed", "Fri", "Sun"];
  const formats = ["Carousel", "Reel", "Single graphic", "Story set", "Carousel", "Reel", "Single graphic"];
  const ctas = ["Save this for later", "DM us for the details", "Tell us which one you'd try", "Link in bio to book", "Share with someone who'd love this", "Comment your favourite"];
  const themes = ["Establish the offer", "Build trust with proof", "Go deeper with education", "Invite action"];
  const pillars = profile.pillars;
  const calendar = [];
  for (let week = 0; week < 4; week += 1) {
    const posts = [];
    for (let i = 0; i < perWeek; i += 1) {
      const pillar = pillars[(week + i) % pillars.length];
      const topic = pick(pillar.topics, random);
      const format = formats[(week * 3 + i) % formats.length];
      posts.push({
        day: days[(i + week) % days.length],
        format,
        pillar: pillar.name,
        hook: `${topic} — ${pick(["here's the part nobody shows", "a closer look", "in three simple steps", "what we learned", "start here"], random)}`,
        captionStarter: `${topic}. ${pick(["Most people assume it's complicated.", "This is the question we get most often.", "A small detail makes a big difference here.", "Here's how we think about it."], random)}`,
        cta: pick(ctas, random),
        designNote: `${format === "Reel" ? "6–12s, text-safe margins, 3 cuts max" : "Template-led, one hero visual, short serif headline"}; ${answers.tone || "warm"} tone.`,
      });
    }
    calendar.push({ week: week + 1, theme: themes[week], posts });
  }
  return calendar;
}

function buildEstimate(answers, pkg, services) {
  const min = pkg.min || 25000;
  const max = pkg.max || 60000;
  const breakdown = [];
  const addOn = (label, value) => breakdown.push({ label, value });
  const designShare = services.design && services.instagram ? 0.45 : services.design ? 0.8 : 0;
  if (designShare) addOn("Design scope & identity system", Math.round(min * designShare));
  if (services.instagram) addOn("Instagram strategy + monthly content system", Math.round(min * (1 - designShare)));
  if (answers.postsPerMonth > 16) addOn("High-volume content production", Math.round(min * 0.15));
  if (answers.instagramNeeds.includes("Monthly analytics review")) addOn("Monthly reporting", Math.round(min * 0.1));
  return { currency: "INR", min, max, setup: min, retainerNote: services.instagram ? `Ongoing monthly curation from ₹${Math.round(min * 0.55).toLocaleString("en-IN")}/month after the first month.` : "One-time project fee; ongoing design support can be quoted separately." , breakdown };
}

export function generateBrief(rawAnswers = {}, options = {}) {
  const answers = normaliseAnswers(rawAnswers);
  const settings = options.settings || {};
  const random = rng(hashString(JSON.stringify(answers)));
  const freeText = [answers.notes, answers.brand, answers.industry, answers.styleWords, answers.audience].join(" ");
  const profile = profileFor(freeText);
  const analysis = analyseEnquiry(freeText);
  const keywords = extractKeywords(freeText, 8);

  let serviceKey = answers.services || "both";
  if (serviceKey === "unsure" || !["design", "instagram", "both"].includes(serviceKey)) {
    serviceKey = analysis.suggestedServices.length > 1 ? "both" : analysis.suggestedServices[0] || "both";
  }
  const services = {
    design: serviceKey === "design" || serviceKey === "both",
    instagram: serviceKey === "instagram" || serviceKey === "both",
    key: serviceKey,
    label: serviceKey === "both" ? "Graphic Design + Instagram Curation" : serviceKey === "design" ? "Graphic Design" : "Instagram Curation",
  };

  const goals = answers.goals.length ? answers.goals : ["Look more professional", "Post consistently"];
  const objectives = goals.slice(0, 4).map((g) => ({
    title: GOAL_METRICS[g]?.objective || g,
    goal: g,
    metric: GOAL_METRICS[g]?.metric || "Reviewed monthly against the content report",
  }));

  const pkg = inferPackage(answers, settings);
  const mood = MOOD_MAP[answers.tone] || MOOD_MAP["Warm & editorial"];
  const deliverables = buildDeliverables(answers, services);
  const calendar = buildCalendar(answers, profile, services, random);
  const estimate = buildEstimate(answers, pkg, services);
  const pillars = profile.pillars.slice(0, 4).map((p, i) => ({
    name: p.name,
    purpose: p.purpose,
    share: `${[35, 25, 25, 15][i]}%`,
    exampleTopics: p.topics,
  }));

  const clarifyingQuestions = [
    `Which three brands or Instagram pages feel closest to the direction you want${answers.competitors ? ` (besides ${answers.competitors})` : ""}?`,
    `Do you have existing photography, or should the plan include a shot list for a phone shoot?`,
    `Who signs off on designs, and how many review rounds work for your team?`,
    `What is the single offer or product you most want enquiries for this quarter?`,
  ];
  if (services.design) clarifyingQuestions.push("Are there existing logo/brand files we should work from, and in which formats?");
  if (services.instagram) clarifyingQuestions.push("Should we publish on your behalf, or hand over a ready-to-post calendar and assets?");

  const assumptions = [
    `${answers.postsPerMonth || 12} feed posts per month${services.instagram ? "" : " (design-only scope)"}.`,
    "Client supplies brand facts, product photography and timely feedback within 3 working days.",
    "Two rounds of revisions per design deliverable; additional rounds quoted separately.",
    "Estimate excludes paid ads, printing, stock assets and third-party subscriptions.",
  ];

  const timeline = [
    { phase: "Discover", duration: "Week 1", outcome: "Kick-off, references, audience and offer agreed" },
    { phase: "Define", duration: services.design ? "Week 1–2" : "Week 1", outcome: "Creative direction, pillars and visual rules signed off" },
    { phase: "Design", duration: services.design ? "Week 2–4" : "Week 2–3", outcome: "First concepts and full content calendar delivered" },
    { phase: "Deliver", duration: "Week 4", outcome: "Final files, templates and a 30-day action plan handed over" },
  ];

  const confidence = Math.min(0.96, 0.62 + Math.min(0.12, keywords.length * 0.015) + (answers.audience ? 0.07 : 0) + (answers.budget && answers.budget !== "Not decided yet" ? 0.07 : 0) + (answers.goals.length ? 0.06 : 0));

  const brief = {
    engine: options.engine || "klyro-local-v1",
    generatedAt: new Date().toISOString(),
    title: `Creative requirements — ${answers.brand}`,
    confidence: Number(confidence.toFixed(2)),
    clientSnapshot: {
      brand: answers.brand, industry: answers.industry || profile.label, handle: answers.handle || "",
      website: answers.website || "", location: answers.location || "", stage: answers.stage || "Growing",
      audience: answers.audience || "Not specified yet", tone: answers.tone || "Warm & editorial",
      budget: answers.budget || "Not decided yet", timeline: answers.timeline || "Flexible",
      postsPerMonth: answers.postsPerMonth || 12,
    },
    detectedSignals: {
      keywords,
      primaryIntent: analysis.primaryIntent,
      intents: analysis.intents,
      inferredServices: serviceKey,
      industryProfile: profile.label,
      goals,
      styleWords: answers.styleWords || "not specified",
      avoid: answers.colorsAvoid || "none specified",
    },
    summary: `${answers.brand} is a ${answers.stage || "growing"} ${profile.label.toLowerCase()} brand looking to ${goals[0].toLowerCase()}${goals[1] ? ` and ${goals[1].toLowerCase()}` : ""}. The recommended scope is ${services.label.toLowerCase()} with ${deliverables.length} deliverable groups, built around a ${mood.mood.toLowerCase()} direction. This brief converts those signals into an actionable requirement list you can approve or edit before any design work begins.`,
    objectives,
    services,
    recommendedPackage: { name: pkg.name, range: `₹${pkg.min.toLocaleString("en-IN")} – ₹${pkg.max.toLocaleString("en-IN")}`, why: `Chosen from ${answers.budget || "the stated scope"}, ${deliverables.length} deliverable groups and ${answers.postsPerMonth || 12} posts/month.` },
    scope: {
      included: deliverables.map((d) => d.name),
      excluded: ["Paid advertising spend", "Printing / production", "Stock photography licences", "Website development", "Community management & DM replies"],
    },
    deliverables,
    designDirection: {
      mood: mood.mood,
      styleNotes: answers.styleWords || "Clean, intentional and easy to recognise at thumbnail size.",
      palette: profile.palette,
      typography: profile.typography,
      layoutRules: [mood.layout, "Keep a 8–12% safe margin for all social exports.", "One message per frame; supporting text stays under 12 words.", "Use the accent colour only for emphasis and calls to action."],
      assetList: services.design ? ["Primary + secondary logo", "Colour + type tokens", "Editable template pack (Canva/Figma)", "Export presets for feed, story and reel cover"] : ["Grid reference board", "Type + colour rules", "Editable story frames"],
    },
    contentPillars: services.instagram ? pillars : [],
    calendar,
    hashtagSets: services.instagram ? [
      { name: "Local / community", tags: profile.hashtags.slice(0, 3) },
      { name: "Niche / discovery", tags: profile.hashtags.slice(2) },
      { name: "Brand-owned", tags: [`#${String(answers.brand).toLowerCase().replace(/[^a-z0-9]/g, "")}`, `#${String(answers.brand).toLowerCase().replace(/[^a-z0-9]/g, "")}studio`] },
    ] : [],
    clarifyingQuestions,
    assumptions,
    timeline,
    estimate,
    nextSteps: [
      "Review this brief and correct anything that feels off.",
      "Share references, photography and access to the Instagram account.",
      "Approve the scope and estimate to start the Discover week.",
    ],
    missingInfo: [
      ...(!answers.audience ? ["A description of the ideal customer"] : []),
      ...(!answers.handle ? ["Instagram handle for an audit"] : []),
      ...(!answers.budget || answers.budget === "Not decided yet" ? ["A budget range"] : []),
    ],
  };
  return brief;
}

export function briefToMarkdown(brief) {
  if (!brief) return "";
  const lines = [
    `# ${brief.title}`,
    "",
    `_Generated by ${brief.engine} · ${new Date(brief.generatedAt).toLocaleString("en-IN")} · confidence ${Math.round(brief.confidence * 100)}%_`,
    "",
    "## Summary",
    brief.summary,
    "",
    "## Client snapshot",
    ...Object.entries(brief.clientSnapshot).map(([k, v]) => `- **${k}**: ${v || "—"}`),
    "",
    "## Objectives",
    ...brief.objectives.map((o) => `- **${o.goal}** → ${o.title}. Measure: ${o.metric}.`),
    "",
    "## Recommended package",
    `${brief.recommendedPackage.name} — ${brief.recommendedPackage.range}. ${brief.recommendedPackage.why}`,
    "",
    "## Deliverables",
    ...brief.deliverables.map((d) => `- **${d.name}** (${d.quantity}) — ${d.detail}`),
    "",
    "## Design direction",
    `- Mood: ${brief.designDirection.mood}`,
    `- Type: ${brief.designDirection.typography}`,
    `- Palette: ${brief.designDirection.palette.map((p) => `${p.name} ${p.hex}`).join(", ")}`,
    ...brief.designDirection.layoutRules.map((r) => `- ${r}`),
    "",
  ];
  if (brief.contentPillars.length) {
    lines.push("## Content pillars", ...brief.contentPillars.map((p) => `- **${p.name}** (${p.share}) — ${p.purpose}. Topics: ${p.exampleTopics.join("; ")}.`), "");
  }
  if (brief.calendar.length) {
    lines.push("## 4-week content calendar");
    for (const week of brief.calendar) {
      lines.push("", `### Week ${week.week} — ${week.theme}`);
      for (const p of week.posts) lines.push(`- **${p.day} · ${p.format} · ${p.pillar}** — ${p.hook} | ${p.captionStarter} | CTA: ${p.cta}`);
      lines.push("");
    }
  }
  lines.push(
    "## Timeline",
    ...brief.timeline.map((t) => `- **${t.phase}** (${t.duration}): ${t.outcome}`),
    "",
    "## Estimate",
    `₹${brief.estimate.min.toLocaleString("en-IN")} – ₹${brief.estimate.max.toLocaleString("en-IN")} (${brief.estimate.currency}). ${brief.estimate.retainerNote}`,
    ...brief.estimate.breakdown.map((b) => `- ${b.label}: ₹${b.value.toLocaleString("en-IN")}`),
    "",
    "## Questions before we start",
    ...brief.clarifyingQuestions.map((q) => `- ${q}`),
    "",
    "## Assumptions",
    ...brief.assumptions.map((a) => `- ${a}`),
    "",
  );
  return lines.join("\n");
}
