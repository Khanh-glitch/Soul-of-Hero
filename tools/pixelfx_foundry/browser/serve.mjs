#!/usr/bin/env node
// Static server for the FX Foundry Browser. Serves the SOH repo root so the browser can fetch
//   /tools/pixelfx_foundry/browser/index.html  and  /assets/pixelfx_foundry/index.json + atlases.
//   node tools/pixelfx_foundry/browser/serve.mjs [port]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url)); // SOH repo root
const port = Number(process.argv[2] || process.env.PORT || 8734);
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".md": "text/plain", ".gif": "image/gif", ".svg": "image/svg+xml" };

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("not found");
  }
}).listen(port, "0.0.0.0", () => console.log(`FX Foundry Browser: http://localhost:${port}/tools/pixelfx_foundry/browser/`));
