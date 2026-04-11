---
title: "第9章 — デバッグ・テスト・リリース：品質を保って速くリリースする"
---

> 第8章でCookieとプライバシー対応を習得しました。この章では「動くコードを出荷する」ための実践——デバッグの基本からVitest・Playwright E2E・GitHub Actions自動化・CWS審査の落とし穴まで——S-Hub 18本のリリース経験から得た実践知識を一気に解説します。

---

## Chrome拡張デバッグの基本

Chrome拡張はコンテキストが複数あり、デバッグの入り口が分かれています。

### コンテキスト別 DevTools の開き方

| コンテキスト | DevToolsを開く方法 | console.log が見える場所 |
|------------|-----------------|----------------------|
| Popup | ポップアップを右クリック → 「検証」 | Popupの DevTools Console |
| Service Worker (background) | `chrome://extensions` → 拡張の「Service Worker」リンク | SWのDevTools Console |
| Content Script | 対象ページで F12 → Console（ドロップダウンでextensionのコンテキスト選択） | ページの DevTools Console |
| Side Panel | サイドパネルを右クリック → 「検証」 | SidePanelの DevTools Console |
| Offscreen Document | `chrome://extensions` → 「Offscreen Document」リンク（表示される場合） | Offscreenの DevTools Console |

**Service Workerの再起動タイミング**: Service Workerは約30秒間アクティビティがないと停止します。停止中はイベントが来ると自動で再起動しますが、ブレークポイントを踏んでいる状態で30秒以上経つと強制終了します。デバッグ中はDevToolsを開いたままにすると停止を遅らせられます。

---

## sourcemap 設定

```typescript
// wxt.config.ts — 開発は sourcemap あり、本番は非公開

export default defineConfig({
  vite: () => ({
    build: {
      // 開発ビルドのみ sourcemap を有効化
      sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : false,
    },
  }),
});
```

本番ビルドに sourcemap を含めると、バンドルに含まれた場合にソースコードが読まれる可能性があります。また、CWSのzip審査では sourcemap ファイルのサイズが気になることもあります。`.wxt/` と `dist/` の中間生成物を `.gitignore` に追加し、リリース用の `zip` は `wxt zip` コマンドで作成します。

---

## ユニットテスト戦略

### chrome.* APIのモック（Vitest）

```typescript
// src/lib/__tests__/storage.test.ts — chrome.storage のモックと型安全テスト

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLocal, setLocal } from '../storage';

// chrome.* グローバルをモック
const mockStorage: Record<string, unknown> = {};

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: mockStorage[key] })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(mockStorage, items);
      }),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
});

describe('storage wrapper', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    vi.clearAllMocks();
  });

  it('setLocal / getLocal でデータを保存・取得できる', async () => {
    await setLocal('usageCount', 5);
    const result = await getLocal('usageCount');
    expect(result).toBe(5);
  });

  it('存在しないキーは undefined を返す', async () => {
    const result = await getLocal('usageCount');
    expect(result).toBeUndefined();
  });

  it('型不一致はコンパイルエラー（実行時テストは不要）', () => {
    // @ts-expect-error — 型チェックがコンパイル時に働いていることの確認
    // setLocal('usageCount', 'five');
    expect(true).toBe(true);
  });
});
```

`vitest.config.ts` に `globals: true` を設定し、`@vitest/coverage-v8` でカバレッジを取得します。`chrome.*` は TypeScript の型定義（`@types/chrome`）があるので、モックも型に沿って書けます。

---

## 統合テスト（Playwright E2E）

拡張機能のE2EテストはPlaywrightを使います。**重要: Chrome拡張は `headless: false` でないと動作しません。**

