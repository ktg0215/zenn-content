# 着手前確認 報告書（確認1・確認2）

- 実施日: YYYY-MM-DD
- 実施者:
- GCP プロジェクト名 / 番号:
- Apps Script プロジェクト名 / スクリプト ID:
- 添付: `scope-nonsensitive.png` / `scope-sensitive.png` / `scope-restricted.png` / `consent-screen.png` / `execution-log.txt` / `precheck_A_webfont.pdf` / `precheck_B_nofont.pdf`

## 確認1：スコープ区分（Cloud Console「データアクセス」の表示）

| スコープ | 仕様書の想定 | Console の表示 | 根拠スクショ |
|---|---|---|---|
| `forms.currentonly` | 非sensitive | non-sensitive / sensitive / restricted | |
| `drive.file` | 非sensitive | | |
| `script.scriptapp` | 非sensitive | | |
| `script.external_request` | 非sensitive | | |
| `userinfo.email` | 非sensitive | | |
| `spreadsheets.currentonly` | 非sensitive | | |
| `spreadsheets` | sensitive の可能性 | | |

- 手動追加で弾かれたスコープ: なし / あり（→ どれ）
- **判定**（§9-1）:
  - [ ] 全部 non-sensitive → 審査は基本フローのみ
  - [ ] sensitive あり（→ どれ）→ 審査 3〜5 営業日＋デモ動画必須
  - [ ] restricted あり（→ どれ）→ 設計変更
- **F7 の扱い**: `spreadsheets` が sensitive → F7 を「リンク一覧をサイドバーに表示＋CSVコピー」に変更する / non-sensitive → 仕様どおり書き戻し

## 確認2：HTML → PDF 実機テスト

実行ログ（`=== forms-pdf-precheck summary ===` 以下を貼る）:

```json
```

| 項目 | A_webfont | B_nofont | 判定基準 |
|---|---|---|---|
| convertMs（変換） | | | |
| saveMs（保存） | | | |
| totalMs | | | ≤ 10,000 |
| PDF サイズ (bytes) | | | |
| 角印（base64 PNG）描画 | OK / NG | OK / NG | OK |
| Noto Sans JP 適用 | OK / NG（既定フォント名: ） | ―（既定フォント名: ） | OK が望ましい。NG でも日本語が読めればフォールバック方針で継続可 |
| 用紙サイズ | A4 / Letter / その他 | | A4 |
| 1 ページに収まる | OK / NG | | OK |
| 罫線・背景色 | OK / 一部 / NG | | 記録のみ |
| トーフになった文字 | | | 記録のみ |
| `drive.file` のみで保存できた | OK / 権限エラー | | OK（NG なら F6 設計変更） |

- 2 回目実行の totalMs（任意）: A: / B:
- **判定**（§9-2）:
  - [ ] OK（≤10 秒・画像・A4 が成立。フォントは OK / フォールバック）→ 本実装へ
  - [ ] NG（→ 何が）→ 代替案（README 末尾の 1〜3）のどれを検討するか CEO 判断

## 所感・本実装への申し送り

-
