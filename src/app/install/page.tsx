import type { Metadata } from "next";
import { InstallGuide } from "@/components/install/InstallGuide";

export const metadata: Metadata = {
  title: "Get the Profit Coach app",
  robots: { index: false, follow: false },
};

/** Where the Settings QR code lands: works out the phone and gives the shortest way onto the home screen. */
export default function InstallPage() {
  return <InstallGuide />;
}
