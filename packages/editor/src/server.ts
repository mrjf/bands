import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { apiRoutes } from "./api/routes";

const app = new Hono();

app.route("/api", apiRoutes);
// Serve static files manually (Hono serveStatic rewrite had issues)
app.get("/static/*", async (c) => {
  const filePath = c.req.path.replace("/static/", "");
  const fullPath = `./src/public/${filePath}`;
  const file = Bun.file(fullPath);
  const exists = await file.exists();
  if (exists) {
    const ext = filePath.split(".").pop() || "";
    const types: Record<string, string> = {
      js: "text/javascript; charset=utf-8",
      css: "text/css; charset=utf-8",
      html: "text/html; charset=utf-8",
      json: "application/json; charset=utf-8",
    };
    // Use Bun.file directly as response body (streaming)
    return new Response(file.stream(), {
      headers: {
        "Content-Type": types[ext] || "application/octet-stream",
        "Cache-Control": "no-store",
        "Content-Length": String(file.size),
      },
    });
  }
  return c.notFound();
});
app.get("*", serveStatic({ path: "./src/public/index.html" }));

const preferred = Number(process.env.PORT) || 3000;

let server: ReturnType<typeof Bun.serve> | null = null;
for (let port = preferred; port < preferred + 100; port++) {
  try {
    server = Bun.serve({ port, fetch: app.fetch });
    console.log(`Band Editor running at http://localhost:${server.port}`);
    break;
  } catch (e: any) {
    if (e?.code === "EADDRINUSE") continue;
    throw e;
  }
}

if (!server) {
  console.error(`Could not find an open port in range ${preferred}-${preferred + 99}`);
  process.exit(1);
}
