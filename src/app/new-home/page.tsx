import type { Metadata } from "next";
import { NewHomeContent } from "./NewHomeContent";

export const metadata: Metadata = {
  title: "The Profit Coach — Transform your business. Reclaim your life.",
  description:
    "Personalised one-to-one business coaching for owners doing £200K–£5M. Unlock 30–130% more profit in 12 months with a certified Profit Coach and the BOSS Diagnostic.",
};

export default function NewHomePage() {
  return <NewHomeContent />;
}
