import type { Metadata } from "next";
import { BriefPage } from "./BriefPage";

export const metadata: Metadata = {
  title: "The Profit Coach — Story & Emotional Copy Brief",
  description: "Internal brand brief for story and emotional copywriting.",
  robots: { index: false, follow: false },
};

export default function CopyBriefPage() {
  return <BriefPage />;
}
