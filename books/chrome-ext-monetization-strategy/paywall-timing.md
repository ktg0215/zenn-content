---
title: "第6章 — ペイウォールタイミング最適化：いつ・どこで・何回見せるか"
---

> 第5章でフリーミアムの境界線（何をFreeにして何をProにするか）を設計しました。しかし同じ境界設計でも、ペイウォールを表示するタイミング次第で転換率は大きく変わります。この章では「いつ・どこで・何回見せるか」という戦術面を、実装コードとGA4測定設計まで込みで解説します。

---

## タイミングの4象限

ペイウォールの表示タイミングは「早さ」と「文脈のズレ」の2軸で考えられます。

```
              文脈あり（使用中）
                    ↑
    【早すぎる】    |    【ちょうどよい】
    価値体験前に    |    高価値アクションの
    壁を出す        |    瞬間に出す
                    |
文脈なし ←──────────────────────→ 文脈あり
（起動時等）        |                （操作中）
                    |
    【無表示】      |    【遅すぎる】
    転換機会を      |    もう諦めた
    逃し続ける      |    ユーザーに出す
                    ↓
              文脈なし（非操作中）
```

**最高の位置**: 右上の「文脈あり × ちょうどよいタイミング」。ユーザーが「これをやりたい」と思ったその瞬間にペイウォールを提示する。

**最悪の位置**: 左上の「早すぎる × 文脈あり」。インストール直後や初回操作でペイウォールを出す。価値を体験していないユーザーにとって壁は「詐欺」に見える。

---

## 「Aha Moment」の前にペイウォールを出さない

**Aha Momentとは**: ユーザーが「この拡張を使い続けよう」と決定的に感じる瞬間のことです。Slack研究で有名になった概念で、Chrome拡張にも適用できます。

Aha Momentの前にペイウォールを出すと、価値を理解する前に離脱されます。Aha Momentの後であれば「この価値を失いたくない」という動機が生まれます。

### S-Hub 3拡張のAha指標

| 拡張 | Aha Moment（推定） | 測定方法 |
|-----|----------------|---------|
| **DataPick** | 最初のデータ抽出プレビューを見た瞬間 | `preview_shown` イベント計測 |
| **Procshot** | 生成されたステップガイドを初めて閲覧した瞬間 | `guide_viewed` イベント計測 |
| **ReadMark** | 保存した位置から記事を再開した瞬間 | `position_restored` イベント計測 |

Aha Momentは仮説から始め、GA4のコホート分析で検証します。「Aha Momentを経験したユーザー」と「経験しなかったユーザー」の14日後継続率を比べると、Aha Momentの正しさを確認できます。

---

## 使用回数ベースのトリガー

「N回使用後に初めてペイウォールを表示する」設計です。最も実装しやすく、Aha Momentを経験させてから表示できます。

### 最適Nの決め方

**訂正**: 本書の初版には、ここに「DataPick で行った A/B テストの結果」として4通りの初回表示タイミングの転換率表を載せていました。**その A/B テストは実施していません。** 表の数値の出所を示すことができないため、表ごと削除します。

実際のところ、個人開発の規模では A/B テストは成立しにくいです。転換率5%を検出するには各バリアントに数百件のペイウォール表示が必要で（本書 第7章にその試算があります）、週に数十件しか出ない拡張では1バリアントに数ヶ月かかります。私たちもそれを満たせていません。

**∴ N は測って決めるのではなく、設計から決めることになります。** 考え方だけ書きます: ペイウォールは「価値を体験し終えた直後」に置く。N は「その拡張で価値が伝わるのに必要な最小回数」であって、汎用の最適値はありません。1回で伝わる道具なら1回、繰り返して初めて効く道具ならもっと後です。**この置き方が効いたかどうかは、私たちは測っていません。**

### 実装例（カウンタ + ペイウォール呼び出し）

