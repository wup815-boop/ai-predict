// 最小限のService Worker。
// キャッシュ戦略は持たず、fetchハンドラを登録するだけでPWAの
// インストール可否判定を満たす（常にネットワークへフォールスルー）。
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // no-op
});
