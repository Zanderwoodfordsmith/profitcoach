"use client";

import { StickyPageHeader } from "@/components/layout";
import { MessageGeneratorChat } from "@/components/MessageGeneratorChat";

export default function CoachMessageGeneratorPage() {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col gap-4">
      <StickyPageHeader
        title="Message Generator"
        description="Draft LinkedIn connection notes, follow-ups, and campaigns using Profit Coach methodology and examples. Describe your avatar and proof; the assistant suggests variants you can choose from."
      />

      <div
        className="flex min-h-0 min-h-[32rem] flex-1 flex-col overflow-hidden rounded-2xl border border-white/70 shadow-xl shadow-slate-200/40"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(14,165,233,0.08), transparent), linear-gradient(to bottom right, rgb(248 250 252), rgba(240,249,255,0.45), rgb(241 245 249))",
        }}
      >
        <MessageGeneratorChat embedded />
      </div>
    </div>
  );
}
