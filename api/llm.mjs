// 국어 스튜디오 AI 중계 (Vercel Function)
// - 키는 Vercel 환경 변수에 둡니다: GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY
// - 환경 변수가 없으면 화면(설정)에서 넣은 키를 x-ks-key 헤더로 받아 그 요청에만 씁니다(저장하지 않음).
// - 비밀번호 미들웨어 뒤에 있으므로 로그인한 사람만 호출할 수 있습니다.
import '../shared/llm-core.js';

export const config = { maxDuration: 120 };

const { callProvider, MODELS, PROVIDERS } = globalThis.KSLLM;
const ENV = { gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'], openai: ['OPENAI_API_KEY'], anthropic: ['ANTHROPIC_API_KEY'] };
const serverKey = (p) => { for (const k of ENV[p] || []) if (process.env[k]) return process.env[k]; return ''; };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export async function GET() {
  return json({ ok: true, via: 'vercel', providers: Object.fromEntries(PROVIDERS.map((p) => [p, { server: !!serverKey(p) }])), models: MODELS });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: { code: 'BAD_JSON', message: '요청 형식이 잘못됐어요' } }, 400); }
  const provider = body && body.provider;
  if (!PROVIDERS.includes(provider)) return json({ error: { code: 'BAD_PROVIDER', message: '알 수 없는 AI 회사' } }, 400);
  const key = serverKey(provider) || request.headers.get('x-ks-key') || '';
  if (!key) return json({ error: { code: 'NO_KEY', message: '이 AI의 키가 없어요. 설정 > AI 모델에서 키를 넣거나 Vercel 환경 변수에 등록하세요.' } }, 400);
  try {
    const r = await callProvider(provider, { model: body.model, parts: body.parts, json: !!body.json, maxTokens: body.maxTokens, system: body.system, temperature: body.temperature }, key, fetch);
    r.keySource = serverKey(provider) ? 'server' : 'user';
    return json(r);
  } catch (e) {
    return json({ error: { code: e.code || 'PROVIDER_ERROR', status: e.status || null, message: e.message } }, e.status && e.status < 500 ? e.status : 502);
  }
}
