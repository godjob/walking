// @ts-nocheck
// dist/tailwind.css が、コード中で実際に使われている Tailwind クラスを
// すべて含んでいるかを検証する。
//
// cdn.tailwindcss.com（ブラウザ上でJITコンパイルする Play CDN）を
// 生成済みCSSに置き換えたため、抽出漏れがあると無言でスタイルが崩れる。
// Tailwind クラスを追加・変更したあとは必ず CSS を再生成して本テストを通すこと。
//
//   npx tailwindcss@3 -i src/tailwind-input.css -o dist/tailwind.css \
//     --content "./index.html,./src/**/*.js" --minify
//   node tests/verify-tailwind-css.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CSS_PATH = path.join(ROOT, 'dist', 'tailwind.css');
const INDEX_PATH = path.join(ROOT, 'index.html');
const SRC_DIR = path.join(ROOT, 'src');

// className: '...' / className: `...` / class="..." の中身を集める
const collectUsedClasses = () => {
    const files = [INDEX_PATH].concat(
        fs.readdirSync(SRC_DIR)
            .filter((f) => f.endsWith('.js'))
            .map((f) => path.join(SRC_DIR, f))
    );

    const used = new Map(); // class -> 使用ファイルの集合

    for (const file of files) {
        const code = fs.readFileSync(file, 'utf8');
        const rel = path.relative(ROOT, file);
        const literals = [];

        // JS: className: '...' または className: `...`
        const jsRe = /className:\s*(['`])([\s\S]*?)\1/g;
        let m;
        while ((m = jsRe.exec(code)) !== null) literals.push(m[2]);

        // HTML: class="..."
        const htmlRe = /\sclass="([^"]*)"/g;
        while ((m = htmlRe.exec(code)) !== null) literals.push(m[1]);

        for (const literal of literals) {
            // テンプレートリテラルの ${...} は区切りとして扱う
            // （分割されたクラス名は存在しないことを確認済み）
            literal
                .replace(/\$\{[\s\S]*?\}/g, ' ')
                .split(/\s+/)
                .map((t) => t.trim())
                .filter(Boolean)
                .forEach((cls) => {
                    if (!used.has(cls)) used.set(cls, new Set());
                    used.get(cls).add(rel);
                });
        }
    }

    return used;
};

// CSS のセレクタからクラス名を取り出す。
// 例) .hover\:bg-gray-300:hover -> hover:bg-gray-300 / .w-1\/2 -> w-1/2
const collectDefinedClasses = (css) => {
    const defined = new Set();
    const re = /\.((?:[^\s.,:#>+~[\]{}()'"\\]|\\.)+)/g;
    let m;
    while ((m = re.exec(css)) !== null) {
        defined.add(m[1].replace(/\\/g, ''));
    }
    return defined;
};

// index.html の <style> で自前定義しているクラス（Tailwind の管轄外）
const collectLocalClasses = () => {
    const html = fs.readFileSync(INDEX_PATH, 'utf8');
    const style = html.match(/<style>([\s\S]*?)<\/style>/);
    return style ? collectDefinedClasses(style[1]) : new Set();
};

const main = () => {
    if (!fs.existsSync(CSS_PATH)) {
        console.error('FAIL: dist/tailwind.css が存在しません（未生成）');
        process.exit(1);
    }

    const css = fs.readFileSync(CSS_PATH, 'utf8');
    const defined = collectDefinedClasses(css);
    const local = collectLocalClasses();
    const used = collectUsedClasses();

    const missing = [];
    for (const [cls, files] of used) {
        if (defined.has(cls) || local.has(cls)) continue;
        missing.push({ cls, files: Array.from(files).join(', ') });
    }

    console.log(`検証対象: ${used.size} クラス（使用箇所から抽出）`);
    console.log(`生成CSS内の定義: ${defined.size} クラス`);
    console.log(`index.html の自前CSS: ${local.size} クラス`);
    console.log(`CSSサイズ: ${(css.length / 1024).toFixed(1)} KB`);

    if (missing.length > 0) {
        console.error(`\nFAIL: 生成CSSに定義がないクラスが ${missing.length} 件あります`);
        for (const { cls, files } of missing) {
            console.error(`  - ${cls}  (${files})`);
        }
        process.exit(1);
    }

    console.log('\nPASS: 使用中のクラスはすべて生成CSSに含まれています');
};

main();
