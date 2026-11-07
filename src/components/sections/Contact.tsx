import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { post } from "../../lib/api";
import { BUDGET_OPTIONS, TIMELINE_OPTIONS } from "../../lib/options";
import type { Analysis } from "../../lib/types";
import "./Contact.css";

type SubmitResult = {
  ok: boolean;
  reference: string;
  grade: string;
  score: number;
  analysis: Analysis;
};

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [instagram, setInstagram] = useState("");
  const [service, setService] = useState("Graphic Design");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const response = await post<SubmitResult>("/api/enquiries", {
        name, email, company, instagram, service, budget, timeline, message, website_url: honeypot,
      });
      setResult(response);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the enquiry.");
      setStatus("error");
    }
  }

  if (status === "success" && result) {
    return (
      <section className="contact-section" id="contact">
        <div className="contact-success">
          <p className="eyebrow">ENQUIRY RECEIVED</p>
          <h2>Thank you, {name.split(" ")[0]}.</h2>
          <p className="contact-success-lead">
            Your project is now in our studio pipeline. We review every enquiry personally
            and reply within 24 hours with a clear scope and an estimate.
          </p>
          <div className="contact-success-meta">
            <div>
              <span>REFERENCE</span>
              <strong>{result.reference}</strong>
            </div>
            <div>
              <span>PRIORITY</span>
              <strong>{result.grade} · {result.score}/100</strong>
            </div>
          </div>
          <div className="contact-success-insight">
            <span>WHAT WE NOTED</span>
            <p>{result.analysis.summary}</p>
          </div>
          <div className="contact-success-actions">
            <Link to="/brief" className="contact-submit">
              Build a detailed AI brief <span>↗</span>
            </Link>
            <button type="button" className="contact-reset" onClick={() => { setStatus("idle"); setMessage(""); }}>
              Send another enquiry
            </button>
          </div>
          <p className="contact-form-note">
            Prefer email? Write to <a href="mailto:technologiiaa@proton.me">technologiiaa@proton.me</a> and quote your reference.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="contact-section" id="contact">
      <div className="contact-layout">
        <div className="contact-intro">
          <p className="eyebrow">START A CONVERSATION</p>

          <h2>Have a project<br />in mind?</h2>

          <p className="contact-description">
            Tell us a little about what you're working on.
            Let's explore how thoughtful design can bring
            clarity to your brand.
          </p>

          <div className="contact-email">
            <span>EMAIL US DIRECTLY</span>
            <a href="mailto:technologiiaa@proton.me">
              technologiiaa@proton.me
            </a>
          </div>

          <div className="contact-brief-teaser">
            <span>NOT SURE WHERE TO START?</span>
            <p>
              Answer five short questions and get a free, tailored creative
              brief with deliverables, a content plan and an estimate.
            </p>
            <Link to="/brief">Try the AI Brief Studio ↗</Link>
          </div>
        </div>

        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="contact-name">Your name</label>
              <input
                id="contact-name"
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="contact-email">Email address</label>
              <input
                id="contact-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="contact-company">Business / brand</label>
              <input
                id="contact-company"
                type="text"
                placeholder="Optional"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="contact-instagram">Instagram handle</label>
              <input
                id="contact-instagram"
                type="text"
                placeholder="@yourbrand"
                value={instagram}
                onChange={(event) => setInstagram(event.target.value)}
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="contact-service">What do you need?</label>
            <select
              id="contact-service"
              value={service}
              onChange={(event) => setService(event.target.value)}
            >
              <option>Graphic Design</option>
              <option>Instagram Content Strategy</option>
              <option>Both Services</option>
              <option>Not Sure Yet</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="contact-budget">Indicative budget</label>
              <select id="contact-budget" value={budget} onChange={(event) => setBudget(event.target.value)}>
                <option value="">Prefer not to say</option>
                {BUDGET_OPTIONS.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="contact-timeline">Timeline</label>
              <select id="contact-timeline" value={timeline} onChange={(event) => setTimeline(event.target.value)}>
                <option value="">Not sure yet</option>
                {TIMELINE_OPTIONS.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="contact-message">Tell us about your project</label>
            <textarea
              id="contact-message"
              placeholder="A little about your brand, goals and what you have in mind..."
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
            />
          </div>

          <div className="hp-field" aria-hidden="true">
            <label htmlFor="contact-website-url">Leave this empty</label>
            <input id="contact-website-url" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
          </div>

          {status === "error" && (
            <div className="contact-error" role="alert">
              {error} You can still email us at{" "}
              <a href="mailto:technologiiaa@proton.me">technologiiaa@proton.me</a>.
            </div>
          )}

          <button type="submit" className="contact-submit" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Send Project Enquiry"} <span>↗</span>
          </button>

          <p className="contact-form-note">
            Your enquiry is saved securely in our studio system and we reply within 24 hours.
          </p>
        </form>
      </div>
    </section>
  );
}
