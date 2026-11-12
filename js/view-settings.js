/* 국어 스튜디오 - 설정 (요청 11: 왼쪽 내비 + 저장 바 하나 + 변경 표시 + 기록) */
(function (A) {
  'use strict';
  const { h, esc } = A;
  const SECTIONS = [
    ['account', '계정'], ['brand', '학원 브랜드'], ['output', '출력 기본값'], ['fonts', '글꼴'], ['annotation', '주석 기본값'],
    ['ai', 'AI 모델'], ['ocr', '글자 읽기(OCR)'], ['agent', 'API·에이전트'], ['notify', '알림'], ['history', '변경 기록'], ['danger', '데이터 관리'],
  ];
  const get = (o, path) => path.split('.').reduce((a, k) => a?.[k], o);
  const set = (o, path, v) => { const ks = path.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };

  A.route('settings', (view, params) => {
    let saved = A.Settings.get();
    let draft = A.clone(saved);
    const root = h('div');
    view.append(root);
    const changedPaths = () => {
      const out = [];
      (function walk(a, b, p) {
        for (const k of Object.keys(b)) {
          const path = p ? p + '.' + k : k;
          if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) walk(a?.[k] || {}, b[k], path);
          else if (JSON.stringify(a?.[k]) !== JSON.stringify(b[k])) out.push(path);
        }
      })(saved, draft, '');
      return out;
    };

    function row(path, title, desc, control) {
      const r = h('div', { class: 's-row', 'data-path': path }, h('div', null, h('b', null, title), desc ? h('span', null, desc) : null), h('div', { class: 'ctl' }, control));
      r.querySelectorAll('.switch, .ctl > input, .ctl > select, .ctl > .seg').forEach((el) => el.setAttribute('aria-label', title));
      return r;
    }
    const toggle = (path) => h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: !!get(draft, path), onchange: (e) => update(path, e.target.checked) }), h('span'));
    const text = (path, ph, type = 'text') => h('input', { class: 'input', type, value: get(draft, path) ?? '', placeholder: ph || '', style: { width: '100%' }, oninput: (e) => update(path, type === 'number' ? +e.target.value : e.target.value) });
    const select = (path, opts) => h('select', { class: 'input', onchange: (e) => update(path, isNaN(+e.target.value) ? e.target.value : +e.target.value) }, opts.map(([v, l]) => h('option', { value: v, selected: String(get(draft, path)) === String(v) }, l)));
    const seg = (path, opts) => h('div', { class: 'seg' }, opts.map(([v, l]) => h('button', { class: get(draft, path) === v ? 'on' : '', onclick: () => { update(path, v); draw(); } }, l)));

    function update(path, v) { set(draft, path, v); refreshBar(); }
    function refreshBar() {
      const ch = changedPaths();
      root.querySelectorAll('.s-row').forEach((r) => r.classList.toggle('changed', ch.some((p) => p === r.dataset.path || p.startsWith(r.dataset.path + '.'))));
      const bar = root.querySelector('.savebar');
      if (bar) { bar.classList.toggle('show', ch.length > 0); bar.querySelector('.cnt').textContent = `변경 ${ch.length}개`; }
    }

    function chainEditor() {
      const order = draft.ocr.chain;
      const list = h('div', { class: 'chain-list' });
      order.forEach((e, i) => {
        const off = draft.ocr.disabled.includes(e);
        list.append(h('div', { class: 'chain-item', style: off ? { opacity: .5 } : null },
          h('span', { class: 'i' }, i + 1), h('span', { style: { flex: 1 } }, A.ENGINE_LABEL[e], e === 'gemini' ? h('span', { class: 'muted tiny' }, '  ' + (A.llm.ready('ocr') ? A.llm.label('ocr') : '연결된 AI 없으면 건너뜀')) : null),
          h('button', { class: 'btn sm ghost', disabled: i === 0, 'aria-label': '위로', onclick: () => { const a = order.slice(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; update('ocr.chain', a); draw(); } }, '↑'),
          h('button', { class: 'btn sm ghost', disabled: i === order.length - 1, 'aria-label': '아래로', onclick: () => { const a = order.slice(); [a[i + 1], a[i]] = [a[i], a[i + 1]]; update('ocr.chain', a); draw(); } }, '↓'),
          e === 'manual' ? h('span', { class: 'tiny muted' }, '항상 마지막') : h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: !off, onchange: (ev) => { const d = new Set(draft.ocr.disabled); ev.target.checked ? d.delete(e) : d.add(e); update('ocr.disabled', [...d]); draw(); } }), h('span'))));
      });
      return list;
    }

    function draw() {
      root.innerHTML = '';
      const hist = A.Settings.history();
      const sec = (id, title, desc, ...rows) => h('section', { class: 's-sec', id: 's-' + id }, h('h2', null, title), h('p', null, desc), h('div', { class: 's-group' + (id === 'danger' ? ' danger-zone' : '') }, rows));
      const content = h('div', null,
        sec('account', '계정', '자료와 작업 기록에 표시할 정보입니다.',
          row('account.name', '이름', '자료 머리말과 작업 기록에 표시', text('account.name', '예: 홍길동')),
          row('account.email', '이메일', '작업 완료 알림 받을 주소', text('account.email', 'name@example.com', 'email'))),
        sec('brand', '학원 브랜드', '모든 출력물에 기본으로 들어가는 정보입니다.',
          row('brand.academyName', '학원명', '머리 배너·꼬리말 기본 문구', text('brand.academyName')),
          row('brand.footerText', '꼬리말 문구', '예: 수업용 자체 제작 자료', text('brand.footerText')),
          row('brand.accent', '강조색', '화면과 출력물의 기본 색', h('div', { class: 'row' }, h('input', { type: 'color', value: draft.brand.accent, oninput: (e) => update('brand.accent', e.target.value), style: { width: '40px', height: '32px', border: '0', background: 'none' } }), h('code', { class: 'small' }, draft.brand.accent)))),
        sec('output', '출력 기본값', '문제지·교재를 출력할 때 먼저 적용됩니다. 출력할 때 바꿀 수도 있어요.',
          row('output.paper', '기본 용지', '', seg('output.paper', [['A4', 'A4'], ['B4', 'B4']])),
          row('output.answerPlacement', '정답 위치', '문항 뒤 미주 또는 시험지 끝', seg('output.answerPlacement', [['inline', '문항 뒤'], ['end', '시험지 끝']])),
          row('output.quickAnswers', '빠른 정답', '해설 앞에 한 줄 5문항 정답표', toggle('output.quickAnswers')),
          row('output.promptTitles', '유형 제목 표시', '문제 묶음 앞에 유형명', toggle('output.promptTitles'))),
        fontsSection(sec),
        sec('annotation', '주석 기본값', '주석 달기와 주석교재의 시작값입니다.',
          row('annotation.density', '필기량', '1 핵심만 ~ 20 촘촘 · 바꿔도 다시 생성하지 않아요', select('annotation.density', Array.from({ length: 20 }, (_, i) => [i + 1, `${i + 1} · ${['핵심만', '간결', '보통', '풍부', '촘촘'][Math.floor(i / 4)]}`]))),
          row('annotation.layout', '레이아웃', '', seg('annotation.layout', [['wing', '날개형'], ['note', '노트형'], ['blank', '빈칸형']])),
          row('annotation.autoHighlight', '형광펜 자동 표시', '주석이 붙은 구절에 색 밑줄', toggle('annotation.autoHighlight'))),
        aiSection(sec),
        sec('ocr', '글자 읽기(OCR)', '쪽마다 위에서부터 시도하고, 저작권 차단·잘림·품질 낮음이면 다음 엔진으로 넘어갑니다.',
          row('ocr.chain', '글자 읽기 대체 순서', 'PDF 글자 레이어·HWPX는 항상 먼저 직접 읽음(비용 0)', chainEditor()),
          row('ocr.lowConf', '의심 줄 기준', '신뢰도가 이보다 낮으면 교정 화면에서 노란색', select('ocr.lowConf', [[60, '60'], [70, '70'], [80, '80'], [90, '90']])),
          row('ocr.enhance', '사진 자동 보정', '회색조·명암 늘리기', toggle('ocr.enhance'))),
        sec('agent', 'API·에이전트', '화면에서 하는 모든 일은 같은 계약의 API로도 할 수 있습니다.',
          row('agent.api', '브라우저 API', '에이전트가 이 페이지에서 바로 호출', h('code', { class: 'small' }, 'window.App.api')),
          row('agent.keys', 'AI 키 · 월 사용 한도', 'Gemini·OpenAI·Claude 키, 월 한도, 즉시 폐기는 AI 모델 구역에 있어요', h('a', { href: '#/settings?s=ai', class: 'btn sm', onclick: (e) => { e.preventDefault(); jump('ai'); } }, 'AI 모델로')),
          row('agent.llm', 'AI 호출 API', '에이전트도 같은 연결로 부름: App.api.llm.generate({ provider, parts, json })', h('code', { class: 'small' }, 'POST /api/llm')),
          row('agent.mcp', 'MCP 도구', 'quote, ocr_document, analyze_exam, annotate_passage, build_exam, render_document', h('span', { class: 'chip' }, '준비 중'))),
        sec('notify', '알림', '',
          row('notify.jobDone', '작업 완료 알림', '작업 큐의 작업이 끝나면 화면 아래에 표시', toggle('notify.jobDone'))),
        sec('history', '변경 기록', '저장할 때마다 무엇이 바뀌었는지 남깁니다.',
          hist.length ? hist.slice(0, 8).map((e) => h('div', { class: 's-row' }, h('div', null, h('b', null, A.fmtDate(e.at)), h('span', null, e.diff.map((d) => `${d.path}: ${JSON.stringify(d.from)} → ${JSON.stringify(d.to)}`).join(' · '))), h('div'))) : h('div', { class: 's-row' }, h('div', null, h('span', null, '아직 기록이 없어요.')), h('div'))),
        sec('danger', '데이터 관리', '자료는 이 브라우저에만 있습니다. 브라우저 기록을 지우면 사라지니 자주 백업하세요.',
          row('danger.backup', '전체 내보내기', A.Backup.last() ? '마지막 백업: ' + A.fmtDate(A.Backup.last()) : '아직 백업한 적이 없어요', h('button', { class: 'btn sm', onclick: async () => { await A.Backup.export(); draw(); } }, '백업 파일 받기')),
          row('danger.restore', '파일에서 복원', '백업 파일의 자료를 이 브라우저에 더합니다', restoreButton()),
          row('danger.lib', '자료함 비우기', '이 브라우저에 저장한 시험지·주석·설계도를 모두 삭제', h('button', { class: 'btn sm danger', onclick: wipeAll }, '모두 삭제')),
          row('danger.reset', '설정 초기화', '모든 설정을 처음 값으로', h('button', { class: 'btn sm danger', onclick: () => { draft = A.Settings.defaults(); draw(); refreshBar(); } }, '초기화'))),
        h('div', { class: 'savebar', role: 'region', 'aria-label': '저장 바' },
          h('span', { class: 'cnt' }, ''),
          h('div', { class: 'row' },
            h('button', { class: 'btn', onclick: () => { draft = A.clone(saved); draw(); } }, '되돌리기'),
            h('button', { class: 'btn primary', onclick: () => { const diff = A.Settings.save(draft); saved = A.Settings.get(); draft = A.clone(saved); A.toast(`설정 ${diff.length}개를 저장했어요`); draw(); } }, '저장'))));
      const nav = h('nav', { class: 's-nav', 'aria-label': '설정 구역' }, SECTIONS.map(([id, label]) => h('a', { href: '#/settings?s=' + id, 'data-s': id, onclick: (e) => { e.preventDefault(); history.replaceState(null, '', '#/settings?s=' + id); jump(id); } }, label)));
      root.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, '설정'), h('p', null, '바꾼 항목은 "변경됨"으로 표시되고, 아래 저장 바에서 한 번에 저장합니다.'))),
        h('div', { class: 'settings' }, nav, content));
      refreshBar();
    }
    // ---------- 글꼴 구역 ----------
    let localList = null;
    function fontsSection(sec) {
      const f = draft.fonts;
      const pick = (role) => A.fonts.select(f[role], (v) => { update('fonts.' + role, v); draw(); }, { label: A.fonts.ROLES[role], style: { width: '100%' } });
      const size = (key, min, max) => h('div', { class: 'row', style: { flexWrap: 'nowrap' } },
        h('button', { class: 'btn sm icon-btn', 'aria-label': '작게', onclick: () => { update('fonts.' + key, Math.max(min, f[key] - 1)); draw(); } }, '−'),
        h('span', { class: 'num', style: { minWidth: '44px', textAlign: 'center' } }, f[key] + 'px'),
        h('button', { class: 'btn sm icon-btn', 'aria-label': '크게', onclick: () => { update('fonts.' + key, Math.min(max, f[key] + 1)); draw(); } }, '+'));
      const preview = h('div', { style: { border: '1px solid var(--line)', borderRadius: '8px', padding: '14px 16px', background: '#fff', color: '#18181b', width: '100%' } },
        h('div', { style: { fontFamily: A.fonts.stackOf(f.paper, 'paper'), fontSize: f.paperSize + 'px', lineHeight: 2 } }, '나 보기가 역겨워 가실 때에는 말없이 고이 보내 드리우리다.'),
        h('div', { style: { fontFamily: A.fonts.stackOf(f.note, 'note'), fontSize: f.noteSize + 'px', borderLeft: '3px solid #9333ea', padding: '2px 8px', background: '#fafafa', marginTop: '4px' } }, '표현법 · 반어: 슬픔을 억누르며 임을 보내는 태도'),
        h('div', { style: { fontFamily: A.fonts.stackOf(f.ui, 'ui'), fontSize: '13px', color: '#71717a', marginTop: '8px' } }, '화면 글꼴: 메뉴·버튼·설명 글자'));
      const fileIn = h('input', { type: 'file', accept: '.ttf,.otf,.woff,.woff2', class: 'hidden', onchange: async (e) => {
        const file = e.target.files[0]; e.target.value = '';
        if (!file) return;
        try { const v = await A.fonts.upload(file); A.toast(`'${file.name}' 글꼴을 올렸어요. 어느 곳에 쓸지 골라 주세요.`); update('fonts.paper', v); draw(); } catch (err) { A.toast(err.message, 'bad'); }
      } });
      const uploads = A.fonts.custom.map((c) => h('div', { class: 'chain-item' }, h('span', { style: { flex: 1, fontFamily: `"${c.family}"` } }, c.name + ' · 가나다 국어 스튜디오'),
        ['ui', 'paper', 'note'].map((r) => h('button', { class: 'btn sm ghost', onclick: () => { update('fonts.' + r, 'upload:' + c.id); draw(); } }, { ui: '화면', paper: '지문', note: '주석' }[r])),
        h('button', { class: 'btn sm ghost danger', 'aria-label': `글꼴 삭제: ${c.name}`, onclick: async () => { if (!confirm(`'${c.name}' 글꼴을 지울까요?`)) return; await A.fonts.removeUpload(c.id); for (const r of ['ui', 'paper', 'note']) if (draft.fonts[r] === 'upload:' + c.id) update('fonts.' + r, r === 'paper' ? 'noto-serif' : 'pretendard'); draw(); } }, '삭제')));
      let localSel = null;
      const localBox = h('div', { class: 'stack', style: { gap: '6px', width: '100%' } },
        h('div', { class: 'row', style: { flexWrap: 'nowrap' } },
          h('button', { class: 'btn sm', onclick: async () => { try { localList = await A.fonts.localFamilies(); draw(); } catch (e) { A.toast(e.message, 'bad'); } } }, localList ? `설치 글꼴 ${localList.length}개` : '설치된 글꼴 불러오기'),
          (localSel = localList ? h('select', { class: 'input', style: { flex: 1 } }, localList.map((n) => h('option', { value: n, style: { fontFamily: `"${n}"` } }, n))) : h('input', { class: 'input', placeholder: '또는 글꼴 이름 직접 입력 (예: 함초롬바탕)', style: { flex: 1 } }))),
        h('div', { class: 'row' }, h('span', { class: 'small muted' }, '적용할 곳:'), ['ui', 'paper', 'note'].map((r) => h('button', { class: 'btn sm', onclick: () => { const n = (localSel.value || '').trim(); if (!n) return A.toast('글꼴을 고르거나 이름을 입력하세요', 'bad'); update('fonts.' + r, 'local:' + n); draw(); } }, A.fonts.ROLES[r]))));
      return sec('fonts', '글꼴', '화면, 지문·시험지 본문, 주석의 글꼴과 크기를 따로 정합니다. 디자인 작업대에서는 자료마다 다르게 고를 수도 있어요.',
        row('fonts.ui', '화면 글꼴', '메뉴·버튼·설명 글자 · 지금: ' + A.fonts.nameOf(f.ui), pick('ui')),
        row('fonts.paper', '지문·시험지 본문', '주석 달기 원문, 시험지·교재 본문 · 지금: ' + A.fonts.nameOf(f.paper), pick('paper')),
        row('fonts.paperSize', '지문 글자 크기', '화면에서 보는 주석 달기 원문 크기 (시험지 크기는 디자인 작업대에서)', size('paperSize', 11, 28)),
        row('fonts.note', '주석 글꼴', '주석 카드 글자 · 손글씨 글꼴로 필기 느낌을 낼 수 있어요 · 지금: ' + A.fonts.nameOf(f.note), pick('note')),
        row('fonts.noteSize', '주석 글자 크기', '', size('noteSize', 9, 20)),
        row('fonts.preview', '미리보기', '저장 전에 여기서 먼저 확인하세요', preview),
        row('fonts.upload', '글꼴 파일 올리기', 'TTF·OTF·WOFF·WOFF2, 15MB 이하 · 이 브라우저에 저장되고 백업 파일에도 포함', h('div', { class: 'stack', style: { gap: '6px', width: '100%' } }, h('button', { class: 'btn sm', onclick: () => fileIn.click() }, '글꼴 파일 고르기'), fileIn, uploads)),
        row('fonts.local', '내 컴퓨터 글꼴', '이 컴퓨터에 설치된 글꼴을 그대로 씁니다. 다른 컴퓨터에서는 보이지 않을 수 있어요', localBox));
    }

    // ---------- AI 모델 구역 ----------
    const L = window.KSLLM;
    const testResult = {};
    function aiSection(sec) {
      const st = A.llm.status;
      const via = { vercel: 'Vercel 서버 중계', 'dev-server': '개발 서버 중계', direct: '브라우저에서 직접 호출', unknown: '확인 중' }[st.via] || st.via;
      const cards = L.PROVIDERS.map((p) => providerCard(p));
      const taskRows = Object.entries(A.llm.TASKS).map(([t, label]) => {
        const p = draft.ai.tasks[t];
        const ok = A.llm.serverKey(p) || !!draft.ai.keys[p];
        const alt = !ok && L.PROVIDERS.find((q) => A.llm.serverKey(q) || !!draft.ai.keys[q]);
        return row('ai.tasks.' + t, label, ok ? `${L.PROVIDER_LABEL[p]} · ${draft.ai.models[p]}` : alt ? `${L.PROVIDER_LABEL[p]} 키가 없어 지금은 ${L.PROVIDER_LABEL[alt]} · ${draft.ai.models[alt]}로 대신 처리해요.` : `${L.PROVIDER_LABEL[p]} 키가 없어요. 키를 넣거나 다른 AI를 고르세요.`,
          h('select', { class: 'input', onchange: (e) => { update('ai.tasks.' + t, e.target.value); draw(); } }, L.PROVIDERS.map((q) => h('option', { value: q, selected: q === p }, L.PROVIDER_LABEL[q]))));
      });
      return sec('ai', 'AI 모델', '시험지 판독·구조화·주석에 쓸 AI를 고릅니다. 키는 서버 환경 변수에 두는 것이 가장 안전해요.',
        row('ai.via', '연결 방식', st.via === 'direct' ? '서버 중계가 없어 이 브라우저가 각 회사에 바로 묻습니다(단일 파일로 열었을 때). 개발 서버나 배포 사이트에서는 서버 중계로 바뀝니다.' : '키는 서버가 대신 들고 AI를 부릅니다. 브라우저 코드에 키가 드러나지 않아요.',
          h('div', { class: 'row' }, h('span', { class: 'chip ' + (st.via === 'direct' ? 'warn' : 'ok') }, via), h('button', { class: 'btn sm', onclick: async () => { await A.llm.refresh(); draw(); } }, '다시 확인'))),
        ...cards,
        ...taskRows,
        row('ai.howto', '서버 키 등록 방법', 'Vercel 프로젝트 > Settings > Environment Variables에 GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY를 넣고 다시 배포. 개발 서버는 kor-studio 폴더의 .env.local 파일에 같은 이름으로 적으면 됩니다.', h('span')));
    }
    function providerCard(p) {
      const state = A.llm.serverKey(p) ? 'server' : draft.ai.keys[p] ? 'browser' : 'none';
      const stateChip = { server: ['서버 키 연결됨', 'ok'], browser: ['이 브라우저 키', 'accent'], none: ['키 없음', ''] }[state];
      const models = L.MODELS[p];
      const cur = draft.ai.models[p];
      const custom = !models.some((m) => m.id === cur);
      const u = A.llm.usage(p);
      const lim = +draft.ai.limits[p] || 0;
      const tr = testResult[p];
      const keyIn = h('input', { class: 'input', type: 'password', autocomplete: 'off', placeholder: state === 'server' ? '서버 키 사용 중 (비워 두세요)' : { gemini: 'AIza…', openai: 'sk-…', anthropic: 'sk-ant-…' }[p], value: draft.ai.keys[p] || '', 'aria-label': `${L.PROVIDER_LABEL[p]} API 키`, style: { flex: 1, minWidth: '160px' }, oninput: (e) => update('ai.keys.' + p, e.target.value.trim()) });
      const box = h('div', { class: 's-row', 'data-path': 'ai.keys.' + p, style: { gridTemplateColumns: '1fr', alignItems: 'start' } },
        h('div', { class: 'row' }, h('b', { style: { fontSize: '14px' } }, L.PROVIDER_LABEL[p]), h('span', { class: 'chip ' + stateChip[1] }, stateChip[0]), h('span', { class: 'spacer' }),
          h('span', { class: 'small muted num' }, `이번 달 ${u.req}회 · ${u.total.toLocaleString()} 토큰${u.fail ? ` · 실패 ${u.fail}` : ''}${lim ? ` / 한도 ${lim.toLocaleString()}` : ''}`)),
        lim ? h('div', { class: 'bar-track', style: { margin: '6px 0' } }, h('div', { class: 'bar-fill', style: { width: Math.min(100, (u.total / lim) * 100) + '%', background: u.total >= lim ? 'var(--bad)' : '' } })) : null,
        h('div', { class: 'grid2', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginTop: '8px' } },
          h('div', { class: 'field' }, h('label', null, '모델'),
            h('select', { class: 'input', 'aria-label': `${L.PROVIDER_LABEL[p]} 모델`, onchange: (e) => { update('ai.models.' + p, e.target.value === '__custom' ? '' : e.target.value); draw(); } },
              models.map((m) => h('option', { value: m.id, selected: m.id === cur }, `${m.label} · ${m.note}`)), h('option', { value: '__custom', selected: custom }, '직접 입력…')),
            custom ? h('input', { class: 'input', placeholder: '모델 ID', value: cur || '', style: { marginTop: '6px' }, oninput: (e) => update('ai.models.' + p, e.target.value.trim()) }) : null),
          h('div', { class: 'field' }, h('label', null, '월 사용 한도 (토큰, 0 = 제한 없음)'),
            h('input', { class: 'input', type: 'number', min: 0, step: 100000, value: lim, 'aria-label': `${L.PROVIDER_LABEL[p]} 월 사용 한도`, oninput: (e) => update('ai.limits.' + p, Math.max(0, +e.target.value || 0)) }))),
        h('div', { class: 'field', style: { marginTop: '8px' } }, h('label', null, 'API 키 (이 브라우저에만 저장 · 공용 컴퓨터에서는 넣지 마세요)'),
          h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, keyIn,
            h('button', { class: 'btn sm', 'aria-label': `${L.PROVIDER_LABEL[p]} 연결 시험`, onclick: () => runTest(p) }, tr && tr.running ? '시험 중…' : '연결 시험'),
            h('button', { class: 'btn sm danger', 'aria-label': `${L.PROVIDER_LABEL[p]} 키 폐기`, disabled: !saved.ai.keys[p] && !draft.ai.keys[p], onclick: () => revoke(p) }, '키 폐기'))),
        tr && !tr.running ? h('div', { class: 'small', style: { marginTop: '6px', color: tr.ok ? 'var(--ok)' : 'var(--bad)' } }, tr.ok ? `연결됨 · ${tr.model} · ${tr.ms}ms · ${tr.keySource === 'server' ? '서버 키' : '넣은 키'}` : `실패: ${tr.error}`) : null);
      return box;
    }
    async function runTest(p) {
      testResult[p] = { running: true }; draw();
      try {
        const r = await A.llm.test(p, { model: draft.ai.models[p], key: draft.ai.keys[p] });
        testResult[p] = { ...r, ok: true };
      } catch (e) { testResult[p] = { ok: false, error: e.message }; }
      draw();
    }
    function revoke(p) {
      if (!confirm(`${L.PROVIDER_LABEL[p]} 키를 이 브라우저에서 바로 지울까요?`)) return;
      const s = A.Settings.get(); s.ai.keys[p] = ''; A.Settings.save(s);
      saved = A.Settings.get(); draft.ai.keys[p] = '';
      delete testResult[p];
      A.toast(`${L.PROVIDER_LABEL[p]} 키를 지웠어요. 키 자체를 막으려면 해당 회사 콘솔에서도 폐기하세요.`);
      draw();
    }

    function restoreButton() {
      const inp = h('input', { type: 'file', accept: '.json,application/json', class: 'hidden', onchange: async (e) => {
        const f = e.target.files[0]; e.target.value = '';
        if (!f) return;
        try { const n = await A.Backup.restore(f); saved = A.Settings.get(); draft = A.clone(saved); A.toast('자료 ' + n + '개를 복원했어요'); draw(); } catch (err) { A.toast(err.message, 'bad'); }
      } });
      return h('span', null, inp, h('button', { class: 'btn sm', onclick: () => inp.click() }, '백업 파일 고르기'));
    }
    async function wipeAll() {
      const c = await A.Backup.counts();
      const total = Object.values(c).reduce((a, b) => a + b, 0);
      if (!total) return A.toast('지울 자료가 없어요');
      if (confirm('자료 ' + total + '개를 지우기 전에 백업 파일을 받을까요?')) await A.Backup.export();
      const typed = prompt('자료 ' + total + '개를 모두 지웁니다. 되돌릴 수 없어요. 계속하려면 삭제 두 글자를 입력하세요.');
      if ((typed || '').trim() !== '삭제') return A.toast('삭제를 취소했어요');
      await A.Backup.wipe();
      A.toast('자료함을 비웠어요');
    }
    function jump(id) {
      const el = root.querySelector('#s-' + id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      root.querySelectorAll('.s-nav a').forEach((a) => a.classList.toggle('on', a.dataset.s === id));
    }
    draw();
    A.llm.refresh().then(() => draw());
    const onScroll = () => {
      let on = SECTIONS[0][0];
      for (const [id] of SECTIONS) { const el = root.querySelector('#s-' + id); if (el && el.getBoundingClientRect().top < 160) on = id; }
      root.querySelectorAll('.s-nav a').forEach((a) => a.classList.toggle('on', a.dataset.s === on));
    };
    view.addEventListener('scroll', onScroll);
    setTimeout(() => (params.s ? jump(params.s) : onScroll()), 50);
    return { cleanup: () => view.removeEventListener('scroll', onScroll) };
  });
})(window.App);
