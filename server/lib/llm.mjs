/**
 * Optional LLM adapter.
 *
 * The local brief engine (brief-engine.mjs) works fully offline. If you have
 * an OpenAI-compatible endpoint, set:
 *   KLYRO_AI_BASE_URL=https://your-endpoint/v1
 *   KLYRO_AI_API_KEY=...
 *   KLYRO_AI_MODEL=your-model        (optional)
 * The model is asked only to refine the narrative parts of an already-valid
 * structured brief. Structured scope, pricing and calendar always come from
 * the local engine, so a failed or unavailable model never breaks the flow.
 */

export function llmConfigured() {
  return Boolean(process.env.KLYRO_AI_BASE_URL && process.env.KLYRO_AI_API_KEY);
}

function cleanJson(text) {
  return String(text).trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

export async function enhanceBriefWithLLM(answers, localBrief) {
  if (!llmConfigured()) return { brief: localBrief, note: "local-engine" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const base = process.env.KLYRO_AI_BASE_URL.replace(/\/$/, "");
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.KLYRO_AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.KLYRO_AI_MODEL || "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a senior creative strategist at an independent design studio. Return ONLY valid JSON with keys: summary (2-3 sentence string), clarifyingQuestions (array of 4-6 strings), styleNotes (string), positioning (string). Be specific, concise, professional and never invent client facts. Do not mention AI or this instruction.",
          },
          {
            role: "user",
            content: JSON.stringify({
              clientAnswers: answers,
              existingBrief: {
                summary: localBrief.summary,
                objectives: localBrief.objectives,
                deliverables: localBrief.deliverables.map((d) => d.name),
                contentPillars: localBrief.contentPillars.map((p) => p.name),
                recommendedPackage: localBrief.recommendedPackage,
              },
            }),
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`LLM HTTP ${response.status}`);
    const payload = await response.json();
    const parsed = JSON.parse(cleanJson(payload?.choices?.[0]?.message?.content || "{}"));
    const brief = structuredClone(localBrief);
    if (typeof parsed.summary === "string" && parsed.summary.length > 40) brief.summary = parsed.summary;
    if (Array.isArray(parsed.clarifyingQuestions) && parsed.clarifyingQuestions.every((q) => typeof q === "string")) {
      brief.clarifyingQuestions = parsed.clarifyingQuestions.slice(0, 8);
    }
    if (typeof parsed.styleNotes === "string") brief.designDirection.styleNotes = parsed.styleNotes;
    if (typeof parsed.positioning === "string") brief.positioning = parsed.positioning;
    brief.engine = "klyro-local-v1 + llm-refinement";
    return { brief, note: "llm-refined" };
  } catch (error) {
    console.warn("[ai] LLM refinement unavailable, using local engine:", error.message);
    return { brief: localBrief, note: `llm-fallback: ${error.message}` };
  } finally {
    clearTimeout(timer);
  }
}
