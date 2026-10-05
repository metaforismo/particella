import type { LayerMeta } from "@/content/layers";
import styles from "./LegendSwatch.module.css";

type Props = Pick<LayerMeta, "symbol" | "tone"> & { size?: number };

/** A map-legend symbol: the same mark the layer uses on the map, at legend scale. */
export function LegendSwatch({ symbol, tone, size = 18 }: Props) {
  return (
    <span
      className={styles.swatch}
      data-symbol={symbol}
      data-tone={tone}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
