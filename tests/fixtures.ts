import { initialPricing } from "../src/server/config";
import { demoContact } from "../src/lib/demo";
export function fixture() {
  const config = initialPricing();
  config.approved = true;
  config.basis = "gross";
  config.vatBps = 2700;
  config.validDays = 30;
  config.grillMode = "selected";
  config.seller = {
    name: "TESZT KIÁLLÍTÓ",
    address: "TESZT CÍM",
    taxId: "TESZT",
    email: "test@example.com",
  };
  config.terms =
    "Kizárólag szoftverellenőrzési minta. Nem valódi árajánlat. Az ÁFA a tesztben feltételezés.";
  const contact = structuredClone(demoContact);
  contact.fields["contact.bepthet_extrk"] = ["TV", "Hangszórók"];
  contact.fullAddress = "TESZT célcím";
  contact.roadKm = 123.456;
  contact.roadKmSource = "TESZT közúti adat";
  contact.roadRetrievedAt = "2026-10-22T06:00:00Z";
  return { config, contact };
}
