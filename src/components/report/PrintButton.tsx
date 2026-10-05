"use client";

import { DownloadSimple } from "@phosphor-icons/react";

/** The browser's print dialog produces the PDF; the page has a dedicated print stylesheet. */
export function PrintButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      <DownloadSimple size={16} aria-hidden="true" /> Scarica PDF
    </button>
  );
}
