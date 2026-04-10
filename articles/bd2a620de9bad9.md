---
title: "楽天市場で出品者の情報を一覧表示するChrome拡張を作った"
emoji: "🛒"
type: "idea"
topics: ["chrome拡張機能","個人開発","楽天市場","せどり","typescript"]
published: true
---

[](#%E3%81%AF%E3%81%98%E3%82%81%E3%81%AB) はじめに

副業でせどりをやっています。


楽天市場をリサーチしていて、出品者の情報を確認するのが地味に面倒だったので、それを解決するChrome拡張を作りました。


[](#%E4%BD%95%E3%81%8C%E9%9D%A2%E5%80%92%E3%81%A0%E3%81%A3%E3%81%9F%E3%81%8B) 何が面倒だったか

楽天で商品を見ていると、同じ商品を複数のショップが出品していることがよくあります。


せどりをやっていると、「この出品者、他に何を売っているんだろう」「評価はどうなんだろう」「いつからやっているショップなんだろう」みたいなことが気になる。


でも、それを確認するには出品者のページに飛ばないといけない。


商品ページ → 出品者ページ → 戻る → 別の出品者ページ → 戻る...


この繰り返しが本当に面倒でした。


商品一覧を見ながら、出品者の情報も同時に確認できたら楽なのに。


[](#%E6%8E%A2%E3%81%97%E3%81%9F%E3%81%91%E3%81%A9%E8%A6%8B%E3%81%A4%E3%81%8B%E3%82%89%E3%81%AA%E3%81%8B%E3%81%A3%E3%81%9F) 探したけど見つからなかった

同じことを考えている人がいるはずだと思って、Chrome拡張を探してみました。


Amazonのセラー分析ツールはたくさんあるんですが、楽天向けはほとんどない。あっても自分がほしい機能とは違う。


楽天市場って、日本だけのサービスだからツールが少ないんですよね。


海外の開発者は作らないし、日本の開発者は少ない。ニッチな市場です。


[](#%E8%87%AA%E5%88%86%E3%81%A7%E4%BD%9C%E3%82%8B%E3%81%93%E3%81%A8%E3%81%AB%E3%81%97%E3%81%9F) 自分で作ることにした

ないなら作るか、と。


やりたいことはシンプルで、商品一覧ページで出品者の情報を表示すること。


具体的には、出品者名の横に評価とかレビュー数とか、基本的な情報をパッと見られるようにしたかった。


楽天APIを使えば楽なのかもしれないけど、個人で使うにはハードルが高いし、APIの制限もある。


なのでDOMをいじって、ページ内の情報を整理して表示する方針にしました。


[](#ai%E3%81%A8%E4%B8%80%E7%B7%92%E3%81%AB%E9%96%8B%E7%99%BA) AIと一緒に開発

Chrome拡張の開発は、YouTubeショートを消す拡張を作ったときに一度やっていたので、なんとなく流れはわかっていました。


とはいえ楽天のページ構造を解析するのは面倒だったので、AIにかなり助けてもらいました。


「このHTMLから出品者情報を抽出したい」みたいな相談をすると、セレクタの書き方を教えてくれる。


楽天のページ構造が変わったときの対応とか、エラーハンドリングとか、自分だけだと見落としそうなところも指摘してくれる。


AIがいなかったら、たぶん3倍くらい時間がかかっていたと思います。


[](#%E5%AE%8C%E6%88%90%E3%81%97%E3%81%9F%E3%82%82%E3%81%AE) 完成したもの

商品ページや検索結果で、出品者に関する情報を見やすく表示できるようになりました。


いちいち出品者ページに飛ばなくても、ざっくりとした情報がわかる。


リサーチの効率がかなり上がりました。


[](#%E3%81%9B%E3%81%A9%E3%82%8A%E3%81%A8%E5%80%8B%E4%BA%BA%E9%96%8B%E7%99%BA%E3%81%AE%E7%9B%B8%E6%80%A7) せどりと個人開発の相性

せどりをやっていると「こういうツールがあれば楽なのに」と思うことが結構あります。


Amazonにはツールが山ほどあるけど、楽天やYahoo!ショッピングは手薄。


これは逆に言うと、自分で作れば使ってくれる人がいるかもしれないということです。


自分が困っていることは、たぶん他の人も困っている。


[](#%E4%BD%9C%E3%81%A3%E3%81%9F%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD%EF%BC%882025%E5%B9%B42%E6%9C%88%E7%8F%BE%E5%9C%A8%EF%BC%9A14%E5%80%8B%EF%BC%89) 作った拡張機能（2025年2月現在：14個）

この記事を書いた時点では6個だった拡張機能が、14個まで増えました。


[](#%F0%9F%8E%AF-%E7%94%9F%E7%94%A3%E6%80%A7%E3%83%84%E3%83%BC%E3%83%AB) 🎯 生産性ツール


[PromptStash](https://chromewebstore.google.com/detail/ocgkponbnolpgobllplcamfobolbjbcj) - AIプロンプトを保存・管理（19サービス対応）

[DataPick](https://chromewebstore.google.com/detail/epoehadeccangbpjldlbkapnakndbpkf) - Webページからデータを抽出

[SnippetVault](https://chromewebstore.google.com/detail/gnnmjklohcoaiheikefoifiekcnndcdi) - コードスニペット管理

[ReadMark](https://chromewebstore.google.com/detail/inejhohffndeacbihghjcobndpoejdfn) - 読書位置を記憶


[](#%F0%9F%A7%98-%E3%83%87%E3%82%B8%E3%82%BF%E3%83%AB%E3%82%A6%E3%82%A7%E3%83%AB%E3%83%93%E3%83%BC%E3%82%A4%E3%83%B3%E3%82%B0) 🧘 デジタルウェルビーイング


[YouTube Shorts Killer](https://chromewebstore.google.com/detail/bajebpkjihldiceceompbcjgepnbhnni) - YouTubeショートを非表示

[X Detox](https://chromewebstore.google.com/detail/hlaankalmjmaefkcabjcfagnkfhlkpce) - X(Twitter)のノイズを消す

[ZenRead](https://chromewebstore.google.com/detail/adoiakplckmoahmiainobfpmdomnhomj) - 集中読書モード


[](#%F0%9F%9B%92-ec%E3%83%BB%E3%81%9B%E3%81%A9%E3%82%8A) 🛒 EC・せどり


[楽天セラーズ・アナリティクス](https://chromewebstore.google.com/detail/dlldcmoekdpakieophgmngnalkiljndc) - 楽天市場の出品者分析

[Arbitra](https://chromewebstore.google.com/detail/bincnlodgkpmmihbdoknndbncjfghpcj) - 価格比較ツール


[](#%F0%9F%94%A7-web%E4%BE%BF%E5%88%A9%E3%83%84%E3%83%BC%E3%83%AB) 🔧 Web便利ツール


[Japanese Font Finder](https://chromewebstore.google.com/detail/ageolfjmheacenbkgiahlkhkogcnocip) - Webサイトの日本語フォントを特定

[TVerPlus](https://chromewebstore.google.com/detail/ddhjonpmonmjgohicdipicodpmndnjll) - TVerの視聴体験を改善

[Yahoo快適](https://chromewebstore.google.com/detail/oeinpjbbingpakilcejimbibfcbbfkkg) - Yahoo!の閲覧体験改善


[](#%F0%9F%8F%A0-%E4%B8%8D%E5%8B%95%E7%94%A3) 🏠 不動産


[物件賃貸分析](https://chromewebstore.google.com/detail/hnfccaipmcmbolhpdklolimlnjloknld) - 賃貸物件の分析

[物件購入分析](https://chromewebstore.google.com/detail/ioboepegcabodocflleblblnknlfpjka) - 購入物件の分析


すべての拡張機能の詳細 → [S-Hub](https://dev-tools-hub.xyz)


[](#%E9%96%A2%E9%80%A3%E8%A8%98%E4%BA%8B) 関連記事

この記事の「その後」や、もっと具体的なノウハウを書いています。


[](#%F0%9F%93%96-%E3%82%B9%E3%83%88%E3%83%BC%E3%83%AA%E3%83%BC%E3%81%AE%E7%B6%9A%E3%81%8D) 📖 ストーリーの続き


[コード書けない自分がAIでChrome拡張を6つ作った開発フロー](https://zenn.dev/ktg/articles/132441dc79fc17) — 実際にどうやってAIで開発しているのか

[個人開発のマーケティングは「分析」以前の問題だった](https://zenn.dev/ktg/articles/13fb68d8b0303e) — 「売る」の壁にぶつかった後に学んだこと

[海外向けのマーケティングをやってみた](https://zenn.dev/ktg/articles/5ac16e807cbe81) — 英語市場への挑戦


[](#%F0%9F%9B%A0-%E6%8A%80%E8%A1%93%E3%83%8E%E3%82%A6%E3%83%8F%E3%82%A6) 🛠 技術ノウハウ


[n8nでGitHub Release → 複数SNS自動投稿を構築した](https://zenn.dev/ktg/articles/38a2a9876aa3d4) — マーケティング自動化の仕組み


[](#%F0%9F%92%AD-%E5%80%8B%E4%BA%BA%E9%96%8B%E7%99%BA%E3%81%AE%E8%80%83%E3%81%88%E6%96%B9) 💭 個人開発の考え方


- [個人開発で一番大事なのは技術でも知識でもなく"情報"だった](https://zenn.dev/ktg/articles/bedb808683dd5f)

- [「誰でも作れる時代」に個人開発をする意味](https://zenn.dev/ktg/articles/598f57c39eb1d9)

- [個人開発のアイデアはもう枯渇している？競合だらけの市場で生き残るために考えていること](https://zenn.dev/ktg/articles/d808635e232eae)