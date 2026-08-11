import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/**
 * GET /api/pairs
 * 
 * 今日のアクティブなペアを返す。
 * バッチが作ったペアは自動的にここに出る。
 * 「公開」という手動操作は存在しない。
 * pairsテーブルにstatus='active'で入った時点で公開済み。
 */
export async function GET() {
  const supabase = createServerClient();

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

  return NextResponse.json({ pairs });
}
