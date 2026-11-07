import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import useTheme, { type Theme } from "./hooks/useTheme";
import useSectionNavigation, { type SectionName } from "./hooks/useSectionNavigation";

import Layout from "./components/layout/Layout";
import PortfolioShowcase from "./components/sections/PortfolioShowcase";
import Services from "./components/sections/Services";
import Process from "./components/sections/Process";
import About from "./components/sections/About";
import Contact from "./components/sections/Contact";
import BriefStudio from "./pages/BriefStudio";
import Studio from "./pages/Studio";
import ProposalPage from "./pages/ProposalPage";

import "./styles/transitions.css";

function Home({ onNavigate }: { onNavigate: (section: SectionName) => void }) {
  return (
    <section className="home-hero" id="home">
      <p className="eyebrow">INDEPENDENT CREATIVE STUDIO</p>
      <h1>Clarity, designed.</h1>
      <p>Thoughtful design for brands with something to say.</p>
      <div className="home-actions">
        <button type="button" className="home-action-primary" onClick={() => onNavigate("brief")}>
          Build your free AI brief <span aria-hidden="true">↗</span>
        </button>
        <button type="button" className="home-action-secondary" onClick={() => onNavigate("contact")}>
          Start a project
        </button>
      </div>
      <p className="home-note">
        Graphic design &amp; Instagram curation — get a tailored scope, content plan and estimate in under three minutes.
      </p>
    </section>
  );
}

type SiteProps = {
  theme: Theme;
  onToggleTheme: () => void;
};

function Site({ theme, onToggleTheme }: SiteProps) {
  const { activeSection, isVisible, navigateTo } = useSectionNavigation();
  const { shareToken } = useParams();

  function renderSection() {
    switch (activeSection) {
      case "home":
        return <Home onNavigate={navigateTo} />;
      case "work":
        return <PortfolioShowcase />;
      case "services":
        return <Services />;
      case "process":
        return <Process />;
      case "about":
        return <About />;
      case "contact":
        return <Contact />;
      case "brief":
        return <BriefStudio shareToken={shareToken} onNavigate={navigateTo} />;
      default:
        return <Home onNavigate={navigateTo} />;
    }
  }

  return (
    <Layout
      theme={theme}
      onToggleTheme={onToggleTheme}
      activeSection={activeSection}
      onNavigate={navigateTo}
    >
      <div
        className={`section-transition ${isVisible ? "" : "is-hidden"}`}
        key={activeSection}
      >
        {renderSection()}
      </div>
    </Layout>
  );
}

function Shell() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Routes>
      <Route path="/" element={<Site theme={theme} onToggleTheme={toggleTheme} />} />
      <Route path="/brief" element={<Site theme={theme} onToggleTheme={toggleTheme} />} />
      <Route path="/brief/:shareToken" element={<Site theme={theme} onToggleTheme={toggleTheme} />} />
      <Route path="/studio" element={<Studio theme={theme} onToggleTheme={toggleTheme} />} />
      <Route path="/proposal/:token" element={<ProposalPage theme={theme} onToggleTheme={toggleTheme} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
