---
title: "CookieJar活用ガイド：Web開発・テスト環境で今すぐ使えるCookie管理テクニック"
emoji: "🍪"
type: "tech"
topics: ["chrome拡張機能", "cookie", "web開発", "テスト", "privacy"]
published: true
published_at: "2026-04-11 09:00"
---

## はじめに

Web開発・QAエンジニアなら一度はこんな場面に遭遇したことがあるのではないでしょうか。

- ログイン状態を素早く切り替えながら動作確認したい
- ステージング環境と本番環境のCookieを瞬時にスワップしたい
- A/Bテストのバリエーションを強制的に切り替えて確認したい

長年愛用されていた「EditThisCookie」がChrome拡張機能のMV3移行に対応できず2024年に姿を消して以降、同等の機能を持つ後継ツールを探しているエンジニアは多いと思います。

この記事では、MV3対応のCookie管理拡張機能「CookieJar」を使った実践的なワークフローをご紹介します。

https://chromewebstore.google.com/detail/cookiejar/lhngfkchfepfjdfhimconagoejemofg

## CookieJarの主要機能

CookieJarは、Chromeの最新拡張機能仕様（Manifest V3）に完全対応したCookie管理ツールです。EditThisCookieの後継として、以下の機能を提供しています。

- **Cookieの一覧表示・編集・削除**：現在開いているページのCookieをリアルタイムで確認・編集
- **プロファイル管理**：複数のCookieセットをプロファイルとして保存・切り替え
- **JSON / Netscapeフォーマットでのエクスポート/インポート**：チームメンバーとの共有も簡単
- **プライバシースコアリング**：サードパーティCookieの多さをスコアで可視化
- **自動クリーンアップ（Pro）**：期限切れCookieを自動で削除

## 実践ユースケース

### 1. ユーザーロールの切り替えテスト

管理者と一般ユーザーで動作が異なるWebアプリのテストに便利です。

手順：
1. 管理者アカウントでログインした状態のCookieをプロファイルA として保存
2. 一般ユーザーでログインしたCookieをプロファイルB として保存
3. テスト中はプロファイルを切り替えるだけでユーザー切替が完了

従来の「ログアウト → 別ユーザーでログイン」という手順が不要になります。

### 2. ステージング ↔ 本番のCookieスワップ

ステージング環境でのテスト後、本番環境に切り替える際にCookieの設定値を引き継ぎたいケースがあります。

```json
// エクスポートしたCookieの例
{
  "name": "session_token",
  "value": "abc123xyz",
  "domain": "staging.example.com",
  "path": "/",
  "httpOnly": true
}
```

CookieJarでエクスポートしたJSONを編集してドメインを変更し、本番環境でインポートするワークフローが構築できます。

### 3. A/Bテストのバリアント強制

A/BテストツールがCookieでバリアントを管理している場合、CookieJarで直接値を書き換えることで任意のバリアントを確認できます。

```
variant_id = "B"  ← この値を直接編集
```

QAチームが全バリアントを効率よく確認するのに役立ちます。

### 4. プライバシー監査

プライバシースコアリング機能を使えば、サードパーティCookieがどれだけ設置されているかを視覚的に確認できます。GDPR対応やサードパーティCookie廃止の影響調査に活用できます。

## チームでの共有

テスト環境のCookie設定をチームで統一したい場合、Netscapeフォーマットでエクスポートしてリポジトリに含めることも可能です。

```
# Netscape HTTP Cookie File
staging.example.com	FALSE	/	TRUE	1799999999	session_token	abc123xyz
```

新メンバーのオンボーディング時にCookieをインポートするだけで、開発環境のセットアップ時間を短縮できます。

## まとめ

CookieJarは、EditThisCookieの後継として現場のWeb開発・QAワークフローに即座に組み込める実用的なツールです。MV3対応なのでChromeのバージョンアップで突然使えなくなる心配もありません。

ぜひChrome Web Storeからインストールして、日々の開発効率向上にお役立てください。

https://chromewebstore.google.com/detail/cookiejar/lhngfkchfepfjdfhimconagoejemofg

より詳しい機能一覧やS-Hubが提供する他のChrome拡張機能については、こちらもご覧ください：https://dev-tools-hub.xyz
