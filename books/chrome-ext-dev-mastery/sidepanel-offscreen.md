---
title: "第7章 — サイドパネル・オフスクリーン：常駐UIとバックグラウンドDOM処理"
---

> 第6章でコンテンツスクリプトの設計を習得しました。この章では、MV3で追加された2つの新API——Side PanelとOffscreen Document——を解説します。ポップアップでは実現できない「常駐UI」と、Service Workerで不可能な「バックグラウンドDOM処理」。ProchotでのSide Panel活用と請求書OCR実装を例に、実践的な使い方を示します。

---

## Side Panel とは何か

Chrome 114（2023年5月）から追加された `chrome.sidePanel` APIは、ブラウザウィンドウの右端に常駐するパネルを提供します。

### Popup との根本的な違い

```
Popup（従来）
  ├─ クリックで開く / フォーカス外れで閉じる
  ├─ 開いている間だけ生存（数秒〜数十秒）
  └─ 状態はService Worker or storageに退避必須

Side Panel（MV3以降）
  ├─ タブをまたいで常駐
  ├─ ユーザーが明示的に閉じるまで生存
  └─ React/Vueのstateをメモリに保持できる
```

Side Panelはポップアップを「拡張した」ものではなく、**拡張のUIパラダイムを根本から変える**機能です。ユーザーがWebページを閲覧しながら、拡張のUIを常時参照・操作できます。

### どちらを選ぶか

| ユースケース | 推奨UI |
|------------|--------|
| 設定変更・1回限りの操作 | Popup |
| ページと並行して作業（メモ・翻訳・AIチャット） | Side Panel |
| ページ全体のデータをリアルタイム表示 | Side Panel |
| 軽量なステータス表示 | Popup |

---

## Side Panel の基本セットアップ

```json
// manifest.json — Side Panel の最小設定
{
  "manifest_version": 3,
  "name": "My Extension",
  "permissions": ["sidePanel"],
  "side_panel": {
    "default_path": "sidepanel.html",
    "default_title": "My Extension Panel"
  },
  "action": {
    "default_icon": "icons/icon-128.png"
  }
}
```

`side_panel.default_path` で指定したHTMLファイルがパネルのエントリーポイントです。`sidepanel` パーミッションが必須です。

WXTでは `entrypoints/sidepanel/` ディレクトリに `index.html` と `App.tsx` を置くと自動で `manifest.json` に設定されます。

---

## action.onClicked でパネルを開く

デフォルトではツールバーアイコンのクリックでパネルが開きます。`openPanelOnActionClick` を `true` に設定するのが最もシンプルな方法です。

```typescript
// background.ts — ツールバークリックでSide Panelを開く

chrome.runtime.onInstalled.addListener(() => {
  // 拡張インストール時にパネルの動作を設定
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
```

より細かく制御したい場合は、`action.onClicked` リスナーで手動で開きます。

```typescript
// background.ts — 条件付きでパネルを開く

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.windowId) return;

  // 現在のパネル状態を確認
  const options = await chrome.sidePanel.getOptions({ tabId: tab.id });

  if (options.enabled) {
    // パネルが有効なタブでは開く
    await chrome.sidePanel.open({ windowId: tab.windowId, tabId: tab.id });
  } else {
    // 無効なタブではポップアップにフォールバック（future対応）
    console.log('[SidePanel] Not available for this tab');
  }
});
```

---

## タブ単位 / グローバル の使い分け

Side Panelはタブごとに異なるコンテンツを表示できます。`setOptions` の `tabId` パラメータで制御します。

```typescript
// background.ts — タブ遷移に応じてパネルを切り替える

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);

  if (tab.url?.startsWith('https://www.amazon.co.jp/')) {
    // Amazonのタブでは価格追跡パネルを表示
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'sidepanel-amazon.html',
      enabled: true,
    });
  } else {
    // その他のタブではデフォルトパネル
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'sidepanel.html',
      enabled: true,
    });
  }
});
```

**SPAでのstate保持**: Side Panelはタブが切り替わっても閉じられないため、Reactのstateはそのまま保持されます。長寿命セッション対応として `chrome.storage.session` を活用してもよいですが、単純な表示状態はメモリに持つのが自然です。

---

## Side Panel ↔ background 通信

Side PanelとBackgroundの通信は、Popupとまったく同じ `chrome.runtime.sendMessage` / `chrome.runtime.connect` を使います。ただし、Side Panelは長寿命なためPortによる接続管理が推奨です。

