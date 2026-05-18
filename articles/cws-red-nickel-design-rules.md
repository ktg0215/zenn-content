---
title: "Chrome拡張のCWS審査で拒否される「Red Nickel」を避けるスクリーンショット設計ルール"
emoji: "🔍"
type: "tech"
topics: ["chrome拡張機能", "cws", "個人開発", "マーケティング"]
published: false
---

## はじめに

先日、自分が運営するChrome拡張機能の1つが、Chrome Web Storeの審査で拒否された。理由は **Small tile (440×280) に「Free」というバッジが入っていたから**。

機能上は何の問題もない。ポリシー違反のような大きな話でもない。ただ「Free」という4文字が画像に入っているという、それだけだ。

これはCWSが内部的に **Red Nickel** と呼んでいる、プロモーション・ランキング情報の模倣禁止ポリシーに引っかかった結果だった。自分は18本のChrome拡張機能を運営していて、今回の拒否をきっかけに全拡張のスクリーンショット・説明文を監査した。**9本に画像違反、14本に説明文違反**が見つかった。割合にして約8割。業界標準でやっていたコピーが、実は地雷だった。

この記事では、自分が学んだ「Red Nickelに引っかからない設計ルール」をコード例つきで共有する。

## Red Nickelとは

CWS Developer Programポリシー (Listing requirements > Promotional content) には次のように書かれている。

> Listings must not include promotional language or claims about your product, including but not limited to discount notifications, "free" promotions, ratings, awards, or rankings.

要は **「無料」「最高」「人気No.1」みたいなプロモ用語を、拡張のリスティング (タイトル / 説明 / 画像) に入れてはいけない** ということ。

「Red Nickel」は内部的なフラグ名らしく、reviewer向けのチェックリストには存在するが、外部開発者向けの明示的なガイドはない。だから「審査で拒否されてから初めて知る」のが大半だ。自分もそうだった。

## 検出された4パターン

監査でぶつかったのは以下の4パターン。リスクの高い順に並べる。

### 1. 画像内の「Free」テキスト (即拒否リスク最大)

Small tile (440×280) や Marquee (1400×560) のバッジ・キャプションに「Free」「Free Forever」「Free to use」が入っているパターン。これが審査拒否の直撃ポイントだった。

```html
<!-- NG (拒否された) -->
<span class="chip">Free</span>
<p class="sub">Free to use on Google Flights. Upgrade for the full picture.</p>

<!-- OK (修正後) -->
<span class="chip">Instant preview</span>
<p class="sub">Visa status on every flight. Auto-detects on Google Flights — Pro adds Booking & Skyscanner.</p>
```

画像内テキストはreviewerが**最も厳しく自動検出する箇所**。「Free」「無料」「Best」「最高」が入っていたら、機能名や具体的なUX訴求に置き換える。これだけで9割は防げる。

### 2. 説明文 (extDescription) の「Free」「Best」

```
NG: "Get SEO scores, find issues & export reports. Free forever."
OK: "Get SEO scores, find issues & export reports. Unlimited scans."

NG: "Best viewing toolkit for streaming."
OK: "Complete viewing toolkit for streaming."
```

画像より審査優先度は低く、現状通過事例も多い。ただしCWSが方針を変えれば即リスクになるので、次回のpublishタイミングで一括修正するのが安全。

### 3. UI模倣の中の「Best」 (グレーゾーン)

Google FlightsなどのリアルなサービスUIを模倣しているとき、画面内に「Best departing flights」のような実在ラベルが含まれているケース。

```html
<!-- グレー (UIモック文脈で6-7割は通る) -->
<div class="flights-header">Best departing flights · JPN passport</div>

<!-- 安全側 -->
<div class="flights-header">Departing flights · JPN passport</div>
```

reviewerが文脈で「これはUIモックの再現だな」と読んでくれる可能性は60-70%、自動検出で引っかかる可能性が30-40%。**修正コスト5分 vs 審査拒否数日のコスト** を比べたら、修正圧倒的優位だった。

### 4. pricing table 内の「Free」 (これはOK)

```html
<div class="plan-name">Free</div>
<div class="plan-price">$0</div>
<!-- ↑ "Free $0" のセットなら通過する -->
```

これは業界標準の表記で、freemiumモデル自体はCWSが認めている。「Free $0」のセットで「価格tierの名前」として機能していれば、画像内に入っていてもセーフ。NotionやLinearなど多数のSaaSで同パターンが通過している。

完全に安全を取るなら「Basic」「Lite」「Starter」に変更する手もあるが、必須ではない。

## セーフな代替案のフレームワーク

監査の結果、置換ルールはほぼ次の表でカバーできた。

| 禁止語 | 推奨代替 |
|---|---|
| Free / Free Forever | "No account" / "Instant" / "Local only" / 削除 |
| Free to try / Free to use | "Start immediately" / "No sign-up" |
| Free Chrome Extension | "MV3 Chrome Extension" / 削除 |
| Best | "Complete" / "Built-in" / 削除 |
| 無料 | 削除 or 機能名で代替 |

ポイントは **「価格属性 (free / best) ではなく機能属性 (instant / local / no account) で置き換える」** こと。後者はCWSが奨励する具体的なバリュー記述で、Red Nickelの対象外になる。同時にユーザーへの価値訴求としてもこちらのほうが具体的で強い。一石二鳥だ。

## グレーケース: 「distraction-free reading」

監査のなかで判定が分かれたのが「distraction-free reading」のような **セマンティック用法**。

「distraction-free」は「気が散らない (邪魔されない)」という形容詞句の慣用表現で、価格の話ではない。ZenRead / ReadingModeなど読み物系拡張で多用されているが、現状CWSは通過させている。

判断基準: **「Free」が単体で価格を指しているか、複合語の一部として機能を指しているか**。後者ならセーフと考えていい。

## 設計ルール5つ

最後にチェックリストとして。

1. **画像内に「Free」「Best」「無料」「最高」を入れない** (即拒否リスク最大)
2. **pricing table の "Free" は OK** ($0と並んでいる場合)
3. **説明文の禁止語は次回publish前にまとめて修正** (画像より優先度低だが順次対応)
4. **UI模倣の中の「Best」は安全側で削除** (5分の修正コストで数日のロスを回避)
5. **新規拡張は submit 前に画像・説明文・タイトルを禁止語grepで監査**

自分は社内の voice-brief というドキュメントにこのチェックリストを組み込んで、記事・コピー作成のたびに自己チェックを走らせている。同じ罠を踏まない仕組みのほうが、毎回気をつけるよりはるかにコスパがいい。

## まとめ

Red Nickelはドキュメント化されていない暗黙ルールで、引っかかってから初めて知るパターンが多い。**「価格属性ではなく機能属性で訴求する」** が基本方針で、これ1つ守れば9割は防げる。

自分のように複数拡張を運営している人は、一度全リスティングを禁止語grepでスキャンすることをおすすめする。新規拡張のpublish前にやらないと、3-5日の審査ロスを毎回繰り返すことになる。

## 関連リンク

- [Chrome Web Store Developer Program Policies — Listing requirements](https://developer.chrome.com/docs/webstore/program-policies/listing-requirements)
- [S-Hub — 18本の拡張機能ポートフォリオ](https://dev-tools-hub.xyz)
