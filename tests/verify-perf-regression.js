// @ts-nocheck
// 初期表示の高速化施策が後のバージョンで失われていないかを検査する。
//
// これらは「動かなくても画面上は正常に見える」ため、退行しても気づけない。
// 実際に v2.9.5 では service-worker.js は存在するのに登録コードが無く、
// SW が一度も動作していなかった（v2.14.0 で発覚するまで気づけなかった）。
//
//   node tests/verify-perf-regression.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const results = [];
const check = (name, condition, hint) => results.push({ name, ok: !!condition, hint });

const html = read('index.html');
const sw = read('service-worker.js');
const firebaseInit = read('src/firebase-init.js');
const constants = read('src/constants.js');

// --- v2.14.0: Service Worker を実際に登録していること ---
check(
    'index.html が Service Worker を登録している',
    /navigator\.serviceWorker\.register\s*\(/.test(html),
    'service-worker.js があっても register() が無ければ SW は一度も動作しない'
);

// --- v2.14.0: Firestore オフライン永続化 ---
check(
    'Firestore のオフライン永続化が有効',
    /enablePersistence\s*\(/.test(firebaseInit),
    'walks/health を毎回フル取得することになり、記録が増えるほど起動が遅くなる'
);

// --- v2.14.0: JS 実行前の白画面を避ける静的ローディング表示 ---
check(
    '#app に静的なローディング表示がある',
    /id="app"[\s\S]{0,200}読み込み中/.test(html),
    'JS の実行完了まで真っ白な画面が表示される'
);

// --- v2.14.0: 写真サムネイルの遅延読み込み ---
const lazyCount = ['src/app.js', 'src/map.js', 'src/health.js', 'src/walk.js', 'src/settings.js']
    .reduce((sum, f) => sum + (read(f).match(/loading:\s*['"]lazy['"]/g) || []).length, 0);
check(
    `写真サムネイルに loading:'lazy' が付いている（${lazyCount}箇所）`,
    lazyCount >= 5,
    '初回表示で写真が一斉にダウンロードされる'
);

// --- v2.16.0: Tailwind はビルド済みCSS。Play CDN に戻していないこと ---
check(
    'Tailwind Play CDN を読み込んでいない',
    // コメント内での言及は許容し、実際の <script> 読み込みだけを検出する
    !/<script[^>]+cdn\.tailwindcss\.com/.test(html),
    'ブラウザ上でJITコンパイルが走り、旧機種の初期表示が大幅に遅くなる'
);
check(
    'ビルド済み Tailwind CSS を読み込んでいる',
    /<link[^>]+href="dist\/tailwind\.css"/.test(html),
    'スタイルが一切適用されない'
);
check(
    'dist/tailwind.css が存在する',
    fs.existsSync(path.join(ROOT, 'dist', 'tailwind.css')),
    '生成物をコミットし忘れている'
);

// --- v2.16.0: SW キャッシュの2層分離 ---
const shellMatch = sw.match(/SHELL_CACHE\s*=\s*'([^']+)'/);
const vendorMatch = sw.match(/VENDOR_CACHE\s*=\s*'([^']+)'/);
check(
    'SW のキャッシュが shell と vendor に分かれている',
    shellMatch && vendorMatch,
    '単一キャッシュだとバージョンアップのたびにCDN約800KBが削除され、毎回フルダウンロードに戻る'
);
check(
    'activate が現行キャッシュを一括で保護している',
    /CURRENT_CACHES\s*=\s*\[/.test(sw) && /!CURRENT_CACHES\.includes\(/.test(sw),
    'VENDOR_CACHE まで削除され、2層に分けた意味が無くなる'
);
check(
    'precache が1件失敗しても install を継続する',
    !/addAll\(/.test(sw) && /\.add\([^)]*\)\.catch\(/.test(sw),
    'addAll は atomic なので1件の失敗で SW が有効化されなくなる'
);

// --- バージョン整合 ---
const appVersion = (constants.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
check(
    `APP_VERSION と SHELL_CACHE のバージョンが一致（${appVersion}）`,
    appVersion && shellMatch && shellMatch[1].endsWith(appVersion),
    'SHELL_CACHE が古いままだと旧 index.html / app.js が配信され続ける'
);

// --- 結果表示 ---
let failed = 0;
for (const { name, ok, hint } of results) {
    if (ok) {
        console.log(`PASS  ${name}`);
    } else {
        failed++;
        console.error(`FAIL  ${name}`);
        console.error(`      → ${hint}`);
    }
}

console.log(`\n${results.length - failed}/${results.length} PASS`);
if (failed > 0) process.exit(1);
