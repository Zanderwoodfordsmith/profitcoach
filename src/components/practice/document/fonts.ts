import { Fraunces } from "next/font/google";

/** The brand's editorial display face (as on the homepage). Used for the
 * Blueprint cover, chapter titles, ledes, quotes and proof numbers. */
export const blueprintDisplay = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-blueprint-display",
});
