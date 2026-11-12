/* 국어 스튜디오 - 주석 달기 (요청 1) + 주석교재 (요청 2, 시연판은 분량 계산·첨부자료 역할까지) */
(function (A) {
  'use strict';
  const { h, esc } = A;
  const CAT = {
    '어휘': '#2563eb', '현대어풀이': '#0891b2', '표현법': '#9333ea', '화자·정서': '#db2777', '인물·사건': '#ea580c',
    '구조': '#16a34a', '배경': '#64748b', '문법': '#0d9488', '출제포인트': '#dc2626', '기출연계': '#b45309',
  };
  // 필기량 20단계: 주석마다 중요도 rank(1~20, 낮을수록 중요)를 두고 rank ≤ 필기량인 것만 표시
  const DMAX = 20;
  const densLabel = (d) => ['핵심만', '간결', '보통', '풍부', '촘촘'][Math.min(4, Math.ceil(d / 4) - 1)];
  const CAT_W = { '출제포인트': 0, '기출연계': 0, '구조': 1, '어휘': 1, '현대어풀이': 1, '화자·정서': 2, '인물·사건': 2, '표현법': 2, '문법': 3, '배경': 3 };
  const rankOf = (n) => n.rank || Math.max(1, Math.min(DMAX, (n.level || 3) * 4 - 2));
  // 같은 level 안에서 갈래 중요도·위치 순으로 4칸에 나눠 rank 부여 (이미 rank가 있으면 유지)
  function assignRanks(notes) {
    const byLevel = {};
    for (const n of notes) if (!n.rank) (byLevel[n.level] = byLevel[n.level] || []).push(n);
    for (const [lv, arr] of Object.entries(byLevel)) {
      arr.sort((a, b) => (CAT_W[a.category] ?? 2) - (CAT_W[b.category] ?? 2) || a.start - b.start);
      arr.forEach((n, i) => { n.rank = Math.min(DMAX, (lv - 1) * 4 + 1 + Math.floor((i * 4) / arr.length)); });
    }
    return notes;
  }
  // 예전(5단계) 자료를 20단계로 옮김
  function normalizeDoc(doc) {
    if (!doc || doc.scale20) return doc;
    if (doc.density && doc.density <= 5) doc.density = Math.min(DMAX, doc.density * 4);
    assignRanks(doc.notes || []);
    doc.scale20 = true;
    return doc;
  }
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
    return assignRanks(notes).sort((a, b) => a.start - b.start || a.rank - b.rank);
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
category는 ${Object.keys(CAT).join(', ')} 중 하나. rank는 중요도 1(시험에 꼭 나오는 핵심)~20(있으면 좋은 보충)이며 주석마다 고르게 퍼뜨릴 것. note는 60자 이내.
JSON {"notes":[{"quote":"…","category":"…","note":"…","rank":1}]} 로만 답하라. 30개 이내.
제목: ${doc.title} ${doc.author ? '/ ' + doc.author : ''}
원문:
${doc.text}`;
    ctx.stage('AI 주석 생성', 30);
    const r = await A.llm.generate({ task: 'annotate', parts: [{ text: prompt }], json: true, maxTokens: 16000 });
    if (A.classifyOutcome(r.finishReason, (r.text || '').length, 0) !== 'ok' || !Array.isArray(r.json?.notes)) { const e = new Error(`AI 주석 실패 (${r.finishReason})`); throw e; }
    ctx.stage('위치 연결', 80);
    return r.json.notes.map((n) => ({ ...anchor(doc.text, n.quote || ''), id: A.uid('n'), quote: n.quote, category: CAT[n.category] ? n.category : '출제포인트', note: String(n.note || '').slice(0, 160), ...(() => { const rk = Math.min(DMAX, Math.max(1, Math.round(+n.rank || (+n.level ? n.level * 4 - 2 : 10)))); return { rank: rk, level: Math.ceil(rk / 4) }; })(), source: 'ai', pinned: false, hidden: false }));
  }

  A.route('annotate', async (view, params) => {
    const s = A.Settings.get();
    let doc = params.id ? await A.DB.get('annotations', params.id) : null;
    if (!doc) doc = A.annoDraft || { id: A.uid('an_'), ...SAMPLE, genre: detectGenre(SAMPLE.text), notes: [], density: s.annotation.density, layout: s.annotation.layout, created_at: Date.now(), scale20: true };
    normalizeDoc(doc);
    A.annoDraft = doc;
    if (!doc.notes.length && doc.text) doc.notes = ruleNotes(doc.text, doc.genre);
    const root = h('div');
    view.append(root);
    let hideCats = new Set();
    let aiJob = null;
    const unsub = A.Jobs.on(() => { if (aiJob && !['queued', 'running'].includes(aiJob.status)) { aiJob = null; draw(); } });

    function visible() { return doc.notes.filter((n) => n.start >= 0 && !n.hidden && !hideCats.has(n.category) && (n.pinned || rankOf(n) <= doc.density)); }
    function setFont(key, v) { const ss = A.Settings.get(); ss.fonts[key] = v; A.Settings.save(ss); }
    function fontBar() {
      const f = A.Settings.get().fonts;
      const step = (key, d, min, max) => h('button', { class: 'btn sm icon-btn', 'aria-label': `${key === 'paperSize' ? '지문' : '주석'} 글자 ${d > 0 ? '크게' : '작게'}`, onclick: () => { const ss = A.Settings.get(); ss.fonts[key] = Math.max(min, Math.min(max, (ss.fonts[key] || 0) + d)); A.Settings.save(ss); draw(); } }, d > 0 ? '+' : '−');
      return h('div', { class: 'row small', style: { marginTop: '10px', gap: '6px' } },
        h('span', { class: 'lbl' }, '지문'), A.fonts.select(f.paper, (v) => setFont('paper', v), { label: '지문 글꼴', style: { height: '28px', width: '150px', fontSize: '12px' } }),
        step('paperSize', -1, 11, 28), h('span', { class: 'num' }, f.paperSize + 'px'), step('paperSize', 1, 11, 28),
        h('span', { class: 'lbl', style: { marginLeft: '8px' } }, '주석'), A.fonts.select(f.note, (v) => setFont('note', v), { label: '주석 글꼴', style: { height: '28px', width: '150px', fontSize: '12px' } }),
        step('noteSize', -1, 9, 20), h('span', { class: 'num' }, f.noteSize + 'px'), step('noteSize', 1, 9, 20),
        h('a', { href: '#/settings?s=fonts', class: 'small', style: { marginLeft: '4px' } }, '글꼴 더보기'));
    }
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
          h('div', { class: 'field' }, h('label', null, '원문'), h('textarea', { class: 'input', rows: 14, 'aria-label': '원문', oninput: (e) => { doc.text = e.target.value; if (doc.text !== SAMPLE.text) { if (doc.author === SAMPLE.author) doc.author = ''; if (doc.title === SAMPLE.title) doc.title = ''; } clearTimeout(doc._t); doc._t = setTimeout(() => { doc.genre = detectGenre(doc.text); rerun(); }, 600); } }, doc.text)),
          h('div', { class: 'row' },
            h('button', { class: 'btn', onclick: rerun }, '사전 주석 다시'),
            A.llm.ready('annotate')
              ? h('button', { class: 'btn primary', disabled: !!aiJob || !doc.text.trim(), title: A.llm.label('annotate'), onclick: runAI }, aiJob ? 'AI 주석 중…' : 'AI 주석 추가 (2단계)')
              : h('button', { class: 'btn', title: 'Gemini·OpenAI·Claude 중 하나의 키를 연결하면 AI 주석이 켜져요', onclick: () => A.go('settings', { s: 'ai' }) }, 'AI 연결하기')),
          !A.llm.ready('annotate') ? h('div', { class: 'small muted' }, 'AI 주석은 설정 > AI 모델에서 Gemini·OpenAI·Claude 중 하나를 연결하면 동작해요. 지금 보이는 주석은 규칙 기반 1단계(무료)입니다.') : h('div', { class: 'small muted' }, 'AI 주석: ' + A.llm.label('annotate')),
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
          h('div', { class: 'dens' }, h('span', { class: 'lbl' }, '필기량'), h('input', { type: 'range', min: 1, max: DMAX, step: 1, value: doc.density, 'aria-label': '필기량 (1~20)', oninput: (e) => { doc.density = +e.target.value; draw(); } }), h('b', { class: 'small num', style: { minWidth: '64px' } }, `${doc.density}/${DMAX} · ${densLabel(doc.density)}`), h('span', { class: 'tiny muted' }, '바꿔도 다시 생성 안 함')),
          h('div', { class: 'seg' }, [['wing', '날개형'], ['note', '노트형'], ['blank', '빈칸형']].map(([k, l]) => h('button', { class: doc.layout === k ? 'on' : '', onclick: () => { doc.layout = k; draw(); } }, l)))),
        h('div', { class: 'card-b', style: { paddingBottom: '0' } },
          h('div', { class: 'legend' }, Object.keys(CAT).filter((c) => counts[c]).map((c) => h('button', { class: 'chip btnchip', style: hideCats.has(c) ? { opacity: .4 } : { borderColor: CAT[c], color: CAT[c] }, onclick: () => { hideCats.has(c) ? hideCats.delete(c) : hideCats.add(c); draw(); } }, `${c} ${counts[c]}`))),
          h('div', { class: 'small muted', style: { marginTop: '8px' } }, `표시 ${vis.length} / 전체 ${doc.notes.length} · 예상 분량 B4 2단 약 ${est}쪽`),
          fontBar()),
        out,
        h('div', { class: 'card-b row', style: { borderTop: '1px solid var(--line)' } },
          h('span', { class: 'small muted' }, '주석은 원문 위치에 묶여 있어 레이아웃·필기량을 바꿔도 그대로예요.'), h('span', { class: 'spacer' }),
          h('button', { class: 'btn sm', onclick: () => { doc = { id: A.uid('an_'), title: '', author: '', text: '', genre: '비문학', notes: [], density: doc.density, layout: doc.layout, created_at: Date.now(), scale20: true }; A.annoDraft = doc; draw(); } }, '새 지문'),
          h('button', { class: 'btn sm', disabled: !doc.text.trim(), title: '인쇄하거나 PDF로 저장 (Ctrl+P)', onclick: openPrint, html: A.icon('printer') + '출력 미리보기' }),
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
          h('button', { title: '더 중요하게 (필기량을 낮춰도 보임)', 'aria-label': `더 중요하게: ${n.quote}`, onclick: () => { n.rank = Math.max(1, rankOf(n) - 1); n.level = Math.ceil(n.rank / 4); draw(); } }, '▲'),
          h('button', { title: '덜 중요하게', 'aria-label': `덜 중요하게: ${n.quote}`, onclick: () => { n.rank = Math.min(DMAX, rankOf(n) + 1); n.level = Math.ceil(n.rank / 4); draw(); } }, '▼'),
          h('button', { title: '숨기기', 'aria-label': `숨기기: ${n.quote}`, onclick: () => { n.hidden = true; draw(); } }, '숨김')),
        h('span', { class: 'tiny muted num', title: '중요도 1~20 (낮을수록 중요, 필기량이 이 값 이상이면 보임)' }, rankOf(n)));
    }
    const printSpec = () => annoPrintSpec([{ doc, density: doc.density, hide: hideCats }], doc.title || '주석', doc.layout);
    function openPrint() { if (!doc.text.trim()) return A.toast('원문을 먼저 넣어 주세요', 'bad'); A.print.preview(printSpec()); }
    A.print.register(printSpec);
    function rerun() { const keep = doc.notes.filter((n) => n.source !== 'rule'); doc.notes = [...ruleNotes(doc.text, doc.genre), ...keep]; draw(); }
    function runAI() {
      if (!A.llm.ready('annotate')) { A.toast('AI 키가 연결되지 않았어요. 설정 > AI 모델에서 연결해 주세요.', 'bad'); return A.go('settings', { s: 'ai' }); }
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
    if (A.llm.status.via === 'unknown') A.llm.refresh().then(() => { if (root.isConnected) draw(); });
    return { cleanup: unsub };
  });

  // ---------- 출력 (주석 달기·주석교재 공통) ----------
  const PSIZE = { s: [10, 7.5], m: [11, 8.5], l: [12.5, 9.5] };
  const BLANK_CATS = ['어휘', '출제포인트', '현대어풀이', '구조'];
  function printVisible(u) { return u.doc.notes.filter((n) => n.start >= 0 && !n.hidden && !(u.hide && u.hide.has(n.category)) && (n.pinned || rankOf(n) <= u.density)); }
  function annoPrintSpec(units, title, layout) {
    const S0 = A.Settings.get();
    return {
      title, paper: S0.output.paper || 'B4', papers: ['A4', 'B4'],
      controls: [
        { key: 'layout', label: '모양', value: layout || 'wing', options: [['wing', '날개형'], ['note', '노트형'], ['blank', '빈칸형']] },
        { key: 'size', label: '글자', value: 'm', options: [['s', '작게'], ['m', '보통'], ['l', '크게']] },
      ],
      build(opts, host) {
        const S = A.Settings.get();
        const MM = A.print.MM;
        const [wmm, hmm] = A.print.PAPER[opts.paper];
        const [tp, np] = PSIZE[opts.size] || PSIZE.m;
        const accent = S.brand.accent || '#904ae8';
        const blocks = [];
        units.forEach((u, ui) => {
          const doc = u.doc, vis = printVisible(u), key = [];
          let off = 0, no = 0, bn = 0, first = true;
          for (const t of doc.text.split('\n')) {
            const o = off; off += t.length + 1;
            if (!t.trim()) { if (!first) blocks.push({ el: h('div', { class: 'ps-gap' }), unit: ui }); continue; }
            no++;
            const mine = vis.filter((n) => n.start >= o && n.start < o + t.length).sort((a, b) => a.start - b.start);
            const tx = h('div', { class: 'tx', style: { fontSize: tp + 'pt' } });
            let cur = o;
            for (const n of mine) {
              if (n.start < cur) continue;
              tx.append(document.createTextNode(doc.text.slice(cur, n.start)));
              const e = Math.min(n.end, o + t.length);
              const blank = opts.layout === 'blank' && BLANK_CATS.includes(n.category);
              if (blank) { bn++; key.push(doc.text.slice(n.start, e)); tx.append(h('sup', null, `(${bn})`)); }
              tx.append(h('mark', { class: blank ? 'blank' : '', style: { borderColor: CAT[n.category], background: S.annotation.autoHighlight && !blank ? CAT[n.category] + '14' : 'transparent' } }, doc.text.slice(n.start, e)));
              cur = e;
            }
            tx.append(document.createTextNode(doc.text.slice(cur, o + t.length)));
            const notes = mine.map((n) => h('div', { class: 'ps-note', style: { borderColor: CAT[n.category], fontSize: np + 'pt' } }, h('b', { style: { color: CAT[n.category] } }, n.category), n.note));
            const row = h('div', { class: 'ps-row ' + (opts.layout === 'note' ? 'note' : 'wing') }, h('div', { class: 'no' }, no), tx, opts.layout !== 'note' || notes.length ? h('div', { class: 'ps-notes' }, notes) : null);
            blocks.push({ el: row, unit: ui, newPage: first && ui > 0, label: `${doc.title || '지문'} ${no}행` });
            first = false;
          }
          if (key.length) blocks.push({ el: h('div', { class: 'ps-key' }, h('h4', null, `빈칸 정답 · ${doc.title || '지문'}`), h('ol', null, key.map((k) => h('li', null, k)))), unit: ui, label: '빈칸 정답' });
        });
        const newSheet = (i, b) => {
          const u = units[b ? b.unit : 0], doc = u.doc;
          const head = !b || b.newPage || i === 0;
          const hdr = head
            ? h('div', { class: 'ps-hdr', style: { borderColor: accent } },
              h('div', null, h('div', null, h('span', { class: 't' }, doc.title || '제목 없음'), doc.author ? h('span', { class: 'a' }, doc.author) : null),
                h('div', { class: 's' }, `${doc.genre || ''} · 필기량 ${u.density}/${DMAX} · 주석 ${printVisible(u).length}개`)),
              h('div', { class: 'r' }, S.brand.academyName || '', h('br'), new Date().toLocaleDateString('ko-KR')))
            : h('div', { class: 'ps-hdr cont', style: { borderColor: '#d4d4d8' } }, h('span', { class: 't' }, `${doc.title || '지문'} (계속)`), h('span', { class: 'r' }, S.brand.academyName || ''));
          const body = h('div', { class: 'ps-body' });
          const sheet = h('div', { class: 'sheet ps', style: { width: wmm * MM + 'px', height: hmm * MM + 'px', padding: `${12 * MM}px ${14 * MM}px ${10 * MM}px` } }, hdr, body,
            h('div', { class: 'ftr', style: { marginTop: 3 * MM + 'px' } }, h('span', null, [S.brand.academyName, S.brand.footerText].filter(Boolean).join(' · ')), h('span', { class: 'pn' })));
          host.append(sheet);
          return { sheet, body };
        };
        const r = A.print.paginate(blocks, newSheet);
        r.pages.forEach((p, i) => { p.querySelector('.pn').textContent = `${i + 1} / ${r.pages.length}`; });
        return r;
      },
    };
  }

  function estimatePages(doc, vis) {
    const lines = doc.text.split('\n').length;
    const noteLines = vis.reduce((a, n) => a + Math.ceil((n.note || '').length / 28), 0);
    return Math.max(0.5, Math.round(((lines * 1.4 + noteLines * 0.8) / 110) * 10) / 10);
  }

  // ---------- 주석교재 (요청 2) ----------
  const ROLE_W = { 학교프린트: 1.0, 교사용교과서: 0.9, 기출: 0.9, 자습서: 0.8, 평가문제집: 0.8, 수업필기: 0.7, 기타: 0.6 };
  A.route('textbook', async (view) => {
    const [annos, docs] = await Promise.all([A.DB.all('annotations'), A.DB.all('documents')]);
    annos.forEach(normalizeDoc);
    const sel = new Set(annos.map((a) => a.id));
    const att = new Set();
    let density = A.Settings.get().annotation.density, target = 0;
    const root = h('div'); view.append(root);
    function draw() {
      root.innerHTML = '';
      const units = annos.filter((a) => sel.has(a.id));
      const per = units.map((u) => ({ u, pages: estimatePages(u, u.notes.filter((n) => n.start >= 0 && !n.hidden && (n.pinned || rankOf(n) <= density))) }));
      const total = Math.round(per.reduce((a, x) => a + x.pages, 0) * 10) / 10;
      let fitDensity = density;
      if (target > 0) { for (let d = DMAX; d >= 1; d--) { const t = units.reduce((a, u) => a + estimatePages(u, u.notes.filter((n) => n.start >= 0 && !n.hidden && (n.pinned || rankOf(n) <= d))), 0); if (t <= target) { fitDensity = d; break; } fitDensity = 1; } }
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
              h('div', { class: 'dens' }, h('span', { class: 'lbl' }, '필기량'), h('input', { type: 'range', min: 1, max: DMAX, value: density, 'aria-label': '필기량 (1~20)', oninput: (e) => { density = +e.target.value; draw(); } }), h('b', { class: 'small num' }, `${density}/${DMAX} · ${densLabel(density)}`)),
              h('div', { class: 'row' }, h('span', { class: 'small' }, '목표 쪽수'), h('input', { class: 'input', type: 'number', min: 0, value: target || '', placeholder: '없음', style: { width: '90px' }, oninput: (e) => { target = +e.target.value || 0; draw(); } }),
                target ? h('span', { class: 'chip ' + (fitDensity === density ? 'ok' : 'warn') }, `맞추려면 필기량 ${fitDensity}`) : null,
                target && fitDensity !== density ? h('button', { class: 'btn sm', onclick: () => { density = fitDensity; draw(); } }, '적용') : null),
              h('div', { class: 'row' }, h('button', { class: 'btn sm primary', disabled: !units.length, onclick: () => A.print.preview(bookSpec()), html: A.icon('printer') + '교재 출력 미리보기' }), h('span', { class: 'small muted' }, units.length ? `작품 ${units.length}개를 작품마다 새 쪽에서 시작해요` : '작품을 골라 주세요')),
              h('div', { class: 'stats' }, h('div', { class: 'stat' }, h('div', { class: 'k' }, '예상 분량 (B4 2단)'), h('div', { class: 'v' }, total + '쪽')), h('div', { class: 'stat' }, h('div', { class: 'k' }, '첨부자료'), h('div', { class: 'v' }, att.size + '개'))),
              h('div', { class: 'small muted' }, '단계별 구성: 1~4 핵심만(출제포인트·기출) → 5~8 간결(+핵심 어휘) → 9~12 보통(+표현법·화자) → 13~16 풍부(+현대어 풀이·배경) → 17~20 촘촘(+문법·보충 전부)'))),
          h('div', { class: 'card', style: { gridColumn: '1 / -1' } }, h('div', { class: 'card-h' }, h('h3', null, '첨부자료 (역할별 가중치)'), h('a', { href: '#/exam?mode=text', class: 'small' }, '첨부자료 텍스트화하기')),
            h('div', { class: 'card-b' }, docs.length ? h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['', '자료', '역할', '가중치', '지문 정렬'].map((t) => h('th', null, t)))), h('tbody', null, docs.map((d) => h('tr', null,
              h('td', null, h('input', { type: 'checkbox', checked: att.has(d.id), onchange: (e) => { e.target.checked ? att.add(d.id) : att.delete(d.id); draw(); } })),
              h('td', null, d.title), h('td', null, h('span', { class: 'chip' }, d.role)), h('td', { class: 'num' }, (ROLE_W[d.role] ?? 0.6).toFixed(1)),
              h('td', { class: 'small muted' }, att.has(d.id) ? h('span', { class: 'chip' }, '준비 중') : '-'))))) : h('div', { class: 'empty' }, '시험지 분석·저장에서 프린트나 교재를 텍스트화해 저장하면 첨부자료로 쓸 수 있어요.'),
              h('div', { class: 'row small muted' }, h('span', { class: 'chip' }, '준비 중'), '구조도(시상 전개도·인물 관계도·문단 구조도)와 첨부자료-지문 정렬')))));
    }
    const bookSpec = () => { const units = annos.filter((a) => sel.has(a.id)).map((d) => ({ doc: d, density })); return annoPrintSpec(units, `주석교재 · 작품 ${units.length}개`, A.Settings.get().annotation.layout); };
    A.print.register(() => { if (!sel.size) A.toast('작품을 골라 주세요', 'bad'); return bookSpec(); });
    draw();
  });

  A.annotate = { ruleNotes, anchor, detectGenre, printSpec: annoPrintSpec };
})(window.App);
