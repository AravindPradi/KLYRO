/**
 * Scheduled enquiry report.
 *
 *   npm run report -- --days 7
 *   npm run report -- --days 7 --out reports
 *   npm run report -- --days 7 --send        # posts to STUDIO_WEBHOOK_URL / Settings webhook
 *
 * Add to cron for a daily digest, e.g.:
 *   0 9 * * * cd /path/to/KLYRO && npm run report -- --days 1 --send >> logs/digest.log 2>&1
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadState } from "../server/lib/store.mjs";
import { buildSummary, digestMarkdown } from "../server/lib/reports.mjs";
import { notify } from "../server/lib/notify.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const valueOf = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const days = Number(valueOf("--days", "7")) || 7;
const outDir = valueOf("--out", "");
const send = args.includes("--send");

const state = loadState();
const summary = buildSummary(state, days);
const digest = digestMarkdown(state, days, summary);

console.log(digest);

if (outDir) {
  const dir = path.resolve(root, outDir);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `klyro-report-${new Date().toISOString().slice(0, 10)}.md`);
  fs.writeFileSync(file, digest);
  console.error(`[report] wrote ${file}`);
}

if (send) {
  const result = await notify("daily_digest", {
    text: `KLYRO enquiry digest (${days}d): ${summary.totals.inWindow} enquiries, ${summary.totals.hot} hot leads, ${summary.totals.followupsDue} follow-ups due, win rate ${summary.totals.conversionRate}%.`,
    days,
    digest,
    totals: summary.totals,
  }, state.settings);
  console.error(`[report] webhook: ${result.sent ? "delivered" : result.reason}`);
}
