---
title: "Chrome拡張のCWS審査で拒否される「Red Nickel」を避けるスクリーンショット設計ルール"
emoji: "🔍"
type: "tech"
topics: ["chrome拡張機能", "cws", "個人開発", "マーケティング"]
published: true
---

## はじめに

自分が運営するChrome拡張機能の1つが、Chrome Web Storeの審査で拒否された。理由は **Small tile (440×280) に「Free」というバッジが入っていたから**。

これはCWSが内部的に **Red Nickel** と呼んでいるプロモ表現の禁止ルールに引っかかった結果だった。18本の拡張を運営している自分はこの拒否を機に全リスティングを監査し、**9本に画像違反、14本に説明文違反**を発見した。約8割が地雷を踏んでいた。

## Red Nickelとは

CWS Developer Programポリシー (Listing requirements > Promotional content) は次のように書く。

> Listings must not include promotional language or claims about your product, including but not limited to discount notifications, "free" promotions, ratings, awards, or rankings.

要は **「無料」「最高」「人気No.1」のようなプロモ用語をリスティングに入れてはいけない** ということ。「Red Nickel」自体は内部フラグ名らしく、外部開発者向けの明示ガイドはない。

## 検出された4パターン

### 1. 画像内の「Free」テキスト (即拒否リスク最大)

Small tile (440×280) や Marquee (1400×560) のバッジ・キャプションに「Free」「Free Forever」「Free to use」が入っているパターン。これが審査拒否の直撃ポイントだった。

```html
<!-- NG -->
<span class="chip">Free</span>

<!-- OK -->
<span class="chip">Instant preview</span>
```

画像内テキストはreviewerが最も厳しく検出する箇所。機能名やUX訴求に置き換えれば9割は防げる。

### 2. 説明文 (extDescription) の「Free」「Best」

```
NG: "Find issues & export reports. Free forever."
OK: "Find issues & export reports. Unlimited scans."
```

画像より審査優先度は低く現状通過事例も多いが、方針変更で即リスク化する。次回publish前に一括修正が安全。

### 3. UI模倣の中の「Best」 (グレーゾーン)

Google FlightsなどのUIを模倣している画面に「Best departing flights」のような実在ラベルが含まれているケース。**修正コスト5分 vs 審査拒否数日のコスト**を比べると、安全側で削除が明らかに優位。

### 4. pricing table 内の「Free」 (これはOK)

```html
<div class="plan-name">Free</div>
<div class="plan-price">$0</div>
```

「Free $0」のセットで価格tier名として機能していればセーフ。freemiumモデル自体はCWSが認めていて、NotionやLinearなど多数のSaaSで同パターンが通過実績あり。

## セーフな代替案フレームワーク

| 禁止語 | 推奨代替 |
|---|---|
| Free / Free Forever | "No account" / "Instant" / "Local only" |
| Free to try / Free to use | "Start immediately" / "No sign-up" |
| Free Chrome Extension | "MV3 Chrome Extension" |
| Best | "Complete" / "Built-in" |
| 無料 | 削除 or 機能名で代替 |

**「価格属性ではなく機能属性で置き換える」** が基本。後者はCWS奨励のバリュー記述で、ユーザー訴求としても具体的で強い。

## 設計ルール5つ

1. **画像内に「Free」「Best」「無料」「最高」を入れない** — 即拒否リスク最大
2. **pricing table の "Free" は OK** — $0と並んでいる場合
3. **説明文の禁止語は次回publish前にまとめて修正**
4. **UI模倣の中の「Best」は安全側で削除** — 5分の修正で数日のロスを回避
5. **submit 前に画像・説明文・タイトルを禁止語grepで監査**

## まとめ

Red Nickelは暗黙ルールで引っかかってから初めて知るパターンが多い。**「価格属性ではなく機能属性で訴求する」** を守れば9割は防げる。

## 関連リンク

- [Chrome Web Store Developer Program Policies — Listing requirements](https://developer.chrome.com/docs/webstore/program-policies/listing-requirements)
- [S-Hub — 18本の拡張機能ポートフォリオ](https://dev-tools-hub.xyz)
