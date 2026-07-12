import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ElectronModeMarker } from "@/components/electron-mode-marker";
import { PRODUCT_DESCRIPTOR_EN, PRODUCT_SHORT_NAME } from "@/lib/product-branding";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: PRODUCT_SHORT_NAME,
  description: PRODUCT_DESCRIPTOR_EN,
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-HK"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white text-foreground" style={{ background: "#fff" }}>
        <ElectronModeMarker />
        {children}
      </body>
    </html>
  );
}
