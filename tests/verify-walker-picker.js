// @ts-nocheck
// v2.17.0: 担当者の選択UIが散歩・お世話で共通部品（WalkerPicker）に揃っていることと、
// 散歩中の「最終GPS受信」診断表示が存在することを検証する。
//
// - 散歩（準備・編集）は複数選択、お世話は1人だけ選択
// - お世話の担当者は従来どおり walker（文字列）で保存する（LINE通知・検索が文字列前提のため）
//
//   node tests/verify-walker-picker.js

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

const results = [];
const check = (name, condition, hint) => results.push({ name, ok: !!condition, hint });

const app = read('src/app.js');
const walk = read('src/walk.js');
const health = read('src/health.js');
const pickerExists = exists('src/walker-picker.js');
const picker = pickerExists ? read('src/walker-picker.js') : '';
const css = read('dist/tailwind.css');

// --- 共通部品 ---
check('src/walker-picker.js が存在する', pickerExists, '担当者選択の共通部品');
check('WalkerPicker を export している', /export\s*\{[^}]*WalkerPicker/.test(picker));
check('1行に並べ、収まらなければ折り返す（flex-wrap）', /flex flex-wrap/.test(picker));
check('タップ領域が44px以上（min-h-[44px]）', /min-h-\[44px\]/.test(picker), 'Apple HIG の推奨最小タップ領域');

// --- 散歩: 複数選択 ---
check('app.js（散歩の準備）が WalkerPicker を使う', /import\s*\{\s*WalkerPicker\s*\}\s*from\s*'\.\/walker-picker\.js'/.test(app) && /createElement\(WalkerPicker/.test(app));
check('walk.js（散歩の編集）が WalkerPicker を使う', /import\s*\{\s*WalkerPicker\s*\}\s*from\s*'\.\/walker-picker\.js'/.test(walk) && /createElement\(WalkerPicker/.test(walk));
check('散歩の担当者に旧来の縦並びチェックボックスが残っていない',
    !/type:\s*'checkbox',\s*checked:\s*(selectedWalkers|formData\.walkers)\.includes/.test(app + walk));

// --- お世話: 1人だけ・文字列で保存 ---
check('health.js（お世話）が WalkerPicker を使う', /import\s*\{\s*WalkerPicker\s*\}\s*from\s*'\.\/walker-picker\.js'/.test(health) && /createElement\(WalkerPicker/.test(health));
check('health.js に担当者のドロップダウンが残っていない', !/createElement\('select'/.test(health));
check('お世話は single 指定（1人だけ選択）', /createElement\(WalkerPicker,\s*\{[^}]*single:\s*true/.test(health));
check('お世話の担当者は walker（文字列）のまま保存', /walker:\s*formData\.walker === name \? '' : name/.test(health));

// --- 検索の絞り込みはドロップダウンのまま（「すべて」を選べるため） ---
check('検索の担当者絞り込みはドロップダウンのまま', /updateSearch\(\{ walker: e\.target\.value \}\)/.test(app));

// --- 診断表示 ---
check('GPSを受信するたびに受信時刻を記録する', /setLastGpsReceivedAt\(Date\.now\(\)\)/.test(app));
check('散歩中に「最終GPS受信」を表示する', /最終GPS受信/.test(app));

// --- 生成CSSに部品のクラスが含まれる（verify-tailwind-css.js は三項演算子内を拾わないため個別に確認） ---
const escapeCls = (c) => c.replace(/([\[\]\/:.])/g, '\\$1');
['flex-wrap', 'min-h-[44px]', 'min-w-[4.5rem]', 'bg-blue-100', 'border-blue-500', 'text-blue-700']
    .forEach((cls) => check(`dist/tailwind.css に .${cls} がある`, css.includes('.' + escapeCls(cls) + '{') || css.includes('.' + escapeCls(cls) + ',')));

// --- 振る舞い: React のスタブで描画し、single / multi の見た目と onToggle を確認 ---
const runBehavior = async () => {
    if (!pickerExists) {
        check('振る舞い: 描画できる', false, 'src/walker-picker.js が無い');
        return;
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'walker-picker-'));
    const mjs = path.join(tmp, 'walker-picker.mjs');
    fs.writeFileSync(mjs, picker);
    global.React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat() }) };
    const { WalkerPicker } = await import(pathToFileURL(mjs).href);

    const walkers = [{ id: '1', name: 'パパ' }, { id: '2', name: 'ママ' }, { id: '3', name: '長女' }, { id: '4', name: '長男' }];
    const toggled = [];
    const tree = WalkerPicker({ walkers, selected: ['ママ'], onToggle: (n) => toggled.push(n) });
    const buttons = tree.children.filter(Boolean);
    check('振る舞い: 4人分のボタンを描画する', buttons.length === 4);
    check('振る舞い: type="button"（フォーム送信を誘発しない）', buttons.every((b) => b.props.type === 'button'));
    check('振る舞い: 選択中だけ aria-checked=true', buttons.map((b) => b.props['aria-checked']).join() === 'false,true,false,false');
    check('振る舞い: 複数選択は role=checkbox', buttons.every((b) => b.props.role === 'checkbox'));
    check('振る舞い: 選択中もチェックマークを付けず名前だけ（色の変化のみで示す）', buttons[1].children.join('') === 'ママ');
    buttons[2].props.onClick();
    check('振る舞い: タップで onToggle に名前が渡る', toggled[0] === '長女');

    const single = WalkerPicker({ walkers, selected: [], onToggle: () => {}, single: true });
    check('振る舞い: 1人選択は role=radio', single.children.filter(Boolean).every((b) => b.props.role === 'radio'));
    check('振る舞い: 1人選択のグループは role=radiogroup', single.props.role === 'radiogroup');
};

runBehavior()
    .catch((err) => check('振る舞い: 例外なく描画できる', false, err.message))
    .finally(() => {
        let failed = 0;
        for (const r of results) {
            console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
            if (!r.ok) { failed += 1; if (r.hint) console.log(`      → ${r.hint}`); }
        }
        console.log(`\n${results.length - failed}/${results.length} passed`);
        process.exit(failed ? 1 : 0);
    });
