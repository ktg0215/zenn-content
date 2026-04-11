---
title: "第3章 — chrome.storage 3層設計パターン"
---

> 第2章でビルドツールを整えました。次は「データをどこに・どう保存するか」です。`chrome.storage.local`・`chrome.storage.sync`・`chrome.storage.session` の3つを正しく使い分けることが、拡張の信頼性を大きく左右します。この章では型安全なstorageラッパーから、レート制限の対処、データマイグレーションまでを実装コードとともに解説します。

---

## chrome.storage の役割と3種の違い

Chrome拡張で「データを保存する」方法は複数あります。なぜ `chrome.storage` を使うのか、まず他の方法との比較から始めます。

### なぜ localStorage ではダメか

```typescript
// ❌ localStorage はService Workerからアクセス不可
// background.ts (Service Worker)
localStorage.setItem('key', 'value'); // ReferenceError: localStorage is not defined
```

`localStorage` はブラウザのWindowコンテキストにのみ存在し、Service Workerからはアクセスできません。また、ポップアップのlocalStorageとコンテンツスクリプトのlocalStorageは別のオリジンに属するため、共有もできません。

`chrome.storage` はすべてのコンテキスト（Service Worker・Popup・ContentScript・SidePanel）から共通してアクセスできる唯一の永続化APIです。

### 3種の比較

| 項目 | local | sync | session |
|-----|-------|------|---------|
| 容量 | 10MB（無制限オプションあり） | 100KB（item最大8KB） | 約1MB |
| 永続性 | 恒久的 | 恒久的 | Service Worker生存中のみ |
| デバイス間同期 | なし | Googleアカウントで同期 | なし |
| 書き込みレート制限 | なし（実質無制限） | 1,800回/分、120万/時 | なし |
| オフライン対応 | ○ | △（最終同期値を保持） | ○ |
| 主な用途 | アプリデータ全般 | ユーザー設定 | セッションキャッシュ |

**実践的な選択基準:**
- `local` — デフォルト。ユーザーのデータ（履歴・保存位置・カウント等）はすべてlocal
- `sync` — ユーザーが複数デバイスで同じ設定を使いたい場合のみ（テーマ・言語・通知設定等）
- `session` — API認証トークンの一時保持、OCR処理の途中結果など「停止されたら消えてよい」データ

---

## 型安全なstorageラッパー実装

`chrome.storage.local.get` の生のAPIは返り値が `Record<string, any>` です。これを型安全にラップします。

```typescript
// src/lib/storage.ts — 型安全なstorageラッパー

// ストレージのスキーマ定義
export interface ExtensionStorage {
  // ユーザーデータ (local)
  usageCount: number;
  installDate: number;
  lastPaywallShown: number | null;
  isPro: boolean;
  processingQueue: string[];

  // ユーザー設定 (sync)
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'ja';
  notificationsEnabled: boolean;

  // セッションキャッシュ (session)
  sessionPaywallShown: boolean;
  cachedApiToken: string | null;
}

type StorageKey = keyof ExtensionStorage;

// ---- local storage ----

export async function getLocal<K extends StorageKey>(
  key: K
): Promise<ExtensionStorage[K] | undefined> {
  const result = await chrome.storage.local.get(key);
  return result[key] as ExtensionStorage[K] | undefined;
}

export async function setLocal<K extends StorageKey>(
  key: K,
  value: ExtensionStorage[K]
): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getLocalMultiple<K extends StorageKey>(
  keys: K[]
): Promise<Partial<Pick<ExtensionStorage, K>>> {
  const result = await chrome.storage.local.get(keys);
  return result as Partial<Pick<ExtensionStorage, K>>;
}

// ---- sync storage ----

export async function getSync<K extends StorageKey>(
  key: K
): Promise<ExtensionStorage[K] | undefined> {
  const result = await chrome.storage.sync.get(key);
  return result[key] as ExtensionStorage[K] | undefined;
}

export async function setSync<K extends StorageKey>(
  key: K,
  value: ExtensionStorage[K]
): Promise<void> {
  await chrome.storage.sync.set({ [key]: value });
}

// ---- session storage ----

export async function getSession<K extends StorageKey>(
  key: K
): Promise<ExtensionStorage[K] | undefined> {
  const result = await chrome.storage.session.get(key);
  return result[key] as ExtensionStorage[K] | undefined;
}

export async function setSession<K extends StorageKey>(
  key: K,
  value: ExtensionStorage[K]
): Promise<void> {
  await chrome.storage.session.set({ [key]: value });
}
```

