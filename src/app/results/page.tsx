"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface Result {
  id: string;
  judged_at: string;
  a_growth_pct: number;
  b_growth_pct: number;
  winner: string;
  product_a: { name: string; github_url?: string };
  product_b: { name: string; github_url?: string };
  ai_predictions: { pick: string; is_correct: boolean }[];
  my_prediction: { pick: string; is_correct: boolean } | null;
}

export default function ResultsPage() {
  const { data: session } = useSession();
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = (session?.user as any)?.id || "";
    fetch(`/api/results?user_id=${userId}`)
      .then((r) => r.json())
      .then((d) => setResults(d.results || []))
      .finally(() => setLoading(false));
  }, [session]);

  return (
    <main className="min-h-[100dvh] bg-base">
      <header className="sticky top-0 z-10 bg-base/90 backdrop-blur border-b border-line px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">
          <a href="/" className="text-content hover:text-accent transition-colors">
            AI Predict
          </a>
        </h1>
        <div className="flex gap-4 text-sm">
          <span className="text-content font-medium">結果</span>
          <a href="/history" className="text-muted hover:text-content transition-colors">
            履歴
          </a>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        <h2 className="text-xl font-bold mb-4 text-content">判定済みの結果</h2>

        {loading && <p className="text-faint text-sm">読み込み中...</p>}

        {!loading && results.length === 0 && (
          <div className="bg-card border border-line rounded-2xl p-6 text-center">
            <div className="text-3xl mb-2">⏳</div>
            <p className="text-content font-medium mb-1">まだ判定済みの結果はありません</p>
            <p className="text-sm text-muted">
              トップページでA/Bを予想すると、30日後にGitHub Starsの増加率で自動判定され、ここに結果が表示されます。
            </p>
            <a
              href="/"
              className="inline-block mt-4 text-sm text-accent font-medium hover:underline"
            >
              予想する →
            </a>
          </div>
        )}

        {results.map((r) => {
          const aWon = r.winner === "a" || r.winner === "both";
          const bWon = r.winner === "b" || r.winner === "both";
          return (
            <div key={r.id} className="bg-card border border-line rounded-xl p-4 mb-3">
              <div className="text-xs text-faint mb-3">
                {new Date(r.judged_at).toLocaleDateString("ja-JP")} 判定
              </div>

              <div className="space-y-2 mb-3">
                <GrowthRow
                  label="A"
                  name={r.product_a.name}
                  githubUrl={r.product_a.github_url}
                  pct={r.a_growth_pct}
                  won={aWon}
                />
                <GrowthRow
                  label="B"
                  name={r.product_b.name}
                  githubUrl={r.product_b.github_url}
                  pct={r.b_growth_pct}
                  won={bWon}
                />
              </div>

              <div className="flex gap-2 text-xs pt-3 border-t border-line">
                <VerdictChip
                  who="あなた"
                  pick={r.my_prediction?.pick}
                  isCorrect={r.my_prediction?.is_correct}
                />
                <VerdictChip
                  who="AI"
                  pick={r.ai_predictions?.[0]?.pick}
                  isCorrect={r.ai_predictions?.[0]?.is_correct}
                />
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

function GrowthRow({
  label,
  name,
  githubUrl,
  pct,
  won,
}: {
  label: "A" | "B";
  name: string;
  githubUrl?: string;
  pct: number;
  won: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`shrink-0 text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center ${
            won ? "bg-success text-white" : "bg-steel text-muted"
          }`}
        >
          {label}
        </span>
        <span
          className={`text-sm truncate ${won ? "text-content font-medium" : "text-muted"}`}
        >
          {name}
        </span>
        {githubUrl && (
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[11px] text-muted hover:text-accent transition-colors"
          >
            ↗
          </a>
        )}
      </div>
      <span
        className={`text-sm font-bold whitespace-nowrap ${won ? "text-success" : "text-faint"}`}
      >
        +{pct?.toFixed(1)}%
      </span>
    </div>
  );
}

function VerdictChip({
  who,
  pick,
  isCorrect,
}: {
  who: string;
  pick?: string;
  isCorrect?: boolean;
}) {
  if (!pick) {
    return (
      <span className="px-2 py-1 rounded bg-base text-faint">
        {who}: 予想なし
      </span>
    );
  }

  return (
    <span
      className={`px-2 py-1 rounded ${
        isCorrect ? "bg-success-bg text-success" : "bg-base text-danger"
      }`}
    >
      {who}: {pick.toUpperCase()} {isCorrect ? "✓ 正解" : "✗ 不正解"}
    </span>
  );
}
