---
title: "Manifest V3 移行で誰も教えてくれなかった落とし穴 — Procshotを作って学んだこと"
emoji: 🔧
type: tech
topics: ["chrome拡張機能", "manifestv3", "typescript", "個人開発", "バイブコーディング"]
published: false
---

Procshot というスクリーンショット拡張を作ったとき、自分は最初から Manifest V3 で書きました。MV2 から MV3 への移行記事はネット上にたくさんありますが、実際に手を動かしてみると、誰も書いていない地味な落とし穴で何度もハマりました。

これまで合計 18 本の Chrome 拡張を MV3 で作ってきて、そのうち 5 本は MV2 からの移行も経験しています。よく語られる「Service Worker は永続的でない」「webRequest blocking が使えない」といった大きな話ではなく、もっと小さな、でも開発中に時間を溶かす落とし穴を 6 つ書いておきます。

## 1. 画面キャプチャの途中で Service Worker が死ぬ

Procshot で最初にぶつかった問題はこれでした。

`chrome.tabs.captureVisibleTab()` で画面をキャプチャして、PNG に変換して、ストレージに保存して、ポップアップに通知する。この一連の処理を Service Worker で書いていたら、保存処理の途中でなぜか結果が返ってこない。エラーログも出ない、ただ無音。

原因は **Service Worker が 30 秒の非活動で勝手に終了する** こと。`await chrome.storage.local.set(...)` を待っているあいだに SW が眠って、Promise が解決されないまま消える。

解決は、長時間の処理を SW でやらないこと。

```typescript
// ❌ SWが眠ると Promise が解決されない
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'capture') {
    const dataUrl = await chrome.tabs.captureVisibleTab();
    const processed = await heavyImageProcessing(dataUrl); // ここでSWが死ぬ
    await chrome.storage.local.set({ capture: processed });
    return { success: true };
  }
});

// ✅ 重い処理は offscreen document に切り出す
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'capture') {
    const dataUrl = await chrome.tabs.captureVisibleTab();
    await ensureOffscreenDocument();
    chrome.runtime.sendMessage({ type: 'process-image', dataUrl });
    return { success: true };
  }
});
```

## 2. 予約撮影に `setTimeout` を使ってはいけない

Procshot には「30 分後に自動キャプチャ」という予約機能があります。最初は素朴に `setTimeout` で書きました。

```typescript
setTimeout(() => captureScreen(), 30 * 60 * 1000);
```

これがまったく動かない。30 分後どころか、5 分後にも 10 分後にも、何の音沙汰もない。

原因は SW が眠ると `setTimeout` のタイマーも一緒に消えること。MV3 では時間に依存する処理は **`chrome.alarms` の一択** です。

```typescript
// ✅ SWが眠っても、指定時刻に起きて発火する
await chrome.alarms.create('scheduled-capture', { delayInMinutes: 30 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'scheduled-capture') captureScreen();
});
```

`chrome.alarms` の最小間隔は 1 分。1 分未満の短い待機が必要なら、設計を見直す必要があります。

## 3. 起動直後の `chrome.storage` 読み出しが Race する

Service Worker が眠っていた状態から、メッセージで叩き起こされた瞬間。`chrome.storage.local.get()` が、まれに古い値を返したり `undefined` を返したりすることがあります。

```typescript
// ❌ SWの起動直後、まだストレージの初期化が終わっていない
const settings = await chrome.storage.local.get('settings');
let cachedSettings = settings; // モジュールトップで読むのが罠

chrome.runtime.onMessage.addListener((msg) => {
  if (cachedSettings.enabled) { /* 起動直後だと undefined */ }
});
```

イベントハンドラの **中で** ストレージを読むのが安全です。

```typescript
// ✅ イベント発火時に毎回読み直す
chrome.runtime.onMessage.addListener(async (msg) => {
  const { settings } = await chrome.storage.local.get('settings');
  if (settings?.enabled) { /* ... */ }
});
```

## 4. `chrome.runtime.lastError` を見逃すと SW が即死する

これは自分が一番ハマった罠です。

MV2 時代、コールバックの `chrome.runtime.lastError` を見落としても、せいぜいログが出るだけでした。MV3 では、未チェックのエラーが **Service Worker を即座に終了させます**。

```typescript
// ❌ もし set が失敗すると、SW が落ちる
chrome.storage.local.set({ key: value }, () => {
  console.log('saved');
});

// ✅ 必ず lastError をチェック
chrome.storage.local.set({ key: value }, () => {
  if (chrome.runtime.lastError) {
    console.error('Storage error:', chrome.runtime.lastError.message);
    return;
  }
  console.log('saved');
});
```

Promise ベースの API（Chrome 88+）を使えば、エラーは Promise 経由で自動的に propagate されます。可能な限り Promise 版を使ったほうが安全です。

## 5. クリップボード操作は `offscreen` document を経由する

Procshot は「キャプチャ画像を直接クリップボードにコピー」する機能があります。MV2 ならバックグラウンドページから `navigator.clipboard.write()` を呼べばよかったのですが、MV3 の Service Worker には DOM がないので、`navigator` が存在しません。

解決は `chrome.offscreen` API で、見えない HTML ページを立ち上げてそこで実行することです。

```typescript
async function ensureOffscreenDocument() {
  const has = await chrome.offscreen.hasDocument();
  if (!has) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.CLIPBOARD],
      justification: 'クリップボード操作には DOM コンテキストが必要',
    });
  }
}
```

`offscreen.html` の中で `navigator.clipboard.write()` を呼べば成功します。manifest にも `"offscreen"` permission を入れるのを忘れずに。

## 6. `host_permissions: <all_urls>` は警告ダイアログとの戦い

Procshot は「どのページでもキャプチャできる」ことが価値なので `<all_urls>` を要求しています。これを書くと、インストール時に怖い警告が出ます。

> このサイトのすべてのデータの読み取りと変更

ユーザーがここで離脱する率は、ピンポイントの host 指定よりかなり高いです。可能な限り **具体的なドメインに絞る** ほうが転換率は上がります。

```json
// ❌ 本当に必要ない限り使わない
"host_permissions": ["<all_urls>"]

// ✅ 必要なドメインだけ
"host_permissions": [
  "https://api.example.com/*",
  "https://extensionpay.com/*"
]
```

Procshot のように全ページ対応が機能の本質なら、CWS のリスティング説明欄に「なぜ全ページが必要か」を明記しておくと、レビュー通過率が上がります。

## まとめ

MV3 は仕様を読むと「複雑になった」と感じますが、ハマりどころは結局、次の 1 行に集約されます。

**「バックグラウンドが常に生きているとは思うな」**

`setTimeout` も、モジュールトップの変数も、Promise の長時間 await も、すべてこの前提が崩れます。防御的に書く習慣がつけば、MV3 は怖くありません。

Procshot を作って 6 ヶ月、いまではこれらの落とし穴を踏まずに新規拡張を立ち上げられるようになりました。誰かが同じ場所でつまずく時間を、少しでも減らせたらと思います。

Procshot を試してみたい方はこちらから:
https://chromewebstore.google.com/detail/ieblehdloggcpmkncplccjofeoakhkll

---

*この記事の英語版は [dev-tools-hub.xyz](https://dev-tools-hub.xyz) の Dev.to にもあります。*
*ポートフォリオ: https://dev-tools-hub.xyz*
