---
title: "Chrome Web Store SEOの完全ガイド — 17本の拡張で試したキーワード戦略"
emoji: "🔍"
type: "tech"
topics: ["chrome拡張機能", "seo", "個人開発", "マーケティング", "typescript"]
published: false
published_at: 2026-04-25 07:00
---

## はじめに

Chrome Web Storeには検索エンジンがある。そして、ほとんどの開発者はそのSEOを全くやっていない。

17本の拡張機能を公開して、CWS検索からのインストールを最大化するために試行錯誤した結果をまとめる。日本語でCWS SEOを解説した記事はほぼゼロなので、この記事が参考になれば幸いだ。

[S-Hub — 最適化済みの全拡張一覧](https://dev-tools-hub.xyz/?utm_source=zenn&utm_medium=article&utm_campaign=cws-seo-guide)

---

## CWS検索アルゴリズムの仕組み

CWSの検索ランキングに影響する要素を、重要度順に並べる：

1. **拡張機能名**（最重要）
2. **短い説明**（132文字制限）
3. **詳細説明**
4. **カテゴリ選択**
5. **ユーザー評価・レビュー数**
6. **週間アクティブユーザー（WAU）**
7. **インストール/アンインストール比率**

この中で、開発者がすぐにコントロールできるのは1-4だ。5-7は間接的な改善になる。

---

## 要素1：拡張機能名 — キーワードファースト

CWS SEOの**8割はここで決まる**。

### NG例

```
Procshot
ZenRead
CookieJar
```

ブランド名だけでは、検索で一切引っかからない。

### OK例（キーワードファースト形式）

```
Procshot — Automatic Procedure Capture & Step-by-Step Guide Maker
ZenRead — Reader Mode & Read Aloud for Chrome
CookieJar — Cookie Editor, Manager & Privacy Analyzer
```

### フォーマット

```
[ブランド名] — [主要キーワード] [副次キーワード] [修飾語]
```

### 実際の結果

17拡張全てをキーワードファースト形式に変更した結果：

| 指標 | 変更前 | 変更後（30日） |
|------|--------|--------------|
| 検索インプレッション | 2,400/週 | 8,100/週 |
| 検索からのインストール | 120/週 | 380/週 |
| 検索CTR | 2.1% | 3.8% |

**タイトル変更だけで検索インプレッションが3.4倍になった。**

[Procshot — 最適化後のCWSリスティング](https://chromewebstore.google.com/detail/procshot)

---

## 要素2：短い説明（132文字）

検索結果とリスティングカードに表示される。全角換算で約66文字。

### ルール

- 最初にユーザーベネフィットを書く（機能ではなく価値）
- 主要キーワードを自然に含める
- 差別化ポイントで締める

### 例（DataPick）

```
Extract tables, lists & text from any webpage. Export to CSV, Excel, JSON or Google Sheets. No coding required.
```

このテキストに含まれるキーワード：
- extract, tables, lists, text, webpage
- CSV, Excel, JSON, Google Sheets
- no coding

全て検索ボリュームのあるキーワードだ。

---

## 要素3：詳細説明

長文のSEOコンテンツを書ける唯一の場所。構成テンプレート：

### 推奨構成

```
1. 概要（問題提起 + 解決策）
2. 主要機能リスト（各機能がキーワード）
3. ユースケース（「〜な人に最適」形式）
4. 技術詳細（MV3対応、パーミッション説明）
5. プライバシーポリシー（信頼構築）
6. サポート情報
```

### キーワード密度の目安

自然な文章の中で、主要キーワードが**2-3%**出現する程度。キーワードスタッフィングはCWSレビューでリジェクトされるリスクがある。

---

## 要素4：8言語ローカライズ

CWSは `_locales` フォルダの言語に応じて、各言語の検索結果に表示する。

### 対応すべき8言語

| 言語 | コード | 理由 |
|------|--------|------|
| 英語 | en | 基本 |
| 日本語 | ja | 国内ユーザー |
| 中国語（簡体） | zh_CN | 最大のChrome市場の一つ |
| 韓国語 | ko | アジア市場 |
| スペイン語 | es | 世界2位の話者数 |
| フランス語 | fr | ヨーロッパ市場 |
| ドイツ語 | de | ヨーロッパ市場 |
| ポルトガル語 | pt_BR | 南米市場 |

### ローカライズの効果

Japanese Font Finderは、日本語ローカライズ後にインストールの**40%が日本語検索経由**になった。

ローカライズは `messages.json` を各言語フォルダに置くだけ。AIに翻訳を任せれば、1拡張あたり30分で8言語対応できる。

---

## 要素5：レビュー戦略

レビュー数と平均評価はランキングに直結する。

### Win-Ask方式

ユーザーが**成功体験をした直後**にレビューを依頼する。

| 拡張 | トリガー条件 |
|------|------------|
| Procshot | 手順キャプチャ5回成功後 |
| DataPick | データ抽出10回成功後 |
| ReadMark | 5ページブックマーク後 |

### 実装のポイント

- ボタンは2つ：「レビューする」「今はしない」
- 「今はしない」を押したら**永久非表示**（しつこくしない）
- GA4で `review_prompt_shown/clicked/dismissed` を計測

[ReadMark — Win-Ask実装済みの例](https://chromewebstore.google.com/detail/inejhohffndeacbihghjcobndpoejdfn)

---

## 要素6：スクリーンショット

検索ランキングへの直接影響は少ないが、**CTR（クリック率）に大きく影響する**。

### ルール

- 1枚目は拡張の実際の動作画面（マーケティングスライドではなく）
- テキストオーバーレイで「何ができるか」を説明
- 統一されたブランディング（フォント、カラー）
- 解像度: 1280x800

### やってはいけないこと

- テンプレ感のあるジェネリックなモックアップ
- テキストが多すぎて実際の画面が見えない
- スクリーンショット間でスタイルがバラバラ

---

## 実践チェックリスト

新しい拡張をCWSに公開するたびに、このチェックリストを回している：

- [ ] タイトル：キーワードファースト形式
- [ ] 短い説明：132文字でキーワード+ベネフィット
- [ ] 詳細説明：構成テンプレートに沿って記述
- [ ] スクリーンショット5枚（テキストオーバーレイ付き）
- [ ] 小タイル（440x280）
- [ ] 8言語ローカライズ
- [ ] カテゴリ：最も近いものを選択
- [ ] Win-Askレビューモーダル実装
- [ ] GA4トラッキング実装
- [ ] クロスプロモーションバナー設置

---

## まとめ

CWS SEOは複雑ではない。ほとんどの開発者がやっていないから、やるだけで差がつく。

最も効果が大きいのは：
1. **タイトルのキーワードファースト化**（これだけで検索3.4倍）
2. **8言語ローカライズ**（工数30分で新しい検索面を獲得）
3. **Win-Askレビュー**（自然にレビューが貯まる仕組み）

17本の拡張でこの戦略を回した結果、週間インストール数は120から380に成長した。

[S-Hub — 全拡張機能はこちら](https://dev-tools-hub.xyz/?utm_source=zenn&utm_medium=article&utm_campaign=cws-seo-guide)

---

### 関連リンク

- [Procshot](https://chromewebstore.google.com/detail/procshot) — ブラウザ操作を自動キャプチャ
- [DataPick](https://chromewebstore.google.com/detail/epoehadeccangbpjldlbkapnakndbpkf) — Webデータ抽出
- [ZenRead](https://chromewebstore.google.com/detail/zenread) — リーダーモード
- [CookieJar](https://chromewebstore.google.com/detail/lhngfkchfepfjjdfhimconagoejemofg) — Cookie管理
