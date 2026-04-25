---
title: "採用していない求人を見抜くChrome拡張を作った — ゴーストジョブ検知ロジックの解説"
emoji: "👻"
type: "tech"
topics: ["chrome拡張機能", "typescript", "個人開発", "就活", "webdev"]
published: false
published_at: "2026-05-21 09:00"
---

求人票が「ずっと載っている」のに実際には採用していない、いわゆる「ゴーストジョブ」の問題を解決するChrome拡張「[GhostJob](https://chromewebstore.google.com/detail/mdjchaohgneaiflafheajamfomeccach)」を作りました。Indeed・LinkedIn・Glassdoorの求人カードにゴーストスコア（0〜100）を表示します。今回はスコア計算ロジックとコンテンツスクリプトの実装ポイントを書きます。

## ゴーストスコアの設計

スコアは3つのシグナルの合算で、最大100点です。

```typescript
export function calculateGhostScore(factors: GhostFactors): number {
  let score = 0;
  score += daysScore(factors.daysSincePosted);       // 最大60点
  score += duplicateScore(factors.similarPostings);  // 最大20点
  score += vaguenessScore(factors.descriptionLength, factors.hasSpecificRequirements); // 最大25点
  return Math.min(score, 100);
}
```

### シグナル1: 掲載からの経過日数（最大60点）

最も重みが大きいシグナルです。30日以上掲載されている求人はゴーストの可能性が高い、という経験則をそのままスコアにしています。

```typescript
function daysScore(daysSincePosted: number): number {
  if (daysSincePosted >= 90) return 60;
  if (daysSincePosted >= 60) return 40;
  if (daysSincePosted >= 30) return 20;
  if (daysSincePosted >= 14) return 10;
  return 0;
}
```

掲載日は各プラットフォームの「X日前」「X週間前」テキストをパースして取得します。自然言語のパースは意外と手間がかかります。

```typescript
export function parseDaysAgo(dateText: string): number {
  const text = dateText.toLowerCase().trim();
  if (/today|just posted|now/.test(text)) return 0;
  const hourMatch = text.match(/(\d+)\s*hour/);
  if (hourMatch) return 0;
  const dayMatch = text.match(/(\d+)\s*day/);
  if (dayMatch) return parseInt(dayMatch[1], 10);
  const weekMatch = text.match(/(\d+)\s*week/);
  if (weekMatch) return parseInt(weekMatch[1], 10) * 7;
  const monthMatch = text.match(/(\d+)\s*month/);
  if (monthMatch) return parseInt(monthMatch[1], 10) * 30;
  // Indeedの「30+ days ago」対応
  if (/30\+/.test(text)) return 35;
  return 0;
}
```

### シグナル2: 重複求人数（最大20点）

同じ会社が同職種・同条件で複数の求人を出しているケースは、常にポジションを開放して「人材をストックしている」だけのことが多い。

### シグナル3: 求人票の曖昧さ（最大25点）

説明文が短すぎる（200文字未満）か、具体的なスキル要件がない求人は怪しい。

```typescript
export function checkHasSpecificRequirements(description: string): boolean {
  const patterns = [/year[s]? of experience/i, /proficient in/i, /required:/i, /must have/i];
  return patterns.some(p => p.test(description));
}
```

## コンテンツスクリプト: 3サイト対応のMutationObserver

Indeed・LinkedIn・Glassdoorはいずれも動的なSPAです。ページ遷移のたびにコンテンツが差し替わるため、MutationObserverで変更を監視してスキャンを走らせます。

```typescript
activeObserver = new MutationObserver(() => {
  scanAndInject();
});
activeObserver.observe(document.body, { childList: true, subtree: true });
window.addEventListener('pagehide', () => activeObserver?.disconnect(), { once: true });
```

重要なのは `processing` フラグです。DOMの変更→スキャン→バッジ注入→再度DOMの変更、という無限ループを防ぎます。

```typescript
let processing = false;

async function scanAndInject() {
  if (processing) return;
  processing = true;
  try {
    await doScan();
  } finally {
    processing = false;
  }
}
```

バッジを注入済みの要素には `data-ghostjob-scored` 属性を付けて、2回処理されないようにしています。

```typescript
cards = document.querySelectorAll('.job_seen_beacon:not([data-ghostjob-scored])');
```

## 詰まったポイント: 無料プランの日次制限

Free（20件/日）とPro（無制限）の制限をコンテンツスクリプト側で実装するとき、`chrome.storage.local`への読み書きが多発してレートリミットに引っかかりました。解決策は「1ページ分のスキャン前に残り件数をまとめて取得し、件数分だけ処理してから1回だけ書き込む」方式に変えることです。バックグラウンドスクリプト経由でストレージを集約するのも有効ですが、今回はコンテンツスクリプト完結のシンプルな方法を選びました。

---

https://dev-tools-hub.xyz/extensions/ghostjob/
