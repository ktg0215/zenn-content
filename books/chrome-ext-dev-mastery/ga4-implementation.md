---
title: "第5章 — GA4 Measurement Protocol完全実装"
---

> 第4章でフリーミアムの実装を完了しました。「有料転換率を上げる」には「何が起きているかを計測する」が前提です。この章では、Chrome拡張でGA4を使う唯一の方法——Measurement Protocol——の完全実装を解説します。Book 2第7章が「何を計測するか」の設計なら、この章は「どう実装するか」のコード版です。

---

## なぜGA4 Measurement Protocolなのか

Chrome拡張でウェブ計測の定番「gtag.js」を使おうとすると、すぐに壁にぶつかります。

### gtag.jsが使えない3つの理由

**① Content Security Policy（CSP）制約**

MV3拡張では、外部スクリプトを動的に読み込むことが禁止されています。`<script src="https://www.googletagmanager.com/gtag/js">` はCSP違反でブロックされます。

**② `eval()` の禁止**

gtag.jsの内部実装は `eval()` または `Function()` コンストラクタを使用しています。MV3のCSPポリシーではこれらは禁止です。

**③ Service Workerにwindowがない**

gtag.jsはブラウザの `window.dataLayer` に依存します。Service Workerには `window` が存在しないため、background.tsからは呼び出せません。

### Measurement Protocolとは

GA4 Measurement Protocol（MP）はGA4のHTTP APIです。`fetch` で直接イベントをGoogleのエンドポイントに送信します。スクリプト読み込み不要・`eval()` 不要・`window` 不要——Chrome拡張と完全に相性が合います。

```
拡張機能 → fetch POST → https://www.google-analytics.com/mp/collect → GA4プロパティ
```

---

## GA4セットアップ

### プロパティとAPIキーの取得

