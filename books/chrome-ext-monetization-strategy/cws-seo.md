---
title: "第2章 — Chrome Web Store SEO：検索インプレッション340%増の全手順"
---

> 第1章で「売れる空白地帯」を見つけました。次の問いは「見つけてもらえるか」です。Chrome Web Storeには独自の検索エンジンがあります。アルゴリズムを理解して最適化するだけで、インストール数は大きく変わります。私が実際に体験した340%増の全手順を公開します。

---

## 340%増が起きた経緯：Procshot事例

まず事実から話します。

Procshot（ブラウザ操作を自動キャプチャしてステップガイドを生成する拡張）を公開して2ヶ月が経った頃、インストール数は伸び悩んでいました。

| 指標 | 変更前 | 変更後（4週間後） |
|-----|-------|----------------|
| 週間検索インプレッション | 240 | 1,056 |
| インプレッション増加率 | — | **+340%** |
| クリック率（CTR） | 2.1% | 3.8% |
| 週間新規インストール | 11 | 47 |

何をしたか。**タイトルを変えただけ**です。

**変更前**：`Procshot`

**変更後**：`Procshot — Automatic Procedure Capture & Step-by-Step Guide Maker`

作業時間：5分。効果：340%増。これがCWS SEOの本質です。

---

## CWSの検索アルゴリズムの仕組み

CWSはGoogleのPlayストアと同じインフラで動いています。公式にはアルゴリズムを公開していませんが、18本の拡張を運用して観察した結果、以下の要素が順位に影響すると考えられます。

### 公式に確認できる要素

| 要素 | 影響度（推定） | 根拠 |
|-----|-------------|------|
| タイトルのキーワード一致 | ★★★★★ | 変更で即座にインプレッション変動 |
| Short descriptionのキーワード | ★★★★☆ | Googleの公式ドキュメントに言及あり |
| カテゴリ設定 | ★★★☆☆ | カテゴリ内ランキングに影響 |
| ユーザー評価（星の数） | ★★★☆☆ | 高評価は露出増加につながる |
| インストール数の増加速度 | ★★★☆☆ | バーストインストールで一時的に上昇 |
| 更新頻度 | ★★☆☆☆ | 定期更新で「アクティブな拡張」として評価 |
| レビュー数 | ★★☆☆☆ | 評価数が多いほど信頼シグナルが強い |

### CWSが見ていないもの（誤解が多い）

- **説明文の文字数**：長ければいいわけではない
- **スクリーンショットの枚数**：1枚でも5枚でも検索順位は変わらない
- **価格設定**：無料/有料は検索順位に影響しない

重要なのは「**タイトルと短い説明文の最初のX文字**」です。

---

## キーワードリサーチ：何を狙うか

タイトルを最適化する前に、どのキーワードを狙うかを決めます。

### ステップ1：CWS内サジェストで需要を確認

CWSの検索バーに機能キーワードを入力して、オートコンプリートを見ます。

```
# 確認する検索クエリパターン
"pdf [機能]"          → pdf editor, pdf highlighter, pdf to word...
"tab [機能]"          → tab manager, tab grouper, tab saver...
"screenshot [機能]"   → screenshot tool, screenshot editor, screenshot capture...
```

サジェストが多いほど検索需要が高い。逆にサジェストが出ない単語は需要が低いか、誰も検索していない。

### ステップ2：競合のタイトル分析

上位5拡張のタイトルを分析して、**共通して使われているキーワード**を特定します。

```json
// competitor-analysis.json（競合タイトル分析メモ）
{
  "query": "procedure documentation",
  "top5_titles": [
    "Scribe — Automatic Procedure Documentation",
    "Tango — Workflow Documentation Maker",
    "Loom — Video Documentation Tool",
    "Guidde — AI Process Documentation",
    "Procshot — Automatic Procedure Capture & Step-by-Step Guide Maker"
  ],
  "common_keywords": ["automatic", "procedure", "documentation", "step-by-step"],
  "target_keywords": ["procedure capture", "step-by-step guide", "how-to guide maker"]
}
```

競合のタイトルから「使われていて効いているキーワード」を抽出するのが最速のリサーチです。

### ステップ3：Googleトレンドで需要を確認

