/* 국어 스튜디오 - 구조화(참조형 AI / 규칙 기반)와 시험지 분석 */
(function (A) {
  'use strict';

  const DOMAIN = { READING: '독서', POETRY: '문학(운문)', NOVEL: '문학(산문)', SPEECH_WRITING: '화법과 작문', GRAMMAR: '문법', MEDIA: '매체', UNKNOWN: '미분류' };
  const TYPE = { FACT: '내용 일치', INFER: '세부 추론', APPLY: '<보기> 적용', VOCAB: '어휘·문맥적 의미', STRUCT: '서술 방식·전개', EXPR: '표현상 특징', CHAR: '인물·심리·태도', COMPARE: '작품·관점 비교', CRIT: '비판·감상', GRAM: '문법 탐구', MEDIA: '매체 자료', SPEECH: '화법 전략', WRITE: '작문·고쳐쓰기' };
  const DOMAIN_RULES = [
    ['GRAMMAR', /(음운|음절|형태소|품사|어근|접사|어간|어미|문장 성분|높임|피동|사동|중세 국어|국어사|안은문장|이어진문장|용언|체언|조사|음운 변동|표준 발음|단어의 짜임)/g, 3],
    ['MEDIA', /(매체|화면|게시물|누리집|블로그|영상|댓글|카드 뉴스|인터넷 방송|하이퍼링크)/g, 3],
    ['SPEECH_WRITING', /(발표|토론|대화|강연|협상|면담|초고|고쳐 쓰|글쓰기|작문|청중|발표자|토의|연설)/g, 2],
    ['POETRY', /(화자|시어|시상|시적|운율|시구|청자|[0-9]연|시의)/g, 3],
    ['NOVEL', /(서술자|인물|사건|장면|갈등|서사|등장인물|이야기)/g, 2],
    ['READING', /(윗글|글쓴이|견해|이론|개념|원리|입장|학자|과정|원인|정보)/g, 1],
  ];
  const TYPE_RULES = [
    ['VOCAB', /(문맥적 의미|사전적 의미|바꿔 쓰|바꾸어 쓰|의미로 적절|ⓐ\s*~\s*ⓔ)/],
    ['GRAM', /(음운|형태소|품사|문장 성분|높임|피동|사동|중세 국어|어미|조사|단어의 짜임)/],
    ['MEDIA', /(매체|화면|게시물|영상|누리집)/],
    ['SPEECH', /(발표|말하기|강연|토론|대화|면담|협상)/],
    ['WRITE', /(초고|고쳐 쓰|글쓰기|작문|자료 활용|조건에 따라)/],
    ['COMPARE', /(\(가\)\s*와\s*\(나\)|\(가\)\s*~\s*\(다\)|공통점|차이점|비교)/],
    ['EXPR', /(표현상|표현 방식|표현 효과|표현한)/],
    ['STRUCT', /(서술상|서술 방식|전개 방식|글의 구조|서술 특징|짜임)/],
    ['CHAR', /(인물|심리|태도|정서|화자)/],
    ['CRIT', /(비판|반응|감상|평가)/],
    ['INFER', /(추론|짐작|예측|이유|까닭)/],
    ['FACT', /(일치|알 수 있는|이해한 내용|이해로|설명으로|내용으로)/],
  ];
  const NEG = /(적절하지\s*않은|않(?:은|는)\s*것은|옳지\s*않은|틀린\s*것|거리가\s*먼)/;
  // OCR이 ①~⑤를 잘못 읽은 표식 (@, @), ®, ©, 6), (1), 1) 등). 문항 안에서는 나오는 순서대로 선지 번호를 매김
  const reOcrMark = /^\s*(?:[@®©◎○⓪⑥](?:\)|\s)|[@®©]$|\(?[1-6]\)\s|[①-⑤]\s?)/;
  const CH = ['①', '②', '③', '④', '⑤'];
  const reSet = /^\s*[\[［]\s*(\d{1,2})\s*[~∼～\-–]\s*(\d{1,2})\s*[\]］]/;
  const reQ = /^\s*(\d{1,2})\s*[.．]\s*(\S.*)$/;
  const reBoogi = /[<〈＜《\[]\s*보\s*기\s*[>〉＞》\]]/;

  function flatLines(doc) {
    const out = [];
    for (const p of doc.pages) for (const l of p.lines || []) out.push({ gid: l.gid, page: p.page_no, text: l.text || '', status: l.status });
    return out;
  }

  // ---------- 규칙 기반 구조화 ----------
  function ruleStructure(lines) {
    const sets = [], items = [], preamble = [];
    let set = null, cur = null, part = null;
    const lastNo = () => (items.length ? items[items.length - 1].number : null);
    for (const L of lines) {
      const t = L.text.trim();
      if (!t) continue;
      const ms = t.match(reSet);
      if (ms) { set = { from: +ms[1], to: +ms[2], header: t, refs: [L.gid], passage: '', passage_refs: [] }; sets.push(set); cur = null; part = 'passage'; continue; }
      const mq = t.match(reQ);
      if (mq) {
        const n = +mq[1], prev = lastNo();
        const seqOk = prev == null ? n <= 45 : n > prev && n - prev <= 3;
        if (seqOk && !CH.some((c) => mq[2].startsWith(c))) {
          cur = { number: n, set: set ? sets.indexOf(set) : null, stem: mq[2], stem_refs: [L.gid], boogi: '', boogi_refs: [], choices: {}, choice_refs: {}, seq_ok: prev == null || n === prev + 1 };
          items.push(cur); part = 'stem';
          continue;
        }
      }
      const marks = CH.map((c, i) => ({ i: i + 1, at: t.indexOf(c) })).filter((m) => m.at >= 0).sort((a, b) => a.at - b.at);
      const digitMark = /^\s*\(?[1-6]\)\s/.test(t);
      if (cur && marks.length <= 1 && part !== 'passage' && reOcrMark.test(t) && !(digitMark && part === 'boogi')) {
        const k = Object.keys(cur.choices).length + 1;
        if (k <= 5) {
          part = 'choices';
          cur.choices[k] = t.replace(reOcrMark, '').trim();
          cur.choice_refs[k] = [L.gid];
          cur.ocr_marks = true;
          continue;
        }
      }
      if (cur && marks.length) {
        part = 'choices';
        marks.forEach((m, k) => {
          const seg = t.slice(m.at + 1, k + 1 < marks.length ? marks[k + 1].at : undefined).trim();
          cur.choices[m.i] = ((cur.choices[m.i] || '') + ' ' + seg).trim();
          (cur.choice_refs[m.i] = cur.choice_refs[m.i] || []).push(L.gid);
        });
        const pre = t.slice(0, marks[0].at).trim();
        if (pre && marks[0].i === 1) { cur.stem += ' ' + pre; cur.stem_refs.push(L.gid); }
        continue;
      }
      const bm = t.match(reBoogi);
      const boogiStart = bm && (t.length - bm[0].length <= 2 || (bm.index === 0 && !/^[를을에의와는가]/.test(t.slice(bm[0].length).trim())));
      if (cur && boogiStart) { part = 'boogi'; const rest = t.replace(reBoogi, '').trim(); if (rest) cur.boogi += (cur.boogi ? '\n' : '') + rest; cur.boogi_refs.push(L.gid); continue; }
      if (cur && part === 'stem') { cur.stem += ' ' + t; cur.stem_refs.push(L.gid); continue; }
      if (cur && part === 'boogi') { cur.boogi += (cur.boogi ? '\n' : '') + t; cur.boogi_refs.push(L.gid); continue; }
      if (cur && part === 'choices') {
        const filled = Object.keys(cur.choices).length;
        if (filled < 5) { const k = Math.max(...Object.keys(cur.choices).map(Number)); cur.choices[k] += ' ' + t; cur.choice_refs[k].push(L.gid); continue; }
        // 선지 5개를 다 채운 뒤 나오는 글 = 다음 지문 (머리말 없는 지문)
        set = { from: null, to: null, header: '', refs: [], passage: t, passage_refs: [L.gid], implicit: true }; sets.push(set); cur = null; part = 'passage'; continue;
      }
      if (set && part === 'passage') { set.passage += (set.passage ? '\n' : '') + t; set.passage_refs.push(L.gid); continue; }
      preamble.push(t);
    }
    return { sets, items, preamble };
  }

  // ---------- 분류 ----------
  function classifyDomain(text) {
    let best = 'READING', bestScore = 0;
    for (const [d, re, w] of DOMAIN_RULES) { const n = (text.match(re) || []).length * w; if (n > bestScore) { best = d; bestScore = n; } }
    return best;
  }
  function classifyType(item, domain) {
    const s = item.stem || '';
    if (/(문맥적 의미|사전적 의미|바꿔 쓰|바꾸어 쓰)/.test(s)) return 'VOCAB';
    if (domain === 'GRAMMAR') return 'GRAM';
    if (item.boogi || reBoogi.test(s)) return 'APPLY';
    for (const [t, re] of TYPE_RULES) if (re.test(s)) return t;
    return 'FACT';
  }
  function enrich(st, lines) {
    const low = new Set(lines.filter((l) => l.status === 'low_conf' || l.status === 'unreadable').map((l) => l.gid));
    // 같은 지문을 쓰는 문항은 같은 영역: 지문 + 모든 발문을 합쳐 한 번에 판단
    st.sets.forEach((s, si) => {
      const its = st.items.filter((i) => i.set === si);
      s.domain = classifyDomain(`${its.map((i) => i.stem + ' ' + i.stem + ' ' + i.boogi).join(' ')} ${(s.header || '')} ${s.passage.slice(0, 600)}`);
      if (/다음\s*시/.test(s.header || '')) s.domain = 'POETRY';
      if (/다음\s*(글|소설)/.test(s.header || '') && /(서술자|인물|사건)/.test(its.map((i) => i.stem).join(' '))) s.domain = 'NOVEL';
    });
    for (const it of st.items) {
      const ctxText = `${it.stem} ${it.stem} ${it.boogi} ${it.set != null ? (st.sets[it.set]?.passage || '').slice(0, 500) : ''}`;
      it.domain = it.domain || (it.set != null && st.sets[it.set]?.domain) || classifyDomain(ctxText);
      it.item_type = it.item_type || classifyType(it, it.domain);
      it.negative = NEG.test(it.stem);
      const nCh = Object.keys(it.choices).length;
      const refs = [...it.stem_refs, ...it.boogi_refs, ...Object.values(it.choice_refs).flat()];
      const lowHit = refs.some((g) => low.has(g));
      it.confidence = +(0.35 * (it.stem.length >= 8 ? 1 : 0) + 0.4 * Math.min(nCh, 5) / 5 + 0.15 * (it.seq_ok === false ? 0 : 1) + 0.1 * (lowHit ? 0 : 1)).toFixed(2);
      it.needs_review = it.confidence < 0.65;
      it.teacher_confirmed = it.teacher_confirmed || false;
      it.choice_avg_len = nCh ? Math.round(Object.values(it.choices).reduce((a, c) => a + c.length, 0) / nCh) : 0;
    }
    return st;
  }

  // ---------- 참조형 구조화 (AI는 줄 ID만 답함 → 원문 재출력 없음) ----------
  async function referenceStructure(lines) {
    const listing = lines.slice(0, 1500).map((l) => `${l.gid}: ${l.text}`).join('\n');
    const prompt = `다음은 OCR로 읽은 국어 시험지의 줄 목록이다. 각 줄 앞에 줄 ID가 있다.
시험지 구조를 줄 ID로만 답하라. 원문 글자를 다시 쓰지 마라.
JSON 형식: {"sets":[{"from":18,"to":21,"header_ref":"P1-L3","passage_refs":["P1-L4"]}],
"items":[{"number":18,"stem_refs":["P1-L20"],"boogi_refs":[],"choice_refs":{"1":["P1-L22"],"2":[],"3":[],"4":[],"5":[]},
"domain":"READING|POETRY|NOVEL|SPEECH_WRITING|GRAMMAR|MEDIA","item_type":"FACT|INFER|APPLY|VOCAB|STRUCT|EXPR|CHAR|COMPARE|CRIT|GRAM|MEDIA|SPEECH|WRITE"}]}
줄 목록:
${listing}`;
    const r = await A.llm.generate({ task: 'structure', parts: [{ text: prompt }], json: true, maxTokens: 32000 });
    const j = r.json;
    if (A.classifyOutcome(r.finishReason, (r.text || '').length, 0) !== 'ok' || !j || !Array.isArray(j.items) || !j.items.length) {
      const e = new Error(`참조형 구조화 실패 (${r.finishReason}${j ? '' : ', JSON 아님'})`); e.code = 'REFERENCE_FAILED'; throw e;
    }
    const byId = new Map(lines.map((l) => [l.gid, l.text]));
    const txt = (refs) => (refs || []).map((g) => byId.get(g) || '').join(' ').replace(/\s+/g, ' ').trim();
    const strip = (s) => s.replace(/^\s*\d{1,2}\s*[.．]\s*/, '').replace(/^[①②③④⑤]\s*/, '').replace(reBoogi, '').trim();
    const sets = (j.sets || []).map((s) => ({ from: s.from, to: s.to, header: byId.get(s.header_ref) || '', refs: s.header_ref ? [s.header_ref] : [], passage: (s.passage_refs || []).map((g) => byId.get(g) || '').join('\n'), passage_refs: s.passage_refs || [] }));
    const items = j.items.map((it) => {
      const choices = {}, choice_refs = {};
      for (const k of ['1', '2', '3', '4', '5']) { const refs = it.choice_refs?.[k] || []; if (refs.length) { choices[k] = strip(txt(refs)); choice_refs[k] = refs; } }
      const set = sets.findIndex((s) => s.from != null && it.number >= s.from && it.number <= s.to);
      return { number: it.number, set: set >= 0 ? set : null, stem: strip(txt(it.stem_refs)), stem_refs: it.stem_refs || [], boogi: strip(txt(it.boogi_refs)), boogi_refs: it.boogi_refs || [], choices, choice_refs, domain: DOMAIN[it.domain] ? it.domain : null, item_type: TYPE[it.item_type] ? it.item_type : null, seq_ok: true };
    });
    return { sets, items, preamble: [] };
  }

  async function run(doc, ctx, s) {
    const lines = flatLines(doc);
    const chain = s.structure || s.ocr.structure;
    for (const eng of chain) {
      if (eng === 'reference_mode') {
        if (!A.llm.ready('structure')) { ctx.log('info', '구조화: 참조형(AI)은 연결된 AI 키가 없어 건너뜀 → 규칙 기반'); continue; }
        try { ctx.log('stage', `구조화: 참조형(${A.llm.label('structure')}, 줄 ID만 응답) 시도`); const st = enrich(await referenceStructure(lines), lines); st.engine = 'reference_mode'; ctx.log('info', `구조화 완료: ${st.items.length}문항 (참조형)`); return st; }
        catch (e) { ctx.log('fallback', `구조화: ${e.message} → 규칙 기반으로 전환`); }
      }
      if (eng === 'rule_based') { const st = enrich(ruleStructure(lines), lines); st.engine = 'rule_based'; ctx.log('info', `구조화 완료: ${st.items.length}문항 (규칙 기반)`); return st; }
    }
    const st = enrich(ruleStructure(lines), lines); st.engine = 'rule_based'; return st;
  }
  function rebuild(doc) { const lines = flatLines(doc); const st = enrich(ruleStructure(lines), lines); st.engine = 'rule_based'; return st; }

  // ---------- 분석 리포트 ----------
  function analyze(doc) {
    const items = doc.structure?.items || [];
    const n = items.length;
    const count = (f) => items.filter(f).length;
    const dist = (key, names) => {
      const m = {}; for (const it of items) m[it[key]] = (m[it[key]] || 0) + 1;
      return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, label: names[k] || k, n: v, pct: n ? Math.round(v * 100 / n) : 0 }));
    };
    const domains = dist('domain', DOMAIN), types = dist('item_type', TYPE);
    const neg = count((i) => i.negative), boogi = count((i) => i.item_type === 'APPLY'), review = count((i) => i.needs_review && !i.teacher_confirmed);
    const top = domains[0];
    const tips = {
      READING: '독서는 문단별 핵심 정보 정리와 선지-지문 대조 훈련이 우선입니다.',
      POETRY: '운문은 화자의 정서·태도와 표현법 개념어를 정확히 연결하는 연습이 필요합니다.',
      NOVEL: '산문은 인물 관계와 사건 흐름을 요약하고, 서술상 특징 선지를 판단하는 연습이 필요합니다.',
      GRAMMAR: '문법은 개념 정리 후 자료 적용 문제를 반복해야 합니다.',
      SPEECH_WRITING: '화법과 작문은 말하기 전략·글쓰기 계획을 자료와 대조하는 유형이 중심입니다.',
      MEDIA: '매체는 자료의 표현 방식과 수용자 고려 요소를 묻는 문항이 중심입니다.',
    };
    const summary = n ? [
      `이번 시험지는 총 ${n}문항으로 분석되었습니다. 가장 비중이 큰 영역은 ${top.label}(${top.n}문항, ${top.pct}%)입니다.`,
      `'적절하지 않은 것'을 고르는 부정 발문이 ${neg}문항(${Math.round(neg * 100 / n)}%)으로, 선지 하나하나를 근거와 대조하는 습관이 점수를 좌우합니다.`,
      boogi ? `<보기>를 적용하는 문항이 ${boogi}문항 있어, 외부 자료를 지문에 대입하는 연습이 필요합니다.` : '<보기> 적용 문항은 거의 없었습니다.',
      ...domains.slice(0, 3).map((d) => tips[d.key]).filter(Boolean),
    ] : ['문항을 찾지 못했습니다. 교정 화면에서 문항 번호(예: "12.")와 선지 기호(①~⑤)가 제대로 읽혔는지 확인해 주세요.'];
    return { n, domains, types, neg, boogi, review, summary, created_at: Date.now() };
  }

  A.structure = { run, rebuild, analyze, ruleStructure, DOMAIN, TYPE, CH };
})(window.App);
