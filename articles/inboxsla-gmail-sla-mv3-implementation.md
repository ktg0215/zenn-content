---
title: "Gmailに「返信SLA」を持たせる拡張を作った話 — alarms + DOM注入の現実解"
emoji: "📧"
type: "tech"
topics: ["chromeextension", "gmail", "個人開発", "typescript", "wxt"]
published: true
---

## 「あの案件、いつまでに返信って言ったっけ？」

フリーランスや受託開発をやっていると、ある日気づく。
「クライアントAには24時間以内、Bには48時間以内、Cは即レス」
そんな返信ルールを口約束で持っているうちに、Gmailの未読リストが増え、ある朝に重要案件のスレッドを掘り出すと**実は3日前に届いていた**——契約打ち切りまでは行かなくても、信頼の減点は確実に起きる。

私自身、月3〜4件の取引先を抱える時期にこれをやらかして、CRMを入れるほどでもないがGmail単体ではどうしようもない領域だと痛感した。
そこで作ったのが **InboxSLA** という Chrome 拡張だ。本記事ではその実装の現実解と、Pro 課金境界をどう引いたかを共有する。

CWS: https://chromewebstore.google.com/detail/fooenikjagbabhodgpohljldfbpggagi

## なぜ既存ツールではダメだったか

「Gmailに期限を持たせたい」という要望に対する選択肢は大きく3つあった。

| 選択肢 | 問題点 |
|---|---|
| HubSpot / Streak など CRM 拡張 | 課金が月$15〜、機能が広すぎてSLA以外も覚える必要がある |
| Gmail 公式の「スヌーズ」 | 受信側のリマインダー専用、SLA という発想ではない |
| Boomerang | リマインダーは送信側、しかも自動判定なし |

欲しかったのは「**ドメインごとに違うSLAを宣言して、受信トレイで一覧視覚化する**」という単機能ツール。CRM ほど大層なものではなく、Gmail の見た目をそのまま延長したい。

そして実装方針の制約として、

- **MV3** で Service Worker ベース
- Gmail の DOM に**外部CSSを差し込まない**（Gmail の更新で巻き添えにならない）
- メール本文は**ローカル処理のみ**、外部送信なし

を最初に決めた。

## 実装の中核 — alarms + storage + DOM 注入

### 1. SLA 期限計算は alarms API で

Service Worker は 30 秒のアイドルで止まる前提なので、定期実行には `chrome.alarms` を使う。InboxSLA では 5 分間隔で1ステップずつチェックする方針にした。

```typescript
// lib/constants.ts
export const ALARM_NAME = 'sla-check';
export const ALARM_PERIOD_MINUTES = 5;
export const SLA_APPROACHING_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2h
```

`onInstalled` のタイミングでアラームを登録し、SW 再起動後も続くようにする。

```typescript
// entrypoints/background.ts
chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    checkSlaAlerts().catch(() => {});
  }
});
```

`checkSlaAlerts()` の中では、追跡中の各スレッドについて「クライアントの SLA 時間 - 経過時間」を計算し、残り 2 時間を切ったら approaching、0 を割ったら overdue として通知を出す。

```typescript
const slaMs = client.slaHours * 60 * 60 * 1000;
const elapsed = now - thread.receivedAt;
const remaining = slaMs - elapsed;

const shouldAlert =
  (remaining <= SLA_APPROACHING_THRESHOLD_MS && remaining > 0) ||
  (remaining <= 0 && elapsed - slaMs < ALARM_PERIOD_MINUTES * 60 * 1000);
```

下半分の条件が地味に重要で、「期限切れの瞬間に1回だけ通知する」ためにアラーム間隔（5 分）以内に超過したものだけを拾うようにしている。これがないと毎回 5 分おきに「Overdue!」を投げ続けることになる。

### 2. Gmail への DOM 注入は最小サーフェスで

content script は `https://mail.google.com/*` のみで動かし、スレッドの一覧行（`tr.zA`）にバッジを差し込む。Gmail は SPA なので `MutationObserver` で動的に追加される行も拾う。

```typescript
// entrypoints/content.ts
const rows = document.querySelectorAll('tr.zA, [role="main"] tr[jsaction]');

rows.forEach((row) => {
  const domain = extractSenderDomain(row);
  if (!domain) return;
  const client = clients.find((c) => domain.endsWith(c.domain));
  if (!client) return;
  injectBadge(row, client, extractThreadTimestamp(row) ?? Date.now());
});
```

バッジ自体は `inline-flex` の `span` で、style は CSS ではなく `style.cssText` で直接書き込んでいる。理由は単純で、外部 stylesheet を Gmail に注入すると Gmail 側の class 衝突や CSP の影響を受ける可能性があり、コンポーネント単位でスタイルを閉じ込めた方が壊れにくい。

```typescript
badge.style.cssText = [
  'display:inline-flex',
  'padding:1px 6px',
  'border-radius:9999px',
  'font-size:10px',
  'font-weight:600',
  'margin-left:6px',
  'pointer-events:none',
].join(';');
```

色も「残り時間」によって動的に変える。

