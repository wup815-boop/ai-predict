"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface Result {
  id: string;
  judged_at: string;
  a_growth_pct: number;
  b_growth_pct: number;
  winner: string;
  product_a: { name: string };
  product_b: { name: string };
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
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">
          <a href="/" className="hover:text-blue-600">AI Predict</a>
        </h1>
        <div className="flex gap-4 text-sm">
          <span className="text-gray-900 font-medium">結果</span>
          <a href="/history" className="text-gray-500 hover:text-gray-900">履歴</a>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        <h2 className="text-xl font-bold mb-4">判定済みの結果</h2>

        {loading && <p className="text-gray-500">Loading...</p>}

        {!loading && results.length === 0 && (
          <div className="bg-white rounded-2xl border p-6 text-center">
            <div className="text-3xl mb-2">⏳</div>
            <p className="text-gray-700 font-medium mb-1">まだ判定済みの結果はありません</p>
            <p className="text-sm text-gray-400">
              トップページでA/Bを予測すると、30日後にGitHub Starsの増加率で自動判定され、ここに結果が表示されます。
            </p>
            <a href="/" className="inline-block mt-4 text-sm text-blue-600 font-medium hover:underline">
              予測する →
            </a>
          </div>
        )}

        {results.map((r) => (
          <div key={r.id} className="bg-white rounded-xl border p-4 mb-3">
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm text-gray-400">
                {new Date(r.judged_at).toLocaleDateString("ja-JP")} 判定
              </div>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <span className={`text-sm font-bold ${r.winner === "a" || r.winner === "both" ? "text-green-600" : "text-gray-400"}`}>
                A: {r.product_a.name} (+{r.a_growth_pct?.toFixed(1)}%)
              </span>
              <span className="text-gray-300">vs</span>
              <span className={`text-sm font-bold ${r.winner === "b" || r.winner === "both" ? "text-green-600" : "text-gray-400"}`}>
                B: {r.product_b.name} (+{r.b_growth_pct?.toFixed(1)}%)
              </span>
            </div>

            <div className="flex gap-4 text-xs">
              {r.my_prediction && (
                <span className={r.my_prediction.is_correct ? "text-green-600" : "text-red-500"}>
                  あなた: {r.my_prediction.pick.toUpperCase()} {r.my_prediction.is_correct ? "✓ 正解" : "✗ 不正解"}
                </span>
              )}
              {r.ai_predictions?.[0] && (
                <span className={r.ai_predictions[0].is_correct ? "text-green-600" : "text-red-500"}>
                  AI: {r.ai_predictions[0].pick.toUpperCase()} {r.ai_predictions[0].is_correct ? "✓" : "✗"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
