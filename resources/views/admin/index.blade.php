@extends('layouts.base')
@section('title', 'Manajer Member')
@section('body')
<div style="max-width:960px;margin:24px auto;padding:0 16px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <h1 style="margin:0">Manajer Member</h1>
    <a class="btn ghost" href="/">&larr; Kembali ke pemutar</a>
  </div>

  @if(session('status'))<p class="ok">{{ session('status') }}</p>@endif

  <form method="get" style="display:flex;gap:8px;margin-bottom:16px">
    <input name="q" value="{{ $q }}" placeholder="Cari ID member (MBR00012), nama, atau email">
    <button style="width:120px">Cari</button>
  </form>

  <table>
    <tr><th>ID Member</th><th>Nama / Email</th><th>Status</th><th>Aktifkan premium</th></tr>
    @foreach($members as $m)
    <tr>
      <td><b>{{ $m->member_code }}</b></td>
      <td>{{ $m->name }}<br><span class="mut">{{ $m->email }}</span></td>
      <td>
        @if($m->is_admin)<span class="badge prem">Admin</span>
        @elseif($m->isPremium())<span class="badge prem">Premium</span><br><span class="mut">s/d {{ $m->premium_until->format('d M Y') }}</span>
        @else<span class="badge">Free</span>@endif
      </td>
      <td>
        @unless($m->is_admin)
        <form method="post" action="{{ route('admin.activate', $m) }}" style="display:flex;gap:6px">
          @csrf
          <select name="days" style="width:120px">
            <option value="30">30 hari</option>
            <option value="90">90 hari</option>
            <option value="180">180 hari</option>
            <option value="365">365 hari</option>
          </select>
          <button>Aktifkan</button>
        </form>
        @if($m->isPremium())
        <form method="post" action="{{ route('admin.revoke', $m) }}" style="margin-top:6px" onsubmit="return confirm('Cabut premium?')">
          @csrf <button class="ghost danger" style="padding:6px 10px">Cabut</button>
        </form>
        @endif
        @endunless
      </td>
    </tr>
    @endforeach
  </table>
  <div style="margin-top:16px">{{ $members->links() }}</div>
</div>
@endsection

