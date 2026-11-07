/**
 * Notification adapter.
 *
 * Email delivery is intentionally delegated to a webhook (Slack, Discord,
 * Zapier, Make, n8n, or your own mailer) so the app never needs SMTP
 * credentials or a mail dependency. Set STUDIO_WEBHOOK_URL or save the URL
 * in Studio > Settings. Without one, events are still recorded in the
 * in-app activity feed and nothing is lost.
 */

export async function notify(event, payload = {}, settings = {}) {
  const url = process.env.STUDIO_WEBHOOK_URL || settings.webhookUrl || "";
  if (!url) return { sent: false, reason: "no-webhook-configured" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const body = {
      text: payload.text,
      event,
      ...payload,
    };
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { sent: true };
  } catch (error) {
    console.warn("[notify] webhook delivery failed:", error.message);
    return { sent: false, reason: error.message };
  } finally {
    clearTimeout(timer);
  }
}

export function enquiryNotification(lead, autoReply) {
  return {
    text: `New ${lead.grade?.toUpperCase() || "NEW"} enquiry (${lead.score}/100) — ${lead.company || lead.name}: ${lead.service}. Ref ${lead.reference}. ${lead.analysis?.summary || ""}`,
    reference: lead.reference,
    name: lead.name,
    email: lead.email,
    company: lead.company,
    service: lead.service,
    score: lead.score,
    grade: lead.grade,
    source: lead.source,
    suggestedReply: autoReply?.body,
  };
}
