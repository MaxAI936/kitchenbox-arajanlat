import { it, expect, vi, afterEach } from "vitest";
import { withRoadDistance } from "../src/server/routing";
import { normalize } from "../src/server/ghl";
import { fixture } from "./fixtures";
import { FIELDS } from "../src/lib/fields";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("Google DRIVE távolságot méterből km-re vált; secret csak fejlécben", async () => {
  const { contact, config } = fixture();
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
  contact.fullAddress = "5600 Békéscsaba, Teszt utca 1.";
  const fetcher = vi.fn(async () =>
    Response.json({
      routes: [{ distanceMeters: 25001 }],
      geocodingResults: {
        origin: { placeId: "o" },
        destination: { placeId: "d" },
      },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  const c = await withRoadDistance(contact, config);
  expect(c.roadKm).toBe(25.001);
  expect(c.roadRetrievedAt).toBeTruthy();
  const args = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(JSON.parse(args[1].body as string).travelMode).toBe("DRIVE");
});
it("részleges címegyezést ellenőrzésre küld", async () => {
  const { contact, config } = fixture();
  delete contact.roadKm;
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
  contact.fullAddress = "5600 Békéscsaba, Teszt utca 1.";
  vi.stubGlobal("fetch", async () =>
    Response.json({
      routes: [{ distanceMeters: 25 }],
      geocodingResults: {
        origin: { placeId: "o" },
        destination: { placeId: "d", partialMatch: true },
      },
    }),
  );
  const c = await withRoadDistance(contact, config);
  expect(c.roadKm).toBeUndefined();
  expect(c.routeIssue).toContain("egyértelműen");
});
it("GHL email és phone natív mező, TEXTBOX_LIST ismeretlen tartalom blokkolható", () => {
  const { config } = fixture();
  const extras = FIELDS.find((x) => x.multi)!;
  const c = normalize(
    {
      id: "c",
      email: "native@example.com",
      phone: "+36301234567",
      customFields: [
        { id: extras.id, value: { [extras.optionIds![0]]: "valami" } },
      ],
    },
    config,
  );
  expect(c.email).toBe("native@example.com");
  expect(c.phone).toBe("+36301234567");
  expect(c.fields[extras.key][0]).toContain("ELLENŐRIZENDŐ");
});
