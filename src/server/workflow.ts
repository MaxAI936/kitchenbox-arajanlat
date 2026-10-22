import { calculate } from "../lib/pricing";
import type { Pricing } from "../lib/pricing";
import type { Contact } from "../lib/fields";
import type { Quote, Store } from "./store";
export function canonical(value: any): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .filter((k) => value[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export async function fingerprint(contact: Contact, config: Pricing) {
  const { roadRetrievedAt, routeIssue, ...semantic } = contact;
  semantic.fields = Object.fromEntries(
    Object.entries(contact.fields).map(([key, value]) => [
      key,
      Array.isArray(value) ? [...value].sort() : value,
    ]),
  );
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical({ contact: semantic, config })),
  );
  return Array.from(new Uint8Array(buf), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
export type Dependencies = {
  store: Store;
  pdf: (q: Quote) => Promise<Uint8Array>;
  send: (q: Quote) => Promise<string>;
  refresh: (id: string, config: Pricing) => Promise<Contact>;
  canSend: () => boolean;
};
export class Workflow {
  constructor(private d: Dependencies) {}
  async process(contact: Contact, config: Pricing) {
    const calculation = calculate(contact, config);
    const fp = await fingerprint(contact, config);
    const q: Quote = {
      id: `KB-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      fingerprint: fp,
      contact,
      config,
      calculation,
      status: calculation.ready ? "processing" : "blocked",
      issues: calculation.issues,
      created_at: new Date().toISOString(),
    };
    const claim = await this.d.store.claim(q);
    if (!claim.claimed) return claim.quote;
    if (calculation.ready) {
      try {
        const pdf = await this.d.pdf(q);
        q.pdf = Buffer.from(pdf).toString("base64");
        q.status = "ready";
        await this.d.store.update(q.id, { pdf: q.pdf, status: "ready" });
      } catch {
        q.status = "error";
        q.issues = ["A PDF létrehozása nem sikerült."];
        await this.d.store.update(q.id, { status: q.status, issues: q.issues });
      }
    }
    if (q.status === "ready" && this.d.canSend()) return this.deliver(q.id);
    return q;
  }
  async deliver(id: string) {
    const q = await this.d.store.get(id);
    if (!q) throw new Error("Az ajánlat nem található.");
    if (!this.d.canSend())
      throw new Error("A levélküldés nincs engedélyezve vagy konfigurálva.");
    if (q.status !== "ready" || !q.calculation.ready || !q.pdf) return q;
    const fresh = await this.d.refresh(q.contact.id, q.config);
    // Road distance belongs to the approved contact address snapshot, not the GHL record.
    fresh.roadKm = q.contact.roadKm;
    fresh.roadKmSource = q.contact.roadKmSource;
    if ((await fingerprint(fresh, q.config)) !== q.fingerprint)
      throw new Error("A kontakt megváltozott; új ajánlat szükséges.");
    if (!fresh.email || fresh.dnd || fresh.emailDnd)
      throw new Error("Hiányzó email vagy aktív letiltás miatt nem küldhető.");
    if (!(await this.d.store.claimSend(id)))
      return (await this.d.store.get(id))!;
    // Persist intent BEFORE side effect. Unknown outcome is never retried automatically.
    try {
      const provider_id = await this.d.send(q);
      await this.d.store.update(id, { status: "submitted", provider_id });
      return { ...q, status: "submitted", provider_id };
    } catch {
      await this.d.store.update(id, {
        status: "delivery_unknown",
        issues: [
          "A szolgáltatói eredmény nem igazolt. Ellenőrizze a küldő szolgáltatónál; automatikus újraküldés letiltva.",
        ],
      });
      return { ...q, status: "delivery_unknown" };
    }
  }
  async recover(id: string) {
    const q = await this.d.store.get(id);
    if (!q) throw new Error("Az ajánlat nem található.");
    if (!["processing", "error"].includes(q.status) || !q.calculation.ready)
      return q;
    const pdf = await this.d.pdf(q);
    const patch = {
      pdf: Buffer.from(pdf).toString("base64"),
      status: "ready",
      issues: [],
    };
    await this.d.store.update(id, patch);
    return { ...q, ...patch };
  }
}
