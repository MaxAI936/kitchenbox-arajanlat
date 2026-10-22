import { describe, it, expect } from "vitest";
import { calculate } from "../src/lib/pricing";
import { fixture } from "./fixtures";
describe("Kalkuláció", () => {
  it("felhasználói képlet és egyszeres közúti km; egész forintos összeg", () => {
    const { contact, config } = fixture();
    const r = calculate(contact, config);
    expect(r.ready).toBe(true);
    expect(r.gross).toBe(
      4900000 + 397000 + 160000 + 78000 + Math.round(123.456 * 280),
    );
    expect(r.net + r.vat).toBe(r.gross);
  });
  it("a hiányzó két extra csak kiválasztáskor blokkol", () => {
    const { contact, config } = fixture();
    expect(calculate(contact, config).ready).toBe(true);
    contact.fields["contact.bepthet_extrk"] = ["NERO Parma Gránit mosogató"];
    const r = calculate(contact, config);
    expect(r.ready).toBe(false);
    expect(r.issues.join()).toContain("NERO");
  });
  it("nincs kitalált ÁFA vagy árjelleg", () => {
    const { contact, config } = fixture();
    config.basis = null;
    config.vatBps = null;
    expect(calculate(contact, config).ready).toBe(false);
  });
  it("ismeretlen opciót és duplikált extrát nem áraz csendesen", () => {
    const { contact, config } = fixture();
    contact.fields["contact.bepthet_extrk"] = ["TV", "TV", "Nem létező"];
    const r = calculate(contact, config);
    expect(r.ready).toBe(false);
    expect(r.issues.length).toBe(2);
    expect(r.lines.filter((x) => x.label.includes("TV"))).toHaveLength(1);
  });
  it("útvonalhiba nem jelent nulla forintos szállítást", () => {
    const { contact, config } = fixture();
    delete contact.roadKm;
    contact.routeIssue = "Címellenőrzés szükséges";
    expect(calculate(contact, config).ready).toBe(false);
  });
  it("a grill opcionális csak kifejezett szabály esetén", () => {
    const { contact, config } = fixture();
    contact.fields["contact.gzgrill"] = "";
    expect(calculate(contact, config).ready).toBe(true);
    config.grillMode = "always";
    expect(calculate(contact, config).ready).toBe(false);
    config.grillMode = null;
    expect(calculate(contact, config).ready).toBe(false);
  });
  it("nettó alapnál soronkénti ÁFA és összesített azonosság", () => {
    const { contact, config } = fixture();
    config.basis = "net";
    const r = calculate(contact, config);
    expect(
      r.lines.every((l) => l.gross === l.net + Math.round(l.net * 0.27)),
    ).toBe(true);
    expect(r.gross).toBe(r.net + r.vat);
  });
});
