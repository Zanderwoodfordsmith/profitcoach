import type { Metadata } from "next";
import { inter } from "@/fonts";

export const metadata: Metadata = {
  title: "Profit Coach Ladder",
  description:
    "The Profit Coach Ladder — Promotion, Proof, and Prestige levels for coaching.",
};

export default function LadderLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className={inter.variable}>{children}</div>;
}
