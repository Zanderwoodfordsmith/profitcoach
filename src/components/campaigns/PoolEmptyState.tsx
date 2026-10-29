"use client";

import {
  PoolImportPicker,
  useBlueprintStart,
  type PoolImportPreset,
} from "@/components/campaigns/PoolImportPicker";

export function PoolEmptyState({
  onPick,
}: {
  onPick: (preset: PoolImportPreset) => void;
}) {
  const start = useBlueprintStart();

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-8 text-left sm:py-12">
      <div className="mb-10 text-center">
        <h2 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          {/* Blank until loaded, so the greeting doesn't flash "Hi" first. */}
          {start === undefined
            ? " "
            : start.firstName
              ? `Hi, ${start.firstName}`
              : "Hi"}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-snug text-slate-600">
          Let&apos;s fill your pool. It holds everyone you might reach out to.
          Pick a way to add your first people.
        </p>
      </div>

      <PoolImportPicker onPick={onPick} />

      <p className="mt-6 text-center text-sm text-slate-500">
        Someone already in your pool stays one row, however many times you add
        them.
      </p>
    </div>
  );
}
