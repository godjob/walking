import { useState, useRef, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, functions, storage } from '../lib/firebase';
import { fetchWeatherData, calculateDistance, calculateTotalDistance, compressImage } from '../lib/utils';

export function useWalk() {
    const [isWalking, setIsWalking] = useState(false);
    const [currentWalk, setCurrentWalk] = useState(null);
    const [photos, setPhotos] = useState([]);
    const [uploadingPhotos, setUploadingPhotos] = useState(false);

    const stationaryTimeRef = useRef(0);
    const lastPositionRef = useRef(null);

    const startWalk = (selectedWalkers, notifyStart) => {
        if (selectedWalkers.length === 0) { alert('散歩者を選択してください'); return; }
        if (!navigator.geolocation) { alert('お使いのブラウザは位置情報に対応していません'); return; }

        const walk = {
            walkers: selectedWalkers,
            startTime: new Date(),
            positions: [],
            pee: false,
            poo: false,
            pooFirmness: 3,
            energy: 3,
            water: false,
            memo: '',
            photos: [],
            weather: null
        };

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                walk.positions.push({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    time: new Date(),
                    accuracy: position.coords.accuracy
                });
                lastPositionRef.current = { lat: position.coords.latitude, lng: position.coords.longitude, time: Date.now() };
                stationaryTimeRef.current = 0;

                setCurrentWalk(walk);
                setIsWalking(true);
                setPhotos([]);

                // Notify
                if (notifyStart) {
                    const notifyWalkStart = httpsCallable(functions, 'notifyWalkStart');
                    notifyWalkStart({ walkers: selectedWalkers })
                        .then(() => console.log('LINE通知送信成功'))
                        .catch(err => {
                            console.error('LINE通知送信失敗', err);
                            alert('LINE通知送信失敗: ' + err.message);
                        });
                } else {
                    console.log('LINE通知はスキップされました');
                }

                // Weather
                const weatherData = await fetchWeatherData(position.coords.latitude, position.coords.longitude);
                if (weatherData) {
                    setCurrentWalk(prev => { if (!prev) return null; return { ...prev, weather: weatherData }; });
                }
            },
            (error) => { alert('位置情報の取得に失敗しました。位置情報を許可してください。'); },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const endWalk = async (notifyEnd) => {
        if (!currentWalk) return;
        const endTime = new Date();
        const duration = Math.floor((endTime - currentWalk.startTime) / 60000);
        const distance = calculateTotalDistance(currentWalk.positions);

        await addDoc(collection(db, 'walks'), {
            walkers: currentWalk.walkers,
            startTime: Timestamp.fromDate(currentWalk.startTime),
            endTime: Timestamp.fromDate(endTime),
            duration,
            distance,
            pee: currentWalk.pee,
            poo: currentWalk.poo,
            pooFirmness: currentWalk.poo ? currentWalk.pooFirmness : null,
            energy: currentWalk.energy,
            water: currentWalk.water,
            memo: currentWalk.memo,
            photos: photos,
            positions: currentWalk.positions,
            weather: currentWalk.weather || null,
            notify: notifyEnd
        });

        setIsWalking(false);
        // Defer state clearing to allow UI to update if needed, but here we just clear.
        setTimeout(() => {
            setCurrentWalk(null);
            setPhotos([]);
            stationaryTimeRef.current = 0;
            lastPositionRef.current = null;
        }, 0);
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
                const storageRef = ref(storage, `walks/${Date.now()}_${randomId}_${fileName}`);
                await uploadBytes(storageRef, compressedBlob);
                return await getDownloadURL(storageRef);
            });
            const uploadedUrls = await Promise.all(uploadPromises);
            setPhotos(prev => [...prev, ...uploadedUrls]);
        } catch (error) { console.error(error); alert('アップロード中にエラーが発生しました: ' + error.message); }
        finally { setUploadingPhotos(false); e.target.value = ''; }
    };

    const removePhoto = (index) => { setPhotos(photos.filter((_, i) => i !== index)); };

    useEffect(() => {
        if (!isWalking || !currentWalk) return;
        const interval = setInterval(() => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    if (position.coords.accuracy <= 50) {
                        const newPos = { lat: position.coords.latitude, lng: position.coords.longitude, time: new Date(), accuracy: position.coords.accuracy };

                        if (lastPositionRef.current) {
                            const dist = calculateDistance(lastPositionRef.current.lat, lastPositionRef.current.lng, newPos.lat, newPos.lng);
                            if (dist <= 10) {
                                stationaryTimeRef.current += 5;
                                if (stationaryTimeRef.current >= 300) {
                                    endWalk(false);
                                    alert('5分間移動がなかったため、散歩を終了しました。');
                                    stationaryTimeRef.current = 0;
                                }
                            } else {
                                stationaryTimeRef.current = 0;
                            }
                            lastPositionRef.current = { lat: newPos.lat, lng: newPos.lng, time: Date.now() };
                        }

                        setCurrentWalk(prev => {
                             if (!prev) return null;
                             return { ...prev, positions: [...prev.positions, newPos] };
                        });
                    }
                },
                (error) => { console.log('GPS取得エラー:', error); },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        }, 5000);
        return () => clearInterval(interval);
    }, [isWalking, currentWalk, photos]); // Photos dependency was in original, likely to keep closure fresh.

    return {
        isWalking, currentWalk, setCurrentWalk, photos, setPhotos,
        uploadingPhotos, setUploadingPhotos, startWalk, endWalk,
        handlePhotoUpload, removePhoto
    };
}
