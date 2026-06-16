---
title: "リバーストライアルのpaywallがMV3で一度も表示されなかった話"
emoji: "🪤"
type: "tech"
topics: ["chrome拡張機能", "manifestv3", "個人開発", "extensionpay", "マネタイズ"]
published: true
published_at: "2026-06-26"
---

## 30日間、誰にもpaywallが表示されていなかった

DataPick というデータ収集拡張がある。Webページのデータをクリックだけで Google Sheets に流し込める、ノーコードのスクレイピング拡張だ。月間で **342人** が使い、7日間でポップアップは **25回** 開かれている。それなりに使われている。

ところが、分析を見て凍りついた。

- `paywall_shown`: **30日間で 0 回**
- `upgrade_clicked`: ほぼ 0
- 売上: **$0**

課金導線が弱いのではない。**そもそも一度も表示されていなかった**。この記事は、その原因をどう切り分けて、どこに地雷があったかの記録だ。

## DataPickの課金モデル: 3日リバーストライアル

まず前提。DataPick は「$19 買い切り + 3日リバーストライアル」というモデルにしていた。

リバーストライアルは、最初の3日間はPro機能を全開放し、4日目に「無料プランに落ちる or 買い切る」を選ばせる方式だ。トライアル中は気持ちよく使えるので、期限切れの瞬間が最大の課金チャンスになる。

裏を返すと、**paywallが出るべき唯一のタイミングは「トライアル開始から3日後」**ということになる。ここが今回の罠の入口だった。

## 切り分け: paywallが0になる原因は3つしかない

`paywall_shown=0` を見たとき、原因の候補は次の3つに絞れる。

1. **計測欠落**: paywall UIは出ているが、`paywall_shown` イベントを送っていない
2. **トリガー経路の不在**: paywallを出すコードがそもそも呼ばれていない
3. **露出条件の未到達**: 条件式は正しいが、その条件に誰も到達していない

順番に潰していく。

### 1. 計測欠落か？

paywallコンポーネントのマウント箇所に、GA4送信が紐づいているかを確認する。

```ts
// NG: UIは出るがイベントが出ない（過去に別拡張でやらかした）
function Paywall() {
  return <UpgradeSheet />;
}

// OK: マウント時に1回だけ送る
function Paywall() {
  useEffect(() => {
    sendGA4Event("paywall_shown", { surface: "trial_expired" });
  }, []);
  return <UpgradeSheet />;
}
```

これは過去に別の拡張で踏んだ。UIを分割リファクタした時に、新しいコンポーネント側へ計測を移植し忘れて、イベントだけ消えたことがある。が、DataPickでは upgrade_clicked も0に近いので「UIは出ているのにクリックされていないだけ」では説明がつかない。計測欠落は主犯ではなさそうだ。

### 2 & 3. トリガー経路 — MV3でリバーストライアルが死ぬ理由

本命はここ。「3日後にpaywallを出す」をMV3でどう実装したか、を疑う。

素朴に書くと、こうなりがちだ。

```ts
// インストール時に3日後のタイマーを仕掛ける（MV3では死ぬ）
chrome.runtime.onInstalled.addListener(() => {
  setTimeout(() => {
    showPaywall();
  }, 3 * 24 * 60 * 60 * 1000); // 3日
});
```

これは**動かない**。MV3のService Workerは数十秒アイドルすると停止する。`setTimeout` で積んだ3日後のコールバックは、SWが寝た瞬間に消える。3日も生き残るわけがない。

結果、「トライアルは始まるが、期限切れpaywallを出すトリガーが永遠に発火しない」状態になる。これが `paywall_shown=0` の最有力の正体だ。露出条件（トライアル期限切れ）に技術的に到達できていない。

## 対策: 時間ではなく「開いた瞬間」に判定する

MV3で時間ベースのトリガーを信用してはいけない。直し方は2つ組み合わせる。

### (a) 永続化された期限をpopup起動時に毎回チェック

`setTimeout` をやめ、トライアル開始時刻を `chrome.storage.local` に書く。判定は「ユーザーがpopupを開いた時」に毎回やる。

```ts
// トライアル開始時（1回だけ）
await chrome.storage.local.set({ trialStartedAt: Date.now() });

// popup を開くたびに判定（SWの生死に依存しない）
const { trialStartedAt } = await chrome.storage.local.get("trialStartedAt");
const elapsed = Date.now() - (trialStartedAt ?? Date.now());
const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

if (elapsed > THREE_DAYS && !(await isPaid())) {
  showPaywall();                       // ← ここで初めて出る
  sendGA4Event("paywall_shown", { surface: "trial_expired" });
}
```

これなら、SWが何度死んでも、ユーザーが次にpopupを開いた瞬間に正しく期限切れと判定できる。

### (b) 念のため chrome.alarms でも起こす

popupを開かないユーザーにも通知バッジ等で気づかせたいなら、`setTimeout` の代わりに `chrome.alarms` を使う。アラームはSWが寝ていても時刻が来れば叩き起こしてくれる。

```ts
chrome.alarms.create("trialExpiry", { delayInMinutes: 3 * 24 * 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "trialExpiry") {
    chrome.action.setBadgeText({ text: "1" });
  }
});
```

ただし `chrome.alarms` も「保証された正確な時刻」ではなく「最低でもこの時間は経過してから」という性質なので、課金判定の本体は必ず (a) の起動時チェックに置く。アラームはあくまで気づきのトリガーに留める。

## ハマったポイント: イベントリスナーの登録位置

ついでにもう一つ。`chrome.alarms.onAlarm` のリスナーを、async関数の中や条件分岐の奥に登録すると、SW復帰時に登録が間に合わず、アラームを取りこぼす。

リスナーは必ず**トップレベルで同期的に**登録する。これはalarmsに限らずMV3の鉄則だ。

```ts
// NG: SW復帰時に登録が間に合わない
chrome.storage.local.get("x").then(() => {
  chrome.alarms.onAlarm.addListener(handler);
});

// OK: トップレベルで同期登録
chrome.alarms.onAlarm.addListener(handler);
```

## まとめ

`paywall_shown=0` を見たら、計測欠落・トリガー不在・条件未到達の3つを切り分ける。リバーストライアルでこれが起きたら、まず疑うのは **MV3のSWで時間ベースのトリガーが死んでいる**ことだ。

- 時間で発火させない。**開いた瞬間に、永続化した期限を毎回チェック**する
- 時間が必要なら `setTimeout` ではなく `chrome.alarms`
- リスナーはトップレベルで同期登録

人に使われているのに売上が立たない時、原因が「課金導線が弱い」ではなく「課金導線が存在しない」だったというのは、笑えないがよくある話だ。まず自分の拡張の `paywall_shown` が0でないかを確認してほしい。

DataPick はこちらで配布している。
https://chromewebstore.google.com/detail/epoehadeccangbpjldlbkapnakndbpkf

---

MV3移行・paywall設計・マネタイズ戦略をまとめた本も書きました（¥500）: https://zenn.dev/ktg/books/chrome-ext-monetization-strategy
