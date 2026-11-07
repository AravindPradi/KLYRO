# KLYRO — Creative Studio + Studio OS

An independent creative studio website for **graphic design** and **Instagram curation**, plus a complete
client-acquisition system built on top of it:

| What you asked for | What is built |
| --- | --- |
| Automated system that makes clients through the website | **AI Brief Studio** (free, instant requirement document → lead capture → auto-drafted proposal), real API-backed contact form, lead scoring, auto-reply drafts, follow-up sequence, shareable proposals with one-click client approval |
| Reports about enquiries | Private **Studio OS** dashboard with KPIs, 14-day trend, service/source/status mix, win rate, pipeline value, automated insights, CSV exports, Markdown digests and a cron-ready report script |
| AI model that generates client requirements for design & Instagram | **Local brief engine**: intent detection, industry profiles, scope/pricing inference, deliverables, design direction + palette, content pillars, a 4-week post calendar with hooks/captions/CTAs, clarifying questions, timeline and estimate. Optional OpenAI-compatible LLM refinement |
| Find new customers | **Prospecting workspace**: search playbooks, segment definitions, qualification rubric, fit scoring, CSV import (own research / authorised APIs), 3-touch outreach scripts and one-click conversion into the enquiry pipeline |

> The original portfolio design, sections, images and theme system are preserved. Everything new follows
> the same ivory / ink / brass design language.

---

## Quick start

```bash
npm install
npm run dev:all          # API on :8787 + website on :5173
```

Open `http://localhost:5173` for the site and `http://localhost:5173/studio` for the dashboard.

**Local demo passphrase:** `klyro-studio` (shown on the login screen). Set `STUDIO_PASSPHRASE` before deploying.

Sample enquiries, prospects and follow-ups are loaded on first run so the charts and reports have data.
They are tagged **DEMO** and can be removed in one click at **Studio → Settings → Clear all demo data**.

Other commands:

```bash
npm run build            # typecheck + production build
npm start                # production: one Node server serves dist/ + /api on PORT
npm run lint
npm run test:run         # 28 engine, API integration and UI smoke tests
npm run report -- --days 7 --send   # enquiry digest to stdout / webhook
```

---

## The client funnel, end to end

1. **Attract.** A visitor clicks *Build your free AI brief* (hero, header, footer, contact section).
2. **Value first.** Five short steps generate a full creative brief instantly — no account, no email required.
   It contains objectives, deliverables with quantities, a design direction with palette, 3–5 Instagram
   content pillars, a 4-week calendar (format, hook, caption starter, CTA, design note), hashtag sets,
   clarifying questions, assumptions, a timeline and a price range.
3. **Capture.** The visitor enters name + email to keep the brief. The server saves the enquiry, drafts an
   indicative proposal, and returns shareable links. If the brief engine is unsure, it recommends a scope.
4. **Qualify.** Every enquiry (contact form or brief studio) gets a transparent 0–100 score with human-readable
   reasons, intent classification, urgency, missing information and a suggested first reply.
5. **Nurture.** Follow-ups are scheduled automatically at day 1 / 3 / 7 (configurable). New enquiries and
   proposal approvals can be pushed to a webhook (Slack, Discord, Zapier, Make, n8n → email).
6. **Close.** The client opens a branded proposal page and clicks **Approve**. The lead flips to *Won*,
   follow-ups close, and an activity event is recorded.
7. **Report.** Studio → Reports shows live numbers, auto-written recommendations, CSV/Markdown exports and
   a digest ready to email or schedule.

### Try it in two minutes

1. Go to `/brief`, fill in the wizard, click **Generate my free brief**.
2. Scroll to *Keep this brief, get a written proposal*, enter your email and submit.
3. Open the proposal link, click **Approve this proposal**.
4. Log into `/studio` and watch the lead appear as **Won** in Overview and Reports.

---

## Architecture

```
src/                              React 19 + TypeScript + Vite (original site + new UI)
  App.tsx                         routing: / , /#section , /brief , /brief/:token ,
                                  /proposal/:token , /studio
  components/sections/Contact.tsx API-backed enquiry form (was mailto:)
  pages/BriefStudio.tsx           public AI brief wizard + generated brief + lead capture
  pages/ProposalPage.tsx          client-facing proposal with approve / decline
  pages/Studio.tsx                private CRM shell + passphrase login
  components/studio/              Overview, Enquiries, Reports, Prospects, Settings, Charts
  lib/                            shared types, option lists, API helpers
server/                           zero-dependency Node HTTP API
  index.mjs                       routes, validation, rate limiting, auth, static files
  lib/store.mjs                   atomic JSON persistence + demo seed
  lib/lead-intel.mjs              intent detection, lead scoring, auto-reply, follow-ups
  lib/brief-engine.mjs            requirement generation (design + Instagram)
  lib/prospect-intel.mjs          campaign playbooks, CSV parser, fit scoring, outreach
  lib/reports.mjs                 aggregation, insights, CSV and Markdown reports
  lib/proposal.mjs                scope → shareable proposal
  lib/llm.mjs                     optional OpenAI-compatible narrative refinement
  lib/auth.mjs                    passphrase → signed httpOnly session cookie
  lib/notify.mjs                  webhook notifications
scripts/dev.mjs                   runs API + Vite together
scripts/digest.mjs                scheduled report CLI
data/klyro.json                   gitignored local database (created on first run)
```

