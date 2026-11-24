const CACHE_NAME = 'myapp-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

/* ===== INSTALL: cache tài nguyên cần thiết ===== */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

/* ===== ACTIVATE: xóa cache cũ ===== */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ===== FETCH: Cache First (cho tài nguyên tĩnh) + Network Fallback ===== */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Chỉ xử lý GET
  if (request.method !== 'GET') return;

  // Bỏ qua request khác origin (API ngoài, analytics...)
  if (!request.url.startsWith(self.location.origin)) return;

  // Bỏ qua chrome-extension, devtools
  if (request.url.startsWith('chrome-extension://')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      // Có trong cache → trả luôn, đồng thời cập nhật ngầm
      if (cached) {
        fetch(request)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkRes.clone()));
            }
          })
          .catch(() => {});
        return cached;
      }

      // Không có cache → fetch mạng, lưu lại
      return fetch(request)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkRes;
        })
        .catch(() => {
          // Offline fallback cho navigation
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
    })
  );
});

/* ===== Nhận message từ client (force update) ===== */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