```typescript
// sidepanel.tsx — Port接続でbackgroundとの永続セッション

import { useEffect, useState, useRef } from 'react';

export function SidePanelApp() {
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const [data, setData] = useState<string[]>([]);

  useEffect(() => {
    // Side Panel起動時にPortを開く
    portRef.current = chrome.runtime.connect({ name: 'sidepanel-session' });

    portRef.current.onMessage.addListener((message) => {
      if (message.type === 'DATA_UPDATE') {
        setData(message.payload);
      }
    });

    portRef.current.onDisconnect.addListener(() => {
      // 拡張リロード時に再接続
      portRef.current = null;
    });

    return () => {
      portRef.current?.disconnect();
    };
  }, []);

  const requestData = () => {
    portRef.current?.postMessage({ type: 'FETCH_DATA' });
  };

  return (
    <div className="panel">
      <button onClick={requestData}>データ取得</button>
      <ul>{data.map((item, i) => <li key={i}>{item}</li>)}</ul>
    </div>
  );
}
```

---

## 実例: Procshot の Side Panel 活用

ProchotではSide Panelを使って、作成したガイド一覧をタブの横に常駐させています。ユーザーがWebページを操作しながら、手順書を参照できる設計です。

```tsx
// entrypoints/sidepanel/App.tsx — Procshot ガイド一覧パネル

import { useState, useEffect } from 'react';
import { getLocal } from '../../lib/storage';

interface Guide {
  id: string;
  title: string;
  steps: number;
  createdAt: number;
}

export function ProchotSidePanel() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    // ガイド一覧をstorageから取得
    getLocal('savedGuides').then((data) => {
      if (data) setGuides(data as Guide[]);
    });

    // storage変更を購読（他のタブでガイドが追加された場合に更新）
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ('savedGuides' in changes) {
        setGuides(changes.savedGuides.newValue ?? []);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return (
    <div className="procshot-panel">
      <h1 className="panel-title">保存済みガイド</h1>
      {guides.length === 0 ? (
        <p className="empty-state">ガイドがまだありません</p>
      ) : (
        <ul className="guide-list">
          {guides.map((guide) => (
            <li
              key={guide.id}
              className={`guide-item ${selected === guide.id ? 'selected' : ''}`}
              onClick={() => setSelected(guide.id)}
            >
              <span className="guide-title">{guide.title}</span>
              <span className="guide-steps">{guide.steps}ステップ</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

## chrome.offscreen とは

MV3のService Worker（background）にはDOMが存在しません。そのため、`document.createElement`・`Canvas API`・`DOMParser`・`createObjectURL` などのDOM APIが使えません。

`chrome.offscreen` APIはこの問題を解決します。**非表示のHTMLドキュメントをバックグラウンドで生成し、そこでDOM処理を実行する**仕組みです。

```
MV3以前（MV2）
  background.html（常駐） → DOM API 使い放題

MV3（chrome.offscreen なし）
  Service Worker → DOM API 不可 → 詰む

MV3（chrome.offscreen あり）
  Service Worker → offscreen.html（非表示）に処理委託 → DOM API 使用可
```

---

## offscreen の主な用途

| 用途 | 具体例 |
|------|--------|
| OCR | Tesseract.jsでの画像テキスト抽出 |
| Canvas処理 | 画像リサイズ・フォーマット変換 |
| DOMParser | HTML文字列のパース（@mozilla/readability等） |
| createObjectURL | Blobから一時URLを生成 |
| 音声・動画処理 | Web Audio API、MediaRecorder |
| クリップボード | navigator.clipboard（Service Workerから不可） |

実例として、DataPickの拡張版では請求書PDFをCanvasでレンダリングし、Tesseract.jsでOCR処理するoffscreenドキュメントを使っています。

---

## offscreen の実装

### manifest.json

```json
// manifest.json — offscreen の設定
{
  "permissions": ["offscreen"]
}
```

### offscreen.html

```html
<!-- public/offscreen.html — 非表示HTMLドキュメント -->
<!DOCTYPE html>
<html>
  <head><meta charset="UTF-8"></head>
  <body>
    <canvas id="ocr-canvas"></canvas>
    <script src="offscreen.js" type="module"></script>
  </body>
</html>
```

### offscreen.ts

```typescript
// src/offscreen.ts — DOMで動く処理

import Tesseract from 'tesseract.js';

// background.ts からのメッセージを受信
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'OCR_REQUEST') return false;

  (async () => {
    const { imageDataUrl } = message;

    // Tesseract.jsでOCR（DOM環境が必要）
    const { data } = await Tesseract.recognize(imageDataUrl, 'jpn+eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          // 進捗をbackgroundに通知
          chrome.runtime.sendMessage({
            type: 'OCR_PROGRESS',
            progress: Math.round(m.progress * 100),
          });
        }
      },
    });

    sendResponse({ success: true, text: data.text });
  })();

  return true; // 非同期sendResponseを有効化
});
```

### background.ts（呼び出し側）

```typescript
// background.ts — offscreenドキュメントを作成してOCRを実行

