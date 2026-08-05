import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MindForge Local — Air-Gapped Knowledge Graph & RAG Engine",
  description:
    "100% client-side knowledge graph and RAG search engine running entirely in your browser. Powered by WebGPU, WebLLM, and Transformers.js — zero cloud, zero API costs.",
  keywords: ["knowledge graph", "RAG", "WebGPU", "LLM", "browser AI", "local AI"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="h-full min-h-screen overflow-hidden antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
