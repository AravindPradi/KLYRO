import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { get, post, type ApiError } from "../lib/api";
import type { Bootstrap, StudioTab } from "../lib/types";
import type { Theme } from "../hooks/useTheme";
import Overview from "../components/studio/Overview";
import Enquiries from "../components/studio/Enquiries";
import Reports from "../components/studio/Reports";
import Prospects from "../components/studio/Prospects";
import StudioSettings from "../components/studio/StudioSettings";
import "../styles/studio.css";

type Props = { theme: Theme; onToggleTheme: () => void };
type Tab = StudioTab;

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "overview", label: "Overview", hint: "Pipeline at a glance" },
  { id: "enquiries", label: "Enquiries", hint: "Leads, replies & proposals" },
  { id: "reports", label: "Reports", hint: "Numbers, exports & digests" },
  { id: "prospects", label: "Find customers", hint: "Prospecting playbooks" },
  { id: "settings", label: "Settings", hint: "Studio configuration" },
];

export default function Studio({ theme, onToggleTheme }: Props) {
  const [auth, setAuth] = useState<"checking" | "guest" | "authed">("checking");
  const [hint, setHint] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusLead, setFocusLead] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await get<Bootstrap>("/api/studio/bootstrap");
      setData(result);
      setAuth("authed");
    } catch (err) {
      if ((err as ApiError).status === 401) {
        setAuth("guest");
        setData(null);
      } else {
        setError(err instanceof Error ? err.message : "Could not load the studio data.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    get<{ authenticated: boolean; demoMode: boolean; hint: string | null }>("/api/auth/status")
      .then((status) => {
        setHint(status.hint);
        if (status.authenticated) void refresh();
        else setAuth("guest");
      })
      .catch(() => setAuth("guest"));
  }, [refresh]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    try {
      await post("/api/auth/login", { passphrase });
      setPassphrase("");
      await refresh();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function logout() {
    await post("/api/auth/logout").catch(() => undefined);
    setAuth("guest");
    setData(null);
  }

  function openLead(id: string) {
    setFocusLead(id);
    setTab("enquiries");
  }

  if (auth === "checking") {
    return <div className="os-center"><p>Checking your studio session…</p></div>;
  }

  if (auth === "guest") {
    return (
      <div className="os-login">
        <div className="os-login-card">
          <Link to="/" className="os-brand">KLYRO<span>.</span></Link>
          <p className="os-eyebrow">STUDIO OS · PRIVATE</p>
          <h1>Your client pipeline.</h1>
          <p className="os-login-lead">
            Enquiries, AI-generated briefs, follow-ups, proposals and enquiry reports —
            all in one private workspace.
          </p>
          <form onSubmit={login}>
            <label htmlFor="os-passphrase">Studio passphrase</label>
            <input
              id="os-passphrase"
              type="password"
              autoComplete="current-password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter passphrase"
              required
            />
            {loginError && <p className="os-error" role="alert">{loginError}</p>}
            <button type="submit" className="os-primary" disabled={loggingIn}>
              {loggingIn ? "Signing in…" : "Enter Studio ↗"}
            </button>
          </form>
          {hint && (
            <p className="os-hint">
              Local demo passphrase: <code>{hint}</code>. Set <code>STUDIO_PASSPHRASE</code> before deploying.
            </p>
          )}
          <div className="os-login-foot">
            <Link to="/">← Back to website</Link>
            <button type="button" onClick={onToggleTheme}>{theme === "light" ? "Dark mode" : "Light mode"}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="os-app">
      <aside className="os-sidebar">
        <div>
          <Link to="/" className="os-brand">KLYRO<span>.</span></Link>
          <p className="os-sidebar-label">STUDIO OS</p>
        </div>
        <nav className="os-nav" aria-label="Studio sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`os-nav-item ${tab === item.id ? "is-active" : ""}`}
              onClick={() => { setTab(item.id); setFocusLead(null); }}
            >
              <strong>{item.label}</strong>
              <small>{item.hint}</small>
            </button>
          ))}
        </nav>
        <div className="os-sidebar-foot">
          <span>{data?.summary.totals.aiEngine || "local engine"}</span>
          <span>{data?.enquiries.length || 0} enquiries · {data?.prospects.length || 0} prospects</span>
        </div>
      </aside>

      <div className="os-main">
        <header className="os-topbar">
          <div>
            <p className="os-eyebrow">{TABS.find((t) => t.id === tab)?.hint}</p>
            <h2>{TABS.find((t) => t.id === tab)?.label}</h2>
          </div>
          <div className="os-topbar-actions">
            <Link to="/brief" className="os-ghost">AI Brief Studio ↗</Link>
            <button type="button" onClick={onToggleTheme} className="os-ghost">{theme === "light" ? "Dark" : "Light"}</button>
            <button type="button" onClick={() => void refresh()} className="os-ghost" disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
            <button type="button" onClick={() => void logout()} className="os-ghost">Sign out</button>
          </div>
        </header>

        <main className="os-content">
          {error && <div className="os-banner os-banner-warning">{error}</div>}
          {data && data.summary.totals.demoRecords > 0 && (
            <div className="os-banner">
              <span>DEMO WORKSPACE</span>
              {data.summary.totals.demoRecords} sample records are loaded so the reports have data.{" "}
              <button type="button" onClick={() => setTab("settings")}>Clear them in Settings →</button>
            </div>
          )}
          {data ? (
            <>
              {tab === "overview" && <Overview data={data} onOpenLead={openLead} onNavigate={setTab} />}
              {tab === "enquiries" && <Enquiries key={focusLead || "all"} data={data} refresh={refresh} initialLead={focusLead} />}
              {tab === "reports" && <Reports initialSummary={data.summary} onOpenLead={openLead} />}
              {tab === "prospects" && <Prospects data={data} refresh={refresh} />}
              {tab === "settings" && <StudioSettings settings={data.settings} refresh={refresh} />}
            </>
          ) : (
            <div className="os-center"><p>Loading studio data…</p></div>
          )}
        </main>
      </div>
    </div>
  );
}
