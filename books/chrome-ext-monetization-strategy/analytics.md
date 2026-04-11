---
title: "第7章 — アナリティクスと収益管理：測れないものは改善できない"
---

> 第6章でペイウォールのタイミングを最適化しました。しかし「どのトリガーが効いているか」「どの拡張が本当に使われているか」を数字で把握していなければ、最適化の方向性が定まりません。この章では、Chrome拡張にGA4のMeasurement Protocolを実装し、インストールから収益転換までのファネルを数字で管理する方法を解説します。

---

## Chrome拡張の計測の難しさ

WebサイトにGoogleタグマネージャーを1行追加するだけでGA4計測が始まる——Webの世界では当たり前のことが、Chrome拡張では簡単にできません。

### Web計測と拡張計測の違い

| 項目 | Webサイト | Chrome拡張 |
|-----|---------|---------|
| GA4 gtag.js | `<script>` タグで読み込み可 | CSP制約で不可 |
| ページビュー | 自動計測 | 手動実装必要 |
| ユーザーID | Cookieで自動付与 | chrome.storage.localで管理 |
| イベント送信元 | ブラウザから直接 | Service Worker経由が必須 |
| オフライン対応 | 不要（ほぼ） | 必要（backgroundは常駐） |

Chromeのコンテンツセキュリティポリシー（CSP）により、拡張ページから外部スクリプトを読み込めません。そのため **GA4 Measurement Protocol**（HTTPで直接イベントを送信するAPI）を使うことになります。これが Chrome拡張GA4計測のデファクトスタンダードです。

---

## 必須イベント12種

全拡張に実装すべきイベントを3カテゴリに整理します。

### カテゴリ1：ライフサイクル（拡張の健康状態）

| イベント | タイミング | 用途 |
|--------|---------|-----|
| `install` | `chrome.runtime.onInstalled` (reason=install) | 新規インストール数の計測 |
| `update` | `chrome.runtime.onInstalled` (reason=update) | アップデート頻度・バージョン移行 |
| `session_start` | ポップアップ起動・アクション実行時 | DAU計算の分子 |

### カテゴリ2：機能使用（価値提供の確認）

| イベント | パラメータ | 用途 |
|--------|---------|-----|
| `feature_used` | `feature_name: string` | どの機能が使われているか |
| `aha_moment` | `feature_name: string` | Aha Moment到達の計測 |

### カテゴリ3：収益転換（マネタイズ計測）

| イベント | タイミング | 用途 |
|--------|---------|-----|
| `paywall_shown` | ペイウォール表示時 | ファネルの入口 |
| `paywall_clicked` | アップグレードボタン押下 | 意向確認 |
| `paywall_dismissed` | ✕ / 後で 押下 | 離脱分析 |
| `upgrade_started` | ExtensionPayページ遷移時 | 決済開始 |
| `upgrade_succeeded` | 課金完了後の初回起動時 | 実際の収益転換 |
| `upgrade_failed` | ExtensionPay決済失敗時 | 機会損失計測 |
| `review_prompt_shown` | レビュー依頼モーダル表示 | レビュー獲得ファネル入口 |
| `review_prompt_clicked` | 「レビューを書く」押下 | CWSページへの誘導 |

---

## 実装パターン：Measurement Protocol

### client_id の生成と保存

GA4ではユーザーを識別する `client_id` が必要です。Chrome拡張では `crypto.randomUUID()` で生成し、`chrome.storage.local` に永続保存します。

