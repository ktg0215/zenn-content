---
title: "Amazon.co.jp・楽天・Yahoo!・メルカリの価格推移を追跡するChrome拡張を作った"
emoji: "💰"
type: "tech"
topics: ["chrome拡張機能", "javascript", "個人開発", "typescript"]
published: false
published_at: "2026-05-10 09:00"
---

日本の主要ECサイト4サイトの価格履歴をKeepa風に追跡するChrome拡張「PricePulse JP」を作りました。実装で詰まったポイントを書き残します。

## 4サイトのDOM/APIの違い

一番大変だったのが各サイトのパーサー実装です。

**Amazon.co.jp**: ASINはURLから取得できますが、価格要素のセレクターが複数あります。`#priceblock_ourprice`、`#priceblock_dealprice`、`.a-price-whole`…状況によって異なるため、優先度付きで試行するマルチセレクター方式を採用しました。

**楽天市場**: schema.orgの`Product`メタデータを優先します。`<script type="application/ld+json">`からJSONを取得する方が、DOMのクラス名よりも安定しています。楽天はCSSクラスが頻繁に変わるため。

**Yahoo!ショッピング**: store.shopping.yahoo.co.jpとshopping.yahoo.co.jpでURL形式が異なります。`og:price:amount`メタタグが信頼性高め。

**メルカリ**: og:descriptionに価格が含まれることが多く、正規表現で`¥(\d{1,3}(?:,\d{3})*)`を抽出しています。

## IndexedDB設計

`idb`ライブラリを使わずネイティブIndexedDBを採用しました。バンドルサイズを小さく保つためです。

2つのObjectStoreを使います:

- `watchlist`: keyPath `id`（サイト+商品IDのハッシュ）、siteインデックス付き
- `history`: keyPath `[watchId, t]`（複合キー）、append-onlyで価格時系列を保存

複合キーにすることで「特定商品の全価格ポイント」を`IDBKeyRange.bound([watchId, -Infinity], [watchId, Infinity])`で効率よく取得できます。

## chrome.alarmsで定期更新

MV3のService WorkerはsetIntervalが使えないため、`chrome.alarms`を使います。

```typescript
chrome.alarms.create(PRICE_REFRESH_ALARM, {
  delayInMinutes: 1,
  periodInMinutes: 180, // 3時間
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== PRICE_REFRESH_ALARM) return;
  runRefreshTick();
});
```

1アイテムずつ60秒間隔でfetchすることで対象サイトへの過負荷を避けています。バックオフ付きリトライもrate_limit判定時のみ発動。

## 値下がり通知

`chrome.notifications.create`でシステム通知を出します。前回価格との差分が5%以上、またはユーザー設定の目標価格を下回った場合にトリガー。notificationのクリックで商品ページに飛びます。

---

CWS公開予定。IndexedDB設計の詳細や各サイトのパーサー改良は継続中です。

https://dev-tools-hub.xyz/extensions/pricepulse-jp/
