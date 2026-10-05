import { z } from "zod";
import type { LatLon, Municipality } from "../../../lib/contracts/index.ts";
import { OutsideCoverage, UpstreamError } from "../../core/errors.ts";
import { provenance } from "../../core/provenance.ts";
import { arcPointParams, fetchSource, parseArc } from "./queries.ts";

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
  const municipality: Municipality = {
    istatCode: a.PRO_COM_T,
    cadastralCode: belfiore,
    name: a.COMUNE,
    province: null,
    provinceCode: String(a.COD_PROV).padStart(3, "0"),
    region: regions[a.COD_REG] ?? null,
  };
  if (["021", "022"].includes(municipality.provinceCode!))
    throw new OutsideCoverage("La cartografia AdE non copre le province autonome di Trento e Bolzano.");
  return { municipality, provenance: provenance("istat-municipality", payload) };
}
