---
title: "第4章 — フリーミアム実装：ExtensionPayとリバーストライアル完全実装"
---

> 第3章でstorageの設計パターンを学びました。この章では収益化の核心——ExtensionPayを使ったフリーミアム実装と、リバーストライアルのコードレベルの実装を解説します。Book 2の第5〜6章が「設計思想」なら、この章は「実装コード完全版」です。

---

## 実装の全体像

フリーミアム制御は拡張の6つのコンポーネントにまたがります。

```
background.ts
  └─ ExtensionPay 初期化・課金状態同期・アラーム管理

lib/subscription.ts
  └─ isPro() / isProOrTrial() / getSubscriptionStatus()

lib/usage-counter.ts
  └─ 使用回数カウント・月次リセット・上限チェック

constants/limits.ts
  └─ FREE_LIMITS / TRIAL_DAYS / PRICES 定数定義

popup/PaywallModal.tsx
  └─ ペイウォールUI・3トリガー対応

popup/hooks/useSubscription.ts
  └─ storage.onChanged でリアクティブ購読
```

### 状態遷移

```
インストール直後
    → [trial] 14日間全機能開放

14日後（トライアル終了）
    → [trial_expired] / 課金確認
        → [free] 機能制限あり
        → [pro]  全機能開放

課金（any状態から）
    → [pro]  全機能開放・永続

返金・サブスク解約
    → [free] 機能制限あり
```

---

## FREE_LIMITS 定数の型設計

機能ごとの制限値をひとつのファイルで管理します。将来の変更は constants を更新するだけで全体に反映されます。

```typescript
// src/constants/limits.ts

export const TRIAL_DAYS = 14;

export const FREE_LIMITS = {
  // DataPick: エクスポート行数
  exportRows: 5,
  // Procshot: 保存できるガイド数
  savedGuides: 5,
  // FocusGuard: ブロックリスト件数
  blockListItems: 5,
  // ReadMark: (Pro機能はハイライトのみ、位置保存は無制限)
  highlights: 0,
} as const satisfies Record<string, number>;

export type FreeLimitKey = keyof typeof FREE_LIMITS;

export const PRO_PRICES = {
  monthly: 3.99,
  yearly: 29.99,
  oneTime: 14.99,
} as const;

// 型チェック用ヘルパー
export function isOverLimit(key: FreeLimitKey, current: number): boolean {
  return current >= FREE_LIMITS[key];
}
```

`as const satisfies Record<string, number>` により、`FREE_LIMITS` のキーは文字列リテラル型に絞られ、値はnumber型に固定されます。将来 `number` 以外の型を入れようとするとコンパイルエラーになります。

---

## ExtensionPay 統合

ExtensionPay（https://extensionpay.com）はChrome拡張向けのStripe決済ラッパーです。CWSのDeveloper DashboardにExtension IDを登録し、APIキーを取得します。

### 初期化パターン

```typescript
// src/lib/extpay.ts — ExtensionPay初期化と状態管理

// @types/extensionpay がないため型定義を自前で用意
declare function ExtPay(extensionId: string): {
  getUser(): Promise<{ paid: boolean; trialStartedAt: Date | null; installedAt: Date }>;
  openPaymentPage(): void;
  openTrialPage(trialPeriod: string): void;
  onPaid: { addListener(cb: () => void): void };
};

const EXTENSION_ID = 'your-extension-id'; // CWSのExtension ID
let extpay: ReturnType<typeof ExtPay> | null = null;

export function getExtPay(): ReturnType<typeof ExtPay> {
  if (!extpay) extpay = ExtPay(EXTENSION_ID);
  return extpay;
}

// background.ts から起動時に呼ぶ
export async function initExtensionPay(): Promise<void> {
  const pay = getExtPay();

  // 課金完了時のコールバック
  pay.onPaid.addListener(async () => {
    await chrome.storage.local.set({
      isPro: true,
      proActivatedAt: Date.now(),
    });
    // 全コンテキストに通知（storage.onChangedで受信）
  });

  // 起動時に課金状態を同期
  await syncSubscriptionStatus();
}

export async function syncSubscriptionStatus(): Promise<void> {
  try {
    const user = await getExtPay().getUser();
    await chrome.storage.local.set({ isPro: user.paid });
  } catch {
    // ネットワーク障害時はキャッシュ済みの値をそのまま使用
  }
}
```

`manifest.json` に `extensionpay.com` へのネットワークアクセス許可が必要です。

```json
// manifest.json
{
  "host_permissions": [
    "https://extensionpay.com/*"
  ]
}
```

---

## Pro判定ロジック

