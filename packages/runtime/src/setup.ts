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

// Server source is loaded from band-server.ts at deploy time
import { readFileSync } from "fs";
import { join, dirname } from "path";

function getServerSource(): string {
  // Try loading from the same directory as this file
  const candidates = [
    join(dirname(new URL(import.meta.url).pathname), "band-server.ts"),
    join(process.cwd(), "packages/runtime/src/band-server.ts"),
    join(process.cwd(), "src/band-server.ts"),
  ];
  for (const p of candidates) {
    try {
      return readFileSync(p, "utf-8");
    } catch { /* try next */ }
  }
  throw new Error("Could not find band-server.ts");
}

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

  // [4/7] Create band-runner user
  log("[4/7]", "Creating band-runner user...");
  try {
    limaShell("id band-runner");
    log("      ", "band-runner user already exists");
  } catch {
    limaShell("sudo useradd --system --no-create-home --shell /usr/sbin/nologin band-runner");
    log("      ", "band-runner user created");
  }

  // [5/7] Deploy band server
  log("[5/7]", "Deploying band server...");
  limaShell("mkdir -p ~/bands-server");

  // Read server source from band-server.ts and deploy to VM
  const serverSource = getServerSource();
  const serverB64 = Buffer.from(serverSource).toString("base64");
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

  // [6/7] Create and start systemd service
  log("[6/7]", "Creating systemd service...");
  limaShell("mkdir -p ~/.config/systemd/user");

  const unitB64 = Buffer.from(SYSTEMD_UNIT).toString("base64");
  limaShell(`echo '${unitB64}' | base64 -d > ~/.config/systemd/user/band-server.service`);

  limaShell("systemctl --user daemon-reload");
  limaShell("systemctl --user enable band-server");
  limaShell("systemctl --user restart band-server");
  limaShell("loginctl enable-linger $USER");
  log("      ", "Service enabled and started");

  // [7/7] Set up default firewall (locked down) and verify health
  log("[7/7]", "Setting up default firewall and verifying...");

  // Default iptables: DROP all outbound except loopback, DNS, and established
  limaShell(`sudo iptables -F OUTPUT 2>/dev/null || true`);
  limaShell(`sudo iptables -P OUTPUT DROP`);
  limaShell(`sudo iptables -A OUTPUT -o lo -j ACCEPT`);
  limaShell(`sudo iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT`);
  limaShell(`sudo iptables -A OUTPUT -p udp --dport 53 -j ACCEPT`);
  limaShell(`sudo iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT`);
  log("      ", "Default firewall: DROP all outbound (DNS + loopback allowed)");
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
