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

const SAMPLE_PRODUCT_A: Product = {
  id: "sample-a",
  name: "PromptForge",
  tagline: "AIプロンプトをチームで管理・共有できるワークスペース",
  ph_url: "",
  github_url: "",
  stars_at_fetch: 1240,
};

const SAMPLE_PRODUCT_B: Product = {
  id: "sample-b",
  name: "VectorNest",
  tagline: "軽量ベクターDBをエッジで動かす開発者向けツール",
  ph_url: "",
  github_url: "",
  stars_at_fetch: 890,
};

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
      <main className="min-h-[100dvh] bg-base flex items-center justify-center px-4">
        <p className="text-faint text-sm">読み込み中...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-[100dvh] bg-base">
        {/* Hero */}
        <div className="max-w-lg mx-auto px-4 pt-14 pb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3 text-content">AI Predict</h1>
          <p className="text-muted text-base mb-8">
            新しいAIプロダクトの成長を予想して、AIと腕を競う
          </p>
          <button
            onClick={() => signIn("google")}
            className="w-full sm:w-auto sm:px-10 bg-accent text-white py-3.5 px-4 rounded-xl font-medium hover:bg-accent-hover active:scale-[0.98] transition-all"
          >
            Googleでログインして始める
          </button>
          <p className="text-xs text-warn bg-card border border-line rounded-lg px-3 py-2 mt-4 inline-block">
            ※ 現在テスト版のため、ログインできない場合があります
          </p>
        </div>

        {/* How it works */}
        <div className="max-w-lg mx-auto px-4 pb-10">
          <h2 className="text-lg font-bold text-center mb-5 text-content">使い方は3ステップ</h2>
          <div className="space-y-3 mb-12">
            <StepItem
              number={1}
              emoji="👆"
              title="1タップで予想"
              description="毎日届く2つのAIプロダクトのうち、伸びる方をタップするだけ"
            />
            <StepItem
              number={2}
              emoji="📅"
              title="30日後に自動判定"
              description="GitHub Starsの増加率で自動的に勝敗が決まります"
            />
            <StepItem
              number={3}
              emoji="🤖"
              title="AIと正解率を比較"
              description="あなたの予想とAI、どちらが当たるか競います"
            />
          </div>

          {/* Sample preview */}
          <h2 className="text-lg font-bold text-center mb-1 text-content">こんな画面で予想します</h2>
          <p className="text-center text-sm text-faint mb-4">
            30日後、どちらのGitHub Starsがより伸びる?（サンプル）
          </p>
          <div className="flex flex-col gap-3">
            <ProductCard
              label="A"
              product={SAMPLE_PRODUCT_A}
              state="idle"
              onClick={() => signIn("google")}
            />
            <VsBadge />
            <ProductCard
              label="B"
              product={SAMPLE_PRODUCT_B}
              state="idle"
              onClick={() => signIn("google")}
            />
          </div>

          <div className="text-center mt-10">
            <button
              onClick={() => signIn("google")}
              className="w-full sm:w-auto sm:px-10 bg-accent text-white py-3.5 px-4 rounded-xl font-medium hover:bg-accent-hover active:scale-[0.98] transition-all"
            >
              Googleでログインして予想する
            </button>
          </div>
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
      <main className="min-h-[100dvh] bg-base flex items-center justify-center px-4">
        <p className="text-faint text-sm">読み込み中...</p>
      </main>
    );
  }

  if (pairs.length === 0) {
    return (
      <main className="min-h-[100dvh] bg-base">
        <SiteHeader />
        <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h1 className="text-xl font-bold mb-2 text-content">
            {totalActive > 0 ? "すべて予想済みです" : "本日のペアはまだありません"}
          </h1>
          <p className="text-sm text-muted">
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
    <main className="min-h-[100dvh] bg-base pb-10">
      <SiteHeader />

      {/* Progress bar */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="flex items-center justify-between text-xs text-faint mb-1.5">
          <span>
            {answeredCount + 1} / {totalCount}
          </span>
          <span>残り {remaining} 件</span>
        </div>
        <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <p className="text-center text-content text-sm sm:text-base mt-6 mb-4 px-4">
        30日後、どちらのGitHub Starsがより伸びる?
      </p>

      <div className="max-w-lg mx-auto px-4 flex flex-col gap-3">
        <ProductCard
          label="A"
          product={pair.product_a}
          state={cardState(selectedPick, "a")}
          onClick={() => handlePick("a")}
        />

        <VsBadge />

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

      {/* フッター: 仕様の #2C3E50 は区切り線に使用。文字を #2C3E50 にすると
          背景 #0D1B2A に対しコントラスト比1.58となり判読できないため、
          文字色は仕様の「テキスト薄い」#576574 を使う。 */}
      <footer className="max-w-lg mx-auto mt-10 pt-4 pb-6 px-4 border-t border-steel text-center text-xs text-faint">
        判定日まで30日 · GitHub Stars増加率で自動判定
      </footer>
    </main>
  );
}

function VsBadge() {
  return (
    <div className="flex items-center justify-center py-0.5">
      <span className="text-xs font-bold text-muted bg-steel rounded-full w-8 h-8 flex items-center justify-center">
        VS
      </span>
    </div>
  );
}

function StepItem({
  number,
  emoji,
  title,
  description,
}: {
  number: number;
  emoji: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 bg-card border border-line rounded-xl p-4">
      <div className="shrink-0 w-8 h-8 rounded-full bg-accent text-white text-sm font-bold flex items-center justify-center">
        {number}
      </div>
      <div>
        <p className="font-medium text-content flex items-center gap-1.5">
          <span>{emoji}</span>
          {title}
        </p>
        <p className="text-sm text-muted mt-0.5">{description}</p>
      </div>
    </div>
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
    <header className="sticky top-0 z-10 bg-base/90 backdrop-blur border-b border-line px-4 py-3 flex items-center justify-between">
      <h1 className="text-lg font-bold text-content">AI Predict</h1>
      <div className="flex items-center gap-3 sm:gap-4 text-sm">
        <a href="/results" className="text-muted hover:text-content transition-colors">
          結果
        </a>
        <a href="/history" className="text-muted hover:text-content transition-colors">
          履歴
        </a>
        <button
          onClick={() => signOut()}
          className="text-faint hover:text-muted text-xs transition-colors"
        >
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
          ? "border-success bg-success-bg"
          : state === "faded"
          ? "border-line bg-card opacity-40"
          : "border-line bg-card hover:border-accent active:scale-[0.98]"
      }`}
    >
      {state === "selected" && (
        <span className="absolute top-3 right-3 sm:top-4 sm:right-4 w-6 h-6 rounded-full bg-success text-white text-xs flex items-center justify-center font-bold">
          ✓
        </span>
      )}
      <div className="flex items-start justify-between gap-3 pr-6">
        <div className="min-w-0">
          <span
            className={`text-xs font-medium uppercase ${
              state === "selected" ? "text-success" : "text-accent"
            }`}
          >
            {label}
          </span>
          <h2 className="text-base sm:text-lg font-bold mt-1 truncate text-content">
            {product.name}
          </h2>
          <p className="text-sm text-muted mt-1 line-clamp-2">{product.tagline}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-xs sm:text-sm text-faint whitespace-nowrap">
            ★ {product.stars_at_fetch.toLocaleString()}
          </span>
          {product.github_url && (
            <a
              href={product.github_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] text-muted hover:text-accent transition-colors flex items-center gap-0.5"
            >
              GitHub ↗
            </a>
          )}
        </div>
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
      <p className="text-center text-danger text-sm mt-4">
        保存に失敗しました。もう一度お試しください。
      </p>
    );
  }

  return (
    <p className="text-center text-success text-sm mt-4 flex items-center justify-center gap-1.5">
      {status === "saving" ? (
        <>
          <span className="inline-block w-3.5 h-3.5 border-2 border-success border-t-transparent rounded-full animate-spin" />
          選択を記録中...
        </>
      ) : (
        <>予想を記録しました。結果は {new Date(judgeAfter).toLocaleDateString("ja-JP")} に判定されます。</>
      )}
    </p>
  );
}
