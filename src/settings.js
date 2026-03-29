// @ts-nocheck
// SettingsScreen コンポーネント・exportAllData関数

import { db } from './firebase-init.js';

function SettingsScreen({ settings, onSave, onReset }) {
    const { useState, useEffect } = React;
    const [localSettings, setLocalSettings] = useState(settings);

    // 親コンポーネントのsettingsが更新されたらローカルも同期（初期ロード時など）
    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleChange = (key, value) => {
        setLocalSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        onSave(localSettings);
    };

    return React.createElement('div', { className: 'pb-20' },
        // Section 1: Stop Detection
        React.createElement('div', { className: 'bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4' },
            React.createElement('h3', { className: 'font-bold text-lg mb-3 text-gray-800 flex items-center' }, React.createElement('span', { className: 'mr-2' }, '🛑'), '停止判定'),

            React.createElement('div', { className: 'mb-6' },
                React.createElement('label', { className: 'block text-sm font-medium mb-1' }, `判定範囲 (半径): ${localSettings.stopDetectionRadius}m`),
                React.createElement('input', {
                    type: 'range', min: 5, max: 50, step: 5,
                    value: localSettings.stopDetectionRadius,
                    onChange: (e) => handleChange('stopDetectionRadius', parseInt(e.target.value)),
                    className: 'w-full mb-1'
                }),
                React.createElement('p', { className: 'text-xs text-gray-500' }, '推奨: 10m (初期設定)')
            ),

            React.createElement('div', null,
                React.createElement('label', { className: 'block text-sm font-medium mb-1' }, `判定時間: ${localSettings.stopDetectionDuration}秒`),
                React.createElement('input', {
                    type: 'range', min: 10, max: 300, step: 10,
                    value: localSettings.stopDetectionDuration,
                    onChange: (e) => handleChange('stopDetectionDuration', parseInt(e.target.value)),
                    className: 'w-full mb-1'
                }),
                React.createElement('p', { className: 'text-xs text-gray-500' }, '推奨: 30秒 (初期設定)')
            )
        ),

        // Section 2: Auto End
        React.createElement('div', { className: 'bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4' },
            React.createElement('h3', { className: 'font-bold text-lg mb-3 text-gray-800 flex items-center' }, React.createElement('span', { className: 'mr-2' }, '🏁'), '自動終了'),

            React.createElement('div', { className: 'flex items-center justify-between mb-4' },
                React.createElement('span', { className: 'text-sm font-medium' }, '自動終了を有効にする'),
                React.createElement('div', {
                    className: `w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${localSettings.autoEndEnabled ? 'bg-green-500' : 'bg-gray-300'}`,
                    onClick: () => handleChange('autoEndEnabled', !localSettings.autoEndEnabled)
                },
                    React.createElement('div', { className: `bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${localSettings.autoEndEnabled ? 'translate-x-6' : ''}` })
                )
            ),
            React.createElement('p', { className: 'text-xs text-gray-500 mb-4' }, '推奨: オン (初期設定)'),

            localSettings.autoEndEnabled && React.createElement('div', null,
                React.createElement('label', { className: 'block text-sm font-medium mb-1' }, `終了までの時間: ${Math.floor(localSettings.autoEndAfterStop / 60)}分`),
                React.createElement('input', {
                    type: 'range', min: 60, max: 1800, step: 60,
                    value: localSettings.autoEndAfterStop,
                    onChange: (e) => handleChange('autoEndAfterStop', parseInt(e.target.value)),
                    className: 'w-full mb-1'
                }),
                React.createElement('p', { className: 'text-xs text-gray-500' }, '推奨: 10分 (初期設定)')
            )
        ),

        // Section 3: Location
        React.createElement('div', { className: 'bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6' },
            React.createElement('h3', { className: 'font-bold text-lg mb-3 text-gray-800 flex items-center' }, React.createElement('span', { className: 'mr-2' }, '📍'), '位置情報'),

            React.createElement('div', { className: 'mb-6' },
                React.createElement('label', { className: 'block text-sm font-medium mb-1' }, `GPS更新間隔: ${localSettings.gpsUpdateInterval}秒`),
                React.createElement('input', {
                    type: 'range', min: 3, max: 30, step: 1,
                    value: localSettings.gpsUpdateInterval,
                    onChange: (e) => handleChange('gpsUpdateInterval', parseInt(e.target.value)),
                    className: 'w-full mb-1'
                }),
                React.createElement('p', { className: 'text-xs text-gray-500' }, '推奨: 5秒 (初期設定) バッテリーと精度のバランス'),
                localSettings.gpsUpdateInterval === 3 && React.createElement('p', { className: 'text-xs text-amber-600 font-bold mt-1' }, '⚠️ バッテリー消費が大きくなります')
            ),

            React.createElement('div', null,
                React.createElement('label', { className: 'block text-sm font-medium mb-1' }, `最小記録距離: ${localSettings.minimumDistanceThreshold}m`),
                React.createElement('input', {
                    type: 'range', min: 1, max: 20, step: 1,
                    value: localSettings.minimumDistanceThreshold,
                    onChange: (e) => handleChange('minimumDistanceThreshold', parseInt(e.target.value)),
                    className: 'w-full mb-1'
                }),
                React.createElement('p', { className: 'text-xs text-gray-500' }, '推奨: 5m (初期設定)')
            )
        ),

        // Action Buttons
        React.createElement('div', { className: 'flex gap-3' },
            React.createElement('button', {
                onClick: handleSave,
                className: 'flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg shadow hover:bg-blue-700 transition-colors'
            }, '保存'),
            React.createElement('button', {
                onClick: () => { if(confirm('初期設定に戻しますか？')) onReset(); },
                className: 'flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-300 transition-colors'
            }, '初期設定に戻す')
        ),

        // Section: Data Management
        React.createElement('div', { className: 'bg-white p-4 rounded-lg shadow-sm border border-gray-200 mt-4' },
            React.createElement('h3', { className: 'font-bold text-lg mb-3 text-gray-800 flex items-center' },
                React.createElement('span', { className: 'mr-2' }, '💾'), 'データ管理'
            ),
            React.createElement('button', {
                id: 'exportAllDataBtn',
                onClick: exportAllData,
                className: 'w-full bg-green-600 text-white font-bold py-3 rounded-lg shadow hover:bg-green-700 transition-colors'
            }, '全データをエクスポート（JSON）')
        )
    );
}

