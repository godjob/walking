// @ts-nocheck
// v2.20.0: 写真ビューアで同じ記録の写真をフリック・矢印で連続閲覧できることを検証する。
//
// - PhotoViewer は 1枚の src ではなく photos 配列と initialIndex を受け取る
// - 端では止まる（先頭へ戻らない）・拡大中はフリック送りしない
// - 一覧の4か所（散歩・お世話 × 2画面）が記録の写真配列ごと渡す
//
//   node tests/verify-photo-viewer.js

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const results = [];
const check = (name, condition, hint) => results.push({ name, ok: !!condition, hint });

const app = read('src/app.js');
const map = read('src/map.js');
const css = read('dist/tailwind.css');

// --- 呼び出し側 ---
check('一覧のサムネイル4か所が写真配列と位置を渡す',
    (app.match(/setViewingPhoto\(\{ photos: item\.photos, index: i \}\)/g) || []).length === 4);
check('URL 1つだけを渡す旧呼び出しが残っていない', !/setViewingPhoto\(url\)/.test(app));
check('PhotoViewer に photos / initialIndex を渡す',
    /createElement\(PhotoViewer, \{ photos: viewingPhoto\.photos, initialIndex: viewingPhoto\.index/.test(app));

// --- ビューア ---
check('PhotoViewer が photos / initialIndex を受け取る', /function PhotoViewer\(\{ photos, initialIndex, onClose \}\)/.test(map));
check('枚数表示（n / N）がある', /`\$\{index \+ 1\} \/ \$\{count\}`/.test(map));
check('前へ・次へボタンに aria-label がある', /'aria-label': label/.test(map) && /navBtn\(-1, '前の写真'/.test(map) && /navBtn\(1, '次の写真'/.test(map));
check('タッチでフリックを判定する', /onTouchStart/.test(map) && /onTouchEnd/.test(map));
check('←→キーと Esc に対応する', /ArrowLeft/.test(map) && /ArrowRight/.test(map) && /Escape/.test(map));
check('前後の写真を先読みする', /new Image\(\)/.test(map));
check('写真を切り替えたら倍率を戻す', /setScale\(1\)/.test(map));

// --- 生成CSS ---
const escapeCls = (c) => c.replace(/([\[\]\/:.])/g, '\\$1');
['left-2', 'right-2', 'top-1/2', '-translate-y-1/2', 'top-5', 'left-4']
    .forEach((cls) => check(`dist/tailwind.css に .${cls} がある`, css.includes('.' + escapeCls(cls) + '{') || css.includes('.' + escapeCls(cls) + ',')));

// --- 振る舞い: 純粋関数を読み込んで確認 ---
const runBehavior = async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-viewer-'));
    fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
    ['map.js', 'utils.js', 'constants.js'].forEach((f) => fs.copyFileSync(path.join(ROOT, 'src', f), path.join(tmp, f)));
    global.React = { createElement: () => null };
    const mod = await import(pathToFileURL(path.join(tmp, 'map.js')).href);
    const { stepPhotoIndex, swipeDelta } = mod;
    check('振る舞い: stepPhotoIndex / swipeDelta を export している', typeof stepPhotoIndex === 'function' && typeof swipeDelta === 'function');
    if (typeof stepPhotoIndex !== 'function' || typeof swipeDelta !== 'function') return;

    check('振る舞い: 次へ進む', stepPhotoIndex(0, 1, 4) === 1);
    check('振る舞い: 最後の写真で止まる（先頭へ戻らない）', stepPhotoIndex(3, 1, 4) === 3);
    check('振る舞い: 最初の写真で止まる', stepPhotoIndex(0, -1, 4) === 0);
    check('振る舞い: 左へフリック → 次へ', swipeDelta(-80, 10, 1) === 1);
    check('振る舞い: 右へフリック → 前へ', swipeDelta(80, -5, 1) === -1);
    check('振る舞い: 短い移動は無視（誤タップ対策）', swipeDelta(-30, 0, 1) === 0);
    check('振る舞い: 縦方向が大きい移動は無視', swipeDelta(-60, 90, 1) === 0);
    check('振る舞い: 拡大中はフリック送りしない', swipeDelta(-120, 0, 1.5) === 0);
};

runBehavior()
    .catch((err) => check('振る舞い: 例外なく読み込める', false, err.message))
    .finally(() => {
        let failed = 0;
        for (const r of results) {
            console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
            if (!r.ok) { failed += 1; if (r.hint) console.log(`      → ${r.hint}`); }
        }
        console.log(`\n${results.length - failed}/${results.length} passed`);
        process.exit(failed ? 1 : 0);
    });
