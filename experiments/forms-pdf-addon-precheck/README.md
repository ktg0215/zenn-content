# forms-pdf-addon 着手前確認キット（確認1・確認2）

仕様書 `forms-pdf-addon-spec-v1` §9 の **確認1（スコープ区分）** と **確認2（HTML→PDF 実機テスト）** を、
Google アカウントを持つ人が **20 分程度で実施できる**ようにまとめたものです。

> **重要**: 確認1・2 は Google Cloud Console と Apps Script の実行環境が必要で、
> Claude Code の実行環境（クラウドコンテナ）からは Google にログインできないため **未実施** です。
> ここにあるのは「実施のための材料」であり、結果は含まれていません（§11-4「自己申告のみは不可」に従い、推測値も書いていません）。
> 実施後は `REPORT_TEMPLATE.md` を埋めて、スクショ・実行ログ・生成 PDF と一緒に戦略室へ戻してください。

## ファイル

| ファイル | 用途 |
|---|---|
| `appsscript.json` | §4-2 の 7 スコープを `oauthScopes` に明記したマニフェスト。`spreadsheets.currentonly` と `spreadsheets` は **両方** 入れてある（確認1 で両方の区分を見るため） |
| `Code.gs` | 確認2 の試作スクリプト。`runPdfCheck` を実行すると領収書サンプル HTML を 2 パターン PDF 化し、時間を計測して Drive に保存する |
| `assets/stamp.png` / `stamp.base64.txt` | 角印代わりの朱色 PNG（427 bytes）。`Code.gs` に base64 で埋め込み済み |
| `preview/A_webfont.html` / `B_nofont.html` | `Code.gs` が生成する HTML そのもの。ブラウザで開けば「本来こう見えるはず」が分かる |
| `preview/expected_*_chromium.pdf` | 同 HTML を Chromium で印刷した **参照 PDF（真の A4、595×842pt）**。GAS の出力と並べて比較する用。※ローカルに Noto Sans JP が無いので字形は IPA ゴシック |
| `tools/make_stamp.py` | 角印 PNG を再生成（標準ライブラリのみ） |
| `tools/render-local.mjs` | `Code.gs` の `buildHtml_` をローカル実行して `preview/` を再生成（`node tools/render-local.mjs`） |
| `REPORT_TEMPLATE.md` | 報告書のひな形 |

---

## 確認1：スコープ区分を Cloud Console の表示で確定する（所要 10 分）

判定基準（§9-1）: **sensitive が 1 つでもあれば** 審査 3〜5 営業日＋デモ動画必須。**restricted が出たら設計変更**。

1. https://console.cloud.google.com/ → プロジェクトの選択 → **新しいプロジェクト**
   名前は `forms-pdf-addon-test` など。組織なし・課金なしで可。**プロジェクト番号**を控える。
2. 左メニュー **Google Auth Platform → ブランディング**（初回は「開始」）
   - アプリ名: 任意 / ユーザーサポートメール: 自分 / 対象: **外部** / 連絡先メール: 自分 → 作成
3. **Google Auth Platform → データアクセス** → **スコープを追加または削除**
   - 右ペイン最下部の **「スコープを手動で追加」** に、下の 7 行を **1 行 1 スコープ**で貼り付け → **テーブルに追加** → **更新**
     ```
     https://www.googleapis.com/auth/forms.currentonly
     https://www.googleapis.com/auth/drive.file
     https://www.googleapis.com/auth/script.scriptapp
     https://www.googleapis.com/auth/script.external_request
     https://www.googleapis.com/auth/userinfo.email
     https://www.googleapis.com/auth/spreadsheets.currentonly
     https://www.googleapis.com/auth/spreadsheets
     ```
   - 手動追加では API を有効化していなくても入る。入らなかった行があればそれも記録する。
4. 保存後、データアクセス画面が **「非機密のスコープ」「機密性の高いスコープ」「制限付きのスコープ」** の 3 ブロックに分かれて表示される。
   **各ブロックを 1 枚ずつスクリーンショット**（`scope-nonsensitive.png` / `scope-sensitive.png` / `scope-restricted.png`）。空のブロックも撮る。
5. Apps Script 側（確認2 で作るプロジェクト）を紐づける場合: エディタ左の **プロジェクトの設定 → Google Cloud Platform（GCP）プロジェクト → プロジェクトを変更** → 手順 1 のプロジェクト番号。
   ※確認1 の区分表示自体はこの紐づけが無くても見える。Marketplace 申請には必要。
6. `REPORT_TEMPLATE.md` の「確認1」表を埋める。**`spreadsheets` が sensitive なら F7 は仕様どおり「リンク一覧をサイドバーに表示＋CSVコピー」へ変更**（§4-2）。

---

