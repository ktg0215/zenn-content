---
title: "GASで作るGoogle フォームの領収書PDFを、日本の書式のWorkspaceアドオンにするまで"
emoji: "🧾"
type: "tech"
topics: ["googleappsscript", "gas", "googleforms", "googleworkspace", "pdf"]
published: true
published_at: "2026-10-21 20:00"
---

:::message
**PR**: この記事で紹介しているアドオンは、開発者本人（自分）が作ったものです。最後に紹介のリンクがあります。
:::

Google フォーム™ の回答から、日本の書式の領収書 PDF を作る。GAS で書けば数十行で動き始めますが、和暦・敬称・税額の端数・重ならない番号まで入れると、だんだん長くなります。さらにそれを「誰でもフォームに入れて使えるアドオン」にすると、権限とドライブへの保存の作りが変わります。

この記事では、GAS 版で必要になる部品と、Workspace アドオンにしたときに変えたところを、実際のコードで書きます。なお、この記事のコードはどれも Claude Code が書いたもので、文中の「書きました」「替えました」もその意味です。

僕は自分ではコードを書かず、Claude Code に日本語で指示して作っています。調べると「Google フォームから領収書を作る GAS」の記事はたくさんありましたが、どれも自分でコードを貼って直せる人向けでした。和暦や「様・御中」、番号の重複、最初の承認画面まで考えると、コードを書かない人にコピペしてもらうのは無理だと思い、フォームに入れるだけで使えるアドオンにすることにしました。

## GAS 版で必要になる部品

フォーム送信時のトリガーで動く、いちばん小さな形は「回答を受け取る → HTML を組む → PDF にしてドライブに置く」です。そこに、日本の領収書として要る部品を足していきます。

### 和暦

`Utilities.formatDate` には和暦の書式が無いので、元号の開始日を表にして変換しました。1 年目は「元年」です。

```javascript
const ERAS = [
  { name: '令和', start: [2019, 5, 1] },
  { name: '平成', start: [1989, 1, 8] },
  { name: '昭和', start: [1926, 12, 25] },
];
function toWareki(date) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  const key = y * 10000 + m * 100 + d;
  for (const era of ERAS) {
    const [sy, sm, sd] = era.start;
    if (key >= sy * 10000 + sm * 100 + sd) {
      const n = y - sy + 1;
      return era.name + (n === 1 ? '元' : n) + '年' + m + '月' + d + '日';
    }
  }
  return y + '年' + m + '月' + d + '日';
}
```

`getFullYear()` などはスクリプトのタイムゾーンで返るので、`appsscript.json` の `timeZone` を `Asia/Tokyo` にしておかないと、日付の変わり目で 1 日ずれます。

### 消費税額の端数は「1 枚につき税率ごとに 1 回」

インボイス（適格請求書）の消費税額は、1 枚の書類につき税率ごとに 1 回だけ端数を処理します（[国税庁 Q&A 問57](https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/pdf/qa/57.pdf)）。税込から出すなら `税込 × 10 / 110` を 1 回だけ丸めます。小数の誤差を避けるため、四捨五入も整数の式で書きました。

```javascript
function calcTax(total, rate, rounding) {      // total = 税込（円）、rate = 10 または 8
  const num = total * rate, den = 100 + rate;
  if (rounding === 'ceil') return Math.ceil(num / den);
  if (rounding === 'round') return Math.floor((2 * num + den) / (2 * den));
  return Math.floor(num / den);                 // 切り捨て
}
```

1〜300,000 円の全額 × 2 税率 × 3 方式を、BigInt の厳密な計算と突き合わせて一致を確かめています。

### 重ならない番号

同じ瞬間に 2 件の回答が届くと、2 つの実行が同じ「前回の番号」を読んでしまいます。`LockService` で順番待ちにしてから番号を進めます。

```javascript
function nextSerial(date) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    const key = 'serial_' + date.getFullYear();
    const n = Number(props.getProperty(key) || '0') + 1;
    props.setProperty(key, String(n));
    return 'R-' + date.getFullYear() + '-' + String(n).padStart(4, '0');
  } finally {
    lock.releaseLock();
  }
}
```

見本なので、番号は年ごとにしています。

### HTML から PDF へ

`Utilities.newBlob(html, 'text/html', 名前).getAs('application/pdf')` で PDF になります。最初の確認では、Noto Sans JP を読み込んだ PDF が 1 件約 1.5 秒、読み込まないと約 0.9 秒で、字体は MS-PGothic などになりました（どちらも 1 回だけ測った数です）。測った PDF は A4・1 ページ・角印の画像つきです。

## アドオンにして変えたところ

自分のフォームで動く GAS と、Marketplace に出して他人のフォームで動くアドオンでは、求められる権限の扱いが違います。

### スコープを小さくする

アドオンが求めるスコープは、次の 5 つにしました。

```json
"oauthScopes": [
  "https://www.googleapis.com/auth/forms.currentonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/script.container.ui",
  "https://www.googleapis.com/auth/script.scriptapp"
]
```

