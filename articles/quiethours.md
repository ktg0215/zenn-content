---
title: "深夜の通知を自動でミュートするChrome拡張を作った — Web Notifications APIの罠"
emoji: "🌙"
type: "tech"
topics: ["chrome拡張機能", "javascript", "typescript", "個人開発"]
published: false
published_at: "2026-05-24 09:00"
---

「深夜0時以降はGoogleカレンダーの通知を切りたい」という要件を実装しようとして、Web Notifications APIではできないことに気づいた。

## Web Notifications APIで通知をミュートできない理由

ブラウザのWeb Notifications APIはサイトから通知を**送る**ためのAPIで、他のサイトの通知を制御する手段は提供していない。`Notification.requestPermission()` や `ServiceWorkerRegistration.showNotification()` はすべて「自分のオリジンから通知する」操作だ。

Chrome拡張でも、他のサイトが送った通知を遮断することはできない。できるのは：

- **自分の拡張が送る通知を制御する** (`chrome.notifications` API)
- **時間帯に応じてGoogleカレンダーのDOM操作を抑制する** (content script)

QuietHoursは後者のアプローチを取った。Googleカレンダーのcontent scriptで、設定したサイレント時間帯に入ったら通知バナーを非表示にする。

## alarms APIで1分ごとに時刻チェック

Service Worker（MV3のBackground）は常駐できないため、定期チェックには `chrome.alarms` が必要になる。

```typescript
chrome.alarms.create('quiethours-check', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'quiethours-check') return;
  const rules = await getRules();
  const active = getActiveRule(rules);
  // active なら content script に通知抑制を指示
});
```

`getActiveRule` は現在時刻をHH:MM形式に変換し、ルールの startTime〜endTime に含まれるか判定する。

```typescript
export function getActiveRule(rules: FocusRule[]): FocusRule | null {
  const now = new Date();
  const day = now.getDay();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return rules.find(rule =>
    rule.enabled &&
    rule.dayOfWeek.includes(day) &&
    hhmm >= rule.startTime && hhmm < rule.endTime
  ) ?? null;
}
```

シンプルな文字列比較だが、`"23:00" >= "22:00"` のような辞書順比較がHH:MM形式では正しく動くので問題ない。

## alarms精度とMV3の制約

`periodInMinutes: 1` は「最小1分間隔」であり、正確な1分おきではない。ルールの開始/終了時刻が最大1分遅れることになる。

これは通知ミュート用途では許容範囲だが、秒単位の精度が必要なユースケースには向かない。

---

QuietHoursは現在CWS公開中。Googleカレンダーの集中時間帯外の通知を自動で管理したい人向け。

https://chromewebstore.google.com/detail/okdmecodmihlgbkeacmebdikolofccfa
