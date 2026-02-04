export const APP_VERSION = 'v3.0.0';

export const WEATHER_API_KEY = "ba80598060806c2e4741766d34286357";

export const BADGES = [
    { id: 'first', name: '初めての散歩', icon: '🎉', condition: (c) => c >= 1 },
    { id: 'ten', name: '散歩10回', icon: '🌟', condition: (c) => c >= 10 },
    { id: 'fifty', name: '散歩50回', icon: '⭐', condition: (c) => c >= 50 },
    { id: 'hundred', name: '散歩100回', icon: '👑', condition: (c) => c >= 100 },
    { id: 'distance10', name: '合計10km', icon: '🏃', condition: (c, d) => d >= 10000 },
    { id: 'distance50', name: '合計50km', icon: '🚀', condition: (c, d) => d >= 50000 },
    { id: 'distance100', name: '合計100km', icon: '🎖️', condition: (c, d) => d >= 100000 }
];
