import { briefToMarkdown } from "./brief-engine.mjs";
import { llmConfigured } from "./llm.mjs";

export const STATUS_LABELS = {
  new: "New", contacted: "Contacted", qualified: "Qualified",
  proposal: "Proposal sent", won: "Won", lost: "Lost",
};
export const SERVICE_LABELS = {
  design: "Graphic Design", instagram: "Instagram Curation",
  both: "Both Services", unsure: "Not Sure Yet",
};
export const SOURCE_LABELS = {
  "contact-form": "Website contact form", "brief-studio": "AI Brief Studio",
  proposal: "Proposal approval", csv: "Prospect CSV import", manual: "Manual entry", demo: "Demo data",
};

function startOfDay(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function dateKey(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

function countBy(items, fn) {
  const map = new Map();
  for (const item of items) {
    const key = fn(item);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);
}

export function buildSummary(state, days = 30) {
  const all = state.enquiries || [];
  const cutoff = Date.now() - days * 86400000;
  const inWindow = all.filter((e) => new Date(e.createdAt).getTime() >= cutoff);
  const won = all.filter((e) => e.status === "won");
  const lost = all.filter((e) => e.status === "lost");
  const decided = won.length + lost.length;
  const proposals = (state.proposals || []).length;
  const hot = all.filter((e) => e.grade === "hot");
  const open = all.filter((e) => !["won", "lost"].includes(e.status));
  const followupsDue = (state.followups || []).filter((f) => !f.done && new Date(f.dueAt).getTime() <= Date.now() + 86400000);

  const trend = [];
  const today = startOfDay(Date.now());
  const trendDays = Math.min(14, Math.max(7, days));
  for (let i = trendDays - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = dateKey(d.toISOString());
    trend.push({ date: key, count: inWindow.filter((e) => dateKey(e.createdAt) === key).length });
  }

  const last7 = all.filter((e) => new Date(e.createdAt).getTime() >= Date.now() - 7 * 86400000);
  const prev7 = all.filter((e) => {
    const t = new Date(e.createdAt).getTime();
    return t >= Date.now() - 14 * 86400000 && t < Date.now() - 7 * 86400000;
  });

  const byStatus = countBy(all, (e) => e.status || "new").map((x) => ({ ...x, label: STATUS_LABELS[x.key] || x.key }));
  const byService = countBy(all, (e) => e.serviceKey || "unsure").map((x) => ({ ...x, label: SERVICE_LABELS[x.key] || x.key }));
  const bySource = countBy(all, (e) => e.source || "manual").map((x) => ({ ...x, label: SOURCE_LABELS[x.key] || x.key }));
  const byIntent = countBy(all, (e) => e.analysis?.primaryIntent || "Unclassified").map((x) => ({ key: x.key, label: x.key, value: x.value }));

  const avgScore = all.length ? Math.round(all.reduce((s, e) => s + (e.score || 0), 0) / all.length) : 0;
  const pipelineValue = open.reduce((sum, e) => {
    const brief = (state.briefs || []).find((b) => b.id === e.briefId);
    return sum + (brief?.brief?.estimate?.min || (e.grade === "hot" ? 40000 : e.grade === "warm" ? 25000 : 12000));
  }, 0);

  const responded = all.filter((e) => e.status !== "new");
  const responseHours = responded.length
    ? responded.reduce((sum, e) => {
        const delta = (new Date(e.updatedAt || e.createdAt) - new Date(e.createdAt)) / 3600000;
        return sum + Math.max(0, Math.min(720, delta));
      }, 0) / responded.length
    : 0;

  const insights = buildInsights({ all, inWindow, last7, prev7, won, lost, hot, open, proposals, bySource, byService, followupsDue, state });

  return {
    generatedAt: new Date().toISOString(),
    windowDays: days,
    totals: {
      enquiries: all.length,
      inWindow: inWindow.length,
      last7: last7.length,
      changeVsPrev7: prev7.length ? Math.round(((last7.length - prev7.length) / prev7.length) * 100) : last7.length ? 100 : 0,
      new: all.filter((e) => e.status === "new").length,
      hot: hot.length,
      open: open.length,
      won: won.length,
      lost: lost.length,
      conversionRate: decided ? Math.round((won.length / decided) * 100) : 0,
      proposalToWinRate: proposals ? Math.round((won.length / proposals) * 100) : 0,
      proposals,
      avgScore,
      pipelineValue,
      avgFirstResponseHours: Number(responseHours.toFixed(1)),
      followupsDue: followupsDue.length,
      demoRecords: all.filter((e) => e.demo).length + (state.prospects || []).filter((p) => p.demo).length,
      aiEngine: llmConfigured() ? "local engine + LLM refinement" : "klyro-local-v1 (offline)",
    },
    trend,
    byStatus, byService, bySource, byIntent,
    topLeads: [...open].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5).map((e) => ({ id: e.id, name: e.name, company: e.company, score: e.score, grade: e.grade, status: e.status, service: e.service, createdAt: e.createdAt, reference: e.reference })),
    recentActivity: (state.activity || []).slice(0, 8),
    insights,
  };
}

function buildInsights({ all, inWindow, last7, prev7, won, lost, hot, open, proposals, bySource, byService, followupsDue, state }) {
  const out = [];
  if (last7.length === 0) out.push({ level: "warning", text: "No enquiries in the last 7 days. Run one prospecting campaign and post two portfolio-led pieces this week." });
  else if (prev7.length && last7.length > prev7.length) out.push({ level: "good", text: `Enquiries are up ${Math.round(((last7.length - prev7.length) / prev7.length) * 100)}% week over week. Keep the channel that produced them active.` });
  else if (prev7.length && last7.length < prev7.length) out.push({ level: "warning", text: `Enquiries are down ${Math.round(((prev7.length - last7.length) / prev7.length) * 100)}% week over week. Check the site form and refresh your outreach.` });

  const studioShare = inWindow.filter((e) => e.source === "brief-studio").length;
  if (studioShare >= 2) out.push({ level: "good", text: `${studioShare} of ${inWindow.length} recent enquiries came through the AI Brief Studio — visitors who complete a brief are the highest-intent segment. Link to it from your Instagram bio.` });
  else if (all.length) out.push({ level: "tip", text: "Add the free AI Brief Studio link to your Instagram bio and pinned post; it converts better than a plain contact form because visitors leave with something useful." });

  const hotNeglected = hot.filter((e) => e.status === "new");
  if (hotNeglected.length) out.push({ level: "warning", text: `${hotNeglected.length} hot lead${hotNeglected.length > 1 ? "s" : ""} still marked New. Reply within 24 hours — speed is the biggest conversion lever here.` });
  if (followupsDue.length) out.push({ level: "warning", text: `${followupsDue.length} follow-up${followupsDue.length > 1 ? "s are" : " is"} due or overdue. Use the suggested scripts in the Enquiries drawer.` });
  if (proposals && won.length / Math.max(1, proposals) < 0.4) out.push({ level: "tip", text: "Proposal-to-win is under 40%. Send a shorter scope with a clear payment schedule and a 14-day validity to create a decision point." });
  if (won.length + lost.length >= 3 && won.length / (won.length + lost.length) < 0.4) out.push({ level: "warning", text: "Win rate is below 40%. Qualify budget earlier in the first reply and offer a small paid starter scope." });
  const topService = byService[0];
  if (topService) out.push({ level: "info", text: `Most requested category: ${topService.label} (${topService.value} enquiries). Build one case study around it for the next outreach wave.` });
  const topSource = bySource[0];
  if (topSource) out.push({ level: "info", text: `Top source: ${topSource.label} (${topSource.value}). Double down on that channel before adding new ones.` });
  if (!followupsDue.length && !hotNeglected.length && last7.length) out.push({ level: "good", text: "Pipeline hygiene looks good: no overdue follow-ups and no hot leads waiting." });
  if ((state.prospects || []).length < 5) out.push({ level: "tip", text: "Prospect list is thin. Generate a campaign in Find Customers and import 5–10 researched businesses as CSV." });
  if (!out.length) out.push({ level: "tip", text: "Submit your first enquiry through the website contact form to see the pipeline come alive." });
  return out;
}

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function enquiriesToCsv(enquiries = []) {
  const headers = ["Reference", "Created", "Name", "Email", "Company", "Instagram", "Service", "Budget", "Timeline", "Source", "Status", "Score", "Grade", "Primary intent", "Message", "Notes"];
  const rows = enquiries.map((e) => [
    e.reference, e.createdAt, e.name, e.email, e.company, e.instagram, e.service,
    e.budget, e.timeline, e.source, STATUS_LABELS[e.status] || e.status, e.score,
    e.grade, e.analysis?.primaryIntent, e.message, (e.notes || []).map((n) => n.text).join(" | "),
  ]);
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

export function prospectTemplateCsv() {
  return [
    "name,niche,city,instagram,website,email,followers,postsPerWeek,lastPostDays,signal,status",
    'Example Bakery,Café / F&B,"Kochi, Kerala",@examplebakery,,hello@example.com,3200,1,18,Strong reviews but stale grid,researched',
  ].join("\n") + "\n";
}

export function digestMarkdown(state, days, summary) {
  const lines = [
    `# KLYRO Studio — enquiry report`,
    "",
    `_${new Date(summary.generatedAt).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })} · window: last ${days} days_`,
    "",
    "## At a glance",
    "",
    "| Metric | Value |",
    "| --- | --- |",
    `| Enquiries (${days}d) | ${summary.totals.inWindow} |`,
    `| Total enquiries | ${summary.totals.enquiries} |`,
    `| Open pipeline | ${summary.totals.open} |`,
    `| Hot leads | ${summary.totals.hot} |`,
    `| Proposals sent | ${summary.totals.proposals} |`,
    `| Won / lost | ${summary.totals.won} / ${summary.totals.lost} |`,
    `| Win rate | ${summary.totals.conversionRate}% |`,
    `| Average lead score | ${summary.totals.avgScore}/100 |`,
    `| Est. open pipeline value | ₹${summary.totals.pipelineValue.toLocaleString("en-IN")} |`,
    `| Follow-ups due | ${summary.totals.followupsDue} |`,
    "",
    "## Service mix",
    ...summary.byService.map((s) => `- ${s.label}: ${s.value}`),
    "",
    "## Where enquiries come from",
    ...summary.bySource.map((s) => `- ${s.label}: ${s.value}`),
    "",
    "## Pipeline",
    ...summary.byStatus.map((s) => `- ${s.label}: ${s.value}`),
    "",
    "## Priority leads",
    ...(summary.topLeads.length ? summary.topLeads.map((l) => `- **${l.company || l.name}** — ${l.score}/100 (${l.grade}), ${STATUS_LABELS[l.status] || l.status}, ${l.service}`) : ["- No open leads right now."]),
    "",
    "## Recommendations",
    ...summary.insights.map((i) => `- ${i.level.toUpperCase()}: ${i.text}`),
    "",
    "---",
    "",
    `Generated by KLYRO Studio OS · ${summary.totals.aiEngine}. Demo records in this workspace: ${summary.totals.demoRecords}.`,
    "",
  ];
  return lines.join("\n");
}

export { briefToMarkdown };
