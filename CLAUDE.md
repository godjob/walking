# CLAUDE.md - 福といっしょ 開発ガイド

## アプリ概要
愛犬「福」の散歩・健康記録を家族で共有するPWAアプリ。
Firebase上で動作し、LINE通知・GPS追跡・写真管理などを提供する。

## 技術スタック

### フロントエンド
- React 17（CDN）・Tailwind CSS（CDN）・ES Modules構成
- ビルドツールなし・Babelなし・JSXなし（React.createElement()で記述）
- `<script type="module" src="src/app.js">` でエントリーポイント読み込み
- CDNグローバル変数（`React`, `ReactDOM`, `firebase`, `google`）をモジュール内で直接参照

### バックエンド
- Firebase Cloud Functions v1（Node.js 20）、リージョン: `asia-northeast1`

### インフラ
- Firebase Hosting / Firestore / Cloud Storage
- バックアップバケット: `gs://walking-36c5a-backup/`（Coldline）
- Firebase プロジェクトID: `walking-36c5a`

## ファイル構成

```
fuku-walk/
├── index.html              HTMLの骨格・CDN読み込み（63行）
├── src/
│   ├── firebase-init.js    Firebase設定・初期化・db/storage/functions export
│   ├── constants.js        定数・APP_VERSION・設定値
│   ├── utils.js            共通ユーティリティ（日付・天気・距離計算など）
│   ├── map.js              地図・写真表示コンポーネント
│   ├── walk.js             散歩記録フォームコンポーネント
│   ├── health.js           お世話記録コンポーネント
│   ├── settings.js         設定画面コンポーネント・exportAllData
│   ├── search.js           ホーム画面の記録検索ロジック（純粋関数）
│   ├── tailwind-input.css  Tailwind生成元（dist/tailwind.css のソース）
│   └── app.js              メインAppコンポーネント・ReactDOM.render()
├── dist/
│   └── tailwind.css        ビルド済みTailwind CSS（生成物・コミット対象）
├── tests/
│   ├── verify-tailwind-css.js       生成CSSの網羅性検証
│   ├── verify-perf-regression.js    初期表示高速化施策の退行検出
│   └── verify-date-local.js         日付のローカルタイム処理の退行検出
├── functions/
│   └── index.js            Cloud Functions（LINE通知・自動/手動バックアップ）
├── service-worker.js       PWAキャッシュ（shell / vendor の2層）
├── firebase.json           Firebase統合設定
├── firestore.rules         Firestoreセキュリティルール
└── storage.rules           Storageセキュリティルール
```

## Tailwind CSS の再生成（v2.16.0〜）

Tailwind は `cdn.tailwindcss.com`（ブラウザ上でJITコンパイルするPlay CDN）から
ビルド済みCSSに移行済み。**Tailwindのクラスを追加・変更したら必ず再生成すること。**
再生成を忘れると、そのクラスだけスタイルが当たらない。

```bash
npx tailwindcss@3 -i src/tailwind-input.css -o dist/tailwind.css \
  --content "./index.html,./src/**/*.js" --minify
node tests/verify-tailwind-css.js     # 使用クラスがCSSに含まれるか検証
node tests/verify-perf-regression.js  # 高速化施策の退行検出
node tests/verify-date-local.js       # 日付がUTCずれしていないか検証
```

`bg-${color}-500` のようにクラス名を分割して組み立てると抽出できず崩れるため、
条件分岐は必ず完全なクラス名を三項演算子で切り替える形で書くこと。

## Firestoreコレクション

| コレクション | 用途 | アクセス |
|------------|------|---------|
| `walks` | 散歩記録 | フロントエンド読み書き |
| `health` | お世話記録 | フロントエンド読み書き |
| `walkers` | 家族メンバー | フロントエンド読み書き |
| `settings` | アプリ設定（家族共有） | フロントエンド読み書き |
| `line_users` | LINE通知先 | バックエンドのみ |

## デプロイコマンド

```bash
firebase deploy                    # 全体
firebase deploy --only hosting     # フロントエンドのみ
firebase deploy --only functions   # バックエンドのみ
```

## バックアップ

```bash
# 手動バックアップ（即時実行）
curl -X POST https://asia-northeast1-walking-36c5a.cloudfunctions.net/runBackupNow

# 自動バックアップ: 毎週日曜 00:00 JST（Cloud Scheduler）
```

## 開発ルール

### 必須
1. **仕様確認**: 実装前に仕様案を提示し、承認を得てから実装する
2. **機能チェック**: 既存機能（特にLINE通知・散歩記録・GPS）の退行がないか確認する
3. **テスト**: 実装前テスト（FAIL確認）→ 実装 → 実装後テスト（PASS確認）の順で行う
   フロントエンドを変更したら `node tests/verify-perf-regression.js` も実行する。
   SW登録・Firestore永続化・Tailwind静的CSS等は**壊れても画面上は正常に見える**ため、
   目視では退行に気づけない（v2.9.5ではSW登録コードの欠落が5バージョン発覚しなかった）
4. **PR作成**: 機能追加・大きな変更は実装後にプルリクエストを作成して報告する。軽微な修正（1〜2行のバグ修正など）はmainへ直接pushして良い
5. **バージョニング**: 変更に応じた次期バージョン（vX.Y.Z）を提案する

### 禁止事項
- ビルドツール（Vite等）の導入（明示的な承認なしに）
- Babel・JSXの導入
- CDN読み込みのReact/Firebaseをnpmパッケージに置き換えること
- **Tailwind を `cdn.tailwindcss.com`（Play CDN）に戻すこと**
  v2.16.0で承認のうえビルド済みCSSへ移行済み。Play CDNはブラウザ上でJITコンパイルを行い、
  旧機種の初期表示が大幅に遅くなる（この問題の根本原因だった）
- 既存コードの削除・変更（追記のみ許可）
- `--force` オプションを使った破壊的な操作

### 環境制約
- `gsutil` 未インストール → GCS操作はCloud Function内のAdmin SDKで代替
- `gh` CLI 未インストール → PRはブラウザで作成（`https://github.com/godjob/walking/compare/main...{branch}`）

## バージョン管理

`src/constants.js` 内の `APP_VERSION` を更新する。
セマンティックバージョニング: `vX.Y.Z`
- Z: バグ修正・微修正
- Y: 機能追加
- X: 破壊的変更

現在: v2.16.1
