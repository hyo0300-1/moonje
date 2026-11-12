// 국어 스튜디오 접속 비밀번호 (Vercel Routing Middleware)
// - 비밀번호 원문은 저장하지 않고 SHA-256 값만 둡니다.
// - Vercel 환경 변수 SITE_PASSWORD 를 넣으면 그 값이 우선합니다(코드 수정 없이 비밀번호 변경).
import { next } from '@vercel/functions';

export const config = { matcher: '/((?!favicon\\.ico).*)' };

const DEFAULT_HASH = '1bd56c1c24625aef1b1bddc8e000e7cf8105c662ec7868140d0cc02d20f89420';
const COOKIE = 'ks_gate';
const MAX_AGE = 60 * 60 * 24 * 30; // 30일

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function passwordHash() {
  const env = typeof process !== 'undefined' && process.env ? process.env.SITE_PASSWORD : '';
  return env ? sha256(env) : DEFAULT_HASH;
}
function readCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}
function safeNext(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function loginPage(nextPath, error) {
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>국어 스튜디오 · 로그인</title><meta name="robots" content="noindex">
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f6f7;color:#18181b;font:14px/1.55 "Pretendard",-apple-system,"Segoe UI","Malgun Gothic",sans-serif}
.card{width:min(360px,92vw);background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:28px 26px;box-shadow:0 4px 16px rgba(0,0,0,.06)}
.brand{display:flex;align-items:center;gap:10px;margin-bottom:22px}.logo{width:34px;height:34px;border-radius:9px;background:#904ae8;color:#fff;display:grid;place-items:center;font-weight:700}
.brand b{display:block;font-size:16px;letter-spacing:-.02em}.brand span{font-size:12px;color:#71717a}
label{display:block;font-size:12px;color:#52525b;font-weight:500;margin-bottom:6px}
input{width:100%;height:40px;padding:0 12px;border:1px solid #d4d4d8;border-radius:8px;font:inherit;outline:none}
input:focus{border-color:#904ae8;box-shadow:0 0 0 3px rgba(144,74,232,.15)}
button{width:100%;height:40px;margin-top:14px;border:0;border-radius:8px;background:#904ae8;color:#fff;font:inherit;font-weight:600;cursor:pointer}
.err{margin-top:10px;font-size:12.5px;color:#dc2626}.hint{margin-top:16px;font-size:11.5px;color:#a1a1aa}
</style></head><body>
<form class="card" method="post" action="/__login">
<div class="brand"><div class="logo">비</div><div><b>국어 스튜디오</b><span>비해당학원</span></div></div>
<label for="pw">비밀번호</label>
<input id="pw" name="password" type="password" autocomplete="current-password" autofocus required aria-label="비밀번호">
<input type="hidden" name="next" value="${esc(nextPath)}">
<button type="submit">들어가기</button>
${error ? `<div class="err" role="alert">${esc(error)}</div>` : ''}
<div class="hint">한 번 들어오면 이 브라우저에서 30일 동안 다시 묻지 않아요.</div>
</form></body></html>`;
  return new Response(html, { status: error ? 401 : 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const hash = await passwordHash();
  const token = await sha256('kor-studio-gate:' + hash);

  if (url.pathname === '/__logout') {
    return new Response(null, { status: 303, headers: { location: '/', 'set-cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`, 'cache-control': 'no-store' } });
  }

  if (url.pathname === '/__login' && request.method === 'POST') {
    const form = await request.formData().catch(() => null);
    const pw = form ? String(form.get('password') || '') : '';
    const to = safeNext(form ? String(form.get('next') || '/') : '/');
    if (pw && (await sha256(pw)) === hash) {
      return new Response(null, { status: 303, headers: { location: to, 'set-cookie': `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`, 'cache-control': 'no-store' } });
    }
    await new Promise((r) => setTimeout(r, 800)); // 연속 대입 늦추기
    return loginPage(to, '비밀번호가 맞지 않아요.');
  }

  if (readCookie(request, COOKIE) === token) return next();

  return loginPage(safeNext(url.pathname === '/__login' ? '/' : url.pathname + url.search), '');
}
