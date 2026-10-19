import { plusJakartaSans as plusJakarta, jetbrainsMono } from "@/fonts";

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
