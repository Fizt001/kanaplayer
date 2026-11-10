(() => {
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const csrf = document.querySelector('meta[name=csrf-token]').content;
const IS_ADMIN = window.PM.admin;
const au = $('#au');

const S = {
  tracks: [], byId: new Map(), playlists: [], me: null,
  tab: 'tracks', detail: null, q: '', sort: 'title',
  groups: [],                       // cache grup yang sedang tampil (album/artis/genre)
  ctx: [],                          // id lagu pada daftar yang sedang tampil
  queue: [], orig: [], qi: -1, shuffle: false, repeat: 'off', speed: 1,
  sleep: null, resume: null, uploading: false,
};

/* ---------- util ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = s => {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
};
const cmp = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'id', {numeric: true, sensitivity: 'base'});
const icon = n => `<svg class="ic"><use href="#i-${n}"/></svg>`;
const shuffleArr = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cur = () => S.byId.get(S.queue[S.qi]);

let toastT;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2400);
}

async function api(url, method = 'GET', body) {
  const opt = {method, headers: {'X-CSRF-TOKEN': csrf, 'Accept': 'application/json'}};
  if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const r = await fetch(url, opt);
  if (r.status === 401) { location.href = '/login'; }
  let data = null; try { data = await r.json(); } catch (e) {}
  return {ok: r.ok, status: r.status, data};
}

function coverEl(el, t) {
  if (t && t.cover_url) { el.style.backgroundImage = `url("${t.cover_url}")`; el.classList.add('has'); }
  else { el.style.backgroundImage = ''; el.classList.remove('has'); }
}
const coverHtml = (url, cls = '') =>
  `<div class="cv ${url ? 'has' : ''} ${cls}" ${url ? `style="background-image:url('${esc(url)}')"` : ''}>${icon('note')}</div>`;

/* ---------- bottom sheet ---------- */
function sheet(title, items) {
  const el = $('#sheet'); el.querySelector('.sh-title').textContent = title;
  const box = el.querySelector('.sh-list'); box.innerHTML = '';
  items.forEach(it => {
    const b = document.createElement('button');
    b.className = 'sh-item' + (it.danger ? ' danger' : '') + (it.on ? ' on' : '');
    b.textContent = it.label;
    b.onclick = () => { closeSheet(); if (it.fn) it.fn(); };
    box.appendChild(b);
  });
  el.classList.add('open');
}
const closeSheet = () => $('#sheet').classList.remove('open');
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });

/* ---------- data ---------- */
async function loadAll() {
  const [t, p, m] = await Promise.all([api('/tracks'), api('/playlists'), api('/me')]);
  S.tracks = Array.isArray(t.data) ? t.data : [];
  S.byId = new Map(S.tracks.map(x => [x.id, x]));
  S.playlists = Array.isArray(p.data) ? p.data : [];
  S.me = m.data; renderMe(); render(); restoreState();
}
async function reloadTracks() {
  const t = await api('/tracks');
  S.tracks = Array.isArray(t.data) ? t.data : S.tracks;
  S.byId = new Map(S.tracks.map(x => [x.id, x]));
  render();
}

function renderMe() {
  const m = S.me; if (!m) return;
  const chip = $('#chip');
  chip.textContent = m.premium ? (m.is_admin ? 'Admin' : 'Premium') : `Free ${m.used}/${m.limit}`;
  chip.classList.toggle('prem', !!m.premium);
}

/* ---------- pengelompokan ---------- */
function groupBy(list, keyFn) {
  const map = new Map();
  list.forEach(t => { const k = keyFn(t) || ''; if (!map.has(k)) map.set(k, []); map.get(k).push(t); });
  return [...map.entries()].map(([key, tracks]) => ({key, tracks}));
}
const byTrackNo = (a, b) => ((a.track_no ?? 9999) - (b.track_no ?? 9999)) || cmp(a.title, b.title);
const matches = (q, ...f) => !q || f.join(' ').toLowerCase().includes(q);

function sortTracks(list) {
  const s = S.sort, l = list.slice();
  if (s === 'artist') return l.sort((a, b) => cmp(a.artist, b.artist) || cmp(a.album, b.album) || byTrackNo(a, b));
  if (s === 'album') return l.sort((a, b) => cmp(a.album, b.album) || byTrackNo(a, b));
  if (s === 'recent') return l.sort((a, b) => b.id - a.id);
  return l.sort((a, b) => cmp(a.title, b.title));
}

