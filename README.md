# 🐕 福といっしょ (Walking App)

愛犬「福」くんの健康管理と散歩記録を、家族みんなで共有するアプリです。

## 📂 ディレクトリ構成

```
fuku-walk/
├── index.html              フロントエンド骨格（CDN読み込み・エントリーポイント）
├── src/
│   ├── firebase-init.js    Firebase設定・初期化
│   ├── constants.js        定数・設定値
│   ├── utils.js            共通ユーティリティ（日付・天気・距離計算など）
│   ├── map.js              地図・写真表示コンポーネント
│   ├── walk.js             散歩記録フォームコンポーネント
│   ├── health.js           お世話記録コンポーネント
│   ├── settings.js         設定画面コンポーネント
│   └── app.js              メインAppコンポーネント・エントリーポイント
├── functions/
│   └── index.js            Cloud Functions（LINE通知・バックアップ）
├── firebase.json           Firebase統合設定
├── firestore.rules         Firestoreセキュリティルール
├── storage.rules           Storageセキュリティルール
└── firestore.indexes.json  Firestoreインデックス設定
```

## ✨ 機能一覧

### フロントエンド

* **散歩記録**: GPS によるリアルタイム位置情報追跡、距離・時間の計測。
* **お世話記録**: 排泄、食事、投薬、体重などの健康情報を記録・編集。
* **写真管理**: 散歩やお世話の記録に写真を添付（自動圧縮・アップロード）。
* **データ可視化**: 週間・月間の統計情報や、過去2週間の履歴チャート表示。
* **地図表示**: Google Maps API を使用した散歩ルートの軌跡表示。
* **バッジ機能**: 散歩回数や距離に応じたバッジ獲得システム。
* **散歩設定**: 停止判定・自動終了・GPS更新間隔などのカスタマイズ。
* **データエクスポート**: 設定画面から全データをJSONファイルとしてダウンロード。

### バックエンド (`functions/`)

* **LINE通知**: 散歩開始・終了・お世話記録を家族グループに自動通知。
* **ユーザー管理**: LINE Webhook によるユーザー登録処理。
* **自動バックアップ**: 毎週日曜 00:00 JST に Firestore・Storage を GCS へ自動保存。
* **手動バックアップ**: HTTP POSTで即時バックアップを実行。

## 🔒 バックアップ

愛犬の記録を守るため、2層のバックアップ体制を整えています。

| 種別 | 方法 | タイミング |
|------|------|---------|
| 自動バックアップ | Cloud Scheduler → GCS (`walking-36c5a-backup`) | 毎週日曜 00:00 JST |
| 手動バックアップ | HTTP POST でいつでも実行 | 任意 |
| データエクスポート | アプリ設定画面からJSONダウンロード | 任意 |

**手動バックアップの実行:**
```bash
curl -X POST https://asia-northeast1-walking-36c5a.cloudfunctions.net/runBackupNow
```

**バックアップ内容:**
```
gs://walking-36c5a-backup/
├── firestore/YYYY-MM-DD/
│   ├── walks.json
│   ├── health.json
│   ├── walkers.json
│   └── settings.json
└── storage/YYYY-MM-DD/
    ├── walks/    散歩写真
    └── health/   お世話写真
```

## 🛡️ セキュリティ

* **Firestore ルール**: 書き込み時の必須フィールド検証、`line_users` へのパブリックアクセス遮断。
* **Storage ルール**: 画像ファイルのみ許可・最大 5MB 制限。
* **Hosting**: `package.json` やバックエンドコードが公開されないよう除外設定済み。

## 🗄️ データモデル (Firestore)

| コレクション | 内容 | アクセス |
|------------|------|---------|
| `walks` | 散歩記録（経路・距離・天気・写真など） | フロントエンド読み書き |
| `health` | お世話記録（種類・日時・担当者など） | フロントエンド読み書き |
| `walkers` | 家族メンバーリスト | フロントエンド読み書き |
| `settings` | アプリ設定（家族共有） | フロントエンド読み書き |
| `line_users` | LINE通知先ユーザー | バックエンドのみ |

## 🛠 使用技術

### フロントエンド
* React 17（CDN）・ES Modules・ビルドツールなし
* Tailwind CSS（CDN）
* Google Maps JavaScript API

### バックエンド
* Firebase Cloud Functions v1（Node.js 20）
* LINE Messaging API
* OpenWeatherMap API

### インフラ
* Firebase Hosting / Firestore / Storage
* Google Cloud Storage（バックアップ用）
* Cloud Scheduler（週次バックアップ）

## 🚀 デプロイ

```bash
# 全体デプロイ
firebase deploy

# フロントエンドのみ
firebase deploy --only hosting

# バックエンドのみ
firebase deploy --only functions
```

## 🕒 バージョン履歴

### v2.11.0 (2026/03/29)
* **💾 データバックアップ機能の追加**
    * 毎週日曜 00:00 JST に Firestore・Storage を GCS へ自動バックアップ
    * バックアップバケット（Coldline・バージョニング有効）を初回実行時に自動作成
    * 手動バックアップ用 HTTPS 関数（`runBackupNow`）の追加
    * 設定画面に「全データをエクスポート（JSON）」ボタンを追加
* **🗂 コード分割（ES Modules）**
    * `index.html` 1ファイル（2,194行）を `src/` 以下の8ファイルに分割
    * ビルドツール不要・デプロイ手順は変わらず

### v2.10.0 (2026/02/24)
* **⚙️ 散歩設定機能の追加**
    * 停止判定（半径・時間）のカスタマイズ
    * 自動終了機能のON/OFFと時間設定
    * GPS更新間隔と最小記録距離の調整機能
    * 設定画面の追加とFirestoreへの保存（家族共有）
    * 散歩中画面への設定値表示

### v2.9.9 (2026/02/23)
* **📏 散歩記録編集画面への歩行距離入力項目追加**

### v2.9.8 (2026/02/20)
* **🗺️ お世話画面への地図ボタン追加**

### v2.9.7 (2026/02/09)
* **🛑 散歩中断防止とモーダル改善**

### v2.9.6 (2026/02/08)
* **📊 ホーム画面の統計表示リニューアル**

### v2.9.5 (2026/02/08)
* **🔆 散歩記録中の画面スリープ防止（Screen Wake Lock）**

---
*最終更新: 2026/03/29*
