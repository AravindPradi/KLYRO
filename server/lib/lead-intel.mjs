/**
 * Lead intelligence: transparent, local inference over enquiry text.
 *
 * No external model or API key is required. Everything here is deterministic
 * and explainable — every score comes with human-readable reasons, which is
 * important when a freelancer has to decide who to reply to first.
 * An optional LLM adapter can be layered on top (see server/lib/llm.mjs).
 */

const STOPWORDS = new Set(
  `a an and are as at be been but by can could do does for from had has have he her his how i if in is it its just me my no not of on or our she so than that the their them then there these they this to us was we were what when where which who why will with would you your about need want looking like please also more get got am hi hey hello thanks thank let know some any very really much one two 3 4 5 6 8 9 10 k`.split(" "),
);

const INTENT_LEXICON = {
  brand_identity: {
    label: "Brand identity / rebrand",
    terms: ["logo", "brand", "identity", "rebrand", "palette", "guidelines", "brandkit", "visual", "typography", "stationery"],
  },
  launch: {
    label: "Launch campaign",
    terms: ["launch", "launching", "opening", "new", "startup", "prelaunch", "release", "debut", "introducing"],
  },
  instagram_growth: {
    label: "Instagram growth & consistency",
    terms: ["instagram", "grid", "followers", "engagement", "reach", "consistent", "inconsistent", "content", "reels", "stories", "posting", "calendar", "strategy", "curation"],
  },
  sales: {
    label: "Leads & sales",
    terms: ["sales", "leads", "enquiries", "customers", "conversion", "bookings", "orders", "revenue", "d2c"],
  },
  production: {
    label: "Ongoing design production",
    terms: ["monthly", "retainer", "templates", "posts", "creatives", "packaging", "labels", "poster", "deck", "brochure", "slides"],
  },
  direction: {
    label: "Creative direction / clarity",
    terms: ["moodboard", "direction", "style", "professional", "clarity", "refresh", "look", "feel", "aesthetic"],
  },
};

const URGENT_TERMS = ["urgent", "asap", "immediately", "this week", "next week", "3 weeks", "few days", "deadline", "launch is", "soon"];
const BUDGET_TERMS = ["budget", "approved", "₹", "rs", "inr", "quoted", "pricing", "price", "charge", "cost", "k", "lakh"];
const RISK_TERMS = ["just checking", "how much", "cheapest", "free", "sample work", "just a few"];
const FREE_MAIL = ["gmail.com", "yahoo.", "outlook.com", "hotmail.com", "proton.me", "protonmail.", "icloud.com", "rediffmail.com"];

