"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";

interface Stats {
  user: { total_predictions: number; judged_count: number; correct_count: number; accuracy_pct: number };
  ai: { total_predictions: number; judged_count: number; correct_count: number; accuracy_pct: number };
  recent: any[];
}

export default function HistoryPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = (session?.user as any)?.id;
    if (!userId) { setLoading(false); return; }

    fetch(`/api/stats?user_id=${userId}`)
      .then((r) => r.json())
      .then((d) => setStats(d))
      .finally(() => setLoading(false));
  }, [session]);

  const u = stats?.user;
  const ai = stats?.ai;
  const beating = u && ai && u.accuracy_pct > ai.accuracy_pct;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">
          <a href="/" className="hover:text-blue-600">AI Predict</a>
        </h1>
        <div className="flex gap-4 text-sm">
          <a href="/results" className="text-gray-500 hover:text-gray-900">結果</a>
          <span className="text-gray-900 font-medium">履歴</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        <h2 className="text-xl font-bold mb-4">あなたの目利き履歴</h2>

        {loading && <p className="text-gray-500">Loading...</p>}

        {!loading && !session && (
          <div className="bg-white rounded-2xl border p-6 text-center">
            <div className="text-3xl mb-2">🔒</div>
            <p className="text-gray-700 font-medium mb-1">ログインすると履歴が表示されます</p>
            <p className="text-sm text-gray-400 mb-4">
              予想数・正解率・AIとの比較など、あなたの目利き成績をここで確認できます。
            </p>
            <button
              onClick={() => signIn("google")}
              className="bg-blue-600 text-white text-sm py-2.5 px-5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Googleでログイン
            </button>
          </div>
        )}

        {!loading && stats && u && u.total_predictions === 0 && (
          <div className="bg-white rounded-2xl border p-6 text-center">
            <div className="text-3xl mb-2">🔮</div>
            <p className="text-gray-700 font-medium mb-1">まだ予想がありません</p>
            <p className="text-sm text-gray-400">
              トップページでA/Bを予想すると、ここに予想数・正解率・AIとの比較が記録されます。
            </p>
            <a href="/" className="inline-block mt-4 text-sm text-blue-600 font-medium hover:underline">
              予想する →
            </a>
          </div>
        )}

        {!loading && stats && u && u.total_predictions > 0 && (
          <>
            {/* Stats comparison */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white rounded-xl border p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">あなた</p>
                <p className="text-3xl font-bold text-blue-600">{u?.accuracy_pct || 0}%</p>
                <p className="text-xs text-gray-400 mt-1">{u?.correct_count || 0} / {u?.judged_count || 0} 正解</p>
              </div>
              <div className="bg-white rounded-xl border p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">AI基準</p>
                <p className="text-3xl font-bold text-gray-600">{ai?.accuracy_pct || 0}%</p>
                <p className="text-xs text-gray-400 mt-1">{ai?.correct_count || 0} / {ai?.judged_count || 0} 正解</p>
              </div>
            </div>

            {/* Status */}
            {u && u.judged_count > 0 && (
              <div className={`rounded-xl p-4 mb-6 text-center text-sm font-medium ${
                beating ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
              }`}>
                {beating ? "🎯 AIを上回っています！" : "AIの方が上です。予想を続けましょう。"}
              </div>
            )}

            {/* Summary */}
            <div className="bg-white rounded-xl border p-4 mb-6">
              <div className="flex justify-between text-sm py-2 border-b">
                <span className="text-gray-500">予想数</span>
                <span className="font-medium">{u?.total_predictions || 0}</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b">
                <span className="text-gray-500">確定数</span>
                <span className="font-medium">{u?.judged_count || 0}</span>
              </div>
              <div className="flex justify-between text-sm py-2">
                <span className="text-gray-500">正解率</span>
                <span className="font-medium">{u?.accuracy_pct || 0}%</span>
              </div>
            </div>

            {/* Recent */}
            {stats.recent && stats.recent.length > 0 && (
              <>
                <h3 className="text-sm font-bold text-gray-700 mb-2">最近の予想</h3>
                {stats.recent.map((r: any, i: number) => (
                  <div key={i} className="bg-white rounded-lg border p-3 mb-2 text-sm">
                    <div className="flex justify-between">
                      <span>
                        {r.pairs?.product_a?.name} vs {r.pairs?.product_b?.name}
                      </span>
                      <span className={
                        r.is_correct === null ? "text-gray-400"
                        : r.is_correct ? "text-green-600" : "text-red-500"
                      }>
                        {r.is_correct === null ? "判定待ち" : r.is_correct ? "✓ 正解" : "✗ 不正解"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      予想: {r.pick.toUpperCase()} · {new Date(r.created_at).toLocaleDateString("ja-JP")}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