function detailTracks(d) {
  const T = S.tracks;
  switch (d.kind) {
    case 'album':  return T.filter(t => (t.album || '') === d.key).sort(byTrackNo);
    case 'artist': return T.filter(t => (t.artist || '') === d.key).sort((a, b) => cmp(a.album, b.album) || byTrackNo(a, b));
    case 'genre':  return T.filter(t => (t.genre || '') === d.key).sort((a, b) => cmp(a.title, b.title));
    case 'fav':    return T.filter(t => t.favorite).sort((a, b) => cmp(a.title, b.title));
    case 'recent': return T.filter(t => t.last_played_at).sort((a, b) => b.last_played_at.localeCompare(a.last_played_at)).slice(0, 50);
    case 'most':   return T.filter(t => t.play_count > 0).sort((a, b) => b.play_count - a.play_count).slice(0, 50);
    case 'playlist': {
      const p = S.playlists.find(x => x.id === d.key);
      return p ? p.track_ids.map(id => S.byId.get(id)).filter(Boolean) : [];
    }
  }
  return [];
}

/* ---------- render daftar ---------- */
function trackRow(t) {
  const on = cur() && cur().id === t.id;
  return `<div class="row ${on ? 'on' : ''}" data-act="play" data-id="${t.id}">
    ${coverHtml(t.cover_url)}
    <div class="tx"><b>${esc(t.title)}</b><span>${esc(t.artist || 'Artis tidak diketahui')}${t.album ? ' · ' + esc(t.album) : ''}</span></div>
    <span class="du">${fmt(t.duration)}</span>
    <button class="ib" data-act="menu" data-id="${t.id}" aria-label="Menu">${icon('more')}</button>
  </div>`;
}

function renderTab() {
  const q = S.q, tab = S.tab;
  S.groups = [];
  if (tab === 'tracks') {
    const list = sortTracks(S.tracks.filter(t => matches(q, t.title, t.artist, t.album, t.genre)));
    S.ctx = list.map(t => t.id);
    const labels = {title: 'Judul', artist: 'Artis', album: 'Album', recent: 'Terbaru'};
    let h = '';
    if (IS_ADMIN && !q) h += `<div id="drop">Seret &amp; lepas file audio ke sini, atau klik untuk memilih
      <input id="file" type="file" accept="audio/*,.flac,.m4a,.opus" multiple hidden><div id="up"></div></div>`;
    if (!list.length) return h + `<div class="empty">${q ? 'Tidak ada hasil.' : 'Pustaka masih kosong.'}</div>`;
    h += `<div class="tb"><button class="pill acc" data-act="playall">${icon('play')}Putar</button>
      <button class="pill" data-act="shuffleall">${icon('shuffle')}Acak</button><span class="sp"></span>
      <button class="lnk" data-act="sort">${list.length} lagu · ${labels[S.sort]} ▾</button></div>`;
    return h + list.map(trackRow).join('');
  }

  if (tab === 'albums') {
    const gs = groupBy(S.tracks, t => t.album).filter(g => matches(q, g.key || 'Tanpa album', g.tracks.map(t => t.artist).join(' ')))
      .sort((a, b) => cmp(a.key || '\uffff', b.key || '\uffff'));
    S.groups = gs;
    if (!gs.length) return `<div class="empty">Belum ada album.</div>`;
    return `<div class="grid">${gs.map((g, i) => {
      const artists = [...new Set(g.tracks.map(t => t.artist).filter(Boolean))];
      const cv = (g.tracks.find(t => t.cover_url) || {}).cover_url;
      return `<div class="card" data-act="open" data-kind="album" data-i="${i}">${coverHtml(cv)}
        <b>${esc(g.key || 'Tanpa album')}</b><span>${artists.length > 1 ? 'Berbagai artis' : esc(artists[0] || '')}</span></div>`;
    }).join('')}</div>`;
  }

  if (tab === 'artists' || tab === 'genres') {
    const isA = tab === 'artists';
    const gs = groupBy(S.tracks, t => isA ? t.artist : t.genre).filter(g => matches(q, g.key || 'Tidak diketahui'))
      .sort((a, b) => cmp(a.key || '\uffff', b.key || '\uffff'));
    S.groups = gs;
    if (!gs.length) return `<div class="empty">${isA ? 'Belum ada artis.' : 'Belum ada genre.'}</div>`;
    return gs.map((g, i) => {
      const cv = (g.tracks.find(t => t.cover_url) || {}).cover_url;
      return `<div class="row ${isA ? 'round' : ''}" data-act="open" data-kind="${isA ? 'artist' : 'genre'}" data-i="${i}">${coverHtml(cv)}
        <div class="tx"><b>${esc(g.key || 'Tidak diketahui')}</b><span>${g.tracks.length} lagu</span></div></div>`;
    }).join('');
  }

  // playlists
  const smart = [
    ['fav', 'Favorit', 'heart-on', S.tracks.filter(t => t.favorite).length],
    ['recent', 'Terakhir diputar', 'timer', Math.min(50, S.tracks.filter(t => t.last_played_at).length)],
    ['most', 'Paling sering diputar', 'repeat', Math.min(50, S.tracks.filter(t => t.play_count > 0).length)],
  ].filter(s => matches(q, s[1]));
  let h = smart.map(s => `<div class="row" data-act="opensmart" data-kind="${s[0]}">
      <div class="cv">${icon(s[2])}</div><div class="tx"><b>${s[1]}</b><span>${s[3]} lagu</span></div></div>`).join('');
  h += `<div class="tb"><button class="pill" data-act="newpl">${icon('add')}Buat playlist</button></div>`;
  h += S.playlists.filter(p => matches(q, p.name)).map(p => {
    const first = S.byId.get(p.track_ids[0]);
    return `<div class="row" data-act="openpl" data-id="${p.id}">${coverHtml(first && first.cover_url)}
      <div class="tx"><b>${esc(p.name)}</b><span>${p.track_ids.length} lagu</span></div></div>`;
  }).join('');
  return h;
}

