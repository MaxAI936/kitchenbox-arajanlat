import { FIELDS, LOCATION_ID } from "../lib/fields";
import type { Contact } from "../lib/fields";
import type { Pricing } from "../lib/pricing";
import { env } from "./config";
export async function ghl(path: string, body?: unknown) {
  if (!env("GHL_TOKEN"))
    throw new Error("A GHL szerveroldali token nincs beállítva.");
  const r = await fetch(`https://services.leadconnectorhq.com${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${env("GHL_TOKEN")}`,
      Version: env("GHL_API_VERSION") || "2021-07-28",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`GHL API hiba (${r.status}).`);
  return r.json();
}
export function normalize(raw: any, config: Pricing): Contact {
  const fields: Contact["fields"] = {};
  for (const f of FIELDS) {
    const id = f.note
      ? config.noteFieldId
      : (config.fields.find((x) => x.key === f.key)?.fieldId ?? f.id);
    const v = Array.isArray(raw.customFields)
      ? raw.customFields.find((x: any) => x.id === id || x.key === f.key)?.value
      : raw.customFields?.[f.key];
    if (f.multi && v && typeof v === "object" && !Array.isArray(v)) {
      // GHL TEXTBOX_LIST stores arbitrary text under option IDs. Only explicit selected values are accepted.
      fields[f.key] = Object.entries(v)
        .filter(
          ([, val]) =>
            val === true || val === "true" || val === "1" || val === 1,
        )
        .map(
          ([id]) =>
            f.options[f.optionIds?.indexOf(id) ?? -1] ?? `ISMERETLEN:${id}`,
        );
      const ambiguous = Object.entries(v).filter(
        ([, val]) =>
          val !== "" &&
          val !== null &&
          val !== false &&
          val !== "false" &&
          val !== "0" &&
          val !== 0 &&
          val !== true &&
          val !== "true" &&
          val !== "1" &&
          val !== 1,
      );
      if (ambiguous.length)
        fields[f.key] = [
          ...(fields[f.key] as string[]),
          ...ambiguous.map(([id, val]) => `ELLENŐRIZENDŐ:${id}=${val}`),
        ];
    } else
      fields[f.key] = Array.isArray(v)
        ? v.map(String)
        : v === undefined || v === null
          ? ""
          : String(v);
  }
  return {
    id: raw.id,
    name: raw.name || [raw.firstName, raw.lastName].filter(Boolean).join(" "),
    email: raw.email ?? "",
    phone: raw.phone ?? "",
    fullAddress:
      raw.fullAddress ||
      [raw.postalCode, raw.city, raw.address1, raw.country]
        .filter(Boolean)
        .join(", "),
    fields,
    dnd: !!raw.dnd,
    emailDnd: raw.dndSettings?.email?.status === "active",
  };
}
export async function getContact(id: string, config: Pricing) {
  const r = await ghl(`/contacts/${encodeURIComponent(id)}`);
  const raw = r.contact;
  if (!raw?.id || raw.locationId !== (env("GHL_LOCATION_ID") || LOCATION_ID))
    throw new Error("A kontakt nem a Kitchen Box fiókhoz tartozik.");
  return normalize(raw, config);
}
export async function upsert(input: Omit<Contact, "id">, config: Pricing) {
  const customFields = FIELDS.map((f) => {
    const value = input.fields[f.key] ?? (f.multi ? [] : "");
    return {
      id: f.note
        ? config.noteFieldId
        : (config.fields.find((x) => x.key === f.key)?.fieldId ?? f.id),
      field_value: f.multi
        ? Object.fromEntries(
            (f.optionIds ?? []).map((id, i) => [
              id,
              (value as string[]).includes(f.options[i]) ? "1" : "",
            ]),
          )
        : value,
    };
  });
  const r = await ghl("/contacts/upsert", {
    locationId: env("GHL_LOCATION_ID") || LOCATION_ID,
    name: input.name,
    email: input.email,
    phone: input.phone || undefined,
    address1: input.fullAddress,
    customFields,
    source: "Kitchenbox ajánlatkalkulátor",
    createNewIfDuplicateAllowed: false,
  });
  return getContact(r.contact.id, config);
}
