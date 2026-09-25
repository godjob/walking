// @ts-nocheck
// v2.18.0: 週間サマリーのLINE通知を検証する。
//
// - functions/weekly-summary.js（集計と文面作成の純粋関数）を架空の1週間分データで検証
// - Cloud Functions・設定画面の配線を文字列検索で検証
//
//   node tests/verify-weekly-summary.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const results = [];
const check = (name, condition, detail) => results.push({ name, ok: !!condition, detail });
const eq = (name, actual, expected) => check(name, actual === expected, `期待: ${JSON.stringify(expected)}\n      実際: ${JSON.stringify(actual)}`);

// JST の日時文字列 → Date
const j = (s) => new Date(`${s}:00+09:00`);

// --- 配線 ---
const index = read('functions/index.js');
const settingsJs = read('src/settings.js');
const app = read('src/app.js');
const constants = read('src/constants.js');

check('index.js が weekly-summary.js を読み込む', /require\('\.\/weekly-summary'\)/.test(index));
check('weeklySummary が月曜7:00（日本時間）に実行される',
    /exports\.weeklySummary\s*=[\s\S]{0,200}\.schedule\('0 7 \* \* 1'\)\s*\.timeZone\('Asia\/Tokyo'\)/.test(index));
check('previewWeeklySummary（LINEを送らないプレビュー）がある', /exports\.previewWeeklySummary\s*=/.test(index));
check('sendWeeklySummaryNow（今すぐ送信）がある', /exports\.sendWeeklySummaryNow\s*=/.test(index));
check('今すぐ送信に連投防止の間隔制限がある', /MANUAL_SEND_INTERVAL_MS/.test(index) && /resource-exhausted/.test(index));
check('定期実行は設定OFFなら送らない', /exports\.weeklySummary[\s\S]*?isWeeklySummaryEnabled\(/.test(index));
check('設定の初期値 weeklySummaryEnabled: true', /weeklySummaryEnabled:\s*true/.test(constants));
check('設定の保存に weeklySummaryEnabled を含める', /weeklySummaryEnabled:\s*newSettings\.weeklySummaryEnabled !== false/.test(app));
check('設定画面から previewWeeklySummary を呼ぶ', /httpsCallable\('previewWeeklySummary'\)/.test(settingsJs));
check('設定画面から sendWeeklySummaryNow を呼ぶ', /httpsCallable\('sendWeeklySummaryNow'\)/.test(settingsJs));

// --- 純粋関数 ---
let ws = null;
try {
    ws = require(path.join(ROOT, 'functions', 'weekly-summary.js'));
} catch (e) {
    check('functions/weekly-summary.js を読み込める', false, e.message);
}

if (ws) {
    const { getWeekRange, buildWeeklySummaryMessages, isWeeklySummaryEnabled, TEXT_LIMIT } = ws;

    // 週の範囲: 実行時刻の直前に終わった月〜日（JST）
    const iso = (d) => d.toISOString();
    const r1 = getWeekRange(j('2026-09-28T07:00'));
    eq('週の範囲: 月曜7:00実行 → 開始は先週月曜0:00 JST', iso(r1.start), iso(j('2026-09-21T00:00')));
    eq('週の範囲: 終了（含まない）は今週月曜0:00 JST', iso(r1.end), iso(j('2026-09-28T00:00')));
    eq('週の範囲: 「記録なし」判定用に4週間さかのぼる', iso(r1.lookbackStart), iso(j('2026-08-24T00:00')));
    eq('週の範囲: 月曜0:00ちょうど → 先週', iso(getWeekRange(j('2026-09-28T00:00')).start), iso(j('2026-09-21T00:00')));
    eq('週の範囲: 日曜23:00（手動実行） → 前の週', iso(getWeekRange(j('2026-09-27T23:00')).start), iso(j('2026-09-14T00:00')));
    eq('週の範囲: 木曜（手動実行） → 直前の完結した週', iso(getWeekRange(j('2026-10-01T12:00')).start), iso(j('2026-09-21T00:00')));

    const walks = [
        // この週
        { at: j('2026-09-21T07:10'), walkers: ['パパ'], distance: 1500, duration: 30, energy: 4, poo: true, pooFirmness: 3, memo: '公園で柴犬と挨拶' },
        { at: j('2026-09-23T18:00'), walkers: ['パパ', '長女'], distance: 2000, duration: 40, energy: 5, poo: true, pooFirmness: 4, memo: '' },
        { at: j('2026-09-27T23:30'), walkers: ['ママ'], distance: 1000, duration: 20, energy: 3, poo: false, memo: '夜の散歩\n涼しかった' },
        // 境界: 翌週（含めない）
        { at: j('2026-09-28T00:00'), walkers: ['パパ'], distance: 9000, duration: 90, energy: 1, poo: true, pooFirmness: 1, memo: '翌週の記録' },
        // 前の週
        { at: j('2026-09-15T08:00'), walkers: ['ママ'], distance: 2000, duration: 30, energy: 3, memo: '' },
        { at: j('2026-09-20T23:59'), walkers: ['パパ'], distance: 1000, duration: 20, energy: 3, memo: '前の週の記録' }
    ];
    const health = [
        // この週
        { type: 'excretion', at: j('2026-09-22T06:00'), walker: 'ママ', pooFirmness: 2, memo: '' },
        { type: 'food', at: j('2026-09-22T07:00'), walker: 'パパ', memo: '   ' },
        { type: 'food', at: j('2026-09-22T19:00'), walker: 'パパ', memo: '' },
        { type: 'yard', at: j('2026-09-24T10:00'), walker: '長男', yardPoo: true, yardPooFirmness: 3, memo: '' },
        { type: 'hospital', at: j('2026-09-24T19:30'), walker: 'ママ', reason: '耳の赤み', memo: '点耳薬を1週間' },
        { type: 'weight', at: j('2026-09-21T20:00'), walker: 'パパ', weight: '4.25', memo: '' },
        { type: 'weight', at: j('2026-09-25T20:00'), walker: 'パパ', weight: '4.2', memo: '' },
        // 直近4週間（この週より前）
        { type: 'weight', at: j('2026-09-10T20:00'), walker: 'パパ', weight: '4.3', memo: '' },
        { type: 'cleaning', at: j('2026-09-05T10:00'), walker: 'ママ', memo: '' },
        { type: 'brushing', at: j('2026-09-01T10:00'), walker: '長女', memo: '' },
        { type: 'food', at: j('2026-09-02T07:00'), walker: 'パパ', memo: '' },
        // 4週間より前（「記録なし」判定に使わない）
        { type: 'bath', at: j('2026-08-20T10:00'), walker: 'ママ', memo: '' }
    ];

    const msgs = buildWeeklySummaryMessages({ walks, health, now: j('2026-09-28T07:00') });
    const summary = msgs[0].text;
    const expectedSummary = [
        '📊 福の週間サマリー（9/21〜9/27）',
        '',
        '🚶 散歩 3回 / 4.5km / 合計1時間30分',
        '   先週比 +1回 / +1.5km',
        '👑 担当者：パパ 2回・長女 1回・ママ 1回',
        '😆 元気度 平均4.0 / 💩 うんち 4回（硬さ平均：普通）',
        '',
        '🐾 お世話',
        ' 💩排泄 1 / 🥣ご飯 2 / ⚖️体重 2 / 🏥病院 1 / 🏡庭遊び 1',
        ' ⚖️ 体重 4.2kg（先週比 -0.1kg）',
        '',
        '⚠️ この週は記録なし：✨ブラッシング・🧹掃除'
    ].join('\n');
    eq('サマリー: 文面全体（境界・集計・先週比・担当者順・体重・記録なし）', summary, expectedSummary);
    check('メッセージはすべて text 型', msgs.every((m) => m.type === 'text'));

    const expectedMemo = [
        '📝 この週のメモ（3件）',
        '',
        '9/21(月) 07:10 🚶散歩（パパ）',
        ' 公園で柴犬と挨拶',
        '',
        '9/24(木) 19:30 🏥病院（ママ）',
        ' 理由：耳の赤み',
        ' 点耳薬を1週間',
        '',
        '9/27(日) 23:30 🚶散歩（ママ）',
        ' 夜の散歩',
        ' 涼しかった'
    ].join('\n');
    eq('メモ: 時系列・病院の理由・複数行・空白のみのメモは除外', msgs[1] && msgs[1].text, expectedMemo);
    eq('メモがある週は2通', msgs.length, 2);

    // 記録ゼロの週
    const empty = buildWeeklySummaryMessages({ walks: [], health: [], now: j('2026-09-28T07:00') });
    eq('記録ゼロ: 1通だけ（メモの吹き出しを送らない）', empty.length, 1);
    check('記録ゼロ: 散歩0回・お世話記録なしと表示', /🚶 散歩 0回/.test(empty[0].text) && /🐾 お世話\n 記録なし/.test(empty[0].text), empty[0].text);

    // 長いメモの分割
    const many = Array.from({ length: 30 }, (_, i) => ({
        at: new Date(j('2026-09-21T06:00').getTime() + i * 3600000), walkers: ['パパ'],
        distance: 100, duration: 5, memo: 'あ'.repeat(1000)
    }));
    const big = buildWeeklySummaryMessages({ walks: many, health: [], now: j('2026-09-28T07:00') });
    eq('分割: TEXT_LIMIT は5000', TEXT_LIMIT, 5000);
    check('分割: 1回の送信は最大5通', big.length <= 5, `${big.length}通`);
    check('分割: どの吹き出しも5000文字以内', big.every((m) => m.text.length <= 5000), big.map((m) => m.text.length).join(','));
    const shown = big.slice(1).map((m) => (m.text.match(/🚶散歩/g) || []).length).reduce((a, b) => a + b, 0);
    const rest = /…ほか(\d+)件はアプリで確認してください$/.exec(big[big.length - 1].text);
    check('分割: 入りきらない分は「…ほかN件」で締め、件数が合う', rest && shown + Number(rest[1]) === 30, `表示${shown}件 / 残り${rest && rest[1]}`);

    const huge = buildWeeklySummaryMessages({ walks: [{ at: j('2026-09-22T06:00'), walkers: ['パパ'], distance: 1, duration: 1, memo: 'い'.repeat(8000) }], health: [], now: j('2026-09-28T07:00') });
    check('分割: 1件で5000文字を超えるメモは切り詰める', huge.length === 2 && huge[1].text.length <= 5000 && huge[1].text.endsWith('…'), huge[1] && huge[1].text.length);

    // 設定
    eq('設定: 未保存（ドキュメントなし）はON', isWeeklySummaryEnabled(undefined), true);
    eq('設定: 項目なしはON', isWeeklySummaryEnabled({}), true);
    eq('設定: false ならOFF', isWeeklySummaryEnabled({ weeklySummaryEnabled: false }), false);
}

let failed = 0;
for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
    if (!r.ok) { failed += 1; if (r.detail !== undefined) console.log(`      ${r.detail}`); }
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
