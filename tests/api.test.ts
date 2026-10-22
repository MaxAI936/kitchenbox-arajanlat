import { it, expect, vi, afterEach } from "vitest";
import { handle } from "../src/server/api";
afterEach(() => vi.unstubAllEnvs());
it("konfigurálatlan admin végpont zárt", async () => {
  vi.stubEnv("ADMIN_TOKEN", "");
  const r = await handle(new Request("http://localhost/api/quotes"));
  expect(r.status).toBe(401);
});
it("webhook külön titkot használ", async () => {
  vi.stubEnv("ADMIN_TOKEN", "a".repeat(32));
  vi.stubEnv("WEBHOOK_TOKEN", "b".repeat(32));
  const r = await handle(
    new Request("http://localhost/api/webhooks/ghl", {
      method: "POST",
      headers: { Authorization: "Bearer " + "a".repeat(32) },
    }),
  );
  expect(r.status).toBe(401);
});
it("adatbázis nélkül nincs csendes memóriatárolás", async () => {
  vi.stubEnv("ADMIN_TOKEN", "a".repeat(32));
  vi.stubEnv("SUPABASE_URL", "");
  const r = await handle(
    new Request("http://localhost/api/contacts", {
      method: "POST",
      headers: { Authorization: "Bearer " + "a".repeat(32) },
    }),
  );
  expect(r.status).toBe(503);
});
