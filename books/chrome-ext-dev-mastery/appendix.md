---
title: "付録 — Gotchas 17選・共通ユーティリティ関数集"
---

> 18本の拡張を作って繰り返しハマったパターンと、すべての拡張で使い回せる共通ユーティリティ関数集です。デバッグの出発点として、コピペベースとして活用してください。

---

## Part 1: Gotchas 17選

### Service Worker 系

**① `return true` を忘れて非同期レスポンスが届かない**

```typescript
// ❌ 非同期処理なのに return true がない
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  fetchData().then((data) => sendResponse(data)); // タイムアウト
});

// ✅ 非同期の場合は必ず return true
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  fetchData().then((data) => sendResponse(data));
  return true; // ← これがないとポートが閉じる
});
```

**② `setInterval` が動かない**

Service Workerは30秒でスリープします。`setInterval` は停止時に消えます。定期処理は `chrome.alarms` で代替します。

```typescript
// ❌
setInterval(() => syncData(), 60_000); // SW停止で消える

// ✅
chrome.alarms.create('sync', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sync') syncData();
});
```

**③ Service Worker起動直後の `chrome.storage` 読み取りタイミング**

`onInstalled` は `onStartup` より先に発火しません。インストール直後の初期データ書き込みは `onInstalled` で確実に行います。

---

**④ Port接続が切れて "Extension context invalidated" エラー**

拡張がリロード・アップデートされると、既存のコンテンツスクリプトのポートが無効になります。

```typescript
// content.ts — 接続切れに備えたエラーハンドリング
function connectToBackground() {
  const port = chrome.runtime.connect({ name: 'cs-session' });

  port.onDisconnect.addListener(() => {
    if (chrome.runtime.lastError) {
      console.warn('[CS] Extension reloaded, reinitializing...');
      // ページリロードを促すか、再接続を試みる
    }
  });

  return port;
}
```

---

### Storage 系

**⑤ `chrome.storage.sync` の容量制限超過**

syncは1アイテム最大8KB、全体100KB。大きなオブジェクトはlocalに保存します。

```typescript
// QuotaExceeded エラーを事前にチェック
const data = JSON.stringify(largeObject);
const byteSize = new TextEncoder().encode(data).length;
if (byteSize > 8000) {
  await chrome.storage.local.set({ largeData: largeObject }); // localへ
} else {
  await chrome.storage.sync.set({ largeData: largeObject });
}
```

**⑥ `chrome.storage.session` がService Worker停止で消える**

sessionはSW生存中のみ有効です。SWが停止→再起動すると消えます。「セッション中に1回だけ」な用途（ペイウォール表示フラグ等）に限定します。再起動後も必要なデータはlocalに保存します。

**⑦ async/await でawaitを忘れてPromiseを受け取る**

```typescript
// ❌ awaitなし → count は Promise<...>
const { count } = chrome.storage.local.get('usageCount');

// ✅
const { count } = await chrome.storage.local.get('usageCount');
```

---

### Content Script 系

**⑧ `document_start` で `document.body` が null**

`document_start` はDOMが構築される前に実行されます。`document.body` は存在しません。

```typescript
// ❌ document_start ではbodyがnull
document.body.appendChild(myEl); // TypeError: Cannot read properties of null

// ✅ document_end または document_idle を使う
// or: DOMContentLoaded を待つ
document.addEventListener('DOMContentLoaded', () => {
  document.body.appendChild(myEl);
});
```

**⑨ iframe内でのContent Script動作**

`all_frames: true` を指定しないとiframe内では動きません。逆に指定するとすべてのiframeに注入されます。`match_origin_as_fallback: true` で同一オリジンiframeのみに限定できます。

**⑩ CSPエラーでインラインスタイル/スクリプトが動かない**

ページのCSPポリシーはコンテンツスクリプトにも適用されます。インラインスクリプト実行や `eval()` はブロックされます。Shadow DOMの中のスタイルはページのCSSには影響を受けませんが、実行コンテキストのCSPは共有されます。

---

### 型・ビルド 系

**⑪ `@types/chrome` バージョンと実APIのずれ**

`@types/chrome` はChrome本体より更新が遅れることがあります。`chrome.sidePanel` 等の新APIは型定義が追いついていない場合があります。

```typescript
// 型定義が追いついていない場合は型アサーションで対応
const sidePanel = (chrome as unknown as {
  sidePanel: {
    setPanelBehavior: (options: { openPanelOnActionClick: boolean }) => Promise<void>;
  };
}).sidePanel;
```

**⑫ ESMとCJSの混在でビルドエラー**

WXTはESM前提ですが、`require()` を使うnpmパッケージとの混在で問題が起きることがあります。`vite.config.ts` の `build.rollupOptions.external` で除外するか、ESM版のみを使うパッケージに差し替えます。

**⑬ `eval()` がバンドル後に混入する**

