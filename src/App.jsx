import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { db } from './lib/firebase';
import { APP_VERSION, BADGES } from './lib/constants';
import {
    getPeriodLabel, getStats, getFirmnessEmoji, getEnergyLabel,
    getWeatherEmoji, formatRelativeTime, formatSimpleTimeAgo,
    formatTimer, getTodayDateString, calculateTotalDistance
} from './lib/utils';
import { useWalk } from './hooks/useWalk';
import { useHealthData } from './hooks/useHealthData';

import CareHistoryChart from './components/features/CareHistoryChart';
import PhotoViewer from './components/ui/PhotoViewer';
import MapView from './components/features/MapView';
import WalkEditForm from './components/features/WalkEditForm';
import HealthForm from './components/features/HealthForm';
import PaginationControls from './components/ui/PaginationControls';

export default function App() {
    const [activeTab, setActiveTab] = useState('home');
    const {
        isWalking, currentWalk, setCurrentWalk, photos, setPhotos,
        uploadingPhotos, startWalk, endWalk, handlePhotoUpload: handleWalkPhotoUpload, removePhoto: removeWalkPhoto
    } = useWalk();
    const { walks, healthRecords, walkers, loading } = useHealthData();

    // Local state for UI
    const [selectedWalkers, setSelectedWalkers] = useState([]);
    const [newWalkerName, setNewWalkerName] = useState('');
    const [showAddWalker, setShowAddWalker] = useState(false);
    const [statsView, setStatsView] = useState('week');
    const [showHealthForm, setShowHealthForm] = useState(false);
    const [healthType, setHealthType] = useState('hospital');
    const [editingWalk, setEditingWalk] = useState(null);
    const [editingHealth, setEditingHealth] = useState(null);
    const [showMap, setShowMap] = useState(null);
    const [viewingPhoto, setViewingPhoto] = useState(null);
    const [now, setNow] = useState(new Date());
    const [showWalkSetup, setShowWalkSetup] = useState(false);

    // Notifications
    const [notifyStart, setNotifyStart] = useState(false);
    const [notifyEnd, setNotifyEnd] = useState(false);

    const [healthFormData, setHealthFormData] = useState({});
    const [originalHealthData, setOriginalHealthData] = useState({});

    const [homePage, setHomePage] = useState(1);
    const [healthPage, setHealthPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    useEffect(() => {
        let timer;
        if (isWalking) {
            timer = setInterval(() => setNow(new Date()), 1000);
        }
        return () => clearInterval(timer);
    }, [isWalking]);

    // Data Mutations
    const addWalker = async () => {
        if (!newWalkerName.trim()) return;
        await addDoc(collection(db, 'walkers'), { name: newWalkerName.trim(), order: walkers.length });
        setNewWalkerName(''); setShowAddWalker(false);
    };

    const deleteWalker = async (walkerId) => {
        if (confirm('この散歩者を削除しますか?')) { await deleteDoc(doc(db, 'walkers', walkerId)); }
    };

    const updateWalk = async (walkId, data) => {
        await updateDoc(doc(db, 'walks', walkId), data);
        setEditingWalk(null);
    };

    const deleteWalk = async (walkId) => {
        if (confirm('この散歩記録を削除しますか?')) { await deleteDoc(doc(db, 'walks', walkId)); }
    };

    const saveHealthRecord = async (data) => {
        const dateTime = data.time ? new Date(`${data.date}T${data.time}`) : new Date(data.date);
        const recordData = { ...data, date: Timestamp.fromDate(dateTime) };
        delete recordData.id;
        if (data.id) { await updateDoc(doc(db, 'health', data.id), recordData); }
        else { await addDoc(collection(db, 'health'), recordData); }
        setShowHealthForm(false); setEditingHealth(null);
    };

    const deleteHealthRecord = async (id) => {
        if (!id) { alert('IDが見つかりません'); return; }
        if (confirm('この記録を削除しますか?')) { try { await deleteDoc(doc(db, 'health', id)); } catch (e) { alert('削除に失敗しました: ' + e); } }
    };

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

    const toggleWalkerSelection = (walkerName) => {
        setSelectedWalkers(prev => {
            if (prev.includes(walkerName)) { return prev.filter(w => w !== walkerName); }
            else {
                if (prev.length >= 10) { alert('散歩者は最大10人までです'); return prev; }
                return [...prev, walkerName];
            }
        });
    };

    const getEarnedBadges = () => {
        const totalCount = walks.length;
        const totalDistance = walks.reduce((sum, w) => sum + (w.distance || 0), 0);
        return BADGES.filter(badge => badge.condition(totalCount, totalDistance));
    };

    if (loading) { return <div className="flex items-center justify-center min-h-screen"><div className="text-lg">読み込み中...</div></div>; }

    const earnedBadges = getEarnedBadges();

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

    return (
        <div className="max-w-md mx-auto bg-white min-h-screen pb-20">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-4">
                <h1 className="text-2xl font-bold">🐕 福といっしょ</h1>
            </div>
            <div className="flex border-b overflow-x-auto">
                {['home', 'health', 'stats', 'badges', 'settings'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => handleTabChange(tab)}
                        className={`flex-shrink-0 px-4 py-3 ${activeTab === tab ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}
                    >
                        {tab === 'home' ? 'ホーム' : tab === 'health' ? 'お世話' : tab === 'stats' ? '統計' : tab === 'badges' ? 'バッジ' : '設定'}
                    </button>
                ))}
            </div>

            {activeTab === 'home' && (
                <div className="p-4">
                    <div className="bg-gradient-to-r from-blue-100 to-purple-100 p-4 rounded-lg mb-4 shadow-sm">
                        <CareHistoryChart walks={walks} healthRecords={healthRecords} />
                        <h2 className="text-sm font-bold mb-3 mt-4 text-gray-700">📊 {getPeriodLabel('week')}</h2>
                        <div className="grid grid-cols-5 gap-1">
                            {['count', 'distance', 'time', 'food', 'poo'].map(key => {
                                const stats = getStats('week', walks, healthRecords);
                                const labels = { count: ['散歩', '回', 'blue'], distance: ['距離', 'km', 'green'], time: ['時間', '分', 'purple'], food: ['ご飯', '回', 'orange'], poo: ['排泄', '回', 'yellow'] };
                                const values = { count: stats.count, distance: (stats.totalDistance / 1000).toFixed(1), time: stats.totalDuration, food: stats.mealCount, poo: stats.pooCount };
                                const [label, unit, color] = labels[key];
                                return (
                                    <div key={key} className="bg-white p-2 rounded text-center">
                                        <p className="text-[10px] text-gray-600">{label}</p>
                                        <p className={`text-lg font-bold text-${color}-600`}>
                                            {values[key]}<span className="text-xs text-gray-400 ml-0.5">{unit}</span>
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <h3 className="font-bold mb-2 text-lg flex items-center"><span className="mr-2">🕒</span>福のお世話</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                        {allRecords.length === 0 ? <p className="text-center text-gray-500 mt-4">まだ記録がありません</p> :
                            displayedHomeRecords.map(item => item.type === 'walk' ? (
                                <div key={'w-' + item.id} className="border rounded-lg p-3 bg-white shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <p className="font-bold text-lg">🚶 散歩 ({Array.isArray(item.walkers) ? item.walkers.join(', ') : item.walkers})</p>
                                            <div className="flex gap-1 mt-1">
                                                {item.pee && <span className="text-lg">💧</span>}
                                                {item.poo && <span className="text-lg">💩{item.pooFirmness ? getFirmnessEmoji(item.pooFirmness) : ''}</span>}
                                                {item.water && <span className="text-lg">🥤</span>}
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end pl-2">
                                            <div className="text-xs text-gray-500 font-bold">{formatRelativeTime(item.startTime)}</div>
                                            <div className="text-xs text-gray-500 font-bold">⏱️{item.duration}分 📍{(item.distance / 1000).toFixed(2)}km</div>
                                            {item.energy && <div className="text-xs font-bold text-orange-500 mt-1">元気: {getEnergyLabel(item.energy)}</div>}
                                            {item.weather && <div className="text-xs text-gray-600 font-medium mt-1">{getWeatherEmoji(item.weather.icon)} {item.weather.temp}℃ 💨{item.weather.wind}m</div>}
                                        </div>
                                    </div>
                                    <div>
                                        {item.memo && <div className="text-sm text-gray-600 mb-1 bg-gray-50 p-1 rounded">{item.memo}</div>}
                                        {item.photos && item.photos.length > 0 && (
                                            <div className="flex gap-1 mt-2 mb-2 overflow-x-auto">
                                                {item.photos.map((url, i) => <img key={i} src={url} className="h-16 w-16 object-cover rounded cursor-pointer border border-gray-200" onClick={() => setViewingPhoto(url)} />)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div key={'h-' + item.id} className="border rounded-lg p-3 bg-white shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <div><p className="font-bold text-lg">{(item.type === 'hospital' ? '🏥 病院' : item.type === 'grooming' ? '✂️ 散髪' : item.type === 'bath' ? '🛁 入浴' : item.type === 'brushing' ? '✨ ブラッシング' : item.type === 'cleaning' ? '🧹 掃除' : item.type === 'weight' ? '⚖️ 体重' : item.type === 'food' ? '🥣 ご飯' : item.type === 'excretion' ? '💩 排泄' : '💊 薬') + ' (' + item.walker + ')'}</p></div>
                                        <div className="text-right"><p className="text-xs text-gray-500 font-bold whitespace-nowrap">{formatRelativeTime(item.date)}</p></div>
                                    </div>
                                    <div className="mb-2">
                                        {item.photos && item.photos.length > 0 && <div className="flex gap-1 mb-2 overflow-x-auto">{item.photos.map((url, i) => <img key={i} src={url} className="h-16 w-16 object-cover rounded cursor-pointer border border-gray-200" onClick={() => setViewingPhoto(url)} />)}</div>}
                                        {item.hospitalName && <p className="text-sm">🏥 {item.hospitalName}</p>}
                                        {item.medicineType && <p className="text-sm text-blue-600">💊 {item.medicineType}</p>}
                                        {item.type === 'excretion' && item.pooFirmness && <p className="text-sm">硬さ: {getFirmnessEmoji(item.pooFirmness)}</p>}
                                        {item.type === 'food' && item.foodAmount && <p className="text-sm">残量: {(['', '空っぽ', '少し', '普通', '多め', '満杯'][item.foodAmount] || '普通') + ` (${item.foodAmount}/5)`}</p>}
                                        {item.type === 'cleaning' && (
                                            <div className="text-sm flex gap-2 mt-1 flex-wrap">
                                                {item.isFloorCleaned && <span className="bg-green-100 px-2 py-0.5 rounded text-green-800">床: 済</span>}
                                                {item.isToiletCleaned && <span className="bg-blue-100 px-2 py-0.5 rounded text-blue-800">トイレ: 済</span>}
                                                {item.isWaterChanged && <span className="bg-cyan-100 px-2 py-0.5 rounded text-cyan-800">水: 済</span>}
                                            </div>
                                        )}
                                        {item.type === 'weight' && <p className="text-lg font-bold text-blue-600">{item.weight} kg</p>}
                                        {item.memo && <p className="text-sm text-gray-600 mt-1">{item.memo}</p>}
                                    </div>
                                </div>
                            ))}
                        <PaginationControls currentPage={homePage} totalPages={homeTotalPages} onPageChange={setHomePage} />
                    </div>
                </div>
            )}

            {activeTab === 'health' && (
                <div className="p-4">
                    {isWalking && currentWalk ? (
                        <div className="space-y-4">
                            <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                                <p className="text-sm text-gray-600 mb-1">👥 散歩者: {currentWalk?.walkers.join(', ')}</p>
                                <p className="text-lg font-bold text-blue-700 mb-1">⏱️ 経過時間: {formatTimer(currentWalk?.startTime, now)}</p>
                                <p className="text-sm text-gray-600 mb-1">📍 距離: {(calculateTotalDistance(currentWalk?.positions || []) / 1000).toFixed(2)}km</p>
                                {currentWalk?.positions && currentWalk.positions.length > 0 && <p className="text-xs text-gray-500">🎯 GPS精度: {(currentWalk.positions[currentWalk.positions.length - 1]?.accuracy?.toFixed(0) || '測定中')}m</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">元気度: {getEnergyLabel(currentWalk?.energy)}</label>
                                <input
                                    type="range" min="1" max="5"
                                    value={currentWalk.energy}
                                    onChange={(e) => setCurrentWalk({ ...currentWalk, energy: parseInt(e.target.value) })}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-[10px] text-gray-500">
                                    <span>絶不調</span><span>普通</span><span>絶好調</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">記録</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => setCurrentWalk({ ...currentWalk, pee: !currentWalk.pee })} className={`py-3 rounded-lg border-2 font-bold ${currentWalk?.pee ? 'bg-yellow-100 border-yellow-500' : 'border-gray-300'}`}>💧 おしっこ</button>
                                    <button onClick={() => setCurrentWalk({ ...currentWalk, poo: !currentWalk.poo })} className={`py-3 rounded-lg border-2 font-bold ${currentWalk?.poo ? 'bg-amber-100 border-amber-500' : 'border-gray-300'}`}>💩 うんち</button>
                                    <button onClick={() => setCurrentWalk({ ...currentWalk, water: !currentWalk.water })} className={`py-3 rounded-lg border-2 font-bold ${currentWalk?.water ? 'bg-blue-100 border-blue-500' : 'border-gray-300'}`}>💧 水</button>
                                </div>
                                {currentWalk?.poo && (
                                    <div className="mt-2 bg-amber-50 p-2 rounded border border-amber-200">
                                        <label className="text-xs font-bold text-gray-600 block mb-1">うんちの硬さ: {getFirmnessLabel(currentWalk.pooFirmness)}</label>
                                        <input
                                            type="range" min="1" max="5"
                                            value={currentWalk.pooFirmness}
                                            onChange={(e) => setCurrentWalk({ ...currentWalk, pooFirmness: parseInt(e.target.value) })}
                                            className="w-full"
                                        />
                                        <div className="flex justify-between text-[10px] text-gray-500">
                                            <span>やわらかい</span><span>普通</span><span>硬い</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">写真 (最大4枚)</label>
                                <div className="grid grid-cols-4 gap-2 mb-2">
                                    {photos.map((url, i) => (
                                        <div key={i} className="relative">
                                            <img src={url} className="w-full h-20 object-cover rounded" />
                                            <button onClick={() => removeWalkPhoto(i)} className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 text-xs">×</button>
                                        </div>
                                    ))}
                                </div>
                                {photos.length < 4 && <input type="file" accept="image/*" multiple onChange={handleWalkPhotoUpload} disabled={uploadingPhotos} className="w-full text-sm" />}
                                {uploadingPhotos && <p className="text-sm text-gray-500">アップロード中...</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">メモ</label>
                                <textarea value={currentWalk?.memo || ''} onChange={(e) => setCurrentWalk({ ...currentWalk, memo: e.target.value })} className="w-full p-2 border rounded-lg" rows={3} placeholder="気づいたことをメモ..." />
                            </div>
                            <div className="flex items-center mb-2">
                                <input type="checkbox" id="notify-end-check" checked={notifyEnd} onChange={(e) => setNotifyEnd(e.target.checked)} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 mr-2" />
                                <label htmlFor="notify-end-check" className="text-sm font-bold text-gray-700">終了をLINEで通知する</label>
                            </div>
                            <button onClick={() => { if (confirm('散歩を終了しますか？')) endWalk(notifyEnd); }} disabled={uploadingPhotos} className={`w-full py-4 rounded-lg text-xl font-bold shadow-md ${uploadingPhotos ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600'}`}>
                                {uploadingPhotos ? '写真アップロード中...' : '🏁 散歩終了'}
                            </button>
                        </div>
                    ) : showWalkSetup ? (
                        <div className="space-y-4">
                            <h3 className="font-bold text-lg">🚶 散歩の準備</h3>
                            <div>
                                <label className="block text-sm font-medium mb-2">散歩者を選択</label>
                                <div className="space-y-2">
                                    {walkers.map(w => (
                                        <label key={w.id} className="flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50">
                                            <input type="checkbox" checked={selectedWalkers.includes(w.name)} onChange={() => toggleWalkerSelection(w.name)} className="mr-2 w-5 h-5" />
                                            <span>{w.name}</span>
                                        </label>
                                    ))}
                                </div>
                                {selectedWalkers.length > 0 && <p className="text-sm text-gray-600 mt-2">選択中: {selectedWalkers.join(', ')}</p>}
                            </div>
                            <div className="flex items-center mb-2">
                                <input type="checkbox" id="notify-start-check" checked={notifyStart} onChange={(e) => setNotifyStart(e.target.checked)} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 mr-2" />
                                <label htmlFor="notify-start-check" className="text-sm font-bold text-gray-700">開始をLINEで通知する</label>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => startWalk(selectedWalkers, notifyStart)} className="flex-1 bg-green-500 text-white py-3 rounded-lg text-lg font-bold shadow">開始</button>
                                <button onClick={() => setShowWalkSetup(false)} className="flex-1 bg-gray-300 text-black py-3 rounded-lg text-lg font-bold">キャンセル</button>
                            </div>
                        </div>
                    ) : !showHealthForm ? (
                        <div>
                            <div className="grid grid-cols-3 gap-2 mb-6">
                                <button onClick={() => setShowWalkSetup(true)} className="bg-green-500 text-white p-4 rounded-lg text-center flex flex-col items-center shadow-md transform active:scale-95 transition-transform">
                                    <span className="text-2xl mb-1">🚶</span><span className="text-xs font-bold">散歩</span>
                                    <span className="text-[10px] opacity-80 mt-1">{formatSimpleTimeAgo(getLastRecordTime('walk')) || '-'}</span>
                                </button>
                                {[
                                    { id: 'excretion', icon: '💩', label: '排泄', bg: 'bg-yellow-100' },
                                    { id: 'food', icon: '🥣', label: 'ご飯', bg: 'bg-orange-100' },
                                    { id: 'medicine', icon: '💊', label: '薬', bg: 'bg-green-100' },
                                    { id: 'bath', icon: '🛁', label: '入浴', bg: 'bg-blue-100' },
                                    { id: 'brushing', icon: '✨', label: 'ﾌﾞﾗｼ', bg: 'bg-purple-100' },
                                    { id: 'cleaning', icon: '🧹', label: '掃除', bg: 'bg-teal-100' },
                                    { id: 'weight', icon: '⚖️', label: '体重', bg: 'bg-indigo-100' },
                                    { id: 'grooming', icon: '✂️', label: '散髪', bg: 'bg-pink-100' },
                                    { id: 'hospital', icon: '🏥', label: '病院', bg: 'bg-red-100' }
                                ].map(btn => (
                                    <button key={btn.id} onClick={() => initHealthForm(btn.id, null)} className={`${btn.bg} p-4 rounded-lg text-center flex flex-col items-center shadow-sm`}>
                                        <span className="text-2xl mb-1">{btn.icon}</span><span className="text-xs font-bold">{btn.label}</span>
                                        <span className="text-[10px] opacity-80 mt-1">{formatSimpleTimeAgo(getLastRecordTime(btn.id)) || '-'}</span>
                                    </button>
                                ))}
                            </div>
                            <h3 className="font-bold mb-3">お世話したよ</h3>
                            <div className="space-y-3">
                                {allRecords.length === 0 ? <p className="text-center text-gray-500 mt-4">記録がありません</p> :
                                    displayedHealthRecords.map(item => item.type === 'walk' ? (
                                        <div key={'w-' + item.id} className="border rounded-lg p-3 bg-white shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex-1">
                                                    <p className="font-bold text-lg">🚶 散歩 ({Array.isArray(item.walkers) ? item.walkers.join(', ') : item.walkers})</p>
                                                    <div className="flex gap-1 mt-1">
                                                        {item.pee && <span className="text-lg">💧</span>}
                                                        {item.poo && <span className="text-lg">💩{item.pooFirmness ? getFirmnessEmoji(item.pooFirmness) : ''}</span>}
                                                        {item.water && <span className="text-lg">🥤</span>}
                                                    </div>
                                                </div>
                                                <div className="text-right flex flex-col items-end pl-2">
                                                    <div className="text-xs text-gray-500 font-bold">{formatRelativeTime(item.startTime)}</div>
                                                    <div className="text-xs text-gray-500 font-bold">⏱️{item.duration}分 📍{(item.distance / 1000).toFixed(2)}km</div>
                                                    {item.energy && <div className="text-xs font-bold text-orange-500 mt-1">元気: {getEnergyLabel(item.energy)}</div>}
                                                    {item.weather && <div className="text-xs text-gray-600 font-medium mt-1">{getWeatherEmoji(item.weather.icon)} {item.weather.temp}℃ 💨{item.weather.wind}m</div>}
                                                </div>
                                            </div>
                                            <div>
                                                {item.memo && <div className="text-sm text-gray-600 mb-1 bg-gray-50 p-1 rounded">{item.memo}</div>}
                                                {item.photos && item.photos.length > 0 && <div className="flex gap-1 mt-2 mb-2 overflow-x-auto">{item.photos.map((url, i) => <img key={i} src={url} className="h-16 w-16 object-cover rounded cursor-pointer border border-gray-200" onClick={() => setViewingPhoto(url)} />)}</div>}
                                                <div className="flex justify-end gap-2">
                                                    {item.positions && item.positions.length > 0 && <button onClick={() => setShowMap(item.positions)} className="px-3 py-1 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded text-xs font-bold">地図</button>}
                                                    <button onClick={() => setEditingWalk(item)} className="px-3 py-1 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded text-xs font-bold">編集</button>
                                                    <button onClick={() => deleteWalk(item.id)} className="px-3 py-1 text-red-600 bg-red-50 hover:bg-red-100 rounded text-xs font-bold">削除</button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div key={'h-' + item.id} className="border rounded-lg p-3 bg-white shadow-sm">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <p className="font-bold text-lg">{(item.type === 'hospital' ? '🏥 病院' : item.type === 'grooming' ? '✂️ 散髪' : item.type === 'bath' ? '🛁 入浴' : item.type === 'brushing' ? '✨ ブラッシング' : item.type === 'cleaning' ? '🧹 掃除' : item.type === 'weight' ? '⚖️ 体重' : item.type === 'food' ? '🥣 ご飯' : item.type === 'excretion' ? '💩 排泄' : '💊 薬') + ' (' + item.walker + ')'}</p>
                                                    <div className="mt-1">
                                                        {item.hospitalName && <p className="text-sm">🏥 {item.hospitalName}</p>}
                                                        {item.medicineType && <p className="text-sm text-blue-600">💊 {item.medicineType}</p>}
                                                        {item.type === 'excretion' && item.pooFirmness && <p className="text-sm">硬さ: {getFirmnessEmoji(item.pooFirmness)}</p>}
                                                        {item.type === 'food' && item.foodAmount && <p className="text-sm">残量: {(['', '空っぽ', '少し', '普通', '多め', '満杯'][item.foodAmount] || '普通') + ` (${item.foodAmount}/5)`}</p>}
                                                        {item.type === 'cleaning' && (
                                                            <div className="text-sm flex gap-2 mt-1 flex-wrap">
                                                                {item.isFloorCleaned && <span className="bg-green-100 px-2 py-0.5 rounded text-green-800">床: 済</span>}
                                                                {item.isToiletCleaned && <span className="bg-blue-100 px-2 py-0.5 rounded text-blue-800">トイレ: 済</span>}
                                                                {item.isWaterChanged && <span className="bg-cyan-100 px-2 py-0.5 rounded text-cyan-800">水: 済</span>}
                                                            </div>
                                                        )}
                                                        {item.type === 'weight' && <p className="text-lg font-bold text-indigo-600">{item.weight} kg</p>}
                                                        {item.memo && <p className="text-sm text-gray-600 mt-1">{item.memo}</p>}
                                                    </div>
                                                </div>
                                                <div className="text-right flex flex-col justify-between items-end gap-2">
                                                    <p className="text-xs text-gray-500 font-bold whitespace-nowrap">{formatRelativeTime(item.date)}</p>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => initHealthForm(item.type, item)} className="text-blue-500 text-xs font-bold border border-blue-200 px-2 py-1 rounded">編集</button>
                                                        <button onClick={() => deleteHealthRecord(item.id)} className="text-red-500 text-xs px-2 py-1">削除</button>
                                                    </div>
                                                </div>
                                            </div>
                                            {item.photos && item.photos.length > 0 && <div className="flex gap-1 mt-2 overflow-x-auto">{item.photos.map((url, i) => <img key={i} src={url} className="h-16 w-16 object-cover rounded cursor-pointer border border-gray-200" onClick={() => setViewingPhoto(url)} />)}</div>}
                                        </div>
                                    ))}
                                <PaginationControls currentPage={healthPage} totalPages={healthTotalPages} onPageChange={setHealthPage} />
                            </div>
                        </div>
                    ) : (
                        <HealthForm
                            type={healthType} walkers={walkers} formData={healthFormData} onChange={setHealthFormData}
                            onSave={saveHealthRecord} onCancel={() => { setShowHealthForm(false); setEditingHealth(null); }}
                        />
                    )}
                </div>
            )}

            {activeTab === 'stats' && (
                <div className="p-4">
                    <div className="flex gap-2 mb-4 overflow-x-auto">
                        {['week', 'month', 'year', 'all'].map(v => (
                            <button
                                key={v} onClick={() => setStatsView(v)}
                                className={`flex-shrink-0 px-4 py-2 rounded text-sm font-bold ${statsView === v ? 'bg-blue-500 text-white shadow' : 'bg-gray-200'}`}
                            >
                                {v === 'week' ? '今週' : v === 'month' ? '今月' : v === 'year' ? '今年' : '全期間'}
                            </button>
                        ))}
                    </div>
                    <div className="space-y-4">
                        <div className="bg-gradient-to-r from-blue-100 to-purple-100 p-4 rounded-lg shadow-sm border border-blue-200">
                            <h3 className="font-bold mb-2">📊 {getPeriodLabel(statsView)}</h3>
                            <div className="grid grid-cols-5 gap-1">
                                {(() => {
                                    const stats = getStats(statsView, walks, healthRecords);
                                    const labels = { count: ['散歩', '回', 'blue'], distance: ['距離', 'km', 'green'], time: ['時間', '分', 'purple'], food: ['ご飯', '回', 'orange'], poo: ['排泄', '回', 'yellow'] };
                                    return ['count', 'distance', 'time', 'food', 'poo'].map(key => {
                                         const values = { count: stats.count, distance: (stats.totalDistance / 1000).toFixed(1), time: stats.totalDuration, food: stats.mealCount, poo: stats.pooCount };
                                         const [label, unit, color] = labels[key];
                                         return (
                                            <div key={key} className="bg-white p-2 rounded text-center">
                                                <p className="text-[10px] text-gray-600">{label}</p>
                                                <p className={`text-lg font-bold text-${color}-600`}>
                                                    {values[key]}<span className="text-xs text-gray-400 ml-0.5">{unit}</span>
                                                </p>
                                            </div>
                                         );
                                    });
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'badges' && (
                <div className="p-4">
                    <h2 className="text-xl font-bold mb-4">🏆 実績・バッジ</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {BADGES.map(badge => {
                            const earned = earnedBadges.find(b => b.id === badge.id);
                            return (
                                <div key={badge.id} className={`p-4 rounded-lg text-center ${earned ? 'bg-gradient-to-br from-yellow-50 to-orange-100 border-2 border-yellow-400 shadow-sm' : 'bg-gray-100 opacity-50'}`}>
                                    <div className="text-4xl mb-2">{badge.icon}</div>
                                    <p className="font-bold text-sm">{badge.name}</p>
                                    {earned && <p className="text-xs text-green-600 mt-1 font-bold">✓ 獲得済み</p>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="p-4">
                    <h2 className="text-xl font-bold mb-4 flex items-center"><span className="mr-2">🏠</span>荒木家</h2>
                    <div className="space-y-2 mb-4">
                        {walkers.map(w => (
                            <div key={w.id} className="flex items-center justify-between p-3 border rounded-lg bg-white shadow-sm">
                                <span className="font-medium">{w.name}</span>
                                <button onClick={() => deleteWalker(w.id)} className="text-red-500 text-sm font-bold">削除</button>
                            </div>
                        ))}
                    </div>
                    {!showAddWalker ? (
                        <button onClick={() => setShowAddWalker(true)} className="w-full bg-blue-500 text-white py-3 rounded-lg font-bold shadow-md">+ メンバーを追加</button>
                    ) : (
                        <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
                            <input type="text" value={newWalkerName} onChange={(e) => setNewWalkerName(e.target.value)} placeholder="名前を入力" className="w-full p-2 border rounded" />
                            <div className="flex gap-2">
                                <button onClick={addWalker} className="flex-1 bg-green-500 text-white py-2 rounded font-bold">追加</button>
                                <button onClick={() => { setShowAddWalker(false); setNewWalkerName(''); }} className="flex-1 bg-gray-300 py-2 rounded">キャンセル</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 bg-gray-100 border-t p-2 text-center">
                <p className="text-xs text-gray-500 font-medium">福といっしょ {APP_VERSION}</p>
            </div>

            {editingWalk && <WalkEditForm walk={editingWalk} walkers={walkers} onSave={(data) => updateWalk(editingWalk.id, data)} onCancel={() => setEditingWalk(null)} />}
            {showMap && <MapView positions={showMap} onClose={() => setShowMap(null)} />}
            {viewingPhoto && <PhotoViewer src={viewingPhoto} onClose={() => setViewingPhoto(null)} />}
        </div>
    );
}
