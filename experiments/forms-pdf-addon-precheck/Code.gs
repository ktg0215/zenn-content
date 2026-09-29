/**
 * 確認2「HTML → PDF 変換の実機テスト」用 試作スクリプト
 * 仕様書: forms-pdf-addon-spec-v1 §9 確認2 / §11 手順3
 *
 * 実行する関数: runPdfCheck
 *
 * 何をするか
 *   1. 領収書サンプルの HTML を 2 パターン組み立てる
 *        A_webfont : Noto Sans JP を Google Fonts の @font-face で指定 + base64 PNG 角印 + A4 CSS
 *        B_nofont  : Web フォント指定なし（既定の日本語フォントにフォールバック）+ 同じ画像・CSS
 *   2. Utilities.newBlob(html,'text/html').getAs('application/pdf') で PDF に変換
 *   3. 変換時間・保存時間を console.time と Date.now() の両方で計測してログに出す
 *   4. マイドライブ直下の「forms-pdf-precheck_<日時>」フォルダに PDF と元 HTML を保存し、URL をログに出す
 *
 * 判定基準（仕様書 §9-2）
 *   - 1 件 ≤ 10 秒
 *   - 日本語フォント（Noto Sans JP）が効いているか（A と B の字形を見比べる）
 *   - base64 画像（右上の朱色の角印）が描画されているか
 *   - A4 レイアウトが崩れていないか（本文下の「用紙幅の目安」の線が横幅いっぱいなら A4 判定）
 *
 * 保存は Drive 高度なサービス v3（Drive.Files.create）のみ。DriveApp は drive.file 単独では createFolder できないため（2026-09-30 実測）。
 * appsscript.json の oauthScopes は仕様書 §4-2 の最小構成をそのまま列挙してあるので、
 * 初回実行時の同意画面に出る文言もあわせて記録しておくこと（確認1の補助資料になる）。
 */

// tools/make_stamp.py が生成した 160x160 の朱色角印 PNG（427 bytes）
var STAMP_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAKAAAACgCAIAAAAErfB6AAABcklEQVR42u3ZWxEAIQwEQZTgXwbOQASPSkJPrYGjvzja6N0KrzkCwAbYABtgA2yADTBg+wR4KnyAAQMGLMACLMACrPvAiW76mwcU/0MAAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIBTAytOgAEDBizAAizAAizAgAEDBvwxsH/RHhsAAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDDgV8CKE2DAgAELsAALsADrHLBlH2DABtgAG2ADbIANMGArswXh1/GJgqIE3gAAAABJRU5ErkJggg==';

var VARIANTS = [
  { key: 'A_webfont', label: '@font-face Noto Sans JP + base64画像 + A4 CSS', useWebFont: true },
  { key: 'B_nofont', label: 'Webフォント指定なし（既定フォント）+ base64画像 + A4 CSS', useWebFont: false }
];

/** エディタの「実行」で呼ぶ関数 */
function runPdfCheck() {
  var startedAt = new Date();
  var folderName = 'forms-pdf-precheck_' + Utilities.formatDate(startedAt, 'Asia/Tokyo', 'yyyyMMdd-HHmmss');
  // DriveApp.createFolder は drive.file 単独では不可（要 auth/drive。2026-09-30 実測）→ Drive 高度なサービス v3 で作成
  var folder = Drive.Files.create({ name: folderName, mimeType: 'application/vnd.google-apps.folder' }, null, { fields: 'id,webViewLink' });
  var results = [];

  VARIANTS.forEach(function (v) {
    var html = buildHtml_(v);
    var htmlBytes = Utilities.newBlob(html).getBytes().length;

    var t0 = Date.now();
    console.time('convert:' + v.key);
    var pdf = Utilities.newBlob(html, 'text/html', v.key + '.html').getAs('application/pdf');
    console.timeEnd('convert:' + v.key);
    var convertMs = Date.now() - t0;

    var t1 = Date.now();
    var pdfFile = Drive.Files.create({ name: 'precheck_' + v.key + '.pdf', parents: [folder.id] }, pdf, { fields: 'id,webViewLink' });
    var saveMs = Date.now() - t1;

    Drive.Files.create({ name: 'source_' + v.key + '.html', parents: [folder.id] }, Utilities.newBlob(html, 'text/html', 'source_' + v.key + '.html'), { fields: 'id,webViewLink' });

    var r = {
      variant: v.key,
      label: v.label,
      htmlBytes: htmlBytes,
      pdfBytes: pdf.getBytes().length,
      convertMs: convertMs,
      saveMs: saveMs,
      totalMs: convertMs + saveMs,
      within10s: convertMs + saveMs <= 10000,
      pdfUrl: pdfFile.webViewLink
    };
    results.push(r);
    console.log(JSON.stringify(r));
  });

  var summary = {
    ranAt: Utilities.formatDate(startedAt, 'Asia/Tokyo', "yyyy-MM-dd'T'HH:mm:ssXXX"),
    wallClockMs: Date.now() - startedAt.getTime(),
    folderUrl: folder.webViewLink,
    results: results
  };
  Logger.log('=== forms-pdf-precheck summary ===\n' + JSON.stringify(summary, null, 2));
  return summary;
}

