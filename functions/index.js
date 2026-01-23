/**
 * 福といっしょ LINE通知機能 Backend (v7対応版)
 */
require('dotenv').config();
// 【重要】v1構文を明示的に使用してエラーを回避
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const line = require('@line/bot-sdk');

admin.initializeApp();
const db = admin.firestore();

// 環境変数(.env)からLINEの設定を読み込み
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

// 家族全員にメッセージを送る関数
async function broadcastToFamily(messages) {
    try {
        const snapshot = await db.collection('line_users').get();
        if (snapshot.empty) {
            console.log('LINE通知先が登録されていません。');
            return;
        }
        const userIds = snapshot.docs.map(doc => doc.id);
        await client.multicast(userIds, messages);
        console.log(`${userIds.length}人にLINE通知を送信しました。`);
    } catch (error) {
        console.error('LINE送信エラー:', error);
    }
}

// 1. ユーザー登録 (Webhook)
exports.lineWebhook = functions.region('asia-northeast1').https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const events = req.body.events || [];
    try {
        await Promise.all(events.map(async (event) => {
            if (event.type === 'follow' || event.type === 'message') {
                const userId = event.source.userId;
                try {
                    const profile = await client.getProfile(userId);
                    await db.collection('line_users').doc(userId).set({
                        displayName: profile.displayName,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                    console.log(`LINEユーザー登録: ${profile.displayName}`);
                } catch (e) {
                    console.error('プロフィール取得失敗:', e);
                }
            }
        }));
        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhookエラー:', error);
        res.status(500).send('Error');
    }
});

// 2. 散歩開始通知 (アプリから呼び出し)
exports.notifyWalkStart = functions.region('asia-northeast1').https.onCall(async (data, context) => {
    const walkers = data.walkers || [];
    const walkersText = walkers.length > 0 ? walkers.join('と') : '誰か';
    const message = {
        type: 'text',
        text: `🐕 散歩スタート！\n\n${walkersText}が福くんの散歩に出発しました💨\nいってらっしゃい！`
    };
    await broadcastToFamily([message]);
    return { success: true };
});

// 3. 散歩終了通知 (データ保存時に自動実行)
exports.onWalkCreated = functions.region('asia-northeast1').firestore
    .document('walks/{walkId}')
    .onCreate(async (snapshot, context) => {
        const walk = snapshot.data();
        const messages = [];

        // 日時・天気などの情報作成
        const dateObj = walk.startTime.toDate();
        // ★ここを変更：日本時間 (Asia/Tokyo) に変換する
        const dateStr = dateObj.toLocaleString('ja-JP', {
            timeZone: 'Asia/Tokyo',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });

        const walkersStr = Array.isArray(walk.walkers) ? walk.walkers.join(', ') : walk.walkers;

        let weatherStr = '';
        if (walk.weather) {
            const iconMap = { '01': '☀️', '02': '⛅', '03': '☁️', '09': '🌧️', '10': '☔', '13': '⛄' };
            const iconCode = walk.weather.icon ? walk.weather.icon.substring(0, 2) : '';
            const emoji = iconMap[iconCode] || '🌤️';
            weatherStr = `\n天気: ${emoji} ${walk.weather.temp}℃ (風速${walk.weather.wind}m)`;
        }

        const pooStr = walk.poo ? 'あり💩' : 'なし';
        const peeStr = walk.pee ? 'あり💧' : 'なし';
        const memoStr = walk.memo ? `\n\n📝 メモ:\n${walk.memo}` : '';

        const textContent = `🏁 散歩終了 (${dateStr})\n` +
            `👤 担当: ${walkersStr}\n` +
            `⏱️ 時間: ${walk.duration}分\n` +
            `📍 距離: ${(walk.distance / 1000).toFixed(2)}km` +
            weatherStr +
            `\n\n🚽 トイレ:\nうんち: ${pooStr} / おしっこ: ${peeStr}` +
            memoStr;

        messages.push({ type: 'text', text: textContent });

        // 写真があれば追加
        if (walk.photos && walk.photos.length > 0) {
            const photoMessages = walk.photos.slice(0, 4).map(url => ({
                type: 'image',
                originalContentUrl: url,
                previewImageUrl: url
            }));
            messages.push(...photoMessages);
        }

        await broadcastToFamily(messages);
    });