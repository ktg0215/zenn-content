#!/usr/bin/env node
/**
 * repo の `published: true` と **Zenn 上の実在** を突き合わせる。
 *
 * 🔴 なぜ在るか（2026-08-17）:
 *   `.github/workflows/zenn-article-drip.yml` は `published: false -> true` に flip して
 *   queue から除去するが、**Zenn が受け取ったかを一度も見ていない**。
 *   実例: `quiethours-google-calendar-overlay` は repo で true・queue から除去済だが、
 *   Zenn 側は「投稿数の上限に達したためデプロイされませんでした」で受け取っていない。
 *   ⇒ **誰も再投入しない限り二度と出ない。** 同じ経路を残り19本が通る。
 *
 * 🔴 判別子の設計:
 *   `https://zenn.dev/<user>/articles/<slug>` の HTTP status を使う。
 *   **ただし「200 なら live」を無検査で信じない。** 走らせるたびに
 *     陽性対照（存在するはずの記事）と 陰性対照（存在しない slug）を先に測り、
 *     期待どおりでなければ **数字を出さずに落ちる**（＝未走査を「0件」と言わない）。
 *
 * 使い方:
 *   node scripts/zenn-live-check.mjs [--user ktg0215] [--ref origin/main] [--json <out>]
 *
 * exit 0 = 全 published:true が Zenn 上に在る ／ 1 = 落ちているものが在る ／ 2 = 走査が成立しない
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const USER = arg('--user', 'ktg0215');
const REF = arg('--ref', null);
const JSON_OUT = arg('--json', null);

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const ref = REF || `origin/${git('rev-parse', '--abbrev-ref', 'HEAD').trim()}`;
console.log(`■ 参照 = ${ref}（🔴 ローカルは遅れていることがある。既定で origin を見る）`);

const files = git('ls-tree', ref, 'articles/', '--name-only').trim().split('\n').filter(Boolean);
const published = [];
for (const f of files) {
  if (!f.endsWith('.md')) continue;
  const body = git('show', `${ref}:${f}`);
  if (/^published: true$/m.test(body)) published.push(f.replace(/^articles\//, '').replace(/\.md$/, ''));
}
console.log(`   published: true = ${published.length} 本 / articles = ${files.length} ファイル`);

const url = (slug) => `https://zenn.dev/${USER}/articles/${slug}`;

async function probe(slug) {
  const r = await fetch(url(slug), { redirect: 'follow' });
  // Zenn は存在しない記事に 404 を返す。念のため本文にも当てる（status だけに依存しない）。
  const text = r.status === 200 ? await r.text() : '';
  const looksMissing = /ページが見つかりません|Page not found/i.test(text);
  return { status: r.status, live: r.status === 200 && !looksMissing };
}

// ── 🔴 対照を先に走らせる。落ちたら数字を出さない ─────────────────
console.log('\n■ 🔴 対照（これが期待どおりでなければ、以下の結果は読まない）');
const negSlug = 'zzz-this-slug-should-never-exist-20260817';
const neg = await probe(negSlug);
console.log(`   陰性対照 ${negSlug} -> HTTP ${neg.status} / live=${neg.live}（期待: live=false）`);

// 陽性対照 = published:true のうち、最も古くから在るもの（先頭）
const posSlug = published[0];
const pos = posSlug ? await probe(posSlug) : null;
if (posSlug) console.log(`   陽性対照 ${posSlug} -> HTTP ${pos.status} / live=${pos.live}（期待: live=true）`);

if (neg.live || !posSlug || !pos.live) {
  console.error('\n🔴 対照が落ちた＝この走査は成立していない（方法の故障）。');
  console.error('   「Zenn に無い記事が N 本」という数字は出しません。');
  process.exit(2);
}
console.log('   🟢 対照 成立');

// ── 本走査 ────────────────────────────────────────────────
console.log('\n■ 突合（published: true が Zenn 上に在るか）');
const missing = [];
for (const slug of published) {
  const r = await probe(slug);
  if (!r.live) { missing.push({ slug, status: r.status }); console.log(`   🔴 無い  ${slug}  HTTP ${r.status}`); }
}
console.log(`\n■ 集計: published:true = ${published.length} / Zenn に無い = ${missing.length}`);
console.log(`   検算: ${missing.length} <= ${published.length} -> ${missing.length <= published.length}`);

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({ ref, user: USER, published, missing }, null, 2), 'utf8');
  console.log(`   書き出し: ${JSON_OUT}`);
}

if (missing.length) {
  console.log('\n🔴 これらは **repo 上は公開済・Zenn 上に存在しない**＝誰も再投入しなければ二度と出ません。');
  console.log('   再投入は drip-queue.txt に slug を戻し、published を false に戻すこと。');
  process.exit(1);
}
console.log('\n🟢 落ちているものはありません。');
