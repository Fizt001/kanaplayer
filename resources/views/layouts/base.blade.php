<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="csrf-token" content="{{ csrf_token() }}">
<title>@yield('title', 'PlayerMP3')</title>
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#7c5cff">
<link rel="icon" type="image/png" href="/icons/icon-192.png">
<link rel="apple-touch-icon" href="/icons/icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="PlayerMP3">
<style>
  :root { --bg:#0f1115; --card:#181b22; --line:#262a33; --txt:#e8eaf0; --mut:#8b92a5; --acc:#7c5cff; --ok:#2ecc71; --bad:#ff5c6c; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--txt); font:15px/1.5 system-ui,sans-serif; }
  a { color:var(--acc); }
  .box { max-width:380px; margin:8vh auto; background:var(--card); border:1px solid var(--line); border-radius:14px; padding:28px; }
  h1 { margin:0 0 18px; font-size:22px; }
  label { display:block; margin:12px 0 4px; color:var(--mut); font-size:13px; }
  input, select { width:100%; padding:10px 12px; background:#0f1115; border:1px solid var(--line); border-radius:8px; color:var(--txt); }
  button, .btn { display:inline-block; padding:10px 16px; background:var(--acc); color:#fff; border:0; border-radius:8px; cursor:pointer; font-size:14px; text-decoration:none; }
  button.ghost { background:transparent; border:1px solid var(--line); color:var(--txt); }
  button.danger { background:var(--bad); }
  .full { width:100%; margin-top:18px; }
  .err { color:var(--bad); font-size:13px; margin-top:6px; }
  .ok { color:var(--ok); }
  .mut { color:var(--mut); }
  table { width:100%; border-collapse:collapse; }
  th, td { padding:10px 8px; border-bottom:1px solid var(--line); text-align:left; vertical-align:middle; }
  th { color:var(--mut); font-weight:500; font-size:13px; }
  .badge { padding:2px 8px; border-radius:99px; font-size:12px; background:var(--line); }
  .badge.prem { background:rgba(124,92,255,.2); color:#b3a1ff; }
</style>
@stack('head')
</head>
<body>
@yield('body')
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
</script>
</body>
</html>

