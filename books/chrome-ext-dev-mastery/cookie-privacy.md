---
title: "第8章 — Cookie・プライバシー：CookieJar実装とCWS審査突破"
---

> 第7章でSide PanelとOffscreen Documentの実装パターンを習得しました。この章では「プライバシー」に踏み込む拡張——Cookieの読み書き・分析を行うCookieJarの実装を例に、`chrome.cookies` APIの使い方とCWSプライバシー審査の通過戦略を解説します。S-HubのCookieJar開発で得た知見をそのまま届けます。

---

## Cookie操作の基礎

`chrome.cookies` APIは、拡張機能だけが持つ特権APIです。ページのJavaScriptが `document.cookie` でアクセスできるのは自ドメインのCookieのみですが、拡張は**権限さえあればすべてのドメインのCookieを読み書き**できます。

### chrome.cookies API vs document.cookie

```
document.cookie（ページJS）
  ├─ 自ドメインのCookieのみ
  ├─ HttpOnly Cookie は読めない
  ├─ Secure / SameSite フラグの取得不可
  └─ 複数ドメインの一括操作不可

chrome.cookies（拡張）
  ├─ host_permissions で指定した全ドメイン
  ├─ HttpOnly Cookie も読み取り可能
  ├─ Secure / SameSite / expirationDate すべて取得
  └─ 複数ドメインの一括getAll/set/remove 可能
```

この強力さゆえ、CWSの審査は `cookies` 権限に対して特に厳しいです。

---

## cookies権限の設計

```json
// manifest.json — cookies権限の設計パターン

// ❌ 過剰な権限（CWS審査で要説明）
{
  "permissions": ["cookies"],
  "host_permissions": ["<all_urls>"]
}

// ✅ 必要なドメインだけ（審査が通りやすい）
{
  "permissions": ["cookies"],
  "host_permissions": [
    "https://*.amazon.co.jp/*",
    "https://*.amazon.com/*"
  ]
}

// ✅ ユーザーが選択したタブだけ（最小権限）
{
  "permissions": ["cookies", "activeTab"]
}
```

CWS審査では、`"<all_urls>"` + `cookies` の組み合わせは「Single Purpose」の説明が必須です。「ユーザーのすべてのサイトのCookieにアクセスできる」拡張は、スパイウェアと区別がつきにくいため、用途の明確な説明が求められます。

---

## cookies.getAll の使い方

```typescript
// src/lib/cookie-manager.ts — Cookie取得と集計

interface CookieSummary {
  domain: string;
  count: number;
  hasTrackers: boolean;
  thirdParty: boolean;
}

export async function getAllCookies(domain?: string): Promise<chrome.cookies.Cookie[]> {
  const details: chrome.cookies.GetAllDetails = {};
  if (domain) details.domain = domain;

  return chrome.cookies.getAll(details);
}

// ドメイン別にCookieを集計
export async function summarizeCookies(currentHost: string): Promise<CookieSummary[]> {
  const all = await chrome.cookies.getAll({});

  // ドメインでグループ化
  const byDomain = new Map<string, chrome.cookies.Cookie[]>();
  for (const cookie of all) {
    const domain = cookie.domain.replace(/^\./, ''); // leading dot を除去
    const group = byDomain.get(domain) ?? [];
    group.push(cookie);
    byDomain.set(domain, group);
  }

  return Array.from(byDomain.entries()).map(([domain, cookies]) => ({
    domain,
    count: cookies.length,
    hasTrackers: cookies.some((c) => isTrackingCookie(c)),
    thirdParty: !currentHost.endsWith(domain) && !domain.endsWith(currentHost),
  }));
}
```

`getAll` のフィルタパラメータには `domain`・`name`・`storeId`（通常/プライベートウィンドウの区別）・`session`（セッションCookieのみ）などが使えます。

---

## cookies.set / remove

```typescript
// src/lib/cookie-manager.ts — CookieJar的なimport/export

// Cookieのエクスポート（シリアライズ）
export async function exportCookies(domain: string): Promise<string> {
  const cookies = await getAllCookies(domain);

  // httpOnly Cookieは復元不可のためメタデータとして保持
  const exportData = cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    secure: c.secure,
    httpOnly: c.httpOnly,
    sameSite: c.sameSite,
    // session CookieはexpirationDateなし
    expirationDate: c.expirationDate,
  }));

  return JSON.stringify(exportData, null, 2);
}

// Cookieのインポート（復元）
export async function importCookies(jsonStr: string): Promise<{
  success: number;
  failed: number;
}> {
  const cookies = JSON.parse(jsonStr) as Partial<chrome.cookies.SetDetails>[];
  let success = 0;
  let failed = 0;

  for (const cookie of cookies) {
    try {
      // url は domain から構築（set に必須）
      const url = `${cookie.secure ? 'https' : 'http'}://${cookie.domain?.replace(/^\./, '')}${cookie.path ?? '/'}`;

      await chrome.cookies.set({
        url,
        name: cookie.name!,
        value: cookie.value!,
        domain: cookie.domain,
        path: cookie.path ?? '/',
        secure: cookie.secure ?? false,
        httpOnly: cookie.httpOnly ?? false,
        sameSite: cookie.sameSite ?? 'unspecified',
        // expirationDate がなければ session cookie
        expirationDate: cookie.expirationDate,
      });
      success++;
    } catch {
      failed++;
    }
  }

  return { success, failed };
}

