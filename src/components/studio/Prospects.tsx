import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { copyText, download, get, patch, post, shortDate } from "../../lib/api";
import type { Bootstrap, Campaign, Prospect } from "../../lib/types";

type Props = { data: Bootstrap; refresh: () => Promise<void> };

const STATUS_OPTIONS = ["researched", "contacted", "replied", "converted", "skipped"];

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" className="os-ghost" onClick={async () => { setDone(await copyText(text)); window.setTimeout(() => setDone(false), 1800); }}>{done ? "Copied ✓" : "Copy"}</button>;
}

function toCsvRow(p: Prospect | Campaign["sampleTargets"][number]) {
  const cells = [p.name, p.niche, p.city, p.instagram || "", p.website || "", p.email || "", String(p.followers || 0), String(p.postsPerWeek || 0), String(p.lastPostDays || 0), p.signal || "", "researched"];
  return cells.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",");
}

export default function Prospects({ data, refresh }: Props) {
  const [niche, setNiche] = useState("independent cafés and small D2C brands");
  const [city, setCity] = useState("Kochi, Kerala");
  const [platform, setPlatform] = useState("Instagram");
  const [offer, setOffer] = useState("a free 1-page creative brief");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [generating, setGenerating] = useState(false);
  const [csv, setCsv] = useState("");
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    get<{ campaigns: Campaign[] }>("/api/studio/campaigns")
      .then((r) => { if (r.campaigns?.[0]) setCampaign(r.campaigns[0]); })
      .catch(() => undefined);
  }, []);

  const prospects = useMemo(() => {
    const items = filter === "all" ? data.prospects : data.prospects.filter((p) => p.grade === filter);
    return [...items].sort((a, b) => b.score - a.score);
  }, [data.prospects, filter]);

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const result = await post<{ campaign: Campaign }>("/api/studio/prospects/campaign", { niche, city, platform, offer });
      setCampaign(result.campaign);
      setMessage("Campaign generated. Search strings, qualification signals and outreach scripts are ready below.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not generate a campaign."); }
    finally { setGenerating(false); }
  }

  async function importCsv(text: string) {
    if (!text.trim()) { setError("Paste CSV data or choose a file first."); return; }
    setImporting(true);
    setError("");
    try {
      const result = await post<{ imported: number; skipped: number }>("/api/studio/prospects/import", { csv: text });
      setMessage(`${result.imported} prospects imported and scored. ${result.skipped} duplicates skipped.`);
      setCsv("");
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Import failed."); }
    finally { setImporting(false); }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsv(await file.text());
  }

  async function updateProspect(id: string, body: Record<string, unknown>) {
    await patch(`/api/studio/prospects/${id}`, body).catch((err) => setError(String(err)));
    await refresh();
  }

  async function addSample(p: Campaign["sampleTargets"][number]) {
    await importCsv(`name,niche,city,instagram,website,email,followers,postsPerWeek,lastPostDays,signal,status\n${toCsvRow(p)}`);
  }

  const previewName = campaign?.sampleTargets[0]?.name || "a local brand";

  return (
    <div className="os-stack">
      <section className="os-card">
        <div className="os-card-head">
          <div>
            <p className="os-eyebrow">FIND NEW CUSTOMERS</p>
            <h3>Build a prospecting campaign</h3>
          </div>
          <span className="os-tag">No scraping · compliant research</span>
        </div>
        <p className="os-muted">
          Describe who you want to work with. The engine writes a repeatable search playbook,
          a qualification rubric and a three-touch outreach sequence. Collect real businesses
          yourself (or from an authorised API), import them as CSV, and the fit score ranks them.
        </p>
        <div className="os-form-grid">
          <label>Niche / segment<input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. boutique cafés, yoga studios" /></label>
          <label>City / region<input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Kochi, Kerala" /></label>
          <label>Platform<select value={platform} onChange={(e) => setPlatform(e.target.value)}><option>Instagram</option><option>LinkedIn</option><option>Google Maps</option><option>Local directories</option></select></label>
          <label>Your opening offer<input value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="a free 1-page creative brief" /></label>
        </div>
        <div className="os-inline-actions">
          <button type="button" className="os-primary" onClick={() => void generate()} disabled={generating}>{generating ? "Building playbook…" : "Generate campaign ↗"}</button>
          <button type="button" className="os-ghost" onClick={() => download("/api/studio/reports/prospect-template.csv").catch(() => undefined)}>CSV template ↓</button>
        </div>
        {message && <div className="os-banner os-banner-good">{message}</div>}
        {error && <div className="os-banner os-banner-warning">{error}</div>}
      </section>

      {campaign && (
        <>
          <section className="os-card os-card-accent">
            <p className="os-eyebrow">PLAYBOOK · {shortDate(campaign.createdAt)}</p>
            <h3>{campaign.headline}</h3>
            <p className="os-muted">{campaign.summary}</p>
            <div className="os-segments">
              {campaign.segments.map((s) => (
                <div key={s.name}><strong>{s.name}</strong><p>{s.why}</p><small>{s.where}</small></div>
              ))}
            </div>
          </section>

          <div className="os-grid-2">
            <section className="os-card">
              <div className="os-card-head"><div><p className="os-eyebrow">STEP 1</p><h3>Where to look</h3></div></div>
              <ul className="os-search-list">
                {campaign.searchStrings.map((s) => (
                  <li key={s.label + s.channel}>
                    <div><span>{s.channel}</span><strong>{s.label}</strong><code>{s.query}</code></div>
                    <CopyBtn text={s.query} />
                  </li>
                ))}
              </ul>
              <div className="os-divider" />
              <p className="os-subhead">30-MINUTE DAILY LOOP</p>
              <ol className="os-ordered">{campaign.dailyWorkflow.map((w) => <li key={w}>{w}</li>)}</ol>
            </section>

            <section className="os-card">
              <div className="os-card-head"><div><p className="os-eyebrow">STEP 2</p><h3>Qualification signals</h3></div></div>
              <div className="os-table-wrap">
                <table className="os-table">
                  <thead><tr><th>Signal</th><th>Points</th><th>Why it matters</th></tr></thead>
                  <tbody>{campaign.qualificationSignals.map((q) => <tr key={q.signal}><td><strong>{q.signal}</strong></td><td>+{q.points}</td><td>{q.meaning}</td></tr>)}</tbody>
                </table>
              </div>
              <div className="os-divider" />
              <p className="os-subhead">SAMPLE RESEARCH TARGETS <span>(illustrative, not real businesses)</span></p>
              <ul className="os-samples">
                {campaign.sampleTargets.map((t) => (
                  <li key={t.name}>
                    <div><strong>{t.name}</strong><span>{t.signal}</span></div>
                    <span className={`os-grade os-grade-${t.grade}`}>{t.score}</span>
                    <button type="button" className="os-ghost" onClick={() => void addSample(t)}>Add</button>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="os-card">
            <div className="os-card-head">
              <div><p className="os-eyebrow">STEP 3</p><h3>Outreach sequence</h3></div>
              <span className="os-tag">Previewed for “{previewName}”</span>
            </div>
            <div className="os-outreach">
              {campaign.outreach.map((step) => {
                const body = step.body
                  .replaceAll("{{name}}", previewName)
                  .replaceAll("{{first_name}}", previewName.split(/\s+/)[0])
                  .replaceAll("{{observation}}", "Your recent posts have a lovely sense of place — a consistent visual system could carry that even further.")
                  .replaceAll("{{pain}}", "a more consistent visual presence");
                return (
                  <article key={step.step}>
                    <div className="os-outreach-head"><span>{step.when}</span><strong>{step.label}</strong><small>{step.channel}</small></div>
                    <p className="os-subhead">SUBJECT · {step.subject.replaceAll("{{name}}", previewName).replaceAll("{{first_name}}", previewName.split(/\s+/)[0])}</p>
                    <pre>{body}</pre>
                    <CopyBtn text={body} />
                  </article>
                );
              })}
            </div>
            <div className="os-note"><strong>Stay compliant:</strong> {campaign.compliance}</div>
          </section>
        </>
      )}

      <section className="os-card">
        <div className="os-card-head">
          <div><p className="os-eyebrow">PROSPECT LIST</p><h3>{data.prospects.length} researched businesses</h3></div>
          <div className="os-range">
            {["all", "hot", "warm", "cool"].map((f) => (
              <button key={f} type="button" className={filter === f ? "is-active" : ""} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>
        <div className="os-table-wrap">
          <table className="os-table">
            <thead><tr><th>Business</th><th>Niche / city</th><th>Signal</th><th>Score</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {prospects.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong><small>{p.instagram || p.email || "—"}{p.demo ? " · DEMO" : ""}</small></td>
                  <td>{p.niche || "—"}<small>{p.city}</small></td>
                  <td>{p.signal || "—"}</td>
                  <td><span className={`os-grade os-grade-${p.grade}`}>{p.score}</span></td>
                  <td>
                    <select value={p.status} onChange={(e) => void updateProspect(p.id, { status: e.target.value })}>
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td>{p.status !== "converted" && <button type="button" className="os-link" onClick={() => void updateProspect(p.id, { status: "converted" })}>Convert →</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!prospects.length && <p className="os-empty">No prospects in this filter yet.</p>}
      </section>

      <section className="os-card">
        <div className="os-card-head"><div><p className="os-eyebrow">IMPORT REAL LEADS</p><h3>CSV import & automatic scoring</h3></div></div>
        <p className="os-muted">
          Columns: <code>name, niche, city, instagram, website, email, followers, postsPerWeek, lastPostDays, signal, status</code>.
          Only <code>name</code> is required. Use your own research, referrals or an authorised API export.
        </p>
        <div className="os-import">
          <textarea rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="name,niche,city,instagram,website,email,followers,postsPerWeek,lastPostDays,signal,status" />
          <div className="os-import-actions">
            <label className="os-file">Choose .csv file<input type="file" accept=".csv,text/csv" onChange={(e) => void onFile(e)} /></label>
            <button type="button" className="os-primary" disabled={importing} onClick={() => void importCsv(csv)}>{importing ? "Importing…" : "Import & score ↗"}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
