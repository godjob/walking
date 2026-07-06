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
// オフライン永続化（IndexedDB）: 2回目以降の起動でwalks/health等をローカルから即時表示し差分のみ同期する
// 複数タブ同時起動時等は失敗し得るが、失敗しても従来動作（毎回フル取得）のままなので握りつぶす
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    console.warn('Firestore persistence unavailable:', err && err.code);
});
const storage = firebase.storage();
const functions = firebase.app().functions('asia-northeast1');

export { db, storage, functions };