function renderDetail() {
  const d = S.detail, list = detailTracks(d);
  S.ctx = list.map(t => t.id);
  let h = `<div class="tb">`;
  if (list.length) h += `<button class="pill acc" data-act="playall">${icon('play')}Putar</button>
    <button class="pill" data-act="shuffleall">${icon('shuffle')}Acak</button>`;
  h += `<span class="sp"></span><span>${list.length} lagu</span>`;
  if (d.kind === 'playlist') h += `<button class="ib" data-act="plmenu" aria-label="Opsi playlist">${icon('more')}</button>`;
  h += `</div>`;
  if (!list.length) return h + `<div class="empty">${d.kind === 'playlist' ? 'Playlist kosong. Tambahkan lagu lewat menu ⋮ pada lagu.' : 'Belum ada lagu.'}</div>`;
  return h + list.map(trackRow).join('');
}

function render() {
  const d = S.detail;
  $('#btn-back').hidden = !d;
  const h1 = $('#title');
  h1.textContent = d ? d.title : 'PlayerMP3'; h1.classList.toggle('sub', !!d);
  $('#tabs').hidden = !!d;
  $$('#tabs .tab').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
  $('#content').innerHTML = d ? renderDetail() : renderTab();
  bindDrop();
}
function markNow() {
  const id = cur() && cur().id;
  $$('#content .row[data-act=play]').forEach(r => r.classList.toggle('on', +r.dataset.id === id));
}

/* ---------- pemutaran ---------- */
async function playAt(i, startPos = 0) {
  const id = S.queue[i], t = S.byId.get(id);
  if (!t) return false;
  const r = await api(`/tracks/${id}/play`, 'POST');
  if (r.status === 402) { au.pause(); S.me = {...S.me, ...r.data}; renderMe(); paywall(r.data); return false; }
  if (!r.ok) { toast('Gagal memutar lagu'); return false; }
  S.me = r.data; renderMe();
  S.qi = i;
  au.src = t.stream_url;
  au.playbackRate = S.speed;
  if (startPos > 1) au.addEventListener('loadedmetadata', () => { au.currentTime = startPos; }, {once: true});
  try { await au.play(); } catch (e) {}
  t.play_count = (t.play_count || 0) + 1; t.last_played_at = new Date().toISOString();
  nowUI(t); saveState(); markNow();
  return true;
}

function playContext(ids, startId, shuffle = S.shuffle) {
  if (!ids.length) return;
  S.shuffle = shuffle; S.orig = ids.slice();
  S.queue = shuffle ? [startId, ...shuffleArr(ids.filter(x => x !== startId))] : ids.slice();
  syncModes();
  playAt(S.queue.indexOf(startId));
}

function next(auto = false) {
  if (!S.queue.length) return;
  if (auto && S.repeat === 'one') { au.currentTime = 0; au.play(); return; }
  let i = S.qi + 1;
  if (i >= S.queue.length) {
    if (auto && S.repeat !== 'all') { au.pause(); au.currentTime = 0; return; }
    i = 0;
  }
  playAt(i);
}
function prev() {
  if (!S.queue.length) return;
  if (au.currentTime > 3 || (S.qi <= 0 && S.repeat !== 'all')) { au.currentTime = 0; return; }
  playAt(S.qi <= 0 ? S.queue.length - 1 : S.qi - 1);
}
function toggle() {
  if (!au.src) {
    if (S.qi >= 0) { playAt(S.qi, S.resume || 0); S.resume = null; }
    else if (S.ctx.length) playContext(S.ctx, S.ctx[0]);
    return;
  }
  au.paused ? au.play() : au.pause();
}

