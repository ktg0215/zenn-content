---
title: "ChatGPTのプロンプトを保存・再利用する方法（毎回打ち直しをやめる）"
emoji: "📝"
type: "idea"
topics: ["chatgpt", "ai", "生産性", "chrome拡張", "個人開発"]
published: true
---
## 同じプロンプトを毎回打ち直していませんか

ChatGPT・Claude・Gemini を毎日使っていると、同じプロンプトを何度も打ち直しているはずです。「箇条書きで要約して」「このコードをレビューして」「この文章を丁寧な敬語に書き直して」——せっかく作り込んだ良いプロンプトも、チャット履歴の中に埋もれて見つからなくなります。

この記事では、プロンプトを保存して再利用する方法を2つ紹介します。手動の方法と、ワンクリックで挿入できる方法です。

## プロンプトを保存する価値

うまく機能するプロンプトは「再利用できる資産」です。毎回記憶を頼りに書き直すと、結果の質がぶれます。保存しておくと:

- **一貫性**: 同じプロンプト＝同じ品質
- **速さ**: 数行のプロンプトを打ち直さなくていい
- **共有**: チームで「実際に効くプロンプト」を使い回せる
- **改善**: ゼロから作り直さず、保存版を磨ける

## 方法1: メモアプリ（ツール不要）

Notion やメモ帳に「プロンプト」ドキュメントを作り、ラベルを付けて貼っておく方法です。使うときはドキュメントを開いて探し、コピーしてタブを切り替えて貼り付けます。数個なら十分ですが、増えるとタブ往復が面倒で、チャット欄へ直接挿入もできません。

## 方法2: PromptStash（ワンクリック挿入）

[PromptStash](https://dev-tools-hub.xyz/extensions/promptstash/?utm_source=zenn.dev&utm_medium=referral&utm_campaign=save-reuse-chatgpt-prompts-ja) は、プロンプトを保存して ChatGPT・Claude・Gemini などのチャット欄へ直接挿入できる無料の Chrome 拡張です。タブの往復が要りません。

1. インストール（無料・アカウント不要）
2. 残したいプロンプトを保存し、フォルダで整理
3. 次回はチャット欄へワンクリックで挿入
4. そのまま使うか、送信前に微調整

**無料**: プロンプト最大10件・フォルダ・変数。
**Pro（月 $5.99）**: プロンプト無制限、プロンプトチェーン、品質スコア、PII マスキング、インポート／エクスポート。

### 変数でテンプレート化する

一箇所だけ変えて同じプロンプトを使うなら、毎回書き換えず変数を使います:

```
以下の文章を {{トーン}} なトーンで、{{読者層}} 向けに書き直してください。
```

一度保存すれば、挿入時に `トーン` と `読者層` を埋めるだけ。1つのテンプレで何十通りもカバーできます。

## インストール

無料・アカウント不要・データは端末内保存。ChatGPT / Claude / Gemini / Perplexity などに対応。

→ **無料インストール:** https://dev-tools-hub.xyz/extensions/promptstash/?utm_source=zenn.dev&utm_medium=referral&utm_campaign=save-reuse-chatgpt-prompts-ja

Chrome ウェブストア: https://chromewebstore.google.com/detail/promptstash/ocgkponbnolpgobllplcamfobolbjbcj

---

*[S-Hub](https://dev-tools-hub.xyz) — ミニマルな Chrome 拡張機能を作っています。*
