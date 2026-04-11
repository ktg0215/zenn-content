# Zenn Book: Chrome拡張 開発技術大全

## 基本情報

| 項目 | 内容 |
|------|------|
| **Book slug** | `chrome-ext-dev-mastery` |
| **タイトル** | Chrome拡張 開発技術大全 ── Manifest V3時代の設計・実装・テスト完全ガイド |
| **価格** | ¥980 |
| **対象読者** | TypeScript/React経験者、Chrome拡張開発経験者、品質を高めたい開発者 |
| **公開予定** | 2026年8月（推敲・カバー画像完成後） |

---

## 章構成と執筆状況

| ファイル | 章タイトル | 状態 | 字数 |
|---------|-----------|------|------|
| `intro.md` | はじめに | ✅ **完成** | ~1,500字 |
| `mv3-architecture.md` | 第1章 Manifest V3時代のChrome拡張アーキテクチャ | ✅ **完成** | ~3,800字 |
| `build-tools.md` | 第2章 ビルドツール選定（WXT/CRXJS/Vite） | ✅ **完成** | ~3,500字 |
| `typescript-types.md` | 第3章 TypeScript strict modeとchrome.*型定義 | ✅ **完成** | ~3,000字 |
| `storage-patterns.md` | 第4章 chrome.storage 3層設計パターン | ✅ **完成** | ~3,400字 |
| `freemium-implementation.md` | 第5章 フリーミアム実装（ExtensionPay） | ✅ **完成** | ~3,600字 |
| `ga4-implementation.md` | 第6章 GA4 Measurement Protocol実装 | ✅ **完成** | ~3,600字 |
| `content-script-design.md` | 第7章 コンテンツスクリプト設計 | ✅ **完成** | ~3,500字 |
| `sidepanel-offscreen.md` | 第8章 サイドパネル・オフスクリーン | ✅ **完成** | ~3,700字 |
| `cookie-privacy.md` | 第9章 Cookie・プライバシー系拡張の実装 | ✅ **完成** | ~3,800字 |
| `debug-test-release.md` | 第10章 デバッグ・テスト・リリース自動化 | ✅ **完成** | ~3,900字 |
| `appendix.md` | 付録 Gotchas 17選・共通ユーティリティ関数集 | ✅ **完成** | ~3,200字 |
| `outro.md` | おわりに | ✅ **完成** | ~900字 |

**総字数目安**: 約41,400字

**執筆状況**: 13/13ファイル完成 🎉

---

## 各章のハイライト

| 章 | 核心コンテンツ | コードブロック数 |
|---|-------------|--------------|
| 第1章 MV3アーキテクチャ | SW寿命問題・ステートレス3パターン・3層構成図 | 5個 |
| 第2章 ビルドツール | WXT/CRXJS/Custom Vite比較・選定フローチャート・5トラブル解決 | 6個 |
| 第4章 Storage設計 | Genericsラッパー・debounced sync・useStorageフック・マイグレーション | 7個 |
| 第5章 フリーミアム | ExtensionPay統合・月次リセットカウンタ・PaywallModal・devTools | 8個 |
| 第6章 GA4実装 | Union型イベント定義・オフラインキュー・A/Bテスト・Validation | 7個 |
| 第7章 CS設計 | MutationObserver SPA対応・型安全Message・Shadow DOM・cleanups | 8個 |
| 第8章 SidePanel/Offscreen | Port長寿命セッション・Procshot実例・Tesseract OCR・キュー設計 | 9個 |
| 第9章 Cookie/Privacy | CookieJar import/export・プライバシースコア・AES-GCM暗号化 | 8個 |
| 第10章 デバッグ/テスト | Vitestモック・Playwright E2E・GitHub Actions CI・rollback.sh | 7個 |
| 付録 | Gotchas 17選・withRetry指数バックオフ・型安全メッセージング | 5個 |

---

## 残タスク

### 必須（公開前）
- [ ] 各章の実コード動作確認（特にPlaywright E2E・WebCrypto）
- [ ] 全章推敲（誤字・章間の用語統一）
- [ ] カバー画像の作成（1000×1400px）→ 下記3案参照
- [ ] `config.yaml` の `published: true` に変更（price: 980 確認済み）
- [ ] Zennダッシュボードでプレビュー確認
- [ ] 章間リンクの動作確認（次章への橋渡しリンク全チェック）

---

## カバー画像 3案

サイズ：1000×1400px（Zenn Book標準）/ 形式：PNG / 作成ツール：Canva

---

### 案A：「コードスニペット」ターミナル型

**テーマ**: コードが並ぶ実装書感。「すぐ使えるコード」が詰まっていることを表現。

```
背景: #0D1117（GitHubダーク）
アクセント: #58A6FF（GitHubブルー）
レイアウト:
  - 上部: TypeScriptコードスニペット風（薄い背景、シンタックスハイライト）
    "async function getSubscriptionStatus(): Promise<SubscriptionStatus> {..."
  - 中央: タイトルテキスト（白、大）
  - 下部: サブタイトル + ¥980バッジ
フォント: Geist Mono（コード） / Noto Sans JP（タイトル）
```

**キャッチ**: 「全パターン、コード付き」

---

### 案B：「MV3アーキテクチャ図」設計書型（推奨）

**テーマ**: 設計が見える。技術書として「体系化されている」を視覚化。

```
背景: #111827（ダークグレー）
アクセント: #10B981（エメラルドグリーン）
レイアウト:
  - 上部: 第1章のアーキテクチャ図（Popup/Background/ContentScript）をシンプル化
            ノード間の矢印で「通信」を表現
  - 中央: タイトルテキスト（白、大）
  - 下部: 「MV3 × TypeScript × WXT」3キーワード + ¥980
フォント: Geist Mono（図ラベル） / Noto Sans JP（タイトル）
```

**キャッチ**: 「設計から実装まで体系化」をアーキテクチャ図で表現

**推奨理由**: Book 1（緑テーマ）・Book 2（ゴールド）と並べたとき、エメラルドグリーン+ダーク背景がシリーズの技術書感を最もよく表現する。¥980の重厚感にも合う。

---

### 案C：「ツールアイコングリッド」実装書型

**テーマ**: 使う技術を全部見せる。「WXT・TypeScript・GA4・ExtensionPay・Playwright」が並ぶ。

```
背景: #0F172A（スレートダーク）
アクセント: #F97316（オレンジ）
レイアウト:
  - 上部: 技術ロゴ風アイコン（TS / WXT / GA4 / Playwright / ExtensionPay）を横並び
  - 中央: タイトルテキスト（白、大）
  - 下部: 「10章 + 付録17選」実用性アピール + ¥980バッジ
フォント: Geist Sans（タイトル） / Noto Sans JP（サブ）
```

**キャッチ**: 何を学べるかが一目でわかる

---

**推奨**: 案B。技術書の「重厚感」と「体系化」を最もよく表現。エメラルドグリーン×ダーク背景はBook 1・2とシリーズ感を保ちながら差別化できる。

---

## git push タイミング

現在は**下書き段階**（`published: false`）。以下が完了したらgit push:
1. 全章本文完成（typescript-types.mdの執筆）
2. カバー画像を `cover.png` として配置
3. `config.yaml` を `published: true`・`price: 980` に変更

## 関連ファイル

- Book 1（無料）: `C:/Company/zenn-content/books/ai-chrome-extension-intro/`
- Book 2（¥500）: `C:/Company/zenn-content/books/chrome-ext-monetization-strategy/`
- Book構成プラン: `C:/Company/.company/marketing/campaigns/zenn-books-plan.md`
- Zennリポジトリ: https://github.com/ktg0215/zenn-content
