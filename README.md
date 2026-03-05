# Discogs Price Helper (Chrome extension)

このプロジェクトは、メルカリ / ヤフオク 等の出品ページを開いた際に Discogs の情報（検索候補・価格帯）を表示し、ウォッチリストに追加できる Chrome 拡張機能のプロトタイプです。

主な機能

- ページのタイトル/本文を抽出して Discogs 検索
- （オプション）Gemini 風の API に本文/タイトルを送って型番等を抽出し Discogs 検索に渡す
- 検索候補と価格帯（可能な場合）をポップアップ／ページ上に表示
- ウォッチリストを拡張機能内に保存・表示

セットアップ

1. 依存インストール

```bash
cd /path/to/dicogs-extension
npm install
```

2. 開発 / ビルド

- 開発サーバ (Vite) を使う場合（拡張機能としての実行は別途ビルドしたものを Chrome に読み込む必要があります）:

```bash
npm run dev
```

- 本番ビルド

```bash
npm run build
```

ビルド結果は `dist/` に出力されます。Chrome 拡張機能管理画面から「パッケージ化されていない拡張機能を読み込む」で `dist/` を読み込んでください。

設定

- 拡張機能のオプション画面で `Discogs token`（database API token）と任意で `Gemini-like endpoint` / `Gemini API key` を入力してください。
- Gemini エンドポイントは、{ title, body } を POST すると { modelNumbers: string[] } のような JSON を返すAPIを想定しています。未設定時は本文からの正規表現抽出を行います。

注意点

- Discogs のマーケットプレイスの価格取得エンドポイントは利用環境や API の仕様に依存します（トークンや権限が必要）。現在の実装はベストエフォートで URL を叩きますが、環境に合わせて調整してください。
- CORS や API レートに注意してください。必要ならプロキシサーバーを挟んでください。

次の改善案

- Discogs のマーケット価格取得を確実にする（API ドキュメントに合わせた実装）
- より精度の高い本文→識別子抽出（Gemini のプロンプト最適化）
- 各種 UI 改善（テーブル表示、履歴、通知）
