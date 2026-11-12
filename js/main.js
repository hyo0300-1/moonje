/* 국어 스튜디오 - 시작 */
(function (A) {
  'use strict';
  A.buildNav();
  A.applyTheme();
  A.$('#theme-btn').addEventListener('click', A.toggleTheme);
  A.$('#cmd-open').addEventListener('click', A.openPalette);
  A.$('#jobs-btn').addEventListener('click', () => A.toggleDrawer());
  A.$('#drawer-close').addEventListener('click', () => A.toggleDrawer(false));
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); A.openPalette(); }
  });
  A.Jobs.on(A.renderJobs);
  A.renderJobs();
  window.addEventListener('hashchange', A.renderRoute);

  // 에이전트용 공개 API: 화면과 같은 계약 (서버 단계의 /v1/jobs 와 같은 모양)
  A.api = {
    version: '0.1-local',
    routes: () => A.NAV.filter((n) => n.id).map((n) => ({ id: n.id, label: n.label, url: '#/' + n.id })),
    listJobs: () => A.Jobs.list.map(({ id, kind, title, status, stage, progress, created_at }) => ({ id, kind, title, status, stage, progress, created_at })),
    getJob: (id) => A.Jobs.get(id),
    listDocuments: () => A.DB.all('documents').then((ds) => ds.map((d) => ({ id: d.id, title: d.title, mode: d.mode, pages: d.pages.length, items: d.structure?.items?.length || 0 }))),
    getDocument: (id) => A.DB.get('documents', id),
    settings: () => { const s = A.Settings.get(); return { ...s, ai: { ...s.ai, keys: Object.fromEntries(Object.entries(s.ai.keys).map(([k, v]) => [k, v ? '••••' : ''])) } }; },
    llm: { status: () => A.llm.status, generate: (opts) => A.llm.generate(opts), usage: (p) => A.llm.usage(p), models: () => window.KSLLM.MODELS },
  };

  // 배포 사이트(비밀번호 보호)에서만 잠그기 버튼 표시. 로컬 개발 서버에는 비밀번호가 없음
  if (location.protocol === 'https:') {
    const foot = A.$('.side-foot');
    foot.insertBefore(A.h('a', { href: '/__logout', class: 'btn ghost sm', title: '잠그기: 다시 들어오려면 비밀번호 필요', 'aria-label': '잠그기' }, '잠그기'), foot.lastElementChild);
  }

  A.llm.refresh();
  A.fonts.init();
  if (!location.hash) location.hash = '#/exam';
  A.renderRoute();
})(window.App);
