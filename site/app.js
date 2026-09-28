const RANDOM_COUNT = 24;
const FORMAT_KEY = 'uma-lgtm:format';

const $ = (sel) => document.querySelector(sel);
const grid = $('#grid');
const horsesEl = $('#horses');
const formatEl = $('#format');
const toast = $('#toast');

const params = new URLSearchParams(location.search);
const state = {
  images: [],
  view: params.get('view') === 'latest' ? 'latest' : 'random',
  horse: params.get('horse') ?? '',
};

function absoluteUrl(image) {
  return new URL(image.src, location.href).href;
}

function snippet(image) {
  const url = absoluteUrl(image);
  switch (formatEl.value) {
    case 'html':
      return `<img src="${url}" alt="LGTM" width="300">`;
    case 'url':
      return url;
    default:
      return `![LGTM](${url})`;
  }
}

function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function filtered() {
  return state.horse ? state.images.filter((img) => img.name === state.horse) : state.images;
}

let toastTimer;
async function copy(image) {
  const text = snippet(image);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // clipboard API が使えない環境向け
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast.querySelector('.toast__img').src = image.src;
  toast.querySelector('.toast__text').textContent = image.name;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

function syncUrl() {
  const p = new URLSearchParams();
  p.set('view', state.view);
  if (state.horse) p.set('horse', state.horse);
  history.replaceState(null, '', `?${p}`);
}

function renderHorses() {
  const counts = new Map();
  for (const img of state.images) counts.set(img.name, (counts.get(img.name) ?? 0) + 1);
  const names = [...counts.keys()].sort((a, b) => a.localeCompare(b, 'ja'));

  const chip = (name, label, count) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.setAttribute('aria-pressed', String(state.horse === name));
    b.innerHTML = `<span></span><small>${count}</small>`;
    b.firstChild.textContent = label;
    b.addEventListener('click', () => {
      state.horse = state.horse === name ? '' : name;
      update();
    });
    return b;
  };

  horsesEl.replaceChildren(
    chip('', 'すべて', state.images.length),
    ...names.map((n) => chip(n, n, counts.get(n))),
  );
  horsesEl.hidden = names.length < 2;
}

function renderGrid() {
  const list = state.view === 'random' ? shuffled(filtered()).slice(0, RANDOM_COUNT) : filtered();
  $('#shuffle').hidden = state.view !== 'random';
  $('#empty').hidden = state.images.length > 0;

  grid.replaceChildren(
    ...list.map((image) => {
      const li = document.createElement('li');
      li.className = 'card';
      li.innerHTML = `
        <button class="card__btn" type="button">
          <img loading="lazy" decoding="async" alt="">
          <span class="card__hint">クリックでコピー</span>
        </button>
        <div class="card__meta">
          <span class="card__name"></span>
          <a class="card__credit" target="_blank" rel="noopener" hidden></a>
        </div>`;
      const img = li.querySelector('img');
      img.src = image.src;
      img.width = image.width;
      img.height = image.height;
      img.alt = `LGTM - ${image.name}`;
      li.querySelector('.card__name').textContent = image.name;
      if (image.credit) {
        const a = li.querySelector('.card__credit');
        a.hidden = false;
        a.href = image.credit.source;
        a.textContent = image.credit.license;
        a.title = image.credit.text;
      }
      li.querySelector('.card__btn').addEventListener('click', () => copy(image));
      return li;
    }),
  );
}

function update() {
  for (const tab of document.querySelectorAll('.tab')) {
    tab.setAttribute('aria-current', String(tab.dataset.view === state.view));
  }
  syncUrl();
  renderHorses();
  renderGrid();
}

function randomCopy() {
  const list = filtered();
  if (list.length) copy(list[Math.floor(Math.random() * list.length)]);
}

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    state.view = tab.dataset.view;
    update();
  });
}
$('#shuffle').addEventListener('click', renderGrid);
$('#random-copy').addEventListener('click', randomCopy);
document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey && e.target.tagName !== 'SELECT') {
    randomCopy();
  }
});

try {
  formatEl.value = localStorage.getItem(FORMAT_KEY) ?? 'markdown';
} catch {}
formatEl.addEventListener('change', () => {
  try {
    localStorage.setItem(FORMAT_KEY, formatEl.value);
  } catch {}
});

state.images = await fetch('images.json', { cache: 'no-cache' })
  .then((r) => (r.ok ? r.json() : []))
  .catch(() => []);
if (state.horse && !state.images.some((img) => img.name === state.horse)) state.horse = '';
update();