```typescript
// background.ts — 使用回数カウンタとペイウォールトリガー
const PAYWALL_TRIGGER_COUNT = 3;
const PAYWALL_COOLDOWN_DAYS = 3; // 一度表示後、次に表示するまでの最低日数

async function trackUsageAndCheckPaywall(featureName: string): Promise<boolean> {
  const { usageCount, lastPaywallShown, isPro } =
    await chrome.storage.local.get(['usageCount', 'lastPaywallShown', 'isPro']);

  // Pro済みならスキップ
  if (isPro) return false;

  const newCount = (usageCount ?? 0) + 1;
  await chrome.storage.local.set({ usageCount: newCount });

  // クールダウン確認（連続表示防止）
  if (lastPaywallShown) {
    const daysSince = (Date.now() - lastPaywallShown) / (1000 * 60 * 60 * 24);
    if (daysSince < PAYWALL_COOLDOWN_DAYS) return false;
  }

  // N回目に達したらペイウォール表示
  if (newCount === PAYWALL_TRIGGER_COUNT) {
    await chrome.storage.local.set({ lastPaywallShown: Date.now() });
    return true; // ペイウォール表示を要求
  }

  return false;
}

// popup.ts での使用例
const shouldShowPaywall = await trackUsageAndCheckPaywall('data_preview');
if (shouldShowPaywall) {
  sendGA4Event('paywall_shown', { trigger: 'usage_count', count: 3 });
  renderPaywallModal();
}
```

---

## 機能アンロックベースのトリガー

ユーザーが**Pro機能に触れた瞬間**だけペイウォールを表示する方法です。「使おうとしたら壁があった」という文脈で提示されるため、動機が明確です。

### Soft block（プレビュー付き）vs Hard block

**Soft block（推奨）**: Pro機能のプレビューを一瞬見せてからペイウォールを表示する。「使えそうなのに使えない」という欲求を生む。

```typescript
// content.ts — Soft block の実装例（DataPickのエクスポート機能）
async function handleExportClick(data: ScrapedData[]) {
  const isPro = await checkProStatus();

  if (!isPro) {
    // プレビュー：エクスポートダイアログを0.5秒だけ表示
    showExportPreview(data.slice(0, 3)); // 最初の3行だけ見せる

    setTimeout(() => {
      dismissExportPreview();
      sendGA4Event('paywall_shown', { trigger: 'feature_unlock', feature: 'export' });
      showPaywallModal({
        title: 'データをエクスポートするにはProが必要です',
        highlightFeature: 'export',
      });
    }, 600);

    return;
  }

  // Pro: 実際のエクスポート処理
  await exportToCSV(data);
}
```

**Hard block**: 機能ボタンをグレーアウトしてクリックできなくする。視覚的にはわかりやすいが、「なぜ使えないのかわからない」という混乱を生む場合がある。ボタンにツールチップ（「Pro版で利用可能」）を付ければ緩和できます。

---

## 時間ベースのトリガー

インストールからN日後に自動的にペイウォールを表示する方法。リバーストライアルの「トライアル終了」通知がこれに該当します。

### 実装と、効果について言えないこと

**訂正**: 初版はここに「Procshotでのデータ」として通知タイミング別の転換率（7日後 2.1% / 14日後 3.2% / 30日後 0.9%）を載せていました。**削除します。** Procshot で最初の課金が発生したのは本書を出した後です。3通りを比べる分子がありませんでした。

実装上の注意だけは残します。「14日後」の通知は ServiceWorker から送るため、ユーザーがブラウザを開いていない間は届きません。**通知が届いた率すら、私たちは計測していません。**

```typescript
// background.ts — 14日後トライアル終了アラーム
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    await chrome.storage.local.set({ installDate: Date.now() });

    // 14日後にアラームを設定
    chrome.alarms.create('trial_end_notification', {
      delayInMinutes: 14 * 24 * 60,
    });
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'trial_end_notification') {
    const { isPro } = await chrome.storage.local.get('isPro');
    if (isPro) return; // すでに有料転換済み

    // 通知を送る
    chrome.notifications.create('trial_end', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Procshot トライアル終了のお知らせ',
      message: 'Pro版の無料トライアル期間が終了しました。継続するにはアップグレードをご検討ください。',
    });

    sendGA4Event('paywall_shown', { trigger: 'trial_end', days: 14 });
  }
});
```

---

## コンテキストベースのトリガー（最高CVR）

「大量データをエクスポートしようとした瞬間」「バッチ実行を選択した瞬間」など、**高価値アクションの直前**にペイウォールを表示します。

**訂正**: 初版はここに「DataPickで計測した転換率比較」としてトリガー種別ごとの転換率（使用回数 3.1% / 機能アンロック 4.7% / コンテキスト 6.2% / 時間 3.2%）を載せていました。**削除します。** DataPick には有料転換の実績がありません。

