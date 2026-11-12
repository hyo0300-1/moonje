/* 국어 스튜디오 - 시험지 분석·저장 (요청 5 + 7) */
(function (A) {
  'use strict';
  const { h, esc, icon } = A;
  const MODES = [
    { id: 'text', name: '텍스트화', desc: '글자만 읽어 교정하고 TXT로 받기' },
    { id: 'structure', name: '구조화', desc: '글자를 문항·<보기>·선지로 나누기' },
    { id: 'analyze', name: '분석', desc: '구조화에 더해 출제 경향 리포트까지' },
  ];
  const ROLES = ['시험지', '학교프린트', '교사용교과서', '자습서', '평가문제집', '기출', '수업필기', '기타'];
  const KIND_LABEL = { image: '이미지', pdf_text: 'PDF 글자', pdf_scan: 'PDF 스캔', parsed: '텍스트' };
  const S = A.examState = A.examState || { mode: 'analyze', title: '', role: '시험지', pages: [], doc: null, tab: 'fix', curPage: 1, onlySuspect: false, jobId: null };

  A.route('exam', async (view, params) => {
    if (params.mode && MODES.some((m) => m.id === params.mode)) S.mode = params.mode;
    if (params.doc) {
      const d = await A.DB.get('documents', params.doc);
      if (d) { S.doc = d; S.mode = d.mode; S.title = d.title; S.role = d.role; S.tab = 'fix'; S.curPage = 1; }
    }
    const root = h('div');
    view.append(root);
    const unsub = A.Jobs.on(() => {
      const j = S.jobId && A.Jobs.get(S.jobId);
      if (!j) return;
      const bar = root.querySelector('#run-progress');
      if (bar) { bar.querySelector('.bar-fill').style.width = j.progress + '%'; bar.querySelector('.st').textContent = j.stage; }
      if (['completed', 'needs_review'].includes(j.status) && j.result && S.doc !== j.result) { S.doc = j.result; S.tab = S.doc.mode === 'analyze' ? 'report' : S.doc.mode === 'structure' ? 'items' : 'fix'; S.curPage = 1; S.jobId = null; draw(); }
      if (['failed', 'cancelled'].includes(j.status)) { S.jobId = null; draw(); }
    });
    const onPaste = (e) => {
      const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
      if (files.length) { e.preventDefault(); addFiles(files); }
    };
    document.addEventListener('paste', onPaste);

    function draw() {
      root.innerHTML = '';
      root.append(
        h('div', { class: 'page-head' },
          h('div', null, h('h1', null, '시험지 분석·저장'), h('p', null, '시험지 사진·PDF·한글 파일을 읽어 글자로 바꾸고, 문항으로 나눠 출제 경향을 분석합니다.')),
          h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => A.go('library') }, '자료함'))),
        h('div', { class: 'stack' }, inputCard(), S.pages.length ? pagesCard() : emptyPagesCard(), runCard(), S.doc ? resultCard() : null));
    }

    // ---------- 1. 파일 넣기 ----------
    function inputCard() {
      const fileIn = h('input', { type: 'file', multiple: true, class: 'hidden', accept: '.pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.txt,.hwpx,.hwp,image/*', onchange: (e) => { addFiles([...e.target.files]); e.target.value = ''; } });
      const camIn = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden', onchange: (e) => { addFiles([...e.target.files]); e.target.value = ''; } });
      const drop = h('div', { class: 'drop', id: 'dropzone' },
        h('div', { html: icon('upload'), style: { width: '28px', height: '28px', margin: '0 auto 6px', color: 'var(--muted)' } }),
        h('b', null, '시험지 파일이나 사진을 끌어다 놓으세요'),
        h('p', null, 'PDF · 이미지(PNG, JPG, WebP, HEIC) · HWPX · TXT · 여러 장 한 번에 · Ctrl+V로 캡처 붙여넣기'),
        h('div', { class: 'row', style: { justifyContent: 'center' } },
          h('button', { class: 'btn primary', onclick: () => fileIn.click() }, '파일 선택'),
          h('button', { class: 'btn', onclick: () => camIn.click(), html: icon('camera') + '카메라로 찍기' })),
        fileIn, camIn);
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles([...e.dataTransfer.files]); });
      return h('div', { class: 'card' },
        h('div', { class: 'card-h' }, h('h3', null, '1  모드와 파일'), h('span', { class: 'sub' }, '모드는 실행 전에 언제든 바꿀 수 있어요')),
        h('div', { class: 'card-b stack' },
          h('div', { class: 'modes', role: 'radiogroup', 'aria-label': '처리 모드' }, MODES.map((m) => h('button', { class: 'mode' + (S.mode === m.id ? ' on' : ''), role: 'radio', 'aria-checked': String(S.mode === m.id), onclick: () => { S.mode = m.id; draw(); } }, h('b', null, m.name), h('span', null, m.desc)))),
          h('div', { class: 'grid2' },
            h('div', { class: 'field' }, h('label', null, '제목'), h('input', { class: 'input', placeholder: '예: 26-1-1 중간 원주고 2학년', value: S.title, oninput: (e) => (S.title = e.target.value) })),
            h('div', { class: 'field' }, h('label', null, '자료 역할'), h('select', { class: 'input', onchange: (e) => (S.role = e.target.value) }, ROLES.map((r) => h('option', { value: r, selected: S.role === r }, r))))),
          drop));
    }

    async function addFiles(files) {
      if (!files.length) return;
      for (const f of files) {
        try {
          A.toast(`${f.name || '이미지'} 읽는 중…`);
          const pages = await A.ocr.fileToPages(f);
          S.pages.push(...pages);
          if (!S.title) S.title = (f.name || '').replace(/\.[^.]+$/, '');
        } catch (e) { A.toast(e.message, 'bad'); }
      }
      draw();
    }

    function emptyPagesCard() {
      return h('div', { class: 'card', style: { opacity: 0.6 } },
        h('div', { class: 'card-h' }, h('h3', null, '2  쪽 정리'), h('span', { class: 'sub' }, '파일을 넣으면 여기에 쪽이 놓여요')),
        h('div', { class: 'card-b small muted' }, '쪽 순서 바꾸기, 돌리기, 펼친 면 두 쪽으로 나누기를 여기서 합니다.'));
    }

    // ---------- 2. 쪽 정리 ----------
    function pagesCard() {
      const strip = h('div', { class: 'pages' });
      let dragIdx = null;
      S.pages.forEach((p, i) => {
        const th = h('div', { class: 'th', draggable: 'true', style: p.src ? { backgroundImage: `url(${p.src})` } : null }, h('span', { class: 'no' }, i + 1), p.src ? null : h('span', null, `텍스트 ${p.lines?.length || 0}줄`));
        const card = h('div', { class: 'pg' }, th,
          h('div', { class: 'meta' }, h('span', { title: p.fname }, (p.fname || '').slice(0, 14)), h('span', { class: 'chip' + (p.kind === 'pdf_text' || p.kind === 'parsed' ? ' ok' : '') }, KIND_LABEL[p.kind])),
          h('div', { class: 'tools' },
            h('button', { title: '오른쪽으로 90° 회전', 'aria-label': `${i + 1}쪽 회전`, disabled: !p.src, onclick: async () => { S.pages[i] = await A.ocr.rotate(p, 90); draw(); } }, '회전'),
            h('button', { title: '펼친 면(B4 2쪽)을 두 쪽으로', 'aria-label': `${i + 1}쪽 2분할`, disabled: !p.src, onclick: async () => { S.pages.splice(i, 1, ...(await A.ocr.split(p))); draw(); } }, '2분할'),
            h('button', { title: '삭제', 'aria-label': `${i + 1}쪽 삭제`, onclick: () => { S.pages.splice(i, 1); draw(); } }, '삭제')));
        th.addEventListener('dragstart', () => { dragIdx = i; card.classList.add('dragging'); });
        th.addEventListener('dragend', () => card.classList.remove('dragging'));
        card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('over'); });
        card.addEventListener('dragleave', () => card.classList.remove('over'));
        card.addEventListener('drop', (e) => { e.preventDefault(); card.classList.remove('over'); if (dragIdx == null || dragIdx === i) return; const [m] = S.pages.splice(dragIdx, 1); S.pages.splice(i, 0, m); dragIdx = null; draw(); });
        strip.append(card);
      });
      const free = S.pages.filter((p) => p.kind === 'pdf_text' || p.kind === 'parsed').length;
      return h('div', { class: 'card' },
        h('div', { class: 'card-h' }, h('h3', null, `2  쪽 정리 · ${S.pages.length}쪽`), h('div', { class: 'row' }, h('span', { class: 'sub' }, '끌어서 순서 변경 · 사진은 자동 보정'), h('button', { class: 'btn sm ghost danger', onclick: () => { S.pages = []; draw(); } }, '모두 비우기'))),
        h('div', { class: 'card-b' }, strip,
          h('div', { class: 'small muted' }, `OCR 필요 ${S.pages.length - free}쪽 · 글자를 바로 읽는 쪽 ${free}쪽(비용 0)`)));
    }

    // ---------- 3. 실행 ----------
    function runCard() {
      const s = A.Settings.get();
      const chain = s.ocr.chain.filter((e) => !s.ocr.disabled.includes(e));
      const chainEl = h('div', { class: 'chain' }, h('span', { class: 'chip ok' }, 'PDF 글자·HWPX 직접 읽기'), h('span', { class: 'arr' }, '→'),
        chain.map((e, i) => { const off = e === 'gemini' && !A.llm.ready('ocr'); return [i ? h('span', { class: 'arr' }, '→') : null, h('span', { class: 'chip' + (off ? '' : ' accent'), title: e === 'gemini' ? (off ? '연결된 AI 키가 없어 건너뜀' : A.llm.label('ocr')) : '' }, e === 'gemini' ? (off ? 'AI 판독 (키 없음)' : 'AI 판독 · ' + A.llm.modelFor(A.llm.providerFor('ocr'))) : A.ENGINE_LABEL[e])]; }));
      const j = S.jobId && A.Jobs.get(S.jobId);
      return h('div', { class: 'card' },
        h('div', { class: 'card-h' }, h('h3', null, '3  실행'), h('a', { href: '#/settings?s=ocr', class: 'small' }, '대체 순서 바꾸기')),
        h('div', { class: 'card-b stack' },
          h('div', null, h('div', { class: 'lbl', style: { marginBottom: '6px' } }, '쪽마다 차단·잘림·품질 낮음이면 다음 엔진으로 자동 전환'), chainEl),
          h('div', { class: 'row' },
            h('label', { class: 'row small' }, h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: s.ocr.enhance, onchange: (e) => { const ns = A.Settings.get(); ns.ocr.enhance = e.target.checked; A.Settings.save(ns); } }), h('span')), '사진 자동 보정(회색조·명암)'),
            h('span', { class: 'spacer' }),
            j ? h('div', { id: 'run-progress', style: { width: '260px' } }, h('div', { class: 'small st', style: { marginBottom: '4px' } }, j.stage), h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: { width: j.progress + '%' } }))) : null,
            j ? h('button', { class: 'btn', onclick: () => A.toggleDrawer(true) }, '진행 기록') : null,
            h('button', { class: 'btn primary', disabled: !S.pages.length || !!j, onclick: start, 'aria-label': '작업 시작' }, j ? '처리 중…' : `${MODES.find((m) => m.id === S.mode).name} 시작`))));
    }

    function start() {
      const s = A.Settings.get();
      const title = S.title || '제목 없는 시험지';
      const pages = S.pages.slice();
      const mode = S.mode, role = S.role;
      const kind = { text: 'ocr', structure: 'structure', analyze: 'analyze' }[mode];
      const job = A.Jobs.create(kind, title, { mode, pages: pages.length, role }, async (ctx) => {
        const doc = { id: A.uid('doc_'), title, role, mode, created_at: Date.now(), pages: [], engine_summary: {} };
        ctx.stage('전처리', 2);
        for (let i = 0; i < pages.length; i++) doc.pages.push(await A.ocr.prepare(pages[i], s, i));
        ctx.stage('글자 읽기', 5);
        for (let i = 0; i < doc.pages.length; i++) {
          await A.ocr.recognizePage(doc.pages[i], ctx, s);
          ctx.progress(5 + 75 * (i + 1) / doc.pages.length);
        }
        for (const p of doc.pages) doc.engine_summary[p.final_engine] = (doc.engine_summary[p.final_engine] || 0) + 1;
        if (mode !== 'text') { ctx.stage('구조화', 82); doc.structure = await A.structure.run(doc, ctx, s); }
        if (mode === 'analyze') { ctx.stage('분석 리포트', 94); doc.analysis = A.structure.analyze(doc); }
        const suspect = doc.pages.reduce((a, p) => a + p.suspect_count, 0);
        const review = doc.structure ? doc.structure.items.filter((i) => i.needs_review).length : 0;
        if (suspect || review) { ctx.job.needsReview = true; ctx.log('info', `검토 필요: 의심 줄 ${suspect}개 · 검수 필요 문항 ${review}개`); }
        return doc;
      });
      S.jobId = job.id;
      draw();
    }

    // ---------- 결과 ----------
    function resultCard() {
      const d = S.doc;
      const tabs = [['fix', '교정'], ...(d.structure ? [['items', `구조 · ${d.structure.items.length}문항`]] : []), ...(d.analysis ? [['report', '분석 리포트']] : []), ['log', '처리 기록']];
      if (!tabs.some((t) => t[0] === S.tab)) S.tab = tabs[0][0];
      const suspect = d.pages.reduce((a, p) => a + (p.suspect_count || 0), 0);
      const body = h('div');
      const card = h('div', { class: 'card' },
        h('div', { class: 'card-h' },
          h('div', null, h('h3', null, d.title), h('div', { class: 'sub' }, `${MODES.find((m) => m.id === d.mode).name} · ${d.pages.length}쪽 · 의심 줄 ${suspect}개${d.saved_at ? ' · 자료함 저장됨' : ''}`)),
          h('div', { class: 'row' },
            d.mode !== 'text' ? h('button', { class: 'btn sm', onclick: () => { d.structure = A.structure.rebuild(d); if (d.mode === 'analyze') d.analysis = A.structure.analyze(d); A.toast('교정한 글자로 구조를 다시 만들었어요'); draw(); } }, '구조 다시 만들기') : null,
            h('button', { class: 'btn sm', onclick: () => exportTxt(d) }, 'TXT'),
            h('button', { class: 'btn sm', onclick: () => exportJson(d) }, 'JSON'),
            h('button', { class: 'btn sm primary', onclick: async () => { d.saved_at = Date.now(); await A.DB.put('documents', d); A.toast('자료함에 저장했어요 (기간 제한 없음)'); draw(); } }, d.saved_at ? '다시 저장' : '자료함에 저장'))),
        h('div', { class: 'res-tabs', role: 'tablist' }, tabs.map(([id, label]) => h('button', { class: S.tab === id ? 'on' : '', role: 'tab', 'aria-selected': String(S.tab === id), onclick: () => { S.tab = id; draw(); } }, label))),
        body);
      if (S.tab === 'fix') body.append(editor(d));
      if (S.tab === 'items') body.append(itemsView(d));
      if (S.tab === 'report') body.append(reportView(d));
      if (S.tab === 'log') body.append(logView(d));
      return card;
    }

    function editor(d) {
      const p = d.pages[Math.min(S.curPage, d.pages.length) - 1];
      const paneW = Math.max(320, ((document.querySelector('#view')?.clientWidth || 1200) - 120) / 2);
      const zoom = p.src ? Math.min(1, (paneW - 24) / p.width) : 1;
      const wrap = h('div', { class: 'wrap' });
      const svgNS = 'http://www.w3.org/2000/svg';
      let svg = null;
      if (p.src) {
        wrap.append(h('img', { src: p.src, width: Math.round(p.width * zoom), height: Math.round(p.height * zoom), alt: `${p.page_no}쪽 원본` }));
        svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${p.width} ${p.height}`); svg.setAttribute('width', Math.round(p.width * zoom)); svg.setAttribute('height', Math.round(p.height * zoom));
        p.lines.forEach((l, i) => {
          if (!l.bbox) return;
          const r = document.createElementNS(svgNS, 'rect');
          r.setAttribute('x', l.bbox[0]); r.setAttribute('y', l.bbox[1]); r.setAttribute('width', l.bbox[2]); r.setAttribute('height', l.bbox[3]); r.setAttribute('rx', 4);
          r.dataset.i = i;
          if (l.status === 'low_conf' || l.status === 'unreadable') r.classList.add('low');
          r.addEventListener('click', () => focusLine(i));
          svg.append(r);
        });
        wrap.append(svg);
      } else wrap.append(h('div', { class: 'noimg' }, '이 쪽은 파일에서 글자를 바로 읽어 원본 이미지가 없어요.'));
      const imgPane = h('div', { class: 'ed-img' }, wrap);
      const linesPane = h('div', { class: 'ed-lines' });
      const rows = [];
      p.lines.forEach((l, i) => {
        const sus = l.status === 'low_conf' || l.status === 'unreadable';
        if (S.onlySuspect && !sus && l.status !== 'edited') return;
        const inp = h('input', { value: l.text, 'aria-label': `${p.page_no}쪽 ${l.line_no}번 줄`, 'data-i': i,
          oninput: (e) => { l.text = e.target.value; if (l.status !== 'edited') { l.prev_status = l.status; l.status = 'edited'; row.className = 'ln edited on'; } },
          onfocus: () => highlight(i),
          onkeydown: (e) => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); nextSuspect(i); } if (e.key === 'Enter') { e.preventDefault(); focusLine(i + 1); } } });
        const row = h('div', { class: 'ln' + (sus ? ' low' : '') + (l.status === 'edited' ? ' edited' : '') }, h('span', { class: 'n' }, l.line_no), inp, h('span', { class: 'c', title: '신뢰도' }, l.confidence == null ? '' : l.confidence));
        rows[i] = row; linesPane.append(row);
      });
      function highlight(i) {
        rows.forEach((r, k) => r && r.classList.toggle('on', k === i));
        if (svg) { svg.querySelectorAll('rect').forEach((r) => r.classList.toggle('on', +r.dataset.i === i)); const b = p.lines[i]?.bbox; if (b) imgPane.scrollTo({ top: b[1] * zoom - 120, behavior: 'smooth' }); }
      }
      function focusLine(i) { const r = rows[i]; if (r) { r.querySelector('input').focus(); r.scrollIntoView({ block: 'nearest' }); } }
      function nextSuspect(from) {
        for (let k = from + 1; k < p.lines.length; k++) if (rows[k] && (p.lines[k].status === 'low_conf' || p.lines[k].status === 'unreadable')) return focusLine(k);
        A.toast('이 쪽에 남은 의심 줄이 없어요');
      }
      const pageChips = d.pages.map((pg) => h('button', { class: 'chip btnchip' + (pg.page_no === p.page_no ? ' on' : ''), onclick: () => { S.curPage = pg.page_no; draw(); } }, `${pg.page_no}쪽${pg.suspect_count ? ' · ' + pg.suspect_count : ''}`));
      return h('div', null,
        h('div', { class: 'ed-bar' }, h('div', { class: 'row' }, pageChips), h('span', { class: 'spacer' }),
          h('span', { class: 'small muted' }, `${A.ENGINE_LABEL[p.final_engine] || ''}${p.confidence != null ? ' · 평균 신뢰도 ' + p.confidence : ''}`),
          h('label', { class: 'row small' }, h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: S.onlySuspect, onchange: (e) => { S.onlySuspect = e.target.checked; draw(); } }), h('span')), '의심 줄만'),
          d.structure ? h('button', { class: 'btn sm', title: 'OCR이 ①~⑤를 @, 6) 등으로 읽은 곳을 문항 구조에 맞춰 바로잡음', onclick: () => fixMarks(d) }, '선지 기호 정리') : null,
          h('button', { class: 'btn sm', onclick: () => nextSuspect(-1) }, '첫 의심 줄로 (Tab: 다음)')),
        h('div', { class: 'editor' }, imgPane, linesPane));
    }

    function fixMarks(d) {
      const byGid = new Map();
      d.pages.forEach((p) => p.lines.forEach((l) => byGid.set(l.gid, l)));
      let n = 0;
      for (const it of d.structure.items) for (const [k, refs] of Object.entries(it.choice_refs || {})) {
        const l = byGid.get(refs[0]);
        if (!l) continue;
        const fixed = l.text.replace(/^\s*(?:[@®©◎○⓪⑥](?:\))?|\(?[1-6]\))\s*/, A.structure.CH[k - 1] + ' ');
        if (fixed !== l.text && !l.text.trim().startsWith(A.structure.CH[k - 1])) { l.text = fixed; l.status = 'edited'; n++; }
      }
      d.structure = A.structure.rebuild(d);
      if (d.mode === 'analyze') d.analysis = A.structure.analyze(d);
      A.toast(n ? `선지 기호 ${n}개를 ①~⑤로 고쳤어요` : '고칠 선지 기호가 없어요');
      draw();
    }

    function itemsView(d) {
      const st = d.structure;
      const sel = (val, map, on) => h('select', { class: 'input', style: { height: '24px', fontSize: '11.5px', padding: '0 4px' }, onchange: (e) => on(e.target.value) }, Object.entries(map).map(([k, v]) => h('option', { value: k, selected: k === val }, v)));
      const review = st.items.filter((i) => i.needs_review && !i.teacher_confirmed).length;
      const list = h('div', { class: 'items' });
      let lastSet = -1;
      for (const it of st.items) {
        if (it.set != null && it.set !== lastSet) {
          const s = st.sets[it.set];
          list.append(h('div', { class: 'set-h' }, h('b', null, s.header || '(지문)'), ` · 지문 ${s.passage_refs.length}줄`));
          lastSet = it.set;
        }
        const need = it.needs_review && !it.teacher_confirmed;
        list.append(h('div', { class: 'item' + (need ? ' need' : '') },
          h('div', { class: 'item-h' },
            h('span', { class: 'no' }, it.number + '.'),
            sel(it.domain, A.structure.DOMAIN, (v) => { it.domain = v; }),
            sel(it.item_type, A.structure.TYPE, (v) => { it.item_type = v; }),
            it.negative ? h('span', { class: 'chip warn' }, '부정 발문') : null,
            h('span', { class: 'spacer' }),
            h('span', { class: 'chip ' + (it.confidence >= 0.65 ? 'ok' : 'warn'), title: '구조 신뢰도' }, `신뢰도 ${Math.round(it.confidence * 100)}`),
            need || it.teacher_confirmed ? h('label', { class: 'row small' }, h('input', { type: 'checkbox', checked: it.teacher_confirmed, onchange: (e) => { it.teacher_confirmed = e.target.checked; draw(); } }), '확인함') : null),
          h('div', { class: 'stem' }, it.stem),
          it.boogi ? h('div', { class: 'boogi' }, '<보기> ', it.boogi) : null,
          h('ol', { class: 'ch' }, [1, 2, 3, 4, 5].map((k) => h('li', { style: it.choices[k] ? null : { color: 'var(--bad)' } }, `${A.structure.CH[k - 1]} ${it.choices[k] || '(못 찾음)'}`))),
          need ? h('div', { class: 'small', style: { color: 'var(--warn)', marginTop: '6px' } }, '검수 필요: 교사 확인 전에는 동형 출제 설계도에 쓰지 않아요.') : null));
      }
      if (!st.items.length) list.append(h('div', { class: 'empty' }, '문항을 찾지 못했어요. 교정 탭에서 문항 번호("12.")와 선지(①~⑤)를 확인한 뒤 "구조 다시 만들기"를 눌러 주세요.'));
      return h('div', { class: 'card-b' },
        h('div', { class: 'row small muted', style: { marginBottom: '10px' } }, `구조화 엔진: ${A.ENGINE_LABEL[st.engine]} · 지문 ${st.sets.length}개 · 문항 ${st.items.length}개 · 검수 필요 ${review}개`),
        list);
    }

    function reportView(d) {
      const a = d.analysis = A.structure.analyze(d);
      const bars = (arr) => arr.map((x) => h('div', { class: 'hbar' }, h('span', null, x.label), h('div', { class: 't' }, h('div', { class: 'f', style: { width: x.pct + '%' } })), h('span', { class: 'v' }, x.n)));
      const rep = h('div', { class: 'card-b stack', id: 'report' },
        h('div', { class: 'stats' },
          h('div', { class: 'stat' }, h('div', { class: 'k' }, '문항'), h('div', { class: 'v' }, a.n)),
          h('div', { class: 'stat' }, h('div', { class: 'k' }, '부정 발문'), h('div', { class: 'v' }, a.n ? Math.round(a.neg * 100 / a.n) + '%' : '-')),
          h('div', { class: 'stat' }, h('div', { class: 'k' }, '<보기> 적용'), h('div', { class: 'v' }, a.boogi)),
          h('div', { class: 'stat' }, h('div', { class: 'k' }, '검수 필요'), h('div', { class: 'v', style: { color: a.review ? 'var(--warn)' : '' } }, a.review))),
        h('div', { class: 'grid2' },
          h('div', null, h('div', { class: 'lbl', style: { marginBottom: '6px' } }, '영역 분포'), bars(a.domains)),
          h('div', null, h('div', { class: 'lbl', style: { marginBottom: '6px' } }, '발문 유형'), bars(a.types))),
        h('div', null, h('div', { class: 'lbl', style: { marginBottom: '6px' } }, '학부모 상담용 요약'), h('div', { style: { lineHeight: '1.8', fontSize: '13.5px' } }, a.summary.map((t) => h('p', { style: { margin: '0 0 6px' } }, t)))),
        h('div', { class: 'row' }, h('span', { class: 'small muted' }, '확인한 문항은 시험지 제작의 동형 설계도에 바로 쓸 수 있어요.'), h('span', { class: 'spacer' }),
          h('button', { class: 'btn sm', onclick: () => A.go('build', { doc: d.id }) }, '이 분석으로 시험지 제작'),
          h('button', { class: 'btn sm', onclick: () => printReport(rep, d) , html: icon('printer') + 'PDF로 인쇄' })));
      return rep;
    }

    function logView(d) {
      return h('div', { class: 'card-b' }, h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, ['쪽', '입력', '처리 경로', '최종', '평균 신뢰도', '의심 줄'].map((t) => h('th', null, t)))),
        h('tbody', null, d.pages.map((p) => h('tr', null,
          h('td', { class: 'num' }, p.page_no),
          h('td', null, KIND_LABEL[p.kind]),
          h('td', null, h('div', { class: 'chain' }, (p.fallback_path || []).map((x, i) => { const [e, o] = x.split(':'); return [i ? h('span', { class: 'arr' }, '→') : null, h('span', { class: 'chip ' + (o === 'ok' ? 'ok' : o === 'skipped' ? '' : 'warn') }, `${A.ENGINE_LABEL[e] || e} · ${A.OUTCOME_LABEL[o] || o}`)]; }))),
          h('td', null, A.ENGINE_LABEL[p.final_engine] || p.final_engine),
          h('td', { class: 'num' }, p.confidence ?? '-'),
          h('td', { class: 'num' }, p.suspect_count))))),
        h('p', { class: 'small muted' }, '시연판의 전용 OCR은 브라우저 안에서 도는 Tesseract입니다. 서비스 단계에서 Upstage/CLOVA 같은 한국어 문서 OCR로 바꾸면 신뢰도가 크게 올라가요.'));
    }

    function printReport(node, d) {
      const pr = document.getElementById('print-root');
      pr.innerHTML = '';
      pr.append(h('div', { style: { padding: '16mm', fontFamily: 'Pretendard, sans-serif' } }, h('h1', { style: { fontSize: '20pt', marginBottom: '6mm' } }, `${d.title} 분석 리포트`), node.cloneNode(true)));
      window.print();
    }
    function exportTxt(d) {
      const t = d.pages.map((p) => `=== ${p.page_no}쪽 ===\n` + p.lines.map((l) => l.text).join('\n')).join('\n\n');
      A.download(`${d.title}.txt`, t);
    }
    function exportJson(d) {
      const slim = { ...d, pages: d.pages.map(({ src, ...rest }) => rest) };
      A.download(`${d.title}.json`, JSON.stringify(slim, null, 2), 'application/json');
    }

    A.exam = { addFiles, start, state: S };
    draw();
    return { cleanup: () => { unsub(); document.removeEventListener('paste', onPaste); delete A.exam; } };
  });
})(window.App);
