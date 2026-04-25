---
title: "フォームの繰り返し入力を1クリックで自動化するChrome拡張を作った（AES-256暗号化対応）"
emoji: "🔐"
type: "tech"
topics: ["chrome拡張機能", "typescript", "セキュリティ", "個人開発"]
published: false
published_at: "2026-05-17 09:00"
---

住所・会社名・電話番号など、繰り返し入力するWebフォームを1ショートカットで自動入力するChrome拡張「FormFill Vault」を作りました。AES-256-GCM暗号化をローカルで実装したときの詰まりポイントを書きます。

## AES-256-GCM暗号化の罠

ユーザーデータをそのまま`chrome.storage.local`に保存するのは怖いので、Web Cryptography APIでAES-256-GCMを実装しました。

**罠その1: IVの使い回し禁止**

AES-GCMは同じキー＋IVの組み合わせを絶対に使い回してはいけません。`crypto.getRandomValues(new Uint8Array(12))`で毎回12バイトのIVを生成し、暗号文と一緒に保存します。

```typescript
const iv = crypto.getRandomValues(new Uint8Array(12));
const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  encode(plaintext)
);
// iv + encrypted をBase64で保存
```

**罠その2: キーのエクスポートとシリアライズ**

CryptoKeyオブジェクトはそのままJSONにできません。`crypto.subtle.exportKey('jwk', key)`でJWK形式にしてからstringstoreします。インポート時は`importKey('jwk', jwk, 'AES-GCM', true, ['encrypt', 'decrypt'])`。

## MV3でのcontent scriptからのvalue injection

`<input>`要素に直接`element.value = '...'`を代入しても、ReactやVueで構築されたフォームでは検知されないことがあります。

解決策は`InputEvent`と`Event`を両方ディスパッチすることです:

```typescript
const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
  window.HTMLInputElement.prototype, 'value'
)?.set;
nativeInputValueSetter?.call(el, value);
el.dispatchEvent(new Event('input', { bubbles: true }));
el.dispatchEvent(new Event('change', { bubbles: true }));
```

Reactの合成イベントシステムを通すためにnative setterを使うのがポイントです。

## scripting権限とcontent scriptの使い分け

MV3では`<all_urls>`のhost permissionが必要ですが、フォーム入力はユーザーが明示的にCtrl+Shift+Fを押したときだけ動作します。content scriptはpassiveに待機、実際の処理はbackgroundからの`FILL_FORMS`メッセージ受信時のみ実行。CWSのレビュー対策として`cws-privacy-justifications.md`に理由書をまとめておきました。

---

https://dev-tools-hub.xyz/extensions/formfill-vault/