```typescript
function getBadgeStyle(remainingMs: number) {
  if (remainingMs <= 0) {
    return { bg: '#ef4444', text: 'OVERDUE' };       // 赤
  }
  if (remainingMs <= SLA_APPROACHING_THRESHOLD_MS) {
    return { bg: '#f97316', text: `${Math.ceil(remainingMs / 3_600_000)}h left` }; // オレンジ
  }
  return { bg: '#22c55e', text: `${Math.floor(remainingMs / 3_600_000)}h` };       // 緑
}
```

### 3. クライアント別タイマー設計

ドメイン → SLA 時間のマッピングは `chrome.storage.local` に保存し、background ↔ content の通信は Message API で済ませる。

```typescript
// background.ts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_CLIENTS') {
    getClients().then(sendResponse).catch(() => sendResponse([]));
    return true; // 非同期 sendResponse のため必須
  }
});
```

content script は 2 分おきにクライアントリストを再フェッチし、加えて 1 分ごとに行を再スキャンしてバッジの残り時間を更新する。Gmail を開きっぱなしでも「あと 3h」→「あと 2h」と数字が減っていく。

```typescript
const intervalId = setInterval(() => scanRows(), 60_000);
```

`return () => { observer.disconnect(); clearInterval(intervalId); }` でクリーンアップも忘れずに。

## Pro 機能の境界をどう引いたか

InboxSLA は ExtensionPay でフリーミアム化している。ここで悩んだのは「**何を有料にすると Gmail で使い続けたいユーザーが課金してくれるか**」。

実装上の境界は `lib/constants.ts` の 1 ファイルに集約してある。

```typescript
export const FREE_LIMITS = {
  maxClients: 3,
  maxAlertsPerMonth: 10,
} as const;
```

設計判断は3つ。

**(A) クライアント数を 3 件に絞る**
個人開発ツールの相場でいうと「FREE で何件まで」は永遠の論争だが、InboxSLA の場合は「**契約を3件持っている時点でフリーランスとして本気度がある**」というシグナルとみなせる。3件目までは無料体験、4件目から課金してもらう。実装は popup 側で `clients.length < FREE_LIMITS.maxClients` を見て `+ Add Client` ボタンを `Upgrade to Pro` に差し替えるだけ。

**(B) 月の通知回数を 10 回に絞る**
これが一番効く制限だと判断した。月10通までは「忘れたとき思い出させてくれる便利ツール」、それ以降は「business critical なツール」になる。実装は `getAlertsThisMonth()` でカレンダー月単位のカウンタを `chrome.storage.local` に保存し、月が変わったら自動でゼロに戻す。

```typescript
// lib/storage.ts
function getMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function getAlertsThisMonth(): Promise<number> {
  const result = await chrome.storage.local.get(['alertsThisMonth', 'alertsMonthKey']);
  const savedKey = result['alertsMonthKey'] as string | undefined;
  if (savedKey !== getMonthKey()) {
    await chrome.storage.local.set({ alertsThisMonth: 0, alertsMonthKey: getMonthKey() });
    return 0;
  }
  return (result['alertsThisMonth'] as number | undefined) ?? 0;
}
```

`maxAlerts = proStatus ? Infinity : FREE_LIMITS.maxAlertsPerMonth` で背景処理側でも引き締める。

**(C) Pro ステータスはキャッシュする**
ExtPay の `getUser()` を毎フレーム叩くと UI がもたつくので 5 分 TTL のキャッシュを挟む。`onPaid` イベントでキャッシュをクリアするので、課金直後は即座に Pro UI に切り替わる。

```typescript
// lib/extpay.ts
onPaid(() => {
  setCachedProStatus(true);
  sendGA4Event('upgrade_completed');
});
```

## Aha モーメントは「赤くなった瞬間」

ユーザーから一番反応があったのは、初期セットアップ後に Gmail を開いて「**昨日の問い合わせスレッドが赤いバッジで OVERDUE と表示された**」瞬間だった。
受信トレイは見ていたはずなのに、なぜか頭から抜け落ちていた案件が一目で炙り出される。これがあるから「常駐させておく価値がある」と感じてもらえる。

逆に「**緑のバッジが並ぶ平和な受信トレイ**」も等価に意味があって、SLA 内に収まっている安心感が可視化されることで、メールチェックのストレスが減る。

## まとめ

- Gmail に SLA を持たせるだけなら CRM は要らない、MV3 + alarms + DOM 注入で十分
- DOM 注入は外部 CSS を入れず `style.cssText` でコンポーネント完結
- Service Worker の 30 秒寿命前提で、状態は全部 `chrome.storage.local` に
- フリーミアムの境界は「クライアント数 × 月通知回数」で本気度を測る

InboxSLA は CWS で公開中で、無料で 3 クライアントまで使える。Gmail 単体の限界を感じている人はぜひ試してみてほしい。

🔗 [InboxSLA — Chrome Web Store](https://chromewebstore.google.com/detail/fooenikjagbabhodgpohljldfbpggagi)
🔗 [S-Hub — 個人開発者向け Chrome 拡張集](https://dev-tools-hub.xyz/extensions/inboxsla/)
