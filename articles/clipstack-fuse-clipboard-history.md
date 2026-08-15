---
title: "クリップボード履歴をFuse.jsでfuzzy検索するChrome拡張をWXTで作った"
emoji: "📋"
type: "tech"
topics: ["chrome拡張", "個人開発", "typescript", "fusejs", "wxt"]
published: true
---

## 「さっきコピーしたやつ、何だったっけ」問題

開発中、`SELECT * FROM users WHERE...` みたいなクエリをコピー → ターミナルでリポジトリ名をコピー → SlackでスレッドURLをコピー → さっきのSQLをペーストしたい。OS標準のクリップボードは直前の1件しか覚えてくれず、cmd+V を押すと「あ、上書きされてた」と気付く。

毎日30回くらい食らうこの小さな苛立ちを潰すために、ClipStack というChrome拡張を作った。クリップボード履歴を保持し、Fuse.js による fuzzy 検索で過去のコピー内容を瞬時に呼び出す、というシンプルなツール。

本記事は、その実装で詰まった「Manifest V3 のクリップボード権限」「Fuse.js の閾値チューニング」「Service Worker の dormant 問題」あたりを中心に書く。

## 既存ツールでよくない？問題

クリップボードマネージャーは Win/Mac 双方に有料の有名どころが揃っている。それでも作った理由は3つ。

1. **常駐アプリを増やしたくない** — 既にメモリは限界
2. **ブラウザのコピーだけ覚えれば9割の用途は足りる** — 開発作業の文脈ではブラウザ起点のコピーが圧倒的多数
3. **ブラウザ拡張なら同期がブラウザ側で完結する** — Chrome のプロファイル同期に乗っかれる

要件は「ブラウザでコピーしたものだけを履歴化、検索可能、ピン留め可」。これだけならMV3拡張で十分作れる。

## 実装の中核

### 1. クリップボード監視 — `clipboardRead` 権限を使わない

最初に詰まったのが権限設計。MV3 で `navigator.clipboard.readText()` を使うと `clipboardRead` 権限が必要で、CWS 審査でも理由説明が重くなる。

逃げ道は **`copy` イベントの `ClipboardEvent.clipboardData` から直接テキストを取り出す**こと。これならクリップボードを「読みに行く」のではなく「ユーザーがコピーした瞬間にイベント引数として渡される」ので、`clipboardRead` 権限は不要。

```ts
// entrypoints/content.ts
import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    document.addEventListener('copy', (event: ClipboardEvent) => {
      const text =
        event.clipboardData?.getData('text/plain') ??
        window.getSelection()?.toString() ??
        '';

      if (!text.trim()) return;

      chrome.runtime.sendMessage({
        type: 'CLIP_CAPTURED',
        text: text.trim(),
        source: window.location.hostname,
      }).catch(() => { /* SW未起動時は無視 */ });
    });
  },
});
```

ポイントは `event.clipboardData?.getData('text/plain')` を第一候補にしつつ、フォールバックで `window.getSelection().toString()` を使う点。一部のサイト（特にGoogle Docsや独自エディタ）は `clipboardData` を空にしてくるので、その場合は選択範囲のテキストを救う。

権限は最終的に `storage` と `<all_urls>` のみ。CWS 審査でも「クリップボード読取権限なしでクリップボード履歴？」というレビュアーの引っかかりを最初の説明文で潰しておくと一発で通る。

### 2. Fuse.js による fuzzy 検索 — `threshold` の値が9割

履歴が増えてくると完全一致検索はほぼ役に立たない。「あの API のレスポンス、何ていうフィールド名だっけ」と曖昧に検索したいので、Fuse.js を採用。

```ts
import Fuse from 'fuse.js';

const fuse = useMemo(
  () => new Fuse(clips, {
    keys: ['text', 'source'],
    threshold: 0.3,
    minMatchCharLength: 1,
  }),
  [clips],
);

const filtered = useMemo(() => {
  if (!query.trim()) return clips;
  return fuse.search(query).map((r) => r.item);
}, [query, fuse, clips]);
```

`threshold` のチューニングが体感品質を決める。

- `0.0` … 完全一致のみ。`grep` と変わらない
- `0.3` … 1〜2文字のtypoまで吸収。最終的にここに落ち着いた
- `0.6` … 何でもヒットしすぎてノイズが目立つ

`keys` に `source`（ドメイン名）も入れているのが地味な工夫。`github.com` でコピーしたものを検索したい時に「github」と打つだけで絞れる。

