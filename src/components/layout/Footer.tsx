
import { Link } from "react-router-dom";
import Container from "../ui/Container";
import type { SectionName } from "../../hooks/useSectionNavigation";
import "./Footer.css";

type FooterProps = {
  onNavigate: (section: SectionName) => void;
};

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="site-footer">
      <Container>
        <div className="footer-main">
          <div className="footer-brand-block">
            <button
              type="button"
              className="footer-brand"
              onClick={() => onNavigate("home")}
            >
              KLYRO<span>.</span>
            </button>

            <p>Clarity, designed.</p>

            <span className="footer-description">
              Independent creative studio focused on graphic design
              and Instagram content strategy.
            </span>
          </div>

          <div className="footer-column">
            <h3>EXPLORE</h3>
            <button onClick={() => onNavigate("work")}>Work</button>
            <button onClick={() => onNavigate("services")}>Services</button>
            <button onClick={() => onNavigate("process")}>Process</button>
            <button onClick={() => onNavigate("about")}>About</button>
            <button onClick={() => onNavigate("brief")}>AI Brief Studio</button>
          </div>

          <div className="footer-column">
            <h3>GET IN TOUCH</h3>
            <button onClick={() => onNavigate("contact")}>
              Start a Project
            </button>
            <a href="mailto:technologiiaa@proton.me">Email KLYRO</a>
            <Link to="/studio">Studio Login</Link>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} KLYRO Creative Studio.</p>
          <p>Independent by design.</p>
        </div>
      </Container>
    </footer>
  );
}
