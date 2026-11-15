import { cp, mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = resolve(root, 'dist');
const brand = 'GBC 歌曲索引';
const kinds = { opening: '片頭曲', insert: '插曲', ending: '片尾曲' };
const featuredAlbum = {
  release: '棘ナシ（通常盤）',
  imageUrl: 'https://girls-band-cry.com/wp-content/uploads/2024/07/togenashi_tsujo_hp.jpg',
  sourceUrl: 'https://girls-band-cry.com/goods/post-42.html',
};
const textFields = ['title', 'artist', 'context'];
const creditFields = { lyrics: '作詞', composition: '作曲', arrangement: '編曲', producer: '製作' };
const watchUrl = /^https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})$/;
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const isHttps = (value) => isText(value) && URL.parse(value)?.protocol === 'https:';
const isDate = (value) => isText(value) && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const escape = (value) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const files = (await readdir(join(root, 'songs'))).filter((file) => file.endsWith('.json'));
if (!files.length) throw new Error('songs/ 至少需要一份歌曲資料。');

const orders = new Set();
const songs = [];
for (const file of files) {
  const slug = file.slice(0, -5);
  const song = JSON.parse(await readFile(join(root, 'songs', file), 'utf8'));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`${file} 檔名不符合規則。`);
  if (!song || typeof song !== 'object' || Array.isArray(song)) throw new Error(`${file} 需要 JSON 物件。`);
  if (!Number.isSafeInteger(song.order) || song.order < 1 || orders.has(song.order)) {
    throw new Error(`${file} 的 order 必須是未重複的正整數。`);
  }
  if (typeof song.kind !== 'string' || !Object.hasOwn(kinds, song.kind)) {
    throw new Error(`${file} 的 kind 不受支援。`);
  }
  for (const field of textFields) {
    if (!isText(song[field])) throw new Error(`${file} 缺少 ${field} 文字。`);
  }
  if (typeof song.spoiler !== 'boolean') throw new Error(`${file} 的 spoiler 必須是布林值。`);
  if (!isHttps(song.sourceUrl)) {
    throw new Error(`${file} 的 sourceUrl 必須是 HTTPS 網址。`);
  }
  const videoId = isText(song.listenUrl) && song.listenUrl.match(watchUrl)?.[1];
  if (!videoId) throw new Error(`${file} 的 listenUrl 必須是 YouTube 單支影片網址。`);
  if (song.cover !== undefined && (
    !isText(song.cover?.release) || !isHttps(song.cover.imageUrl) || !isHttps(song.cover.sourceUrl)
  )) {
    throw new Error(`${file} 的 cover 需要 release 及兩個 HTTPS 網址。`);
  }
  if (song.credits !== undefined && (!isHttps(song.credits?.sourceUrl) ||
    !Object.keys(creditFields).every((field) => isText(song.credits[field])))) {
    throw new Error(`${file} 的 credits 需要詞曲、編曲、製作與來源。`);
  }
  if (song.digital !== undefined && (!isDate(song.digital?.date) ||
    !isHttps(song.digital.url) || !isHttps(song.digital.sourceUrl))) {
    throw new Error(`${file} 的 digital 需要有效的發行日期、串流網址與來源。`);
  }
  if (song.releases !== undefined && (!Array.isArray(song.releases) ||
    !song.releases.every((release) => isText(release?.title) && isDate(release.date) &&
      Number.isSafeInteger(release.track) && release.track > 0 && isHttps(release.sourceUrl)))) {
    throw new Error(`${file} 的 releases 需要發行名稱、日期、曲序與來源。`);
  }
  if (song.versions !== undefined && (!Array.isArray(song.versions) ||
    !song.versions.every((version) => isText(version?.title) &&
      isText(version.detail) && isHttps(version.sourceUrl)))) {
    throw new Error(`${file} 的 versions 需要版本名稱、說明與來源。`);
  }
  orders.add(song.order);
  songs.push({ ...song, slug, videoId });
}
songs.sort((a, b) => a.order - b.order);

