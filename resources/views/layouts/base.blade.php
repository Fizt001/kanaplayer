<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="csrf-token" content="{{ csrf_token() }}">
<title>@yield('title', 'KanaPlayer') - KanaPlayer</title>
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#0b0e14">
<link rel="icon" type="image/png" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="KanaPlayer">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<style>
  :root {
    --bg: #0b0e14;
    --card: #151922;
    --card-soft: #1a202c;
    --line: #242b38;
    --line-soft: rgba(255, 255, 255, 0.07);
    --txt: #f1f5f9;
    --mut: #94a3b8;
    --acc: #7c5cff;
    --acc-hover: #6a46f9;
    --acc-cyan: #00c6ff;
    --ok: #2ecc71;
    --bad: #ff5c6c;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--txt);
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--acc); text-decoration: none; transition: color 0.15s; }
  a:hover { color: var(--acc-cyan); }

  /* Auth UI Styles */
  .auth-wrapper {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    background:
      radial-gradient(circle at 20% 15%, rgba(124, 92, 255, 0.18) 0%, transparent 45%),
      radial-gradient(circle at 80% 85%, rgba(0, 198, 255, 0.12) 0%, transparent 45%),
      #0b0e14;
  }
  .auth-brand {
    text-align: center;
    margin-bottom: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .auth-logo {
    width: 64px;
    height: 64px;
    border-radius: 18px;
    background: linear-gradient(135deg, rgba(124, 92, 255, 0.25), rgba(0, 198, 255, 0.15));
    border: 1px solid rgba(255, 255, 255, 0.15);
    padding: 6px;
    box-shadow: 0 12px 30px rgba(124, 92, 255, 0.35);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .auth-logo img {
    width: 100%;
    height: 100%;
    border-radius: 14px;
    display: block;
    object-fit: cover;
  }
  .auth-brand h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
    background: linear-gradient(135deg, #ffffff 40%, #c4b5fd 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .auth-brand p {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--mut);
  }
  .auth-card {
    width: 100%;
    max-width: 400px;
    background: rgba(21, 25, 34, 0.88);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--line-soft);
    border-radius: 24px;
    padding: 28px 24px;
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.04);
  }
  .auth-tabs {
    display: flex;
    background: rgba(11, 14, 20, 0.7);
    border: 1px solid var(--line-soft);
    border-radius: 12px;
    padding: 4px;
    margin-bottom: 24px;
    gap: 4px;
  }
  .auth-tab {
    flex: 1;
    text-align: center;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 600;
    color: var(--mut);
    border-radius: 9px;
    transition: all 0.2s;
  }
  .auth-tab.active {
    background: var(--card-soft);
    color: #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  .auth-group {
    margin-bottom: 16px;
  }
  .auth-group label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
    margin-bottom: 6px;
  }
  .auth-input-box {
    position: relative;
    display: flex;
    align-items: center;
  }
  .auth-input-box svg {
    position: absolute;
    left: 14px;
    width: 18px;
    height: 18px;
    fill: #64748b;
    pointer-events: none;
    transition: fill 0.2s;
  }
  .auth-input-box input {
    width: 100%;
    height: 46px;
    padding: 0 14px 0 42px;
    background: rgba(11, 14, 20, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: var(--txt);
    font-size: 14px;
    transition: all 0.2s;
  }
  .auth-input-box input:focus {
    outline: none;
    border-color: var(--acc);
    background: rgba(11, 14, 20, 0.9);
    box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.25);
  }
  .auth-input-box input:focus + svg,
  .auth-input-box input:focus ~ svg {
    fill: var(--acc);
  }
  .auth-btn {
    width: 100%;
    height: 48px;
    margin-top: 10px;
    background: linear-gradient(135deg, #7c5cff, #4f46e5);
    border: none;
    border-radius: 14px;
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.02em;
    cursor: pointer;
    box-shadow: 0 10px 24px rgba(124, 92, 255, 0.35);
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .auth-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 28px rgba(124, 92, 255, 0.45);
    filter: brightness(1.08);
  }
  .auth-btn:active {
    transform: translateY(1px);
    filter: brightness(0.95);
  }
  .auth-extra-card {
    margin-top: 20px;
    padding: 12px 14px;
    background: rgba(124, 92, 255, 0.08);
    border: 1px dashed rgba(124, 92, 255, 0.25);
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .auth-extra-icon {
    font-size: 20px;
    line-height: 1;
  }
  .auth-extra-text {
    font-size: 12px;
    color: #cbd5e1;
    line-height: 1.4;
  }
  .err {
    color: var(--bad);
    font-size: 12px;
    margin-top: 5px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* Admin table styles */
  .box { max-width:380px; margin:8vh auto; background:var(--card); border:1px solid var(--line); border-radius:14px; padding:28px; }
  button, .btn { display:inline-block; padding:10px 16px; background:var(--acc); color:#fff; border:0; border-radius:8px; cursor:pointer; font-size:14px; text-decoration:none; }
  button.ghost { background:transparent; border:1px solid var(--line); color:var(--txt); }
  button.danger { background:var(--bad); }
  table { width:100%; border-collapse:collapse; }
  th, td { padding:10px 8px; border-bottom:1px solid var(--line); text-align:left; vertical-align:middle; }
  th { color:var(--mut); font-weight:500; font-size:13px; }
  .badge { padding:2px 8px; border-radius:99px; font-size:12px; background:var(--line); }
  .badge.prem { background:rgba(124,92,255,.2); color:#b3a1ff; }
  .mut { color: var(--mut); }
  .ok { color: var(--ok); }
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

