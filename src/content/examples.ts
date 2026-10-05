import type { LatLon } from "@/lib/contracts";

// Real parcels verified against the live sources, chosen to show different kinds of answers.
export const EXAMPLES: { label: string; short: string; detail: string; point: LatLon }[] = [
  {
    label: "Lotto residenziale a Firenze",
    short: "Firenze, zona B",
    detail: "Zona B del Piano Operativo · 1.046 m²",
    point: { lat: 43.737, lon: 11.233 },
  },
  {
    label: "Collina coltivata a Firenze",
    short: "collina fiorentina",
    detail: "Sub-sistema agricolo · 5,3 ha",
    point: { lat: 43.793, lon: 11.26 },
  },
  {
    label: "Campagna a Bagno a Ripoli",
    short: "Bagno a Ripoli",
    detail: "Pericolosità da frana segnalata · 1,9 ha",
    point: { lat: 43.7, lon: 11.32 },
  },
  {
    label: "Area urbana a Milano",
    short: "Milano, Tortona",
    detail: "Residenziale secondo il PGT · 9.631 m²",
    point: { lat: 45.4515, lon: 9.166 },
  },
];
