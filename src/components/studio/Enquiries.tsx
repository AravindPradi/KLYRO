import { useEffect, useMemo, useState } from "react";
import { copyText, download, get, patch, post, money, shortDate, shortDateTime } from "../../lib/api";
import { SOURCE_LABELS, SERVICE_LABELS, STATUS_LABELS, STATUS_OPTIONS } from "../../lib/options";
import type { Bootstrap, Brief, Enquiry, Followup, Proposal, Activity, Deliverable } from "../../lib/types";

type Detail = {
  enquiry: Enquiry;
  brief: (Brief & { shareToken?: string }) | null;
  proposal: Proposal | null;
  followups: Followup[];
  activity: Activity[];
};
type Reply = { subject: string; body: string; channel: string };

type Props = {
  data: Bootstrap;
  refresh: () => Promise<void>;
  initialLead: string | null;
};

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="os-ghost" onClick={async () => { setDone(await copyText(text)); window.setTimeout(() => setDone(false), 1800); }}>
      {done ? "Copied ✓" : label}
    </button>
  );
}

export default function Enquiries({ data, refresh, initialLead }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [service, setService] = useState("all");
  const [source, setSource] = useState("all");
  const [selected, setSelected] = useState<string | null>(initialLead);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [reply, setReply] = useState<Reply | null>(null);
  const [error, setError] = useState("");

  const loadDetail = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      setDetail(await get<Detail>(`/api/studio/enquiries/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the enquiry.");
    } finally {
      setBusy(false);
    }
  };

  // A lead opened from the Overview arrives as an initial prop (the parent
  // remounts this component via a key), so load it in an async callback.
  useEffect(() => {
    if (!initialLead) return;
    const timer = window.setTimeout(() => void loadDetail(initialLead), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectLead(id: string) {
    setSelected(id);
    setDetail(null);
    setReply(null);
    setNote("");
    setError("");
    void loadDetail(id);
  }

  function closeDrawer() {
    setSelected(null);
    setDetail(null);
    setReply(null);
  }

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return data.enquiries.filter((e) => {
      if (status !== "all" && e.status !== status) return false;
      if (service !== "all" && e.serviceKey !== service) return false;
      if (source !== "all" && e.source !== source) return false;
      if (!needle) return true;
      return [e.name, e.email, e.company, e.instagram, e.message, e.reference].some((v) => String(v || "").toLowerCase().includes(needle));
    });
  }, [data.enquiries, query, status, service, source]);

  async function updateLead(body: Record<string, unknown>) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await patch(`/api/studio/enquiries/${selected}`, body);
      await Promise.all([loadDetail(selected), refresh()]);
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function generateBrief() {
    if (!selected) return;
    setBusy(true);
    try {
      await post(`/api/studio/enquiries/${selected}/brief`, {});
      await Promise.all([loadDetail(selected), refresh()]);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not generate the brief."); }
    finally { setBusy(false); }
  }

  async function createProposal() {
    if (!selected) return;
    setBusy(true);
    try {
      await post(`/api/studio/enquiries/${selected}/proposal`, {});
      await Promise.all([loadDetail(selected), refresh()]);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create the proposal."); }
    finally { setBusy(false); }
  }

  async function makeReply() {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await post<{ reply: Reply }>(`/api/studio/enquiries/${selected}/reply`, {});
      setReply(result.reply);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not draft a reply."); }
    finally { setBusy(false); }
  }

  async function toggleFollowup(f: Followup) {
    await patch(`/api/studio/followups/${f.id}`, { done: !f.done }).catch(() => undefined);
    if (selected) void loadDetail(selected);
  }

  return (
    <div className="os-stack">
      <section className="os-card">
        <div className="os-filters">
          <input type="search" placeholder="Search name, brand, email, reference…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search enquiries" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={service} onChange={(e) => setService(e.target.value)} aria-label="Filter by service">
            <option value="all">All services</option>
            {Object.entries(SERVICE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filter by source">
            <option value="all">All sources</option>
            {Object.entries(SOURCE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <button type="button" className="os-ghost" onClick={() => { setQuery(""); setStatus("all"); setService("all"); setSource("all"); }}>Clear</button>
          <button type="button" className="os-primary" onClick={() => download("/api/studio/reports/enquiries.csv").catch(() => undefined)}>Export CSV ↓</button>
        </div>
        <p className="os-count">Showing {filtered.length} of {data.enquiries.length} enquiries</p>

        <div className="os-table-wrap">
          <table className="os-table os-table-leads">
            <thead>
              <tr><th>Received</th><th>Lead</th><th>Service</th><th>Source</th><th>Score</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className={selected === e.id ? "is-selected" : ""}>
                  <td>{shortDate(e.createdAt)}</td>
                  <td>
                    <strong>{e.company || e.name}</strong>
                    <small>{e.name} · {e.reference}{e.demo ? " · DEMO" : ""}</small>
                  </td>
                  <td>{e.service}</td>
                  <td>{SOURCE_LABELS[e.source] || e.source}</td>
                  <td><span className={`os-grade os-grade-${e.grade}`}>{e.score}</span></td>
                  <td><span className={`os-status os-status-${e.status}`}>{STATUS_LABELS[e.status] || e.status}</span></td>
                  <td><button type="button" className="os-link" onClick={() => selectLead(e.id)}>Open →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && <p className="os-empty">No enquiries match these filters.</p>}
      </section>

      {selected && (
        <div className="os-drawer-backdrop" onClick={closeDrawer} role="presentation">
          <aside className="os-drawer" onClick={(e) => e.stopPropagation()} aria-label="Enquiry details">
            <div className="os-drawer-head">
              <div>
                <p className="os-eyebrow">ENQUIRY DETAIL</p>
                <h3>{detail?.enquiry.company || detail?.enquiry.name || "Loading…"}</h3>
                {detail && <p className="os-muted">{detail.enquiry.reference} · {shortDateTime(detail.enquiry.createdAt)}</p>}
              </div>
              <button type="button" className="os-close" onClick={closeDrawer} aria-label="Close">✕</button>
            </div>

            {error && <div className="os-banner os-banner-warning">{error}</div>}
            {busy && !detail && <p className="os-empty">Loading…</p>}

            {detail && (
              <div className="os-drawer-body">
                <div className="os-drawer-toolbar">
                  <label>Status
                    <select value={detail.enquiry.status} onChange={(e) => void updateLead({ status: e.target.value })}>
                      {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </label>
                  <div className="os-score-block">
                    <span className={`os-grade os-grade-${detail.enquiry.grade}`}>{detail.enquiry.score}</span>
                    <span>{detail.enquiry.grade} lead</span>
                  </div>
                </div>

                <div className="os-drawer-section">
                  <p className="os-eyebrow">CONTACT</p>
                  <div className="os-kv">
                    <div><span>Name</span><strong>{detail.enquiry.name}</strong></div>
                    <div><span>Email</span><a href={`mailto:${detail.enquiry.email}`}>{detail.enquiry.email}</a></div>
                    <div><span>Instagram</span><strong>{detail.enquiry.instagram || "—"}</strong></div>
                    <div><span>Service</span><strong>{detail.enquiry.service}</strong></div>
                    <div><span>Budget</span><strong>{detail.enquiry.budget || "—"}</strong></div>
                    <div><span>Timeline</span><strong>{detail.enquiry.timeline || "—"}</strong></div>
                  </div>
                  <p className="os-message">{detail.enquiry.message}</p>
                </div>

                <div className="os-drawer-section">
                  <p className="os-eyebrow">AI ANALYSIS · {detail.enquiry.analysis.primaryIntent}</p>
                  <p className="os-muted">{detail.enquiry.analysis.summary}</p>
                  <div className="os-chips">
                    {detail.enquiry.analysis.keywords.map((k) => <span key={k}>{k}</span>)}
                  </div>
                  <div className="os-two-col">
                    <div>
                      <span className="os-subhead">SCORE BREAKDOWN</span>
                      <ul className="os-reasons">
                        {detail.enquiry.scoreReasons.map((r, i) => (
                          <li key={i}><span className={r.points >= 0 ? "os-plus" : "os-minus"}>{r.points >= 0 ? "+" : ""}{r.points}</span>{r.reason}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="os-subhead">ASK IN YOUR REPLY</span>
                      <ul className="os-bullets">{detail.enquiry.analysis.missingInfo.map((q) => <li key={q}>{q}</li>)}</ul>
                      <span className="os-subhead">SUGGESTED SERVICES</span>
                      <p className="os-muted">{detail.enquiry.analysis.suggestedServices.map((s) => SERVICE_LABELS[s] || s).join(" + ")}</p>
                    </div>
                  </div>
                </div>

                <div className="os-drawer-section">
                  <div className="os-section-head">
                    <p className="os-eyebrow">AUTO-REPLY</p>
                    <button type="button" className="os-ghost" onClick={() => void makeReply()} disabled={busy}>Draft reply</button>
                  </div>
                  {reply ? (
                    <div className="os-reply">
                      <strong>{reply.subject}</strong>
                      <pre>{reply.body}</pre>
                      <div className="os-inline-actions">
                        <Copy text={`${reply.subject}\n\n${reply.body}`} label="Copy reply" />
                        <a className="os-ghost" href={`mailto:${detail.enquiry.email}?subject=${encodeURIComponent(reply.subject)}&body=${encodeURIComponent(reply.body)}`}>Open in email ↗</a>
                      </div>
                    </div>
                  ) : <p className="os-muted">Generate a personalised first reply with the missing details filled in.</p>}
                </div>

                <div className="os-drawer-section">
                  <div className="os-section-head">
                    <p className="os-eyebrow">CREATIVE BRIEF</p>
                    <button type="button" className="os-ghost" onClick={() => void generateBrief()} disabled={busy}>
                      {detail.brief ? "Regenerate" : "Generate brief"}
                    </button>
                  </div>
                  {detail.brief ? (
                    <>
                      <p className="os-muted">{detail.brief.summary}</p>
                      <p className="os-muted"><strong>{detail.brief.recommendedPackage.name}</strong> · {detail.brief.recommendedPackage.range} · confidence {Math.round(detail.brief.confidence * 100)}%</p>
                      <div className="os-inline-actions">
                        {detail.brief.shareToken && <a className="os-primary" href={`/brief/${detail.brief.shareToken}`} target="_blank" rel="noreferrer">Open brief ↗</a>}
                        {detail.brief.shareToken && <Copy text={`${window.location.origin}/brief/${detail.brief.shareToken}`} label="Copy brief link" />}
                      </div>
                      <ul className="os-bullets">
                        {(detail.brief.deliverables as Deliverable[]).slice(0, 4).map((d) => <li key={d.name}>{d.name} — {d.quantity}</li>)}
                      </ul>
                    </>
                  ) : <p className="os-muted">No brief yet. One click turns this message into a full requirement document.</p>}
                </div>

                <div className="os-drawer-section">
                  <div className="os-section-head">
                    <p className="os-eyebrow">PROPOSAL</p>
                    {!detail.proposal && <button type="button" className="os-ghost" onClick={() => void createProposal()} disabled={busy || !detail.brief}>Create proposal</button>}
                  </div>
                  {detail.proposal ? (
                    <>
                      <p className="os-muted">{detail.proposal.package.name} · {money(detail.proposal.investment.min)} – {money(detail.proposal.investment.max)} · {detail.proposal.status}</p>
                      <div className="os-inline-actions">
                        <a className="os-primary" href={`/proposal/${detail.proposal.token}`} target="_blank" rel="noreferrer">Open proposal ↗</a>
                        <Copy text={`${window.location.origin}/proposal/${detail.proposal.token}`} label="Copy client link" />
                      </div>
                    </>
                  ) : <p className="os-muted">Generate a brief first, then create a shareable proposal the client can approve online.</p>}
                </div>

                <div className="os-drawer-section">
                  <p className="os-eyebrow">FOLLOW-UPS</p>
                  {detail.followups.length ? (
                    <ul className="os-followups">
                      {detail.followups.map((f) => (
                        <li key={f.id} className={f.done ? "is-done" : ""}>
                          <label><input type="checkbox" checked={f.done} onChange={() => void toggleFollowup(f)} /><span>{f.type} · {shortDate(f.dueAt)}</span></label>
                          <p>{f.message}</p>
                          <Copy text={f.message} label="Copy" />
                        </li>
                      ))}
                    </ul>
                  ) : <p className="os-muted">No follow-ups scheduled.</p>}
                </div>

                <div className="os-drawer-section">
                  <p className="os-eyebrow">NOTES</p>
                  <div className="os-note-form">
                    <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a private note about this lead…" />
                    <button type="button" className="os-primary" disabled={!note.trim()} onClick={() => void updateLead({ note })}>Add note</button>
                  </div>
                  <ul className="os-notes">
                    {(detail.enquiry.notes || []).map((n) => <li key={n.id}><span>{shortDateTime(n.at)}</span><p>{n.text}</p></li>)}
                  </ul>
                </div>

                <div className="os-drawer-section">
                  <p className="os-eyebrow">ACTIVITY</p>
                  <ul className="os-timeline">
                    {detail.activity.map((a) => (
                      <li key={a.id}><span className="os-dot" /><div><strong>{a.title}</strong><p>{a.description} · {shortDateTime(a.at)}</p></div></li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
