import { SupportCallPageClient } from "@/components/support/SupportCallPageClient";

export const metadata = {
  title: "Support call with Zander — The Profit Coach",
  description: "Schedule a 20-minute support call with Zander.",
};

/** Public booking page: theprofitcoach.com/support-call-zander */
export default function SupportCallZanderPage() {
  return <SupportCallPageClient hostSlug="zander" />;
}
