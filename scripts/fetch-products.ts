/**
 * fetch-products.ts
 * 
 * 日次バッチ: Product Hunt → GitHub → Supabase
 * GitHub Actions cronで毎日実行
 * 
 * 1. Product Huntから直近のAIプロダクトを取得
 * 2. GitHubリポジトリの有無を確認
 * 3. GitHub連携済みのものだけDBに保存
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

// ============================================================
// Config
// ============================================================
const PH_TOKEN = process.env.PH_DEVELOPER_TOKEN!;
const GH_TOKEN = process.env.GITHUB_TOKEN!;    // optional but recommended (rate limit)
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// Product Hunt GraphQL: 直近の投稿を取得
// ============================================================
interface PHPost {
  id: string;
  name: string;
  tagline: string;
  url: string;
  createdAt: string;
  website: string;
  topics: { edges: { node: { slug: string } }[] };
}

async function fetchPHPosts(cursor?: string): Promise<{ posts: PHPost[]; endCursor?: string; hasNext: boolean }> {
  const query = `
    query($after: String) {
      posts(first: 20, after: $after, order: NEWEST) {
        edges {
          node {
            id
            name
            tagline
            url
            createdAt
            website
            topics { edges { node { slug } } }
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  `;

  const res = await fetch("https://api.producthunt.com/v2/api/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PH_TOKEN}`,
    },
    body: JSON.stringify({ query, variables: { after: cursor || null } }),
  });

  if (!res.ok) throw new Error(`PH API ${res.status}: ${await res.text()}`);

  const json = await res.json();
  const data = json.data.posts;

  return {
    posts: data.edges.map((e: any) => e.node),
    endCursor: data.pageInfo.endCursor,
    hasNext: data.pageInfo.hasNextPage,
  };
}

// ============================================================
// AI関連かチェック（トピックベース）
// ============================================================
const AI_TOPICS = new Set([
  "artificial-intelligence", "machine-learning", "ai",
  "generative-ai", "large-language-models", "chatgpt",
  "developer-tools", "no-code", "automation",
  "natural-language-processing", "computer-vision",
]);

function isAIProduct(post: PHPost): boolean {
  return post.topics.edges.some((e) => AI_TOPICS.has(e.node.slug));
}

// ============================================================
// GitHub: URLからリポジトリ情報を取得
// ============================================================
interface GitHubInfo {
  owner: string;
  repo: string;
  stars: number;
  contributors: number;
  repoCreatedAt: string;
}

function extractGitHubRepo(websiteUrl: string): { owner: string; repo: string } | null {
  // パターン: github.com/owner/repo
  const match = websiteUrl.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

// ウェブサイトにGitHubリンクがない場合、GitHub検索で探す
async function searchGitHubRepo(productName: string): Promise<{ owner: string; repo: string } | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "ai-predict-service",
  };
  if (GH_TOKEN) headers.Authorization = `Bearer ${GH_TOKEN}`;

  // プロダクト名でGitHub検索
  const query = encodeURIComponent(productName);
  const res = await fetch(
    `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=1`,
    { headers }
  );
  if (!res.ok) return null;
  const data = await res.json();

  if (!data.items || data.items.length === 0) return null;

  const top = data.items[0];
  // 名前が大きく違う場合は無視（無関係なリポジトリを拾わないため）
  const repoName = top.name.toLowerCase();
  const searchName = productName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!repoName.includes(searchName) && !searchName.includes(repoName)) {
    return null;
  }

  return { owner: top.owner.login, repo: top.name };
}

async function fetchGitHubInfo(owner: string, repo: string): Promise<GitHubInfo | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "ai-predict-service",
  };
  if (GH_TOKEN) headers.Authorization = `Bearer ${GH_TOKEN}`;

  // リポジトリ基本情報
  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!repoRes.ok) return null;
  const repoData = await repoRes.json();

  // コントリビューター数（最初のページのみ）
  const contribRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=1&anon=true`,
    { headers }
  );
  let contributors = 0;
  if (contribRes.ok) {
    // Linkヘッダーから総数を推定
    const link = contribRes.headers.get("Link");
    if (link) {
      const lastMatch = link.match(/page=(\d+)>; rel="last"/);
      contributors = lastMatch ? parseInt(lastMatch[1]) : 1;
    } else {
      const data = await contribRes.json();
      contributors = Array.isArray(data) ? data.length : 0;
    }
  }

  return {
    owner,
    repo,
    stars: repoData.stargazers_count,
    contributors,
    repoCreatedAt: repoData.created_at,
  };
}

// ============================================================
// Main: 取得 → フィルタ → 保存
// ============================================================
async function main() {
  console.log("=== Product Hunt AI Product Fetch ===");
  console.log(`Date: ${new Date().toISOString()}`);

  // 直近3日のProduct Hunt投稿を取得
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  let allPosts: PHPost[] = [];
  let cursor: string | undefined;
  let page = 0;

  // ページネーションで取得（最大5ページ = 100件）
  while (page < 5) {
    const { posts, endCursor, hasNext } = await fetchPHPosts(cursor);
    const recent = posts.filter((p) => new Date(p.createdAt) >= threeDaysAgo);
    allPosts.push(...recent);

    if (!hasNext || recent.length < posts.length) break;
    cursor = endCursor;
    page++;
    await sleep(500); // Rate limit対策
  }

  console.log(`PH posts (last 3 days): ${allPosts.length}`);

  // AIフィルタ
  const aiPosts = allPosts.filter(isAIProduct);
  console.log(`AI-related: ${aiPosts.length}`);

  // GitHub連携チェック + 保存
  let saved = 0;
  for (const post of aiPosts) {
    // まずウェブサイトURLからGitHubリポを探す
    let ghRef = extractGitHubRepo(post.website || "");

    // なければGitHub検索でプロダクト名から探す
    if (!ghRef) {
      ghRef = await searchGitHubRepo(post.name);
      if (ghRef) {
        console.log(`  SEARCH HIT: ${post.name} → ${ghRef.owner}/${ghRef.repo}`);
      }
      await sleep(500); // GitHub Search API rate limit対策
    }

    if (!ghRef) {
      console.log(`  SKIP (no GitHub): ${post.name}`);
      continue;
    }

    const ghInfo = await fetchGitHubInfo(ghRef.owner, ghRef.repo);
    if (!ghInfo) {
      console.log(`  SKIP (GitHub 404): ${post.name} → ${ghRef.owner}/${ghRef.repo}`);
      continue;
    }

    // Supabaseにupsert
    const { error } = await supabase.from("products").upsert(
      {
        ph_id: post.id,
        name: post.name,
        tagline: post.tagline,
        ph_url: post.url,
        github_url: `https://github.com/${ghInfo.owner}/${ghInfo.repo}`,
        github_owner: ghInfo.owner,
        github_repo: ghInfo.repo,
        stars_at_fetch: ghInfo.stars,
        contributors: ghInfo.contributors,
        repo_created_at: ghInfo.repoCreatedAt,
        ph_launched_at: post.createdAt.split("T")[0],
      },
      { onConflict: "ph_id" }
    );

    if (error) {
      console.error(`  ERROR saving ${post.name}:`, error.message);
    } else {
      console.log(`  SAVED: ${post.name} (★${ghInfo.stars})`);
      saved++;

      // NG2修正: star_snapshotに本日のStarsを記録
      const { data: product } = await supabase
        .from("products")
        .select("id")
        .eq("ph_id", post.id)
        .single();

      if (product) {
        await supabase.from("star_snapshots").upsert(
          { product_id: product.id, captured_at: new Date().toISOString().split("T")[0], stars: ghInfo.stars },
          { onConflict: "product_id,captured_at" }
        );
      }
    }

    await sleep(300);
  }

  // NG2: 既存の全製品のStarsも毎日スナップショット
  console.log("\n--- Daily snapshot for all tracked products ---");
  const { data: allProducts } = await supabase
    .from("products")
    .select("id, github_owner, github_repo");

  let snapped = 0;
  for (const p of allProducts || []) {
    const stars = await fetchCurrentStars(p.github_owner, p.github_repo);
    if (stars !== null) {
      await supabase.from("star_snapshots").upsert(
        { product_id: p.id, captured_at: new Date().toISOString().split("T")[0], stars },
        { onConflict: "product_id,captured_at" }
      );
      snapped++;
    }
    await sleep(200);
  }
  console.log(`Snapshots recorded: ${snapped}`);

  console.log(`\nTotal saved: ${saved}`);
}

async function fetchCurrentStars(owner: string, repo: string): Promise<number | null> {
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
