---
title: "広告ゼロのChrome拡張を2.7倍に伸ばしたCWS SEOの話"
emoji: "🔍"
type: "tech"
topics: ["chrome拡張機能", "seo", "個人開発", "i18n", "マーケティング"]
published: true
published_at: "2026-05-25 09:00"
---

## マーケをしていない拡張が、いちばん伸びた

31本のChrome拡張を運用している。SNSもブログも、広告も、ほぼ何もしていない拡張がほとんどだ。

そんな中で、PageMemo という地味なメモ拡張だけが **2.7倍（+170%）** に伸びた。プロモーションは一度もやっていない。やったのは、Chrome Web Store（CWS）のリスティングを整えたことだけ。

つまり伸びた要因は **CWS SEO** に集約される。この記事では、何をして、何が効いて、何が効かなかったかを実データで書く。

PageMemo は「Webページに紐づく付箋メモ」を作る拡張だ。ページを再訪問すると、そのページに残したメモが自動で出てくる。アカウント不要、自動保存。サイドパネルで常駐する。

## CWSにも検索エンジンがある

見落とされがちだが、Chrome Web Store には検索窓がある。ユーザーは「sticky notes」「web page memo」「ページ メモ」のようなキーワードで拡張を探す。

このとき CWS が見ているのは、主に次の3つだ。

- 拡張の **名前**（`manifest` の `name`、ロケールごとに出し分けられる）
- **説明文**（`extDescription`、最初の1〜2文が特に重要）
- **対応言語**（`_locales/` に用意したロケール数）

PageMemo で効いたのは、この3つを「9言語 × ニッチkeyword × サイドパネル」という形で噛み合わせたことだった。

## 効いた要因1: 9言語ローカライズ

PageMemo は9言語に対応している。

```
extensions/Pagememo/dist/_locales/
├── de/      ├── en/      ├── es/
├── fr/      ├── it/      ├── ja/
├── ko/      ├── pt_BR/   └── zh_CN/
```

CWSは、ユーザーのChrome表示言語に合わせてローカライズされたリスティングを出す。`_locales` を9言語ぶん用意すると、9言語ぶんの検索インデックスに別々に載るということだ。日本語で「付箋メモ」、英語で「sticky notes」、それぞれの言語圏で別々に拾われる。

実装はMV3標準の `__MSG_xxx__` 参照にしておく。

```json
// manifest（抜粋）
{
  "default_locale": "ja",
  "name": "__MSG_extName__",
  "description": "__MSG_extDescription__"
}
```

```json
// _locales/en/messages.json
{
  "extName":        { "message": "Sticky Notes for Any Page – PageMemo" },
  "extDescription": { "message": "Take notes linked to specific web pages. Auto-save, no account required." }
}
```

```json
// _locales/ja/messages.json
{
  "extName":        { "message": "どのページにも貼れる付箋メモ – PageMemo" },
  "extDescription": { "message": "Webページに紐づいたメモを作成。自動保存、アカウント不要。" }
}
```

ポイントは、機械翻訳をそのまま貼らず、各言語の **検索語**を意識して名前を組むこと。英語なら「Sticky Notes」、日本語なら「付箋メモ」と、その言語圏で実際に検索される単語を先頭に置く。

## 効いた要因2: ニッチに振り切ったキーワード

「メモ拡張」だけだと Google Keep や Notion Web Clipper のような巨人と正面衝突する。勝てない。

PageMemo は「**ページに紐づく**メモ」「再訪問で**自動表示**」という、一段ニッチな needs に名前と説明文を寄せた。検索ボリュームは小さくなるが、競合が薄く、刺さったユーザーの離脱が少ない。

これは数字に出ている。直近7日の `popup_opened` は **142回** と、アクティブユーザー数（MAU 約150）に対して異常に高い。1人が何度も開いている＝ページを開くたびに使う、定着した使われ方をしているということだ。

## 効いた要因3: サイドパネル常駐

ポップアップ型のメモは「開いて閉じたら終わり」になりがちだ。PageMemo は Side Panel API でブラウズ中ずっと横に出しておける。これが上の「何度も開く」挙動を支えている。

検索流入で来た人が、定着して使い続ける。CWSはアクティブ率の高い拡張を評価する傾向があるので、定着が次の露出を呼ぶ。この循環が「マーケ未着手なのに最高成長」の正体だった。

## ハマったポイント: 多言語の空ディレクトリで起動不能

9言語に増やす過程で、`_locales/{lang}/` ディレクトリだけ作って `messages.json` を置き忘れると、Chromeは拡張のロードを**丸ごと拒否**する。`npm run build` は成功するので気づきにくい。

```
# 各ロケールに messages.json が存在するか必ず検査する
for d in dist/_locales/*/; do
  test -f "$d/messages.json" || echo "MISSING: $d"
done
```

もう一つ。`default_locale` で指定したロケールに該当 key がないと、これも起動時に落ちる。多言語化したら、ビルド後に実際に `chrome://extensions` で読み込んでエラーバッジが出ないかを必ず確認する。

## 正直な話: SEOで人は来るが、お金は別問題

きれいな成功話で終わらせたくないので、効かなかった側も書く。

PageMemo は人は伸びた。でも **売上は $0** だ。直近7日で paywall は12回表示され、upgrade クリックは2回。インストールは伸びても、課金にはつながっていない。

CWS SEO が解決するのは「発見される」ところまで。そこから先の「払ってもらう」は、paywallの出し方や価格設計という別レイヤーの問題で、PageMemoはまだそこを詰められていない。直近のMAUも -9.6% と短期では揺れている。

「伸びている＝成功」ではない。CWS SEOは集客の打ち手であって、収益化の打ち手ではない。ここを混同すると、人は来るのに通帳は動かない、という今のPageMemoの状態になる。

## まとめ

広告ゼロで拡張を2.7倍にした要因は、突き詰めると次の組み合わせだった。

- 9言語ローカライズで、9つの検索インデックスに載せる
- 巨人と戦わないニッチkeywordに名前と説明文を寄せる
- サイドパネル常駐で定着率を上げ、CWSの評価循環に乗せる

まずやるべきは `_locales` の多言語化だ。コードを1行も変えずに、リスティングの言語を増やすだけで、流入の母数が変わる。

PageMemo はこちらで配布している（無料、アカウント不要）。実際の名前・説明文の組み方の参考にどうぞ。
https://chromewebstore.google.com/detail/jmpmfbheoclfmceceihjpcjlabakkdde
