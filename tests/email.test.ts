import { afterEach, it, expect, vi } from "vitest";
import {
  createAttachmentUrl,
  attachmentResponse,
} from "../src/server/attachments";
import { sendEmail } from "../src/server/email";
import { configured } from "../src/server/config";
import { MemoryStore } from "../src/server/store";
import type { Quote } from "../src/server/store";
import { calculate } from "../src/lib/pricing";
import { fixture } from "./fixtures";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
async function setup() {
  vi.stubEnv("PDF_SIGNING_SECRET", "test-secret-".repeat(4));
  vi.stubEnv("PUBLIC_URL", "https://quotes.example.com");
  const { contact, config } = fixture();
  const q: Quote = {
    id: "KB-TEST-ABC",
    fingerprint: "test",
    contact,
    config,
    calculation: calculate(contact, config),
    status: "ready",
    issues: [],
    created_at: new Date().toISOString(),
    pdf: Buffer.from("%PDF-1.7\nMOCK").toString("base64"),
  };
  const store = new MemoryStore();
  await store.claim(q);
  return { store, q };
}
it("aláírt PDF endpoint helyes fájlnévvel és MIME típussal szolgál ki", async () => {
  const { q, store } = await setup();
  const url = await createAttachmentUrl(q.id);
  const response = await attachmentResponse(new Request(url), store);
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("application/pdf");
  expect(response.headers.get("Content-Disposition")).toBe(
    'attachment; filename="KB-TEST-ABC.pdf"',
  );
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(url).not.toContain(q.contact.email);
  expect(url).not.toContain("test-secret");
});
it("lejárt aláírt URL nem ad PDF-et", async () => {
  const { q, store } = await setup();
  const now = Date.now();
  const url = await createAttachmentUrl(q.id, now);
  expect(
    (await attachmentResponse(new Request(url), store, now + 901000)).status,
  ).toBe(403);
});
it("hamisított aláírás vagy másik dokumentumazonosító elutasítva", async () => {
  const { q, store } = await setup();
  const url = new URL(await createAttachmentUrl(q.id));
  url.searchParams.set("signature", "0".repeat(64));
  expect((await attachmentResponse(new Request(url), store)).status).toBe(403);
  const other = (await createAttachmentUrl(q.id)).replace(q.id, "KB-OTHER");
  expect((await attachmentResponse(new Request(other), store)).status).toBe(
    403,
  );
});
it("aláírás nélkül admin Bearer token sem érvényes attachment hozzáférés", async () => {
  const { q, store } = await setup();
  const r = await attachmentResponse(
    new Request(`https://quotes.example.com/api/attachments/${q.id}.pdf`, {
      headers: { Authorization: "Bearer admin" },
    }),
    store,
  );
  expect(r.status).toBe(403);
});
it("a blokkolt ajánlat nem osztható meg aláírt végleges PDF-ként", async () => {
  const { q, store } = await setup();
  await store.update(q.id, { status: "blocked" });
  expect(
    (
      await attachmentResponse(
        new Request(await createAttachmentUrl(q.id)),
        store,
      )
    ).status,
  ).toBe(404);
});
it("alapból GHL Email hívás: natív contact email, csatolmány URL, GHL sender", async () => {
  const { q } = await setup();
  vi.stubEnv("EMAIL_PROVIDER", "ghl");
  vi.stubEnv("GHL_TOKEN", "fake-ghl-token");
  vi.stubEnv("EMAIL_FROM", "ajanlat@kitchenbox.example");
  const mock = vi.fn(async () =>
    Response.json({ messageId: "ghl-message", emailMessageId: "email1" }),
  );
  vi.stubGlobal("fetch", mock);
  expect(await sendEmail(q)).toBe("ghl-message");
  const [url, options] = mock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe(
    "https://services.leadconnectorhq.com/conversations/messages",
  );
  const body = JSON.parse(options.body as string);
  expect(body.type).toBe("Email");
  expect(body.contactId).toBe(q.contact.id);
  expect(body.emailTo).toBe(q.contact.email);
  expect(body.emailFrom).toBe("ajanlat@kitchenbox.example");
  expect(body.attachments[0]).toMatch(
    /^https:\/\/quotes.example.com\/api\/attachments\/KB-TEST-ABC.pdf\?/,
  );
  expect(body.attachments[0]).not.toContain("fake-ghl-token");
});
it("GHL konfiguráció nem igényel Resend kulcsot és alapból küldés tiltott", async () => {
  await setup();
  vi.stubEnv("EMAIL_PROVIDER", "ghl");
  vi.stubEnv("GHL_TOKEN", "fake");
  vi.stubEnv("EMAIL_FROM", "sender@example.com");
  vi.stubEnv("EMAIL_DOMAIN_VERIFIED", "true");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("SEND_EMAIL_ENABLED", "false");
  expect(configured().email).toBe(true);
  expect(configured().sending).toBe(false);
});
it("lokális HTTP cím nem használható GHL attachment URL-ként", async () => {
  const { q } = await setup();
  vi.stubEnv("PUBLIC_URL", "http://localhost:5180");
  await expect(createAttachmentUrl(q.id)).rejects.toThrow("HTTPS");
});
