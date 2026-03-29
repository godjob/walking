// @ts-nocheck
// MapView, PhotoViewer コンポーネント

import { useModalScrollLock } from './utils.js';

function PhotoViewer({ src, onClose }) {
    const { useState } = React;
    const [scale, setScale] = useState(1);
    useModalScrollLock(true);

    return React.createElement('div', {
        className: 'fixed inset-0 bg-black z-[60] flex items-center justify-center overflow-hidden overscroll-contain',
        onClick: onClose
    },
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
        React.createElement('img', {
            src: src,
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

export { PhotoViewer, MapView };
