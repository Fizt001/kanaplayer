(() => {
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const csrf = document.querySelector('meta[name=csrf-token]').content;
const IS_ADMIN = window.PM.admin;
const au = $('#au');

const S = {
  tracks: [], byId: new Map(), playlists: [], me: null,
  localTracks: [],                  // lagu offline / lokal dari perangkat pengguna
  nav: 'music',                     // 'music' | 'device' | 'playlists' | 'account'
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
const cur = () => S.byId.get(S.queue[S.qi]) || S.localTracks.find(x => x.id === S.queue[S.qi]);

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

/* ---------- local device storage (IndexedDB) ---------- */
const DB_NAME = 'PlayerMP3_DeviceStorage';
const DB_VERSION = 1;
const STORE_NAME = 'tracks';

function openDeviceDB() {
  return new Promise(resolve => {
    if (!window.indexedDB) return resolve(null);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => { console.warn('IndexedDB error', e); resolve(null); };
  });
}

async function loadLocalTracks() {
  try {
    const db = await openDeviceDB();
    if (!db) return [];
    return new Promise(resolve => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        S.localTracks = req.result || [];
        resolve(S.localTracks);
      };
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
}

async function saveLocalTrack(track) {
  try {
    const db = await openDeviceDB();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(track);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {}
}

async function deleteLocalTrack(id) {
  try {
    const db = await openDeviceDB();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {}
}

async function clearAllLocalTracks() {
  try {
    const db = await openDeviceDB();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {}
}

function getAudioDuration(file) {
  return new Promise(resolve => {
    const tempAu = document.createElement('audio');
    const url = URL.createObjectURL(file);
    tempAu.preload = 'metadata';
    tempAu.src = url;
    tempAu.onloadedmetadata = () => {
      const d = tempAu.duration;
      URL.revokeObjectURL(url);
      resolve(isFinite(d) ? Math.round(d) : 0);
    };
    tempAu.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
  });
}

async function addLocalFiles(fileList) {
  const files = [...fileList].filter(f => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|ogg|opus|wav|flac)$/i.test(f.name));
  if (!files.length) return toast('Tidak ada file audio yang cocok.');
  toast(`Memproses ${files.length} lagu dari perangkat...`);
  let count = 0;
  for (const f of files) {
    const id = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    let clean = f.name.replace(/\.[^/.]+$/, '');
    let artist = 'Perangkat Lokal';
    let title = clean;
    if (clean.includes(' - ')) {
      const parts = clean.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }
    const dur = await getAudioDuration(f);
    const localTrack = {
      id,
      is_local: true,
      title: title || f.name,
      artist: artist,
      album: 'Musik Perangkat',
      duration: dur,
      size: f.size,
      blob: f,
      cover_url: null,
      created_at: new Date().toISOString(),
    };
    await saveLocalTrack(localTrack);
    S.localTracks.push(localTrack);
    count++;
  }
  toast(`${count} lagu berhasil ditambahkan dari perangkat!`);
  render();
}

/* ---------- data loading ---------- */
async function loadAll() {
  await loadLocalTracks();
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
  const on = cur() && String(cur().id) === String(t.id);
  const isLoc = t.is_local || String(t.id).startsWith('dev_');
  return `<div class="row ${on ? 'on' : ''}" data-act="play" data-id="${t.id}">
    ${coverHtml(t.cover_url)}
    <div class="tx">
      <b>${esc(t.title)}${isLoc ? '<span class="tag-local">Perangkat</span>' : ''}</b>
      <span>${esc(t.artist || 'Artis tidak diketahui')}${t.album ? ' · ' + esc(t.album) : ''}</span>
    </div>
    <span class="du">${fmt(t.duration)}</span>
    <button class="ib" data-act="${isLoc ? 'local-menu' : 'menu'}" data-id="${t.id}" aria-label="Menu">${icon('more')}</button>
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
   RENDER MENU: MUSIK PERANGKAT (Lokal IndexedDB)
   ======================================================== */
function renderDeviceView() {
  const q = S.q;
  let list = S.localTracks.filter(t => matches(q, t.title, t.artist, t.album));
  S.ctx = list.map(t => t.id);

  let h = `
  <div class="device-banner">
    <div class="device-banner-text">
      <h3>Musik di Perangkat Ini</h3>
      <p>Putar lagu dari penyimpanan HP atau Laptop Anda tanpa upload ke server. Gratis sepuasnya tanpa batas kuota.</p>
    </div>
    <div class="device-actions">
      <button class="btn-device-add" data-act="pick-local-files">
        <svg class="ic"><use href="#i-add"/></svg>
        <span>Pilih Lagu</span>
      </button>
      <button class="btn-device-folder" data-act="pick-local-folder">
        <svg class="ic"><use href="#i-folder"/></svg>
        <span>Buka Folder</span>
      </button>
    </div>
  </div>`;

  if (!S.localTracks.length) {
    return h + `
    <div class="empty" style="padding:48px 16px;text-align:center;">
      <div style="font-size:36px;margin-bottom:12px;">📁</div>
      <b style="display:block;font-size:16px;color:var(--txt);margin-bottom:6px;">Belum Ada Musik Perangkat</b>
      <p style="color:var(--mut);font-size:13px;max-width:380px;margin:0 auto 16px;line-height:1.5;">
        Klik tombol di atas untuk memilih lagu atau folder musik dari HP/Laptop Anda. Lagu akan tersimpan di browser ini dan siap diputar kapan saja!
      </p>
    </div>`;
  }

  if (!list.length) {
    return h + `<div class="empty">Tidak ada lagu perangkat yang cocok dengan pencarian.</div>`;
  }

  h += `
  <div class="tb">
    <button class="pill acc" data-act="playall">${icon('play')}Putar</button>
    <button class="pill" data-act="shuffleall">${icon('shuffle')}Acak</button>
    <span class="sp"></span>
    <span style="font-size:13px;color:var(--mut);">${list.length} lagu</span>
    <button class="ib" data-act="clear-local-music" title="Hapus semua lagu perangkat" aria-label="Hapus semua">${icon('close')}</button>
  </div>`;

  return h + list.map(trackRow).join('');
}

/* ========================================================
   RENDER MENU 2: PLAYLIST (Add Playlist & Koleksi)
   ======================================================== */
function renderPlaylistsView() {
  const q = S.q;
  let h = `
  <div class="pl-banner">
    <div class="pl-banner-text">
      <h3>Koleksi Playlist</h3>
      <p>Buat daftar putar sesuai selera dan lagu favorit Anda.</p>
    </div>
    <button class="btn-newpl" data-act="newpl">
      <svg class="ic"><use href="#i-add"/></svg>
      <span>+ Buat Playlist</span>
    </button>
  </div>`;

  const smart = [
    ['fav', 'Favorit', 'heart-on', S.tracks.filter(t => t.favorite).length, 'smart-fav'],
    ['recent', 'Terakhir diputar', 'timer', Math.min(50, S.tracks.filter(t => t.last_played_at).length), 'smart-recent'],
    ['most', 'Paling sering diputar', 'repeat', Math.min(50, S.tracks.filter(t => t.play_count > 0).length), 'smart-most'],
  ].filter(s => matches(q, s[1]));

  h += smart.map(s => `
    <div class="pl-card-row" data-act="opensmart" data-kind="${s[0]}">
      <div class="cv ${s[4]}">${icon(s[2])}</div>
      <div class="tx">
        <b>${s[1]}</b>
        <span>${s[3]} lagu</span>
      </div>
    </div>`).join('');

  const customPlaylists = S.playlists.filter(p => matches(q, p.name));
  if (customPlaylists.length) {
    h += `<div class="tb" style="margin-top:18px;margin-bottom:6px;"><span style="font-weight:700;color:var(--txt);font-size:15px;">Daftar Playlist Saya</span><span class="sp"></span><span style="font-size:13px;">${customPlaylists.length} playlist</span></div>`;
    h += customPlaylists.map(p => {
      const first = S.byId.get(p.track_ids[0]);
      const cvHtml = first && first.cover_url
        ? coverHtml(first.cover_url)
        : `<div class="cv smart-custom">${icon('playlist')}</div>`;
      return `
        <div class="pl-card-row" data-act="openpl" data-id="${p.id}">
          ${cvHtml}
          <div class="tx">
            <b>${esc(p.name)}</b>
            <span>${p.track_ids.length} lagu</span>
          </div>
          <button class="ib" data-act="plmenu-row" data-id="${p.id}" aria-label="Opsi playlist">${icon('more')}</button>
        </div>`;
    }).join('');
  } else if (!smart.length) {
    h += `<div class="empty">${q ? 'Tidak ada playlist yang cocok.' : 'Belum ada playlist.'}</div>`;
  }

  return h;
}

/* ========================================================
   RENDER MENU 3: SETTING AKUN (Samsung One UI Mobile Style)
   ======================================================== */
function renderAccountView() {
  const m = S.me || {};
  const isPrem = !!m.premium;
  const isAdmin = !!m.is_admin;
  const initial = (m.name || 'U').charAt(0).toUpperCase();
  const limit = m.limit || 5;
  const used = m.used || 0;
  const pct = isPrem ? 100 : Math.min(100, Math.round((used / limit) * 100));
  const remaining = isPrem ? 'Tanpa batas' : `${m.remaining ?? Math.max(0, limit - used)} lagu tersisa`;

  let h = `
  <div class="ac-wrap">
    {{-- Profil Hero Card (Samsung One UI Style) --}}
    <div class="ac-hero-card">
      <div class="ac-hero-top">
        <div class="ac-avatar">${esc(initial)}</div>
        <div class="ac-profile-meta">
          <div class="ac-profile-name-row">
            <h2 class="ac-user-name">${esc(m.name || 'Member')}</h2>
            <span class="ac-role-badge ${isAdmin ? 'admin' : (isPrem ? 'prem' : 'free')}">
              ${isAdmin ? '🛡️ Admin' : (isPrem ? '⭐ Premium' : 'Free Member')}
            </span>
          </div>
          <button class="ac-id-chip" data-act="copy-ac-id" title="Klik untuk salin ID Member">
            <span class="ac-id-lbl">ID Member:</span>
            <b class="ac-id-val">${esc(m.member_code || '-')}</b>
            <svg class="ic ac-copy-icon"><use href="#i-copy"/></svg>
          </button>
        </div>
      </div>

      <div class="ac-quota-box">
        <div class="ac-quota-header">
          <span>Status Kuota Harian</span>
          <b style="color:${isPrem ? '#38bdf8' : (used >= limit ? 'var(--bad)' : '#2ecc71')}">
            ${isPrem ? 'Bebas Putar (Unlimited)' : remaining}
          </b>
        </div>
        <div class="ac-quota-bar">
          <i style="width:${pct}%;background:${isPrem ? 'linear-gradient(90deg, #7c5cff, #00c6ff)' : (pct >= 100 ? 'var(--bad)' : 'linear-gradient(90deg, #7c5cff, #00c6ff)')}"></i>
        </div>
        <div class="ac-quota-footer">
          <span>${isPrem ? 'Akses penuh seluruh musik' : `Terpakai ${used} dari ${limit} lagu hari ini`}</span>
          <span>${isPrem && m.premium_until ? `s/d ${m.premium_until}` : (isPrem ? 'Aktif' : (used >= limit ? 'Batas Habis' : 'Tersedia'))}</span>
        </div>
      </div>
    </div>`;

  if (!isPrem) {
    h += `
    <div class="ac-card ac-prem-banner">
      <div class="ac-prem-top">
        <div class="ac-prem-badge">⭐ LANGGANAN PREMIUM</div>
        <span class="ac-prem-price">${esc(m.price || 'Rp 25.000 / bln')}</span>
      </div>
      <h3 class="ac-prem-title">Putar Musik Tanpa Batas</h3>
      <p class="ac-prem-desc">
        Bebas putar ribuan lagu di Cloud Server setiap hari tanpa batasan kuota.
      </p>
      <div class="ac-prem-info-box">
        <div class="ac-prem-info-row">
          <span class="mut">Info Transfer Bank:</span>
          <b>${esc(m.payment_info || 'Hubungi Admin')}</b>
        </div>
        <div class="ac-prem-info-row">
          <span class="mut">Kirimkan ID Member:</span>
          <b style="color:var(--acc);letter-spacing:0.04em;">${esc(m.member_code || '-')}</b>
        </div>
      </div>
      <button class="btn-upgrade-copy" data-act="copy-ac-id">
        <svg class="ic"><use href="#i-copy"/></svg> Salin ID Member Anda
      </button>
    </div>`;
  }

  if (IS_ADMIN) {
    h += `
    <div class="ac-group-label">PENGELOLAAN SISTEM</div>
    <div class="ac-card ac-tile-card" data-act="open-admin-panel">
      <div class="ac-tile-icon admin">
        <svg class="ic"><use href="#i-shield"/></svg>
      </div>
      <div class="ac-tile-body">
        <b>Manajer Musik & Member</b>
        <span>Kelola pengguna, aktivasi paket, dan kuota</span>
      </div>
      <div class="ac-tile-arrow">
        <svg class="ic"><use href="#i-chevron"/></svg>
      </div>
    </div>`;
  }

  h += `
    <div class="ac-group-label">PENGATURAN APLIKASI</div>
    <div class="ac-card ac-settings-group">
      <div class="ac-tile" data-act="reload-lib">
        <div class="ac-tile-icon sync">
          <svg class="ic"><use href="#i-refresh"/></svg>
        </div>
        <div class="ac-tile-body">
          <b>Muat Ulang Pustaka Musik</b>
          <span>Sinkronisasi ulang daftar lagu dan cover dari server</span>
        </div>
        <div class="ac-tile-arrow">
          <svg class="ic"><use href="#i-chevron"/></svg>
        </div>
      </div>

      <div class="ac-divider"></div>

      <div class="ac-tile info-only">
        <div class="ac-tile-icon info">
          <svg class="ic"><use href="#i-music"/></svg>
        </div>
        <div class="ac-tile-body">
          <b>Versi Aplikasi</b>
          <span>PlayerMP3 Web Audio Player (PWA)</span>
        </div>
        <span class="ac-badge-info">v1.0</span>
      </div>

      <div class="ac-divider"></div>

      <div class="ac-tile danger" data-act="logout">
        <div class="ac-tile-icon logout">
          <svg class="ic"><use href="#i-logout"/></svg>
        </div>
        <div class="ac-tile-body">
          <b class="txt-danger">Keluar dari Akun</b>
          <span>Akhiri sesi login di perangkat ini</span>
        </div>
        <div class="ac-tile-arrow danger">
          <svg class="ic"><use href="#i-chevron"/></svg>
        </div>
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

  // Sembunyikan chip status dan tombol menu titik tiga di header saat di Setting Akun agar topbar mobile bersih
  const topChip = $('#chip');
  if (topChip) topChip.hidden = (nav === 'account' && !d);
  const topMenu = $('[data-act="topmenu"]');
  if (topMenu) topMenu.hidden = (nav === 'account' && !d);

  // Title di Topbar
  const h1 = $('#title');
  if (d) {
    h1.textContent = d.title;
    h1.classList.add('sub');
  } else {
    h1.classList.remove('sub');
    if (nav === 'music') h1.textContent = 'Musik Cloud';
    else if (nav === 'device') h1.textContent = 'Musik Perangkat';
    else if (nav === 'playlists') h1.textContent = 'Playlist';
    else if (nav === 'account') h1.textContent = 'Setting Akun';
  }

  // Sub-tabs Musik (hanya muncul saat di menu Musik Cloud dan bukan sedang di halaman detail)
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
    else if (nav === 'device') $('#content').innerHTML = renderDeviceView();
    else if (nav === 'playlists') $('#content').innerHTML = renderPlaylistsView();
    else if (nav === 'account') $('#content').innerHTML = renderAccountView();
  }

  bindDrop();
  markNow();
}

function markNow() {
  const id = cur() && cur().id;
  $$('#content .row[data-act=play]').forEach(r => r.classList.toggle('on', String(r.dataset.id) === String(id)));
}

/* ========================================================
   PEMUTARAN AUDIO & KONTROL
   ======================================================== */
async function playAt(i, startPos = 0) {
  const id = S.queue[i];
  const t = S.byId.get(id) || S.localTracks.find(x => x.id === id);
  if (!t) return false;

  // Lagu dari perangkat lokal: Putar langsung via Blob URL tanpa batasan kuota server
  if (t.is_local || String(id).startsWith('dev_')) {
    if (!t.blobUrl && t.blob) {
      t.blobUrl = URL.createObjectURL(t.blob);
    }
    S.qi = i;
    au.src = t.blobUrl || '';
    au.playbackRate = S.speed;
    if (startPos > 1) au.addEventListener('loadedmetadata', () => { au.currentTime = startPos; }, {once: true});
    try { await au.play(); } catch (e) {}
    nowUI(t);
    saveState();
    markNow();
    return true;
  }

  // Lagu cloud VPS: verifikasi kuota dan stream dari server
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
  const t = S.byId.get(id) || S.localTracks.find(x => x.id === id);
  if (!t) return;
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
    const t = S.byId.get(id) || S.localTracks.find(x => x.id === id); if (!t) return;
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

  // Perbarui lirik jika jendela lirik sedang terbuka
  const lyEl = $('#nplyrics');
  if (lyEl && lyEl.classList.contains('open')) {
    const lText = $('#lyrics-text');
    if (t && t.lyrics && t.lyrics.trim()) {
      lText.textContent = t.lyrics;
      lText.classList.remove('lyrics-empty');
    } else {
      lText.innerHTML = '<span class="lyrics-empty">Lirik belum tersedia untuk lagu ini.</span>';
    }
  }

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
  if (IS_ADMIN && !t.is_local) {
    items.push({label: 'Edit Info Lagu & Lirik', fn: () => openEditTrack(t)});
    items.push({label: 'Hapus dari pustaka server', danger: true, fn: () => deleteTrack(t)});
  }
  sheet(t.title, items);
}

function localTrackMenu(t) {
  const items = [
    {label: 'Putar berikutnya', fn: () => enqueue(t.id, true)},
    {label: 'Tambah ke antrean', fn: () => enqueue(t.id, false)},
    {label: 'Hapus dari perangkat ini', danger: true, fn: async () => {
      await deleteLocalTrack(t.id);
      S.localTracks = S.localTracks.filter(x => x.id !== t.id);
      if (cur() && String(cur().id) === String(t.id)) {
        au.pause(); au.removeAttribute('src'); S.qi = -1; $('#mini').hidden = true; closeNp();
      }
      render();
      toast('Lagu dihapus dari perangkat');
    }},
  ];
  sheet(t.title, items);
}

/* Edit Metadata Track (Admin) */
function openEditTrack(t) {
  const bd = $('#dlg-edit-track');
  if (!bd) return;
  $('#ed-id').value = t.id;
  $('#ed-title').value = t.title || '';
  $('#ed-artist').value = t.artist || '';
  $('#ed-album').value = t.album || '';
  $('#ed-genre').value = t.genre || '';
  $('#ed-trackno').value = t.track_no ?? '';
  $('#ed-lyrics').value = t.lyrics || '';
  bd.classList.add('open');
  setTimeout(() => $('#ed-title').focus(), 80);
}
function closeEditTrack() {
  $('#dlg-edit-track')?.classList.remove('open');
}
$('#dlg-edit-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const id = +$('#ed-id').value;
  const payload = {
    title: $('#ed-title').value.trim(),
    artist: $('#ed-artist').value.trim() || null,
    album: $('#ed-album').value.trim() || null,
    genre: $('#ed-genre').value.trim() || null,
    track_no: $('#ed-trackno').value ? parseInt($('#ed-trackno').value, 10) : null,
    lyrics: $('#ed-lyrics').value.trim() || null,
  };
  const r = await api(`/tracks/${id}`, 'PATCH', payload);
  if (!r.ok) return toast('Gagal memperbarui lagu');
  const updated = r.data;
  const old = S.byId.get(id);
  if (old) Object.assign(old, updated);
  closeEditTrack();
  if (cur() && cur().id === id) {
    nowUI(old);
  }
  render();
  toast('Info lagu & lirik berhasil diperbarui!');
});
$('#dlg-edit-track')?.addEventListener('click', e => {
  if (e.target.id === 'dlg-edit-track') closeEditTrack();
});

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
  const findT = id => S.byId.get(id) || S.localTracks.find(x => x.id === id);
  S.queue = (st.queue || []).filter(id => !!findT(id));
  S.orig = (st.orig || []).filter(id => !!findT(id));
  S.qi = S.queue.indexOf(curId);
  syncModes();
  if (S.qi >= 0) {
    S.resume = st.pos || 0;
    const t = findT(curId);
    if (t) nowUI(t);
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
  'open-admin-panel': () => { location.href = '/admin'; },
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
  'dlg-edit-cancel': () => closeEditTrack(),
  'toggle-lyrics': () => {
    const el = $('#nplyrics');
    if (!el) return;
    const willOpen = !el.classList.contains('open');
    el.classList.toggle('open', willOpen);
    $('#blyr')?.classList.toggle('on', willOpen);
    if (willOpen) {
      const t = cur();
      const lText = $('#lyrics-text');
      if (t && t.lyrics && t.lyrics.trim()) {
        lText.textContent = t.lyrics;
        lText.classList.remove('lyrics-empty');
      } else {
        lText.innerHTML = '<span class="lyrics-empty">Lirik belum tersedia untuk lagu ini.</span>';
      }
    }
  },
  'pick-local-files': () => $('#local-file-picker')?.click(),
  'pick-local-folder': () => $('#local-folder-picker')?.click(),
  'clear-local-music': async () => {
    const ok = await confirmDialog({
      title: 'Hapus Semua Musik Perangkat?',
      desc: 'Semua daftar lagu dari perangkat ini akan dihapus dari browser. File asli di HP/Laptop Anda tetap aman.',
      okText: 'Hapus Semua',
      danger: true,
    });
    if (!ok) return;
    await clearAllLocalTracks();
    S.localTracks = [];
    render();
    toast('Semua lagu perangkat telah dibersihkan');
  },
  'local-menu': el => {
    const t = S.localTracks.find(x => x.id === el.dataset.id);
    if (t) localTrackMenu(t);
  },
  newpl: () => createPlaylist(null),
  sort: () => sheet('Urutkan lagu', [['title', 'Judul'], ['artist', 'Artis'], ['album', 'Album'], ['recent', 'Terbaru ditambahkan']]
    .map(([k, l]) => ({label: l, on: S.sort === k, fn: () => { S.sort = k; render(); }}))),
  play: el => {
    const rawId = el.dataset.id;
    const id = rawId.startsWith('dev_') ? rawId : +rawId;
    playContext(S.ctx, id);
  },
  menu: el => {
    const rawId = el.dataset.id;
    const id = rawId.startsWith('dev_') ? rawId : +rawId;
    const t = S.byId.get(id) || S.localTracks.find(x => x.id === id);
    if (t) {
      if (t.is_local) localTrackMenu(t);
      else trackMenu(t);
    }
  },
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

/* Local File / Folder Pickers */
$('#local-file-picker')?.addEventListener('change', e => {
  if (e.target.files && e.target.files.length) {
    addLocalFiles(e.target.files);
    e.target.value = '';
  }
});
$('#local-folder-picker')?.addEventListener('change', e => {
  if (e.target.files && e.target.files.length) {
    addLocalFiles(e.target.files);
    e.target.value = '';
  }
});

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