CWSの検索はGoogle検索と連動している部分があります。Googleトレンドで以下を確認します。

- 「[機能名] chrome extension」の検索トレンド
- 季節変動がないか（あれば公開タイミングを調整）
- 英語と日本語どちらの需要が大きいか

---

## タイトル最適化：5分でできる最大の施策

タイトルの最適化は、CWS SEOで最もROIが高い施策です。

### タイトルの黄金律

```
[ブランド名] — [主キーワード] [副キーワード/ユースケース]

例:
Procshot — Automatic Procedure Capture & Step-by-Step Guide Maker
ReadMark — Reading Position Saver for Long Articles & Documents
DataPick — No-Code Web Scraper: Extract to CSV, Excel, Google Sheets
```

**ルール①：ブランド名は先頭に**
ブランドが後ろに来ると検索結果でブランドが見えなくなる。

**ルール②：主キーワードをダッシュの直後に**
CWSのアルゴリズムは文字列の前方一致を重視している（推定）。ダッシュの後の最初の単語がキーワードの最重要位置。

**ルール③：文字数は45〜60文字が理想**
- 45文字未満：キーワード密度が低い
- 75文字超：検索結果で末尾が切れる
- 45〜60文字：キーワードを詰め込みつつ表示される

**ルール④：英語タイトルで海外需要を取る**
CWSは言語別にインデックスする。英語タイトルは英語圏ユーザーに見つけてもらえる唯一の機会。

### 変更前後の比較（実例）

| 拡張 | Before | After | 変化 |
|-----|--------|-------|------|
| Procshot | `Procshot` | `Procshot — Automatic Procedure Capture & Step-by-Step Guide Maker` | インプレッション+340% |
| ReadMark | `ReadMark` | `ReadMark — Reading Position Saver & Bookmark for Long Articles` | インプレッション+180% |
| DataPick | `DataPick` | `DataPick — No-Code Web Scraper: Extract Tables to CSV & Google Sheets` | インプレッション+220% |

---

## Short description（短い説明文）：133文字の使い方

Short descriptionはCWSの検索結果一覧に表示される133文字の説明文です。タイトルに次いでSEOへの影響が大きい。

### 構造テンプレート

```
# short-description-template.txt
# パターン1：機能 + 対象ユーザー + 差別化
[動詞] + [何を] + [どこで/どのように]. [ターゲット] + [差別化ポイント].

例:
"Save your reading position on any webpage. Restore it with one click.
Perfect for long documentation, tutorials, and research articles."

# パターン2：Problem-Solution型
[課題の共感] + [解決策] + [具体的な機能].

例:
"Stop losing your place in long articles. ReadMark automatically saves
your scroll position and restores it when you return — no login required."
```

### 避けるべきNG表現

| NG表現 | 理由 |
|--------|------|
| 「最高」「最強」「No.1」 | ポリシー違反でリジェクト |
| キーワードの羅列 | キーワードスタッフィングとして判定 |
| 会社名・開発者名 | 検索者は知らない |
| 「無料」「Free」（タイトルに） | ポリシーで禁止 |

### 133文字の配分ガイド

```
0〜60文字：最重要キーワードを自然に含めたHook
60〜110文字：主要機能の列挙（動詞+目的語形式）
110〜133文字：ターゲットユーザーor差別化ポイント
```

---

## 詳細説明文：Problem/Features/Keywords構造

Full descriptionはCWSのページで全文表示されます。SEOへの直接影響は低いですが、インストール率（CVR）に大きく影響します。

### 推奨構造（2,000〜4,000文字目安）

```markdown
## [Hook: 課題の共感 1-2行]
"Long articles are frustrating to revisit. You scroll back to where you
left off every single time — wasting minutes you could spend reading."

## ✨ Key Features
- **Auto-save**: Your position is saved automatically as you read
- **One-click restore**: Return to your exact spot with a single click
- **Multi-page support**: Track reading progress across dozens of pages
- **Zero setup**: Works immediately after installation, no accounts needed

## 🎯 Perfect For
- Technical documentation readers
- Researchers reading multiple long papers
- Students working through online textbooks

## 🔒 Privacy First
All data stays on your device. We never collect or transmit your
browsing history or reading positions.

## ⭐ How to Use
1. Install ReadMark
2. Start reading any long article
3. Come back anytime — your position is waiting

---
Keywords: reading progress, scroll position saver, bookmark, long articles,
documentation reader, research tool
```

