/**
 * KLYRO Studio OS — API server.
 *
 * Zero runtime dependencies: node:http + a JSON data file.
 *   Dev  : vite proxies /api → this server (npm run dev:all)
 *   Prod : npm run build && npm start  (this server also serves dist/)
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { loadState, mutate, saveState, logActivity, clearDemoData, uid, token, now, reference, serviceKey, DEFAULT_SETTINGS, root, dataFile } from "./lib/store.mjs";
import { analyseEnquiry, scoreLead, buildAutoReply, buildFollowUps } from "./lib/lead-intel.mjs";
import { generateBrief, answersFromEnquiry, briefToMarkdown, normaliseAnswers } from "./lib/brief-engine.mjs";
import { enhanceBriefWithLLM, llmConfigured } from "./lib/llm.mjs";
import { buildProposal, proposalToMarkdown } from "./lib/proposal.mjs";
import { buildProspectCampaign, csvToProspects, scoreProspect } from "./lib/prospect-intel.mjs";
import { buildSummary, enquiriesToCsv, digestMarkdown, prospectTemplateCsv } from "./lib/reports.mjs";
import { checkPassphrase, createSessionToken, verifySessionToken, parseCookies, sessionCookie, clearCookie, demoMode } from "./lib/auth.mjs";
import { notify, enquiryNotification } from "./lib/notify.mjs";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const DIST = path.join(root, "dist");
const MAX_BODY = 1024 * 1024;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff",
  ".map": "application/json", ".txt": "text/plain; charset=utf-8",
};

const clamp = (value, max = 2000, fallback = "") => String(value ?? fallback).trim().slice(0, max);
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
const state = () => loadState();

function send(res, status, body, contentType = "application/json; charset=utf-8", extraHeaders = {}) {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    ...extraHeaders,
  });
  res.end(payload);
}

const json = (res, status, data, headers) => send(res, status, data, "application/json; charset=utf-8", headers);
const fail = (res, status, message) => json(res, status, { error: message });
const text = (res, status, body, type = "text/plain; charset=utf-8", headers = {}) => send(res, status, body, type, headers);

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error("Request body too large"), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Invalid JSON body"), { status: 400 });
  }
}

/* ------------------------------- helpers -------------------------------- */

function buildLead(input = {}, source = "contact-form") {
  const message = clamp(input.message, 4000);
  const analysis = analyseEnquiry(message);
  const lead = {
    id: uid("enq"),
    reference: reference(),
    createdAt: now(),
    updatedAt: now(),
    name: clamp(input.name, 120),
    email: clamp(input.email, 180).toLowerCase(),
    company: clamp(input.company, 160),
    instagram: clamp(input.instagram || input.handle, 120),
    service: clamp(input.service || "Not Sure Yet", 80),
    serviceKey: serviceKey(input.service),
    message,
    budget: clamp(input.budget, 80),
    timeline: clamp(input.timeline, 80),
    source,
    status: "new",
    analysis,
    notes: [],
    demo: false,
    briefId: null,
    proposalId: null,
  };
  const scored = scoreLead(lead);
  return { ...lead, score: scored.score, grade: scored.grade, scoreReasons: scored.reasons };
}

function addFollowUps(lead, settings) {
  const templates = buildFollowUps(lead, settings);
  const records = templates.map((t) => ({
    id: uid("fup"),
    enquiryId: lead.id,
    dueAt: new Date(Date.now() + t.dayOffset * 86400000).toISOString(),
    type: t.type,
    channel: t.channel,
    message: t.message,
    done: false,
    completedAt: null,
    demo: false,
  }));
  mutate((s) => { s.followups.push(...records); });
  return records;
}

function saveBrief(lead, answers, brief, options = {}) {
  const record = {
    id: uid("brf"),
    enquiryId: lead.id,
    createdAt: now(),
    shareToken: token(),
    answers: normaliseAnswers(answers),
    engine: brief.engine,
    confidence: brief.confidence,
    demo: false,
    ...brief,
  };
  mutate((s) => {
    s.briefs.unshift(record);
    const target = s.enquiries.find((e) => e.id === lead.id);
    if (target) { target.briefId = record.id; target.updatedAt = now(); }
  });
  void options;
  return record;
}

