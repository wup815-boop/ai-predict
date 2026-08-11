import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/**
 * GET /api/stats?user_id=xxx
 * 
 * ユーザーの予測履歴サマリー + AI基準との比較
 */
export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const userId = req.nextUrl.searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  // ユーザー成績
  const { data: userStats } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", userId)
    .single();

  // AI成績
  const { data: aiStats } = await supabase
    .from("ai_stats")
    .select("*")
    .single();

  // 直近の予測（最新10件）
  const { data: recent } = await supabase
    .from("predictions")
    .select(`
      pick,
      is_correct,
      created_at,
      pairs(
        product_a:products!pairs_product_a_id_fkey(name),
        product_b:products!pairs_product_b_id_fkey(name),
        winner,
        status
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    user: userStats || { total_predictions: 0, judged_count: 0, correct_count: 0, accuracy_pct: 0 },
    ai: aiStats || { total_predictions: 0, judged_count: 0, correct_count: 0, accuracy_pct: 0 },
    recent: recent || [],
  });
}
