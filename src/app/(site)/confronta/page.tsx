import type { Metadata } from "next";
import { Compare, type CompareTarget } from "@/components/compare/Compare";
import { COMPARE_LIMIT } from "@/lib/compare";
import { parseAt } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Confronta terreni",
  description: "Fino a quattro terreni affiancati, livello per livello, dalle stesse fonti pubbliche.",
  robots: { index: false },
};

const ID = /^it:[A-Z]\d{3}:[A-Z0-9_]{1,3}:\d{1,5}:\d{1,8}[A-Z]?$/;

/** `p=id@lat,lon`, repeated. Malformed entries are dropped rather than failing the page. */
function toTargets(value: string | string[] | undefined): CompareTarget[] {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set<string>();
  return raw
    .flatMap((entry) => {
      const [id, at] = entry.split("@");
      if (!ID.test(id) || seen.has(id)) return [];
      seen.add(id);
      return [{ id, at: parseAt(at) }];
    })
    .slice(0, COMPARE_LIMIT);
}

export default async function ComparePage({ searchParams }: PageProps<"/confronta">) {
  const { p } = await searchParams;
  const targets = toTargets(p);
  return <Compare key={targets.map((t) => t.id).join("|")} targets={targets} />;
}