function saveProposal(lead, brief, settings) {
  const proposal = buildProposal(lead, { ...brief, id: brief.id }, settings);
  mutate((s) => {
    s.proposals.unshift(proposal);
    const target = s.enquiries.find((e) => e.id === lead.id);
    if (target) {
      target.proposalId = proposal.id;
      target.status = target.status === "new" ? "proposal" : target.status;
      target.updatedAt = now();
    }
  });
  return proposal;
}

function recordNewLead(lead, extra = {}) {
  const settings = state().settings;
  const autoReply = buildAutoReply(lead, settings);
  mutate((s) => {
    s.enquiries.unshift(lead);
    s.activity.unshift({
      id: uid("act"), at: now(), type: "enquiry",
      title: `New enquiry — ${lead.company || lead.name}`,
      description: `${lead.service} · ${lead.grade} lead (${lead.score}/100) · ${lead.reference}`,
      enquiryId: lead.id,
    });
    s.activity = s.activity.slice(0, 250);
  });
  addFollowUps(lead, settings);
  notify("new_enquiry", enquiryNotification(lead, autoReply), settings).then((result) => {
    if (!result.sent && result.reason !== "no-webhook-configured") {
      logActivity("notification", "Webhook delivery failed", result.reason);
    }
  }).catch(() => {});
  logActivity("auto-reply", "Auto-reply prepared", `${autoReply.subject} — copy it from the enquiry drawer.`, { enquiryId: lead.id });
  void extra;
  return { autoReply };
}

function findLead(id) {
  return state().enquiries.find((e) => e.id === id);
}

/* ------------------------------- routes --------------------------------- */

const routes = [];
const route = (method, pattern, handler, auth = false) => routes.push({ method, pattern, handler, auth });

route("GET", /^\/api\/health$/, () => ({
  ok: true, service: "klyro-studio-os", time: now(),
  aiEngine: llmConfigured() ? "local + llm" : "local", dataFile: path.basename(dataFile),
}));

route("GET", /^\/api\/auth\/status$/, (ctx) => ({
  authenticated: ctx.authenticated,
  demoMode: demoMode(),
  hint: demoMode() ? "klyro-studio" : null,
  studioName: state().settings.studioName,
}));

route("POST", /^\/api\/auth\/login$/, async (ctx) => {
  if (!checkPassphrase(ctx.body.passphrase)) return { status: 401, body: { error: "That passphrase doesn't match." } };
  const cookie = sessionCookie(createSessionToken());
  return { status: 200, body: { ok: true }, headers: { "set-cookie": cookie } };
});

route("POST", /^\/api\/auth\/logout$/, () => ({ ok: true, headers: { "set-cookie": clearCookie() } }));

/* ---- public: website contact form ---- */
route("POST", /^\/api\/enquiries$/, async (ctx) => {
  const { body } = ctx;
  if (body.website_url) return { status: 200, body: { ok: true, reference: "SPAM-FILTERED" } }; // honeypot
  if (!isEmail(body.email) || !clamp(body.name, 120) || !clamp(body.message, 4000)) {
    return { status: 400, body: { error: "Please add your name, a valid email and a short project note." } };
  }
  const lead = buildLead(body, "contact-form");
  const { autoReply } = recordNewLead(lead);
  return {
    status: 201,
    body: {
      ok: true, reference: lead.reference, id: lead.id, grade: lead.grade, score: lead.score,
      analysis: lead.analysis, autoReply: state().settings.autoReplyEnabled ? autoReply : null,
    },
  };
});

/* ---- public: AI brief preview (no data stored) ---- */
route("POST", /^\/api\/briefs\/preview$/, async (ctx) => {
  const answers = normaliseAnswers(ctx.body.answers || ctx.body || {});
  const local = generateBrief(answers, { settings: state().settings });
  const { brief } = await enhanceBriefWithLLM(answers, local);
  return { brief, engine: brief.engine, llmConfigured: llmConfigured() };
});

