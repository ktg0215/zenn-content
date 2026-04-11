---
title: "第1章 — Manifest V3時代のChrome拡張アーキテクチャ"
---

> はじめにでMV3の全体像を俯瞰しました。この章では「なぜService Workerなのか」から入り、ステートレス設計の3パターンまでを実装コードとともに解説します。MV3の設計思想を理解することが、以降の全章の基礎になります。

---

## Manifest V2からV3への変更点

Chromeが2020年に発表したManifest V3（MV3）は、2023年以降のCWS新規申請で実質必須となっています。MV2からの主要な変更点を整理します。

| 項目 | Manifest V2 | Manifest V3 |
|-----|-----------|-----------|
| バックグラウンド処理 | Background Page（永続的） | Service Worker（ステートレス） |
| コンテンツスクリプト挿入 | `tabs.executeScript` | `scripting.executeScript` |
| リモートコード実行 | 可能 | **禁止**（CSP強化） |
| XMLHttpRequest | content scriptで使用可 | `fetch` のみ |
| `webRequest` API | ブロッキング可能 | 宣言型（`declarativeNetRequest`）に移行 |
| アイコンサイズ | `browser_action` / `page_action` | `action` に統一 |

最も影響が大きいのは**Background PageからService Workerへの移行**です。

---

## なぜService Workerなのか

Background Pageはブラウザが起動中は常にメモリに常駐していました。これは開発者にとって便利でしたが、Chromeの消費メモリ増加の一因でもありました。

Service WorkerはWebのService Worker仕様をChrome拡張に適用したものです。**リクエストがないと停止し、必要なときだけ起動する**というモデルです。

### Service Workerのライフサイクル

```
インストール時: chrome.runtime.onInstalled
    ↓
起動（イベント発生時）: chrome.runtime.onMessage, chrome.alarms.onAlarm 等
    ↓
処理実行（最大5分程度）
    ↓
アイドル時に停止（自動）
    ↓
次のイベント発生で再起動
```

**重要**: Service Workerはいつでも停止します。「変数に状態を持つ」実装は必ず壊れます。

```typescript
// ❌ MV2時代のパターン（MV3では動かない）
// background.ts
let isAuthenticated = false; // 停止したらリセットされる

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'CHECK_AUTH') {
    // isAuthenticated は常に false になる（停止後の再起動で初期化）
    return isAuthenticated;
  }
});
```

```typescript
// ✅ MV3のパターン（storageから都度取得）
// background.ts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_AUTH') {
    chrome.storage.local.get('isAuthenticated').then(({ isAuthenticated }) => {
      sendResponse({ isAuthenticated: isAuthenticated ?? false });
    });
    return true; // 非同期レスポンスを示すためにtrueを返す
  }
});
```

---

## MV3のマニフェスト構造

まず `manifest.json` の基本構造を確認します。

```json
// manifest.json
{
  "manifest_version": 3,
  "name": "__MSG_extensionName__",
  "version": "1.0.0",
  "description": "__MSG_extensionDescription__",
  "default_locale": "en",

  "permissions": [
    "storage",
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "<all_urls>"
  ],

  "background": {
    "service_worker": "background.js",
    "type": "module"
  },

  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },

  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],

  "web_accessible_resources": [
    {
      "resources": ["fonts/*", "images/*"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

### パーミッション設計の原則

**最小権限の原則**: CWSの審査では、マニフェストに宣言されているパーミッションと実際の使用が照合されます。未使用のパーミッションはリジェクト原因になります。

| パーミッション | 用途 | 審査での注意点 |
|------------|-----|-------------|
| `storage` | chrome.storage.local/sync | ほぼ全拡張で必要 |
| `activeTab` | 現在のタブのURL取得 | `tabs` より制限が緩く審査が通りやすい |
| `scripting` | スクリプト動的挿入 | `host_permissions` との組み合わせが必要 |
| `tabs` | 全タブのURL取得 | 必要な場合のみ。理由の説明を準備 |
| `cookies` | Cookie読み書き | プライバシー審査が厳しい |
| `management` | インストール済み拡張の取得 | 理由を明示 |
| `<all_urls>` | 全サイトへのアクセス | 代替として特定ドメインを検討 |

---

## ステートレス設計の3パターン

Service Workerのステートレス問題に対応する実践パターンを3つ紹介します。

### パターン1：storage永続化パターン

状態はすべて `chrome.storage.local` に保存します。Service Workerが再起動しても、storageから復元できます。

```typescript
// background.ts — storage永続化パターン

// ❌ インメモリ状態（Service Worker停止で消える）
let processingQueue: string[] = [];

// ✅ storage永続化（再起動後も復元可能）
async function addToQueue(url: string): Promise<void> {
  const { processingQueue = [] } = await chrome.storage.local.get('processingQueue');
  await chrome.storage.local.set({
    processingQueue: [...processingQueue, url],
  });
}