```typescript
// src/analytics.ts — GA4 Measurement Protocol 実装

const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const MEASUREMENT_ID = 'G-XXXXXXXXXX'; // GA4プロパティID
const API_SECRET = 'YOUR_API_SECRET'; // GA4管理画面で取得

async function getOrCreateClientId(): Promise<string> {
  const { ga4ClientId } = await chrome.storage.local.get('ga4ClientId');
  if (ga4ClientId) return ga4ClientId;

  const newId = crypto.randomUUID();
  await chrome.storage.local.set({ ga4ClientId: newId });
  return newId;
}

export async function sendGA4Event(
  eventName: string,
  params: Record<string, string | number> = {}
): Promise<void> {
  // オプトアウト確認
  const { analyticsOptOut } = await chrome.storage.local.get('analyticsOptOut');
  if (analyticsOptOut) return;

  const clientId = await getOrCreateClientId();

  const payload = {
    client_id: clientId,
    non_personalized_ads: true,
    events: [
      {
        name: eventName,
        params: {
          engagement_time_msec: 100, // GA4必須パラメータ
          session_id: getSessionId(),
          ...params,
        },
      },
    ],
  };

  // エラーは握りつぶす（計測失敗が本体機能に影響しないように）
  try {
    await fetch(
      `${GA4_ENDPOINT}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  } catch {
    // silent fail
  }
}

// セッションID：起動ごとに変わる一時ID（DAU計算用）
let _sessionId: string | null = null;
function getSessionId(): string {
  if (!_sessionId) _sessionId = Date.now().toString();
  return _sessionId;
}
```

### background.ts でのライフサイクルイベント送信

```typescript
// background.ts — インストール・アップデートイベント
chrome.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
  if (reason === 'install') {
    await sendGA4Event('install', {
      extension_version: chrome.runtime.getManifest().version,
    });
  } else if (reason === 'update') {
    await sendGA4Event('update', {
      from_version: previousVersion ?? 'unknown',
      to_version: chrome.runtime.getManifest().version,
    });
  }
});

// feature_used の送信例（各機能のアクション内で呼ぶ）
export async function trackFeatureUsed(featureName: string): Promise<void> {
  await sendGA4Event('feature_used', { feature_name: featureName });
}
```

---

## ファネル設計

6つのステップでインストールから収益転換までを追います。

```
install
  ↓ （脱落: 使わなかった）
session_start（翌日以降）← DAU
  ↓ （脱落: Aha Momentに到達しなかった）
aha_moment
  ↓ （脱落: Free版で満足した）
paywall_shown
  ↓ （脱落: dismissした）
upgrade_started
  ↓ （脱落: 決済を途中でやめた）
upgrade_succeeded ← 収益
```

### 各段階の脱落率の目安（S-Hub実測）

| ステップ間 | 脱落率の目安 |
|---------|-----------|
| install → session_start (翌日) | 40〜60% |
| session_start → aha_moment | 30〜50% |
| aha_moment → paywall_shown | 30〜60%（Free版の設計による） |
| paywall_shown → upgrade_started | 85〜92% |
| upgrade_started → upgrade_succeeded | 3〜8%（CVR） |

`paywall_shown → upgrade_started` の脱落が85〜92%であることに驚く方が多い。「アップグレードボタンを押さずに閉じる人が大多数」という現実を受け入れ、paywall_shown数を増やすことと、CVR（upgrade_started ÷ paywall_shown）を改善することの両輪で考えます。

---

## S-Hub Dashboardの役割

GA4を直接操作すると、18本の拡張データが混在してノイズが多くなります。S-Hub Dashboard（`tools.dev-tools-hub.xyz`）では、GA4から取得したデータを拡張別・指標別に集計して表示しています。

### extension_name マッピングの重要性

GA4にはどの拡張からのイベントか識別する仕組みがありません。各拡張に固有の `MEASUREMENT_ID` を割り当てるか、共通IDを使ってイベントパラメータに `extension_name` を含める必要があります。

```typescript
// 共通GAプロパティを使う場合（拡張名をパラメータに含める）
await sendGA4Event('feature_used', {
  feature_name: 'data_preview',
  extension_name: 'datapick', // 必須
  extension_version: chrome.runtime.getManifest().version,
});
```

S-Hub Dashboardでは `extension_name` ディメンションでフィルタリングし、拡張ごとのDAU・CVR・ペイウォールファネルを1画面で比較できます。

---

## コホート分析の具体

「インストールした週のユーザーが、7日後・30日後も使い続けているか」がリテンション指標です。

### リテンション計測（GA4探索レポート）

GA4の「探索」→「コホートデータ探索」で以下を設定します：

- **コホートに含める条件**: `install` イベントが発生
- **リテンションの計算基準**: `session_start` イベントが発生
- **粒度**: 週

S-Hubでの拡張別リテンション実測（インストール週を100%として）：

| 拡張 | 7日後 | 14日後 | 30日後 |
|-----|------|-------|-------|
| ReadMark | 61% | 52% | 44% |
| Procshot | 47% | 38% | 29% |
| DataPick | 38% | 28% | 19% |
| FocusGuard | 71% | 63% | 55% |

FocusGuardのリテンションが高いのは「毎日使うブロックツール」だからです。DataPickが低いのは「特定の作業をするときだけ使う」一発系の性質があるため。リテンションが高い拡張ほど、月額サブスクリプションのLTVが高くなります。

---

## A/Bテストと計測の接続

A/Bテストを正しく計測するには、どのバリアントを体験したかをイベントに紐付けます。

```typescript
// A/Bテストのvariant_idをイベントに含める
const PAYWALL_VARIANT = 'B'; // 'A' or 'B'、起動時にランダム割り当て