/* ---- public: AI brief + lead + proposal (the conversion engine) ---- */
route("POST", /^\/api\/briefs$/, async (ctx) => {
  const { body } = ctx;
  if (body.website_url) return { status: 200, body: { ok: true, reference: "SPAM-FILTERED" } };
  if (!isEmail(body.email) || !clamp(body.name, 120)) {
    return { status: 400, body: { error: "Add your name and a valid email so we can send your brief." } };
  }
  const answers = normaliseAnswers(body.answers || {});
  const local = generateBrief(answers, { settings: state().settings });
  const { brief: generated } = await enhanceBriefWithLLM(answers, local);

  const existing = state().enquiries.find((e) => e.email === clamp(body.email, 180).toLowerCase() && Date.now() - new Date(e.createdAt).getTime() < 86400000);
  let lead;
  if (existing) {
    lead = structuredClone(existing);
    mutate((s) => {
      const target = s.enquiries.find((e) => e.id === existing.id);
      if (!target) return;
      Object.assign(target, {
        company: clamp(body.company || answers.brand, 160) || target.company,
        instagram: clamp(answers.handle, 120) || target.instagram,
        service: target.serviceKey === "unsure" ? "Both Services" : target.service,
        message: `${target.message}\n\n[Brief Studio] ${generated.summary}`.slice(0, 4000),
        updatedAt: now(),
      });
    });
    lead = findLead(existing.id);
  } else {
    lead = buildLead({
      name: body.name,
      email: body.email,
      company: body.company || answers.brand,
      instagram: answers.handle,
      service: generated.services.key === "both" ? "Both Services" : generated.services.key === "design" ? "Graphic Design" : "Instagram Content Strategy",
      message: `[AI Brief Studio]\n${generated.summary}\n\nGoals: ${answers.goals.join(", ")}\nNotes: ${answers.notes || "—"}`,
      budget: answers.budget,
      timeline: answers.timeline,
    }, "brief-studio");
    recordNewLead(lead);
  }

  const briefRecord = saveBrief(lead, answers, generated);
  const proposal = saveProposal(lead, briefRecord, state().settings);
  logActivity("brief", `AI brief generated for ${lead.company || lead.name}`, `${generated.services.label} · ${generated.recommendedPackage.name} · confidence ${Math.round(generated.confidence * 100)}%`, { enquiryId: lead.id });
  logActivity("proposal", `Proposal drafted for ${lead.company || lead.name}`, `Indicative ${generated.recommendedPackage.range} — shareable link ready.`, { enquiryId: lead.id });

  return {
    status: 201,
    body: {
      ok: true,
      leadId: lead.id,
      reference: lead.reference,
      briefToken: briefRecord.shareToken,
      briefUrl: `/brief/${briefRecord.shareToken}`,
      proposalToken: proposal.token,
      proposalUrl: `/proposal/${proposal.token}`,
      brief: briefRecord,
      proposal,
    },
  };
});

/* ---- public: shareable brief / proposal ---- */
route("GET", /^\/api\/briefs\/([a-zA-Z0-9_-]+)$/, (ctx) => {
  const shareToken = ctx.params[0];
  const brief = state().briefs.find((b) => b.shareToken === shareToken);
  if (!brief) return { status: 404, body: { error: "Brief not found." } };
  const lead = state().enquiries.find((e) => e.id === brief.enquiryId);
  return { brief, client: lead ? { name: lead.name, company: lead.company } : null, studioName: state().settings.studioName };
});

route("GET", /^\/api\/briefs\/([a-zA-Z0-9_-]+)\/markdown$/, (ctx) => {
  const brief = state().briefs.find((b) => b.shareToken === ctx.params[0]);
  if (!brief) return { status: 404, body: { error: "Brief not found." } };
  return { raw: briefToMarkdown(brief), type: "text/markdown; charset=utf-8", download: `klyro-brief-${ctx.params[0]}.md` };
});

route("GET", /^\/api\/proposals\/([a-zA-Z0-9_-]+)$/, (ctx) => {
  const proposal = state().proposals.find((p) => p.token === ctx.params[0]);
  if (!proposal) return { status: 404, body: { error: "Proposal not found." } };
  return { proposal, studioName: state().settings.studioName };
});

route("POST", /^\/api\/proposals\/([a-zA-Z0-9_-]+)\/approve$/, async (ctx) => {
  const proposal = state().proposals.find((p) => p.token === ctx.params[0]);
  if (!proposal) return { status: 404, body: { error: "Proposal not found." } };
  if (proposal.status === "approved") return { proposal };
  const note = clamp(ctx.body.note, 1000);
  mutate((s) => {
    const p = s.proposals.find((x) => x.token === proposal.token);
    if (p) { p.status = "approved"; p.approvedAt = now(); p.approvalNote = note; p.updatedAt = now(); }
    const lead = s.enquiries.find((e) => e.id === proposal.enquiryId);
    if (lead) { lead.status = "won"; lead.updatedAt = now(); }
    s.followups.filter((f) => f.enquiryId === proposal.enquiryId).forEach((f) => { f.done = true; f.completedAt = now(); });
    s.activity.unshift({ id: uid("act"), at: now(), type: "won", title: `${proposal.clientCompany} approved the proposal`, description: note || "Client approved the scope. Time to send the invoice and kick-off form.", enquiryId: proposal.enquiryId });
  });
  notify("proposal_approved", { text: `🎉 ${proposal.clientCompany} approved ${proposal.title}. Ref: ${proposal.id}`, note }, state().settings).catch(() => {});
  return { proposal: state().proposals.find((p) => p.token === proposal.token) };
});

