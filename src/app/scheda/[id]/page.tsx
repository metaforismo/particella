import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/report/ReportView";
import { BadRequest, NotFound } from "@/server/core/errors";
import { getPlotReport } from "@/server/plots";

export const metadata: Metadata = {
  title: "Scheda del terreno",
  robots: { index: false },
};

// Each report reads public sources at request time; never prerender or cache it as a static page.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function ReportPage({ params, searchParams }: PageProps<"/scheda/[id]">) {
  const { id } = await params;
  const { at } = await searchParams;
  const report = await getPlotReport(decodeURIComponent(id), typeof at === "string" ? at : undefined).catch(
    (error: unknown) => {
      if (error instanceof NotFound || error instanceof BadRequest) notFound();
      throw error;
    },
  );
  return <ReportView report={report} />;
}