一部のライブラリ（古いpolyfillなど）が内部で `eval()` を使っています。MV3のCSPで即ブロックされます。`vite-plugin-checker` や `wxt build` 後の `grep -r "eval("` で確認します。

---

### CWS審査 系

**⑭ 未使用パーミッションでリジェクト**

`manifest.json` に書いたが実際には使っていない権限があると審査でリジェクトされます。リリース前に全パーミッションが実際に使われているか確認します。

**⑮ キーワードスタッフィングでリジェクト**

説明文に「最高のツール 最強の拡張 最速の処理」のようなキーワードを詰め込むとリジェクトされます。自然な文体で機能を説明します。

**⑯ プライバシーポリシーURLが404でリジェクト**

Privacy Policy URLを登録したのに、ページが存在しない・リンク切れの場合はリジェクトされます。公開前にURLへのアクセスを確認します。

---

### その他

**⑰ `chrome.runtime.id` が undefined になる（Extension context invalidated）**

拡張がリロード・アップデートされた後、コンテンツスクリプトが生き残っている状態で `chrome.runtime.id` にアクセスすると undefined になります。このエラーが出たらページのリロードをユーザーに促すUIを表示します。

```typescript
// content.ts — invalidated 検知
function isExtensionValid(): boolean {
  try {
    return !!chrome.runtime.id;
  } catch {
    return false;
  }
}

// 各操作前にチェック
if (!isExtensionValid()) {
  showReloadPrompt(); // 「ページを更新してください」
  return;
}
```

---

## Part 2: 共通ユーティリティ関数集

S-Hubの全拡張で使い回しているユーティリティ関数です。コピーしてそのまま使えます。

### debounce / throttle

```typescript
// src/lib/utils.ts — debounce & throttle

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  };
}

export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let lastCalled = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCalled >= limitMs) {
      lastCalled = now;
      fn(...args);
    }
  };
}
```

### retry（指数バックオフ付き）

```typescript
// src/lib/retry.ts — 指数バックオフリトライ

interface RetryOptions {
  maxAttempts?: number;   // デフォルト: 3
  baseDelayMs?: number;   // デフォルト: 1000ms
  maxDelayMs?: number;    // デフォルト: 30000ms
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000, maxDelayMs = 30_000 } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;

      // 指数バックオフ: 1s → 2s → 4s → ... (maxDelayMs上限)
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      // ジッター追加でリクエスト集中を避ける
      const jitter = Math.random() * delay * 0.1;
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
    }
  }

  throw lastError;
}

// 使用例
const data = await withRetry(() => fetchFromAPI('/endpoint'), {
  maxAttempts: 3,
  baseDelayMs: 500,
});
```

### 型安全なメッセージパッシング

```typescript
// src/lib/messaging.ts — 拡張全体で使える型安全メッセージング

// アプリのメッセージ型定義（プロジェクトに合わせて変更）
export type ExtMessage =
  | { type: 'GET_STATUS'; payload?: never }
  | { type: 'SET_SETTING'; payload: { key: string; value: unknown } }
  | { type: 'TRIGGER_ACTION'; payload: { action: string } };

export type ExtMessageResponse<T extends ExtMessage> =
  T extends { type: 'GET_STATUS' } ? { isPro: boolean; version: string }
  : T extends { type: 'SET_SETTING' } ? { success: boolean }
  : T extends { type: 'TRIGGER_ACTION' } ? { done: boolean }
  : never;

// 型安全な送信ラッパー
export async function sendMessage<T extends ExtMessage>(
  message: T
): Promise<ExtMessageResponse<T>> {
  return chrome.runtime.sendMessage(message) as Promise<ExtMessageResponse<T>>;
}

// background.ts 側のハンドラ型
export function createMessageHandler<T extends ExtMessage>(
  type: T['type'],
  handler: (
    payload: T extends { payload: infer P } ? P : never,
    sender: chrome.runtime.MessageSender
  ) => Promise<ExtMessageResponse<T>>
): (
  message: ExtMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: ExtMessageResponse<T>) => void
) => boolean {
  return (message, sender, sendResponse) => {
    if (message.type !== type) return false;
    handler(message.payload as never, sender).then(sendResponse);
    return true;
  };
}
```

---

:::message
**付録のまとめ**

- Service Worker系のGotchasは「return trueの欠落」「setIntervalの停止」「Port切断時のエラーハンドリング」の3つが頻出
- Storage系は「sync 8KB制限」「session揮発性」「awaitの欠落」を押さえる。型安全ラッパーがこれらの多くを防止する
- ビルド系は `eval()` の混入と `@types/chrome` の遅延更新に注意。新APIは型アサーションで対応
- CWS審査系は「未使用権限」「キーワードスタッフィング」「PP URL 404」の3つが最頻出のリジェクト理由
- `withRetry`（指数バックオフ）と型安全メッセージングラッパーはすべての拡張で使い回せる。コピーしてプロジェクトに配置するだけで即使える
:::
