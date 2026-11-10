@extends('layouts.base')
@section('title', 'PlayerMP3')
@push('head')
<link rel="stylesheet" href="/css/player.css?v={{ filemtime(public_path('css/player.css')) }}">
@endpush
@section('body')
{{-- Sprite ikon --}}
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></symbol>
  <symbol id="i-pause" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></symbol>
  <symbol id="i-next" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></symbol>
  <symbol id="i-prev" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></symbol>
  <symbol id="i-shuffle" viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></symbol>
  <symbol id="i-repeat" viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></symbol>
  <symbol id="i-repeat1" viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/><path d="M13 15V9h-1l-2 1v1h1.5v4z"/></symbol>
  <symbol id="i-heart" viewBox="0 0 24 24"><path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/></symbol>
  <symbol id="i-heart-on" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></symbol>
  <symbol id="i-more" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></symbol>
  <symbol id="i-search" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></symbol>
  <symbol id="i-back" viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></symbol>
  <symbol id="i-down" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></symbol>
  <symbol id="i-up" viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></symbol>
  <symbol id="i-queue" viewBox="0 0 24 24"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></symbol>
  <symbol id="i-timer" viewBox="0 0 24 24"><path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42A8.962 8.962 0 0012 4c-4.97 0-9 4.03-9 9s4.02 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></symbol>
  <symbol id="i-speed" viewBox="0 0 24 24"><path d="M20.38 8.57l-1.23 1.85a8 8 0 01-.22 7.58H5.07A8 8 0 0115.58 6.85l1.85-1.23A10 10 0 003.35 19a2 2 0 001.72 1h13.85a2 2 0 001.74-1 10 10 0 00-.27-10.44zm-9.79 6.84a2 2 0 002.83 0l5.66-8.49-8.49 5.66a2 2 0 000 2.83z"/></symbol>
  <symbol id="i-add" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></symbol>
  <symbol id="i-close" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></symbol>
  <symbol id="i-note" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></symbol>
  {{-- Ikon Navigasi Utama --}}
  <symbol id="i-music" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></symbol>
  <symbol id="i-playlist" viewBox="0 0 24 24"><path d="M3 10h11v2H3v-2zm0-4h11v2H3V6zm0 8h7v2H3v-2zm13-1v8l6-4-6-4z"/></symbol>
  <symbol id="i-user" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></symbol>
  <symbol id="i-settings" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></symbol>
  <symbol id="i-copy" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></symbol>
  <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></symbol>
  <symbol id="i-lyrics" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></symbol>
  <symbol id="i-edit" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></symbol>
  <symbol id="i-cloud" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></symbol>
  <symbol id="i-device" viewBox="0 0 24 24"><path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14zm-5 2c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></symbol>
  <symbol id="i-folder" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></symbol>
  <symbol id="i-chevron" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></symbol>
  <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></symbol>
  <symbol id="i-logout" viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></symbol>
</svg>