// Cookie削除
export async function removeCookie(url: string, name: string): Promise<void> {
  await chrome.cookies.remove({ url, name });
}
```

---

## cookies.onChanged リスナー

```typescript
// background.ts — Cookieのリアルタイム監視

// 監視対象ドメインのフィルタ
const WATCH_DOMAINS = ['analytics.google.com', 'facebook.com', 'doubleclick.net'];

chrome.cookies.onChanged.addListener((changeInfo) => {
  const { cookie, removed, cause } = changeInfo;
  const domain = cookie.domain.replace(/^\./, '');

  // トラッカードメインのCookie変化のみログ
  if (!WATCH_DOMAINS.some((d) => domain.endsWith(d))) return;

  const event = removed ? 'removed' : 'set';
  console.log(`[Cookie Monitor] ${event}: ${cookie.name} @ ${domain} (cause: ${cause})`);

  // UI通知（popup or sidepanelに送信）
  chrome.runtime.sendMessage({
    type: 'COOKIE_CHANGED',
    cookie: { name: cookie.name, domain, removed, cause },
  }).catch(() => {
    // popup が閉じている場合は無視
  });
});
```

`cause` には `explicit`（ページが直接セット）・`overwrite`（上書き）・`expired`（期限切れ）・`evicted`（キャッシュ削除）などがあります。

---

## プライバシースコア実装

```typescript
// src/lib/privacy-score.ts — Cookieのトラッカー判定とスコアリング

// 既知のトラッカードメインリスト（実際はdisconnect.meのリスト等を使用）
const KNOWN_TRACKERS = new Set([
  'google-analytics.com',
  'doubleclick.net',
  'facebook.com',
  'hotjar.com',
  'mixpanel.com',
  'segment.io',
  'amplitude.com',
]);

// Cookie名による追跡判定（ヒューリスティック）
const TRACKING_NAME_PATTERNS = [
  /^_ga/,      // Google Analytics
  /^_fb/,      // Facebook
  /^__utm/,    // Google Analytics (Universal)
  /^_hjid/,    // Hotjar
  /^ajs_/,     // Segment
];

export function isTrackingCookie(cookie: chrome.cookies.Cookie): boolean {
  const domain = cookie.domain.replace(/^\./, '');

  // ドメイン一致
  if (KNOWN_TRACKERS.has(domain)) return true;
  if ([...KNOWN_TRACKERS].some((t) => domain.endsWith(t))) return true;

  // 名前パターン
  if (TRACKING_NAME_PATTERNS.some((p) => p.test(cookie.name))) return true;

  return false;
}

export interface PrivacyScore {
  score: number;       // 0-100 (100が最もプライバシー友好的)
  trackerCount: number;
  thirdPartyCount: number;
  details: string[];
}

export async function calcPrivacyScore(currentUrl: string): Promise<PrivacyScore> {
  const host = new URL(currentUrl).hostname;
  const all = await chrome.cookies.getAll({});

  const details: string[] = [];
  let trackerCount = 0;
  let thirdPartyCount = 0;

  for (const cookie of all) {
    const domain = cookie.domain.replace(/^\./, '');
    const isThirdParty = !host.endsWith(domain) && !domain.endsWith(host);

    if (isThirdParty) thirdPartyCount++;
    if (isTrackingCookie(cookie)) {
      trackerCount++;
      details.push(`${cookie.name} (${domain})`);
    }
  }

  // スコア計算（簡易版）
  const penalty = trackerCount * 5 + thirdPartyCount * 2;
  const score = Math.max(0, 100 - penalty);

  return { score, trackerCount, thirdPartyCount, details };
}
```

---

## CWS プライバシー審査を通すコツ

CWSのプライバシー審査は2023年以降厳格化されています。`cookies` や `<all_urls>` を使う拡張は特に入念な準備が必要です。

**Single Purpose の記述**: Developer Dashboardの「Purpose」欄に具体的な用途を書きます。

```
❌ 曖昧な記述
"This extension manages cookies."

