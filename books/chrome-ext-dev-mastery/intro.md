---
title: "はじめに — 本書の使い方とMV3時代の全体像"
---

> 18本のChrome拡張を作り、そのたびに同じ壁にぶつかった。Service Workerの寿命問題、storageの競合状態、CWSのCSP制約、テスト環境の構築——これらに毎回時間を溶かすのをやめたくて、パターンとして整理したのがこの本です。

---

## この本で学べること

| 章 | テーマ | 実装例 |
|---|-------|-------|
| 第1章 | MV3アーキテクチャとService Worker | ステートレス設計パターン3つ |
| 第2章 | ビルドツール選定（WXT/CRXJS/Vite） | 18本の拡張から導いた選定基準 |
| 第3章 | TypeScript strict modeとchrome.*型定義 | メッセージパッシング型設計 |
| 第4章 | chrome.storage 3層設計パターン | local/sync/session使い分け |
| 第5章 | フリーミアム実装（ExtensionPay） | リバーストライアル完全実装 |
| 第6章 | GA4 Measurement Protocol実装 | 12イベント + オプトアウト |
| 第7章 | コンテンツスクリプト設計 | SPA対応・Shadow DOM隔離 |
| 第8章 | サイドパネル・オフスクリーン | 常駐UI・バックグラウンドDOM |
| 第9章 | Cookie・プライバシー系拡張の実装 | CookieJar設計・CWS審査対策 |
| 第10章 | デバッグ・テスト・リリース自動化 | Playwright E2E・GitHub Actions |
| 付録 | Gotchas 17選・共通ユーティリティ | debounce/retry/型安全メッセージング |

---

## 対象読者

**この本はこんな方に最適です:**

- TypeScript/React経験者でChrome拡張開発に入門したい方
- すでに拡張を1〜2本公開しているが、設計やコード品質を改善したい方
- 複数の拡張を量産できる再現性のある設計パターンを習得したい方

**こんな方には向いていません:**

- プログラミング初心者（JavaScript/TypeScriptの基礎を先に学んでください）
- 「とりあえず動くもの」を1本作りたいだけの方（[Book 1「AIで始めるChrome拡張 個人開発入門」](https://zenn.dev/ktg/books/ai-chrome-extension-intro) が最適です）

---

## ¥980の価値について

本書はBook 1（無料）・Book 2（¥500）とシリーズ構成になっています。

| 本 | 価格 | 内容 |
|---|------|------|
| Book 1「AIで始めるChrome拡張 個人開発入門」 | 無料 | Claude/Cursor AIを使った最初の1本の作り方 |
| Book 2「Chrome拡張を売るための戦略書」 | ¥500 | CVR最大化・フリーミアム設計・クロスプロモーション |
| **本書（Book 3）「Chrome拡張 開発技術大全」** | **¥980** | **実装パターンの体系化・テスト・リリース自動化** |

¥980に値するのは、以下の理由からです。

**1. 「ゼロから調べる時間」を削減する**

本書の各章は「S-Hubで実際に遭遇した問題とその解決策」です。MutationObserverのSPA対応、offscreenのキュー設計、Playwright E2Eの `headless: false` 制約——これらをゼロから調べると1日以上かかります。本書はその調査結果を8,000字以上のコードとともに凝縮しています。

**2. 「18本分の経験」が入っている**

1本の拡張を作る経験値と18本の経験値は、単純に18倍ではありません。3本目から見えてくる共通パターン、10本目に気づく設計の限界、18本目で確立した量産フレームワーク——これらは作らないとわからない知識です。

**3. 「コードをコピーしてすぐ使える」**

本書のすべてのコードはTypeScript strict modeで動作確認済みです。各コードブロックにはファイル名を記載し、プロジェクトにそのまま配置できます。

---

## この本で扱わないこと

- Chrome拡張の「作り方入門」→ [Book 1](https://zenn.dev/ktg/books/ai-chrome-extension-intro) を参照
- 収益化・マーケティング戦略→ [Book 2](https://zenn.dev/ktg/books/chrome-ext-monetization-strategy) を参照
- Firefox拡張（WXTによるマルチブラウザ対応の概要は触れますが、Firefox固有の実装は扱いません）

---

## コードについて

本書のすべてのコードはTypeScript strict modeで書かれています。`any` 型は一切使用していません。各コードブロックにはファイル名コメントを付け、実際のプロジェクト構造に対応させています。

```json
// tsconfig.json — 本書が前提とする設定
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "lib": ["ESNext", "WebWorker"],
    "module": "ESNext",
    "moduleResolution": "Bundler"
  }
}
```

では第1章から始めましょう。Manifest V3の設計思想を理解することが、すべての実装パターンの基礎になります。

**→ [第1章：Manifest V3時代のChrome拡張アーキテクチャ](./mv3-architecture.md)**
