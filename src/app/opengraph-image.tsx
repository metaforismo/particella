import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Particella: cosa si può costruire su un terreno, dalle fonti pubbliche ufficiali";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = (file: string) => readFile(join(process.cwd(), "src/fonts", file));

// Satori cannot read the variable woff2, so the share image uses the static cuts of the same family.
export default async function OpenGraphImage() {
  const [bold, medium] = await Promise.all([
    font("archivo-latin-700-normal.woff"),
    font("archivo-latin-500-normal.woff"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#edefec",
          backgroundImage:
            "linear-gradient(#d9ddd9 1px, transparent 1px), linear-gradient(90deg, #d9ddd9 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          padding: 72,
          fontFamily: "Archivo",
          color: "#17201d",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>Particella</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ fontSize: 92, fontWeight: 700, lineHeight: 1, letterSpacing: -3, maxWidth: 720 }}>
              Cosa si può costruire qui?
            </div>
            <div style={{ fontSize: 30, fontWeight: 500, color: "#47524d", maxWidth: 700 }}>
              Catasto, rischi, vincoli e contesto di ogni terreno in Italia, con la fonte accanto a ogni dato.
            </div>
          </div>
        </div>
        <svg width="340" height="340" viewBox="0 0 24 24" style={{ alignSelf: "center" }}>
          <defs>
            <pattern id="h" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="0.65" height="1.6" fill="#f5c518" />
            </pattern>
          </defs>
          <path d="M3.5 7.2 13.8 2.8l6.9 6.1-2.4 11.4-12.6 1.2Z" fill="url(#h)" />
          <path
            d="M3.5 7.2 13.8 2.8l6.9 6.1-2.4 11.4-12.6 1.2Z"
            fill="none"
            stroke="#17201d"
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
          <circle cx="11.6" cy="12.6" r="0.9" fill="#17201d" />
        </svg>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Archivo", data: bold, weight: 700, style: "normal" },
        { name: "Archivo", data: medium, weight: 500, style: "normal" },
      ],
    },
  );
}
