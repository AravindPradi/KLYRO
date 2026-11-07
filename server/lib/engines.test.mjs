import { describe, expect, it } from "vitest";
import { analyseEnquiry, scoreLead, buildAutoReply, buildFollowUps, extractKeywords } from "./lead-intel.mjs";
import { generateBrief, answersFromEnquiry, briefToMarkdown, normaliseAnswers } from "./brief-engine.mjs";
import { buildProspectCampaign, csvToProspects, parseCsv, scoreProspect } from "./prospect-intel.mjs";
import { buildSummary, enquiriesToCsv, digestMarkdown } from "./reports.mjs";
import { loadState } from "./store.mjs";

const SETTINGS = {
  studioName: "KLYRO Creative Studio",
  ownerEmail: "technologiiaa@proton.me",
  responseSlaHours: 24,
  followUpDays: [1, 3, 7],
  packages: {
    Starter: { min: 12000, max: 25000, label: "Starter" },
    Growth: { min: 25000, max: 60000, label: "Growth" },
    Signature: { min: 60000, max: 150000, label: "Signature" },
  },
};

describe("lead intelligence", () => {
  it("detects launch intent, urgency and budget signals", () => {
    const analysis = analyseEnquiry("We are launching a skincare line in January. Need packaging design and a monthly calendar. Budget ₹80,000, urgent.");
    expect(analysis.primaryIntent).toBeTruthy();
    expect(analysis.budgetMentioned).toBe(true);
    expect(analysis.urgency).toBe("high");
    expect(analysis.suggestedServices).toContain("design");
    expect(extractKeywords("brand brand logo logo identity").slice(0, 2)).toContain("brand");
  });

  it("scores a detailed, high-intent lead above a one-line price check", () => {
    const hot = scoreLead({
      message: "Launching a D2C skincare brand in January, need packaging, a brand kit and 12 posts a month. Budget approved at ₹80,000.",
      company: "Ayurveda by Meera", email: "meera@brand.com", instagram: "@brand",
      serviceKey: "both", source: "brief-studio", timeline: "Within 1 month",
    });
    const cool = scoreLead({ message: "Hi, just checking how much for a poster?", email: "x@gmail.com", serviceKey: "unsure", source: "contact-form" });
    expect(hot.score).toBeGreaterThan(cool.score);
    expect(hot.grade).toBe("hot");
    expect(hot.reasons.length).toBeGreaterThan(3);
    expect(cool.score).toBeLessThan(45);
  });

  it("drafts a personalised reply and a three-touch follow-up sequence", () => {
    const lead = { name: "Ananya Menon", reference: "KLY-123", service: "Both Services", message: "Need a rebrand and Instagram plan.", analysis: analyseEnquiry("Need a rebrand and Instagram plan") };
    const reply = buildAutoReply(lead, SETTINGS);
    expect(reply.subject).toContain("KLY-123");
    expect(reply.body).toContain("Ananya");
    expect(reply.body).toContain("24 hours");
    const followups = buildFollowUps(lead, SETTINGS);
    expect(followups).toHaveLength(3);
    expect(followups.map((f) => f.dayOffset)).toEqual([1, 3, 7]);
  });
});

