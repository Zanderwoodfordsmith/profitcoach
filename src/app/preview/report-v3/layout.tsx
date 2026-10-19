import { plusJakartaSans as plusJakarta, jetbrainsMono } from "@/fonts";

export default function ReportV3Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${plusJakarta.className} ${jetbrainsMono.variable} min-h-screen antialiased`}
    >
      {children}
    </div>
  );
}
