// 국어 스튜디오 개발 서버: node dev-server.js  (기본 포트 5178)
// - 파일을 저장하면 열려 있는 브라우저가 자동 새로고침
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.env.KS_ROOT || __dirname;
const PORT = +process.env.PORT || 5178;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.md': 'text/plain; charset=utf-8' };
const LIVE = `<script>(()=>{let v=null;setInterval(async()=>{try{const r=await fetch('/__version',{cache:'no-store'});const t=await r.text();if(v&&t!==v)location.reload();v=t;}catch(e){}},1000)})();</script>`;
function version() {
  let latest = 0;
  const walk = (d) => { for (const n of fs.readdirSync(d)) { if (n === 'node_modules' || n.startsWith('.')) continue; const f = path.join(d, n); const s = fs.statSync(f); if (s.isDirectory()) walk(f); else if (/\.(html|js|css)$/.test(n) && n !== '국어스튜디오.html') latest = Math.max(latest, s.mtimeMs); } };
  try { walk(ROOT); } catch (e) {}
  return String(latest);
}
// ---------- AI 중계 (/api/llm): Vercel 함수와 같은 규칙 ----------
// 키: 환경 변수 또는 이 폴더의 .env.local (GEMINI_API_KEY=..., OPENAI_API_KEY=..., ANTHROPIC_API_KEY=...)
try { new Function(fs.readFileSync(path.join(ROOT, 'shared', 'llm-core.js'), 'utf8'))(); } catch (e) { console.error('AI 모듈을 불러오지 못했어요: ' + e.message); }
const ENV_FILE = {};
try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) ENV_FILE[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch (e) { /* 파일 없음 */ }
const KEY_ENV = { gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'], openai: ['OPENAI_API_KEY'], anthropic: ['ANTHROPIC_API_KEY'] };
const serverKey = (p) => { for (const k of KEY_ENV[p] || []) { const v = process.env[k] || ENV_FILE[k]; if (v) return v; } return ''; };
function sendJson(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }
async function handleLlm(req, res) {
  const L = globalThis.KSLLM;
  if (!L) return sendJson(res, 500, { error: { code: 'NO_MODULE', message: 'AI 모듈 없음' } });
  if (req.method === 'GET') return sendJson(res, 200, { ok: true, via: 'dev-server', providers: Object.fromEntries(L.PROVIDERS.map((p) => [p, { server: !!serverKey(p) }])), models: L.MODELS });
  if (req.method !== 'POST') return sendJson(res, 405, { error: { code: 'METHOD' } });
  const chunks = [];
  for await (const c of req) chunks.push(c);
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { return sendJson(res, 400, { error: { code: 'BAD_JSON', message: '요청 형식이 잘못됐어요' } }); }
  if (!L.PROVIDERS.includes(body.provider)) return sendJson(res, 400, { error: { code: 'BAD_PROVIDER', message: '알 수 없는 AI 회사' } });
  const key = serverKey(body.provider) || req.headers['x-ks-key'] || '';
  if (!key) return sendJson(res, 400, { error: { code: 'NO_KEY', message: '이 AI의 키가 없어요. 설정 > AI 모델에서 키를 넣거나 .env.local에 등록하세요.' } });
  try {
    const r = await L.callProvider(body.provider, { model: body.model, parts: body.parts, json: !!body.json, maxTokens: body.maxTokens, system: body.system, temperature: body.temperature }, key, fetch);
    r.keySource = serverKey(body.provider) ? 'server' : 'user';
    sendJson(res, 200, r);
  } catch (e) {
    sendJson(res, e.status && e.status < 500 ? e.status : 502, { error: { code: e.code || 'PROVIDER_ERROR', status: e.status || null, message: e.message } });
  }
}

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/api/llm') { handleLlm(req, res).catch((e) => sendJson(res, 500, { error: { code: 'SERVER', message: e.message } })); return; }
  if (p === '/__version') { res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); return res.end(version()); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(path.normalize(ROOT)) || /[\\/]\.env/.test(file)) { res.writeHead(403); return res.end('forbidden'); }
  let data;
  try { data = fs.readFileSync(file); } catch (e) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('없는 파일: ' + p); }
  const ext = path.extname(file);
  if (ext === '.html') data = Buffer.from(data.toString('utf8').replace('</body>', LIVE + '</body>'));
  res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(data);
  process.stdout.write(`${new Date().toLocaleTimeString('ko-KR', { hour12: false })} ${req.method} ${p}\n`);
});
const LOG = path.join(ROOT, 'dev-server.log');
const log = (m) => { try { fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${m}\n`); } catch (e) {} };
process.on('uncaughtException', (e) => { log('ERROR ' + (e.stack || e)); console.error(e); });
server.on('error', (e) => {
  log('LISTEN ERROR ' + e.code + ' ' + e.message);
  if (e.code === 'EADDRINUSE') console.error(`포트 ${PORT}을(를) 이미 쓰고 있어요. 이미 켜져 있다면 http://127.0.0.1:${PORT} 을 열면 됩니다.`);
  else console.error('서버를 시작하지 못했어요: ' + e.message);
});
server.listen(PORT, '127.0.0.1', () => { log(`started node ${process.version} root=${ROOT} port=${PORT}`); console.log(`국어 스튜디오 개발 서버: http://127.0.0.1:${PORT}  (Ctrl+C로 종료)`); });

