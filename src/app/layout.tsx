import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted so builds never depend on reaching Google Fonts. Covers Latin-1, all Italian accents included.
const archivo = localFont({
  src: "../fonts/archivo-latin-wdth-normal.woff2",
  weight: "100 900",
  style: "normal",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Particella — cosa si può costruire su un terreno",
    template: "%s · Particella",
  },
  description:
    "Scegli un terreno in Italia: catasto, piano urbanistico, rischi e contesto da fonti pubbliche ufficiali, con un assistente AI che cita ogni fonte.",
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: "Particella",
  },
};

export const viewport: Viewport = {
  themeColor: "#edefec",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
