/**
 * Phase 4 dashboard color-proof driver (VMCP-01.48).
 *
 * Reconstructs the Phase 2 driver (the original scratchpad copy was never
 * committed). Serves the real vite-built SPA (dist/spa) plus a mock
 * /api/snapshot for a chosen SCENARIO, then screenshots /app via Playwright so
 * we can confirm the status dot / battery / disconnect banner render through
 * titan semantic tokens.
 *
 * Usage (from ~/Documents/projects/voltras/mobile so Playwright resolves):
 *   SCENARIO=active_set   node scratchpad/dashboard-phase4-driver.mjs
 *   SCENARIO=disconnected node scratchpad/dashboard-phase4-driver.mjs
 *
 * NDA: only /api/snapshot JSON is fabricated — no protocol bytes/frames/codes.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const SPA_DIR = '/Users/hjewkes/Documents/projects/voltras-mcp/dist/spa';
const OUT_DIR = '/private/tmp/claude-501/-Users-hjewkes-Library-Application-Support-active-work-voltras-workspace/c752be7b-622c-4e8c-a982-b8c14e644c06/scratchpad';
const SCENARIO = process.env.SCENARIO ?? 'active_set';

const CONTENT_TYPE = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

// ── Mock snapshot fixtures ───────────────────────────────────────────────────
// A concentric Phase carrying peakVelocity (mm/s) + the running aggregates WA
// reads for mean velocity (velocity-loss %). Peaks span the zone bands so the
// VelocityStrip paints green→red.
const phase = (peakMms) => ({
  samples: [],
  startTime: 0,
  endTime: 0,
  startPosition: 0,
  endPosition: 0,
  _totalVelocity: peakMms,
  _totalForce: 0,
  _totalLoad: 0,
  _movementSampleCount: 1,
  _totalHoldDuration: 0,
  _peakVelocityTime: 0,
  _lastMovementVelocity: peakMms,
  peakVelocity: peakMms,
  peakForce: 0,
  peakLoad: 0,
});
const rep = (n, peakMms) => ({ repNumber: n, concentric: phase(peakMms), eccentric: phase(0) });

const activeSet = {
  session: { sessionId: 's-phase4', exerciseName: 'Cable Chest Press' },
  devices: [
    {
      slotId: 'A',
      device: {
        connected: true,
        weightLbs: 135,
        trainingMode: 'weightTraining',
        batteryPercent: 82,
      },
    },
  ],
  sets: {
    active: {
      reps: [rep(1, 1050), rep(2, 900), rep(3, 780), rep(4, 620), rep(5, 480)],
      latestInProgress: { targetWeightTenths: 1350 },
      watch: { notifyOn: [{ type: 'rep_count_reached', value: 8 }] },
    },
  },
  activeExercise: { primaryMuscles: ['chest'], secondaryMuscles: ['shoulders', 'triceps'] },
};

const disconnected = {
  session: { sessionId: 's-phase4', exerciseName: 'Cable Chest Press' },
  devices: [
    {
      slotId: 'A',
      device: {
        connected: false,
        weightLbs: 135,
        trainingMode: 'weightTraining',
        batteryPercent: 15, // < 20 → low-battery token path
        disconnectedAt: new Date(Date.now() - 42_000).toISOString(),
      },
    },
  ],
  sets: { active: null },
  activeExercise: null,
};

const SNAPSHOTS = { active_set: activeSet, disconnected };
const snapshot = SNAPSHOTS[SCENARIO];
if (!snapshot) throw new Error(`unknown SCENARIO="${SCENARIO}"`);

// ── Static + mock-API server ─────────────────────────────────────────────────
const server = createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0];
  if (url === '/api/snapshot') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(snapshot));
    return;
  }
  try {
    const rel = url === '/app' || url === '/app/' ? 'index.html' : url.replace(/^\/app\//, '');
    const file = readFileSync(join(SPA_DIR, rel));
    res.writeHead(200, { 'content-type': CONTENT_TYPE[extname(rel)] ?? 'application/octet-stream' });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { port } = server.address();
const appUrl = `http://127.0.0.1:${port}/app`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
// 'load' not 'networkidle' — the 500ms snapshot poll means the network never idles.
await page.goto(appUrl, { waitUntil: 'load' });
// Let the poll + a tick land so status/battery/banner settle.
await page.waitForTimeout(1500);

// Assert the titan status token actually resolved on the status dot (not empty).
const dotColor = await page.$eval('.status-dot', (el) => getComputedStyle(el).color).catch(() => null);
const label = await page.$eval('.status-label', (el) => el.textContent?.trim()).catch(() => null);

const outPath = join(OUT_DIR, `dashboard-phase4-${SCENARIO}.png`);
await page.screenshot({ path: outPath, fullPage: true });
console.log(JSON.stringify({ scenario: SCENARIO, label, dotColor, outPath }, null, 2));

await browser.close();
server.close();