function toggleShuffle() {
  S.shuffle = !S.shuffle;
  const id = S.queue[S.qi];
  if (S.qi >= 0) {
    if (S.shuffle) S.queue = [...S.queue.slice(0, S.qi + 1), ...shuffleArr(S.queue.slice(S.qi + 1))];
    else if (S.orig.includes(id)) { S.queue = S.orig.slice(); S.qi = S.queue.indexOf(id); }
  }
  syncModes(); saveState();
  toast(S.shuffle ? 'Acak: aktif' : 'Acak: mati');
}
function cycleRepeat() {
  S.repeat = {off: 'all', all: 'one', one: 'off'}[S.repeat];
  syncModes(); saveState();
  toast({off: 'Ulangi: mati', all: 'Ulangi semua', one: 'Ulangi satu lagu'}[S.repeat]);
}
function syncModes() {
  $('#bshuf').classList.toggle('on', S.shuffle);
  $('#brep').classList.toggle('on', S.repeat !== 'off');
  $('#irep').innerHTML = `<use href="#i-${S.repeat === 'one' ? 'repeat1' : 'repeat'}"/>`;
  $('#lspd').textContent = `${S.speed}x`;
}

/* Antrean */
function enqueue(id, now) {
  if (!S.byId.has(id)) return;
  if (S.qi < 0 || !S.queue.length) { S.queue = [id]; S.orig = [id]; S.qi = -1; playAt(0); return; }
  const at = now ? S.qi + 1 : S.queue.length;
  S.queue.splice(at, 0, id);
  const oi = S.orig.indexOf(S.queue[S.qi]);
  S.orig.splice(now ? oi + 1 : S.orig.length, 0, id);
  saveState();
  toast(now ? 'Akan diputar berikutnya' : 'Ditambahkan ke antrean');
}
function moveQ(i, j) {
  if (j < 0 || j >= S.queue.length) return;
  const [x] = S.queue.splice(i, 1);
  S.queue.splice(j, 0, x);
  if (i === S.qi) S.qi = j; else if (i < S.qi && j >= S.qi) S.qi--; else if (i > S.qi && j <= S.qi) S.qi++;
  if (!S.shuffle) S.orig = S.queue.slice();
  renderQueue(); saveState();
}
function removeQ(i) {
  if (i === S.qi) return;
  const id = S.queue[i];
  S.queue.splice(i, 1); if (i < S.qi) S.qi--;
  const oi = S.orig.indexOf(id); if (oi >= 0) S.orig.splice(oi, 1);
  renderQueue(); saveState();
}
function renderQueue() {
  const el = $('#qlist');
  if (!S.queue.length) { el.innerHTML = '<div class="empty">Antrean kosong.</div>'; return; }
  let h = '';
  S.queue.forEach((id, i) => {
    const t = S.byId.get(id); if (!t) return;
    if (i === S.qi) h += '<div class="qlabel">Sedang diputar</div>';
    if (i === S.qi + 1) h += '<div class="qlabel">Berikutnya</div>';
    h += `<div class="qrow ${i === S.qi ? 'on' : ''} ${i < S.qi ? 'done' : ''}" data-act="qplay" data-i="${i}">
      ${coverHtml(t.cover_url)}<div class="tx"><b>${esc(t.title)}</b><span>${esc(t.artist || '')}</span></div>
      <button class="ib" data-act="qup" data-i="${i}" aria-label="Naik">${icon('up')}</button>
      <button class="ib" data-act="qdown" data-i="${i}" aria-label="Turun">${icon('down')}</button>
      ${i === S.qi ? '' : `<button class="ib" data-act="qremove" data-i="${i}" aria-label="Hapus">${icon('close')}</button>`}</div>`;
  });
  el.innerHTML = h;
  const on = el.querySelector('.qrow.on'); if (on) on.scrollIntoView({block: 'center'});
}

/* Sleep timer & kecepatan */
function setSleep(minutes, eot) {
  if (S.sleep && S.sleep.t) clearTimeout(S.sleep.t);
  S.sleep = null;
  if (eot) S.sleep = {eot: true};
  else if (minutes) S.sleep = {end: Date.now() + minutes * 60000, t: setTimeout(() => { au.pause(); S.sleep = null; sleepUI(); toast('Timer tidur selesai'); }, minutes * 60000)};
  sleepUI();
}
function sleepUI() {
  const s = S.sleep;
  $('#bslp').classList.toggle('on', !!s);
  $('#lslp').textContent = !s ? 'Timer' : s.eot ? 'Akhir lagu' : `${Math.max(1, Math.ceil((s.end - Date.now()) / 60000))} mnt`;
}
setInterval(sleepUI, 30000);

