# Claude Desktop 用 指示書（確認1・2 の実施）

## 事前準備（人間側・3 分）

1. ローカルで `git fetch origin claude/new-session-7a3v51 && git checkout claude/new-session-7a3v51`
2. Claude Desktop でこのリポジトリのフォルダを開く
3. Claude が使うブラウザ（アプリ内ブラウザ、または Claude in Chrome）で Google にログインしておく。
   確認に使うアカウント = 将来 Marketplace に出すアカウントが望ましい（テストプロジェクトをそのまま流用できる）
4. 下の指示文を貼る

## 指示文（ここから下をそのまま貼る）

```
experiments/forms-pdf-addon-precheck/README.md の手順で、仕様書 §9 の「確認1（スコープ区分）」と「確認2（HTML→PDF 実機テスト）」を実施してください。ブラウザは私がログイン済みの Google アカウントで操作して構いません。

進め方:
1. まず README.md と REPORT_TEMPLATE.md を読む。
2. 確認1: Cloud Console で新規プロジェクト「forms-pdf-addon-test」を作る（組織なし・課金なし）。Google Auth Platform → ブランディング作成（外部）→ データアクセス → 「スコープを手動で追加」に README の 7 スコープを貼って保存。「機密性の低い／高い／制限付き」の各ブロックをスクリーンショットして experiments/forms-pdf-addon-precheck/results/ に scope-nonsensitive.png / scope-sensitive.png / scope-restricted.png として保存する。空のブロックも撮る。プロジェクト番号を控える。
3. 確認2: script.google.com で新規プロジェクト「forms-pdf-precheck」を作り、プロジェクトの設定でマニフェスト表示を ON にしてから、appsscript.json と Code.gs をリポジトリのファイルで丸ごと置換する。runPdfCheck を実行し、承認画面をスクリーンショット（consent-screen.png）。実行ログの「=== forms-pdf-precheck summary ===」以下の JSON を results/execution-log.txt に保存。ログの folderUrl を開き、precheck_A_webfont.pdf と precheck_B_nofont.pdf をダウンロードして results/ に置く。可能なら 2 回目も実行して時間のばらつきを記録する。
4. PDF を開き、README の判定表（角印の描画・A と B の字形差・A4 幅の朱線・トーフ文字・罫線）を preview/expected_A_webfont_chromium.pdf と見比べて判定する。
5. REPORT_TEMPLATE.md をコピーして results/REPORT.md を作り、すべての欄を実測値で埋める。見られなかった項目は「未確認」と書く。推測で埋めない。
6. results/ 一式を git add して「docs(precheck): 確認1・2 の実施結果」でコミットし、ブランチ claude/new-session-7a3v51 に push する。
7. 最後に、確認1・2 の判定（OK / NG とその根拠）と、§4-2 の F7・§9-2 の Docs API 切替に関わる結論を 10 行以内で報告する。

守ること:
- 本実装（サイドバー UI・トリガー・テンプレート実装）には入らない。
- 課金の有効化、既存プロジェクトの変更・削除、Marketplace への申請、OAuth 審査の提出はしない。必要そうなら止まって私に聞く。
- Google の承認画面で「このアプリは確認されていません」が出たら「詳細」→「（安全ではないページ）に移動」で進めてよい（自分のテストプロジェクトのため）。
- 手順どおりに進まない画面（メニュー名が違う、スコープが手動追加で弾かれる等）に当たったら、その画面をスクリーンショットして results/ に残し、何が違ったかを REPORT.md に書く。
```
