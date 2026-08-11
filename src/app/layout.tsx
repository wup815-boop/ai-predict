import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Predict - どちらが伸びる?",
  description: "新しいAIプロダクトの成長を予測して目利き履歴を残す",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
