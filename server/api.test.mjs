import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataFile = path.join(os.tmpdir(), `klyro-api-test-${process.pid}-${Date.now()}.json`);
process.env.KLYRO_DATA_FILE = dataFile;
process.env.PORT = "0";
process.env.HOST = "127.0.0.1";
process.env.NODE_ENV = "test";

const { server } = await import("./index.mjs");
let base = "";
let cookie = "";

beforeAll(async () => {
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 8787}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dataFile, { force: true });
});

async function request(method, url, body, auth = false) {
  const response = await fetch(`${base}${url}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(auth && cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  return { status: response.status, data, headers: response.headers };
}

describe("public API", () => {
  it("reports health", async () => {
    const res = await request("GET", "/api/health");
    expect(res.status).toBe(200);
    expect(res.data.service).toBe("klyro-studio-os");
  });

  it("requires a passphrase and opens a session", async () => {
    const status = await request("GET", "/api/auth/status");
    expect(status.data.authenticated).toBe(false);
    expect(status.data.hint).toBe("klyro-studio");

    const denied = await request("GET", "/api/studio/bootstrap");
    expect(denied.status).toBe(401);

    const wrong = await request("POST", "/api/auth/login", { passphrase: "nope" });
    expect(wrong.status).toBe(401);

    const ok = await request("POST", "/api/auth/login", { passphrase: "klyro-studio" });
    expect(ok.status).toBe(200);
    cookie = (ok.headers.get("set-cookie") || "").split(";")[0];
    expect(cookie).toContain("klyro_session=");
  });

  it("captures a contact-form enquiry with scoring and follow-ups", async () => {
    const res = await request("POST", "/api/enquiries", {
      name: "Test Client", email: "client@brand.co.in", company: "Test Brand",
      instagram: "@testbrand", service: "Both Services", budget: "₹25,000 – ₹60,000",
      timeline: "Within 1 month",
      message: "We are launching a new café next month and need a brand identity plus a monthly Instagram calendar. Budget approved.",
    });
    expect(res.status).toBe(201);
    expect(res.data.reference).toMatch(/^KLY-/);
    expect(res.data.score).toBeGreaterThan(50);
    expect(res.data.analysis.summary).toBeTruthy();
    expect(res.data.autoReply.subject).toContain(res.data.reference);
  });

  it("generates a brief preview without persisting anything", async () => {
    const before = await request("GET", "/api/studio/bootstrap", undefined, true);
    const res = await request("POST", "/api/briefs/preview", {
      answers: {
        brand: "Preview Co", goals: ["Post consistently"], services: "instagram",
        instagramNeeds: ["Monthly content calendar", "Reel concepts"], postsPerMonth: 8,
        budget: "Under ₹25,000", tone: "Minimal & calm",
      },
    });
    expect(res.status).toBe(200);
    expect(res.data.brief.calendar).toHaveLength(4);
    expect(res.data.brief.services.design).toBe(false);
    const after = await request("GET", "/api/studio/bootstrap", undefined, true);
    expect(after.data.briefs.length).toBe(before.data.briefs.length);
  });

  it("rejects invalid contact form submissions", async () => {
    const res = await request("POST", "/api/enquiries", { name: "", email: "bad", message: "" });
    expect(res.status).toBe(400);
  });
});

describe("conversion funnel", () => {
  let proposalToken = "";
  let briefToken = "";

  it("saves a brief, creates a lead and drafts a proposal", async () => {
    const res = await request("POST", "/api/briefs", {
      name: "Brief Client", email: "brief@studio.co.in", company: "Brief Studio Co",
      answers: {
        brand: "Brief Studio Co", industry: "Beauty / skincare", handle: "@briefco",
        goals: ["Launch a new brand or product", "Increase product sales"],
        services: "both", designNeeds: ["Logo & brand identity", "Packaging & labels"],
        instagramNeeds: ["Monthly content calendar", "Caption writing", "Reel concepts"],
        postsPerMonth: 12, budget: "₹60,000+", timeline: "Within 1 month",
        audience: "Urban women 25–40", tone: "Premium & refined",
        notes: "Launching a skincare line in January",
      },
    });
    expect(res.status).toBe(201);
    expect(res.data.brief.deliverables.length).toBeGreaterThan(4);
    expect(res.data.proposal.investment.min).toBeGreaterThan(0);
    expect(res.data.proposalUrl).toMatch(/^\/proposal\//);
    proposalToken = res.data.proposalToken;
    briefToken = res.data.briefToken;
  });

  it("serves shareable brief and proposal pages", async () => {
    const brief = await request("GET", `/api/briefs/${briefToken}`);
    expect(brief.status).toBe(200);
    expect(brief.data.brief.title).toContain("Brief Studio Co");
    const markdown = await request("GET", `/api/briefs/${briefToken}/markdown`);
    expect(markdown.status).toBe(200);
    expect(markdown.data).toContain("## Deliverables");
    const proposal = await request("GET", `/api/proposals/${proposalToken}`);
    expect(proposal.status).toBe(200);
    expect(proposal.data.proposal.status).toBe("sent");
  });

  it("marks the lead Won when the client approves online", async () => {
    const res = await request("POST", `/api/proposals/${proposalToken}/approve`, { note: "Looks good, let's start." });
    expect(res.status).toBe(200);
    expect(res.data.proposal.status).toBe("approved");
    const bootstrap = await request("GET", "/api/studio/bootstrap", undefined, true);
    const lead = bootstrap.data.enquiries.find((e) => e.email === "brief@studio.co.in");
    expect(lead.status).toBe("won");
    expect(lead.proposalId).toBeTruthy();
  });
});

describe("studio workspace", () => {
  it("returns a bootstrap with reports, demo data and settings", async () => {
    const res = await request("GET", "/api/studio/bootstrap", undefined, true);
    expect(res.status).toBe(200);
    expect(res.data.summary.totals.enquiries).toBeGreaterThan(0);
    expect(res.data.enquiries.length).toBeGreaterThan(0);
    expect(res.data.settings.studioName).toBeTruthy();
    expect(res.data.summary.totals.demoRecords).toBeGreaterThan(0);
  });

  it("generates a brief and a proposal for an existing enquiry", async () => {
    const bootstrap = await request("GET", "/api/studio/bootstrap", undefined, true);
    const lead = bootstrap.data.enquiries.find((e) => e.email === "client@brand.co.in");
    const brief = await request("POST", `/api/studio/enquiries/${lead.id}/brief`, {}, true);
    expect(brief.status).toBe(200);
    expect(brief.data.brief.deliverables.length).toBeGreaterThan(0);
    const proposal = await request("POST", `/api/studio/enquiries/${lead.id}/proposal`, {}, true);
    expect(proposal.status).toBe(200);
    expect(proposal.data.url).toMatch(/^\/proposal\//);
    const reply = await request("POST", `/api/studio/enquiries/${lead.id}/reply`, {}, true);
    expect(reply.data.reply.body).toContain("Hi Test,");
    expect(reply.data.reply.body).toContain(lead.reference);
  });

  it("updates status and appends a private note", async () => {
    const bootstrap = await request("GET", "/api/studio/bootstrap", undefined, true);
    const lead = bootstrap.data.enquiries.find((e) => e.email === "client@brand.co.in");
    const res = await request("PATCH", `/api/studio/enquiries/${lead.id}`, { status: "qualified", note: "Called, sent scope." }, true);
    expect(res.data.enquiry.status).toBe("qualified");
    expect(res.data.enquiry.notes[0].text).toBe("Called, sent scope.");
  });

  it("exports reports as CSV and Markdown", async () => {
    const csv = await request("GET", "/api/studio/reports/enquiries.csv", undefined, true);
    expect(csv.status).toBe(200);
    expect(csv.data).toContain("Reference,Created,Name");
    expect(csv.headers.get("content-disposition")).toContain("attachment");
    const digest = await request("GET", "/api/studio/reports/digest.md?days=7", undefined, true);
    expect(digest.data).toContain("## At a glance");
    const summary = await request("GET", "/api/studio/reports/summary?days=30", undefined, true);
    expect(summary.data.summary.trend).toHaveLength(14);
  });

  it("builds a campaign, imports prospects and converts one", async () => {
    const campaign = await request("POST", "/api/studio/prospects/campaign", { niche: "cafés", city: "Kochi, Kerala" }, true);
    expect(campaign.data.campaign.searchStrings.length).toBeGreaterThan(4);

    const csv = 'name,niche,city,instagram,email,followers,postsPerWeek,lastPostDays,signal,status\nNew Test Café,Café / F&B,"Kochi, Kerala",@newcafe,hi@newcafe.in,2400,1,20,Launch next month,researched';
    const imported = await request("POST", "/api/studio/prospects/import", { csv }, true);
    expect(imported.data.imported).toBe(1);
    const prospect = imported.data.prospects[0];
    expect(prospect.score).toBeGreaterThan(40);

    const converted = await request("PATCH", `/api/studio/prospects/${prospect.id}`, { status: "converted" }, true);
    expect(converted.status).toBe(200);
    const bootstrap = await request("GET", "/api/studio/bootstrap", undefined, true);
    expect(bootstrap.data.enquiries.some((e) => e.company === "New Test Café")).toBe(true);
  });

  it("saves settings and clears only demo records", async () => {
    const saved = await request("PATCH", "/api/studio/settings", { studioName: "KLYRO Test Studio", responseSlaHours: 12 }, true);
    expect(saved.data.settings.studioName).toBe("KLYRO Test Studio");
    const cleared = await request("POST", "/api/studio/settings/clear-demo", {}, true);
    expect(cleared.data.removed).toBeGreaterThan(0);
    const bootstrap = await request("GET", "/api/studio/bootstrap", undefined, true);
    expect(bootstrap.data.enquiries.every((e) => !e.demo)).toBe(true);
    expect(bootstrap.data.enquiries.some((e) => e.email === "client@brand.co.in")).toBe(true);
  });
});
