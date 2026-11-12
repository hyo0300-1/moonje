/* 국어 스튜디오 - 공통: 유틸, 저장소, 설정, 작업 큐, 라우터, 작업 요청창 */
window.App = window.App || {};
(function (A) {
  'use strict';

  // ---------- 유틸 ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      el.append(k.nodeType ? k : document.createTextNode(String(k)));
    }
    return el;
  }
  const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (t) => new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function deepMerge(base, over) {
    if (Array.isArray(base) || typeof base !== 'object' || base === null) return over === undefined ? base : over;
    const out = { ...base };
    for (const k of Object.keys(over || {})) out[k] = k in base ? deepMerge(base[k], over[k]) : over[k];
    return out;
  }
  function toast(msg, kind) {
    const t = h('div', { class: 'toast' + (kind === 'bad' ? ' bad' : ''), role: 'status' }, msg);
    $('#toasts').append(t);
    setTimeout(() => t.remove(), 3200);
  }
  function download(name, text, type = 'text/plain;charset=utf-8') {
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    document.body.append(a); a.click(); a.remove();
  }

  // 아이콘 (Lucide 스타일 단순 SVG)
  const ICON = {
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8h10M7 12h10M7 16h6"/>',
    note: '<path d="M4 4h12l4 4v12H4z"/><path d="M8 10h8M8 14h5"/><path d="M16 4v4h4"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M8 7h8"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    palette: '<circle cx="13.5" cy="6.5" r="1.2"/><circle cx="17.5" cy="10.5" r="1.2"/><circle cx="8.5" cy="7.5" r="1.2"/><path d="M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A5.6 5.6 0 0 0 22 9.8C22 5.5 17.5 2 12 2z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19.6l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H2.6a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.4 6.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V2.6a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.1a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    queue: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
    redo: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/>',
    printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ''}</svg>`;

  // ---------- IndexedDB 저장소 ----------
  const DB = {
    _db: null,
    open() {
      if (this._db) return Promise.resolve(this._db);
      return new Promise((res, rej) => {
        const r = indexedDB.open('kor-studio', 2);
        r.onupgradeneeded = () => {
          const d = r.result;
          for (const s of ['documents', 'annotations', 'assets', 'builds']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
        };
        r.onsuccess = () => { this._db = r.result; res(this._db); };
        r.onerror = () => rej(r.error);
      });
    },
    async tx(store, mode, fn) {
      const d = await this.open();
      return new Promise((res, rej) => {
        const t = d.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => res(req ? req.result : undefined);
        t.onerror = () => rej(t.error);
      });
    },
    put(store, obj) { return this.tx(store, 'readwrite', (s) => s.put(obj)).then(() => obj); },
    get(store, id) { return this.tx(store, 'readonly', (s) => s.get(id)); },
    all(store) { return this.tx(store, 'readonly', (s) => s.getAll()); },
    del(store, id) { return this.tx(store, 'readwrite', (s) => s.delete(id)); },
    clear(store) { return this.tx(store, 'readwrite', (s) => s.clear()); },
  };

  // ---------- 설정 ----------
  const ENGINE_LABEL = {
    pdf_text: 'PDF 글자 레이어', parsed: '파일 직접 읽기', gemini: 'AI 판독', dedicated_ocr: '전용 OCR(로컬)',
    tile_mode: '타일 모드', manual: '수동 확인', reference_mode: '참조형 구조화(AI)', rule_based: '규칙 기반 구조화',
  };
  const OUTCOME_LABEL = { ok: '완료', blocked_copyright: '저작권 차단', blocked_safety: '안전 차단', truncated: '잘림', error: '오류', low_quality: '품질 낮음', skipped: '건너뜀' };
  const DEFAULT_SETTINGS = {
    account: { name: '', email: '' },
    brand: { academyName: '비해당학원', headerText: '', footerText: '수업용 자체 제작 자료', accent: '#904ae8' },
    output: { quickAnswers: false, promptTitles: true, answerPlacement: 'end', paper: 'B4' },
    annotation: { density: 3, layout: 'wing', autoHighlight: true },
    ocr: { chain: ['gemini', 'dedicated_ocr', 'tile_mode', 'manual'], disabled: [], structure: ['reference_mode', 'rule_based'], lowConf: 70, enhance: true, lang: 'kor+eng' },
    ai: {
      keys: { gemini: '', openai: '', anthropic: '' },
      models: { gemini: 'gemini-3.8-flash', openai: 'gpt-6.1-terra', anthropic: 'claude-sonnet-5-5' },
      tasks: { ocr: 'gemini', structure: 'gemini', annotate: 'gemini' },
      limits: { gemini: 0, openai: 0, anthropic: 0 },
    },
    ui: { theme: 'light' },
    notify: { jobDone: true },
  };
  const Settings = {
    key: 'ks.settings',
    histKey: 'ks.settings.history',
    get() {
      let s;
      try { s = deepMerge(DEFAULT_SETTINGS, JSON.parse(localStorage.getItem(this.key) || '{}')); } catch { s = clone(DEFAULT_SETTINGS); }
      // 예전 설정 옮기기: 단일 Gemini 키 → 회사별 키, 종료 예정 모델 교체
      if (s.ai.geminiKey && !s.ai.keys.gemini) s.ai.keys.gemini = s.ai.geminiKey;
      delete s.ai.geminiKey; delete s.ai.model;
      if (/^gemini-2\.5/.test(s.ai.models.gemini || '')) s.ai.models.gemini = 'gemini-3.8-flash';
      return s;
    },
    save(next) {
      const prev = this.get();
      const diff = [];
      (function walk(a, b, p) {
        for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
          const av = a?.[k], bv = b?.[k], path = p ? p + '.' + k : k;
          if (av && bv && typeof av === 'object' && !Array.isArray(av)) walk(av, bv, path);
          else if (JSON.stringify(av) !== JSON.stringify(bv)) { const secret = /^ai\.keys\./.test(path); diff.push({ path, from: secret ? (av ? '••••' : '') : av, to: secret ? (bv ? '••••' : '') : bv }); }
        }
      })(prev, next, '');
      localStorage.setItem(this.key, JSON.stringify(next));
      if (diff.length) {
        const hist = JSON.parse(localStorage.getItem(this.histKey) || '[]');
        hist.unshift({ at: Date.now(), diff });
        localStorage.setItem(this.histKey, JSON.stringify(hist.slice(0, 50)));
      }
      A.applyTheme();
      return diff;
    },
    history() { return JSON.parse(localStorage.getItem(this.histKey) || '[]'); },
    defaults() { return clone(DEFAULT_SETTINGS); },
  };

  // ---------- 작업 큐 (서버 jobs 테이블과 같은 모양) ----------
  const KIND_LABEL = { ocr: '텍스트화', structure: '구조화', analyze: '시험지 분석', annotate: 'AI 주석', render: '출력' };
  const Jobs = {
    list: [], queue: [], running: false, subs: new Set(),
    create(kind, title, input, run) {
      const job = { id: uid('job_'), kind, title, input, status: 'queued', stage: '대기 중', progress: 0, events: [], created_at: Date.now(), created_via: 'ui' };
      this.list.unshift(job);
      this.queue.push({ job, run });
      this.event(job, 'queued', '대기열에 등록');
      this.pump();
      return job;
    },
    async pump() {
      if (this.running) return;
      const next = this.queue.shift();
      if (!next) return;
      this.running = true;
      const { job, run } = next;
      if (job.status === 'cancelled') { this.running = false; return this.pump(); }
      job.status = 'running'; job.started_at = Date.now();
      const ctx = {
        job,
        stage: (s, p) => { job.stage = s; if (p != null) job.progress = p; this.event(job, 'stage', s); },
        progress: (p) => { job.progress = Math.max(0, Math.min(100, p)); this.emit(); },
        log: (type, msg) => this.event(job, type, msg),
        cancelled: () => job.status === 'cancelled',
      };
      try {
        const r = await run(ctx);
        if (job.status !== 'cancelled') { job.status = job.needsReview ? 'needs_review' : 'completed'; job.progress = 100; job.result = r; job.stage = job.needsReview ? '검토 필요' : '완료'; this.event(job, 'completed', '완료'); if (Settings.get().notify.jobDone) toast(`${job.title}: 완료`); }
      } catch (e) {
        if (job.status !== 'cancelled') { job.status = 'failed'; job.error = { code: e.code || 'ERROR', message: e.message, retryable: !!e.retryable }; job.stage = '실패'; this.event(job, 'failed', e.message); toast(`${job.title}: ${e.message}`, 'bad'); console.error(e); }
      }
      job.finished_at = Date.now();
      this.running = false;
      this.emit();
      this.pump();
    },
    cancel(id) { const j = this.list.find((x) => x.id === id); if (j && ['queued', 'running'].includes(j.status)) { j.status = 'cancelled'; j.stage = '취소됨'; this.event(j, 'cancelled', '사용자가 취소'); } },
    event(job, type, msg) { job.events.push({ at: Date.now(), type, msg }); this.emit(); },
    on(fn) { this.subs.add(fn); return () => this.subs.delete(fn); },
    emit() { for (const f of this.subs) try { f(); } catch (e) { console.error(e); } },
    get(id) { return this.list.find((j) => j.id === id); },
  };

  function renderJobs() {
    const active = Jobs.list.filter((j) => ['queued', 'running'].includes(j.status)).length;
    $('#jobs-btn').innerHTML = (active ? '<span class="dot"></span>' : '') + icon('queue') + `<span>작업 큐${active ? ' ' + active : ''}</span>`;
    const b = $('#drawer-b');
    if (!$('#drawer').classList.contains('open')) return;
    b.innerHTML = '';
    if (!Jobs.list.length) { b.append(h('div', { class: 'empty' }, '아직 작업이 없습니다. 시험지 분석·저장에서 파일을 넣고 작업을 시작해 보세요.')); return; }
    for (const j of Jobs.list) {
      const st = { queued: ['대기', ''], running: ['진행 중', 'accent'], completed: ['완료', 'ok'], needs_review: ['검토 필요', 'warn'], failed: ['실패', 'bad'], cancelled: ['취소', ''] }[j.status];
      const ev = h('div', { class: 'job-ev' }, j.events.slice(-40).map((e) => h('div', { class: e.type }, `${new Date(e.at).toLocaleTimeString('ko-KR', { hour12: false })}  ${e.msg}`)));
      b.append(h('div', { class: 'job' },
        h('div', { class: 'job-t' }, h('span', null, j.title), h('span', { class: 'chip ' + st[1] }, st[0])),
        h('div', { class: 'job-s' }, `${KIND_LABEL[j.kind] || j.kind} · ${j.stage} · ${fmtDate(j.created_at)}`),
        h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: { width: (j.progress || 0) + '%' } })),
        ev,
        ['queued', 'running'].includes(j.status) ? h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn sm', onclick: () => Jobs.cancel(j.id) }, '취소')) : null,
      ));
      ev.scrollTop = ev.scrollHeight;
    }
  }

  // ---------- 예전 호출 이름 유지: 작업별로 고른 AI(Gemini·OpenAI·Claude)로 보냄 ----------
  async function gemini(parts, { json = true, task = 'structure' } = {}) {
    return A.llm.generate({ task, parts, json });
  }
  // 응답 분류 (DB 함수 classify_ocr_outcome 과 동일 규칙)
  function classifyOutcome(finishReason, chars, expected) {
    const f = String(finishReason || '').toUpperCase();
    if (f === 'RECITATION') return 'blocked_copyright';
    if (['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'OTHER', 'REFUSAL'].includes(f)) return 'blocked_safety';
    if (f === 'MAX_TOKENS') return 'truncated';
    if (!chars) return 'error';
    if (expected > 0 && chars < expected * 0.5) return 'truncated';
    return 'ok';
  }

  // ---------- 라우터 ----------
  const NAV = [
    { grp: '자료 만들기' },
    { id: 'annotate', label: '주석 달기', icon: 'note' },
    { id: 'textbook', label: '주석교재', icon: 'book' },
    { id: 'build', label: '시험지 제작', icon: 'layers' },
    { grp: '분석·보관' },
    { id: 'exam', label: '시험지 분석·저장', icon: 'scan' },
    { id: 'library', label: '자료함', icon: 'box' },
    { grp: '디자인' },
    { id: 'design', label: '디자인 작업대', icon: 'palette' },
    { id: 'settings', label: '설정', icon: 'gear' },
  ];
  const routes = {};
  let current = null;
  function route(id, render) { routes[id] = render; }
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    return { id: path || 'exam', params: Object.fromEntries(new URLSearchParams(qs || '')) };
  }
  function go(id, params) {
    const qs = params && Object.keys(params).length ? '?' + new URLSearchParams(params) : '';
    location.hash = '#/' + id + qs;
  }
  async function renderRoute() {
    const { id, params } = parseHash();
    const r = routes[id] ? id : 'exam';
    const view = $('#view');
    if (current?.cleanup) try { current.cleanup(); } catch {}
    view.innerHTML = '';
    view.className = 'view';
    $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.id === r));
    const item = NAV.find((n) => n.id === r);
    $('#crumb').innerHTML = `국어 스튜디오 / <b>${esc(item?.label || '')}</b>`;
    current = (await routes[r](view, params)) || null;
    view.focus({ preventScroll: true });
  }
  function buildNav() {
    const nav = $('#nav');
    nav.innerHTML = '';
    for (const n of NAV) {
      if (n.grp) { nav.append(h('div', { class: 'grp' }, n.grp)); continue; }
      nav.append(h('a', { href: '#/' + n.id, 'data-id': n.id, 'aria-label': n.label, title: n.label, html: icon(n.icon) + `<span>${esc(n.label)}</span>` }));
    }
  }

  // ---------- 작업 요청창 (Ctrl+K) ----------
  const COMMANDS = [
    { t: '시험지 분석·저장 열기', k: '시험지 분석 저장 ocr 텍스트화 구조화 업로드 이미지', run: () => go('exam') },
    { t: '이미지·PDF 텍스트화 (OCR)', k: 'ocr 텍스트화 글자 이미지 사진 pdf', run: () => go('exam', { mode: 'text' }) },
    { t: '시험지 분석 리포트 만들기', k: '분석 리포트 학부모 동형 경향', run: () => go('exam', { mode: 'analyze' }) },
    { t: '지문에 주석 달기', k: '주석 행간주 필기 지문', run: () => go('annotate') },
    { t: '시험지 제작 설계도 만들기', k: '시험지 제작 변형 기출 설계도 연속 출제 유사도', run: () => go('build') },
    { t: '디자인 작업대에서 배너 바꾸기', k: '디자인 배너 이미지 머리 표지 로고 워터마크', run: () => go('design') },
    { t: '자료함 열기', k: '자료함 저장 보관 목록', run: () => go('library') },
    { t: '설정: OCR 대체 순서', k: '설정 ocr 엔진 대체 저작권 차단 순서', run: () => go('settings', { s: 'ocr' }) },
    { t: '설정: AI 모델 연결 (Gemini·OpenAI·Claude)', k: '설정 ai 모델 키 api gemini openai gpt claude 제미나이 클로드', run: () => go('settings', { s: 'ai' }) },
    { t: '설정: 학원 브랜드', k: '설정 학원 브랜드 이름 로고 강조색', run: () => go('settings', { s: 'brand' }) },
    { t: '작업 큐 보기', k: '작업 큐 진행 상태 job', run: () => toggleDrawer(true) },
    { t: '다크 모드 전환', k: '테마 다크 라이트 화면', run: () => toggleTheme() },
  ];
  function planFor(q) {
    const s = q.replace(/\s+/g, '');
    const steps = [];
    if (/ocr|텍스트|사진|이미지|pdf|스캔/i.test(s)) steps.push('시험지 분석·저장 → 텍스트화 모드로 파일 넣기');
    if (/분석|리포트|경향|동형/.test(s)) steps.push('시험지 분석·저장 → 분석 모드 (구조화 + 경향 리포트)');
    if (/주석|행간주|필기/.test(s)) steps.push('주석 달기 → 무료 사전 주석 → 필기량 조절');
    if (/변형|출제|시험지제작|설계도/.test(s)) steps.push('시험지 제작 → 설계도 만들기');
    if (/배너|디자인|표지|로고/.test(s)) steps.push('디자인 작업대 → 배너 슬롯 교체');
    return steps;
  }
  function openPalette() {
    if ($('.modal-bg')) return;
    let sel = 0, items = COMMANDS;
    const input = h('input', { placeholder: '무엇을 할까요? 예: "사진 시험지 텍스트화", "배너 바꾸기"', 'aria-label': '작업 요청' });
    const list = h('div', { class: 'list', role: 'listbox' });
    const plan = h('div', { class: 'plan hidden' });
    const bg = h('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(); } }, h('div', { class: 'palette', role: 'dialog', 'aria-label': '작업 요청창' }, input, list, plan));
    function close() { bg.remove(); }
    function draw() {
      const q = input.value.trim().toLowerCase();
      items = q ? COMMANDS.filter((c) => (c.t + ' ' + c.k).toLowerCase().split(/\s+/).some((w) => q.split(/\s+/).some((x) => w.includes(x) || x.includes(w)))) : COMMANDS;
      sel = Math.min(sel, Math.max(0, items.length - 1));
      list.innerHTML = '';
      items.forEach((c, i) => list.append(h('div', { class: 'it' + (i === sel ? ' on' : ''), role: 'option', onclick: () => { close(); c.run(); } }, c.t, h('small', null, i === sel ? 'Enter' : ''))));
      if (!items.length) list.append(h('div', { class: 'empty' }, '맞는 명령이 없어요.'));
      const steps = q ? planFor(q) : [];
      plan.classList.toggle('hidden', !steps.length);
      plan.innerHTML = steps.length ? '<b>에이전트 계획 (확인 후 실행)</b><ol>' + steps.map((s) => `<li>${esc(s)}</li>`).join('') + '</ol>' : '';
    }
    input.addEventListener('input', () => { sel = 0; draw(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
      else if (e.key === 'Enter' && items[sel]) { close(); items[sel].run(); }
      else if (e.key === 'Escape') close();
    });
    document.body.append(bg);
    draw();
    input.focus();
  }

  // ---------- 테마 / 서랍 ----------
  function applyTheme() {
    const s = Settings.get();
    document.documentElement.dataset.theme = s.ui.theme;
    document.documentElement.style.setProperty('--accent', s.brand.accent || '#904ae8');
    const b = $('#theme-btn');
    if (b) b.innerHTML = icon(s.ui.theme === 'dark' ? 'sun' : 'moon');
  }
  function toggleTheme() { const s = Settings.get(); s.ui.theme = s.ui.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem(Settings.key, JSON.stringify(s)); applyTheme(); }
  function toggleDrawer(force) { const d = $('#drawer'); d.classList.toggle('open', force ?? !d.classList.contains('open')); renderJobs(); }

  // ---------- 이미지 유틸 ----------
  function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('이미지를 읽을 수 없습니다')); i.src = src; }); }
  function readAs(file, how) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r[how](file); }); }
  async function imageStats(src) {
    const img = await loadImage(src);
    const c = document.createElement('canvas'); const w = 64, hh = Math.max(1, Math.round(64 * img.height / img.width));
    c.width = w; c.height = hh;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, hh);
    const d = g.getImageData(0, 0, w, hh).data;
    let lum = 0; const buckets = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      lum += (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255;
      const key = ((r >> 5) << 6) | ((gg >> 5) << 3) | (b >> 5);
      const e = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 }; e.n++; e.r += r; e.g += gg; e.b += b; buckets.set(key, e);
    }
    lum /= d.length / 4;
    const toHex = (v) => Math.round(v).toString(16).padStart(2, '0');
    const sorted = [...buckets.values()].sort((a, b) => b.n - a.n).map((e) => ({ r: e.r / e.n, g: e.g / e.n, b: e.b / e.n }));
    const pal = [];
    for (const c2 of sorted) {
      const sat = Math.max(c2.r, c2.g, c2.b) - Math.min(c2.r, c2.g, c2.b);
      if (sat < 40) continue; // 회색 계열 제외
      if (pal.some((p) => Math.abs(p.r - c2.r) + Math.abs(p.g - c2.g) + Math.abs(p.b - c2.b) < 90)) continue;
      pal.push(c2); if (pal.length === 3) break;
    }
    return { lum, palette: pal.map((p) => '#' + toHex(p.r) + toHex(p.g) + toHex(p.b)), width: img.width, height: img.height };
  }

  // ---------- 백업·복원 (서버가 붙기 전까지 자료를 잃지 않기 위한 필수 기능) ----------
  const STORES = ['documents', 'annotations', 'builds', 'assets'];
  const LS_KEYS = ['ks.settings', 'ks.settings.history', 'ks.design.presets'];
  const Backup = {
    lastKey: 'ks.lastBackup',
    last() { return +localStorage.getItem(this.lastKey) || 0; },
    async counts() { const o = {}; for (const s of STORES) o[s] = (await DB.all(s)).length; return o; },
    async export() {
      const data = { app: 'kor-studio', version: 1, exported_at: new Date().toISOString(), stores: {}, local: {} };
      for (const s of STORES) data.stores[s] = await DB.all(s);
      for (const k of LS_KEYS) data.local[k] = localStorage.getItem(k);
      if (data.local['ks.settings']) { try { const st = JSON.parse(data.local['ks.settings']); if (st.ai) { st.ai.geminiKey = ''; st.ai.keys = { gemini: '', openai: '', anthropic: '' }; } data.local['ks.settings'] = JSON.stringify(st); } catch {} }
      const d = new Date(), p = (n) => String(n).padStart(2, '0');
      download(`국어스튜디오-백업-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`, JSON.stringify(data), 'application/json');
      localStorage.setItem(this.lastKey, String(Date.now()));
      const n = Object.values(data.stores).reduce((a, x) => a + x.length, 0);
      toast(`백업 파일을 내려받았어요 (자료 ${n}개, API 키는 빼고 저장)`);
      return n;
    },
    async restore(file) {
      let data;
      try { data = JSON.parse(await readAs(file, 'readAsText')); } catch { throw new Error('백업 파일을 읽을 수 없어요'); }
      if (data?.app !== 'kor-studio' || !data.stores) throw new Error('국어 스튜디오 백업 파일이 아니에요');
      let n = 0;
      for (const s of STORES) for (const obj of data.stores[s] || []) { if (obj && obj.id) { await DB.put(s, obj); n++; } }
      for (const k of LS_KEYS) {
        if (data.local?.[k] == null) continue;
        if (k === 'ks.settings') { // 지금 쓰는 API 키는 유지
          try { const cur = Settings.get(); const st = JSON.parse(data.local[k]); st.ai = { ...(st.ai || {}), keys: cur.ai.keys }; delete st.ai.geminiKey; localStorage.setItem(k, JSON.stringify(st)); } catch {}
        } else localStorage.setItem(k, data.local[k]);
      }
      applyTheme();
      return n;
    },
    async wipe() { for (const s of STORES) await DB.clear(s); },
  };

  Object.assign(A, { Backup, $, $$, h, uid, esc, fmtDate, clone, sleep, deepMerge, toast, download, icon, DB, Settings, Jobs, gemini, classifyOutcome, ENGINE_LABEL, OUTCOME_LABEL, route, go, renderRoute, buildNav, openPalette, applyTheme, toggleTheme, toggleDrawer, renderJobs, loadImage, readAs, imageStats, NAV });
})(window.App);
