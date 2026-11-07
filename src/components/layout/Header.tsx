
import Container from "../ui/Container";
import ThemeToggle from "../ui/ThemeToggle";
import type { Theme } from "../../hooks/useTheme";
import type { SectionName } from "../../hooks/useSectionNavigation";

type HeaderProps = {
  theme: Theme;
  onToggleTheme: () => void;
  activeSection: SectionName;
  onNavigate: (section: SectionName) => void;
};

export default function Header({
  theme,
  onToggleTheme,
  activeSection,
  onNavigate,
}: HeaderProps) {
  const links: { label: string; section: SectionName }[] = [
    { label: "Work", section: "work" },
    { label: "Services", section: "services" },
    { label: "Process", section: "process" },
    { label: "About", section: "about" },
    { label: "AI Brief", section: "brief" },
  ];

  return (
    <header className="site-header">
      <Container>
        <div className="header-inner">
          <button
            type="button"
            className="brand"
            onClick={() => onNavigate("home")}
            aria-label="KLYRO home"
          >
            KLYRO<span>.</span>
          </button>

          <nav className="main-nav" aria-label="Main navigation">
            {links.map((link) => (
              <button
                key={link.section}
                type="button"
                className={`nav-link ${
                  activeSection === link.section ? "active" : ""
                }`}
                onClick={() => onNavigate(link.section)}
                aria-current={
                  activeSection === link.section ? "page" : undefined
                }
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="header-actions">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <button
              type="button"
              className="header-cta"
              onClick={() => onNavigate("contact")}
            >
              Start a Project
            </button>
          </div>
        </div>
      </Container>
    </header>
  );
}
