// Service Worker for 漫果AI PWA
// bump version to force SW update/activate and purge old caches
const CACHE_NAME = 'moyin-creator-v3';
// 只缓存稳定的静态资源；不要缓存 /src/* 这类 dev 源码路径，否则容易导致更新/热重载异常
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.error('[SW] Cache install failed:', err);
      })
  );
  // 不要强制立即接管（skipWaiting），否则在手机端更容易出现“频繁刷新/闪屏”
  // 让新 SW 等到下次导航再生效，体验更稳定
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // 不要立刻 claim，避免页面运行中 SW 控制权切换导致的异常刷新感
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // 不要让 SW 处理任何 API 请求（尤其是开发环境下的本地代理接口），避免缓存/路由干扰导致 404/异常响应
  try {
    const url = new URL(event.request.url);
    if (url.pathname.startsWith('/api/')) {
      event.respondWith(
        fetch(event.request).catch(() => new Response('Network error', { status: 502 }))
      );
      return;
    }
  } catch (_) {
    // ignore URL parse errors and fall through to default handler
  }

  const isNav =
    event.request.mode === 'navigate' ||
    (event.request.destination === 'document' && event.request.method === 'GET');

  // 导航请求用 network-first，避免缓存的 index.html 反复触发资源不匹配导致“看起来在刷新”
  if (isNav) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 部署在静态站点时，深层路由可能返回 404；此时回退到 /index.html（SPA）
          if (!response || response.status >= 400) {
            return fetch('/index.html').catch(() =>
              caches.match('/index.html').then((r) => r || new Response('Offline', { status: 503 }))
            );
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', responseToCache));
          return response;
        })
        .catch(() => caches.match('/index.html').then((r) => r || new Response('Offline', { status: 503 })))
    );
    return;
  }

  // 其他静态资源 cache-first
  event.respondWith(
    caches.match(event.request)
      .then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (event.request.method !== 'GET' || !response || response.status !== 200) return response;
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          return response;
        });
      })
      .catch(() => new Response('Network error', { status: 502 }))
  );
});
