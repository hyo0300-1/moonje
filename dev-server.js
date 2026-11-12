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
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/__version') { res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); return res.end(version()); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(path.normalize(ROOT))) { res.writeHead(403); return res.end('forbidden'); }
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