route("POST", /^\/api\/proposals\/([a-zA-Z0-9_-]+)\/decline$/, async (ctx) => {
  const proposal = state().proposals.find((p) => p.token === ctx.params[0]);
  if (!proposal) return { status: 404, body: { error: "Proposal not found." } };
  mutate((s) => {
    const p = s.proposals.find((x) => x.token === proposal.token);
    if (p) { p.status = "declined"; p.declineNote = clamp(ctx.body.note, 1000); p.updatedAt = now(); }
    const lead = s.enquiries.find((e) => e.id === proposal.enquiryId);
    if (lead && lead.status !== "won") { lead.status = "lost"; lead.updatedAt = now(); }
    s.activity.unshift({ id: uid("act"), at: now(), type: "lost", title: `${proposal.clientCompany} declined the proposal`, description: p?.declineNote || "Ask one short question about timing or scope.", enquiryId: proposal.enquiryId });
  });
  return { ok: true };
});

/* ---- studio: bootstrap / enquiries ---- */
route("GET", /^\/api\/studio\/bootstrap$/, () => {
  const s = state();
  return {
    summary: buildSummary(s, 30),
    enquiries: s.enquiries,
    followups: s.followups,
    proposals: s.proposals,
    prospects: s.prospects,
    activity: s.activity.slice(0, 40),
    briefs: s.briefs.map((b) => ({ id: b.id, enquiryId: b.enquiryId, createdAt: b.createdAt, shareToken: b.shareToken, title: b.title, confidence: b.confidence, engine: b.engine, services: b.services })),
    settings: s.settings,
  };
}, true);

route("GET", /^\/api\/studio\/enquiries$/, (ctx) => {
  const { q = "", status = "all", service = "all", source = "all", limit = "200" } = ctx.query;
  let items = [...state().enquiries];
  if (status !== "all") items = items.filter((e) => e.status === status);
  if (service !== "all") items = items.filter((e) => e.serviceKey === service);
  if (source !== "all") items = items.filter((e) => e.source === source);
  if (q) {
    const needle = String(q).toLowerCase();
    items = items.filter((e) => [e.name, e.email, e.company, e.instagram, e.message, e.reference].some((v) => String(v || "").toLowerCase().includes(needle)));
  }
  return { enquiries: items.slice(0, Number(limit) || 200), total: items.length };
}, true);

route("GET", /^\/api\/studio\/enquiries\/([a-zA-Z0-9_-]+)$/, (ctx) => {
  const s = state();
  const enquiry = s.enquiries.find((e) => e.id === ctx.params[0]);
  if (!enquiry) return { status: 404, body: { error: "Enquiry not found." } };
  return {
    enquiry,
    brief: s.briefs.find((b) => b.id === enquiry.briefId) || null,
    proposal: s.proposals.find((p) => p.id === enquiry.proposalId) || null,
    followups: s.followups.filter((f) => f.enquiryId === enquiry.id),
    activity: s.activity.filter((a) => a.enquiryId === enquiry.id),
    options: { status: ["new", "contacted", "qualified", "proposal", "won", "lost"] },
  };
}, true);

