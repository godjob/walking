// @ts-nocheck
// HealthForm, CareHistoryChart コンポーネント

import { storage } from './firebase-init.js';
import { compressImage, getFirmnessLabel, getFoodAmountLabel, useModalScrollLock } from './utils.js';

function CareHistoryChart({ walks, healthRecords }) {
    const { useRef, useEffect } = React;
    const todayRef = useRef(null);
    const scrollRef = useRef(null);

    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = -14; i <= 2; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        dates.push(d);
    }

    const allEvents = [
        ...walks.map(w => ({ type: 'walk', date: new Date(w.startTime) })),
        ...healthRecords.map(h => ({ type: h.type, date: new Date(h.date) }))
    ];

    const getIcon = (type) => {
        const map = {
            'walk': '🚶',
            'excretion': '💩',
            'food': '🥣',
            'medicine': '💊',
            'bath': '🛁',
            'brushing': '✨',
            'cleaning': '🧹',
            'weight': '⚖️',
            'grooming': '✂️',
            'hospital': '🏥',
            'yard': '🏡'
        };
        return map[type] || '✨';
    };

    useEffect(() => {
        if (todayRef.current) {
            todayRef.current.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
        }
    }, []);

    return React.createElement('div', { className: 'w-full mb-2 bg-white/50 rounded-lg p-2' },
        React.createElement('div', {
            ref: scrollRef,
            className: 'flex gap-2 overflow-x-auto no-scrollbar pb-2 items-end h-32',
        },
            dates.map((date, index) => {
                const isToday = date.getTime() === today.getTime();
                const dateKey = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();

                const dayEvents = allEvents.filter(e => {
                    const eDate = new Date(e.date);
                    return eDate.getFullYear() === date.getFullYear() &&
                        eDate.getMonth() === date.getMonth() &&
                        eDate.getDate() === date.getDate();
                }).sort((a, b) => a.date - b.date);

                const dayLabel = date.getDate();
                const weekLabel = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];

                return React.createElement('div', {
                    key: index,
                    ref: isToday ? todayRef : null,
                    className: 'flex flex-col-reverse items-center min-w-[32px] flex-shrink-0'
                },
                    React.createElement('div', {
                        className: `text-xs mt-1 text-center border-t border-gray-400 w-full pt-1 ${isToday ? 'font-bold text-blue-700' : 'text-gray-600'}`
                    },
                        React.createElement('span', { className: 'block text-sm leading-none' }, dayLabel),
                        React.createElement('span', { className: 'text-[10px]' }, weekLabel)
                    ),
                    dayEvents.map((ev, i) =>
                        React.createElement('div', { key: i, className: 'text-sm leading-none mb-0.5' }, getIcon(ev.type))
                    )
                );
            })
        )
    );
}

