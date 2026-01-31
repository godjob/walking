/**
 * 福といっしょ LINE通知機能 Backend (v2.9.2 - Stabilized v1)
 */
require('dotenv').config();
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const line = require('@line/bot-sdk');

admin.initializeApp();
const db = admin.firestore();

// 【修正後のコード（○ これで動きます）】
// 古い config 読み込み行は削除します
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};

if (!config.channelAccessToken || !config.channelSecret) {
    console.error('LINE Channel Access TokenまたはSecretが設定されていません。functions:config:set line.access_token="..." line.channel_secret="..." を実行するか、.envファイルを確認してください。');
}

const client = new line.Client(config);

// 日時フォーマット関数 (YY/MM/DD HH:mm) - JST
function formatDateTime(timestamp) {
    if (!timestamp) return '';
    const dateObj = timestamp.toDate();
    const d = new Date(dateObj.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));

    const yy = d.getFullYear().toString().slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');

    return `${yy}/${mm}/${dd} ${hh}:${min}`;
}

async function broadcastToFamily(messages) {
    try {
        const snapshot = await db.collection('line_users').get();
        if (snapshot.empty) {
            console.log('LINE通知先が登録されていません。');
            throw new Error('LINE通知先が登録されていません。');
        }
        const userIds = snapshot.docs.map(doc => doc.id);
        await client.multicast(userIds, messages);
        console.log(`${userIds.length}人にLINE通知を送信しました。`);
    } catch (error) {
        console.error('LINE送信エラー:', error);
        throw error;
    }
}

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

exports.notifyWalkStart = functions.region('asia-northeast1').https.onCall(async (data, context) => {
    const walkers = data.walkers || [];
    const walkersText = walkers.length > 0 ? walkers.join('と') : '誰か';

    const now = admin.firestore.Timestamp.now();
    const dateStr = formatDateTime(now);

    const message = {
        type: 'text',
        text: `🐕 散歩スタート！\n${dateStr}\n\n${walkersText}が福くんの散歩に出発しました💨\nいってらっしゃい！`
    };

    try {
        await broadcastToFamily([message]);
        return { success: true };
    } catch (error) {
        console.error('notifyWalkStartエラー:', error);
        throw new functions.https.HttpsError('internal', 'LINE通知の送信に失敗しました。', error.message);
    }
});

exports.onWalkCreated = functions.region('asia-northeast1').firestore
    .document('walks/{walkId}')
    .onCreate(async (snapshot, context) => {
        const walk = snapshot.data();

        // ★通知がオフに設定されている場合はここで終了
        if (walk.notify === false) {
            console.log('通知設定がOFFのため、散歩終了通知をスキップしました。');
            return null;
        }

        const messages = [];

        const dateStr = formatDateTime(walk.startTime);
        const walkersStr = Array.isArray(walk.walkers) ? walk.walkers.join(', ') : walk.walkers;

        let weatherStr = '';
        if (walk.weather) {
            const iconMap = { '01': '☀️', '02': '⛅', '03': '☁️', '09': '🌧️', '10': '☔', '13': '⛄' };
            const iconCode = walk.weather.icon ? walk.weather.icon.substring(0, 2) : '';
            const emoji = iconMap[iconCode] || '🌤️';
            weatherStr = `\n天気: ${emoji} ${walk.weather.temp}℃ (風速${walk.weather.wind}m)`;
        }

        const firmnessLabels = { 1: 'とてもやわらかい', 2: 'やわらかい', 3: '普通', 4: '硬め', 5: '硬い' };
        const firmnessStr = (walk.poo && walk.pooFirmness) ? ` (${firmnessLabels[walk.pooFirmness] || '普通'})` : '';

        const pooStr = walk.poo ? `あり💩${firmnessStr}` : 'なし';
        const peeStr = walk.pee ? 'あり💧' : 'なし';
        const energyLabels = { 1: '絶不調 😫', 2: '不調 😓', 3: '普通 😐', 4: '元気 🙂', 5: '絶好調 😆' };
        const energyStr = walk.energy ? `\n元気: ${energyLabels[walk.energy] || '普通'}` : '';
        const memoStr = walk.memo ? `\n\n📝 メモ:\n${walk.memo}` : '';

        const textContent = `🏁 散歩終了\n${dateStr}\n\n` +
            `👤 担当: ${walkersStr}\n` +
            `⏱️ 時間: ${walk.duration}分\n` +
            `📍 距離: ${(walk.distance / 1000).toFixed(2)}km` +
            weatherStr +
            energyStr +
            `\n\n🚽 トイレ:\nうんち: ${pooStr} / おしっこ: ${peeStr}` +
            memoStr;

        messages.push({ type: 'text', text: textContent });

        if (walk.photos && walk.photos.length > 0) {
            const photoMessages = walk.photos.slice(0, 4).map(url => ({
                type: 'image', originalContentUrl: url, previewImageUrl: url
            }));
            messages.push(...photoMessages);
        }

        await broadcastToFamily(messages);
    });

