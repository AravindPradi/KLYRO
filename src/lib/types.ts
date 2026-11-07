export type Grade = "hot" | "warm" | "cool";
export type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";

export type ScoreReason = { points: number; reason: string };
export type Intent = { key: string; label: string; confidence: number };
export type Analysis = {
  primaryIntent: string;
  intents: Intent[];
  keywords: string[];
  urgency: string;
  budgetMentioned: boolean;
  riskSignals: string[];
  wordCount: number;
  suggestedServices: string[];
  missingInfo: string[];
  summary: string;
};
export type Note = { id: string; at: string; text: string };

export type Enquiry = {
  id: string;
  reference: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  email: string;
  company: string;
  instagram: string;
  service: string;
  serviceKey: string;
  message: string;
  budget: string;
  timeline: string;
  source: string;
  status: LeadStatus;
  analysis: Analysis;
  notes: Note[];
  demo?: boolean;
  briefId: string | null;
  proposalId: string | null;
  score: number;
  grade: Grade;
  scoreReasons: ScoreReason[];
};

export type Deliverable = { name: string; quantity: string; detail: string };
export type Objective = { title: string; goal: string; metric: string };
export type Palette = { name: string; hex: string; use: string };
export type Pillar = { name: string; purpose: string; share: string; exampleTopics: string[] };
export type CalendarPost = { day: string; format: string; pillar: string; hook: string; captionStarter: string; cta: string; designNote: string };
export type CalendarWeek = { week: number; theme: string; posts: CalendarPost[] };

export type Brief = {
  id?: string;
  enquiryId?: string;
  shareToken?: string;
  createdAt?: string;
  engine: string;
  generatedAt: string;
  title: string;
  confidence: number;
  clientSnapshot: Record<string, string | number>;
  detectedSignals: {
    keywords: string[];
    primaryIntent: string;
    intents: Intent[];
    inferredServices: string;
    industryProfile: string;
    goals: string[];
    styleWords: string;
    avoid: string;
  };
  summary: string;
  positioning?: string;
  objectives: Objective[];
  services: { design: boolean; instagram: boolean; key: string; label: string };
  recommendedPackage: { name: string; range: string; why: string };
  scope: { included: string[]; excluded: string[] };
  deliverables: Deliverable[];
  designDirection: { mood: string; styleNotes: string; palette: Palette[]; typography: string; layoutRules: string[]; assetList: string[] };
  contentPillars: Pillar[];
  calendar: CalendarWeek[];
  hashtagSets: { name: string; tags: string[] }[];
  clarifyingQuestions: string[];
  assumptions: string[];
  timeline: { phase: string; duration: string; outcome: string }[];
  estimate: { currency: string; min: number; max: number; setup: number; retainerNote: string; breakdown: { label: string; value: number }[] };
  nextSteps: string[];
  missingInfo: string[];
};

export type Proposal = {
  id: string;
  token: string;
  enquiryId: string | null;
  briefId: string | null;
  createdAt: string;
  validUntil: string;
  status: "sent" | "approved" | "declined";
  approvedAt: string | null;
  clientName: string;
  clientCompany: string;
  studioName: string;
  ownerEmail: string;
  title: string;
  summary: string;
  objectives: string[];
  package: { name: string; range: string };
  deliverables: Deliverable[];
  timeline: { phase: string; duration: string; outcome: string }[];
  investment: { min: number; max: number; currency: string; note: string };
  terms: string[];
  nextSteps: string[];
  approvalNote?: string;
  declineNote?: string;
};

export type Followup = {
  id: string;
  enquiryId: string;
  dueAt: string;
  type: string;
  channel: string;
  message: string;
  done: boolean;
  completedAt: string | null;
  demo?: boolean;
};

export type Prospect = {
  id: string;
  createdAt: string;
  name: string;
  niche: string;
  city: string;
  instagram: string;
  website: string;
  email: string;
  phone: string;
  followers: number;
  postsPerWeek: number;
  lastPostDays: number;
  hasWebsite: boolean;
  signal: string;
  status: string;
  score: number;
  grade: Grade;
  reasons: ScoreReason[];
  demo?: boolean;
  sample?: boolean;
};

export type Campaign = {
  id: string;
  createdAt: string;
  params: { niche: string; city: string; platform: string; offer: string };
  headline: string;
  summary: string;
  segments: { name: string; why: string; where: string }[];
  searchStrings: { channel: string; label: string; query: string }[];
  qualificationSignals: { signal: string; points: number; meaning: string }[];
  outreach: { step: number; when: string; channel: string; label: string; subject: string; body: string }[];
  dailyWorkflow: string[];
  compliance: string;
  sampleTargets: Prospect[];
};

export type Activity = {
  id: string;
  at: string;
  type: string;
  title: string;
  description: string;
  enquiryId?: string;
  demo?: boolean;
};

export type Settings = {
  studioName: string;
  ownerEmail: string;
  currency: string;
  responseSlaHours: number;
  webhookUrl: string;
  autoReplyEnabled: boolean;
  followUpDays: number[];
  packages: Record<string, { min: number; max: number; label: string }>;
};

export type Insight = { level: "good" | "warning" | "tip" | "info"; text: string };

export type Summary = {
  generatedAt: string;
  windowDays: number;
  totals: {
    enquiries: number; inWindow: number; last7: number; changeVsPrev7: number;
    new: number; hot: number; open: number; won: number; lost: number;
    conversionRate: number; proposalToWinRate: number; proposals: number;
    avgScore: number; pipelineValue: number; avgFirstResponseHours: number;
    followupsDue: number; demoRecords: number; aiEngine: string;
  };
  trend: { date: string; count: number }[];
  byStatus: { key: string; label: string; value: number }[];
  byService: { key: string; label: string; value: number }[];
  bySource: { key: string; label: string; value: number }[];
  byIntent: { key: string; label: string; value: number }[];
  topLeads: { id: string; name: string; company: string; score: number; grade: Grade; status: string; service: string; createdAt: string; reference: string }[];
  recentActivity: Activity[];
  insights: Insight[];
};

export type Bootstrap = {
  summary: Summary;
  enquiries: Enquiry[];
  followups: Followup[];
  proposals: Proposal[];
  prospects: Prospect[];
  activity: Activity[];
  briefs: { id: string; enquiryId: string; createdAt: string; shareToken: string; title: string; confidence: number; engine: string; services: { key: string; label: string } }[];
  settings: Settings;
};

export type StudioTab = "overview" | "enquiries" | "reports" | "prospects" | "settings";
