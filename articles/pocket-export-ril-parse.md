---
title: "Pocket が終わる前にデータを移した話: ril_export.html でハマった3点"
emoji: "📑"
type: "tech"
topics: ["javascript", "pocket", "個人開発", "chrome拡張"]
published: true
published_at: "2026-06-18"
---

Pocket が2026年にサービスを終了する。数年分「あとで読む」に送ったリンクが消える前に、エクスポートしたデータを自作ツールに取り込もうとした。やってみると3か所詰まったので、メモしておく。

## Pocket のエクスポート形式

Pocket は設定画面からデータをエクスポートできる。出てくるのは `ril_export.html` という1枚の HTML で、中身は `<ul>` に `<a>` が並んだだけのシンプルな構造になっている。各リンクには `time_added`（追加日時の Unix 時刻）と `tags` が属性として付く。

```html
<li><a href="https://example.com/article"
       time_added="1700000000"
       tags="programming,later">記事タイトル</a></li>
```

ブラウザのブックマーク export と似た「Netscape Bookmark 風」の形式だ。パーサを書けば、そのまま他のツールに移せる。

## パースする

DOM パーサで `<a>` を全部拾い、属性を取り出すだけでいい。ブラウザでも Node でも動く形にするとこうなる。

```js
function parsePocketExport(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return [...doc.querySelectorAll("a")].map((a) => ({
    url: a.href,
    title: a.textContent.trim(),
    addedAt: Number(a.getAttribute("time_added")) * 1000, // ms に変換
    tags: (a.getAttribute("tags") || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  }));
}
```

`time_added` は秒単位の Unix 時刻なので、JavaScript の `Date` に渡すなら 1000 倍してミリ秒にする。ここを忘れると 1970 年付近の日付になる、よくあるハマりどころ。

## 取り込み先での扱い方（ハマりどころ3つ）

実際に自作のリーダーや拡張へ取り込むときに詰まりやすい点を挙げておく。

1. **重複 URL**: 同じ記事を何度も保存している人は多い。`url` を正規化（末尾スラッシュ・`utm_*` 除去）してから dedupe する。
2. **件数が多い**: 数千件を一度に `chrome.storage.local` に入れると 1MB 上限に当たる。`unlimitedStorage` 権限を付けて `chrome.storage.local` の上限を外すか、最初から IndexedDB に入れる。
3. **タグの表記ゆれ**: 大文字小文字・全角半角が混ざる。取り込み時に `toLowerCase()` + 正規化しておくと、あとでタグ絞り込みが効く。

この3点を最初に処理しておくと、移行後に「件数が合わない」「日付がおかしい」で悩まずに済む。

## まとめ

Pocket のエクスポートは構造が素直なので、移行自体は難しくない。ポイントは ① `time_added` のミリ秒変換 ② URL 正規化での重複排除 ③ ストレージ上限の3つだけ。終了前にエクスポートだけは取っておくことをおすすめする。

---

自分も Chrome 拡張（ReadMark）で「読みかけの記事の続きから再開する」仕組みを作っている。ページごとの読書位置（スクロール位置）を自動保存して、タブを閉じても続きから読めるようにするものだ。Pocket のような「あとで読むキュー」とは別カテゴリ（読書位置の自動保存）だが、長い記事を読み切る習慣づくりという点では地続きだと思っている。同じく長文を読み切れずに困っている方の参考になれば。
ReadMark: https://chromewebstore.google.com/detail/inejhohffndeacbihghjcobndpoejdfn

---

Chrome拡張の作り方・マーケ戦略を1冊にまとめました（無料）: https://zenn.dev/ktg/books/ai-chrome-extension-intro