/** 領収書サンプル HTML を組み立てる（テンプレートは Docs API を使わずコードで生成する方針 = F2） */
function buildHtml_(opt) {
  var issueDate = new Date(2026, 8, 29); // 2026-09-29 → 令和8年9月29日
  var subtotal = 11000;
  var tax = Math.floor(subtotal * 0.10);
  var total = subtotal + tax;

  var fontCss = opt.useWebFont
    ? "@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');\n"
    : '';
  var fontLink = opt.useWebFont
    ? '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap">'
    : '';

  return [
    '<!DOCTYPE html>',
    '<html lang="ja"><head><meta charset="utf-8">',
    '<title>領収書 ' + escapeHtml_(serial_('R', issueDate, 1)) + '</title>',
    fontLink,
    '<style>',
    fontCss,
    '@page { size: A4 portrait; margin: 15mm; }',
    'html, body { margin: 0; padding: 0; }',
    'body { width: 180mm; font-family: "Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif; font-size: 11pt; color: #111; }',
    'h1 { font-size: 22pt; letter-spacing: 0.5em; margin: 0 0 4mm 0; }',
    'table { border-collapse: collapse; width: 100%; }',
    'table.head td { border: none; vertical-align: top; }',
    'table.grid td, table.grid th { border: 1px solid #333; padding: 2mm 3mm; }',
    'table.grid th { background: #eee; font-weight: 700; text-align: left; width: 32mm; }',
    '.amount { font-size: 20pt; font-weight: 700; text-align: right; }',
    '.small { font-size: 9pt; color: #444; }',
    '.probe { border-top: 2px solid #c01e1e; width: 180mm; margin-top: 8mm; }',
    '.stamp { width: 22mm; height: 22mm; }',
    '</style></head><body>',

    '<table class="head"><tr>',
    '<td style="width:120mm"><h1>領収書</h1>',
    '<div class="small">No. ' + escapeHtml_(serial_('R', issueDate, 1)) + '</div>',
    '<div class="small">発行日：' + escapeHtml_(toWareki_(issueDate)) + '（' + escapeHtml_(Utilities.formatDate(issueDate, 'Asia/Tokyo', 'yyyy年M月d日')) + '）</div>',
    '</td>',
    '<td style="width:60mm; text-align:right"><img class="stamp" alt="角印" src="data:image/png;base64,' + STAMP_PNG_BASE64 + '"></td>',
    '</tr></table>',

    '<p style="font-size:14pt; border-bottom:1px solid #333; padding-bottom:1mm; margin:6mm 0">山田　太郎　様</p>',
    '<p class="amount">' + escapeHtml_(yen_(total)) + '<span style="font-size:11pt">（税込）</span></p>',

    '<table class="grid">',
    '<tr><th>但し書き</th><td>セミナー受講料として</td></tr>',
    '<tr><th>内訳（税率10%）</th><td>本体 ' + escapeHtml_(yen_(subtotal)) + '　消費税 ' + escapeHtml_(yen_(tax)) + '</td></tr>',
    '<tr><th>登録番号</th><td>T1234567890123</td></tr>',
    '<tr><th>発行者</th><td>株式会社サンプル<br>東京都千代田区丸の内1-1-1<br>代表　鈴木　花子</td></tr>',
    '</table>',

    '<div class="probe"></div>',
    '<p class="small">用紙幅の目安：上の朱線が本文幅いっぱい（A4 210mm − 余白15mm×2 = 180mm）に届いていれば A4 判定OK。'
      + '右上の朱色の四角が見えれば base64 画像OK。'
      + 'パターン: ' + escapeHtml_(opt.key) + '（' + escapeHtml_(opt.label) + '）</p>',
    '<p class="small">字形チェック用：令和 領収書 修了証 受付票 様 御中 ¥1,234,567 ①②③ 髙﨑 𠮷野家（異体字・サロゲートペア）</p>',
    '</body></html>'
  ].join('\n');
}

/** 和暦（令和・平成のみ。MVP の F4 相当の最小実装） */
function toWareki_(d) {
  var y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  var reiwaStart = new Date(2019, 4, 1);
  var era, ey;
  if (d >= reiwaStart) { era = '令和'; ey = y - 2018; }
  else { era = '平成'; ey = y - 1988; }
  return era + (ey === 1 ? '元' : String(ey)) + '年' + m + '月' + day + '日';
}

/** 金額の 3 桁区切り + ¥ */
function yen_(n) {
  return '¥' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 連番: 接頭辞 + 年月 + 4 桁（F4） */
function serial_(prefix, d, n) {
  return prefix + '-' + Utilities.formatDate(d, 'Asia/Tokyo', 'yyyyMM') + '-' + ('0000' + n).slice(-4);
}

function escapeHtml_(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