function HealthForm({ type, walkers, formData, onChange, onSave, onCancel }) {
    const { useState } = React;
    const [uploading, setUploading] = useState(false);

    const handleSubmit = () => {
        if (!formData.walker) { alert('担当者を選択してください'); return; }
        if (type === 'hospital' && !formData.hospitalName) { alert('病院名を入力してください'); return; }
        if (type === 'grooming' && formData.groomedBy === 'shop' && !formData.shopName) { alert('店舗名を入力してください'); return; }
        if (type === 'medicine' && !formData.medicineType) { alert('薬の種類を入力してください'); return; }
        if (type === 'weight' && !formData.weight) { alert('体重を入力してください'); return; }
        onSave(formData);
    };

    const handlePhotoUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        setUploading(true);
        try {
            const uploadPromises = files.map(async (file) => {
                const compressedBlob = await compressImage(file);
                const randomId = Math.random().toString(36).substring(7);
                const fileName = file.name.split('.')[0] + '.jpg';
                const ref = storage.ref(`health/${Date.now()}_${randomId}_${fileName}`);
                await ref.put(compressedBlob);
                return await ref.getDownloadURL();
            });
            const newUrls = await Promise.all(uploadPromises);
            onChange({ ...formData, photos: [...(formData.photos || []), ...newUrls] });
        } catch (err) {
            alert('アップロードに失敗しました: ' + err);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const removePhoto = (index) => {
        onChange({ ...formData, photos: (formData.photos || []).filter((_, i) => i !== index) });
    };

    return React.createElement('div', { className: 'space-y-4 bg-white p-4 rounded-lg' },
        React.createElement('h3', { className: 'font-bold text-lg' },
            (formData.id ? '✏️ 編集: ' : '') +
            (type === 'hospital' ? '🏥 病院記録' : type === 'grooming' ? '✂️ 散髪記録' : type === 'bath' ? '🛁 入浴記録' : type === 'brushing' ? '✨ ブラッシング' : type === 'cleaning' ? '🧹 掃除' : type === 'weight' ? '⚖️ 体重' : type === 'food' ? '🥣 ご飯' : type === 'excretion' ? '💩 排泄記録' : type === 'yard' ? '🏡 庭遊び記録' : '💊 薬記録')
        ),
        React.createElement('div', null,
            React.createElement('label', { className: 'block text-sm font-medium mb-1' }, '担当者'),
            React.createElement('select', {
                value: formData.walker, onChange: (e) => onChange({ ...formData, walker: e.target.value }),
                className: 'w-full p-2 border rounded'
            },
                React.createElement('option', { value: '' }, '担当者を選択'),
                walkers.map(w => React.createElement('option', { key: w.id, value: w.name }, w.name))
            )
        ),
        React.createElement('div', null,
            React.createElement('label', { className: 'block text-sm font-medium mb-1' }, '日付'),
            React.createElement('input', {
                type: 'date', value: formData.date,
                onChange: (e) => onChange({ ...formData, date: e.target.value }),
                className: 'w-full p-2 border rounded'
            })
        ),
        React.createElement('div', null,
            React.createElement('label', { className: 'block text-sm font-medium mb-1' }, '時刻'),
            React.createElement('input', {
                type: 'time', value: formData.time,
                onChange: (e) => onChange({ ...formData, time: e.target.value }),
                className: 'w-full p-2 border rounded'
            })
        ),
        type === 'hospital' && React.createElement('div', null,
            React.createElement('label', { className: 'block text-sm font-medium mb-1' }, '病院名'),
            React.createElement('input', {
                type: 'text', value: formData.hospitalName,
                onChange: (e) => onChange({ ...formData, hospitalName: e.target.value }),
                className: 'w-full p-2 border rounded', placeholder: '例: ○○動物病院'
            }),
            React.createElement('label', { className: 'block text-sm font-medium mb-1 mt-2' }, '理由'),
            React.createElement('input', {
                type: 'text', value: formData.reason,
                onChange: (e) => onChange({ ...formData, reason: e.target.value }),
                className: 'w-full p-2 border rounded', placeholder: '例: 定期検診'
            })
        ),
        type === 'grooming' && React.createElement('div', null,
            React.createElement('label', { className: 'block text-sm font-medium mb-1' }, '実施場所'),
            React.createElement('div', { className: 'space-y-2' },
                React.createElement('label', { className: 'flex items-center' },
                    React.createElement('input', {
                        type: 'radio', name: 'groomedBy', value: 'walker',
                        checked: formData.groomedBy === 'walker',
                        onChange: (e) => onChange({ ...formData, groomedBy: e.target.value }),
                        className: 'mr-2'
                    }), '自宅'
                ),
                React.createElement('label', { className: 'flex items-center' },
                    React.createElement('input', {
                        type: 'radio', name: 'groomedBy', value: 'shop',
                        checked: formData.groomedBy === 'shop',
                        onChange: (e) => onChange({ ...formData, groomedBy: e.target.value }),
                        className: 'mr-2'
                    }), '店舗'
                ),
                formData.groomedBy === 'shop' && React.createElement('input', {
                    type: 'text', value: formData.shopName,
                    onChange: (e) => onChange({ ...formData, shopName: e.target.value }),
                    className: 'w-full p-2 border rounded ml-6', placeholder: '店舗名を入力'
                })
            )
        ),
        type === 'medicine' && React.createElement('div', null,
            React.createElement('label', { className: 'block text-sm font-medium mb-1' }, '薬の種類'),
            React.createElement('input', {
                type: 'text', value: formData.medicineType,
                onChange: (e) => onChange({ ...formData, medicineType: e.target.value }),
                className: 'w-full p-2 border rounded', placeholder: '例: フィラリア予防薬'
            }),
            React.createElement('label', { className: 'flex items-center mt-2' },
                React.createElement('input', {
                    type: 'checkbox', checked: formData.isVaccine,
                    onChange: (e) => onChange({ ...formData, isVaccine: e.target.checked }),
                    className: 'mr-2'
                }), '予防接種'
            )
        ),
        type === 'excretion' && React.createElement('div', null,
            React.createElement('label', { className: 'block text-sm font-medium mb-1' },
                'うんちの硬さ: ' + getFirmnessLabel(formData.pooFirmness)
            ),
            React.createElement('input', {
                type: 'range', min: 1, max: 5, value: formData.pooFirmness,
                onChange: (e) => onChange({ ...formData, pooFirmness: parseInt(e.target.value) }),
                className: 'w-full'
            }),
            React.createElement('div', { className: 'flex justify-between text-xs text-gray-500 mt-1' },
                React.createElement('span', null, 'やわらかい'), React.createElement('span', null, '普通'), React.createElement('span', null, '硬い')
            )
        ),
        type === 'food' && React.createElement('div', null,
            React.createElement('label', { className: 'block text-sm font-medium mb-1' },
                '残量: ' + getFoodAmountLabel(formData.foodAmount || 3)
            ),
            React.createElement('input', {
                type: 'range', min: 1, max: 5, value: formData.foodAmount || 3,
                onChange: (e) => onChange({ ...formData, foodAmount: parseInt(e.target.value) }),
                className: 'w-full'
            }),
            React.createElement('div', { className: 'flex justify-between text-xs text-gray-500 mt-1' },
                React.createElement('span', null, '空'), React.createElement('span', null, '普通'), React.createElement('span', null, '満杯')
            )
        ),
        type === 'cleaning' && React.createElement('div', null,
            React.createElement('label', { className: 'block text-sm font-medium mb-1' }, '実施した内容'),
            React.createElement('div', { className: 'flex gap-4 mt-2 flex-wrap' },
                React.createElement('label', { className: 'flex items-center' },
                    React.createElement('input', {
                        type: 'checkbox', checked: formData.isFloorCleaned,
                        onChange: (e) => onChange({ ...formData, isFloorCleaned: e.target.checked }),
                        className: 'mr-2 w-5 h-5'
                    }), '床を掃除'
                ),
                React.createElement('label', { className: 'flex items-center' },
                    React.createElement('input', {
                        type: 'checkbox', checked: formData.isToiletCleaned,
                        onChange: (e) => onChange({ ...formData, isToiletCleaned: e.target.checked }),
                        className: 'mr-2 w-5 h-5'
                    }), 'トイレ掃除'
                ),
                React.createElement('label', { className: 'flex items-center' },
                    React.createElement('input', {
                        type: 'checkbox', checked: formData.isWaterChanged,
                        onChange: (e) => onChange({ ...formData, isWaterChanged: e.target.checked }),
                        className: 'mr-2 w-5 h-5'
                    }), '飲み水交換'
                )
            )
        ),
        type === 'weight' && React.createElement('div', null,
            React.createElement('label', { className: 'block text-sm font-medium mb-1' }, '体重 (kg)'),
            React.createElement('input', {
                type: 'number', step: '0.1', value: formData.weight || '',
                onChange: (e) => onChange({ ...formData, weight: e.target.value }),
                className: 'w-full p-2 border rounded', placeholder: '例: 12.5'
            })
        ),
        type === 'yard' && React.createElement('div', { className: 'space-y-3' },
            React.createElement('div', null,
                React.createElement('label', { className: 'block text-sm font-medium mb-1' }, '庭に出た時間'),
                React.createElement('div', { className: 'flex items-center gap-2' },
                    React.createElement('input', {
                        type: 'time', value: formData.yardStartTime || '',
                        onChange: (e) => onChange({ ...formData, yardStartTime: e.target.value }),
                        className: 'flex-1 p-2 border rounded'
                    }),
                    React.createElement('span', { className: 'text-gray-500' }, '〜'),
                    React.createElement('input', {
                        type: 'time', value: formData.yardEndTime || '',
                        onChange: (e) => onChange({ ...formData, yardEndTime: e.target.value }),
                        className: 'flex-1 p-2 border rounded'
                    })
                )
            ),
            React.createElement('div', null,
                React.createElement('label', { className: 'flex items-center gap-2 cursor-pointer' },
                    React.createElement('input', {
                        type: 'checkbox', checked: formData.yardPoo || false,
                        onChange: (e) => onChange({ ...formData, yardPoo: e.target.checked }),
                        className: 'w-5 h-5'
                    }),
                    React.createElement('span', { className: 'text-sm font-medium' }, '💩 うんちあり')
                ),
                formData.yardPoo && React.createElement('div', { className: 'mt-2 bg-amber-50 p-2 rounded border border-amber-200' },
                    React.createElement('label', { className: 'text-xs font-bold text-gray-600 block mb-1' },
                        'うんちの硬さ: ' + getFirmnessLabel(formData.yardPooFirmness || 3)
                    ),
                    React.createElement('input', {
                        type: 'range', min: 1, max: 5, value: formData.yardPooFirmness || 3,
                        onChange: (e) => onChange({ ...formData, yardPooFirmness: parseInt(e.target.value) }),
                        className: 'w-full'
                    }),
                    React.createElement('div', { className: 'flex justify-between text-[10px] text-gray-500 mt-1' },
                        React.createElement('span', null, 'やわらかい'),
                        React.createElement('span', null, '普通'),
                        React.createElement('span', null, '硬い')
                    )
                )
            )
        ),
        React.createElement('div', null,
            React.createElement('label', { className: 'block text-sm font-medium mb-2' }, '写真 (最大4枚)'),
            React.createElement('div', { className: 'grid grid-cols-4 gap-2 mb-2' },
                (formData.photos || []).map((url, i) => React.createElement('div', { key: i, className: 'relative' },
                    React.createElement('img', { src: url, className: 'w-full h-16 object-cover rounded' }),
                    React.createElement('button', {
                        onClick: () => removePhoto(i),
                        className: 'absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 text-xs'
                    }, '×')
                ))
            ),
            React.createElement('input', {
                type: 'file', accept: 'image/*', multiple: true, onChange: handlePhotoUpload,
                disabled: uploading, className: 'w-full text-sm'
            }),
            uploading && React.createElement('p', { className: 'text-sm text-gray-500' }, 'アップロード中...')
        ),
        React.createElement('div', null,
            React.createElement('label', { className: 'block text-sm font-medium mb-1' }, 'メモ'),
            React.createElement('textarea', {
                value: formData.memo, onChange: (e) => onChange({ ...formData, memo: e.target.value }),
                className: 'w-full p-2 border rounded', rows: 3, placeholder: '詳細をメモ...'
            })
        ),

        React.createElement('div', { className: 'flex items-center mb-2' },
            React.createElement('input', {
                type: 'checkbox',
                id: 'notify-check',
                checked: formData.notify,
                onChange: (e) => onChange({ ...formData, notify: e.target.checked }),
                className: 'w-5 h-5 text-blue-600 rounded focus:ring-blue-500 mr-2'
            }),
            React.createElement('label', { htmlFor: 'notify-check', className: 'text-sm font-bold text-gray-700' }, 'LINEで通知する')
        ),

        React.createElement('div', { className: 'flex gap-2 mb-8' },
            React.createElement('button', { onClick: handleSubmit, className: 'flex-1 bg-blue-500 text-white py-2 rounded font-bold' }, '保存'),
            React.createElement('button', { onClick: onCancel, className: 'flex-1 bg-gray-300 py-2 rounded' }, 'キャンセル')
        )
    );
}

export { CareHistoryChart, HealthForm };