/* UI lagu yang diputar */
function nowUI(t) {
  $('#mini').hidden = false;
  $('#mttl').textContent = $('#nttl').textContent = t.title;
  $('#mart').textContent = $('#nart').textContent = t.artist || '';
  coverEl($('#mcv'), t); coverEl($('#bigcv'), t);
  favUI(t);
  document.title = `${t.title} - PlayerMP3`;
  $('#tdur').textContent = fmt(t.duration);
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title, artist: t.artist || '', album: t.album || '',
      artwork: t.cover_url ? [{src: t.cover_url, sizes: '512x512'}] : [],
    });
  }
}
function favUI(t) {
  $('#nfav').innerHTML = icon(t && t.favorite ? 'heart-on' : 'heart');
  $('#nfav').classList.toggle('on', !!(t && t.favorite));
}
function ppUI() {
  const id = au.paused ? 'play' : 'pause';
  $('#mpp').innerHTML = $('#npp').innerHTML = `<use href="#i-${id}"/>`;
}

async function toggleFav(t) {
  t.favorite = !t.favorite; favUI(cur()); render();
  const r = await api(`/tracks/${t.id}/favorite`, 'POST');
  if (!r.ok) { t.favorite = !t.favorite; favUI(cur()); render(); toast('Gagal menyimpan favorit'); }
  else toast(t.favorite ? 'Ditambahkan ke Favorit' : 'Dihapus dari Favorit');
}

/* Playlist */
function upsertPl(p) {
  const i = S.playlists.findIndex(x => x.id === p.id);
  if (i >= 0) S.playlists[i] = p; else S.playlists.push(p);
  S.playlists.sort((a, b) => cmp(a.name, b.name));
}
async function createPlaylist(thenAdd) {
  const name = (prompt('Nama playlist:') || '').trim(); if (!name) return;
  const r = await api('/playlists', 'POST', {name});
  if (!r.ok) return toast('Gagal membuat playlist');
  upsertPl(r.data);
  if (thenAdd) { await addToPlaylist(r.data.id, thenAdd); } else render();
}
async function addToPlaylist(plId, trackId) {
  const r = await api(`/playlists/${plId}/tracks`, 'POST', {track_id: trackId});
  if (!r.ok) return toast('Gagal menambahkan ke playlist');
  upsertPl(r.data); render();
  toast(`Ditambahkan ke "${r.data.name}"`);
}
function pickPlaylist(trackId) {
  const items = [{label: '+ Playlist baru', fn: () => createPlaylist(trackId)}];
  S.playlists.forEach(p => items.push({label: `${p.name} (${p.track_ids.length})`, fn: () => addToPlaylist(p.id, trackId)}));
  sheet('Tambah ke playlist', items);
}

/* Menu lagu */
function trackMenu(t) {
  const items = [
    {label: 'Putar berikutnya', fn: () => enqueue(t.id, true)},
    {label: 'Tambah ke antrean', fn: () => enqueue(t.id, false)},
    {label: 'Tambah ke playlist', fn: () => pickPlaylist(t.id)},
    {label: t.favorite ? 'Hapus dari Favorit' : 'Tambah ke Favorit', fn: () => toggleFav(t)},
  ];
  if (S.detail && S.detail.kind === 'playlist') items.push({label: 'Hapus dari playlist ini', fn: async () => {
    const r = await api(`/playlists/${S.detail.key}/tracks/${t.id}`, 'DELETE');
    if (r.ok) { upsertPl(r.data); render(); }
  }});
  if (t.album) items.push({label: 'Buka album', fn: () => { S.detail = {kind: 'album', key: t.album, title: t.album}; closeNp(); render(); }});
  if (t.artist) items.push({label: 'Buka artis', fn: () => { S.detail = {kind: 'artist', key: t.artist, title: t.artist}; closeNp(); render(); }});
  if (IS_ADMIN) items.push({label: 'Hapus dari pustaka', danger: true, fn: () => deleteTrack(t)});
  sheet(t.title, items);
}
async function deleteTrack(t) {
  if (!confirm(`Hapus "${t.title}" dari pustaka? File akan dihapus permanen.`)) return;
  const r = await api(`/tracks/${t.id}`, 'DELETE');
  if (!r.ok) return toast('Gagal menghapus');
  const playingId = cur() && cur().id;
  S.queue = S.queue.filter(x => x !== t.id); S.orig = S.orig.filter(x => x !== t.id);
  S.playlists.forEach(p => { p.track_ids = p.track_ids.filter(x => x !== t.id); });
  if (playingId === t.id) { au.pause(); au.removeAttribute('src'); S.qi = -1; $('#mini').hidden = true; closeNp(); }
  else S.qi = S.queue.indexOf(playingId);
  S.tracks = S.tracks.filter(x => x.id !== t.id); S.byId.delete(t.id);
  render(); saveState(); toast('Lagu dihapus');
}

