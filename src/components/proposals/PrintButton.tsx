"use client";

import { FileDown } from "lucide-react";

/** Save the page as a PDF through the browser's print dialog. */
export function PrintButton({ className }: { className: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      <FileDown size={16} strokeWidth={2} aria-hidden="true" />
      Save as PDF
    </button>
  );
}
