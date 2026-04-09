---
title: "Chromeにリーダーモードがないなら作ればいい ── ZenReadというChrome拡張を作った話"
emoji: "📖"
type: "tech"
topics: ["chrome拡張機能", "react", "typescript", "readability", "webspeechapi"]
published: true
published_at: "2026-04-17 09:00"
---

## はじめに

技術記事やニュースをブラウザで読んでいるとき、本文に集中できないことはないでしょうか。

サイドバーの広告、ナビゲーションメニュー、関連記事のレコメンド、SNSシェアボタン。読みたいのは本文だけなのに、視界にはノイズが多すぎます。

SafariやFirefoxにはネイティブのリーダーモードが搭載されています。しかし、世界シェアトップのChromeには、長い間ネイティブで安定したリーダーモードが提供されていません。`chrome://flags` で実験的機能として触れることはできますが、常用するには不安定です。

ないなら作ろう。そう考えてChrome拡張機能「ZenRead」を開発しました。

https://chromewebstore.google.com/detail/zenread/adoiakplckmoahmiainobfpmdomnhomj

## ZenReadの機能

### リーダーモード（無料）

コア機能です。任意のWebページでアイコンをクリック、またはショートカットキーを押すと、ページ全体が本文だけのクリーンな表示に切り替わります。

テキスト抽出には **Mozilla Readability.js** を採用しています。Firefoxのリーダーモードと同じライブラリなので、主要なニュースサイト・技術ブログ・Medium記事などで安定して動作します。

### バイオニックテキスト（無料）

各単語の最初の数文字を**太字**で表示する「バイオニック・リーディング」技術を実装しています。

**こ**れにより **眼** が **自然** に **単語** を **追いやすく** なり、**読** み **速度** が **向上** する と **言われて** います。

慣れてくると、英語記事を読む速度が体感で20〜30%ほど上がります。

### テキスト読み上げ（TTS）

Web Speech APIを使ったテキスト読み上げ機能です。再生速度・声の種類を選択でき、通勤中に「聴く読書」として活用できます。

### フォントとテーマのカスタマイズ（Pro）

- フォントサイズ・行間の細かい調整
- ライト / ダーク / セピアテーマ
- お気に入りフォントの選択

## 技術的な実装詳細

### Readability.jsの組み込み

```typescript
import { Readability } from '@mozilla/readability';

const documentClone = document.cloneNode(true) as Document;
const article = new Readability(documentClone).parse();

if (article) {
  renderReaderMode(article.content, article.title);
}
```

重要なのは `document.cloneNode(true)` でDOMを複製してからReadabilityに渡すことです。Readabilityはパース中にDOMを破壊するため、元のDOMを保護する必要があります。

### バイオニックテキストの実装

```typescript
function bionic(text: string): string {
  return text.split(' ').map(word => {
    const boldLen = Math.ceil(word.length / 2);
    return `<b>${word.slice(0, boldLen)}</b>${word.slice(boldLen)}`;
  }).join(' ');
}
```

単語の前半を`<b>`タグで囲むシンプルな実装ですが、日本語・英語混在テキストへの対応に細かい調整が必要でした。

### MV3でのContent Script設計

Chrome拡張機能のManifest V3では、長時間動作するバックグラウンドスクリプトが制限されています。リーダーモードのUIはContent Scriptとして実装し、Shadow DOMを使ってページのCSSと完全に分離しています。

```typescript
const shadow = document.createElement('div').attachShadow({ mode: 'closed' });
// shadow内にリーダーモードのUIを描画
```

Shadow DOMを使うことで、どんなサイトでもZenReadのUIが正しく表示されます。

## 使い方

1. ZenReadをインストール
2. 読みたい記事を開く
3. アドレスバー右のZenReadアイコンをクリック（または `Alt+Z`）
4. クリーンなリーダービューに切り替わります
5. 右サイドバーでバイオニックテキスト・TTSのON/OFFを切り替え

## まとめ

ZenReadは「Chromeにリーダーモードが欲しい」という純粋な動機から生まれたツールです。技術的にはReadability.js・Web Speech API・Shadow DOMの組み合わせで、シンプルかつ堅牢な実装を実現しています。

日々の情報収集・学習に活用していただければ幸いです。

https://chromewebstore.google.com/detail/zenread/adoiakplckmoahmiainobfpmdomnhomj

S-Hubが提供する他のChrome拡張機能はこちら：https://dev-tools-hub.xyz