/* Paywall */
function paywall(d) {
  $('#pwmsg').textContent = d.message || 'Kuota harian habis. Upgrade ke premium untuk lanjut memutar.';
  $('#pwid').textContent = d.member_code || (S.me && S.me.member_code) || '';
  $('#pwinfo').textContent = [d.price && `Harga: ${d.price}.`, d.payment_info].filter(Boolean).join(' ');
  $('#paywall').classList.add('open');
}

/* Now Playing / antrean */
function openNp() { if (S.qi >= 0) { $('#np').classList.add('open'); history.pushState({np: 1}, ''); } }
function closeNp() { $('#np').classList.remove('open'); }
window.addEventListener('popstate', () => {
  if ($('#queue').classList.contains('open')) $('#queue').classList.remove('open');
  else if ($('#np').classList.contains('open')) closeNp();
  else if (S.detail) { S.detail = null; render(); }
});

/* ---------- penyimpanan status ---------- */
function saveState() {
  try {
    localStorage.setItem('pm_state', JSON.stringify({
      uid: window.PM.uid, queue: S.queue, orig: S.orig, qi: S.qi, shuffle: S.shuffle,
      repeat: S.repeat, speed: S.speed, pos: au.currentTime || 0,
    }));
  } catch (e) {}
}
function restoreState() {
  let st; try { st = JSON.parse(localStorage.getItem('pm_state') || 'null'); } catch (e) {}
  if (!st || st.uid !== window.PM.uid) return;
  S.shuffle = !!st.shuffle; S.repeat = st.repeat || 'off'; S.speed = st.speed || 1;
  const curId = (st.queue || [])[st.qi];
  S.queue = (st.queue || []).filter(id => S.byId.has(id));
  S.orig = (st.orig || []).filter(id => S.byId.has(id));
  S.qi = S.queue.indexOf(curId);
  syncModes();
  if (S.qi >= 0) {
    S.resume = st.pos || 0;
    nowUI(S.byId.get(curId));
    ppUI();
  } else { S.queue = []; S.orig = []; }
}
setInterval(() => { if (!au.paused) saveState(); }, 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveState(); });

/* ---------- event audio ---------- */
let lastPos = 0;
au.addEventListener('timeupdate', () => {
  const d = au.duration, c = au.currentTime;
  if (isFinite(d) && d > 0) {
    $('#seek').value = c / d * 1000;
    $('#mprog').style.width = (c / d * 100) + '%';
    $('#tdur').textContent = fmt(d);
  }
  $('#tcur').textContent = fmt(c);
  if ('mediaSession' in navigator && isFinite(d) && Date.now() - lastPos > 1000) {
    lastPos = Date.now();
    try { navigator.mediaSession.setPositionState({duration: d, playbackRate: au.playbackRate, position: Math.min(c, d)}); } catch (e) {}
  }
});
au.addEventListener('play', ppUI);
au.addEventListener('pause', () => { ppUI(); saveState(); });
au.addEventListener('ended', () => {
  if (S.sleep && S.sleep.eot) { S.sleep = null; sleepUI(); au.pause(); return; }
  next(true);
});
au.addEventListener('error', () => { if (au.src) toast('Tidak bisa memutar lagu ini'); });
$('#seek').addEventListener('input', e => { if (isFinite(au.duration)) au.currentTime = e.target.value / 1000 * au.duration; });

if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession;
  [['play', () => toggle()], ['pause', () => au.pause()], ['previoustrack', prev], ['nexttrack', () => next()],
   ['seekbackward', () => { au.currentTime = Math.max(0, au.currentTime - 10); }],
   ['seekforward', () => { au.currentTime = Math.min(au.duration || 1e9, au.currentTime + 10); }],
   ['seekto', d => { au.currentTime = d.seekTime; }]]
    .forEach(([a, f]) => { try { ms.setActionHandler(a, f); } catch (e) {} });
}
document.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); toggle(); }
  if (e.code === 'ArrowRight' && e.shiftKey) next();
  if (e.code === 'ArrowLeft' && e.shiftKey) prev();
});

