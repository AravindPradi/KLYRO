import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { copyText, download, get, money, post } from "../lib/api";
import {
  BUDGET_OPTIONS, DESIGN_OPTIONS, EMPTY_ANSWERS, GOAL_OPTIONS, INDUSTRY_OPTIONS,
  INSTAGRAM_OPTIONS, SERVICE_OPTIONS, STAGE_OPTIONS, TIMELINE_OPTIONS, TONE_OPTIONS,
  type BriefAnswers,
} from "../lib/options";
import type { Brief } from "../lib/types";
import type { SectionName } from "../hooks/useSectionNavigation";
import "../styles/brief.css";

type Props = {
  shareToken?: string;
  onNavigate: (section: SectionName) => void;
};

type SaveResult = {
  reference: string;
  briefUrl: string;
  proposalUrl: string;
  briefToken: string;
  proposalToken: string;
};

const STEPS = ["Your brand", "Goals & audience", "Scope", "Style", "Practicalities"];

function SectionCard({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="bs-card">
      <p className="bs-eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function ChipGroup({ options, selected, onToggle }: { options: readonly string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <div className="bs-chips">
      {options.map((option) => (
        <button
          type="button"
          key={option}
          className={`bs-chip ${selected.includes(option) ? "is-selected" : ""}`}
          aria-pressed={selected.includes(option)}
          onClick={() => onToggle(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function Palette({ items }: { items: { name: string; hex: string; use: string }[] }) {
  return (
    <div className="bs-palette">
      {items.map((p) => (
        <div className="bs-swatch" key={p.hex}>
          <span style={{ background: p.hex }} />
          <strong>{p.name}</strong>
          <small>{p.hex}</small>
          <small>{p.use}</small>
        </div>
      ))}
    </div>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="bs-small-btn"
      onClick={async () => {
        const ok = await copyText(text);
        setCopied(ok);
        window.setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

function BriefResult({ brief, answers, shareToken, mode }: { brief: Brief; answers?: BriefAnswers; shareToken?: string; mode: "preview" | "shared" }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(String(answers?.brand || ""));
  const [honeypot, setHoneypot] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SaveResult | null>(null);

  async function saveBrief(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await post<SaveResult>("/api/briefs", {
        name, email, company, answers, website_url: honeypot,
      });
      setSaved(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your brief.");
    } finally {
      setSaving(false);
    }
  }

  const downloadMd = () => {
    if (shareToken) {
      download(`/api/briefs/${shareToken}/markdown`).catch(() => undefined);
      return;
    }
    const blob = new Blob([briefToPlainText(brief)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "klyro-creative-brief.md";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="bs-result">
      <header className="bs-result-head">
        <div>
          <p className="bs-eyebrow">{mode === "shared" ? "SHARED CREATIVE BRIEF" : "YOUR GENERATED BRIEF"}</p>
          <h2>{brief.title}</h2>
          <p className="bs-result-sub">
            {brief.services.label} · {brief.recommendedPackage.name} · {brief.recommendedPackage.range}
          </p>
        </div>
        <div className="bs-result-actions">
          <span className="bs-confidence">{Math.round(brief.confidence * 100)}% brief confidence</span>
          <button type="button" className="bs-small-btn" onClick={downloadMd}>Download .md</button>
          <button type="button" className="bs-small-btn" onClick={() => window.print()}>Print</button>
        </div>
      </header>

      <div className="bs-summary">
        <p className="bs-eyebrow">IN ONE PARAGRAPH</p>
        <p>{brief.summary}</p>
        <CopyButton text={briefToPlainText(brief)} label="Copy whole brief" />
      </div>

      <div className="bs-grid-2">
        <SectionCard eyebrow="01 / OBJECTIVES" title="What this work needs to achieve">
          <ul className="bs-list">
            {brief.objectives.map((o) => (
              <li key={o.goal}>
                <strong>{o.goal}</strong>
                <span>{o.title}.</span>
                <small>Measure: {o.metric}</small>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard eyebrow="02 / INVESTMENT" title="Recommended scope & estimate">
          <div className="bs-price">{brief.recommendedPackage.range}</div>
          <p className="bs-muted">{brief.recommendedPackage.why}</p>
          <ul className="bs-plain-list">
            {brief.estimate.breakdown.map((b) => <li key={b.label}><span>{b.label}</span><strong>{money(b.value)}</strong></li>)}
          </ul>
          <p className="bs-muted">{brief.estimate.retainerNote}</p>
        </SectionCard>
      </div>

      <SectionCard eyebrow="03 / REQUIREMENTS" title="Deliverables we would produce">
        <div className="bs-table-wrap">
          <table className="bs-table">
            <thead><tr><th>Deliverable</th><th>Quantity</th><th>Notes</th></tr></thead>
            <tbody>
              {brief.deliverables.map((d) => (
                <tr key={d.name}><td><strong>{d.name}</strong></td><td>{d.quantity}</td><td>{d.detail}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bs-scope-note">
          <div><span className="bs-eyebrow">INCLUDED</span><p>{brief.scope.included.join(" · ")}</p></div>
          <div><span className="bs-eyebrow">NOT INCLUDED</span><p>{brief.scope.excluded.join(" · ")}</p></div>
        </div>
      </SectionCard>

      <div className="bs-grid-2">
        <SectionCard eyebrow="04 / DESIGN DIRECTION" title="Visual language">
          <p><strong>{brief.designDirection.mood}</strong></p>
          <p className="bs-muted">{brief.designDirection.styleNotes}</p>
          <p className="bs-muted">{brief.designDirection.typography}</p>
          <Palette items={brief.designDirection.palette} />
          <ul className="bs-bullets">
            {brief.designDirection.layoutRules.map((r) => <li key={r}>{r}</li>)}
          </ul>
          <p className="bs-muted">Assets: {brief.designDirection.assetList.join(" · ")}</p>
        </SectionCard>

        <SectionCard eyebrow="05 / INSTAGRAM" title="Content pillars">
          {brief.contentPillars.length ? (
            <ul className="bs-list">
              {brief.contentPillars.map((p) => (
                <li key={p.name}>
                  <strong>{p.name} <span className="bs-share">{p.share}</span></strong>
                  <span>{p.purpose}</span>
                  <small>{p.exampleTopics.join(" · ")}</small>
                </li>
              ))}
            </ul>
          ) : <p className="bs-muted">Design-only scope — no content calendar in this brief.</p>}
          {brief.hashtagSets.length > 0 && (
            <div className="bs-hashtags">
              {brief.hashtagSets.map((set) => <p key={set.name}><span>{set.name}</span> {set.tags.join(" ")}</p>)}
            </div>
          )}
        </SectionCard>
      </div>

      {brief.calendar.length > 0 && (
        <SectionCard eyebrow="06 / 4-WEEK PLAN" title="A ready-to-use content calendar">
          <div className="bs-calendar">
            {brief.calendar.map((week) => (
              <div className="bs-week" key={week.week}>
                <div className="bs-week-head">
                  <strong>Week {week.week}</strong>
                  <span>{week.theme}</span>
                </div>
                {week.posts.map((p, i) => (
                  <div className="bs-post" key={`${week.week}-${i}`}>
                    <div className="bs-post-meta"><span>{p.day}</span><span>{p.format}</span><span>{p.pillar}</span></div>
                    <p><strong>{p.hook}</strong></p>
                    <p className="bs-muted">{p.captionStarter}</p>
                    <div className="bs-post-foot"><span>CTA: {p.cta}</span><span>{p.designNote}</span></div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="bs-grid-2">
        <SectionCard eyebrow="07 / TIMELINE" title="How the project runs">
          <ul className="bs-plain-list">
            {brief.timeline.map((t) => <li key={t.phase}><span><strong>{t.phase}</strong> · {t.duration}</span><span>{t.outcome}</span></li>)}
          </ul>
        </SectionCard>
        <SectionCard eyebrow="08 / BEFORE WE START" title="Questions & assumptions">
          <ul className="bs-bullets">
            {brief.clarifyingQuestions.map((q) => <li key={q}>{q}</li>)}
          </ul>
          <div className="bs-assumptions">
            <span className="bs-eyebrow">ASSUMPTIONS</span>
            <ul className="bs-bullets">{brief.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
          </div>
        </SectionCard>
      </div>

      {mode === "preview" && !saved && (
        <section className="bs-convert" id="bs-convert">
          <div>
            <p className="bs-eyebrow">NEXT STEP — FREE</p>
            <h3>Keep this brief, get a written proposal.</h3>
            <p>
              We'll save everything above, draft an indicative proposal with scope and pricing,
              and send you both links. No obligation, no spam — one email from the studio.
            </p>
          </div>
          <form onSubmit={saveBrief} className="bs-convert-form">
            <div className="bs-form-row">
              <label>Your name<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></label>
              <label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@brand.com" /></label>
            </div>
            <label>Business / brand<input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Optional" /></label>
            <div className="hp-field" aria-hidden="true">
              <label htmlFor="bs-website-url">Leave empty</label>
              <input id="bs-website-url" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
            </div>
            {error && <p className="bs-error" role="alert">{error}</p>}
            <button type="submit" className="bs-primary" disabled={saving}>
              {saving ? "Preparing…" : "Save brief & get proposal ↗"}
            </button>
            <small>We'll reply within 24 hours. Your details are only used for this project.</small>
          </form>
        </section>
      )}

      {saved && (
        <section className="bs-saved">
          <p className="bs-eyebrow">BRIEF SAVED — REF {saved.reference}</p>
          <h3>Everything is ready for you.</h3>
          <p>Your brief and an indicative proposal are now in the studio system. Keep these links:</p>
          <div className="bs-saved-links">
            <Link to={saved.briefUrl} className="bs-primary">Open your brief ↗</Link>
            <Link to={saved.proposalUrl} className="bs-secondary">View the proposal ↗</Link>
            <CopyButton text={`${window.location.origin}${saved.proposalUrl}`} label="Copy proposal link" />
          </div>
          <p className="bs-muted">You can approve the proposal directly on its page — that instantly updates the studio pipeline.</p>
        </section>
      )}

      {mode === "shared" && (
        <section className="bs-saved">
          <p className="bs-eyebrow">QUESTIONS ABOUT THIS BRIEF?</p>
          <h3>Let's talk it through.</h3>
          <p>Reply to the email that brought you here, or send a new enquiry with your reference.</p>
          <div className="bs-saved-links">
            <Link to="/#contact" className="bs-primary">Contact the studio ↗</Link>
            <Link to="/brief" className="bs-secondary">Generate your own brief ↗</Link>
          </div>
        </section>
      )}
    </div>
  );
}

function briefToPlainText(brief: Brief): string {
  const lines = [
    `# ${brief.title}`, "", brief.summary, "",
    `Recommended package: ${brief.recommendedPackage.name} — ${brief.recommendedPackage.range}`, "",
    "## Objectives", ...brief.objectives.map((o) => `- ${o.goal}: ${o.title} (${o.metric})`), "",
    "## Deliverables", ...brief.deliverables.map((d) => `- ${d.name} (${d.quantity}) — ${d.detail}`), "",
    "## Design direction", `- ${brief.designDirection.mood}`, `- ${brief.designDirection.typography}`,
    `- Palette: ${brief.designDirection.palette.map((p) => `${p.name} ${p.hex}`).join(", ")}`, "",
  ];
  if (brief.contentPillars.length) lines.push("## Content pillars", ...brief.contentPillars.map((p) => `- ${p.name} (${p.share}): ${p.purpose}`), "");
  for (const week of brief.calendar) {
    lines.push(`## Week ${week.week} — ${week.theme}`, ...week.posts.map((p) => `- ${p.day} · ${p.format} · ${p.pillar}: ${p.hook} | ${p.captionStarter} | CTA: ${p.cta}`), "");
  }
  lines.push("## Estimate", `${brief.recommendedPackage.range}. ${brief.estimate.retainerNote}`, "",
    "## Questions", ...brief.clarifyingQuestions.map((q) => `- ${q}`), "",
    "## Assumptions", ...brief.assumptions.map((a) => `- ${a}`), "");
  return lines.join("\n");
}

export default function BriefStudio({ shareToken, onNavigate }: Props) {
  const [answers, setAnswers] = useState<BriefAnswers>(EMPTY_ANSWERS);
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sharedBrief, setSharedBrief] = useState<Brief | null>(null);
  const [sharedLoading, setSharedLoading] = useState(Boolean(shareToken));

  useEffect(() => {
    if (!shareToken) return;
    let cancelled = false;
    get<{ brief: Brief }>(`/api/briefs/${shareToken}`)
      .then((data) => { if (!cancelled) setSharedBrief(data.brief); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Could not load this brief."); })
      .finally(() => { if (!cancelled) setSharedLoading(false); });
    return () => { cancelled = true; };
  }, [shareToken]);

  const set = <K extends keyof BriefAnswers>(key: K, value: BriefAnswers[K]) =>
    setAnswers((current) => ({ ...current, [key]: value }) as BriefAnswers);

  const toggle = (key: "goals" | "designNeeds" | "instagramNeeds", value: string) =>
    setAnswers((current) => ({
      ...current,
      [key]: current[key].includes(value) ? current[key].filter((v) => v !== value) : [...current[key], value],
    }) as BriefAnswers);

  const canContinue = () => {
    if (step === 0) return Boolean(answers.brand.trim());
    if (step === 1) return answers.goals.length > 0;
    return true;
  };

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const response = await post<{ brief: Brief }>("/api/briefs/preview", { answers });
      setBrief(response.brief);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the brief.");
    } finally {
      setLoading(false);
    }
  }

  if (shareToken) {
    return (
      <div className="bs-page">
        <div className="bs-shell">
          {sharedLoading && <div className="bs-loading">Loading your brief…</div>}
          {error && !sharedBrief && <div className="bs-error">{error}</div>}
          {sharedBrief && <BriefResult brief={sharedBrief} shareToken={shareToken} mode="shared" />}
        </div>
      </div>
    );
  }

  if (brief) {
    return (
      <div className="bs-page">
        <div className="bs-shell">
          <button type="button" className="bs-back" onClick={() => setBrief(null)}>← Edit answers</button>
          <BriefResult brief={brief} answers={answers} mode="preview" />
        </div>
      </div>
    );
  }

  return (
    <div className="bs-page">
      <div className="bs-shell">
        <header className="bs-head">
          <p className="bs-eyebrow">FREE · NO SIGN-UP · ~3 MINUTES</p>
          <h2>Turn a vague idea into a clear creative brief.</h2>
          <p>
            Answer a few questions about your brand. Our brief engine writes your requirements —
            deliverables, design direction, Instagram content pillars, a 4-week calendar and an estimate —
            so you know exactly what to ask for before spending anything.
          </p>
        </header>

        <div className="bs-progress" aria-label="Brief progress">
          {STEPS.map((label, index) => (
            <button
              type="button"
              key={label}
              className={`bs-progress-step ${index === step ? "is-active" : ""} ${index < step ? "is-done" : ""}`}
              onClick={() => index <= step && setStep(index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {label}
            </button>
          ))}
        </div>

        <div className="bs-form-card">
          {step === 0 && (
            <>
              <h3>First, tell us about the brand.</h3>
              <p className="bs-muted">The more specific you are, the sharper the brief.</p>
              <div className="bs-form-grid">
                <label className="bs-wide">Brand / business name <span>*</span>
                  <input value={answers.brand} onChange={(e) => set("brand", e.target.value)} placeholder="e.g. Lumière Café" required />
                </label>
                <label>Industry
                  <select value={answers.industry} onChange={(e) => set("industry", e.target.value)}>
                    <option value="">Select an industry</option>
                    {INDUSTRY_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </label>
                <label>Stage
                  <select value={answers.stage} onChange={(e) => set("stage", e.target.value)}>
                    {STAGE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </label>
                <label>Instagram handle
                  <input value={answers.handle} onChange={(e) => set("handle", e.target.value)} placeholder="@yourbrand" />
                </label>
                <label>Website
                  <input value={answers.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
                </label>
                <label>City / region
                  <input value={answers.location} onChange={(e) => set("location", e.target.value)} placeholder="Kochi, Kerala" />
                </label>
                <label>Audience age range
                  <input value={answers.audienceAge} onChange={(e) => set("audienceAge", e.target.value)} placeholder="e.g. 25–40" />
                </label>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h3>What should this work achieve?</h3>
              <p className="bs-muted">Pick everything that matters — we'll turn them into measurable objectives.</p>
              <div className="bs-field-block">
                <span className="bs-label">GOALS <span>*</span></span>
                <ChipGroup options={GOAL_OPTIONS} selected={answers.goals} onToggle={(v) => toggle("goals", v)} />
              </div>
              <div className="bs-field-block">
                <span className="bs-label">SERVICES</span>
                <div className="bs-service-grid">
                  {SERVICE_OPTIONS.map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      className={`bs-service ${answers.services === option.value ? "is-selected" : ""}`}
                      onClick={() => set("services", option.value)}
                      aria-pressed={answers.services === option.value}
                    >
                      <strong>{option.label}</strong>
                      <small>{option.hint}</small>
                    </button>
                  ))}
                </div>
              </div>
              <label className="bs-wide">Who is the ideal customer?
                <textarea rows={3} value={answers.audience} onChange={(e) => set("audience", e.target.value)} placeholder="e.g. Young professionals in Kochi who value slow, local experiences" />
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <h3>What do you actually need made?</h3>
              <p className="bs-muted">We'll size quantities from your posting rhythm and turn these into deliverables.</p>
              {(answers.services === "design" || answers.services === "both" || answers.services === "unsure") && (
                <div className="bs-field-block">
                  <span className="bs-label">GRAPHIC DESIGN</span>
                  <ChipGroup options={DESIGN_OPTIONS} selected={answers.designNeeds} onToggle={(v) => toggle("designNeeds", v)} />
                </div>
              )}
              {(answers.services === "instagram" || answers.services === "both" || answers.services === "unsure") && (
                <div className="bs-field-block">
                  <span className="bs-label">INSTAGRAM CURATION</span>
                  <ChipGroup options={INSTAGRAM_OPTIONS} selected={answers.instagramNeeds} onToggle={(v) => toggle("instagramNeeds", v)} />
                </div>
              )}
              <div className="bs-field-block">
                <span className="bs-label">FEED POSTS PER MONTH · {answers.postsPerMonth}</span>
                <input
                  className="bs-range"
                  type="range"
                  min={4}
                  max={30}
                  step={2}
                  value={answers.postsPerMonth}
                  onChange={(e) => set("postsPerMonth", Number(e.target.value))}
                  aria-label="Feed posts per month"
                />
                <div className="bs-range-labels"><span>4 (light)</span><span>12 (steady)</span><span>30 (daily)</span></div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h3>How should it feel?</h3>
              <p className="bs-muted">Words are enough — no moodboard needed yet.</p>
              <div className="bs-form-grid">
                <label className="bs-wide">Tone / mood
                  <select value={answers.tone} onChange={(e) => set("tone", e.target.value)}>
                    {TONE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </label>
                <label className="bs-wide">Style words & references
                  <textarea rows={3} value={answers.styleWords} onChange={(e) => set("styleWords", e.target.value)} placeholder="Warm, editorial, lots of negative space, earthy photography…" />
                </label>
                <label>Colours / things to avoid
                  <input value={answers.colorsAvoid} onChange={(e) => set("colorsAvoid", e.target.value)} placeholder="Neon, gradients…" />
                </label>
                <label>Brands you admire
                  <input value={answers.competitors} onChange={(e) => set("competitors", e.target.value)} placeholder="@brand, @brand" />
                </label>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h3>Last one — the practicalities.</h3>
              <p className="bs-muted">These set the package, price range and timeline in your brief.</p>
              <div className="bs-form-grid">
                <label>Budget range
                  <select value={answers.budget} onChange={(e) => set("budget", e.target.value)}>
                    <option value="">Select a range</option>
                    {BUDGET_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </label>
                <label>Timeline
                  <select value={answers.timeline} onChange={(e) => set("timeline", e.target.value)}>
                    <option value="">Select a timeline</option>
                    {TIMELINE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </label>
                <label className="bs-wide">Anything else we should know?
                  <textarea rows={4} value={answers.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Launch dates, existing assets, what isn't working today…" />
                </label>
              </div>
              <div className="bs-summary-preview">
                <span className="bs-eyebrow">READY TO GENERATE</span>
                <p>
                  {answers.brand || "Your brand"} · {answers.services === "both" ? "Design + Instagram" : answers.services === "design" ? "Graphic design" : answers.services === "instagram" ? "Instagram curation" : "Scope to be recommended"} · {answers.goals.length} goals · {answers.postsPerMonth} posts/month
                </p>
              </div>
            </>
          )}

          {error && <p className="bs-error" role="alert">{error}</p>}

          <div className="bs-nav">
            <button type="button" className="bs-secondary" onClick={() => (step === 0 ? onNavigate("home") : setStep(step - 1))}>
              {step === 0 ? "← Back to site" : "← Previous"}
            </button>
            {step < STEPS.length - 1 ? (
              <button type="button" className="bs-primary" disabled={!canContinue()} onClick={() => setStep(step + 1)}>
                Continue →
              </button>
            ) : (
              <button type="button" className="bs-primary" disabled={loading} onClick={generate}>
                {loading ? "Writing your brief…" : "Generate my free brief ↗"}
              </button>
            )}
          </div>
          <p className="bs-privacy">
            Runs on the studio's own brief engine — nothing is sent to third parties, and no account is needed.
            {step < STEPS.length - 1 && " Answers stay in this browser until you generate."}
          </p>
        </div>
      </div>
    </div>
  );
}
