/* 국어 스튜디오 - 설정 (요청 11: 왼쪽 내비 + 저장 바 하나 + 변경 표시 + 기록) */
(function (A) {
  'use strict';
  const { h, esc } = A;
  const SECTIONS = [
    ['account', '계정'], ['brand', '학원 브랜드'], ['output', '출력 기본값'], ['annotation', '주석 기본값'],
    ['ocr', 'OCR·AI'], ['agent', 'API·에이전트'], ['notify', '알림'], ['history', '변경 기록'], ['danger', '데이터 관리'],
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
          h('span', { class: 'i' }, i + 1), h('span', { style: { flex: 1 } }, A.ENGINE_LABEL[e], e === 'gemini' && !draft.ai.geminiKey ? h('span', { class: 'muted tiny' }, '  키 없으면 건너뜀') : null),
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
        sec('annotation', '주석 기본값', '주석 달기와 주석교재의 시작값입니다.',
          row('annotation.density', '필기량', '1 핵심만 ~ 5 촘촘 · 바꿔도 다시 생성하지 않아요', select('annotation.density', [[1, '1 핵심만'], [2, '2 간결'], [3, '3 보통'], [4, '4 풍부'], [5, '5 촘촘']])),
          row('annotation.layout', '레이아웃', '', seg('annotation.layout', [['wing', '날개형'], ['note', '노트형'], ['blank', '빈칸형']])),
          row('annotation.autoHighlight', '형광펜 자동 표시', '주석이 붙은 구절에 색 밑줄', toggle('annotation.autoHighlight'))),
        sec('ocr', 'OCR·AI', '쪽마다 위에서부터 시도하고, 저작권 차단·잘림·품질 낮음이면 다음 엔진으로 넘어갑니다.',
          row('ocr.chain', '글자 읽기 대체 순서', 'PDF 글자 레이어·HWPX는 항상 먼저 직접 읽음(비용 0)', chainEditor()),
          row('ocr.lowConf', '의심 줄 기준', '신뢰도가 이보다 낮으면 교정 화면에서 노란색', select('ocr.lowConf', [[60, '60'], [70, '70'], [80, '80'], [90, '90']])),
          row('ocr.enhance', '사진 자동 보정', '회색조·명암 늘리기', toggle('ocr.enhance')),
          row('ai.geminiKey', 'Gemini API 키', '넣으면 Gemini 판독·참조형 구조화·AI 주석이 켜집니다. 이 브라우저에만 저장되니 공용 컴퓨터에서는 넣지 마세요.', text('ai.geminiKey', 'AIza…', 'password')),
          row('ai.model', '모델', '', text('ai.model'))),
        sec('agent', 'API·에이전트', '화면에서 하는 모든 일은 같은 계약의 API로도 할 수 있습니다.',
          row('agent.api', '브라우저 API', '에이전트가 이 페이지에서 바로 호출', h('code', { class: 'small' }, 'window.App.api')),
          row('agent.keys', 'API 키 · 월 사용 한도', '키별 권한과 월 한도, 즉시 폐기', h('span', { class: 'chip' }, '준비 중')),
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
