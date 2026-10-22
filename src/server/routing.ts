import type { Contact } from "../lib/fields";
import type { Pricing } from "../lib/pricing";
import { env } from "./config";
export async function withRoadDistance(
  contact: Contact,
  config: Pricing,
): Promise<Contact> {
  try {
    if (!env("GOOGLE_MAPS_API_KEY"))
      throw new Error("A Google Routes API kulcs nincs beállítva.");
    if (
      !contact.fullAddress ||
      contact.fullAddress.length < 12 ||
      !/[0-9]/.test(contact.fullAddress)
    )
      throw new Error("Pontos kiszállítási cím szükséges, házszámmal.");
    const response = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": env("GOOGLE_MAPS_API_KEY"),
          "X-Goog-FieldMask": "routes.distanceMeters,geocodingResults",
        },
        body: JSON.stringify({
          origin: { address: config.delivery.origin },
          destination: { address: contact.fullAddress },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_UNAWARE",
          computeAlternativeRoutes: false,
          languageCode: "hu-HU",
          units: "METRIC",
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw new Error(`Útvonalszámítás sikertelen (${response.status}).`);
    const r = await response.json();
    const points = [
      r.geocodingResults?.origin,
      r.geocodingResults?.destination,
    ];
    if (
      points.some(
        (p) => !p?.placeId || p.partialMatch || p.geocoderStatus?.code,
      )
    )
      throw new Error(
        "A cím nem azonosítható egyértelműen; címellenőrzés szükséges.",
      );
    const meters = r.routes?.[0]?.distanceMeters;
    if (!Number.isFinite(meters) || meters < 0)
      throw new Error("Nem található közúti útvonal.");
    return {
      ...contact,
      roadKm: meters / 1000,
      roadKmSource: "Google Routes API / DRIVE / egyszeres közúti út",
      roadRetrievedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ...contact,
      routeIssue: error instanceof Error ? error.message : "Útvonalhiba.",
    };
  }
}
