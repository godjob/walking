import { useState } from 'react';
import { useImageUpload } from '../../hooks/useImageUpload';
import { getFirmnessLabel, getFoodAmountLabel } from '../../lib/utils';

export default function HealthForm({ type, walkers, formData, onChange, onSave, onCancel }) {
    const { uploading, uploadPhotos } = useImageUpload('health');

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
        const newUrls = await uploadPhotos(files, formData.photos);
        if (newUrls) {
            onChange({ ...formData, photos: [...(formData.photos || []), ...newUrls] });
        }
        e.target.value = '';
    };

    const removePhoto = (index) => {
        onChange({ ...formData, photos: (formData.photos || []).filter((_, i) => i !== index) });
    };

    return (
        <div className="space-y-4 bg-white p-4 rounded-lg">
            <h3 className="font-bold text-lg">
                {(formData.id ? '✏️ 編集: ' : '') +
                    (type === 'hospital' ? '🏥 病院記録' : type === 'grooming' ? '✂️ 散髪記録' : type === 'bath' ? '🛁 入浴記録' : type === 'brushing' ? '✨ ブラッシング' : type === 'cleaning' ? '🧹 掃除' : type === 'weight' ? '⚖️ 体重' : type === 'food' ? '🥣 ご飯' : type === 'excretion' ? '💩 排泄記録' : '💊 薬記録')}
            </h3>
            <div>
                <label className="block text-sm font-medium mb-1">担当者</label>
                <select
                    value={formData.walker} onChange={(e) => onChange({ ...formData, walker: e.target.value })}
                    className="w-full p-2 border rounded"
                >
                    <option value="">担当者を選択</option>
                    {walkers.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">日付</label>
                <input
                    type="date" value={formData.date}
                    onChange={(e) => onChange({ ...formData, date: e.target.value })}
                    className="w-full p-2 border rounded"
                />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">時刻</label>
                <input
                    type="time" value={formData.time}
                    onChange={(e) => onChange({ ...formData, time: e.target.value })}
                    className="w-full p-2 border rounded"
                />
            </div>
            {type === 'hospital' && (
                <div>
                    <label className="block text-sm font-medium mb-1">病院名</label>
                    <input
                        type="text" value={formData.hospitalName}
                        onChange={(e) => onChange({ ...formData, hospitalName: e.target.value })}
                        className="w-full p-2 border rounded" placeholder="例: ○○動物病院"
                    />
                    <label className="block text-sm font-medium mb-1 mt-2">理由</label>
                    <input
                        type="text" value={formData.reason}
                        onChange={(e) => onChange({ ...formData, reason: e.target.value })}
                        className="w-full p-2 border rounded" placeholder="例: 定期検診"
                    />
                </div>
            )}
            {type === 'grooming' && (
                <div>
                    <label className="block text-sm font-medium mb-1">実施場所</label>
                    <div className="space-y-2">
                        <label className="flex items-center">
                            <input
                                type="radio" name="groomedBy" value="walker"
                                checked={formData.groomedBy === 'walker'}
                                onChange={(e) => onChange({ ...formData, groomedBy: e.target.value })}
                                className="mr-2"
                            /> 自宅
                        </label>
                        <label className="flex items-center">
                            <input
                                type="radio" name="groomedBy" value="shop"
                                checked={formData.groomedBy === 'shop'}
                                onChange={(e) => onChange({ ...formData, groomedBy: e.target.value })}
                                className="mr-2"
                            /> 店舗
                        </label>
                        {formData.groomedBy === 'shop' && (
                            <input
                                type="text" value={formData.shopName}
                                onChange={(e) => onChange({ ...formData, shopName: e.target.value })}
                                className="w-full p-2 border rounded ml-6" placeholder="店舗名を入力"
                            />
                        )}
                    </div>
                </div>
            )}
            {type === 'medicine' && (
                <div>
                    <label className="block text-sm font-medium mb-1">薬の種類</label>
                    <input
                        type="text" value={formData.medicineType}
                        onChange={(e) => onChange({ ...formData, medicineType: e.target.value })}
                        className="w-full p-2 border rounded" placeholder="例: フィラリア予防薬"
                    />
                    <label className="flex items-center mt-2">
                        <input
                            type="checkbox" checked={formData.isVaccine}
                            onChange={(e) => onChange({ ...formData, isVaccine: e.target.checked })}
                            className="mr-2"
                        /> 予防接種
                    </label>
                </div>
            )}
            {type === 'excretion' && (
                <div>
                    <label className="block text-sm font-medium mb-1">
                        うんちの硬さ: {getFirmnessLabel(formData.pooFirmness)}
                    </label>
                    <input
                        type="range" min={1} max={5} value={formData.pooFirmness}
                        onChange={(e) => onChange({ ...formData, pooFirmness: parseInt(e.target.value) })}
                        className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>やわらかい</span><span>普通</span><span>硬い</span>
                    </div>
                </div>
            )}
            {type === 'food' && (
                <div>
                    <label className="block text-sm font-medium mb-1">
                        残量: {getFoodAmountLabel(formData.foodAmount || 3)}
                    </label>
                    <input
                        type="range" min={1} max={5} value={formData.foodAmount || 3}
                        onChange={(e) => onChange({ ...formData, foodAmount: parseInt(e.target.value) })}
                        className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>空</span><span>普通</span><span>満杯</span>
                    </div>
                </div>
            )}
            {type === 'cleaning' && (
                <div>
                    <label className="block text-sm font-medium mb-1">実施した内容</label>
                    <div className="flex gap-4 mt-2 flex-wrap">
                        <label className="flex items-center">
                            <input
                                type="checkbox" checked={formData.isFloorCleaned}
                                onChange={(e) => onChange({ ...formData, isFloorCleaned: e.target.checked })}
                                className="mr-2 w-5 h-5"
                            /> 床を掃除
                        </label>
                        <label className="flex items-center">
                            <input
                                type="checkbox" checked={formData.isToiletCleaned}
                                onChange={(e) => onChange({ ...formData, isToiletCleaned: e.target.checked })}
                                className="mr-2 w-5 h-5"
                            /> トイレ掃除
                        </label>
                        <label className="flex items-center">
                            <input
                                type="checkbox" checked={formData.isWaterChanged}
                                onChange={(e) => onChange({ ...formData, isWaterChanged: e.target.checked })}
                                className="mr-2 w-5 h-5"
                            /> 飲み水交換
                        </label>
                    </div>
                </div>
            )}
            {type === 'weight' && (
                <div>
                    <label className="block text-sm font-medium mb-1">体重 (kg)</label>
                    <input
                        type="number" step="0.1" value={formData.weight || ''}
                        onChange={(e) => onChange({ ...formData, weight: e.target.value })}
                        className="w-full p-2 border rounded" placeholder="例: 12.5"
                    />
                </div>
            )}
            <div>
                <label className="block text-sm font-medium mb-2">写真 (最大4枚)</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                    {(formData.photos || []).map((url, i) => (
                        <div key={i} className="relative">
                            <img src={url} className="w-full h-16 object-cover rounded" alt="health" />
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
                <label className="block text-sm font-medium mb-1">メモ</label>
                <textarea
                    value={formData.memo} onChange={(e) => onChange({ ...formData, memo: e.target.value })}
                    className="w-full p-2 border rounded" rows={3} placeholder="詳細をメモ..."
                />
            </div>

            <div className="flex items-center mb-2">
                <input
                    type="checkbox"
                    id="notify-check"
                    checked={formData.notify}
                    onChange={(e) => onChange({ ...formData, notify: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 mr-2"
                />
                <label htmlFor="notify-check" className="text-sm font-bold text-gray-700">LINEで通知する</label>
            </div>

            <div className="flex gap-2 mb-8">
                <button onClick={handleSubmit} className="flex-1 bg-blue-500 text-white py-2 rounded font-bold">保存</button>
                <button onClick={onCancel} className="flex-1 bg-gray-300 py-2 rounded">キャンセル</button>
            </div>
        </div>
    );
}
