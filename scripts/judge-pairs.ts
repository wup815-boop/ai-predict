/**
 * judge-pairs.ts
 * 
 * 日次バッチ: 30日経過ペアの結果判定
 * 
 * 1. judge_after <= today のペアを取得
 * 2. GitHub APIで現在のStars数を取得
 * 3. 増加率を計算して勝者を決定
 * 4. 全予測のis_correctを更新
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const GH_TOKEN = process.env.GITHUB_TOKEN!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// GitHub Stars取得
// ============================================================
async function getStars(owner: string, repo: string): Promise<number | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "ai-predict-service",
  };
  if (GH_TOKEN) headers.Authorization = `Bearer ${GH_TOKEN}`;

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!res.ok) return null;
  const data = await res.json();
  return data.stargazers_count;
}

// ============================================================
// 増加率計算
// ============================================================
function growthPct(start: number, end: number): number {
  if (start === 0) return end > 0 ? 100 : 0;
  return ((end - start) / start) * 100;
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log("=== Judge Pairs ===");
  const today = new Date().toISOString().split("T")[0];

  // 判定対象のペアを取得（products情報も結合）
  const { data: pairs, error } = await supabase
    .from("pairs")
    .select(`
      *,
      product_a:products!pairs_product_a_id_fkey(*),
      product_b:products!pairs_product_b_id_fkey(*)
    `)
    .eq("status", "active")
    .lte("judge_after", today);

  if (error) throw error;
  if (!pairs || pairs.length === 0) {
    console.log("No pairs to judge today.");
    return;
  }

  console.log(`Pairs to judge: ${pairs.length}`);

  for (const pair of pairs) {
    const a = pair.product_a;
    const b = pair.product_b;

    // 現在のStars取得
    const aStarsEnd = await getStars(a.github_owner, a.github_repo);
    const bStarsEnd = await getStars(b.github_owner, b.github_repo);

    if (aStarsEnd === null || bStarsEnd === null) {
      console.log(`  SKIP (GitHub error): ${a.name} vs ${b.name}`);
      // リポジトリ削除等の場合はキャンセル
      await supabase.from("pairs").update({ status: "cancelled" }).eq("id", pair.id);
      continue;
    }

    const aGrowth = growthPct(pair.a_stars_start, aStarsEnd);
    const bGrowth = growthPct(pair.b_stars_start, bStarsEnd);

    let winner: "a" | "b" | "both";
    if (Math.abs(aGrowth - bGrowth) < 0.01) {
      winner = "both"; // 同率
    } else {
      winner = aGrowth > bGrowth ? "a" : "b";
    }

    // ペア結果を更新
    await supabase
      .from("pairs")
      .update({
        status: "judged",
        a_stars_end: aStarsEnd,
        b_stars_end: bStarsEnd,
        a_growth_pct: aGrowth,
        b_growth_pct: bGrowth,
        winner,
        judged_at: new Date().toISOString(),
      })
      .eq("id", pair.id);

    // 利用者予測のis_correctを更新
    const { data: predictions } = await supabase
      .from("predictions")
      .select("id, pick")
      .eq("pair_id", pair.id);

    for (const pred of predictions || []) {
      const isCorrect = winner === "both" || pred.pick === winner;
      await supabase
        .from("predictions")
        .update({ is_correct: isCorrect })
        .eq("id", pred.id);
    }

    // AI予測のis_correctを更新
    const { data: aiPred } = await supabase
      .from("ai_predictions")
      .select("id, pick")
      .eq("pair_id", pair.id)
      .single();

    if (aiPred) {
      const aiCorrect = winner === "both" || aiPred.pick === winner;
      await supabase
        .from("ai_predictions")
        .update({ is_correct: aiCorrect })
        .eq("id", aiPred.id);
    }

    console.log(
      `  JUDGED: ${a.name} (${aGrowth.toFixed(1)}%) vs ${b.name} (${bGrowth.toFixed(1)}%) → Winner: ${winner.toUpperCase()}`
    );

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
