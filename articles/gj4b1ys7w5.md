---
title: "ゴーストジョブ（幽霊求人）を自動検出するChrome拡張を作った話 — GhostJob"
emoji: "👻"
type: "tech"
topics: ["chrome拡張", "typescript", "react", "個人開発", "求職"]
published: false
---

## なぜ作ったのか

転職活動中に感じた違和感がある。LinkedIn や Indeed で「掲載されて 3 ヶ月以上、応募者 200 人超」の求人に応募しても、返信が来ない。調べてみると、これは「ゴーストジョブ（ghost job）」と呼ばれる現象で、実際には採用意欲がほぼない求人が大量に掲載されたままになっているらしい。

**GhostJob** は、Indeed・LinkedIn・Glassdoor の求人ページをリアルタイム分析し、各求人に 0〜100 のゴーストスコアを付けて表示する Chrome 拡張だ。スコアが高いほど「幽霊求人度」が高い。

## 主な機能

- **ゴーストスコア（0-100）表示**: 各求人カードにスコアと判定（実在求人 / 注意 / ゴーストの可能性）をオーバーレイ
- **スコアバー表示**: 視覚的に赤/黄/緑で危険度を可視化
- **3 大媒体対応**: Indeed / LinkedIn Jobs / Glassdoor の DOM に対応
- **スキャン履歴**: ポップアップで今日スキャンした求人リストを確認
- **ライト/ダークモード・多言語対応**: 日本語・英語・韓国語・スペイン語

## 技術スタック

```
GhostJob/
├── entrypoints/
│   ├── popup/        # React ポップアップ（スキャン済み求人リスト）
│   ├── content.ts    # Indeed/LinkedIn/Glassdoor DOM 解析
│   ├── background.ts # スキャン数管理・アラーム
│   └── welcome/      # オンボーディング
├── lib/
│   ├── scoring.ts    # ゴーストスコア計算ロジック
│   ├── i18n.ts       # 4 言語対応（en/ja/ko/es）
│   └── theme.ts      # ライト/ダーク/システム切り替え
└── assets/           # 求人媒体ロゴ等
```

### ゴーストスコアの計算ロジック

スコアは以下の指標を加重合算して算出する：

```typescript
interface GhostSignals {
  daysPosted: number;       // 掲載日数（長いほど+）
  applicantCount: number;   // 応募者数（多いほど+）
  hasClosingDate: boolean;  // 締切日あり（あれば−）
  hasRecruiterActivity: boolean; // 採用担当の最終活動（あれば−）
  repostCount: number;      // 再掲載回数（多いほど+）
}

export function calcGhostScore(signals: GhostSignals): number {
  let score = 0;
  if (signals.daysPosted > 30) score += 20;
  if (signals.daysPosted > 90) score += 20;
  if (signals.applicantCount > 100) score += 15;
  if (signals.applicantCount > 300) score += 10;
  if (!signals.hasClosingDate) score += 10;
  if (!signals.hasRecruiterActivity) score += 15;
  score += Math.min(signals.repostCount * 5, 10);
  return Math.min(score, 100);
}
```

各媒体の DOM 構造が異なるため、`content.ts` にメディアごとのセレクタマップを持ち、MutationObserver でページ内の新着カードを随時処理する。

### スコアの視覚化

```typescript
function ghostLevel(score: number) {
  if (score <= 30) return { label: '実在の可能性大', color: '#16a34a', dot: '🟢' };
  if (score <= 60) return { label: '要注意', color: '#d97706', dot: '🟡' };
  return { label: 'ゴーストの可能性', color: '#dc2626', dot: '🔴' };
}
```

求人カードのタイトル横にスコアと判定ラベルを直接インジェクトし、一覧表示の段階で取捨選択できる。

## フリーミアム設計

| プラン | 制限 |
|--------|------|
| **Free** | 20 スキャン / 日 |
| **Pro（$5/月）** | 無制限スキャン + 企業採用トレンド履歴 + フラグ済み求人 CSV エクスポート |

一日 20 件という制限は、転職活動中に現実的に見る求人数の目安として設定した。本格的に使いたいユーザーに Pro にアップグレードしてもらう設計。

## 開発で大変だったこと

Indeed・LinkedIn・Glassdoor はそれぞれ SPA 構成が異なり、React / Vue の仮想 DOM 更新による DOM 置換タイミングが違う。`MutationObserver` のターゲット要素を媒体ごとに調整し、`disconnect()` の呼び出し漏れによるメモリリークも修正した（v1.0.3 で解消）。

また、求人 ID の安定化も課題だった。LinkedIn はログイン状態によって DOM の属性が変わるため、URL の `jobId` パラメータを優先し、取得できない場合は会社名+タイトルのハッシュを ID として使う仕組みにした。

## 今後の展開

- ゴースト率の高い企業ランキング機能
- 求人 URL の共有時に「ゴーストスコア付き」プレビューカードを生成
- Greenhouse / Lever などの ATS 直接求人ページへの対応

就活・転職活動をしている方はぜひ使ってみてほしい。

https://chromewebstore.google.com/detail/mdjchaohgneaiflafheajamfomeccach