route("PATCH", /^\/api\/studio\/enquiries\/([a-zA-Z0-9_-]+)$/, (ctx) => {
  const id = ctx.params[0];
  const current = findLead(id);
  if (!current) return { status: 404, body: { error: "Enquiry not found." } };
  const allowed = ["name", "email", "company", "instagram", "service", "budget", "timeline", "status", "notes"];
  mutate((s) => {
    const lead = s.enquiries.find((e) => e.id === id);
    if (!lead) return;
    for (const key of allowed) {
      if (ctx.body[key] === undefined) continue;
      if (key === "notes") {
        lead.notes = Array.isArray(ctx.body.notes) ? ctx.body.notes.slice(0, 50) : lead.notes;
      } else {
        lead[key] = clamp(ctx.body[key], key === "notes" ? 4000 : 200);
      }
    }
    if (ctx.body.note && typeof ctx.body.note === "string") {
      lead.notes = [{ id: uid("note"), at: now(), text: clamp(ctx.body.note, 2000) }, ...(lead.notes || [])];
    }
    if (ctx.body.service) lead.serviceKey = serviceKey(ctx.body.service);
    if (ctx.body.message) {
      lead.message = clamp(ctx.body.message, 4000);
      lead.analysis = analyseEnquiry(lead.message);
      const scored = scoreLead(lead);
      lead.score = scored.score;
      lead.grade = scored.grade;
      lead.scoreReasons = scored.reasons;
    }
    lead.updatedAt = now();
    s.activity.unshift({ id: uid("act"), at: now(), type: "update", title: `Updated ${lead.company || lead.name}`, description: ctx.body.status ? `Status → ${ctx.body.status}` : "Enquiry details edited", enquiryId: id });
  });
  return { enquiry: findLead(id) };
}, true);

route("POST", /^\/api\/studio\/enquiries\/([a-zA-Z0-9_-]+)\/brief$/, async (ctx) => {
  const lead = findLead(ctx.params[0]);
  if (!lead) return { status: 404, body: { error: "Enquiry not found." } };
  const answers = normaliseAnswers(ctx.body.answers || answersFromEnquiry(lead));
  const local = generateBrief(answers, { settings: state().settings });
  const { brief } = await enhanceBriefWithLLM(answers, local);
  const record = saveBrief(lead, answers, brief);
  logActivity("brief", `Brief generated for ${lead.company || lead.name}`, `${brief.services.label} · ${brief.recommendedPackage.name}`, { enquiryId: lead.id });
  return { brief: record };
}, true);

route("POST", /^\/api\/studio\/enquiries\/([a-zA-Z0-9_-]+)\/proposal$/, (ctx) => {
  const lead = findLead(ctx.params[0]);
  if (!lead) return { status: 404, body: { error: "Enquiry not found." } };
  const s = state();
  const brief = s.briefs.find((b) => b.id === lead.briefId) || s.briefs.find((b) => b.enquiryId === lead.id);
  if (!brief) return { status: 400, body: { error: "Generate a brief first — the proposal needs a scope." } };
  const proposal = saveProposal(lead, brief, s.settings);
  logActivity("proposal", `Proposal drafted for ${lead.company || lead.name}`, `Share: /proposal/${proposal.token}`, { enquiryId: lead.id });
  return { proposal, url: `/proposal/${proposal.token}` };
}, true);

route("POST", /^\/api\/studio\/enquiries\/([a-zA-Z0-9_-]+)\/reply$/, (ctx) => {
  const lead = findLead(ctx.params[0]);
  if (!lead) return { status: 404, body: { error: "Enquiry not found." } };
  return { reply: buildAutoReply(lead, state().settings) };
}, true);

route("POST", /^\/api\/studio\/enquiries\/([a-zA-Z0-9_-]+)\/followups$/, (ctx) => {
  const lead = findLead(ctx.params[0]);
  if (!lead) return { status: 404, body: { error: "Enquiry not found." } };
  return { followups: addFollowUps(lead, state().settings) };
}, true);

route("GET", /^\/api\/studio\/followups$/, () => ({ followups: state().followups }), true);

route("PATCH", /^\/api\/studio\/followups\/([a-zA-Z0-9_-]+)$/, (ctx) => {
  mutate((s) => {
    const f = s.followups.find((x) => x.id === ctx.params[0]);
    if (f) {
      f.done = Boolean(ctx.body.done);
      f.completedAt = f.done ? now() : null;
      if (f.done) s.activity.unshift({ id: uid("act"), at: now(), type: "followup", title: "Follow-up completed", description: `${f.type} for an enquiry marked done.`, enquiryId: f.enquiryId });
    }
  });
  return { ok: true };
}, true);

/* ---- studio: reports ---- */
route("GET", /^\/api\/studio\/reports\/summary$/, (ctx) => ({ summary: buildSummary(state(), Number(ctx.query.days) || 30) }), true);

