---
title: "ChromeでCookieを編集する方法（EditThisCookieがMV3で使えなくなった後の代替）"
emoji: "🍪"
type: "tech"
topics: ["chrome", "cookie", "個人開発", "chrome拡張", "webdev"]
published: true
---
## EditThisCookie が使えなくなったのはなぜか

長年 Chrome で Cookie を編集するのに **EditThisCookie** を使っていた方も多いはずです。ところがある日、更新が止まったり、そもそも読み込めなくなったりしました。原因は Chrome の **Manifest V3（MV3）** への移行です。旧来の Manifest V2 拡張のプラットフォームが廃止され、MV3 に作り直されなかった拡張は動かなくなりました。Cookie エディタは背景スクリプトと `chrome.cookies` API に依存するため、特に影響を受けています。

この記事では、いま Chrome で Cookie を編集する方法を2つ紹介します。まずは追加インストール不要の DevTools、次に MV3 対応の拡張です。

## Cookie を編集したい典型的な場面

- **Web アプリのデバッグ**: 新規ユーザーと再訪ユーザーで挙動が変わるかの検証
- **認証フローのテスト**: アカウントを作らずにログイン状態を切り替える
- **ログインループの解消**: 古いセッション Cookie が無限リダイレクトを起こすことがある
- **トラッキング Cookie の削除**: ログアウトせずに広告系 Cookie だけ消す
- **フラグの確認**: `Secure` / `HttpOnly` / `SameSite` が正しく設定されているか

## 方法1: Chrome DevTools（インストール不要）

1. ページを右クリック → **検証**
2. **Application** タブを開く
3. サイドバー → **Storage → Cookies**
4. ドメインを選択
5. 行をダブルクリックして name / value / expiry / flags を編集

動きますが、日常的に使うには手数が多いです。検索なし、種類別フィルタなし、ワンクリックのエクスポートもなく、毎回小さいパネルを何クリックも操作します。

## 方法2: CookieJar（MV3 対応）

[CookieJar](https://dev-tools-hub.xyz/extensions/cookiejar/?utm_source=zenn.dev&utm_medium=referral&utm_campaign=edit-cookies-chrome-ja) は Manifest V3 で作られた無料の Cookie エディタで、EditThisCookie の代替として設計されています。

基本操作:

1. ツールバーのアイコンをクリック
2. 現在のページの全 Cookie がドメイン順に並び、Login / Tracking / Analytics / Functional に自動分類される
3. Cookie をクリックして value / expiry / flags を直接編集（即時反映）
4. JSON または Netscape（`cookies.txt`）形式でエクスポート / インポート

### EditThisCookie からの移行

| EditThisCookie でやっていたこと | CookieJar |
|---|---|
| ポップアップで全 Cookie を見る | ツールバーアイコンをクリック |
| 値をその場で編集 | Cookie をクリックして直接編集 |
| ファイルにエクスポート | JSON / Netscape（cookies.txt） |
| ファイルからインポート | 対応 |
| 単一 Cookie の削除 | ワンクリック |
| 現行 Chrome（MV3）対応 | ✅ MV3 ネイティブ |

ここまではすべて無料です。CookieJar Pro（月 $4.99・買切 $29.99）は自動クリーンアップルール・Cookie プロファイル保存・ストレージマネージャーを追加します。

補足: `HttpOnly` Cookie（サーバーが設定）は表示・削除はできますが編集はできません。これはブラウザのセキュリティ仕様で、拡張側の制限ではありません（EditThisCookie でも同様）。

## インストール

CookieJar は無料で、CookieJar アカウントの登録も不要です。あなたの Cookie と保存したプロファイルはブラウザ内（ローカルストレージ）にのみ保存され、CookieJar がそれらをアップロードすることはありません。

→ **無料インストール:** https://dev-tools-hub.xyz/extensions/cookiejar/?utm_source=zenn.dev&utm_medium=referral&utm_campaign=edit-cookies-chrome-ja

Chrome ウェブストア: https://chromewebstore.google.com/detail/cookiejar/lhngfkchfepfjjdfhimconagoejemofg

---

*[S-Hub](https://dev-tools-hub.xyz) — ミニマルで MV3 対応の Chrome 拡張機能を作っています。*
