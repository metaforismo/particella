import { z } from "zod";
import { municipalitySnapshot } from "#server/countries/it/cadastral-query.ts";
import provinces from "../../../../data/snapshots/it-provinces-2026.json" with { type: "json" };
import type { LatLon, Municipality } from "#contracts";
import { OutsideCoverage, UpstreamError } from "#server/core/errors.ts";
import { provenance } from "#server/core/provenance.ts";
import { arcPointParams, fetchSource, parseArc } from "#server/countries/it/queries.ts";

const Attributes = z.object({
  PRO_COM_T: z.string().regex(/^\d{6}$/),
  COMUNE: z.string().min(1),
  COD_PROV: z.number(),
  COD_REG: z.number(),
});

const regions = [
  "",
  "Piemonte",
  "Valle d'Aosta",
  "Lombardia",
  "Trentino-Alto Adige",
  "Veneto",
  "Friuli-Venezia Giulia",
  "Liguria",
  "Emilia-Romagna",
  "Toscana",
  "Umbria",
  "Marche",
  "Lazio",
  "Abruzzo",
  "Molise",
  "Campania",
  "Puglia",
  "Basilicata",
  "Calabria",
  "Sicilia",
  "Sardegna",
];

export async function municipalityAt(p: LatLon, belfiore: string | null = null, signal?: AbortSignal) {
  const payload = await fetchSource("istat-municipality", arcPointParams(p), { signal });
  const features = parseArc(payload).features;
  if (!features.length)
    throw new OutsideCoverage("Il punto non ricade nei confini comunali ISTAT disponibili.");
  if (features.length !== 1) throw new UpstreamError("Punto sul confine tra più comuni: selezione ambigua.");
  const parsed = Attributes.safeParse(features[0].attributes);
  if (!parsed.success) throw new UpstreamError("Attributi comunali ISTAT non validi.");
  const a = parsed.data;
  const provinceId = String(a.COD_PROV).padStart(3, "0");
  const province = (provinces.provinces as Record<string, { name: string; code: string }>)[provinceId];
  const supplied = belfiore
    ? municipalitySnapshot.municipalities.find((m) => m.cadastralCode === belfiore)
    : undefined;
  const municipalityRecord =
    supplied?.istatCode === a.PRO_COM_T
      ? supplied
      : municipalitySnapshot.municipalities.find((m) => m.istatCode === a.PRO_COM_T);
  const municipality: Municipality = {
    istatCode: a.PRO_COM_T,
    cadastralCode: /^[A-Z]\d{3}$/.test(municipalityRecord?.cadastralCode ?? "")
      ? municipalityRecord!.cadastralCode
      : null,
    name: a.COMUNE,
    province: province?.name ?? null,
    provinceCode: province?.code ?? null,
    region: regions[a.COD_REG] ?? null,
  };
  if (["021", "022"].includes(provinceId))
    throw new OutsideCoverage("La cartografia AdE non copre le province autonome di Trento e Bolzano.");
  return {
    municipality,
    codeProvenance: provenance("istat-municipalities", {
      requestUrl: municipalitySnapshot.sourceUrl,
      retrievedAt: municipalitySnapshot.retrievedAt,
    }),
    provenance: provenance("istat-municipality", payload),
    provinceProvenance: provenance("istat-provinces", {
      requestUrl: provinces.sourceUrl,
      retrievedAt: provinces.retrievedAt,
    }),
  };
}
