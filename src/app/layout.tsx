import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "AI Predict - どちらが伸びる?",
  description: "新しいAIプロダクトの成長を予測して目利き履歴を残す",
  openGraph: {
    title: "AI Predict - AIプロダクト成長予測",
    description: "2つのAIプロダクト、どちらが伸びる？30日後にGitHub Starsで答え合わせ",
    siteName: "AI Predict",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AI Predict - AIプロダクト成長予測",
    description: "2つのAIプロダクト、どちらが伸びる？30日後にGitHub Starsで答え合わせ",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
