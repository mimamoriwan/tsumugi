# Tsumugi

個人用メモアプリ。Apple純正メモアプリの代替として、自分に最適化されたメモ環境を作ることが目的。

---

## コンセプト

**「キャプチャは無摩擦、整理は後から自動」**

- 書くとき：日付＋題名（例：`20260524_リライト`）だけつけて書き捨てる
- 保存後：Claude APIが自動でタグ付け・分類
- 見返すとき：曖昧な記憶の断片からでも素早く辿り着ける

---

## 開発方針

- **シングルユーザー最適化が最優先**：自分が一番厳しいベータテスター
- **使いながら育てる**：動くものを手元に置いて改修
- **手動操作を最小化**：コード変更はClaude Codeに任せ、自分の手は入れない
- **製品化を視野に**：満足できたらCapacitor → App Store申請

---

## 技術スタック

| 要素 | 技術 |
|---|---|
| フロントエンド | React + Vite + TypeScript |
| ホスティング | Vercel（GitHubと自動連携） |
| DB | Supabase（PostgreSQL・東京リージョン） |
| AI | Claude API（claude-sonnet-4-6） |
| 将来のネイティブ化 | Capacitor → Xcode → App Store |

### ロードマップ
```
① React PWA（現在）
      ↓ 使い込んで満足したら
② Capacitorでラップ
      ↓
③ Xcodeでビルド・署名（Apple Developer登録済み・会社名義）
      ↓
④ App Store申請
```

---

## URL・リポジトリ

- **本番URL**: https://tsumugi-kohl.vercel.app
- **GitHub**: https://github.com/mimamoriwan/tsumugi

---

## ファイル構成

```
tsumugi/
├── CLAUDE.md                # このファイル
├── src/
│   ├── App.tsx              # メインUI（3タブ：書く・一覧・探す）
│   ├── App.css              # スタイル（ライト/ダークモード対応）
│   └── lib/
│       ├── supabase.ts      # Supabaseクライアント + Memo型定義
│       └── tagger.ts        # Claude API自動タグ付け・セマンティック検索
├── .env.local               # 環境変数（gitignore済み）
├── supabase_setup.sql       # テーブル作成SQL（実行済み）
└── vite.config.ts
```

---

## 環境変数

### ローカル（.env.local）
```
VITE_SUPABASE_URL=https://nnvzyicyuupukybylbql.supabase.co
VITE_SUPABASE_ANON_KEY=（Supabase Publishableキー）
ANTHROPIC_API_KEY=（AnthropicのAPIキー）  ← VITE_プレフィックスなし（サーバー側専用）
```

### Vercel（本番）
```
VITE_SUPABASE_URL=設定済み
VITE_SUPABASE_ANON_KEY=設定済み
ANTHROPIC_API_KEY=要追加（Edge Function内でのみ参照）
```

---

## Supabase情報

| 項目 | 内容 |
|---|---|
| プロジェクト名 | mimamoriwan's Project |
| リージョン | Northeast Asia（Tokyo） |
| Project URL | https://nnvzyicyuupukybylbql.supabase.co |
| テーブル | memos |
| RLS | 有効（anon・authenticatedに全操作許可） |

### memosテーブル構造
```sql
id          uuid        primary key, default gen_random_uuid()
title       text        not null（例：20260524_リライト）
content     text        not null
tags        text[]      default '{}'
created_at  timestamptz default now()
updated_at  timestamptz default now()
```

---

## 実装済み機能（2026年5月24日時点）

| 機能 | 内容 |
|---|---|
| メモ保存 | タイトル＋本文をSupabaseに保存 |
| 自動タグ付け | 保存時にClaude APIが日本語タグを5〜8個生成（Edge Function経由・本番でも動作） |
| 未タグ自動補完 | PCブラウザ起動時にtags:[]のメモを一括タグ付け（iPhoneで書いたメモに後からタグをつける） |
| キーワード検索 | タイトル・本文のilike検索 |
| AIセマンティック検索 | 自然文でClaudeが意味的に関連するメモを順位付けして返す（Edge Function経由・本番でも動作） |
| 一覧表示 | 新着順・タグ表示 |
| PWA対応 | iPhoneのホーム画面に追加可能（vite-plugin-pwa・Appleメタタグ・アイコン設定済み） |
| メモ詳細表示・自動保存 | 一覧からメモをクリックしてモーダルで全文表示・編集（1.5秒デバウンスで自動保存） |
| メモ削除 | 詳細モーダルから削除可能 |
| タグ絞り込み | タグをクリックすると同タグのメモを時系列で絞り込み表示・クリアボタンで全件に戻る |

---

## PC・iPhone の役割分担

| 端末 | できること |
|---|---|
| iPhone（本番Vercel） | 全機能が使える（Edge Function経由でタグ付け・AI検索も動作） |
| PC（vercel dev） | 全機能が使える（Edge Function + Vite をローカルで同時起動） |

---

## 既知の問題・未実装

| 項目 | 対応方針 |
|---|---|
| ~~AI機能が本番で動かない~~ | Vercel Edge Functions実装済み（/api/tag・/api/search）|

---

## 次にやること（優先順）

### 優先度高
なし（数日間の実運用フィードバックを待つ）

### 優先度中
なし（Edge Functions実装完了）

### 優先度低（将来）
2. **Capacitorでネイティブ化** → Xcode経由でApp Store申請
3. **マルチデバイス最適化** → iPad・iPhoneでの表示調整

---

## 開発コマンド

```bash
npm run dev      # 開発サーバー起動（vercel dev：Vite + Edge Functions を同時起動）
npm run build    # ビルド確認
```

---

## セキュリティ注意事項

`ANTHROPIC_API_KEY` はサーバー側（Edge Function）でのみ使用。ブラウザには露出しない。
クライアントは `/api/tag`・`/api/search` を呼ぶだけで、APIキーを持たない。