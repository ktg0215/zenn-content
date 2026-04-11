---
title: "Chrome拡張を17本個人開発して学んだこと：技術・CWS審査・収益化まで"
emoji: "🛠️"
type: "idea"
topics: ["chrome拡張機能", "個人開発", "typescript", "マーケティング", "収益化"]
published: true
published_at: 2026-04-21 07:00
---

## はじめに

2025年からChrome拡張機能の個人開発を始めて、気づけば17本をChrome Web Storeに公開していた。

生産性ツール、開発者ツール、リーディング補助、データ抽出、SNSカスタマイズ――ジャンルはバラバラだが、17本作る中で見えてきたパターンがある。

この記事では、技術面・CWS審査・収益化の3軸で学んだことを共有する。

[S-Hub — 全拡張機能の一覧はこちら](https://dev-tools-hub.xyz/?utm_source=zenn&utm_medium=article&utm_campaign=17-lessons)

---

## 技術面で学んだこと

### Manifest V3は「ステートレス設計」が全て

MV3ではバックグラウンドがService Workerになり、30秒で停止する。グローバル変数に状態を持つと、再起動時に全て消える。

これが17本作って最も痛感した教訓だ。

**解決策：** `chrome.storage` を3層に分けて使う。

- `chrome.storage.session` — セッション中だけ必要なデータ（ブラウザ閉じたら消える）
- `chrome.storage.sync` — ユーザー設定（デバイス間で同期）
- `chrome.storage.local` — 永続データ（利用統計、キャッシュ）

### TypeScriptは必須

17本の拡張を保守していると、型がないコードベースは破綻する。`any` 型は一切使わず、全ての拡張でTypeScript + strict modeを採用している。

### ビルドツールはViteに統一

最初はwebpackやCRXJSなど色々試したが、最終的にViteのカスタム設定に統一した。理由：

- ビルドが速い（ほとんどの拡張で3秒以内）
- 設定がシンプル
- Tree-shakingが優秀でバンドルサイズが小さい

### GA4トラッキングは全拡張に入れる

Measurement Protocol を使って、全拡張に以下のイベントを送信している：

- `install` — インストール時
- `update` — アップデート時
- `feature_used` — 主要機能の使用時
- `paywall_shown` — 有料機能の壁が表示された時
- `review_prompt_shown/clicked/dismissed` — レビュー依頼の反応

このデータがなければ、どの拡張に注力すべきか判断できない。

---

## CWS審査で学んだこと

### パーミッションは最小限に

`<all_urls>` と `activeTab` を同時にリクエストするとリジェクトされる。パーミッションの正当性説明（Permission Justifications）は必ず書く。

### タイトルは「キーワードファースト」

CWSの検索は拡張機能名を最も重視する。ブランド名だけのタイトルでは検索に引っかからない。

**NG:** `Procshot`
**OK:** `Procshot — Automatic Procedure Capture & Step-by-Step Guide Maker`

この変更だけで検索インプレッションが**340%増加**した。

[Procshot — Chrome Web Store](https://chromewebstore.google.com/detail/procshot)

### 説明文は132文字が勝負

CWSの短い説明（Short Description）は132文字制限。ここにキーワードを自然に詰め込む。

**例（DataPick）：**
> Extract tables, lists & text from any webpage. Export to CSV, Excel, JSON or Google Sheets. No coding required.

### 8言語ローカライズでインストール数2倍

`_locales` フォルダに8言語のメッセージファイルを追加するだけで、各言語の検索結果に表示されるようになる。

対応言語：英語、日本語、中国語（簡体）、韓国語、スペイン語、フランス語、ドイツ語、ポルトガル語

---

## 収益化で学んだこと

### フリーミアムが唯一の選択肢

CWSには購入前にインストールする仕組みがないため、「まず無料で使ってもらう → 制限に当たったら課金」のフリーミアムモデルしか機能しない。

現在7本の拡張で有料プランを提供している。

### リバーストライアルが効く

通常の無料トライアル（申し込み→7日間Pro→期限切れ）ではなく、**インストール直後から7日間Proを自動付与**するリバーストライアルを採用。

結果：トライアルなしと比較して**転換率が約60%向上**。

### 価格帯は$3-5/月

ユーティリティ拡張の適正価格は$3-5/月。$10を超えると離脱が急増する。ニッチなプロ向けツール以外は$5以下に抑えるべき。

### ペイウォールは「制限に当たった瞬間」に出す

ランダムなタイミングでアップグレードモーダルを出すのは逆効果。ユーザーが「この機能を使いたいのに使えない」と感じた瞬間にペイウォールを表示すると、転換率が**3倍**になった。

[DataPick — Chrome Web Store](https://chromewebstore.google.com/detail/epoehadeccangbpjldlbkapnakndbpkf)

---

## クロスプロモーション戦略

17本の拡張があると、各拡張が他の拡張の導線になる。全18拡張にクロスプロモーションバナーを実装した。

ポイント：
- 関連性の高い拡張だけを推薦（推薦マトリクス）
- 1回のポップアップ表示で1つだけ推薦
- 「閉じる」ボタンは24時間クールダウン（永久非表示にしない）
- GA4でクリック率を計測して推薦を最適化

初週のクリック率は**3.2%**。関連性の高いペア（Procshot → DataPick）は**5.1%**まで上がった。

---

## まとめ

17本作って見えた最も重要なこと：

1. **MV3はステートレス設計が全て** — chrome.storageを正しく使えば怖くない
2. **CWS SEOはタイトルが8割** — キーワードファーストに変えるだけで成果が出る
3. **フリーミアム + リバーストライアル** — この組み合わせが最も自然に収益化できる
4. **GA4なしで意思決定はできない** — 全拡張に入れて数字で判断する
5. **量が質を生む** — 17本作ったからこそ見えるパターンがある

[S-Hub — 全拡張機能はこちら](https://dev-tools-hub.xyz/?utm_source=zenn&utm_medium=article&utm_campaign=17-lessons)

---

### 関連リンク

- [Procshot](https://chromewebstore.google.com/detail/procshot) — ブラウザ操作を自動キャプチャ
- [DataPick](https://chromewebstore.google.com/detail/epoehadeccangbpjldlbkapnakndbpkf) — Webデータ抽出
- [ReadMark](https://chromewebstore.google.com/detail/inejhohffndeacbihghjcobndpoejdfn) — 読書位置を保存
- [CookieJar](https://chromewebstore.google.com/detail/lhngfkchfepfjjdfhimconagoejemofg) — Cookie管理・プライバシー分析
