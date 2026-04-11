---
title: "第4章 — はじめてのChrome拡張を1時間で作る"
---

第3章でWXT + TypeScript + Reactの開発環境が整いました。ここからが本番です。この章では実際に「動くChrome拡張」を作ります。最初に作るのはシンプルなものでいい——「現在のページのタイトルとURLをワンクリックでコピーする」拡張です。複雑な機能は不要、まず動かすことが最優先です。Manifest V3の基本構造を体で覚えながら、AIとのペアプログラミングの感覚を掴みましょう。

---

※ この章は以下の記事を再編・加筆したものです。
- [コードが書けなくてもChrome拡張を量産できる開発フロー — AI活用の実践](https://zenn.dev/ktg/articles/chrome-extension-ai-mass-production)

---

## まず作るもの：「ページタイトル+URLコピー」

シンプルですが実用的な拡張機能です。ブラウザ右上のアイコンをクリックすると、現在のページのタイトルとURLがクリップボードにコピーされます。

**開発時間目安：30〜60分**

この拡張を作るメリット：
- Manifest V3の最小構成が理解できる
- ポップアップUIとchrome APIの連携が体験できる
- AIへの指示の流れが掴める

## Manifest V3の基本構造を理解する

`manifest.json`（またはWXTなら`wxt.config.ts`）がChrome拡張の設計図です。

```json
// .output/chrome-mv3/manifest.json（WXTが自動生成）
{
  "manifest_version": 3,
  "name": "URL Copier",
  "version": "1.0.0",
  "description": "現在のページのタイトルとURLをコピーします",
  "permissions": ["activeTab", "clipboardWrite"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "128": "icon/128.png"
    }
  }
}
```

**Manifest V3で必ず覚えること：**

| 項目 | ルール |
|------|-------|
| `manifest_version` | 必ず`3`（V2は2025年以降サポート終了） |
| `permissions` | 最小限に（不要なパーミッションは審査でリジェクト） |
| バックグラウンド処理 | Service Worker（30秒でスリープするためステートレス設計が必要） |

## AIへの依頼文テンプレート

このプロンプトをCursorまたはClaude Codeに貼り付けてください。

```
Chrome拡張機能（Manifest V3）を作ってください。

【機能】
- ポップアップを開いたとき、現在のタブのタイトルとURLを表示する
- 「コピー」ボタンをクリックすると「タイトル\nURL」の形式でクリップボードにコピーされる
- コピー後は「コピーしました！」とフィードバックを表示する

【技術スタック】
- WXT + React + TypeScript
- Tailwind CSS（シンプルなスタイリング）

【ファイル構成】
- entrypoints/popup/App.tsx（ポップアップのメインコンポーネント）
- wxt.config.ts（マニフェスト設定、permissions: ["activeTab", "clipboardWrite"]）

コードを書いてください。
```

## Chromeで動作確認する手順

コードが生成されたら、Chromeにロードします。

```bash
# Step 1: ビルド
npm run build

# Step 2: Chrome拡張として読み込む
# chrome://extensions を開く
# → 右上「デベロッパーモード」をON
# → 「パッケージ化されていない拡張機能を読み込む」をクリック
# → .output/chrome-mv3/ フォルダを選択
```

ブラウザ右上に拡張機能のアイコンが表示されたら成功です。アイコンをクリックしてポップアップが開き、「コピー」ボタンが動けば完成。

## よくあるエラーと対処法

| エラー | 原因 | 対処 |
|--------|------|------|
| `chrome is not defined` | ブラウザ外環境でchrome APIを呼んでいる | コンポーネントの初期化タイミングを確認 |
| アイコンが表示されない | アイコンファイルのパスが違う | `public/icon/128.png`に128px PNGを置く |
| ポップアップが真っ白 | JSエラー発生中 | `chrome://extensions` → エラーボタンを確認 |
| `activeTab`が効かない | パーミッション不足 | `wxt.config.ts`の`permissions`を確認 |

エラーが出たら、メッセージをそのままAIに貼り付けてください。

## 12ステップの量産フロー

最初の1本を作ったら、2本目からはこのフローを回します。

### Phase 1：企画・設計（2〜3時間）
1. マーケットリサーチ（競合調査・低評価レビュー分析）
2. 要件定義（ターゲット・コア機能・フリーミアム境界）
3. 技術スタック決定（TypeScript + Vite + Manifest V3で統一）

### Phase 2：AI協働開発（4〜8時間）
4. `CLAUDE.md`でAIに文脈を与える（プロジェクト目的・Gotchas）
5. 機能ごとに分割して実装依頼（「全部作って」はNG）
6. 型チェック・ビルド確認（`npx tsc --noEmit` + `npm run build`）

### Phase 3：品質確認（2〜4時間）
7. 静的解析（TypeScript型チェック + ESLint）
8. 手動テスト（実際のChromeで操作）

### Phase 4：リリース（1〜2時間）
9. スクリーンショット5枚（1280×800）
10. 多言語化（英語だけでも大きく流入が変わる）
11. CWS提出
12. Edge Add-onsにも同じzipを提出

2本目以降は慣れで半分以下の時間になります。

## 1時間で作れる拡張のアイデア集

最初の1本ができたら、次のアイデアに挑戦してみましょう。AIへの指示1回で実装できます。

- **ページのスクリーンショットを撮る** — `chrome.tabs.captureVisibleTab`
- **特定サイトで広告を非表示にする** — コンテンツスクリプト + CSS
- **よく使うテキストをワンクリックで入力する** — テキスト展開ツール
- **現在のサイトのカラーパレットを表示する** — `getComputedStyle`で色抽出

---

:::message
**この章で学んだこと**

- Manifest V3の最小構成（manifest_version, permissions, action）
- WXTビルド → `chrome://extensions` でロードの流れ
- AIへの指示はプロンプトテンプレートを用意しておくと速い
- エラーはそのままAIに貼るだけで解決できることが多い
- 2本目以降は12ステップの量産フローを回す
:::

---

第5章からは、実際に公開している拡張機能の実装事例を見ていきます。「自分が不満に思ったこと」をそのまま形にした2本の事例から、コンテンツスクリプトとchrome.storageの使いどころを掴みましょう。

**→ [第5章：実例①読書・閲覧補助ツール](./reading-tools.md)**
