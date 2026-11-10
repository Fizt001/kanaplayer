@extends('layouts.base')
@section('title', 'Daftar')
@section('body')
<form class="box" method="post" action="/register">
  @csrf
  <h1>Daftar</h1>
  <label>Nama</label>
  <input name="name" value="{{ old('name') }}" required autofocus>
  @error('name')<div class="err">{{ $message }}</div>@enderror
  <label>Email</label>
  <input type="email" name="email" value="{{ old('email') }}" required>
  @error('email')<div class="err">{{ $message }}</div>@enderror
  <label>Password (min. 8 karakter)</label>
  <input type="password" name="password" required>
  @error('password')<div class="err">{{ $message }}</div>@enderror
  <label>Ulangi password</label>
  <input type="password" name="password_confirmation" required>
  <button class="full">Daftar</button>
  <p class="mut">Akun gratis bisa memutar {{ config('player.free_daily_limit') }} lagu per hari.</p>
  <p class="mut" style="text-align:center">Sudah punya akun? <a href="/login">Masuk</a></p>
</form>
@endsection

