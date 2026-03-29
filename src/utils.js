// @ts-nocheck
// 共通ユーティリティ関数

import { WEATHER_API_KEY } from './constants.js';

const getFirmnessLabel = (value) => {
    const labels = { 1: 'とてもやわらかい', 2: 'やわらかい', 3: '普通', 4: '硬め', 5: '硬い' };
    return labels[value] || '普通';
};

const getFirmnessEmoji = (firmness) => {
    const emojis = { 1: '💧💧', 2: '💧', 3: '✅', 4: '⚠️', 5: '🔴' };
    return emojis[firmness] || '✅';
};

const getFoodAmountLabel = (value) => {
    const labels = { 1: '空っぽ', 2: '少し', 3: '普通', 4: '多め', 5: '満杯' };
    return labels[value] + ` (${value}/5)`;
};

const getEnergyLabel = (value) => {
    const labels = { 1: '絶不調 😫', 2: '不調 😓', 3: '普通 😐', 4: '元気 🙂', 5: '絶好調 😆' };
    return labels[value] || '普通 😐';
};

const fetchWeatherData = async (lat, lng) => {
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

const getWeatherEmoji = (iconCode) => {
    if (!iconCode) return '🌤️';
    const map = {
        '01': '☀️', '02': '⛅', '03': '☁️', '04': '☁️',
        '09': '🌧️', '10': '☔', '11': '⚡', '13': '⛄', '50': '🌫️',
    };
    const code = iconCode.substring(0, 2);
    return map[code] || '🌤️';
};

const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const toLocalISOString = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const compressImage = (file) => {
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

function getWeekStart(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day;
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
}

function getMonthStart(d) {
    const date = new Date(d);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date;
}

function calculateStats(walks, healthRecords, startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const filteredWalks = walks.filter(w => {
        const d = new Date(w.startTime);
        return d >= start && d <= end;
    });

    const filteredHealth = healthRecords.filter(h => {
        const d = new Date(h.date);
        return d >= start && d <= end;
    });

    const totalDistance = filteredWalks.reduce((sum, w) => sum + (w.distance || 0), 0);
    const totalDuration = filteredWalks.reduce((sum, w) => sum + (w.duration || 0), 0);

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

    return {
        count: filteredWalks.length,
        totalDistance,
        totalDuration,
        mealCount,
        pooCount,
        avgDuration: filteredWalks.length > 0 ? totalDuration / filteredWalks.length : 0,
        walkerStats
    };
}

function getPeriodLabel(period) {
    const now = new Date();
    if (period === 'week') {
        const start = getWeekStart(now);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return `今週 (${start.getMonth() + 1}/${start.getDate()}〜${end.getMonth() + 1}/${end.getDate()})`;
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

// モーダル表示時の背景スクロール防止フック
const useModalScrollLock = (isOpen) => {
    const { useEffect } = React;
    useEffect(() => {
        if (isOpen) {
            const originalStyle = window.getComputedStyle(document.body).overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalStyle;
            };
        }
    }, [isOpen]);
};

export {
    getFirmnessLabel,
    getFirmnessEmoji,
    getFoodAmountLabel,
    getEnergyLabel,
    fetchWeatherData,
    getWeatherEmoji,
    getTodayDateString,
    toLocalISOString,
    compressImage,
    getWeekStart,
    getMonthStart,
    calculateStats,
    getPeriodLabel,
    useModalScrollLock
};
