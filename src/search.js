// @ts-nocheck
// ホーム画面「福のお世話」一覧の検索・絞り込みロジック（純粋関数のみ）

import { CARE_TYPES } from './constants.js';
import { getWeekStart, getMonthStart } from './utils.js';

// 検索条件の初期値。すべて「未指定＝絞り込みなし」を意味する
const DEFAULT_SEARCH = {
    types: [],        // お世話の種類（空配列＝すべて）
    period: 'all',    // 'today' | 'week' | 'month' | 'all' | 'custom'
    from: '',         // 'YYYY-MM-DD'（period === 'custom' のとき有効）
    to: '',           // 'YYYY-MM-DD'（period === 'custom' のとき有効）
    walker: '',       // 担当者名（空＝すべて）
    keyword: '',      // フリーワード（空＝すべて）
    photo: 'all'      // 'all' | 'with' | 'without'
};

const PERIOD_LABELS = {
    today: '今日',
    week: '今週',
    month: '今月',
    all: '全期間',
    custom: '期間指定'
};

const PHOTO_LABELS = {
    with: '📷あり',
    without: '📷なし'
};

// 散歩は startTime、お世話は date に日時が入っている
const getRecordDate = (record) => {
    if (!record) return null;
    return record.type === 'walk' ? record.startTime : record.date;
};

// 'YYYY-MM-DD' をローカルタイムの Date に変換する（new Date(str) はUTC解釈になるため使わない）
const parseDateInput = (str, endOfDay) => {
    if (!str) return null;
    const parts = String(str).split('-');
    if (parts.length !== 3) return null;
    const [y, m, d] = parts.map(Number);
    if (!y || !m || !d) return null;
    return endOfDay
        ? new Date(y, m - 1, d, 23, 59, 59, 999)
        : new Date(y, m - 1, d, 0, 0, 0, 0);
};

// 検索対象期間を { start, end } で返す。null は無制限を表す
const getPeriodRange = (period, from, to, baseDate) => {
    const base = baseDate ? new Date(baseDate) : new Date();

    if (period === 'today') {
        const start = new Date(base);
        start.setHours(0, 0, 0, 0);
        const end = new Date(base);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    if (period === 'week') {
        // 既存の統計と同じ日曜起点の週
        const start = getWeekStart(base);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    if (period === 'month') {
        const start = getMonthStart(base);
        const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    if (period === 'custom') {
        const start = parseDateInput(from, false);
        const end = parseDateInput(to, true);
        if (!start && !end) return null;
        return { start, end };
    }

    return null; // 'all'
};

// 種類フィルタ。排泄は散歩中の poo・庭遊びの yardPoo も対象に含める
const matchesCareType = (record, types) => {
    if (!Array.isArray(types) || types.length === 0) return true;
    return types.some((t) => {
        if (t === 'excretion') {
            if (record.type === 'excretion') return true;
            if (record.type === 'walk' && record.poo) return true;
            if (record.type === 'yard' && record.yardPoo) return true;
            return false;
        }
        return record.type === t;
    });
};

const matchesPeriod = (record, range) => {
    if (!range) return true;
    const raw = getRecordDate(record);
    if (!raw) return false;
    const time = new Date(raw).getTime();
    if (Number.isNaN(time)) return false;
    if (range.start && time < range.start.getTime()) return false;
    if (range.end && time > range.end.getTime()) return false;
    return true;
};

// 散歩は walkers（配列）、お世話は walker（文字列）に担当者が入っている
const getRecordWalkers = (record) => {
    if (record.type === 'walk') {
        if (Array.isArray(record.walkers)) return record.walkers;
        return record.walkers ? [record.walkers] : [];
    }
    return record.walker ? [record.walker] : [];
};

const matchesWalker = (record, walker) => {
    if (!walker) return true;
    return getRecordWalkers(record).includes(walker);
};

const matchesKeyword = (record, keyword) => {
    const kw = (keyword || '').trim().toLowerCase();
    if (!kw) return true;
    const haystack = [
        record.memo,
        record.hospitalName,
        record.medicineType,
        record.shopName,
        getRecordWalkers(record).join(' ')
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(kw);
};

const matchesPhoto = (record, photo) => {
    if (!photo || photo === 'all') return true;
    const count = Array.isArray(record.photos) ? record.photos.length : 0;
    return photo === 'with' ? count > 0 : count === 0;
};

// 記録一覧を検索条件で絞り込む。元の配列は変更せず新しい配列を返す
const filterCareRecords = (records, search, baseDate) => {
    if (!Array.isArray(records)) return [];
    const s = { ...DEFAULT_SEARCH, ...(search || {}) };
    const range = getPeriodRange(s.period, s.from, s.to, baseDate);
    return records.filter((r) =>
        matchesCareType(r, s.types)
        && matchesPeriod(r, range)
        && matchesWalker(r, s.walker)
        && matchesKeyword(r, s.keyword)
        && matchesPhoto(r, s.photo)
    );
};

// 何らかの絞り込みが有効かどうか（「記録が消えた」と誤解されないよう表示に使う）
const isSearchActive = (search) => {
    const s = { ...DEFAULT_SEARCH, ...(search || {}) };
    return (Array.isArray(s.types) && s.types.length > 0)
        || (s.period && s.period !== 'all')
        || !!s.walker
        || !!(s.keyword && s.keyword.trim())
        || (s.photo && s.photo !== 'all');
};

// 絞り込み中に常時表示する条件サマリー文字列を組み立てる
const buildSearchSummary = (search) => {
    const s = { ...DEFAULT_SEARCH, ...(search || {}) };
    const parts = [];

    if (Array.isArray(s.types) && s.types.length > 0) {
        const labels = s.types.map((t) => {
            const def = CARE_TYPES.find((c) => c.type === t);
            return def ? def.emoji + def.label : t;
        });
        parts.push(labels.length > 3 ? `${labels.slice(0, 3).join('・')} 他${labels.length - 3}件` : labels.join('・'));
    }

    if (s.period && s.period !== 'all') {
        if (s.period === 'custom') {
            parts.push(`${s.from || '最初'}〜${s.to || '最新'}`);
        } else {
            parts.push(PERIOD_LABELS[s.period] || s.period);
        }
    }

    if (s.walker) parts.push(`👤${s.walker}`);
    if (s.photo && s.photo !== 'all') parts.push(PHOTO_LABELS[s.photo]);
    if (s.keyword && s.keyword.trim()) parts.push(`「${s.keyword.trim()}」`);

    return parts.join(' / ');
};

export {
    DEFAULT_SEARCH,
    PERIOD_LABELS,
    PHOTO_LABELS,
    getRecordDate,
    getPeriodRange,
    matchesCareType,
    filterCareRecords,
    isSearchActive,
    buildSearchSummary
};
