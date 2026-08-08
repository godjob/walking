// @ts-nocheck
// 日付をローカルタイムで扱えているかを検査する。
//
// toISOString() は UTC に変換するため、JST 09:00 より前の記録は日付が1日前になる。
// v2.16.0 までの編集フォームはこれで日付が1日前にずれていた（時刻はローカルのままなので
// 「日付だけ1日前・時間はそのまま」という、画面を見ても異常だと気づけない壊れ方をする）。
// しかも編集して保存するとそのずれた日付が Firestore に書き戻され、記録日が破壊される。
//
//   node tests/verify-date-local.js

// Date の挙動をタイムゾーンに依存させないため JST 固定で実行し直す
if (process.env.TZ !== 'Asia/Tokyo') {
    const { spawnSync } = require('child_process');
    const r = spawnSync(process.execPath, [__filename], {
        stdio: 'inherit',
        env: { ...process.env, TZ: 'Asia/Tokyo' }
    });
    process.exit(r.status === null ? 1 : r.status);
}

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const results = [];
const check = (name, condition, hint) => results.push({ name, ok: !!condition, hint });

const app = read('src/app.js');
const utils = read('src/utils.js');
const settings = read('src/settings.js');

// --- 静的検査: 編集フォームの初期値 (initHealthForm) ---
// お世話10種すべてがこの1関数を共有しているため、ここが壊れると全種類がずれる
const initHealthForm = (app.match(/const initHealthForm[\s\S]*?\n    };\n/) || [])[0] || '';
// 解説コメントに toISOString の語が出てくるので、コードだけを検査対象にする
const initHealthFormCode = initHealthForm.replace(/\/\/.*$/gm, '');

check(
    'initHealthForm を app.js から抽出できる',
    initHealthForm.length > 0,
    '関数名か整形が変わっている。テスト側の抽出正規表現を追従させること'
);

check(
    'initHealthForm が toISOString を使っていない',
    initHealthForm.length > 0 && !/toISOString/.test(initHealthFormCode),
    'toISOString() は UTC 変換なので JST 09:00 前の記録の日付が1日前になる'
);

check(
    'initHealthForm が toLocalISOString で日付を組み立てている',
    /toLocalISOString\(record\.date\)/.test(initHealthForm),
    '散歩の編集フォーム (walk.js) と同じ toLocalISOString を使うこと'
);

check(
    'app.js が toLocalISOString を import している',
    /import\s*\{[\s\S]*?\btoLocalISOString\b[\s\S]*?\}\s*from\s*'\.\/utils\.js'/.test(app),
    'import し忘れると実行時に ReferenceError になる'
);

// --- 静的検査: エクスポートのファイル名 ---
check(
    'settings.js のバックアップファイル名がローカル日付',
    !/new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)/.test(settings)
        && /getTodayDateString\(\)/.test(settings),
    'JST 09:00 前にエクスポートするとファイル名が前日の日付になる'
);

// --- 動作検査: toLocalISOString が日付をずらさないこと ---
// utils.js は ES Modules なので、関数定義だけ取り出して評価する（ビルドツールを入れない方針のため）
const src = (utils.match(/const toLocalISOString = [\s\S]*?\n};\n/) || [])[0];
check(
    'utils.js から toLocalISOString を抽出できる',
    !!src,
    'utils.js の toLocalISOString の定義が見つからない'
);

if (src) {
    const toLocalISOString = new Function(`${src}\nreturn toLocalISOString;`)();

    // JST 09:00 より前は UTC に変換すると前日になる。ここが退行の本命
    const cases = [
        ['2026-08-08T00:10', '2026-08-08', '00:10'],
        ['2026-08-08T07:30', '2026-08-08', '07:30'],
        ['2026-08-08T08:59', '2026-08-08', '08:59'],
        ['2026-08-08T09:00', '2026-08-08', '09:00'],
        ['2026-08-08T18:00', '2026-08-08', '18:00'],
        ['2026-08-08T23:59', '2026-08-08', '23:59'],
        ['2026-01-01T00:00', '2026-01-01', '00:00']  // 年をまたぐケース
    ];

    for (const [input, expectDate, expectTime] of cases) {
        const [date, time] = toLocalISOString(new Date(input)).split('T');
        check(
            `${input} (JST) → ${expectDate} ${expectTime}`,
            date === expectDate && time === expectTime,
            `実際は ${date} ${time}。日付が1日ずれている`
        );
    }
}

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
