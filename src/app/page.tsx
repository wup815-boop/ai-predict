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

type FeedbackStatus = "idle" | "saving" | "saved" | "error";

export default function Home() {
  const { data: session, status } = useSession();
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalActive, setTotalActive] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedPick, setSelectedPick] = useState<"a" | "b" | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>("idle");

  useEffect(() => {
    if (status === "loading") return;

    const userId = (session?.user as any)?.id;
    const url = userId ? `/api/pairs?user_id=${userId}` : "/api/pairs";

    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        const fetched = d.pairs || [];
        setPairs(fetched);
        setTotalCount(fetched.length);
        setTotalActive(d.total_active ?? fetched.length);
        setAnsweredCount(0);
      })
      .finally(() => setLoading(false));
  }, [status, session]);

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-gray-400 text-sm">読み込み中...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center bg-gray-50 px-4 py-10">
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold mb-2">AI Predict</h1>
          <p className="text-gray-500 text-sm mb-6">
            新しいAIプロダクトの成長を予測して目利き履歴を残す
          </p>

          <ul className="text-left text-sm text-gray-600 space-y-2.5 mb-6">
            <li className="flex items-center gap-2.5">
              <span className="text-base">👆</span>
              1タップで予測
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-base">📅</span>
              30日後に自動判定
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-base">🤖</span>
              AIと正解率を比較
            </li>
          </ul>

          <button
            onClick={() => signIn("google")}
            className="w-full bg-blue-600 text-white py-3.5 px-4 rounded-xl font-medium hover:bg-blue-700 active:scale-[0.98] transition-all"
          >
            Googleでログイン
          </button>

          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4">
            ※ 現在テスト版のため、ログインできない場合はお問い合わせください
          </p>
        </div>
      </main>
    );
  }

  const pair = pairs[0];

  async function handlePick(pick: "a" | "b") {
    if (!pair || !session?.user || selectedPick) return;
    const userId = (session.user as any).id;

    // 即時フィードバック: ネットワーク応答を待たずに選択状態を反映する
    setSelectedPick(pick);
    setFeedbackStatus("saving");

    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pair_id: pair.id, pick, user_id: userId }),
      });

      if (!res.ok && res.status !== 409) {
        throw new Error("failed");
      }

      setFeedbackStatus("saved");
      setTimeout(() => {
        setPairs((prev) => prev.filter((p) => p.id !== pair.id));
        setAnsweredCount((c) => c + 1);
        setSelectedPick(null);
        setFeedbackStatus("idle");
      }, 900);
    } catch {
      setFeedbackStatus("error");
      setTimeout(() => {
        setSelectedPick(null);
        setFeedbackStatus("idle");
      }, 1500);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-gray-400 text-sm">読み込み中...</p>
      </main>
    );
  }

  if (pairs.length === 0) {
    return (
      <main className="min-h-[100dvh] bg-gray-50">
        <SiteHeader />
        <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h1 className="text-xl font-bold mb-2">
            {totalActive > 0 ? "すべて予測済みです" : "本日のペアはまだありません"}
          </h1>
          <p className="text-sm text-gray-400">
            {totalActive > 0
              ? "結果は判定日に「結果」ページで確認できます。"
              : "毎日15:00頃に新しいペアが登場します"}
          </p>
        </div>
      </main>
    );
  }

  const progressPct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;
  const remaining = pairs.length;

  return (
    <main className="min-h-[100dvh] bg-gray-50 pb-10">
      <SiteHeader />

      {/* Progress bar */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
          <span>
            {answeredCount + 1} / {totalCount}
          </span>
          <span>残り {remaining} 件</span>
        </div>
        <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <p className="text-center text-gray-700 text-sm sm:text-base mt-6 mb-4 px-4">
        30日後、どちらのGitHub Starsがより伸びる?
      </p>

      <div className="max-w-lg mx-auto px-4 flex flex-col gap-3">
        <ProductCard
          label="A"
          product={pair.product_a}
          state={cardState(selectedPick, "a")}
          onClick={() => handlePick("a")}
        />

        <div className="flex items-center justify-center py-0.5">
          <span className="text-xs font-bold text-gray-400 bg-gray-100 border border-gray-200 rounded-full w-8 h-8 flex items-center justify-center">
            VS
          </span>
        </div>

        <ProductCard
          label="B"
          product={pair.product_b}
          state={cardState(selectedPick, "b")}
          onClick={() => handlePick("b")}
        />
      </div>

      <div className="max-w-lg mx-auto px-4">
        <FeedbackBanner status={feedbackStatus} judgeAfter={pair.judge_after} />
      </div>

      <footer className="text-center text-xs text-gray-300 mt-10 pb-6 px-4">
        判定日まで30日 · GitHub Stars増加率で自動判定
      </footer>
    </main>
  );
}

function cardState(
  selectedPick: "a" | "b" | null,
  side: "a" | "b"
): "idle" | "selected" | "faded" {
  if (!selectedPick) return "idle";
  return selectedPick === side ? "selected" : "faded";
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
      <h1 className="text-lg font-bold">AI Predict</h1>
      <div className="flex items-center gap-3 sm:gap-4 text-sm">
        <a href="/results" className="text-gray-500 hover:text-gray-900">
          結果
        </a>
        <a href="/history" className="text-gray-500 hover:text-gray-900">
          履歴
        </a>
        <button onClick={() => signOut()} className="text-gray-400 hover:text-gray-600 text-xs">
          ログアウト
        </button>
      </div>
    </header>
  );
}

function ProductCard({
  label,
  product,
  state,
  onClick,
}: {
  label: "A" | "B";
  product: Product;
  state: "idle" | "selected" | "faded";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={state !== "idle"}
      className={`relative w-full text-left p-4 sm:p-5 rounded-2xl border-2 transition-all duration-200 ${
        state === "selected"
          ? "border-green-500 bg-green-50 shadow-md"
          : state === "faded"
          ? "border-gray-200 bg-gray-50 opacity-50"
          : "border-gray-200 bg-white hover:border-blue-400 hover:shadow-md active:scale-[0.98]"
      }`}
    >
      {state === "selected" && (
        <span className="absolute top-3 right-3 sm:top-4 sm:right-4 w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-bold">
          ✓
        </span>
      )}
      <div className="flex items-start justify-between gap-3 pr-6">
        <div className="min-w-0">
          <span
            className={`text-xs font-medium uppercase ${
              state === "selected" ? "text-green-600" : "text-blue-500"
            }`}
          >
            {label}
          </span>
          <h2 className="text-base sm:text-lg font-bold mt-1 truncate">{product.name}</h2>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.tagline}</p>
        </div>
        <span className="text-xs sm:text-sm text-gray-400 whitespace-nowrap shrink-0">
          ★ {product.stars_at_fetch.toLocaleString()}
        </span>
      </div>
    </button>
  );
}

function FeedbackBanner({
  status,
  judgeAfter,
}: {
  status: FeedbackStatus;
  judgeAfter: string;
}) {
  if (status === "idle") return null;

  if (status === "error") {
    return (
      <p className="text-center text-red-500 text-sm mt-4">
        保存に失敗しました。もう一度お試しください。
      </p>
    );
  }

  return (
    <p className="text-center text-green-600 text-sm mt-4 flex items-center justify-center gap-1.5">
      {status === "saving" ? (
        <>
          <span className="inline-block w-3.5 h-3.5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          選択を記録中...
        </>
      ) : (
        <>予測を記録しました。結果は {new Date(judgeAfter).toLocaleDateString("ja-JP")} に判定されます。</>
      )}
    </p>
  );
}
