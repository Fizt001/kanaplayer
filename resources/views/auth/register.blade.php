@extends('layouts.base')
@section('title', 'Daftar Akun Baru')

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
      <a href="/login" class="auth-tab">Masuk</a>
      <span class="auth-tab active">Daftar</span>
    </div>

    <form method="post" action="/register">
      @csrf

      <div class="auth-group">
        <label for="name">Nama Lengkap</label>
        <div class="auth-input-box">
          <input id="name" type="text" name="name" value="{{ old('name') }}" placeholder="Misal: Budi Santoso" required autofocus autocomplete="name">
          <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
        </div>
        @error('name')<div class="err"><span>⚠️</span> {{ $message }}</div>@enderror
      </div>

      <div class="auth-group">
        <label for="email">Alamat Email</label>
        <div class="auth-input-box">
          <input id="email" type="email" name="email" value="{{ old('email') }}" placeholder="nama@email.com" required autocomplete="email">
          <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
        </div>
        @error('email')<div class="err"><span>⚠️</span> {{ $message }}</div>@enderror
      </div>

      <div class="auth-group">
        <label for="password">Kata Sandi (Min. 8 Karakter)</label>
        <div class="auth-input-box">
          <input id="password" type="password" name="password" placeholder="••••••••" required autocomplete="new-password">
          <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        </div>
        @error('password')<div class="err"><span>⚠️</span> {{ $message }}</div>@enderror
      </div>

      <div class="auth-group">
        <label for="password_confirmation">Ulangi Kata Sandi</label>
        <div class="auth-input-box">
          <input id="password_confirmation" type="password" name="password_confirmation" placeholder="••••••••" required autocomplete="new-password">
          <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
        </div>
      </div>

      <button type="submit" class="auth-btn">
        <span>Buat Akun Sekarang</span>
        <svg style="width:18px;height:18px;fill:currentColor;" viewBox="0 0 24 24"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
      </button>
    </form>

    <div class="auth-extra-card">
      <div class="auth-extra-icon">✨</div>
      <div class="auth-extra-text">
        <b>Penyimpanan Lokal Mandiri</b><br>
        Lagu &amp; playlist tersimpan aman di perangkat Anda secara offline.
      </div>
    </div>
  </div>
</div>
@endsection

