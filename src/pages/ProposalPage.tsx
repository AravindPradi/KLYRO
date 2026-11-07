import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { get, money, post, shortDate, copyText } from "../lib/api";
import type { Proposal } from "../lib/types";
import type { Theme } from "../hooks/useTheme";
import "../styles/proposal.css";

type Props = { theme: Theme; onToggleTheme: () => void };

export default function ProposalPage({ theme, onToggleTheme }: Props) {
  const { token = "" } = useParams();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    get<{ proposal: Proposal }>(`/api/proposals/${token}`)
      .then((data) => { if (!cancelled) setProposal(data.proposal); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Proposal not found."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  async function respond(action: "approve" | "decline", event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await post<{ proposal?: Proposal; ok?: boolean }>(`/api/proposals/${token}/${action}`, { note });
      if (result.proposal) setProposal(result.proposal);
      else setProposal((current) => current ? { ...current, status: action === "approve" ? "approved" : "declined" } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record your response.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pp-page">
      <header className="pp-header">
        <Link to="/" className="pp-brand">KLYRO<span>.</span></Link>
        <div className="pp-header-actions">
          <button type="button" onClick={onToggleTheme} className="pp-theme">{theme === "light" ? "Dark mode" : "Light mode"}</button>
          <Link to="/#contact" className="pp-header-link">Contact ↗</Link>
        </div>
      </header>

      <main className="pp-shell">
        {loading && <p className="pp-loading">Loading your proposal…</p>}
        {error && !proposal && <div className="pp-error"><h1>Proposal unavailable</h1><p>{error}</p><Link to="/">Back to KLYRO ↗</Link></div>}

        {proposal && (
          <>
            <div className="pp-head">
              <p className="pp-eyebrow">PROJECT PROPOSAL · {proposal.id.toUpperCase()}</p>
              <h1>{proposal.title}</h1>
              <p className="pp-lead">{proposal.summary}</p>
              <div className="pp-meta">
                <div><span>PREPARED BY</span><strong>{proposal.studioName}</strong></div>
                <div><span>PREPARED FOR</span><strong>{proposal.clientCompany}</strong></div>
                <div><span>DATE</span><strong>{shortDate(proposal.createdAt)}</strong></div>
                <div><span>VALID UNTIL</span><strong>{shortDate(proposal.validUntil)}</strong></div>
              </div>
              <div className={`pp-status pp-status-${proposal.status}`}>
                Status: {proposal.status === "sent" ? "Awaiting your decision" : proposal.status === "approved" ? "Approved ✓" : "Declined"}
              </div>
            </div>

            <section className="pp-card pp-investment">
              <div>
                <p className="pp-eyebrow">RECOMMENDED PACKAGE</p>
                <h2>{proposal.package.name}</h2>
                <p className="pp-price">{proposal.package.range}</p>
                <p className="pp-muted">{proposal.investment.note}</p>
              </div>
              <div className="pp-objectives">
                <p className="pp-eyebrow">WHAT THIS SOLVES</p>
                <ul>{proposal.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
              </div>
            </section>

            <section className="pp-card">
              <p className="pp-eyebrow">SCOPE OF WORK</p>
              <h2>What's included</h2>
              <div className="pp-table-wrap">
                <table className="pp-table">
                  <thead><tr><th>Deliverable</th><th>Quantity</th><th>Detail</th></tr></thead>
                  <tbody>
                    {proposal.deliverables.map((d) => (
                      <tr key={d.name}><td><strong>{d.name}</strong></td><td>{d.quantity}</td><td>{d.detail}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="pp-muted">Investment line items: {money(proposal.investment.min)} – {money(proposal.investment.max)} ({proposal.investment.currency}).</p>
            </section>

            <div className="pp-grid-2">
              <section className="pp-card">
                <p className="pp-eyebrow">TIMELINE</p>
                <h2>How it runs</h2>
                <ul className="pp-list">
                  {proposal.timeline.map((t) => <li key={t.phase}><strong>{t.phase}</strong><span>{t.duration}</span><p>{t.outcome}</p></li>)}
                </ul>
              </section>
              <section className="pp-card">
                <p className="pp-eyebrow">TERMS</p>
                <h2>The fine print, plainly</h2>
                <ul className="pp-bullets">{proposal.terms.map((t) => <li key={t}>{t}</li>)}</ul>
              </section>
            </div>

            {proposal.status === "sent" ? (
              <section className="pp-card pp-decision" id="decision">
                <p className="pp-eyebrow">YOUR DECISION</p>
                <h2>Ready when you are.</h2>
                <p>Approving takes one click and updates the studio instantly — we'll follow up with an invoice and a short kick-off questionnaire. A note is optional.</p>
                <label htmlFor="pp-note">A note for the studio (optional)</label>
                <textarea id="pp-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything you'd like adjusted before we begin…" />
                {error && <p className="pp-inline-error">{error}</p>}
                <div className="pp-decision-actions">
                  <button type="button" className="pp-approve" disabled={busy} onClick={(e) => respond("approve", e)}>
                    {busy ? "Sending…" : "Approve this proposal ✓"}
                  </button>
                  <button type="button" className="pp-decline" disabled={busy} onClick={(e) => respond("decline", e)}>
                    Not right now
                  </button>
                  <button type="button" className="pp-copy" onClick={async () => { setCopied(await copyText(window.location.href)); window.setTimeout(() => setCopied(false), 1800); }}>
                    {copied ? "Link copied" : "Copy link"}
                  </button>
                </div>
              </section>
            ) : (
              <section className="pp-card pp-decision">
                <p className="pp-eyebrow">RESPONSE RECORDED</p>
                <h2>{proposal.status === "approved" ? "Thank you — let's begin." : "Thanks for letting us know."}</h2>
                <p>
                  {proposal.status === "approved"
                    ? `We've received your approval${proposal.approvedAt ? ` on ${shortDate(proposal.approvedAt)}` : ""}. Expect an invoice and kick-off questionnaire from ${proposal.ownerEmail || "the studio"}.`
                    : "The door stays open. If timing or scope changes, just reply to your original email."}
                </p>
                {proposal.approvalNote && <blockquote>“{proposal.approvalNote}”</blockquote>}
              </section>
            )}

            <footer className="pp-footer">
              <p>Questions? <a href={`mailto:${proposal.ownerEmail}`}>{proposal.ownerEmail}</a></p>
              <Link to="/">KLYRO Creative Studio ↗</Link>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
