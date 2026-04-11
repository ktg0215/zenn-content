---
title: "第6章 — コンテンツスクリプト設計：DOM操作・通信・SPA対応の実践パターン"
---

> 第5章でGA4の計測基盤を整えました。この章ではWebページと直接対話するコンテンツスクリプトの設計を解説します。MutationObserverによるSPA対応、backgroundとの通信パターン、Shadow DOMによるUI隔離——DataPickとReadMarkの実装を例に、実戦で使えるパターンを示します。

---

## コンテンツスクリプトの役割と制約

コンテンツスクリプト（CS）はWebページのDOMに注入されるJavaScriptです。ページのHTMLを読み書きできる唯一のコンテキストです。

### Isolated World vs Main World

CSはデフォルトで**Isolated World**で動作します。ページのJavaScriptとは別の実行環境であり、ページのグローバル変数（`window.React`等）にはアクセスできません。

```
Isolated World（コンテンツスクリプト）
  ├─ chrome.* API にアクセス可能
  ├─ DOMは共有（document.querySelector等は使える）
  └─ window オブジェクトは別インスタンス

Main World（ページのJS）
  ├─ chrome.* API にアクセス不可
  ├─ window.React, window.__store__ 等にアクセス可能
  └─ DOMは共有
```

`manifest.json` で `"world": "MAIN"` を指定するとMain Worldで動作しますが、`chrome.*` APIが使えなくなります。ページのグローバル変数に触れる必要がある場合のみ使用します。

---

## 注入戦略

### 静的注入 vs プログラマティック注入

```json
// manifest.json — 静的注入（全URLに常時注入）
{
  "content_scripts": [
    {
      "matches": ["https://example.com/*"],
      "exclude_matches": ["https://example.com/admin/*"],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_idle"
    }
  ]
}
```

```typescript
// background.ts — プログラマティック注入（ユーザー操作時のみ）
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js'],
  });
});
```

| | 静的注入 | プログラマティック |
|---|--------|----------------|
| 注入タイミング | ページ読み込み時に自動 | 任意のタイミング |
| パーミッション | `matches` に一致するURLに自動適用 | `scripting` + `activeTab` |
| 向いているケース | 常時動作するツール（ReadMark等） | ユーザーが明示的に起動する（DataPick等） |

**run_at の使い分け:**
- `document_start`: DOMが構築される前。ページスクリプトより先に実行したい場合
- `document_end`: DOMが構築された後、サブリソース読み込み前（`DOMContentLoaded`相当）
- `document_idle`: すべてのリソース読み込み完了後（デフォルト、最も安全）

---

## DOM操作とMutationObserver（SPA対応）

Reactで作られたSPAはページ遷移をDOM操作で行います。`document_idle` で一度だけCSを実行しても、その後のURL変化に追従できません。

```typescript
// content.ts — MutationObserver + throttle で SPA対応

function handlePageChange(url: string): void {
  // URLが変わるたびに実行される処理
  console.log('[CS] Page changed:', url);
  initializeForCurrentPage();
}

// MutationObserver で body の変化を監視
// （SPAはbody子要素を差し替えてルーティングする）
let lastUrl = location.href;

const observer = new MutationObserver(
  throttle(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      handlePageChange(location.href);
    }
  }, 300)
);

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// throttle実装（requestIdleCallbackを使ってメインスレッドを圧迫しない）
function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limitMs: number
): T {
  let lastCalled = 0;
  return ((...args: unknown[]) => {
    const now = Date.now();
    if (now - lastCalled >= limitMs) {
      lastCalled = now;
      requestIdleCallback(() => fn(...args));
    }
  }) as T;
}
```

`requestIdleCallback` を使うことで、ブラウザがアイドル状態のときだけMutationObserverのコールバックを処理します。スクロールや入力中のLong Taskを回避できます。

---

## backgroundとの通信パターン

### 単発リクエスト/レスポンス

```typescript
// content.ts → background.ts への型安全な通信

type Message =
  | { type: 'GET_STATUS' }
  | { type: 'SAVE_POSITION'; url: string; scrollY: number }
  | { type: 'EXTRACT_DATA'; selector: string };

type MessageResponse<T extends Message['type']> =
  T extends 'GET_STATUS' ? { isPro: boolean; usageCount: number }
  : T extends 'SAVE_POSITION' ? { success: boolean }
  : T extends 'EXTRACT_DATA' ? { data: string[] }
  : never;

// 型安全なsendMessage
async function sendToBackground<T extends Message>(
  message: T
): Promise<MessageResponse<T['type']>> {
  return chrome.runtime.sendMessage(message);
}

// 使用例（content.ts）
const status = await sendToBackground({ type: 'GET_STATUS' });
// status.isPro は boolean として型推論される

await sendToBackground({
  type: 'SAVE_POSITION',
  url: location.href,
  scrollY: window.scrollY,
});
```

### 長時間処理はPortで

単発のsendMessageは約5分でタイムアウトします。OCRや大量データ処理など長時間かかる場理は `chrome.runtime.connect` でポート接続します。

