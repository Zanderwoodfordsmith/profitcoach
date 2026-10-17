import { AdvisoryBlueprintPageClient } from "@/components/booking/AdvisoryBlueprintPageClient";

export const metadata = {
  title: "Blueprint Call — The Profit Coach",
  description:
    "Book the Blueprint Call with Pam. You lock the market, the offer, the price, and the angle.",
};

/** Public booking page: theprofitcoach.com/advisory-blueprint */
export default function AdvisoryBlueprintPage() {
  return <AdvisoryBlueprintPageClient />;
}
