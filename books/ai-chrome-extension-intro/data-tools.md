---
title: "第6章 — 実例②：データ抽出・自動化ツールを作る"
---

第5章では「閲覧体験を改善する」拡張を見ました。次は「データを取り出す」拡張です。Webページの情報を手でコピーしてスプレッドシートに貼る——この繰り返し作業は多くのビジネスパーソンが毎日やっています。自動化すれば価値が高く、有料転換率も上がります。DataPickの実装から、スクレイピング系拡張の設計パターンを学びましょう。

---

※ この章は以下の記事を再編・加筆したものです。
- [Webページからデータを抜き出すChrome拡張を作った](https://zenn.dev/ktg/articles/df8bbb927b8061)
- [Webページ間のコピペ地獄を終わらせるChrome拡張機能を作った](https://zenn.dev/ktg/articles/947f47c94db163)
- [DataPick × Google Sheets連携ガイド](https://zenn.dev/ktg/articles/datapick-google-sheets)

---

## データ抽出系拡張が高価値な理由

読書補助系と違い、データ抽出系は「ビジネスの生産性向上」に直結します。

- **痛みが明確** — 手作業でのコピペは誰もが嫌
- **繰り返し使われる** — 毎週・毎日の定期作業になりやすい
- **有料転換しやすい** — 「仕事で使えるなら払う」層がいる

## 事例：DataPick — ノーコードWebスクレイピング

### 解決した課題

「特定のECサイトの商品名・価格・在庫をExcelに転記したい」「複数のページから同じ形式のデータを収集したい」——こういった作業は多くのビジネスパーソンが手作業で行っています。DataPickはコードなしで要素をクリック選択してデータを抽出し、CSV/ExcelにエクスポートできるChrome拡張です。

### 技術構成

```
TypeScript + React（Vite + CRXJS）
Content Script（DOM要素の選択・ハイライト）
Background Service Worker（データの一時保存）
chrome.downloads API（CSVエクスポート）
```

## DOM要素の選択と抽出

### コンテンツスクリプトで要素を選択する

```typescript
// src/content.ts
let isSelecting = false;

// 選択モードのON/OFF（バックグラウンドからのメッセージで制御）
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'TOGGLE_SELECT') {
    isSelecting = !isSelecting;
    document.body.style.cursor = isSelecting ? 'crosshair' : '';
  }
});

// クリックした要素とその類似要素を全取得
document.addEventListener('click', (e) => {
  if (!isSelecting) return;
  e.preventDefault();
  e.stopPropagation();

  const element = e.target as HTMLElement;
  const cssSelector = generateOptimalSelector(element);

  // 同じパターンに一致する全要素を取得
  const allElements = document.querySelectorAll(cssSelector);
  const data = Array.from(allElements).map(el => el.textContent?.trim() ?? '');

  chrome.runtime.sendMessage({ type: 'ELEMENTS_FOUND', data, selector: cssSelector });
});
```

### CSSセレクタを自動生成する

```typescript
// src/content.ts
function generateOptimalSelector(el: HTMLElement): string {
  // id > class > タグ+位置 の優先順位でセレクタを生成
  if (el.id) return `#${el.id}`;

  const classSelector = [...el.classList]
    .filter(c => !c.match(/^\d|hover|active|focus/))  // 動的クラスを除外
    .map(c => `.${c}`)
    .join('');
  if (classSelector) return `${el.tagName.toLowerCase()}${classSelector}`;

  // 親要素との相対位置でフォールバック
  const parent = el.parentElement;
  if (!parent) return el.tagName.toLowerCase();
  const index = [...parent.children].indexOf(el) + 1;
  return `${generateOptimalSelector(parent)} > :nth-child(${index})`;
}
```

## CSVへのエクスポート

```typescript
// src/background.ts（Service Worker）
function exportToCSV(headers: string[], rows: string[][]): void {
  // BOMを付与してExcelで文字化けを防ぐ
  const bom = '\uFEFF';
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  const dataUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(bom + csvContent)}`;

  chrome.downloads.download({
    url: dataUrl,
    filename: `datapick-export-${new Date().toISOString().slice(0, 10)}.csv`,
  });
}
```

## Google Sheetsへの直接書き込み

さらに一歩進めて、Google Sheets APIで直接スプレッドシートに書き込む連携も実現できます。

```typescript
// src/popup/sheets.ts
async function appendToSheet(
  spreadsheetId: string,
  values: string[][],
  accessToken: string
): Promise<void> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:append?valueInputOption=RAW`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Sheets API error: ${error.error?.message}`);
  }
}
```

### Google OAuth認証の取得

Chrome拡張でのGoogle OAuth認証は`chrome.identity.getAuthToken`で取得します。

```typescript
// src/popup/auth.ts
async function getGoogleAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(token as string);
    });
  });
}
```

## データ抽出拡張を作るときの注意点

### robots.txtと利用規約の確認

スクレイピングはサイトの利用規約で禁止されている場合があります。「個人利用目的で、サーバーに過度な負荷をかけない」用途であることをREADMEに明示しておくと審査が通りやすいです。

### リクエスト間隔の制御

```typescript
// src/utils/rateLimit.ts
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRateLimit(urls: string[], delayMs = 2000): Promise<string[]> {
  const results: string[] = [];
  for (const url of urls) {
    const response = await fetch(url);
    results.push(await response.text());
    await sleep(delayMs);  // 2秒間隔でリクエスト
  }
  return results;
}
```

### chrome.alarms APIで定期実行

```typescript
// src/background.ts
// 1時間ごとにデータ収集
chrome.alarms.create('hourly-fetch', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'hourly-fetch') {
    // 自動収集処理
  }
});
```

## データ抽出拡張の設計パターンまとめ

| 機能 | 実装方法 |
|------|---------|
| DOM要素の視覚的選択 | `mouseover`ハイライト + `click`で確定 |
| CSSセレクタの自動生成 | id → class → nth-child の優先順位で生成 |
| CSV出力 | BOM付きdata URL + `chrome.downloads.download` |
| Google Sheets書き込み | Sheets API + `chrome.identity.getAuthToken` |
| 定期的なデータ収集 | `chrome.alarms` API |

---

:::message
**この章で学んだこと**

- データ抽出系はビジネスユーザーに価値が高く有料転換しやすい
- コンテンツスクリプトでクリックイベントを使い、DOM要素を視覚的に選択できる
- BOM（`\uFEFF`）を付与することでExcelでの文字化けを防げる
- Google OAuth認証は`chrome.identity.getAuthToken`で取得できる
- `chrome.alarms`で定期実行を実現（Service Workerのスリープを回避）
:::

---

拡張機能が完成したら、いよいよ世界に公開する番です。次の章では、Chrome Web Storeへの公開手順を費用・審査・注意点すべて含めて解説します。

**→ [第7章：Chrome Web Storeに公開する](./publish-to-cws.md)**
