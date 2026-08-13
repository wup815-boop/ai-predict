# AI Product Prediction Service

新しいAIプロダクトを見つけ、2つのうちどちらが伸びるかを1タップで予測し、30日後の結果と照合して目利き履歴を残す無料サービス。

## セットアップ手順

### 1. アカウント作成（すべて無料枠）

| サービス | URL | 必要なもの |
|---------|-----|----------|
| **Supabase** | https://supabase.com | メールでサインアップ → New Project |
| **Product Hunt** | https://www.producthunt.com/v2/oauth/applications | Developer Token を生成 |
| **GitHub PAT** | https://github.com/settings/tokens | `public_repo` スコープのみ |
| **Vercel** | https://vercel.com | GitHubアカウントで連携 |
| **Resend** | https://resend.com | 週次結果通知メール用。API Keyを発行（独自ドメイン検証まではonboarding@resend.dev送信元のみ） |

### 2. Supabase DB作成

Supabaseダッシュボード → SQL Editor → `supabase/schema.sql` の内容を貼り付けて実行。

### 3. ローカル開発

```bash
cp .env.example .env.local
# .env.local に各トークンを入力

npm install
npm run dev          # Next.js開発サーバー
```

### 4. バッチ処理テスト

```bash
npm run fetch        # Product Hunt → GitHub → DB
npm run pair         # ペア作成 + AI予測
npm run judge        # 30日経過ペアの判定
npm run notify       # 直近7日で判定されたペアの結果をメール通知（週次）
npm run batch        # fetch → pair → judge を順番に実行
```

### 5. デプロイ

- GitHubにpush
- Vercelでインポート
- 環境変数を設定
- GitHub Actions の Secrets に同じ変数を設定（`daily-batch.yml` 用に加え、`weekly-notify.yml` 用に `RESEND_API_KEY` / `EMAIL_FROM` / `NEXTAUTH_URL` も設定）

## プロジェクト構造

```
ai-predict/
├── .github/workflows/
│   └── daily-batch.yml      # 日次バッチ（UTC 06:00）
├── scripts/
│   ├── fetch-products.ts    # PH + GitHub → DB
│   ├── create-pairs.ts      # ペア生成 + AI予測
│   └── judge-pairs.ts       # 30日判定
├── supabase/
│   └── schema.sql           # DB定義
├── src/
│   ├── app/                 # Next.js App Router（Week 3）
│   ├── lib/                 # Supabaseクライアント等
│   └── components/          # UIコンポーネント
├── .env.example
└── package.json
```

## Week別タスク

- **Week 1** ← 今ここ: API接続確認 + DB作成
- **Week 2**: ペアリング + バッチ自動化
- **Week 3**: 予測画面 + 認証
- **Week 4**: 結果画面 + 履歴画面
- **Week 5**: テスト + 公開