このラッパーを使うと、存在しないキーや型の不一致をコンパイル時に検出できます。

```typescript
// ✅ 型補完が効く
await setLocal('usageCount', 5);         // OK
await setLocal('usageCount', 'five');    // コンパイルエラー
await setLocal('nonExistentKey', true);  // コンパイルエラー

const count = await getLocal('usageCount'); // number | undefined
```

---

## レート制限との付き合い方

`chrome.storage.sync` には書き込みレート制限（1,800回/分）があります。ユーザーがスライダーやトグルを連打すると、この制限に引っかかる場合があります。

デバウンスで書き込みをまとめます。

```typescript
// src/lib/storage.ts — デバウンス付きsync書き込み

type DebouncedSyncQueue = Partial<ExtensionStorage>;
let syncQueue: DebouncedSyncQueue = {};
let syncTimer: ReturnType<typeof setTimeout> | null = null;

export function setyncDebounced<K extends StorageKey>(
  key: K,
  value: ExtensionStorage[K],
  delayMs = 500
): void {
  // キューに追加（同じキーは上書き）
  syncQueue = { ...syncQueue, [key]: value };

  // タイマーをリセット
  if (syncTimer) clearTimeout(syncTimer);

  syncTimer = setTimeout(async () => {
    const toWrite = syncQueue;
    syncQueue = {};
    syncTimer = null;

    await chrome.storage.sync.set(toWrite);
  }, delayMs);
}
```

`chrome.storage.local` はレート制限がないため、デバウンスは不要です。

---

## onChanged の使いどころ

`chrome.storage.onChanged` は値が変わったときにリスナーが呼ばれます。popup ↔ background の状態同期に使います。

### Reactカスタムフック（popup側）

```typescript
// src/hooks/useStorage.ts — storage変更をリアクティブに購読するフック

import { useEffect, useState } from 'react';
import { getLocal, ExtensionStorage } from '../lib/storage';

type StorageKey = keyof ExtensionStorage;

export function useStorage<K extends StorageKey>(
  key: K,
  initialValue: ExtensionStorage[K]
): [ExtensionStorage[K], (value: ExtensionStorage[K]) => Promise<void>] {
  const [value, setValue] = useState<ExtensionStorage[K]>(initialValue);

  useEffect(() => {
    // 初期値を取得
    getLocal(key).then((stored) => {
      if (stored !== undefined) setValue(stored);
    });

    // 変更を監視
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area === 'local' && key in changes) {
        setValue(changes[key].newValue as ExtensionStorage[K]);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [key]);

  const setStorageValue = async (newValue: ExtensionStorage[K]) => {
    await chrome.storage.local.set({ [key]: newValue });
    // onChanged が発火してsetValueが呼ばれるため、直接setValueしない
  };

  return [value, setStorageValue];
}

// 使用例
// const [isPro, setIsPro] = useStorage('isPro', false);
```

---

## データマイグレーション

拡張のバージョンアップで、storageのスキーマが変わることがあります。古いデータを新しい形式に変換する「マイグレーション」が必要です。

```typescript
// background.ts — バージョニングとマイグレーション

const CURRENT_SCHEMA_VERSION = 2;

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'update') {
    await runMigrations();
  }
  if (reason === 'install') {
    await chrome.storage.local.set({ schemaVersion: CURRENT_SCHEMA_VERSION });
  }
});

async function runMigrations(): Promise<void> {
  const { schemaVersion = 1 } = await chrome.storage.local.get('schemaVersion');

  if (schemaVersion < 2) {
    await migrateV1toV2();
  }

  await chrome.storage.local.set({ schemaVersion: CURRENT_SCHEMA_VERSION });
}

async function migrateV1toV2(): Promise<void> {
  // v1: { savedPosition: number } → v2: { savedPositions: Record<string, number> }
  const { savedPosition } = await chrome.storage.local.get('savedPosition');
  if (savedPosition !== undefined) {
    const currentUrl = 'unknown'; // v1では単一URL
    await chrome.storage.local.set({
      savedPositions: { [currentUrl]: savedPosition },
    });
    await chrome.storage.local.remove('savedPosition');
  }
}
```

マイグレーションは `chrome.runtime.onInstalled` の `reason === 'update'` で実行します。インストール時（`reason === 'install'`）には最新スキーマで初期化します。