describe("brief engine", () => {
  const answers = normaliseAnswers({
    brand: "Lumière Café", industry: "Café / F&B", handle: "@lumierecafe",
    goals: ["Launch a new brand or product", "Get more enquiries / leads"],
    audience: "Young professionals in Kochi", tone: "Warm & editorial", services: "both",
    designNeeds: ["Logo & brand identity", "Social post templates"],
    instagramNeeds: ["Content strategy & pillars", "Monthly content calendar", "Reel concepts", "Caption writing"],
    postsPerMonth: 12, budget: "₹25,000 – ₹60,000", timeline: "Within 1 month",
    notes: "Opening a second café next month, need identity and Instagram curation",
  });

  it("produces a complete, structured requirement document", () => {
    const brief = generateBrief(answers, { settings: SETTINGS });
    expect(brief.services.design).toBe(true);
    expect(brief.services.instagram).toBe(true);
    expect(brief.deliverables.length).toBeGreaterThan(4);
    expect(brief.contentPillars).toHaveLength(4);
    expect(brief.calendar).toHaveLength(4);
    expect(brief.calendar.reduce((sum, w) => sum + w.posts.length, 0)).toBe(12);
    expect(brief.designDirection.palette.length).toBe(4);
    expect(brief.clarifyingQuestions.length).toBeGreaterThan(4);
    expect(brief.estimate.min).toBeGreaterThan(0);
    expect(brief.confidence).toBeGreaterThan(0.6);
    expect(brief.recommendedPackage.name).toBe("Growth");
    expect(brief.summary).toContain("Lumière Café");
  });

  it("reads Indian-formatted budgets correctly even for a small scope", () => {
    const small = { ...answers, designNeeds: ["Logo & brand identity"], instagramNeeds: ["Monthly content calendar"], postsPerMonth: 8 };
    expect(generateBrief({ ...small, budget: "Under ₹25,000" }, { settings: SETTINGS }).recommendedPackage.name).toBe("Starter");
    expect(generateBrief({ ...small, budget: "₹25,000 – ₹60,000" }, { settings: SETTINGS }).recommendedPackage.name).toBe("Growth");
    expect(generateBrief({ ...small, budget: "₹40,000" }, { settings: SETTINGS }).recommendedPackage.name).toBe("Growth");
    expect(generateBrief({ ...small, budget: "₹60,000+" }, { settings: SETTINGS }).recommendedPackage.name).toBe("Signature");
    expect(generateBrief({ ...small, budget: "Not decided yet" }, { settings: SETTINGS }).recommendedPackage.name).toBe("Starter");
  });

  it("respects a design-only scope and a high budget", () => {
    const designOnly = generateBrief({ ...answers, services: "design", postsPerMonth: 8, budget: "₹60,000+" }, { settings: SETTINGS });
    expect(designOnly.services.instagram).toBe(false);
    expect(designOnly.calendar).toHaveLength(0);
    expect(designOnly.contentPillars).toHaveLength(0);
    expect(designOnly.recommendedPackage.name).toBe("Signature");
    expect(designOnly.deliverables.every((d) => !d.name.includes("Reel"))).toBe(true);
  });

  it("infers answers from a raw enquiry and renders Markdown", () => {
    const lead = { message: "Launching a new skincare brand, need a logo, packaging labels and 12 posts a month with reel concepts. Budget ₹80,000.", company: "Skin Co", serviceKey: "both", budget: "₹60,000+", timeline: "Within 1 month", instagram: "@skinco" };
    const inferred = answersFromEnquiry(lead);
    expect(inferred.goals).toContain("Launch a new brand or product");
    expect(inferred.designNeeds).toContain("Logo & brand identity");
    const brief = generateBrief(inferred, { settings: SETTINGS });
    const md = briefToMarkdown(brief);
    expect(md).toContain("# Creative requirements");
    expect(md).toContain("### Week 4");
    expect(md).toContain("## Deliverables");
    expect(md).not.toContain("undefined");
  });

  it("is deterministic for identical input", () => {
    const a = generateBrief(answers, { settings: SETTINGS });
    const b = generateBrief(answers, { settings: SETTINGS });
    expect(JSON.stringify({ ...a, generatedAt: "" })).toBe(JSON.stringify({ ...b, generatedAt: "" }));
  });
});

describe("prospecting intelligence", () => {
  it("builds a compliant campaign with searches, scoring and outreach", () => {
    const campaign = buildProspectCampaign({ niche: "cafés", city: "Kochi, Kerala", offer: "a free brief" }, SETTINGS);
    expect(campaign.searchStrings.length).toBeGreaterThanOrEqual(5);
    expect(campaign.outreach).toHaveLength(3);
    expect(campaign.qualificationSignals.length).toBeGreaterThan(3);
    expect(campaign.compliance.toLowerCase()).toContain("opt-out");
    expect(campaign.sampleTargets.every((t) => t.sample)).toBe(true);
  });

  it("parses quoted CSV and scores fit signals", () => {
    const csv = 'name,niche,city,instagram,email,followers,postsPerWeek,lastPostDays,signal,status\n"Foo, Café",Café / F&B,"Kochi, Kerala",@foo,hi@foo.in,3200,1,18,Launch next month,researched';
    expect(parseCsv(csv)).toHaveLength(1);
    const rows = csvToProspects(csv);
    expect(rows[0].name).toBe("Foo, Café");
    expect(rows[0].city).toBe("Kochi, Kerala");
    expect(rows[0].score).toBeGreaterThan(40);
    expect(scoreProspect({ ...rows[0], status: "replied" }).score).toBeGreaterThan(rows[0].score);
  });
});

describe("reports", () => {
  it("aggregates KPIs, trend, insights and exports", () => {
    const state = loadState();
    const summary = buildSummary(state, 30);
    expect(summary.totals.enquiries).toBeGreaterThan(0);
    expect(summary.trend).toHaveLength(14);
    expect(summary.byService.length).toBeGreaterThan(0);
    expect(summary.insights.length).toBeGreaterThan(0);
    const csv = enquiriesToCsv(state.enquiries);
    expect(csv.split("\n")[0]).toContain("Reference");
    expect(csv.split("\n").length).toBeGreaterThan(state.enquiries.length);
    expect(digestMarkdown(state, 7, summary)).toContain("## At a glance");
  });
});
