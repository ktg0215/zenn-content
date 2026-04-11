---
title: "第2章 — ビルドツール選定：WXT・CRXJS・Custom Viteを使い分ける"
---

> 第1章でMV3のアーキテクチャを理解しました。次の問いは「どのビルドツールで開発するか」です。Chrome拡張は複数のエントリーポイント（popup・background・content script）を持つ特殊なビルド対象です。WXT・CRXJS・Custom Vite——それぞれの特性と選定基準を、S-Hubの18拡張での経験をもとに解説します。

---

## ビルドツールを選ぶ必要がある理由

「vanilla JSで書けばいいのでは？」という疑問は正当です。実際、Chrome拡張はHTMLとJavaScriptだけで動きます。ではなぜビルドツールが必要か。

### vanilla JSで開発し続けるリスク

| 問題 | 内容 |
|-----|-----|
| TypeScript非対応 | `chrome.storage.local.get` の返り値が `any`。型エラーを実行時まで検出できない |
| HMR（ホットリロード）なし | コードを変更するたびに「拡張の更新→ページリロード」が必要。開発効率が著しく低下 |
| バンドル最適化なし | import文が使えない or 大量の `<script>` タグが必要 |
| i18n管理が手動 | `_locales/` のJSONを直接編集。型保証なし |
| zip生成が手動 | リリースのたびにファイルを選んでzip化 |

3本目の拡張をvanilla JSで書いていた時期に、「ファイルを変更→拡張を更新→テストページをリロード→動作確認」を1日100回繰り返していました。ビルドツールに移行してHMRが使えるようになった時点で、開発速度は体感で3倍になりました。

---

## WXT — S-Hubの標準ビルドツール

WXT（Web Extension Tools）はViteベースのChrome拡張フレームワークです。S-Hubでは18本中15本がWXTを採用しています。

### 最小構成

```typescript
// wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    permissions: ['storage', 'activeTab'],
    default_locale: 'en',
  },
});
```

```
# プロジェクト構造
my-extension/
├── wxt.config.ts
├── package.json
├── entrypoints/
│   ├── popup/
│   │   ├── index.html
│   │   └── App.tsx
│   ├── background.ts        ← Service Worker
│   ├── content.ts           ← Content Script
│   └── options/
│       ├── index.html
│       └── App.tsx
├── public/
│   ├── icons/
│   └── _locales/
└── components/
    └── shared/
```

### WXTの主要機能

**① 自動マニフェスト生成**

`wxt.config.ts` に書いた設定と `entrypoints/` のファイル構造から `manifest.json` を自動生成します。`popup/index.html` があれば `"action": { "default_popup": "popup.html" }` が自動で入ります。

**② HMR（ホットリロード）**

ポップアップ・コンテンツスクリプト・オプションページはHMRが動きます。`npm run dev` を起動したまま開発でき、変更がブラウザに即反映されます。

**③ i18nの型安全対応（@wxt-dev/i18n）**

```typescript
// i18n.ts — WXT i18nモジュール
import { defineExtensionMessaging } from '@wxt-dev/i18n';

// locales/en.json の型が自動生成される
const { t } = useI18n();
const label = t('extensionName'); // 型補完が効く
```

**④ ブラウザ互換対応**

```typescript
// wxt.config.ts — Firefox/Edge同時対応
export default defineConfig({
  browser: process.env.BROWSER as 'chrome' | 'firefox' | 'edge' ?? 'chrome',
  manifest: {
    // Firefox固有の設定は browser_specific_settings で自動分岐
  },
});
```

### WXTのメリット・デメリット

| メリット | デメリット |
|--------|---------|
| ゼロ設定でTypeScript + React | カスタムViteプラグインの追加に制約がある場合がある |
| HMR完全対応 | WXTのバージョンアップで設定が変わることがある |
| i18n・zip・型定義が統合 | entrypoints/ 命名規則に従う必要がある |
| ドキュメントが充実 | 大規模バンドル最適化の自由度がCustom Viteより低い |
| AI（Claude/Cursor）との相性が良い | — |

---

## CRXJS — ViteネイティブなChrome拡張プラグイン

CRXJS（`@crxjs/vite-plugin`）はViteの公式エコシステムに近い位置づけのプラグインです。`manifest.json` をビルドの起点にし、Viteの設定をそのまま活かせます。

### 設定例

```typescript
// vite.config.ts — CRXJS
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
});
```

```json
// manifest.json — CRXJS はこのファイルをそのまま読む
{
  "manifest_version": 3,
  "name": "My Extension",
  "version": "1.0.0",
  "action": {
    "default_popup": "src/popup/index.html"
  },
  "background": {
    "service_worker": "src/background/index.ts",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/index.ts"]
    }
  ]
}
```

### CRXJSのメリット・デメリット

| メリット | デメリット |
|--------|---------|
| 生のVite設定がそのまま使える | 2024年以降の更新が断続的（メンテナンス頻度が低下） |
| manifest.json を手書きできる（自由度高） | npm install時に依存関係トラブルが発生しやすい |
| HMRがWXT同等に動く | WXTほどのi18n/zip統合機能がない |
| Viteプラグインの全力活用 | ドキュメントがWXTより薄い |

**注意**: 2025年時点でCRXJSのGitHubリポジトリへのコミット頻度が低下しています。新規プロジェクトへの採用はリスクを考慮してください。S-Hubでは既存の3拡張がCRXJSを使っていますが、新規はWXTに統一しています。

---

