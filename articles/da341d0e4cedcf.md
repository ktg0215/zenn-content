---
title: "WXT + React + TypeScriptでSEOメタ分析Chrome拡張「OnPageX」を作った"
emoji: "🐡"
type: "idea"
topics: ["chrome拡張","seo","個人開発"]
published: true
---

[](#%E4%BD%9C%E3%81%A3%E3%81%9F%E3%82%82%E3%81%AE) 作ったもの

**OnPageX** — ワンクリックでWebページのSEO健全性を分析するChrome拡張機能。


ツールバーのアイコンをクリックすると、現在のページのメタ情報を抽出して9カテゴリのSEOスコアを色分け表示します。


🔗 **Chrome Web Store**: [OnPageX — SEO Meta Analyzer]


[https://chromewebstore.google.com/detail/onpagex-seo-meta-analyzer/bnmkiihgfmmedaikcipkihcpabjbmdcc?authuser=0&hl=ja](https://chromewebstore.google.com/detail/onpagex-seo-meta-analyzer/bnmkiihgfmmedaikcipkihcpabjbmdcc?authuser=0&hl=ja)


[](#%E3%81%AA%E3%81%9C%E4%BD%9C%E3%81%A3%E3%81%9F%E3%81%8B) なぜ作ったか

クライアントのWebページのSEO状態を確認するとき、毎回こうなっていました:


- メタタグ確認 → 拡張機能A

- 見出し構造確認 → 拡張機能B

- 構造化データ確認 → 拡張機能C


どの拡張も生データを並べるだけで、**「このページのSEOは健全なのか？」** という問いには答えてくれない。


1つのツールで全部見られて、かつ **良い/注意/要改善** をひと目で判断できるものが欲しかった。なかったので作りました。


[](#%E6%8A%80%E8%A1%93%E3%82%B9%E3%82%BF%E3%83%83%E3%82%AF) 技術スタック


項目
技術


フレームワーク
WXT（Viteベース、MV3自動生成）


UI
React + TypeScript


スタイリング
Tailwind CSS


決済
ExtensionPay（Stripe経由）


PDF生成
jsPDF + jspdf-autotable


[](#%E3%81%AA%E3%81%9Ccrxjs%E3%81%A7%E3%81%AF%E3%81%AA%E3%81%8Fwxt%E3%81%8B) なぜCRXJSではなくWXTか

2025年半ばにCRXJSがアーカイブ危機を経験（v2.3.0で復活したものの）、長期メンテナンスに不安がありました。


WXTはViteネイティブで、ファイルベースのエントリポイント管理、manifest自動生成、HMR対応。GitHub Stars 9,200+で、2026年時点では最も活発なChrome拡張フレームワークです。


[](#%E3%82%A2%E3%83%BC%E3%82%AD%E3%83%86%E3%82%AF%E3%83%81%E3%83%A3) アーキテクチャ

```
popup（React）
  ↓ chrome.scripting.executeScript
content script（DOM抽出）
  ↓ 結果を返す
popup（スコアリング + 表示）
  ↓ chrome.runtime.sendMessage
background（ExtPay初期化 / CORSプロキシ）
```

ポイントは **activeTab + scripting API** の組み合わせ。ユーザーがアイコンをクリックしたタブにだけスクリプトを注入するので、`` のような広範な権限は不要です。


[](#%E5%AE%9F%E8%A3%85%E3%81%A7%E8%A9%B0%E3%81%BE%E3%81%A3%E3%81%9F%E3%81%A8%E3%81%93%E3%82%8D) 実装で詰まったところ

[](#1.-executescript%E3%81%AE%E9%96%A2%E6%95%B0%E3%82%B7%E3%83%AA%E3%82%A2%E3%83%A9%E3%82%A4%E3%82%BA%E5%88%B6%E7%B4%84) 1. executeScriptの関数シリアライズ制約

`chrome.scripting.executeScript` の `func` に渡す関数は、Chromeが **シリアライズして別コンテキストに送る** ため、外部変数やimportへの参照が一切使えません。


```
// ❌ これは動かない
import { extractSeoData } from '../lib/extractor';

const results = await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  func: extractSeoData,  // シリアライズ時にimport先が消える
});
```

```
// ✅ 関数の中身を完全にインライン展開する
const results = await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  func: () => {
    // ここに抽出ロジックを全部書く
    const title = document.title || '';
    const metaDescEl = document.querySelector('meta[name="description"]');
    // ... 100行以上のインライン関数になる
    return { title, metaDescription, ogTags, headings, schemas, links, images };
  },
});
```

正直あまり美しくはないですが、`chrome.scripting.executeScript` のfuncを使う限りこれが最もシンプルな方法です。代替として `files` パラメータで別ファイルを注入する方法もありますが、WXTのビルドパスとの整合を取る手間が増えます。


[](#2.-%E7%AB%B6%E5%90%88%E6%AF%94%E8%BC%83%E3%81%AEcors%E5%9B%9E%E9%81%BF) 2. 競合比較のCORS回避

Pro機能の「競合URL比較」は、ユーザーが入力した外部URLのHTMLを取得してDOMパースする必要があります。Popupからの直接fetchはCORSで失敗するので、**Background Service Worker経由**で取得します。


```
// background.ts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'FETCH_URL') {
    fetch(message.url)
      .then(res => res.text())
      .then(html => sendResponse({ success: true, html }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // 非同期レスポンスを示す
  }
});
```

```
// popup側
const response = await chrome.runtime.sendMessage({
  type: 'FETCH_URL',
  url: competitorUrl,
});
const parser = new DOMParser();
const doc = parser.parseFromString(response.html, 'text/html');
// → extractFromDocument(doc, url) で抽出
```

Background Service Workerにはブラウザと同等のfetch権限があるため、CORSに引っかかりません。ただしMV3のService Workerは30秒アイドルで停止するので、大量のURLを順番にfetchするような使い方には向きません。


[](#3.-mv3-service-worker%E3%81%AE%E5%A4%89%E6%95%B0%E6%B6%88%E5%A4%B1) 3. MV3 Service Workerの変数消失

MV3のService Workerは **約5分のアイドル後に終了** します。終了後に再起動されるとトップレベルコードは再実行されますが、非同期コールバック内のクロージャ変数は `undefined` になります。


ExtensionPayを使う場合、これが問題になります:


```
// background.ts のトップレベル
const extpay = ExtPay('onpagex');
extpay.startBackground(); // ← 再起動時に再実行されるのでOK

// ❌ 長時間後に呼ばれるコールバック内
chrome.alarms.onAlarm.addListener(() => {
  extpay.getUser(); // extpayがundefinedの可能性
});

// ✅ コールバック内で再宣言
chrome.alarms.onAlarm.addListener(() => {
  const extpay = ExtPay('onpagex'); // 再宣言
  // startBackground()は呼ばない（二重呼び出しはエラー）
  extpay.getUser();
});
```

[](#4.-pdf%E6%97%A5%E6%9C%AC%E8%AA%9E%E5%AF%BE%E5%BF%9C%E3%81%AE%E3%83%90%E3%83%B3%E3%83%89%E3%83%AB%E3%82%B5%E3%82%A4%E3%82%BA%E5%95%8F%E9%A1%8C) 4. PDF日本語対応のバンドルサイズ問題

jsPDFはデフォルトで日本語フォントを含まないので、NotoSansJPをbase64エンコードして埋め込む必要があります。フルフォントは約5MB。Chrome拡張のZIPサイズに直結するので、pyftsubsetでサブセット化しました。


```
pip install fonttools brotli
pyftsubset NotoSansJP-Regular.ttf \
  --text-file=subset-chars.txt \
  --output-file=NotoSansJP-Regular-subset.ttf
```

5MB → 約1.5MBまで削減。base64化してTypeScriptファイルに書き出し、jsPDFに登録します。


```
doc.addFileToVFS('NotoSansJP-Regular.ttf', NotoSansJPBase64);
doc.addFont('NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal');
doc.setFont('NotoSansJP');
```

[](#%E3%82%B9%E3%82%B3%E3%82%A2%E3%83%AA%E3%83%B3%E3%82%B0%E3%81%AE%E8%A8%AD%E8%A8%88) スコアリングの設計

9カテゴリのスコアリングは、各項目に `good / warning / critical` の3段階を割り当てるシンプルな仕組みです。


```
// タイトル
const level = (len >= 30 && len  60) ? 'good'
            : len > 0 ? 'warning'
            : 'critical';

// H1タグ
const count = headings.filter(h => h.tag === 'H1').length;
const level = count === 1 ? 'good'
            : count === 0 ? 'critical'
            : 'warning';
```

閾値はGoogleのSEOガイドラインに基づいています（タイトル30〜60文字、ディスクリプション120〜160文字など）。Pro版ではこの閾値をユーザーがカスタマイズできます。


色分けはTailwindのユーティリティクラスで:


```
good     → text-green-500 (#10b981)
warning  → text-yellow-500 (#f59e0b)
critical → text-red-500 (#ef4444)
```

[](#%E3%83%95%E3%83%AA%E3%83%BC%E3%83%9F%E3%82%A2%E3%83%A0%E8%A8%AD%E8%A8%88) フリーミアム設計

ExtensionPay（Stripe経由）で $9.99 の買い切り課金を実装しています。


**無料で使える機能:**

9カテゴリのスコアリング、見出し構造ツリー、Schema.orgビューア、リンク分析、画像alt監査、コピー機能


**Pro機能（$9.99 一回購入）:**

SERPプレビュー、競合URL比較、PDF/CSVエクスポート、バルクチェック、分析履歴、カスタムスコアリング


ExtensionPayの実装で気をつけた点:


`getUser()` は毎回ネットワークリクエストなので、`chrome.storage.local` に5分間キャッシュ

- 買い切りモデルなので `paid: true` が一度セットされたらほぼ永久にtrue → 積極的にキャッシュ可

`onPaid` コールバックはログイン時にも発火する（初回支払い時だけではない）のでハンドラーはべき等に


[](#%E3%83%AD%E3%83%BC%E3%82%AB%E3%83%A9%E3%82%A4%E3%82%BA) ローカライズ

8言語対応（en / ja / es / pt_BR / ko / de / fr / it）。


Chrome Web Storeは **各言語を別々にインデックスする** ので、8言語対応 = CWS上で8倍の検索露出になります。翻訳コストに対するリターンが非常に大きい施策です。


WXTでは `public/_locales/{lang}/messages.json` にi18nファイルを配置するだけで、ビルド時に自動的にmanifestに反映されます。


[](#%E3%81%BE%E3%81%A8%E3%82%81) まとめ

WXT + React + TypeScriptの組み合わせはChrome拡張開発の体験がかなり良いです。特にHMRが効くのは開発効率に直結します。


MV3固有のハマりどころ（executeScriptのシリアライズ、Service Workerの寿命、content scriptの制約）は最初に理解しておくとスムーズに進みます。


フリーミアムChrome拡張の収益化にExtensionPayを使うのは、個人開発者にはかなり楽な選択肢です。Stripeに直接入金されるので、決済周りを自分で実装する必要がありません。


[https://chromewebstore.google.com/detail/onpagex-seo-meta-analyzer/bnmkiihgfmmedaikcipkihcpabjbmdcc?authuser=0&hl=ja](https://chromewebstore.google.com/detail/onpagex-seo-meta-analyzer/bnmkiihgfmmedaikcipkihcpabjbmdcc?authuser=0&hl=ja)


[](#%E4%BD%9C%E3%81%A3%E3%81%9F%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD%EF%BC%882025%E5%B9%B42%E6%9C%88%E7%8F%BE%E5%9C%A8%EF%BC%9A15%E5%80%8B%EF%BC%89) 作った拡張機能（2025年2月現在：15個）

[](#%F0%9F%8E%AF-%E7%94%9F%E7%94%A3%E6%80%A7%E3%83%84%E3%83%BC%E3%83%AB) 🎯 生産性ツール


[PromptStash](https://chromewebstore.google.com/detail/ocgkponbnolpgobllplcamfobolbjbcj) - AIプロンプトを保存・管理（19サービス対応）

[DataPick](https://chromewebstore.google.com/detail/epoehadeccangbpjldlbkapnakndbpkf) - Webページからデータを抽出

[DataBridge](https://chromewebstore.google.com/detail/databridge) - ページ間データ転送

[SnippetVault](https://chromewebstore.google.com/detail/gnnmjklohcoaiheikefoifiekcnndcdi) - コードスニペット管理

[ReadMark](https://chromewebstore.google.com/detail/inejhohffndeacbihghjcobndpoejdfn) - 読書位置を記憶


[](#%F0%9F%A7%98-%E3%83%87%E3%82%B8%E3%82%BF%E3%83%AB%E3%82%A6%E3%82%A7%E3%83%AB%E3%83%93%E3%83%BC%E3%82%A4%E3%83%B3%E3%82%B0) 🧘 デジタルウェルビーイング


[YouTube Shorts Killer](https://chromewebstore.google.com/detail/bajebpkjihldiceceompbcjgepnbhnni) - YouTubeショートを非表示

[X Detox](https://chromewebstore.google.com/detail/hlaankalmjmaefkcabjcfagnkfhlkpce) - X(Twitter)のノイズを消す

[ZenRead](https://chromewebstore.google.com/detail/adoiakplckmoahmiainobfpmdomnhomj) - 集中読書モード


[](#%F0%9F%9B%92-ec%E3%83%BB%E3%81%9B%E3%81%A9%E3%82%8A) 🛒 EC・せどり


[楽天セラーズ・アナリティクス](https://chromewebstore.google.com/detail/dlldcmoekdpakieophgmngnalkiljndc) - 楽天市場の出品者分析

[Arbitra](https://chromewebstore.google.com/detail/bincnlodgkpmmihbdoknndbncjfghpcj) - 価格比較ツール


[](#%F0%9F%94%A7-web%E4%BE%BF%E5%88%A9%E3%83%84%E3%83%BC%E3%83%AB) 🔧 Web便利ツール


[Japanese Font Finder](https://chromewebstore.google.com/detail/ageolfjmheacenbkgiahlkhkogcnocip) - Webサイトの日本語フォントを特定

[TVerPlus](https://chromewebstore.google.com/detail/ddhjonpmonmjgohicdipicodpmndnjll) - TVerの視聴体験を改善

[Yahoo快適](https://chromewebstore.google.com/detail/oeinpjbbingpakilcejimbibfcbbfkkg) - Yahoo!の閲覧体験改善


[](#%F0%9F%8F%A0-%E4%B8%8D%E5%8B%95%E7%94%A3) 🏠 不動産


[物件賃貸分析](https://chromewebstore.google.com/detail/hnfccaipmcmbolhpdklolimlnjloknld) - 賃貸物件の分析

[物件購入分析](https://chromewebstore.google.com/detail/ioboepegcabodocflleblblnknlfpjka) - 購入物件の分析


すべての拡張機能の詳細 → [S-Hub](https://dev-tools-hub.xyz)