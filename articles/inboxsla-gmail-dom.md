---
title: "メールのSLAを個人で管理するChrome拡張を作った — MutationObserverとGmail DOM解析"
emoji: "📬"
type: "tech"
topics: ["chrome拡張機能", "typescript", "gmail", "個人開発", "webdev"]
published: false
published_at: "2026-05-28 09:00"
---

フリーランスやクライアントワークをしていると、「あのメール、いつ返信すればいいんだっけ」問題が地味に発生します。有料のSLAツールを個人で使うのは大げさなので、Gmailのスレッドに直接SLA残時間バッジを表示するChrome拡張「[InboxSLA](https://chromewebstore.google.com/detail/fooenikjagbabhodgpohljldfbpggagi)」を作りました。今回はGmail DOMの解析とMutationObserverの実装を中心に書きます。

## GmailのDOM解析が難しい理由

GmailはWebアプリとして長年アップデートを続けてきたため、内部のクラス名が難読化されていて意味を持ちません。`.yW span[email]` のようなセレクタは、Gmailのバージョンアップで突然壊れることがあります。

そのため、メールアドレスを取得するセレクタを複数用意してフォールバックさせています。

```typescript
function extractSenderDomain(row: Element): string | null {
  const senderEl =
    row.querySelector('[email]') ??
    row.querySelector('.yW span[email]') ??
    row.querySelector('.bA4 span[email]');

  if (senderEl) {
    const email = senderEl.getAttribute('email') ?? '';
    const atIdx = email.indexOf('@');
    if (atIdx >= 0) return email.slice(atIdx + 1).toLowerCase();
  }

  // ホバーカードIDにメールアドレスが含まれる場合
  const emailEl = row.querySelector('[data-hovercard-id]');
  if (emailEl) {
    const email = emailEl.getAttribute('data-hovercard-id') ?? '';
    const atIdx = email.indexOf('@');
    if (atIdx >= 0) return email.slice(atIdx + 1).toLowerCase();
  }

  return null;
}
```

ドメイン（`@example.com` の `example.com` 部分）でクライアントを識別しているのは、同一企業からのメールをまとめて扱えるからです。

## スレッドのタイムスタンプ取得

スレッドの受信日時は `td.xW span[title]` に格納されています。`title` 属性にはフル形式の日時文字列が入っているので、`new Date()` でそのままパースできます。

```typescript
function extractThreadTimestamp(row: Element): number | null {
  const timeEl =
    row.querySelector('.xW.xY span[title]') ??
    row.querySelector('td.xW span[title]');

  if (timeEl) {
    const title = timeEl.getAttribute('title') ?? '';
    const parsed = new Date(title).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  return Date.now(); // フォールバック: 現在時刻（保守的）
}
```

## バッジの注入と更新

SLAバッジはスレッド行に直接DOMを追加します。`data-inboxsla-badge` 属性で既存バッジを検索し、ある場合は更新、ない場合は新規作成します。

```typescript
function injectBadge(row: Element, client: Client, receivedAt: number): void {
  const slaMs = client.slaHours * 60 * 60 * 1000;
  const remaining = slaMs - (Date.now() - receivedAt);
  const { bg, color, text } = getBadgeStyle(remaining);

  const BADGE_ATTR = 'data-inboxsla-badge';
  let badge = row.querySelector(`[${BADGE_ATTR}]`) as HTMLElement | null;

  if (!badge) {
    badge = document.createElement('span');
    badge.setAttribute(BADGE_ATTR, 'true');
    // ... スタイル設定
    const subjectEl = row.querySelector('.y6') ?? row.querySelector('td.a4W');
    subjectEl?.appendChild(badge);
  }

  badge.style.background = bg;
  badge.textContent = text;
}
```

バッジの色は残り時間で3段階に分けています。

```typescript
function getBadgeStyle(remainingMs: number) {
  if (remainingMs <= 0)
    return { bg: '#ef4444', color: '#fff', text: 'OVERDUE' };
  if (remainingMs <= SLA_APPROACHING_THRESHOLD_MS)
    return { bg: '#f97316', color: '#fff', text: `${Math.ceil(remainingMs / 3_600_000)}h left` };
  return { bg: '#22c55e', color: '#fff', text: `${Math.floor(remainingMs / 3_600_000)}h` };
}
```

## MutationObserverでGmailの動的ロードに対応

Gmailはスクロールやフォルダ切り替えで新しいスレッドを動的に追加します。コンテンツスクリプトの初回実行だけでは不十分なので、MutationObserverでDOMの変化を監視して `scanRows()` を再実行します。

```typescript
const observer = new MutationObserver(scanRows);
observer.observe(document.body, { childList: true, subtree: true });
```

ただし `subtree: true` にするとDOMの変更ごとにコールバックが大量発火します。バッジ自身の注入もDOMの変更なので、そのままでは無限ループになりかけます。ここでも「スキャン中フラグ」か「debounce」が必要です。今回はスキャンの入口で `Date.now() - lastScan < 500` をチェックして500ms以内の再実行を弾いています。

## クライアント設定の管理

どのドメインのメールに何時間のSLAを設定するかは、拡張のポップアップ画面でユーザーが設定します。設定は `chrome.storage.sync` に保存しているので、PCが変わっても引き継がれます。コンテンツスクリプトは起動時にバックグラウンドスクリプト経由で設定を取得し、以後は5分に1回リフレッシュします。

---

https://dev-tools-hub.xyz/extensions/inboxsla/
