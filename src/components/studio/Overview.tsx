import { BarBreakdown, Donut, TrendChart } from "./Charts";
import { money, shortDateTime } from "../../lib/api";
import { STATUS_LABELS } from "../../lib/options";
import type { Bootstrap, StudioTab, Insight } from "../../lib/types";

type Props = {
  data: Bootstrap;
  onOpenLead: (id: string) => void;
  onNavigate: (tab: StudioTab) => void;
};

function Kpi({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "good" | "warning" }) {
  return (
    <div className={`os-kpi ${tone ? `os-kpi-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

const insightLabel: Record<Insight["level"], string> = {
  good: "GOOD", warning: "ACTION", tip: "TIP", info: "INFO",
};

export default function Overview({ data, onOpenLead, onNavigate }: Props) {
  const { summary, enquiries, followups, activity } = data;
  const t = summary.totals;
  const due = followups
    .filter((f) => !f.done)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, 5);
  const statusItems = summary.byStatus.map((s) => ({ label: s.label, value: s.value }));

  return (
    <div className="os-stack">
      <div className="os-kpi-grid">
        <Kpi label="ENQUIRIES (30D)" value={String(t.inWindow)} note={`${t.enquiries} all-time · ${t.changeVsPrev7 >= 0 ? "+" : ""}${t.changeVsPrev7}% vs last week`} tone={t.changeVsPrev7 >= 0 ? "good" : "warning"} />
        <Kpi label="OPEN PIPELINE" value={String(t.open)} note={`${t.new} waiting for a first reply`} tone={t.new > 2 ? "warning" : undefined} />
        <Kpi label="HOT LEADS" value={String(t.hot)} note={`Avg. score ${t.avgScore}/100`} tone={t.hot ? "good" : undefined} />
        <Kpi label="PROPOSALS" value={String(t.proposals)} note={`${t.proposalToWinRate}% proposal → won`} />
        <Kpi label="WIN RATE" value={`${t.conversionRate}%`} note={`${t.won} won · ${t.lost} lost`} />
        <Kpi label="PIPELINE VALUE" value={money(t.pipelineValue)} note="Estimated open scope" />
      </div>

      <div className="os-grid-2">
        <section className="os-card os-card-wide">
          <div className="os-card-head">
            <div><p className="os-eyebrow">ENQUIRY VOLUME</p><h3>Last 14 days</h3></div>
            <span className="os-tag">{summary.trend.reduce((s, d) => s + d.count, 0)} enquiries</span>
          </div>
          <TrendChart data={summary.trend} />
        </section>

        <section className="os-card">
          <div className="os-card-head"><div><p className="os-eyebrow">PIPELINE</p><h3>By status</h3></div></div>
          <Donut items={statusItems} />
        </section>
      </div>

      <div className="os-grid-2">
        <section className="os-card">
          <div className="os-card-head"><div><p className="os-eyebrow">DEMAND</p><h3>Service mix</h3></div></div>
          <BarBreakdown items={summary.byService.map((s) => ({ label: s.label, value: s.value }))} />
          <div className="os-divider" />
          <p className="os-eyebrow">WHERE THEY COME FROM</p>
          <BarBreakdown items={summary.bySource.map((s) => ({ label: s.label, value: s.value }))} />
        </section>

        <section className="os-card">
          <div className="os-card-head">
            <div><p className="os-eyebrow">AUTOMATED INSIGHTS</p><h3>What to do next</h3></div>
          </div>
          <ul className="os-insights">
            {summary.insights.map((insight, i) => (
              <li key={i} className={`os-insight os-insight-${insight.level}`}>
                <span>{insightLabel[insight.level]}</span>
                <p>{insight.text}</p>
              </li>
            ))}
          </ul>
          <div className="os-quick-actions">
            <button type="button" onClick={() => onNavigate("prospects")}>Build a prospecting campaign →</button>
            <button type="button" onClick={() => onNavigate("reports")}>Open full reports →</button>
          </div>
        </section>
      </div>

      <div className="os-grid-2">
        <section className="os-card">
          <div className="os-card-head">
            <div><p className="os-eyebrow">PRIORITY</p><h3>Leads to reply to first</h3></div>
            <button type="button" className="os-ghost" onClick={() => onNavigate("enquiries")}>All enquiries →</button>
          </div>
          {summary.topLeads.length ? (
            <div className="os-table-wrap">
              <table className="os-table">
                <thead><tr><th>Lead</th><th>Score</th><th>Status</th><th>Service</th><th></th></tr></thead>
                <tbody>
                  {summary.topLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td><strong>{lead.company || lead.name}</strong><small>{lead.reference}</small></td>
                      <td><span className={`os-grade os-grade-${lead.grade}`}>{lead.score}</span></td>
                      <td>{STATUS_LABELS[lead.status] || lead.status}</td>
                      <td>{lead.service}</td>
                      <td><button type="button" className="os-link" onClick={() => onOpenLead(lead.id)}>Open</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="os-empty">No open leads yet. Submit an enquiry on the website to see it appear here.</p>}
        </section>

        <section className="os-card">
          <div className="os-card-head">
            <div><p className="os-eyebrow">FOLLOW-UPS</p><h3>{t.followupsDue} due or overdue</h3></div>
            <button type="button" className="os-ghost" onClick={() => onNavigate("enquiries")}>Manage →</button>
          </div>
          {due.length ? (
            <ul className="os-timeline">
              {due.map((f) => {
                const lead = enquiries.find((e) => e.id === f.enquiryId);
                // Relative due labels need the current clock at render time.
                // eslint-disable-next-line react-hooks/purity
                const hoursUntil = (new Date(f.dueAt).getTime() - Date.now()) / 3600000;
                const overdue = hoursUntil < 0;
                const when = overdue
                  ? `overdue by ${Math.max(1, Math.round(-hoursUntil))}h`
                  : hoursUntil < 24 ? `due in ${Math.max(1, Math.round(hoursUntil))}h` : `due in ${Math.round(hoursUntil / 24)}d`;
                return (
                  <li key={f.id}>
                    <span className={overdue ? "os-dot-alert" : "os-dot"} />
                    <div>
                      <strong>{f.type} · {lead?.company || lead?.name || "Lead"}</strong>
                      <p>{f.channel} · {when}</p>
                    </div>
                    <button type="button" className="os-link" onClick={() => onOpenLead(f.enquiryId)}>View</button>
                  </li>
                );
              })}
            </ul>
          ) : <p className="os-empty">No follow-ups due. Nice.</p>}
          <div className="os-divider" />
          <p className="os-eyebrow">RECENT ACTIVITY</p>
          <ul className="os-activity-mini">
            {activity.slice(0, 4).map((a) => (
              <li key={a.id}><strong>{a.title}</strong><span>{shortDateTime(a.at)}</span></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
