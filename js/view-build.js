/* 국어 스튜디오 - 시험지 제작 (요청 3 + 6): 소재 → 설계도 → (생성) → (검토) → 출력 */
(function (A) {
  'use strict';
  const { h } = A;
  const SIM = { // DB set_sim_targets 와 같은 값 (원본 기출 대비)
    '동형': [0.70, 1.00, 0.35, '구조는 같게, 표현은 새로'],
    '선지변형': [0.80, 1.00, 0.60, '발문은 그대로, 선지만 새로'],
    '보기선지변형': [0.60, 0.85, 0.45, '<보기>와 선지를 바꿈'],
    '재구성': [0.40, 0.70, 0.30, '무엇을 판단하게 할지까지 새로 구성'],
    '신규': [0.00, 0.50, 0.30, '원본과 다른 새 문항'],
  };
  const TRAPS = ['부분일치', '범위확대·축소', '인과전도', '주체혼동', '개념혼동', '보기오적용', '근거없음', '어휘착각'];
  const AXIS = { FACT: '세부 정보 일치 판단', INFER: '전제·함축 추론', APPLY: '<보기> 사례에 원리 적용', VOCAB: '문맥에 맞는 의미 판단', STRUCT: '서술 방식 파악', EXPR: '표현 효과 판단', CHAR: '인물·화자의 태도 파악', COMPARE: '두 대상의 공통점·차이점', CRIT: '관점에 따른 비판·평가', GRAM: '문법 개념 적용', MEDIA: '매체 표현 의도', SPEECH: '말하기 전략 판단', WRITE: '고쳐쓰기 적절성' };
  const DIFF = ['하', '중', '상', '최상'];
  const CH = ['①', '②', '③', '④', '⑤'];

  function planAnswers(n, seed) {
    let x = (seed + 7) * 9301 + 49297;
    const rnd = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
    const pool = []; for (let i = 0; i < n; i++) pool.push((i % 5) + 1);
    const res = [];
    while (pool.length) {
      let k, tries = 0;
      do { k = Math.floor(rnd() * pool.length); tries++; } while (res.length >= 2 && res[res.length - 1] === pool[k] && res[res.length - 2] === pool[k] && tries <= 20);
      res.push(pool.splice(k, 1)[0]);
    }
    return res;
  }

  A.route('build', async (view, params) => {
    const docs = (await A.DB.all('documents')).filter((d) => d.structure?.items?.length);
    let b = params.id ? await A.DB.get('builds', params.id) : null;
    if (!b) b = A.buildDraft || {
      id: A.uid('bd_'), title: '변형 시험지', source: params.doc ? 'past' : 'passage', docId: params.doc || (docs[0]?.id ?? null),
      passage: '식물은 빛 에너지를 이용하여 이산화 탄소와 물로 포도당을 만든다. 이 과정을 광합성이라 하며, 엽록체에서 일어난다.\n\n광합성으로 만들어진 포도당은 생장에 쓰이거나 녹말의 형태로 저장된다.\n\n한편 빛의 세기가 일정 수준을 넘으면 광합성 속도는 더 이상 증가하지 않는다. 이 지점을 광포화점이라 한다.\n\n광포화점은 식물마다 다르며, 그늘에서 자라는 식물은 대체로 광포화점이 낮다.',
      mode: '신규', rounds: 3, perRound: 5, types: ['FACT', 'INFER', 'APPLY', 'VOCAB'], curve: 'up', balance: true, slots: [], created_at: Date.now(),
    };
    if (params.doc) { b.source = 'past'; b.docId = params.doc; if (b.mode === '신규') b.mode = '동형'; }
    A.buildDraft = b;
    let tabRound = 1;
    const root = h('div'); view.append(root);

    const paragraphs = () => (b.passage || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    function sourceItems() {
      const d = docs.find((x) => x.id === b.docId);
      if (!d) return { usable: [], excluded: [] };
      const usable = d.structure.items.filter((i) => !i.needs_review || i.teacher_confirmed);
      return { usable, excluded: d.structure.items.filter((i) => i.needs_review && !i.teacher_confirmed), doc: d };
    }
    function diffFor(j, n) {
      if (b.curve === 'flat') return '중';
      if (b.curve === 'up') return DIFF[Math.min(3, Math.floor((j / Math.max(1, n - 1)) * 3.999))];
      return null;
    }
    function plan() {
      const old = b.slots.filter((s) => s.locked);
      const slots = [];
      for (let r = 1; r <= b.rounds; r++) {
        if (b.source === 'past') {
          const { usable } = sourceItems();
          const ans = planAnswers(usable.length, r);
          usable.forEach((it, j) => slots.push(old.find((o) => o.round === r && o.slot === j + 1) || { round: r, slot: j + 1, ref: `원본 ${it.number}번`, evidence: it.set != null ? `지문 ${it.set + 1}` : '-', type: it.item_type, axis: AXIS[it.item_type] || '', trap: TRAPS[(j + r) % TRAPS.length], diff: diffFor(j, usable.length) || (it.domain === 'GRAMMAR' ? '상' : '중'), answer: b.balance ? ans[j] : null, locked: false }));
        } else {
          const ps = paragraphs();
          const n = b.perRound;
          const ans = planAnswers(n, r);
          for (let j = 0; j < n; j++) {
            const p = ps.length ? ((j + (r - 1) * Math.max(1, Math.floor(ps.length / 2))) % ps.length) + 1 : 1;
            const type = b.types.length ? b.types[(j + r - 1) % b.types.length] : 'FACT';
            slots.push(old.find((o) => o.round === r && o.slot === j + 1) || { round: r, slot: j + 1, ref: '-', evidence: `문단 ${p}`, type, axis: AXIS[type] || '', trap: TRAPS[(j * 3 + r) % TRAPS.length], diff: diffFor(j, n) || '중', answer: b.balance ? ans[j] : null, locked: false });
          }
        }
      }
      b.slots = slots;
    }
    if (!b.slots.length) plan();

    function stats(r) {
      const ss = b.slots.filter((s) => s.round === r);
      const dist = [1, 2, 3, 4, 5].map((k) => ss.filter((s) => s.answer === k).length);
      let run = 1, maxRun = 1;
      for (let i = 1; i < ss.length; i++) { run = ss[i].answer && ss[i].answer === ss[i - 1].answer ? run + 1 : 1; maxRun = Math.max(maxRun, run); }
      const ev = {}; ss.forEach((s) => (ev[s.evidence] = (ev[s.evidence] || 0) + 1));
      return { dist, maxRun, ev, n: ss.length };
    }

    function draw() {
      root.innerHTML = '';
      const { usable, excluded } = sourceItems();
      const [smin, smax, surf, desc] = SIM[b.mode];
      const st = stats(tabRound);
      const steps = h('div', { class: 'steps' },
        [['① 소재', b.source === 'past' ? '기출·분석 결과' : '지문'], ['② 설계도', '무료 · 지금 단계'], ['③ 생성', '서버 큐 · 칸별'], ['④ 검토', '풀이 검증 · 후보 비교'], ['⑤ 출력', '디자인 작업대']].map(([t, s], i) => h('div', { class: 'step' + (i === 1 ? ' on' : i > 1 ? ' off' : '') }, h('b', null, t), h('span', null, s))));
      const srcCard = h('div', { class: 'card' },
        h('div', { class: 'card-h' }, h('h3', null, '① 소재와 모드'), h('div', { class: 'seg' }, [['passage', '지문 변형'], ['past', '기출 변형·동형']].map(([k, l]) => h('button', { class: b.source === k ? 'on' : '', onclick: () => { b.source = k; if (k === 'past' && b.mode === '신규') b.mode = '동형'; plan(); draw(); } }, l)))),
        h('div', { class: 'card-b stack' },
          h('div', { class: 'field' }, h('label', null, '시험지 제목'), h('input', { class: 'input', value: b.title, oninput: (e) => (b.title = e.target.value) })),
          b.source === 'passage'
            ? h('div', { class: 'field' }, h('label', null, `지문 (빈 줄로 문단 구분 · 현재 ${paragraphs().length}문단)`), h('textarea', { class: 'input', rows: 7, onchange: (e) => { b.passage = e.target.value; plan(); draw(); } }, b.passage))
            : h('div', { class: 'field' }, h('label', null, '원본 (자료함의 구조화·분석 결과)'),
                docs.length ? h('select', { class: 'input', onchange: (e) => { b.docId = e.target.value; plan(); draw(); } }, docs.map((d) => h('option', { value: d.id, selected: d.id === b.docId }, `${d.title} · ${d.structure.items.length}문항`))) : h('div', { class: 'small muted' }, '자료함에 구조화한 시험지가 없어요. 시험지 분석·저장에서 먼저 분석해 주세요.'),
                docs.length ? h('div', { class: 'small muted' }, `사용 ${usable.length}문항${excluded.length ? ` · 검수 필요로 제외 ${excluded.length}문항 (${excluded.map((i) => i.number + '번').join(', ')}) — 분석 화면에서 "확인함"을 누르면 포함돼요` : ''}`) : null),
          h('div', { class: 'grid2', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' } },
            h('div', { class: 'field' }, h('label', null, '유사도 모드'), h('select', { class: 'input', onchange: (e) => { b.mode = e.target.value; draw(); } }, Object.keys(SIM).map((m) => h('option', { value: m, selected: b.mode === m }, m)))),
            h('div', { class: 'field' }, h('label', null, '회차'), h('input', { class: 'input', type: 'number', min: 1, max: 20, value: b.rounds, onchange: (e) => { b.rounds = Math.max(1, Math.min(20, +e.target.value || 1)); tabRound = Math.min(tabRound, b.rounds); plan(); draw(); } })),
            b.source === 'passage' ? h('div', { class: 'field' }, h('label', null, '회차당 문항'), h('input', { class: 'input', type: 'number', min: 1, max: 15, value: b.perRound, onchange: (e) => { b.perRound = Math.max(1, Math.min(15, +e.target.value || 1)); plan(); draw(); } })) : null,
            h('div', { class: 'field' }, h('label', null, '난도 흐름'), h('select', { class: 'input', onchange: (e) => { b.curve = e.target.value; plan(); draw(); } }, [['up', '쉬움 → 어려움'], ['flat', '고르게'], ['source', '원본 따름']].map(([v, l]) => h('option', { value: v, selected: b.curve === v }, l))))),
          b.source === 'passage' ? h('div', null, h('div', { class: 'lbl', style: { marginBottom: '6px' } }, '발문 유형 (회차마다 순서를 돌려 배치)'), h('div', { class: 'row' }, Object.entries(A.structure.TYPE).map(([k, l]) => h('button', { class: 'chip btnchip' + (b.types.includes(k) ? ' on' : ''), onclick: () => { b.types = b.types.includes(k) ? b.types.filter((x) => x !== k) : [...b.types, k]; plan(); draw(); } }, l)))) : null,
          h('label', { class: 'row small' }, h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: b.balance, onchange: (e) => { b.balance = e.target.checked; plan(); draw(); } }), h('span')), '정답 번호 균형 (1~5 고르게, 같은 번호 3연속 금지)')));

      const simCard = h('div', { class: 'card' },
        h('div', { class: 'card-h' }, h('h3', null, '유사도 기준'), h('span', { class: 'sub' }, desc)),
        h('div', { class: 'card-b stack' },
          simChart(b.mode),
          h('dl', { class: 'kv' },
            h('dt', null, '원본 대비 구조'), h('dd', { class: 'num' }, `${smin.toFixed(2)} ~ ${smax.toFixed(2)}`),
            h('dt', null, '원본 대비 표현'), h('dd', { class: 'num' }, `${surf.toFixed(2)} 이하`),
            h('dt', null, '세트 안 두 문항'), h('dd', null, '표현 0.60 이하 · 근거 겹침 0.50 이하'),
            h('dt', null, '지난 문항'), h('dd', null, '같은 지문으로 만든 문항 은행과도 비교')),
          h('div', { class: 'small muted' }, '구조 = 발문 유형 0.4 + 발문 뼈대 0.3 + 근거 겹침 0.3 · 표현 = max(본문 임베딩, 선지 3-gram)')));

      const roundTabs = h('div', { class: 'res-tabs' }, Array.from({ length: b.rounds }, (_, i) => h('button', { class: tabRound === i + 1 ? 'on' : '', onclick: () => { tabRound = i + 1; draw(); } }, `${i + 1}회차`)));
      const sel = (val, opts, on) => h('select', { class: 'cell-in', onchange: (e) => on(e.target.value) }, opts.map(([v, l]) => h('option', { value: v, selected: String(val) === String(v) }, l)));
      const rows = b.slots.filter((s) => s.round === tabRound).map((s) => h('tr', null,
        h('td', { class: 'num' }, s.slot),
        h('td', { class: 'small' }, s.evidence, s.ref !== '-' ? h('div', { class: 'tiny muted' }, s.ref) : null),
        h('td', null, sel(s.type, Object.entries(A.structure.TYPE), (v) => { s.type = v; s.axis = AXIS[v] || s.axis; s.locked = true; draw(); })),
        h('td', null, h('input', { class: 'cell-in', value: s.axis, oninput: (e) => { s.axis = e.target.value; s.locked = true; } })),
        h('td', null, sel(s.trap, TRAPS.map((t) => [t, t]), (v) => { s.trap = v; s.locked = true; })),
        h('td', null, sel(s.diff, DIFF.map((d) => [d, d]), (v) => { s.diff = v; s.locked = true; })),
        h('td', null, sel(s.answer ?? '', [['', '자유'], ...CH.map((c, i) => [i + 1, c])], (v) => { s.answer = v ? +v : null; s.locked = true; draw(); })),
        h('td', null, h('label', { class: 'row tiny', title: '고정한 칸은 다시 배치해도 그대로' }, h('input', { type: 'checkbox', checked: s.locked, onchange: (e) => { s.locked = e.target.checked; } }), '고정'))));
      const maxD = Math.max(1, ...st.dist);
      const planCard = h('div', { class: 'card' },
        h('div', { class: 'card-h' }, h('div', null, h('h3', null, '② 설계도'), h('div', { class: 'sub' }, `${b.rounds}회차 · 총 ${b.slots.length}칸 · 칸마다 근거·판단축·함정·목표 정답을 먼저 정합니다`)),
          h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { plan(); draw(); A.toast('고정하지 않은 칸을 다시 배치했어요'); } }, '다시 배치'),
            h('button', { class: 'btn sm', onclick: () => A.download(`${b.title}-설계도.json`, JSON.stringify({ title: b.title, mode: b.mode, targets: SIM[b.mode].slice(0, 3), slots: b.slots }, null, 2), 'application/json') }, 'JSON'),
            h('button', { class: 'btn sm primary', onclick: async () => { b.saved_at = Date.now(); await A.DB.put('builds', b); A.toast('설계도를 자료함에 저장했어요'); } }, '설계도 저장'))),
        roundTabs,
        h('div', { class: 'card-b' },
          h('div', { class: 'grid2', style: { marginBottom: '14px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' } },
            h('div', null, h('div', { class: 'lbl' }, `정답 분포 · 최대 연속 ${st.maxRun}번 ${st.maxRun >= 3 ? '(주의)' : '(통과)'}`),
              h('div', { class: 'row', style: { alignItems: 'flex-end', gap: '10px', height: '64px', marginTop: '6px' } }, st.dist.map((c, i) => h('div', { style: { textAlign: 'center', fontSize: '11px' } }, h('div', { style: { width: '26px', height: Math.max(3, (c / maxD) * 44) + 'px', background: 'var(--accent)', borderRadius: '4px 4px 1px 1px', opacity: c ? 1 : 0.2 } }), CH[i] + ' ' + c)))),
            h('div', null, h('div', { class: 'lbl' }, '근거 범위 분포'), h('div', { class: 'row', style: { marginTop: '8px' } }, Object.entries(st.ev).map(([k, v]) => h('span', { class: 'chip' + (v > 1 && b.source === 'passage' && st.n <= paragraphs().length ? ' warn' : '') }, `${k} × ${v}`))))),
          h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['칸', '근거', '발문 유형', '판단축', '함정', '난도', '목표 정답', ''].map((t) => h('th', null, t)))), h('tbody', null, rows))));

      const nextCard = h('div', { class: 'card' },
        h('div', { class: 'card-h' }, h('h3', null, '③ 생성 · ④ 검토'), h('span', { class: 'chip' }, '준비 중')),
        h('div', { class: 'card-b stack' },
          h('div', { class: 'small' }, `견적: ${b.slots.length}칸 · 검증 실패로 버린 후보는 차감하지 않음`),
          h('div', { class: 'small muted' }, '칸마다 생성 → 자동 검증(선지 5개·정답 범위·중복 선지, 다른 모델의 풀이 검증, 근거 인용 대조, 정답 길이 편향) → 유사도 기준 통과 시 자동 확정, 아니면 후보 비교 화면. 앞 회차의 (발문 뼈대, 근거, 정답 진술)을 "이미 사용됨"으로 넘겨 회차 간 중복을 막습니다.'),
          h('div', { class: 'row' }, h('span', { class: 'chip' }, '준비 중'), h('a', { href: '#/settings?s=ocr', class: 'small' }, '연결 상태 보기'))));
      root.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, '시험지 제작'), h('p', null, '지문이나 기출 문항으로 변형 시험지를 만듭니다. 생성 전에 설계도로 회차 간 중복과 정답 쏠림을 먼저 막습니다.'))),
        steps, h('div', { class: 'grid2', style: { marginBottom: '16px' } }, srcCard, simCard), h('div', { class: 'stack' }, planCard, nextCard));
    }

    function simChart(mode) {
      const W = 300, H = 170, L = 30, B = 24, T = 6, R = 6;
      const x = (v) => L + v * (W - L - R), y = (v) => T + (1 - v) * (H - T - B);
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', '100%'); svg.setAttribute('height', H);
      let s = '';
      for (const v of [0, 0.5, 1]) s += `<line x1="${x(0)}" x2="${x(1)}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 4}" y="${y(v) + 3}" font-size="9" text-anchor="end" fill="var(--muted)">${v}</text><text x="${x(v)}" y="${H - 8}" font-size="9" text-anchor="middle" fill="var(--muted)">${v}</text>`;
      for (const [m, [a, bb, c]] of Object.entries(SIM)) {
        const on = m === mode;
        s += `<rect x="${x(0)}" y="${y(bb)}" width="${x(c) - x(0)}" height="${y(a) - y(bb)}" fill="${on ? 'var(--accent)' : 'var(--muted)'}" fill-opacity="${on ? 0.18 : 0.04}" stroke="${on ? 'var(--accent)' : 'var(--line-2)'}"/>`;
        if (on) s += `<text x="${x(c) - 4}" y="${y(a) - 4}" font-size="10" text-anchor="end" fill="var(--accent)" font-weight="700">${m}</text>`;
      }
      s += `<text x="${x(1)}" y="${H}" font-size="9" text-anchor="end" fill="var(--muted)">표현 유사도 →</text><text x="${L + 3}" y="${T + 9}" font-size="9" fill="var(--muted)">↑ 구조</text>`;
      svg.innerHTML = s;
      return svg;
    }
    draw();
    A.build = { state: b, plan, stats };
  });
  A.planAnswers = planAnswers;
})(window.App);
