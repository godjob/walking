import { useState, useEffect } from 'react';

export default function PhotoViewer({ src, onClose }) {
    const [scale, setScale] = useState(1);
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'auto'; };
    }, []);
    return (
        <div
            className="fixed inset-0 bg-black z-[60] flex items-center justify-center overflow-hidden"
            onClick={onClose}
        >
            <div className="absolute top-4 right-4 z-10 flex gap-4">
                <button
                    className="bg-gray-800 text-white p-3 rounded-full opacity-80 hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); setScale(s => Math.min(s + 0.5, 3)); }}
                >
                    ➕
                </button>
                <button
                    className="bg-gray-800 text-white p-3 rounded-full opacity-80 hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); setScale(s => Math.max(s - 0.5, 1)); }}
                >
                    ➖
                </button>
                <button
                    className="bg-white text-black p-3 rounded-full opacity-80 hover:opacity-100 font-bold"
                    onClick={onClose}
                >
                    ✕
                </button>
            </div>
            <img
                src={src}
                className="transition-transform duration-200 ease-out max-w-full max-h-full object-contain"
                style={{ transform: `scale(${scale})` }}
                onClick={(e) => e.stopPropagation()}
                alt="Full size"
            />
        </div>
    );
}