```typescript
// e2e/popup.spec.ts — Playwright で popup 起動テスト

import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.resolve('dist'); // WXT build output

let context: BrowserContext;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false, // 拡張機能は headless 不可
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });
});

test.afterAll(async () => {
  await context.close();
});

test('Popup が正しく表示される', async () => {
  // Service Worker からExtension IDを取得
  const [background] = context.serviceWorkers();
  const extensionId = background.url().split('/')[2];

  // Popup を直接開く
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  // UI要素の確認
  await expect(page.locator('h1')).toContainText('DataPick');
  await expect(page.locator('[data-testid="usage-count"]')).toBeVisible();
});

test('Paywall が無料制限超過時に表示される', async () => {
  // storage に使用回数を注入
  const background = context.serviceWorkers()[0];
  await background.evaluate(() => {
    const key = `usage_exportRows_${new Date().toISOString().slice(0, 7)}`;
    chrome.storage.local.set({ [key]: 6 }); // FREE_LIMIT + 1
  });

  const extensionId = background.url().split('/')[2];
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await page.click('[data-testid="export-button"]');
  await expect(page.locator('.paywall-modal')).toBeVisible();
});
```

---

## CI/CD（GitHub Actions）

```yaml
# .github/workflows/ci.yml — ビルド・テスト・zip の自動化

name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: 型チェック
        run: npm run typecheck

      - name: リント
        run: npm run lint

      - name: ユニットテスト
        run: npm run test

      - name: ビルド
        env:
          VITE_GA4_MEASUREMENT_ID: ${{ secrets.GA4_MEASUREMENT_ID }}
          VITE_GA4_API_SECRET: ${{ secrets.GA4_API_SECRET }}
          VITE_EXTPAY_ID: ${{ secrets.EXTPAY_ID }}
        run: npm run build

      - name: zip 作成
        run: npm run zip

      - name: zip を artifact として保存
        uses: actions/upload-artifact@v4
        with:
          name: extension-zip
          path: .output/*.zip

  # mainブランチのみCWSへ自動アップロード
  upload-to-cws:
    needs: build-and-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/download-artifact@v4
        with:
          name: extension-zip

      - name: CWSへアップロード（審査キューに投入）
        uses: mnao305/chrome-extension-upload@v4.0.1
        with:
          file-path: '*.zip'
          extension-id: ${{ secrets.CWS_EXTENSION_ID }}
          client-id: ${{ secrets.CWS_CLIENT_ID }}
          client-secret: ${{ secrets.CWS_CLIENT_SECRET }}
          refresh-token: ${{ secrets.CWS_REFRESH_TOKEN }}
          publish: false  # 自動公開はしない（手動で Publish ボタンを押す）
```

`publish: false` にしているのは、CWSへのアップロードと公開を分離するためです。自動アップロードで審査キューに入れ、審査通過後に手動でDashboardから「Publish」を押すのがS-Hubの標準運用です。

---

## リリースプロセス

```bash
#!/bin/bash
# scripts/release.sh — バージョンアップからzip作成まで

set -e

# 引数チェック（例: ./release.sh 1.2.0）
if [ -z "$1" ]; then
  echo "Usage: ./release.sh <new_version>"
  exit 1
fi

NEW_VERSION="$1"

echo "=== Releasing v${NEW_VERSION} ==="

# 1. manifest.json のバージョンを更新
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '${NEW_VERSION}';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
  console.log('package.json updated');
"

# 2. 型チェック・ビルド・zip
npm run typecheck
npm run build
npm run zip

# 3. git タグを作成
git add package.json
git commit -m "chore: release v${NEW_VERSION}"
git tag "v${NEW_VERSION}"

echo "=== Done: v${NEW_VERSION} ==="
echo "次のステップ:"
echo "  git push && git push --tags"
echo "  CWS Dashboard で Publish ボタンを押す"
```

バージョニングはsemverに従います。S-Hubでは以下のルールを採用しています。
- **patch** (1.0.x): バグ修正・文言変更
- **minor** (1.x.0): 新機能追加・UI改善
- **major** (x.0.0): 非互換変更・リブランド

---

## Chrome Web Store審査の落とし穴10選

S-Hub 18本のリリース経験から、審査リジェクトになった（または危うくなった）パターンをまとめます。

