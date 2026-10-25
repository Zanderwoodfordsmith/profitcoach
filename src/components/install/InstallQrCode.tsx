"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cardClass } from "@/components/ui/Card";

/** QR code for this site's /install page, so a phone can scan it off the desktop screen. */
export function InstallQrCode({ size }: { size: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(`${window.location.origin}/install`, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((next) => {
        if (!cancelled) setDataUrl(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [size]);

  return (
    <div className={cardClass("plain", "shrink-0 p-3")}>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt="QR code that opens Profit Coach on your phone"
          width={size}
          height={size}
          style={{ width: size, height: size }}
        />
      ) : (
        <div className="animate-pulse rounded bg-slate-100" style={{ width: size, height: size }} aria-hidden />
      )}
    </div>
  );
}