const OFFSCREEN_URL = chrome.runtime.getURL('offscreen.html');

async function ensureOffscreenDocument(): Promise<void> {
  // 既存のoffscreenドキュメントを確認（1拡張につき1つまで）
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [OFFSCREEN_URL],
  });

  if (existingContexts.length > 0) return; // 既に存在する

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [chrome.offscreen.Reason.DOM_PARSER], // 使用理由を明示
    justification: 'OCR processing requires DOM and Canvas API', // 説明文必須
  });
}

export async function runOCR(imageDataUrl: string): Promise<string> {
  await ensureOffscreenDocument();

  const response = await chrome.runtime.sendMessage({
    type: 'OCR_REQUEST',
    imageDataUrl,
    target: 'offscreen', // offscreen側でフィルタリングに使う
  });

  if (!response.success) throw new Error('OCR failed');
  return response.text;
}
```

---

## ライフサイクルと制約

`chrome.offscreen` には重要な制約があります。

**1つのoffscreenドキュメントのみ**: 拡張全体で同時に1つしか作成できません。複数の処理を並列実行したい場合はキューで順次処理します。

**明示的な解放**: 不要になったら `chrome.offscreen.closeDocument()` で解放します。特にメモリを大量に使うOCRやCanvas処理の後は必須です。

```typescript
// background.ts — offscreenの解放と並列処理キュー

// OCRキュー（同時1処理のため順次実行）
const ocrQueue: Array<() => Promise<void>> = [];
let isProcessing = false;

async function processOCRQueue(): Promise<void> {
  if (isProcessing || ocrQueue.length === 0) return;
  isProcessing = true;

  while (ocrQueue.length > 0) {
    const task = ocrQueue.shift()!;
    await task();
  }

  // キューが空になったらoffscreenを解放
  await chrome.offscreen.closeDocument();
  isProcessing = false;
}

export function enqueueOCR(imageDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    ocrQueue.push(async () => {
      try {
        const text = await runOCR(imageDataUrl);
        resolve(text);
      } catch (e) {
        reject(e);
      }
    });
    processOCRQueue();
  });
}
```

---

## よくある罠

**① `reasons` の指定ミスでpermission拒否**

`chrome.offscreen.Reason` は用途に合ったものを選ぶ必要があります。Tesseract.jsなどDOM全般なら `DOM_PARSER`、音声処理なら `AUDIO_PLAYBACK` など複数指定可能です。理由が合っていないとCWS審査で拒否されます。

```typescript
// ❌ 理由が実態と合っていない
reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK]

// ✅ DOM操作が主な理由
reasons: [chrome.offscreen.Reason.DOM_PARSER, chrome.offscreen.Reason.BLOBS]
```

**② 複数処理の同時実行でクラッシュ**

`createDocument` を2回呼ぶとエラーになります。`getContexts` で確認してから作成するか、上記キュー設計で解決します。

**③ CSP制約による外部スクリプト読み込み失敗**

offscreen.htmlもMV3のCSP制約を受けます。外部CDNからスクリプトを読み込む場合はバンドルに含める（ローカル参照する）必要があります。

---

:::message
**この章で学んだこと**

- Side PanelはChrome 114以降で使えるUI。Popupと異なり常駐できるため、ページと並行して作業するユースケース（メモ・翻訳・AI等）に最適
- `setPanelBehavior({ openPanelOnActionClick: true })` でツールバークリックに紐付け。`setOptions({ tabId })` でタブ単位の切り替えが可能
- Side PanelのBackgroundとの通信はPopupと同じsendMessage/Portだが、長寿命なのでPortによる永続セッションが推奨
- Offscreen DocumentはService WorkerからDOM APIを使うための専用HTML。Tesseract.js OCR・Canvas・createObjectURL・DOMParserに対応
- offscreenは1拡張につき1つ制限。`getContexts`で重複を避け、処理完了後は`closeDocument`で解放する。並列処理はキュー設計で対応
:::

---

Side PanelとOffscreen Documentの実装パターンを習得しました。次の章では、Chrome拡張のもう一つの重要テーマ——Cookieとプライバシーを扱います。MV3で変わったCookieアクセスの方法と、CWSのプライバシー審査を通過するための実装パターンを解説します。

**→ [第8章：Cookie・プライバシー対応](./cookie-privacy.md)**