| # | 原因 | 対策 |
|---|------|------|
| 1 | **パーミッション過剰** | 使っていない権限は削除。`cookies`+`<all_urls>`は要説明 |
| 2 | **remote code** | `chrome-webstore-upload` で事前確認。外部スクリプト読み込みは即リジェクト |
| 3 | **説明文と機能の不一致** | 審査員が「説明に書いた機能がない」と判断するとリジェクト |
| 4 | **アイコン著作権侵害** | 有名ブランドのロゴ・フォントを改変して使うのは危険 |
| 5 | **Privacy Policy なし** | `cookies`・`storage`・外部API送信があればPP必須 |
| 6 | **eval() / new Function()** | バンドラーの最適化で混入することがある。`wxt build` 後に確認 |
| 7 | **インストール直後のリダイレクト** | `onInstalled` でウェルカムページを開くのはOKだが、外部の販売ページへの強制リダイレクトはNG |
| 8 | **宣伝的すぎるスクリーンショット** | 「世界No.1」「最高」等の根拠のない表現はNG |
| 9 | **host_permissions の説明不足** | 各ホストがなぜ必要かを Permission Justification に記載 |
| 10 | **バージョン0.x.x での公開** | 審査は通るが、ユーザー心理的に `1.0.0` 以上が望ましい |

審査期間の目安: 初回公開は **3〜7営業日**、更新（軽微）は **1〜3営業日**、更新（権限追加あり）は **3〜7営業日** が目安です。2023年以降は審査が厳格化されたため、余裕を持ったスケジュールが必要です。

---

## ロールバック戦略

CWSには「バージョンを戻す」機能がありません。不具合のある新バージョンを公開してしまった場合の対処法は1つです——**旧バージョンのコードを新しいバージョン番号で再アップロード**します。

```bash
# scripts/rollback.sh — 緊急ロールバック手順

# 1. 問題のあるバージョンを特定
git log --oneline | head -10

# 2. 直前の安定バージョンのタグを確認
git tag | sort -V | tail -5

# 3. 安定バージョンのコードをチェックアウト（新しいブランチで）
git checkout v1.1.0 -b hotfix/rollback-to-1.1.0

# 4. package.json のバージョンを現行より新しい番号に変更
# (例: 問題があるのが 1.2.0 なら、1.2.1 として旧コードを再アップロード)
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '1.2.1'; // 現行より新しいバージョン番号が必須
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

# 5. ビルド・zip・CWSにアップロード
npm run build && npm run zip
# → CWS Dashboardで手動アップロード or chrome-webstore-upload-cli で送信
```

**予防策**: `publish: false` でCIはアップロードだけにして、本番反映（Publish）は常に手動で行うことでロールバックの機会を確保します。

---

:::message
**この章で学んだこと**

- Chrome拡張のデバッグはコンテキスト（Popup/SW/ContentScript/SidePanel）ごとにDevToolsの開き方が異なる。Service Workerは30秒で停止するため、ブレークポイントは慎重に
- `chrome.*` APIのモックはVitest + `vi.stubGlobal('chrome', ...)` で型安全に実装できる。テストは「動作確認」よりも「型の保証」が主な価値
- Playwright E2Eテストは `headless: false` が必須。`launchPersistentContext` + `--load-extension` でExtension IDを取得し、popupページを直接開いてテストする
- GitHub ActionsのCIは `typecheck → lint → test → build → zip → upload` の順。`publish: false` でアップロードと公開を分離し、本番反映は手動で行う
- CWSにロールバック機能はない。緊急時は旧コードに新しいバージョン番号を付けて再アップロード。これを防ぐため `publish: false` 運用が必須
:::

---

デバッグ・テスト・リリースの実践フローを習得しました。最終章では、Book 3全体を通じて得た知識の「Gotchas（落とし穴）17選」と付録をお届けします。本番でハマりやすい罠とその回避パターンを凝縮しています。

**→ [付録：Gotchas 17選・チートシート](./appendix.md)**
