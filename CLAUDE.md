# Tsumugi

個人用メモアプリ。

## 概要

- React PWA + Supabase + Claude API を組み合わせたメモアプリ
- 将来的に Capacitor 経由で App Store 申請予定

## 技術スタック

- **フロントエンド**: Vite + React
- **バックエンド/DB**: Supabase
- **デプロイ**: Vercel
- **AI**: Claude API
- **モバイル（将来）**: Capacitor

## Phase 1 目標

書いて保存できる画面を作る。

## ディレクトリ構成

```
Tsumugi/
├── src/
│   ├── components/
│   ├── pages/
│   ├── lib/         # Supabase クライアントなど
│   └── main.tsx
├── public/
├── index.html
├── vite.config.ts
└── CLAUDE.md
```

## 開発コマンド

```bash
npm run dev      # 開発サーバー起動
npm run build    # ビルド
npm run preview  # ビルドプレビュー
```

## 環境変数

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ANTHROPIC_API_KEY=
```

## TODO

- [ ] **本番化時**: `VITE_ANTHROPIC_API_KEY` をフロントエンドから除去し、
      Vercel Edge Functions (`/api/generate-tags.ts`) に移行する。
      現在は `dangerouslyAllowBrowser: true` でローカル開発専用として動作。
      公開前に必ず対応すること（API キーが漏洩するリスクあり）。
