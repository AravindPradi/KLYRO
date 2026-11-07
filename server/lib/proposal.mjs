import { uid, token, now } from "./store.mjs";

const TERMS = [
  "50% advance to begin, 50% on final handover. Payments via UPI / bank transfer.",
  "Two rounds of revisions are included per deliverable group; extra rounds are quoted before work starts.",
  "Final editable source files (AI / PSD / Figma / Canva) are handed over after the balance payment.",
  "The estimate excludes printing, paid ads, stock licences and third-party tools.",
  "Timeline assumes feedback within 3 working days of each review.",
  "This proposal is valid for 14 days from the date above.",
];

export function buildProposal(lead = {}, brief = {}, settings = {}, existing = {}) {
  const estimate = brief.estimate || { min: 25000, max: 60000, currency: "INR", retainerNote: "" };
  const validUntil = new Date(Date.now() + 14 * 86400000).toISOString();
  return {
    id: existing.id || uid("prop"),
    token: existing.token || token(),
    enquiryId: lead.id || null,
    briefId: brief.id || lead.briefId || null,
    createdAt: existing.createdAt || now(),
    updatedAt: now(),
    validUntil,
    status: existing.status || "sent",
    approvedAt: existing.approvedAt || null,
    clientName: lead.name || "",
    clientCompany: lead.company || lead.name || "",
    studioName: settings.studioName || "KLYRO Creative Studio",
    ownerEmail: settings.ownerEmail || "",
    title: `Proposal for ${lead.company || lead.name || "your project"}`,
    summary: brief.summary || "A focused creative scope based on your enquiry.",
    objectives: (brief.objectives || []).map((o) => o.title),
    package: brief.recommendedPackage || { name: "Growth", range: "₹25,000 – ₹60,000" },
    deliverables: brief.deliverables || [],
    timeline: brief.timeline || [],
    investment: {
      min: estimate.min,
      max: estimate.max,
      currency: estimate.currency || "INR",
      note: estimate.retainerNote || "",
    },
    terms: TERMS,
    nextSteps: [
      "Reply with an approval or any edits to the scope.",
      "We send the invoice and a short kick-off questionnaire.",
      "Work begins on the next available Monday.",
    ],
  };
}

export function proposalToMarkdown(p) {
  return [
    `# ${p.title}`,
    "",
    `_${p.studioName} · ${new Date(p.createdAt).toLocaleDateString("en-IN", { dateStyle: "long" })} · valid until ${new Date(p.validUntil).toLocaleDateString("en-IN", { dateStyle: "long" })}_`,
    "",
    p.summary,
    "",
    `## Recommended package: ${p.package.name} — ${p.package.range}`,
    "",
    "## Objectives",
    ...p.objectives.map((o) => `- ${o}`),
    "",
    "## Deliverables",
    ...p.deliverables.map((d) => `- **${d.name}** (${d.quantity}) — ${d.detail}`),
    "",
    "## Investment",
    `₹${p.investment.min.toLocaleString("en-IN")} – ₹${p.investment.max.toLocaleString("en-IN")}. ${p.investment.note}`,
    "",
    "## Timeline",
    ...p.timeline.map((t) => `- **${t.phase}** (${t.duration}): ${t.outcome}`),
    "",
    "## Terms",
    ...p.terms.map((t) => `- ${t}`),
    "",
    "## Next steps",
    ...p.nextSteps.map((t) => `- ${t}`),
    "",
    `Questions? ${p.ownerEmail}`,
    "",
  ].join("\n");
}
