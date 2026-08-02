const CACHE_NAME = 'fuku-cache-v2.15.0';
const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(PRECACHE_URLS);
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. データ通信 (Firestore, Storage, Functions, API) はキャッシュしない (Network Only)
    if (url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('storage.googleapis.com') ||
        url.hostname.includes('cloudfunctions.net') ||
        url.href.includes('googleapis.com/google.firestore') ||
        url.pathname.includes('/api/')) {
        return;
    }

    // 2. CDNライブラリとアプリ内リソースは Stale-While-Revalidate
    const isCdn =
        url.hostname === 'cdn.tailwindcss.com' ||
        url.hostname === 'unpkg.com' ||
        url.hostname === 'www.gstatic.com' ||
        url.hostname === 'maps.googleapis.com';

    const isLocal = event.request.url.startsWith(self.location.origin);

    if (isCdn || isLocal) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    const fetchPromise = fetch(event.request)
                        .then((networkResponse) => {
                            // 正常なレスポンスならキャッシュを更新
                            // Opaque response (type: 'opaque') もCDN等ではあり得るので許容するが、statusチェックは200のみ
                            // ただしopaqueの場合はstatusが0になるため、type === 'opaque' も許可する必要がある場合がある
                            // ここではシンプルにエラーでなければ保存する
                            if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                                cache.put(event.request, networkResponse.clone());
                            }
                            return networkResponse;
                        })
                        .catch((err) => {
                            console.warn('Fetch failed.', err);
                            throw err;
                        });

                    // キャッシュがあればそれを即座に返す (Stale), 裏でfetchPromiseが実行され次回更新される
                    // キャッシュがなければ fetchPromise の結果を待つ
                    return cachedResponse || fetchPromise;
                });
            })
        );
    }
});
