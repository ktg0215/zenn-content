---
title: "第7章 — Chrome Web Storeに公開する"
---

第6章までで拡張機能が動く状態になりました。ここからが「作る」フェーズの終わりであり、「届ける」フェーズの始まりです。Chrome Web Storeへの公開は思ったより簡単です。初期費用$5、審査期間数日〜2週間——この章では実際にかかる費用と、公開までの全手順を解説します。審査でリジェクトされないためのポイントも、18本の経験から整理しました。

---

※ この章は以下の記事を再編・加筆したものです。
- [Chrome拡張機能の開発にかかる費用をすべて公開する](https://zenn.dev/ktg/articles/545185f40e5f92)

---

## CWS公開のコスト全公開

実際にかかる費用はこれだけです。

| 項目 | 費用 | 頻度 |
|------|------|------|
| Chrome Developer登録料 | **$5** | 一回限り（永久）|
| 各拡張の公開 | **$0** | 何本でも無料 |
| AI開発ツール（Claude Pro等） | **$20/月** | 月次 |
| サーバー費用 | **$0** | クライアントサイド処理のため |
| **合計（初月）** | **$25** | — |

18本公開した今も、月のインフラコストは実質0円です。CWSの登録料$5を払えば、追加費用なしで無制限に公開できます。

## 公開前のチェックリスト

### 1. ビルドとzipの作成

```bash
# WXTのビルド
npm run build
# → .output/chrome-mv3/ にファイルが生成される

# PowerShellでzip化（Windowsの場合）
Compress-Archive -Path ".output/chrome-mv3/*" -DestinationPath "my-extension-v1.0.0.zip"

# Mac/Linuxの場合
cd .output/chrome-mv3 && zip -r ../../my-extension-v1.0.0.zip .
```

### 2. 必須アセットの準備

| アセット | サイズ | 用途 |
|---------|--------|------|
| アイコン | 128×128px PNG | ストアと拡張アイコン |
| スクリーンショット | 1280×800px（最大5枚） | ストアページのギャラリー |
| プロモーション画像 | 440×280px（任意） | ストアでのリスティング強化 |

アイコンはCanvaで5分で作れます。スクリーンショットは実際の動作画面をキャプチャし、Canvaでテキストを重ねるだけで十分です。

### 3. 説明文の作成（検索順位に直結）

CWSの説明文には2種類あり、重みが違います。

**Short description（132文字以内）**：検索ランキングへの影響が最も大きい

**良い例：**
```
Extract tables, lists & text from any webpage. Export to CSV, Excel,
JSON or Google Sheets. No coding required. Works on all websites.
```

**悪い例：**
```
DataPick - the best Chrome extension for data extraction. Amazing tool!
```

Short descriptionには自然な形でキーワードを含めてください。キーワードの羅列（キーワードスタッフィング）は審査でリジェクトされます。

**Full description**：箇条書きと機能一覧を使い、英語・日本語両方で書くと検索露出が増えます。

### 4. パーミッション正当化の記入

`<all_urls>` や `tabs`、`history` などのセンシティブなパーミッションを使う場合、「権限の正当化」欄への記入が必須です。

```
# 権限の正当化例（"tabs" パーミッション）
The "tabs" permission is required to read the URL and title of the 
active tab when the user clicks the extension icon. This information 
is used only to display it in the popup and is never sent to any server.
```

## 審査でよくある落とし穴

18本の公開経験で踏んだ地雷を共有します。

### 落とし穴①：キーワードスタッフィング

説明文にキーワードを詰め込みすぎると審査でリジェクトされます。自然な文章で書いてください。

### 落とし穴②：`<all_urls>` と `activeTab` の併用

両方を同時にリクエストすると「過剰なパーミッション」としてリジェクトされることがあります。必要な方だけを使いましょう。

### 落とし穴③：アイコンの商標侵害

他サービスのロゴや商標を使ったアイコンは即リジェクト。オリジナルアイコンを使ってください。

### 審査期間の目安

| 提出タイプ | 審査期間 |
|-----------|---------|
| 初回公開 | 1〜2週間 |
| バージョンアップ | 2〜5日 |
| ポリシー違反後の再提出 | 1〜2週間 |

## Edge Add-onsにも同時提出する

同じzipファイルをMicrosoft Edge Add-onsにも提出できます。追加工数ほぼゼロで、Edgeユーザーへのリーチが広がります。

Edge Add-onsの提出先：`partner.microsoft.com/dashboard`

EdgeはChromiumベースなので、CWS向けに作ったManifest V3の拡張はほぼそのまま動きます。

## 公開後の最初の72時間

公開直後に以下の行動で初期インストールを獲得します。初期インストール数はCWSの検索アルゴリズムにプラスの影響を与えます。

1. Zenn・Qiitaに開発記事を書く
2. X（Twitter）で `#個人開発` `#Chrome拡張` タグで告知
3. ProductHuntに登録（英語圏向け）
4. 関連するRedditコミュニティに投稿

---

:::message
**この章で学んだこと**

- CWS公開の初期コストは$5のみ、月次コストは実質$0
- Short descriptionがCWSの検索順位に最も影響する
- センシティブなパーミッションには「権限の正当化」の記入が必須
- キーワードスタッフィングとパーミッション過剰がリジェクトの主因
- 同じzipをEdge Add-onsにも提出してリーチを広げる
:::

---

公開しました。でも「公開 = ゴール」ではありません。最終章では、公開後にやるべきことを18本の経験から整理します。

**→ [第8章：公開後にやること](./after-publish.md)**
