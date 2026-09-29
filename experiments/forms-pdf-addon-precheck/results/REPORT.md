# 着手前確認 報告書（確認1・確認2）

- 実施日: 2026-09-30
- 実施者: Claude（Cowork / Claude in Chrome でしょうたの Google アカウントを操作。OAuth 承認ポップアップの「許可」操作のみ本人）
- GCP プロジェクト名 / 番号: forms-pdf-addon-test / 654853233046（組織なし・課金なし。Auth Platform ブランディング: 外部）
- Apps Script プロジェクト名 / スクリプト ID: forms-pdf-precheck / 1v7lQqHpW-aHyzucashdL3hhMviQ8BLKi4idRJF4Nkqq9N_dV3JdfU2rc
  - GCP プロジェクトへの紐づけ（プロジェクトの設定 → GCP プロジェクト変更）は **未実施**（区分表示には不要のため）
- 添付: `scope-nonsensitive.png` / `scope-sensitive.png` / `scope-restricted.png` / `execution-log.txt` / `precheck_A_webfont.pdf` / `precheck_B_nofont.pdf`
  - 補助: `scope-dataaccess-full-1.png` `scope-dataaccess-full-2.png`（データアクセス画面全体）、`run1-drivefile-error.png`（1 回目の権限エラー）、`drive-viewer-A_webfont.png`（Drive ビューア表示）、`render_*_150dpi.png`（PDF を poppler で 150dpi 描画）、`glyph-compare_A_B_expected.png`（字形チェック行の比較。上から A / B / 参照 expected_A）
  - `consent-screen.png`: **未確認**（承認画面は別ウィンドウのポップアップで開き、Claude からは撮影できなかった）

## 確認1：スコープ区分（Cloud Console「データアクセス」の表示）

| スコープ | 仕様書の想定 | Console の表示 | 根拠スクショ |
|---|---|---|---|
| `forms.currentonly` | 非sensitive | non-sensitive（非機密のスコープ） | scope-nonsensitive.png |
| `drive.file` | 非sensitive | non-sensitive（非機密のスコープ） | scope-nonsensitive.png |
| `script.scriptapp` | 非sensitive | **sensitive**（機密性の高いスコープ） | scope-sensitive.png |
| `script.external_request` | 非sensitive | **sensitive**（機密性の高いスコープ） | scope-sensitive.png |
| `userinfo.email` | 非sensitive | non-sensitive（非機密のスコープ） | scope-nonsensitive.png |
| `spreadsheets.currentonly` | 非sensitive | non-sensitive（非機密のスコープ） | scope-nonsensitive.png |
| `spreadsheets` | sensitive の可能性 | **sensitive**（機密性の高いスコープ） | scope-sensitive.png |

- 制限付きのスコープ: 「表示する行がありません」（scope-restricted.png）
- 手動追加で弾かれたスコープ: なし（7 行ともカンマ区切りで「テーブルに追加」→ 更新 → Save。再読み込み後も保持を確認）
  - `userinfo.email` は手動追加前から一覧にあった（手動追加後の件数 29→35 で +6）
- **判定**（§9-1）:
  - [ ] 全部 non-sensitive → 審査は基本フローのみ
  - [x] sensitive あり（→ `script.scriptapp` / `script.external_request` / `spreadsheets`）→ 審査 3〜5 営業日＋デモ動画必須
  - [ ] restricted あり → 設計変更
- **F7 の扱い**: `spreadsheets` が sensitive → F7 を「リンク一覧をサイドバーに表示＋CSVコピー」に変更する
  - ただし `script.scriptapp`（トリガー）と `script.external_request` も sensitive のため、**F7 を変更しても sensitive 審査自体は避けられない**（§4-2 のスコープ構成のままなら）。
- 手順との差異: README の見出し「機密性の低いスコープ」は、実画面では「**非機密のスコープ**」。ブランディング作成の最終ステップで「Google API サービス: ユーザーデータに関するポリシー」への同意チェックが必須（本人確認のうえ同意）。