async function processQueue(): Promise<void> {
  const { processingQueue = [] } = await chrome.storage.local.get('processingQueue');
  if (processingQueue.length === 0) return;

  const [current, ...rest] = processingQueue;
  await chrome.storage.local.set({ processingQueue: rest });

  await processItem(current);
}
```

### パターン2：アラームによる定期実行パターン

Service WorkerはsetIntervalが使えません（停止するため）。`chrome.alarms` APIを使います。

```typescript
// background.ts — アラームパターン

// インストール時にアラームを設定
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('periodic-sync', {
    periodInMinutes: 60,
  });
});

// アラーム発火時の処理
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'periodic-sync') {
    await syncData();
  }
});

async function syncData(): Promise<void> {
  // この関数はService Workerが停止していても、
  // アラームが発火した時点で起動して実行される
  const { lastSyncedAt } = await chrome.storage.local.get('lastSyncedAt');
  // ... 同期処理
  await chrome.storage.local.set({ lastSyncedAt: Date.now() });
}
```

**注意**: `chrome.alarms` を使うには `manifest.json` の `permissions` に `"alarms"` を追加します。

### パターン3：メッセージパッシングパターン

popup・content script・background間の通信は `chrome.runtime.sendMessage` で行います。

```typescript
// popup.ts → background.ts への非同期メッセージ
async function getStatus(): Promise<{ isPro: boolean; usageCount: number }> {
  return chrome.runtime.sendMessage({ type: 'GET_STATUS' });
}

// background.ts でのハンドリング
chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    if (message.type === 'GET_STATUS') {
      // 非同期処理のためtrue を返す
      chrome.storage.local
        .get(['isPro', 'usageCount'])
        .then(({ isPro = false, usageCount = 0 }) => {
          sendResponse({ isPro, usageCount });
        });
      return true; // 必須: 非同期レスポンスを使う場合
    }
  }
);

// content.ts → background.ts（タブIDを指定して送る場合）
chrome.runtime.sendMessage({ type: 'DATA_EXTRACTED', data: extractedData });
```

**よくあるミス**: `sendResponse` を呼ぶ前にリスナーが `return false` または `undefined` を返すと、非同期レスポンスが届きません。非同期処理を使う場合は必ず `return true` を返してください。

---

## 3層アーキテクチャの全体像

MV3拡張の典型的なアーキテクチャは以下の3層で構成されます。

```
┌─────────────────────────────────────────────────────┐
│  Popup / Side Panel（React + TypeScript）            │
│  → ユーザー操作のUI層                                │
│  → chrome.runtime.sendMessage で background と通信  │
└──────────────────────┬──────────────────────────────┘
                       │ メッセージ
┌──────────────────────▼──────────────────────────────┐
│  Background Service Worker                           │
│  → ビジネスロジック・状態管理・API通信               │
│  → chrome.storage でデータ永続化                    │
│  → chrome.alarms で定期処理                         │
└──────────────────────┬──────────────────────────────┘
                       │ chrome.scripting.executeScript
┌──────────────────────▼──────────────────────────────┐
│  Content Script（DOM操作）                           │
│  → ページのDOM読み取り・操作                         │
│  → chrome.runtime.sendMessage でbackgroundに送信    │
└─────────────────────────────────────────────────────┘
```

各層の責任分担を明確にすることが、MV3拡張開発の鍵です。

- **Popup/SidePanel**: UIのレンダリングのみ。データ取得はbackgroundに委ねる
- **Background**: データ処理・状態管理・外部API通信の唯一の場所
- **Content Script**: DOMアクセスのみ。データ処理はbackgroundに委ねる

---

## Service Worker の寿命問題への対処

Service Workerは通常30秒〜5分でブラウザに停止されます。長時間かかる処理がある場合の対処法です。

### chrome.alarms でのチェーン処理

```typescript
// background.ts — 長時間処理をアラームでチェーンする
const BATCH_SIZE = 10;

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'batch-process') return;

  const { pendingItems = [] } = await chrome.storage.local.get('pendingItems');
  if (pendingItems.length === 0) return;

  // バッチサイズ分だけ処理
  const batch = pendingItems.slice(0, BATCH_SIZE);
  const remaining = pendingItems.slice(BATCH_SIZE);

  await processBatch(batch);
  await chrome.storage.local.set({ pendingItems: remaining });

  // 残りがあれば次のアラームを設定
  if (remaining.length > 0) {
    chrome.alarms.create('batch-process', { delayInMinutes: 0.5 });
  }
});
```

---

:::message
**この章で学んだこと**

- MV3最大の変化は「Background Page（永続）→ Service Worker（ステートレス）」。変数に状態を持つ実装は壊れる
- 状態はすべて `chrome.storage.local` に永続化する。Service Workerが再起動しても復元可能
- `setInterval` は使えない。定期処理は `chrome.alarms` APIを使う
- 非同期メッセージレスポンスを返す場合はリスナーで `return true` が必須
- 3層設計（Popup/Background/ContentScript）で責任を分離し、各層の役割を明確にする
:::

---

次章では、このアーキテクチャを前提に「どのビルドツールを選ぶか」を解説します。WXT・CRXJS・素のViteのそれぞれの使い分けと、実際の設定ファイルを比較します。

**→ [第2章：ビルドツール選定](./build-tools.md)**
