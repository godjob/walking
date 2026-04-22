// @ts-nocheck
// メインAppコンポーネント・ReactDOM.render() エントリーポイント

import { db, storage, functions } from './firebase-init.js';
import { APP_VERSION, DEFAULT_SETTINGS, badges, ITEMS_PER_PAGE } from './constants.js';
import {
    getFirmnessLabel,
    getFirmnessEmoji,
    getEnergyLabel,
    getWeatherEmoji,
    getTodayDateString,
    compressImage,
    getWeekStart,
    getMonthStart,
    calculateStats,
    getPeriodLabel,
    fetchWeatherData,
    useModalScrollLock
} from './utils.js';
import { PhotoViewer, MapView } from './map.js';
import { WalkEditForm } from './walk.js';
import { CareHistoryChart, HealthForm } from './health.js';
import { SettingsScreen } from './settings.js';

const { useState, useEffect, useRef, useLayoutEffect, useMemo } = React;

function App() {
    const [activeTab, setActiveTab] = useState('home');
    const [isWalking, setIsWalking] = useState(false);
    const [currentWalk, setCurrentWalk] = useState(null);
    const [walks, setWalks] = useState([]);
    const [healthRecords, setHealthRecords] = useState([]);
    const [walkers, setWalkers] = useState([]);
    const [selectedWalkers, setSelectedWalkers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newWalkerName, setNewWalkerName] = useState('');
    const [showAddWalker, setShowAddWalker] = useState(false);
    const [uploadingPhotos, setUploadingPhotos] = useState(false);
    const [photos, setPhotos] = useState([]);
    const [statsView, setStatsView] = useState('week');
    const [showHealthForm, setShowHealthForm] = useState(false);
    const [healthType, setHealthType] = useState('hospital');
    const [editingWalk, setEditingWalk] = useState(null);
    const [editingHealth, setEditingHealth] = useState(null);
    const [showMap, setShowMap] = useState(null);
    const [viewingPhoto, setViewingPhoto] = useState(null);
    const [now, setNow] = useState(new Date());
    const watchIdRef = useRef(null);
    const wakeLockRef = useRef(null);
    const stopCheckIntervalRef = useRef(null);
    const lastGpsUpdateRef = useRef(0);
    const lastActivePositionRef = useRef(null);
    const [lastPositionTime, setLastPositionTime] = useState(Date.now());
    const [showWalkWarning, setShowWalkWarning] = useState(false);
    useModalScrollLock(showWalkWarning);

    // const stationaryTimeRef = useRef(0); // Removed in v2.9.5
    // const lastPositionRef = useRef(null); // Removed in v2.9.5
    const [showWalkSetup, setShowWalkSetup] = useState(false);

    const [settings, setSettings] = useState(DEFAULT_SETTINGS);

    useEffect(() => {
        const unsubscribe = db.collection('settings').doc('walk').onSnapshot((doc) => {
            if (doc.exists) {
                setSettings({ ...DEFAULT_SETTINGS, ...doc.data() });
            }
        });
        return () => unsubscribe();
    }, []);

    const saveSettings = async (newSettings) => {
        try {
            const dataToSave = {
                stopDetectionRadius: parseInt(newSettings.stopDetectionRadius, 10),
                stopDetectionDuration: parseInt(newSettings.stopDetectionDuration, 10),
                locationInterval: parseInt(newSettings.stopDetectionDuration, 10),
                autoEndEnabled: !!newSettings.autoEndEnabled,
                autoEndAfterStop: parseInt(newSettings.autoEndAfterStop, 10),
                gpsUpdateInterval: parseInt(newSettings.gpsUpdateInterval, 10),
                minimumDistanceThreshold: parseInt(newSettings.minimumDistanceThreshold, 10),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: 'user'
            };

            await db.collection('settings').doc('walk').set(dataToSave, { merge: true });
            alert('設定を保存しました');
        } catch (error) {
            console.error("Error saving settings: ", error);
            alert('設定の保存に失敗しました');
        }
    };

    const resetSettings = async () => {
         try {
            await db.collection('settings').doc('walk').set({
                ...DEFAULT_SETTINGS,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: 'reset'
            });
            alert('初期設定に戻しました');
        } catch (error) {
            console.error("Error resetting settings: ", error);
            alert('リセットに失敗しました');
        }
    };

    // ★独立した通知設定 (初期値: OFF)
    const [notifyStart, setNotifyStart] = useState(false);
    const [notifyEnd, setNotifyEnd] = useState(false);

    const [healthFormData, setHealthFormData] = useState({});
    const [originalHealthData, setOriginalHealthData] = useState({});

    const [homePage, setHomePage] = useState(1);
    const [healthPage, setHealthPage] = useState(1);

    const statsData = useMemo(() => {
        const now = new Date();

        const thisWeekStart = getWeekStart(now);
        const thisWeekEnd = new Date(thisWeekStart);
        thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
        thisWeekEnd.setHours(23, 59, 59, 999);

        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(thisWeekStart.getDate() - 7);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
        lastWeekEnd.setHours(23, 59, 59, 999);

        const thisMonthStart = getMonthStart(now);
        const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        thisMonthEnd.setHours(23, 59, 59, 999);

        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        lastMonthEnd.setHours(23, 59, 59, 999);

        return {
            week: calculateStats(walks, healthRecords, thisWeekStart, thisWeekEnd),
            lastWeek: calculateStats(walks, healthRecords, lastWeekStart, lastWeekEnd),
            month: calculateStats(walks, healthRecords, thisMonthStart, thisMonthEnd),
            lastMonth: calculateStats(walks, healthRecords, lastMonthStart, lastMonthEnd),
            ranges: {
                week: `${thisWeekStart.getMonth() + 1}/${thisWeekStart.getDate()}〜${thisWeekEnd.getMonth() + 1}/${thisWeekEnd.getDate()}`,
                month: `${thisMonthStart.getMonth() + 1}/${thisMonthStart.getDate()}〜${thisMonthEnd.getMonth() + 1}/${thisMonthEnd.getDate()}`
            }
        };
    }, [walks, healthRecords]);

    const renderStatItem = (label, current, previous, unit, mainColor, isFloat = false) => {
        const diff = current - previous;

        let diffStr = '';
        let diffColor = 'text-gray-500';

        if (diff > 0) {
            diffStr = '+' + (isFloat ? (diff / 1000).toFixed(1) : diff);
            diffColor = 'text-emerald-500';
        } else if (diff < 0) {
            diffStr = (isFloat ? (diff / 1000).toFixed(1) : diff);
            diffColor = 'text-red-500';
        } else {
            diffStr = '±0';
            diffColor = 'text-gray-500';
        }

        const currentVal = isFloat ? (current / 1000).toFixed(1) : current;

        return React.createElement('div', { className: 'bg-white p-2 rounded text-center' },
            React.createElement('p', { className: 'text-[10px] text-gray-600' }, label),
            React.createElement('p', { className: `text-[13px] font-bold ${mainColor} whitespace-nowrap leading-none tracking-tighter` },
                currentVal,
                React.createElement('span', { className: 'text-gray-400 ml-0.5' }, unit)
            ),
            React.createElement('p', { className: `text-[9px] font-bold whitespace-nowrap tracking-tighter ${diffColor}` },
                `(${diffStr}${unit})`
            )
        );
    };

    const formatRelativeTime = (date) => {
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

    const formatSimpleTimeAgo = (date) => {
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

    const formatDate = (date) => {
        if (!date) return '';
        const d = new Date(date);
        const year = d.getFullYear().toString().slice(-2);
        return `${year}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    useEffect(() => {
        let timer;
        if (isWalking) {
            timer = setInterval(() => setNow(new Date()), 1000);
        }
        return () => clearInterval(timer);
    }, [isWalking]);

    useEffect(() => {
        const unsubscribe = db.collection('walkers').onSnapshot((snapshot) => {
            const walkerList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            setWalkers(walkerList.sort((a, b) => a.order - b.order));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const unsubscribe = db.collection('walks').orderBy('startTime', 'desc').onSnapshot((snapshot) => {
            const walkList = snapshot.docs.map(doc => ({
                ...doc.data(), id: doc.id,
                startTime: doc.data().startTime?.toDate(),
                endTime: doc.data().endTime?.toDate()
            }));
            setWalks(walkList);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const unsubscribe = db.collection('health').orderBy('date', 'desc').onSnapshot((snapshot) => {
            const records = snapshot.docs.map(doc => ({
                ...doc.data(), id: doc.id,
                date: doc.data().date?.toDate()
            }));
            setHealthRecords(records);
        });
        return () => unsubscribe();
    }, []);

    const initHealthForm = (type, record) => {
        const initialData = {
            id: record?.id || null,
            type: record?.type || type,
            date: record ? new Date(record.date).toISOString().split('T')[0] : getTodayDateString(),
            time: record ? new Date(record.date).toTimeString().slice(0, 5) : new Date().toTimeString().slice(0, 5),
            walker: record?.walker || '',
            hospitalName: record?.hospitalName || '',
            reason: record?.reason || '',
            groomedBy: record?.groomedBy || 'walker',
            shopName: record?.shopName || '',
            medicineType: record?.medicineType || '',
            isVaccine: record?.isVaccine || false,
            pooFirmness: record?.pooFirmness || 3,
            foodAmount: record?.foodAmount || 3,
            isFloorCleaned: record?.isFloorCleaned || false,
            isToiletCleaned: record?.isToiletCleaned || false,
            isWaterChanged: record?.isWaterChanged || false,
            weight: record?.weight || '',
            yardStartTime: record?.yardStartTime || '',
            yardEndTime: record?.yardEndTime || '',
            yardPoo: record?.yardPoo || false,
            yardPooFirmness: record?.yardPooFirmness || 3,
            memo: record?.memo || '',
            photos: record?.photos || [],
            notify: false
        };
        setHealthFormData(initialData);
        setOriginalHealthData(initialData);
        setHealthType(type);
        if (record) setEditingHealth(record);
        setShowHealthForm(true);
        setShowWalkSetup(false);
    };

    const handleTabChange = (newTab) => {
        if (isWalking && newTab !== 'health') { alert('散歩中です！'); return; }
        if (activeTab === 'health' && showHealthForm) {
            const isDirty = JSON.stringify(healthFormData) !== JSON.stringify(originalHealthData);
            if (isDirty) {
                if (confirm('変更内容を保存しますか？\nOK: 保存して移動\nキャンセル: 変更を破棄して移動')) {
                    saveHealthRecord(healthFormData);
                } else { setShowHealthForm(false); setEditingHealth(null); }
            } else { setShowHealthForm(false); setEditingHealth(null); }
        }
        setActiveTab(newTab);
    };

    const toggleWalker = (walkerName) => {
        setSelectedWalkers(prev => {
            if (prev.includes(walkerName)) { return prev.filter(w => w !== walkerName); }
            else {
                if (prev.length >= 10) { alert('散歩者は最大10人までです'); return prev; }
                return [...prev, walkerName];
            }
        });
    };

    const addWalker = async () => {
        if (!newWalkerName.trim()) return;
        await db.collection('walkers').add({ name: newWalkerName.trim(), order: walkers.length });
        setNewWalkerName(''); setShowAddWalker(false);
    };

    const deleteWalker = async (walkerId) => {
        if (confirm('この散歩者を削除しますか?')) { await db.collection('walkers').doc(walkerId).delete(); }
    };

    const handlePhotoUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        if (photos.length + files.length > 4) { alert('写真は最大4枚までです'); e.target.value = ''; return; }
        setUploadingPhotos(true);
        try {
            const uploadPromises = files.map(async (file) => {
                const compressedBlob = await compressImage(file);
                const randomId = Math.random().toString(36).substring(7);
                const fileName = file.name.split('.')[0] + '.jpg';
                const ref = storage.ref(`walks/${Date.now()}_${randomId}_${fileName}`);
                await ref.put(compressedBlob);
                return await ref.getDownloadURL();
            });
            const uploadedUrls = await Promise.all(uploadPromises);
            setPhotos(prev => [...prev, ...uploadedUrls]);
        } catch (error) { console.error(error); alert('アップロード中にエラーが発生しました: ' + error.message); }
        finally { setUploadingPhotos(false); e.target.value = ''; }
    };

    const removePhoto = (index) => { setPhotos(photos.filter((_, i) => i !== index)); };

    const calculateDistance = (lat1, lng1, lat2, lng2) => {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const calculateTotalDistance = (positions) => {
        if (positions.length < 2) return 0;
        let total = 0;
        for (let i = 1; i < positions.length; i++) {
            total += calculateDistance(positions[i - 1].lat, positions[i - 1].lng, positions[i].lat, positions[i].lng);
        }
        return total;
    };

    const isWakeLockSupported = () => 'wakeLock' in navigator;

    const requestWakeLock = async () => {
        if (!isWakeLockSupported()) {
            console.warn('[Wake Lock] Not supported in this browser');
            alert('お使いのブラウザはスリープ防止機能に対応していません。散歩中は画面を手動で点灯し続けてください。');
            return;
        }

        try {
            const wakeLock = await navigator.wakeLock.request('screen');
            wakeLockRef.current = wakeLock;
            console.log('[Wake Lock] Acquired');

            wakeLock.addEventListener('release', () => {
                console.log('[Wake Lock] Released');
                wakeLockRef.current = null;
            });
        } catch (error) {
            console.error('[Wake Lock] Request failed:', error);
            if (error.name === 'NotAllowedError') {
                console.warn('[Wake Lock] Permission denied by user or system');
            } else {
                alert('スリープ防止機能の起動に失敗しました。散歩中は画面を手動で点灯し続けてください。');
            }
        }
    };

    const releaseWakeLock = async () => {
        if (wakeLockRef.current !== null) {
            try {
                await wakeLockRef.current.release();
                console.log('[Wake Lock] Released manually');
                wakeLockRef.current = null;
            } catch (error) {
                console.error('[Wake Lock] Release failed:', error);
                wakeLockRef.current = null;
            }
        }
    };

    const handlePositionSuccess = async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const timestamp = position.timestamp;

        // GPS更新間隔の制御
        if (timestamp - lastGpsUpdateRef.current < settings.gpsUpdateInterval * 1000) {
            return;
        }
        lastGpsUpdateRef.current = timestamp;

        console.log('[GPS] Position updated:', {
            lat: latitude,
            lng: longitude,
            accuracy: `${accuracy}m`,
            timestamp: new Date(timestamp).toISOString()
        });

        // 停止判定ロジック
        if (!lastActivePositionRef.current) {
            lastActivePositionRef.current = { lat: latitude, lng: longitude };
            setLastPositionTime(Date.now());
        } else {
            const dist = calculateDistance(lastActivePositionRef.current.lat, lastActivePositionRef.current.lng, latitude, longitude);
            if (dist > settings.stopDetectionRadius) {
                setLastPositionTime(Date.now());
                lastActivePositionRef.current = { lat: latitude, lng: longitude };
            }
        }

        // 精度が悪すぎる場合はスキップ（100m以上の誤差）
        if (accuracy > 100) {
            console.warn('[GPS] Low accuracy, skipping:', accuracy);
            return;
        }

        setCurrentWalk(prev => {
            if (!prev) return null;

            // 最小記録距離の判定
            if (prev.positions.length > 0) {
                const lastPos = prev.positions[prev.positions.length - 1];
                const dist = calculateDistance(lastPos.lat, lastPos.lng, latitude, longitude);
                if (dist < settings.minimumDistanceThreshold) {
                    return prev;
                }
            }

            const newPos = {
                lat: latitude,
                lng: longitude,
                time: new Date(timestamp),
                accuracy: accuracy
            };
            return { ...prev, positions: [...prev.positions, newPos] };
        });
    };

    const handlePositionError = (error) => {
        console.error('[GPS] Position error:', {
            code: error.code,
            message: error.message
        });

        switch (error.code) {
            case error.PERMISSION_DENIED:
                alert('位置情報の権限が拒否されました。設定を確認してください。');
                endWalk();
                break;
            case error.POSITION_UNAVAILABLE:
                console.warn('[GPS] Position unavailable (信号が弱い可能性があります)');
                break;
            case error.TIMEOUT:
                console.warn('[GPS] Position timeout (GPSの取得に時間がかかっています)');
                break;
            default:
                console.error('[GPS] Unknown error:', error);
        }
    };

    const startWalk = async () => {
        if (selectedWalkers.length === 0) { alert('散歩者を選択してください'); return; }
        if (!navigator.geolocation) { alert('お使いのブラウザは位置情報に対応していません'); return; }

        // 既存のwatchPositionがあれば解除
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }

        const walk = {
            walkers: selectedWalkers, startTime: new Date(), positions: [],
            pee: false, poo: false, pooFirmness: 3, energy: 3, water: false, memo: '', photos: [], weather: null
        };

        setCurrentWalk(walk);
        setIsWalking(true);
        setShowWalkSetup(false);
        setPhotos([]);
        setNow(new Date());
        setLastPositionTime(Date.now());
        lastActivePositionRef.current = null;

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        let firstPosition = true;

        try {
            const watchId = navigator.geolocation.watchPosition(
                async (position) => {
                    if (firstPosition) {
                        firstPosition = false;
                        const weatherData = await fetchWeatherData(position.coords.latitude, position.coords.longitude);
                        if (weatherData) {
                            setCurrentWalk(prev => { if (!prev) return null; return { ...prev, weather: weatherData }; });
                        }
                    }
                    handlePositionSuccess(position);
                },
                handlePositionError,
                options
            );
            watchIdRef.current = watchId;
            console.log('[GPS] watchPosition started:', watchId);
        } catch (error) {
            console.error('[GPS] Failed to start watchPosition:', error);
            alert('GPS追跡の開始に失敗しました。位置情報の権限を確認してください。');
        }

        await requestWakeLock();
        // ★LINE通知（チェックされている場合のみ）
        if (notifyStart) {
            const notifyWalkStart = functions.httpsCallable('notifyWalkStart');
            notifyWalkStart({ walkers: selectedWalkers })
                .then(() => console.log('LINE通知送信成功'))
                .catch(err => {
                    console.error('LINE通知送信失敗', err);
                    alert('LINE通知送信失敗: ' + err.message);
                });
        } else {
            console.log('LINE通知はスキップされました');
        }
    };

    useEffect(() => {
        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                console.log('[GPS] Cleanup: watchPosition cleared on unmount');
            }
            if (wakeLockRef.current !== null) {
                wakeLockRef.current.release()
                    .then(() => console.log('[Wake Lock] Cleanup: Released on unmount'))
                    .catch(err => console.error('[Wake Lock] Cleanup failed:', err));
            }
        };
    }, []);

    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && isWalking) {
                if (wakeLockRef.current === null) {
                    console.log('[Wake Lock] Page visible, re-requesting wake lock');
                    await requestWakeLock();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isWalking]);

    useEffect(() => {
        if (stopCheckIntervalRef.current !== null) {
            clearInterval(stopCheckIntervalRef.current);
        }

        if (isWalking) {
            stopCheckIntervalRef.current = setInterval(() => {
                const now = Date.now();
                const timeSinceLastPosition = now - lastPositionTime;

                if (settings.autoEndEnabled) {
                    const autoEndThreshold = settings.autoEndAfterStop * 1000;
                    // 自動終了の10秒前に警告
                    const warningThreshold = Math.max(0, autoEndThreshold - 10000);

                    if (timeSinceLastPosition > warningThreshold && timeSinceLastPosition < autoEndThreshold && !showWalkWarning) {
                        console.log('[Stop Check] Warning');
                        setShowWalkWarning(true);
                        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                    }

                    if (timeSinceLastPosition > autoEndThreshold) {
                        console.log('[Stop Check] Auto End');
                        setShowWalkWarning(false);
                        alert('停止時間が長いため、散歩を自動終了しました。');
                        endWalk();
                    }
                }
            }, 1000); // Check every 1 second
        }

        return () => {
            if (stopCheckIntervalRef.current !== null) {
                clearInterval(stopCheckIntervalRef.current);
                stopCheckIntervalRef.current = null;
            }
        };
    }, [isWalking, lastPositionTime, showWalkWarning, settings]);

    const endWalk = async () => {
        if (!currentWalk) return;
        await releaseWakeLock();

        // watchPositionの停止
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            console.log('[GPS] watchPosition cleared:', watchIdRef.current);
            watchIdRef.current = null;
        }

        const endTime = new Date();
        const duration = Math.floor((endTime - currentWalk.startTime) / 60000);
        const distance = calculateTotalDistance(currentWalk.positions);

        setIsWalking(false);
        setTimeout(() => {
            setCurrentWalk(null);
            setSelectedWalkers([]);
            setPhotos([]);
            // stationaryTimeRef.current = 0; // Removed in v2.9.5
            // lastPositionRef.current = null; // Removed in v2.9.5
        }, 0);

        await db.collection('walks').add({
            walkers: currentWalk.walkers,
            startTime: firebase.firestore.Timestamp.fromDate(currentWalk.startTime),
            endTime: firebase.firestore.Timestamp.fromDate(endTime),
            duration, distance,
            pee: currentWalk.pee,
            poo: currentWalk.poo,
            pooFirmness: currentWalk.poo ? currentWalk.pooFirmness : null,
            energy: currentWalk.energy,
            water: currentWalk.water,
            memo: currentWalk.memo, photos: photos, positions: currentWalk.positions, weather: currentWalk.weather || null,
            // ★通知フラグを保存
            notify: notifyEnd
        });
    };

    const updateWalk = async (walkId, data) => { await db.collection('walks').doc(walkId).update(data); setEditingWalk(null); };
    const deleteWalk = async (walkId) => { if (confirm('この散歩記録を削除しますか?')) { await db.collection('walks').doc(walkId).delete(); } };

    const saveHealthRecord = async (data) => {
        const dateTime = data.time ? new Date(`${data.date}T${data.time}`) : new Date(data.date);
        const recordData = { ...data, date: firebase.firestore.Timestamp.fromDate(dateTime) };
        delete recordData.id;
        if (data.id) { await db.collection('health').doc(data.id).update(recordData); }
        else { await db.collection('health').add(recordData); }
        setShowHealthForm(false); setEditingHealth(null);
    };

    const deleteHealthRecord = async (id) => {
        if (!id) { alert('IDが見つかりません'); return; }
        if (confirm('この記録を削除しますか?')) { try { await db.collection('health').doc(id).delete(); } catch (e) { alert('削除に失敗しました: ' + e); } }
    };

    const formatTimer = (start) => {
        if (!start) return '0分00秒';
        const diffMs = now - start;
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        return `${mins}分${secs.toString().padStart(2, '0')}秒`;
    };

    const getStats = (period) => {
        const now = new Date();
        let start, end;
        if (period === 'week') {
            start = getWeekStart(now);
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
        } else if (period === 'month') {
            start = getMonthStart(now);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            end.setHours(23, 59, 59, 999);
        } else if (period === 'year') {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        } else {
            start = new Date(2000, 0, 1);
            end = new Date();
            end.setHours(23, 59, 59, 999);
        }
        return calculateStats(walks, healthRecords, start, end);
    };

    const getEarnedBadges = () => {
        const totalCount = walks.length;
        const totalDistance = walks.reduce((sum, w) => sum + (w.distance || 0), 0);
        return badges.filter(badge => badge.condition(totalCount, totalDistance));
    };

    const PaginationControls = ({ currentPage, totalPages, onPageChange }) => {
        if (totalPages <= 1) return null;

        return React.createElement('div', { className: 'flex justify-center items-center gap-2 mt-4 text-sm' },
            React.createElement('button', {
                onClick: () => onPageChange(1),
                disabled: currentPage === 1,
                className: `px-2 py-1 rounded border ${currentPage === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white text-blue-600 hover:bg-blue-50'}`
            }, '|<< 最新'),
            React.createElement('button', {
                onClick: () => onPageChange(Math.max(1, currentPage - 1)),
                disabled: currentPage === 1,
                className: `px-2 py-1 rounded border ${currentPage === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white text-blue-600 hover:bg-blue-50'}`
            }, '< 新しい'),
            React.createElement('span', { className: 'font-bold mx-2' }, `${currentPage} / ${totalPages}`),
            React.createElement('button', {
                onClick: () => onPageChange(Math.min(totalPages, currentPage + 1)),
                disabled: currentPage === totalPages,
                className: `px-2 py-1 rounded border ${currentPage === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-white text-blue-600 hover:bg-blue-50'}`
            }, '古い >'),
            React.createElement('button', {
                onClick: () => onPageChange(totalPages),
                disabled: currentPage === totalPages,
                className: `px-2 py-1 rounded border ${currentPage === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-white text-blue-600 hover:bg-blue-50'}`
            }, '最古 >>|')
        );
    };

    if (loading) { return React.createElement('div', { className: 'flex items-center justify-center min-h-screen' }, React.createElement('div', { className: 'text-lg' }, '読み込み中...')); }

    const stats = getStats(statsView);
    const earnedBadges = getEarnedBadges();
    const recentWalks = walks.slice(0, 20);
    const recentHealth = healthRecords.slice(0, 20);

    const allRecords = [...walks.map(w => ({ ...w, type: 'walk' })), ...healthRecords]
        .sort((a, b) => {
            const dateA = a.type === 'walk' ? a.startTime : a.date;
            const dateB = b.type === 'walk' ? b.startTime : b.date;
            return dateB - dateA;
        });

    const getLastRecordTime = (type) => {
        if (type === 'excretion') {
            const record = allRecords.find(r => r.type === 'excretion' || (r.type === 'walk' && r.poo));
            return record ? (record.startTime || record.date) : null;
        }
        const record = allRecords.find(r => r.type === type);
        return record ? (record.startTime || record.date) : null;
    };

    const homeTotalPages = Math.ceil(allRecords.length / ITEMS_PER_PAGE) || 1;
    const displayedHomeRecords = allRecords.slice((homePage - 1) * ITEMS_PER_PAGE, homePage * ITEMS_PER_PAGE);

    const healthTotalPages = Math.ceil(allRecords.length / ITEMS_PER_PAGE) || 1;
    const displayedHealthRecords = allRecords.slice((healthPage - 1) * ITEMS_PER_PAGE, healthPage * ITEMS_PER_PAGE);

    return React.createElement('div', { className: 'max-w-md mx-auto bg-white min-h-screen pb-20' },
        React.createElement('div', { className: 'bg-gradient-to-r from-blue-500 to-purple-500 text-white p-4' }, React.createElement('h1', { className: 'text-2xl font-bold' }, '🐕 福といっしょ')),
        React.createElement('div', { className: 'flex border-b overflow-x-auto' },
            React.createElement('button', { onClick: () => handleTabChange('home'), className: `flex-shrink-0 px-4 py-3 ${activeTab === 'home' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}` }, 'ホーム'),
            React.createElement('button', { onClick: () => handleTabChange('health'), className: `flex-shrink-0 px-4 py-3 ${activeTab === 'health' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}` }, 'お世話'),
            React.createElement('button', { onClick: () => handleTabChange('stats'), className: `flex-shrink-0 px-4 py-3 ${activeTab === 'stats' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}` }, '統計'),
            React.createElement('button', { onClick: () => handleTabChange('badges'), className: `flex-shrink-0 px-4 py-3 ${activeTab === 'badges' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}` }, 'バッジ'),
            React.createElement('button', { onClick: () => handleTabChange('members'), className: `flex-shrink-0 px-4 py-3 ${activeTab === 'members' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}` }, 'メンバー'),
            React.createElement('button', { onClick: () => handleTabChange('settings'), className: `flex-shrink-0 px-4 py-3 ${activeTab === 'settings' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}` }, '設定')
        ),

        activeTab === 'home' && React.createElement('div', { className: 'p-4' },
            React.createElement('div', { className: 'bg-gradient-to-r from-blue-100 to-purple-100 p-4 rounded-lg mb-4 shadow-sm' },
                React.createElement(CareHistoryChart, { walks: walks, healthRecords: healthRecords }),

                React.createElement('h2', { className: 'text-sm font-bold mb-2 mt-4 text-gray-700' },
                    `📊 今週 (${statsData.ranges.week}) `,
                    React.createElement('span', { className: 'text-xs font-normal text-gray-500' }, '※括弧内は先週比')
                ),
                React.createElement('div', { className: 'grid grid-cols-5 gap-1 mb-4' },
                    renderStatItem('散歩', statsData.week.count, statsData.lastWeek.count, '回', 'text-blue-600'),
                    renderStatItem('距離', statsData.week.totalDistance, statsData.lastWeek.totalDistance, 'km', 'text-green-600', true),
                    renderStatItem('時間', statsData.week.totalDuration, statsData.lastWeek.totalDuration, '分', 'text-purple-600'),
                    renderStatItem('ご飯', statsData.week.mealCount, statsData.lastWeek.mealCount, '回', 'text-orange-600'),
                    renderStatItem('排泄', statsData.week.pooCount, statsData.lastWeek.pooCount, '回', 'text-yellow-600')
                ),

                React.createElement('h2', { className: 'text-sm font-bold mb-2 text-gray-700' },
                    `📊 今月 (${statsData.ranges.month}) `,
                    React.createElement('span', { className: 'text-xs font-normal text-gray-500' }, '※括弧内は先月比')
                ),
                React.createElement('div', { className: 'grid grid-cols-5 gap-1' },
                    renderStatItem('散歩', statsData.month.count, statsData.lastMonth.count, '回', 'text-blue-600'),
                    renderStatItem('距離', statsData.month.totalDistance, statsData.lastMonth.totalDistance, 'km', 'text-green-600', true),
                    renderStatItem('時間', statsData.month.totalDuration, statsData.lastMonth.totalDuration, '分', 'text-purple-600'),
                    renderStatItem('ご飯', statsData.month.mealCount, statsData.lastMonth.mealCount, '回', 'text-orange-600'),
                    renderStatItem('排泄', statsData.month.pooCount, statsData.lastMonth.pooCount, '回', 'text-yellow-600')
                )
            ),
            React.createElement('h3', { className: 'font-bold mb-2 text-lg flex items-center' }, React.createElement('span', { className: 'mr-2' }, '🕒'), '福のお世話'),
            React.createElement('div', { className: 'space-y-3 max-h-96 overflow-y-auto pr-1' },
                allRecords.length === 0 ? React.createElement('p', { className: 'text-center text-gray-500 mt-4' }, 'まだ記録がありません') :
                    displayedHomeRecords.map(item => item.type === 'walk' ?
                        React.createElement('div', { key: 'w-' + item.id, className: 'border rounded-lg p-3 bg-white shadow-sm' },
                            React.createElement('div', { className: 'flex justify-between items-start mb-2' },
                                React.createElement('div', { className: 'flex-1' },
                                    React.createElement('p', { className: 'font-bold text-lg' }, '🚶 散歩 (' + (Array.isArray(item.walkers) ? item.walkers.join(', ') : item.walkers) + ')'),
                                    React.createElement('div', { className: 'flex gap-1 mt-1' },
                                        item.pee && React.createElement('span', { className: 'text-lg' }, '💧'),
                                        item.poo && React.createElement('span', { className: 'text-lg' }, '💩' + (item.pooFirmness ? getFirmnessEmoji(item.pooFirmness) : '')),
                                        item.water && React.createElement('span', { className: 'text-lg' }, '🥤')
                                    )
                                ),
                                React.createElement('div', { className: 'text-right flex flex-col items-end pl-2' },
                                    React.createElement('div', { className: 'text-xs text-gray-500 font-bold' }, formatRelativeTime(item.startTime)),
                                    React.createElement('div', { className: 'text-xs text-gray-500 font-bold' }, '⏱️' + item.duration + '分 📍' + (item.distance / 1000).toFixed(2) + 'km'),
                                    item.energy && React.createElement('div', { className: 'text-xs font-bold text-orange-500 mt-1' }, '元気: ' + getEnergyLabel(item.energy)),
                                    item.weather && React.createElement('div', { className: 'text-xs text-gray-600 font-medium mt-1' }, `${getWeatherEmoji(item.weather.icon)} ${item.weather.temp}℃ 💨${item.weather.wind}m`)
                                )
                            ),
                            React.createElement('div', null,
                                item.memo && React.createElement('div', { className: 'text-sm text-gray-600 mb-1 bg-gray-50 p-1 rounded' }, item.memo),
                                item.photos && item.photos.length > 0 && React.createElement('div', { className: 'flex gap-1 mt-2 mb-2 overflow-x-auto' },
                                    item.photos.map((url, i) => React.createElement('img', { key: i, src: url, className: 'h-16 w-16 object-cover rounded cursor-pointer border border-gray-200', onClick: () => setViewingPhoto(url) }))
                                ),
                                React.createElement('div', { className: 'flex justify-end gap-2 mt-2' },
                                    item.positions && item.positions.length > 0 && React.createElement('button', {
                                        onClick: () => setShowMap(item.positions),
                                        className: 'px-3 py-1 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded text-xs font-bold'
                                    }, '地図')
                                )
                            )
                        ) :
                        React.createElement('div', { key: 'h-' + item.id, className: 'border rounded-lg p-3 bg-white shadow-sm' },
                            React.createElement('div', { className: 'flex justify-between items-start mb-2' },
                                React.createElement('div', null, React.createElement('p', { className: 'font-bold text-lg' }, (item.type === 'hospital' ? '🏥 病院' : item.type === 'grooming' ? '✂️ 散髪' : item.type === 'bath' ? '🛁 入浴' : item.type === 'brushing' ? '✨ ブラッシング' : item.type === 'cleaning' ? '🧹 掃除' : item.type === 'weight' ? '⚖️ 体重' : item.type === 'food' ? '🥣 ご飯' : item.type === 'excretion' ? '💩 排泄' : item.type === 'yard' ? '🏡 庭遊び' : '💊 薬') + ' (' + item.walker + ')')),
                                React.createElement('div', { className: 'text-right' }, React.createElement('p', { className: 'text-xs text-gray-500 font-bold whitespace-nowrap' }, formatRelativeTime(item.date)))
                            ),
                            React.createElement('div', { className: 'mb-2' },
                                item.photos && item.photos.length > 0 && React.createElement('div', { className: 'flex gap-1 mb-2 overflow-x-auto' },
                                    item.photos.map((url, i) => React.createElement('img', { key: i, src: url, className: 'h-16 w-16 object-cover rounded cursor-pointer border border-gray-200', onClick: () => setViewingPhoto(url) }))
                                ),
                                item.hospitalName && React.createElement('p', { className: 'text-sm' }, '🏥 ' + item.hospitalName),
                                item.medicineType && React.createElement('p', { className: 'text-sm text-blue-600' }, '💊 ' + item.medicineType),
                                item.type === 'excretion' && item.pooFirmness && React.createElement('p', { className: 'text-sm' }, '硬さ: ' + getFirmnessEmoji(item.pooFirmness)),
                                item.type === 'food' && item.foodAmount && React.createElement('p', { className: 'text-sm' }, '残量: ' + (['', '空っぽ', '少し', '普通', '多め', '満杯'][item.foodAmount] || '普通') + ` (${item.foodAmount}/5)`),
                                item.type === 'cleaning' && React.createElement('div', { className: 'text-sm flex gap-2 mt-1 flex-wrap' },
                                    item.isFloorCleaned && React.createElement('span', { className: 'bg-green-100 px-2 py-0.5 rounded text-green-800' }, '床: 済'),
                                    item.isToiletCleaned && React.createElement('span', { className: 'bg-blue-100 px-2 py-0.5 rounded text-blue-800' }, 'トイレ: 済'),
                                    // ★飲み水交換バッジ表示 (ホーム)
                                    item.isWaterChanged && React.createElement('span', { className: 'bg-cyan-100 px-2 py-0.5 rounded text-cyan-800' }, '水: 済')
                                ),
                                item.type === 'weight' && React.createElement('p', { className: 'text-lg font-bold text-blue-600' }, item.weight + ' kg'),
                                item.type === 'yard' && React.createElement('div', { className: 'text-sm mt-1' },
                                    (item.yardStartTime || item.yardEndTime) && React.createElement('p', { className: 'text-gray-600' }, '⏱️ ' + (item.yardStartTime || '?') + ' 〜 ' + (item.yardEndTime || '?')),
                                    item.yardPoo && React.createElement('p', { className: 'text-amber-700' }, '💩 うんちあり' + (item.yardPooFirmness ? ' ' + getFirmnessEmoji(item.yardPooFirmness) : ''))
                                ),
                                item.memo && React.createElement('p', { className: 'text-sm text-gray-600 mt-1' }, item.memo)
                            )
                        )
                    ),
                React.createElement(PaginationControls, {
                    currentPage: homePage,
                    totalPages: homeTotalPages,
                    onPageChange: setHomePage
                })
            )
        ),

        activeTab === 'health' && React.createElement('div', { className: 'p-4' },
            isWalking && currentWalk ? React.createElement('div', { className: 'space-y-4' },
                React.createElement('div', { className: 'bg-blue-50 p-4 rounded-lg border-2 border-blue-200' },
                    React.createElement('p', { className: 'text-sm text-gray-600 mb-1' }, '👥 散歩者: ' + currentWalk?.walkers.join(', ')),
                    React.createElement('p', { className: 'text-lg font-bold text-blue-700 mb-1' }, '⏱️ 経過時間: ' + formatTimer(currentWalk?.startTime)),
                    React.createElement('p', { className: 'text-sm text-gray-600 mb-1' }, '📍 距離: ' + (calculateTotalDistance(currentWalk?.positions || []) / 1000).toFixed(2) + 'km'),
                    currentWalk?.positions && currentWalk.positions.length > 0 && React.createElement('p', { className: 'text-xs text-gray-500' }, '🎯 GPS精度: ' + (currentWalk.positions[currentWalk.positions.length - 1]?.accuracy?.toFixed(0) || '測定中') + 'm')
                ),
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-sm font-medium mb-2' }, '元気度: ' + getEnergyLabel(currentWalk?.energy)),
                    React.createElement('input', {
                        type: 'range', min: '1', max: '5',
                        value: currentWalk.energy,
                        onChange: (e) => setCurrentWalk({ ...currentWalk, energy: parseInt(e.target.value) }),
                        className: 'w-full'
                    }),
                    React.createElement('div', { className: 'flex justify-between text-[10px] text-gray-500' },
                        React.createElement('span', null, '絶不調'),
                        React.createElement('span', null, '普通'),
                        React.createElement('span', null, '絶好調')
                    )
                ),
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-sm font-medium mb-2' }, '記録'),
                    React.createElement('div', { className: 'grid grid-cols-3 gap-2' },
                        React.createElement('button', { onClick: () => setCurrentWalk({ ...currentWalk, pee: !currentWalk.pee }), className: `py-3 rounded-lg border-2 font-bold ${currentWalk?.pee ? 'bg-yellow-100 border-yellow-500' : 'border-gray-300'}` }, '💧 おしっこ'),
                        React.createElement('button', { onClick: () => setCurrentWalk({ ...currentWalk, poo: !currentWalk.poo }), className: `py-3 rounded-lg border-2 font-bold ${currentWalk?.poo ? 'bg-amber-100 border-amber-500' : 'border-gray-300'}` }, '💩 うんち'),
                        React.createElement('button', { onClick: () => setCurrentWalk({ ...currentWalk, water: !currentWalk.water }), className: `py-3 rounded-lg border-2 font-bold ${currentWalk?.water ? 'bg-blue-100 border-blue-500' : 'border-gray-300'}` }, '💧 水')
                    ),
                    currentWalk?.poo && React.createElement('div', { className: 'mt-2 bg-amber-50 p-2 rounded border border-amber-200' },
                        React.createElement('label', { className: 'text-xs font-bold text-gray-600 block mb-1' }, 'うんちの硬さ: ' + getFirmnessLabel(currentWalk.pooFirmness)),
                        React.createElement('input', {
                            type: 'range', min: '1', max: '5',
                            value: currentWalk.pooFirmness,
                            onChange: (e) => setCurrentWalk({ ...currentWalk, pooFirmness: parseInt(e.target.value) }),
                            className: 'w-full'
                        }),
                        React.createElement('div', { className: 'flex justify-between text-[10px] text-gray-500' },
                            React.createElement('span', null, 'やわらかい'),
                            React.createElement('span', null, '普通'),
                            React.createElement('span', null, '硬い')
                        )
                    )
                ),
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-sm font-medium mb-2' }, '写真 (最大4枚)'),
                    React.createElement('div', { className: 'grid grid-cols-4 gap-2 mb-2' },
                        photos.map((url, i) => React.createElement('div', { key: i, className: 'relative' },
                            React.createElement('img', { src: url, className: 'w-full h-20 object-cover rounded' }),
                            React.createElement('button', { onClick: () => removePhoto(i), className: 'absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 text-xs' }, '×')
                        ))
                    ),
                    photos.length < 4 && React.createElement('input', { type: 'file', accept: 'image/*', multiple: true, onChange: handlePhotoUpload, disabled: uploadingPhotos, className: 'w-full text-sm' }),
                    uploadingPhotos && React.createElement('p', { className: 'text-sm text-gray-500' }, 'アップロード中...')
                ),
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-sm font-medium mb-2' }, 'メモ'),
                    React.createElement('textarea', { value: currentWalk?.memo || '', onChange: (e) => setCurrentWalk({ ...currentWalk, memo: e.target.value }), className: 'w-full p-2 border rounded-lg', rows: 3, placeholder: '気づいたことをメモ...' })
                ),

                // ★終了時の通知チェックボックスを追加
                React.createElement('div', { className: 'flex items-center mb-2' },
                    React.createElement('input', {
                        type: 'checkbox',
                        id: 'notify-end-check',
                        checked: notifyEnd,
                        onChange: (e) => setNotifyEnd(e.target.checked),
                        className: 'w-5 h-5 text-blue-600 rounded focus:ring-blue-500 mr-2'
                    }),
                    React.createElement('label', { htmlFor: 'notify-end-check', className: 'text-sm font-bold text-gray-700' }, '終了をLINEで通知する')
                ),

                React.createElement('button', { onClick: () => { if (confirm('散歩を終了しますか？')) endWalk(); }, disabled: uploadingPhotos, className: `w-full py-4 rounded-lg text-xl font-bold shadow-md ${uploadingPhotos ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600'}` }, uploadingPhotos ? '写真アップロード中...' : '🏁 散歩終了'),
                React.createElement('div', { className: 'mt-4 bg-gray-100 p-2 rounded text-[10px] text-gray-500 border border-gray-200' },
                    React.createElement('div', { className: 'grid grid-cols-2 gap-x-2 gap-y-1' },
                        React.createElement('div', null, `🛑 停止判定: ${settings.stopDetectionRadius}m / ${settings.stopDetectionDuration}秒`),
                        React.createElement('div', null, `🏁 自動終了: ${settings.autoEndEnabled ? Math.floor(settings.autoEndAfterStop / 60) + '分後' : 'オフ'}`),
                        React.createElement('div', null, `📍 GPS更新: ${settings.gpsUpdateInterval}秒`),
                        React.createElement('div', null, `📏 最小記録: ${settings.minimumDistanceThreshold}m`)
                    )
                )
            ) : showWalkSetup ? React.createElement('div', { className: 'space-y-4' },
                React.createElement('h3', { className: 'font-bold text-lg' }, '🚶 散歩の準備'),
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-sm font-medium mb-2' }, '散歩者を選択'),
                    React.createElement('div', { className: 'space-y-2' },
                        walkers.map(w => React.createElement('label', { key: w.id, className: 'flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50' },
                            React.createElement('input', { type: 'checkbox', checked: selectedWalkers.includes(w.name), onChange: () => toggleWalker(w.name), className: 'mr-2 w-5 h-5' }), React.createElement('span', null, w.name)
                        ))
                    ),
                    selectedWalkers.length > 0 && React.createElement('p', { className: 'text-sm text-gray-600 mt-2' }, '選択中: ' + selectedWalkers.join(', '))
                ),

                // ★開始時の通知チェックボックスを追加
                React.createElement('div', { className: 'flex items-center mb-2' },
                    React.createElement('input', {
                        type: 'checkbox',
                        id: 'notify-start-check',
                        checked: notifyStart,
                        onChange: (e) => setNotifyStart(e.target.checked),
                        className: 'w-5 h-5 text-blue-600 rounded focus:ring-blue-500 mr-2'
                    }),
                    React.createElement('label', { htmlFor: 'notify-start-check', className: 'text-sm font-bold text-gray-700' }, '開始をLINEで通知する')
                ),

                React.createElement('div', { className: 'flex gap-2' },
                    React.createElement('button', { onClick: startWalk, className: 'flex-1 bg-green-500 text-white py-3 rounded-lg text-lg font-bold shadow' }, '開始'),
                    React.createElement('button', { onClick: () => setShowWalkSetup(false), className: 'flex-1 bg-gray-300 text-black py-3 rounded-lg text-lg font-bold' }, 'キャンセル')
                )
            ) : !showHealthForm ? React.createElement('div', null,
                React.createElement('div', { className: 'grid grid-cols-3 gap-2 mb-6' },
                    React.createElement('button', { onClick: () => setShowWalkSetup(true), className: 'bg-green-500 text-white p-4 rounded-lg text-center flex flex-col items-center shadow-md transform active:scale-95 transition-transform' },
                        React.createElement('span', { className: 'text-2xl mb-1' }, '🚶'),
                        React.createElement('span', { className: 'text-xs font-bold' }, '散歩'),
                        React.createElement('span', { className: 'text-[10px] opacity-80 mt-1' }, formatSimpleTimeAgo(getLastRecordTime('walk')) || '-')
                    ),
                    React.createElement('button', { onClick: () => initHealthForm('excretion', null), className: 'bg-yellow-100 p-4 rounded-lg text-center flex flex-col items-center shadow-sm' },
                        React.createElement('span', { className: 'text-2xl mb-1' }, '💩'),
                        React.createElement('span', { className: 'text-xs font-bold' }, '排泄'),
                        React.createElement('span', { className: 'text-[10px] opacity-80 mt-1' }, formatSimpleTimeAgo(getLastRecordTime('excretion')) || '-')
                    ),
                    React.createElement('button', { onClick: () => initHealthForm('food', null), className: 'bg-orange-100 p-4 rounded-lg text-center flex flex-col items-center shadow-sm' },
                        React.createElement('span', { className: 'text-2xl mb-1' }, '🥣'),
                        React.createElement('span', { className: 'text-xs font-bold' }, 'ご飯'),
                        React.createElement('span', { className: 'text-[10px] opacity-80 mt-1' }, formatSimpleTimeAgo(getLastRecordTime('food')) || '-')
                    ),
                    React.createElement('button', { onClick: () => initHealthForm('medicine', null), className: 'bg-green-100 p-4 rounded-lg text-center flex flex-col items-center shadow-sm' },
                        React.createElement('span', { className: 'text-2xl mb-1' }, '💊'),
                        React.createElement('span', { className: 'text-xs font-bold' }, '薬'),
                        React.createElement('span', { className: 'text-[10px] opacity-80 mt-1' }, formatSimpleTimeAgo(getLastRecordTime('medicine')) || '-')
                    ),
                    React.createElement('button', { onClick: () => initHealthForm('bath', null), className: 'bg-blue-100 p-4 rounded-lg text-center flex flex-col items-center shadow-sm' },
                        React.createElement('span', { className: 'text-2xl mb-1' }, '🛁'),
                        React.createElement('span', { className: 'text-xs font-bold' }, '入浴'),
                        React.createElement('span', { className: 'text-[10px] opacity-80 mt-1' }, formatSimpleTimeAgo(getLastRecordTime('bath')) || '-')
                    ),
                    React.createElement('button', { onClick: () => initHealthForm('brushing', null), className: 'bg-purple-100 p-4 rounded-lg text-center flex flex-col items-center shadow-sm' },
                        React.createElement('span', { className: 'text-2xl mb-1' }, '✨'),
                        React.createElement('span', { className: 'text-xs font-bold' }, 'ﾌﾞﾗｼ'),
                        React.createElement('span', { className: 'text-[10px] opacity-80 mt-1' }, formatSimpleTimeAgo(getLastRecordTime('brushing')) || '-')
                    ),
                    React.createElement('button', { onClick: () => initHealthForm('cleaning', null), className: 'bg-teal-100 p-4 rounded-lg text-center flex flex-col items-center shadow-sm' },
                        React.createElement('span', { className: 'text-2xl mb-1' }, '🧹'),
                        React.createElement('span', { className: 'text-xs font-bold' }, '掃除'),
                        React.createElement('span', { className: 'text-[10px] opacity-80 mt-1' }, formatSimpleTimeAgo(getLastRecordTime('cleaning')) || '-')
                    ),
                    React.createElement('button', { onClick: () => initHealthForm('weight', null), className: 'bg-indigo-100 p-4 rounded-lg text-center flex flex-col items-center shadow-sm' },
                        React.createElement('span', { className: 'text-2xl mb-1' }, '⚖️'),
                        React.createElement('span', { className: 'text-xs font-bold' }, '体重'),
                        React.createElement('span', { className: 'text-[10px] opacity-80 mt-1' }, formatSimpleTimeAgo(getLastRecordTime('weight')) || '-')
                    ),
                    React.createElement('button', { onClick: () => initHealthForm('grooming', null), className: 'bg-pink-100 p-4 rounded-lg text-center flex flex-col items-center shadow-sm' },
                        React.createElement('span', { className: 'text-2xl mb-1' }, '✂️'),
                        React.createElement('span', { className: 'text-xs font-bold' }, '散髪'),
                        React.createElement('span', { className: 'text-[10px] opacity-80 mt-1' }, formatSimpleTimeAgo(getLastRecordTime('grooming')) || '-')
                    ),
                    React.createElement('button', { onClick: () => initHealthForm('hospital', null), className: 'bg-red-100 p-4 rounded-lg text-center flex flex-col items-center shadow-sm' },
                        React.createElement('span', { className: 'text-2xl mb-1' }, '🏥'),
                        React.createElement('span', { className: 'text-xs font-bold' }, '病院'),
                        React.createElement('span', { className: 'text-[10px] opacity-80 mt-1' }, formatSimpleTimeAgo(getLastRecordTime('hospital')) || '-')
                    ),
                    React.createElement('button', { onClick: () => initHealthForm('yard', null), className: 'bg-lime-100 p-4 rounded-lg text-center flex flex-col items-center shadow-sm' },
                        React.createElement('span', { className: 'text-2xl mb-1' }, '🏡'),
                        React.createElement('span', { className: 'text-xs font-bold' }, '庭遊び'),
                        React.createElement('span', { className: 'text-[10px] opacity-80 mt-1' }, formatSimpleTimeAgo(getLastRecordTime('yard')) || '-')
                    )
                ),
                React.createElement('h3', { className: 'font-bold mb-3' }, 'お世話したよ'),
                React.createElement('div', { className: 'space-y-3' },
                    allRecords.length === 0 ? React.createElement('p', { className: 'text-center text-gray-500 mt-4' }, '記録がありません') :
                        displayedHealthRecords.map(item => item.type === 'walk' ?
                            React.createElement('div', { key: 'w-' + item.id, className: 'border rounded-lg p-3 bg-white shadow-sm' },
                                React.createElement('div', { className: 'flex justify-between items-start mb-2' },
                                    React.createElement('div', { className: 'flex-1' },
                                        React.createElement('p', { className: 'font-bold text-lg' }, '🚶 散歩 (' + (Array.isArray(item.walkers) ? item.walkers.join(', ') : item.walkers) + ')'),
                                        React.createElement('div', { className: 'flex gap-1 mt-1' },
                                            item.pee && React.createElement('span', { className: 'text-lg' }, '💧'),
                                            item.poo && React.createElement('span', { className: 'text-lg' }, '💩' + (item.pooFirmness ? getFirmnessEmoji(item.pooFirmness) : '')),
                                            item.water && React.createElement('span', { className: 'text-lg' }, '🥤')
                                        )
                                    ),
                                    React.createElement('div', { className: 'text-right flex flex-col items-end pl-2' },
                                        React.createElement('div', { className: 'text-xs text-gray-500 font-bold' }, formatRelativeTime(item.startTime)),
                                        React.createElement('div', { className: 'text-xs text-gray-500 font-bold' }, '⏱️' + item.duration + '分 📍' + (item.distance / 1000).toFixed(2) + 'km'),
                                        item.energy && React.createElement('div', { className: 'text-xs font-bold text-orange-500 mt-1' }, '元気: ' + getEnergyLabel(item.energy)),
                                        item.weather && React.createElement('div', { className: 'text-xs text-gray-600 font-medium mt-1' }, `${getWeatherEmoji(item.weather.icon)} ${item.weather.temp}℃ 💨${item.weather.wind}m`)
                                    )
                                ),
                                React.createElement('div', null,
                                    item.memo && React.createElement('div', { className: 'text-sm text-gray-600 mb-1 bg-gray-50 p-1 rounded' }, item.memo),
                                    item.photos && item.photos.length > 0 && React.createElement('div', { className: 'flex gap-1 mt-2 mb-2 overflow-x-auto' },
                                        item.photos.map((url, i) => React.createElement('img', { key: i, src: url, className: 'h-16 w-16 object-cover rounded cursor-pointer border border-gray-200', onClick: () => setViewingPhoto(url) }))
                                    ),
                                    React.createElement('div', { className: 'flex justify-end gap-2' },
                                        item.positions && item.positions.length > 0 && React.createElement('button', { onClick: () => setShowMap(item.positions), className: 'px-3 py-1 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded text-xs font-bold' }, '地図'),
                                        React.createElement('button', { onClick: () => setEditingWalk(item), className: 'px-3 py-1 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded text-xs font-bold' }, '編集'),
                                        React.createElement('button', { onClick: () => deleteWalk(item.id), className: 'px-3 py-1 text-red-600 bg-red-50 hover:bg-red-100 rounded text-xs font-bold' }, '削除')
                                    )
                                )
                            ) :
                            React.createElement('div', { key: 'h-' + item.id, className: 'border rounded-lg p-3 bg-white shadow-sm' },
                                React.createElement('div', { className: 'flex justify-between items-start' },
                                    React.createElement('div', { className: 'flex-1' },
                                        React.createElement('p', { className: 'font-bold text-lg' }, (item.type === 'hospital' ? '🏥 病院' : item.type === 'grooming' ? '✂️ 散髪' : item.type === 'bath' ? '🛁 入浴' : item.type === 'brushing' ? '✨ ブラッシング' : item.type === 'cleaning' ? '🧹 掃除' : item.type === 'weight' ? '⚖️ 体重' : item.type === 'food' ? '🥣 ご飯' : item.type === 'excretion' ? '💩 排泄' : item.type === 'yard' ? '🏡 庭遊び' : '💊 薬') + ' (' + item.walker + ')'),
                                        React.createElement('div', { className: 'mt-1' },
                                            item.hospitalName && React.createElement('p', { className: 'text-sm' }, '🏥 ' + item.hospitalName),
                                            item.medicineType && React.createElement('p', { className: 'text-sm text-blue-600' }, '💊 ' + item.medicineType),
                                            item.type === 'excretion' && item.pooFirmness && React.createElement('p', { className: 'text-sm' }, '硬さ: ' + getFirmnessEmoji(item.pooFirmness)),
                                            item.type === 'food' && item.foodAmount && React.createElement('p', { className: 'text-sm' }, '残量: ' + (['', '空っぽ', '少し', '普通', '多め', '満杯'][item.foodAmount] || '普通') + ` (${item.foodAmount}/5)`),
                                            item.type === 'cleaning' && React.createElement('div', { className: 'text-sm flex gap-2 mt-1 flex-wrap' },
                                                item.isFloorCleaned && React.createElement('span', { className: 'bg-green-100 px-2 py-0.5 rounded text-green-800' }, '床: 済'),
                                                item.isToiletCleaned && React.createElement('span', { className: 'bg-blue-100 px-2 py-0.5 rounded text-blue-800' }, 'トイレ: 済'),
                                                // ★飲み水交換バッジ表示 (お世話)
                                                item.isWaterChanged && React.createElement('span', { className: 'bg-cyan-100 px-2 py-0.5 rounded text-cyan-800' }, '水: 済')
                                            ),
                                            item.type === 'weight' && React.createElement('p', { className: 'text-lg font-bold text-indigo-600' }, item.weight + ' kg'),
                                            item.type === 'yard' && React.createElement('div', { className: 'text-sm mt-1' },
                                                (item.yardStartTime || item.yardEndTime) && React.createElement('p', { className: 'text-gray-600' }, '⏱️ ' + (item.yardStartTime || '?') + ' 〜 ' + (item.yardEndTime || '?')),
                                                item.yardPoo && React.createElement('p', { className: 'text-amber-700' }, '💩 うんちあり' + (item.yardPooFirmness ? ' ' + getFirmnessEmoji(item.yardPooFirmness) : ''))
                                            ),
                                            item.memo && React.createElement('p', { className: 'text-sm text-gray-600 mt-1' }, item.memo)
                                        )
                                    ),
                                    React.createElement('div', { className: 'text-right flex flex-col justify-between items-end gap-2' },
                                        React.createElement('p', { className: 'text-xs text-gray-500 font-bold whitespace-nowrap' }, formatRelativeTime(item.date)),
                                        React.createElement('div', { className: 'flex gap-2' },
                                            React.createElement('button', { onClick: () => initHealthForm(item.type, item), className: 'text-blue-500 text-xs font-bold border border-blue-200 px-2 py-1 rounded' }, '編集'),
                                            React.createElement('button', { onClick: () => deleteHealthRecord(item.id), className: 'text-red-500 text-xs px-2 py-1' }, '削除')
                                        )
                                    )
                                ),
                                item.photos && item.photos.length > 0 && React.createElement('div', { className: 'flex gap-1 mt-2 overflow-x-auto' },
                                    item.photos.map((url, i) => React.createElement('img', { key: i, src: url, className: 'h-16 w-16 object-cover rounded cursor-pointer border border-gray-200', onClick: () => setViewingPhoto(url) }))
                                )
                            )
                        )
                ),
                React.createElement(PaginationControls, {
                    currentPage: healthPage,
                    totalPages: healthTotalPages,
                    onPageChange: setHealthPage
                })
            ) : React.createElement(HealthForm, {
                type: healthType, walkers: walkers, formData: healthFormData, onChange: setHealthFormData,
                onSave: saveHealthRecord, onCancel: () => { setShowHealthForm(false); setEditingHealth(null); }
            })
        ),

        // ... (stats, badges, settings, footer, modal群は既存のまま)
        activeTab === 'stats' && React.createElement('div', { className: 'p-4' },
            React.createElement('div', { className: 'flex gap-2 mb-4 overflow-x-auto' },
                ['week', 'month', 'year', 'all'].map(v => React.createElement('button', {
                    key: v, onClick: () => setStatsView(v), className: `flex-shrink-0 px-4 py-2 rounded text-sm font-bold ${statsView === v ? 'bg-blue-500 text-white shadow' : 'bg-gray-200'}`
                }, v === 'week' ? '今週' : v === 'month' ? '今月' : v === 'year' ? '今年' : '全期間'))
            ),
            React.createElement('div', { className: 'space-y-4' },
                React.createElement('div', { className: 'bg-gradient-to-r from-blue-100 to-purple-100 p-4 rounded-lg shadow-sm border border-blue-200' },
                    React.createElement('h3', { className: 'font-bold mb-2' }, '📊 ' + getPeriodLabel(statsView)),
                    React.createElement('div', { className: 'grid grid-cols-5 gap-1' },
                        React.createElement('div', { className: 'bg-white p-2 rounded text-center' }, React.createElement('p', { className: 'text-[10px] text-gray-600' }, '散歩'), React.createElement('p', { className: 'text-lg font-bold text-blue-600' }, getStats(statsView).count, React.createElement('span', { className: 'text-xs text-gray-400 ml-0.5' }, '回'))),
                        React.createElement('div', { className: 'bg-white p-2 rounded text-center' }, React.createElement('p', { className: 'text-[10px] text-gray-600' }, '距離'), React.createElement('p', { className: 'text-lg font-bold text-green-600' }, (getStats(statsView).totalDistance / 1000).toFixed(1), React.createElement('span', { className: 'text-xs text-gray-400 ml-0.5' }, 'km'))),
                        React.createElement('div', { className: 'bg-white p-2 rounded text-center' }, React.createElement('p', { className: 'text-[10px] text-gray-600' }, '時間'), React.createElement('p', { className: 'text-lg font-bold text-purple-600' }, getStats(statsView).totalDuration, React.createElement('span', { className: 'text-xs text-gray-400 ml-0.5' }, '分'))),
                        React.createElement('div', { className: 'bg-white p-2 rounded text-center' }, React.createElement('p', { className: 'text-[10px] text-gray-600' }, 'ご飯'), React.createElement('p', { className: 'text-lg font-bold text-orange-600' }, getStats(statsView).mealCount, React.createElement('span', { className: 'text-xs text-gray-400 ml-0.5' }, '回'))),
                        React.createElement('div', { className: 'bg-white p-2 rounded text-center' }, React.createElement('p', { className: 'text-[10px] text-gray-600' }, '排泄'), React.createElement('p', { className: 'text-lg font-bold text-yellow-600' }, getStats(statsView).pooCount, React.createElement('span', { className: 'text-xs text-gray-400 ml-0.5' }, '回')))
                    )
                )
            )
        ),

        activeTab === 'badges' && React.createElement('div', { className: 'p-4' },
            React.createElement('h2', { className: 'text-xl font-bold mb-4' }, '🏆 実績・バッジ'),
            React.createElement('div', { className: 'grid grid-cols-2 gap-3' },
                badges.map(badge => {
                    const earned = earnedBadges.find(b => b.id === badge.id);
                    return React.createElement('div', { key: badge.id, className: `p-4 rounded-lg text-center ${earned ? 'bg-gradient-to-br from-yellow-50 to-orange-100 border-2 border-yellow-400 shadow-sm' : 'bg-gray-100 opacity-50'}` },
                        React.createElement('div', { className: 'text-4xl mb-2' }, badge.icon),
                        React.createElement('p', { className: 'font-bold text-sm' }, badge.name),
                        earned && React.createElement('p', { className: 'text-xs text-green-600 mt-1 font-bold' }, '✓ 獲得済み')
                    );
                })
            )
        ),

        activeTab === 'members' && React.createElement('div', { className: 'p-4' },
            React.createElement('h2', { className: 'text-xl font-bold mb-4 flex items-center' }, React.createElement('span', { className: 'mr-2' }, '🏠'), '荒木家'),
            React.createElement('div', { className: 'space-y-2 mb-4' },
                walkers.map(w => React.createElement('div', { key: w.id, className: 'flex items-center justify-between p-3 border rounded-lg bg-white shadow-sm' },
                    React.createElement('span', { className: 'font-medium' }, w.name),
                    React.createElement('button', { onClick: () => deleteWalker(w.id), className: 'text-red-500 text-sm font-bold' }, '削除')
                ))
            ),
            !showAddWalker ? React.createElement('button', { onClick: () => setShowAddWalker(true), className: 'w-full bg-blue-500 text-white py-3 rounded-lg font-bold shadow-md' }, '+ メンバーを追加') : React.createElement('div', { className: 'space-y-2 bg-gray-50 p-4 rounded-lg' },
                React.createElement('input', { type: 'text', value: newWalkerName, onChange: (e) => setNewWalkerName(e.target.value), placeholder: '名前を入力', className: 'w-full p-2 border rounded' }),
                React.createElement('div', { className: 'flex gap-2' },
                    React.createElement('button', { onClick: addWalker, className: 'flex-1 bg-green-500 text-white py-2 rounded font-bold' }, '追加'),
                    React.createElement('button', { onClick: () => { setShowAddWalker(false); setNewWalkerName(''); }, className: 'flex-1 bg-gray-300 py-2 rounded' }, 'キャンセル')
                )
            )
        ),

        activeTab === 'settings' && React.createElement('div', { className: 'p-4' },
            React.createElement(SettingsScreen, { settings: settings, onSave: saveSettings, onReset: resetSettings })
        ),

        React.createElement('div', { className: 'fixed bottom-0 left-0 right-0 bg-gray-100 border-t p-2 text-center' },
            React.createElement('p', { className: 'text-xs text-gray-500 font-medium' }, '福といっしょ ' + APP_VERSION)
        ),

        editingWalk && React.createElement(WalkEditForm, { walk: editingWalk, walkers: walkers, onSave: (data) => updateWalk(editingWalk.id, data), onCancel: () => setEditingWalk(null) }),
        showMap && React.createElement(MapView, { positions: showMap, onClose: () => setShowMap(null) }),
        viewingPhoto && React.createElement(PhotoViewer, { src: viewingPhoto, onClose: () => setViewingPhoto(null) }),

        showWalkWarning && React.createElement('div', { className: 'modal-overlay' },
            React.createElement('div', { className: 'bg-white rounded-lg p-6 max-w-sm w-full shadow-2xl modal-content m-4' },
                React.createElement('h3', { className: 'font-bold text-xl text-red-600 mb-4 flex items-center justify-center' },
                    React.createElement('span', { className: 'text-3xl mr-2' }, '⚠️'), '散歩中ですか？'
                ),
                React.createElement('p', { className: 'text-gray-700 mb-6 font-bold leading-relaxed text-center' },
                    'しばらく移動が検出されていません。', React.createElement('br'),
                    '散歩を継続しますか？', React.createElement('br'),
                    React.createElement('span', { className: 'text-xs text-red-500 font-normal block mt-2' }, '※5分経過すると自動終了します')
                ),
                React.createElement('div', { className: 'flex flex-col gap-3' },
                    React.createElement('button', {
                        onClick: () => { setLastPositionTime(Date.now()); setShowWalkWarning(false); },
                        className: 'bg-green-600 text-white font-bold py-4 px-4 rounded-lg text-lg shadow-lg hover:bg-green-700 transition-colors'
                    }, 'まだ散歩中です 🐕'),
                    React.createElement('button', {
                        onClick: () => { if (confirm('散歩を終了しますか？')) { setShowWalkWarning(false); endWalk(); } },
                        className: 'bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors'
                    }, '終了する')
                )
            )
        )
    );
}

ReactDOM.render(React.createElement(App), document.getElementById('app'));
