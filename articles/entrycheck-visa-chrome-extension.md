---
title: "190カ国のビザ・入国要件をブラウザ内で即確認するChrome拡張を作った話 — EntryCheck"
emoji: "🛂"
type: "tech"
topics: ["chrome拡張", "typescript", "react", "個人開発", "旅行"]
published: true
---

## なぜ作ったのか

海外旅行を計画するとき、「この国はビザが要るのか？」という確認作業が地味に面倒だ。外務省のサイトや IATA Travel Centre を行き来して、国ごとにタブを開いて調べる。特に複数国を周遊するルートを検討しているとき、この繰り返し作業は疲弊する。

**EntryCheck** は、そのリサーチを Chrome のポップアップ内で完結させる拡張だ。出発国と目的国を選ぶだけで、ビザ要件・滞在可能日数・入国条件を即座に表示する。

## 主な機能

- **ワンクリック照会**: 国籍と目的地を選択するだけで要件を表示
- **190 カ国以上対応**: ほぼ全ての旅券 × 目的地の組み合わせをカバー
- **要件ステータス表示**: ビザ不要 / ビザ on Arrival / 事前取得必要 / 入国不可 をカラーバッジで識別
- **ライト/ダークモード**: `applyTheme()` 関数でポップアップに即時反映
- **多言語対応**: 日本語・英語・韓国語・スペイン語

## 技術スタック

```
EntryCheck/
├── entrypoints/
│   ├── popup/        # React ポップアップ（国籍・目的地セレクタ）
│   ├── content.ts    # 旅行サイトへの情報オーバーレイ
│   ├── background.ts # ストレージ管理・GA4 イベント
│   └── welcome/      # 初回オンボーディング
├── lib/
│   ├── visa.ts       # ビザ要件データベース + 照会ロジック
│   ├── countries.ts  # 190 カ国リスト（コード・名称）
│   ├── storage.ts    # EntrySettings の読み書き
│   └── i18n.ts       # 4 言語翻訳
└── data/             # ビザ要件 JSON データセット
```

WXT + React + TypeScript 構成。`visa.ts` に 190 カ国×190 カ国分のビザ要件マトリックスを持ち、`getVisaRequirement(nationality, destination)` でクライアントサイドのみで解決できる。外部 API への依存がないため、オフライン動作も可能だ。

### ビザ照会の実装

```typescript
export type VisaStatus = 'visa_free' | 'visa_on_arrival' | 'e_visa' | 'visa_required' | 'not_admitted';

export interface VisaRequirement {
  status: VisaStatus;
  duration?: number; // 滞在可能日数
  notes?: string;
}

export async function getVisaRequirement(
  nationality: string,
  destination: string
): Promise<VisaRequirement | null> {
  // ローカルの JSON データセットを参照
  const key = `${nationality}_${destination}`;
  return VISA_DATA[key] ?? null;
}
```

ステータスごとに色と絵文字をマッピングし、視覚的に一目でわかる UI にした。

### コンテンツスクリプトによるオーバーレイ

`content.ts` は Google Flights や Booking.com のページで動作し、目的地が検出されたときに自動でビザ要件のバッジをオーバーレイ表示する。`MutationObserver` で SPA のルート変更を監視し、ページ遷移後も正しく動作する。

## フリーミアム設計

| プラン | 制限 |
|--------|------|
| **Free** | 10 ルックアップ / 月 |
| **Pro（$4/月）** | 無制限ルックアップ + 複数国比較 + 要件変更メールアラート |

Free のルックアップ上限は `chrome.storage.local` に `usageCount` として保持し、月が変わったらリセットする設計。ExtensionPay で課金判定を行い、上限超過時にペイウォールモーダルを表示する。

## 設計で意識したこと

旅行サイトを開いたまま情報を確認できる「タブを離れない」UX を最重視した。ポップアップ幅は 380px 固定で、縦スクロールなしで要件全体が見える高さに収めた。また、「先月調べた国と条件が変わっていないか」という不安を解消するため、Pro ユーザー向けにアラート機能を用意している。

## 今後の展開

- 複数国を一括比較するリスト表示（Pro 機能）
- 旅程に沿った乗り継ぎ国のビザ要件連鎖チェック
- パスポートスキャンによる国籍自動判定

海外旅行・出張の前にぜひ使ってみてほしい。

https://chromewebstore.google.com/detail/gfbdmeieifamgheecbmdpadniofodkfa
