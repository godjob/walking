// @ts-nocheck
// MapView, PhotoViewer コンポーネント

import { useModalScrollLock } from './utils.js';

// 端では止まる（4枚程度なら「全部見た」が分かるほうが自然なため先頭へ戻さない）
const stepPhotoIndex = (index, delta, count) => Math.min(Math.max(index + delta, 0), count - 1);

// フリックの判定。横に50px以上かつ縦より大きい移動だけを送りとみなす。
// 拡大中は「写真の中を見たい」操作と区別できないため送らない（ボタンでは送れる）
const SWIPE_THRESHOLD = 50;
const swipeDelta = (dx, dy, scale) => {
    if (scale > 1) return 0;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return 0;
    return dx < 0 ? 1 : -1;
};

function PhotoViewer({ photos, initialIndex, onClose }) {
    const { useState, useEffect, useRef } = React;
    const [index, setIndex] = useState(initialIndex || 0);
    const [scale, setScale] = useState(1);
    const touchStartRef = useRef(null);
    const swipedRef = useRef(false);
    useModalScrollLock(true);

    const count = photos.length;
    const go = (delta) => {
        setIndex(i => {
            const next = stepPhotoIndex(i, delta, count);
            if (next !== i) setScale(1);
            return next;
        });
    };

    // 前後の写真を先読みし、切り替え時に白い画面を出さない
    useEffect(() => {
        [index - 1, index + 1].forEach(i => {
            if (i >= 0 && i < count) { const img = new Image(); img.src = photos[i]; }
        });
    }, [index, count]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'ArrowLeft') go(-1);
            else if (e.key === 'ArrowRight') go(1);
            else if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [count, onClose]);

    const onTouchStart = (e) => {
        if (e.touches.length !== 1) { touchStartRef.current = null; return; }
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchEnd = (e) => {
        const start = touchStartRef.current;
        touchStartRef.current = null;
        if (!start || count < 2) return;
        const t = e.changedTouches[0];
        const delta = swipeDelta(t.clientX - start.x, t.clientY - start.y, scale);
        if (delta === 0) return;
        // フリック直後に発火するクリックで背景タップ扱い（閉じる）にならないようにする
        swipedRef.current = true;
        setTimeout(() => { swipedRef.current = false; }, 400);
        go(delta);
    };
    const handleBackdropClick = () => { if (!swipedRef.current) onClose(); };

    const navBtn = (delta, label, symbol, side) => React.createElement('button', {
        type: 'button',
        'aria-label': label,
        disabled: delta < 0 ? index === 0 : index === count - 1,
        className: `absolute ${side} top-1/2 -translate-y-1/2 z-10 bg-gray-800 text-white w-12 h-12 rounded-full text-3xl leading-none opacity-70 hover:opacity-100 disabled:opacity-20`,
        onClick: (e) => { e.stopPropagation(); go(delta); }
    }, symbol);

    return React.createElement('div', {
        className: 'fixed inset-0 bg-black z-[60] flex items-center justify-center overflow-hidden overscroll-contain',
        onClick: handleBackdropClick,
        onTouchStart,
        onTouchEnd
    },
        count > 1 && React.createElement('div', {
            className: 'absolute top-5 left-4 z-10 bg-gray-800 text-white text-sm font-bold px-3 py-1 rounded-full opacity-80'
        }, `${index + 1} / ${count}`),
        React.createElement('div', { className: 'absolute top-4 right-4 z-10 flex gap-4' },
            React.createElement('button', {
                className: 'bg-gray-800 text-white p-3 rounded-full opacity-80 hover:opacity-100',
                onClick: (e) => { e.stopPropagation(); setScale(s => Math.min(s + 0.5, 3)); }
            }, '➕'),
            React.createElement('button', {
                className: 'bg-gray-800 text-white p-3 rounded-full opacity-80 hover:opacity-100',
                onClick: (e) => { e.stopPropagation(); setScale(s => Math.max(s - 0.5, 1)); }
            }, '➖'),
            React.createElement('button', {
                className: 'bg-white text-black p-3 rounded-full opacity-80 hover:opacity-100 font-bold',
                onClick: onClose
            }, '✕')
        ),
        count > 1 && navBtn(-1, '前の写真', '‹', 'left-2'),
        count > 1 && navBtn(1, '次の写真', '›', 'right-2'),
        React.createElement('img', {
            key: index,
            src: photos[index],
            className: 'transition-transform duration-200 ease-out max-w-full max-h-full object-contain',
            style: { transform: `scale(${scale})` },
            onClick: (e) => e.stopPropagation()
        })
    );
}

function MapView({ positions, onClose }) {
    const { useRef, useEffect } = React;
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const polylineRef = useRef(null);
    useModalScrollLock(true);

    useEffect(() => {
        if (!positions || positions.length === 0 || !mapRef.current) return;

        if (!mapInstanceRef.current) {
            mapInstanceRef.current = new google.maps.Map(mapRef.current, {
                center: { lat: positions[0].lat, lng: positions[0].lng },
                zoom: 15,
                mapTypeId: google.maps.MapTypeId.ROADMAP,
                disableDefaultUI: false,
                zoomControl: true,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
                scaleControl: true,
            });
        }

        const map = mapInstanceRef.current;
        const pathCoordinates = positions.map(p => ({ lat: p.lat, lng: p.lng }));

        if (polylineRef.current) {
            polylineRef.current.setMap(null);
        }

        polylineRef.current = new google.maps.Polyline({
            path: pathCoordinates,
            geodesic: true,
            strokeColor: "#2563EB",
            strokeOpacity: 1.0,
            strokeWeight: 5,
        });

        polylineRef.current.setMap(map);

        if (pathCoordinates.length > 0) {
            const bounds = new google.maps.LatLngBounds();
            pathCoordinates.forEach(coord => bounds.extend(coord));
            map.fitBounds(bounds);
        }

        return () => {
            if (polylineRef.current) {
                polylineRef.current.setMap(null);
            }
        };
    }, [positions]);

    return React.createElement('div', {
        className: 'modal-overlay p-4'
    },
        React.createElement('div', { className: 'bg-white rounded-lg w-full max-w-2xl modal-content' },
            React.createElement('div', { className: 'p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10' },
                React.createElement('h3', { className: 'font-bold text-lg' }, '🗺️ 散歩コース (Google Maps)'),
                React.createElement('button', {
                    onClick: onClose,
                    className: 'text-gray-500 hover:text-gray-700 text-2xl'
                }, '×')
            ),
            React.createElement('div', { ref: mapRef, className: 'w-full h-96 rounded-b-lg' })
        )
    );
}

export { PhotoViewer, MapView, stepPhotoIndex, swipeDelta };
