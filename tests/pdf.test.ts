import { it, expect } from "vitest";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { createQuotePdf } from "../src/server/pdf";
import { calculate } from "../src/lib/pricing";
import { fixture } from "./fixtures";
it("magyar ékezetekkel, hosszú konfigurációval és feltételekkel többoldalas PDF készül", async () => {
  const { contact, config } = fixture();
  contact.name = "TESZT Őrült Tűzhely";
  contact.fields["contact.megjegyzs"] = "Árvíztűrő tükörfúrógép. ".repeat(30);
  config.terms +=
    "\n" + "További tesztfeltétel magyar ékezetekkel. ".repeat(90);
  const calculation = calculate(contact, config);
  const bytes = await createQuotePdf(
    {
      id: "TESZT-KB-2026",
      fingerprint: "test",
      contact,
      config,
      calculation,
      status: "ready",
      issues: [],
      created_at: "2026-10-22T06:00:00Z",
    },
    new Uint8Array(readFileSync("public/fonts/NotoSans-Regular.ttf")),
  );
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBeGreaterThan(1);
  mkdirSync("tmp/pdfs", { recursive: true });
  writeFileSync("tmp/pdfs/complete-test.pdf", bytes);
});
