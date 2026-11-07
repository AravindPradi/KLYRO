import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export type SectionName =
  | "home"
  | "work"
  | "services"
  | "process"
  | "about"
  | "contact"
  | "brief";

const SECTIONS: SectionName[] = ["home", "work", "services", "process", "about", "contact", "brief"];

function sectionFromLocation(pathname: string, hash: string): SectionName {
  if (pathname.startsWith("/brief")) return "brief";
  const value = hash.replace("#", "") as SectionName;
  return SECTIONS.includes(value) ? value : "home";
}

/**
 * URL-driven section navigation so every part of the site can be deep-linked
 * (e.g. /#services) while keeping the existing fade transition.
 */
export default function useSectionNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const target = sectionFromLocation(location.pathname, location.hash);
  const [rendered, setRendered] = useState<SectionName>(target);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (target === rendered) return;
    // Both state updates happen in timer callbacks, never synchronously in
    // the effect body, so the fade stays smooth without cascading renders.
    const hide = window.setTimeout(() => setIsVisible(false), 0);
    const show = window.setTimeout(() => {
      setRendered(target);
      window.scrollTo({ top: 0, behavior: "instant" });
      setIsVisible(true);
    }, 220);
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(show);
    };
  }, [target, rendered]);

  const navigateTo = useCallback(
    (section: SectionName) => {
      navigate(section === "brief" ? "/brief" : section === "home" ? "/" : `/#${section}`);
    },
    [navigate],
  );

  return { activeSection: rendered, isVisible, navigateTo };
}
