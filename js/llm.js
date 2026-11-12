/* 국어 스튜디오 - AI 연결 (Gemini · OpenAI · Claude)
 * 호출 순서: 서버 중계(/api/llm, 키는 서버 환경 변수 또는 화면에서 넣은 키) → 서버가 없으면 브라우저에서 직접
 * 작업별 AI: ocr(시험지 판독) · structure(구조화) · annotate(주석) */
(function (A) {
  'use strict';
  const L = window.KSLLM;
  const TASKS = { ocr: '시험지 판독(이미지 → 글자)', structure: '문항 구조화', annotate: '주석 달기' };
  const USAGE_KEY = 'ks.llm.usage';
  const month = () => new Date().toISOString().slice(0, 7);
  const err = (message, code) => Object.assign(new Error(message), { code });

  const llm = {
    TASKS,
    status: { via: 'unknown', providers: {} },
    async refresh() {
      if (location.protocol === 'file:') { this.status = { via: 'direct', providers: {} }; return this.status; }
      try {
        const r = await fetch('/api/llm', { cache: 'no-store' });
        const ct = r.headers.get('content-type') || '';
        if (!r.ok || !ct.includes('json')) throw new Error('no server');
        const j = await r.json();
        this.status = { via: j.via || 'server', providers: j.providers || {} };
      } catch (e) { this.status = { via: 'direct', providers: {} }; }
      A.Jobs && A.Jobs.emit();
      return this.status;
    },
    key(p) { return (A.Settings.get().ai.keys || {})[p] || ''; },
    serverKey(p) { return !!(this.status.providers[p] && this.status.providers[p].server); },
    usable(p) { return this.serverKey(p) || !!this.key(p); },
    // 작업에 고른 AI에 키가 없으면 키가 있는 AI로 자동 대체
    chosenFor(task) { return (A.Settings.get().ai.tasks || {})[task] || 'gemini'; },
    providerFor(task) {
      const p = this.chosenFor(task);
      if (this.usable(p)) return p;
      return L.PROVIDERS.find((q) => this.usable(q)) || p;
    },
    modelFor(p) { return (A.Settings.get().ai.models || {})[p] || L.DEFAULT_MODEL[p]; },
    ready(task) { return this.usable(this.providerFor(task)); },
    label(task) { const p = this.providerFor(task); return `${L.PROVIDER_LABEL[p]} · ${this.modelFor(p)}`; },
    keyState(p) { return this.serverKey(p) ? 'server' : this.key(p) ? 'browser' : 'none'; },

    usage(p, m = month()) {
      const all = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}');
      const u = (all[m] && all[m][p]) || { req: 0, input: 0, output: 0, fail: 0 };
      return { ...u, total: u.input + u.output };
    },
    track(p, usage, failed) {
      const all = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}');
      const m = month();
      all[m] = all[m] || {};
      const u = all[m][p] || { req: 0, input: 0, output: 0, fail: 0 };
      u.req++; if (failed) u.fail++;
      if (usage) { u.input += usage.input || 0; u.output += usage.output || 0; }
      all[m][p] = u;
      localStorage.setItem(USAGE_KEY, JSON.stringify(all));
    },
    limit(p) { return +((A.Settings.get().ai.limits || {})[p] || 0); },

    // opts: { task, provider, model, parts:[{text}|{image:{mime,data}}], json, maxTokens, system }
    async generate(opts) {
      const provider = opts.provider || this.providerFor(opts.task);
      const model = opts.model || this.modelFor(provider);
      const lim = this.limit(provider);
      if (lim && this.usage(provider).total >= lim) throw err(`${L.PROVIDER_LABEL[provider]} 이번 달 사용 한도(${lim.toLocaleString()} 토큰)에 도달했어요. 설정 > AI 모델에서 한도를 올리거나 다른 AI를 고르세요.`, 'MONTHLY_LIMIT');
      if (this.status.via === 'unknown') await this.refresh();
      const body = { provider, model, parts: L.normParts(opts.parts), json: !!opts.json, maxTokens: opts.maxTokens, system: opts.system };
      const userKey = opts.key || this.key(provider);
      let r;
      try {
        if (this.status.via !== 'direct') {
          const headers = { 'content-type': 'application/json' };
          if (!this.serverKey(provider) && userKey) headers['x-ks-key'] = userKey;
          const res = await fetch('/api/llm', { method: 'POST', headers, body: JSON.stringify(body) });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw err(j.error ? j.error.message : `AI 호출 실패 (${res.status})`, j.error ? j.error.code : 'HTTP_' + res.status);
          r = j;
        } else {
          const key = userKey;
          if (!key) throw err(`${L.PROVIDER_LABEL[provider]} 키가 없어요. 설정 > AI 모델에서 넣어 주세요.`, 'NO_KEY');
          r = await L.callProvider(provider, body, key, window.fetch.bind(window), { browser: true });
        }
      } catch (e) {
        this.track(provider, null, true);
        if (e.code === 'BAD_KEY') e.message = `${L.PROVIDER_LABEL[provider]} 키가 맞지 않아요. 키를 다시 확인하세요. (${e.message.replace(/^.*?:\s*/, '').slice(0, 80)})`;
        if (e.code === 'MODEL_NOT_FOUND') e.message = `모델 '${model}'을(를) 찾지 못했어요. 다른 모델을 고르거나 계정 등급(유료 전용 모델 여부)을 확인하세요.`;
        throw e;
      }
      this.track(provider, r.usage, false);
      return r;
    },
    async test(provider, o = {}) {
      const t0 = performance.now();
      const r = await this.generate({ provider, model: o.model, key: o.key, parts: [{ text: '연결 확인입니다. JSON {"ok":true} 만 답하세요.' }], json: true, maxTokens: 2000 });
      return { ms: Math.round(performance.now() - t0), ok: !!(r.json && r.json.ok), model: r.model, keySource: r.keySource || 'browser', usage: r.usage };
    },
  };
  A.llm = llm;
})(window.App);