### キーワード密度の管理

```
# 理想的なキーワード密度チェック
主キーワード（例：scroll position）: 3〜5回
副キーワード（例：reading bookmark）: 2〜3回
関連語（例：long articles, documentation）: 各1〜2回

# NG: 同じキーワードを繰り返す
"save scroll position, auto save scroll position, scroll position saver,
position save, scroll save..." → 即リジェクト
```

---

## スクリーンショット最適化：1枚目だけで勝負が決まる

スクリーンショットは検索結果に**1枚目だけ**が表示されます。

### 1枚目に入れるべき要素

```
┌─────────────────────────────────────┐
│  キャッチコピー（大きく・英語）         │
│  "Automatically saves where you      │
│   stopped reading"                   │
├─────────────────────────────────────┤
│                                      │
│    [拡張機能の実際のUI スクリーン]     │
│    (動作している状態を見せる)          │
│                                      │
└─────────────────────────────────────┘
推奨: 1280×800px / PNG / 余白16px以上
```

**良い1枚目の条件：**
- **5秒ルール**：5秒見て何の拡張かわかる
- **テキスト付き**：機能説明のキャッチコピーを画像上に重ねる
- **実際の動作画面**：モックアップより実画面が信頼される
- **コントラスト**：テキストが背景に溶け込まない

**悪い1枚目の例（実際に失敗した）：**
- アイコンだけ大きく表示（機能が伝わらない）
- UI全体を小さく表示（読めない）
- 日本語のみ（英語圏ユーザーに届かない）

### 2〜5枚目の構成例（DataPickの場合）

| 枚数 | 内容 |
|-----|-----|
| 1枚目 | 「クリックするだけでデータ抽出」+ ハイライト選択UI |
| 2枚目 | CSV/Excelエクスポート後のスプレッドシート |
| 3枚目 | Google Sheets直接書き込みのデモ |
| 4枚目 | 対応サイト一覧 |
| 5枚目 | フリーミアム境界（無料でできること/Proでできること）|

---

## キーワードスタッフィング回避：審査を通過するためのルール

CWSはキーワードスタッフィング（不自然なキーワード詰め込み）に敏感です。実際にPromptStashの初回申請がこれでリジェクトされた経験があります。

### リジェクトされたときの説明文（実例）

```
# ❌ キーワードスタッフィングの例（修正前）
"AI prompt manager. Best prompt manager for AI. Prompt management tool.
ChatGPT prompts. Claude prompts. Gemini prompts. Save AI prompts.
Manage prompts. Prompt organizer. AI workflow prompts..."
```

### 修正後（承認された）

```
# ✅ 自然なキーワード配置（修正後）
"PromptStash helps you save, organize, and reuse AI prompts across
ChatGPT, Claude, Gemini, and 19 other AI services. Use slash commands
to instantly insert saved prompts. Build your personal prompt library."
```

**判断基準：**
- 読んだときに自然な英語（または日本語）の文章になっているか
- 同じキーワードが3行以内に3回以上出てこないか
- キーワードが文脈の中で使われているか（羅列でないか）

---

:::message
**この章で学んだこと**

- CWS SEOで最大の施策はタイトルの最適化（Procshot事例：340%増/4週間）
- タイトルは「ブランド名 — 主キーワード 副キーワード」の45〜60文字が理想
- Short descriptionはProblem-Solution型かFeature型で133文字を使い切る
- スクリーンショットの1枚目だけが検索結果に表示される、5秒ルールで設計する
- キーワードスタッフィングは即リジェクト対象、自然な文章の中にキーワードを配置する
:::

---

CWS上で見つけてもらえるようになりました。次のステップは「見つけた人にインストールしてもらう」ことです。第3章では、ストアページ全体の最適化——タイトル・説明文・スクリーンショット・プロモーション画像を一体として設計するリスティング最適化を解説します。

**→ [第3章：リスティング最適化](./listing-optimization.md)**
