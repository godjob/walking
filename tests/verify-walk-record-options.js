// @ts-nocheck
// v2.19.0: 散歩の記録項目の変更を検証する。
//
// - 散歩開始時の元気度の初期値は5（絶好調）
// - おしっこボタンを散歩中・散歩編集の画面から外す（過去の記録の 💧 表示は残す）
// - 散歩終了のLINE通知からおしっこの項目を外す（ボタンが無いと常に「なし」と誤って届くため）
//
//   node tests/verify-walk-record-options.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const app = read('src/app.js');
const walk = read('src/walk.js');
const index = read('functions/index.js');
const onWalkCreated = (index.match(/exports\.onWalkCreated[\s\S]*?\n\s*\}\);/) || [''])[0];

const results = [];
const check = (name, condition) => results.push({ name, ok: !!condition });

check('散歩開始時の元気度の初期値は5', /pooFirmness: 3, energy: 5,/.test(app));
check('散歩中の画面におしっこボタンが無い', !/'💧 おしっこ'/.test(app));
check('散歩編集の画面におしっこボタンが無い', !/'💧 おしっこ'/.test(walk));
check('散歩中の記録ボタンは2列（うんち・水）', /grid grid-cols-2 gap-2' },\s*React\.createElement\('button', \{ onClick: \(\) => setCurrentWalk\(\{ \.\.\.currentWalk, poo:/.test(app));
check('散歩編集の記録ボタンは2列（うんち・水）', /grid grid-cols-2 gap-2' },\s*React\.createElement\('button', \{\s*onClick: \(\) => setFormData\(\{ \.\.\.formData, poo:/.test(walk));
check('過去の記録の 💧 表示は残す（履歴一覧2か所）', (app.match(/item\.pee && React\.createElement/g) || []).length === 2);
check('onWalkCreated を特定できる', onWalkCreated.length > 0);
check('散歩終了のLINE通知におしっこの項目が無い', onWalkCreated && !/おしっこ/.test(onWalkCreated) && !/peeStr/.test(onWalkCreated));
check('散歩終了のLINE通知にうんちの項目は残る', /うんち: \$\{pooStr\}/.test(onWalkCreated));

let failed = 0;
for (const r of results) { console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`); if (!r.ok) failed += 1; }
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
