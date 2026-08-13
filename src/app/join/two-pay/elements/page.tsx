import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Join — 2-pay | Profit Coach",
  robots: { index: false, follow: false },
};

/** Closer links use /join/two-pay; keep this path as an alias. */
export default function JoinTwoPayElementsRoute() {
  redirect("/join/two-pay");
}