1. [Google Analytics](https://analytics.google.com) → 管理 → プロパティを作成
2. 「データストリーム」→「ウェブ」→ URL に拡張IDを入力（`chrome-extension://xxxx`）
3. Measurement ID（`G-XXXXXXXXXX`）をコピー
4. 「測定プロトコルAPIシークレット」→「作成」→ APIシークレットをコピー

```typescript
// src/constants/analytics.ts — 環境変数として管理

// WXTの場合は .env ファイルに記載
// VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
// VITE_GA4_API_SECRET=your_api_secret

export const GA4_CONFIG = {
  measurementId: import.meta.env.VITE_GA4_MEASUREMENT_ID as string,
  apiSecret: import.meta.env.VITE_GA4_API_SECRET as string,
  endpoint: 'https://www.google-analytics.com/mp/collect',
  debugEndpoint: 'https://www.google-analytics.com/debug/mp/collect',
} as const;
```

**注意**: APIシークレットはGitHubに公開しないでください。WXTの `.env` ファイルを `.gitignore` に追加し、CI/CDにはシークレットとして設定します。ただし、Chrome拡張のバンドルに含まれる以上、技術的にはユーザーが抽出できます。APIシークレットは書き込み専用（イベント送信のみ）なので、流出しても読み取りはできません。

---

## client_id の生成と保存

```typescript
// src/lib/client-id.ts — UUID v4 ベースのclient_id管理

export async function getOrCreateClientId(): Promise<string> {
  const { ga4ClientId } = await chrome.storage.local.get('ga4ClientId');

  if (typeof ga4ClientId === 'string' && ga4ClientId.length > 0) {
    return ga4ClientId;
  }

  // crypto.randomUUID() は MV3 Service Worker で使用可能
  const newId = crypto.randomUUID();
  await chrome.storage.local.set({ ga4ClientId: newId });
  return newId;
}

// セッションIDはService Worker生存中に固定（起動のたびに変わる）
let _sessionId: string | null = null;

export function getSessionId(): string {
  if (!_sessionId) {
    _sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  return _sessionId;
}
```

`client_id` は `chrome.storage.local` に永続保存し、拡張を削除しない限り同じユーザーとして識別します。`session_id` はService Workerの生存中のみ有効なメモリ変数です。GA4のセッション計算に使われます。

---

## イベント送信の型安全ラッパー

```typescript
// src/lib/analytics.ts — GA4 Measurement Protocol 完全実装

import { GA4_CONFIG } from '../constants/analytics';
import { getOrCreateClientId, getSessionId } from './client-id';

// イベント名をUnion型で定義（存在しないイベント名はコンパイルエラー）
type GA4EventName =
  | 'install'
  | 'update'
  | 'session_start'
  | 'feature_used'
  | 'aha_moment'
  | 'paywall_shown'
  | 'paywall_clicked'
  | 'paywall_dismissed'
  | 'upgrade_started'
  | 'upgrade_succeeded'
  | 'upgrade_failed'
  | 'review_prompt_shown'
  | 'review_prompt_clicked'
  | 'review_prompt_dismissed';

// イベントパラメータの型（GA4の予約済みパラメータを除いたカスタム部分）
type GA4EventParams = Record<string, string | number | boolean>;

export async function sendEvent(
  eventName: GA4EventName,
  params: GA4EventParams = {}
): Promise<void> {
  // オプトアウト確認
  const { analyticsOptOut } = await chrome.storage.local.get('analyticsOptOut');
  if (analyticsOptOut === true) return;

  const clientId = await getOrCreateClientId();
  const isDev = import.meta.env.DEV;

  const payload = {
    client_id: clientId,
    non_personalized_ads: true, // パーソナライズ広告を無効
    events: [
      {
        name: eventName,
        params: {
          // GA4の必須パラメータ
          session_id: getSessionId(),
          engagement_time_msec: 100,
          // カスタムパラメータ
          extension_version: chrome.runtime.getManifest().version,
          ...params,
        },
      },
    ],
  };

  const endpoint = isDev ? GA4_CONFIG.debugEndpoint : GA4_CONFIG.endpoint;
  const url = `${endpoint}?measurement_id=${GA4_CONFIG.measurementId}&api_secret=${GA4_CONFIG.apiSecret}`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // 計測失敗は本体機能に影響させない（silent fail）
    if (isDev) console.warn('[Analytics] Failed to send event:', eventName);
  }
}
```

---

## ライフサイクルイベント

```typescript
// background.ts — インストール・アップデートイベント

chrome.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
  switch (reason) {
    case 'install':
      await sendEvent('install', {
        extension_version: chrome.runtime.getManifest().version,
      });
      // インストール日時を記録（トライアル計算に使用）
      await chrome.storage.local.set({ installDate: Date.now() });
      break;

    case 'update':
      await sendEvent('update', {
        from_version: previousVersion ?? 'unknown',
        to_version: chrome.runtime.getManifest().version,
      });
      break;
  }
});

// session_start: ポップアップ起動・主要機能実行時に呼ぶ
// （Chrome拡張にはページビューの概念がないため手動実装）
export async function trackSessionStart(): Promise<void> {
  const { lastSessionAt } = await chrome.storage.local.get('lastSessionAt');
  const now = Date.now();
  const thirtyMinutes = 30 * 60 * 1000;

  // 30分以上経過していれば新セッション
  if (!lastSessionAt || now - (lastSessionAt as number) > thirtyMinutes) {
    await sendEvent('session_start');
    await chrome.storage.local.set({ lastSessionAt: now });
  }
}
```

---

## A/BテストのVariant送信

A/Bテストのバリアントをイベントパラメータに含めて送信します。

```typescript
// src/lib/ab-test.ts — A/Bテスト variant 管理

type ABTestName = 'paywall_copy' | 'paywall_timing' | 'upgrade_button_color';
type Variant = 'A' | 'B';

// インストール時にバリアントをランダム割り当てして永続化
export async function getOrAssignVariant(testName: ABTestName): Promise<Variant> {
  const storageKey = `abtest_${testName}`;
  const stored = await chrome.storage.local.get(storageKey);

  if (stored[storageKey] === 'A' || stored[storageKey] === 'B') {
    return stored[storageKey] as Variant;
  }

  const variant: Variant = Math.random() < 0.5 ? 'A' : 'B';
  await chrome.storage.local.set({ [storageKey]: variant });
  return variant;
}

// 使用例
const variant = await getOrAssignVariant('paywall_copy');
await sendEvent('paywall_shown', {
  trigger: 'usage_count',
  ab_test: 'paywall_copy',
  ab_variant: variant, // GA4でフィルタリングできる
});
```

---

## バッチ送信とリトライ

オフライン時やネットワーク障害でfetchが失敗した場合のリトライ実装です。

```typescript
// src/lib/analytics-queue.ts — オフライン時のキューとリトライ

interface QueuedEvent {
  name: GA4EventName;
  params: GA4EventParams;
  timestamp: number;
}

const MAX_QUEUE_SIZE = 20;
const MAX_RETRY_AGE_MS = 24 * 60 * 60 * 1000; // 24時間以上古いイベントは破棄

export async function enqueueEvent(
  name: GA4EventName,
  params: GA4EventParams
): Promise<void> {
  const { analyticsQueue = [] } = await chrome.storage.local.get('analyticsQueue');
  const queue = analyticsQueue as QueuedEvent[];

  const newEvent: QueuedEvent = { name, params, timestamp: Date.now() };

  // キューが満杯なら古いものを捨てる
  const trimmed = queue.slice(-MAX_QUEUE_SIZE + 1);
  await chrome.storage.local.set({ analyticsQueue: [...trimmed, newEvent] });
}

export async function flushQueue(): Promise<void> {
  const { analyticsQueue = [] } = await chrome.storage.local.get('analyticsQueue');
  const queue = analyticsQueue as QueuedEvent[];
  if (queue.length === 0) return;

  const now = Date.now();
  const validEvents = queue.filter((e) => now - e.timestamp < MAX_RETRY_AGE_MS);

  for (const event of validEvents) {
    await sendEvent(event.name, event.params);
  }

  await chrome.storage.local.set({ analyticsQueue: [] });
}

// Service Worker起動時（= ネットワーク復帰の可能性）にflush
chrome.runtime.onStartup.addListener(flushQueue);
```

---

## プライバシー配慮

### オプトアウト実装

```typescript
// src/popup/AnalyticsToggle.tsx

export function AnalyticsToggle() {
  const [optOut, setOptOut] = useState(false);

  useEffect(() => {
    chrome.storage.local.get('analyticsOptOut').then(({ analyticsOptOut }) => {
      setOptOut(analyticsOptOut === true);
    });
  }, []);

  const handleToggle = async (checked: boolean) => {
    await chrome.storage.local.set({ analyticsOptOut: checked });
    setOptOut(checked);
  };

  return (
    <label className="analytics-toggle">
      <input
        type="checkbox"
        checked={optOut}
        onChange={(e) => handleToggle(e.target.checked)}
      />
      <span>使用状況データの収集を無効にする</span>
    </label>
  );
}
```

### CWSプライバシー審査で使える説明文テンプレ

```
この拡張機能は、機能改善を目的として匿名の使用状況データを
Google Analytics 4 に送信しています。

収集するデータ:
- 拡張機能のインストール・更新のタイミング
- どの機能が使用されたか（個人を特定する情報は含みません）
- エラーの発生有無

収集しないデータ:
- 氏名・メールアドレス等の個人情報
- 閲覧したWebページのURL
- 入力フォームの内容

データ収集は設定画面から無効にできます。
```

---

## デバッグ：GA4 Validation Endpoint

送信前にイベントの形式が正しいか確認できます。

```typescript
// src/lib/analytics-debug.ts — 開発環境でのみ使用

export async function validateEvent(
  eventName: GA4EventName,
  params: GA4EventParams
): Promise<void> {
  if (!import.meta.env.DEV) return;

  const clientId = await getOrCreateClientId();
  const payload = {
    client_id: clientId,
    events: [{ name: eventName, params }],
  };

  const url = `${GA4_CONFIG.debugEndpoint}?measurement_id=${GA4_CONFIG.measurementId}&api_secret=${GA4_CONFIG.apiSecret}`;

  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  // Validation endpointはエラー詳細をJSONで返す
  const result = await response.json();
  if (result.validationMessages?.length > 0) {
    console.warn('[GA4 Validation]', result.validationMessages);
  } else {
    console.log('[GA4 Validation] OK:', eventName);
  }
}
```

また、GA4の「Debug View」（管理 → DebugView）を使うと、送信されたイベントをリアルタイムで確認できます。`?debug_mode=true` パラメータを追加するか、debug endpointを使うことでDebug Viewに表示されます。

---

:::message
**この章で学んだこと**

- Chrome拡張でGA4を計測するにはMeasurement Protocol一択。gtag.jsはCSP・eval禁止・window不在のため使えない
- `client_id` は `crypto.randomUUID()` で生成してchrome.storage.localに永続保存。session_idはService Worker生存中のメモリ変数
- イベント名をUnion型で定義すると、存在しないイベント名がコンパイルエラーになり計測ミスを防止できる
- オフライン時のイベントはchrome.storage.localのキューに積み、Service Worker起動時にflushする
- プライバシー審査のための3原則: PII不送信・オプトアウト実装・プライバシーポリシーへの明記
:::

---

計測基盤が整いました。次の章では、ページのDOMと直接対話するコンテンツスクリプトの設計を解説します。DataPickのデータ抽出とReadMarkのスクロール位置保存——2つの実装を通じて、MutationObserver・DOMセレクター生成・CSP対処のパターンを学びます。

**→ [第6章：コンテンツスクリプト設計](./content-script-design.md)**