```typescript
// src/lib/subscription.ts — 購読状態の判定

export type SubscriptionStatus = 'pro' | 'trial' | 'trial_expired' | 'free';

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const { isPro, installDate } = await chrome.storage.local.get([
    'isPro',
    'installDate',
  ]);

  if (isPro) return 'pro';

  if (!installDate) {
    // 初回起動: installDateを記録してトライアル開始
    await chrome.storage.local.set({ installDate: Date.now() });
    return 'trial';
  }

  const daysSinceInstall =
    (Date.now() - (installDate as number)) / (1000 * 60 * 60 * 24);

  if (daysSinceInstall <= TRIAL_DAYS) return 'trial';
  return 'trial_expired'; // トライアル終了・未課金
}

// よく使うショートハンド
export async function isPro(): Promise<boolean> {
  const status = await getSubscriptionStatus();
  return status === 'pro';
}

export async function isProOrTrial(): Promise<boolean> {
  const status = await getSubscriptionStatus();
  return status === 'pro' || status === 'trial';
}

// 機能制限ガード（Pro/Trial以外ではペイウォールを返す）
export async function requireProOrTrial(): Promise<
  { allowed: true } | { allowed: false; status: SubscriptionStatus }
> {
  const status = await getSubscriptionStatus();
  if (status === 'pro' || status === 'trial') {
    return { allowed: true };
  }
  return { allowed: false, status };
}
```

---

## Usageカウンタ（月次リセット付き）

使用回数制限型フリーミアムの場合、月次でカウンターをリセットする必要があります。

```typescript
// src/lib/usage-counter.ts — atomic incrementと月次リセット

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function incrementUsage(feature: FreeLimitKey): Promise<{
  current: number;
  limit: number;
  isOverLimit: boolean;
}> {
  const monthKey = getCurrentMonthKey();
  const storageKey = `usage_${feature}_${monthKey}`;

  // atomic read-modify-write（Service Worker 並行呼び出し対策）
  // chrome.storage.local はシリアル化されているため競合しない
  const stored = await chrome.storage.local.get(storageKey);
  const current = (stored[storageKey] as number | undefined) ?? 0;
  const next = current + 1;

  await chrome.storage.local.set({ [storageKey]: next });

  const limit = FREE_LIMITS[feature];
  return {
    current: next,
    limit,
    isOverLimit: next > limit,
  };
}

export async function getUsage(feature: FreeLimitKey): Promise<number> {
  const monthKey = getCurrentMonthKey();
  const storageKey = `usage_${feature}_${monthKey}`;
  const stored = await chrome.storage.local.get(storageKey);
  return (stored[storageKey] as number | undefined) ?? 0;
}
```

`chrome.storage.local` はChrome内部でシリアライズされているため、Service Workerが並行して呼ばれても書き込み競合は発生しません。月次リセットは `monthKey` を変えることで自動的に達成されます（古い月のデータは残りますが、参照されなくなります）。

---

## Paywall UI コンポーネント

```typescript
// src/popup/PaywallModal.tsx

import { getExtPay } from '../lib/extpay';
import { PRO_PRICES, FREE_LIMITS, FreeLimitKey } from '../constants/limits';

type PaywallTrigger =
  | { type: 'limit_reached'; feature: FreeLimitKey; current: number }
  | { type: 'pro_feature_clicked'; featureName: string }
  | { type: 'trial_expired' };

interface PaywallModalProps {
  trigger: PaywallTrigger;
  onClose: () => void;
}

export function PaywallModal({ trigger, onClose }: PaywallModalProps) {
  const handleUpgrade = () => {
    getExtPay().openPaymentPage();
  };

  const title = (() => {
    switch (trigger.type) {
      case 'limit_reached':
        return `今月の利用上限（${FREE_LIMITS[trigger.feature]}回）に達しました`;
      case 'pro_feature_clicked':
        return `${trigger.featureName} は Pro 版の機能です`;
      case 'trial_expired':
        return '14日間のトライアルが終了しました';
    }
  })();

  return (
    <div className="paywall-overlay" onClick={onClose}>
      <div className="paywall-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose} aria-label="閉じる">
          ✕
        </button>

        <h2 className="paywall-title">{title}</h2>

        <ul className="pro-features">
          <li>✓ 全機能を無制限で利用</li>
          <li>✓ 新機能の優先アクセス</li>
          <li>✓ 優先サポート</li>
        </ul>

        <div className="price-block">
          <span className="price">${PRO_PRICES.monthly}</span>
          <span className="period">/月</span>
          <span className="daily">（1日約13円）</span>
        </div>

        <button className="upgrade-btn" onClick={handleUpgrade}>
          Pro版にアップグレード
        </button>

        <p className="cancel-note">いつでもキャンセル可能</p>
      </div>
    </div>
  );
}
```