function layout(title, description, base, body) {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escape(description)}">
  <meta name="theme-color" content="#221816">
  <title>${escape(title)}</title>
  <link rel="stylesheet" href="${base}assets/site.css">
</head>
<body>
  <a class="skip-link" href="#main">跳到主要內容</a>
  <header class="site-header">
    <nav class="wrap nav" aria-label="主導覽">
      <a class="brand" href="${base}index.html"><span class="brand-mark" aria-hidden="true">◉</span> ${brand}</a>
      <div class="nav-links">
        <a href="${base}index.html#tracks">歌曲索引</a>
        <a href="${base}index.html#about">關於</a>
      </div>
    </nav>
  </header>
  ${body}
  <footer class="site-footer"><div class="wrap footer-row">
    <span>${brand} · 非官方同好網站</span>
    <a href="https://girls-band-cry.com/">作品官方網站 <span aria-hidden="true">↗</span></a>
  </div></footer>
</body>
</html>
`;
}

const trackNumber = (index) => String(index + 1).padStart(2, '0');
function coverFigure(cover, className) {
  return `<figure class="${className}">
    <a href="${escape(cover.sourceUrl)}"><img src="${escape(cover.imageUrl)}" width="640" height="640"
      alt="${escape(cover.release)} 封面" decoding="async"></a>
    <figcaption><a href="${escape(cover.sourceUrl)}"><span lang="ja">${escape(cover.release)}</span> · 官方發行資料 ↗</a></figcaption>
  </figure>`;
}
const cards = songs.map((song, index) => `
        <li><a class="track" href="track-${song.slug}.html">
          <span class="track-num" aria-hidden="true">${trackNumber(index)}</span>
          <div><span class="tag">${kinds[song.kind]}</span>
            <h3 lang="ja">${escape(song.title)}</h3>
            <p lang="ja">${escape(song.artist)}</p>
          </div>
          <span class="track-arrow" aria-hidden="true">↗</span>
        </a></li>`).join('');

const description = '收錄動畫的片頭曲、插曲與片尾曲，附官方影片與發行資料。';
const home = `<main id="main">
    <section class="hero" aria-labelledby="hero-title">
      <div class="wrap hero-inner">
        <div>
          <p class="eyebrow hero-kicker">動畫歌曲索引</p>
          <h1 id="hero-title" lang="en">GIRLS<br>BAND CRY<span>.</span></h1>
          <p class="hero-description">${description}</p>
          <a class="button hero-button" href="#tracks">瀏覽歌曲 <span aria-hidden="true">↓</span></a>
        </div>
        ${coverFigure(featuredAlbum, 'hero-cover')}
      </div>
    </section>
    <section id="tracks" class="wrap index" aria-labelledby="tracks-title">
      <div class="section-heading">
        <div><p class="eyebrow">TRACKLIST</p><h2 id="tracks-title">歌曲索引</h2></div>
        <span class="count">收錄 ${songs.length} 首</span>
      </div>
      <ol class="track-list">${cards}
      </ol>
    </section>
    <section id="about" class="about" aria-labelledby="about-title">
      <div class="wrap about-inner">
        <h2 id="about-title">關於本站</h2>
        <p>此非官方索引整理《GIRLS BAND CRY》動畫歌曲的演出版本和使用集數。影片與封面來源標在各歌曲頁。</p>
      </div>
    </section>
  </main>`;

function renderSong(song, index) {
  const next = songs[(index + 1) % songs.length];
  const context = `<p>${escape(song.context)}</p>`;
  const displayContext = song.spoiler
    ? `<details><summary>劇透提示 · 展開情境</summary>${context}</details>`
    : context;
  const nextLink = next === song ? '' : `
      <a href="track-${next.slug}.html">下一首 <span lang="ja">${escape(next.title)}</span> →</a>`;
  const credits = song.credits ? `
      <section class="song-section"><h2>詞曲與製作</h2>
        <dl class="credit-list">${Object.entries(creditFields).map(([field, label]) => `
          <div><dt>${label}</dt><dd lang="ja">${escape(song.credits[field])}</dd></div>`).join('')}
        </dl>
        <p><a class="source" href="${escape(song.credits.sourceUrl)}">製作名單來源 ↗</a></p>
      </section>` : '';
  const releases = song.digital || song.releases?.length ? `
      <section class="song-section"><h2>發行與收錄</h2>
        <ul class="release-list">
          ${song.digital ? `<li><a href="${escape(song.digital.sourceUrl)}">數位發行</a>
            <span><time datetime="${song.digital.date}">${song.digital.date}</time></span></li>` : ''}
          ${(song.releases ?? []).map((release) => `<li>
            <a href="${escape(release.sourceUrl)}" lang="ja">${escape(release.title)}</a>
            <span><time datetime="${release.date}">${release.date}</time> · 第 ${release.track} 曲</span>
          </li>`).join('')}
        </ul>
      </section>` : '';
  const versions = song.versions?.length ? `
      <section class="song-section"><h2>其他版本</h2>
        <ul class="release-list">${song.versions.map((version) => `<li>
          <a href="${escape(version.sourceUrl)}">${escape(version.title)}</a>
          <span>${escape(version.detail)}</span>
        </li>`).join('')}</ul>
      </section>` : '';

  return `<main id="main" class="wrap article-wrap">
    <a class="back" href="index.html#tracks">← 返回歌曲索引</a>
    <article>
      <header class="song-header">
        <p class="eyebrow">TRACK ${trackNumber(index)} <span aria-hidden="true">/</span> ${kinds[song.kind]}</p>
        <h1 lang="ja">${escape(song.title)}</h1>
      </header>
      <section class="song-section" aria-labelledby="listen-title">
        <h2 id="listen-title">官方試聽</h2>
        <iframe class="player" width="640" height="360" loading="lazy"
          src="https://www.youtube.com/embed/${song.videoId}?playsinline=1"
          title="${escape(song.title)} 官方影片"
          referrerpolicy="strict-origin-when-cross-origin"
          allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>
        <div class="listen-links">
          <a class="source" href="${escape(song.listenUrl)}">在 YouTube 開啟 <span aria-hidden="true">↗</span></a>
          ${song.digital ? `<a class="source" href="${escape(song.digital.url)}">官方完整版串流 <span aria-hidden="true">↗</span></a>` : ''}
        </div>
      </section>
      <section class="song-section"><h2>歌曲資訊</h2>
        <div class="song-info">
          <dl>
            <div><dt>演出版本</dt><dd lang="ja">${escape(song.artist)}</dd></div>
            <div><dt>收錄類型</dt><dd>${kinds[song.kind]}</dd></div>
          </dl>
          ${song.cover ? coverFigure(song.cover, 'song-cover') : ''}
        </div>
      </section>
      <section class="song-section"><h2>作品中的出現情境</h2>
        ${displayContext}
        <p><a class="source" href="${escape(song.sourceUrl)}">查看官方資料 <span aria-hidden="true">↗</span></a></p>
      </section>${credits}${releases}${versions}
    </article>
    <nav class="track-nav" aria-label="歌曲導覽">
      <a href="index.html#tracks">← 歌曲索引</a>${nextLink}
    </nav>
  </main>`;
}

await mkdir(dist, { recursive: true });
await cp(join(root, 'assets'), join(dist, 'assets'), { recursive: true });
await writeFile(join(dist, 'index.html'), layout(`GIRLS BAND CRY｜${brand}`, description, '', home));
for (const [index, song] of songs.entries()) {
  const pageDescription = `《${song.title}》的官方試聽、演出版本與動畫使用資料。`;
  const page = layout(`${song.title}｜${brand}`, pageDescription, '', renderSong(song, index));
  await writeFile(join(dist, `track-${song.slug}.html`), page);
}
const expected = new Set(songs.map((song) => `track-${song.slug}.html`));
for (const file of await readdir(dist)) {
  if (/^track-[a-z0-9-]+\.html$/.test(file) && !expected.has(file)) {
    await unlink(join(dist, file));
  }
}
console.log(`建置完成：首頁 + ${songs.length} 個歌曲頁（dist/）`);
