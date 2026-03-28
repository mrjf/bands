/**
 * Lima VM setup and teardown.
 *
 * Provides reliable, step-by-step provisioning of the Lima VM
 * used by the lima executor. Each step verifies success before
 * proceeding, and failures produce actionable error messages.
 */

import { execSync } from "child_process";
import { writeFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const VM_NAME = "bands-executor";
const PORT = 9000;

const SERVER_SOURCE = `\
/**
 * Band Server — Lima VM
 *
 * Self-contained permission enforcement server.
 * Mirrors the Cloudflare worker logic but with real CLI, file I/O, and fetch.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";

let currentBand: any = null;

// --- Permission helpers (identical to Cloudflare worker) ---

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

    // Process CLI commands — Lima CAN execute these
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

    // Process file reads — Lima CAN read files
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

    // Process file writes — Lima CAN write files
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

    // Process network fetches — Lima CAN fetch
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
    executedOn: 'lima',
  };
  const outputStr = JSON.stringify(result);
  const durationMs = Date.now() - startTime;
  c.header('X-Band-Input-Bytes', String(inputBytes));
  c.header('X-Band-Output-Bytes', String(outputStr.length));
  c.header('X-Band-Duration-Ms', String(durationMs));
  return c.json(result);
});

export default { port: 9000, fetch: app.fetch };
`;

const SYSTEMD_UNIT = `\
[Unit]
Description=Band execution server
After=network.target

[Service]
ExecStart=%h/.bun/bin/bun run %h/bands-server/server.ts
Restart=always
WorkingDirectory=%h/bands-server

[Install]
WantedBy=default.target
`;

function log(step: string, msg: string) {
  console.log(`${step} ${msg}`);
}

function limaShell(cmd: string, opts?: { stdio?: "pipe" | "inherit" }): string {
  return execSync(`limactl shell ${VM_NAME} -- bash -c '${cmd}'`, {
    stdio: opts?.stdio ?? "pipe",
    encoding: "utf-8",
  }) as string;
}

export async function setupLima(options: { force?: boolean } = {}): Promise<void> {
  // [1/6] Check prerequisites
  log("[1/6]", "Checking prerequisites...");
  try {
    const version = execSync("limactl --version", { stdio: "pipe", encoding: "utf-8" }).trim();
    log("      ", `limactl found: ${version}`);
  } catch {
    console.error(
      "\nError: limactl is not installed.\n" +
        "Install it with: brew install lima\n" +
        "More info: https://lima-vm.io/"
    );
    process.exit(1);
  }

  // [2/6] Create Lima VM
  log("[2/6]", "Creating Lima VM...");
  const vmExists = checkVmExists();

  if (vmExists && options.force) {
    log("      ", "Force flag set — removing existing VM...");
    try { execSync(`limactl stop ${VM_NAME}`, { stdio: "pipe" }); } catch { /* already stopped */ }
    execSync(`limactl delete ${VM_NAME}`, { stdio: "pipe" });
    await createMinimalVm();
  } else if (vmExists) {
    const running = checkVmRunning();
    if (running) {
      log("      ", "VM already exists and is running — skipping creation");
    } else {
      log("      ", "VM exists but is stopped — starting...");
      execSync(`limactl start ${VM_NAME}`, { stdio: "inherit" });
    }
  } else {
    await createMinimalVm();
  }

  // [3/6] Install bun in VM
  log("[3/6]", "Installing bun in VM...");
  let bunInstalled = false;
  try {
    limaShell("which bun || ~/.bun/bin/bun --version");
    bunInstalled = true;
  } catch { /* not installed */ }

  if (!bunInstalled) {
    log("      ", "Installing prerequisites...");
    limaShell("sudo apt-get update -qq && sudo apt-get install -y -qq unzip curl iptables bubblewrap");
    log("      ", "Installing bun...");
    limaShell("curl -fsSL https://bun.sh/install | bash");
  }

  // Verify bun works
  try {
    const bunVersion = limaShell("~/.bun/bin/bun --version").trim();
    log("      ", `Bun ${bunVersion} ready`);
  } catch {
    console.error("\nError: Bun installation failed inside the VM.");
    console.error("Try running: band setup --force");
    process.exit(1);
  }

  // [4/6] Deploy band server
  log("[4/6]", "Deploying band server...");
  limaShell("mkdir -p ~/bands-server");

  // Write server.ts via stdin pipe to avoid shell escaping issues
  const serverB64 = Buffer.from(SERVER_SOURCE).toString("base64");
  limaShell(`echo '${serverB64}' | base64 -d > ~/bands-server/server.ts`);

  log("      ", "Installing dependencies...");
  limaShell("cd ~/bands-server && ~/.bun/bin/bun add hono");

  // Verify
  try {
    limaShell("ls ~/bands-server/node_modules/hono/package.json");
  } catch {
    console.error("\nError: Failed to install hono in the VM.");
    process.exit(1);
  }
  log("      ", "Server code deployed");

  // [5/6] Create and start systemd service
  log("[5/6]", "Creating systemd service...");
  limaShell("mkdir -p ~/.config/systemd/user");

  const unitB64 = Buffer.from(SYSTEMD_UNIT).toString("base64");
  limaShell(`echo '${unitB64}' | base64 -d > ~/.config/systemd/user/band-server.service`);

  limaShell("systemctl --user daemon-reload");
  limaShell("systemctl --user enable band-server");
  limaShell("systemctl --user restart band-server");
  limaShell("loginctl enable-linger $USER");
  log("      ", "Service enabled and started");

  // [6/6] Verify health endpoint
  log("[6/6]", "Verifying health endpoint...");
  const healthy = await pollHealth(`http://localhost:${PORT}`, 15_000);

  if (healthy) {
    console.log("\n✓ Lima VM is ready — band server running on http://localhost:9000");
  } else {
    console.error("\n✗ Health check failed. Service logs:");
    try {
      const logs = limaShell("systemctl --user status band-server 2>&1 || true");
      console.error(logs);
    } catch { /* ignore */ }
    process.exit(1);
  }
}

export async function teardownLima(): Promise<void> {
  console.log("Stopping and deleting Lima VM...");
  try {
    execSync(`limactl stop ${VM_NAME}`, { stdio: "inherit" });
  } catch {
    // May already be stopped
  }
  try {
    execSync(`limactl delete ${VM_NAME}`, { stdio: "inherit" });
    console.log("✓ Lima VM removed");
  } catch (err) {
    console.error(`Failed to delete VM: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

function checkVmExists(): boolean {
  try {
    const result = execSync("limactl list --json", { stdio: "pipe", encoding: "utf-8" });
    const parsed = JSON.parse(result);
    const vms = Array.isArray(parsed) ? parsed : [parsed];
    return vms.some((v: { name: string }) => v.name === VM_NAME);
  } catch {
    return false;
  }
}

function checkVmRunning(): boolean {
  try {
    const result = execSync("limactl list --json", { stdio: "pipe", encoding: "utf-8" });
    const parsed = JSON.parse(result);
    const vms = Array.isArray(parsed) ? parsed : [parsed];
    const vm = vms.find((v: { name: string }) => v.name === VM_NAME);
    return vm?.status === "Running";
  } catch {
    return false;
  }
}

async function createMinimalVm(): Promise<void> {
  const config = `\
# Lima VM for band execution — no provisioning scripts
images:
  - location: "https://cloud-images.ubuntu.com/releases/24.04/release/ubuntu-24.04-server-cloudimg-amd64.img"
    arch: "x86_64"
  - location: "https://cloud-images.ubuntu.com/releases/24.04/release/ubuntu-24.04-server-cloudimg-arm64.img"
    arch: "aarch64"

cpus: 2
memory: "2GiB"
disk: "10GiB"

portForwards:
  - guestPort: 9000
    hostPort: ${PORT}
`;

  const tempDir = mkdtempSync(join(tmpdir(), "lima-bands-"));
  const configPath = join(tempDir, `${VM_NAME}.yaml`);

  try {
    writeFileSync(configPath, config);
    log("      ", "Creating VM (this may take a few minutes)...");
    execSync(`limactl create --name=${VM_NAME} ${configPath}`, { stdio: "inherit" });
    execSync(`limactl start ${VM_NAME}`, { stdio: "inherit" });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function pollHealth(url: string, maxWaitMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const resp = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (resp.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}