---

## アンロックの即時反映

課金完了後、ページリロードなしにPro機能が使えるようにするには、`chrome.storage.onChanged` を使います。

```typescript
// src/popup/hooks/useSubscription.ts

import { useState, useEffect } from 'react';
import { getSubscriptionStatus, SubscriptionStatus } from '../../lib/subscription';

export function useSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);

  useEffect(() => {
    // 初期値取得
    getSubscriptionStatus().then(setStatus);

    // isPro が変化したら即時反映
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area === 'local' && 'isPro' in changes) {
        getSubscriptionStatus().then(setStatus);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return {
    status,
    isPro: status === 'pro',
    isProOrTrial: status === 'pro' || status === 'trial',
    isLoading: status === null,
  };
}
```

ExtensionPayの `onPaid` コールバックが `chrome.storage.local` に `isPro: true` を書き込む → `storage.onChanged` が発火 → Reactの状態が更新 → UIが即時切り替わる、という流れです。

---

## 失敗・エラーハンドリング

| シナリオ | 対応 |
|--------|-----|
| 課金ページを開いたが支払いしなかった | `onPaid` が発火しない。ペイウォールの「✕」で閉じれば元の状態に戻る |
| ネットワーク障害でExtPay.getUser()失敗 | キャッシュ済みの `isPro` をそのまま使用（optimistic）。オフラインでも動作継続 |
| 返金後の解約 | ExtensionPayのwebhookが `isPro` をfalseに更新。次回起動時にsyncStatus()で反映 |
| 決済エラー | ExtensionPayのUIで表示される。拡張側では特別な処理不要 |

---

## テスト可能性：開発用コマンド

開発中にフリーミアムの各状態を手動で切り替えるためのdevtools実装です。

```typescript
// src/lib/dev-tools.ts — 開発環境専用

const isDev = process.env.NODE_ENV === 'development';

export const devTools = isDev
  ? {
      // Pro強制付与
      async forcePro(): Promise<void> {
        await chrome.storage.local.set({ isPro: true });
        console.log('[DevTools] isPro = true');
      },
      // Free状態にリセット
      async forceFreeTrial(): Promise<void> {
        await chrome.storage.local.set({
          isPro: false,
          installDate: Date.now(), // トライアル開始
        });
        console.log('[DevTools] Trial restarted');
      },
      // トライアル期限切れを擬似
      async forceTrialExpired(): Promise<void> {
        const expiredDate = Date.now() - 15 * 24 * 60 * 60 * 1000; // 15日前
        await chrome.storage.local.set({
          isPro: false,
          installDate: expiredDate,
        });
        console.log('[DevTools] Trial expired (15 days ago)');
      },
      // 使用カウントリセット
      async resetUsage(feature: string): Promise<void> {
        const monthKey = new Date().toISOString().slice(0, 7);
        await chrome.storage.local.remove(`usage_${feature}_${monthKey}`);
        console.log(`[DevTools] Usage reset: ${feature}`);
      },
      // 全storage表示
      async dump(): Promise<void> {
        const all = await chrome.storage.local.get(null);
        console.table(all);
      },
    }
  : null;
```

本番ビルドでは `process.env.NODE_ENV === 'development'` が `false` になり、devToolsは `null` になります。バンドラーのdead code eliminationにより、devツールのコードは本番バンドルに含まれません。

---

:::message
**この章で学んだこと**

- フリーミアム制御は6コンポーネント（background/subscription/usage-counter/limits/PaywallModal/useSubscription）に責任分離する
- `FREE_LIMITS` は `as const satisfies Record<string, number>` で型安全に定数化。変更は1ファイルで全体に反映
- `chrome.storage.local` はシリアライズされているためService Worker並行呼び出しでも書き込み競合しない。月次リセットはmonthKeyで自動達成
- `storage.onChanged` → React state更新で課金完了を即時反映。ページリロード不要
- 開発用devToolsは `NODE_ENV === 'development'` で分岐し、本番バンドルからdead code eliminationで除外
:::

---

フリーミアムの実装基盤が整いました。次は「どの機能が使われているか」「ペイウォールはどれだけ転換しているか」を計測する基盤です。第5章では、GA4 Measurement Protocolの完全実装——12イベントの送信ロジックからオプトアウトまでをコードとともに解説します。

**→ [第5章：GA4 Measurement Protocol実装](./ga4-implementation.md)**
