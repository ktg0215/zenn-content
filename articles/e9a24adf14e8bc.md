---
title: "YouTubeショートを非表示にするChrome拡張の作り方：ShortsKiller開発記録"
emoji: "🚫"
type: "idea"
topics: ["chrome拡張機能","youtube","個人開発","javascript","生産性"]
published: true
---

[](#%E3%81%AF%E3%81%98%E3%82%81%E3%81%AB) はじめに

昼は普通に会社員として働いていて、プログラミングは完全に趣味です。仕事終わりの夜とか、休みの日にコツコツやっています。


そんな限られた時間の中で、YouTubeショートに時間を吸われるのが本当にストレスでした。


[](#youtube%E3%82%B7%E3%83%A7%E3%83%BC%E3%83%88%E3%81%AE%E4%BD%95%E3%81%8C%E5%AB%8C%E3%81%A0%E3%81%A3%E3%81%9F%E3%81%8B) YouTubeショートの何が嫌だったか

別にショート動画自体が悪いわけじゃないんです。


問題は「見るつもりがないのに見てしまう」こと。


YouTubeを開くと、ホーム画面にショートがデカデカと表示される。検索結果にも混ざってくる。普通の動画を見終わった後にもおすすめされる。


気づいたら30分くらい経ってることがある。


これが本当に嫌でした。


30分あれば、コード書けるし、本も読める。


[](#%E6%9C%80%E5%88%9D%E3%81%AF%E8%A8%AD%E5%AE%9A%E3%81%A7%E3%81%AA%E3%82%93%E3%81%A8%E3%81%8B%E3%81%97%E3%82%88%E3%81%86%E3%81%A8%E3%81%97%E3%81%9F) 最初は設定でなんとかしようとした

YouTubeの設定を色々いじってみたんですが、ショートを完全に非表示にする方法がない。


「興味なし」を押しても、また別のショートが出てくる。キリがない。


じゃあ拡張機能で消せばいいじゃん、と思って探してみたら、いくつかありました。でも、なんか微妙にかゆいところに手が届かなかったり、更新が止まっていたり。


だったら自分で作るか、となりました。


[](#ai%E3%81%AB%E6%89%8B%E4%BC%9D%E3%81%A3%E3%81%A6%E3%82%82%E3%82%89%E3%81%84%E3%81%AA%E3%81%8C%E3%82%89%E4%BD%9C%E3%81%A3%E3%81%9F) AIに手伝ってもらいながら作った

プログラミングは昔多少やっていたんですが、Chrome拡張は初めてでした。


でも今はAIがある。


ClaudeとかChatGPTに「YouTubeのショートを非表示にするChrome拡張を作りたい」って相談しながら、少しずつ形にしていきました。


manifest.jsonの書き方とか、content scriptの仕組みとか、AIに聞けば教えてくれる。エラーが出たらエラーメッセージを貼り付ければ解決策を出してくれる。


正直、AIがなかったら途中で挫折してたと思います。


[](#%E5%AE%8C%E6%88%90%E3%81%97%E3%81%9F%E3%82%82%E3%81%AE) 完成したもの

やることはシンプルで、YouTubeのページからショート関連の要素を消すだけ。


- ホーム画面のショートセクション

- サイドバーのショートリンク

- 検索結果に混ざるショート

- おすすめに出てくるショート


これらを非表示にします。


オンオフの切り替えもできるようにしました。たまには見たい時もあるかもしれないので。


[](#%E4%BD%BF%E3%81%A3%E3%81%A6%E3%81%BF%E3%81%9F%E7%B5%90%E6%9E%9C) 使ってみた結果

自分で使い始めて数ヶ月経ちますが、快適です。


YouTubeを開いても、普通の動画だけが並んでいる。昔のYouTubeに戻った感じ。


ショートを見なくなった分、夜の時間に余裕ができました。その時間で次の拡張機能を作ったりしています。


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