<div class="pm-app">
  {{-- Sidebar Navigasi (Mode Desktop) --}}
  <aside class="sidebar">
    <div class="sb-brand">
      <div class="logo-icon"><svg class="ic"><use href="#i-music"/></svg></div>
      <div class="logo-text">
        <b>PlayerMP3</b>
        <span>Web Audio Player</span>
      </div>
    </div>

    <nav class="sb-nav">
      <div class="sb-section-title">Sumber Musik</div>
      <button class="sb-link on" data-act="nav" data-nav="music">
        <svg class="ic"><use href="#i-cloud"/></svg>
        <span>Musik Cloud (Server)</span>
      </button>
      <button class="sb-link" data-act="nav" data-nav="device">
        <svg class="ic"><use href="#i-device"/></svg>
        <span>Musik Perangkat</span>
      </button>

      <div class="sb-section-title" style="margin-top:16px;">Koleksi & Akun</div>
      <button class="sb-link" data-act="nav" data-nav="playlists">
        <svg class="ic"><use href="#i-playlist"/></svg>
        <span>Playlist</span>
      </button>
      <button class="sb-link" data-act="nav" data-nav="account">
        <svg class="ic"><use href="#i-user"/></svg>
        <span>Setting Akun</span>
      </button>

      <div class="sb-section-title" style="margin-top:16px;">Aksi Cepat</div>
      <button class="sb-link ghost" data-act="newpl">
        <svg class="ic"><use href="#i-add"/></svg>
        <span>Buat Playlist</span>
      </button>
      @if(auth()->user()->is_admin)
      <a class="sb-link ghost" href="/admin">
        <svg class="ic"><use href="#i-shield"/></svg>
        <span>Manajer Member</span>
      </a>
      @endif
    </nav>

    <div class="sb-user">
      <div class="sb-user-card" data-act="nav" data-nav="account">
        <div class="u-avatar">{{ strtoupper(substr(auth()->user()->name, 0, 1)) }}</div>
        <div class="u-info">
          <b>{{ auth()->user()->name }}</b>
          <span class="mut">{{ auth()->user()->member_code }}</span>
        </div>
        <span class="chip {{ auth()->user()->isPremium() ? 'prem' : '' }}" id="sb-chip">
          {{ auth()->user()->is_admin ? 'Admin' : (auth()->user()->isPremium() ? 'Premium' : 'Free') }}
        </span>
      </div>
    </div>
  </aside>

  {{-- Area Konten Utama --}}
  <div class="main-pane">
    <header id="top">
      <div class="bar">
        <button class="ib" data-act="back" id="btn-back" hidden aria-label="Kembali"><svg class="ic"><use href="#i-back"/></svg></button>
        <h1 id="title">Putar Musik</h1>
        <button class="ib" data-act="search" id="btn-search" aria-label="Cari"><svg class="ic"><use href="#i-search"/></svg></button>
        <button class="chip" id="chip" data-act="nav" data-nav="account">...</button>
        <button class="ib" data-act="topmenu" aria-label="Menu"><svg class="ic"><use href="#i-more"/></svg></button>
      </div>

      <div id="sb" hidden><input id="q" type="search" placeholder="Cari lagu, album, artis, genre..." autocomplete="off"></div>

      {{-- Sub-tab Musik (Hanya tampil saat di menu Putar Musik dan tidak sedang di halaman detail) --}}
      <nav id="music-tabs">
        <button class="tab on" data-act="tab" data-tab="tracks">Lagu</button>
        <button class="tab" data-act="tab" data-tab="albums">Album</button>
        <button class="tab" data-act="tab" data-tab="artists">Artis</button>
        <button class="tab" data-act="tab" data-tab="genres">Genre</button>
      </nav>
    </header>

    <main id="content"></main>
  </div>

  {{-- Mini Player --}}
  <div id="mini" hidden>
    <div class="prog"><i id="mprog"></i></div>
    <div class="in" data-act="open-np">
      <div class="cv" id="mcv"><svg class="ic"><use href="#i-note"/></svg></div>
      <div class="tx"><b id="mttl">-</b><span id="mart"></span></div>
      <button class="ib" data-act="toggle" aria-label="Putar/Jeda"><svg class="ic" id="mpp"><use href="#i-play"/></svg></button>
      <button class="ib" data-act="next" aria-label="Berikutnya"><svg class="ic"><use href="#i-next"/></svg></button>
    </div>
  </div>

  {{-- Bottom Navigation Bar (Mode Mobile - Layaknya Tampilan Android) --}}
  <nav class="bottom-nav">
    <button class="bnav-btn on" data-act="nav" data-nav="music">
      <div class="bnav-icon"><svg class="ic"><use href="#i-cloud"/></svg></div>
      <span class="bnav-label">Cloud</span>
    </button>
    <button class="bnav-btn" data-act="nav" data-nav="device">
      <div class="bnav-icon"><svg class="ic"><use href="#i-device"/></svg></div>
      <span class="bnav-label">Perangkat</span>
    </button>
    <button class="bnav-btn" data-act="nav" data-nav="playlists">
      <div class="bnav-icon"><svg class="ic"><use href="#i-playlist"/></svg></div>
      <span class="bnav-label">Playlist</span>
    </button>
    <button class="bnav-btn" data-act="nav" data-nav="account">
      <div class="bnav-icon"><svg class="ic"><use href="#i-user"/></svg></div>
      <span class="bnav-label">Akun</span>
    </button>
  </nav>

  {{-- Hidden Input Pemilih File / Folder Perangkat Lokal --}}
  <input type="file" id="local-file-picker" accept="audio/*,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac" multiple hidden>
  <input type="file" id="local-folder-picker" webkitdirectory directory multiple hidden>

  {{-- Now Playing Sheet --}}
  <section id="np" aria-label="Sedang diputar">
    <div class="wrapnp">
      <div class="top">
        <button class="ib" data-act="close-np" aria-label="Tutup"><svg class="ic"><use href="#i-down"/></svg></button>
        <span id="npsrc">Sedang diputar</span>
        <button class="ib" data-act="np-menu" aria-label="Menu"><svg class="ic"><use href="#i-more"/></svg></button>
      </div>
      <div id="npcover" class="np-cover-container" data-act="toggle-lyrics" title="Ketuk untuk melihat lirik">
        <div class="cv" id="bigcv"><svg class="ic"><use href="#i-note"/></svg></div>
        <div id="nplyrics" class="np-lyrics-overlay">
          <div class="lyrics-header">
            <span>LIRIK LAGU</span>
            <button type="button" class="pill ghost" data-act="toggle-lyrics" style="padding:4px 10px;font-size:11px;">Tutup</button>
          </div>
          <div id="lyrics-text" class="lyrics-content"></div>
        </div>
      </div>
      <div class="meta">
        <div class="tx"><b id="nttl">-</b><span id="nart"></span></div>
        <button class="ib" data-act="fav" id="nfav" aria-label="Favorit"><svg class="ic"><use href="#i-heart"/></svg></button>
      </div>
      <div class="seekrow">
        <input id="seek" type="range" min="0" max="1000" value="0">
        <div class="times"><span id="tcur">0:00</span><span id="tdur">0:00</span></div>
      </div>
      <div class="ctl">
        <button class="ib" data-act="shuffle" id="bshuf" aria-label="Acak"><svg class="ic"><use href="#i-shuffle"/></svg></button>
        <button class="ib" data-act="prev" aria-label="Sebelumnya"><svg class="ic"><use href="#i-prev"/></svg></button>
        <button class="ib play" data-act="toggle" aria-label="Putar/Jeda"><svg class="ic" id="npp"><use href="#i-play"/></svg></button>
        <button class="ib" data-act="next" aria-label="Berikutnya"><svg class="ic"><use href="#i-next"/></svg></button>
        <button class="ib" data-act="repeat" id="brep" aria-label="Ulangi"><svg class="ic" id="irep"><use href="#i-repeat"/></svg></button>
      </div>
      <div class="sub-ctl">
        <button class="ib" data-act="toggle-lyrics" id="blyr" aria-label="Lirik"><svg class="ic"><use href="#i-lyrics"/></svg><span>Lirik</span></button>
        <button class="ib" data-act="speed" id="bspd"><svg class="ic"><use href="#i-speed"/></svg><span id="lspd">1x</span></button>
        <button class="ib" data-act="sleep" id="bslp"><svg class="ic"><use href="#i-timer"/></svg><span id="lslp">Timer</span></button>
        <button class="ib" data-act="queue"><svg class="ic"><use href="#i-queue"/></svg><span>Antrean</span></button>
      </div>
    </div>
  </section>

  {{-- Antrean --}}
  <section id="queue" aria-label="Antrean">
    <div class="hd">
      <h2>Antrean</h2>
      <button class="lnk" data-act="qclear">Kosongkan</button>
      <button class="ib" data-act="qclose" aria-label="Tutup"><svg class="ic"><use href="#i-close"/></svg></button>
    </div>
    <div id="qlist"></div>
  </section>

  <div id="sheet"><div class="sh"><div class="sh-title"></div><div class="sh-list"></div></div></div>

  <div id="paywall">
    <div class="pw">
      <h2>Kuota harian habis</h2>
      <p id="pwmsg"></p>
      <p>ID member Anda:</p>
      <div class="id" id="pwid"></div>
      <p id="pwinfo"></p>
      <div class="row2">
        <button class="pill" data-act="copyid">Salin ID</button>
        <button class="pill acc" data-act="pwclose">Tutup</button>
      </div>
    </div>
  </div>

  {{-- Modal Dialog Form (Create / Rename Playlist) --}}
  <div id="dlg-form" class="dlg-backdrop">
    <div class="dlg-box">
      <div class="dlg-header">
        <div class="dlg-icon"><svg class="ic"><use href="#i-playlist"/></svg></div>
        <div>
          <h3 id="dlg-form-title">Buat Playlist Baru</h3>
          <span class="mut" id="dlg-form-desc">Beri nama untuk playlist Anda</span>
        </div>
      </div>
      <form id="dlg-form-body" onsubmit="return false;">
        <div class="dlg-input-wrap">
          <label for="dlg-input" id="dlg-label">Nama Playlist</label>
          <input id="dlg-input" type="text" maxlength="80" autocomplete="off" placeholder="Misal: Santai Sore, Mood Booster, Hits...">
        </div>
        <div class="dlg-actions">
          <button type="button" class="pill ghost" data-act="dlg-cancel">Batal</button>
          <button type="submit" class="pill acc" id="dlg-form-submit">Buat Playlist</button>
        </div>
      </form>
    </div>
  </div>

  {{-- Modal Konfirmasi Kustom (Hapus Lagu / Playlist / Logout) --}}
  <div id="dlg-confirm" class="dlg-backdrop">
    <div class="dlg-box">
      <div class="dlg-header">
        <div class="dlg-icon danger" id="dlg-conf-icon"><svg class="ic"><use href="#i-close"/></svg></div>
        <div>
          <h3 id="dlg-conf-title">Konfirmasi</h3>
          <span class="mut" id="dlg-conf-desc">Apakah Anda yakin?</span>
        </div>
      </div>
      <div class="dlg-actions">
        <button type="button" class="pill ghost" data-act="dlg-conf-cancel">Batal</button>
        <button type="button" class="pill danger" id="dlg-conf-ok">Lanjutkan</button>
      </div>
    </div>
  </div>

  {{-- Modal Edit Metadata Track (Admin) --}}
  <div id="dlg-edit-track" class="dlg-backdrop">
    <div class="dlg-box" style="max-width: 480px; max-height: 90vh; overflow-y: auto;">
      <div class="dlg-header">
        <div class="dlg-icon"><svg class="ic"><use href="#i-edit"/></svg></div>
        <div>
          <h3>Edit Info Lagu</h3>
          <span class="mut">Perbarui judul, artis, album, genre, dan lirik</span>
        </div>
      </div>
      <form id="dlg-edit-form">
        <input type="hidden" id="ed-id">
        <div class="dlg-input-wrap">
          <label for="ed-title">Judul Lagu *</label>
          <input id="ed-title" required autocomplete="off">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="dlg-input-wrap">
            <label for="ed-artist">Artis</label>
            <input id="ed-artist" autocomplete="off">
          </div>
          <div class="dlg-input-wrap">
            <label for="ed-album">Album</label>
            <input id="ed-album" autocomplete="off">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="dlg-input-wrap">
            <label for="ed-genre">Genre</label>
            <input id="ed-genre" autocomplete="off">
          </div>
          <div class="dlg-input-wrap">
            <label for="ed-trackno">No. Trek</label>
            <input id="ed-trackno" type="number" min="0" max="65535" autocomplete="off">
          </div>
        </div>
        <div class="dlg-input-wrap">
          <label for="ed-lyrics">Lirik Lagu</label>
          <textarea id="ed-lyrics" rows="5" placeholder="Tuliskan lirik lagu di sini..."></textarea>
        </div>
        <div class="dlg-actions">
          <button type="button" class="pill ghost" data-act="dlg-edit-cancel">Batal</button>
          <button type="submit" class="pill acc">Simpan Perubahan</button>
        </div>
      </form>
    </div>
  </div>

  <div id="toast"></div>
  <audio id="au" preload="none"></audio>
  <form id="logout" method="post" action="/logout">@csrf</form>
</div>

<script>window.PM = { admin: @json((bool) auth()->user()->is_admin), uid: {{ (int) auth()->id() }} };</script>
<script src="/js/player.js?v={{ filemtime(public_path('js/player.js')) }}"></script>
@endsection
