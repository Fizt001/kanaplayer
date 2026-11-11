@extends('layouts.base')
@section('title', 'Masuk')

@section('body')
<div class="auth-wrapper">
  <div class="auth-brand">
    <div class="auth-logo">
      <img src="/icons/icon-192.png" alt="KanaPlayer Logo">
    </div>
    <h1>KanaPlayer</h1>
    <p>Offline &amp; Modern Media Player</p>
  </div>

  <div class="auth-card">
    <div class="auth-tabs">
      <span class="auth-tab active">Masuk</span>
      <a href="/register" class="auth-tab">Daftar</a>
    </div>

    <form method="post" action="/login">
      @csrf

      <div class="auth-group">
        <label for="email">Alamat Email</label>
        <div class="auth-input-box">
          <input id="email" type="email" name="email" value="{{ old('email') }}" placeholder="nama@email.com" required autofocus autocomplete="email">
          <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
        </div>
        @error('email')<div class="err"><span>⚠️</span> {{ $message }}</div>@enderror
      </div>

      <div class="auth-group">
        <label for="password">Kata Sandi</label>
        <div class="auth-input-box">
          <input id="password" type="password" name="password" placeholder="••••••••" required autocomplete="current-password">
          <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        </div>
        @error('password')<div class="err"><span>⚠️</span> {{ $message }}</div>@enderror
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
        <label style="display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-size:13px; color:var(--mut); margin:0; text-transform:none; letter-spacing:normal;">
          <input type="checkbox" name="remember" style="accent-color:var(--acc); width:16px; height:16px; border-radius:4px; cursor:pointer;">
          <span>Ingat saya</span>
        </label>
      </div>

      <button type="submit" class="auth-btn">
        <span>Masuk ke Pemutar</span>
        <svg style="width:18px;height:18px;fill:currentColor;" viewBox="0 0 24 24"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
      </button>
    </form>

    <div class="auth-extra-card">
      <div class="auth-extra-icon">🎵</div>
      <div class="auth-extra-text">
        <b>100% Offline Ready</b><br>
        Putar &amp; kelola koleksi musik dari penyimpanan perangkat Anda tanpa batas kuota.
      </div>
    </div>
  </div>
</div>
@endsection

