---
title: "スクロール位置の自動保存を Chrome 拡張で作る — local と sync の使い分け"
emoji: "📖"
type: "tech"
topics: ["chrome拡張機能", "javascript", "typescript", "storage", "個人開発"]
published: true
---

長い記事を途中まで読んで、別タブに切り替えて、戻ってきたら一番上に戻っている。あの「どこまで読んだっけ」を毎回スクロールして探すのが嫌で、スクロール位置を自動保存・復元する拡張(ReadMark)を作った。

実装してみると、`chrome.storage` の `local` と `sync` をどう使い分けるかが設計の肝だった。この記事はその話。

## やりたいこと2種類

ReadMark の機能は、似て非なる2つに分かれる。

1. **自動保存**: どのページでも、スクロールするたびに位置を裏で記録(明示操作なし)
2. **ブックマーク**: ユーザーが Alt+M で明示的に「ここを保存」(メモやタグ付き)

この2つは保存先を分けた。

| | 自動保存(scroll position) | ブックマーク(明示) |
|---|---|---|
| 保存先 | `chrome.storage.local` | `chrome.storage.sync` |
| 量 | 訪れたページ分(大量) | ユーザーが選んだ分(少量) |
| 期限 | 7日で expire | 永続 |
| 同期 | しない(プライバシー優先) | する(端末間で復元) |

## なぜ自動保存を local にするか

`chrome.storage.sync` は端末間で同期できて便利だが、**容量が厳しい**(全体 100KB 強、1アイテム 8KB)。自動保存は訪れたページすべてに発生するので、sync に入れると一瞬で枯渇する。しかも「自分が見た全ページの履歴」がクラウド同期されるのはプライバシー的にも避けたい。

だから自動保存はローカルに置き、7日で expire させる。

```ts
const POSITION_EXPIRY_DAYS = 7;

async function savePosition(url: string, scrollPct: number, title: string) {
  const key = `pos:${normalizeUrl(url)}`;
  await chrome.storage.local.set({
    [key]: { scrollPct, title, savedAt: Date.now() },
  });
}

// 取得時に期限チェック
async function getPosition(url: string) {
  const key = `pos:${normalizeUrl(url)}`;
  const { [key]: pos } = await chrome.storage.local.get(key);
  if (!pos) return null;
  const ageDays = (Date.now() - pos.savedAt) / 86400000;
  return ageDays > POSITION_EXPIRY_DAYS ? null : pos;
}
```

明示ブックマークは数が少なく、端末間で復元したい(無料は5件、Pro で無制限)。これは sync に置く。役割で保存先を分けるのがポイント。

## スクロール位置は px でなく % で持つ

ここがハマりポイントだった。スクロール位置を **px(`window.scrollY`)で保存すると、画面幅や font-size が変わったときにズレる**。レスポンシブなページや、別端末では位置が合わない。

そこで**ドキュメント全体に対する割合(%)**で持つ。

```ts
function getScrollPct(): number {
  const doc = document.documentElement;
  const scrollable = doc.scrollHeight - doc.clientHeight;
  return scrollable > 0 ? doc.scrollTop / scrollable : 0;
}

function restoreScrollPct(pct: number) {
  const doc = document.documentElement;
  const scrollable = doc.scrollHeight - doc.clientHeight;
  doc.scrollTo({ top: scrollable * pct });
}
```

## 復元タイミングの罠 — 動的コンテンツ

content script を `document_idle` で注入して復元しても、**画像や遅延ロードのコンテンツが後から入ると `scrollHeight` が変わり、復元位置がズレる**。

対策として、復元は1回で終わらせず、`scrollHeight` が安定するまで短いリトライを入れた(or `ResizeObserver` で高さ変化を監視して再補正)。動的ページではこの「後追い補正」がないと体感がかなり悪くなる。

## まとめ

- 役割で保存先を分ける: 大量・プライバシー敏感な自動保存は `local` + 期限、少量・同期したいブックマークは `sync`
- スクロール位置は px でなく **%** で保存(レスポンシブ・端末差に強い)
- 復元は1回で決めず、`scrollHeight` の安定を待つ/後追い補正する(動的コンテンツ対策)

無料で5件までブックマークできる。長文をよく読む人は試してみてください。

ReadMark(Chrome ウェブストア):
https://chromewebstore.google.com/detail/inejhohffndeacbihghjcobndpoejdfn


