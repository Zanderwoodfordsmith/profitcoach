import type { Metadata } from "next";
import { PamHomepage } from "./PamHomepage";

export const metadata: Metadata = {
  title: "Pam Woodford — Global #1 Business Profit Coach | The Profit System",
  description:
    "Work with Pam Woodford and the Profit System to increase profit, reclaim time, and build a business that runs without you. Diagnose, prioritise, and compound results.",
};

export default function PamHomePage() {
  return <PamHomepage />;
}
