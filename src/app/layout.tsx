import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI-Powered CI/CD Pipeline Builder",
  description:
    "Visual + AI-generated CI/CD pipelines. Drag-and-drop node canvas, describe-to-AI graph generation, GitHub Actions YAML compiler with smart caching + matrix expansion, and a deterministic mock run simulator.",
  keywords: [
    "CI/CD",
    "GitHub Actions",
    "pipeline builder",
    "YAML compiler",
    "AI codegen",
    "Next.js",
    "Prisma",
  ],
  authors: [{ name: "AI-Powered CI/CD Pipeline Builder" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
