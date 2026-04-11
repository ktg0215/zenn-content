---
title: "第5章 — 実例①：読書・閲覧補助ツールを作る"
---

第4章で「動くChrome拡張」を1本作りました。次は「ユーザーの日常的なブラウジング体験を改善する」タイプの拡張です。人は毎日何時間もブラウザで記事を読んでいます。その体験に小さなストレスがある——それが最も確実なプロダクトの種です。この章では私が公開しているReadMarkとZenReadの実装から、コンテンツスクリプト・chrome.storage・UIオーバーレイという3つのパターンを学びます。

---

※ この章は以下の記事を再編・加筆したものです。
- [長い記事の「どこまで読んだっけ？」を解決するChrome拡張を作った](https://zenn.dev/ktg/articles/632b7c10489e9b)
- [Chromeにリーダーモードがないなら作ればいい ── ZenReadというChrome拡張を作った話](https://zenn.dev/ktg/articles/c79536ed17894b)

---

## 読書補助拡張が個人開発に向いている理由

読書・閲覧補助系の拡張が個人開発に向いている理由は3つあります。

1. **毎日使われる** — インストールされっぱなしになりやすく、アクティブ率が高い
2. **差別化しやすい** — 対象サイト（Zenn/Qiitaなど）を絞るだけでニッチになれる
3. **バックエンド不要** — ページのDOMをいじるだけなので、サーバーコストゼロ

## 事例①：ReadMark — 読書位置を記憶する

### 解決した課題

長い技術記事やドキュメントを途中まで読んで閉じると、次に開いたとき「どこまで読んだっけ？」が分からなくなる。ページ内でブックマークできれば便利なのに、スクロール位置を保存する拡張がなかった。

### 技術構成

```
TypeScript + React（Vite + CRXJS）
chrome.storage.local（データ保存）
Content Script（スクロール監視）
```

### 実装の核心：コンテンツスクリプトでスクロール位置を記録

```typescript
// entrypoints/content.ts
// スクロール位置を500msごとにストレージに保存
window.addEventListener('scroll', debounce(() => {
  const scrollY = window.scrollY;
  const url = window.location.href;
  chrome.storage.local.set({ [url]: scrollY });
}, 500));

// ページ読み込み時に保存した位置を復元
window.addEventListener('load', async () => {
  const url = window.location.href;
  const result = await chrome.storage.local.get(url);
  if (result[url]) {
    window.scrollTo({ top: result[url], behavior: 'smooth' });
  }
});

// debounce: 連続イベントを間引く
function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
```

### 設計のポイント

- **URLをキーにする** — `chrome.storage.local.set({ [url]: scrollY })` で複数ページを管理
- **debounce** — スクロールイベントは1秒間に数十回発生するため、500msの間引きが必須
- **behavior: 'smooth'** — ユーザーが気づかないうちに自然に戻れるように

### AIへの指示例

```
Chrome拡張（Manifest V3、TypeScript + Vite + CRXJS）を作ってください。

【機能】
コンテンツスクリプトが現在のページのスクロール位置を監視し、
500msのdebounceでchrome.storage.localに {url: scrollY} 形式で保存する。
同じURLを再訪問したとき、保存された位置にスムーズスクロールで復元する。

【ファイル】
- src/content.ts（コンテンツスクリプト）
- src/popup/App.tsx（手動で現在位置を保存するボタン）
```

### 実際の拡張機能

[ReadMark — Chrome Web Store](https://chromewebstore.google.com/detail/inejhohffndeacbihghjcobndpoejdfn)（インストール数6,200+）

---

## 事例②：ZenRead — リーダーモードを作る

### 解決した課題

ChromeにはSafariのような「リーダーモード」がデフォルトで存在しない。広告や余計なナビゲーションが多いサイトで、記事本文だけを読めるようにしたかった。Mozillaのオープンソース技術（Readability.js）を使えば実現できると気づき、開発した。

### 技術構成

```
TypeScript + React（Vite + esbuild）
@mozilla/readability（記事本文抽出）
DOMPurify（XSS対策）
Web Speech API（テキスト読み上げ、Pro機能）
ExtPay（課金）
```

### 実装の核心：Readability.jsで本文を抽出

```typescript
// src/content.ts
import { Readability } from '@mozilla/readability';
import DOMPurify from 'dompurify';

function extractArticle() {
  // DOMを複製してから解析（Readabilityは元DOMを変更するため）
  const documentClone = document.cloneNode(true) as Document;
  const reader = new Readability(documentClone, {
    charThreshold: 500,
    keepClasses: false,
  });
  const article = reader.parse();

  if (!article) return;

  // XSSを除去してからレンダリング
  const cleanHtml = DOMPurify.sanitize(article.content, {
    FORBID_TAGS: ['script', 'style', 'iframe', 'form'],
    FORBID_ATTR: ['onerror', 'onclick'],
  });

  displayReaderView(cleanHtml, article.title);
}
```

### サイト固有ルールで抽出精度を上げる

汎用ライブラリだけでは抽出が崩れるサイトに、カスタムルールを追加できます。

```typescript
// src/content.ts
const SITE_RULES: Record<string, { contentSelector: string; preRemove: string[] }> = {
  'qiita.com': {
    contentSelector: '.it-MdContent',
    preRemove: ['.it-Footer', '.it-Sidebar'],
  },
  'zenn.dev': {
    contentSelector: '.znc',
    preRemove: ['.Sidebar', '.ArticleFooter'],
  },
};
```

### テキスト読み上げ（Web Speech API）

```typescript
// src/popup/tts.ts
// Chromeの14秒バグ対策: 10秒ごとにpause→resumeを繰り返す
let keepAliveInterval: ReturnType<typeof setInterval>;

function startTTS(text: string) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 1.2;

  keepAliveInterval = setInterval(() => {
    window.speechSynthesis.pause();
    window.speechSynthesis.resume();
  }, 10000);

  window.speechSynthesis.speak(utterance);
}
```

### 実際の拡張機能

[ZenRead — Chrome Web Store](https://chromewebstore.google.com/detail/adoiakplckmoahmiainobfpmdomnhomj)

---

## コンテンツスクリプトの使いどころ一覧

| ユースケース | 実装方法 |
|------------|---------|
| スクロール位置の記録 | `scroll`イベント + `chrome.storage.local` |
| ページのDOM書き換え | コンテンツスクリプトでquerySelectorAll + 操作 |
| 本文の抽出 | Readability.js + DOMPurify |
| ページ上にUIを表示 | Reactを`createRoot`でマウント、z-indexを最大値に |
| テキスト読み上げ | Web Speech API + Chrome 14秒バグ対策 |

---

:::message
**この章で学んだこと**

- コンテンツスクリプトはページのDOMに直接アクセスできる唯一の場所
- `chrome.storage.local`でURLをキーにしてページ別データを管理できる
- debounceでスクロールイベントを間引くことでストレージ書き込みを最適化
- Readability.jsを使えばリーダーモードが実装できる
- DOMPurifyでXSS対策（外部ライブラリ導入で数行で対応可能）
:::

---

次の章ではデータ抽出系の拡張を見ていきます。「閲覧補助」から一歩進んで、Webページのデータを取り出してスプレッドシートに書き出す——ビジネスユーザーが求める価値の高い拡張機能の設計パターンです。

**→ [第6章：実例②データ抽出・自動化ツール](./data-tools.md)**