route("GET", /^\/api\/studio\/reports\/enquiries\.csv$/, () => ({
  raw: enquiriesToCsv(state().enquiries),
  type: "text/csv; charset=utf-8",
  download: `klyro-enquiries-${new Date().toISOString().slice(0, 10)}.csv`,
}), true);

route("GET", /^\/api\/studio\/reports\/digest\.md$/, (ctx) => {
  const days = Number(ctx.query.days) || 7;
  const summary = buildSummary(state(), days);
  return {
    raw: digestMarkdown(state(), days, summary),
    type: "text/markdown; charset=utf-8",
    download: `klyro-report-${new Date().toISOString().slice(0, 10)}.md`,
  };
}, true);

route("GET", /^\/api\/studio\/reports\/prospect-template\.csv$/, () => ({
  raw: prospectTemplateCsv(), type: "text/csv; charset=utf-8", download: "klyro-prospect-template.csv",
}), true);

/* ---- studio: prospecting ---- */
route("POST", /^\/api\/studio\/prospects\/campaign$/, (ctx) => {
  const campaign = buildProspectCampaign(ctx.body, state().settings);
  mutate((s) => { s.campaigns.unshift({ id: uid("cmp"), ...campaign }); s.campaigns = s.campaigns.slice(0, 20); });
  logActivity("campaign", "Prospecting campaign generated", `${campaign.params.niche} in ${campaign.params.city}`);
  return { campaign };
}, true);

route("POST", /^\/api\/studio\/prospects\/import$/, (ctx) => {
  const parsed = csvToProspects(ctx.body.csv || "");
  if (!parsed.length) return { status: 400, body: { error: "No valid rows found. Include a `name` column (see the template CSV)." } };
  const created = [];
  mutate((s) => {
    for (const p of parsed) {
      if (s.prospects.some((existing) => existing.name.toLowerCase() === p.name.toLowerCase())) continue;
      const record = { ...p, id: uid("prs"), createdAt: now(), demo: false };
      s.prospects.unshift(record);
      created.push(record);
    }
  });
  logActivity("import", `${created.length} prospects imported`, "Scored automatically by fit signals.");
  return { imported: created.length, skipped: parsed.length - created.length, prospects: created };
}, true);

route("PATCH", /^\/api\/studio\/prospects\/([a-zA-Z0-9_-]+)$/, (ctx) => {
  mutate((s) => {
    const p = s.prospects.find((x) => x.id === ctx.params[0]);
    if (!p) return;
    for (const key of ["name", "niche", "city", "instagram", "website", "email", "signal", "status"]) {
      if (ctx.body[key] !== undefined) p[key] = clamp(ctx.body[key], 500);
    }
    if (ctx.body.status === "converted") {
      const lead = buildLead({
        name: p.name, email: p.email || "", company: p.name, instagram: p.instagram,
        service: "Not Sure Yet", message: `Converted from prospect research. Signal: ${p.signal || "—"}. ${p.niche || ""} ${p.city || ""}`.trim(),
      }, "csv");
      s.enquiries.unshift(lead);
      s.activity.unshift({ id: uid("act"), at: now(), type: "enquiry", title: `Prospect converted — ${p.name}`, description: "Moved from the prospect list into enquiries.", enquiryId: lead.id });
    }
    Object.assign(p, scoreProspect(p));
  });
  return { ok: true };
}, true);

route("GET", /^\/api\/studio\/campaigns$/, () => ({ campaigns: state().campaigns }), true);

/* ---- studio: settings ---- */
route("GET", /^\/api\/studio\/settings$/, () => ({ settings: state().settings, defaults: DEFAULT_SETTINGS }), true);

route("PATCH", /^\/api\/studio\/settings$/, (ctx) => {
  mutate((s) => {
    const allowed = ["studioName", "ownerEmail", "responseSlaHours", "webhookUrl", "autoReplyEnabled", "followUpDays", "packages"];
    for (const key of allowed) {
      if (ctx.body[key] === undefined) continue;
      s.settings[key] = typeof ctx.body[key] === "string" ? clamp(ctx.body[key], 500) : ctx.body[key];
    }
  });
  return { settings: state().settings };
}, true);

route("POST", /^\/api\/studio\/settings\/test-webhook$/, async () => {
  const result = await notify("test", { text: "✅ KLYRO Studio OS webhook test — your notifications are connected." }, state().settings);
  return { ...result, configured: Boolean(state().settings.webhookUrl || process.env.STUDIO_WEBHOOK_URL) };
}, true);

