---
title: "第3章 — TypeScript strict modeとchrome.*型定義"
---

> 第2章でビルドツールを選定しました。次は「型安全なコードを書く基盤」を整えます。`@types/chrome` の導入、メッセージパッシングのUnion型設計、よくある型エラーへの対処——この章で整備した型定義が、残り全章のコードの品質を支えます。

---

## Chrome拡張におけるTypeScript設定のポイント

Chrome拡張は複数のコンテキスト（Service Worker・Popup・ContentScript）があり、それぞれで使えるグローバルAPIが異なります。`tsconfig.json` はこの差異を考慮して設定します。

```json
// tsconfig.json — Chrome拡張向け推奨設定

{
  "compilerOptions": {
    // Strict系（妥協なし）
    "strict": true,
    "noUncheckedIndexedAccess": true,   // 配列アクセスに undefined を追加
    "exactOptionalPropertyTypes": true,  // undefined と省略を区別

    // 出力設定
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",       // Vite/WXT向け

    // Lib: Service Worker + DOM の両方を含める
    // background.ts → WebWorker のみ（window不在）
    // popup/content → DOM あり
    // ※ WXTはentrypoint別にlibを自動設定するため、手動では「DOM,WebWorker」を両方含める
    "lib": ["ESNext", "DOM", "WebWorker"],

    // パス解決
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "entrypoints/**/*"]
}
```

`noUncheckedIndexedAccess` は `array[0]` の型を `T | undefined` にします。配列の境界外アクセスによるランタイムエラーをコンパイル時に検出できます。

---

## @types/chrome の導入とバージョン管理

```bash
npm install -D @types/chrome
```

WXTを使う場合は `wxt prepare` で自動的に型定義が追加されます。手動の場合は上記コマンドで導入します。

**バージョン管理の注意点**: `@types/chrome` はChrome本体の更新から数週間〜数ヶ月遅れます。特に新API（`chrome.sidePanel`・`chrome.offscreen` 等）は型定義が追いついていない場合があります。

```typescript
// global.d.ts — 型定義が追いついていないAPIの補完

declare namespace chrome {
  namespace sidePanel {
    interface PanelOptions {
      tabId?: number;
      path?: string;
      enabled?: boolean;
    }
    function setOptions(options: PanelOptions): Promise<void>;
    function getOptions(options: { tabId?: number }): Promise<PanelOptions>;
    function open(options: { windowId: number; tabId?: number }): Promise<void>;
    function setPanelBehavior(options: { openPanelOnActionClick: boolean }): Promise<void>;
  }

  // chrome.runtime.getContexts（MV3新API）
  namespace runtime {
    enum ContextType {
      OFFSCREEN_DOCUMENT = 'OFFSCREEN_DOCUMENT',
    }
    interface ExtensionContext {
      contextType: ContextType;
      documentUrl?: string;
    }
    function getContexts(filter: {
      contextTypes?: ContextType[];
      documentUrls?: string[];
    }): Promise<ExtensionContext[]>;
  }
}
```

`declare namespace chrome` で既存の型定義にマージ追加できます。`@types/chrome` が更新された後は、このファイルから該当部分を削除します。

---

## Message Union 型のパターン集

Chrome拡張でのメッセージパッシングは型定義が最重要です。Union型を使って型安全を確保します。

```typescript
// src/types/messages.ts — 拡張全体で共有するメッセージ型定義

// ---- リクエスト型 ----
export type AppMessage =
  // 課金状態
  | { type: 'GET_SUBSCRIPTION_STATUS' }
  | { type: 'OPEN_PAYMENT_PAGE' }
  // データ操作
  | { type: 'EXTRACT_DATA'; payload: { selector: string; limit: number } }
  | { type: 'SAVE_POSITION'; payload: { url: string; scrollY: number } }
  | { type: 'DELETE_DATA'; payload: { key: string } }
  // 計測
  | { type: 'TRACK_EVENT'; payload: { name: string; params: Record<string, unknown> } }
  // 設定
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTING'; payload: { key: string; value: unknown } };

// ---- レスポンス型（リクエスト型にマッピング） ----
export type AppMessageResponse<T extends AppMessage> =
  T extends { type: 'GET_SUBSCRIPTION_STATUS' }
    ? { status: 'pro' | 'trial' | 'trial_expired' | 'free' }
  : T extends { type: 'EXTRACT_DATA' }
    ? { data: string[]; count: number }
  : T extends { type: 'SAVE_POSITION' }
    ? { success: boolean }
  : T extends { type: 'GET_SETTINGS' }
    ? { theme: string; language: string }
  : { success: boolean }; // デフォルトレスポンス

// ---- 型安全な送信関数 ----
export async function sendMessage<T extends AppMessage>(
  message: T
): Promise<AppMessageResponse<T>> {
  return chrome.runtime.sendMessage(message) as Promise<AppMessageResponse<T>>;
}
```

```typescript
// background.ts — メッセージハンドラの型安全な実装

import type { AppMessage, AppMessageResponse } from './types/messages';

chrome.runtime.onMessage.addListener(
  (
    message: AppMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: AppMessageResponse<typeof message>) => void
  ) => {
    switch (message.type) {
      case 'GET_SUBSCRIPTION_STATUS':
        getSubscriptionStatus().then((status) => sendResponse({ status }));
        return true;

      case 'EXTRACT_DATA': {
        const { selector, limit } = message.payload; // 型推論が効く
        extractData(selector, limit).then((data) =>
          sendResponse({ data, count: data.length })
        );
        return true;
      }

      case 'SAVE_POSITION': {
        const { url, scrollY } = message.payload;
        savePosition(url, scrollY).then(() => sendResponse({ success: true }));
        return true;
      }

      default:
        sendResponse({ success: false });
        return false;
    }
  }
);
```