await sendGA4Event('paywall_shown', {
  trigger: 'usage_count',
  variant_id: PAYWALL_VARIANT, // GA4でフィルタリングできる
});
```

GA4でvariant_id別にCVRを比較し、統計的有意差が出たら勝ちバリアントを採用します。

**最小サンプル数の目安**: 転換率5%を検出したい場合、各バリアントに約400サンプル（paywall_shown数）が必要です。週100クリックの拡張では、1バリアントのテストに約4週間かかります。

---

## プライバシー配慮

GA4実装はCWSのプライバシー審査で確認される項目です。適切に対応しないとリジェクトされます。

### CWSで求められる対応

1. **プライバシーポリシーへの明記**: 「匿名の使用状況データをGA4で収集する」と記載
2. **PIIを送らない**: `client_id` にメールアドレス・UID等を使わない（`crypto.randomUUID()` 推奨）
3. **IPアドレス非送信**: Measurement Protocol経由では自動でマスクされる（gtag.jsと異なり）

### オプトアウトの実装

```typescript
// settings-page.tsx — アナリティクスオプトアウトのトグル
async function toggleAnalyticsOptOut(optOut: boolean): Promise<void> {
  await chrome.storage.local.set({ analyticsOptOut: optOut });

  if (!optOut) {
    // オプトインに戻したとき、オプトアウトを選んだことは送らない
    // (その行為自体がトラッキングになるため)
  }
}

// 設定UIの例
<label>
  <input
    type="checkbox"
    checked={analyticsOptOut}
    onChange={(e) => toggleAnalyticsOptOut(e.target.checked)}
  />
  使用状況の匿名データ収集を無効にする
</label>
```

CWSの審査では「データ収集の目的・収集内容・オプトアウト方法」を説明できれば通過します。「GA4で匿名の使用統計を取っています、オプトアウトは設定から可能です」という一文が審査担当者への回答になります。

---

:::message
**この章で学んだこと**

- Chrome拡張のGA4計測は Measurement Protocol 経由が唯一の方法。`client_id` は `crypto.randomUUID()` で生成し `chrome.storage.local` に永続保存する
- 必須イベント12種: ライフサイクル（install/update/session_start）・機能使用（feature_used/aha_moment）・収益転換（paywall_shown/clicked/dismissed/upgrade_started/succeeded/failed/review_prompt系）
- ファネルの現実：paywall_shown のうち upgrade_started に進むのは8〜15%。paywall_shown数の最大化とCVR改善の両輪が必要
- コホート分析でリテンション率を測ると、拡張の「使われ方の性質」（毎日型 vs 一発型）が明確になる
- プライバシー審査対応の3点：プライバシーポリシーへの明記・PII不送信・オプトアウト実装
:::

---

数字で拡張の状態を把握できるようになりました。次は「1本の拡張が別の拡張の入口になる」クロスプロモーション戦略です。18本のポートフォリオがあれば、既存ユーザーを他の拡張に誘導することで、獲得コストゼロで新規インストールを生み出せます。第8章ではその設計を解説します。

**→ [第8章：クロスプロモーション](./cross-promotion.md)**
