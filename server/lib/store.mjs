import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreLead, analyseEnquiry } from "./lead-intel.mjs";
import { scoreProspect } from "./prospect-intel.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = path.join(root, "data");
const dataFile = process.env.KLYRO_DATA_FILE || path.join(dataDir, "klyro.json");

export const DEFAULT_SETTINGS = {
  studioName: "KLYRO Creative Studio",
  ownerEmail: "technologiiaa@proton.me",
  currency: "INR",
  responseSlaHours: 24,
  webhookUrl: "",
  autoReplyEnabled: true,
  followUpDays: [1, 3, 7],
  packages: {
    Starter: { min: 12000, max: 25000, label: "Starter" },
    Growth: { min: 25000, max: 60000, label: "Growth" },
    Signature: { min: 60000, max: 150000, label: "Signature" },
  },
};

export function uid(prefix = "id") {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

export function token() {
  return randomBytes(12).toString("base64url");
}

export function reference() {
  const d = new Date();
  const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `KLY-${stamp}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

export function now() {
  return new Date().toISOString();
}

function daysAgo(days, hour = 10) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

function daysAhead(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(9, 0, 0, 0);
  return d.toISOString();
}

function emptyState() {
  return {
    version: 1,
    createdAt: now(),
    settings: structuredClone(DEFAULT_SETTINGS),
    enquiries: [],
    briefs: [],
    proposals: [],
    prospects: [],
    campaigns: [],
    followups: [],
    activity: [],
  };
}

/* ------------------------------------------------------------------ *
 * Demo data. Clearly flagged with `demo: true` so it can be removed in
 * one click from Studio > Settings before the system goes live.
 * ------------------------------------------------------------------ */
const DEMO_ENQUIRIES = [
  {
    name: "Ananya Menon", email: "ananya@lumierecafe.in", company: "Lumière Café",
    instagram: "@lumierecafe", service: "Both Services",
    message: "We are opening a second café in Kochi next month and need a full visual identity plus someone to curate our Instagram. Budget around ₹45,000. Need to start urgently — launch is in 3 weeks.",
    budget: "₹25,000 – ₹60,000", timeline: "Within 1 month", source: "contact-form", status: "proposal", days: 1,
  },
  {
    name: "Rahul Nair", email: "rahul.nair@gmail.com", company: "Nair & Co Interiors",
    instagram: "@nairandco", service: "Instagram Content Strategy",
    message: "Our Instagram has been inconsistent for months. We want a proper content plan and monthly post designs, mostly reels and before/after carousels. Not sure about budget yet.",
    budget: "", timeline: "1–3 months", source: "contact-form", status: "qualified", days: 3,
  },
  {
    name: "Sneha Thomas", email: "sneha@theslowstudio.co", company: "The Slow Studio",
    instagram: "@theslowstudio", service: "Graphic Design",
    message: "Looking for a rebrand: logo, colour palette, brand guidelines and a set of social templates for our ceramics studio. We have a clear moodboard already. Budget ₹30k.",
    budget: "₹25,000 – ₹60,000", timeline: "Within 1 month", source: "brief-studio", status: "won", days: 6,
  },
  {
    name: "Faisal K", email: "faisal.k.v@gmail.com", company: "Kochi Cycle Co.",
    instagram: "@kochicycleco", service: "Not Sure Yet",
    message: "Hi, just checking what you charge for a few posters.",
    budget: "", timeline: "Flexible", source: "contact-form", status: "lost", days: 9,
  },
  {
    name: "Meera Pillai", email: "meera@ayurvedabymeera.com", company: "Ayurveda by Meera",
    instagram: "@ayurvedaby_meera", service: "Both Services",
    message: "Launching a D2C skincare line in January. Need packaging design, a brand kit and a 3 month Instagram content calendar with 12 posts a month. Budget is approved at ₹80,000.",
    budget: "₹60,000+", timeline: "1–3 months", source: "brief-studio", status: "proposal", days: 4,
  },
  {
    name: "Devika S", email: "devika.s@outlook.com", company: "Studio Devika",
    instagram: "@studiodevika", service: "Graphic Design",
    message: "Need 8 Instagram post creatives per month for my boutique. Long-term collaboration if the style matches. Please share samples and pricing.",
    budget: "Under ₹25,000", timeline: "Flexible", source: "contact-form", status: "contacted", days: 7,
  },
  {
    name: "Arjun Krishnan", email: "arjun@fortkochifitness.com", company: "Fort Kochi Fitness",
    instagram: "@fortkochifitness", service: "Instagram Content Strategy",
    message: "We want more enquiries from Instagram. Need content pillars, reel ideas and a monthly calendar. Currently posting twice a week with no strategy.",
    budget: "₹25,000 – ₹60,000", timeline: "Within 1 month", source: "brief-studio", status: "new", days: 0,
  },
  {
    name: "Priya George", email: "priya@northline.co.in", company: "Northline Architects",
    instagram: "@northlinearchitects", service: "Graphic Design",
    message: "Proposal deck design and a refreshed visual identity for an architecture firm. 20 slides, print + digital. Timeline 6 weeks.",
    budget: "₹60,000+", timeline: "1–3 months", source: "contact-form", status: "qualified", days: 12,
  },
  {
    name: "Nikhil R", email: "nikhil.rao@gmail.com", company: "Chai & Chapters",
    instagram: "@chaiandchapters", service: "Both Services",
    message: "New bookstore cafe. Would love help with the look and feel and a launch campaign on Instagram. Still exploring, no fixed budget.",
    budget: "", timeline: "Exploring", source: "contact-form", status: "contacted", days: 14,
  },
  {
    name: "Lakshmi Iyer", email: "lakshmi@shantiyoga.in", company: "Shanti Yoga",
    instagram: "@shantiyoga_kochi", service: "Instagram Content Strategy",
    message: "Need a consistent grid and story templates for our yoga studio, plus captions. We post daily but engagement is flat.",
    budget: "Under ₹25,000", timeline: "Within 1 month", source: "brief-studio", status: "won", days: 18,
  },
  {
    name: "Tobias Varghese", email: "tobias@malabarroasters.com", company: "Malabar Roasters",
    instagram: "@malabar_roasters", service: "Graphic Design",
    message: "Packaging labels for 6 coffee variants and a brand sheet. Need source files. Budget ₹35,000, start next month.",
    budget: "₹25,000 – ₹60,000", timeline: "1–3 months", source: "contact-form", status: "proposal", days: 21,
  },
  {
    name: "Hana Yusuf", email: "hana.yusuf@gmail.com", company: "Hana Handmade",
    instagram: "@hanahandmade", service: "Not Sure Yet",
    message: "I make handmade jewellery and want my page to look more professional. Help?",
    budget: "", timeline: "Flexible", source: "contact-form", status: "new", days: 0,
  },
  {
    name: "Roshan Mathew", email: "roshan@palmgrovehostels.com", company: "Palm Grove Hostels",
    instagram: "@palmgrovehostels", service: "Instagram Content Strategy",
    message: "Three properties, one page. Need a content system with reels, guest stories and seasonal offers. Monthly retainer possible.",
    budget: "₹60,000+", timeline: "Within 1 month", source: "brief-studio", status: "qualified", days: 25,
  },
  {
    name: "Aishwarya R", email: "aishwarya@petalspune.in", company: "Petals Floristry",
    instagram: "@petals_floristry", service: "Graphic Design",
    message: "Logo refresh and price-list design. Small scope, quick turnaround.",
    budget: "Under ₹25,000", timeline: "Within 1 month", source: "contact-form", status: "lost", days: 28,
  },
];

const DEMO_PROSPECTS = [
  { name: "Independent café in Fort Kochi", niche: "Café / F&B", city: "Kochi, Kerala", instagram: "", website: "", followers: 2400, postsPerWeek: 1, lastPostDays: 19, hasWebsite: false, signal: "Active offline, inconsistent grid", status: "researched" },
  { name: "Boutique interiors studio in Ernakulam", niche: "Interiors", city: "Ernakulam, Kerala", instagram: "", website: "yes", followers: 5600, postsPerWeek: 2, lastPostDays: 8, hasWebsite: true, signal: "Portfolio-heavy site, no content system", status: "researched" },
  { name: "D2C skincare founder (launching)", niche: "Beauty / D2C", city: "Bengaluru", instagram: "", website: "yes", followers: 900, postsPerWeek: 3, lastPostDays: 4, hasWebsite: true, signal: "Pre-launch, needs identity + calendar", status: "contacted" },
  { name: "Yoga & wellness studio in Kozhikode", niche: "Wellness", city: "Kozhikode, Kerala", instagram: "", website: "", followers: 3800, postsPerWeek: 4, lastPostDays: 2, hasWebsite: false, signal: "High frequency, no visual consistency", status: "researched" },
  { name: "Specialty coffee roaster in Wayanad", niche: "F&B / Retail", city: "Wayanad, Kerala", instagram: "", website: "yes", followers: 7200, postsPerWeek: 1, lastPostDays: 26, hasWebsite: true, signal: "Packaging dated, page dormant", status: "replied" },
];

function seedDemo(state) {
  for (const d of DEMO_ENQUIRIES) {
    const createdAt = daysAgo(d.days, 9 + (d.days % 7));
    const analysis = analyseEnquiry(d.message);
    const lead = {
      id: uid("enq"), reference: `KLY-DEMO-${String(DEMO_ENQUIRIES.indexOf(d) + 1).padStart(3, "0")}`,
      createdAt, updatedAt: createdAt,
      name: d.name, email: d.email, company: d.company, instagram: d.instagram,
      service: d.service, serviceKey: serviceKey(d.service), message: d.message,
      budget: d.budget, timeline: d.timeline, source: d.source, status: d.status,
      analysis, notes: [], demo: true, briefId: null, proposalId: null,
    };
    const scored = scoreLead(lead);
    lead.score = scored.score;
    lead.grade = scored.grade;
    lead.scoreReasons = scored.reasons;
    state.enquiries.push(lead);
  }

  DEMO_PROSPECTS.forEach((p, i) => {
    const record = { ...p, id: uid("prs"), createdAt: daysAgo(2 + i * 2), demo: true };
    state.prospects.push({ ...record, ...scoreProspect(record) });
  });

  const hot = state.enquiries.filter((e) => e.status === "new" || e.status === "contacted").slice(0, 4);
  for (const [i, e] of hot.entries()) {
    state.followups.push({
      id: uid("fup"), enquiryId: e.id,
      dueAt: daysAhead(i % 3 === 0 ? -1 : i + 1),
      type: i % 2 === 0 ? "First reply" : "Follow-up",
      channel: "Email", message: "Personal follow-up on the enquiry.",
      done: false, completedAt: null, demo: true,
    });
  }

  state.activity.push(
    { id: uid("act"), at: daysAgo(0, 8), type: "demo", title: "Demo workspace created", description: "Sample enquiries loaded so reports have something to show. Clear them in Settings before going live.", demo: true },
  );
  return state;
}

export function serviceKey(service = "") {
  const s = service.toLowerCase();
  if (s.includes("both")) return "both";
  if (s.includes("instagram")) return "instagram";
  if (s.includes("graphic") || s.includes("design")) return "design";
  return "unsure";
}

let state = null;

export function loadState() {
  if (state) return state;
  try {
    const raw = fs.readFileSync(dataFile, "utf8");
    state = JSON.parse(raw);
    state.settings = { ...structuredClone(DEFAULT_SETTINGS), ...(state.settings || {}) };
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("[store] Could not read data file, starting a new one:", error.message);
    }
    state = seedDemo(emptyState());
    saveState();
  }
  for (const key of ["enquiries", "briefs", "proposals", "prospects", "campaigns", "followups", "activity"]) {
    if (!Array.isArray(state[key])) state[key] = [];
  }
  return state;
}

export function saveState() {
  if (!state) return;
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  const tmp = `${dataFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, dataFile);
}

export function mutate(fn) {
  const s = loadState();
  const result = fn(s);
  saveState();
  return result;
}

export function logActivity(type, title, description, extra = {}) {
  mutate((s) => {
    s.activity.unshift({ id: uid("act"), at: now(), type, title, description, ...extra });
    s.activity = s.activity.slice(0, 250);
  });
}

export function clearDemoData() {
  return mutate((s) => {
    const count = s.enquiries.filter((x) => x.demo).length + s.prospects.filter((x) => x.demo).length;
    const demoEnquiryIds = new Set(s.enquiries.filter((x) => x.demo).map((x) => x.id));
    s.enquiries = s.enquiries.filter((x) => !x.demo);
    s.briefs = s.briefs.filter((x) => !x.demo);
    s.proposals = s.proposals.filter((x) => !x.demo);
    s.prospects = s.prospects.filter((x) => !x.demo);
    s.campaigns = s.campaigns.filter((x) => !x.demo);
    s.followups = s.followups.filter((x) => !x.demo && !demoEnquiryIds.has(x.enquiryId));
    s.activity = s.activity.filter((x) => !x.demo);
    return count;
  });
}

export { dataFile, root };