`switch` の各 `case` でペイロードの型が自動的に絞り込まれます。`message.payload.selector` は `EXTRACT_DATA` ケース内でのみ型安全にアクセスできます。

---

## React + Chrome拡張で気をつける型のポイント

```typescript
// src/popup/hooks/useExtensionState.ts — React + chrome.storage の型安全フック

import { useState, useEffect } from 'react';

// chrome.storage のコールバック値は any になりやすい → 型ガードで防御
function isSubscriptionStatus(
  value: unknown
): value is 'pro' | 'trial' | 'trial_expired' | 'free' {
  return (
    value === 'pro' ||
    value === 'trial' ||
    value === 'trial_expired' ||
    value === 'free'
  );
}

export function useSubscriptionStatus() {
  const [status, setStatus] = useState<'pro' | 'trial' | 'trial_expired' | 'free' | null>(null);

  useEffect(() => {
    chrome.storage.local.get('subscriptionStatus').then(({ subscriptionStatus }) => {
      // 型ガードで unknown → Union型に絞り込む
      if (isSubscriptionStatus(subscriptionStatus)) {
        setStatus(subscriptionStatus);
      } else {
        setStatus('free'); // フォールバック
      }
    });

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if ('subscriptionStatus' in changes) {
        const newValue = changes.subscriptionStatus.newValue;
        if (isSubscriptionStatus(newValue)) setStatus(newValue);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return status;
}
```

**`chrome.*` コールバックの返り値は基本 `any`**。`chrome.storage.local.get` の返り値は `Record<string, any>` です。型ガード関数（`is` 述語）で絞り込むことでランタイム安全性も確保します。

---

## よくあるTypeScriptエラー10選と解決策

| # | エラー | 原因 | 解決策 |
|---|-------|------|--------|
| 1 | `Property 'sidePanel' does not exist on type 'typeof chrome'` | @types/chrome未対応API | `global.d.ts` で型補完 |
| 2 | `Object is possibly 'undefined'` | `noUncheckedIndexedAccess` | 配列アクセスに `?? fallback` を追加 |
| 3 | `Type 'string' is not assignable to type 'never'` | switch の型絞り込みが完全でない | `default` ケースに `exhaustiveCheck` を追加 |
| 4 | `Cannot find name 'window'` | Service Worker に window なし | `globalThis` を使うか `@ts-expect-error` |
| 5 | `Type '{}' is not assignable to type 'ExtensionStorage'` | chrome.storage.get の返り値が広すぎる | 型ガード関数で絞り込み |
| 6 | `Argument of type 'string \| undefined' is not assignable` | オプショナル値の未チェック | `??` か `!` 演算子で処理 |
| 7 | `Module '"@types/chrome"' has no exported member` | バージョン不一致 | `npm update @types/chrome` |
| 8 | `'async' modifier cannot appear on a constructor` | コンストラクタに async | 静的ファクトリーメソッドに変更 |
| 9 | `Type instantiation is excessively deep` | 再帰型が深すぎる | `interface` に変更 or `// @ts-expect-error` |
| 10 | `JSX element type does not have any construct or call signature` | Reactのバージョン不一致 | `@types/react` のバージョンを一致させる |

**エラー3 の exhaustive check パターン**:

```typescript
// exhaustive check — switch の網羅性をコンパイル時に保証
function handleMessage(message: AppMessage): void {
  switch (message.type) {
    case 'GET_SUBSCRIPTION_STATUS':
      // ...
      break;
    case 'EXTRACT_DATA':
      // ...
      break;
    default:
      // ここに到達したら型エラー（未処理のケースがある証拠）
      const _exhaustiveCheck: never = message;
      throw new Error(`Unhandled message type: ${(_exhaustiveCheck as AppMessage).type}`);
  }
}
```

新しいメッセージタイプを `AppMessage` に追加した際、`switch` の `case` に追加し忘れるとコンパイルエラーになります。

---

:::message
**この章で学んだこと**

- `tsconfig.json` は `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` の3点セットが Chrome拡張における型安全の基礎。`lib` には `DOM` と `WebWorker` を両方含める
- `@types/chrome` が追いついていない新API（sidePanel/offscreen/getContexts）は `global.d.ts` の `declare namespace chrome` で補完する。更新後は削除する
- メッセージパッシングはUnion型 + Conditional Typesで型安全に設計できる。`switch` の各 `case` でペイロードが自動的に絞り込まれる
- `chrome.storage` の返り値は `Record<string, any>` のため、型ガード関数（`is` 述語）で絞り込むことがランタイム安全性を保証する唯一の方法
- exhaustive checkパターン（`const _: never = ...`）でUnion型の全ケース処理を強制できる。新しいメッセージ型追加時の処理漏れをコンパイル時に検出する
:::

---

型定義の基盤が整いました。次の章では、この型安全な設計を活用して「データをどこに・どう保存するか」を解説します。`chrome.storage.local`・`sync`・`session` の3種を使い分け、型安全なラッパーでストレージを制御します。

**→ [第4章：chrome.storage 3層設計パターン](./storage-patterns.md)**
