"use client";

import { useState } from "react";

export function JoinPriceCheckDot({
  nickname,
  priceId,
}: {
  nickname: string | null;
  priceId: string;
}) {
  const [open, setOpen] = useState(false);
  const label = [nickname, priceId].filter(Boolean).join(" · ");

  return (
    <div className="pointer-events-none fixed right-3 bottom-10 z-20 flex justify-end lg:right-5">
      {open ? (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="pointer-events-auto max-w-[min(100vw-1.5rem,22rem)] rounded-md bg-white/80 px-2 py-1 text-left text-[9px] leading-snug tracking-wide text-slate-400/90 shadow-sm ring-1 ring-slate-200/70 backdrop-blur-sm select-all"
          title="Hide price check"
        >
          {label}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Show linked Stripe price"
          className="pointer-events-auto h-1.5 w-1.5 rounded-full bg-slate-300/80 hover:bg-slate-400"
        />
      )}
    </div>
  );
}
