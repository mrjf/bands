/**
 * Band Server — Cloudflare Container
 *
 * Self-contained permission enforcement server.
 * Identical to the Lima VM server — same Hono app, same permission logic,
 * same real CLI, file I/O, and fetch capabilities.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";

let currentBand: any = null;

// --- Permission helpers (identical to Lima server) ---

function matchGlob(str: string, pattern: string): boolean {
  if (pattern === str) return true;
  if (pattern === '*' || pattern === '**') return true;
  const escaped = pattern
    .split('**').join('DOUBLESTAR')
    .split('*').join('SINGLESTAR')
    .split('.').join('[.]')
    .split('DOUBLESTAR').join('.*')
    .split('SINGLESTAR').join('.*');
  try {
    return new RegExp('^' + escaped + '$').test(str);
  } catch {
    return false;
  }
}

function checkPermission(value: string, allowPatterns?: string[], denyPatterns?: string[]): boolean {
  for (const pattern of (denyPatterns || [])) {
    if (matchGlob(value, pattern)) return false;
  }
  for (const pattern of (allowPatterns || [])) {
    if (matchGlob(value, pattern)) return true;
  }
  return false;
}

function isFirewallTest(payload: any): boolean {
  if (typeof payload !== 'object' || payload === null) return false;
  return 'testCli' in payload || 'testRead' in payload || 'testWrite' in payload || 'testNet' in payload;
}

function isOperationPayload(payload: any): boolean {
  if (typeof payload !== 'object' || payload === null) return false;
  return 'runCli' in payload || 'readFiles' in payload || 'writeFiles' in payload || 'fetchUrls' in payload;
}

function checkInsistSatisfied(band: any, tracker: any) {
  const missing: any[] = [];
  for (const pattern of (band.insist?.cli || [])) {
    const found = tracker.cli.some((cmd: string) => checkPermission(cmd, [pattern], []));
    if (!found) missing.push({ category: 'cli', pattern });
  }
  for (const pattern of (band.insist?.read || [])) {
    const found = tracker.read.some((path: string) => checkPermission(path, [pattern], []));
    if (!found) missing.push({ category: 'read', pattern });
  }
  for (const pattern of (band.insist?.write || [])) {
    const found = tracker.write.some((path: string) => checkPermission(path, [pattern], []));
    if (!found) missing.push({ category: 'write', pattern });
  }
  for (const pattern of (band.insist?.net || [])) {
    const found = tracker.net.some((host: string) => checkPermission(host, [pattern], []));
    if (!found) missing.push({ category: 'net', pattern });
  }
  return { satisfied: missing.length === 0, missing };
}

function checkPermissions(band: any, payload: any) {
  const results: any = { anyDenied: false };
  if (payload.testCli) {
    const allowed = checkPermission(payload.testCli, band.allow?.cli, band.deny?.cli);
    results.cli = { command: payload.testCli, allowed };
    if (!allowed) { results.anyDenied = true; results.deniedReason = 'CLI command denied: ' + payload.testCli; }
  }
  if (payload.testRead) {
    const allowed = checkPermission(payload.testRead, band.allow?.read, band.deny?.read);
    results.read = { path: payload.testRead, allowed };
    if (!allowed) { results.anyDenied = true; results.deniedReason = 'Read access denied: ' + payload.testRead; }
  }
  if (payload.testWrite) {
    const allowed = checkPermission(payload.testWrite, band.allow?.write, band.deny?.write);
    results.write = { path: payload.testWrite, allowed };
    if (!allowed) { results.anyDenied = true; results.deniedReason = 'Write access denied: ' + payload.testWrite; }
  }
  if (payload.testNet) {
    const allowed = checkPermission(payload.testNet, band.allow?.net, band.deny?.net);
    results.net = { host: payload.testNet, allowed };
    if (!allowed) { results.anyDenied = true; results.deniedReason = 'Network access denied: ' + payload.testNet; }
  }
  return results;
}

// --- Hono app ---

const app = new Hono();
app.use("*", cors());

app.get("/health", (c) => c.json({ ready: !!currentBand, band: currentBand?.band, version: '2.0' }));

app.post("/init", async (c) => {
  currentBand = await c.req.json();
  return c.json({ ok: true, band: currentBand.band });
});

app.post("/", async (c) => {
  if (!currentBand) return c.json({ error: { code: 'NOT_INITIALIZED', message: 'Call /init first' } }, 400);

  const startTime = Date.now();
  const band = currentBand;
  const payload = await c.req.json();
  const inputBytes = JSON.stringify(payload).length;

  // --- Firewall test (permission check only) ---
  if (isFirewallTest(payload)) {
    const permissions = checkPermissions(band, payload);

    if (permissions.anyDenied) {
      const durationMs = Date.now() - startTime;
      c.header('X-Band-Duration-Ms', String(durationMs));
      return c.json({
        error: { code: 'PERMISSION_DENIED', message: permissions.deniedReason },
        permissions,
        enforced: true,
      }, 403);
    }

    const result = {
      success: true,
      band: band.band,
      version: band.version,
      permissions,
      enforced: true,
      timestamp: new Date().toISOString(),
    };
    const outputBytes = JSON.stringify(result).length;
    const durationMs = Date.now() - startTime;
    c.header('X-Band-Input-Bytes', String(inputBytes));
    c.header('X-Band-Output-Bytes', String(outputBytes));
    c.header('X-Band-Duration-Ms', String(durationMs));
    return c.json(result);
  }

  // --- Operation payload (actual execution with insist tracking) ---
  if (isOperationPayload(payload)) {
    const tracker = { cli: [] as string[], read: [] as string[], write: [] as string[], net: [] as string[] };
    const operations: any = {};
    let permissionDenied: any = null;

    // Process CLI commands
    if (payload.runCli) {
      operations.cli = [];
      for (const cmd of payload.runCli) {
        tracker.cli.push(cmd);
        const allowed = checkPermission(cmd, band.allow?.cli, band.deny?.cli);
        if (!allowed) { permissionDenied = { type: 'cli', value: cmd }; break; }
        try {
          const proc = Bun.spawnSync(['bash', '-c', cmd], { timeout: 10000 });
          operations.cli.push({ command: cmd, allowed, output: proc.stdout.toString().trim() });
        } catch (err: any) {
          operations.cli.push({ command: cmd, allowed, error: err.message });
        }
      }
    }

    // Process file reads
    if (!permissionDenied && payload.readFiles) {
      operations.read = [];
      for (const path of payload.readFiles) {
        tracker.read.push(path);
        const allowed = checkPermission(path, band.allow?.read, band.deny?.read);
        if (!allowed) { permissionDenied = { type: 'read', value: path }; break; }
        try {
          const content = await Bun.file(path).text();
          operations.read.push({ path, allowed, content });
        } catch (err: any) {
          operations.read.push({ path, allowed, error: err.message });
        }
      }
    }

    // Process file writes
    if (!permissionDenied && payload.writeFiles) {
      operations.write = [];
      for (const item of payload.writeFiles) {
        tracker.write.push(item.path);
        const allowed = checkPermission(item.path, band.allow?.write, band.deny?.write);
        if (!allowed) { permissionDenied = { type: 'write', value: item.path }; break; }
        try {
          await Bun.write(item.path, item.content || '');
          operations.write.push({ path: item.path, allowed, written: true });
        } catch (err: any) {
          operations.write.push({ path: item.path, allowed, error: err.message });
        }
      }
    }

    // Process network fetches
    if (!permissionDenied && payload.fetchUrls) {
      operations.net = [];
      for (const url of payload.fetchUrls) {
        let host: string;
        try { host = new URL(url).hostname; } catch { host = url; }
        tracker.net.push(host);
        const allowed = checkPermission(host, band.allow?.net, band.deny?.net);
        if (!allowed) { permissionDenied = { type: 'net', value: url }; break; }
        try {
          const resp = await fetch(url);
          operations.net.push({ url, allowed, status: resp.status });
        } catch (err: any) {
          operations.net.push({ url, allowed, error: err.message });
        }
      }
    }

    // Permission denied
    if (permissionDenied) {
      const durationMs = Date.now() - startTime;
      c.header('X-Band-Duration-Ms', String(durationMs));
      return c.json({
        error: {
          code: 'PERMISSION_DENIED',
          message: permissionDenied.type + ' access denied: ' + permissionDenied.value,
        },
        operations,
        tracker,
        enforced: true,
      }, 403);
    }

    // Insist check
    const insistCheck = checkInsistSatisfied(band, tracker);
    if (!insistCheck.satisfied) {
      const durationMs = Date.now() - startTime;
      c.header('X-Band-Duration-Ms', String(durationMs));
      return c.json({
        error: {
          code: 'INSIST_NOT_SATISFIED',
          message: 'Required operations not performed: ' + insistCheck.missing.map((m: any) => m.category + ':' + m.pattern).join(', '),
        },
        operations,
        tracker,
        insist: { satisfied: false, missing: insistCheck.missing, enforced: true },
        enforced: true,
      }, 400);
    }

    // Success
    const result = {
      success: true,
      band: band.band,
      version: band.version,
      operations,
      tracker,
      insist: { satisfied: true, missing: [], enforced: true },
      enforced: true,
      timestamp: new Date().toISOString(),
    };
    const outputStr = JSON.stringify(result);
    const durationMs = Date.now() - startTime;
    c.header('X-Band-Input-Bytes', String(inputBytes));
    c.header('X-Band-Output-Bytes', String(outputStr.length));
    c.header('X-Band-Duration-Ms', String(durationMs));
    return c.json(result);
  }

  // --- Regular payload (basic execution tests) ---
  const result = {
    success: true,
    band: band.band,
    version: band.version,
    input: payload,
    timestamp: new Date().toISOString(),
    executedOn: 'cloudflare',
  };
  const outputStr = JSON.stringify(result);
  const durationMs = Date.now() - startTime;
  c.header('X-Band-Input-Bytes', String(inputBytes));
  c.header('X-Band-Output-Bytes', String(outputStr.length));
  c.header('X-Band-Duration-Ms', String(durationMs));
  return c.json(result);
});

export default { port: 9000, fetch: app.fetch };
