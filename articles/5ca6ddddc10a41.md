---
title: "Base64エンコード完全解説：仕組み・使いどころ・JavaScriptでの実装ガイド"
emoji: "✨"
type: "tech"
topics: ["javascript","セキュリティ","初心者向け","base64","webdev"]
published: true
---

「Base64エンコードって何のためにあるの？」と思ったことはありませんか？


この記事では、Base64の仕組みから実際の使いどころ、JavaScriptでの実装まで解説します。


[](#base64%E3%81%A8%E3%81%AF) Base64とは

Base64は、バイナリデータを**64種類のASCII文字**（A-Z・a-z・0-9・+・/）で表現するエンコード方式です。


なぜ64種類かというと、6ビット（2の6乗 = 64）のデータを1文字で表現できるからです。


```
元データ（バイナリ）→ Base64変換 → ASCII文字列
```

[](#%E3%81%AA%E3%81%9Cbase64%E3%81%8C%E5%BF%85%E8%A6%81%E3%81%AA%E3%81%AE%E3%81%8B) なぜBase64が必要なのか

インターネット上では、データをテキストとして送受信する場面が多くあります。


しかし画像や動画などのバイナリデータを直接テキストに含めようとすると、制御文字や特殊文字が混ざって文字化けや破損が起きることがあります。


Base64エンコードすることで、**バイナリデータを安全にテキストとして扱える**ようになります。


[](#base64%E3%81%AE%E4%B8%BB%E3%81%AA%E7%94%A8%E9%80%94) Base64の主な用途

**1. データURLの生成**

HTML内に画像を埋め込む際に使います。


```
img src="data:image/png;base64,iVBORw0KGgo..." />
```

**2. JWT（JSON Web Token）**

JWTはヘッダー・ペイロード・署名の3つをBase64Urlエンコードして`.`で繋いだ文字列です。


```
eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxMjMifQ.xxx
```

**3. メール添付ファイル**

MIMEエンコードでファイルをメールに添付する際にBase64が使われています。


**4. APIでのバイナリデータ送信**

画像データをJSONのフィールドとして送信する際に使われます。


```
{
  "image": "iVBORw0KGgoAAAANSUhEUgAA..."
}
```

[](#javascript%E3%81%A7%E3%81%AE%E5%AE%9F%E8%A3%85) JavaScriptでの実装

ブラウザ標準のAPIで実装できます。外部ライブラリは不要です。


```
// エンコード
const encoded = btoa("Hello, World!");
console.log(encoded); // "SGVsbG8sIFdvcmxkIQ=="
 
// デコード
const decoded = atob("SGVsbG8sIFdvcmxkIQ==");
console.log(decoded); // "Hello, World!"
```

**日本語（マルチバイト文字）の場合**


`btoa()`はASCII文字のみ対応なので、日本語はひと手間必要です。


```
// エンコード（日本語対応）
const encodeBase64 = (str) => {
  return btoa(unescape(encodeURIComponent(str)));
};
 
// デコード（日本語対応）
const decodeBase64 = (str) => {
  return decodeURIComponent(escape(atob(str)));
};
 
console.log(encodeBase64("こんにちは")); // "44GT44KT44Gr44Gh44Gv"
console.log(decodeBase64("44GT44KT44Gr44Gh44Gv")); // "こんにちは"
```

**URL-safe Base64**


`+`と`/`をURLに含めると問題が起きる場合があります。JWTなどでは**URL-safe Base64**（+→-、/→_）が使われます。


```
const toUrlSafeBase64 = (str) => {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};
 
const fromUrlSafeBase64 = (str) => {
  const pad = str.length % 4;
  const padded = str + "=".repeat(pad ? 4 - pad : 0);
  return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
};
```

[](#base64%E3%81%AE%E6%B3%A8%E6%84%8F%E7%82%B9) Base64の注意点

**データ量が増える**

Base64エンコードすると、データサイズが元の**約1.33倍**になります。頻繁にエンコード・デコードするデータには向きません。


**暗号化ではない**

Base64はエンコード（変換）であって暗号化ではありません。デコードすれば誰でも元のデータを取得できます。セキュリティ目的には使わないでください。


[](#%E3%82%AA%E3%83%B3%E3%83%A9%E3%82%A4%E3%83%B3%E3%81%A7%E8%A9%A6%E3%81%99) オンラインで試す

実際にBase64エンコード・デコードを試したい場合は、ブラウザだけで動くツールを使うと便利です。


入力したデータが外部サーバーに送信されないクライアントサイド処理のツールを選ぶと安心です。


[https://tools.dev-tools-hub.xyz/ja/](https://tools.dev-tools-hub.xyz/ja/)