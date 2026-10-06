/** Prepare a complete index from an official municipal ZIP, or warm it from AdE. */
import { readFile } from "node:fs/promises";
import { resolveMunicipality } from "#server/countries/it/cadastral-query.ts";
import {
  buildCadastralIndex,
  municipalIndex,
  storeCadastralIndex,
} from "#server/countries/it/cadastral-index.ts";
import { archiveUrl } from "#server/countries/it/cadastral-archive.ts";

const name = process.argv[2];
if (!name)
  throw new Error(
    'Usage: node --experimental-strip-types scripts/cadastre-index.ts "Firenze" [official-comune.zip]',
  );
const municipality = resolveMunicipality(name);
const start = performance.now();
const file = process.argv[3];
const index = file
  ? await buildCadastralIndex(new Uint8Array(await readFile(file)), municipality.cadastralCode, {
      requestUrl: archiveUrl(municipality.region),
      retrievedAt: new Date().toISOString(),
    })
  : await municipalIndex(municipality.cadastralCode);
if (file) await storeCadastralIndex(index);
console.log(
  JSON.stringify({
    municipality: name,
    belfiore: index.belfiore,
    counts: index.counts,
    indexBytes: Buffer.byteLength(JSON.stringify(index)),
    seconds: (performance.now() - start) / 1000,
    referenceDate: index.referenceDate,
    sha256: index.sha256,
  }),
);
