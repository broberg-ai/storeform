/**
 * Serve the local test-form fixture so a Lens run can reach it at a URL.
 * Used for local F001.2 E2E (the daemon's browser can reach localhost — no
 * cloud token needed). Run: `bun run src/serve-fixture.ts [port]`.
 */
const port = Number(process.env.PORT ?? Bun.argv[2] ?? 4599);
const root = new URL("../fixtures/extreme-form/", import.meta.url).pathname;

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const rel = (url.pathname === "/" ? "/index.html" : url.pathname).replace(/^\/+/, "");
    const file = Bun.file(root + rel);
    return (await file.exists()) ? new Response(file) : new Response("not found", { status: 404 });
  },
});

console.log(`fixture served on http://localhost:${port}`);
