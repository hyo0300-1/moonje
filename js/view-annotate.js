/* 국어 스튜디오 - 주석 달기 (요청 1) + 주석교재 (요청 2, 시연판은 분량 계산·첨부자료 역할까지) */
(function (A) {
  'use strict';
  const { h, esc } = A;
  const CAT = {
    '어휘': '#2563eb', '현대어풀이': '#0891b2', '표현법': '#9333ea', '화자·정서': '#db2777', '인물·사건': '#ea580c',
    '구조': '#16a34a', '배경': '#64748b', '문법': '#0d9488', '출제포인트': '#dc2626', '기출연계': '#b45309',
  };
  const DENS = ['', '핵심만', '간결', '보통', '풍부', '촘촘'];
  const SAMPLE = { title: '진달래꽃', author: '김소월', text: '나 보기가 역겨워\n가실 때에는\n말없이 고이 보내 드리우리다.\n\n영변에 약산\n진달래꽃\n아름 따다 가실 길에 뿌리우리다.\n\n가시는 걸음걸음\n놓인 그 꽃을\n사뿐히 즈려밟고 가시옵소서.\n\n나 보기가 역겨워\n가실 때에는\n죽어도 아니 눈물 흘리우리다.' };
  const STOP = new Set(['그리고', '하지만', '그러나', '있는', '없는', '하는', '것은', '것이', '때에', '에서', '으로', '에게', '이다', '한다', '그는', '그의']);

  function detectGenre(text) {
    const lines = text.split('\n').filter((l) => l.trim());
    const avg = lines.reduce((a, l) => a + l.length, 0) / Math.max(1, lines.length);
    if (/[ㆍᆞᆢㅿㆁㆆ]/.test(text)) return '고전 시가';
    if (/["“”]/.test(text) && avg > 30) return '소설';
    if (avg < 32 && lines.length >= 3) return '현대시';
    return '비문학';
  }

  // ---------- 1단계: 규칙 기반 사전 주석 (무료, 즉시) ----------
  function ruleNotes(text, genre) {
    const notes = [];
    const add = (start, end, category, note, level) => { if (end > start) notes.push({ id: A.uid('n'), start, end, quote: text.slice(start, end), category, note, level, source: 'rule', anchor: 'exact', pinned: false, hidden: false }); };
    const lines = []; let off = 0;
    for (const l of text.split('\n')) { lines.push({ t: l, off }); off += l.length + 1; }
    const isPoem = /시|시가/.test(genre);

    // 수미상관: 첫 연과 마지막 연이 거의 같음
    const stanzas = text.split(/\n\s*\n/);
    if (isPoem && stanzas.length >= 3) {
      const norm = (s) => s.replace(/\s/g, '').slice(0, 10);
      if (norm(stanzas[0]) === norm(stanzas[stanzas.length - 1])) add(0, stanzas[0].split('\n')[0].length, '구조', '수미상관: 첫 연을 마지막 연에서 되풀이해 구조적 안정감과 주제 강조', 1);
    }
    for (const { t, off: o } of lines) {
      if (!t.trim()) continue;
      let m;
      const reEx = /(아아|오오|어즈버|아으)|[가-힣]+(구나|도다|로다|노라)(?=[\s.,!?]|$)/g;
      while ((m = reEx.exec(t))) add(o + m.index, o + m.index + m[0].length, '표현법', '영탄: 감탄의 말로 감정을 직접 드러냄', 2);
      const last = t.trim().match(/([가-힣]+)([?？]|[.]?)$/);
      if (last && (/[?？]$/.test(t.trim()) || /(랴|리오|리요|ㄴ가|는가|겠는가|을쏘냐|던가)$/.test(last[1]))) { const s = o + t.lastIndexOf(last[1]); add(s, s + last[1].length, '표현법', '설의: 묻는 형식으로 뜻을 강조', 2); }
      else if (last && /(옵소서|소서|어라|아라|거라|시오)$/.test(last[1])) { const s = o + t.lastIndexOf(last[1]); add(s, s + last[1].length, '화자·정서', '명령·기원형 어미: 청자에게 바라는 화자의 태도', 2); }
      else if (last && isPoem && /(우리다|리라|오리다|겠다|리로다)$/.test(last[1])) { const s = o + t.lastIndexOf(last[1]); add(s, s + last[1].length, '화자·정서', '의지·다짐의 어미: 화자의 굳은 태도(반어 여부 확인)', 2); }
      const reColor = /(푸른|붉은|하얀|흰|검은|노란|파란|초록|금빛|은빛|잿빛|빨간)/g;
      while ((m = reColor.exec(t))) add(o + m.index, o + m.index + m[0].length, '표현법', '색채 이미지: 시각적 심상', 4);
      const reDup = /([가-힣]{2})\1/g;
      while ((m = reDup.exec(t))) add(o + m.index, o + m.index + m[0].length, '표현법', '음성 상징·반복어: 리듬감과 생동감', 4);
      const reHanja = /([가-힣]+)\(([\u4e00-\u9fff]+)\)/g;
      while ((m = reHanja.exec(t))) add(o + m.index, o + m.index + m[0].length, '어휘', `한자 병기 어휘: ${m[1]}(${m[2]}) 뜻 확인`, 3);
      if (/[ㆍᆞᆢㅿㆁㆆ]/.test(t)) add(o, o + Math.min(t.length, 12), '현대어풀이', '옛 표기: 현대어 풀이 필요', 2);
      const reEllip = /…|\.{3}/g;
      while ((m = reEllip.exec(t))) add(o + Math.max(0, m.index - 4), o + m.index + m[0].length, '표현법', '말줄임: 여운을 남김', 4);
      if (!isPoem) {
        const reConn = /(^|[.!?]\s*)(그러나|하지만|반면|따라서|그러므로|결국|예를 들어|가령|즉|다시 말해)(?=[\s,])/g;
        const kind = { 그러나: '전환·대조', 하지만: '전환·대조', 반면: '대조', 따라서: '결론', 그러므로: '결론', 결국: '결론', '예를 들어': '예시', 가령: '예시', 즉: '부연', '다시 말해': '부연' };
        while ((m = reConn.exec(t))) { const s = o + m.index + m[1].length; add(s, s + m[2].length, '구조', `접속 표현(${kind[m[2]]}): 글의 흐름이 바뀌는 지점`, ['결론', '전환·대조'].includes(kind[m[2]]) ? 2 : 3); }
        const reDef = /([가-힣][가-힣\s]{1,18}?)(이란|란|이라고 한다|라고 한다|을 말한다|를 말한다|을 뜻한다|를 뜻한다)/g;
        while ((m = reDef.exec(t))) add(o + m.index, o + m.index + m[0].length, '출제포인트', '개념 정의: 선지에서 그대로 묻는 경우가 많음', 1);
        if (/^["“]/.test(t.trim())) add(o + t.indexOf(t.trim()), o + Math.min(t.length, t.indexOf(t.trim()) + 14), '인물·사건', '대화: 인물의 성격·관계가 드러남', 3);
      }
    }
    if (isPoem) {
      const first = text.match(/(나는|내가|나의|나\s|우리)/);
      if (first) add(first.index, first.index + first[0].trim().length, '화자·정서', '화자가 겉으로 드러남(1인칭)', 3);
      // 같은 시행 반복 (줄 단위) 먼저, 그다음 단어 반복
      const lineCount = new Map();
      for (const { t } of lines) { const k = t.trim(); if (k.length >= 3) lineCount.set(k, (lineCount.get(k) || 0) + 1); }
      const repLines = [...lineCount.entries()].filter(([, n]) => n >= 2).map(([k]) => k);
      for (const k of repLines) {
        const L = lines.find((x) => x.t.trim() === k);
        const s0 = L.off + L.t.indexOf(k);
        if (!notes.some((x) => x.start <= s0 && x.end >= s0 + 2 && x.category === '구조')) add(s0, s0 + k.length, '표현법', `시행 반복: 같은 행이 ${lineCount.get(k)}번 나와 운율과 주제 강조`, 2);
      }
      const inRepLine = (w) => repLines.some((k) => k.includes(w));
      const counts = new Map();
      for (const w of text.match(/[가-힣]{2,}/g) || []) if (!STOP.has(w)) counts.set(w, (counts.get(w) || 0) + 1);
      const reps = [...counts.entries()].filter(([w, n]) => n >= 2 && !inRepLine(w)).sort((a, b) => b[1] - a[1]).slice(0, 2);
      for (const [w, n] of reps) {
        const at = text.indexOf(w);
        if (notes.some((x) => x.start <= at && x.end >= at + w.length)) continue;
        add(at, at + w.length, '표현법', `반복: '${w}'이(가) ${n}번 나와 운율과 의미를 강조`, n >= 3 ? 2 : 3);
      }
    }
    return notes.sort((a, b) => a.start - b.start || a.level - b.level);
  }

  // ---------- 위치 복구 (정확히 → 공백·부호 무시 → 실패) ----------
  function anchor(text, quote) {
    let i = text.indexOf(quote);
    if (i >= 0) return { start: i, end: i + quote.length, anchor: 'exact' };
    const map = []; let stripped = '';
    for (let k = 0; k < text.length; k++) if (!/[\s.,!?·'"“”‘’()\-]/.test(text[k])) { map.push(k); stripped += text[k]; }
    const q = quote.replace(/[\s.,!?·'"“”‘’()\-]/g, '');
    if (q.length >= 2) { i = stripped.indexOf(q); if (i >= 0) return { start: map[i], end: map[i + q.length - 1] + 1, anchor: 'fuzzy' }; }
    return { start: -1, end: -1, anchor: 'lost' };
  }

  async function aiNotes(doc, ctx) {
    const prompt = `너는 고등학교 국어 교사다. 아래 ${doc.genre} 작품(또는 지문)에 수업용 주석을 달아라.
규칙: quote는 원문에 있는 그대로의 짧은 구절(2~15자). 원문 전체를 다시 쓰지 말 것.
category는 ${Object.keys(CAT).join(', ')} 중 하나. level은 중요도 1(가장 중요)~5. note는 60자 이내.
JSON {"notes":[{"quote":"…","category":"…","note":"…","level":1}]} 로만 답하라. 25개 이내.
제목: ${doc.title} ${doc.author ? '/ ' + doc.author : ''}
원문:
${doc.text}`;
    ctx.stage('AI 주석 생성', 30);
    const r = await A.gemini([{ text: prompt }]);
    if (A.classifyOutcome(r.finishReason, (r.text || '').length, 0) !== 'ok' || !Array.isArray(r.json?.notes)) { const e = new Error(`AI 주석 실패 (${r.finishReason})`); throw e; }
    ctx.stage('위치 연결', 80);
    return r.json.notes.map((n) => ({ ...anchor(doc.text, n.quote || ''), id: A.uid('n'), quote: n.quote, category: CAT[n.category] ? n.category : '출제포인트', note: String(n.note || '').slice(0, 160), level: Math.min(5, Math.max(1, +n.level || 3)), source: 'ai', pinned: false, hidden: false }));
  }

  A.route('annotate', async (view, params) => {
    const s = A.Settings.get();
    let doc = params.id ? await A.DB.get('annotations', params.id) : null;
    if (!doc) doc = A.annoDraft || { id: A.uid('an_'), ...SAMPLE, genre: detectGenre(SAMPLE.text), notes: [], density: s.annotation.density, layout: s.annotation.layout, created_at: Date.now() };
    A.annoDraft = doc;
    if (!doc.notes.length && doc.text) doc.notes = ruleNotes(doc.text, doc.genre);
    const root = h('div');
    view.append(root);
    let hideCats = new Set();
    let aiJob = null;
    const unsub = A.Jobs.on(() => { if (aiJob && !['queued', 'running'].includes(aiJob.status)) { aiJob = null; draw(); } });

    function visible() { return doc.notes.filter((n) => n.start >= 0 && !n.hidden && !hideCats.has(n.category) && (n.pinned || n.level <= doc.density)); }
    function draw() {
      root.innerHTML = '';
      const vis = visible();
      const lost = doc.notes.filter((n) => n.anchor === 'lost');
      const counts = {};
      for (const n of doc.notes) counts[n.category] = (counts[n.category] || 0) + 1;
      const est = estimatePages(doc, vis);
      const left = h('div', { class: 'card' },
        h('div', { class: 'card-h' }, h('h3', null, '지문 넣기'), h('span', { class: 'sub' }, '붙여넣으면 바로 무료 사전 주석')),
        h('div', { class: 'card-b stack' },
          h('div', { class: 'grid2', style: { gridTemplateColumns: '1fr 1fr' } },
            h('div', { class: 'field' }, h('label', null, '제목'), h('input', { class: 'input', value: doc.title || '', oninput: (e) => (doc.title = e.target.value) })),
            h('div', { class: 'field' }, h('label', null, '작가'), h('input', { class: 'input', value: doc.author || '', oninput: (e) => (doc.author = e.target.value) }))),
          h('div', { class: 'field' }, h('label', null, '갈래'), h('select', { class: 'input', onchange: (e) => { doc.genre = e.target.value; rerun(); } }, ['현대시', '고전 시가', '소설', '비문학'].map((g) => h('option', { selected: doc.genre === g }, g)))),
          h('div', { class: 'field' }, h('label', null, '원문'), h('textarea', { class: 'input', rows: 14, 'aria-label': '원문', oninput: (e) => { doc.text = e.target.value; clearTimeout(doc._t); doc._t = setTimeout(() => { doc.genre = detectGenre(doc.text); rerun(); }, 600); } }, doc.text)),
          h('div', { class: 'row' },
            h('button', { class: 'btn', onclick: rerun }, '사전 주석 다시'),
            h('button', { class: 'btn primary', disabled: !!aiJob || !doc.text.trim(), title: s.ai.geminiKey ? '' : '설정 > OCR·AI에 Gemini 키를 넣으면 켜져요', onclick: runAI }, aiJob ? 'AI 주석 중…' : 'AI 주석 추가 (2단계)')),
          !A.Settings.get().ai.geminiKey ? h('div', { class: 'small muted' }, 'AI 주석은 설정에 Gemini 키가 있을 때 동작해요. 지금 보이는 주석은 규칙 기반 1단계(무료)입니다.') : null,
          lost.length ? h('div', { class: 'small', style: { color: 'var(--warn)' } }, `위치를 못 찾은 주석 ${lost.length}개: ${lost.map((n) => '"' + n.quote + '"').join(', ')} (버리지 않고 보관)`) : null));

      const out = h('div', { class: 'anno-out ' + (doc.layout === 'note' ? 'note' : '') });
      const lines = []; let off = 0;
      for (const l of doc.text.split('\n')) { lines.push({ t: l, off }); off += l.length + 1; }
      let no = 0;
      for (const { t, off: o } of lines) {
        if (!t.trim()) { out.append(h('div', { style: { height: '10px' } })); continue; }
        no++;
        const mine = vis.filter((n) => n.start >= o && n.start < o + t.length).sort((a, b) => a.start - b.start);
        const tx = h('div', { class: 'tx' });
        let cur = o;
        for (const n of mine) {
          if (n.start < cur) continue;
          tx.append(document.createTextNode(doc.text.slice(cur, n.start)));
          const e = Math.min(n.end, o + t.length);
          const blank = doc.layout === 'blank' && ['어휘', '출제포인트', '현대어풀이', '구조'].includes(n.category);
          tx.append(h('mark', { class: 'a' + (blank ? ' blank' : ''), style: { borderColor: CAT[n.category], background: s.annotation.autoHighlight && !blank ? CAT[n.category] + '14' : 'transparent' }, title: n.note }, doc.text.slice(n.start, e)));
          cur = e;
        }
        tx.append(document.createTextNode(doc.text.slice(cur, o + t.length)));
        const notesEl = h('div', { class: 'notes' }, mine.map((n) => noteCard(n)));
        out.append(h('div', { class: 'anno-line' }, h('div', { class: 'ln-no' }, no), tx, mine.length || doc.layout !== 'note' ? notesEl : null));
      }
      const right = h('div', { class: 'card' },
        h('div', { class: 'card-h' },
          h('div', { class: 'dens' }, h('span', { class: 'lbl' }, '필기량'), h('input', { type: 'range', min: 1, max: 5, step: 1, value: doc.density, 'aria-label': '필기량', oninput: (e) => { doc.density = +e.target.value; draw(); } }), h('b', { class: 'small' }, `${doc.density} ${DENS[doc.density]}`), h('span', { class: 'tiny muted' }, '바꿔도 다시 생성 안 함 · 연필 0')),
          h('div', { class: 'seg' }, [['wing', '날개형'], ['note', '노트형'], ['blank', '빈칸형']].map(([k, l]) => h('button', { class: doc.layout === k ? 'on' : '', onclick: () => { doc.layout = k; draw(); } }, l)))),
        h('div', { class: 'card-b', style: { paddingBottom: '0' } },
          h('div', { class: 'legend' }, Object.keys(CAT).filter((c) => counts[c]).map((c) => h('button', { class: 'chip btnchip', style: hideCats.has(c) ? { opacity: .4 } : { borderColor: CAT[c], color: CAT[c] }, onclick: () => { hideCats.has(c) ? hideCats.delete(c) : hideCats.add(c); draw(); } }, `${c} ${counts[c]}`))),
          h('div', { class: 'small muted', style: { marginTop: '8px' } }, `표시 ${vis.length} / 전체 ${doc.notes.length} · 예상 분량 B4 2단 약 ${est}쪽`)),
        out,
        h('div', { class: 'card-b row', style: { borderTop: '1px solid var(--line)' } },
          h('span', { class: 'small muted' }, '주석은 원문 위치에 묶여 있어 레이아웃·필기량을 바꿔도 그대로예요.'), h('span', { class: 'spacer' }),
          h('button', { class: 'btn sm', onclick: () => { doc = { id: A.uid('an_'), title: '', author: '', text: '', genre: '비문학', notes: [], density: doc.density, layout: doc.layout, created_at: Date.now() }; A.annoDraft = doc; draw(); } }, '새 지문'),
          h('button', { class: 'btn sm primary', onclick: async () => { doc.saved_at = Date.now(); const { _t, ...clean } = doc; await A.DB.put('annotations', clean); A.toast('자료함에 저장했어요'); } }, '자료함에 저장')));
      root.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, '주석 달기'), h('p', null, '지문을 넣으면 바로 주석이 달립니다. 필기량과 레이아웃(날개형·노트형·빈칸형)을 바꿔도 다시 만들지 않아요.'))),
        h('div', { class: 'anno' }, left, right));
    }
    function noteCard(n) {
      const txt = h('span', { class: 'txt', contenteditable: 'true', 'aria-label': `주석 내용: ${n.quote}`, onblur: (e) => { if (e.target.textContent !== n.note) { n.note = e.target.textContent; n.source = 'teacher'; } } }, n.note);
      return h('div', { class: 'note' + (n.pinned ? ' pinned' : ''), style: { borderColor: CAT[n.category] } },
        h('span', { class: 'cat', style: { color: CAT[n.category] } }, n.category),
        txt,
        h('span', { class: 'acts' },
          h('button', { title: '고정: 필기량을 내려도 남김', 'aria-label': `${n.pinned ? '고정 해제' : '고정'}: ${n.quote}`, onclick: () => { n.pinned = !n.pinned; draw(); } }, n.pinned ? '고정 해제' : '고정'),
          h('button', { title: '숨기기', 'aria-label': `숨기기: ${n.quote}`, onclick: () => { n.hidden = true; draw(); } }, '숨김')),
        h('span', { class: 'tiny muted', title: '중요도 (1이 가장 중요)' }, 'L' + n.level));
    }
    function rerun() { const keep = doc.notes.filter((n) => n.source !== 'rule'); doc.notes = [...ruleNotes(doc.text, doc.genre), ...keep]; draw(); }
    function runAI() {
      aiJob = A.Jobs.create('annotate', `AI 주석: ${doc.title || '지문'}`, { passage_chars: doc.text.length }, async (ctx) => {
        const add = await aiNotes(doc, ctx);
        const fresh = add.filter((a) => !doc.notes.some((b) => b.start === a.start && b.category === a.category));
        doc.notes.push(...fresh);
        ctx.log('info', `AI 주석 ${fresh.length}개 추가 · 위치 못 찾음 ${fresh.filter((x) => x.anchor === 'lost').length}개 · 유사 매칭 ${fresh.filter((x) => x.anchor === 'fuzzy').length}개`);
        return { added: fresh.length };
      });
      draw();
    }
    draw();
    return { cleanup: unsub };
  });

  function estimatePages(doc, vis) {
    const lines = doc.text.split('\n').length;
    const noteLines = vis.reduce((a, n) => a + Math.ceil((n.note || '').length / 28), 0);
    return Math.max(0.5, Math.round(((lines * 1.4 + noteLines * 0.8) / 110) * 10) / 10);
  }

  // ---------- 주석교재 (요청 2) ----------
  const ROLE_W = { 학교프린트: 1.0, 교사용교과서: 0.9, 기출: 0.9, 자습서: 0.8, 평가문제집: 0.8, 수업필기: 0.7, 기타: 0.6 };
  A.route('textbook', async (view) => {
    const [annos, docs] = await Promise.all([A.DB.all('annotations'), A.DB.all('documents')]);
    const sel = new Set(annos.map((a) => a.id));
    const att = new Set();
    let density = A.Settings.get().annotation.density, target = 0;
    const root = h('div'); view.append(root);
    function draw() {
      root.innerHTML = '';
      const units = annos.filter((a) => sel.has(a.id));
      const per = units.map((u) => ({ u, pages: estimatePages(u, u.notes.filter((n) => n.start >= 0 && !n.hidden && (n.pinned || n.level <= density))) }));
      const total = Math.round(per.reduce((a, x) => a + x.pages, 0) * 10) / 10;
      let fitDensity = density;
      if (target > 0) { for (let d = 5; d >= 1; d--) { const t = units.reduce((a, u) => a + estimatePages(u, u.notes.filter((n) => n.start >= 0 && !n.hidden && (n.pinned || n.level <= d))), 0); if (t <= target) { fitDensity = d; break; } fitDensity = 1; } }
      root.append(
        h('div', { class: 'page-head' }, h('div', null, h('h1', null, '주석교재'), h('p', null, '주석 단 작품을 묶어 교재를 만듭니다. 학교 프린트·교사용 교과서 같은 첨부자료는 역할별 가중치로 반영합니다.'))),
        h('div', { class: 'grid2' },
          h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('h3', null, `작품 ${units.length}개`), h('a', { href: '#/annotate', class: 'small' }, '새 작품 주석 달기')),
            h('div', { class: 'card-b' }, annos.length ? h('table', { class: 'tbl' }, h('tbody', null, annos.map((a) => h('tr', null,
              h('td', null, h('input', { type: 'checkbox', checked: sel.has(a.id), onchange: (e) => { e.target.checked ? sel.add(a.id) : sel.delete(a.id); draw(); } })),
              h('td', null, h('b', null, a.title || '제목 없음'), h('div', { class: 'tiny muted' }, `${a.genre} · 주석 ${a.notes.length}개`)),
              h('td', { class: 'num small' }, (per.find((x) => x.u.id === a.id)?.pages ?? '-') + '쪽'))))) : h('div', { class: 'empty' }, '주석 달기에서 작품을 저장하면 여기서 묶을 수 있어요.'))),
          h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('h3', null, '필기량 = 분량 예산')),
            h('div', { class: 'card-b stack' },
              h('div', { class: 'dens' }, h('span', { class: 'lbl' }, '필기량'), h('input', { type: 'range', min: 1, max: 5, value: density, oninput: (e) => { density = +e.target.value; draw(); } }), h('b', { class: 'small' }, `${density} ${DENS[density]}`)),
              h('div', { class: 'row' }, h('span', { class: 'small' }, '목표 쪽수'), h('input', { class: 'input', type: 'number', min: 0, value: target || '', placeholder: '없음', style: { width: '90px' }, oninput: (e) => { target = +e.target.value || 0; draw(); } }),
                target ? h('span', { class: 'chip ' + (fitDensity === density ? 'ok' : 'warn') }, `맞추려면 필기량 ${fitDensity}`) : null,
                target && fitDensity !== density ? h('button', { class: 'btn sm', onclick: () => { density = fitDensity; draw(); } }, '적용') : null),
              h('div', { class: 'stats' }, h('div', { class: 'stat' }, h('div', { class: 'k' }, '예상 분량 (B4 2단)'), h('div', { class: 'v' }, total + '쪽')), h('div', { class: 'stat' }, h('div', { class: 'k' }, '첨부자료'), h('div', { class: 'v' }, att.size + '개'))),
              h('div', { class: 'small muted' }, '단계별 구성: 1 출제포인트·기출 → 2 +핵심 어휘 → 3 +표현법·화자 → 4 +현대어 풀이·배경 → 5 +문법·첨부자료 전부'))),
          h('div', { class: 'card', style: { gridColumn: '1 / -1' } }, h('div', { class: 'card-h' }, h('h3', null, '첨부자료 (역할별 가중치)'), h('a', { href: '#/exam?mode=text', class: 'small' }, '첨부자료 텍스트화하기')),
            h('div', { class: 'card-b' }, docs.length ? h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['', '자료', '역할', '가중치', '지문 정렬'].map((t) => h('th', null, t)))), h('tbody', null, docs.map((d) => h('tr', null,
              h('td', null, h('input', { type: 'checkbox', checked: att.has(d.id), onchange: (e) => { e.target.checked ? att.add(d.id) : att.delete(d.id); draw(); } })),
              h('td', null, d.title), h('td', null, h('span', { class: 'chip' }, d.role)), h('td', { class: 'num' }, (ROLE_W[d.role] ?? 0.6).toFixed(1)),
              h('td', { class: 'small muted' }, att.has(d.id) ? h('span', { class: 'chip' }, '준비 중') : '-'))))) : h('div', { class: 'empty' }, '시험지 분석·저장에서 프린트나 교재를 텍스트화해 저장하면 첨부자료로 쓸 수 있어요.'),
              h('div', { class: 'row small muted' }, h('span', { class: 'chip' }, '준비 중'), '구조도(시상 전개도·인물 관계도·문단 구조도)와 첨부자료-지문 정렬')))));
    }
    draw();
  });

  A.annotate = { ruleNotes, anchor, detectGenre };
})(window.App);