exports.onHealthWrite = functions.region('asia-northeast1').firestore
    .document('health/{healthId}')
    .onWrite(async (change, context) => {
        const newData = change.after.exists ? change.after.data() : null;

        if (!newData || newData.notify === false) return;

        const isUpdate = change.before.exists;
        const actionTitle = isUpdate ? '(修正)' : '';

        const dateStr = formatDateTime(newData.date);

        let title = '';
        let detail = '';

        const walker = newData.walker || '誰か';
        const memo = newData.memo ? `\n📝 ${newData.memo}` : '';

        switch (newData.type) {
            case 'excretion':
                title = '💩 排泄';
                const firmnessLabels = { 1: 'とてもやわらかい', 2: 'やわらかい', 3: '普通', 4: '硬め', 5: '硬い' };
                const firmness = firmnessLabels[newData.pooFirmness] || '普通';
                detail = `${walker}がトイレの世話をしました。\nうんちの硬さ: ${firmness}`;
                break;

            case 'food':
                title = '🥣 ご飯';
                const amountLabels = { 1: '空っぽ', 2: '少し', 3: '普通', 4: '多め', 5: '満杯' };
                const amount = amountLabels[newData.foodAmount] || '普通';
                detail = `${walker}がご飯をあげました。\n残量: ${amount}`;
                break;

            case 'medicine':
                title = '💊 薬';
                const medType = newData.medicineType || '薬';
                const vaccine = newData.isVaccine ? '(予防接種)' : '';
                detail = `${walker}が${medType}${vaccine}をあげました。`;
                break;

            case 'bath':
                title = '🛁 入浴';
                detail = `${walker}が福をお風呂に入れました✨`;
                break;

            case 'brushing':
                title = '✨ ブラッシング';
                detail = `${walker}がブラッシングをしてふわふわになりました✨`;
                break;

            case 'cleaning':
                title = '🧹 掃除';
                const cleanedItems = [];
                if (newData.isFloorCleaned) cleanedItems.push('床✨');
                if (newData.isToiletCleaned) cleanedItems.push('トイレ✨');
                if (newData.isWaterChanged) cleanedItems.push('水交換✨');
                const cleanedText = cleanedItems.length > 0 ? `\n詳細: ${cleanedItems.join(', ')}` : '';
                detail = `${walker}が掃除をしました。${cleanedText}`;
                break;

            case 'grooming':
                title = '✂️ 散髪';
                const place = newData.groomedBy === 'shop' ? `お店(${newData.shopName})` : '自宅';
                detail = `${walker}が${place}で散髪しました💈`;
                break;

            case 'hospital':
                title = '🏥 病院';
                const hospitalName = newData.hospitalName || '病院';
                detail = `${walker}が${hospitalName}に連れて行きました。\n理由: ${newData.reason || 'なし'}`;
                break;

            case 'weight':
                title = '⚖️ 体重測定';
                detail = `${walker}が福ちゃんの体重を測りました。\n結果: ${newData.weight}kg`;
                break;

            default:
                title = '✨ お世話';
                detail = `${walker}がお世話をしました。`;
        }

        const textContent = `${title} ${actionTitle}\n${dateStr}\n\n${detail}${memo}`;

        const messages = [{ type: 'text', text: textContent }];

        if (newData.photos && newData.photos.length > 0) {
            const photoMessages = newData.photos.slice(0, 4).map(url => ({
                type: 'image', originalContentUrl: url, previewImageUrl: url
            }));
            messages.push(...photoMessages);
        }

        await broadcastToFamily(messages);
    });
