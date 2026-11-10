(() => {
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const csrf = document.querySelector('meta[name=csrf-token]').content;
const IS_ADMIN = window.PM.admin;
const au = $('#au');

const S = {
  tracks: [], byId: new Map(), playlists: [], me: null,
  nav: 'music',                     // 'music' | 'playlists' | 'account'
  tab: 'tracks',                    // sub-tab musik: 'tracks' | 'albums' | 'artists' | 'genres'
  detail: null,                     // { kind: 'album'|'artist'|'genre'|'playlist'|'fav'|'recent'|'most', key, title }
  q: '', sort: 'title',
  groups: [],                       // cache grup album/artis/genre
  ctx: [],                          // id lagu pada daftar aktif
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
  const el = $('#toast'); if (!el) return;
  el.textContent = msg; el.classList.add('show');
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
  if (!el) return;
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

/* ---------- custom dialog modals (pengganti prompt & confirm) ---------- */
let dlgResolve = null;
function promptDialog({ title = 'Buat Playlist', desc = '', label = 'Nama Playlist', placeholder = '', initialValue = '', submitText = 'Simpan' }) {
  return new Promise(resolve => {
    dlgResolve = resolve;
    const bd = $('#dlg-form');
    if (!bd) return resolve(null);
    $('#dlg-form-title').textContent = title;
    $('#dlg-form-desc').textContent = desc;
    $('#dlg-label').textContent = label;
    const input = $('#dlg-input');
    input.placeholder = placeholder;
    input.value = initialValue;
    $('#dlg-form-submit').textContent = submitText;
    bd.classList.add('open');
    setTimeout(() => { input.focus(); input.select(); }, 80);
  });
}

function closePromptDialog(val = null) {
  const bd = $('#dlg-form');
  if (bd) bd.classList.remove('open');
  if (dlgResolve) {
    const fn = dlgResolve;
    dlgResolve = null;
    fn(val);
  }
}

let confResolve = null;
function confirmDialog({ title = 'Konfirmasi', desc = 'Apakah Anda yakin?', okText = 'Lanjutkan', danger = true }) {
  return new Promise(resolve => {
    confResolve = resolve;
    const bd = $('#dlg-confirm');
    if (!bd) return resolve(false);
    $('#dlg-conf-title').textContent = title;
    $('#dlg-conf-desc').textContent = desc;
    const btnOk = $('#dlg-conf-ok');
    btnOk.textContent = okText;
    btnOk.className = 'pill ' + (danger ? 'danger' : 'acc');
    const iconEl = $('#dlg-conf-icon');
    if (iconEl) iconEl.className = 'dlg-icon ' + (danger ? 'danger' : '');
    bd.classList.add('open');
  });
}

function closeConfirmDialog(ok = false) {
  const bd = $('#dlg-confirm');
  if (bd) bd.classList.remove('open');
  if (confResolve) {
    const fn = confResolve;
    confResolve = null;
    fn(ok);
  }
}

// Handler form dialog & backdrop
$('#dlg-form-body')?.addEventListener('submit', e => {
  e.preventDefault();
  const v = ($('#dlg-input').value || '').trim();
  closePromptDialog(v || null);
});
$('#dlg-form')?.addEventListener('click', e => {
  if (e.target.id === 'dlg-form') closePromptDialog(null);
});
$('#dlg-conf-ok')?.addEventListener('click', () => closeConfirmDialog(true));
$('#dlg-confirm')?.addEventListener('click', e => {
  if (e.target.id === 'dlg-confirm') closeConfirmDialog(false);
});

/* ---------- data loading ---------- */
async function loadAll() {
  const [t, p, m] = await Promise.all([api('/tracks'), api('/playlists'), api('/me')]);
  S.tracks = Array.isArray(t.data) ? t.data : [];
  S.byId = new Map(S.tracks.map(x => [x.id, x]));
  S.playlists = Array.isArray(p.data) ? p.data : [];
  S.me = m.data;
  renderMe();
  render();
  restoreState();
}
async function reloadTracks() {
  const t = await api('/tracks');
  S.tracks = Array.isArray(t.data) ? t.data : S.tracks;
  S.byId = new Map(S.tracks.map(x => [x.id, x]));
  render();
}

function renderMe() {
  const m = S.me; if (!m) return;
  const chipText = m.premium ? (m.is_admin ? 'Admin' : 'Premium') : `Free ${m.used}/${m.limit}`;
  const chip = $('#chip');
  if (chip) {
    chip.textContent = chipText;
    chip.classList.toggle('prem', !!m.premium);
  }
  const sbChip = $('#sb-chip');
  if (sbChip) {
    sbChip.textContent = chipText;
    sbChip.classList.toggle('prem', !!m.premium);
  }
}

/* ---------- data filtering & sorting ---------- */
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

function trackRow(t) {
  const on = cur() && cur().id === t.id;
  return `<div class="row ${on ? 'on' : ''}" data-act="play" data-id="${t.id}">
    ${coverHtml(t.cover_url)}
    <div class="tx"><b>${esc(t.title)}</b><span>${esc(t.artist || 'Artis tidak diketahui')}${t.album ? ' · ' + esc(t.album) : ''}</span></div>
    <span class="du">${fmt(t.duration)}</span>
    <button class="ib" data-act="menu" data-id="${t.id}" aria-label="Menu">${icon('more')}</button>
  </div>`;
}

/* ========================================================
   RENDER MENU 1: PUTAR MUSIK (Sub-tab Lagu, Album, Artis, Genre)
   ======================================================== */
function renderMusicView() {
  const q = S.q, tab = S.tab;
  S.groups = [];

  if (tab === 'tracks') {
    const list = sortTracks(S.tracks.filter(t => matches(q, t.title, t.artist, t.album, t.genre)));
    S.ctx = list.map(t => t.id);
    const labels = {title: 'Judul', artist: 'Artis', album: 'Album', recent: 'Terbaru'};
    let h = '';
    if (IS_ADMIN && !q) {
      h += `<div id="drop">Seret &amp; lepas file audio ke sini, atau klik untuk memilih
        <input id="file" type="file" accept="audio/*,.flac,.m4a,.opus" multiple hidden><div id="up"></div></div>`;
    }
    if (!list.length) return h + `<div class="empty">${q ? 'Tidak ada lagu yang cocok.' : 'Pustaka musik masih kosong. Tambahkan lagu dengan drag & drop.'}</div>`;
    h += `<div class="tb"><button class="pill acc" data-act="playall">${icon('play')}Putar</button>
      <button class="pill" data-act="shuffleall">${icon('shuffle')}Acak</button><span class="sp"></span>
      <button class="lnk" data-act="sort">${list.length} lagu · ${labels[S.sort]} ▾</button></div>`;
    return h + list.map(trackRow).join('');
  }

  if (tab === 'albums') {
    const gs = groupBy(S.tracks, t => t.album).filter(g => matches(q, g.key || 'Tanpa album', g.tracks.map(t => t.artist).join(' ')))
      .sort((a, b) => cmp(a.key || '\uffff', b.key || '\uffff'));
    S.groups = gs;
    if (!gs.length) return `<div class="empty">${q ? 'Tidak ada album yang cocok.' : 'Belum ada album.'}</div>`;
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
    if (!gs.length) return `<div class="empty">${q ? 'Tidak ada hasil.' : (isA ? 'Belum ada artis.' : 'Belum ada genre.')}</div>`;
    return gs.map((g, i) => {
      const cv = (g.tracks.find(t => t.cover_url) || {}).cover_url;
      return `<div class="row ${isA ? 'round' : ''}" data-act="open" data-kind="${isA ? 'artist' : 'genre'}" data-i="${i}">${coverHtml(cv)}
        <div class="tx"><b>${esc(g.key || 'Tidak diketahui')}</b><span>${g.tracks.length} lagu</span></div></div>`;
    }).join('');
  }
  return '';
}

/* ========================================================
   RENDER MENU 2: PLAYLIST (Add Playlist & Koleksi)
   ======================================================== */
function renderPlaylistsView() {
  const q = S.q;
  let h = `
  <div class="pl-banner">
    <div>
      <h3>Koleksi Playlist</h3>
      <p>Buat daftar putar sesuai selera dan lagu favorit Anda.</p>
    </div>
    <button class="pill acc" data-act="newpl">
      <svg class="ic"><use href="#i-add"/></svg> Buat Playlist
    </button>
  </div>`;

  const smart = [
    ['fav', 'Favorit', 'heart-on', S.tracks.filter(t => t.favorite).length],
    ['recent', 'Terakhir diputar', 'timer', Math.min(50, S.tracks.filter(t => t.last_played_at).length)],
    ['most', 'Paling sering diputar', 'repeat', Math.min(50, S.tracks.filter(t => t.play_count > 0).length)],
  ].filter(s => matches(q, s[1]));

  h += smart.map(s => `<div class="row" data-act="opensmart" data-kind="${s[0]}">
      <div class="cv">${icon(s[2])}</div><div class="tx"><b>${s[1]}</b><span>${s[3]} lagu</span></div></div>`).join('');

  const customPlaylists = S.playlists.filter(p => matches(q, p.name));
  if (customPlaylists.length) {
    h += `<div class="tb" style="margin-top:14px;"><span style="font-weight:700;color:var(--txt);">Daftar Playlist Saya</span><span class="sp"></span><span>${customPlaylists.length} playlist</span></div>`;
    h += customPlaylists.map(p => {
      const first = S.byId.get(p.track_ids[0]);
      return `<div class="row" data-act="openpl" data-id="${p.id}">${coverHtml(first && first.cover_url)}
        <div class="tx"><b>${esc(p.name)}</b><span>${p.track_ids.length} lagu</span></div>
        <button class="ib" data-act="plmenu-row" data-id="${p.id}" aria-label="Opsi playlist">${icon('more')}</button>
      </div>`;
    }).join('');
  } else if (!smart.length) {
    h += `<div class="empty">${q ? 'Tidak ada playlist yang cocok.' : 'Belum ada playlist.'}</div>`;
  }

  return h;
}

/* ========================================================
   RENDER MENU 3: SETTING AKUN
   ======================================================== */
function renderAccountView() {
  const m = S.me || {};
  const isPrem = !!m.premium;
  const isAdmin = !!m.is_admin;
  const initial = (m.name || 'U').charAt(0).toUpperCase();
  const limit = m.limit || 5;
  const used = m.used || 0;
  const pct = isPrem ? 100 : Math.min(100, Math.round((used / limit) * 100));
  const remaining = isPrem ? 'Tanpa batas' : `${m.remaining ?? Math.max(0, limit - used)} lagu lagi`;

  let h = `
  <div class="ac-wrap">
    <div class="ac-card">
      <div class="ac-header">
        <div class="ac-avatar">${esc(initial)}</div>
        <div class="ac-title">
          <b>${esc(m.name || 'Member')}</b>
          <span>${esc(m.member_code || '-')}</span>
        </div>
      </div>

      <div class="ac-id-badge">
        <span style="font-size:12px;color:var(--mut);">ID Member:</span>
        <b id="ac-mcode">${esc(m.member_code || '-')}</b>
        <button class="ib" data-act="copy-ac-id" title="Salin ID Member" style="width:30px;height:30px;"><svg class="ic" style="width:16px;height:16px;"><use href="#i-copy"/></svg></button>
      </div>

      <div class="ac-quota-box">
        <div class="ac-quota-info">
          <span>Paket: <b style="color:${isPrem ? '#b9a8ff' : '#2ecc71'}">${isAdmin ? 'Admin (Full Akses)' : (isPrem ? 'Premium' : 'Free Member')}</b></span>
          <span>${isPrem && m.premium_until ? `s/d ${m.premium_until}` : `Sisa: ${remaining}`}</span>
        </div>
        <div class="ac-quota-bar"><i style="width:${pct}%;background:${isPrem ? 'var(--acc)' : (pct >= 100 ? 'var(--bad)' : 'var(--acc)')}"></i></div>
        <div class="ac-quota-info">
          <span>${isPrem ? 'Bebas putar sepuasnya' : `Terpakai ${used} dari ${limit} lagu hari ini`}</span>
          <span>${isPrem ? 'Aktif' : (used >= limit ? 'Batas Habis' : 'Tersedia')}</span>
        </div>
      </div>
    </div>`;

  if (!isPrem) {
    h += `
    <div class="ac-card">
      <h3 class="ac-section-title">Langganan Musik Premium</h3>
      <p style="color:var(--mut);font-size:13px;margin:0 0 12px;line-height:1.5;">
        Dapatkan akses putar lagu sepuasnya tanpa batasan kuota harian. Lakukan transfer dan kirimkan ID member Anda ke pengelola.
      </p>
      <div style="background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:14px;font-size:13px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span class="mut">Tarif Langganan:</span>
          <b>${esc(m.price || 'Rp 25.000 / bulan')}</b>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span class="mut">Info Transfer:</span>
          <b>${esc(m.payment_info || 'Hubungi Admin')}</b>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span class="mut">ID Member Anda:</span>
          <b style="color:var(--acc);letter-spacing:0.04em;">${esc(m.member_code || '-')}</b>
        </div>
      </div>
      <button class="pill acc" data-act="copy-ac-id" style="width:100%;justify-content:center;padding:11px;">
        <svg class="ic"><use href="#i-copy"/></svg> Salin ID Member Anda
      </button>
    </div>`;
  }

  if (IS_ADMIN) {
    h += `
    <div class="ac-card">
      <h3 class="ac-section-title">Manajer Musik & Member (Admin)</h3>
      <p style="color:var(--mut);font-size:13px;margin:0 0 12px;">
        Buka panel manajer untuk mengaktifkan status premium member berdasarkan ID member, serta kelola pengguna.
      </p>
      <div class="ac-btn-row">
        <a class="pill acc" href="/admin">
          <svg class="ic"><use href="#i-shield"/></svg> Buka Manajer Member
        </a>
      </div>
    </div>`;
  }

  h += `
    <div class="ac-card">
      <h3 class="ac-section-title">Pengaturan Aplikasi</h3>
      <div class="ac-btn-row">
        <button class="pill" data-act="reload-lib">
          <svg class="ic"><use href="#i-speed"/></svg> Muat Ulang Pustaka
        </button>
        <button class="pill" data-act="logout" style="color:var(--bad);">
          <svg class="ic"><use href="#i-close"/></svg> Keluar (Logout)
        </button>
      </div>
    </div>
  </div>`;

  return h;
}

/* ========================================================
   RENDER DETAIL (Album, Artist, Genre, Playlist)
   ======================================================== */
function renderDetail() {
  const d = S.detail, list = detailTracks(d);
  S.ctx = list.map(t => t.id);
  let h = `<div class="tb">`;
  if (list.length) {
    h += `<button class="pill acc" data-act="playall">${icon('play')}Putar</button>
      <button class="pill" data-act="shuffleall">${icon('shuffle')}Acak</button>`;
  }
  h += `<span class="sp"></span><span>${list.length} lagu</span>`;
  if (d.kind === 'playlist') {
    h += `<button class="ib" data-act="plmenu" aria-label="Opsi playlist">${icon('more')}</button>`;
  }
  h += `</div>`;
  if (!list.length) {
    return h + `<div class="empty">${d.kind === 'playlist' ? 'Playlist kosong. Tambahkan lagu lewat menu ⋮ pada lagu.' : 'Belum ada lagu.'}</div>`;
  }
  return h + list.map(trackRow).join('');
}

/* ========================================================
   RENDER ROOT
   ======================================================== */
function render() {
  const d = S.detail;
  const nav = S.nav;

  // Tombol Kembali
  $('#btn-back').hidden = !d;

  // Search button & search bar
  const searchBtn = $('#btn-search');
  if (searchBtn) searchBtn.hidden = (nav === 'account' && !d);
  if (nav === 'account' && !d) $('#sb').hidden = true;

  // Title di Topbar
  const h1 = $('#title');
  if (d) {
    h1.textContent = d.title;
    h1.classList.add('sub');
  } else {
    h1.classList.remove('sub');
    if (nav === 'music') h1.textContent = 'Putar Musik';
    else if (nav === 'playlists') h1.textContent = 'Playlist';
    else if (nav === 'account') h1.textContent = 'Setting Akun';
  }

  // Sub-tabs Musik (hanya muncul saat di menu Musik dan bukan sedang di halaman detail)
  const musicTabs = $('#music-tabs');
  if (musicTabs) {
    musicTabs.hidden = (nav !== 'music' || !!d);
    $$('#music-tabs .tab').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
  }

  // Sinkronisasi navigasi aktif (Sidebar Desktop & Bottom Nav Mobile)
  $$('.sb-link[data-nav]').forEach(el => el.classList.toggle('on', el.dataset.nav === nav && !d));
  $$('.bnav-btn[data-nav]').forEach(el => el.classList.toggle('on', el.dataset.nav === nav && !d));

  // Render isi konten
  if (d) {
    $('#content').innerHTML = renderDetail();
  } else {
    if (nav === 'music') $('#content').innerHTML = renderMusicView();
    else if (nav === 'playlists') $('#content').innerHTML = renderPlaylistsView();
    else if (nav === 'account') $('#content').innerHTML = renderAccountView();
  }

  bindDrop();
  markNow();
}

function markNow() {
  const id = cur() && cur().id;
  $$('#content .row[data-act=play]').forEach(r => r.classList.toggle('on', +r.dataset.id === id));
}

/* ========================================================
   PEMUTARAN AUDIO & KONTROL
   ======================================================== */
async function playAt(i, startPos = 0) {
  const id = S.queue[i], t = S.byId.get(id);
  if (!t) return false;
  const r = await api(`/tracks/${id}/play`, 'POST');
  if (r.status === 402) {
    au.pause();
    S.me = {...S.me, ...r.data};
    renderMe();
    paywall(r.data);
    return false;
  }
  if (!r.ok) { toast('Gagal memutar lagu'); return false; }
  S.me = r.data;
  renderMe();
  S.qi = i;
  au.src = t.stream_url;
  au.playbackRate = S.speed;
  if (startPos > 1) au.addEventListener('loadedmetadata', () => { au.currentTime = startPos; }, {once: true});
  try { await au.play(); } catch (e) {}
  t.play_count = (t.play_count || 0) + 1;
  t.last_played_at = new Date().toISOString();
  nowUI(t);
  saveState();
  markNow();
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

/* Sleep timer */
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

/* UI Lagu yang diputar */
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

/* Playlist Management */
function upsertPl(p) {
  const i = S.playlists.findIndex(x => x.id === p.id);
  if (i >= 0) S.playlists[i] = p; else S.playlists.push(p);
  S.playlists.sort((a, b) => cmp(a.name, b.name));
}
async function createPlaylist(thenAdd) {
  const name = await promptDialog({
    title: 'Buat Playlist Baru',
    desc: 'Beri nama untuk daftar putar lagu Anda',
    label: 'Nama Playlist',
    placeholder: 'Misal: Santai Sore, Mood Booster, Hits...',
    initialValue: '',
    submitText: 'Buat Playlist',
  });
  if (!name) return;
  const r = await api('/playlists', 'POST', {name});
  if (!r.ok) return toast('Gagal membuat playlist');
  upsertPl(r.data);
  if (thenAdd) {
    await addToPlaylist(r.data.id, thenAdd);
  } else {
    render();
    toast(`Playlist "${r.data.name}" berhasil dibuat!`);
  }
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

/* Menu lagu & opsi */
function trackMenu(t) {
  const items = [
    {label: 'Putar berikutnya', fn: () => enqueue(t.id, true)},
    {label: 'Tambah ke antrean', fn: () => enqueue(t.id, false)},
    {label: 'Tambah ke playlist', fn: () => pickPlaylist(t.id)},
    {label: t.favorite ? 'Hapus dari Favorit' : 'Tambah ke Favorit', fn: () => toggleFav(t)},
  ];
  if (S.detail && S.detail.kind === 'playlist') {
    items.push({label: 'Hapus dari playlist ini', fn: async () => {
      const r = await api(`/playlists/${S.detail.key}/tracks/${t.id}`, 'DELETE');
      if (r.ok) { upsertPl(r.data); render(); }
    }});
  }
  if (t.album) items.push({label: 'Buka album', fn: () => { S.detail = {kind: 'album', key: t.album, title: t.album}; closeNp(); render(); }});
  if (t.artist) items.push({label: 'Buka artis', fn: () => { S.detail = {kind: 'artist', key: t.artist, title: t.artist}; closeNp(); render(); }});
  if (IS_ADMIN) items.push({label: 'Hapus dari pustaka', danger: true, fn: () => deleteTrack(t)});
  sheet(t.title, items);
}

async function deleteTrack(t) {
  const ok = await confirmDialog({
    title: 'Hapus Lagu dari Pustaka?',
    desc: `Lagu "${t.title}" akan dihapus permanen dari server dan pustaka.`,
    okText: 'Hapus Lagu',
    danger: true,
  });
  if (!ok) return;
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

/* Paywall popup */
function paywall(d) {
  $('#pwmsg').textContent = d.message || 'Kuota harian habis. Upgrade ke premium untuk lanjut memutar.';
  $('#pwid').textContent = d.member_code || (S.me && S.me.member_code) || '';
  $('#pwinfo').textContent = [d.price && `Harga: ${d.price}.`, d.payment_info].filter(Boolean).join(' ');
  $('#paywall').classList.add('open');
}

/* Now Playing / Antrean modal */
function openNp() { if (S.qi >= 0) { $('#np').classList.add('open'); history.pushState({np: 1}, ''); } }
function closeNp() { $('#np').classList.remove('open'); }
window.addEventListener('popstate', () => {
  if ($('#queue').classList.contains('open')) $('#queue').classList.remove('open');
  else if ($('#np').classList.contains('open')) closeNp();
  else if (S.detail) { S.detail = null; render(); }
});

/* Local Storage State */
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

/* Event Audio */
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

/* ========================================================
   DISPATCHER AKSI KLIK (Navigasi, Sub-tab, Menu)
   ======================================================== */
const A = {
  nav: el => {
    S.nav = el.dataset.nav;
    S.detail = null;
    render();
    window.scrollTo(0, 0);
  },
  tab: el => {
    S.tab = el.dataset.tab;
    S.detail = null;
    render();
    window.scrollTo(0, 0);
  },
  back: () => {
    if (history.state && history.state.d) history.back();
    else { S.detail = null; render(); }
  },
  search: () => {
    const sb = $('#sb');
    sb.hidden = !sb.hidden;
    if (!sb.hidden) $('#q').focus();
    else { S.q = ''; $('#q').value = ''; render(); }
  },
  'copy-ac-id': () => {
    const v = (S.me && S.me.member_code) || '';
    (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject())
      .then(() => toast(`ID ${v} berhasil disalin!`), () => toast(`ID: ${v}`));
  },
  'reload-lib': () => {
    reloadTracks();
    toast('Pustaka musik dimuat ulang');
  },
  logout: async () => {
    const ok = await confirmDialog({
      title: 'Keluar dari Akun',
      desc: 'Apakah Anda yakin ingin keluar dari sesi akun PlayerMP3?',
      okText: 'Keluar',
      danger: true,
    });
    if (ok) $('#logout').submit();
  },
  topmenu: () => {
    const items = [];
    if (IS_ADMIN) items.push({label: 'Manajer Member (Admin)', fn: () => { location.href = '/admin'; }});
    items.push({label: 'Muat ulang pustaka', fn: () => { reloadTracks(); toast('Pustaka dimuat ulang'); }});
    items.push({label: 'Setting akun', fn: () => { S.nav = 'account'; S.detail = null; render(); }});
    items.push({label: 'Keluar', danger: true, fn: async () => {
      const ok = await confirmDialog({
        title: 'Keluar dari Akun',
        desc: 'Apakah Anda yakin ingin keluar dari sesi akun PlayerMP3?',
        okText: 'Keluar',
        danger: true,
      });
      if (ok) $('#logout').submit();
    }});
    sheet(S.me ? `${S.me.name} · ${S.me.member_code}` : 'Menu', items);
  },
  open: el => {
    const g = S.groups[+el.dataset.i]; if (!g) return;
    S.detail = {kind: el.dataset.kind, key: g.key, title: g.key || (el.dataset.kind === 'album' ? 'Tanpa album' : 'Tidak diketahui')};
    render(); window.scrollTo(0, 0); history.pushState({d: 1}, '');
  },
  opensmart: el => {
    const t = {fav: 'Favorit', recent: 'Terakhir diputar', most: 'Paling sering diputar'}[el.dataset.kind];
    S.detail = {kind: el.dataset.kind, key: null, title: t};
    render(); window.scrollTo(0, 0); history.pushState({d: 1}, '');
  },
  openpl: el => {
    const p = S.playlists.find(x => x.id === +el.dataset.id); if (!p) return;
    S.detail = {kind: 'playlist', key: p.id, title: p.name};
    render(); window.scrollTo(0, 0); history.pushState({d: 1}, '');
  },
  'plmenu-row': el => {
    const p = S.playlists.find(x => x.id === +el.dataset.id); if (!p) return;
    sheet(p.name, [
      {label: 'Buka playlist', fn: () => { S.detail = {kind: 'playlist', key: p.id, title: p.name}; render(); }},
      {label: 'Ganti nama', fn: async () => {
        const n = await promptDialog({
          title: 'Ubah Nama Playlist',
          desc: 'Masukkan nama baru untuk playlist ini',
          label: 'Nama Playlist',
          placeholder: 'Nama playlist...',
          initialValue: p.name,
          submitText: 'Simpan',
        });
        if (!n) return;
        const r = await api(`/playlists/${p.id}`, 'PATCH', {name: n});
        if (r.ok) { upsertPl(r.data); render(); toast('Nama playlist diperbarui'); }
      }},
      {label: 'Hapus playlist', danger: true, fn: async () => {
        const ok = await confirmDialog({
          title: 'Hapus Playlist?',
          desc: `Playlist "${p.name}" akan dihapus permanen. Lagu tetap aman di pustaka.`,
          okText: 'Hapus Playlist',
          danger: true,
        });
        if (!ok) return;
        const r = await api(`/playlists/${p.id}`, 'DELETE');
        if (r.ok) { S.playlists = S.playlists.filter(x => x.id !== p.id); render(); toast('Playlist dihapus'); }
      }},
    ]);
  },
  plmenu: () => {
    const p = S.playlists.find(x => x.id === S.detail.key); if (!p) return;
    sheet(p.name, [
      {label: 'Ganti nama', fn: async () => {
        const n = await promptDialog({
          title: 'Ubah Nama Playlist',
          desc: 'Masukkan nama baru untuk playlist ini',
          label: 'Nama Playlist',
          placeholder: 'Nama playlist...',
          initialValue: p.name,
          submitText: 'Simpan',
        });
        if (!n) return;
        const r = await api(`/playlists/${p.id}`, 'PATCH', {name: n});
        if (r.ok) { upsertPl(r.data); S.detail.title = r.data.name; render(); toast('Nama playlist diperbarui'); }
      }},
      {label: 'Hapus playlist', danger: true, fn: async () => {
        const ok = await confirmDialog({
          title: 'Hapus Playlist?',
          desc: `Playlist "${p.name}" akan dihapus permanen. Lagu tetap aman di pustaka.`,
          okText: 'Hapus Playlist',
          danger: true,
        });
        if (!ok) return;
        const r = await api(`/playlists/${p.id}`, 'DELETE');
        if (r.ok) { S.playlists = S.playlists.filter(x => x.id !== p.id); S.detail = null; render(); toast('Playlist dihapus'); }
      }},
    ]);
  },
  'dlg-cancel': () => closePromptDialog(null),
  'dlg-conf-cancel': () => closeConfirmDialog(false),
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
  copyid: () => {
    const v = $('#pwid').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject())
      .then(() => toast('ID disalin'), () => toast(v));
  },
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

/* ========================================================
   UPLOAD AUDIO (ADMIN): DRAG & DROP & MULTI-BATCH
   ======================================================== */
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
['dragover', 'drop'].forEach(ev => window.addEventListener(ev, e => { if (!e.target.closest || !e.target.closest('#drop')) e.preventDefault(); }));

/* ---------- Mulai Aplikasi ---------- */
syncModes();
loadAll();
})();
