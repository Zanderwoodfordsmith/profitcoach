import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
});

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