/* ---------- aksi klik ---------- */
const A = {
  tab: el => { S.tab = el.dataset.tab; S.detail = null; render(); window.scrollTo(0, 0); },
  back: () => { if (history.state && history.state.d) history.back(); else { S.detail = null; render(); } },
  search: () => { const sb = $('#sb'); sb.hidden = !sb.hidden; if (!sb.hidden) $('#q').focus(); else { S.q = ''; $('#q').value = ''; render(); } },
  quota: () => { const m = S.me; if (!m) return;
    sheet(`ID member: ${m.member_code}`, [{label: m.premium
      ? (m.is_admin ? 'Akun admin (tanpa batas)' : `Premium${m.premium_until ? ' sampai ' + m.premium_until : ''}`)
      : `Free: ${m.used}/${m.limit} lagu hari ini (sisa ${m.remaining})`}]); },
  topmenu: () => {
    const items = [];
    if (IS_ADMIN) items.push({label: 'Manajer member', fn: () => { location.href = '/admin'; }});
    items.push({label: 'Muat ulang pustaka', fn: () => { reloadTracks(); toast('Pustaka dimuat ulang'); }});
    items.push({label: 'Keluar', danger: true, fn: () => $('#logout').submit()});
    sheet(S.me ? `${S.me.name} · ${S.me.member_code}` : 'Menu', items);
  },
  open: el => { const g = S.groups[+el.dataset.i]; if (!g) return;
    S.detail = {kind: el.dataset.kind, key: g.key, title: g.key || (el.dataset.kind === 'album' ? 'Tanpa album' : 'Tidak diketahui')}; render(); window.scrollTo(0, 0); history.pushState({d: 1}, ''); },
  opensmart: el => { const t = {fav: 'Favorit', recent: 'Terakhir diputar', most: 'Paling sering diputar'}[el.dataset.kind];
    S.detail = {kind: el.dataset.kind, key: null, title: t}; render(); window.scrollTo(0, 0); history.pushState({d: 1}, ''); },
  openpl: el => { const p = S.playlists.find(x => x.id === +el.dataset.id); if (!p) return;
    S.detail = {kind: 'playlist', key: p.id, title: p.name}; render(); window.scrollTo(0, 0); history.pushState({d: 1}, ''); },
  plmenu: () => { const p = S.playlists.find(x => x.id === S.detail.key); if (!p) return;
    sheet(p.name, [
      {label: 'Ganti nama', fn: async () => { const n = (prompt('Nama baru:', p.name) || '').trim(); if (!n) return;
        const r = await api(`/playlists/${p.id}`, 'PATCH', {name: n}); if (r.ok) { upsertPl(r.data); S.detail.title = r.data.name; render(); } }},
      {label: 'Hapus playlist', danger: true, fn: async () => { if (!confirm(`Hapus playlist "${p.name}"?`)) return;
        const r = await api(`/playlists/${p.id}`, 'DELETE'); if (r.ok) { S.playlists = S.playlists.filter(x => x.id !== p.id); S.detail = null; render(); } }},
    ]); },
  newpl: () => createPlaylist(null),
  sort: () => sheet('Urutkan lagu', [['title', 'Judul'], ['artist', 'Artis'], ['album', 'Album'], ['recent', 'Terbaru ditambahkan']]
    .map(([k, l]) => ({label: l, on: S.sort === k, fn: () => { S.sort = k; render(); }}))),
  play: el => playContext(S.ctx, +el.dataset.id),
  menu: el => { const t = S.byId.get(+el.dataset.id); if (t) trackMenu(t); },
  playall: () => { if (S.ctx.length) playContext(S.ctx, S.ctx[0], false); },
  shuffleall: () => { if (S.ctx.length) playContext(S.ctx, S.ctx[Math.floor(Math.random() * S.ctx.length)], true); },
  'open-np': () => openNp(),
  'close-np': () => { if (history.state && history.state.np) history.back(); else closeNp(); },
  'np-menu': () => { const t = cur(); if (t) trackMenu(t); },
  toggle: () => toggle(), next: () => next(), prev: () => prev(),
  shuffle: () => toggleShuffle(), repeat: () => cycleRepeat(),
  fav: () => { const t = cur(); if (t) toggleFav(t); },
  speed: () => sheet('Kecepatan putar', [0.5, 0.75, 1, 1.25, 1.5, 2].map(v =>
    ({label: v === 1 ? 'Normal (1x)' : `${v}x`, on: S.speed === v, fn: () => { S.speed = v; au.playbackRate = v; syncModes(); saveState(); }}))),
  sleep: () => sheet('Timer tidur', [
    {label: 'Mati', on: !S.sleep, fn: () => setSleep(0)},
    ...[15, 30, 45, 60].map(m => ({label: `${m} menit`, fn: () => { setSleep(m); toast(`Berhenti dalam ${m} menit`); }})),
    {label: 'Akhir lagu ini', on: !!(S.sleep && S.sleep.eot), fn: () => { setSleep(0, true); toast('Berhenti setelah lagu ini'); }},
  ]),
  queue: () => { renderQueue(); $('#queue').classList.add('open'); history.pushState({q: 1}, ''); },
  qclose: () => { if (history.state && history.state.q) history.back(); else $('#queue').classList.remove('open'); },
  qclear: () => { if (S.qi < 0) return; const id = S.queue[S.qi]; S.queue = [id]; S.orig = [id]; S.qi = 0; renderQueue(); saveState(); },
  qplay: el => playAt(+el.dataset.i),
  qup: el => moveQ(+el.dataset.i, +el.dataset.i - 1),
  qdown: el => moveQ(+el.dataset.i, +el.dataset.i + 1),
  qremove: el => removeQ(+el.dataset.i),
  copyid: () => { const v = $('#pwid').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(() => toast('ID disalin'), () => toast(v)); },
  pwclose: () => $('#paywall').classList.remove('open'),
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || !A[el.dataset.act]) return;
  e.stopPropagation();
  A[el.dataset.act](el);
});
$('#q').addEventListener('input', e => { S.q = e.target.value.trim().toLowerCase(); render(); });
$('#paywall').addEventListener('click', e => { if (e.target.id === 'paywall') A.pwclose(); });