export function tokenize(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9₹@.\-\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

export function extractKeywords(text = "", limit = 8) {
  const counts = new Map();
  for (const word of tokenize(text)) {
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

export function analyseEnquiry(message = "", extra = {}) {
  const text = String(message || "");
  const lower = text.toLowerCase();
  const words = tokenize(text);
  const bag = new Set(words);

  const intents = Object.entries(INTENT_LEXICON)
    .map(([key, def]) => {
      const hits = def.terms.filter((t) => bag.has(t) || lower.includes(t));
      return { key, label: def.label, confidence: Math.min(0.98, hits.length * 0.24), hits };
    })
    .filter((i) => i.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence);

  const keywords = extractKeywords(text, 7);
  const urgent = URGENT_TERMS.some((t) => lower.includes(t));
  const budgetMentioned = BUDGET_TERMS.some((t) => lower.includes(t)) || /\b\d{4,6}\b/.test(lower);
  const risk = RISK_TERMS.filter((t) => lower.includes(t));
  const wordCount = words.length;

  const suggestedServices = [];
  if (intents.some((i) => ["brand_identity", "production", "direction"].includes(i.key))) suggestedServices.push("design");
  if (intents.some((i) => ["instagram_growth", "launch", "sales"].includes(i.key))) suggestedServices.push("instagram");
  if (!suggestedServices.length) suggestedServices.push("design");

  const missingInfo = [];
  if (!budgetMentioned) missingInfo.push("An indicative budget or range");
  if (!urgent && !/timeline|week|month|deadline|start|date/i.test(lower)) missingInfo.push("Preferred start date or deadline");
  if (!/instagram|@|handle|website|http/i.test(lower)) missingInfo.push("Instagram handle or website to review");
  if (!/logo|posts|reels|packaging|identity|calendar|deliverable|need \d|per month/i.test(lower)) missingInfo.push("Which deliverables matter most");
  if (!/audience|customer|client|who|target/i.test(lower)) missingInfo.push("Who the ideal customer is");

  const summaryBits = [];
  if (intents[0]) summaryBits.push(intents[0].label.toLowerCase());
  if (urgent) summaryBits.push("time-sensitive");
  if (budgetMentioned) summaryBits.push("budget signalled");

  return {
    primaryIntent: intents[0]?.label || "General creative enquiry",
    intents: intents.slice(0, 3).map(({ key, label, confidence }) => ({ key, label, confidence: Number(confidence.toFixed(2)) })),
    keywords,
    urgency: urgent ? "high" : /month|soon|flexible|exploring/i.test(lower) ? "medium" : "low",
    budgetMentioned,
    riskSignals: risk,
    wordCount,
    suggestedServices,
    missingInfo: missingInfo.slice(0, 4),
    summary: summaryBits.length
      ? `Enquiry reads as ${summaryBits.join(", ")}.`
      : "Short enquiry; needs a discovery reply before a quote.",
  };
}

export function scoreLead(lead = {}) {
  const reasons = [];
  let score = 12;
  const add = (points, reason) => {
    score += points;
    reasons.push({ points, reason });
  };
  const message = String(lead.message || "");
  const analysis = lead.analysis || analyseEnquiry(message);
  const email = String(lead.email || "").toLowerCase();

  if (lead.budget || analysis.budgetMentioned) add(18, "Budget or price expectation mentioned");
  const moneyText = `${lead.budget} ${message}`.replace(/,/g, "");
  if (/60000\s*\+|1\s*lakh|retainer|above\s*₹?\s*60000|approved at ₹?\s*[6-9]\d{4}|approved at ₹?\s*[1-9]\d{5}/i.test(moneyText)) add(6, "Higher-value / retainer scope signalled");
  if (/within 1 month|urgent|asap|this week|3 weeks|next month/i.test(`${lead.timeline} ${message}`)) add(13, "Near-term timeline");
  if (analysis.urgency === "high") add(5, "Urgency language detected");
  if (lead.company) add(8, "Named business / company");
  if (email && !FREE_MAIL.some((d) => email.endsWith(d))) add(8, "Business email domain");
  if (lead.instagram) add(6, "Instagram handle provided");
  if (lead.serviceKey === "both") add(8, "Interested in both services");
  else if (lead.serviceKey && lead.serviceKey !== "unsure") add(4, "Specific service selected");
  if (analysis.wordCount >= 35) add(10, "Detailed brief provided");
  else if (analysis.wordCount >= 14) add(5, "Some project context provided");
  if (analysis.keywords.length >= 4) add(5, "Clear topical signals in message");
  if (lead.source === "brief-studio") add(12, "Completed AI brief studio (high intent)");
  for (const signal of analysis.riskSignals || []) add(-7, `Low-commitment phrase: "${signal}"`);
  if (analysis.wordCount < 8) add(-6, "Very short message");
  if (lead.serviceKey === "unsure") add(-3, "Service not yet chosen");

  score = Math.max(5, Math.min(100, Math.round(score)));
  return {
    score,
    grade: score >= 72 ? "hot" : score >= 45 ? "warm" : "cool",
    reasons: reasons.sort((a, b) => b.points - a.points),
  };
}

export function buildAutoReply(lead = {}, settings = {}) {
  const analysis = lead.analysis || analyseEnquiry(lead.message);
  const firstName = String(lead.name || "there").trim().split(" ")[0];
  const studio = settings.studioName || "KLYRO Creative Studio";
  const owner = settings.ownerEmail || "";
  const service = lead.service && lead.service !== "Not Sure Yet" ? lead.service : "graphic design and Instagram curation";
  const questions = analysis.missingInfo.slice(0, 3);

  const subject = `We've received your project enquiry — ${lead.reference || "KLYRO"}`;
  const body = [
    `Hi ${firstName},`,
    "",
    `Thank you for reaching out to ${studio}. Your enquiry about ${service.toLowerCase()} is with us (ref: ${lead.reference || "—"}).`,
    "",
    analysis.summary,
    "",
    "Here's what happens next:",
    `1. We review your note and any references you've shared.`,
    `2. We reply with a tailored brief, a recommended scope and an estimate within ${settings.responseSlaHours || 24} hours.`,
    "3. If it feels like a fit, we book a short 20-minute discovery call.",
    "",
    questions.length ? "To make our first reply as useful as possible, could you share:" : "One quick question before we reply:",
    ...questions.map((q, i) => `   ${i + 1}. ${q}`),
    "",
    "If it's easier, just reply with a link to your Instagram or a couple of brands you admire.",
    "",
    "Looking forward to it,",
    `${studio}${owner ? `\n${owner}` : ""}`,
  ].join("\n");

  return { subject, body, channel: "Email" };
}

export function buildFollowUps(lead = {}, settings = {}) {
  const days = settings.followUpDays || [1, 3, 7];
  const firstName = String(lead.name || "there").trim().split(" ")[0];
  const labels = ["Gentle nudge", "Value follow-up", "Final check-in"];
  const bodies = [
    `Hi ${firstName},\n\nJust floating this back to the top of your inbox. Happy to put together a short scope and estimate for ${String(lead.service || "your project").toLowerCase()} whenever you're ready — a one-line reply is enough.\n\n— ${settings.studioName || "KLYRO"}`,
    `Hi ${firstName},\n\nOne idea while you decide: we usually start with a one-page creative brief (content pillars + visual direction) so the scope and price are clear before anything is designed. Want me to draft one for your brand? No commitment needed.\n\n— ${settings.studioName || "KLYRO"}`,
    `Hi ${firstName},\n\nI'll close the loop here so I'm not cluttering your inbox. If the timing changes, the door's open — just reply to this message and we'll pick it up.\n\n— ${settings.studioName || "KLYRO"}`,
  ];
  return days.map((day, i) => ({
    id: `fup_${lead.id || "new"}_${day}`,
    type: labels[i] || `Follow-up ${i + 1}`,
    channel: "Email",
    dayOffset: day,
    message: bodies[i] || bodies[bodies.length - 1],
  }));
}
