-- AI Product Prediction Service - Database Schema
-- Supabase (PostgreSQL)
-- v1.1 - 2026.08.11
-- Fix: NG1 最低Stars条件, NG2 star_snapshots追加, NG3 KPI定義修正

-- ============================================================
-- 1. Products: Product Huntから取得したAIプロダクト
-- ============================================================
create table products (
  id            uuid primary key default gen_random_uuid(),
  ph_id         text unique not null,          -- Product Hunt ID
  name          text not null,
  tagline       text,
  ph_url        text,
  github_url    text,                          -- GitHubリポジトリURL
  github_owner  text,                          -- e.g. "openai"
  github_repo   text,                          -- e.g. "whisper"
  stars_at_fetch int not null default 0,       -- 取得時のStars数
  contributors  int,                           -- コントリビューター数
  repo_created_at timestamptz,                 -- リポジトリ作成日
  ph_launched_at date not null,                -- Product Hunt掲載日
  fetched_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index idx_products_ph_launched on products(ph_launched_at);
create index idx_products_github on products(github_owner, github_repo);

-- ============================================================
-- 2. Pairs: 2製品のペア（予測対象）
-- ============================================================
create table pairs (
  id            uuid primary key default gen_random_uuid(),
  product_a_id  uuid not null references products(id),
  product_b_id  uuid not null references products(id),
  status        text not null default 'active'
                  check (status in ('active', 'judged', 'cancelled')),
  created_at    timestamptz not null default now(),
  judge_after   date not null,                 -- 判定日（作成日+30日）
  -- 判定結果
  a_stars_start int,                           -- 判定開始時のStars
  b_stars_start int,
  a_stars_end   int,                           -- 判定終了時のStars
  b_stars_end   int,
  a_growth_pct  numeric(8,4),                  -- 増加率 %
  b_growth_pct  numeric(8,4),
  winner        text check (winner in ('a', 'b', 'both')),
  judged_at     timestamptz
);

create index idx_pairs_status on pairs(status, judge_after);

-- ============================================================
-- 2b. Star Snapshots: 日次Stars記録（NG2修正）
-- AI予測の「直近N日増加」算出用。毎日バッチで1行追加。
-- ============================================================
create table star_snapshots (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products(id),
  captured_at   date not null default current_date,
  stars         int not null,
  unique(product_id, captured_at)
);

create index idx_snapshots_product on star_snapshots(product_id, captured_at);

-- ============================================================
-- 3. Users: 最低限の認証
-- ============================================================
create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique,
  display_name  text,
  auth_provider text,                          -- 'google' | 'email'
  created_at    timestamptz not null default now()
);

-- ============================================================
-- 4. Predictions: 利用者の予測（AかB）
-- ============================================================
create table predictions (
  id            uuid primary key default gen_random_uuid(),
  pair_id       uuid not null references pairs(id),
  user_id       uuid not null references users(id),
  pick          text not null check (pick in ('a', 'b')),
  is_correct    boolean,                       -- 判定後にセット
  created_at    timestamptz not null default now(),
  unique(pair_id, user_id)                     -- 1ペアにつき1予測
);

create index idx_predictions_user on predictions(user_id, created_at);

-- ============================================================
-- 5. AI Predictions: AI基準予測
-- ============================================================
create table ai_predictions (
  id            uuid primary key default gen_random_uuid(),
  pair_id       uuid not null references pairs(id) unique,
  pick          text not null check (pick in ('a', 'b')),
  score_a       numeric(10,4),                 -- ヒューリスティクススコア
  score_b       numeric(10,4),
  reasoning     jsonb,                         -- スコア内訳
  is_correct    boolean,                       -- 判定後にセット
  created_at    timestamptz not null default now()
);

-- ============================================================
-- 6. Views: ユーザー履歴サマリー
-- ============================================================
create or replace view user_stats as
select
  p.user_id,
  count(*)                                           as total_predictions,
  count(*) filter (where p.is_correct is not null)   as judged_count,
  count(*) filter (where p.is_correct = true)        as correct_count,
  case
    when count(*) filter (where p.is_correct is not null) > 0
    then round(
      100.0 * count(*) filter (where p.is_correct = true)
      / count(*) filter (where p.is_correct is not null), 1
    )
    else 0
  end                                                as accuracy_pct,
  max(p.created_at)                                  as last_prediction_at
from predictions p
group by p.user_id;

-- AI基準の成績
create or replace view ai_stats as
select
  count(*)                                           as total_predictions,
  count(*) filter (where is_correct is not null)     as judged_count,
  count(*) filter (where is_correct = true)          as correct_count,
  case
    when count(*) filter (where is_correct is not null) > 0
    then round(
      100.0 * count(*) filter (where is_correct = true)
      / count(*) filter (where is_correct is not null), 1
    )
    else 0
  end                                                as accuracy_pct
from ai_predictions;
