/**
 * create-pairs.ts
 * 
 * 日次バッチ: 未ペアの製品からペアを生成 + AI基準予測
 * fetch-products.ts の後に実行
 * 
 * ペアリング条件:
 *   - 掲載日が3日以内
 *   - まだペアに入っていない製品
 *   - ランダムに2製品をマッチ
 * 
 * AI予測（v1 ヒューリスティクス）:
 *   - Stars数（正規化）    weight: 0.25
 *   - リポジトリ年齢の若さ  weight: 0.20
 *   - 直近7日Stars増加      weight: 0.35
 *   - コントリビューター数   weight: 0.20
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const JUDGE_DAYS = 30; // 判定までの日数

// ============================================================
// ペアリング対象の製品を取得
// ============================================================
async function getUnpairedProducts() {
  // 直近3日に掲載され、まだどのペアにも入っていない製品
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .gte("ph_launched_at", threeDaysAgo.toISOString().split("T")[0])
    .order("ph_launched_at", { ascending: false });

  if (error) throw error;
  if (!products) return [];

  // 既にペアに入っている製品IDを取得
  const { data: pairs } = await supabase
    .from("pairs")
    .select("product_a_id, product_b_id");

  const pairedIds = new Set<string>();
  (pairs || []).forEach((p) => {
    pairedIds.add(p.product_a_id);
    pairedIds.add(p.product_b_id);
  });

  // NG1修正: Stars 20未満は対象外（小母数の異常増加率を排除）
  const MIN_STARS = 20;
  return products.filter((p) => !pairedIds.has(p.id) && p.stars_at_fetch >= MIN_STARS);
}

// ============================================================
// AI予測スコア計算（v1 ヒューリスティクス）
// ============================================================
interface Product {
  id: string;
  name: string;
  stars_at_fetch: number;
  stars_7d_ago: number | null;
  contributors: number | null;
  repo_created_at: string | null;
}

// NG2修正: star_snapshotsから利用可能な最長デルタを取得
async function getStarsDelta(productId: string, currentStars: number): Promise<{ delta: number; days: number }> {
  // 7日前 → 3日前 → 1日前の順で探す（利用可能な最長窓）
  for (const daysBack of [7, 3, 1]) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysBack);

    const { data } = await supabase
      .from("star_snapshots")
      .select("stars")
      .eq("product_id", productId)
      .lte("captured_at", targetDate.toISOString().split("T")[0])
      .order("captured_at", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      return { delta: currentStars - data.stars, days: daysBack };
    }
  }
  // スナップショットがまだない場合（初日）
  return { delta: 0, days: 0 };
}

async function calcAIScore(product: Product): Promise<{ score: number; breakdown: Record<string, number> }> {
  const now = Date.now();

  // 1. Stars数（log scale, 0-1正規化）
  const starsScore = Math.min(Math.log10(Math.max(product.stars_at_fetch, 1) + 1) / 5, 1);

  // 2. リポジトリの若さ（新しいほど高い）
  let ageScore = 0.5;
  if (product.repo_created_at) {
    const ageDays = (now - new Date(product.repo_created_at).getTime()) / (1000 * 60 * 60 * 24);
    ageScore = Math.max(0, 1 - ageDays / 365);
  }

  // 3. NG2修正: star_snapshotsから利用可能なデルタを取得
  const { delta, days } = await getStarsDelta(product.id, product.stars_at_fetch);
  let momentumScore = 0;
  if (days > 0) {
    // 日割りに正規化して比較可能にする
    const dailyIncrease = delta / days;
    momentumScore = Math.min(Math.log10(Math.max(dailyIncrease, 0) + 1) / 2, 1);
  }

  // 4. コントリビューター数
  const contribScore = Math.min(Math.log10(Math.max(product.contributors || 0, 1) + 1) / 3, 1);

  const score =
    starsScore * 0.25 +
    ageScore * 0.20 +
    momentumScore * 0.35 +
    contribScore * 0.20;

  return {
    score,
    breakdown: {
      stars: starsScore,
      age: ageScore,
      momentum: momentumScore,
      momentum_days: days,
      contributors: contribScore,
    },
  };
}

// ============================================================
// Main: ペア作成 + AI予測
// ============================================================
async function main() {
  console.log("=== Create Pairs + AI Predictions ===");

  const unpaired = await getUnpairedProducts();
  console.log(`Unpaired products: ${unpaired.length}`);

  if (unpaired.length < 2) {
    console.log("Not enough products to create pairs. Done.");
    return;
  }

  // シャッフル（Fisher-Yates）
  for (let i = unpaired.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unpaired[i], unpaired[j]] = [unpaired[j], unpaired[i]];
  }

  // 2つずつペアにする
  const pairsToCreate = Math.floor(unpaired.length / 2);
  let created = 0;

  for (let i = 0; i < pairsToCreate; i++) {
    const a = unpaired[i * 2];
    const b = unpaired[i * 2 + 1];

    const judgeAfter = new Date();
    judgeAfter.setDate(judgeAfter.getDate() + JUDGE_DAYS);

    // ペア作成
    const { data: pair, error: pairErr } = await supabase
      .from("pairs")
      .insert({
        product_a_id: a.id,
        product_b_id: b.id,
        a_stars_start: a.stars_at_fetch,
        b_stars_start: b.stars_at_fetch,
        judge_after: judgeAfter.toISOString().split("T")[0],
      })
      .select()
      .single();

    if (pairErr) {
      console.error(`  ERROR creating pair: ${a.name} vs ${b.name}`, pairErr.message);
      continue;
    }

    // AI予測（NG2: スナップショットベースで非同期）
    const scoreA = await calcAIScore(a);
    const scoreB = await calcAIScore(b);
    const aiPick = scoreA.score >= scoreB.score ? "a" : "b";

    const { error: aiErr } = await supabase.from("ai_predictions").insert({
      pair_id: pair.id,
      pick: aiPick,
      score_a: scoreA.score,
      score_b: scoreB.score,
      reasoning: { a: scoreA.breakdown, b: scoreB.breakdown },
    });

    if (aiErr) {
      console.error(`  ERROR saving AI prediction:`, aiErr.message);
    }

    console.log(`  PAIR: ${a.name} vs ${b.name} → AI picks ${aiPick.toUpperCase()} (${scoreA.score.toFixed(3)} vs ${scoreB.score.toFixed(3)})`);
    created++;
  }

  console.log(`\nPairs created: ${created}`);
  if (unpaired.length % 2 === 1) {
    console.log(`  1 product left unpaired (will retry tomorrow)`);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
