import { FIELDS } from "../lib/fields";
import type { Pricing } from "../lib/pricing";
export function initialPricing(): Pricing {
  const extras: Record<string, number> = {
    "Yakiniku Medium Kamado grill": 400333,
    "Beersafe XL Onyx hűtőszekrény": 129000,
    TV: 160000,
    Hangszórók: 78000,
  };
  return {
    version: "user-prices-2026-10-22",
    approved: false,
    currency: "HUF",
    noteFieldId: "kmcSp7odRLLac2Zlkdhg",
    basis: null,
    vatBps: null,
    baseAmount: 4900000,
    validDays: null,
    seller: { name: "", address: "", taxId: "", email: "" },
    terms: "",
    grillMode: null,
    delivery: {
      origin: "Békéscsaba, Bartók Béla út 37A",
      perKm: 280,
      multiplier: 1,
      approved: true,
    },
    fields: FIELDS.filter((f) => !f.note).map((f) => ({
      key: f.key,
      fieldId: f.id,
      label: f.label,
      required: !f.multi && f.key !== "contact.gzgrill",
      multi: !!f.multi,
      rules: f.options.map((value) => ({
        value,
        amount: f.multi
          ? (extras[value] ?? null)
          : f.key === "contact.gzgrill"
            ? 397000
            : 0,
      })),
    })),
  };
}
export function env(name: string) {
  return process.env[name] ?? "";
}
export const configured = () => ({
  ghl: !!env("GHL_TOKEN"),
  routing: !!env("GOOGLE_MAPS_API_KEY"),
  database: !!env("SUPABASE_URL") && !!env("SUPABASE_SERVICE_ROLE_KEY"),
  email:
    !!env("RESEND_API_KEY") &&
    !!env("EMAIL_FROM") &&
    env("EMAIL_DOMAIN_VERIFIED") === "true",
  sending: env("SEND_EMAIL_ENABLED") === "true",
  admin: env("ADMIN_TOKEN").length >= 32,
  webhook: env("WEBHOOK_TOKEN").length >= 32,
});
