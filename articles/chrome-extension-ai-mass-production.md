---
title: "コードが書けなくてもChrome拡張を量産できる開発フロー — AI活用の実践"
emoji: "🤖"
type: "idea"
topics: ["chrome拡張機能", "個人開発", "ai", "バイブコーディング", "claude"]
published: false
published_at: 2026-04-23 07:00
---

## はじめに

「Chrome拡張を17本作っている」と言うと、たいてい驚かれる。しかも自分は本業プログラマーではない。

実は、この17本のほとんどはAI（Claude）との協働で作っている。コードを一行一行書くのではなく、**設計と判断に集中して、実装はAIに任せる**というフローだ。

この記事では、AI活用でChrome拡張を「量産」するための具体的なフローを公開する。

[S-Hub — AIで作った拡張機能の一覧](https://dev-tools-hub.xyz/?utm_source=zenn&utm_medium=article&utm_campaign=ai-mass-production)

---

## 前提：AIコーディングの現実

まず断っておくと、AIは魔法ではない。以下は事実：

- **AIはコードを書ける**が、設計判断はできない
- **AIは高速だが、方向性が間違っていると高速に間違える**
- **AIの出力は検証が必要**で、テストなしで本番に出すのは危険

つまり、AIを使っても「何を作るか」「なぜ作るか」「ユーザーにどう届けるか」は人間が考える必要がある。AIが変えるのは実装のスピードだけだ。

---

## 開発フロー：12ステップ

### Phase 1: 企画・設計

**1. マーケットリサーチ**

Chrome Web Storeで競合を調査する。「どんな拡張が求められているか」をユーザーレビューから読み取る。

例：EditThisCookieがMV3対応せずに消えた → Cookie管理拡張に需要がある → CookieJarを開発

**2. 要件定義**

Claudeに「こういう拡張を作りたい」と伝える前に、自分で以下を決める：

- ターゲットユーザー（開発者？一般ユーザー？）
- コア機能（1つに絞る）
- 無料/有料の境界
- 必要なパーミッション

**3. 技術スタック決定**

全拡張で統一：
- TypeScript + Vite（ビルド）
- Manifest V3（必須）
- Tailwind CSS（UI）
- ExtensionPay（決済、必要なら）

### Phase 2: AI協働開発

**4. CLAUDE.mdで文脈を与える**

プロジェクトルートに `CLAUDE.md` を置き、以下を記述：

- プロジェクトの目的
- ファイル構成ルール
- コーディング規約（`any`禁止、コメントは日本語OK等）
- ビルドコマンド
- よくあるミスパターン（Gotchas）

これにより、AIが毎回同じ質問をせずに済む。

**5. 機能ごとに実装を依頼**

「全部作って」ではなく、機能単位で依頼する：

1. 「chrome.storageを使ったデータ永続化レイヤーを作って」
2. 「ポップアップUIをReactで作って」
3. 「content scriptでGmail上にボタンを注入して」

各ステップでビルド・動作確認してから次に進む。

**6. 型チェック・ビルド確認**

AIのコード出力後、必ず：

```bash
npx tsc --noEmit    # 型チェック
npm run build       # ビルド
```

エラーがあればAIにフィードバックして修正。

### Phase 3: 品質保証

**7. 静的解析（デバッグスキル）**

自作のデバッグスキルで静的解析を実行：
- TypeScript型チェック
- ESLintルール
- Viteビルド
- パーミッション最小化チェック

**8. ペルソナレビュー**

架空のペルソナ（初心者ユーザー、パワーユーザー、プライバシー重視ユーザー等）視点でUXをレビュー。

**9. 手動テスト**

`chrome://extensions` でロードして実際に操作。自動テストでは見つからないUI/UXの問題はここで発見する。

### Phase 4: リリース

**10. CWSスクリーンショット作成**

5枚のスクリーンショット（1280x800）+ 小タイル（440x280）を作成。テンプレートを使い回して統一感を出す。

**11. 多言語化**

8言語のlocalesファイルを作成。AIに翻訳を依頼し、ネイティブチェックが難しい言語は機械翻訳のまま出す（ないよりはマシ）。

**12. CWS提出 + Edge同時提出**

zip作成 → CWSアップロード → Edge Add-onsにも同じzipを提出。

[DataPick — このフローで作った拡張の例](https://chromewebstore.google.com/detail/epoehadeccangbpjldlbkapnakndbpkf)

---

## 1本あたりの開発時間

| フェーズ | 時間 |
|---------|------|
| リサーチ・設計 | 2-3時間 |
| AI協働実装 | 4-8時間 |
| デバッグ・テスト | 2-4時間 |
| CWSスクショ・説明文 | 1-2時間 |
| **合計** | **9-17時間** |

従来の手書きコーディングなら50-100時間かかる規模の拡張を、AIとの協働で10-20時間に短縮している。

---

## AIに任せていいこと・ダメなこと

### 任せていいこと

- ボイラープレートコード生成
- CRUD操作の実装
- CSS/Tailwindのスタイリング
- テストコード作成
- 多言語翻訳
- CWS説明文の生成

### 自分で判断すべきこと

- 何を作るか（市場調査の結論）
- フリーミアムの境界線
- ユーザー体験の設計
- パーミッションの取捨選択
- 価格設定
- マーケティング戦略

---

## よくある失敗パターン

AIコーディングで17本作る中で、何度も踏んだ地雷：

1. **`any`型の多用** — AIはデフォルトで`any`を使いがち。strictモードを強制する
2. **chrome.runtime.lastError未チェック** — storageのコールバックで必ず確認
3. **GA4イベントの重複送信** — backgroundとpopupの両方から同じイベントを送らない
4. **ハードコードされた制限値** — 定数ファイルにまとめてimportする
5. **i18nのハードコード日本語** — UIテキストは必ずlocales経由

これらは `CLAUDE.md` のGotchasセクションに書いておくことで、AIの出力段階で防げる。

---

## まとめ

AIでChrome拡張を量産するポイント：

1. **設計は人間、実装はAI** — 役割分担を明確に
2. **CLAUDE.mdで文脈を固定** — AIの出力品質が安定する
3. **機能単位で依頼** — 「全部作って」は失敗の元
4. **型チェック・ビルドを毎回** — AIの出力を検証する習慣
5. **12ステップを愚直に回す** — 近道はない、でもAIがあれば速い

17本のChrome拡張を個人で運営できているのは、このフローがあるからだ。

[S-Hub — 全17本の拡張機能](https://dev-tools-hub.xyz/?utm_source=zenn&utm_medium=article&utm_campaign=ai-mass-production)

---

### 関連リンク

- [Procshot](https://chromewebstore.google.com/detail/procshot) — ブラウザ操作を自動キャプチャ
- [CookieJar](https://chromewebstore.google.com/detail/lhngfkchfepfjjdfhimconagoejemofg) — Cookie管理
- [SnapReply](https://chromewebstore.google.com/detail/pijandokkbhdejnoienhjmoicjapgpmk) — Gmailテンプレート
- [FocusGuard](https://chromewebstore.google.com/detail/focusguard) — 集中モード
