/**
 * notify-results.ts
 *
 * 週次バッチ: 直近7日間に判定された（30日経過した）ペアの結果を
 * 予測したユーザーにメールで通知する。
 *
 * judge-pairs.ts が pairs.status を 'judged' に更新した後に実行する想定。
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "AI Predict <onboarding@resend.dev>";
const SITE_URL = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");

interface JudgedPair {
  id: string;
  judged_at: string;
  a_growth_pct: number;
  b_growth_pct: number;
  winner: "a" | "b" | "both";
  product_a: { name: string };
  product_b: { name: string };
}

interface Prediction {
  pair_id: string;
  user_id: string;
  pick: "a" | "b";
  is_correct: boolean | null;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function buildEmailHtml(
  displayName: string | null,
  rows: { pair: JudgedPair; pred: Prediction }[],
  correctCount: number
) {
  const greeting = displayName ? `${escapeHtml(displayName)}さん` : "こんにちは";
  const itemsHtml = rows
    .map(({ pair, pred }) => {
      const isCorrect = pair.winner === "both" || pred.is_correct;
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
            <div style="font-size:14px;color:#111827;margin-bottom:4px;">
              <strong>${escapeHtml(pair.product_a.name)}</strong> (${pair.a_growth_pct?.toFixed(1)}%)
              <span style="color:#9ca3af;"> vs </span>
              <strong>${escapeHtml(pair.product_b.name)}</strong> (${pair.b_growth_pct?.toFixed(1)}%)
            </div>
            <div style="font-size:13px;color:${isCorrect ? "#16a34a" : "#dc2626"};">
              あなたの予測: ${pred.pick.toUpperCase()} ${isCorrect ? "✓ 正解" : "✗ 不正解"}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h1 style="font-size:20px;color:#111827;">今週の予測結果</h1>
      <p style="font-size:14px;color:#374151;">
        ${greeting}、今週判定された ${rows.length} 件のうち ${correctCount} 件正解でした。
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        ${itemsHtml}
      </table>
      <a href="${SITE_URL}/results" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;">
        結果ページを見る
      </a>
      <p style="font-size:12px;color:#9ca3af;margin-top:24px;">AI Predict - 30日後にGitHub Starsで答え合わせ</p>
    </div>
  `;
}

async function main() {
  console.log("=== Notify Results (weekly) ===");

  if (!RESEND_API_KEY) {
    console.log("RESEND_API_KEY not set. Skipping email send (dry run only).");
  }
  const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: pairs, error: pairsError } = await supabase
    .from("pairs")
    .select(`
      id,
      judged_at,
      a_growth_pct,
      b_growth_pct,
      winner,
      product_a:products!pairs_product_a_id_fkey(name),
      product_b:products!pairs_product_b_id_fkey(name)
    `)
    .eq("status", "judged")
    .gte("judged_at", sevenDaysAgo);

  if (pairsError) throw pairsError;

  if (!pairs || pairs.length === 0) {
    console.log("No pairs judged in the last 7 days. Nothing to notify.");
    return;
  }

  const judgedPairs = pairs as unknown as JudgedPair[];
  const pairIds = judgedPairs.map((p) => p.id);

  const { data: predictions, error: predError } = await supabase
    .from("predictions")
    .select("pair_id, user_id, pick, is_correct")
    .in("pair_id", pairIds);

  if (predError) throw predError;
  if (!predictions || predictions.length === 0) {
    console.log("No predictions for this week's judged pairs.");
    return;
  }

  const byUser = new Map<string, Prediction[]>();
  for (const pred of predictions as Prediction[]) {
    if (!byUser.has(pred.user_id)) byUser.set(pred.user_id, []);
    byUser.get(pred.user_id)!.push(pred);
  }

  const userIds = [...byUser.keys()];
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email, display_name")
    .in("id", userIds);

  if (usersError) throw usersError;

  console.log(`Judged pairs (7d): ${judgedPairs.length} / Users to notify: ${(users || []).length}`);

  for (const user of users || []) {
    const preds = byUser.get(user.id) || [];
    if (!user.email || preds.length === 0) continue;

    const rows = preds
      .map((pred) => {
        const pair = judgedPairs.find((p) => p.id === pred.pair_id);
        return pair ? { pair, pred } : null;
      })
      .filter((r): r is { pair: JudgedPair; pred: Prediction } => r !== null);

    if (rows.length === 0) continue;

    const correctCount = rows.filter((r) => r.pair.winner === "both" || r.pred.is_correct).length;
    const html = buildEmailHtml(user.display_name, rows, correctCount);
    const subject = `【AI Predict】今週の予測結果 ${correctCount}/${rows.length}件正解`;

    if (!resend) {
      console.log(`  [DRY RUN] would send to ${user.email}: ${subject}`);
      continue;
    }

    try {
      await resend.emails.send({ from: EMAIL_FROM, to: user.email, subject, html });
      console.log(`  SENT: ${user.email} (${rows.length} pairs, ${correctCount} correct)`);
    } catch (e) {
      console.error(`  FAILED: ${user.email}`, e);
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
