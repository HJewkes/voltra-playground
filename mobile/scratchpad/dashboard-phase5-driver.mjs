/**
 * Phase 5 a11y-proof driver (VMCP-01.49).
 *
 * Serves the freshly-built SPA (dist/spa) plus a mock /api/snapshot for the
 * active-set scenario (same fixture shape as the Phase 4 driver), screenshots
 * /app via Playwright to confirm no visual regression from the a11y pass, and
 * dumps a slice of the accessibility tree to confirm the panel region
 * landmarks / aria-live wiring actually reached the DOM.
 *
 * Usage (from ~/Documents/projects/voltras/mobile so Playwright resolves):
 *   node <path-to-this-file>
 *
 * NDA: only /api/snapshot JSON is fabricated — no protocol bytes/frames/codes.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const SPA_DIR = '/Users/hjewkes/Documents/projects/voltras-mcp/dist/spa';
const OUT_DIR = '/private/tmp/claude-501/-Users-hjewkes-Library-Application-Support-active-work-voltras-workspace/c752be7b-622c-4e8c-a982-b8c14e644c06/scratchpad';

const CONTENT_TYPE = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

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
  session: { sessionId: 's-phase5', exerciseName: 'Cable Chest Press' },
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

const server = createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0];
  if (url === '/api/snapshot') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(activeSet));
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
await page.goto(appUrl, { waitUntil: 'load' });
await page.waitForTimeout(1500);

const outPath = join(OUT_DIR, 'dashboard-phase5-active-set.png');
await page.screenshot({ path: outPath, fullPage: true });

// Confirm the new region landmarks + aria-live wiring reached the DOM.
const regionLabels = await page.$$eval('section[role="region"]', (els) =>
  els.map((el) => el.getAttribute('aria-label')),
);
const setLogLive = await page.$eval(
  '.dashboard section[aria-label="Sets this session"] [aria-live]',
  (el) => el.getAttribute('aria-live'),
).catch(() => null);
const statusRole = await page.$eval('.status-chip', (el) => el.getAttribute('role')).catch(() => null);
const statusLive = await page.$eval('.status-chip', (el) => el.getAttribute('aria-live')).catch(() => null);
const bodyMapToggleLabels = await page.$$eval(
  '[data-testid="body-map-view-toggle"] [role="button"]',
  (els) => els.map((el) => el.getAttribute('aria-label')),
).catch(() => []);
const muscleLegendLabels = await page.$$eval(
  '[data-testid="body-map-legend"] [role="button"]',
  (els) => els.map((el) => el.getAttribute('aria-label')),
).catch(() => []);

console.log(
  JSON.stringify(
    { outPath, regionLabels, setLogLive, statusRole, statusLive, bodyMapToggleLabels, muscleLegendLabels },
    null,
    2,
  ),
);

await browser.close();
server.close();