## 確認2：HTML → PDF 実機テスト

実行ログ（`=== forms-pdf-precheck summary ===` 以下。成功 1 回目 = 実行 #2。全文は execution-log.txt）:

```json
{
  "ranAt": "2026-09-30T00:50:37+09:00",
  "wallClockMs": 5906,
  "folderUrl": "https://drive.google.com/drive/folders/1fdUft6B1JJ9xknhQMNMagWxvAzm_iB7L",
  "results": [
    {
      "variant": "A_webfont",
      "label": "@font-face Noto Sans JP + base64画像 + A4 CSS",
      "htmlBytes": 3051,
      "pdfBytes": 244208,
      "convertMs": 5,
      "saveMs": 1506,
      "totalMs": 1511,
      "within10s": true,
      "pdfUrl": "https://drive.google.com/file/d/1gFpAhxkqupUopanFn_lOKmvye_eMmzvb/view?usp=drivesdk"
    },
    {
      "variant": "B_nofont",
      "label": "Webフォント指定なし（既定フォント）+ base64画像 + A4 CSS",
      "htmlBytes": 2871,
      "pdfBytes": 88322,
      "convertMs": 6,
      "saveMs": 1373,
      "totalMs": 1379,
      "within10s": true,
      "pdfUrl": "https://drive.google.com/file/d/1VPXuOXnFBVVvYzbzapF37-0rfOyaD7iQ/view?usp=drivesdk"
    }
  ]
}
```

| 項目 | A_webfont | B_nofont | 判定基準 |
|---|---|---|---|
| convertMs（変換） | 5 | 6 | （下記注1） |
| saveMs（保存） | 1,506 | 1,373 | |
| totalMs | 1,511 | 1,379 | ≤ 10,000 → **OK** |
| PDF サイズ (bytes) | 244,208 | 88,322 | |
| 角印（base64 PNG）描画 | **OK**（160×160 画像 1 個を埋め込み） | **OK** | OK |
| Noto Sans JP 適用 | **OK**（埋め込みフォント名 `NotoSansJP-Thin`※、B と字形が明確に異なる） | ―（既定フォント名: `MS-PGothic`、一部 `MotoyaL04Maru-3`） | OK |
| 用紙サイズ | **A4**（594.96 × 841.92 pt） | A4（同） | A4 |
| 1 ページに収まる | **OK**（Pages: 1） | OK（Pages: 1） | OK |
| 罫線・背景色 | **一部**（罫線 OK / `th` の背景色 #eee は出ない） | 一部（同） | 記録のみ |
| トーフになった文字 | なし（令和・①②③・髙﨑・𠮷 すべて描画、テキスト抽出でも正しいコードポイント） | なし（同） | 記録のみ |
| `drive.file` のみで保存できた | **DriveApp: 権限エラー** / Drive 高度なサービス v3: OK | 同左 | 下記注2 |

