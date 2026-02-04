import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { toLocalISOString, getEnergyLabel } from '../../lib/utils';
import { useImageUpload } from '../../hooks/useImageUpload';

export default function WalkEditForm({ walk, walkers, onSave, onCancel }) {
    const [formData, setFormData] = useState({
        walkers: walk.walkers || [],
        startTime: walk.startTime ? toLocalISOString(walk.startTime) : '',
        endTime: walk.endTime ? toLocalISOString(walk.endTime) : '',
        pee: walk.pee || false,
        poo: walk.poo || false,
        energy: walk.energy || 3,
        water: walk.water || false,
        memo: walk.memo || '',
        photos: walk.photos || []
    });

    const { uploading, uploadPhotos } = useImageUpload('walks');

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
        const newUrls = await uploadPhotos(files, formData.photos);
        if (newUrls) {
             setFormData(prev => ({ ...prev, photos: [...prev.photos, ...newUrls] }));
        }
        e.target.value = '';
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
            startTime: Timestamp.fromDate(start),
            endTime: Timestamp.fromDate(end),
            duration: newDuration
        };
        onSave(saveData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-md max-h-[85vh] overflow-y-auto">
                <div className="p-4">
                    <h3 className="font-bold text-lg mb-4">散歩記録を編集</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">日時</label>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-gray-500">開始</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.startTime}
                                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                        className="w-full p-2 border rounded text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">終了</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.endTime}
                                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                        className="w-full p-2 border rounded text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">散歩者</label>
                            <div className="space-y-2">
                                {walkers.map(w => (
                                    <label key={w.id} className="flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={formData.walkers.includes(w.name)}
                                            onChange={() => toggleWalker(w.name)}
                                            className="mr-2 w-5 h-5"
                                        />
                                        <span>{w.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">元気度: {getEnergyLabel(formData.energy)}</label>
                            <input
                                type="range" min="1" max="5"
                                value={formData.energy}
                                onChange={(e) => setFormData({ ...formData, energy: parseInt(e.target.value) })}
                                className="w-full"
                            />
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>絶不調</span>
                                <span>普通</span>
                                <span>絶好調</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">記録</label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => setFormData({ ...formData, pee: !formData.pee })}
                                    type="button"
                                    className={`py-3 rounded-lg border-2 ${formData.pee ? 'bg-yellow-100 border-yellow-500' : 'border-gray-300'}`}
                                >
                                    💧 おしっこ
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, poo: !formData.poo })}
                                    type="button"
                                    className={`py-3 rounded-lg border-2 ${formData.poo ? 'bg-amber-100 border-amber-500' : 'border-gray-300'}`}
                                >
                                    💩 うんち
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, water: !formData.water })}
                                    type="button"
                                    className={`py-3 rounded-lg border-2 ${formData.water ? 'bg-blue-100 border-blue-500' : 'border-gray-300'}`}
                                >
                                    💧 水
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">写真</label>
                            <div className="grid grid-cols-4 gap-2 mb-2">
                                {formData.photos.map((url, i) => (
                                    <div key={i} className="relative">
                                        <img src={url} className="w-full h-16 object-cover rounded" alt="walk" />
                                        <button
                                            onClick={() => removePhoto(i)}
                                            className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <input
                                type="file" accept="image/*" multiple onChange={handlePhotoUpload}
                                disabled={uploading} className="w-full text-sm"
                            />
                            {uploading && <p className="text-sm text-gray-500">アップロード中...</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">メモ</label>
                            <textarea
                                value={formData.memo} onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                                className="w-full p-2 border rounded-lg" rows={3}
                            />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleSubmit} className="flex-1 bg-blue-500 text-white py-2 rounded-lg">保存</button>
                            <button onClick={onCancel} className="flex-1 bg-gray-300 py-2 rounded-lg">キャンセル</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
