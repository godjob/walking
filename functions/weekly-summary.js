/**
 * 週間サマリーの集計と文面作成（v2.18.0）
 *
 * Firestore に触れない純粋関数だけを置く。index.js が記録を読み込み、
 * 日時を Date に揃えた `at` を付けて渡す（散歩: startTime / お世話: date）。
 * テスト: node tests/verify-weekly-summary.js
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_WEEKS = 4;      // 「この週は記録なし」の判定に使う直近の週数
const TEXT_LIMIT = 5000;       // LINE テキストメッセージ1通の上限文字数
const MAX_MESSAGES = 5;        // LINE 1回の送信で送れる吹き出しの上限

// アプリの CARE_TYPES（src/constants.js）と同じ並び。ラベルは略さず書く
const CARE_TYPES = [
    { type: 'walk', label: '散歩', emoji: '🚶' },
    { type: 'excretion', label: '排泄', emoji: '💩' },
    { type: 'food', label: 'ご飯', emoji: '🥣' },
    { type: 'medicine', label: '薬', emoji: '💊' },
    { type: 'bath', label: '入浴', emoji: '🛁' },
    { type: 'brushing', label: 'ブラッシング', emoji: '✨' },
    { type: 'cleaning', label: '掃除', emoji: '🧹' },
    { type: 'weight', label: '体重', emoji: '⚖️' },
    { type: 'grooming', label: '散髪', emoji: '✂️' },
    { type: 'hospital', label: '病院', emoji: '🏥' },
    { type: 'yard', label: '庭遊び', emoji: '🏡' }
];
const CARE_TYPE_MAP = Object.fromEntries(CARE_TYPES.map((c) => [c.type, c]));
const FIRMNESS_LABELS = { 1: 'とてもやわらかい', 2: 'やわらかい', 3: '普通', 4: '硬め', 5: '硬い' };
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// JST の暦で読むための Date（getUTC* で JST の年月日時を取り出す）
const toJst = (date) => new Date(date.getTime() + JST_OFFSET_MS);

// 実行時刻の直前に終わった月曜0:00〜翌月曜0:00（JST・終了は含まない）
function getWeekRange(now) {
    const jst = toJst(now);
    const daysSinceMonday = (jst.getUTCDay() + 6) % 7;
    const thisMonday = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate() - daysSinceMonday) - JST_OFFSET_MS;
    const start = new Date(thisMonday - 7 * DAY_MS);
    return {
        start,
        end: new Date(thisMonday),
        prevStart: new Date(start.getTime() - 7 * DAY_MS),
        lookbackStart: new Date(start.getTime() - LOOKBACK_WEEKS * 7 * DAY_MS)
    };
}

// 設定ドキュメントが無い・項目が無い場合は ON として扱う
function isWeeklySummaryEnabled(settings) {
    return !(settings && settings.weeklySummaryEnabled === false);
}

const inRange = (rec, from, to) => rec.at >= from && rec.at < to;
const byTime = (a, b) => a.at - b.at;
const formatMonthDay = (date) => { const d = toJst(date); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
const shortYear = (date) => String(toJst(date).getUTCFullYear()).slice(-2);
// 26/9/14〜9/20。年をまたぐ週だけ終わりにも年を付ける（26/12/28〜27/1/3）
const formatWeekLabel = (start, lastDay) => `${shortYear(start)}/${formatMonthDay(start)}〜`
    + (shortYear(start) === shortYear(lastDay) ? '' : `${shortYear(lastDay)}/`) + formatMonthDay(lastDay);
const formatEntryTime = (date) => {
    const d = toJst(date);
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAYS[d.getUTCDay()]}) ${hh}:${mm}`;
};
const formatDuration = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h > 0 ? `${h}時間${m}分` : `${m}分`;
};
const signed = (n, digits = 0) => (n >= 0 ? '+' : '-') + Math.abs(n).toFixed(digits);
const walkersOf = (walk) => (Array.isArray(walk.walkers) ? walk.walkers : (walk.walkers ? [walk.walkers] : []));
const toKm = (walks) => walks.reduce((sum, w) => sum + (Number(w.distance) || 0), 0) / 1000;

function buildWalkLines(weekWalks, prevWalks) {
    const km = toKm(weekWalks);
    const minutes = weekWalks.reduce((sum, w) => sum + (Number(w.duration) || 0), 0);
    const lines = [`🚶 散歩 ${weekWalks.length}回 / ${km.toFixed(1)}km / 合計${formatDuration(minutes)}`];
    lines.push(`   先週比 ${signed(weekWalks.length - prevWalks.length)}回 / ${signed(km - toKm(prevWalks), 1)}km`);

    // 担当者ランキング（同数は先に登場した順）
    const counts = new Map();
    weekWalks.slice().sort(byTime).forEach((w) => walkersOf(w).forEach((name) => counts.set(name, (counts.get(name) || 0) + 1)));
    if (counts.size > 0) {
        const ranking = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => `${name} ${n}回`);
        lines.push(`👑 担当者：${ranking.join('・')}`);
    }
    return lines;
}

function buildConditionLine(weekWalks, weekHealth) {
    const parts = [];
    const energies = weekWalks.map((w) => Number(w.energy)).filter((n) => n >= 1 && n <= 5);
    if (energies.length > 0) {
        parts.push(`😆 元気度 平均${(energies.reduce((a, b) => a + b, 0) / energies.length).toFixed(1)}`);
    }
    // うんち: 散歩中・排泄記録・庭遊び中の合計
    const firmness = [];
    let pooCount = 0;
    weekWalks.forEach((w) => { if (w.poo) { pooCount += 1; if (w.pooFirmness) firmness.push(Number(w.pooFirmness)); } });
    weekHealth.forEach((h) => {
        if (h.type === 'excretion') { pooCount += 1; if (h.pooFirmness) firmness.push(Number(h.pooFirmness)); }
        if (h.type === 'yard' && h.yardPoo) { pooCount += 1; if (h.yardPooFirmness) firmness.push(Number(h.yardPooFirmness)); }
    });
    if (pooCount > 0) {
        const avg = firmness.length > 0 ? Math.round(firmness.reduce((a, b) => a + b, 0) / firmness.length) : null;
        parts.push(`💩 うんち ${pooCount}回` + (avg ? `（硬さ平均：${FIRMNESS_LABELS[avg]}）` : ''));
    }
    return parts.length > 0 ? [parts.join(' / ')] : [];
}

function buildCareLines(weekHealth, beforeHealth) {
    const counts = CARE_TYPES
        .filter((c) => c.type !== 'walk')
        .map((c) => ({ ...c, n: weekHealth.filter((h) => h.type === c.type).length }))
        .filter((c) => c.n > 0);
    const lines = ['🐾 お世話'];
    lines.push(counts.length > 0 ? ' ' + counts.map((c) => `${c.emoji}${c.label} ${c.n}`).join(' / ') : ' 記録なし');

    const latestWeight = (records) => {
        const w = records.filter((h) => h.type === 'weight' && !Number.isNaN(parseFloat(h.weight))).sort(byTime);
        return w.length > 0 ? parseFloat(w[w.length - 1].weight) : null;
    };
    const current = latestWeight(weekHealth);
    if (current !== null) {
        const before = latestWeight(beforeHealth);
        lines.push(` ⚖️ 体重 ${current}kg` + (before !== null ? `（先週比 ${signed(current - before, 1)}kg）` : ''));
    }
    return lines;
}

// 直近4週間に1回以上あるのに、この週は0回だったお世話
function buildMissingLine(weekRecords, lookbackRecords) {
    const done = new Set(weekRecords.map((r) => r.type));
    const usual = new Set(lookbackRecords.map((r) => r.type));
    const missing = CARE_TYPES.filter((c) => usual.has(c.type) && !done.has(c.type));
    return missing.length > 0 ? [`⚠️ この週は記録なし：${missing.map((c) => c.emoji + c.label).join('・')}`] : [];
}

function buildMemoEntries(weekWalks, weekHealth) {
    const records = weekWalks.map((w) => ({ ...w, type: 'walk', who: walkersOf(w).join('・') }))
        .concat(weekHealth.map((h) => ({ ...h, who: h.walker || '' })))
        .sort(byTime);
    const entries = [];
    records.forEach((r) => {
        const memo = (r.memo || '').trim();
        const reason = r.type === 'hospital' ? (r.reason || '').trim() : '';
        if (!memo && !reason) return;
        const care = CARE_TYPE_MAP[r.type] || { emoji: '🐾', label: 'お世話' };
        const lines = [`${formatEntryTime(r.at)} ${care.emoji}${care.label}` + (r.who ? `（${r.who}）` : '')];
        if (reason) lines.push(` 理由：${reason}`);
        if (memo) memo.split(/\r?\n/).forEach((line) => lines.push(` ${line}`));
        entries.push(lines.join('\n'));
    });
    return entries;
}

// メモを 5000 文字ごとの吹き出しに詰める。入りきらなければ最後に「…ほかN件」
function packMemoMessages(entries, maxMessages) {
    if (entries.length === 0) return [];
    const header = `📝 この週のメモ（${entries.length}件）`;
    const SEP = '\n\n';
    const restNote = (n) => `…ほか${n}件はアプリで確認してください`;
    const REST_RESERVE = SEP.length + restNote(entries.length).length;

    const chunks = [];
    let current = header;
    let i = 0;
    for (; i < entries.length; i += 1) {
        const isLastChunk = chunks.length === maxMessages - 1;
        const limit = isLastChunk && i < entries.length - 1 ? TEXT_LIMIT - REST_RESERVE : TEXT_LIMIT;
        let entry = entries[i];
        // 1件だけで上限を超える場合は切り詰める
        const room = limit - current.length - SEP.length;
        if (entry.length > TEXT_LIMIT - header.length - SEP.length - REST_RESERVE) {
            entry = entry.slice(0, TEXT_LIMIT - header.length - SEP.length - REST_RESERVE - 1) + '…';
        }
        if (entry.length <= room) {
            current += SEP + entry;
            continue;
        }
        if (isLastChunk) break;
        chunks.push(current);
        current = entry;
    }
    if (i < entries.length) current += SEP + restNote(entries.length - i);
    chunks.push(current);
    return chunks;
}

/**
 * @param {{ walks: Array, health: Array, now: Date }} params
 *   walks / health は `at`（Date）付き。直近4週間＋対象週を含めて渡す
 * @returns {Array<{type: 'text', text: string}>} LINE に送る吹き出し（最大5通）
 */
