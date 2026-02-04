import { useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from '../lib/firebase';
import { compressImage } from '../lib/utils';

export function useImageUpload(pathPrefix, maxPhotos = 4) {
    const [uploading, setUploading] = useState(false);

    const uploadPhotos = async (files, currentPhotos = []) => {
        if (files.length === 0) return [];
        if (currentPhotos.length + files.length > maxPhotos) {
            alert(`写真は最大${maxPhotos}枚までです`);
            return null;
        }
        setUploading(true);
        try {
            const uploadPromises = files.map(async (file) => {
                const compressedBlob = await compressImage(file);
                const randomId = Math.random().toString(36).substring(7);
                const fileName = file.name.split('.')[0] + '.jpg';
                const storageRef = ref(storage, `${pathPrefix}/${Date.now()}_${randomId}_${fileName}`);
                await uploadBytes(storageRef, compressedBlob);
                return await getDownloadURL(storageRef);
            });
            const newUrls = await Promise.all(uploadPromises);
            return newUrls;
        } catch (err) {
            alert('アップロードに失敗しました: ' + err);
            return null;
        } finally {
            setUploading(false);
        }
    };

    return { uploading, uploadPhotos };
}
