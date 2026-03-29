// @ts-nocheck
// Firebase初期化・db/storage/functions変数のexport

const firebaseConfig = {
    apiKey: "AIzaSyAqGO0-RnJAfQqsIunx35ZuAGc85cFD-lA",
    authDomain: "walking-36c5a.firebaseapp.com",
    projectId: "walking-36c5a",
    storageBucket: "walking-36c5a.firebasestorage.app",
    messagingSenderId: "457304106244",
    appId: "1:457304106244:web:3bcb8df4d4a3b27a971c51"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();
const functions = firebase.app().functions('asia-northeast1');

export { db, storage, functions };
