// horses.json に書いた馬の写真を Wikimedia Commons から photos/ に取り込む。
//
//   photos/<馬名>/commons-<pageid>.jpg   写真（長辺 800px）
//   photos/<馬名>/commons-<pageid>.json  撮影者・ライセンス（build.mjs がクレジットに使う）
//
// 自由ライセンス（CC0 / パブリックドメイン / CC BY / CC BY-SA）の写真だけを取る。
// 取り込み済みのファイルはスキップするので、馬を追加したら再実行すればよい。
// 使いたくない写真は horses.json の exclude に pageid を書いて、ファイルを消す。

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PHOTOS_DIR = path.join(ROOT, 'photos');
const API = 'https://commons.wikimedia.org/w/api.php';
// Wikimedia の User-Agent ポリシーに従って連絡先を入れる
const USER_AGENT = 'uma-lgtm/1.0 (https://github.com/nodokamome/uma-lgtm)';
const PER_HORSE = Number(process.env.PER_HORSE ?? 8);
const THUMB_WIDTH = 800;
const MIN_SHORT_SIDE = 600;
const LICENSE_OK = /^(CC0|CC BY(-SA)? \d(\.\d)?|Public domain|PD\b)/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripTags = (html = '') =>
  html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function categoryFiles(category) {
  const files = [];
  let cont = {};
  do {
    const data = await api({
      action: 'query',
      generator: 'categorymembers',
      gcmtitle: `Category:${category}`,
      gcmtype: 'file',
      gcmlimit: '50',
      prop: 'imageinfo',
      iiprop: 'url|size|mime|extmetadata',
      iiurlwidth: String(THUMB_WIDTH),
      iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist',
      ...cont,
    });
    for (const page of data.query?.pages ?? []) {
      const ii = page.imageinfo?.[0];
      if (!ii) continue;
      const meta = ii.extmetadata ?? {};
      files.push({
        pageid: page.pageid,
        title: page.title,
        mime: ii.mime,
        width: ii.width,
        height: ii.height,
        thumb: ii.thumburl,
        source: ii.descriptionurl,
        artist: stripTags(meta.Artist?.value) || 'Unknown',
        license: stripTags(meta.LicenseShortName?.value),
        licenseUrl: meta.LicenseUrl?.value ?? null,
      });
    }
    cont = data.continue ?? null;
    await sleep(300);
  } while (cont);
  return files;
}

// 同じレースの連写ばかりにならないよう、タイトル順に並べて等間隔に拾う
function pick(files, n) {
  if (files.length <= n) return files;
  const sorted = [...files].sort((a, b) => a.title.localeCompare(b.title));
  return Array.from({ length: n }, (_, i) => sorted[Math.floor((i * sorted.length) / n)]);
}

const horses = JSON.parse(await fs.readFile(path.join(ROOT, 'horses.json'), 'utf8'));
const only = process.argv.slice(2);

for (const horse of horses) {
  if (only.length && !only.includes(horse.name)) continue;
  const exclude = new Set(horse.exclude ?? []);
  const candidates = (await categoryFiles(horse.commons)).filter(
    (f) =>
      !exclude.has(f.pageid) &&
      /^image\/(jpeg|png)$/.test(f.mime) &&
      Math.min(f.width, f.height) >= MIN_SHORT_SIDE &&
      LICENSE_OK.test(f.license),
  );

  const dir = path.join(PHOTOS_DIR, horse.name);
  await fs.mkdir(dir, { recursive: true });
  // 取り込み済みの枚数を数えて、足りない分だけ未取得の候補から補充する
  const have = new Set(
    (await fs.readdir(dir)).map((f) => /^commons-(\d+)\.jpg$/.exec(f)?.[1]).filter(Boolean).map(Number),
  );
  const rest = candidates.filter((f) => !have.has(f.pageid));

  let added = 0;
  for (const f of pick(rest, Math.max(0, PER_HORSE - have.size))) {
    const base = path.join(dir, `commons-${f.pageid}`);
    const res = await fetch(f.thumb, { headers: { 'user-agent': USER_AGENT } });
    if (!res.ok) {
      console.warn(`  skip ${f.title}: ${res.status}`);
      continue;
    }
    await fs.writeFile(`${base}.jpg`, Buffer.from(await res.arrayBuffer()));
    const { pageid, title, source, artist, license, licenseUrl } = f;
    await fs.writeFile(`${base}.json`, JSON.stringify({ pageid, title, source, artist, license, licenseUrl }, null, 2) + '\n');
    added++;
    await sleep(500);
  }
  console.log(`${horse.name}: 候補 ${candidates.length} 枚 / 追加 ${added} 枚`);
}
