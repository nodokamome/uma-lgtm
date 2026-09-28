// photos/ 以下の写真に LGTM を合成して dist/ に静的サイトを出力する。
//
//   photos/イクイノックス/01.jpg      → 馬名「イクイノックス」
//   photos/ドウデュース_有馬記念.jpg  → 馬名「ドウデュース」（最初の _ より前）
//
// 出力ファイル名は元画像の内容ハッシュなので、デザインを変えて再ビルドしても
// 過去の PR に貼った URL は変わらない。
//
// 写真と同名の .json（fetch-commons.mjs が作る）があれば、撮影者とライセンスを
// 画像の下端に入れる。PR に貼った画像単体でもクレジットが残るようにするため。

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const PHOTOS_DIR = path.resolve(ROOT, process.env.PHOTOS_DIR ?? 'photos');
const SITE_DIR = path.join(ROOT, 'site');
const DIST_DIR = path.join(ROOT, 'dist');
const OUT_DIR = path.join(DIST_DIR, 'lgtm');

const MAX_SIZE = 500;
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.tif', '.tiff']);

// LGTM の字形。高さ 100 の座標系で中心線を描き、太い線で塗る。
// フォントに依存しないのでローカルでも CI でも同じ見た目になる。
const STROKE = 18;
const GAP = 14;
const GLYPHS = [
  { w: 71, d: 'M9 9V91H62' },
  { w: 90, d: 'M68.1 18.6A36 41 0 1 0 81 50H52' },
  { w: 86, d: 'M9 9H77M43 9V91' },
  { w: 90, d: 'M9 91V9L45 58L81 9V91' },
];
const TEXT_WIDTH = GLYPHS.reduce((sum, g) => sum + g.w, 0) + GAP * (GLYPHS.length - 1);

const escapeXml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

function creditText(credit) {
  const artist = credit.artist.replace(/\s*\(talk\)$/, '');
  const by = artist && artist !== 'Own work' ? `Photo: ${artist.length > 36 ? `${artist.slice(0, 35)}…` : artist} / ` : '';
  return `${by}${credit.license} / Wikimedia Commons (modified)`;
}

function creditSvg(width, height, credit) {
  if (!credit) return '';
  const text = creditText(credit);
  // 文字幅をざっくり見積もり（全角 1em・半角 0.58em）、はみ出すなら文字を小さくする
  const em = [...text].reduce((sum, c) => sum + (c.charCodeAt(0) > 0x2e7f ? 1 : 0.58), 0);
  const pad = 8;
  const size = Math.max(8, Math.min(Math.round(width * 0.022), Math.floor((width - pad * 2) / em)));
  const bar = Math.round(size * 1.8);
  return `<rect x="0" y="${height - bar}" width="${width}" height="${bar}" fill="#000" fill-opacity="0.45"/>
  <text x="${pad}" y="${height - Math.round(bar * 0.32)}" font-size="${size}" fill="#fff" fill-opacity="0.92"
    font-family="Hiragino Sans, Noto Sans CJK JP, sans-serif">${escapeXml(text)}</text>`;
}

function overlaySvg(width, height, credit) {
  const scale = Math.min((width * 0.72) / TEXT_WIDTH, (height * 0.34) / 100);
  const tx = (width - TEXT_WIDTH * scale) / 2;
  const ty = (height - 100 * scale) / 2;

  let x = 0;
  const paths = GLYPHS.map((g) => {
    const p = `<path d="${g.d}" transform="translate(${x} 0)"/>`;
    x += g.w + GAP;
    return p;
  }).join('');

  const common = 'fill="none" stroke-linecap="round" stroke-linejoin="round"';
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity="0.45"/>
  </filter></defs>
  <g transform="translate(${tx} ${ty}) scale(${scale})">
    <g ${common} stroke="#1b1b1b" stroke-opacity="0.7" stroke-width="${STROKE + 9}" filter="url(#s)">${paths}</g>
    <g ${common} stroke="#fff" stroke-width="${STROKE}">${paths}</g>
  </g>
  ${creditSvg(width, height, credit)}
</svg>`);
}

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (EXTENSIONS.has(path.extname(entry.name).toLowerCase())) yield full;
  }
}

function horseName(file) {
  const rel = path.relative(PHOTOS_DIR, file);
  const [first, ...rest] = rel.split(path.sep);
  if (rest.length > 0) return first.normalize('NFC');
  return path.parse(first).name.split('_')[0].normalize('NFC');
}

// 新着順のため、git に最初に追加された日時を使う（未コミットならファイルの更新日時）。
function addedAt(file, stat) {
  try {
    const out = execFileSync('git', ['log', '--diff-filter=A', '--follow', '--format=%aI', '--', file], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (out) return out.split('\n').at(-1);
  } catch {}
  return stat.mtime.toISOString();
}

async function build() {
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.cp(SITE_DIR, DIST_DIR, { recursive: true });

  const images = [];
  const seen = new Set();
  for await (const file of walk(PHOTOS_DIR)) {
    const buf = await fs.readFile(file);
    const id = createHash('sha1').update(buf).digest('hex').slice(0, 12);
    if (seen.has(id)) continue;
    seen.add(id);

    const credit = await fs
      .readFile(file.replace(/\.[^.]+$/, '.json'), 'utf8')
      .then(JSON.parse)
      .catch(() => null);

    const { data, info } = await sharp(buf)
      .rotate()
      .resize(MAX_SIZE, MAX_SIZE, { fit: 'inside', withoutEnlargement: true })
      .toBuffer({ resolveWithObject: true });

    await sharp(data)
      .composite([{ input: overlaySvg(info.width, info.height, credit) }])
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(path.join(OUT_DIR, `${id}.jpg`));

    images.push({
      id,
      src: `lgtm/${id}.jpg`,
      name: horseName(file),
      width: info.width,
      height: info.height,
      addedAt: addedAt(file, await fs.stat(file)),
      credit: credit && {
        text: creditText(credit),
        source: credit.source,
        license: credit.license,
        licenseUrl: credit.licenseUrl,
      },
    });
    console.log(`  ${id}  ${path.relative(PHOTOS_DIR, file)}`);
  }

  images.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  await fs.writeFile(path.join(DIST_DIR, 'images.json'), JSON.stringify(images));
  console.log(`\n${images.length} 枚の LGTM 画像を生成しました → dist/`);
}

await build();
