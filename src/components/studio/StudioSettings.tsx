import { useState, type FormEvent } from "react";
import { money, patch, post } from "../../lib/api";
import type { Settings } from "../../lib/types";

type Props = { settings: Settings; refresh: () => Promise<void> };

export default function StudioSettings({ settings, refresh }: Props) {
  const [form, setForm] = useState({
    studioName: settings.studioName,
    ownerEmail: settings.ownerEmail,
    responseSlaHours: String(settings.responseSlaHours),
    webhookUrl: settings.webhookUrl || "",
    autoReplyEnabled: settings.autoReplyEnabled,
    followUpDays: settings.followUpDays.join(", "),
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState("");

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await patch("/api/studio/settings", {
        studioName: form.studioName,
        ownerEmail: form.ownerEmail,
        responseSlaHours: Number(form.responseSlaHours) || 24,
        webhookUrl: form.webhookUrl.trim(),
        autoReplyEnabled: form.autoReplyEnabled,
        followUpDays: form.followUpDays.split(",").map((d) => Number(d.trim())).filter((d) => Number.isFinite(d) && d > 0),
      });
      setMessage("Settings saved. New enquiries will use these values.");
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save settings."); }
    finally { setSaving(false); }
  }

  async function testWebhook() {
    setTestResult("Sending…");
    try {
      const result = await post<{ sent: boolean; reason?: string; configured: boolean }>("/api/studio/settings/test-webhook", {});
      setTestResult(result.sent ? "✅ Webhook delivered." : result.configured ? `⚠️ Delivery failed: ${result.reason || "unknown error"}` : "No webhook URL configured yet — save one above first.");
    } catch (err) { setTestResult(err instanceof Error ? err.message : "Test failed."); }
  }

  async function clearDemo() {
    if (!window.confirm("Remove all sample enquiries, prospects and follow-ups? Real records are kept.")) return;
    try {
      const result = await post<{ removed: number }>("/api/studio/settings/clear-demo", {});
      setMessage(`${result.removed} demo records removed. Your workspace is ready for real clients.`);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not clear demo data."); }
  }

  return (
    <div className="os-stack">
      <section className="os-card">
        <div className="os-card-head"><div><p className="os-eyebrow">STUDIO PROFILE</p><h3>How the automation speaks for you</h3></div></div>
        <form onSubmit={save} className="os-settings-form">
          <div className="os-form-grid">
            <label>Studio name<input value={form.studioName} onChange={(e) => set("studioName", e.target.value)} /></label>
            <label>Reply-to email<input type="email" value={form.ownerEmail} onChange={(e) => set("ownerEmail", e.target.value)} /></label>
            <label>Response promise (hours)<input type="number" min={1} max={168} value={form.responseSlaHours} onChange={(e) => set("responseSlaHours", e.target.value)} /></label>
            <label>Follow-up days (comma separated)<input value={form.followUpDays} onChange={(e) => set("followUpDays", e.target.value)} placeholder="1, 3, 7" /></label>
            <label className="os-wide">Notification webhook URL<input value={form.webhookUrl} onChange={(e) => set("webhookUrl", e.target.value)} placeholder="https://hooks.slack.com/… or a Zapier / Make / n8n URL" /></label>
          </div>
          <label className="os-checkbox">
            <input type="checkbox" checked={form.autoReplyEnabled} onChange={(e) => set("autoReplyEnabled", e.target.checked)} />
            <span>Prepare a personalised auto-reply for every new enquiry</span>
          </label>
          <div className="os-inline-actions">
            <button type="submit" className="os-primary" disabled={saving}>{saving ? "Saving…" : "Save settings"}</button>
            <button type="button" className="os-ghost" onClick={() => void testWebhook()}>Test webhook</button>
          </div>
          {testResult && <p className="os-muted">{testResult}</p>}
          {message && <div className="os-banner os-banner-good">{message}</div>}
          {error && <div className="os-banner os-banner-warning">{error}</div>}
        </form>
      </section>

      <div className="os-grid-2">
        <section className="os-card">
          <div className="os-card-head"><div><p className="os-eyebrow">PRICING TIERS</p><h3>Used by the brief engine</h3></div></div>
          <div className="os-table-wrap">
            <table className="os-table">
              <thead><tr><th>Package</th><th>Min</th><th>Max</th></tr></thead>
              <tbody>
                {Object.entries(settings.packages).map(([name, pkg]) => (
                  <tr key={name}><td><strong>{name}</strong></td><td>{money(pkg.min)}</td><td>{money(pkg.max)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="os-muted">The engine picks a tier from the client's budget, number of deliverables and posting volume. Edit the ranges in <code>data/klyro.json</code> or via the API if your pricing changes.</p>
        </section>

        <section className="os-card">
          <div className="os-card-head"><div><p className="os-eyebrow">WORKSPACE DATA</p><h3>Storage & demo records</h3></div></div>
          <p className="os-muted">
            All enquiries, briefs, proposals, prospects and settings live in a single local JSON file
            (<code>data/klyro.json</code>). No third-party database, no client data leaving your server.
            Back up that file before deploying.
          </p>
          <button type="button" className="os-danger" onClick={() => void clearDemo()}>Clear all demo data</button>
          <div className="os-divider" />
          <p className="os-subhead">OPTIONAL INTEGRATIONS</p>
          <ul className="os-bullets">
            <li><code>STUDIO_PASSPHRASE</code> — set a real Studio password before going live.</li>
            <li><code>STUDIO_WEBHOOK_URL</code> — Slack / Discord / Zapier / Make alerts for new enquiries and approvals.</li>
            <li><code>KLYRO_AI_BASE_URL</code> + <code>KLYRO_AI_API_KEY</code> — optional OpenAI-compatible model to refine brief narratives.</li>
            <li><code>npm run report -- --days 7 --send</code> — scheduled enquiry digest to your webhook.</li>
          </ul>
        </section>
      </div>

      <section className="os-card">
        <div className="os-card-head"><div><p className="os-eyebrow">HOW THE AUTOMATION WORKS</p><h3>From visitor to signed client</h3></div></div>
        <ol className="os-flow">
          <li><strong>01 · Attract</strong><span>AI Brief Studio gives every visitor a free, tailored requirement document — the highest-intent lead magnet on the site.</span></li>
          <li><strong>02 · Capture</strong><span>Contact form and brief submissions are saved with source, budget, timeline, intent and a transparent 0–100 fit score.</span></li>
          <li><strong>03 · Nurture</strong><span>Auto-reply drafts, follow-ups at day 1/3/7, webhook alerts and an activity feed make sure no hot lead goes cold.</span></li>
          <li><strong>04 · Close</strong><span>One click turns an enquiry into a brief and a shareable proposal the client can approve online; approval marks the lead Won.</span></li>
          <li><strong>05 · Report</strong><span>Live KPIs, service/source mix, win rate, priority leads, CSV exports and scheduled Markdown digests.</span></li>
        </ol>
      </section>
    </div>
  );
}
