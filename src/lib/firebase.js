import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
    apiKey: "AIzaSyAqGO0-RnJAfQqsIunx35ZuAGc85cFD-lA",
    authDomain: "walking-36c5a.firebaseapp.com",
    projectId: "walking-36c5a",
    storageBucket: "walking-36c5a.firebasestorage.app",
    messagingSenderId: "457304106244",
    appId: "1:457304106244:web:3bcb8df4d4a3b27a971c51"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'asia-northeast1');

export default app;
