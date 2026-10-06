// PROTOTYPE (#18). Zero-dependency dev server for the UI prototype.
// Serves prototypes/ and strips TypeScript types on the fly so the browser can import logic.ts directly.
// Run: pnpm prototype:ui   then open http://localhost:5178/r1-booking-ui/?variant=A
import http from "node:http";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const PORT = Number(process.env.PORT ?? 5178);
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".ts": "text/javascript", ".css": "text/css",
};

http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  if (p === "/") { res.writeHead(302, { location: "/r1-booking-ui/?variant=A" }); res.end(); return; }
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try {
    let body = await readFile(file, "utf8");
    const ext = path.extname(file);
    if (ext === ".ts") body = stripTypeScriptTypes(body);
    res.writeHead(200, { "content-type": types[ext] ?? "text/plain", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("not found");
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`HX-RMS UI prototype → http://localhost:${PORT}/r1-booking-ui/?variant=A`);
});
