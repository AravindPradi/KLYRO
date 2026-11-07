export const GOAL_OPTIONS = [
  "Get more enquiries / leads",
  "Increase product sales",
  "Grow an engaged following",
  "Launch a new brand or product",
  "Look more professional",
  "Post consistently",
  "Rebrand / refresh visuals",
  "Save time on content",
] as const;

export const DESIGN_OPTIONS = [
  "Logo & brand identity",
  "Brand guidelines / kit",
  "Social post templates",
  "Packaging & labels",
  "Posters / flyers / ads",
  "Presentation deck",
] as const;

export const INSTAGRAM_OPTIONS = [
  "Content strategy & pillars",
  "Monthly content calendar",
  "Caption writing",
  "Reel concepts",
  "Story templates",
  "Grid / visual system",
  "Hashtag & discovery research",
  "Monthly analytics review",
] as const;

export const BUDGET_OPTIONS = ["Under ₹25,000", "₹25,000 – ₹60,000", "₹60,000+", "Not decided yet"] as const;
export const TIMELINE_OPTIONS = ["Within 1 month", "1–3 months", "Flexible", "Exploring"] as const;
export const STAGE_OPTIONS = ["Just starting", "Growing", "Established", "Relaunching"] as const;
export const TONE_OPTIONS = ["Warm & editorial", "Minimal & calm", "Bold & energetic", "Playful & friendly", "Premium & refined"] as const;
export const INDUSTRY_OPTIONS = [
  "Café / restaurant / F&B",
  "Beauty / skincare / D2C",
  "Interiors / architecture",
  "Wellness / yoga / fitness",
  "Fashion / jewellery / craft",
  "Tech / services / education",
  "Hospitality / travel",
  "Retail / local business",
  "Something else",
] as const;

export const SERVICE_OPTIONS = [
  { value: "design", label: "Graphic Design", hint: "Identity, templates, packaging, campaign assets" },
  { value: "instagram", label: "Instagram Curation", hint: "Strategy, calendar, captions, visual system" },
  { value: "both", label: "Both Services", hint: "One coherent brand + content system" },
  { value: "unsure", label: "Not Sure Yet", hint: "Let the brief recommend a scope" },
] as const;

export const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal sent" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
] as const;

export const STATUS_LABELS: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s.label]));
export const SERVICE_LABELS: Record<string, string> = {
  design: "Graphic Design", instagram: "Instagram Curation", both: "Both Services", unsure: "Not Sure Yet",
};
export const SOURCE_LABELS: Record<string, string> = {
  "contact-form": "Contact form", "brief-studio": "AI Brief Studio", proposal: "Proposal", csv: "CSV import", manual: "Manual", demo: "Demo",
};

export type BriefAnswers = {
  brand: string;
  industry: string;
  handle: string;
  website: string;
  location: string;
  stage: string;
  goals: string[];
  audience: string;
  audienceAge: string;
  tone: string;
  services: string;
  designNeeds: string[];
  instagramNeeds: string[];
  postsPerMonth: number;
  styleWords: string;
  colorsAvoid: string;
  competitors: string;
  budget: string;
  timeline: string;
  notes: string;
};

export const EMPTY_ANSWERS: BriefAnswers = {
  brand: "", industry: "", handle: "", website: "", location: "", stage: "Growing",
  goals: [], audience: "", audienceAge: "", tone: "Warm & editorial", services: "both",
  designNeeds: [], instagramNeeds: [], postsPerMonth: 12, styleWords: "", colorsAvoid: "",
  competitors: "", budget: "", timeline: "", notes: "",
};
