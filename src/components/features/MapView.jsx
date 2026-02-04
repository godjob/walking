import { useEffect, useRef } from 'react';
import { Map, useMap } from '@vis.gl/react-google-maps';

function MapContent({ positions }) {
    const map = useMap();
    const polylineRef = useRef(null);

    useEffect(() => {
        if (!map || !positions || positions.length === 0) return;

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

        const bounds = new google.maps.LatLngBounds();
        pathCoordinates.forEach(coord => bounds.extend(coord));
        map.fitBounds(bounds);

        return () => {
            if (polylineRef.current) {
                polylineRef.current.setMap(null);
            }
        };
    }, [map, positions]);

    return null;
}

export default function MapView({ positions, onClose }) {
    const center = positions && positions.length > 0 ? { lat: positions[0].lat, lng: positions[0].lng } : { lat: 35.6812, lng: 139.7671 };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-2xl flex flex-col h-auto max-h-[90vh]">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-lg">🗺️ 散歩コース (Google Maps)</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                </div>
                <div className="w-full h-96 rounded-b-lg relative">
                     <Map
                        defaultCenter={center}
                        defaultZoom={15}
                        mapId="DEMO_MAP_ID"
                        disableDefaultUI={false}
                        zoomControl={true}
                        streetViewControl={false}
                        fullscreenControl={false}
                        mapTypeControl={false}
                        scaleControl={true}
                        style={{ width: '100%', height: '100%' }}
                     >
                        <MapContent positions={positions} />
                     </Map>
                </div>
            </div>
        </div>
    );
}
