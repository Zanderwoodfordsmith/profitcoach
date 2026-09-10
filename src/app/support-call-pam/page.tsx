import { SupportCallPageClient } from "@/components/support/SupportCallPageClient";

export const metadata = {
  title: "Support call with Pam — The Profit Coach",
  description: "Schedule a 20-minute support call with Pam.",
};

/** Public booking page: theprofitcoach.com/support-call-pam */
export default function SupportCallPamPage() {
  return <SupportCallPageClient hostSlug="pam" />;
}
