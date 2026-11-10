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
</svg>

<div class="pm">
  <div id="app">
    <div id="top">
      <div class="bar">
        <button class="ib" data-act="back" id="btn-back" hidden aria-label="Kembali"><svg class="ic"><use href="#i-back"/></svg></button>
        <h1 id="title">PlayerMP3</h1>
        <button class="ib" data-act="search" aria-label="Cari"><svg class="ic"><use href="#i-search"/></svg></button>
        <button class="chip" id="chip" data-act="quota">...</button>
        <button class="ib" data-act="topmenu" aria-label="Menu"><svg class="ic"><use href="#i-more"/></svg></button>
      </div>
      <div id="sb" hidden><input id="q" type="search" placeholder="Cari lagu, album, artis..." autocomplete="off"></div>
      <nav id="tabs">
        <button class="tab" data-act="tab" data-tab="playlists">Playlist</button>
        <button class="tab on" data-act="tab" data-tab="tracks">Lagu</button>
        <button class="tab" data-act="tab" data-tab="albums">Album</button>
        <button class="tab" data-act="tab" data-tab="artists">Artis</button>
        <button class="tab" data-act="tab" data-tab="genres">Genre</button>
      </nav>
    </div>
    <main id="content"></main>
  </div>

  {{-- Mini player --}}
  <div id="mini" hidden>
    <div class="prog"><i id="mprog"></i></div>
    <div class="in" data-act="open-np">
      <div class="cv" id="mcv"><svg class="ic"><use href="#i-note"/></svg></div>
      <div class="tx"><b id="mttl">-</b><span id="mart"></span></div>
      <button class="ib" data-act="toggle" aria-label="Putar/Jeda"><svg class="ic" id="mpp"><use href="#i-play"/></svg></button>
      <button class="ib" data-act="next" aria-label="Berikutnya"><svg class="ic"><use href="#i-next"/></svg></button>
    </div>
  </div>

  {{-- Now Playing --}}
  <section id="np" aria-label="Sedang diputar">
    <div class="wrapnp">
      <div class="top">
        <button class="ib" data-act="close-np" aria-label="Tutup"><svg class="ic"><use href="#i-down"/></svg></button>
        <span id="npsrc">Sedang diputar</span>
        <button class="ib" data-act="np-menu" aria-label="Menu"><svg class="ic"><use href="#i-more"/></svg></button>
      </div>
      <div class="cv" id="bigcv"><svg class="ic"><use href="#i-note"/></svg></div>
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

  <div id="toast"></div>
  <audio id="au" preload="none"></audio>
  <form id="logout" method="post" action="/logout">@csrf</form>
</div>

<script>window.PM = { admin: @json((bool) auth()->user()->is_admin), uid: {{ (int) auth()->id() }} };</script>
<script src="/js/player.js?v={{ filemtime(public_path('js/player.js')) }}"></script>
@endsection
