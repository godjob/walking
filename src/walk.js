// @ts-nocheck
// WalkEditForm コンポーネント

import { storage } from './firebase-init.js';
import { toLocalISOString, compressImage, getEnergyLabel, useModalScrollLock } from './utils.js';

function WalkEditForm({ walk, walkers, onSave, onCancel }) {
    const { useState } = React;
    useModalScrollLock(true);
    const [formData, setFormData] = useState({
        walkers: walk.walkers || [],
        startTime: walk.startTime ? toLocalISOString(walk.startTime) : '',
        endTime: walk.endTime ? toLocalISOString(walk.endTime) : '',
        distance: walk.distance !== undefined ? (walk.distance / 1000) : '',
        pee: walk.pee || false,
        poo: walk.poo || false,
        energy: walk.energy || 3,
        water: walk.water || false,
        memo: walk.memo || '',
        photos: walk.photos || []
    });
    const [uploading, setUploading] = useState(false);

    const toggleWalker = (walkerName) => {
        setFormData(prev => ({
            ...prev,
            walkers: prev.walkers.includes(walkerName)
                ? prev.walkers.filter(w => w !== walkerName)
                : [...prev.walkers, walkerName]
        }));
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
                const ref = storage.ref(`walks/${Date.now()}_${randomId}_${fileName}`);
                await ref.put(compressedBlob);
                return await ref.getDownloadURL();
            });
            const newUrls = await Promise.all(uploadPromises);
            setFormData(prev => ({ ...prev, photos: [...prev.photos, ...newUrls] }));
        } catch (err) {
            alert('アップロードに失敗しました: ' + err);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const removePhoto = (index) => {
        setFormData(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }));
    };

    const handleSubmit = () => {
        if (formData.walkers.length === 0) { alert('散歩者を選択してください'); return; }
        const start = new Date(formData.startTime);
        const end = new Date(formData.endTime);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) { alert('日時が正しくありません'); return; }
        if (end < start) { alert('終了時間は開始時間より後にしてください'); return; }
        const newDuration = Math.floor((end - start) / 60000);
        const saveData = {
            ...formData,
            startTime: firebase.firestore.Timestamp.fromDate(start),
            endTime: firebase.firestore.Timestamp.fromDate(end),
            duration: newDuration,
            distance: (formData.distance !== '' && formData.distance !== null) ? Math.round(parseFloat(formData.distance) * 1000) : 0
        };
        onSave(saveData);
    };

    return React.createElement('div', {
        className: 'modal-overlay p-4'
    },
        React.createElement('div', { className: 'bg-white rounded-lg w-full max-w-md modal-content' },
            React.createElement('div', { className: 'p-4' },
                React.createElement('h3', { className: 'font-bold text-lg mb-4' }, '散歩記録を編集'),
                React.createElement('div', { className: 'space-y-4' },
                    React.createElement('div', null,
                        React.createElement('label', { className: 'block text-sm font-medium mb-2' }, '日時'),
                        React.createElement('div', { className: 'grid grid-cols-2 gap-2' },
                            React.createElement('div', null,
                                React.createElement('label', { className: 'text-xs text-gray-500' }, '開始'),
                                React.createElement('input', {
                                    type: 'datetime-local',
                                    value: formData.startTime,
                                    onChange: (e) => setFormData({ ...formData, startTime: e.target.value }),
                                    className: 'w-full p-2 border rounded text-sm'
                                })
                            ),
                            React.createElement('div', null,
                                React.createElement('label', { className: 'text-xs text-gray-500' }, '終了'),
                                React.createElement('input', {
                                    type: 'datetime-local',
                                    value: formData.endTime,
                                    onChange: (e) => setFormData({ ...formData, endTime: e.target.value }),
                                    className: 'w-full p-2 border rounded text-sm'
                                })
                            )
                        )
                    ),
                    React.createElement('div', null,
                        React.createElement('label', { className: 'block text-sm font-medium mb-2' }, '散歩者'),
                        React.createElement('div', { className: 'space-y-2' },
                            walkers.map(w => React.createElement('label', {
                                key: w.id, className: 'flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50'
                            },
                                React.createElement('input', {
                                    type: 'checkbox', checked: formData.walkers.includes(w.name),
                                    onChange: () => toggleWalker(w.name), className: 'mr-2 w-5 h-5'
                                }),
                                React.createElement('span', null, w.name)
                            ))
                        )
                    ),
                    React.createElement('div', null,
                        React.createElement('label', { className: 'block text-sm font-medium mb-2' }, '歩行距離'),
                        React.createElement('div', { className: 'flex items-center gap-2' },
                            React.createElement('input', {
                                type: 'number',
                                min: '0',
                                step: '0.01',
                                placeholder: '例: 1.71',
                                value: formData.distance,
                                onChange: (e) => setFormData({ ...formData, distance: e.target.value }),
                                className: 'border border-gray-300 rounded px-3 py-2 w-full text-sm'
                            }),
                            React.createElement('span', { className: 'text-sm text-gray-600 whitespace-nowrap' }, 'km')
                        )
                    ),
                    React.createElement('div', null,
                        React.createElement('label', { className: 'block text-sm font-medium mb-2' }, '元気度: ' + getEnergyLabel(formData.energy)),
                        React.createElement('input', {
                            type: 'range', min: '1', max: '5',
                            value: formData.energy,
                            onChange: (e) => setFormData({ ...formData, energy: parseInt(e.target.value) }),
                            className: 'w-full'
                        }),
                        React.createElement('div', { className: 'flex justify-between text-xs text-gray-500' },
                            React.createElement('span', null, '絶不調'),
                            React.createElement('span', null, '普通'),
                            React.createElement('span', null, '絶好調')
                        )
                    ),
                    React.createElement('div', null,
                        React.createElement('label', { className: 'block text-sm font-medium mb-2' }, '記録'),
                        React.createElement('div', { className: 'grid grid-cols-3 gap-2' },
                            React.createElement('button', {
                                onClick: () => setFormData({ ...formData, pee: !formData.pee }),
                                type: 'button',
                                className: `py-3 rounded-lg border-2 ${formData.pee ? 'bg-yellow-100 border-yellow-500' : 'border-gray-300'}`
                            }, '💧 おしっこ'),
                            React.createElement('button', {
                                onClick: () => setFormData({ ...formData, poo: !formData.poo }),
                                type: 'button',
                                className: `py-3 rounded-lg border-2 ${formData.poo ? 'bg-amber-100 border-amber-500' : 'border-gray-300'}`
                            }, '💩 うんち'),
                            React.createElement('button', {
                                onClick: () => setFormData({ ...formData, water: !formData.water }),
                                type: 'button',
                                className: `py-3 rounded-lg border-2 ${formData.water ? 'bg-blue-100 border-blue-500' : 'border-gray-300'}`
                            }, '💧 水')
                        )
                    ),
                    React.createElement('div', null,
                        React.createElement('label', { className: 'block text-sm font-medium mb-2' }, '写真'),
                        React.createElement('div', { className: 'grid grid-cols-4 gap-2 mb-2' },
                            formData.photos.map((url, i) => React.createElement('div', { key: i, className: 'relative' },
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
                        React.createElement('label', { className: 'block text-sm font-medium mb-2' }, 'メモ'),
                        React.createElement('textarea', {
                            value: formData.memo, onChange: (e) => setFormData({ ...formData, memo: e.target.value }),
                            className: 'w-full p-2 border rounded-lg', rows: 3
                        })
                    ),
                    React.createElement('div', { className: 'flex gap-2' },
                        React.createElement('button', { onClick: handleSubmit, className: 'flex-1 bg-blue-500 text-white py-2 rounded-lg' }, '保存'),
                        React.createElement('button', { onClick: onCancel, className: 'flex-1 bg-gray-300 py-2 rounded-lg' }, 'キャンセル')
                    )
                )
            )
        )
    );
}

export { WalkEditForm };
