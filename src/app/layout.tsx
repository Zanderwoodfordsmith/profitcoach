import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Profit Coach",
  description: "Profit Coach",
  icons: {
    icon: "/favicon.png",
    apple: "/app-icons/apple-touch-icon.png",
  },
  // Home screen on iPhone: open full screen with the app's own name.
  appleWebApp: {
    capable: true,
    title: "Profit Coach",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c5290",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ImpersonationProvider>{children}</ImpersonationProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
