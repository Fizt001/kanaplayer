@extends('layouts.base')
@section('title', 'Masuk')
@section('body')
<form class="box" method="post" action="/login">
  @csrf
  <h1>Masuk</h1>
  <label>Email</label>
  <input type="email" name="email" value="{{ old('email') }}" required autofocus>
  @error('email')<div class="err">{{ $message }}</div>@enderror
  <label>Password</label>
  <input type="password" name="password" required>
  <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="remember" style="width:auto"> Ingat saya</label>
  <button class="full">Masuk</button>
  <p class="mut" style="text-align:center">Belum punya akun? <a href="/register">Daftar</a></p>
</form>
@endsection