- 2 回目実行の totalMs（Drive 高度なサービス版の 2 回目 = 実行 #3）: A: 1,904 ms（convert 9 / save 1,895）/ B: 1,765 ms（convert 4 / save 1,761）、wallClockMs 6,425
- PDF の Creator / Producer は A・B とも `Chromium` / `Skia/PDF m153`。**GAS の `getAs('application/pdf')`（HTML 入力）は現在 Chromium 系レンダラで印刷されている**と読める。README 事前注意点の「Drive のドキュメント変換器で @page・Web フォントが無視される／Letter になる」は、今回の実測では当てはまらなかった。
- 朱線（`.probe`, 180mm 指定）の実測幅: A・B とも 179.9 mm（400dpi 描画で x=238〜3070px）→ 本文幅いっぱい。
- 参照 PDF（preview/expected_A_webfont_chromium.pdf）との比較: レイアウト・角印・朱線位置は一致。参照側は IPA ゴシックで 𠮷 がトーフだったが、GAS 側（A・B）は 𠮷 も描画された。参照側は `th` の灰色背景が出ているが GAS 側は出ない。
- ※ `NotoSansJP-Thin` は PDF 内のフォント名。可変フォント由来の名前と思われ、描画は本文 400・見出し 700 相当の太さで出ている（render_A_webfont_150dpi.png）。
- 注1: `convertMs` は 2〜9 ms しかなく、`getAs` は遅延評価で、実際の変換はファイル書き込み時（`Drive.Files.create` に Blob を渡した時点）に走っていると思われる。したがって **`saveMs` ≒ 変換＋保存の実時間**。1 件あたり 1.4〜1.9 秒。
- 注2: 元の Code.gs（`DriveApp.createFolder` / `createFile`）は oauthScopes が `drive.file` のみだと
  `Exception: Specified permissions are not sufficient to call DriveApp.createFolder. Required permissions: https://www.googleapis.com/auth/drive`（コード.gs:38）で失敗（run1-drivefile-error.png）。
  しょうたの指示で、oauthScopes は変えずに appsscript.json の `dependencies.enabledAdvancedServices` に Drive v3 を追加し、保存部分を `Drive.Files.create`（フォルダ作成・PDF・HTML とも、`fields: 'id,webViewLink'`）に差し替えた。差し替え版はリポジトリの Code.gs / appsscript.json に上書き済み。**追加の再承認は求められず、そのまま保存に成功**。
- **判定**（§9-2）:
  - [x] OK（≤10 秒・画像・A4 が成立。フォントは **OK**）→ 本実装へ
  - [ ] NG → 代替案（README 末尾の 1〜3）のどれを検討するか CEO 判断

## 所感・本実装への申し送り

- **DriveApp は `drive.file` 単独では `createFolder` 不可（要 `drive` フル権限＝restricted）。Drive 高度なサービス v3 なら `drive.file` のままで作成・保存とも可**（実測）。F6 は「DriveApp ではなく Drive 高度なサービス（Drive API v3）で保存」と明記すること。
- F6 の申し送り: **ユーザーが選んだ既存フォルダに保存するには Google Picker で選ばせる必要がある**（`drive.file` はアプリが作成したファイル／ユーザーが Picker 等で明示的に開いたファイルにしかアクセスできない仕様のため）。今回はアプリ自身が作ったフォルダに保存したので可能だった。既存フォルダへの保存は本実装時の論点（未検証）。
- §4-2 の構成では `script.scriptapp`・`script.external_request`・`spreadsheets` の 3 つが sensitive。F7 を CSV コピーに変えても、トリガー（scriptapp）と外部通信（external_request）が残る限り sensitive 審査（3〜5 営業日＋デモ動画）は必要。外部通信が本当に要るか（Google Fonts は PDF 変換側が取りに行っており、スクリプトは `UrlFetchApp` を使っていない）は見直し余地あり。**今回のスクリプトは UrlFetchApp 未使用でも Web フォントが効いた**点に注意（external_request を外しても A が成立するかは未検証）。
- §9-2 の Docs API 切替: 今回の結果（Chromium 系で A4・画像・Web フォント・異体字まで OK、1 件 2 秒弱）なら **Docs API（documents = sensitive）への切替は不要**。HTML 方式で継続できる。
- CSS の `background` は印刷時に出ない（Chromium の「背景のグラフィック」オフ相当と思われる）。表の見出し色などは罫線や太字で表現するか、`-webkit-print-color-adjust: exact` 等で出るかを本実装前に確認（未検証）。
- 初回承認は、エディタの「権限を確認」ポップアップで 1 度許可してもエディタ側に反映されず、再実行で 2 度目の承認が必要だった（2 度目で反映）。
- consent-screen.png（同意画面の 7 スコープの文言）は未確認。必要なら別途本人がスクショを追加する。
