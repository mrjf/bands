import { spawn, type Subprocess } from "bun";
import { join } from "path";
import { watch } from "fs/promises";

const ROOT = import.meta.dir;
const PUBLIC = join(ROOT, "public");
const API_SRC = join(ROOT, "api");
const FORMAT_SRC = join(ROOT, "../../format/src");
const BANDS_SRC = join(ROOT, "../../bands");
const SKILLS_SRC = join(ROOT, "../../../skills");

let server: Subprocess | null = null;
let building = false;

async function buildClient() {
  if (building) return;
  building = true;
  console.log("[dev] Building client...");
  try {
    const result = await Bun.build({
      entrypoints: [join(PUBLIC, "app.ts")],
      outdir: PUBLIC,
      target: "browser",
    });
    if (result.success) {
      console.log("[dev] Client built.");
    } else {
      console.error("[dev] Build failed:", result.logs);
    }
  } catch (e) {
    console.error("[dev] Build error:", e);
  }
  building = false;
}

async function startServer() {
  if (server) {
    server.kill();
    await server.exited;
  }
  console.log("[dev] Starting server...");
  server = spawn({
    cmd: ["bun", "run", join(ROOT, "server.ts")],
    stdout: "inherit",
    stderr: "inherit",
  });
}

// Initial build and start
await buildClient();
await startServer();

console.log("[dev] Watching for changes...");

// Watch directory - rebuild client for public/format, restart server for api/bands
async function watchDir(dir: string, label: string, action: "client" | "server") {
  try {
    const watcher = watch(dir, { recursive: true });
    for await (const event of watcher) {
      const filename = event.filename;
      if (!filename || filename === "app.js" || filename.includes(".tmp.")) continue;

      console.log(`[dev] ${label} ${filename} changed`);

      if (action === "client" && filename.endsWith(".ts")) {
        await buildClient();
      } else if (action === "server" && (filename.endsWith(".ts") || filename.endsWith(".md"))) {
        await startServer();
      }
    }
  } catch (e) {
    console.error(`[dev] Watch error for ${dir}:`, e);
  }
}

// Start watchers
watchDir(PUBLIC, "", "client");
watchDir(FORMAT_SRC, "@bands/format", "client");
watchDir(API_SRC, "api", "server");
watchDir(BANDS_SRC, "bands", "server");
watchDir(SKILLS_SRC, "skills", "server");

// Keep process alive
process.on("SIGINT", () => {
  server?.kill();
  process.exit(0);
});
