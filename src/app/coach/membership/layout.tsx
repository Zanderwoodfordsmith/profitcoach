import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-pc-ds-mono",
});

export default function CoachMembershipLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${plusJakarta.className} ${jetbrainsMono.variable} antialiased`}>
      {children}
    </div>
  );
}
