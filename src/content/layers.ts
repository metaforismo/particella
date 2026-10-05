import type { LayerGroup, LayerId } from "@/lib/contracts";

export type LayerMeta = {
  id: LayerId;
  group: LayerGroup;
  title: string;
  /** What the layer answers, phrased as the user's question. */
  question: string;
  authority: string;
  /** How the layer is drawn in the legend; mirrors its map symbol. */
  symbol: "hatch" | "fill" | "line" | "dots" | "ring" | "grid";
  tone: "sepia" | "hydro" | "verde" | "ink" | "cantiere";
};

export const GROUP_LABEL: Record<LayerGroup, string> = {
  urbanistica: "Urbanistica",
  rischi: "Rischi naturali",
  ambiente: "Ambiente e terreno",
  contesto: "Contesto",
};

export const LAYERS: LayerMeta[] = [
  {
    id: "planning",
    group: "urbanistica",
    title: "Zonizzazione del piano",
    question: "In che zona del piano regolatore ricade e cosa permette?",
    authority: "Geoportali regionali e comunali",
    symbol: "hatch",
    tone: "sepia",
  },
  {
    id: "landscape",
    group: "urbanistica",
    title: "Vincoli paesaggistici",
    question: "Serve l'autorizzazione paesaggistica?",
    authority: "Ministero della Cultura",
    symbol: "line",
    tone: "sepia",
  },
  {
    id: "land-cover",
    group: "urbanistica",
    title: "Uso e consumo di suolo",
    question: "Il terreno è già costruito, agricolo o naturale?",
    authority: "ISPRA, Copernicus",
    symbol: "grid",
    tone: "verde",
  },
  {
    id: "flood",
    group: "rischi",
    title: "Pericolosità idraulica",
    question: "Il lotto è in un'area allagabile?",
    authority: "ISPRA IdroGEO",
    symbol: "fill",
    tone: "hydro",
  },
  {
    id: "landslide",
    group: "rischi",
    title: "Frane",
    question: "Ci sono frane censite o aree a pericolosità PAI?",
    authority: "ISPRA IdroGEO",
    symbol: "fill",
    tone: "sepia",
  },
  {
    id: "seismic",
    group: "rischi",
    title: "Classificazione sismica",
    question: "In che zona sismica si trova il comune?",
    authority: "Dipartimento della Protezione Civile",
    symbol: "ring",
    tone: "ink",
  },
  {
    id: "protected-areas",
    group: "ambiente",
    title: "Aree protette e Natura 2000",
    question: "Il lotto tocca un parco o un sito Natura 2000?",
    authority: "Ministero dell'Ambiente",
    symbol: "hatch",
    tone: "verde",
  },
  {
    id: "terrain",
    group: "ambiente",
    title: "Profilo del terreno",
    question: "Quanto è in pendenza e a che quota si trova?",
    authority: "Copernicus DEM",
    symbol: "line",
    tone: "sepia",
  },
  {
    id: "solar",
    group: "ambiente",
    title: "Esposizione solare",
    question: "Quanta energia solare riceve in un anno?",
    authority: "Commissione europea, JRC PVGIS",
    symbol: "fill",
    tone: "cantiere",
  },
  {
    id: "services",
    group: "contesto",
    title: "Servizi nei dintorni",
    question: "Scuole, fermate, farmacie e negozi a portata di mano?",
    authority: "OpenStreetMap",
    symbol: "dots",
    tone: "ink",
  },
  {
    id: "accessibility",
    group: "contesto",
    title: "Raggiungibilità",
    question: "Dove arrivo in 10 minuti a piedi o in auto?",
    authority: "OpenStreetMap, Valhalla",
    symbol: "ring",
    tone: "hydro",
  },
  {
    id: "demographics",
    group: "contesto",
    title: "Popolazione",
    question: "Quante persone vivono nell'area e come cambia?",
    authority: "ISTAT",
    symbol: "grid",
    tone: "ink",
  },
  {
    id: "market",
    group: "contesto",
    title: "Valori immobiliari",
    question: "Quanto vale al metro quadro nella zona?",
    authority: "Agenzia delle Entrate, OMI",
    symbol: "fill",
    tone: "sepia",
  },
];

export const LAYER_BY_ID = Object.fromEntries(LAYERS.map((l) => [l.id, l])) as Record<LayerId, LayerMeta>;
