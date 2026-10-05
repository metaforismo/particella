/**
 * Real response of GET /api/v1/plots/it:A564:_:60:110/layers/landslide, captured on 6 October 2026
 * and shortened (legend, overlays and provenance truncated, request URL elided, features removed).
 */
export const LAYER_SAMPLE = `{
  "layer": "landslide",
  "group": "rischi",
  "title": "Frane",
  "status": "ok",
  "scope": "point",
  "headline": "La fonte segnala pericolosità da frana P3 sul punto.",
  "severity": "high",
  "metrics": [
    {
      "key": "pai_classes",
      "label": "Classi PAI al punto",
      "value": "P3"
    },
    {
      "key": "iffi_count",
      "label": "Fenomeni IFFI al punto",
      "value": 1,
      "unit": "fenomeni"
    }
  ],
  "overlays": [
    {
      "id": "landslide",
      "kind": "raster",
      "tileUrl": "/api/v1/tiles/landslide/{z}/{x}/{y}",
      "opacity": 0.5,
      "attribution": "ISPRA e Regioni / Province autonome · CC BY-SA 4.0"
    }
  ],
  "legend": [
    {
      "classKey": "P1",
      "label": "Pericolosità P1"
    },
    {
      "classKey": "P2",
      "label": "Pericolosità P2"
    }
  ],
  "notes": [],
  "provenance": [
    {
      "sourceId": "idrogeo",
      "dataset": "Mosaicature PAI idraulica e frane",
      "authority": "ISPRA",
      "license": "CC BY-SA 4.0; attribuzione ISPRA, derivati con stessa licenza",
      "url": "https://idrogeo.isprambiente.it/geoserver/ows",
      "method": "wms",
      "isOfficial": true,
      "requestUrl": "https://idrogeo.isprambiente.it/geoserver/ows?bbox=11.319305935%2C43.700…",
      "retrievedAt": "2026-10-05T22:46:06.799Z",
      "referenceDate": null
    }
  ],
  "computedAt": "2026-10-05T22:46:06.801Z"
}`;
