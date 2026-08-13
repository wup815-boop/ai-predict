"use client";

import { signIn } from "next-auth/react";

const FEATURES = [
  { emoji: "👆", label: "1タップ予想" },
  { emoji: "📅", label: "30日後に自動判定" },
  { emoji: "🤖", label: "AIと正解率を比較" },
];

export default function LoginPage() {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-base px-4 py-10">
      <div className="bg-card border border-line p-6 sm:p-8 rounded-2xl max-w-sm w-full text-center">
        <h1 className="text-2xl font-bold mb-2 text-content">AI Predict</h1>
        <p className="text-muted text-sm mb-6">
          新しいAIプロダクトの成長を予想して、AIと腕を競う
        </p>

        <div className="grid grid-cols-3 gap-2 mb-7">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="bg-base border border-line rounded-xl px-2 py-3 flex flex-col items-center gap-1.5"
            >
              <span className="text-xl">{f.emoji}</span>
              <span className="text-[11px] leading-tight text-muted">{f.label}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full bg-accent text-white py-3.5 px-4 rounded-xl font-medium hover:bg-accent-hover active:scale-[0.98] transition-all"
        >
          Googleでログイン
        </button>

        <p className="text-xs text-faint mt-4">予想履歴を保存するためにログインが必要です</p>
        <p className="text-xs text-warn bg-base border border-line rounded-lg px-3 py-2 mt-4">
          ※ 現在テスト版のため、ログインできない場合があります
        </p>
      </div>
    </main>
  );
}
