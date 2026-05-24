import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const repoRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), "..", ".."));
const port = Number(process.env.PORT || 4173);
const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".yml", "text/yaml; charset=utf-8"],
  [".yaml", "text/yaml; charset=utf-8"]
]);

function resolvePath(url) {
  const requested = decodeURIComponent(new URL(url, `http://127.0.0.1:${port}`).pathname);
  const rel = requested === "/" ? "web/index.html" : requested.slice(1);
  const path = normalize(join(repoRoot, rel));
  if (!path.startsWith(repoRoot)) {
    return null;
  }
  return path;
}

createServer(async (req, res) => {
  const path = resolvePath(req.url || "/");
  if (!path) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const info = await stat(path);
    const file = info.isDirectory() ? join(path, "index.html") : path;
    const body = await readFile(file);
    res.writeHead(200, { "content-type": mime.get(extname(file)) || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`OpenXcom browser port: http://127.0.0.1:${port}/web/index.html`);
});
