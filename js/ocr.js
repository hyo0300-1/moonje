/* 국어 스튜디오 - 입력 읽기, 전처리, OCR 엔진과 대체 순서 */
(function (A) {
  'use strict';
  const MAX_DIM = 2400;
  if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const err = (msg, code) => Object.assign(new Error(msg), { code });
  const textToLines = (text) => text.split(/\r?\n/).map((t) => t.replace(/\s+$/, '')).filter((t) => t.trim()).map((t, i) => ({ line_no: i + 1, text: t, bbox: null, confidence: null, status: 'ok' }));

  async function canvasFrom(src, w, hgt) {
    const img = await A.loadImage(src);
    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round((w || img.width) * scale); c.height = Math.round((hgt || img.height) * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  // ---------- 파일 → 쪽 ----------
  async function imagePage(blob, fname) {
    const url = URL.createObjectURL(blob);
    try {
      const c = await canvasFrom(url);
      return { id: A.uid('pg_'), fname, kind: 'image', src: c.toDataURL('image/jpeg', 0.92), width: c.width, height: c.height };
    } finally { URL.revokeObjectURL(url); }
  }

  async function hwpxPages(file) {
    if (!window.JSZip) throw err('HWPX 읽기 모듈을 불러오지 못했습니다', 'LIB');
    const zip = await JSZip.loadAsync(file);
    const names = Object.keys(zip.files).filter((n) => /^Contents\/section\d+\.xml$/i.test(n)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)));
    if (!names.length) throw err('HWPX 본문(section)을 찾지 못했습니다', 'HWPX_EMPTY');
    const lines = [];
    for (const n of names) {
      const xml = new DOMParser().parseFromString(await zip.file(n).async('string'), 'application/xml');
      for (const p of xml.getElementsByTagNameNS('*', 'p')) {
        if (p.parentElement && p.parentElement.localName === 'p') continue;
        const t = [...p.getElementsByTagNameNS('*', 't')].map((x) => x.textContent).join('');
        if (t.trim()) lines.push(t);
      }
    }
    return [{ id: A.uid('pg_'), fname: file.name, kind: 'parsed', src: null, lines: textToLines(lines.join('\n')) }];
  }

  // PDF: 글자 레이어가 있으면 그대로 쓰고(무료), 없으면 그림으로 렌더링해서 OCR 대상
  async function pdfPages(file, onProgress) {
    if (!window.pdfjsLib) throw err('PDF 모듈을 불러오지 못했습니다', 'LIB');
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const out = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 2 });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      const tc = await page.getTextContent();
      const items = tc.items.filter((it) => it.str && it.str.trim());
      const chars = items.reduce((s, it) => s + it.str.replace(/\s/g, '').length, 0);
      const pg = { id: A.uid('pg_'), fname: `${file.name} ${i}쪽`, src: c.toDataURL('image/jpeg', 0.9), width: c.width, height: c.height };
      if (chars >= 40) { pg.kind = 'pdf_text'; pg.lines = pdfLines(items, vp); }
      else pg.kind = 'pdf_scan';
      out.push(pg);
      onProgress && onProgress(i, pdf.numPages);
    }
    return out;
  }
  function pdfLines(items, vp) {
    const boxes = items.map((it) => {
      const t = pdfjsLib.Util.transform(vp.transform, it.transform);
      const hgt = Math.hypot(t[2], t[3]);
      return { str: it.str, x: t[4], y: t[5] - hgt, w: it.width * vp.scale, h: hgt };
    });
    const mid = vp.width / 2;
    const crossing = boxes.filter((b) => b.x < mid - 4 && b.x + b.w > mid + 4).length;
    const twoCol = crossing / boxes.length < 0.04 && boxes.some((b) => b.x > mid) && boxes.some((b) => b.x + b.w < mid);
    const groups = [];
    for (const b of boxes) {
      const col = twoCol ? (b.x >= mid ? 1 : 0) : 0;
      const g = groups.find((g) => g.col === col && Math.abs(g.y - b.y) < Math.max(3, b.h * 0.5));
      if (g) g.items.push(b); else groups.push({ col, y: b.y, items: [b] });
    }
    groups.sort((a, b) => a.col - b.col || a.y - b.y);
    return groups.map((g, i) => {
      g.items.sort((a, b) => a.x - b.x);
      let text = '';
      g.items.forEach((b, k) => { if (k) { const p = g.items[k - 1]; text += b.x - (p.x + p.w) > b.h * 0.25 ? ' ' : ''; } text += b.str; });
      const x0 = Math.min(...g.items.map((b) => b.x)), y0 = Math.min(...g.items.map((b) => b.y));
      const x1 = Math.max(...g.items.map((b) => b.x + b.w)), y1 = Math.max(...g.items.map((b) => b.y + b.h));
      return { line_no: i + 1, text: text.trim(), bbox: [Math.round(x0), Math.round(y0), Math.round(x1 - x0), Math.round(y1 - y0)], confidence: 100, status: 'ok' };
    }).filter((l) => l.text);
  }

  async function fileToPages(file, onProgress) {
    const name = (file.name || 'clipboard.png').toLowerCase();
    const ext = name.includes('.') ? name.split('.').pop() : '';
    if (ext === 'txt' || file.type === 'text/plain') return [{ id: A.uid('pg_'), fname: file.name, kind: 'parsed', src: null, lines: textToLines(await A.readAs(file, 'readAsText')) }];
    if (ext === 'hwpx') return hwpxPages(file);
    if (ext === 'hwp') throw err('HWP(구버전 바이너리)는 서버 파서 단계에서 지원합니다. 한글에서 HWPX나 PDF로 저장해 올려 주세요.', 'HWP_BINARY');
    if (ext === 'pdf' || file.type === 'application/pdf') return pdfPages(file, onProgress);
    if (['heic', 'heif'].includes(ext) || /hei[cf]/.test(file.type)) {
      if (!window.heic2any) throw err('HEIC 변환 모듈을 불러오지 못했습니다', 'LIB');
      const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
      return [await imagePage(Array.isArray(out) ? out[0] : out, file.name)];
    }
    if ((file.type || '').startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) return [await imagePage(file, file.name || '붙여넣은 이미지')];
    throw err(`지원하지 않는 형식입니다: ${file.name}`, 'UNSUPPORTED');
  }

  // ---------- 전처리 ----------
  async function rotate(page, deg) {
    const img = await A.loadImage(page.src);
    const rad = deg * Math.PI / 180, s = Math.abs(Math.sin(rad)), co = Math.abs(Math.cos(rad));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * co + img.height * s); c.height = Math.round(img.width * s + img.height * co);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.translate(c.width / 2, c.height / 2); g.rotate(rad); g.drawImage(img, -img.width / 2, -img.height / 2);
    return { ...page, src: c.toDataURL('image/jpeg', 0.92), width: c.width, height: c.height, lines: page.kind === 'pdf_text' ? null : page.lines, kind: page.kind === 'pdf_text' ? 'pdf_scan' : page.kind };
  }
  async function split(page) {
    const img = await A.loadImage(page.src);
    const half = Math.floor(img.width / 2);
    const mk = (x, label) => {
      const c = document.createElement('canvas'); c.width = half; c.height = img.height;
      c.getContext('2d').drawImage(img, x, 0, half, img.height, 0, 0, half, img.height);
      return { id: A.uid('pg_'), fname: `${page.fname} (${label})`, kind: page.kind === 'pdf_text' ? 'pdf_scan' : page.kind, src: c.toDataURL('image/jpeg', 0.92), width: half, height: img.height };
    };
    return [mk(0, '왼쪽'), mk(half, '오른쪽')];
  }
  // 회색조 + 명암 늘리기 (2%~98% 구간)
  async function enhance(src) {
    const c = await canvasFrom(src);
    const g = c.getContext('2d');
    const im = g.getImageData(0, 0, c.width, c.height), d = im.data;
    const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) { const y = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0; d[i] = y; hist[y]++; }
    const total = d.length / 4; let acc = 0, lo = 0, hi = 255;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > total * 0.02) { lo = v; break; } }
    acc = 0;
    for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > total * 0.02) { hi = v; break; } }
    const span = Math.max(1, hi - lo);
    for (let i = 0; i < d.length; i += 4) { const v = Math.max(0, Math.min(255, (d[i] - lo) * 255 / span)); d[i] = d[i + 1] = d[i + 2] = v; }
    g.putImageData(im, 0, 0);
    return c.toDataURL('image/jpeg', 0.92);
  }

  // ---------- 엔진 ----------
  let worker = null, workerLang = null, logFn = null;
  async function getWorker(lang, ctx) {
    if (!window.Tesseract) throw err('OCR 엔진을 불러오지 못했습니다(네트워크 확인)', 'LIB');
    if (worker && workerLang === lang) return worker;
    if (worker) { await worker.terminate(); worker = null; }
    ctx && ctx.log('info', `전용 OCR 언어 데이터 준비 (${lang}) · 처음 한 번만 내려받아요`);
    worker = await Tesseract.createWorker(lang, 1, { logger: (m) => logFn && logFn(m) });
    workerLang = lang;
    return worker;
  }
  function tessLines(data, dx, lowConf) {
    return (data.lines || []).map((l) => ({
      text: (l.text || '').replace(/\s+$/, '').replace(/\n/g, ''),
      bbox: [Math.round(l.bbox.x0 + dx), Math.round(l.bbox.y0), Math.round(l.bbox.x1 - l.bbox.x0), Math.round(l.bbox.y1 - l.bbox.y0)],
      confidence: Math.round(l.confidence),
    })).filter((l) => l.text.trim()).map((l) => ({ ...l, status: l.confidence < lowConf ? 'low_conf' : 'ok' }));
  }
  const judge = (lines) => {
    const chars = lines.reduce((s, l) => s + l.text.replace(/\s/g, '').length, 0);
    const mean = lines.length ? lines.reduce((s, l) => s + (l.confidence || 0), 0) / lines.length : 0;
    return { chars, mean, outcome: chars < 8 ? 'error' : mean < 45 ? 'low_quality' : 'ok' };
  };

  const Engines = {
    // 1) Gemini 판독: 키가 있을 때만. 저작권 차단(RECITATION)이면 다음 엔진으로
    async gemini(page) {
      const b64 = page.src.split(',')[1];
      const mime = page.src.slice(5, page.src.indexOf(';'));
      const prompt = '이 시험지 이미지의 글자를 위에서 아래, 왼쪽 단에서 오른쪽 단 순서로 줄 단위로 옮겨라. 고치거나 요약하지 말 것. JSON {"lines":["…"]} 형식으로만 답하라.';
      const r = await A.gemini([{ text: prompt }, { inline_data: { mime_type: mime, data: b64 } }]);
      const arr = Array.isArray(r.json?.lines) ? r.json.lines.map((x) => (typeof x === 'string' ? x : x?.text || '')) : [];
      const chars = arr.join('').replace(/\s/g, '').length;
      return { outcome: A.classifyOutcome(r.finishReason, chars, page.expectedChars || 0), finishReason: r.finishReason, lines: arr.filter((t) => t.trim()).map((t) => ({ text: t, bbox: null, confidence: null, status: 'ok' })) };
    },
    // 2) 전용 OCR: 줄 단위 글자 + 좌표 + 신뢰도 (시연판은 브라우저 안 Tesseract, 서비스에서는 Upstage/CLOVA로 교체)
    async dedicated_ocr(page, ctx, s) {
      const w = await getWorker(s.ocr.lang, ctx);
      const { data } = await w.recognize(page.src);
      const lines = tessLines(data, 0, s.ocr.lowConf);
      return { ...judge(lines), lines };
    },
    // 3) 타일 모드: 쪽을 왼쪽·오른쪽 단으로 잘라 따로 인식 (2단 시험지, 긴 출력 차단 대응)
    async tile_mode(page, ctx, s) {
      const w = await getWorker(s.ocr.lang, ctx);
      const img = await A.loadImage(page.src);
      const half = Math.floor(img.width / 2);
      let lines = [];
      for (const x of [0, half]) {
        const c = document.createElement('canvas'); c.width = half; c.height = img.height;
        c.getContext('2d').drawImage(img, x, 0, half, img.height, 0, 0, half, img.height);
        const { data } = await w.recognize(c.toDataURL('image/png'));
        lines = lines.concat(tessLines(data, x, s.ocr.lowConf));
      }
      return { ...judge(lines), lines };
    },
    // 4) 수동 확인: 가장 나았던 결과를 '의심'으로 표시해 교정 화면으로 넘김
    async manual(page) {
      const best = page.bestLines || [];
      if (!best.length) return { outcome: 'ok', manual: true, lines: [{ text: '', bbox: null, confidence: 0, status: 'unreadable' }] };
      return { outcome: 'ok', manual: true, lines: best.map((l) => ({ ...l, status: 'low_conf' })) };
    },
  };

  async function prepare(page, s, i) {
    const p = { page_no: i + 1, fname: page.fname, kind: page.kind, src: page.src, width: page.width, height: page.height, lines: page.lines ? A.clone(page.lines) : null, attempts: [], fallback_path: [] };
    if (p.src && s.ocr.enhance && (p.kind === 'image' || p.kind === 'pdf_scan')) p.src = await enhance(p.src);
    return p;
  }

  // 쪽 하나에 대체 순서 적용 (DB 함수 next_ocr_engine 과 같은 규칙)
  async function recognizePage(p, ctx, s) {
    const tag = `${p.page_no}쪽`;
    if (p.kind === 'pdf_text' || p.kind === 'parsed') {
      p.text_source = p.kind; p.final_engine = p.kind; p.fallback_path = [p.kind + ':ok'];
      ctx.log('info', `${tag}: ${A.ENGINE_LABEL[p.kind]} → OCR 없이 바로 사용 (비용 0)`);
    } else {
      p.text_source = 'ocr';
      const chain = s.ocr.chain.filter((e) => !s.ocr.disabled.includes(e)).filter((e) => e !== 'gemini' || s.ai.geminiKey);
      if (!s.ai.geminiKey && s.ocr.chain.includes('gemini') && !s.ocr.disabled.includes('gemini')) p.fallback_path.push('gemini:skipped');
      for (const eng of chain) {
        if (ctx.cancelled()) throw err('취소됨', 'CANCELLED');
        ctx.log('stage', `${tag}: ${A.ENGINE_LABEL[eng]} 시도`);
        logFn = (m) => { if (m.status === 'recognizing text') ctx.progress(ctx.job.progress); };
        const t0 = performance.now();
        let r;
        try { r = await Engines[eng](p, ctx, s); } catch (e) { r = { outcome: 'error', error: e.message, lines: [] }; }
        const ms = Math.round(performance.now() - t0);
        p.attempts.push({ engine: eng, outcome: r.outcome, finish_reason: r.finishReason || null, chars: r.chars ?? null, mean_conf: r.mean != null ? Math.round(r.mean) : null, duration_ms: ms });
        p.fallback_path.push(eng + ':' + r.outcome);
        if (r.lines && r.lines.length && (!p.bestLines || (r.mean || 0) > (p.bestMean || 0))) { p.bestLines = r.lines; p.bestMean = r.mean || 0; }
        if (r.outcome === 'ok') {
          p.lines = r.lines; p.final_engine = eng; p.manual = !!r.manual;
          ctx.log(r.manual ? 'fallback' : 'info', `${tag}: ${A.ENGINE_LABEL[eng]} ${r.manual ? '→ 교정 화면에서 확인 필요' : '완료'} (${(ms / 1000).toFixed(1)}초)`);
          break;
        }
        ctx.log('fallback', `${tag}: ${A.ENGINE_LABEL[eng]} ${A.OUTCOME_LABEL[r.outcome]}${r.error ? ' (' + r.error + ')' : ''}${r.mean != null ? ` · 평균 신뢰도 ${Math.round(r.mean)}` : ''} → 다음 엔진`);
      }
      if (!p.lines) { p.lines = [{ text: '', bbox: null, confidence: 0, status: 'unreadable' }]; p.final_engine = 'manual'; }
      delete p.bestLines; delete p.bestMean;
    }
    p.lines = p.lines.map((l, i) => {
      let status = l.status === 'ok' && l.confidence != null && l.confidence < s.ocr.lowConf ? 'low_conf' : l.status;
      // 한글 줄에 뜨금없는 영문 조각(예: "Ho]", "AME")이 섞이면 오독 의심
      const body = (l.text || '').replace(/\[[^\]]*\]/g, '');
      const hangul = (body.match(/[가-힣]/g) || []).length;
      if (status === 'ok' && p.text_source === 'ocr' && hangul >= 4 && /[A-Za-z]{2,}|[A-Za-z][\]\}|]/.test(body)) { status = 'low_conf'; l.reason = '한글 사이 영문 조각'; }
      return { ...l, line_no: i + 1, gid: `P${p.page_no}-L${i + 1}`, status };
    });
    const confs = p.lines.map((l) => l.confidence).filter((c) => c != null);
    p.confidence = confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : null;
    p.suspect_count = p.lines.filter((l) => l.status === 'low_conf' || l.status === 'unreadable').length;
  }

  A.ocr = { fileToPages, rotate, split, enhance, prepare, recognizePage, Engines, textToLines };
})(window.App);
