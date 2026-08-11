import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/**
 * GET /api/results?user_id=xxx
 * 
 * 判定済みペアと自分の正誤を返す。
 * 30日経過してjudge-pairs.tsが処理したものが自動で出る。
 */
export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const userId = req.nextUrl.searchParams.get("user_id");

  const { data: pairs, error } = await supabase
    .from("pairs")
    .select(`
      id,
      created_at,
      judged_at,
      a_growth_pct,
      b_growth_pct,
      winner,
      product_a:products!pairs_product_a_id_fkey(id, name, github_url),
      product_b:products!pairs_product_b_id_fkey(id, name, github_url),
      ai_predictions(pick, is_correct)
    `)
    .eq("status", "judged")
    .order("judged_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ユーザーの予測を結合
  let userPredictions: Record<string, any> = {};
  if (userId) {
    const { data: preds } = await supabase
      .from("predictions")
      .select("pair_id, pick, is_correct")
      .eq("user_id", userId);

    (preds || []).forEach((p) => {
      userPredictions[p.pair_id] = p;
    });
  }

  const results = (pairs || []).map((pair) => ({
    ...pair,
    my_prediction: userPredictions[pair.id] || null,
  }));

  return NextResponse.json({ results });
}
