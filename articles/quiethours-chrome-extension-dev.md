---
title: "通知をミュートしてフォーカス時間を守るChrome拡張を作った話 — Quiethours"
emoji: "🔕"
type: "tech"
topics: ["chrome拡張", "typescript", "react", "個人開発", "生産性"]
published: true
---

## なぜ作ったのか

ディープワーク中に Slack の通知音がなるたびに集中が途切れる。「通知オフにすれば？」という話だが、それをスケジュール管理するのが面倒だ。Google Calendar にすでに「集中タイム」のイベントを入れているのに、そのタイミングで自動的に通知をミュートしてくれるツールが意外と存在しない。

その課題を解決するために **Quiethours** を作った。Google Calendar の集中タイムイベントと連携し、予定に合わせてサイトブロックと通知ミュートを自動化する Chrome 拡張だ。

## 主な機能

- **フォーカスルール管理**: 曜日・時間帯を指定してフォーカス時間を登録
- **Google Calendar 連携**: `https://calendar.google.com/` を参照し、集中タイムイベントを自動検出
- **サイトブロック**: フォーカス中は指定サイトへのアクセスをブロック（デフォルト 10 件まで）
- **ライト/ダークモード**: ポップアップの見た目をシステム設定に合わせて切り替え
- **多言語対応**: 日本語・英語・韓国語・スペイン語に対応

## 技術スタック

```
Quiethours/
├── entrypoints/
│   ├── popup/        # React ポップアップ UI
│   ├── background.ts # Alarm ベースのスケジューラ
│   └── welcome/      # オンボーディング画面
├── lib/
│   ├── constants.ts  # FREE_LIMITS, イベント名
│   ├── storage.ts    # chrome.storage.local ラッパー
│   ├── i18n.ts       # 多言語翻訳テーブル
│   └── theme.ts      # ライト/ダーク切り替え
└── wxt.config.ts
```

フレームワークには **WXT + React + TypeScript** を採用した。WXT は MV3 に対応した Chrome 拡張専用のビルドツールで、HMR・型チェック・コード分割が標準で動く。Service Worker（background.ts）内では `chrome.alarms` API を使い、1 分ごとにフォーカスルールの状態をチェックする。

### フォーカスルールの判定ロジック

```typescript
// lib/storage.ts より
export function getActiveRule(rules: FocusRule[]): FocusRule | null {
  const now = new Date();
  const day = now.getDay();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return rules.find(r =>
    r.enabled &&
    r.dayOfWeek.includes(day) &&
    hhmm >= r.startTime &&
    hhmm < r.endTime
  ) ?? null;
}
```

曜日と HH:MM の文字列比較だけでルールを判定できるため、タイムゾーン問題が発生しない。

## フリーミアム設計

| プラン | 制限 |
|--------|------|
| **Free** | フォーカスルール 1 件 / ブロックサイト 10 件 |
| **Pro（$5/月）** | 無制限ルール・サイト + 週次フォーカス統計レポート |

決済は **ExtensionPay** を使っている。Stripe 管理画面なしに Chrome 拡張へ課金機能を追加できる SaaS で、`extpay.getUser()` の戻り値を見るだけで課金状態を判定できる。

```typescript
const [isPro, setIsPro] = useState(false);
const user = await extpay.getUser().catch(() => ({ paid: false }));
setIsPro(user.paid ?? false);
```

## GA4 トラッキング

`background.ts` のインストール/アップデートイベント、ポップアップの操作イベント（ルール追加・削除、ペイウォール表示など）を Google Analytics 4（測定 ID: `G-H97K0NSECJ`）に送信している。Service Worker 内の未捕捉エラーも `error_sw_crash` イベントとして収集し、バグ発見を早める設計にした。

## 使ってみた感想

自分で使ってみると「フォーカス中に設定変更したい」ニーズが出てきた。今後のアップデートで一時停止ボタンと Google Calendar の OAuth 連携を実装予定。

Chrome ウェブストアで公開中なので、ぜひ使ってみてほしい。

https://chromewebstore.google.com/detail/okdmecodmihlgbkeacmebdikolofccfa
