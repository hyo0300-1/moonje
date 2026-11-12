/* 국어 스튜디오 - 디자인 작업대 (요청 8: 배너 슬롯 자유 교체, 내 문서 미리보기, 문항 잘림 방지, 목표 쪽수 맞춤) */
(function (A) {
  'use strict';
  const { h, esc, icon } = A;
  const MM = 96 / 25.4;
  const PAPER = { A4: [210, 297], B4: [257, 364] };
  const SLOT_INFO = {
    header: ['머리 배너', '모든 쪽 맨 위 띠'], cover: ['표지', '첫 장 전체'], divider: ['구역 띠', '지문 묶음 사이'],
    footer: ['꼬리말', '쪽 번호와 문구'], watermark: ['워터마크', '본문 뒤 흐린 그림·글자'], logo: ['로고', '머리 배너 오른쪽'],
  };
  const MODES = { auto: '자동', image: '이미지', library: '라이브러리', text: '글자', none: '없음' };
  const SLOT_MODES = { header: ['auto', 'image', 'library', 'text', 'none'], cover: ['auto', 'image', 'library', 'none'], divider: ['auto', 'image', 'library', 'none'], footer: ['text', 'none'], watermark: ['image', 'library', 'text', 'none'], logo: ['image', 'library', 'none'] };
  const SWATCHES = ['#904ae8', '#316a59', '#1d4ed8', '#0f766e', '#b45309', '#be123c', '#334155', '#7c3aed'];
  const SAMPLE = [
    '[1~2] 다음 글을 읽고 물음에 답하시오.', '식물은 빛 에너지를 이용하여 이산화 탄소와 물로 포도당을 만든다. 이 과정을 광합성이라 하며, 엽록체에서 일어난다. 광합성으로 만들어진 포도당은 생장에 쓰이거나 녹말의 형태로 저장된다. 한편 빛의 세기가 일정 수준을 넘으면 광합성 속도는 더 이상 증가하지 않는다. 이 지점을 광포화점이라고 하며, 식물마다 그 값이 다르다.',
    '1. 윗글의 내용과 일치하지 않는 것은?', '① 광합성은 엽록체에서 일어난다.', '② 광합성에는 빛 에너지가 필요하다.', '③ 포도당은 녹말의 형태로 저장될 수 있다.', '④ 빛이 강할수록 광합성 속도는 계속 증가한다.', '⑤ 광포화점은 식물마다 다를 수 있다.',
    '2. 윗글을 바탕으로 <보기>를 이해한 내용으로 적절한 것은? [3점]', '<보기>', '어떤 학생이 빛의 세기를 달리하며 수초에서 나오는 기포 수를 세었다.', '① 기포 수는 빛의 세기와 관계가 없다.', '② 빛이 약할 때 기포 수가 가장 많다.', '③ 빛이 일정 세기를 넘으면 기포 수 증가가 멈춘다.', '④ 기포는 녹말이 분해되어 생긴다.', '⑤ 수초는 빛 없이도 광합성을 한다.',
    '[3~4] 다음 시를 읽고 물음에 답하시오.', '나 보기가 역겨워\n가실 때에는\n말없이 고이 보내 드리우리다.\n\n영변에 약산\n진달래꽃\n아름 따다 가실 길에 뿌리우리다.\n\n가시는 걸음걸음\n놓인 그 꽃을\n사뿐히 즈려밟고 가시옵소서.\n\n나 보기가 역겨워\n가실 때에는\n죽어도 아니 눈물 흘리우리다.\n                    - 김소월, 「진달래꽃」',
    '3. 윗글의 화자에 대한 설명으로 적절하지 않은 것은?', '① 화자는 이별의 상황에 놓여 있다.', '② 화자는 임을 말없이 보내겠다고 한다.', '③ 화자는 임이 가는 길에 꽃을 뿌리겠다고 한다.', '④ 화자는 임을 원망하며 떠나지 말라고 외친다.', '⑤ 화자는 슬픔을 겉으로 드러내지 않으려 한다.',
    '4. 윗글의 표현상 특징으로 가장 적절한 것은?', '① 반어적 표현으로 화자의 정서를 드러낸다.', '② 색채 대비로 계절의 변화를 보여 준다.', '③ 의성어를 활용하여 생동감을 준다.', '④ 명령형 어미로 단호한 태도를 드러낸다.', '⑤ 설의적 표현으로 주제를 강조한다.',
  ];

  function defaults() {
    const s = A.Settings.get();
    return {
      name: '기본 · ' + s.brand.academyName + ' 시험지', paper: s.output.paper || 'B4', columns: 2, fontFamily: '', fontPt: 10, lineSpacing: 1.65, margin: 14, accent: s.brand.accent,
      brand: { academyName: s.brand.academyName, title: '', sub: '국어 영역', footerText: s.brand.footerText, pageNumbers: true },
      slots: {
        header: { mode: 'auto', asset: null, fit: 'cover', fx: 50, fy: 50, height: 22, opacity: 1, pages: 'all', textColor: 'auto' },
        cover: { mode: 'none', asset: null, fit: 'cover', fx: 50, fy: 50, opacity: 1 },
        divider: { mode: 'auto', asset: null, height: 1.6 },
        footer: { mode: 'text' },
        watermark: { mode: 'none', asset: null, opacity: 0.06, text: '' },
        logo: { mode: 'none', asset: null },
      },
    };
  }
  const PRESETS_KEY = 'ks.design.presets';
  const loadPresets = () => JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]');
  const savePresets = (p) => localStorage.setItem(PRESETS_KEY, JSON.stringify(p));

  A.route('design', async (view, params) => {
    view.className = 'view flush';
    const presets = loadPresets();
    const def = presets.find((p) => p.is_default);
    let st = def ? A.deepMerge(defaults(), A.clone(def.state)) : defaults();
    let presetId = def?.id || null;
    const undo = [], redo = [];
    let tab = 'banner', openSlot = 'header', zoom = 0.62, curPage = 0, sourceId = params.doc || 'sample', warnings = [], pageCount = 0;
    const assets = new Map();
    for (const a of await A.DB.all('assets')) assets.set(a.id, a);
    const docs = (await A.DB.all('documents')).filter((d) => d.structure?.items?.length);

    const left = h('div', { class: 'wb-left' });
    const center = h('div', { class: 'wb-center' });
    const right = h('div', { class: 'wb-right' });
    view.append(h('div', { class: 'wb' }, left, center, right));

    function commit(mut, { soft } = {}) {
      if (!soft) { undo.push(JSON.stringify(st)); if (undo.length > 80) undo.shift(); redo.length = 0; }
      mut(st);
      drawLeft(); drawPreview();
    }
    let softTimer = null;
    function commitSoft(mut) { // 슬라이더: 끌기 시작할 때 한 번만 기록
      if (!softTimer) { undo.push(JSON.stringify(st)); redo.length = 0; }
      clearTimeout(softTimer); softTimer = setTimeout(() => (softTimer = null), 600);
      mut(st); drawPreview(); syncLabels();
    }
    function doUndo() { if (!undo.length) return; redo.push(JSON.stringify(st)); st = JSON.parse(undo.pop()); drawLeft(); drawPreview(); }
    function doRedo() { if (!redo.length) return; undo.push(JSON.stringify(st)); st = JSON.parse(redo.pop()); drawLeft(); drawPreview(); }

    async function addAsset(file, slot) {
      if (!file || !file.type.startsWith('image/')) return A.toast('이미지 파일만 넣을 수 있어요', 'bad');
      if (file.size > 5 * 1024 * 1024) return A.toast('5MB 이하 이미지만 넣을 수 있어요', 'bad');
      const src = await A.readAs(file, 'readAsDataURL');
      const stats = await A.imageStats(src);
      const asset = { id: A.uid('as_'), name: file.name, src, ...stats, kind: slot, created_at: Date.now() };
      await A.DB.put('assets', asset);
      assets.set(asset.id, asset);
      commit((s) => { s.slots[slot].mode = 'image'; s.slots[slot].asset = asset.id; });
      if (stats.palette.length) A.toast('이미지에서 강조색 후보를 뽑았어요 (배너 패널 아래)');
    }

    // ---------- 왼쪽 패널 ----------
    let labelSync = [];
    function syncLabels() { labelSync.forEach((f) => f()); }
    function range(label, get, setv, min, max, step, fmt) {
      const out = h('span', { class: 'num small' });
      const inp = h('input', { type: 'range', min, max, step, value: get(), 'aria-label': label, oninput: (e) => commitSoft((s) => setv(s, +e.target.value)) });
      labelSync.push(() => { out.textContent = fmt(get()); });
      out.textContent = fmt(get());
      return h('div', { class: 'mini' }, h('span', null, label), h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, inp, out));
    }
    const segc = (opts, cur, on) => h('div', { class: 'seg' }, opts.map(([v, l]) => h('button', { class: cur === v ? 'on' : '', onclick: () => on(v) }, l)));

    function slotCard(key) {
      const sl = st.slots[key];
      const on = openSlot === key;
      const asset = sl.asset && assets.get(sl.asset);
      const card = h('div', { class: 'slot-card' + (on ? ' on' : ''), 'data-slot': key },
        h('div', { class: 'sh', onclick: () => { openSlot = on ? null : key; drawLeft(); } }, h('div', null, h('b', null, SLOT_INFO[key][0]), h('div', { class: 'tiny muted' }, SLOT_INFO[key][1])), h('span', { class: 'chip' + (sl.mode !== 'none' ? ' accent' : '') }, MODES[sl.mode])));
      if (!on) return card;
      const body = h('div', { class: 'slot-body' });
      body.append(h('div', { class: 'row' }, SLOT_MODES[key].map((m) => h('button', { class: 'chip btnchip' + (sl.mode === m ? ' on' : ''), onclick: () => commit((s) => { s.slots[key].mode = m; }) }, MODES[m]))));
      if (sl.mode === 'image' || sl.mode === 'library') {
        const fileIn = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/svg+xml', class: 'hidden', onchange: (e) => addAsset(e.target.files[0], key) });
        const pv = h('div', { class: 'pv', title: '눌러서 초점 위치 지정', style: asset ? { backgroundImage: `url(${asset.src})`, backgroundPosition: `${sl.fx ?? 50}% ${sl.fy ?? 50}%` } : null },
          asset && sl.fx != null ? h('i', { style: { left: sl.fx + '%', top: sl.fy + '%' } }) : null);
        pv.addEventListener('click', (e) => { if (!asset) return; const r = pv.getBoundingClientRect(); commit((s) => { s.slots[key].fx = Math.round((e.clientX - r.left) / r.width * 100); s.slots[key].fy = Math.round((e.clientY - r.top) / r.height * 100); }); });
        body.append(h('div', { class: 'img-pick' }, pv, h('div', { class: 'stack', style: { gap: '4px' } }, h('button', { class: 'btn sm', onclick: () => fileIn.click() }, asset ? '이미지 바꾸기' : '이미지 올리기'), h('span', { class: 'tiny muted' }, asset ? `${asset.width}×${asset.height}` : 'PNG·JPG·WebP·SVG, 5MB'))), fileIn);
        const lib = [...assets.values()];
        if (lib.length) body.append(h('div', null, h('div', { class: 'tiny muted', style: { marginBottom: '4px' } }, '내 라이브러리'), h('div', { class: 'swatches' }, lib.slice(-12).map((a) => h('button', { class: 'sw' + (sl.asset === a.id ? ' on' : ''), title: a.name, style: { width: '44px', backgroundImage: `url(${a.src})`, backgroundSize: 'cover', backgroundPosition: 'center' }, onclick: () => commit((s) => { s.slots[key].asset = a.id; if (s.slots[key].mode === 'library') s.slots[key].mode = 'image'; }) })))));
        if (key !== 'logo' && key !== 'watermark') body.append(h('div', { class: 'mini' }, h('span', null, '맞춤'), segc([['cover', '채우기'], ['contain', '맞추기'], ['stretch', '늘이기']], sl.fit, (v) => commit((s) => { s.slots[key].fit = v; }))));
        if (asset?.palette?.length) body.append(h('div', { class: 'mini' }, h('span', null, '강조색 추천'), h('div', { class: 'swatches' }, asset.palette.map((c) => h('button', { class: 'sw', title: c, style: { background: c }, onclick: () => commit((s) => { s.accent = c; }) })))));
        if (key === 'header' && asset) {
          const lum = asset.lum;
          body.append(h('div', { class: 'mini' }, h('span', null, '글자색'), segc([['auto', '자동'], ['light', '흰색'], ['dark', '검정']], sl.textColor, (v) => commit((s) => { s.slots.header.textColor = v; }))));
          if (sl.textColor === 'auto' && lum > 0.4 && lum < 0.62) body.append(h('div', { class: 'wb-warn' }, '배경 밝기가 중간이라 글자가 잘 안 보일 수 있어요. 글자색을 직접 고르거나 투명도를 낮춰 보세요.'));
        }
      }
      if (key === 'header' && sl.mode !== 'none') {
        body.append(range('높이', () => st.slots.header.height, (s, v) => (s.slots.header.height = v), 10, 60, 1, (v) => v + 'mm'));
        body.append(h('div', { class: 'mini' }, h('span', null, '적용 쪽'), h('select', { class: 'input', style: { height: '28px' }, onchange: (e) => commit((s) => { s.slots.header.pages = e.target.value; }) }, [['all', '모든 쪽'], ['first', '첫 쪽만'], ['odd', '홀수 쪽'], ['even', '짝수 쪽']].map(([v, l]) => h('option', { value: v, selected: sl.pages === v }, l)))));
      }
      if ((key === 'header' || key === 'cover') && (sl.mode === 'image' || sl.mode === 'library')) body.append(range('불투명도', () => st.slots[key].opacity, (s, v) => (s.slots[key].opacity = v), 0.1, 1, 0.05, (v) => Math.round(v * 100) + '%'));
      if (key === 'watermark' && sl.mode !== 'none') {
        body.append(range('불투명도', () => st.slots.watermark.opacity, (s, v) => (s.slots.watermark.opacity = v), 0.02, 0.3, 0.01, (v) => Math.round(v * 100) + '%'));
        if (sl.mode === 'text') body.append(h('input', { class: 'input', placeholder: '워터마크 글자 (비우면 학원명)', value: sl.text || '', oninput: (e) => commitSoft((s) => { s.slots.watermark.text = e.target.value; }) }));
      }
      if (key === 'divider' && sl.mode !== 'none') body.append(range('두께', () => st.slots.divider.height, (s, v) => (s.slots.divider.height = v), 0.6, 8, 0.2, (v) => v.toFixed(1) + 'mm'));
      card.append(body);
      return card;
    }

    function drawLeft() {
      labelSync = [];
      left.innerHTML = '';
      const tabs = h('div', { class: 'wb-tabs', role: 'tablist' }, [['paper', '용지·글꼴'], ['banner', '배너·이미지'], ['brand', '브랜드'], ['preset', '프리셋']].map(([id, l]) => h('button', { class: tab === id ? 'on' : '', role: 'tab', onclick: () => { tab = id; drawLeft(); } }, l)));
      const p = h('div', { class: 'wb-panel' });
      if (tab === 'paper') {
        p.append(
          h('div', { class: 'wb-sec' }, h('h4', null, '용지'), segc([['A4', 'A4 (210×297)'], ['B4', 'B4 (257×364)']], st.paper, (v) => commit((s) => { s.paper = v; }))),
          h('div', { class: 'wb-sec' }, h('h4', null, '단'), segc([[1, '1단'], [2, '2단']], st.columns, (v) => commit((s) => { s.columns = v; }))),
          h('div', { class: 'wb-sec' }, h('h4', null, '본문 글꼴'),
            A.fonts.select(st.fontFamily, (v) => commit((s) => { s.fontFamily = v; }), { allowInherit: true, inheritLabel: `설정 따름 (${A.fonts.nameOf(A.Settings.get().fonts.paper)})`, label: '시험지 본문 글꼴', style: { width: '100%' } }),
            h('div', { class: 'tiny muted', style: { marginTop: '6px' } }, '이 시험지에만 적용돼요. 기본 글꼴은 설정 > 글꼴에서 바꿔요.')),
          h('div', { class: 'wb-sec stack', style: { gap: '8px' } }, h('h4', null, '본문'),
            range('글자 크기', () => st.fontPt, (s, v) => (s.fontPt = v), 8, 13, 0.5, (v) => v + 'pt'),
            range('줄 간격', () => st.lineSpacing, (s, v) => (s.lineSpacing = v), 1.3, 2.2, 0.05, (v) => Math.round(v * 100) + '%'),
            range('여백', () => st.margin, (s, v) => (s.margin = v), 8, 25, 1, (v) => v + 'mm')),
          h('div', { class: 'wb-sec' }, h('h4', null, '목표 쪽수에 맞추기'),
            h('div', { class: 'row' }, h('input', { class: 'input', type: 'number', min: 1, max: 40, value: Math.max(1, pageCount - 1) || 1, id: 'target-pages', style: { width: '80px' } }), h('span', { class: 'small muted' }, '쪽 이하'),
              h('button', { class: 'btn sm', onclick: () => fitPages(+left.querySelector('#target-pages').value) }, '자동 맞춤')),
            h('div', { class: 'tiny muted', style: { marginTop: '6px' } }, '글자 크기 → 줄 간격 → 여백 순서로 허용 범위 안에서 줄여요.')));
      }
      if (tab === 'banner') {
        p.append(h('div', { class: 'tiny muted' }, '미리보기의 머리 배너를 눌러도 여기로 와요. 이미지 파일을 배너 위에 끌어다 놓으면 바로 바뀝니다.'));
        for (const k of Object.keys(SLOT_INFO)) p.append(slotCard(k));
      }
      if (tab === 'brand') {
        const field = (label, path, ph) => h('div', { class: 'field' }, h('label', null, label), h('input', { class: 'input', value: path.split('.').reduce((a, k) => a[k], st) || '', placeholder: ph || '', oninput: (e) => commitSoft((s) => { const ks = path.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], s)[last] = e.target.value; }) }));
        p.append(field('학원명', 'brand.academyName'), field('시험지 제목', 'brand.title', '비우면 자료 제목'), field('부제', 'brand.sub', '예: 국어 영역'), field('꼬리말 문구', 'brand.footerText'),
          h('label', { class: 'row small' }, h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: st.brand.pageNumbers, onchange: (e) => commit((s) => { s.brand.pageNumbers = e.target.checked; }) }), h('span')), '쪽 번호'),
          h('div', { class: 'wb-sec' }, h('h4', null, '강조색'), h('div', { class: 'swatches' }, SWATCHES.map((c) => h('button', { class: 'sw' + (st.accent.toLowerCase() === c ? ' on' : ''), style: { background: c }, title: c, onclick: () => commit((s) => { s.accent = c; }) })),
            h('input', { type: 'color', value: st.accent, oninput: (e) => commitSoft((s) => { s.accent = e.target.value; }), style: { width: '28px', height: '28px', border: 0, padding: 0, background: 'none' } }))));
      }
      if (tab === 'preset') {
        const list = loadPresets();
        p.append(
          h('div', { class: 'field' }, h('label', null, '프리셋 이름'), h('input', { class: 'input', value: st.name, oninput: (e) => { st.name = e.target.value; } })),
          h('div', { class: 'row' },
            h('button', { class: 'btn primary sm', onclick: () => savePreset(false) }, presetId ? '저장 (새 버전)' : '새 프리셋으로 저장'),
            presetId ? h('button', { class: 'btn sm', onclick: () => savePreset(true) }, '다른 이름으로') : null),
          h('div', { class: 'wb-sec' }, h('h4', null, `저장된 프리셋 ${list.length}개`),
            list.length ? list.map((pr) => h('div', { class: 'slot-card' + (pr.id === presetId ? ' on' : ''), style: { marginBottom: '6px' } },
              h('div', { class: 'row' }, h('b', { class: 'small' }, pr.name), pr.is_default ? h('span', { class: 'chip accent' }, '기본') : null, h('span', { class: 'spacer' }), h('span', { class: 'tiny muted' }, 'v' + pr.version)),
              h('div', { class: 'row' },
                h('button', { class: 'btn sm', onclick: () => { undo.push(JSON.stringify(st)); st = A.deepMerge(defaults(), A.clone(pr.state)); presetId = pr.id; drawLeft(); drawPreview(); } }, '불러오기'),
                h('button', { class: 'btn sm', onclick: () => { const l = loadPresets(); l.forEach((x) => (x.is_default = x.id === pr.id)); savePresets(l); drawLeft(); } }, '기본으로'),
                pr.versions?.length ? h('select', { class: 'input', style: { height: '26px', fontSize: '12px' }, onchange: (e) => { const v = pr.versions.find((x) => String(x.version) === e.target.value); if (v) { undo.push(JSON.stringify(st)); st = A.deepMerge(defaults(), A.clone(v.state)); drawLeft(); drawPreview(); A.toast(`v${v.version}로 되돌렸어요 (저장하면 새 버전)`); } } }, h('option', null, '이전 버전'), pr.versions.map((v) => h('option', { value: v.version }, `v${v.version} · ${A.fmtDate(v.at)}`))) : null,
                h('span', { class: 'spacer' }),
                h('button', { class: 'btn sm ghost danger', onclick: () => { savePresets(loadPresets().filter((x) => x.id !== pr.id)); if (presetId === pr.id) presetId = null; drawLeft(); } }, '삭제')))) : h('div', { class: 'small muted' }, '아직 없어요.')));
      }
      left.append(tabs, p);
    }
    function savePreset(asNew) {
      const list = loadPresets();
      let pr = !asNew && presetId && list.find((x) => x.id === presetId);
      if (pr) { pr.versions = [{ version: pr.version, at: pr.updated_at, state: pr.state }, ...(pr.versions || [])].slice(0, 20); pr.version++; pr.state = A.clone(st); pr.name = st.name; pr.updated_at = Date.now(); }
      else { pr = { id: A.uid('pr_'), name: asNew ? st.name + ' 사본' : st.name, version: 1, state: A.clone(st), versions: [], is_default: !list.length, updated_at: Date.now() }; list.push(pr); presetId = pr.id; }
      savePresets(list);
      A.toast(`"${pr.name}" v${pr.version} 저장`);
      drawLeft();
    }

    // ---------- 미리보기 ----------
    function blocksFrom() {
      let lines, title;
      if (sourceId !== 'sample') {
        const d = docs.find((x) => x.id === sourceId);
        if (d) { title = d.title; return { title, st: d.structure }; }
      }
      lines = SAMPLE.flatMap((t, i) => (i === 1 || i === 17 ? [{ gid: 'S' + i, text: '__PASSAGE__' + i }] : t.split('\n').length > 1 ? [{ gid: 'S' + i, text: '__PASSAGE__' + i }] : [{ gid: 'S' + i, text: t }]));
      const s = A.structure.ruleStructure(lines);
      for (const set of s.sets) set.passage = set.passage.split('\n').map((x) => (x.startsWith('__PASSAGE__') ? SAMPLE[+x.slice(11)] : x)).join('\n');
      return { title: '샘플 · 2학년 중간고사 대비', st: s };
    }
    function textColorFor(sl, asset) {
      if (sl.mode === 'text') return '#18181b';
      if (sl.mode === 'auto') return '#ffffff';
      if (sl.textColor === 'light') return '#ffffff';
      if (sl.textColor === 'dark') return '#18181b';
      return asset && asset.lum * sl.opacity + (1 - sl.opacity) * 1 > 0.55 ? '#18181b' : '#ffffff';
    }
    function bgSize(fit) { return fit === 'contain' ? 'contain' : fit === 'stretch' ? '100% 100%' : 'cover'; }
    function headerApplies(i) { const p = st.slots.header.pages; return p === 'all' || (p === 'first' && i === 0) || (p === 'odd' && i % 2 === 0) || (p === 'even' && i % 2 === 1); }

    function makeSheet(i, title, total) {
      const [wmm, hmm] = PAPER[st.paper];
      if (st.fontFamily) A.fonts.ensure(st.fontFamily);
      const sheet = h('div', { class: 'sheet', style: { width: wmm * MM + 'px', height: hmm * MM + 'px', padding: `${st.margin * MM}px`, fontSize: st.fontPt + 'pt', fontFamily: st.fontFamily ? A.fonts.stackOf(st.fontFamily, 'paper') : null, lineHeight: st.lineSpacing } });
      const hs = st.slots.header;
      if (hs.mode !== 'none' && headerApplies(i)) {
        const asset = hs.asset && assets.get(hs.asset);
        const isImg = (hs.mode === 'image' || hs.mode === 'library') && asset;
        const color = textColorFor(hs, asset);
        const hdr = h('div', { class: 'hdr', title: '눌러서 배너 바꾸기 · 이미지를 끌어다 놓으면 교체', style: { height: hs.height * MM + 'px', marginBottom: 4 * MM + 'px', color, textShadow: isImg && color === '#ffffff' ? '0 1px 3px rgba(0,0,0,.55)' : 'none', background: hs.mode === 'auto' ? st.accent : 'transparent', borderBottom: hs.mode === 'text' ? `0.8mm solid ${st.accent}` : 'none', borderRadius: hs.mode === 'auto' || isImg ? '1.5mm' : '0' } },
          isImg ? h('div', { class: 'tint', style: { backgroundImage: `url(${asset.src})`, backgroundSize: bgSize(hs.fit), backgroundPosition: `${hs.fx}% ${hs.fy}%`, backgroundRepeat: 'no-repeat', opacity: hs.opacity, borderRadius: '1.5mm' } }) : null,
          h('div', null, h('div', { class: 'ht' }, st.brand.title || title), h('div', { class: 'hs' }, [st.brand.academyName, st.brand.sub].filter(Boolean).join(' · '))),
          logoEl() || h('div', { class: 'hs pnum' }, `${i + 1} / ${total || '?'}`),
          h('span', { class: 'hdr-hint' }, '클릭·끌어다 놓기로 교체'));
        hdr.addEventListener('click', () => { tab = 'banner'; openSlot = 'header'; drawLeft(); });
        hdr.addEventListener('dragover', (e) => { e.preventDefault(); hdr.classList.add('drop-over'); });
        hdr.addEventListener('dragleave', () => hdr.classList.remove('drop-over'));
        hdr.addEventListener('drop', (e) => { e.preventDefault(); hdr.classList.remove('drop-over'); addAsset(e.dataTransfer.files[0], 'header'); });
        sheet.append(hdr);
      }
      const wm = st.slots.watermark;
      if (wm.mode !== 'none') {
        const a = wm.asset && assets.get(wm.asset);
        sheet.append(h('div', { class: 'wm', style: { opacity: wm.opacity } }, (wm.mode === 'image' || wm.mode === 'library') && a ? h('img', { src: a.src, alt: '' }) : wm.mode === 'text' ? h('span', null, wm.text || st.brand.academyName) : null));
      }
      const body = h('div', { class: 'body', style: { gridTemplateColumns: `repeat(${st.columns}, 1fr)`, columnGap: 7 * MM + 'px' } });
      const cols = Array.from({ length: st.columns }, () => h('div', { class: 'colm' }));
      body.append(...cols);
      sheet.append(body);
      if (st.slots.footer.mode !== 'none') sheet.append(h('div', { class: 'ftr', style: { marginTop: 3 * MM + 'px' } }, h('span', null, [st.brand.academyName, st.brand.footerText].filter(Boolean).join(' · ')), st.brand.pageNumbers ? h('span', { class: 'pn' }, String(i + 1)) : h('span')));
      return { sheet, cols };
    }
    function logoEl() {
      const lg = st.slots.logo; const a = lg.asset && assets.get(lg.asset);
      return lg.mode !== 'none' && a ? h('img', { class: 'logo-img', src: a.src, alt: '로고' }) : null;
    }
    function coverSheet(title) {
      const cv = st.slots.cover; const [wmm, hmm] = PAPER[st.paper];
      const a = cv.asset && assets.get(cv.asset);
      const isImg = (cv.mode === 'image' || cv.mode === 'library') && a;
      const dark = isImg ? a.lum * cv.opacity + (1 - cv.opacity) < 0.55 : false;
      return h('div', { class: 'sheet cover', style: { width: wmm * MM + 'px', height: hmm * MM + 'px', color: isImg ? (dark ? '#fff' : '#18181b') : '#18181b' } },
        h('div', { class: 'cv-bg', style: isImg ? { backgroundImage: `url(${a.src})`, backgroundSize: bgSize(cv.fit), backgroundPosition: `${cv.fx}% ${cv.fy}%`, opacity: cv.opacity } : { background: `linear-gradient(${st.accent}, ${st.accent}) bottom / 100% 38% no-repeat` } }),
        h('div', { class: 'cv-in' }, h('h1', null, st.brand.title || title), h('p', null, [st.brand.academyName, st.brand.sub].filter(Boolean).join(' · ')), logoEl()));
    }
    // OCR 줄바꿈은 화면상 줄일 뿐: 운문은 줄을 살리고, 산문·독서는 문장으로 이어 붙임
    function flowText(s) {
      if (s.domain === 'POETRY' || !s.passage_refs || !s.passage_refs.length || s.passage_refs[0].startsWith('S')) return s.passage;
      return s.passage.split('\n').reduce((acc, line) => (!acc ? line : /[.?!”"」]$/.test(acc) ? acc + '\n' + line : acc + (/[가-힣]$/.test(acc) && /^[가-힣]/.test(line) ? '' : ' ') + line), '');
    }
    function blockEls(sst) {
      const out = [];
      let lastSet = -1;
      const div = st.slots.divider; const da = div.asset && assets.get(div.asset);
      sst.items.forEach((it) => {
        const parts = [];
        if (it.set != null && it.set !== lastSet) {
          const s = sst.sets[it.set];
          lastSet = it.set;
          const setBlk = h('div', { class: 'blk' },
            div.mode !== 'none' ? h('div', { class: 'divider', style: { height: div.height + 'mm', background: (div.mode === 'image' || div.mode === 'library') && da ? `url(${da.src}) center / cover` : st.accent } }) : null,
            h('div', { class: 'setline' }, s.header || ''), s.passage ? h('div', { class: 'passage' }, flowText(s)) : null);
          out.push({ el: setBlk, label: `${s.header || '지문'}` });
        }
        parts.push(h('div', { class: 'q' }, h('span', { class: 'qn' }, it.number + '.'), it.stem));
        if (it.boogi) parts.push(h('div', { class: 'bg' }, h('div', { style: { textAlign: 'center', fontWeight: 700 } }, '< 보 기 >'), it.boogi));
        parts.push(h('div', { class: 'chs' }, [1, 2, 3, 4, 5].filter((k) => it.choices[k]).map((k) => h('div', null, `${A.structure.CH[k - 1]} ${it.choices[k]}`))));
        out.push({ el: h('div', { class: 'blk' }, parts), label: `${it.number}번 문항` });
      });
      return out;
    }

    let sheets = [];
    function layout(container) {
      const { title, st: sst } = blocksFrom();
      warnings = [];
      sheets = [];
      const wraps = [];
      const [wmm, hmm] = PAPER[st.paper];
      const addWrap = (sheet) => { const w = h('div', { class: 'sheet-wrap', style: { width: wmm * MM * zoom + 'px', height: hmm * MM * zoom + 'px' } }, h('div', { class: 'sheet-scale', style: { transform: `scale(${zoom})` } }, sheet)); container.append(w); wraps.push(w); sheets.push(sheet); };
      if (st.slots.cover.mode !== 'none') addWrap(coverSheet(title));
      let idx = 0, cur = makeSheet(idx, title), col = 0;
      addWrap(cur.sheet);
      const fits = (c) => c.scrollHeight <= c.clientHeight + 1;
      for (const b of blockEls(sst)) {
        cur.cols[col].append(b.el);
        if (fits(cur.cols[col])) continue;
        if (cur.cols[col].children.length > 1) {
          b.el.remove();
          col++;
          if (col >= st.columns) { idx++; cur = makeSheet(idx, title); col = 0; addWrap(cur.sheet); }
          cur.cols[col].append(b.el);
        }
        if (!fits(cur.cols[col])) warnings.push(`${b.label}이(가) 한 단보다 길어 잘려요. 글자 크기를 줄이거나 1단으로 바꿔 보세요.`);
      }
      const total = sheets.length - (st.slots.cover.mode !== 'none' ? 1 : 0);
      sheets.forEach((s) => s.querySelectorAll('.pnum').forEach((x) => { x.textContent = x.textContent.replace('?', total); }));
      return { title, total };
    }
    function drawPreview() {
      center.innerHTML = '';
      const canvas = h('div', { class: 'wb-canvas' });
      const sel = h('select', { class: 'input', style: { height: '30px', maxWidth: '260px' }, 'aria-label': '미리보기 내용', onchange: (e) => { sourceId = e.target.value; drawPreview(); } },
        h('option', { value: 'sample', selected: sourceId === 'sample' }, '샘플 시험지'), docs.map((d) => h('option', { value: d.id, selected: sourceId === d.id }, `자료함: ${d.title}`)));
      const tb = h('div', { class: 'wb-toolbar' },
        h('span', { class: 'small muted' }, '미리보기'), sel,
        h('button', { class: 'btn sm icon-btn', title: '실행 취소 (Ctrl+Z)', disabled: !undo.length, onclick: doUndo, html: icon('undo') }),
        h('button', { class: 'btn sm icon-btn', title: '다시 실행 (Ctrl+Y)', disabled: !redo.length, onclick: doRedo, html: icon('redo') }),
        h('button', { class: 'btn sm', onclick: () => { zoom = Math.max(0.3, +(zoom - 0.1).toFixed(2)); drawPreview(); } }, '−'),
        h('span', { class: 'small num' }, Math.round(zoom * 100) + '%'),
        h('button', { class: 'btn sm', onclick: () => { zoom = Math.min(1.2, +(zoom + 0.1).toFixed(2)); drawPreview(); } }, '+'),
        h('span', { class: 'spacer' }),
        h('span', { class: 'small', id: 'pc' }),
        h('button', { class: 'btn sm primary', title: '인쇄하거나 PDF로 저장 (Ctrl+P)', onclick: printAll, html: icon('printer') + '출력 미리보기' }));
      center.append(tb, canvas);
      const { total } = layout(canvas);
      pageCount = total;
      tb.querySelector('#pc').innerHTML = `${total}쪽` + (warnings.length ? ` · <span class="wb-warn">경고 ${warnings.length}</span>` : ' · 잘린 문항 없음');
      if (warnings.length) canvas.prepend(h('div', { class: 'card', style: { padding: '10px 14px', maxWidth: '720px' } }, warnings.map((w) => h('div', { class: 'wb-warn' }, w))));
      drawThumbs();
    }
    function drawThumbs() {
      right.innerHTML = '';
      sheets.forEach((s, i) => {
        const w = s.offsetWidth, hh = s.offsetHeight, sc = 96 / w;
        const tb = h('div', { class: 'tb', style: { width: w * sc + 'px', height: hh * sc + 'px' } }, h('div', { style: { transform: `scale(${sc})`, transformOrigin: 'top left' } }, s.cloneNode(true)));
        right.append(h('div', { class: 'thumbw' + (i === curPage ? ' on' : ''), 'aria-hidden': 'true', onclick: () => { curPage = i; s.parentElement.parentElement.scrollIntoView({ behavior: 'smooth', block: 'start' }); drawThumbsSel(); } }, tb, h('div', null, s.classList.contains('cover') ? '표지' : `${i + 1 - (st.slots.cover.mode !== 'none' ? 1 : 0)}쪽`)));
      });
    }
    function drawThumbsSel() { [...right.children].forEach((c, i) => c.classList.toggle('on', i === curPage)); }

    function fitPages(target) {
      if (!target || pageCount <= target) return A.toast(pageCount <= target ? `이미 ${pageCount}쪽이에요` : '목표 쪽수를 넣어 주세요');
      undo.push(JSON.stringify(st));
      const tries = [];
      for (let f = st.fontPt; f >= 8; f -= 0.5) for (const ls of [st.lineSpacing, 1.55, 1.45, 1.35].filter((x) => x <= st.lineSpacing)) for (const m of [st.margin, 12, 10].filter((x) => x <= st.margin)) tries.push([f, ls, m]);
      const probe = h('div', { style: { position: 'absolute', left: '-99999px', top: 0 } });
      document.body.append(probe);
      let ok = null;
      const saved = A.clone(st);
      for (const [f, ls, m] of tries) {
        st.fontPt = f; st.lineSpacing = ls; st.margin = m;
        probe.innerHTML = '';
        const r = layout(probe);
        if (r.total <= target && !warnings.length) { ok = [f, ls, m]; break; }
      }
      probe.remove();
      if (!ok) { st = saved; undo.pop(); drawPreview(); return A.toast('허용 범위(8pt) 안에서는 맞출 수 없어요. 1단↔2단이나 용지를 바꿔 보세요', 'bad'); }
      drawLeft(); drawPreview();
      A.toast(`${ok[0]}pt · 줄 간격 ${Math.round(ok[1] * 100)}% · 여백 ${ok[2]}mm로 ${pageCount}쪽에 맞췄어요`);
    }
    // 출력: 작업대에서 조판한 쪽을 그대로 미리보기·인쇄 (용지·글꼴은 작업대에서 바꿈)
    const printSpec = () => ({
      title: (st.brand.title || blocksFrom().title) + ` · ${st.paper} ${st.columns}단`, paper: st.paper,
      build: () => ({ pages: sheets.map((s) => { const c = s.cloneNode(true); c.querySelectorAll('.hdr-hint').forEach((x) => x.remove()); c.querySelectorAll('.hdr').forEach((x) => { x.style.cursor = 'default'; x.removeAttribute('title'); }); return c; }), warnings: [...warnings] }),
    });
    function printAll() { A.print.preview(printSpec()); }
    A.print.register(printSpec);
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); }
      if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); doRedo(); }
      if (e.key.toLowerCase() === 's') { e.preventDefault(); savePreset(false); }
    };
    document.addEventListener('keydown', onKey);
    A.design = { get state() { return st; }, commit, addAsset, fitPages, pageCount: () => pageCount, warnings: () => warnings };
    drawLeft();
    await (document.fonts?.ready || Promise.resolve());
    drawPreview();
    return { cleanup: () => { document.removeEventListener('keydown', onKey); delete A.design; } };
  });
})(window.App);