## 確認2：HTML → PDF 変換の実機テスト（所要 10 分）

判定基準（§9-2）: **1 件 ≤ 10 秒**、**フォントと画像が描画される**。NG なら Docs API 方式（`documents` = sensitive）への切替を検討。

1. https://script.google.com/ → **新しいプロジェクト**。名前は `forms-pdf-precheck`。
2. 左の **プロジェクトの設定（歯車）** → **「appsscript.json」マニフェスト ファイルをエディタで表示する** にチェック。
3. エディタに戻り、`appsscript.json` の中身をこのフォルダの `appsscript.json` で **丸ごと置換**。
4. `コード.gs` の中身をこのフォルダの `Code.gs` で **丸ごと置換**。保存。
5. 関数選択で **`runPdfCheck`** を選び **実行**。
   - 初回は承認ダイアログ → 「詳細」→「（安全ではないページ）に移動」→ 許可。
   - **このとき出る同意画面もスクショ**（`consent-screen.png`）。7 スコープの文言が確認1 の補助資料になる。
6. 下の **実行ログ** に `=== forms-pdf-precheck summary ===` と JSON が出る。**全文コピー**して `execution-log.txt` に保存。
   - `convertMs`（変換）/ `saveMs`（保存）/ `totalMs` / `within10s` がパターン `A_webfont`・`B_nofont` それぞれに出る。
   - 左メニュー **実行数** からも同じ実行の総所要時間が見える（そちらもスクショ推奨）。
7. ログの `folderUrl` を開く。マイドライブ直下に `forms-pdf-precheck_<日時>` フォルダができ、中に
   `precheck_A_webfont.pdf` / `precheck_B_nofont.pdf` / `source_*.html` がある。**PDF 2 つをダウンロード**して報告に添付。
8. PDF を開いて次を見る（`preview/expected_A_webfont_chromium.pdf` と並べると分かりやすい）:

   | 見る所 | OK | NG |
   |---|---|---|
   | 右上の朱色の四角（角印） | 表示されている | 出ない／壊れている → base64 画像 NG |
   | A と B の字形 | A が明らかに Noto Sans JP（B と違う） | A と B が同じ字形 → `@font-face` は効いていない（B の既定フォントが何かも記録） |
   | 本文下の朱線 | 本文幅いっぱい・ページ 1 枚 | 途中で切れる／2 ページ目にはみ出す／用紙が Letter（8.5×11in） → A4 レイアウト NG |
   | 「字形チェック用」行 | 令和・①②③・髙﨑・𠮷 が全部出る | □（トーフ）になる文字を記録 |
   | 表の罫線・背景色 | 出ている | 消えている（CSS 無視の度合いの記録） |

9. `REPORT_TEMPLATE.md` の「確認2」を埋める。

### 追加で確認しておくと後で効くこと（任意・5 分）

- **`drive.file` だけで動いたか**: このスクリプトは `DriveApp.createFolder/createFile` しか使わず、`appsscript.json` に `drive` フル権限を入れていない。エラーなく保存できたなら F6 の「`drive.file` で保存」は成立。逆に権限エラーなら F6 の設計変更が必要（`drive.file` で「ユーザーが選んだ既存フォルダ」に書くには Google Picker 経由の選択が必要になる点も、本実装時の論点として報告に書く）。
- **同じ関数をもう 1 回実行**して時間のばらつきを見る（初回はウォームアップで遅いことがある）。

---

## 事前に把握している注意点（すべて **未検証**。結果と食い違ったら結果が正）

- `getAs('application/pdf')` の HTML 変換は Drive 側のドキュメント変換器で、ブラウザのレンダリングではない。
  一般に **`@page`・`position`・`flex`・Web フォントが無視される**という報告が多く、用紙サイズが Letter になる可能性がある。
  この試作は意図的に **table レイアウトのみ**で組んであり、それでも崩れるなら HTML 方式そのものが厳しい。
- フォントが NG でも「日本語が読める既定フォントで出る」なら、§3 のフォールバック方針（システム既定の日本語フォント）で MVP は成立しうる。
  角印と A4 が OK ならまず商品になる。**フォント NG だけで Docs API（sensitive）に倒す前に、CEO 判断を仰ぐ**。
- 画像・A4 が NG だった場合の代替案（本実装前の検討材料。それぞれ未検証）:
  1. Docs API 方式（仕様書記載。`documents` スコープが増え sensitive 審査になる）
  2. Slides をテンプレートにして `drive.file` + 複製 → PDF 書き出し（`presentations` スコープが増える。区分は確認1 と同じ手順で見る）
  3. GAS 上で純 JS の PDF ライブラリ（pdf-lib など）を動かして自前で描く（スコープ追加なし。フォントを Drive に置いて毎回読むため速度が論点）
