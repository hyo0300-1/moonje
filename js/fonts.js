/* 국어 스튜디오 - 글꼴 (화면 · 지문/시험지 본문 · 주석)
 * 고를 수 있는 것: 기본 제공 한글 글꼴 / 내 컴퓨터에 설치된 글꼴 / 직접 올린 글꼴 파일(TTF·OTF·WOFF·WOFF2) */
(function (A) {
  'use strict';
  const G = (q) => `https://fonts.googleapis.com/css2?family=${q}&display=swap`;
  const CATALOG = [
    { id: 'pretendard', name: '프리텐다드', kind: '고딕', family: '"Pretendard", "Pretendard Variable"', fallback: 'sans-serif' },
    { id: 'noto-sans', name: '본고딕 (Noto Sans KR)', kind: '고딕', family: '"Noto Sans KR"', fallback: 'sans-serif', css: G('Noto+Sans+KR:wght@400;700') },
    { id: 'nanum-gothic', name: '나눔고딕', kind: '고딕', family: '"Nanum Gothic"', fallback: 'sans-serif', css: G('Nanum+Gothic:wght@400;700') },
    { id: 'malgun', name: '맑은 고딕 (윈도우)', kind: '고딕', family: '"Malgun Gothic", "맑은 고딕"', fallback: 'sans-serif' },
    { id: 'noto-serif', name: '본명조 (Noto Serif KR)', kind: '명조', family: '"Noto Serif KR"', fallback: 'serif', css: G('Noto+Serif+KR:wght@400;700') },
    { id: 'nanum-myeongjo', name: '나눔명조', kind: '명조', family: '"Nanum Myeongjo"', fallback: 'serif', css: G('Nanum+Myeongjo:wght@400;700') },
    { id: 'gowun-batang', name: '고운바탕', kind: '명조', family: '"Gowun Batang"', fallback: 'serif', css: G('Gowun+Batang:wght@400;700') },
    { id: 'batang', name: '바탕 (윈도우)', kind: '명조', family: '"Batang", "바탕", "AppleMyungjo"', fallback: 'serif' },
    { id: 'nanum-pen', name: '나눔손글씨 펜', kind: '손글씨', family: '"Nanum Pen Script"', fallback: 'cursive', css: G('Nanum+Pen+Script') },
    { id: 'gaegu', name: '개구', kind: '손글씨', family: '"Gaegu"', fallback: 'cursive', css: G('Gaegu:wght@400;700') },
    { id: 'gamja', name: '감자꽃', kind: '손글씨', family: '"Gamja Flower"', fallback: 'cursive', css: G('Gamja+Flower') },
  ];
  const ROLES = { ui: '화면 글꼴', paper: '지문·시험지 본문', note: '주석 글꼴' };
  const loadedCss = new Set();
  const registered = new Map(); // 올린 글꼴 id → family
  const custom = []; // { id, name, family }

  function familyOf(value) {
    if (!value) return null;
    if (value.startsWith('local:')) return `"${value.slice(6).replace(/"/g, '')}"`;
    if (value.startsWith('upload:')) { const c = custom.find((x) => x.id === value.slice(7)); return c ? `"${c.family}"` : null; }
    const f = CATALOG.find((x) => x.id === value);
    return f ? f.family : null;
  }
  function stackOf(value, role) {
    const fam = familyOf(value);
    const fallbackSans = '"Pretendard", -apple-system, "Segoe UI", "Malgun Gothic", sans-serif';
    const fallbackSerif = '"Noto Serif KR", "Nanum Myeongjo", "Batang", "바탕", "AppleMyungjo", serif';
    const base = role === 'paper' ? fallbackSerif : fallbackSans;
    return fam ? `${fam}, ${base}` : base;
  }
  function ensureCss(value) {
    const f = CATALOG.find((x) => x.id === value);
    if (!f || !f.css || loadedCss.has(f.css)) return;
    loadedCss.add(f.css);
    document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: f.css }));
  }
  function nameOf(value) {
    if (!value) return '기본';
    if (value.startsWith('local:')) return value.slice(6) + ' (내 컴퓨터)';
    if (value.startsWith('upload:')) { const c = custom.find((x) => x.id === value.slice(7)); return c ? c.name + ' (올린 글꼴)' : '올린 글꼴(없음)'; }
    return (CATALOG.find((x) => x.id === value) || {}).name || value;
  }

  // 올린 글꼴 불러와 등록
  async function loadUploads() {
    const all = (await A.DB.all('assets')).filter((a) => a.kind === 'font');
    custom.length = 0;
    for (const a of all) {
      const family = 'KS Font ' + a.id;
      custom.push({ id: a.id, name: a.name, family });
      if (registered.has(a.id)) continue;
      try {
        const ff = new FontFace(family, `url(${a.src})`);
        await ff.load();
        document.fonts.add(ff);
        registered.set(a.id, family);
      } catch (e) { console.warn('글꼴 등록 실패', a.name, e); }
    }
    return custom;
  }
  async function upload(file) {
    if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) throw new Error('TTF·OTF·WOFF·WOFF2 파일만 올릴 수 있어요');
    if (file.size > 15 * 1024 * 1024) throw new Error('15MB 이하 글꼴 파일만 올릴 수 있어요');
    const src = await A.readAs(file, 'readAsDataURL');
    const id = A.uid('ft_');
    const name = file.name.replace(/\.(ttf|otf|woff2?)$/i, '');
    try { const test = new FontFace('KS Font ' + id, `url(${src})`); await test.load(); } catch (e) { throw new Error('글꼴 파일을 읽을 수 없어요. 다른 파일로 시도해 주세요.'); }
    await A.DB.put('assets', { id, kind: 'font', name, src, created_at: Date.now() });
    await loadUploads();
    return 'upload:' + id;
  }
  async function removeUpload(id) { await A.DB.del('assets', id); await loadUploads(); }
  // 내 컴퓨터에 설치된 글꼴 목록 (크롬·엣지, 권한 요청)
  async function localFamilies() {
    if (!window.queryLocalFonts) throw new Error('이 브라우저는 설치 글꼴 목록을 지원하지 않아요. 글꼴 이름을 직접 입력해 주세요.');
    const list = await window.queryLocalFonts();
    return [...new Set(list.map((f) => f.family))].sort((a, b) => a.localeCompare(b, 'ko'));
  }

  function apply(f) {
    f = f || A.Settings.get().fonts;
    const root = document.documentElement.style;
    for (const role of Object.keys(ROLES)) ensureCss(f[role]);
    root.setProperty('--font-ui', stackOf(f.ui, 'ui'));
    root.setProperty('--font-paper', stackOf(f.paper, 'paper'));
    root.setProperty('--font-note', stackOf(f.note, 'note'));
    root.setProperty('--paper-size', (f.paperSize || 16) + 'px');
    root.setProperty('--note-size', (f.noteSize || 12) + 'px');
  }
  async function init() { try { await loadUploads(); } catch (e) { /* DB 없음 */ } apply(); }
  // 글꼴 고르기 상자 (설정·주석·디자인 작업대가 같이 씀)
  function select(value, onChange, opts = {}) {
    const groups = {};
    for (const f of CATALOG) (groups[f.kind] = groups[f.kind] || []).push(f);
    const sel = A.h('select', { class: 'input', 'aria-label': opts.label || '글꼴', style: opts.style || null, onchange: (e) => onChange(e.target.value) },
      opts.allowInherit ? A.h('option', { value: '', selected: !value }, opts.inheritLabel || '설정 따름') : null,
      Object.entries(groups).map(([k, arr]) => A.h('optgroup', { label: k }, arr.map((f) => A.h('option', { value: f.id, selected: value === f.id, style: { fontFamily: stackOf(f.id) } }, f.name)))),
      custom.length ? A.h('optgroup', { label: '올린 글꼴' }, custom.map((c) => A.h('option', { value: 'upload:' + c.id, selected: value === 'upload:' + c.id }, c.name))) : null,
      value && value.startsWith('local:') ? A.h('optgroup', { label: '내 컴퓨터' }, A.h('option', { value, selected: true }, value.slice(6))) : null);
    return sel;
  }

  A.fonts = { CATALOG, ROLES, apply, init, select, stackOf, nameOf, ensure: ensureCss, upload, removeUpload, loadUploads, localFamilies, get custom() { return custom; } };
})(window.App);
