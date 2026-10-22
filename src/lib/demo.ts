import { FIELDS } from "./fields";
import type { Contact } from "./fields";
export const demoContact: Contact = {
  id: "demo",
  name: "Minta Érdeklődő",
  email: "erdeklodo@example.com",
  phone: "+36 00 000 0000",
  fullAddress: "A kiszállítási cím még nincs megadva",
  fields: Object.fromEntries(
    FIELDS.map((f) => [
      f.key,
      f.note
        ? "Fedett teraszra tervezett kültéri konyha."
        : f.multi
          ? f.options
          : f.options[0],
    ]),
  ),
};
