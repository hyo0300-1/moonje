/* 국어 스튜디오 - 자료함 (요청 10: 저장된 시험지 이동, 기간 제한 없는 보관) */
(function (A) {
  'use strict';
  const { h } = A;
  const MODE = { text: '텍스트화', structure: '구조화', analyze: '분석' };
  A.route('library', async (view) => {
    const [docs, annos, builds] = await Promise.all([A.DB.all('documents'), A.DB.all('annotations'), A.DB.all('builds')]);
    let filter = 'all';
    const root = h('div');
    view.append(root);
    function draw() {
      root.innerHTML = '';
      const rows = [
        ...docs.map((d) => ({ kind: 'doc', at: d.saved_at || d.created_at, d })),
        ...annos.map((d) => ({ kind: 'anno', at: d.saved_at || d.created_at, d })),
        ...builds.map((d) => ({ kind: 'build', at: d.saved_at || d.created_at, d })),
      ].filter((r) => filter === 'all' || r.kind === filter).sort((a, b) => b.at - a.at);
      const grid = h('div', { class: 'lib' });
      for (const r of rows) {
        const d = r.d;
        if (r.kind === 'doc') {
          const items = d.structure?.items?.length || 0;
          grid.append(h('div', { class: 'card' },
            h('div', { class: 'row' }, h('span', { class: 'chip accent' }, MODE[d.mode]), h('span', { class: 'chip' }, d.role), h('span', { class: 'spacer' }), h('span', { class: 'tiny muted' }, A.fmtDate(r.at))),
            h('h3', null, d.title),
            h('div', { class: 'small muted' }, `${d.pages.length}쪽${items ? ` · ${items}문항` : ''} · 의심 줄 ${d.pages.reduce((a, p) => a + (p.suspect_count || 0), 0)}`),
            h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => A.go('exam', { doc: d.id }) }, '열기'),
              items ? h('button', { class: 'btn sm', onclick: () => A.go('build', { doc: d.id }) }, '시험지 제작') : null,
              h('button', { class: 'btn sm', onclick: () => A.go('design', { doc: d.id }) }, '디자인'),
              h('span', { class: 'spacer' }),
              h('button', { class: 'btn sm ghost danger', onclick: async () => { if (!confirm('삭제할까요?')) return; await A.DB.del('documents', d.id); docs.splice(docs.indexOf(d), 1); draw(); } }, '삭제'))));
        } else if (r.kind === 'anno') {
          grid.append(h('div', { class: 'card' },
            h('div', { class: 'row' }, h('span', { class: 'chip accent' }, '주석'), h('span', { class: 'chip' }, d.genre || ''), h('span', { class: 'spacer' }), h('span', { class: 'tiny muted' }, A.fmtDate(r.at))),
            h('h3', null, d.title || '제목 없음'),
            h('div', { class: 'small muted' }, `주석 ${d.notes.length}개 · 필기량 ${d.density}`),
            h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => A.go('annotate', { id: d.id }) }, '열기'), h('span', { class: 'spacer' }),
              h('button', { class: 'btn sm ghost danger', onclick: async () => { if (!confirm('삭제할까요?')) return; await A.DB.del('annotations', d.id); annos.splice(annos.indexOf(d), 1); draw(); } }, '삭제'))));
        } else {
          grid.append(h('div', { class: 'card' },
            h('div', { class: 'row' }, h('span', { class: 'chip accent' }, '설계도'), h('span', { class: 'chip' }, d.mode), h('span', { class: 'spacer' }), h('span', { class: 'tiny muted' }, A.fmtDate(r.at))),
            h('h3', null, d.title),
            h('div', { class: 'small muted' }, `${d.rounds}회차 · 회차당 ${d.perRound}칸`),
            h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => A.go('build', { id: d.id }) }, '열기'), h('span', { class: 'spacer' }),
              h('button', { class: 'btn sm ghost danger', onclick: async () => { if (!confirm('삭제할까요?')) return; await A.DB.del('builds', d.id); builds.splice(builds.indexOf(d), 1); draw(); } }, '삭제'))));
        }
      }
      const total = docs.length + annos.length + builds.length;
      const last = A.Backup.last();
      const stale = total && (!last || Date.now() - last > 7 * 864e5);
      const restoreIn = h('input', { type: 'file', accept: '.json,application/json', class: 'hidden', onchange: async (e) => {
        const f = e.target.files[0]; e.target.value = '';
        if (!f) return;
        try { const n = await A.Backup.restore(f); A.toast(`자료 ${n}개를 복원했어요`); A.renderRoute(); } catch (err) { A.toast(err.message, 'bad'); }
      } });
      root.append(
        h('div', { class: 'page-head' }, h('div', null, h('h1', null, '자료함'), h('p', null, '만든 자료를 기간 제한 없이 보관합니다. 다시 출력해도 비용이 없어요.')),
          h('div', { class: 'row' },
            h('button', { class: 'btn', onclick: async () => { await A.Backup.export(); draw(); } }, '전체 내보내기'),
            h('button', { class: 'btn', onclick: () => restoreIn.click() }, '파일에서 복원'), restoreIn)),
        stale ? h('div', { class: 'card', style: { padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', borderColor: 'color-mix(in oklab, var(--warn) 50%, var(--line))' } },
          h('span', { class: 'chip warn' }, '백업 필요'),
          h('span', { class: 'small' }, last ? `마지막 백업이 ${Math.floor((Date.now() - last) / 864e5)}일 전입니다.` : '아직 백업한 적이 없어요.', ' 자료는 이 브라우저에만 있어서, 브라우저 기록을 지우면 사라져요.'),
          h('span', { class: 'spacer' }),
          h('button', { class: 'btn sm primary', onclick: async () => { await A.Backup.export(); draw(); } }, '지금 백업')) : null,
        h('div', { class: 'row', style: { marginBottom: '12px' } },
          h('div', { class: 'seg' }, [['all', '전체'], ['doc', '시험지'], ['anno', '주석'], ['build', '설계도']].map(([k, l]) => h('button', { class: filter === k ? 'on' : '', onclick: () => { filter = k; draw(); } }, l)))),
        rows.length ? grid : h('div', { class: 'card empty' }, '아직 저장한 자료가 없어요. 시험지 분석·저장이나 주석 달기에서 "자료함에 저장"을 눌러 보세요.'));
    }
    draw();
  });
})(window.App);