`useMemo` の依存配列に `clips` を入れて再生成しているので、新しいコピーが入ると Fuse インスタンスを作り直す。クリップ数100件程度なら毎回作っても 1ms 以下で終わるので問題なし。1000件超えると流石に再考する必要があるが、Free 上限20件・想定 Pro ユーザーでも数百件レベルなので無視。

### 3. WXT での MV3 Service Worker 設計

WXT (`wxt.dev`) を使うと MV3 のボイラープレートが綺麗に隠蔽される。`defineBackground({ type: 'module', main() {...} })` を書くだけで、SW が ESM として動く。

```ts
// entrypoints/background.ts
export default defineBackground({
  type: 'module',
  main() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      handleMessage(message, sendResponse);
      return true; // 非同期レスポンス維持
    });
  },
});
```

詰まったのは **SW dormant 問題**。MV3 の SW は約30秒で sleep するので、popup を開いた瞬間に SW が起きていない可能性がある。ClipStack は SW を経由してストレージ更新を行うため、popup → SW のメッセージで SW を wake up させる設計にした。

副作用として、`onMessage.addListener` が同期的に登録されている必要がある（main() の中で即座に登録）。`await` を間に挟むとリスナー登録が遅延し、ウェイク時の最初のメッセージを取りこぼす。

### 4. ピン留めと履歴上限の UX

ピン留めはユーザーが「これは消したくない」と明示的に選んだもの。履歴上限の枠外で管理する。

```ts
// 重複チェック → 既存があれば先頭へ移動
const existingIdx = clips.findIndex((c) => c.text === trimmed);
const filtered = existingIdx >= 0
  ? clips.filter((_, i) => i !== existingIdx)
  : clips;

let updated = [newClip, ...filtered];

// Free版の制限：ピン以外を maxHistory に絞る
if (!settings.isPro) {
  const pinned = updated.filter((c) => c.pinned);
  const unpinned = updated.filter((c) => !c.pinned);
  updated = [...pinned, ...unpinned.slice(0, FREE_LIMITS.maxHistory)];
}
```

「同じテキストを再コピーしたら、新規追加せずに先頭へ移動」というのは小さいが効く。同じURLを何度もコピーする運用で履歴が同じ文字列で埋まるのを防ぐ。

## Pro機能の境界線をどう引いたか

フリーミアム設計でいつも悩むのが「何を Pro にするか」。実装視点で考えると、答えは「**コストが追加でかかる機能**」になる。

ClipStack の場合：

| 機能 | プラン | 実装コスト |
|------|--------|-----------|
| 履歴20件、ピン留め5件 | Free | ローカル `chrome.storage.local` のみ |
| 履歴無制限、ピン無制限 | Pro | 同上（実コスト増なし） |
| デバイス間同期 | Pro | バックエンド or `chrome.storage.sync` 容量管理 |
| エクスポート（JSON/CSV） | Pro | 実装の手間のみ |

履歴上限はストレージ的な制約でなく純粋に「Free と Pro を分ける線引き」。じゃあ20件は妥当なのか？という話に繋がる。

## 「20件で十分か問題」

A/B するほどユーザーがいないので、設計時の判断ロジックを残しておく：

- **5件**: 直前のコピーが押し出される頻度が高すぎ、Free 体験が弱すぎる
- **20件**: 数時間の作業で埋まる量。「Pro が必要」と感じる頻度が出る
- **50件**: ほぼ無料で完結してしまい、Pro への動機が薄れる
- **無制限**: そもそも課金させる気あるのか問題

20件にした決め手は「**ピン留め5件と組み合わせると、ヘビーに使えば1〜2日で限界が来る**」というバランス。Free でも「便利だ」と感じてもらいつつ、毎日使えば「もう少し欲しい」と感じる線。

実装上は `FREE_LIMITS = { maxHistory: 20, maxPinned: 5 } as const` という定数1箇所で集約し、UI バナーから addClip ロジックまで全部ここを参照している。後で 30 に変えたくなったら定数1箇所だけ書き換えれば全UIに反映される。ハードコードは負債なので最初から定数にしておく。

## まとめ

「便利な常駐アプリを入れる」と「拡張機能で済ませる」の間には、メモリ消費以上の心理的なハードルがあると個人的には思っていて、Chrome内で完結するクリップボードマネージャーには需要があった。

実装の山は (1) 権限を増やさずクリップボードを取る (2) Fuse.js の閾値チューニング (3) MV3 SW の dormant 対策 の3点。ここを越えれば残りはUIをミニマルに作るだけ。

ClipStack は CWS で公開中なので、もし「あ、それ欲しかった」と思ったら触ってみてください。

→ [ClipStack on Chrome Web Store](https://chromewebstore.google.com/detail/lkdcdpbenhhgncjfdfhnbfdenbkkihhk)