async function exportAllData() {
    const btn = document.getElementById('exportAllDataBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'エクスポート中...'; }
    try {
        function convertTimestamps(obj) {
            if (obj === null || obj === undefined) return obj;
            if (typeof obj.toDate === 'function') return obj.toDate().toISOString();
            if (Array.isArray(obj)) return obj.map(convertTimestamps);
            if (typeof obj === 'object') {
                const result = {};
                for (const key of Object.keys(obj)) { result[key] = convertTimestamps(obj[key]); }
                return result;
            }
            return obj;
        }

        const [walksSnap, healthSnap, walkersSnap, settingsSnap] = await Promise.all([
            db.collection('walks').get(),
            db.collection('health').get(),
            db.collection('walkers').get(),
            db.collection('settings').get()
        ]);

        const exportData = {
            exportedAt: new Date().toISOString(),
            walks: walksSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })),
            health: healthSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })),
            walkers: walkersSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })),
            settings: settingsSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }))
        };

        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const today = new Date().toISOString().slice(0, 10);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fuku-walk-backup-${today}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert('完了しました！');
    } catch (e) {
        console.error('Export error:', e);
        alert('エクスポートに失敗しました');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '全データをエクスポート（JSON）'; }
    }
}

export { SettingsScreen, exportAllData };