/* ---------- upload (admin): drag & drop, dipecah per batch ---------- */
const MAX_FILES = 15, MAX_BYTES = 100 * 1024 * 1024;
function batches(files) {
  const out = []; let c = [], size = 0;
  for (const f of files) {
    if (c.length && (c.length >= MAX_FILES || size + f.size > MAX_BYTES)) { out.push(c); c = []; size = 0; }
    c.push(f); size += f.size;
  }
  if (c.length) out.push(c);
  return out;
}
function sendBatch(list, label, say) {
  return new Promise(resolve => {
    const fd = new FormData(); list.forEach(f => fd.append('files[]', f));
    const x = new XMLHttpRequest();
    x.open('POST', '/tracks');
    x.setRequestHeader('X-CSRF-TOKEN', csrf); x.setRequestHeader('Accept', 'application/json');
    x.upload.onprogress = e => { if (e.lengthComputable) say(`${label} ${Math.round(e.loaded / e.total * 100)}%`); };
    x.onload = () => {
      if (x.status === 201) return resolve(JSON.parse(x.responseText));
      let why = `kode ${x.status}`;
      if (x.status === 413) why = 'ukuran melebihi batas server';
      else if (x.status === 419) why = 'sesi kedaluwarsa, muat ulang halaman';
      else if (x.status === 403) why = 'hanya admin yang boleh upload';
      else if (x.status === 422) { try { why = Object.values(JSON.parse(x.responseText).errors).flat()[0]; } catch (e) {} }
      resolve({error: why, failed: list.map(f => f.name)});
    };
    x.onerror = () => resolve({error: 'koneksi gagal', failed: list.map(f => f.name)});
    x.send(fd);
  });
}
async function upload(files) {
  if (!files.length || S.uploading) return;
  S.uploading = true;
  const say = m => { const u = $('#up'); if (u) u.textContent = m; };
  const groups = batches([...files]);
  let created = 0, skipped = 0, failed = 0, lastErr = '';
  for (let i = 0; i < groups.length; i++) {
    const r = await sendBatch(groups[i], `Batch ${i + 1}/${groups.length}:`, say);
    if (r.error) { failed += r.failed.length; lastErr = r.error; } else { created += r.created.length; skipped += r.skipped.length; }
  }
  let msg = `${created} lagu ditambahkan`;
  if (skipped) msg += `, ${skipped} dilewati (duplikat/format tidak didukung)`;
  if (failed) msg += `, ${failed} gagal (${lastErr})`;
  S.uploading = false;
  await reloadTracks();
  say(msg); toast(msg);
}
function bindDrop() {
  const drop = $('#drop'); if (!drop) return;
  const file = $('#file');
  drop.onclick = e => { if (e.target !== file) file.click(); };
  file.onchange = e => { upload(e.target.files); e.target.value = ''; };
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => upload(e.dataTransfer.files));
}
// Cegah browser membuka file bila terlepas di luar kotak drop.
['dragover', 'drop'].forEach(ev => window.addEventListener(ev, e => { if (!e.target.closest || !e.target.closest('#drop')) e.preventDefault(); }));

/* ---------- mulai ---------- */
syncModes();
loadAll();
})();
