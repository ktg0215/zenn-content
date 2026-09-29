#!/usr/bin/env node
/**
 * Code.gs の buildHtml_ をローカルで実行して preview/*.html を書き出し、
 * Chromium が見つかれば「本来こう見えるはず」の参照 PDF（真の A4）も書き出す。
 * Apps Script 側の getAs('application/pdf') の結果と見比べるための基準であって、
 * 確認2 の代わりにはならない（GAS の変換器は Chromium ではない）。
 *
 * 使い方: node tools/render-local.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'preview');
mkdirSync(out, { recursive: true });

// GAS グローバルの最小スタブ（buildHtml_ が使う分だけ）
const sandbox = {
  console,
  Utilities: {
    formatDate(d, _tz, fmt) {
      const p = (n) => String(n).padStart(2, '0');
      return fmt
        .replace('yyyy', d.getFullYear())
        .replace('MM', p(d.getMonth() + 1))
        .replace(/M(?!M)/, d.getMonth() + 1)
        .replace('dd', p(d.getDate()))
        .replace(/d(?!d)/, d.getDate());
    },
    newBlob: () => { throw new Error('newBlob is GAS-only'); },
  },
  DriveApp: {},
  Logger: { log: console.log },
};
vm.createContext(sandbox);
vm.runInContext(readFileSync(path.join(root, 'Code.gs'), 'utf8'), sandbox, { filename: 'Code.gs' });

const chromeCandidates = [
  process.env.CHROME_BIN,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean);
const chrome = chromeCandidates.find((p) => existsSync(p));

for (const v of sandbox.VARIANTS) {
  const html = sandbox.buildHtml_(v);
  const htmlPath = path.join(out, `${v.key}.html`);
  writeFileSync(htmlPath, html);
  console.log(`wrote ${path.relative(root, htmlPath)} (${Buffer.byteLength(html)} bytes)`);
  if (!chrome) continue;
  const pdfPath = path.join(out, `expected_${v.key}_chromium.pdf`);
  execFileSync(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href,
  ], { stdio: 'pipe', timeout: 60000 });
  console.log(`wrote ${path.relative(root, pdfPath)} via ${chrome}`);
}
if (!chrome) console.log('Chromium が見つからないため参照 PDF はスキップ（HTML のみ出力）');
