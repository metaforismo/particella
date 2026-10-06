import { pathToFileURL } from "node:url";
import {
  buildMunicipalIndex,
  storeCadastralIndex,
  type CadastralIndex,
} from "#server/countries/it/cadastral-index.ts";
import { cadastralStorage, type CadastralStorage } from "#server/countries/it/cadastral-storage.ts";

// Capoluoghi with connected planning adapters and positive/empty sample evidence in session D.
export const DEFAULT_BELFIORE = ["D612", "F205", "A794", "E648", "L219", "I726"] as const;
export async function prebuildCadastre(
  codes: readonly string[],
  storage: CadastralStorage,
  build: (code: string) => Promise<CadastralIndex> = buildMunicipalIndex,
) {
  if (codes.some((code) => !/^[A-Z]\d{3}$/.test(code)))
    throw new Error("Usage: npm run cadastre:prebuild -- D612 F205 ... (Belfiore uppercase)");
  const results = [];
  // Sequential: an archive exists only in memory while its municipal index is built and uploaded.
  for (const code of new Set(codes)) {
    const started = performance.now();
    const index = await build(code);
    if (index.belfiore !== code) throw new Error("Cadastral index municipality mismatch");
    await storeCadastralIndex(index, storage);
    results.push({
      belfiore: code,
      counts: index.counts,
      indexBytes: Buffer.byteLength(JSON.stringify(index)),
      sha256: index.sha256,
      seconds: Math.round((performance.now() - started) / 1000),
    });
  }
  return results;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const codes = process.argv.slice(2);
  const results = await prebuildCadastre(codes.length ? codes : DEFAULT_BELFIORE, cadastralStorage());
  for (const result of results) console.log(JSON.stringify(result));
}
