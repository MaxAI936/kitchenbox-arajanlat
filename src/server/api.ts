import { z } from "zod";
import { FIELDS, LOCATION_ID } from "../lib/fields";
import type { Contact } from "../lib/fields";
import { calculate, PricingSchema } from "../lib/pricing";
import { configured, env, initialPricing } from "./config";
import { getContact, ghl, normalize, upsert } from "./ghl";
import { SupabaseStore } from "./store";
import { Workflow } from "./workflow";
import { createQuotePdf } from "./pdf";
import { sendEmail } from "./email";
import { withRoadDistance } from "./routing";
import { demoContact } from "../lib/demo";
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function secureEqual(a: string, b: string) {
  const hash = async (s: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    );
  const [x, y] = await Promise.all([hash(a), hash(b)]);
  return x.reduce((s, v, i) => s | (v ^ y[i]), 0) === 0;
}
async function authorized(req: Request, webhook = false) {
  const token = env(webhook ? "WEBHOOK_TOKEN" : "ADMIN_TOKEN");
  return (
    token.length >= 32 &&
    (await secureEqual(
      req.headers.get("Authorization") ?? "",
      `Bearer ${token}`,
    ))
  );
}
const contactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(254),
  phone: z.string().max(40),
  fullAddress: z.string().max(500),
  fields: z.record(
    z.union([z.string().max(4000), z.array(z.string().max(300)).max(30)]),
  ),
});
function validateFields(c: Omit<Contact, "id">) {
  for (const f of FIELDS) {
    const v = c.fields[f.key];
    if (f.note) continue;
    const values = Array.isArray(v) ? v : v ? [v] : [];
    if (!f.multi && values.length > 1)
      throw new Error(`${f.label}: csak egy érték választható.`);
    if (values.some((v) => !(f.options as string[]).includes(v)))
      throw new Error(`${f.label}: ismeretlen érték.`);
  }
}
export async function handle(request: Request): Promise<Response> {
  try {
    const path = new URL(request.url).pathname.replace(/^\/api\//, "");
    const settings = configured();
    if (path === "health")
      return json({
        service: "Kitchenbox",
        mode: settings.database ? "configured" : "setup-required",
      });
    if (path === "demo" && request.method === "GET")
      return json({ config: initialPricing(), contact: demoContact });
    if (path === "demo/pdf" && request.method === "GET") {
      const c = initialPricing(),
        calculation = calculate(demoContact, c);
      const bytes = await createQuotePdf({
        id: "KB-BEMUTATO",
        fingerprint: "demo",
        contact: demoContact,
        config: c,
        calculation,
        status: "blocked",
        issues: calculation.issues,
        created_at: new Date().toISOString(),
      });
      return new Response(bytes as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="Kitchenbox-bemutato.pdf"',
          "Cache-Control": "no-store",
        },
      });
    }
    if (!(await authorized(request, path === "webhooks/ghl")))
      return json(
        { error: "A művelethez érvényes szerveroldali hozzáférés szükséges." },
        401,
      );
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 100000) return json({ error: "Túl nagy kérés." }, 413);
    const store = new SupabaseStore();
    const config = settings.database
      ? ((await store.getConfig()) ?? initialPricing())
      : initialPricing();
    const flow = new Workflow({
      store,
      pdf: createQuotePdf,
      send: sendEmail,
      refresh: getContact,
      canSend: () => settings.email && settings.sending,
    });
    if (path === "settings" && request.method === "GET")
      return json({ settings, config, fields: FIELDS });
    if (!settings.database)
      return json(
        {
          error:
            "Az adatbázis nincs konfigurálva. Állítsa be a Supabase kapcsolatot és futtassa a migrációt.",
        },
        503,
      );
    if (path === "settings" && request.method === "PUT") {
      const c = PricingSchema.parse(await request.json());
      c.version = crypto.randomUUID();
      if (
        c.fields.length !== 7 ||
        new Set(c.fields.map((f) => f.key)).size !== 7 ||
        FIELDS.filter((f) => !f.note).some(
          (f) => !c.fields.find((x) => x.key === f.key),
        )
      )
        return json({ error: "Mind a hét konfigurációs mező szükséges." }, 400);
      if (
        c.fields.some(
          (f) => new Set(f.rules.map((r) => r.value)).size !== f.rules.length,
        )
      )
        return json({ error: "Ismétlődő árszabály." }, 400);
      if (
        c.fields.some((f) => {
          const expected = FIELDS.find((x) => x.key === f.key)!;
          return (
            f.multi !== !!expected.multi ||
            f.rules.length !== expected.options.length ||
            f.rules.some(
              (r) => !(expected.options as string[]).includes(r.value),
            )
          );
        })
      )
        return json(
          {
            error:
              "Az árszabályoknak a GHL mezők jelenlegi opcióival kell egyezniük.",
          },
          400,
        );
      await store.saveConfig(c);
      return json({ config: c });
    }
    if (path === "quotes" && request.method === "GET") {
      const rows = await store.list();
      return json(
        rows.map(({ pdf, ...q }: import("./store").Quote) => ({
          ...q,
          hasPdf: !!pdf,
        })),
      );
    }
    if (path === "contacts" && request.method === "GET") {
      const r = await ghl("/contacts/search", {
        locationId: env("GHL_LOCATION_ID") || LOCATION_ID,
        page: 1,
        pageLimit: 100,
      });
      return json((r.contacts ?? []).map((c: any) => normalize(c, config)));
    }
    if (path === "contacts" && request.method === "POST") {
      const input = contactSchema.parse(await request.json());
      validateFields(input);
      const contact = await withRoadDistance(
        await upsert(input, config),
        config,
      );
      return json(await flow.process(contact, config));
    }
    if (path === "quotes/create" && request.method === "POST") {
      const input = z
        .object({ contactId: z.string().min(1) })
        .parse(await request.json());
      const contact = await withRoadDistance(
        await getContact(input.contactId, config),
        config,
      );
      return json(await flow.process(contact, config));
    }
    if (path === "webhooks/ghl" && request.method === "POST") {
      // Workflow custom webhook contract: server refresh is authoritative; incoming prices/recipient ignored.
      const input = z
        .object({
          contactId: z.string().min(1).max(100),
          locationId: z.literal(LOCATION_ID),
        })
        .parse(await request.json());
      const contact = await withRoadDistance(
        await getContact(input.contactId, config),
        config,
      );
      return json(await flow.process(contact, config));
    }
    const match = path.match(/^quotes\/([A-Za-z0-9-]+)\/(pdf|send|recover)$/);
    if (match) {
      const q = await store.get(match[1]);
      if (!q) return json({ error: "Nem található." }, 404);
      if (match[2] === "send" && request.method === "POST")
        return json(await flow.deliver(q.id));
      if (match[2] === "recover" && request.method === "POST")
        return json(await flow.recover(q.id));
      if (match[2] === "pdf" && request.method === "GET") {
        const bytes = q.pdf
          ? Buffer.from(q.pdf, "base64")
          : await createQuotePdf({
              ...q,
              calculation: { ...q.calculation, ready: false },
            });
        return new Response(bytes as BodyInit, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${q.id}.pdf"`,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
    }
    return json({ error: "Ismeretlen végpont." }, 404);
  } catch (error) {
    if (error instanceof z.ZodError)
      return json(
        {
          error: "Érvénytelen adatok.",
          details: error.issues.map((x) => `${x.path.join(".")}: ${x.message}`),
        },
        400,
      );
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "A feldolgozás nem sikerült.",
      },
      400,
    );
  }
}
