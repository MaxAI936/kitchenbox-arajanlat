import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Quote } from "./store";
import regularData from "../../public/fonts/DejaVuSans.ttf?inline";
import boldData from "../../public/fonts/DejaVuSans-Bold.ttf?inline";
import templateData from "../../public/templates/kitchenbox-template.pdf?inline";
const decode = (data: string) =>
  Uint8Array.from(atob(data.split(",")[1]), (c) => c.charCodeAt(0));
const format = (n: number) =>
  new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 })
    .format(n)
    .replace(/\u00a0/g, " ");
/** Original two-page vector template, exact embedded fonts, logo and geometry. */
export async function createQuotePdf(
  q: Quote,
  _fontOverride?: Uint8Array,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(decode(templateData));
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(decode(regularData), { subset: true }),
    bold = await doc.embedFont(decode(boldData), { subset: true });
  const pages = doc.getPages(),
    H = 841.89,
    black = rgb(0, 0, 0),
    white = rgb(1, 1, 1);
  function text(
    pi: number,
    value: string,
    x: number,
    top: number,
    size = 8.2,
    isBold = false,
    right?: number,
    color = black,
  ) {
    const f = isBold ? bold : font;
    const clean = value.replace(/[\u0000-\u001f]/g, " ");
    const width = right ? right - x : undefined;
    if (width && f.widthOfTextAtSize(clean, size) > width)
      size = Math.max(5.5, (size * width) / f.widthOfTextAtSize(clean, size));
    pages[pi].drawText(clean, {
      x: right ? right - f.widthOfTextAtSize(clean, size) : x,
      y: H - top,
      size,
      font: f,
      color,
    });
  }
  function wrap(value: string, width: number, size = 8.2) {
    const result: string[] = [];
    for (const para of value.split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        if (
          font.widthOfTextAtSize((line ? line + " " : "") + word, size) >
            width &&
          line
        ) {
          result.push(line);
          line = "";
        }
        for (const char of (line ? " " : "") + word) {
          if (font.widthOfTextAtSize(line + char, size) > width) {
            result.push(line);
            line = "";
          }
          line += char;
        }
      }
      result.push(line);
    }
    return result;
  }
  const date = (d: string) =>
    new Date(d).toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });
  const sample =
    q.id.startsWith("TESZT") ||
    q.id.includes("BEMUTATO") ||
    !q.calculation.ready;
  text(0, sample ? "MINTA - NEM VÉGLEGES" : q.id, 30, 108.5, 9, true);
  text(0, `Keltezés: ${date(q.created_at)}`, 30, 132.8, 8.2, true);
  text(
    0,
    `Érvényes: ${q.config.validDays ? date(new Date(Date.parse(q.created_at) + q.config.validDays * 86400000).toISOString()) : "egyeztetés alatt"}`,
    30,
    145.5,
    8.2,
    true,
  );
  text(0, q.contact.name, 370, 108.5, 9, true, 565);
  text(0, q.contact.email, 370, 130.3, 8.2, false, 565);
  text(0, q.contact.phone, 370, 143, 8.2, false, 565);
  const address = wrap(
    q.contact.fullAddress || "Kiszállítási címre vár",
    155,
    8.2,
  );
  address
    .slice(0, 3)
    .forEach((line, i) => text(0, line, 410, 202 + i * 11.5, 8.2, false, 565));
  const value = (key: string) => {
    const v = q.contact.fields[key];
    return Array.isArray(v) ? v.join(", ") : v || "Nincs megadva";
  };
  text(
    0,
    `Acél vázszerkezet színterezett Szín: ${value("contact.hz")}`,
    30,
    323.5,
    7.5,
  );
  text(
    0,
    `Külső lemez borítás: színterezett Szín: ${value("contact.hz")}`,
    30,
    335,
    7.5,
  );
  text(
    0,
    `Belső burkolat (6 mm kompakt lemez) Szín: ${value("contact.htlap")}`,
    30,
    346.5,
    7.5,
  );
  text(0, `Munkalap: ${value("contact.munkapult_anyag")}`, 30, 447.7, 7.5);
  text(0, `Munkalap színe: ${value("contact.munkapult")}`, 30, 459.2, 7.5);
  text(
    0,
    `Front: Kompakt lemez Szín: ${value("contact.konyha_front")}`,
    30,
    470.7,
    7.5,
  );
  text(
    0,
    `Vázszerkezet: Kompakt lemez Szín: ${value("contact.konyha_front")}`,
    30,
    482.2,
    7.5,
  );
  text(
    0,
    "Egyéb: a kiválasztott beépíthető extrák a tételsorokban szerepelnek.",
    30,
    557.8,
    7.5,
  );
  text(
    0,
    sample
      ? "Minta - ÁFA, hiányzó ár és kiszállítás egyeztetés alatt."
      : "A konfiguráció a kontakt mezői alapján készült.",
    30,
    569.3,
    7.1,
  );
  const notes = wrap(`Megjegyzés: ${value("contact.megjegyzs")}`, 285, 7.5);
  notes
    .slice(0, 3)
    .forEach((line, i) => text(0, line, 30, 588 + i * 11.5, 7.5));
  function cell(
    pi: number,
    top: number,
    amount: number | null | undefined,
    selected = true,
    grossOverride?: number,
  ) {
    text(pi, selected ? "1 db" : "-", 360, top, 8.2, false, 386);
    text(
      pi,
      !selected
        ? "-"
        : amount === null || amount === undefined
          ? "Árra vár"
          : format(amount),
      402,
      top,
      8.2,
      false,
      455,
    );
    text(
      pi,
      !selected
        ? "-"
        : q.config.vatBps === null
          ? "?"
          : `${q.config.vatBps / 100}%`,
      472,
      top,
      8.2,
      false,
      494,
    );
    let gross: string = "-";
    if (selected) {
      if (amount === null || amount === undefined) gross = "Árra vár";
      else if (q.config.basis === null || q.config.vatBps === null)
        gross = "ÁFA-ra vár";
      else
        gross = format(
          q.config.basis === "gross"
            ? amount
            : amount + Math.round((amount * q.config.vatBps) / 10000),
        );
    }
    if (q.calculation.ready && grossOverride !== undefined)
      gross = format(grossOverride);
    text(pi, gross, 505, top, 8.2, false, 565);
  }
  const descriptiveSurcharges = q.calculation.lines
    .filter(
      (l) =>
        !l.label.startsWith("Gázgrill:") &&
        !l.label.startsWith("Beépíthető extrák:") &&
        l.label !== "Kiszállási díj" &&
        l.label !== "Kitchen Box",
    )
    .reduce((s, l) => s + l.amount, 0);
  cell(
    0,
    277,
    q.config.baseAmount === null
      ? null
      : q.config.baseAmount + descriptiveSurcharges,
    true,
    q.calculation.lines
      .filter(
        (l) =>
          !l.label.startsWith("Gázgrill:") &&
          !l.label.startsWith("Beépíthető extrák:") &&
          l.label !== "Kiszállási díj",
      )
      .reduce((s, l) => s + l.gross, 0),
  );
  const chosen = q.contact.fields["contact.bepthet_extrk"];
  const extras = new Set(
    Array.isArray(chosen) ? chosen : chosen ? [chosen] : [],
  );
  const price = (key: string, val: string) =>
    q.config.fields
      .find((f) => f.key === key)
      ?.rules.find((r) => r.value === val)?.amount;
  const rows = [
    {
      pi: 0,
      top: 632.7,
      label: `Gázgrill: ${value("contact.gzgrill")}`,
      selected: !!q.contact.fields["contact.gzgrill"],
      amount: price("contact.gzgrill", value("contact.gzgrill")),
    },
    {
      pi: 0,
      top: 662.9,
      label: "NERO Parma Gránit mosogató",
      selected: extras.has("NERO Parma Gránit mosogató"),
      amount: price("contact.bepthet_extrk", "NERO Parma Gránit mosogató"),
    },
    {
      pi: 0,
      top: 693.1,
      label: "Yakiniku Medium Kamado grill",
      selected: extras.has("Yakiniku Medium Kamado grill"),
      amount: price("contact.bepthet_extrk", "Yakiniku Medium Kamado grill"),
    },
    {
      pi: 0,
      top: 723.3,
      label: "Hűtő: Beersafe XL Onyx hűtőszekrény",
      selected: extras.has("Beersafe XL Onyx hűtőszekrény"),
      amount: price("contact.bepthet_extrk", "Beersafe XL Onyx hűtőszekrény"),
    },
    {
      pi: 1,
      top: 106.2,
      label: "Főzőlap: Ignito Domino gázfőzőlap",
      selected: extras.has("Ignito Domino gázfőzőlap"),
      amount: price("contact.bepthet_extrk", "Ignito Domino gázfőzőlap"),
    },
    {
      pi: 1,
      top: 136.4,
      label: "Mennyezeti Hangfalszett",
      selected: extras.has("Hangszórók"),
      amount: price("contact.bepthet_extrk", "Hangszórók"),
    },
    {
      pi: 1,
      top: 166.6,
      label: "TV",
      selected: extras.has("TV"),
      amount: price("contact.bepthet_extrk", "TV"),
    },
  ];
  for (const row of rows) {
    const size = bold.widthOfTextAtSize(row.label, 8.2) > 290 ? 7.2 : 8.2;
    text(row.pi, row.label, 30, row.top, size, true);
    text(
      row.pi,
      row.selected ? "Kiválasztva" : "Nem választott",
      30,
      row.top + 12.3,
      7.5,
    );
    cell(row.pi, row.top, row.amount, row.selected);
  }
  text(1, "Kiszállítási díj", 30, 196.8, 8.2, true);
  const shipping =
    q.contact.roadKm !== undefined && q.config.delivery.multiplier
      ? Math.round(
          q.contact.roadKm *
            q.config.delivery.perKm *
            q.config.delivery.multiplier,
        )
      : null;
  text(
    1,
    q.contact.roadKm !== undefined
      ? `${q.contact.roadKm} km x ${q.config.delivery.perKm} Ft/km`
      : "Közúti távolság és kiszállítási címre vár",
    30,
    209.1,
    7.5,
  );
  cell(1, 196.8, shipping);
  const totals = q.calculation.ready
    ? [
        format(q.calculation.net) + " HUF",
        format(q.calculation.vat) + " HUF",
        format(q.calculation.gross) + " HUF",
      ]
    : ["Nem végleges", "Egyeztetés alatt", "Nem végleges"];
  totals.forEach((s, i) =>
    text(1, s, 440, 242 + i * 19.7, 8.2, true, 565, i === 2 ? white : black),
  );
  if (q.config.seller.name) {
    for (let pi = 0; pi < 2; pi++) {
      pages[pi].drawRectangle({
        x: 29,
        y: H - 61,
        width: 400,
        height: 45,
        color: white,
      });
      text(pi, q.config.seller.name, 30, 30, 12, true);
      text(pi, q.config.seller.address, 30, 44, 8.2);
      text(pi, q.config.seller.taxId, 30, 56.7, 8.2);
    }
  }
  let extra: string[] = [];
  if (notes.length > 3) extra.push("Megjegyzés folytatása", ...notes.slice(3));
  if (address.length > 3)
    extra.push("Kiszállítási cím folytatása", ...address.slice(3));
  if (q.contact.roadKmSource)
    extra.push(
      `Útvonal forrása: ${q.contact.roadKmSource}`,
      `Lekérdezés: ${q.contact.roadRetrievedAt || "nincs megadva"}`,
    );
  if (q.config.terms) {
    pages[1].drawRectangle({
      x: 29,
      y: H - 541,
      width: 540,
      height: 244,
      color: white,
    });
    const lines = wrap(q.config.terms, 535);
    lines.slice(0, 17).forEach((line, i) => text(1, line, 30, 309 + i * 12.7));
    if (lines.length > 17)
      extra.push("Feltételek folytatása", ...lines.slice(17));
  }
  if (!q.calculation.ready) {
    text(1, "MINTA - NEM VÉGLEGES AJÁNLAT", 30, 563, 9, true);
    const issues = wrap(q.issues.join(" "), 535, 7.5);
    issues
      .slice(0, 8)
      .forEach((line, i) => text(1, line, 30, 578 + i * 11.5, 7.5));
    if (issues.length > 8) extra.push(...issues.slice(8));
  }
  if (extra.length) {
    let top = 698;
    for (const line of extra.flatMap((l) => wrap(l, 535, 7.5))) {
      if (top > 780) {
        const [p] = await doc.copyPages(
          await PDFDocument.load(decode(templateData)),
          [1],
        );
        doc.addPage(p);
        pages.push(p);
        if (q.config.seller.name) {
          p.drawRectangle({
            x: 29,
            y: H - 61,
            width: 400,
            height: 45,
            color: white,
          });
          text(pages.length - 1, q.config.seller.name, 30, 30, 12, true);
          text(pages.length - 1, q.config.seller.address, 30, 44, 8.2);
          text(pages.length - 1, q.config.seller.taxId, 30, 56.7, 8.2);
        }
        p.drawRectangle({
          x: 0,
          y: 60,
          width: 595.28,
          height: 715,
          color: white,
        });
        top = 100;
        text(pages.length - 1, "Kiegészítő adatok", 30, 85, 12, true);
      }
      text(pages.length - 1, line, 30, top, 7.5);
      top += 11.5;
    }
  }
  if (pages.length > 2)
    for (let i = 0; i < pages.length; i++) {
      pages[i].drawRectangle({
        x: 520,
        y: 20,
        width: 50,
        height: 20,
        color: white,
      });
      text(i, `${i + 1} / ${pages.length}`, 520, 819, 8.2, false, 565);
    }
  doc.setTitle(`Kitchen Box - ${q.id}`);
  doc.setAuthor("Kitchen Box");
  return doc.save();
}
