export const LOCATION_ID = "sQwGiqEHji64YPHGXdEU";
const colors = ["Antracit szürke", "Rézbarna", "Szürkésfehér", "Mélyfekete"];
// Read from the Kitchen Box GHL location on 2026-10-22. Prices intentionally absent.
export const FIELDS = [
  {
    key: "contact.hz",
    id: "NRpHMOgQ4HJoKXp1KYBw",
    label: "Ház",
    options: colors,
  },
  {
    key: "contact.htlap",
    id: "hSAynNT9Z3lbnaaaSJWT",
    label: "Hátlap",
    options: colors,
  },
  {
    key: "contact.konyha_front",
    id: "D6SlMZsltTCQoKAQzZpE",
    label: "Konyha front",
    options: colors,
  },
  {
    key: "contact.munkapult",
    id: "PPf3ndjV58gzQZhglMnI",
    label: "Munkapult",
    options: colors,
  },
  {
    key: "contact.munkapult_anyag",
    id: "2QouA84Z55lwpIx0Ogqn",
    label: "Munkapult anyag",
    options: ["Kompakt lemez", "Dekton (technikai kő)"],
  },
  {
    key: "contact.gzgrill",
    id: "ZdlSJjTAzEl0vseKpN1g",
    label: "Gázgrill",
    options: [
      "Beefeater 1500 3 égős, rozsdamentes acél",
      "Beefeater 1600 3 égős, rozsdamentes acél",
      "Beefeater 1600 3 égős, fekete zománcozott",
    ],
  },
  {
    key: "contact.bepthet_extrk",
    id: "bmHBwVNGIYhVkxaYzUQ3",
    label: "Beépíthető extrák",
    options: [
      "NERO Parma Gránit mosogató",
      "Ignito Domino gázfőzőlap",
      "Yakiniku Medium Kamado grill",
      "Beersafe XL Onyx hűtőszekrény",
      "TV",
      "Hangszórók",
    ],
    optionIds: [
      "e4c4111c-4f1e-489a-a189-f96305574781",
      "75878377-ad52-481e-901e-a409d12ff7d9",
      "652c6273-e5e1-449a-a029-e85ace8de499",
      "fc6b8c85-cd41-44ae-9355-735aa74e2c25",
      "9730b364-76a3-486f-8355-0e41f4f6b1ef",
      "cf1521cb-fca5-4dd6-a4de-5c5a3b84ba88",
    ],
    multi: true,
  },
  {
    key: "contact.megjegyzs",
    id: "kmcSp7odRLLac2Zlkdhg",
    label: "Megjegyzés",
    options: [],
    note: true,
  },
];
export type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  fullAddress?: string;
  roadKm?: number;
  roadKmSource?: string;
  roadRetrievedAt?: string;
  routeIssue?: string;
  fields: Record<string, string | string[]>;
  dnd?: boolean;
  emailDnd?: boolean;
};
export const money = (value: number) =>
  new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency: "HUF",
    maximumFractionDigits: 0,
  }).format(value);