```typescript
// content.ts — Port接続でストリーミング通信
const port = chrome.runtime.connect({ name: 'data-extraction' });

port.onMessage.addListener((message) => {
  if (message.type === 'PROGRESS') {
    updateProgressBar(message.percent);
  } else if (message.type === 'COMPLETE') {
    showResult(message.data);
    port.disconnect();
  }
});

port.postMessage({ type: 'START', selector: '.data-table tr' });
```

---

## ページスクリプトとの接続

Isolated WorldのCSからMain Worldのページ変数にアクセスする必要がある場合、`CustomEvent` でブリッジします。

```typescript
// content.ts（Isolated World）→ ページへのブリッジ

// Isolated World → Main World
function sendToPage(type: string, data: unknown): void {
  document.dispatchEvent(
    new CustomEvent('__EXTENSION_REQUEST__', {
      detail: { type, data, source: 'extension' },
    })
  );
}

// Main World → Isolated World
document.addEventListener('__PAGE_RESPONSE__', (event) => {
  const customEvent = event as CustomEvent;
  // 信頼境界チェック: extensionからのイベントだけ受け入れる
  if (customEvent.detail?.source !== 'page') return;
  handlePageResponse(customEvent.detail);
});

// 例: Reactのstoreからデータを取得
sendToPage('GET_REDUX_STATE', { key: 'user' });
```

**注意**: `CustomEvent` のdetailに入る値はシリアライズされます。関数やDOM参照は渡せません。また、ページスクリプトと拡張CSは同じdocumentイベントを受け取れるため、イベント名の衝突を避けるためにプレフィックスを付けてください。

---

## Shadow DOMでUIを隔離する

CSで拡張のUIをページに挿入する場合、ページのCSSが自分のUIを崩すことがあります。Shadow DOMで完全に隔離します。

```typescript
// content.ts — Shadow DOM + スタイル注入でUIを隔離

function createIsolatedUI(): ShadowRoot {
  const host = document.createElement('div');
  host.id = 'my-extension-host';
  // ページのflexboxやgridに影響されないようにstyle設定
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647;';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  // スタイルをShadow DOM内に注入（ページのCSSは入ってこない）
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .panel {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: white;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    }
  `;
  shadow.appendChild(style);

  return shadow;
}

// ReactをShadow DOM内にレンダリング（React 18+）
import { createRoot } from 'react-dom/client';

const shadow = createIsolatedUI();
const container = document.createElement('div');
shadow.appendChild(container);
createRoot(container).render(<MyPanel />);
```

`mode: 'closed'` にするとページのJSから `shadowRoot` プロパティにアクセスできなくなります。

---

## アンロード時のクリーンアップ

CSはページが閉じられるまで動き続けます。MutationObserverやイベントリスナーを適切に解除しないとメモリリークになります。

```typescript
// content.ts — クリーンアップの統合管理

const cleanups: Array<() => void> = [];

// MutationObserverの登録と解除登録
const observer = new MutationObserver(handleMutation);
observer.observe(document.body, { childList: true, subtree: true });
cleanups.push(() => observer.disconnect());

// スクロールイベントの登録と解除登録
const handleScroll = throttle(saveScrollPosition, 500);
window.addEventListener('scroll', handleScroll, { passive: true });
cleanups.push(() => window.removeEventListener('scroll', handleScroll));

// ページアンロード時にすべてをクリーンアップ
window.addEventListener('beforeunload', () => {
  cleanups.forEach((fn) => fn());
});

// chrome.runtime 切断時（拡張がリロードされた時）もクリーンアップ
chrome.runtime.connect().onDisconnect.addListener(() => {
  cleanups.forEach((fn) => fn());
});
```

`chrome.runtime.connect()` で作成したポートが切断されると `onDisconnect` が発火します。拡張がアップデートされた際のCSの孤立（extension context invalidated）対策として有効です。

---

:::message
**この章で学んだこと**

- コンテンツスクリプトはIsolated Worldで動作。chrome.*APIは使えるがページのwindow変数にはアクセスできない。Main Worldが必要な場合のみ `"world": "MAIN"` を使う
- SPA対応にはMutationObserver + throttle + requestIdleCallbackの組み合わせが有効。URL変化を監視してページ遷移に追従する
- backgroundとの通信は短時間処理ならsendMessage（return trueで非同期対応）、長時間処理はPort（connect）で接続する
- 自分のUIをページCSSから守るにはShadow DOM（mode: 'closed'）を使い、スタイルをShadow内に注入する
- MutationObserver・イベントリスナーはcleanups配列で管理し、beforeunloadとruntime切断で一括解除してメモリリークを防ぐ
:::

---

コンテンツスクリプトの設計パターンを習得しました。次の章では、MV3で追加された新APIを活用します——サイドパネルとオフスクリーンドキュメントを使って、ポップアップでは実現できない「常駐UI」と「バックグラウンドDOM処理」を実装します。

**→ [第7章：サイドパネル・オフスクリーン](./sidepanel-offscreen.md)**
