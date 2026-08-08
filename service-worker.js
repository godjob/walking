// v2.16.0: キャッシュを2層に分離。
// 旧実装は単一の CACHE_NAME に自サイトのファイルとCDNライブラリを同居させていたため、
// バージョンアップで CACHE_NAME を上げるたびに activate が CDN 約800KB まで道連れに削除し、
// 次回起動が毎回フルダウンロードに戻っていた（旧機種で初期表示が遅くなる主因のひとつ）。
// CDNのURLはバージョンが埋め込まれており内容が変わらないため、アプリ更新では破棄しない。
const SHELL_CACHE = 'fuku-shell-v2.16.1';  // 自サイトのファイル。バージョンごとに入れ替える
const VENDOR_CACHE = 'fuku-vendor-v1';     // CDNライブラリ。アプリ更新をまたいで保持する

const CURRENT_CACHES = [SHELL_CACHE, VENDOR_CACHE];

const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.json',
    './dist/tailwind.css'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then((cache) => Promise.all(
                // 旧実装の cache.addAll は atomic で、1件でも失敗すると install 全体が失敗し
                // その端末では Service Worker が一度も有効化されなかった。
                // 個別に add して失敗は握りつぶし、取得できたものだけ確実にキャッシュする。
                PRECACHE_URLS.map((url) => cache.add(url).catch((err) => {
                    console.warn('Precache skipped:', url, err);
                }))
            ))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // 現行の2つ以外を削除する。VENDOR_CACHE は残るため
                    // バージョンアップ後もCDNライブラリは端末に保持される。
                    if (!CURRENT_CACHES.includes(cacheName)) {
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
    //    （cdn.tailwindcss.com は v2.16.0 で dist/tailwind.css に置き換えたため対象外）
    const isCdn =
        url.hostname === 'unpkg.com' ||
        url.hostname === 'www.gstatic.com' ||
        url.hostname === 'maps.googleapis.com';

    const isLocal = event.request.url.startsWith(self.location.origin);

    if (isCdn || isLocal) {
        const cacheName = isCdn ? VENDOR_CACHE : SHELL_CACHE;

        event.respondWith(
            caches.open(cacheName).then((cache) => {
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
