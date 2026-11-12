/* 국어 스튜디오 - LLM 공통 호출 (브라우저·Vercel 함수·개발 서버가 같이 씀)
 * 입력 parts: [{ text: '...' }, { image: { mime: 'image/jpeg', data: '<base64>' } }]
 * 출력: { text, json, finishReason: STOP|MAX_TOKENS|SAFETY|RECITATION|REFUSAL|OTHER, usage: { input, output }, provider, model, ms }
 * 모델 목록 기준: 2026-11-12 각 사 공식 문서 */
(function (root) {
  'use strict';

  const MODELS = {
    gemini: [
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', note: '빠름·기본 추천' },
      { id: 'gemini-4-argon', label: 'Gemini 4 Argon', note: '고성능 추론 (유료 등급)' },
      { id: 'gemini-4-carbon', label: 'Gemini 4 Carbon', note: '최상위 (유료 등급)' },
      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', note: '가장 저렴' },
    ],
    openai: [
      { id: 'gpt-6.1-terra', label: 'GPT-6.1 Terra', note: '빠름·이미지 판독 강함·기본 추천' },
      { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol', note: '성능과 비용 균형' },
      { id: 'gpt-6-astra', label: 'GPT-6 Astra', note: '최상위' },
      { id: 'gpt-6-luna', label: 'GPT-6 Luna', note: '가장 저렴' },
    ],
    anthropic: [
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', note: '속도·성능 균형·기본 추천' },
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: '고성능' },
      { id: 'claude-fable-5-2', label: 'Claude Fable 5.2', note: '최상위 추론' },
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', note: '가장 빠름·저렴' },
    ],
  };
  const PROVIDERS = Object.keys(MODELS);
  const PROVIDER_LABEL = { gemini: 'Google Gemini', openai: 'OpenAI', anthropic: 'Anthropic Claude' };
  const DEFAULT_MODEL = { gemini: 'gemini-3.8-flash', openai: 'gpt-6.1-terra', anthropic: 'claude-sonnet-5-5' };

  function fail(message, extra) { return Object.assign(new Error(message), extra || {}); }

  // 모델이 JSON을 코드 블록이나 설명과 섞어 줄 때도 꺼내 씀
  function parseJsonLoose(text) {
    if (!text) return null;
    const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try { return JSON.parse(t); } catch (e) { /* 계속 */ }
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { /* 실패 */ } }
    return null;
  }

  function normParts(parts) {
    return (parts || []).map((p) => {
      if (p == null) return null;
      if (typeof p === 'string') return { text: p };
      if (p.text != null) return { text: String(p.text) };
      if (p.image) return { image: { mime: p.image.mime || 'image/jpeg', data: p.image.data } };
      if (p.inline_data) return { image: { mime: p.inline_data.mime_type, data: p.inline_data.data } };
      return null;
    }).filter(Boolean);
  }

  async function readError(res, provider) {
    let msg = '';
    try { const j = await res.json(); msg = j?.error?.message || j?.message || JSON.stringify(j).slice(0, 300); } catch (e) { try { msg = (await res.text()).slice(0, 300); } catch (e2) { /* 없음 */ } }
    const code = res.status === 401 || res.status === 403 || /api key not valid|invalid.*api.?key/i.test(msg) ? 'BAD_KEY' : res.status === 404 ? 'MODEL_NOT_FOUND' : res.status === 429 ? 'RATE_LIMIT' : 'PROVIDER_HTTP_' + res.status;
    return fail(`${PROVIDER_LABEL[provider]} 오류 ${res.status}: ${msg}`, { code, status: res.status, provider });
  }

  // ---------- Gemini ----------
  async function callGemini(req, key, fetchFn) {
    const parts = normParts(req.parts).map((p) => (p.text != null ? { text: p.text } : { inline_data: { mime_type: p.image.mime, data: p.image.data } }));
    const body = { contents: [{ role: 'user', parts }], generationConfig: {} };
    if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };
    if (req.json) body.generationConfig.responseMimeType = 'application/json';
    if (req.maxTokens) body.generationConfig.maxOutputTokens = req.maxTokens;
    if (req.temperature != null) body.generationConfig.temperature = req.temperature;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:generateContent`;
    const res = await fetchFn(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
    if (!res.ok) throw await readError(res, 'gemini');
    const d = await res.json();
    const cand = d.candidates && d.candidates[0];
    const blocked = d.promptFeedback && d.promptFeedback.blockReason;
    const fr = String(blocked || (cand && cand.finishReason) || 'OTHER').toUpperCase();
    const text = ((cand && cand.content && cand.content.parts) || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
    const finish = fr === 'STOP' ? 'STOP' : fr === 'MAX_TOKENS' ? 'MAX_TOKENS' : fr === 'RECITATION' ? 'RECITATION' : ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'].includes(fr) ? 'SAFETY' : 'OTHER';
    const u = d.usageMetadata || {};
    return { text, finishReason: finish, rawFinish: fr, usage: { input: u.promptTokenCount || 0, output: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) } };
  }

  // ---------- OpenAI (Responses API) ----------
  async function callOpenAI(req, key, fetchFn) {
    const content = normParts(req.parts).map((p) => (p.text != null ? { type: 'input_text', text: p.text } : { type: 'input_image', image_url: `data:${p.image.mime};base64,${p.image.data}` }));
    const body = { model: req.model, input: [{ role: 'user', content }] };
    const sys = [req.system, req.json ? 'Respond with a single valid JSON object only.' : ''].filter(Boolean).join('\n');
    if (sys) body.instructions = sys;
    if (req.json) body.text = { format: { type: 'json_object' } };
    if (req.maxTokens) body.max_output_tokens = req.maxTokens;
    const res = await fetchFn('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key }, body: JSON.stringify(body) });
    if (!res.ok) throw await readError(res, 'openai');
    const d = await res.json();
    let text = '', refusal = '';
    for (const o of d.output || []) {
      if (o.type !== 'message') continue;
      for (const c of o.content || []) {
        if (c.type === 'output_text') text += c.text || '';
        if (c.type === 'refusal') refusal += c.refusal || '';
      }
    }
    if (!text && typeof d.output_text === 'string') text = d.output_text;
    const reason = d.incomplete_details && d.incomplete_details.reason;
    const finish = refusal && !text ? 'REFUSAL' : d.status === 'completed' ? 'STOP' : reason === 'max_output_tokens' ? 'MAX_TOKENS' : reason === 'content_filter' ? 'SAFETY' : 'OTHER';
    const u = d.usage || {};
    return { text, finishReason: finish, rawFinish: d.status + (reason ? ':' + reason : ''), refusal, usage: { input: u.input_tokens || 0, output: u.output_tokens || 0 } };
  }

  // ---------- Anthropic (Messages API) ----------
  async function callAnthropic(req, key, fetchFn, opts) {
    const content = normParts(req.parts).map((p) => (p.text != null ? { type: 'text', text: p.text } : { type: 'image', source: { type: 'base64', media_type: p.image.mime, data: p.image.data } }));
    const sys = [req.system, req.json ? '반드시 JSON 객체 하나만 출력하라. 설명이나 코드 블록 표시는 쓰지 마라.' : ''].filter(Boolean).join('\n');
    const body = { model: req.model, max_tokens: req.maxTokens || 16000, messages: [{ role: 'user', content }] };
    if (sys) body.system = sys;
    const send = (version) => {
      const headers = { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': version };
      if (opts && opts.browser) headers['anthropic-dangerous-direct-browser-access'] = 'true';
      return fetchFn('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
    };
    let res = await send('2023-06-01');
    if (res.status === 400) { // 새 API 버전만 받는 모델이면 한 번 더
      const clone = res.clone ? res.clone() : null;
      let msg = '';
      try { msg = clone ? JSON.stringify(await clone.json()) : ''; } catch (e) { /* 무시 */ }
      if (/version/i.test(msg)) res = await send('2026-10-21');
    }
    if (!res.ok) throw await readError(res, 'anthropic');
    const d = await res.json();
    const text = (d.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('');
    const sr = d.stop_reason;
    const finish = sr === 'end_turn' || sr === 'stop_sequence' ? 'STOP' : sr === 'max_tokens' ? 'MAX_TOKENS' : sr === 'refusal' ? 'REFUSAL' : 'OTHER';
    const u = d.usage || {};
    return { text, finishReason: finish, rawFinish: sr, usage: { input: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0), output: u.output_tokens || 0 } };
  }

  async function callProvider(provider, req, key, fetchFn, opts) {
    if (!PROVIDERS.includes(provider)) throw fail('알 수 없는 AI 회사: ' + provider, { code: 'BAD_PROVIDER' });
    if (!key) throw fail(`${PROVIDER_LABEL[provider]} 키가 없습니다`, { code: 'NO_KEY', provider });
    const r0 = { ...req, model: req.model || DEFAULT_MODEL[provider] };
    const t0 = Date.now();
    const f = fetchFn || fetch;
    const r = provider === 'gemini' ? await callGemini(r0, key, f) : provider === 'openai' ? await callOpenAI(r0, key, f) : await callAnthropic(r0, key, f, opts);
    r.json = r0.json ? parseJsonLoose(r.text) : null;
    r.provider = provider;
    r.model = r0.model;
    r.ms = Date.now() - t0;
    return r;
  }

  root.KSLLM = { MODELS, PROVIDERS, PROVIDER_LABEL, DEFAULT_MODEL, callProvider, parseJsonLoose, normParts };
})(typeof globalThis !== 'undefined' ? globalThis : window);
