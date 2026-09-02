import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans, Sometype_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

// Plus Jakarta carries display and controls; Inter carries body and small text;
// Sometype Mono is the technical voice for uppercase meta labels.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const sometype = Sometype_Mono({
  variable: "--font-sometype",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "VIABUS — Operations portal",
    template: "%s · VIABUS",
  },
  description:
    "Trip requests, quotes, fleet and drivers for VIABUS coach operations.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${jakarta.variable} ${inter.variable} ${sometype.variable} font-sans`}
      >
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