**No database server, no runtime npm dependencies for the backend, no third-party AI required.**
All data stays in `data/klyro.json` on your server. Back that file up.

---

## The "AI" — how it actually works, and how to upgrade it

`server/lib/brief-engine.mjs` is a deterministic, explainable inference engine:

- lexical intent detection (launch / rebrand / growth / production / sales …) with confidence scores;
- industry profiles (café, beauty/D2C, interiors, wellness, fashion, tech) with their own pillars,
  topic banks, palettes, typography and hashtags;
- scope → deliverables with quantities derived from posts/month;
- budget + scope → package tier and an itemised estimate;
- seeded variation so two similar brands get different, but stable, calendars;
- a confidence score that rises with audience, budget and goal clarity.

This means it works offline, produces the same result for the same input, never invents client facts,
and never sends your clients' data anywhere. It is not a large language model; it is a specialised
rules + templates model for creative briefs.

**Optional LLM refinement:** set `KLYRO_AI_BASE_URL`, `KLYRO_AI_API_KEY` and optionally `KLYRO_AI_MODEL`
for any OpenAI-compatible `/chat/completions` endpoint. The model only rewrites the summary, style notes,
positioning and clarifying questions. Scope, deliverables, calendar and pricing always come from the local
engine, so a failed/expensive/missing model silently falls back to the offline result.

---

## Finding new customers — honest scope

The prospecting workspace **does not scrape Instagram or Google**. Unauthorised scraping breaks platform
terms, produces poor data and can get a business account restricted. Instead it gives you:

- exact Google Maps / boolean / hashtag / directory / referral search strings for a niche + city;
- four target segments with the reason each one buys;
- a qualification rubric (dormant page, no website, launch trigger, audience size …);
- a 30-minute daily prospecting loop and a 3-touch personal outreach sequence;
- CSV import + automatic fit scoring for leads you collected legitimately (your research, referrals,
  networking, or an authorised API such as Google Places / Instagram Graph API);
- one-click conversion of a prospect into an enquiry.

Always use public business information, personalise messages and honour opt-outs.

---

## Configuration

Copy `.env.example` to `.env` and load it with your process manager (or `node --env-file=.env`).

| Variable | Default | Purpose |
| --- | --- | --- |
| `STUDIO_PASSPHRASE` | `klyro-studio` in dev, generated in prod | Dashboard password |
| `KLYRO_SESSION_SECRET` | random per process | Keeps sessions valid across restarts |
| `KLYRO_SECURE_COOKIES` | `false` | Set `true` behind HTTPS |
| `STUDIO_WEBHOOK_URL` | empty | Slack/Discord/Zapier/Make/n8n alerts |
| `KLYRO_DATA_FILE` | `./data/klyro.json` | JSON database location |
| `PORT` | `8787` | API / production server port |
| `KLYRO_AI_BASE_URL`, `KLYRO_AI_API_KEY`, `KLYRO_AI_MODEL` | empty | Optional LLM refinement |
| `KLYRO_API_TARGET` | `http://127.0.0.1:8787` | Vite dev proxy target |

Settings editable in the UI: studio name, reply-to email, response SLA, follow-up days, webhook URL,
auto-reply toggle, and clearing demo data.

### Notifications & email

Email delivery is delegated to a webhook so no SMTP credentials live in the app. Point
`STUDIO_WEBHOOK_URL` at a Zapier/Make/n8n scenario that sends an email (or at a Slack/Discord channel)
and every new enquiry / approval will arrive there with the reference, score and suggested reply.
The Studio drawer also gives you the reply text plus a ready `mailto:` link for manual sending.

### Deploying

```bash
npm install
npm run build
STUDIO_PASSPHRASE='a-long-secret' NODE_ENV=production PORT=8787 npm start
```

One Node process then serves the built React app and `/api` from the same origin. Put it behind HTTPS
(Caddy / nginx / a platform proxy), set `KLYRO_SECURE_COOKIES=true`, and persist `data/` on a volume.

Or use the included container (a `data/` volume keeps your client records):

```bash
docker build -t klyro .
docker run -d -p 8787:8787 \
  -e STUDIO_PASSPHRASE='a-long-secret' \
  -e STUDIO_WEBHOOK_URL='https://hooks.slack.com/...' \
  -v klyro-data:/app/data \
  --name klyro klyro
```

For a daily digest, add a cron job:

```cron
0 9 * * * cd /srv/klyro && npm run report -- --days 1 --send >> logs/digest.log 2>&1
```

---

## Notes on the demo data

On the first run the workspace seeds 14 fictional enquiries, 5 prospects and a few follow-ups with dates
spread over the last month. They exist only so that conversion rates, trends and reports are meaningful
when you first open the dashboard. They are clearly marked `demo` (badged in the UI, counted in reports)
and are removed by **Settings → Clear all demo data** without touching real records.

## Tests

`npm run test:run` covers the brief engine, lead scoring, CSV parsing, prospect scoring, report
aggregation, a full HTTP integration run (login → contact form → brief → proposal → approval →
reports → prospect import → settings) against a temporary database, and jsdom smoke tests for the
public brief wizard, contact form and Studio login.
