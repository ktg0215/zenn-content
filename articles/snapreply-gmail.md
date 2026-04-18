---
title: "Gmail返信を3秒で終わらせるAI Chrome拡張SnapReplyの作り方と使い方"
emoji: "⚡"
type: "tech"
topics: ["chrome拡張機能", "gmail", "typescript", "react", "productivity"]
published: true
published_at: "2026-04-15 09:00"
---

## はじめに

「承知しました。対応いたします。」「ご確認ありがとうございます。」「添付ファイルをお送りします。」

毎日のGmail対応で、こんな定型文を何度も手打ちしていませんか。メール1通あたりの返信時間は短くても、1日数十通ともなれば無視できない時間になります。

Gmailには「テンプレート」機能（旧・定型文）がありますが、挿入までの操作が多く、テンプレートを探す手間もかかります。

この課題を解決するために、Gmail上でワンクリック・テンプレート返信ができるChrome拡張機能「SnapReply for Gmail」を開発しました。

https://chromewebstore.google.com/detail/snapreply-for-gmail/pijandokkbhdejnoienhjmoicjapgpmk

## SnapReplyでできること

### ワンクリックでテンプレート挿入

メールを開いた状態でSnapReplyのパネルを開くと、登録済みのテンプレート一覧が表示されます。使いたいテンプレートをクリックするだけで、返信欄に文章が挿入されます。

Gmailの標準テンプレートと違い、**キーボードショートカット一発**でパネルを開けるため、マウス操作を最小限に抑えられます。

### テンプレートのカスタマイズ

業種・職種に応じたテンプレートを自由に追加・編集できます。

よく使うテンプレート例：
- 受領確認：「ご連絡ありがとうございます。内容を確認しました。」
- 日程調整：「ご都合のよい日時をいくつかお知らせください。」
- 完了報告：「対応が完了いたしました。ご確認ください。」
- 資料送付：「お待たせいたしました。資料を添付にてお送りします。」

### Gmailとの深い統合

SnapReplyはGmailのDOMに直接統合されているため、Gmailから別タブに移動する必要がありません。返信ウィンドウを開いたまま操作が完結します。

## 技術的なポイント：Gmail DOMとの格闘

Gmailは独特のDOM構造を持ち、React等のSPAが採用されているため、通常のCSSセレクタやDOMイベントが想定通りに動かないことがあります。

開発で特に苦労したのは以下の点です：

### 1. 動的に変化するDOM

Gmailはメール切り替え時にDOMを大幅に書き換えます。MutationObserverを使ってDOM変更を監視し、返信ウィンドウが開いたタイミングでSnapReplyのUIを注入しています。

```typescript
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      injectSnapReplyUI();
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });
```

### 2. CSPとMV3の制約

Chrome拡張機能のManifest V3ではインラインスクリプトが禁止されています。Content Scriptからのみ安全なDOM操作を行う設計が必要でした。

### 3. 返信欄への文字挿入

Gmailはcontenteditable要素に独自の処理をしているため、単純なinnerHTML操作では入力を認識してくれません。execCommandとinputイベントの組み合わせで対応しています。

## 実際の効率化効果

テンプレートを10件程度登録した状態で1週間使ってみた感想：

- 定型返信にかかる時間が平均3分 → 30秒以下に短縮
- 「何を書くか考える」時間がゼロに（テンプレートを選ぶだけ）
- タイプミスによる送り直しがなくなった

特にカスタマーサポートや社内連絡が多い方に効果を実感していただいています。

## まとめ

SnapReply for GmailはGmail上でのテンプレート返信を極限まで効率化するツールです。インストールして最初の5分でテンプレートを登録すれば、すぐに効果を実感できます。

https://chromewebstore.google.com/detail/snapreply-for-gmail/pijandokkbhdejnoienhjmoicjapgpmk

S-Hubが提供する他のChrome拡張機能はこちら：https://dev-tools-hub.xyz
