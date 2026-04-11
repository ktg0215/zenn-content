---
title: "第8章 — クロスプロモーション：18拡張のポートフォリオをLTVに変える"
---

> 第7章でGA4による計測基盤を整えました。数字を見ると「どの拡張が伸びていて、どの拡張が停滞しているか」が見えてきます。ここで使えるのが「拡張を1本持っていると広告が必要だが、18本持つと拡張間で送客できる」というクロスプロモーションの論理です。この章では、S-Hubの18拡張で実際に実装したクロスプロモーションの設計と落とし穴を解説します。

---

## クロスプロモーションとは

自社の拡張Aのユーザーを、自社の拡張Bのインストールへ誘導することです。

例えば：
- DataPickを使っているユーザーに「物件スカウター」を紹介する（同じ「データを集めたい」ペルソナ）
- ReadMarkを使っているユーザーにProcshot（ガイド作成）を紹介する（読むことに関心があるペルソナ）

### 1拡張 vs 18拡張のLTV比較

```
1拡張の場合:
  新規ユーザー獲得 → 転換 → LTV = $31.92（月額×8ヶ月）
  獲得コスト = CWSの自然流入 + Zenn/X 告知のみ

18拡張の場合:
  拡張A新規ユーザー → クロスプロモ → 拡張B転換
  拡張B → 拡張C転換 ...

  同一ユーザーのLTV = $31.92 × 平均インストール拡張数
  S-Hub実測: 有料転換ユーザーの平均インストール拡張数 = 2.3本
  → LTV = $31.92 × 2.3 = 約 $73/ユーザー
```

CACゼロで既存ユーザーのLTVを2倍以上にできます。

---

## なぜクロスプロモが効くのか

### 信頼の転移

ユーザーはすでに拡張Aを「インストールして使っている」状態です。これは「S-Hubの拡張は信頼できる」という実体験に基づいた認知があります。初対面のユーザーへの広告とは転換率が根本的に異なります。

### S-Hubの実測データ

ReadMarkのポップアップ設定画面末尾に「S-Hubの他の拡張」セクションを追加した結果：

| 指標 | 値 |
|-----|---|
| cross_promo_shown（月間） | 2,400回 |
| cross_promo_clicked | 187回（CTR 7.8%） |
| clicked後のインストール率 | 41% |
| 月間追加インストール（クロスプロモ由来） | 約77件 |

CWSの自然流入と比較して、CACはゼロ。かつCWSリスティングを見て来るユーザーより転換率が高い（CWSリスティングは29%）。

---

## 導線の配置場所5パターン

### ① ペイウォール内「他の拡張も試す」セクション

ペイウォールを閉じようとしているユーザーに、無料の別拡張を紹介します。「お金は払わないが、別の拡張は試す」という離脱防止として機能します。

**CTR実測**: 3.2%（ペイウォールのアップグレードCTRより低いが、離脱防止としての価値あり）

### ② オンボーディング完了画面

「セットアップ完了！」の画面末尾に「同じ開発者の他の拡張」を表示。最初の感動が高いタイミングで信頼を活かす。

**CTR実測**: 12.4%（最高値。Aha Moment直後の感情的な高まりが効く）

### ③ 設定画面末尾

「S-Hubファミリーの拡張」セクションとして常設。積極的にプッシュせず、気づいた人が見る形。

**CTR実測**: 2.1%（低いが、ユーザーの能動的な探索なのでインストール率が高い）

### ④ Review promptの後

「レビューありがとうございます！」のサンキュー画面でクロスプロモ。レビューを書いてくれたユーザーは最も満足度が高い層。

**CTR実測**: 18.7%（最高値に近い。高満足度ユーザーへのリーチ）

### ⑤ アンインストール防止モーダル

「本当に削除しますか？」モーダルで「こんな拡張も試しましたか？」を表示。ただし押しつけがましいと感じさせるリスクがあり、CTRは低め（1.4%）。表示するかは慎重に判断。

---

## ラインナップの動的選択

18拡張を全て列挙するのは認知負荷が高く、かえって離脱を招きます。表示する拡張は最大3本に絞り、動的に選択します。

### インストール済み拡張の除外

```typescript
// cross-promo.ts — インストール済み拡張を除外して候補を絞る

// S-Hubの全拡張IDリスト（manifest.jsonから参照）
const S_HUB_EXTENSIONS: Array<{ id: string; name: string; slug: string }> = [
  { id: 'abcdefghijklmnopqrstuvwxyz123456', name: 'DataPick', slug: 'datapick' },
  { id: 'bcdefghijklmnopqrstuvwxyz123456a', name: 'Procshot', slug: 'procshot' },
  { id: 'cdefghijklmnopqrstuvwxyz123456ab', name: 'FocusGuard', slug: 'focusguard' },
  // ... 残り15拡張
];

// 現在の拡張ID（自分自身を除外するため）
const CURRENT_EXTENSION_ID = chrome.runtime.id;

async function getCrossPromoTargets(maxCount = 3): Promise<typeof S_HUB_EXTENSIONS> {
  // chrome.management APIでインストール済みの拡張IDを取得
  const installed = await chrome.management.getAll();
  const installedIds = new Set(installed.map((ext) => ext.id));

  return S_HUB_EXTENSIONS
    .filter((ext) => ext.id !== CURRENT_EXTENSION_ID) // 自分自身を除外
    .filter((ext) => !installedIds.has(ext.id))        // インストール済みを除外
    .slice(0, maxCount);                                // 最大3本に絞る
}
```

`chrome.management` パーミッションが必要です。`manifest.json` の `permissions` に `"management"` を追加してください。ただしこのパーミッションはCWSの審査でフラグが立つことがあります。審査コメントには「インストール済み拡張の重複表示防止のため」と説明します。