`forms.currentonly` は「開いているフォームだけ」、`drive.file` は「アドオン自身が作ったファイルだけ」に触れる権限です。ドライブ全体を読む権限を取らないので、利用者に説明しやすく、審査で説明するスコープも減ります。それでも `script.container.ui` と `script.scriptapp` は機密性の高いスコープとして OAuth の検証で説明が要りました。

### `drive.file` だけでは DriveApp が使えない

GAS 版で使った `DriveApp.createFile` は、`drive.file` だけでは権限エラーになりました。そこで、ドライブへの保存を Drive API v3（高度なサービス）に替えています。

```javascript
// appsscript.json で高度なサービス Drive（v3）を有効にしておく
function savePdf(pdfBlob, fileName, folderId) {
  return Drive.Files.create(
    { name: fileName, parents: [folderId] },
    pdfBlob,
    { fields: 'id,name,webViewLink' }
  );
}
```

`getAs('application/pdf')` は遅延評価で、実際の変換は `Drive.Files.create` に渡したときに走ります。変換の失敗も保存の呼び出しのところで出るので、エラーの扱いはそこにまとめました。

### トリガーはフォームごと・1 人 20 個まで

フォーム送信時のインストール型トリガーは、サイドバーで自動生成のスイッチを入れたフォームごとに作ります。トリガーは「1 人の利用者・1 つのスクリプトにつき 20 個」が上限なので（[Apps Script の割り当て](https://developers.google.com/apps-script/guides/services/quotas)）、1 人が自動生成を有効にできるフォームは 20 個までになります。利用者には「使っていないフォームで止めてから、もう一度有効に」と理由つきで出すようにしました。

### 角印の画像の置き場所

利用者がアップロードした角印の PNG を、毎回の PDF に入れる必要があります。`drive.file` の範囲で保存はできても、高度なサービスでは中身をダウンロードして読み戻す形（`alt=media`）が使えなかったため、画像は base64 にして 8KB ずつに分け、フォームの `DocumentProperties` に置いています。

## ハマったところ

どれも、フォームの中で実際に触ってみるまで分かりませんでした。

### showModelessDialog が、何も出さずに戻る

サイドバーから大きな設定の画面を開くのに、最初は `showModelessDialog` を使っていました。ところが今の Google フォームの編集画面では、これがエラーも出さずに何も表示しませんでした。サーバー側の記録では、開く前と開いた後のログが 0.1 秒ほど（124ms）で正常に残っているのに、画面にはダイアログができていません。小さな HTML でも同じでした。

`showModalDialog` なら表示されたので、こちらに替えました。スコープは同じ `script.container.ui` のままです。モーダルなので、開いている間はうしろのフォームとサイドバーを押せなくなります。

### トリガーの作成が、Google 側で一時的に失敗する

自動生成のスイッチを入れると、`ScriptApp.newTrigger(...).forForm(...).onFormSubmit().create()` でトリガーを作ります。この `create` が、ときどき `Unexpected error while getting the method or property create on object ScriptApp.FormTriggerBuilder.` で失敗しました。もう一度押すと作れます。

そこで、失敗したら 2.5 秒待って 1 回だけ自動でやり直すようにしました。ただし、失敗に見えても実はトリガーができていることがあるので、やり直す前にこのフォームのトリガーを読み直し、もうあれば作らずに「有効」として返します。トリガーを 2 つ作ると、1 件の回答で PDF が 2 枚できてしまうためです。この読み直しも Google 側で失敗することがあり、そのときは状態が分からないので作らずに理由を出します。

### サイドバーの読み込みとスイッチが重なって、タイムアウトする

サイドバーは、画面に戻ったときに今の状態（トリガー、エラー、できた PDF など）を読み直します。作り直したサイドバーではこの読み込みが重くなり（3〜4 秒）、スイッチの操作と重なったときに「ドキュメント（フォーム）にアクセス中に Drive のサービスがタイムアウトしました」が出ました。

サイドバーで読むものを減らし（エラーは件数といちばん新しい 1 件、PDF もいちばん新しい 1 件だけにして、一覧は読まない）、スイッチを押した直後は読み直さないようにしました。

## 数字（2026-10-09 夜の時点）

| 項目 | 数 |
|---|---|
| 最初の commit | 2026-09-30 |
| commit（アドオンのディレクトリに触れたもの） | 110 |
| Apps Script（開発用のファイルを除く） | 2,588 行 |
| HTML（サイドバー・設定の画面・3 書式のテンプレート） | 2,033 行 |
| OAuth のスコープ | 5（うち機密性の高いもの 2） |

自分のフォーム 1 つで使い、書式も自分で直せる人なら、GAS 版で十分だと思います。アドオンにして良かったのは、誰のフォームでもそのまま動き、審査を通す中で権限が最小に整理されたことです。大変だったのは、フォームの中の画面の確認で、ボタンを押しても何も起きない、ダイアログが出ない、といった問題は実際に触ってみるまで分かりませんでした。

---

この記事で作ったアドオン「フォーム回答で領収書・修了証PDF」は、Google Workspace Marketplace で公開しています（自作です）。GAS・アドオン・外注の比べ方はこちらにまとめました。
https://dev-tools-hub.xyz/blog/google-form-receipt-pdf/?utm_source=zenn&utm_medium=article&utm_content=forms-pdf&utm_campaign=forms-pdf