function buildWeeklySummaryMessages({ walks, health, now }) {
    const range = getWeekRange(now);
    const weekWalks = walks.filter((w) => inRange(w, range.start, range.end));
    const prevWalks = walks.filter((w) => inRange(w, range.prevStart, range.start));
    const weekHealth = health.filter((h) => inRange(h, range.start, range.end));
    const beforeHealth = health.filter((h) => h.at < range.start);
    const lookback = walks.map((w) => ({ ...w, type: 'walk' })).concat(health)
        .filter((r) => inRange(r, range.lookbackStart, range.start));
    const weekRecords = weekWalks.map((w) => ({ ...w, type: 'walk' })).concat(weekHealth);

    const lastDay = new Date(range.end.getTime() - DAY_MS);
    const sections = [
        [`📊 福のお世話　週間サマリー（${formatWeekLabel(range.start, lastDay)}）`],
        buildWalkLines(weekWalks, prevWalks).concat(buildConditionLine(weekWalks, weekHealth)),
        buildCareLines(weekHealth, beforeHealth),
        buildMissingLine(weekRecords, lookback)
    ].filter((s) => s.length > 0);

    const summary = sections.map((s) => s.join('\n')).join('\n\n');
    const memoTexts = packMemoMessages(buildMemoEntries(weekWalks, weekHealth), MAX_MESSAGES - 1);
    return [summary].concat(memoTexts).map((text) => ({ type: 'text', text }));
}

module.exports = {
    getWeekRange,
    isWeeklySummaryEnabled,
    buildWeeklySummaryMessages,
    LOOKBACK_WEEKS,
    TEXT_LIMIT
};
