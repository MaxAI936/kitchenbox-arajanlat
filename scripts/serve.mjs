// Minimal Node host for the built TanStack application; Vibe supplies its own host.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import handler from "../dist/server/server.js";
const root = resolve("dist/client");
const mime = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const file = resolve(root, "." + decodeURIComponent(url.pathname));
    if (
      file.startsWith(root + sep) &&
      (await stat(file)
        .then((s) => s.isFile())
        .catch(() => false))
    ) {
      res.setHeader(
        "Content-Type",
        mime[extname(file)] || "application/octet-stream",
      );
      res.end(await readFile(file));
      return;
    }
    const body = ["GET", "HEAD"].includes(req.method)
      ? undefined
      : await Array.fromAsync(req).then((b) => Buffer.concat(b));
    const request = new Request(
      new URL(
        req.url,
        process.env.PUBLIC_URL ||
          "http://localhost:" + (process.env.PORT || 5180),
      ),
      { method: req.method, headers: req.headers, body, duplex: "half" },
    );
    const response = await handler.fetch(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("A kérés nem dolgozható fel.");
  }
}).listen(Number(process.env.PORT || 5180), "127.0.0.1", () =>
  console.log("Kitchenbox: http://127.0.0.1:" + (process.env.PORT || 5180)),
);
