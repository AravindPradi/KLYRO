import { useEffect, useState } from "react";
import { copyText, download, get, money } from "../../lib/api";
import { STATUS_LABELS } from "../../lib/options";
import { BarBreakdown, TrendChart } from "./Charts";
import type { Summary } from "../../lib/types";

type Props = { initialSummary: Summary; onOpenLead: (id: string) => void };

export default function Reports({ initialSummary, onOpenLead }: Props) {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [digest, setDigest] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      get<{ summary: Summary }>(`/api/studio/reports/summary?days=${days}`),
      get<string>(`/api/studio/reports/digest.md?days=${days}`),
    ])
      .then(([s, d]) => { if (!cancelled) { setSummary(s.summary); setDigest(d); } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Could not build the report."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  const t = summary.totals;

  const changeRange = (value: number) => {
    if (value === days) return;
    setLoading(true);
    setDays(value);
  };

  return (
    <div className="os-stack">
      <section className="os-card">
        <div className="os-card-head">
          <div>
            <p className="os-eyebrow">ENQUIRY REPORT</p>
            <h3>Last {days} days {loading ? "· refreshing…" : ""}</h3>
          </div>
          <div className="os-range">
            {[7, 30, 90].map((d) => (
              <button key={d} type="button" className={days === d ? "is-active" : ""} onClick={() => changeRange(d)}>{d}d</button>
            ))}
          </div>
        </div>
        <div className="os-kpi-grid os-kpi-grid-6">
          <div className="os-kpi"><span>ENQUIRIES</span><strong>{t.inWindow}</strong><small>{t.enquiries} all-time</small></div>
          <div className="os-kpi"><span>HOT LEADS</span><strong>{t.hot}</strong><small>{t.followupsDue} follow-ups due</small></div>
          <div className="os-kpi"><span>PROPOSALS</span><strong>{t.proposals}</strong><small>{t.proposalToWinRate}% → won</small></div>
          <div className="os-kpi"><span>WIN RATE</span><strong>{t.conversionRate}%</strong><small>{t.won} won · {t.lost} lost</small></div>
          <div className="os-kpi"><span>PIPELINE VALUE</span><strong>{money(t.pipelineValue)}</strong><small>Estimated open scope</small></div>
          <div className="os-kpi"><span>AVG. FIRST RESPONSE</span><strong>{t.avgFirstResponseHours}h</strong><small>Time to first status change</small></div>
        </div>
      </section>

      {error && <div className="os-banner os-banner-warning">{error}</div>}

      <div className="os-grid-2">
        <section className="os-card os-card-wide">
          <div className="os-card-head"><div><p className="os-eyebrow">VOLUME</p><h3>Enquiries per day</h3></div></div>
          <TrendChart data={summary.trend} />
        </section>
        <section className="os-card">
          <div className="os-card-head"><div><p className="os-eyebrow">BREAKDOWN</p><h3>By status</h3></div></div>
          <BarBreakdown items={summary.byStatus.map((s) => ({ label: s.label, value: s.value }))} />
          <div className="os-divider" />
          <p className="os-eyebrow">BY SERVICE</p>
          <BarBreakdown items={summary.byService.map((s) => ({ label: s.label, value: s.value }))} />
        </section>
      </div>

      <div className="os-grid-2">
        <section className="os-card">
          <div className="os-card-head"><div><p className="os-eyebrow">ATTRIBUTION</p><h3>Sources & intent</h3></div></div>
          <p className="os-subhead">WHERE ENQUIRIES COME FROM</p>
          <BarBreakdown items={summary.bySource.map((s) => ({ label: s.label, value: s.value }))} />
          <div className="os-divider" />
          <p className="os-subhead">WHAT THEY ASK FOR</p>
          <BarBreakdown items={summary.byIntent.map((s) => ({ label: s.label, value: s.value }))} />
        </section>

        <section className="os-card">
          <div className="os-card-head"><div><p className="os-eyebrow">RECOMMENDATIONS</p><h3>Auto-generated insights</h3></div></div>
          <ul className="os-insights">
            {summary.insights.map((i, index) => (
              <li key={index} className={`os-insight os-insight-${i.level}`}><span>{i.level.toUpperCase()}</span><p>{i.text}</p></li>
            ))}
          </ul>
          <div className="os-divider" />
          <p className="os-subhead">PRIORITY LEADS</p>
          <ul className="os-report-leads">
            {summary.topLeads.map((l) => (
              <li key={l.id}>
                <button type="button" className="os-link" onClick={() => onOpenLead(l.id)}>{l.company || l.name} →</button>
                <span>{l.score}/100 · {STATUS_LABELS[l.status] || l.status}</span>
              </li>
            ))}
            {!summary.topLeads.length && <li className="os-empty">No open leads in this window.</li>}
          </ul>
        </section>
      </div>

      <section className="os-card">
        <div className="os-card-head">
          <div><p className="os-eyebrow">EXPORTS & DIGESTS</p><h3>Take the report with you</h3></div>
        </div>
        <div className="os-export-actions">
          <button type="button" className="os-primary" onClick={() => download(`/api/studio/reports/enquiries.csv`).catch(() => undefined)}>All enquiries · CSV ↓</button>
          <button type="button" className="os-ghost" onClick={() => download(`/api/studio/reports/digest.md?days=${days}`).catch(() => undefined)}>Report · Markdown ↓</button>
          <button type="button" className="os-ghost" onClick={() => download("/api/studio/reports/prospect-template.csv").catch(() => undefined)}>Prospect CSV template ↓</button>
          <button type="button" className="os-ghost" onClick={async () => { setCopied(await copyText(digest)); window.setTimeout(() => setCopied(false), 1800); }}>{copied ? "Digest copied ✓" : "Copy digest"}</button>
          <a className="os-ghost" href={`mailto:?subject=${encodeURIComponent(`KLYRO enquiry report — last ${days} days`)}&body=${encodeURIComponent(digest.slice(0, 1800))}`}>Email digest ↗</a>
        </div>
        <div className="os-digest">
          <pre>{digest || "Building digest…"}</pre>
        </div>
        <div className="os-note">
          <strong>Automate it:</strong> run <code>npm run report -- --days 7 --send</code> on a daily cron,
          or set <code>STUDIO_WEBHOOK_URL</code> in Settings to receive new-enquiry alerts in Slack,
          Discord, Zapier or your email automation.
        </div>
      </section>
    </div>
  );
}
