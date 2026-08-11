import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/**
 * POST /api/predict
 * body: { pair_id, pick: "a" | "b", user_id }
 * 
 * ユーザーがAかBを選んだときに呼ばれる。
 * これだけが人間の操作。
 */
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { pair_id, pick, user_id } = await req.json();

  if (!pair_id || !pick || !user_id) {
    return NextResponse.json({ error: "pair_id, pick, user_id required" }, { status: 400 });
  }

  if (pick !== "a" && pick !== "b") {
    return NextResponse.json({ error: "pick must be 'a' or 'b'" }, { status: 400 });
  }

  // 重複チェック（1ペア1予測）
  const { data: existing } = await supabase
    .from("predictions")
    .select("id")
    .eq("pair_id", pair_id)
    .eq("user_id", user_id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "already predicted" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("predictions")
    .insert({ pair_id, pick, user_id })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ prediction: data });
}
