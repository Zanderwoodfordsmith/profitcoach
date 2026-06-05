"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type ShareQrCodeModalProps = {
  open: boolean;
  title: string;
  description: string;
  url: string;
  displayUrl?: string;
  filenameStem: string;
  onClose: () => void;
};

export function ShareQrCodeModal({
  open,
  title,
  description,
  url,
  displayUrl,
  filenameStem,
  onClose,
}: ShareQrCodeModalProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open) {
      setDataUrl(null);
      return;
    }

    let cancelled = false;

    async function generatePreview() {
      try {
        const next = await QRCode.toDataURL(url, {
          width: 240,
          margin: 2,
          errorCorrectionLevel: "M",
        });
        if (!cancelled) {
          setDataUrl(next);
        }
      } catch {
        if (!cancelled) {
          setDataUrl(null);
        }
      }
    }

    void generatePreview();

    return () => {
      cancelled = true;
    };
  }, [open, url]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  async function downloadPng() {
    setDownloading(true);
    try {
      const png = await QRCode.toDataURL(url, {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: "M",
      });
      const link = document.createElement("a");
      link.href = png;
      link.download = `${filenameStem}.png`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-qr-code-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="share-qr-code-title"
              className="text-lg font-semibold text-slate-900"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            Close
          </button>
        </div>

        <div className="mt-5 flex justify-center">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            {dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dataUrl}
                alt="QR code for your share link"
                width={240}
                height={240}
                className="h-[240px] w-[240px]"
              />
            ) : (
              <div
                className="h-[240px] w-[240px] animate-pulse rounded bg-slate-100"
                aria-hidden
              />
            )}
          </div>
        </div>

        {displayUrl ? (
          <code className="mt-4 block truncate rounded-md bg-slate-50 px-3 py-2 text-center text-xs text-slate-700">
            {displayUrl}
          </code>
        ) : null}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void downloadPng()}
            disabled={!dataUrl || downloading}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloading ? "Preparing…" : "Download PNG"}
          </button>
        </div>
      </div>
    </div>
  );
}
