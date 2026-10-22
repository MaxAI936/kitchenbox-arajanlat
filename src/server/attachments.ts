import { env } from "./config";
import type { Store } from "./store";
const TTL = 15 * 60;
async function signature(id: string, expires: string) {
  if (env("PDF_SIGNING_SECRET").length < 32)
    throw new Error("A PDF aláíró titok nincs beállítva.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env("PDF_SIGNING_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`v1\n${id}\n${expires}`),
  );
  return Array.from(new Uint8Array(bytes), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
export async function createAttachmentUrl(id: string, now = Date.now()) {
  if (!/^[A-Za-z0-9-]+$/.test(id))
    throw new Error("Érvénytelen PDF azonosító.");
  const base = new URL(env("PUBLIC_URL"));
  if (base.protocol !== "https:")
    throw new Error("A PDF-átadáshoz publikus HTTPS alkalmazáscím szükséges.");
  const url = new URL(`/api/attachments/${id}.pdf`, base);
  const expires = String(Math.floor(now / 1000) + TTL);
  url.searchParams.set("expires", expires);
  url.searchParams.set("signature", await signature(id, expires));
  return url.toString();
}
export async function attachmentResponse(
  request: Request,
  store: Store,
  now = Date.now(),
): Promise<Response> {
  const url = new URL(request.url),
    id = url.pathname.match(/^\/api\/attachments\/([A-Za-z0-9-]+)\.pdf$/)?.[1],
    expires = url.searchParams.get("expires") ?? "",
    sig = url.searchParams.get("signature") ?? "";
  const denied = () =>
    new Response("Érvénytelen vagy lejárt PDF-hivatkozás.", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  if (
    !["GET", "HEAD"].includes(request.method) ||
    !id ||
    !/^\d{10}$/.test(expires) ||
    !/^[a-f0-9]{64}$/.test(sig)
  )
    return denied();
  const seconds = Math.floor(now / 1000);
  if (
    Number(expires) <= seconds ||
    Number(expires) > seconds + TTL ||
    env("PDF_SIGNING_SECRET").length < 32
  )
    return denied();
  const expected = await signature(id, expires);
  if (
    [...expected].reduce(
      (result, ch, i) => result | (ch.charCodeAt(0) ^ sig.charCodeAt(i)),
      0,
    ) !== 0
  )
    return denied();
  const q = await store.get(id);
  if (
    !q?.pdf ||
    !q.calculation.ready ||
    !["ready", "sending", "submitted", "delivery_unknown"].includes(q.status)
  )
    return new Response("A dokumentum nem érhető el.", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  const bytes = Buffer.from(q.pdf, "base64");
  if (
    bytes.subarray(0, 5).toString() !== "%PDF-" ||
    bytes.length > 25 * 1024 * 1024
  )
    throw new Error("Érvénytelen PDF tartalom.");
  return new Response(request.method === "HEAD" ? null : bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${id}.pdf"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
