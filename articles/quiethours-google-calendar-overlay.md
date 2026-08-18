---
title: "Googleカレンダーにフォーカスタイムをオーバーレイ表示する Chrome 拡張を作った"
emoji: "🌙"
type: "tech"
topics: ["chrome拡張", "個人開発", "typescript", "wxt", "googlecalendar"]
published: true
---

## 「この時間は会議入れないで」を視覚化したかった

リモートワーク中心になってから、フォーカスタイム（深い作業時間）の確保が
本気で難しくなった。Slack や Google Calendar で「12-15時はミーティング不可」
と書いておいても、相手のカレンダー UI 上では普通に空いて見えるから、
普通にミーティングを入れられる。

予定の重複を防ぐにはどうすればいいか。
答えは「相手のカレンダー UI に直接、自分のフォーカス時間を視覚化して見せる」だった。

それを実装した Chrome 拡張が **Quiethours** ([CWS](https://chromewebstore.google.com/detail/okdmecodmihlgbkeacmebdikolofccfa))。
この記事ではフォーカスタイムを Google カレンダーのグリッドに半透明オーバーレイとして
描画する方法と、SPA で再描画される DOM を追従するための観察パターンを書く。

## なぜ Calendar API を使わなかったのか

最初は Google Calendar API + OAuth2 で「集中時間」の予定を作ろうかと思った。
やめた理由は3つ。

1. **OAuth2 は CWS 審査が長い** — calendar.events 権限のレビューは1〜2週間ストップする
2. **個人カレンダーへの書き込みは怖い** — 既存予定が消える事故の責任は取れない
3. **見せ方が固定される** — Google Calendar 標準の予定として描画されるので、色やラベルがアプリ依存

そこで方針を変えた。「**書き込まない、見せるだけ**」。
content script で `calendar.google.com` の DOM に半透明 div をオーバーレイすれば、
ユーザー自身のカレンダーには何の変更も加えずに視覚化だけできる。
権限は `host_permissions: ["https://calendar.google.com/*"]` だけで済む。
OAuth2 不要、CWS 審査もすんなり通った（公開 1 週間以内）。

## 実装の中核

### 1. Google Calendar の時間グリッドを掴む

最大の難所は「時間グリッドの DOM をどう特定するか」。
Google Calendar はクラス名がビルドごとにミニファイされるので、
`.KF4T6b` のような見た目で特定するのは事故る。

なので**安定属性を優先順位付き**で探す:

```ts
const timeGrid =
  // 優先1: 既存の予定要素から逆引き（最も安定）
  document.querySelector('[data-dtstart]')
    ?.closest('[role="gridcell"]')
    ?.closest('[role="row"]')
    ?.parentElement
  // 優先2: data 属性（中程度）
  ?? document.querySelector('[data-column]')
  // 優先3: ミニファイクラス（壊れやすい、最後の砦）
  ?? document.querySelector('.KF4T6b'); // ⚠️ fragile
```

`data-dtstart` は予定要素についている安定した data 属性。
そこから祖先を辿って週ビュー/日ビューのグリッド本体に到達する。
Google Calendar 側の minify ハッシュが変わっても、この経路はほぼ生き残る。

### 2. オーバーレイの位置を %  指定する

時間 `09:00` を「グリッド全体に対する %」に変換する。
24時間で 0% → 100% という単純な比例計算:

```ts
function timeToPercent(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return ((h * 60 + (m ?? 0)) / (24 * 60)) * 100;
}

function createOverlay(rule: FocusRule): HTMLElement {
  const el = document.createElement('div');
  const top = timeToPercent(rule.startTime);
  const bottom = timeToPercent(rule.endTime);
  const height = bottom - top;

  el.setAttribute('data-quiethours', rule.id);
  Object.assign(el.style, {
    position: 'absolute',
    left: '0', right: '0',
    top: `${top}%`,
    height: `${height}%`,
    background: `${rule.color}22`,         // 22 = 13% alpha
    borderLeft: `3px solid ${rule.color}`,
    pointerEvents: 'none',                  // ← 重要：クリックを下に通す
    zIndex: '1',
  });
  return el;
}
```

ポイントは `pointerEvents: 'none'`。
これがないとユーザーが既存の予定をクリックできなくなる。
オーバーレイは「見せる」だけで、操作は全部下のレイヤーに通す。

### 3. SPA 再描画への追従

Google Calendar は SPA で、週/月切り替えやスクロールごとに
DOM がごっそり差し替わる。一度 inject しても、
週ビューを切り替えた瞬間に消える。

これは MutationObserver で吸収する:

```ts
const observer = new MutationObserver(() => {
  removeOverlays();
  injectOverlays();
});

const waitForCalendar = setInterval(() => {
  const root = document.querySelector('[data-view-toggle]')
    ?? document.querySelector('div[role="main"]');
  if (root) {
    clearInterval(waitForCalendar);
    observer.observe(root, { childList: true, subtree: false });
    injectOverlays();
  }
}, 500);
```

`subtree: false` がコツ。`true` にすると変更通知が秒間数百回飛んできて、
オーバーレイの再描画ループで CPU が燃える。
最上位コンテナの直接の子供だけ監視すれば、ビュー切り替えは検知できる。

### 4. 会議とフォーカスタイムの衝突を検出

オーバーレイだけでは「うっかり予定を入れてしまった」を防げない。
そこで既存の予定要素を走査して、フォーカス時間に被っているものに
⚠️ バッジを追加する:

```ts
function addConflictBadges(): void {
  const events = document.querySelectorAll<HTMLElement>('[data-eventid]');
  events.forEach((ev) => {
    const dtstart = ev.getAttribute('data-dtstart')
      ?? ev.getAttribute('aria-label') ?? '';
    const match = dtstart.match(/(\d{1,2}):(\d{2})/);
    if (!match) return;

    const hhmm = `${match[1].padStart(2, '0')}:${match[2]}`;
    const day = new Date().getDay();
    const conflict = _rules.find(
      (r) => r.enabled
        && r.dayOfWeek.includes(day)
        && hhmm >= r.startTime
        && hhmm < r.endTime,
    );
    if (!conflict) return;
    if (ev.querySelector('[data-qh-badge]')) return; // 重複防止

    const badge = document.createElement('span');
    badge.setAttribute('data-qh-badge', '1');
    badge.textContent = '⚠️';
    ev.appendChild(badge);
  });
}
```

`hhmm >= startTime && hhmm < endTime` は文字列比較で正しく動く。
`'09:30' >= '09:00'` は true、`'12:00' >= '09:00'` も true。
ゼロパディングしてあれば辞書順 = 時間順になる。

## Pro 機能の境界

`FREE_LIMITS.rulesPerDay = 1`。
Free プランは「曜日ごと1ルールまで」、Pro でアンロック。

なぜ 1 なのか。Free でも体験はちゃんと機能する設計にしたかった。
「平日9-12時を集中タイム」という最頻ユースケースは無料で完結する。
ただし「平日午前9-12時 + 午後14-16時」「土日は別ルール」のような
複雑な運用にしたい人は、ぶっちゃけ Pro 価値がある層なので課金してもらう。

`paywall_shown` イベント自体は出るが、出すタイミングを限定している:

```ts
const handleAddClick = () => {
  if (!isPro && rules.length >= FREE_LIMITS.rulesPerDay) {
    setShowPaywall(true);  // 2件目を作ろうとした瞬間だけ
    return;
  }
  setForm({ ...DEFAULT_FORM });
};
```

「いきなり paywall を出す」ではなく「価値を体験した後の壁」設計。
これは ZenRead で paywall を popup 起動時に出して**転換率 0%** だった
失敗から学んだ ([別記事](./zenread-paywall-conversion-zero.md) で書いた)。

## 公開してから気づいたこと

Google Calendar の DOM は**月に 1〜2 回くらいクラス名が変わる**。
`.KF4T6b` をフォールバックの最後に置いている理由はこれ。
完全に予防はできないので、`data-dtstart` 起点の祖先辿りを
最優先のパスにしている。これが壊れると緊急パッチを出すしかない。

通知許可も悩んだ。
最初は「フォーカスタイム開始時に notify」を入れたが、
「Google Calendar のリマインダーと被って邪魔」というフィードバックを受けて
通知をオプトインに変更。デフォルトは静かに、必要な人だけ ON。

## まとめ

- Google Calendar API は使わない、content script オーバーレイで十分
- 時間 → % 変換は 24h 比例、`pointerEvents: 'none'` でクリックを下に通す
- SPA 追従は MutationObserver の `subtree: false` で軽く
- 衝突検出は既存予定の `data-dtstart` 走査で十分
- 課金壁は「機能を体験した後」に出す

[Quiethours を Chrome ウェブストアで開く](https://chromewebstore.google.com/detail/okdmecodmihlgbkeacmebdikolofccfa)

S-Hub では他にも、フォーカス系・生産性系の Chrome 拡張を出している。
[dev-tools-hub.xyz](https://dev-tools-hub.xyz/) からどうぞ。
