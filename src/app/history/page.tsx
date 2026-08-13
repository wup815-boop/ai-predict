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
    <main className="min-h-[100dvh] bg-base">
      <header className="sticky top-0 z-10 bg-base/90 backdrop-blur border-b border-line px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">
          <a href="/" className="text-content hover:text-accent transition-colors">
            AI Predict
          </a>
        </h1>
        <div className="flex gap-4 text-sm">
          <a href="/results" className="text-muted hover:text-content transition-colors">
            結果
          </a>
          <span className="text-content font-medium">履歴</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        <h2 className="text-xl font-bold mb-4 text-content">あなたの目利き履歴</h2>

        {loading && <p className="text-faint text-sm">読み込み中...</p>}

        {!loading && !session && (
          <div className="bg-card border border-line rounded-2xl p-6 text-center">
            <div className="text-3xl mb-2">🔒</div>
            <p className="text-content font-medium mb-1">ログインすると履歴が表示されます</p>
            <p className="text-sm text-muted mb-4">
              予想数・正解率・AIとの比較など、あなたの目利き成績をここで確認できます。
            </p>
            <button
              onClick={() => signIn("google")}
              className="bg-accent text-white text-sm py-2.5 px-5 rounded-lg font-medium hover:bg-accent-hover transition-colors"
            >
              Googleでログイン
            </button>
          </div>
        )}

        {!loading && stats && u && u.total_predictions === 0 && (
          <div className="bg-card border border-line rounded-2xl p-6 text-center">
            <div className="text-3xl mb-2">🔮</div>
            <p className="text-content font-medium mb-1">まだ予想がありません</p>
            <p className="text-sm text-muted">
              トップページでA/Bを予想すると、ここに予想数・正解率・AIとの比較が記録されます。
            </p>
            <a
              href="/"
              className="inline-block mt-4 text-sm text-accent font-medium hover:underline"
            >
              予想する →
            </a>
          </div>
        )}

        {!loading && stats && u && u.total_predictions > 0 && (
          <>
            {/* あなた vs AI */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <ScoreCard
                label="あなた"
                pct={u?.accuracy_pct || 0}
                correct={u?.correct_count || 0}
                judged={u?.judged_count || 0}
                highlight
              />
              <ScoreCard
                label="AI基準"
                pct={ai?.accuracy_pct || 0}
                correct={ai?.correct_count || 0}
                judged={ai?.judged_count || 0}
              />
            </div>

            {/* ステータスバー */}
            {u && u.judged_count > 0 && (
              <StatusBar
                beating={!!beating}
                userPct={u.accuracy_pct || 0}
                aiPct={ai?.accuracy_pct || 0}
              />
            )}

            {/* 詳細 */}
            <div className="bg-card border border-line rounded-xl p-4 mb-6">
              <DetailRow label="予想数" value={u?.total_predictions || 0} />
              <DetailRow label="確定数" value={u?.judged_count || 0} />
              <DetailRow label="正解率" value={`${u?.accuracy_pct || 0}%`} last />
            </div>

            {/* 最近の予想 */}
            {stats.recent && stats.recent.length > 0 && (
              <>
                <h3 className="text-sm font-bold text-muted mb-2">最近の予想</h3>
                {stats.recent.map((r: any, i: number) => (
                  <div
                    key={i}
                    className="bg-card border border-line rounded-lg p-3 mb-2 text-sm"
                  >
                    <div className="flex justify-between gap-3">
                      <span className="text-content truncate">
                        {r.pairs?.product_a?.name} vs {r.pairs?.product_b?.name}
                      </span>
                      <span
                        className={`shrink-0 ${
                          r.is_correct === null
                            ? "text-faint"
                            : r.is_correct
                            ? "text-success"
                            : "text-danger"
                        }`}
                      >
                        {r.is_correct === null ? "判定待ち" : r.is_correct ? "✓ 正解" : "✗ 不正解"}
                      </span>
                    </div>
                    <div className="text-xs text-faint mt-1">
                      予想: {r.pick.toUpperCase()} ·{" "}
                      {new Date(r.created_at).toLocaleDateString("ja-JP")}
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

function ScoreCard({
  label,
  pct,
  correct,
  judged,
  highlight,
}: {
  label: string;
  pct: number;
  correct: number;
  judged: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 text-center ${
        highlight ? "bg-card border-accent" : "bg-card border-line"
      }`}
    >
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className={`text-4xl font-bold ${highlight ? "text-accent" : "text-muted"}`}>
        {pct}
        <span className="text-xl">%</span>
      </p>
      <p className="text-xs text-faint mt-1">
        {correct} / {judged} 正解
      </p>
    </div>
  );
}

function StatusBar({
  beating,
  userPct,
  aiPct,
}: {
  beating: boolean;
  userPct: number;
  aiPct: number;
}) {
  const total = userPct + aiPct;
  const userShare = total > 0 ? (userPct / total) * 100 : 50;

  return (
    <div className="bg-card border border-line rounded-xl p-4 mb-6">
      <div className="h-2 w-full bg-steel rounded-full overflow-hidden flex mb-3">
        <div
          className="h-full bg-accent transition-all duration-500"
          style={{ width: `${userShare}%` }}
        />
      </div>
      <p
        className={`text-center text-sm font-medium ${
          beating ? "text-success" : "text-muted"
        }`}
      >
        {beating ? "🎯 AIを上回っています！" : "AIの方が上です。予想を続けましょう。"}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string | number;
  last?: boolean;
}) {
  return (
    <div
      className={`flex justify-between text-sm py-2 ${last ? "" : "border-b border-line"}`}
    >
      <span className="text-muted">{label}</span>
      <span className="font-medium text-content">{value}</span>
    </div>
  );
}
