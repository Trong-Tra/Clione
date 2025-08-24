import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NetworkProvider } from "@/contexts/NetworkContext";
import { WalletProvider } from "@/contexts/WalletContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clione",
  description: "VWAP-Enhanced TWAP Trading - Trading with the Rhythm of the Market",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NetworkProvider>
          <WalletProvider>{children}</WalletProvider>
        </NetworkProvider>
      </body>
    </html>
  );
}
