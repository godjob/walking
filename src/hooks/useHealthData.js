import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from '../lib/firebase';

export function useHealthData() {
    const [walks, setWalks] = useState([]);
    const [healthRecords, setHealthRecords] = useState([]);
    const [walkers, setWalkers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "walkers"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const walkerList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            setWalkers(walkerList.sort((a, b) => a.order - b.order));
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const q = query(collection(db, "walks"), orderBy("startTime", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const walkList = snapshot.docs.map(doc => ({
                ...doc.data(), id: doc.id,
                startTime: doc.data().startTime?.toDate(),
                endTime: doc.data().endTime?.toDate()
            }));
            setWalks(walkList);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const q = query(collection(db, "health"), orderBy("date", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const records = snapshot.docs.map(doc => ({
                ...doc.data(), id: doc.id,
                date: doc.data().date?.toDate()
            }));
            setHealthRecords(records);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return { walks, healthRecords, walkers, loading };
}
