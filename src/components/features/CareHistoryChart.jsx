import { useRef, useEffect } from 'react';

export default function CareHistoryChart({ walks, healthRecords }) {
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
            'hospital': '🏥'
        };
        return map[type] || '✨';
    };

    useEffect(() => {
        if (todayRef.current) {
            todayRef.current.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
        }
    }, []);

    return (
        <div className="w-full mb-2 bg-white/50 rounded-lg p-2">
            <div
                ref={scrollRef}
                className="flex gap-2 overflow-x-auto no-scrollbar pb-2 items-end h-32"
            >
                {dates.map((date, index) => {
                    const isToday = date.getTime() === today.getTime();

                    const dayEvents = allEvents.filter(e => {
                        const eDate = new Date(e.date);
                        return eDate.getFullYear() === date.getFullYear() &&
                            eDate.getMonth() === date.getMonth() &&
                            eDate.getDate() === date.getDate();
                    }).sort((a, b) => a.date - b.date);

                    const dayLabel = date.getDate();
                    const weekLabel = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];

                    return (
                        <div
                            key={index}
                            ref={isToday ? todayRef : null}
                            className="flex flex-col-reverse items-center min-w-[32px] flex-shrink-0"
                        >
                            <div
                                className={`text-xs mt-1 text-center border-t border-gray-400 w-full pt-1 ${isToday ? 'font-bold text-blue-700' : 'text-gray-600'}`}
                            >
                                <span className="block text-sm leading-none">{dayLabel}</span>
                                <span className="text-[10px]">{weekLabel}</span>
                            </div>
                            {dayEvents.map((ev, i) => (
                                <div key={i} className="text-sm leading-none mb-0.5">{getIcon(ev.type)}</div>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
