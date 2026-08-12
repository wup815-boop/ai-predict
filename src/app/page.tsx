"use client";

import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

interface Product {
  id: string;
  name: string;
  tagline: string;
  ph_url: string;
  github_url: string;
  stars_at_fetch: number;
}

interface Pair {
  id: string;
  created_at: string;
  judge_after: string;
  product_a: Product;
  product_b: Product;
}

export default function Home() {
  const { data: session, status } = useSession();
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [predicted, setPredicted] = useState<Set<string>>(new Set());
  const [lastPick, setLastPick] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pairs")
      .then((r) => r.json())
      .then((d) => setPairs(d.pairs || []))
      .finally(() => setLoading(false));
  }, []);

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-sm border max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold mb-2">AI Predict</h1>
          <p className="text-gray-500 text-sm mb-6">
            AIプロダクトの成長を予測して目利き履歴を残す
          </p>
          <button
            onClick={() => signIn("google")}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Googleでログイン
          </button>
        </div>
      </main>
    );
  }

  const pair = pairs[currentIndex];

  async function handlePick(pick: "a" | "b") {
    if (!pair || !session?.user) return;
    const userId = (session.user as any).id;

    const res = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pair_id: pair.id, pick, user_id: userId }),
    });

    if (res.ok) {
      setPredicted((s) => new Set(s).add(pair.id));
      setLastPick(pick);
      setTimeout(() => {
        setLastPick(null);
        if (currentIndex < pairs.length - 1) {
          setCurrentIndex((i) => i + 1);
        }
      }, 2000);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </main>
    );
  }

  if (pairs.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">AI Predict</h1>
          <p className="text-gray-500">本日のペアはまだありません</p>
          <p className="text-sm text-gray-400 mt-1">毎日15:00頃に新しいペアが登場します</p>
        </div>
      </main>
    );
  }

  const alreadyPredicted = predicted.has(pair.id);
  const isLast = currentIndex >= pairs.length - 1;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">AI Predict</h1>
        <div className="flex items-center gap-4 text-sm">
          <a href="/results" className="text-gray-500 hover:text-gray-900">結果</a>
          <a href="/history" className="text-gray-500 hover:text-gray-900">履歴</a>
          <button onClick={() => signOut()} className="text-gray-400 hover:text-gray-600 text-xs">
            ログアウト
          </button>
        </div>
      </header>

      <div className="text-center py-3 text-sm text-gray-400">
        {currentIndex + 1} / {pairs.length}
      </div>

      <p className="text-center text-gray-700 mb-4 px-4">
        30日後、どちらのGitHub Starsがより伸びる?
      </p>

      <div className="max-w-lg mx-auto px-4 space-y-3">
        <button
          onClick={() => !alreadyPredicted && handlePick("a")}
          disabled={alreadyPredicted}
          className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
            lastPick === "a" ? "border-green-500 bg-green-50"
            : alreadyPredicted ? "border-gray-200 bg-gray-50 opacity-60"
            : "border-gray-200 bg-white hover:border-blue-400 hover:shadow-md active:scale-[0.98]"
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium text-blue-500 uppercase">A</span>
              <h2 className="text-lg font-bold mt-1">{pair.product_a.name}</h2>
              <p className="text-sm text-gray-500 mt-1">{pair.product_a.tagline}</p>
            </div>
            <span className="text-sm text-gray-400 whitespace-nowrap ml-3">★ {pair.product_a.stars_at_fetch.toLocaleString()}</span>
          </div>
        </button>

        <div className="text-center text-gray-300 text-sm font-bold">VS</div>

        <button
          onClick={() => !alreadyPredicted && handlePick("b")}
          disabled={alreadyPredicted}
          className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
            lastPick === "b" ? "border-green-500 bg-green-50"
            : alreadyPredicted ? "border-gray-200 bg-gray-50 opacity-60"
            : "border-gray-200 bg-white hover:border-blue-400 hover:shadow-md active:scale-[0.98]"
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium text-blue-500 uppercase">B</span>
              <h2 className="text-lg font-bold mt-1">{pair.product_b.name}</h2>
              <p className="text-sm text-gray-500 mt-1">{pair.product_b.tagline}</p>
            </div>
            <span className="text-sm text-gray-400 whitespace-nowrap ml-3">★ {pair.product_b.stars_at_fetch.toLocaleString()}</span>
          </div>
        </button>
      </div>

      {alreadyPredicted && (
        <p className="text-center text-green-600 text-sm mt-4">
          予測を記録しました。結果は {new Date(pair.judge_after).toLocaleDateString("ja-JP")} に判定されます。
          {!isLast && " 次のペアへ..."}
        </p>
      )}

      <footer className="text-center text-xs text-gray-300 mt-12 pb-6">
        判定日まで30日 · GitHub Stars増加率で自動判定
      </footer>
    </main>
  );
}
