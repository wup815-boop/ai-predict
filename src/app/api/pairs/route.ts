import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/**
 * GET /api/pairs?user_id=xxx
 *
 * 今日のアクティブなペアを返す。
 * バッチが作ったペアは自動的にここに出る。
 * 「公開」という手動操作は存在しない。
 * pairsテーブルにstatus='active'で入った時点で公開済み。
 *
 * user_idが渡された場合、そのユーザーが既に予測済みのペアは除外する
 * （リロードしても回答済みペアが再表示されないようにするため）。
 */
export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const userId = req.nextUrl.searchParams.get("user_id");

  const { data: pairs, error } = await supabase
    .from("pairs")
    .select(`
      id,
      created_at,
      judge_after,
      product_a:products!pairs_product_a_id_fkey(
        id, name, tagline, ph_url, github_url, stars_at_fetch
      ),
      product_b:products!pairs_product_b_id_fkey(
        id, name, tagline, ph_url, github_url, stars_at_fetch
      )
    `)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!userId) {
    return NextResponse.json({ pairs, total_active: (pairs ?? []).length });
  }

  const { data: predicted, error: predictedError } = await supabase
    .from("predictions")
    .select("pair_id")
    .eq("user_id", userId);

  if (predictedError) {
    return NextResponse.json({ error: predictedError.message }, { status: 500 });
  }

  const predictedIds = new Set((predicted ?? []).map((p) => p.pair_id));
  const unansweredPairs = (pairs ?? []).filter((p) => !predictedIds.has(p.id));

  return NextResponse.json({ pairs: unansweredPairs, total_active: (pairs ?? []).length });
}
