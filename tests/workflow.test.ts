import { it, expect, vi } from "vitest";
import { fixture } from "./fixtures";
import { MemoryStore } from "../src/server/store";
import { Workflow } from "../src/server/workflow";
it("aktív DND esetén nem küld levelet", async () => {
  const t = setup();
  t.contact.dnd = true;
  const q = await t.flow.process(t.contact, t.config);
  t.enable();
  await expect(t.flow.deliver(q.id)).rejects.toThrow("letiltás");
  expect(t.send).not.toHaveBeenCalled();
});
function setup() {
  const { contact, config } = fixture(),
    store = new MemoryStore();
  const pdf = vi.fn(async () => new Uint8Array([1, 2, 3])),
    send = vi.fn(async () => "provider-1"),
    refresh = vi.fn(async () => structuredClone(contact));
  let enabled = false;
  const flow = new Workflow({
    store,
    pdf,
    send,
    refresh,
    canSend: () => enabled,
  });
  return {
    contact,
    config,
    store,
    pdf,
    send,
    refresh,
    flow,
    enable: () => (enabled = true),
  };
}
it("párhuzamos ismételt esemény egyetlen ajánlat és PDF", async () => {
  const t = setup();
  const rows = await Promise.all(
    Array.from({ length: 12 }, () => t.flow.process(t.contact, t.config)),
  );
  expect(new Set(rows.map((r) => r.id)).size).toBe(1);
  expect(t.pdf).toHaveBeenCalledTimes(1);
  expect(t.send).not.toHaveBeenCalled();
});
it("ismételt útvonal-lekérdezés időbélyege nem duplikál", async () => {
  const t = setup();
  const a = await t.flow.process(t.contact, t.config);
  t.contact.roadRetrievedAt = "2026-10-22T07:00:00Z";
  const b = await t.flow.process(t.contact, t.config);
  expect(a.id).toBe(b.id);
});
it("hiányos árlista mellett nincs PDF véglegesítés vagy küldés", async () => {
  const t = setup();
  t.config.approved = false;
  t.enable();
  const q = await t.flow.process(t.contact, t.config);
  expect(q.status).toBe("blocked");
  expect(t.pdf).not.toHaveBeenCalled();
  expect(t.send).not.toHaveBeenCalled();
});
it("párhuzamos küldést atomikus claim védi", async () => {
  const t = setup();
  const q = await t.flow.process(t.contact, t.config);
  t.enable();
  await Promise.all(Array.from({ length: 8 }, () => t.flow.deliver(q.id)));
  expect(t.send).toHaveBeenCalledTimes(1);
  expect((await t.store.get(q.id))?.status).toBe("submitted");
});
it("bizonytalan küldési eredmény nem ismétlődik", async () => {
  const t = setup();
  const q = await t.flow.process(t.contact, t.config);
  t.send.mockRejectedValue(new Error("timeout"));
  t.enable();
  await t.flow.deliver(q.id);
  expect((await t.store.get(q.id))?.status).toBe("delivery_unknown");
  await t.flow.deliver(q.id);
  expect(t.send).toHaveBeenCalledTimes(1);
});
it("megváltozott címzett és DND letiltja a küldést", async () => {
  const t = setup();
  const q = await t.flow.process(t.contact, t.config);
  t.contact.email = "changed@example.com";
  t.enable();
  await expect(t.flow.deliver(q.id)).rejects.toThrow("megváltozott");
  expect(t.send).not.toHaveBeenCalled();
});
it("új árlistaverzió új ajánlatot eredményez", async () => {
  const t = setup();
  const a = await t.flow.process(t.contact, t.config);
  t.config = { ...t.config, version: "v2" };
  const b = await t.flow.process(t.contact, t.config);
  expect(a.id).not.toBe(b.id);
});