✅ 具体的な記述
"CookieJar helps users view, export, and delete browser cookies
for privacy management. It displays cookies grouped by domain,
highlights third-party trackers, and allows bulk deletion."
```

**Permission Justification（必須項目）**:

| パーミッション | 正当化の文例 |
|------------|------------|
| `cookies` | "Required to read and manage cookies across domains as the core functionality." |
| `<all_urls>` | "Users can manage cookies for any site they visit." |
| `storage` | "Used to save user preferences (theme, filter settings) locally." |
| `activeTab` | "Required to display cookie count for the current tab." |

**Data Usage Disclosure**: Developer Dashboardの「Privacy practices」で以下を設定します。
- **User data collection**: Yes / No（収集する場合は種別を選択）
- **Privacy Policy URL**: 必須（`cookies` 権限使用時）
- **Remote code**: No（必ずNo。外部スクリプト読み込みは審査落ちの最短コース）

---

## ユーザーデータの扱い方

```typescript
// src/lib/privacy-settings.ts — プライバシー設定の実装

// client_id は PII ではないが、永続化は明示的に説明する
// → GA4のclient_idはランダムUUID。氏名/メール等と紐付けていなければPII非該当

// IPアドレスの非送信（GA4 Measurement Protocolの場合）
// → サーバーサイドプロキシ経由でGoogle IPを隠せるが、
//    拡張の場合はユーザーのIPから直接送信されることをPrivacy Policyに明記する

// オプトアウト実装（第5章のAnalyticsToggleと同様）
export async function isAnalyticsOptOut(): Promise<boolean> {
  const { analyticsOptOut } = await chrome.storage.local.get('analyticsOptOut');
  return analyticsOptOut === true;
}

// ユーザーデータ削除リクエストへの対応
// CWSのDeveloper Programポリシー: データ削除手段を提供する義務
export async function deleteAllUserData(): Promise<void> {
  // 拡張が保持するすべてのストレージをクリア
  await chrome.storage.local.clear();
  await chrome.storage.sync.clear();

  // GA4のclient_idも削除（次回起動時に新規生成される）
  console.log('[Privacy] All user data deleted');
}
```

---

## 暗号化が必要なケース

`chrome.storage` は暗号化されていません。OS権限があれば読み取れます。パスワードや認証トークンを保存する場合は `WebCrypto API` で暗号化します。

```typescript
// src/lib/crypto-storage.ts — AES-GCM による暗号化ストレージ

// 暗号化キーをSession StorageにキャッシュしてService Worker生存中のみ有効
async function getOrCreateKey(): Promise<CryptoKey> {
  const { cryptoKeyJwk } = await chrome.storage.session.get('cryptoKeyJwk');

  if (cryptoKeyJwk) {
    return crypto.subtle.importKey('jwk', cryptoKeyJwk, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  // 新規キー生成（Service Worker再起動のたびに新しいキー）
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const jwk = await crypto.subtle.exportKey('jwk', key);
  await chrome.storage.session.set({ cryptoKeyJwk: jwk });
  return key;
}

export async function encryptAndStore(storageKey: string, plainText: string): Promise<void> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96bit IV
  const encoded = new TextEncoder().encode(plainText);

  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  // IV + 暗号文をBase64でストレージに保存
  const combined = new Uint8Array([...iv, ...new Uint8Array(encrypted)]);
  const base64 = btoa(String.fromCharCode(...combined));
  await chrome.storage.local.set({ [storageKey]: base64 });
}

export async function decryptFromStore(storageKey: string): Promise<string | null> {
  const stored = await chrome.storage.local.get(storageKey);
  if (!stored[storageKey]) return null;

  const key = await getOrCreateKey();
  const combined = Uint8Array.from(atob(stored[storageKey]), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  try {
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(decrypted);
  } catch {
    return null; // キーが変わっていた場合（Service Worker再起動後）
  }
}
```

**注意**: 上記のキー管理方式では、Service Workerが再起動するたびにキーが変わり、以前の暗号データが復号できなくなります。長期保存が必要な場合はユーザーのパスフレーズからキー派生（PBKDF2）する方式を使います。

---

:::message
**この章で学んだこと**

- `chrome.cookies` APIは拡張だけが持つ特権。HttpOnly Cookieを含む全ドメインのCookieにアクセスできるため、CWS審査では権限の正当化が必須
- `cookies` + `<all_urls>` の組み合わせはCWS審査で最もマークされやすい。可能な限り特定ドメインに限定するか `activeTab` で代替する
- トラッカー判定はドメインリスト（disconnect.me等）+ Cookie名パターンのヒューリスティックで実装できる
- CWSプライバシー審査: Single Purposeの明確な記述、Permission Justification、Privacy Policy URL、Remote code: No の4点が必須
- `chrome.storage` は非暗号化。パスワード等の機密データはWebCrypto API（AES-GCM）で暗号化してから保存する
:::

---

Cookie操作とプライバシー対応の実装パターンを習得しました。次の章では、拡張のリリースまでの道筋——デバッグ・テスト・CWSへの公開プロセス——を一気に解説します。型エラーの検出から審査リジェクト対策まで、S-Hubの18本のリリース経験から得た実践知識をお届けします。

**→ [第9章：デバッグ・テスト・リリース](./debug-test-release.md)**
