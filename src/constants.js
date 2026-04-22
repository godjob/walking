// @ts-nocheck
// 定数・バッジ定義・デフォルト設定

const APP_VERSION = 'v2.12.0';

const DEFAULT_SETTINGS = {
    stopDetectionRadius: 10,
    stopDetectionDuration: 30,
    autoEndEnabled: true,
    autoEndAfterStop: 600,
    gpsUpdateInterval: 5,
    minimumDistanceThreshold: 5,
};

const badges = [
    { id: 'first', name: '初めての散歩', icon: '🎉', condition: (c) => c >= 1 },
    { id: 'ten', name: '散歩10回', icon: '🌟', condition: (c) => c >= 10 },
    { id: 'fifty', name: '散歩50回', icon: '⭐', condition: (c) => c >= 50 },
    { id: 'hundred', name: '散歩100回', icon: '👑', condition: (c) => c >= 100 },
    { id: 'distance10', name: '合計10km', icon: '🏃', condition: (c, d) => d >= 10000 },
    { id: 'distance50', name: '合計50km', icon: '🚀', condition: (c, d) => d >= 50000 },
    { id: 'distance100', name: '合計100km', icon: '🎖️', condition: (c, d) => d >= 100000 }
];

const WEATHER_API_KEY = "ba80598060806c2e4741766d34286357";

const ITEMS_PER_PAGE = 20;

export { APP_VERSION, DEFAULT_SETTINGS, badges, WEATHER_API_KEY, ITEMS_PER_PAGE };
