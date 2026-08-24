import type { Metadata } from "next";
import { HomeV3Content } from "./HomeV3Content";

export const metadata: Metadata = {
  title: "The Profit Coach | If you stop, the business stops. Let's fix that.",
  description:
    "Most owners don't own a business. They own a job that owns them. The free BOSS Score shows you why in 10 minutes, and a certified Profit Coach helps you fix it in the right order.",
  // Staging URL. Remove noindex when this page is promoted to the live homepage.
  robots: { index: false, follow: false },
};

export default function HomeV3Page() {
  return <HomeV3Content />;
}
