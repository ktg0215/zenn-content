---
title: "YouTube講義をAIで要約してスタディノートを作るChrome拡張を作った話 — LectureLoop"
emoji: "📚"
type: "tech"
topics: ["chrome拡張", "typescript", "react", "個人開発", "ai"]
published: false
---

## なぜ作ったのか

オンライン学習を続けていると、「見た動画の内容を後で復習できない」問題に直面する。YouTube で 1 時間の講義を見てメモを取るのは重労働だし、字幕ファイルをコピーして ChatGPT に貼り付けるのも一手間だ。

**LectureLoop** は、YouTube の字幕を自動取得して AI が要点をまとめ、フラッシュカード形式のスタディノートを生成する Chrome 拡張だ。講義を見ながらサイドパネルに要約が自動生成され、学習効率が大きく向上する。

## 主な機能

- **字幕自動取得**: YouTube の CC 字幕（自動生成・手動字幕）を取得してテキスト化
- **AI 要点まとめ**: OpenAI GPT-4o-mini を使い、講義の重要ポイントを箇条書きで整理
- **フラッシュカード生成**: 要約から Q&A 形式のカードを自動生成し、記憶定着を支援
- **サイドパネル UI**: YouTube を開いたまま横に並んで確認できる MV3 サイドパネル対応
- **ライト/ダークモード・多言語対応**: 日本語・英語・韓国語・スペイン語

## 技術スタック

```
LectureLoop/
├── entrypoints/
│   ├── popup/        # React ポップアップ（月次使用状況・履歴）
│   ├── sidepanel/    # React サイドパネル（要約・フラッシュカード）
│   ├── content.ts    # YouTube 字幕抽出・動画 ID 検出
│   └── background.ts # AI プロキシ呼び出し・履歴管理
├── lib/
│   ├── constants.ts  # FREE_LIMITS, VERCEL_PROXY_URL
│   ├── storage.ts    # 処理済み動画・フラッシュカードの永続化
│   └── theme.ts      # ライト/ダーク切り替え
└── wxt.config.ts
```

### AI 呼び出しのアーキテクチャ

API キーをユーザーに入力させない方針を採用した。代わりに、Vercel にデプロイしたプロキシエンドポイント経由で OpenAI を呼び出す。

```typescript
// lib/constants.ts
export const VERCEL_PROXY_URL = 'https://s-hub-dashboard-beta.vercel.app/api/llm/chat';

// background.ts
const response = await fetch(VERCEL_PROXY_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'system', content: SUMMARIZE_SYSTEM_PROMPT },
      { role: 'user', content: transcript },
    ],
    model: 'gpt-4o-mini',
  }),
});
```

Chrome 拡張から直接 OpenAI API を叩くとキーが露出するリスクがあるため、この Vercel プロキシ方式を採用した。レート制限もサーバー側で管理できる。

### サイドパネルの実装

MV3 の `chrome.sidePanel` API はまだ比較的新しく、コンテンツスクリプトから `chrome.runtime.sendMessage` で動画 ID を送信し、サイドパネル側がそのイベントを受けて要約処理を開始する仕組みにした。

```typescript
// content.ts: 動画 ID 変化を検出
const videoId = new URLSearchParams(location.search).get('v');
if (videoId && videoId !== lastVideoId) {
  lastVideoId = videoId;
  chrome.runtime.sendMessage({ type: 'VIDEO_CHANGED', videoId });
}
```

YouTube は SPA なので、`MutationObserver` と `popstate` イベントを組み合わせてルート変更を監視している。

## フリーミアム設計

| プラン | 制限 |
|--------|------|
| **Free** | 3 動画 / 月 |
| **Pro（月額 $7）** | 無制限動画 + フラッシュカード無制限生成 |

月 3 本という制限は、「無料で使えることを実感してもらいつつ、定期的に使うユーザーをアップグレードに誘導する」リバーストライアル的な設計。Pro のフラッシュカード機能は学習継続のモチベーション維持に直結するため、課金の動機付けとして機能する。

## 実装で苦労したところ

`chrome.sidePanel` を content script から直接制御できない問題（MV3 の制約）があった。解決策として、background script を仲介者にして、content script → background → sidePanel のメッセージバスを設計した。この設計はデバッグが難しいが、各役割が明確に分離される利点がある。

また、YouTube の自動生成字幕は言語コードが `en-US` や `ja-JP` のように複数候補があるため、優先順位をつけて取得する処理が必要だった。

## 今後の展開

- Coursera / Udemy の字幕への対応
- 定期復習リマインダー（エビングハウス忘却曲線ベース）
- ノートのエクスポート（Markdown / Notion 連携）

オンライン学習を効率化したい方にぜひ試してほしい。

https://chromewebstore.google.com/detail/dkfjdnchkngbkeocblinimimiddfnkbg
