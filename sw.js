/* ふたば(偽)お習字 PWA service worker
   方針：常時オンライン前提。アプリの「殻」だけ軽くキャッシュして起動を安定させる。
   Firebase/Supabase/フォント/CDN など外部通信は一切横取りせず素通し（リアルタイム性を損なわない）。*/
const CACHE = "oshuji-shell-v3";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e=>{
  e.waitUntil(caches.open(CACHE).then(c=> c.addAll(SHELL)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener("activate", e=>{
  e.waitUntil(
    caches.keys().then(ks=> Promise.all(ks.filter(k=> k!==CACHE).map(k=> caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", e=>{
  const req = e.request;
  if(req.method !== "GET") return;                 // 書き込み系は素通し
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;  // 外部（API/CDN/フォント）は横取りしない
  // 同一オリジンの殻：network-first（更新を優先）→ ダメならキャッシュ → 最後にindex
  e.respondWith(
    fetch(req).then(res=>{
      const copy = res.clone();
      caches.open(CACHE).then(c=> c.put(req, copy)).catch(()=>{});
      return res;
    }).catch(()=> caches.match(req).then(m=> m || caches.match("./index.html")))
  );
});