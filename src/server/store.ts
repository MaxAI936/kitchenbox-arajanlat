import { env } from "./config";
import type { Contact } from "../lib/fields";
import type { Pricing, Calculation } from "../lib/pricing";
export type Quote = {
  id: string;
  fingerprint: string;
  contact: Contact;
  config: Pricing;
  calculation: Calculation;
  status: string;
  issues: string[];
  created_at: string;
  pdf?: string;
  provider_id?: string;
};
export interface Store {
  getConfig(): Promise<Pricing | null>;
  saveConfig(c: Pricing): Promise<void>;
  list(): Promise<Quote[]>;
  get(id: string): Promise<Quote | null>;
  claim(q: Quote): Promise<{ quote: Quote; claimed: boolean }>;
  update(id: string, patch: Partial<Quote>): Promise<void>;
  claimSend(id: string): Promise<boolean>;
}
export class SupabaseStore implements Store {
  async request(path: string, body?: unknown, method = body ? "POST" : "GET") {
    const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
        Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`Adatbázis hiba (${r.status}).`);
    return r.status === 204 ? null : r.json();
  }
  async getConfig() {
    const r = await this.request("kb_config?id=eq.main&select=data");
    return r[0]?.data ?? null;
  }
  async saveConfig(config: Pricing) {
    await this.request("rpc/kb_save_config", { p_data: config });
  }
  async list() {
    return this.request("kb_quotes?select=*&order=created_at.desc&limit=200");
  }
  async get(id: string) {
    return (
      (
        await this.request(`kb_quotes?id=eq.${encodeURIComponent(id)}&select=*`)
      )[0] ?? null
    );
  }
  async claim(q: Quote) {
    return this.request("rpc/kb_claim_quote", { p_quote: q });
  }
  async update(id: string, patch: Partial<Quote>) {
    await this.request(
      `kb_quotes?id=eq.${encodeURIComponent(id)}`,
      patch,
      "PATCH",
    );
  }
  async claimSend(id: string) {
    return this.request("rpc/kb_claim_send", { p_id: id });
  }
}
// Explicit test adapter. Production never falls back to in-memory persistence.
export class MemoryStore implements Store {
  config: Pricing | null = null;
  quotes = new Map<string, Quote>();
  async getConfig() {
    return this.config;
  }
  async saveConfig(c: Pricing) {
    this.config = c;
  }
  async list() {
    return [...this.quotes.values()];
  }
  async get(id: string) {
    return this.quotes.get(id) ?? null;
  }
  async claim(q: Quote) {
    const old = [...this.quotes.values()].find(
      (x) => x.fingerprint === q.fingerprint,
    );
    if (old) return { quote: old, claimed: false };
    this.quotes.set(q.id, q);
    return { quote: q, claimed: true };
  }
  async update(id: string, patch: Partial<Quote>) {
    Object.assign(this.quotes.get(id)!, patch);
  }
  async claimSend(id: string) {
    const q = this.quotes.get(id);
    if (q?.status !== "ready") return false;
    q.status = "sending";
    return true;
  }
}