route("POST", /^\/api\/studio\/settings\/clear-demo$/, () => {
  const removed = clearDemoData();
  logActivity("settings", "Demo data cleared", `${removed} sample records removed. Workspace is ready for real clients.`);
  return { removed };
}, true);

route("GET", /^\/api\/studio\/activity$/, () => ({ activity: state().activity.slice(0, 100) }), true);

/* --------------------------- request pipeline --------------------------- */

const rateBuckets = new Map();
function rateLimited(req, publishable = false) {
  if (!publishable) return false;
  const ip = req.socket?.remoteAddress || "unknown";
  const key = `${ip}:${req.url.split("?")[0]}`;
  const bucket = rateBuckets.get(key) || { count: 0, reset: Date.now() + 60000 };
  if (Date.now() > bucket.reset) { bucket.count = 0; bucket.reset = Date.now() + 60000; }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return bucket.count > 12;
}

function serveStatic(req, res, pathname) {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    return text(res, 200, "KLYRO Studio OS API is running. Build the frontend with `npm run build` (or use `npm run dev:all` in development).", "text/plain; charset=utf-8");
  }
  const requested = path.join(DIST, decodeURIComponent(pathname));
  const safe = requested.startsWith(DIST) && fs.existsSync(requested) && fs.statSync(requested).isFile();
  const file = safe ? requested : path.join(DIST, "index.html");
  const ext = path.extname(file);
  const headers = safe && file.includes(`${path.sep}assets${path.sep}`) ? { "cache-control": "public, max-age=31536000, immutable" } : {};
  res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream", ...headers, "x-content-type-options": "nosniff" });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (!pathname.startsWith("/api/")) {
    if (req.method !== "GET" && req.method !== "HEAD") return fail(res, 405, "Method not allowed");
    return serveStatic(req, res, pathname);
  }

  const cookies = parseCookies(req.headers.cookie || "");
  const authenticated = verifySessionToken(cookies.klyro_session || "");
  const match = routes.find((r) => r.method === req.method && r.pattern.test(pathname));
  if (!match) return fail(res, 404, "Unknown endpoint");
  if (match.auth && !authenticated) return fail(res, 401, "Studio session expired. Please sign in again.");

  const publishable = req.method === "POST" && /^\/api\/(enquiries|briefs|proposals)/.test(pathname);
  if (rateLimited(req, publishable)) return fail(res, 429, "Too many submissions. Please try again in a minute.");

  try {
    const body = ["POST", "PATCH", "PUT"].includes(req.method) ? await readBody(req) : {};
    const params = pathname.match(match.pattern)?.slice(1) || [];
    const query = Object.fromEntries(url.searchParams.entries());
    const result = await match.handler({ body, params, query, authenticated, headers: req.headers });
    const status = result?.status || 200;
    const headers = result?.headers || {};
    if (result?.raw !== undefined) {
      const disposition = result.download ? { "content-disposition": `attachment; filename="${result.download}"` } : {};
      return text(res, status, result.raw, result.type || "text/plain; charset=utf-8", { ...headers, ...disposition });
    }
    const { status: _status, body: _body, headers: _headers, raw: _raw, type: _type, download: _download, ...rest } = result || {};
    return json(res, status, result?.body ?? rest, headers);
  } catch (error) {
    console.error(`[api] ${req.method} ${pathname}:`, error);
    return fail(res, error.status || 500, error.status ? error.message : "Something went wrong on the server.");
  }
});

server.listen(PORT, HOST, () => {
  const s = loadState();
  console.log(`\n  KLYRO Studio OS API  →  http://${HOST}:${PORT}`);
  console.log(`  Data file            →  ${dataFile}`);
  console.log(`  Enquiries loaded     →  ${s.enquiries.length} (${s.enquiries.filter((e) => e.demo).length} demo)`);
  console.log(`  AI engine            →  ${llmConfigured() ? "local + LLM refinement" : "klyro-local-v1 (offline)"}`);
  console.log(`  Studio auth          →  ${demoMode() ? "demo passphrase: klyro-studio (set STUDIO_PASSPHRASE!)" : "environment passphrase"}`);
  if (process.env.NODE_ENV !== "production") console.log(`  Frontend dev server  →  run "npm run dev:all"\n`);
  saveState();
});

export { server };
