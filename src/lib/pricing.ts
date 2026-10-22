import { z } from "zod";
import type { Contact } from "./fields";
export const PricingSchema = z.object({
  version: z.string().min(1),
  approved: z.boolean(),
  currency: z.literal("HUF"),
  noteFieldId: z.string().min(1),
  basis: z.enum(["gross", "net"]).nullable(),
  vatBps: z.number().int().min(0).max(10000).nullable(),
  baseAmount: z.number().int().nonnegative().max(1e10).nullable(),
  validDays: z.number().int().min(1).max(365).nullable(),
  seller: z.object({
    name: z.string(),
    address: z.string(),
    taxId: z.string(),
    email: z.string(),
  }),
  terms: z.string().max(15000),
  grillMode: z.enum(["always", "selected"]).nullable(),
  delivery: z.object({
    origin: z.string(),
    perKm: z.number().int().nonnegative(),
    multiplier: z.number().positive().max(10).nullable(),
    approved: z.boolean(),
  }),
  fields: z.array(
    z.object({
      key: z.string(),
      fieldId: z.string().min(1),
      label: z.string(),
      required: z.boolean(),
      multi: z.boolean(),
      rules: z.array(
        z.object({
          value: z.string().min(1),
          amount: z.number().int().nonnegative().max(1e10).nullable(),
        }),
      ),
    }),
  ),
});
export type Pricing = z.infer<typeof PricingSchema>;
export type Calculation = {
  ready: boolean;
  issues: string[];
  lines: {
    label: string;
    amount: number;
    net: number;
    vat: number;
    gross: number;
  }[];
  net: number;
  vat: number;
  gross: number;
  version: string;
};
export function calculate(contact: Contact, config: Pricing): Calculation {
  const issues: string[] = [];
  const lines: Calculation["lines"] = [];
  if (!config.approved) issues.push("Az árlista nincs jóváhagyva.");
  if (config.baseAmount === null) issues.push("Az alapár hiányzik.");
  if (config.basis === null || config.vatBps === null)
    issues.push("Az árképzés alapja vagy az ÁFA hiányzik.");
  if (!config.validDays) issues.push("Az érvényességi idő hiányzik.");
  if (!config.grillMode)
    issues.push("A gázgrill felszámításának szabálya hiányzik.");
  if (!config.delivery.approved || !config.delivery.multiplier)
    issues.push("A kiszállítás szabálya nincs jóváhagyva.");
  if (
    contact.roadKm === undefined ||
    !Number.isFinite(contact.roadKm) ||
    contact.roadKm < 0 ||
    !contact.roadKmSource
  )
    issues.push("Igazolt közúti távolság szükséges.");
  if (!contact.fullAddress)
    issues.push("A contact.full_address célcím hiányzik.");
  if (contact.routeIssue) issues.push(contact.routeIssue);
  if (!config.seller.name || !config.seller.address || !config.seller.taxId)
    issues.push("A kiállító adatai hiányoznak.");
  function add(label: string, amount: number) {
    const net =
      config.basis === "gross"
        ? Math.round((amount * 10000) / (10000 + (config.vatBps ?? 0)))
        : amount;
    const gross =
      config.basis === "gross"
        ? amount
        : net + Math.round((net * (config.vatBps ?? 0)) / 10000);
    lines.push({ label, amount, net, vat: gross - net, gross });
  }
  if (config.baseAmount !== null) add("Kitchen Box", config.baseAmount);
  for (const field of config.fields) {
    const raw = contact.fields[field.key];
    const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (
      (field.required ||
        (field.key === "contact.gzgrill" && config.grillMode === "always")) &&
      !values.length
    )
      issues.push(`${field.label}: nincs kiválasztva.`);
    if (!field.multi && values.length > 1)
      issues.push(`${field.label}: csak egy érték adható meg.`);
    if (new Set(values).size !== values.length)
      issues.push(`${field.label}: ismétlődő érték.`);
    for (const value of [...new Set(values)]) {
      const rule = field.rules.find((r) => r.value === value);
      if (!rule || rule.amount === null)
        issues.push(`${field.label} / ${value}: nincs jóváhagyott ár.`);
      else add(`${field.label}: ${value}`, rule.amount);
    }
  }
  if (
    contact.roadKm !== undefined &&
    Number.isFinite(contact.roadKm) &&
    contact.roadKm >= 0 &&
    config.delivery.multiplier
  )
    add(
      "Kiszállási díj",
      Math.round(
        contact.roadKm * config.delivery.perKm * config.delivery.multiplier,
      ),
    );
  return {
    ready: issues.length === 0,
    issues,
    lines,
    net: lines.reduce((s, l) => s + l.net, 0),
    vat: lines.reduce((s, l) => s + l.vat, 0),
    gross: lines.reduce((s, l) => s + l.gross, 0),
    version: config.version,
  };
}
