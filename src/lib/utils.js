import { WEATHER_API_KEY } from './constants';

export const getFirmnessLabel = (value) => {
    const labels = { 1: 'とてもやわらかい', 2: 'やわらかい', 3: '普通', 4: '硬め', 5: '硬い' };
    return labels[value] || '普通';
};

export const getFirmnessEmoji = (firmness) => {
    const emojis = { 1: '💧💧', 2: '💧', 3: '✅', 4: '⚠️', 5: '🔴' };
    return emojis[firmness] || '✅';
};

export const getFoodAmountLabel = (value) => {
    const labels = { 1: '空っぽ', 2: '少し', 3: '普通', 4: '多め', 5: '満杯' };
    return (labels[value] || '普通') + ` (${value}/5)`;
};

export const getEnergyLabel = (value) => {
    const labels = { 1: '絶不調 😫', 2: '不調 😓', 3: '普通 😐', 4: '元気 🙂', 5: '絶好調 😆' };
    return labels[value] || '普通 😐';
};

export const fetchWeatherData = async (lat, lng) => {
    try {
        if (!WEATHER_API_KEY) return null;
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${WEATHER_API_KEY}&units=metric&lang=ja`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Weather API Error');
        const data = await response.json();
        return {
            condition: data.weather[0].description,
            icon: data.weather[0].icon,
            temp: Math.round(data.main.temp * 10) / 10,
            wind: Math.round(data.wind.speed * 10) / 10
        };
    } catch (error) {
        console.warn("天気情報の取得に失敗しましたが、処理を継続します:", error);
        return null;
    }
};

export const getWeatherEmoji = (iconCode) => {
    if (!iconCode) return '🌤️';
    const map = {
        '01': '☀️', '02': '⛅', '03': '☁️', '04': '☁️',
        '09': '🌧️', '10': '☔', '11': '⚡', '13': '⛄', '50': '🌫️',
    };
    const code = iconCode.substring(0, 2);
    return map[code] || '🌤️';
};

export const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const toLocalISOString = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const compressImage = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200;
                const scaleSize = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
                canvas.width = img.width * scaleSize;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Image compression failed'));
                    }
                }, 'image/jpeg', 0.7);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

export function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
}

export function getPeriodLabel(period) {
    const now = new Date();
    if (period === 'week') {
        const monday = getMonday(now);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return `今週 (${monday.getMonth() + 1}/${monday.getDate()}〜${sunday.getMonth() + 1}/${sunday.getDate()})`;
    } else if (period === 'month') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return `今月 (${firstDay.getMonth() + 1}/${firstDay.getDate()}〜${lastDay.getMonth() + 1}/${lastDay.getDate()})`;
    } else if (period === 'year') {
        return `今年 (${now.getFullYear()}年)`;
    } else {
        return '全期間';
    }
}

export const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export const calculateTotalDistance = (positions) => {
    if (!positions || positions.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < positions.length; i++) {
        total += calculateDistance(positions[i - 1].lat, positions[i - 1].lng, positions[i].lat, positions[i].lng);
    }
    return total;
};

export const formatRelativeTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 24 && diffHours >= 0) {
        if (diffHours < 1) {
            const diffMins = Math.floor(diffMs / (1000 * 60));
            return diffMins <= 0 ? 'たった今' : `${diffMins}分前`;
        }
        return `${Math.floor(diffHours)}時間前`;
    }
    const year = d.getFullYear().toString().slice(-2);
    return `${year}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const formatSimpleTimeAgo = (date) => {
    if (!date) return '';
    const now = new Date();
    const d = new Date(date);
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMins < 60) return `${diffMins}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays < 30) return `${diffDays}日前`;
    if (diffMonths < 12) return `${diffMonths}ヶ月前`;
    return '1年以上前';
};

export const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear().toString().slice(-2);
    return `${year}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const formatTimer = (start, now) => {
    if (!start) return '0分00秒';
    const diffMs = now - start;
    const mins = Math.floor(diffMs / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    return `${mins}分${secs.toString().padStart(2, '0')}秒`;
};

export const getStats = (period, walks, healthRecords) => {
    const now = new Date();
    const startDate = new Date();
    if (period === 'week') {
        const monday = getMonday(now);
        startDate.setTime(monday.getTime());
        startDate.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
        startDate.setDate(1); startDate.setHours(0, 0, 0, 0);
    } else if (period === 'year') {
        startDate.setMonth(0, 1); startDate.setHours(0, 0, 0, 0);
    } else { startDate.setFullYear(2000, 0, 1); }
    const filteredWalks = period === 'all' ? walks : walks.filter(w => w.startTime >= startDate);
    const totalDistance = filteredWalks.reduce((sum, w) => sum + (w.distance || 0), 0);
    const totalDuration = filteredWalks.reduce((sum, w) => sum + (w.duration || 0), 0);
    const filteredHealth = period === 'all' ? healthRecords : healthRecords.filter(r => r.date >= startDate);
    const mealCount = filteredHealth.filter(r => r.type === 'food').length;

    const healthPooCount = filteredHealth.filter(r => r.type === 'excretion').length;
    const walkPooCount = filteredWalks.filter(w => w.poo).length;
    const pooCount = healthPooCount + walkPooCount;

    const walkerStats = {};
    filteredWalks.forEach(w => {
        const walkerList = Array.isArray(w.walkers) ? w.walkers : [w.walkers];
        walkerList.forEach(walker => {
            if (!walkerStats[walker]) { walkerStats[walker] = { count: 0, distance: 0, duration: 0 }; }
            walkerStats[walker].count += 1; walkerStats[walker].distance += w.distance || 0; walkerStats[walker].duration += w.duration || 0;
        });
    });
    return { count: filteredWalks.length, totalDistance, totalDuration, mealCount, pooCount, avgDuration: filteredWalks.length > 0 ? totalDuration / filteredWalks.length : 0, walkerStats };
};
