import { layerResult, type LayerProvider } from "#server/core/layers.ts";
import { provenance } from "#server/core/provenance.ts";
import { esriRings, coversPoint, parcelSamples, type PlotGeometry } from "#server/geo/index.ts";
import { fetchSource, arcPointParams, parseGeo } from "#server/countries/it/queries.ts";
import { UpstreamError } from "#server/core/errors.ts";

const classes: Record<string, string> = {
  "111": "Tessuto urbano continuo",
  "112": "Tessuto urbano discontinuo",
  "121": "Aree industriali o commerciali",
  "122": "Reti stradali e ferroviarie",
  "123": "Aree portuali",
  "124": "Aeroporti",
  "131": "Aree estrattive",
  "132": "Discariche",
  "133": "Cantieri",
  "141": "Aree verdi urbane",
  "142": "Aree sportive e ricreative",
  "211": "Seminativi non irrigui",
  "212": "Seminativi irrigui",
  "213": "Risaie",
  "221": "Vigneti",
  "222": "Frutteti",
  "223": "Oliveti",
  "231": "Prati e pascoli",
  "241": "Colture annuali e permanenti",
  "242": "Colture complesse",
  "243": "Terreni agricoli con vegetazione naturale",
  "244": "Aree agroforestali",
  "311": "Boschi di latifoglie",
  "312": "Boschi di conifere",
  "313": "Boschi misti",
  "321": "Praterie naturali",
  "322": "Brughiere e cespuglieti",
  "323": "Vegetazione mediterranea",
  "324": "Boschi e arbusti in evoluzione",
  "331": "Spiagge e dune",
  "332": "Rocce nude",
  "333": "Vegetazione rada",
  "334": "Aree incendiate",
  "335": "Ghiacciai e nevi perenni",
  "411": "Paludi interne",
  "412": "Torbiere",
  "421": "Paludi salmastre",
  "422": "Saline",
  "423": "Piane di marea",
  "511": "Corsi d’acqua",
  "512": "Specchi d’acqua",
  "521": "Lagune costiere",
  "522": "Estuari",
  "523": "Mare",
};

export const landCover: LayerProvider = async (plot, { signal }) => {
  const polygon = plot.geometry as PlotGeometry | null;
  const params: Record<string, string | number | boolean> = polygon
    ? {
        geometry: JSON.stringify({ rings: esriRings(polygon), spatialReference: { wkid: 4326 } }),
        geometryType: "esriGeometryPolygon",
      }
    : {};
  const payload = await fetchSource(
    "corine",
    {
      ...arcPointParams(plot.centroid),
      ...params,
      f: "geojson",
      outSR: 4326,
      returnGeometry: true,
      resultRecordCount: 100,
    },
    { signal },
  );
  const features = parseGeo(payload).features.map((feature) => {
    const code = String(feature.properties.Code_18 ?? "");
    if (!classes[code] || (feature.geometry?.type !== "Polygon" && feature.geometry?.type !== "MultiPolygon"))
      throw new UpstreamError("Classe o geometria CORINE non riconosciuta.");
    return {
      ...feature,
      properties: { ...feature.properties, classKey: `clc-${code}`, code, label: classes[code] },
    };
  });
  const samples = polygon ? parcelSamples(polygon, 3) : [plot.centroid];
  const counts = new Map<string, number>();
  let missing = 0;
  for (const point of samples) {
    const matches = features.filter((f) => coversPoint(f.geometry as PlotGeometry, point));
    const codes = [...new Set(matches.map((f) => f.properties.code))];
    if (codes.length !== 1) {
      missing++;
      continue;
    }
    counts.set(codes[0], (counts.get(codes[0]) ?? 0) + 1);
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  const dominant = ranked[0];
  const tied = dominant && ranked[1]?.[1] === dominant[1];
  const code = tied ? undefined : dominant?.[0];
  return layerResult("land-cover", {
    status: !features.length ? "empty" : missing || tied || !code ? "partial" : "ok",
    scope: polygon ? "parcel" : "point",
    severity: "none",
    headline: code
      ? `La copertura ${polygon ? "prevalente stimata" : "al punto"} è: ${classes[code].toLowerCase()}.`
      : features.length
        ? "La copertura prevalente non è determinabile dai dati disponibili."
        : "CORINE non restituisce copertura del suolo in questo luogo.",
    metrics: [
      { key: "dominant_cover", label: "Copertura prevalente stimata", value: code ? classes[code] : null },
      {
        key: "dominant_sample_share",
        label: "Punti con la classe prevalente",
        value: code && dominant ? Math.round((dominant[1] / samples.length) * 100) : null,
        unit: "%",
        hint: "Percentuale dei punti controllati, non superficie impermeabilizzata.",
      },
      {
        key: "impervious_share",
        label: "Superficie impermeabilizzata",
        value: null,
        unit: "%",
        hint: "Non disponibile in CORINE: non viene dedotta dalla classe.",
      },
    ],
    features: { type: "FeatureCollection", features },
    legend: [...new Set(features.map((f) => f.properties.code))].map((code) => ({
      classKey: `clc-${code}`,
      label: classes[code],
    })),
    method:
      "Una query ArcGIS interseca il poligono del lotto (o il punto); classe prevalente stimata con conteggio su griglia interna 4×4 più punto rappresentativo. CORINE 2018, unità minima 25 ha, larghezza 100 m, scala 1:100000; nessun calcolo della superficie impermeabilizzata.",
    notes: [
      "La mappa del 2018 descrive aree ampie: può non riconoscere dettagli o cambiamenti recenti di questo terreno.",
      "La prevalenza è una stima sui punti controllati, non una misura della superficie. Non descrive la destinazione urbanistica o i permessi per costruire.",
      "Fonte Copernicus/EEA; classificazione ed elaborazione Particella, senza approvazione implicita dell’Unione europea.",
    ],
    provenance: [provenance("corine", payload)],
  });
};