トリガーの**分類**は使えます（使用回数 / 機能アンロック / コンテキスト / 時間）。50行以上のデータ抽出を試みたユーザーが「大量データを扱いたい真剣なユーザー」である、という設計の読みも変わりません。**どれが自分の拡張で効くかは、あなたのデータで確かめてください。私たちは確かめていません。**

---

## 連続ペイウォール回避

1セッション中に複数回ペイウォールを出すと、ユーザーは「この拡張は使えない」と感じます。

### セッション内フラグの実装

```typescript
// popup.ts — セッション内ペイウォール表示管理
// sessionStorage はタブを閉じると消える → 1セッション制限に最適

const SESSION_PAYWALL_KEY = 'paywallShownThisSession';

function hasShownPaywallThisSession(): boolean {
  return sessionStorage.getItem(SESSION_PAYWALL_KEY) === 'true';
}

function markPaywallShownThisSession(): void {
  sessionStorage.setItem(SESSION_PAYWALL_KEY, 'true');
}

// ペイウォール表示の統合関数
async function maybeShowPaywall(trigger: string): Promise<void> {
  // 1. Proユーザーにはスキップ
  const { isPro } = await chrome.storage.local.get('isPro');
  if (isPro) return;

  // 2. このセッションで既に表示済みならスキップ
  if (hasShownPaywallThisSession()) return;

  // 3. クールダウン確認（前回表示から3日以内ならスキップ）
  const { lastPaywallShown } = await chrome.storage.local.get('lastPaywallShown');
  if (lastPaywallShown) {
    const daysSince = (Date.now() - lastPaywallShown) / (1000 * 60 * 60 * 24);
    if (daysSince < 3) return;
  }

  // 表示
  markPaywallShownThisSession();
  await chrome.storage.local.set({ lastPaywallShown: Date.now() });
  sendGA4Event('paywall_shown', { trigger });
  renderPaywallModal();
}
```

### 「後で」を選んだユーザーへの再呼び出し

ペイウォールを「後で」「✕」で閉じたユーザーには、**3日後**に再表示します。1日後は早すぎて怒らせる、7日後は遅すぎて忘れられる——という設計判断です。（初版はここに「3日後が最も転換率が高い（S-Hub実測）」と書いていましたが、この比較は実測していません。訂正します。）

---

## 測定設計：GA4で何を計測するか

### 必須イベント3つ

```typescript
// analytics.ts — ペイウォール計測イベント
type PaywallEventParams = {
  trigger: 'usage_count' | 'feature_unlock' | 'time_based' | 'context' | 'trial_end';
  feature?: string;
  count?: number;
  days?: number;
};

// 1. ペイウォールが表示された
sendGA4Event('paywall_shown', params);

// 2. ペイウォールの「アップグレード」ボタンを押した
sendGA4Event('paywall_clicked', { ...params, action: 'upgrade' });

// 3. ペイウォールを閉じた（「後で」「✕」）
sendGA4Event('paywall_dismissed', { ...params, action: 'dismiss' });
```

### CVR計算と分析

```
ペイウォールCVR = paywall_clicked ÷ paywall_shown

# 注: 初版はここに「理想値（S-Hub実測ベース）」としてトリガー別の CVR 目安を
# 載せていましたが、実測の出所を示せないため削除しました。
# 自分の拡張の CVR は上の式で自分のデータから出してください。
```

`paywall_shown` と `paywall_clicked` をGA4のファネルレポートで追うことで、どのトリガーが最も効率的かを定量評価できます。

---

:::message
**この章で学んだこと**

- ペイウォールは「Aha Momentの後・高価値アクションの瞬間」に置く設計にする（効果の数値は私たちは測れていない）
- 使用回数ベースの N は「その拡張で価値が伝わる最小回数」から設計で決める。汎用の最適値はない
- 1セッション中の連続表示はsessionStorageでブロック。前回表示から3日のクールダウンを設ける
- GA4の必須イベントは `paywall_shown` / `paywall_clicked` / `paywall_dismissed` の3つ。CVR = clicked ÷ shown
- Soft blockでプレビューを0.5秒見せてからペイウォール表示すると「欲求→解決」の流れが自然になる
:::

---

どのタイミングでペイウォールを出すかを最適化しました。しかし「どのユーザーが転換しやすいか」「どの機能が本当に使われているか」を知らなければ、最適化の方向性が定まりません。第7章では、GA4・CWSのAnalytics・独自ダッシュボードを組み合わせて、拡張機能の収益を数字で把握する方法を解説します。

**→ [第7章：アナリティクスと収益管理](./analytics.md)**
