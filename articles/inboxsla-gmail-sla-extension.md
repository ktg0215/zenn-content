---
title: "メール応答時間を自動トラッキングするChrome拡張を作った話 — InboxSLA"
emoji: "📬"
type: "tech"
topics: ["chrome拡張", "typescript", "react", "個人開発", "生産性"]
published: false
---

## なぜ作ったのか

フリーランスや小規模チームで働いていると、「クライアントへのメール返信が遅れていないか」という管理が地味に難しい。CRM を使うほどではないが、Gmail の未読バッジだけでは応答期限がわからない。

**InboxSLA** は、クライアントごとに SLA（サービスレベルアグリーメント）の応答期限を設定し、Gmail スレッドの応答遅延をリアルタイムで検出する Chrome 拡張だ。「この取引先には 24 時間以内に返信する」というルールを登録しておくだけで、期限超過・期限接近を自動アラートしてくれる。

## 主な機能

- **クライアント登録**: ドメイン（例: `acme.com`）ごとに SLA 時間（時間単位）を設定
- **スレッドトラッキング**: Gmail コンテンツスクリプトが受信スレッドを自動検出・監視
- **ステータスバッジ**: 期限超過（赤）・期限接近（オレンジ）・問題なし（緑）を一目で識別
- **ポップアップダッシュボード**: クライアント一覧と未返信スレッド数をリスト表示
- **ライト/ダークモード・多言語対応**: 日本語・英語・韓国語・スペイン語

## 技術スタック

```
InboxSLA/
├── entrypoints/
│   ├── popup/        # React ダッシュボード
│   ├── sidepanel/    # 詳細ビュー（サイドパネル）
│   ├── content.ts    # Gmail スレッド検出
│   ├── extensionpay-cs.content.ts  # ExtPay 用 CS
│   └── background.ts # 5 分ごとの SLA チェックアラーム
├── components/
│   ├── CrossPromo.tsx
│   └── ReviewModal.tsx
└── lib/
    ├── constants.ts  # FREE_LIMITS, SLA_APPROACHING_THRESHOLD_MS
    ├── storage.ts    # Client / TrackedThread の永続化
    └── analytics.ts  # GA4 イベント送信
```

### 5 分ごとの SLA チェック

`chrome.alarms` API を使い、5 分ごとにバックグラウンドで SLA チェックを実行する。

```typescript
// background.ts
chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const threads = await getTrackedThreads();
  const clients = await getClients();
  for (const thread of threads) {
    const client = clients.find(c => thread.from.endsWith(c.domain));
    if (!client) continue;
    const status = getSlaStatus(thread, client);
    if (status === 'overdue' || status === 'approaching') {
      await notifyIfNeeded(thread, status);
    }
  }
});
```

`SLA_APPROACHING_THRESHOLD_MS = 2 * 60 * 60 * 1000`（2 時間）以内になると「期限接近」として先手を打った通知を出す。

### Gmail スレッドの検出

コンテンツスクリプトは `MutationObserver` で Gmail の DOM 変更を監視し、新着メールを検出したら送信元ドメインと受信日時を `background.ts` に送信する。

```typescript
const msg: TrackedThread = {
  id: threadId,
  from: senderEmail,
  subject: subjectText,
  receivedAt: Date.now(),
};
chrome.runtime.sendMessage({ type: 'THREAD_DETECTED', thread: msg });
```

## フリーミアム設計

| プラン | 制限 |
|--------|------|
| **Free** | クライアント 3 件 / アラート 10 件 / 月 |
| **Pro（月額 $6）** | 無制限クライアント・アラート + スレッドエクスポート |

`FREE_LIMITS.maxClients = 3` / `FREE_LIMITS.maxAlertsPerMonth = 10` を定数で管理し、UI の分岐は全てこの定数を参照する。ハードコードを避けることで、将来のプラン変更が 1 ファイルの修正で済む設計にした。

## 設計で工夫した点

- **ドメインベース管理**: メールアドレスではなくドメインで紐付けることで、同じ会社から複数のアドレスが来ても一元管理できる
- **サイドパネル**: MV3 の `sidePanel` API を使い、Gmail を開いたまま詳細確認できる
- **5 分ポーリング + 受信時即時検出**: バッテリー消費を抑えつつ、見落としを防ぐハイブリッド設計

## 今後の展開

- Outlook / Fastmail へのコンテンツスクリプト対応
- Slack や Notion カレンダーとの連携
- チームダッシュボード（複数ユーザーの SLA を一元管理）

メール管理に悩んでいるフリーランス・スモールチームにぜひ使ってみてほしい。

https://chromewebstore.google.com/detail/fooenikjagbabhodgpohljldfbpggagi
