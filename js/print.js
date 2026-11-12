/* 국어 스튜디오 - 출력 미리보기 + 인쇄 (주석 달기 · 주석교재 · 디자인 작업대 · 분석 리포트가 같이 씀)
 * A.print.preview(spec)
 *   spec.title     미리보기 제목
 *   spec.paper     'A4' | 'B4'
 *   spec.papers    고를 수 있는 용지 목록 (없으면 용지 고정)
 *   spec.controls  [{ key, label, options: [[값, 이름]...], value }]  바꾸면 다시 조판
 *   spec.build(opts, host) → { pages: [Element], warnings: [] }   host는 실제 크기로 재는 숨은 자리
 *   spec.flow      true면 쪽 나눔을 브라우저에 맡김(리포트처럼 흐르는 글)
 * A.print.register(fn)  지금 화면의 출력 내용 등록 → Ctrl+P가 이 미리보기를 엶 */
(function (A) {
  'use strict';
  const { h, icon } = A;
  const MM = 96 / 25.4;
  const PAPER = { A4: [210, 297], B4: [257, 364] };
  let provider = null;
  let openOverlay = null;

  const routeKey = () => (location.hash || '#/').split('?')[0];
  function register(fn) { provider = { fn, route: routeKey() }; }
  function openCurrent() {
    if (openOverlay) return openOverlay.print();
    if (provider && provider.route === routeKey()) return preview(provider.fn());
    A.toast('이 화면에는 출력할 자료가 없어요. 주석 달기·주석교재·디자인 작업대·분석 리포트에서 출력할 수 있어요.');
  }

  // "1-3, 5" → {0,1,2,4}. 비우면 전체. 잘못 쓰면 null
  function parseRange(s, total) {
    s = (s || '').replace(/\s/g, '');
    if (!s) return new Set(Array.from({ length: total }, (_, i) => i));
    const out = new Set();
    for (const part of s.split(',')) {
      const m = part.match(/^(\d+)(?:[-~](\d+))?$/);
      if (!m) return null;
      const a = +m[1], b = m[2] ? +m[2] : a;
      if (a < 1 || b < a) return null;
      for (let i = a; i <= Math.min(b, total); i++) out.add(i - 1);
    }
    return out.size ? out : null;
  }

  async function waitAssets(root) {
    try { await document.fonts.ready; } catch {}
    await Promise.all([...root.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; setTimeout(r, 4000); }))));
  }

  async function printPages(pages, paper, { gray = false, flow = false, margin = 14 } = {}) {
    const pr = document.getElementById('print-root');
    pr.innerHTML = '';
    pr.classList.toggle('gray', gray);
    const [w, hh] = PAPER[paper] || PAPER.A4;
    pr.append(h('style', null, flow
      ? `@page { size: ${w}mm ${hh}mm; margin: ${margin}mm }`
      : `@page { size: ${w}mm ${hh}mm; margin: 0 } #print-root .sheet { width: ${w}mm !important; height: ${(hh - 0.6).toFixed(1)}mm !important; }`));
    for (const p of pages) { const c = p.cloneNode(true); c.style.transform = ''; c.style.boxShadow = 'none'; pr.append(c); }
    pr.querySelectorAll('.hdr-hint').forEach((x) => x.remove());
    await waitAssets(pr);
    const done = () => { window.removeEventListener('afterprint', done); setTimeout(() => { pr.innerHTML = ''; }, 300); };
    window.addEventListener('afterprint', done);
    window.print();
  }

  function preview(spec) {
    if (openOverlay) openOverlay.close();
    const opts = { paper: spec.paper || A.Settings.get().output.paper || 'A4' };
    for (const c of spec.controls || []) opts[c.key] = c.value;
    let zoom = 'fit', range = '', gray = false, pages = [], warnings = [], dims = [];
    const prevFocus = document.activeElement;

    const host = h('div', { class: 'pv-measure', 'aria-hidden': 'true' });
    const bar = h('div', { class: 'pv-bar' });
    const stage = h('div', { class: 'pv-stage' });
    const tip = h('div', { class: 'pv-tip' });
    const ov = h('div', { class: 'pv-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': '출력 미리보기' }, bar, stage, tip, host);
    document.body.append(ov);

    const seg = (list, cur, on, label) => h('div', { class: 'seg', role: 'group', 'aria-label': label }, list.map(([v, l]) => h('button', { class: String(cur) === String(v) ? 'on' : '', 'aria-pressed': String(cur) === String(v), onclick: () => on(v) }, l)));
    const field = (label, el) => h('div', { class: 'pv-field' }, h('span', null, label), el);

    function rebuild() {
      host.innerHTML = '';
      let r;
      try { r = spec.build(opts, host) || {}; } catch (e) { console.error(e); A.toast('조판 중 문제가 생겼어요: ' + e.message, 'bad'); r = { pages: [] }; }
      pages = r.pages || [];
      warnings = r.warnings || [];
      // 화면에서 떼어 내면 크기를 재지 못하므로 지금 재 둠
      for (const p of pages) if (!p.isConnected) host.append(p);
      dims = pages.map((p) => [p.offsetWidth, p.offsetHeight]);
      drawBar(); drawStage();
    }
    function sel() { return parseRange(range, pages.length); }
    function drawBar() {
      bar.innerHTML = '';
      const s = sel();
      const rangeIn = h('input', { class: 'input' + (s ? '' : ' bad'), value: range, placeholder: '전체 (예: 1-3, 5)', 'aria-label': '인쇄할 쪽', style: { width: '150px', height: '30px' },
        oninput: (e) => { range = e.target.value; const ok = sel(); rangeIn.classList.toggle('bad', !ok); count.textContent = ok ? `${ok.size}/${pages.length}쪽 인쇄` : '쪽 번호를 확인하세요'; drawStage(); } });
      const count = h('b', { class: 'small num' }, s ? `${s.size}/${pages.length}쪽 인쇄` : '쪽 번호를 확인하세요');
      bar.append(
        h('h3', null, '출력 미리보기'), h('span', { class: 'small muted pv-title' }, spec.title || ''),
        spec.papers ? field('용지', seg(spec.papers.map((p) => [p, p]), opts.paper, (v) => { opts.paper = v; rebuild(); }, '용지')) : h('span', { class: 'chip' }, opts.paper),
        ...(spec.controls || []).map((c) => field(c.label, seg(c.options, opts[c.key], (v) => { opts[c.key] = v; rebuild(); }, c.label))),
        h('span', { class: 'spacer' }),
        field('쪽', rangeIn),
        h('label', { class: 'pv-field', style: { cursor: 'pointer' } }, h('input', { type: 'checkbox', checked: gray, onchange: (e) => { gray = e.target.checked; ov.classList.toggle('gray', gray); } }), h('span', null, '흑백')),
        field('보기', seg([['fit', '맞춤'], [0.5, '50%'], [0.75, '75%'], [1, '100%']], zoom, (v) => { zoom = v; drawBar(); drawStage(); }, '확대')),
        count,
        h('button', { class: 'btn sm', onclick: close }, '닫기'),
        h('button', { class: 'btn sm primary', id: 'pv-print', disabled: !pages.length, onclick: doPrint, html: icon('printer') + '인쇄' }));
      tip.innerHTML = '';
      tip.append(
        warnings.length ? h('span', { class: 'wb-warn' }, `확인할 것 ${warnings.length}개: ${warnings.slice(0, 2).join(' / ')}${warnings.length > 2 ? ' …' : ''}`) : h('span', null, '잘린 곳 없음'),
        h('span', null, ' · 인쇄 창에서 대상(프린터)을 "PDF로 저장"으로 고르면 PDF 파일로 저장돼요. 배율은 "기본값(100%)"으로 두세요.'));
    }
    function drawStage() {
      stage.innerHTML = '';
      if (!pages.length) { stage.append(h('div', { class: 'pv-empty' }, '출력할 내용이 없어요.')); return; }
      const pw = dims[0][0] || 800;
      const z = zoom === 'fit' ? Math.min(1, Math.max(0.25, (stage.clientWidth - 64) / pw)) : +zoom;
      const s = sel() || new Set();
      pages.forEach((p, i) => {
        const [w, ph] = dims[i];
        stage.append(h('div', { class: 'pv-page' + (s.has(i) ? '' : ' off') },
          h('div', { class: 'sheet-wrap', style: { width: w * z + 'px', height: ph * z + 'px' } }, h('div', { class: 'sheet-scale', style: { transform: `scale(${z})` } }, p)),
          h('div', { class: 'lab' }, `${i + 1} / ${pages.length}`)));
      });
    }
    async function doPrint() {
      const s = sel();
      if (!s) return A.toast('인쇄할 쪽 번호를 확인해 주세요 (예: 1-3, 5)', 'bad');
      const btn = bar.querySelector('#pv-print'); if (btn) btn.disabled = true;
      try { await printPages(pages.filter((_, i) => s.has(i)), opts.paper, { gray, flow: spec.flow, margin: spec.margin }); }
      finally { if (btn) btn.disabled = false; }
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    }
    let rT = null;
    const onResize = () => { clearTimeout(rT); rT = setTimeout(() => zoom === 'fit' && drawStage(), 150); };
    function close() {
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onResize);
      ov.remove();
      openOverlay = null;
      prevFocus?.focus?.();
    }
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    openOverlay = { close, print: doPrint, get pages() { return pages; }, get opts() { return opts; }, setRange: (r) => { range = r; drawBar(); drawStage(); } };
    rebuild();
    (document.fonts?.ready || Promise.resolve()).then(() => { if (openOverlay && ov.isConnected) rebuild(); });
    setTimeout(() => bar.querySelector('#pv-print')?.focus(), 50);
    return openOverlay;
  }

  // 쪽 단위로 나누는 도우미: 블록을 차례로 넣다가 넘치면 새 쪽
  function paginate(blocks, newSheet) {
    const pages = [], warnings = [];
    let cur = newSheet(0);
    pages.push(cur.sheet);
    const fits = (el) => el.scrollHeight <= el.clientHeight + 1;
    for (const b of blocks) {
      if (b.newPage && cur.body.children.length) { cur = newSheet(pages.length, b); pages.push(cur.sheet); }
      cur.body.append(b.el);
      if (fits(cur.body)) continue;
      if (cur.body.children.length > 1) {
        b.el.remove();
        cur = newSheet(pages.length, b);
        pages.push(cur.sheet);
        cur.body.append(b.el);
      }
      if (!fits(cur.body)) warnings.push(`${b.label || '내용'}이(가) 한 쪽보다 길어 잘려요`);
    }
    return { pages, warnings };
  }

  A.print = { preview, register, openCurrent, printPages, paginate, parseRange, PAPER, MM, get isOpen() { return !!openOverlay; }, get overlay() { return openOverlay; } };
})(window.App);