## Custom Vite — 最大柔軟性の代償

すべてを手動で設定する方法です。Viteのマルチエントリーポイント機能を使い、ビルド出力を `dist/` に手動で整えます。

```typescript
// vite.config.ts — Custom Vite（マルチエントリー完全手動）
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    // manifest.json と _locales/ を dist/ にコピーするカスタムプラグイン
    {
      name: 'copy-manifest',
      writeBundle() {
        mkdirSync('dist/_locales/en', { recursive: true });
        copyFileSync('public/manifest.json', 'dist/manifest.json');
        copyFileSync('public/_locales/en/messages.json', 'dist/_locales/en/messages.json');
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
```

Custom Viteは「なんでもできる」代わりに、manifest.jsonのコピー・_localesの管理・zip生成・Service Workerの出力名の固定など、WXTが自動でやってくれることをすべて手動で書く必要があります。

---

## 3強比較表

| 機能 | WXT | CRXJS | Custom Vite |
|-----|-----|-------|------------|
| 設定量 | 少（wxt.config.tsのみ） | 中（vite.config.ts + manifest.json） | 多（全手動） |
| HMR | ✅ 完全対応 | ✅ 完全対応 | △ 手動設定 |
| TypeScript | ✅ 自動 | ✅ Viteと同等 | ✅ 手動設定 |
| i18n統合 | ✅ @wxt-dev/i18n | ✗ | ✗ |
| zip生成 | ✅ `wxt zip` | ✗（手動） | ✗（手動） |
| ブラウザ互換 | ✅ Firefox/Edge対応 | △ Chrome中心 | 自前実装 |
| カスタマイズ | ○ | ◎ | ◎◎ |
| ドキュメント | ✅ 充実 | △ 更新が遅い | Vite公式のみ |
| S-Hub採用実績 | 15本 | 3本（移行予定） | 0本 |

---

## 選定フローチャート

```
新しいChrome拡張を作る
    ↓
初めてのChrome拡張開発 or 3本未満?
    → YES → WXT（ゼロ設定で即開始できる）
    ↓ NO
複数のViteプラグインを組み合わせたい?
既存のViteプロジェクトに拡張機能を追加したい?
    → YES → CRXJS（ただしメンテ状況を確認）
    ↓ NO
特殊な出力形式 or ビルドパイプラインが必要?
    → YES → Custom Vite
    ↓ NO
    → WXT（S-Hub推奨）
```

---

## package.json scripts の標準化

WXTを前提とした標準スクリプト構成です。

```json
// package.json
{
  "scripts": {
    "dev": "wxt",
    "dev:firefox": "wxt -b firefox",
    "build": "wxt build",
    "build:firefox": "wxt build -b firefox",
    "zip": "wxt zip",
    "zip:firefox": "wxt zip -b firefox",
    "typecheck": "vue-tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx",
    "prepare": "wxt prepare"
  }
}
```

CI/CD（GitHub Actions）での実行を想定すると、`typecheck` → `lint` → `build` → `zip` の順で実行します。

---

## よくあるトラブル5選

**① HMRが動かない（ポップアップが更新されない）**

拡張のポップアップウィンドウを閉じてから再度開く必要がある場合があります。WXTの場合は `npm run dev` 再起動で解消することが多い。Chromeの「パックされていない拡張機能を読み込む」で `dist/` ではなく `.output/chrome-mv3/` を指定しているか確認してください。

**② Service Workerで型エラー**

WXTでService Workerを書くとき、`window` オブジェクトへのアクセスで型エラーが出ます。Service Workerコンテキストには `window` がないためです。`self` を使うか、`tsconfig.json` の `lib` に `"WebWorker"` を追加します。

```json
// tsconfig.json — Service Worker向け設定
{
  "compilerOptions": {
    "lib": ["ESNext", "WebWorker"],
    "strict": true
  }
}
```

**③ `_locales/` が認識されない**

WXTでは `public/_locales/` に配置します（`src/_locales/` ではない）。ビルド後に `dist/_locales/` にコピーされることを確認してください。

**④ Source Mapがdevtoolsに表示されない**

`wxt.config.ts` に `vite: { build: { sourcemap: true } }` を追加します。本番ビルドではパフォーマンスのためにfalseにします。

**⑤ 本番ビルドのバンドルサイズ肥大**

`wxt.config.ts` で不要なchunkを分析します。

```typescript
// wxt.config.ts — バンドル分析
export default defineConfig({
  vite: () => ({
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // React系をchunkに分離
            vendor: ['react', 'react-dom'],
          },
        },
      },
    },
  }),
});
```

---

:::message
**この章で学んだこと**

- Chrome拡張開発にビルドツールが必要な理由はHMR・TypeScript・バンドル最適化・zip生成の4点
- WXTはゼロ設定でTypeScript + React + HMRが動く。S-Hubの18本中15本が採用
- CRXJSはViteの自由度を活かせるが、2024〜2025年時点でメンテ頻度が低下している
- Custom Viteは最大柔軟性だが、WXTが自動化してくれることをすべて手書きするコストがかかる
- `typecheck → lint → build → zip` のCIパイプラインを最初から用意することで、リリース品質を維持する
:::

---

ビルドツールが整いました。次は「型安全なコードをどう書くか」です。第3章では、TypeScript strict modeの設定と `@types/chrome` を活用した型定義パターン——特にメッセージパッシングの型設計——を解説します。

**→ [第3章：TypeScript strict modeとchrome.*型定義](./typescript-types.md)**
