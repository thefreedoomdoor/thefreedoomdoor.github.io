#!/usr/bin/env node
/** 本地预览：node scripts/serve.mjs [端口] */
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2] || process.env.PORT || 4000);
const HOST = "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
};

async function resolveFile(urlPath) {
  let target = path.normalize(path.join(ROOT, decodeURIComponent(urlPath)));

  if (!target.startsWith(ROOT)) return null;

  try {
    const stat = await fs.stat(target);
    if (stat.isDirectory()) {
      target = path.join(target, "index.html");
      await fs.stat(target);
    }
    return target;
  } catch (error) {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || "/").split("?")[0];
  const file = await resolveFile(urlPath === "/" ? "/index.html" : urlPath);

  if (!file) {
    const fallback = path.join(ROOT, "404.html");
    try {
      const body = await fs.readFile(fallback);
      res.writeHead(404, { "Content-Type": MIME[".html"] });
      res.end(body);
    } catch (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404");
    }
    return;
  }

  try {
    const body = await fs.readFile(file);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("500");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`预览：http://${HOST}:${PORT}/`);
  console.log("Ctrl+C 结束");
});