### ユースケース近似度によるソート

DataPickユーザーには「データ収集系」の拡張を優先、ReadMarkユーザーには「読書・リサーチ系」を優先します。

```typescript
// cross-promo.ts — ユースケース近似度マッピング
const USECASE_AFFINITY: Record<string, string[]> = {
  datapick: ['property-scout', 'price-tracker', 'procshot'],
  readmark: ['procshot', 'highlighter', 'focus-guard'],
  procshot: ['datapick', 'readmark', 'loom-alternative'],
  focusguard: ['readmark', 'procshot', 'timer-extension'],
};

function getSortedTargets(
  currentSlug: string,
  candidates: typeof S_HUB_EXTENSIONS
): typeof S_HUB_EXTENSIONS {
  const affinityOrder = USECASE_AFFINITY[currentSlug] ?? [];
  return [...candidates].sort((a, b) => {
    const aIdx = affinityOrder.indexOf(a.slug);
    const bIdx = affinityOrder.indexOf(b.slug);
    // affinityOrderに含まれていないものは末尾
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });
}
```

---

## リスティングカードの作り方

クロスプロモのUIカードには以下の要素を含めます。

```
┌────────────────────────────────────┐
│ [アイコン32px]  DataPick            │
│               No-Code Web Scraper  │
│               ★4.6 · 2,800+       │
│                         [追加する →] │
└────────────────────────────────────┘
```

**制約**: ポップアップの幅（350〜400px）に収める。カードは縦に最大3枚。各カードの高さは64px程度に抑える。

アイコン画像とメタデータ（名前・評価・インストール数）は、バンドルに含めるか外部JSONから取得するかを選択します。

---

## CWS規約との整合

### 自社拡張のみOK

他社の拡張をクロスプロモすることは、CWSのポリシーで禁止されています。「S-Hubファミリー」として自社拡張のみを紹介する形にします。

ストアページの説明文に「S-Hubファミリーの一員」と記載することで、ブランドとしての一貫性を審査担当者に示します。

### Review promptとの競合を避ける

クロスプロモとレビュー依頼を同時に出さないようにします。1セッションに1つのお願いが限界です。フラグを使って排他制御します。

```typescript
// 排他制御: review_promptとcross_promoは同時に出さない
const { reviewPromptShownAt, crossPromoShownAt } =
  await chrome.storage.local.get(['reviewPromptShownAt', 'crossPromoShownAt']);

const daysSinceReview = reviewPromptShownAt
  ? (Date.now() - reviewPromptShownAt) / 86400000
  : Infinity;

const daysSinceCrossPromo = crossPromoShownAt
  ? (Date.now() - crossPromoShownAt) / 86400000
  : Infinity;

// どちらかを表示してから7日以内は何も出さない
if (daysSinceReview < 7 || daysSinceCrossPromo < 7) return;
```

---

## 効果測定

### 計測イベント

| イベント | タイミング |
|--------|---------|
| `cross_promo_shown` | カードが表示された |
| `cross_promo_clicked` | カードをクリックした |
| `cross_promo_installed` | クリック後にインストールされた（別拡張から検知） |

`cross_promo_installed` は別拡張のインストール時に `chrome.runtime.sendMessage` で元の拡張に通知するか、GA4でクリックとインストールのタイムライン照合で推定します。

S-Hub Dashboardでは拡張間の相互流入をマトリクス表示しています。「ReadMarkから何人がDataPickへ行ったか」を月次で確認し、クロスプロモの効果を定量評価します。

---

## 実装の落とし穴

**① chrome.management のCSP問題**

`chrome.management` はContent ScriptからはアクセスできずService Workerからのみ使用可能です。ポップアップから呼ぶ場合は `chrome.runtime.sendMessage` 経由でService Workerに委譲します。

**② 拡張メタデータのキャッシュ**

インストール済みリストを毎回取得するのはコストがかかります。セッション内でキャッシュします。

```typescript
// cross-promo.ts — セッションキャッシュパターン
let cachedTargets: typeof S_HUB_EXTENSIONS | null = null;

async function getCachedCrossPromoTargets(): Promise<typeof S_HUB_EXTENSIONS> {
  if (cachedTargets) return cachedTargets;
  cachedTargets = await getCrossPromoTargets(3);
  return cachedTargets;
}
```

**③ 各拡張の更新頻度ズレ**

拡張Aのコードに「拡張B の最新インストール数」をハードコードすると、拡張Aを更新するたびに全拡張のデータを更新しなければなりません。インストール数・評価は外部JSONで管理するか、表示しないか（アイコン+名前+説明のみ）を選択します。

S-HubではCDNにメタデータJSONを置き、起動時に取得してローカルキャッシュする方法を採用しています。ただしCSP設定でフェッチ先ドメインを `connect-src` に明示する必要があります。

---

:::message
**この章で学んだこと**

- クロスプロモは獲得コストゼロで既存ユーザーのLTVを2倍以上にできる。S-Hub有料ユーザーの平均インストール数は2.3本
- 最も効果的な配置はReview prompt後（CTR 18.7%）とオンボーディング完了画面（12.4%）。満足度が高いタイミングを狙う
- `chrome.management` APIでインストール済み拡張を除外し、最大3本に絞って表示する
- Review promptとクロスプロモは同一セッション・7日以内での重複表示を排他制御で防ぐ
- 拡張メタデータ（インストール数・評価）はハードコードせず外部JSONかCDN管理で鮮度を保つ
:::

---

これで8章分の実践知識が揃いました。最後に、「18本作った先に見えるもの」——数字の先にある個人開発者としての問いに答えます。

**→ [おわりに](./outro.md)**