---

## session storage で一時データ管理

`chrome.storage.session` はService Workerが停止すると消えます。この性質を利用して、「停止されたら消えてよい」データを管理します。

**主な用途:**
- **APIトークンの一時保持**: 認証後のアクセストークン。Service Workerが停止したら再取得
- **OCR処理の途中結果**: 画像解析の中間データ
- **セッション内ペイウォール制御**: `sessionStorage` の代替（Service Workerから使えるため）

```typescript
// background.ts — session storageでAPIトークン管理
async function getApiToken(): Promise<string> {
  // まずsessionから取得を試みる
  const { cachedApiToken } = await chrome.storage.session.get('cachedApiToken');
  if (cachedApiToken) return cachedApiToken;

  // キャッシュ切れ→再取得
  const token = await fetchNewToken();
  await chrome.storage.session.set({ cachedApiToken: token });
  return token;
}
```

---

## プライバシーとstorage

`chrome.storage.sync` に保存したデータはGoogleのサーバーに送信されます。個人情報（氏名・メール・URLの履歴等）をsyncに保存することは、CWSのプライバシー審査で問題になる可能性があります。

**原則**: sync には「設定値」のみ。「ユーザーの行動データ」はlocal に保存する。

```typescript
// ✅ syncに入れていいもの
setSync('theme', 'dark');
setSync('language', 'ja');
setSync('notificationsEnabled', false);

// ❌ syncに入れてはいけないもの
// setSync('visitedUrls', [...]); // 閲覧履歴
// setSync('userEmail', '...'); // PII
// setSync('scrollPositions', {...}); // 行動データ
```

---

## デバッグテクニック

### chrome://extensions での確認

1. `chrome://extensions` を開く
2. 対象拡張の「Service Worker」リンクをクリック
3. DevToolsの「Application」タブ → 「Storage」→ 「Extension Storage」

### エクスポート/インポート実装

```typescript
// storage-debug.ts — 開発時のデータ確認用
export async function exportAllStorage(): Promise<void> {
  const local = await chrome.storage.local.get(null);
  const sync = await chrome.storage.sync.get(null);
  console.log('=== local ===', JSON.stringify(local, null, 2));
  console.log('=== sync ===', JSON.stringify(sync, null, 2));
}
```

---

## よくある失敗5つ

**① async/awaitの抜け**

```typescript
// ❌ awaitがないので値はPromiseになる
const { count } = chrome.storage.local.get('usageCount');
console.log(count); // undefined（Promiseを分割代入している）

// ✅
const { count } = await chrome.storage.local.get('usageCount');
```

**② QuotaExceeded エラー**

localは10MB、syncはitem単位8KB・全体100KBの上限があります。大きなデータ（数MBの画像・ログ等）はIndexedDBを使います。

**③ onChanged の循環トリガー**

storageの値をonChangedリスナー内で書き換えると、再びonChangedが発火して無限ループになります。変更前後の値が同じ場合はスキップする条件を入れます。

**④ syncのレート制限超過**

ユーザー操作ごとにsyncへ書き込んでいると、すぐにレート制限（1,800回/分）に達します。本章の `setyncDebounced` を使います。

**⑤ PII をうっかりsyncに保存**

閲覧URL・入力テキスト・メールアドレスをsyncに保存するとGoogleサーバーに送信されます。CWSプライバシー審査でリジェクト対象になります。

---

:::message
**この章で学んだこと**

- `chrome.storage` の3種（local/sync/session）は容量・永続性・同期・レート制限が異なる。デフォルトはlocal、ユーザー設定のみsync、一時データはsession
- `localStorage` はService Workerからアクセス不可。全コンテキストで共有できる唯一の永続化APIが `chrome.storage`
- TypeScript Genericsでスキーマ定義したラッパーを作ると、存在しないキーや型の不一致をコンパイル時に検出できる
- `chrome.storage.sync` の書き込みはデバウンスでまとめてレート制限を回避する
- PII（個人情報・行動データ）はsyncに入れない。CWSプライバシー審査での頻出リジェクト理由
:::

---

データの保存基盤が整いました。次の章では、この storage 設計を活用して「有料機能の壁」を実装するフリーミアムの実装を解説します。ExtensionPayの統合からリバーストライアルのコード、ペイウォールモーダルまで一気に実装します。

**→ [第4章：フリーミアム実装（ExtensionPay）](./freemium-implementation.md)**
