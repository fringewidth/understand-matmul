/* Where 9/4 Comes From: interactive figures.
   Every figure draws from the CSS color tokens, so it follows light and dark themes. */
(function () {
  'use strict';

  /* ------------------------------------------------------------ helpers */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const C = {};
  const TOKENS = ['bg', 'panel', 'panel2', 'paper', 'fg', 'muted', 'rule', 'X', 'Y', 'Z', 'omega', 'good', 'bad',
    'X-soft', 'Y-soft', 'Z-soft', 'omega-soft'];
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    TOKENS.forEach(k => { C[k] = cs.getPropertyValue('--' + k).trim(); });
  }
  readColors();

  const drawers = [];
  function register(fn) { drawers.push(fn); fn(); }
  function redrawAll() { readColors(); drawers.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redrawAll);
  } catch (e) { /* old browsers */ }
  new MutationObserver(redrawAll).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  let lastW = window.innerWidth;
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth !== lastW) { lastW = window.innerWidth; redrawAll(); }
    }, 120);
  });

  function prep(cv, hOverride) {
    if (!cv.dataset.h) cv.dataset.h = cv.getAttribute('height') || '240';
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.max(200, cv.clientWidth || cv.parentElement.clientWidth || 320);
    const h = Math.round(hOverride ? hOverride(w) : +cv.dataset.h);
    cv.style.height = h + 'px';
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  function withAlpha(color, a) {
    // color is #rrggbb or rgba(...)
    if (color.startsWith('#')) {
      let hex = color.slice(1);
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      const n = parseInt(hex, 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }
    const m = color.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(',').map(s => s.trim());
      return `rgba(${p[0]},${p[1]},${p[2]},${a})`;
    }
    return color;
  }
  const MONO = '"Instrument Sans", "Helvetica Neue", system-ui, sans-serif';
  const DISPLAY = '"Source Serif 4", Georgia, serif';
  function font(px, fam, weight) { return `${weight || 500} ${px}px ${fam || MONO}`; }
  function fmtInt(n) { return Math.round(n).toLocaleString('en-US'); }
  function fmtNum(x, d) { return Number(x).toFixed(d === undefined ? 2 : d); }
  function bigWords(x) {
    if (!isFinite(x)) return 'too many to write';
    if (x < 1e6) return fmtInt(x);
    const names = [[1e18, 'quintillion'], [1e15, 'quadrillion'], [1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']];
    if (x >= 1e21) return '10^' + Math.log10(x).toFixed(1);
    for (const [v, nm] of names) if (x >= v) return (x / v).toFixed(x / v < 10 ? 1 : 0) + ' ' + nm;
    return fmtInt(x);
  }
  function fmtTime(sec) {
    if (sec < 1e-3) return 'under a millisecond';
    if (sec < 1) return (sec * 1000).toFixed(0) + ' milliseconds';
    if (sec < 60) return sec.toFixed(sec < 10 ? 1 : 0) + ' seconds';
    if (sec < 3600) return (sec / 60).toFixed(sec < 600 ? 1 : 0) + ' minutes';
    if (sec < 86400) return (sec / 3600).toFixed(1) + ' hours';
    if (sec < 86400 * 365) return (sec / 86400).toFixed(1) + ' days';
    const y = sec / (86400 * 365);
    if (y < 1e6) return fmtInt(y) + ' years';
    return bigWords(y) + ' years';
  }
  function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function sub(s) { return `<sub>${s}</sub>`; }
  function sup(s) { return `<sup>${s}</sup>`; }
  function bindSlider(id, fmt, onChange) {
    const input = $('#' + id);
    const out = $('#' + id + 'Out');
    const update = () => { if (out) out.textContent = fmt ? fmt(+input.value) : input.value; onChange(+input.value); };
    input.addEventListener('input', update);
    return { input, update, get value() { return +input.value; } };
  }
  function setPressed(group, btn) { $$('button', group).forEach(b => { if (b.hasAttribute('aria-pressed') && b !== btn && !b.id) b.setAttribute('aria-pressed', 'false'); }); btn.setAttribute('aria-pressed', 'true'); }
  function svgEl(tag, attrs, parent) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  function onVisible(el, cb) {
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    new IntersectionObserver(es => es.forEach(e => cb(e.isIntersecting)), { rootMargin: '100px' }).observe(el);
  }

  /* ------------------------------------------------------------ navigation */
  (function nav() {
    const sections = $$('section.chapter');
    const list = $('#tocList');
    sections.forEach(s => {
      const li = document.createElement('li');
      li.innerHTML = `<a href="#${s.id}"><span class="num">${s.dataset.num}</span><span>${s.dataset.title}</span><span class="done" data-done="${s.id}"></span></a>`;
      list.appendChild(li);
    });
    const btn = $('#tocBtn'); const sheet = $('#toc'); const back = $('#tocBackdrop');
    function open(v) {
      sheet.hidden = !v; back.hidden = !v; btn.setAttribute('aria-expanded', String(v));
      if (v) { const a = $('a', sheet); if (a) a.focus(); }
    }
    btn.addEventListener('click', () => open(sheet.hidden));
    back.addEventListener('click', () => open(false));
    sheet.addEventListener('click', e => { if (e.target.closest('a')) open(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) { open(false); btn.focus(); } });

    const here = $('#here'); const prog = $('#progress');
    let ticking = false;
    function onScroll() {
      ticking = false;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      prog.style.width = (max > 0 ? Math.min(100, (y / max) * 100) : 0) + '%';
      let cur = sections[0];
      for (const s of sections) if (s.getBoundingClientRect().top < 90) cur = s;
      const label = `<small>${cur.dataset.num}</small>${cur.dataset.title}`;
      if (here.innerHTML !== label) here.innerHTML = label;
    }
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
  })();

  /* ------------------------------------------------------------ quizzes */
  const QUIZ = {
    q1: { q: 'How many multiplications does the school method use for two 4&times;4 matrices?',
      o: ['16', '48', '64', '256'], a: 2,
      w: 'Each of the 16 entries of C needs 4 multiplications (one row times one column). That is 16 &times; 4 = 64 = 4' + sup(3) + '.' },
    q2: { q: 'Laderman (1976) multiplies 3&times;3 matrices with 23 products. Which exponent does that give?',
      o: ['About 2.85, which is worse than Strassen&rsquo;s 2.81', 'About 2.56, which beats Strassen', 'Exactly 2.30', 'About 3.10, which is worse than the school method'], a: 0,
      w: 'The exponent is log' + sub(3) + ' 23 &asymp; 2.854, because 3' + sup('2.854') + ' &asymp; 23. That is above 2.807. With 3&times;3 blocks you would need 21 products or fewer to beat Strassen, because 3' + sup('2.807') + ' &asymp; 21.8.' },
    q3: { q: 'In the term x' + sub('ij') + ' y' + sub('jk') + ' z' + sub('ki') + ', which leg does not see the index k?',
      o: ['The X leg', 'The Y leg', 'The Z leg', 'All three legs see k'], a: 0,
      w: 'The index k appears in y' + sub('jk') + ' and z' + sub('ki') + '. The variable x' + sub('ij') + ' has no k. So index k pairs the Y leg with the Z leg, and the lone side is X: index k acts like Dot' + sub('X') + '.' },
    q4: { q: 'What is the rank of Dot(m) = x(y' + sub('1') + 'z' + sub('1') + ' + &hellip; + y' + sub('m') + 'z' + sub('m') + ')?',
      o: ['1', 'm', 'm' + sup('2'), '2m'], a: 1,
      w: 'The task asks for the m products x&middot;y' + sub('1') + ', &hellip;, x&middot;y' + sub('m') + ', each sent to its own label. These are m unrelated answers, and one multiplication can only make one new product. The direct recipe uses m, so the rank is exactly m.' },
    q5: { q: 'What is the rank of Poly(3, 5)?',
      o: ['15', '8', '7', '5'], a: 2,
      w: 'a + b &minus; 1 = 3 + 5 &minus; 1 = 7. The product of a degree-2 and a degree-4 polynomial has degree 6, so it has 7 coefficients, and 7 points pin it down. The direct method would use 3 &times; 5 = 15.' },
    q6: { q: 'You know that &alpha;' + sup('N') + ' &le; 100 &middot; &beta;' + sup('N') + ' for every whole number N, and &alpha;, &beta; are positive. What follows?',
      o: ['Only &alpha; &le; 100&middot;&beta;', '&alpha; &le; &beta;', '&alpha; &le; &beta; / 100', 'Nothing useful'], a: 1,
      w: 'Take the Nth root: &alpha; &le; 100' + sup('1/N') + '&middot;&beta;. As N grows, 100' + sup('1/N') + ' gets as close to 1 as you like. So &alpha; &le; &beta;. This is the power trick.' },
    q7: { q: 'A meter has p' + sub('X') + ' = 0.5, p' + sub('Y') + ' = 0.5 and p' + sub('Z') + ' = 1. What is &lambda;(MM(10))?',
      o: ['10', '100', '1000', '2'], a: 1,
      w: '&lambda;(MM(10)) = 10' + sup('0.5') + ' &middot; 10' + sup('0.5') + ' &middot; 10' + sup('1') + ' = 10' + sup('2') + ' = 100. Its level is t = 2/3, so it says that MM(n) costs about n' + sup('2') + '.' },
    q8: { q: 'The machine turns 5M copies of a task into M separate pieces. Why does that help the score at all?',
      o: ['Because 5 is smaller than M', 'Each piece gets a free Dot(M) bonus, which pays back the cost of the copies', 'Because the clock filter creates new terms', 'It does not help. It only moves terms around.'], a: 1,
      w: 'Without the bonus, 5M copies would give only M pieces, and the meter would learn just &lambda;(A) &ge; &lambda;(piece)/5. The bonus Dot(M) multiplies each piece&rsquo;s meter reading by M' + sup('t') + '. That gives P(A) &ge; M&middot;P(piece), and the power trick removes the 5.' },
    q9: { q: 'A pair of polynomials, each with 6 coefficients, splits into a long part and a short part. What are their lengths?',
      o: ['6 and 6', '7 and 5', '8 and 4', '12 and 0'], a: 1,
      w: 'The pair has 2 &times; 6 = 12 coefficients. The long part has b + 1 = 7 and the short part has b &minus; 1 = 5. Check: 7 + 5 = 12.' },
    q10: { q: 'Rule T with a = 3 and h = 2 says that 3P(3, 2) is at most which score?',
      o: ['P(3, 6)', 'P(3, 8)', 'P(3, 9)', 'P(6, 6)'], a: 1,
      w: '3h + a &minus; 1 = 6 + 3 &minus; 1 = 8. Three copies of length 2 make 6, and the extra a &minus; 1 = 2 is the tax for the middle block.' },
    q11: { q: 'Which meter levels t survive the squeeze?',
      o: ['Only t = 1', 't &le; 3/4', 't &ge; 3/4', 'Every t between 0 and 1'], a: 1,
      w: 'The floor grows like a' + sup('4/3') + ' and the ceiling like a' + sup('1/t') + '. The ceiling stays on top only when 1/t &ge; 4/3, which means t &le; 3/4. Then every meter reads MM(n) as n' + sup('3t') + ' &le; n' + sup('9/4') + '.' },
    q12: { q: 'In the thought experiment, suppose a tripling rule had tax &tau; = 0.8. What bound would the same steps give?',
      o: ['&omega; &le; 2.10', '&omega; &le; 2.25', '&omega; &le; 2.00', '&omega; &le; 2.40'], a: 0,
      w: 'The bound is 3(2 + &tau;)/4 = 3 &times; 2.8 / 4 = 2.1. A smaller tax gives a better bound.' }
  };
  const STORE_KEY = 'understand-matmul-quiz-v1';
  let quizState = {};
  try { quizState = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { quizState = {}; }
  function saveQuiz() { try { localStorage.setItem(STORE_KEY, JSON.stringify(quizState)); } catch (e) { /* storage blocked */ } }
  function updateScore() {
    const total = Object.keys(QUIZ).length;
    const right = Object.keys(QUIZ).filter(k => quizState[k] && quizState[k].first === true).length;
    const answered = Object.keys(QUIZ).filter(k => quizState[k] && quizState[k].solved).length;
    $('#scorePill').textContent = `${answered} / ${total} solved`;
    $('#scorePill').title = `${right} right on the first try`;
    $$('section.chapter').forEach(s => {
      const qs = $$('.quiz', s).map(q => q.dataset.quiz);
      const mark = $(`[data-done="${s.id}"]`);
      if (!mark) return;
      mark.textContent = qs.length && qs.every(q => quizState[q] && quizState[q].solved) ? 'quiz done' : '';
    });
  }
  $$('.quiz').forEach(box => {
    const id = box.dataset.quiz; const Q = QUIZ[id]; if (!Q) return;
    box.innerHTML = `<p class="qtag">Check yourself</p><p class="qtext">${Q.q}</p><div class="opts"></div><p class="why" hidden></p>`;
    const opts = $('.opts', box); const why = $('.why', box);
    Q.o.forEach((txt, i) => {
      const b = document.createElement('button');
      b.className = 'opt'; b.type = 'button'; b.innerHTML = txt;
      b.addEventListener('click', () => {
        const st = quizState[id] || {};
        if (st.first === undefined) st.first = (i === Q.a);
        if (i === Q.a) {
          st.solved = true;
          b.classList.add('right');
          why.innerHTML = '<b>Right.</b> ' + Q.w;
        } else {
          b.classList.add('wrong');
          why.innerHTML = '<b>Not quite.</b> Try another answer.';
        }
        why.hidden = false;
        quizState[id] = st; saveQuiz(); updateScore();
      });
      opts.appendChild(b);
    });
    if (quizState[id] && quizState[id].solved) {
      opts.children[Q.a].classList.add('right');
      why.innerHTML = '<b>Right.</b> ' + Q.w; why.hidden = false;
    }
  });
  updateScore();

  /* ------------------------------------------------------------ hero: record chart */
  const RECORDS = [
    { x: 1967.5, w: 3, lab: 'before 1969', who: 'The school method', note: 'n multiplications for each of the n² entries.' },
    { x: 1969.5, w: 2.8074, lab: '1969', who: 'Volker Strassen', note: 'Seven products for 2×2 blocks, used again and again.' },
    { x: 1978.5, w: 2.796, lab: '1978', who: 'Victor Pan' },
    { x: 1979.5, w: 2.780, lab: '1979', who: 'Bini, Capovani, Lotti and Romani', note: 'First use of approximate recipes with a tiny ε.' },
    { x: 1981.2, w: 2.522, lab: '1981', who: 'Arnold Schönhage', note: 'Many small independent products at once.' },
    { x: 1981.9, w: 2.496, lab: '1981', who: 'Don Coppersmith and Shmuel Winograd' },
    { x: 1986.5, w: 2.479, lab: '1986', who: 'Volker Strassen', note: 'The laser method.' },
    { x: 1990.0, w: 2.3755, lab: '1990', who: 'Don Coppersmith and Shmuel Winograd', note: 'Their method stood for 20 years.' },
    { x: 2010.5, w: 2.3737, lab: '2010', who: 'Andrew Stothers' },
    { x: 2012.4, w: 2.3729, lab: '2012', who: 'Virginia Vassilevska Williams' },
    { x: 2014.4, w: 2.3728639, lab: '2014', who: 'François Le Gall' },
    { x: 2020.8, w: 2.3728596, lab: '2020', who: 'Josh Alman and Virginia Vassilevska Williams' },
    { x: 2022.8, w: 2.371866, lab: '2022', who: 'Ran Duan, Hongxun Wu and Renfei Zhou' },
    { x: 2023.6, w: 2.371552, lab: '2023', who: 'Vassilevska Williams, Xu, Xu and Zhou' },
    { x: 2024.6, w: 2.371339, lab: '2024', who: 'Alman, Duan, Vassilevska Williams, Xu, Xu and Zhou' },
    { x: 2026.6, w: 2.371177, lab: 'August 2026', who: 'Dupont and others, with AlphaEvolve' },
    { x: 2026.73, w: 2.258, lab: 'September 24, 2026', who: 'OpenAI', note: 'The first big drop since 1990.', isNew: true },
    { x: 2026.75, w: 2.25, lab: 'October 2, 2026', who: 'OpenAI', note: 'ω ≤ 9/4. This page explains this proof.', isNew: true }
  ];
  const rc = { zoom: false, sel: RECORDS.length - 1 };
  function drawRecords() {
    const host = $('#recordChart');
    const W = Math.max(280, host.clientWidth || 320);
    const H = Math.round(Math.max(210, Math.min(320, W * 0.62)));
    const m = { l: 42, r: 12, t: 12, b: 26 };
    const x0 = rc.zoom ? 2019.5 : 1965, x1 = rc.zoom ? 2027.2 : 2028;
    const y0 = rc.zoom ? 2.22 : 1.92, y1 = rc.zoom ? 2.39 : 3.06;
    const X = v => m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r);
    const Y = v => m.t + (y1 - v) / (y1 - y0) * (H - m.t - m.b);
    host.innerHTML = '';
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Records for omega over time' }, host);
    const defs = svgEl('defs', {}, svg);
    const cp = svgEl('clipPath', { id: 'rcClip' }, defs);
    svgEl('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b }, cp);
    const yt = rc.zoom ? [2.25, 2.30, 2.35] : [2, 2.25, 2.5, 2.75, 3];
    yt.forEach(v => {
      svgEl('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), stroke: C.rule, 'stroke-width': 1 }, svg);
      const t = svgEl('text', { x: m.l - 6, y: Y(v) + 4, 'text-anchor': 'end', fill: C.muted, 'font-size': 10.5, 'font-family': MONO }, svg);
      t.textContent = v.toFixed(2);
    });
    const xt = rc.zoom ? [2020, 2022, 2024, 2026] : [1970, 1990, 2010, 2026];
    xt.forEach(v => {
      const t = svgEl('text', { x: X(v), y: H - 8, 'text-anchor': 'middle', fill: C.muted, 'font-size': 10.5, 'font-family': MONO }, svg);
      t.textContent = v;
    });
    if (!rc.zoom) {
      svgEl('line', { x1: m.l, x2: W - m.r, y1: Y(2), y2: Y(2), stroke: C.muted, 'stroke-dasharray': '4 4', 'stroke-width': 1.2 }, svg);
      const t = svgEl('text', { x: W - m.r - 2, y: Y(2) - 5, 'text-anchor': 'end', fill: C.muted, 'font-size': 10.5, 'font-family': MONO }, svg);
      t.textContent = 'floor: ω ≥ 2';
    }
    let d = `M ${X(RECORDS[0].x)} ${Y(RECORDS[0].w)}`;
    for (let i = 1; i < RECORDS.length; i++) d += ` H ${X(RECORDS[i].x)} V ${Y(RECORDS[i].w)}`;
    d += ` H ${X(x1)}`;
    const g = svgEl('g', { 'clip-path': 'url(#rcClip)' }, svg);
    svgEl('path', { d, fill: 'none', stroke: C.fg, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, g);
    RECORDS.forEach((r, i) => {
      if (r.x < x0 || r.x > x1) return;
      const sel = i === rc.sel;
      if (sel) svgEl('circle', { cx: X(r.x), cy: Y(r.w), r: 10, fill: 'none', stroke: r.isNew ? C.omega : C.fg, 'stroke-width': 1.5 }, g);
      svgEl('circle', { cx: X(r.x), cy: Y(r.w), r: r.isNew ? 5.5 : 4, fill: r.isNew ? C.omega : C.panel, stroke: r.isNew ? C.omega : C.fg, 'stroke-width': 1.6 }, g);
    });
    svg.addEventListener('click', ev => {
      const rect = svg.getBoundingClientRect();
      const px = (ev.clientX - rect.left) * (W / rect.width);
      const py = (ev.clientY - rect.top) * (H / rect.height);
      let best = -1, bd = 1e9;
      RECORDS.forEach((r, i) => {
        if (r.x < x0 || r.x > x1) return;
        const dd = Math.hypot(X(r.x) - px, Y(r.w) - py);
        if (dd < bd) { bd = dd; best = i; }
      });
      if (best >= 0 && bd < 40) { rc.sel = best; drawRecords(); }
    });
    svg.style.cursor = 'pointer';
    const r = RECORDS[rc.sel];
    const prev = rc.sel > 0 ? RECORDS[rc.sel - 1].w : null;
    $('#recordInfo').innerHTML = `<b>ω ≤ ${r.w}</b> &middot; ${r.lab}<br>${r.who}${r.note ? '. ' + r.note : '.'}` +
      (prev ? `<br>Drop from the last record: ${(prev - r.w).toFixed(r.w > 2.37 ? 7 : 4)}` : '');
    $('#rcRange').textContent = rc.zoom ? '2019 to 2026' : '1966 to 2026';
  }
  $('#rcAll').addEventListener('click', () => { rc.zoom = false; $('#rcAll').setAttribute('aria-pressed', 'true'); $('#rcZoom').setAttribute('aria-pressed', 'false'); drawRecords(); });
  $('#rcZoom').addEventListener('click', () => { rc.zoom = true; $('#rcZoom').setAttribute('aria-pressed', 'true'); $('#rcAll').setAttribute('aria-pressed', 'false'); drawRecords(); });
  register(drawRecords);

  /* ------------------------------------------------------------ ch1: school multiplication */
  const mm = { A: [], B: [], sel: [0, 0], count: 0, timer: null };
  function mmNew() {
    mm.A = [0, 1, 2].map(() => [0, 1, 2].map(() => randInt(0, 5)));
    mm.B = [0, 1, 2].map(() => [0, 1, 2].map(() => randInt(0, 5)));
    mm.count = 0; mmRender();
  }
  function mmC(i, k) { return mm.A[i][0] * mm.B[0][k] + mm.A[i][1] * mm.B[1][k] + mm.A[i][2] * mm.B[2][k]; }
  function mmRender(done) {
    const [si, sk] = mm.sel;
    const cell = (v, cls) => `<div class="c ${cls || ''}">${v}</div>`;
    let a = '<div class="mat" style="grid-template-columns:repeat(3,auto)">';
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) a += cell(mm.A[i][j], i === si ? 'hx' : '');
    a += '</div>';
    let b = '<div class="mat" style="grid-template-columns:repeat(3,auto)">';
    for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) b += cell(mm.B[j][k], k === sk ? 'hy' : '');
    b += '</div>';
    let c = '<div class="mat" style="grid-template-columns:repeat(3,auto)">';
    for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) {
      const shown = done === undefined || (i * 3 + k) <= done;
      c += `<button type="button" class="c ${i === si && k === sk ? 'hz' : ''}" data-i="${i}" data-k="${k}" aria-label="Entry row ${i + 1} column ${k + 1}">${shown ? mmC(i, k) : '?'}</button>`;
    }
    c += '</div>';
    $('#mmRow').innerHTML = `${a}<span class="mat-op">&times;</span>${b}<span class="mat-op">=</span>${c}`;
    const parts = [0, 1, 2].map(j => `<span class="lx">${mm.A[si][j]}</span>&middot;<span class="ly">${mm.B[j][sk]}</span>`).join(' + ');
    $('#mmCalc').innerHTML = `C${sub(`${si + 1}${sk + 1}`)} = ${parts} = <b>${mmC(si, sk)}</b><br>row ${si + 1} of A with column ${sk + 1} of B: 3 multiplications`;
    $('#mmCount').textContent = `${mm.count} multiplications`;
    $$('#mmRow button.c').forEach(btn => btn.addEventListener('click', () => {
      stopPlay(); mm.sel = [+btn.dataset.i, +btn.dataset.k]; mm.count = 3; mmRender();
    }));
  }
  function stopPlay() { if (mm.timer) { clearInterval(mm.timer); mm.timer = null; $('#mmPlay').textContent = 'Compute all of C'; } }
  $('#mmPlay').addEventListener('click', () => {
    if (mm.timer) { stopPlay(); return; }
    let step = 0;
    if (reduceMotion) { mm.sel = [2, 2]; mm.count = 27; mmRender(); return; }
    $('#mmPlay').textContent = 'Stop';
    mm.sel = [0, 0]; mm.count = 3; mmRender(0);
    mm.timer = setInterval(() => {
      step++;
      if (step > 8) { stopPlay(); return; }
      mm.sel = [Math.floor(step / 3), step % 3]; mm.count = 3 * (step + 1); mmRender(step);
    }, 650);
  });
  $('#mmNew').addEventListener('click', () => { stopPlay(); mmNew(); });
  mmNew();

  /* sizes */
  const sizeS = bindSlider('sizeN', v => fmtInt(Math.pow(10, v)), drawSizes);
  function drawSizes() {
    const n = Math.pow(10, sizeS.value);
    const rows = [
      { e: 3, name: 'School method, n³', col: C.fg },
      { e: 2.371, name: 'Record before 2026, n²·³⁷¹', col: C.muted },
      { e: 2.25, name: 'New bound, n²·²⁵', col: C.omega }
    ];
    const top = 3 * Math.log10(n);
    $('#sizeBars').innerHTML = rows.map(r => {
      const v = Math.pow(n, r.e);
      const wpct = Math.max(2, (r.e * Math.log10(n)) / top * 100);
      return `<div class="bar-line"><div class="lab"><span>${r.name}</span><span>${bigWords(v)}</span></div>
        <div class="bar-wrap"><div class="bar" style="width:${wpct}%;background:${r.col}"></div></div>
        <div class="lab"><span>time: ${fmtTime(v / 1e9)}</span>${r.e < 3 ? `<span>${bigWords(Math.pow(n, 3 - r.e))}&times; less than n³</span>` : '<span></span>'}</div></div>`;
    }).join('');
  }
  register(drawSizes);

  /* ------------------------------------------------------------ ch2: Strassen */
  const st = {};
  function stNew() {
    const r = () => { let v = 0; while (v === 0) v = randInt(-3, 6); return v; };
    st.a = [[r(), r()], [r(), r()]]; st.b = [[r(), r()], [r(), r()]];
    stRender();
  }
  function stRender() {
    const [[a11, a12], [a21, a22]] = st.a; const [[b11, b12], [b21, b22]] = st.b;
    const P = (v) => (v < 0 ? `(${v})` : `${v}`);
    const M = [
      ['(A' + sub(11) + ' + A' + sub(22) + ')(B' + sub(11) + ' + B' + sub(22) + ')', `(${P(a11)} + ${P(a22)})(${P(b11)} + ${P(b22)})`, (a11 + a22) * (b11 + b22)],
      ['(A' + sub(21) + ' + A' + sub(22) + ')B' + sub(11), `(${P(a21)} + ${P(a22)})&middot;${P(b11)}`, (a21 + a22) * b11],
      ['A' + sub(11) + '(B' + sub(12) + ' &minus; B' + sub(22) + ')', `${P(a11)}&middot;(${P(b12)} &minus; ${P(b22)})`, a11 * (b12 - b22)],
      ['A' + sub(22) + '(B' + sub(21) + ' &minus; B' + sub(11) + ')', `${P(a22)}&middot;(${P(b21)} &minus; ${P(b11)})`, a22 * (b21 - b11)],
      ['(A' + sub(11) + ' + A' + sub(12) + ')B' + sub(22), `(${P(a11)} + ${P(a12)})&middot;${P(b22)}`, (a11 + a12) * b22],
      ['(A' + sub(21) + ' &minus; A' + sub(11) + ')(B' + sub(11) + ' + B' + sub(12) + ')', `(${P(a21)} &minus; ${P(a11)})(${P(b11)} + ${P(b12)})`, (a21 - a11) * (b11 + b12)],
      ['(A' + sub(12) + ' &minus; A' + sub(22) + ')(B' + sub(21) + ' + B' + sub(22) + ')', `(${P(a12)} &minus; ${P(a22)})(${P(b21)} + ${P(b22)})`, (a12 - a22) * (b21 + b22)]
    ];
    const m = M.map(x => x[2]);
    const c11 = m[0] + m[3] - m[4] + m[6], c12 = m[2] + m[4], c21 = m[1] + m[3], c22 = m[0] - m[1] + m[2] + m[5];
    const s11 = a11 * b11 + a12 * b21, s12 = a11 * b12 + a12 * b22, s21 = a21 * b11 + a22 * b21, s22 = a21 * b12 + a22 * b22;
    const mat = (rows, cls) => `<div class="mat" style="grid-template-columns:repeat(2,auto)">${rows.flat().map(v => `<div class="c ${cls}">${v}</div>`).join('')}</div>`;
    $('#stRow').innerHTML = `${mat(st.a, 'hx')}<span class="mat-op">&times;</span>${mat(st.b, 'hy')}<span class="mat-op">=</span>${mat([[c11, c12], [c21, c22]], '')}`;
    $('#stProducts').innerHTML = M.map((x, i) => `<div class="t"><span>M${sub(i + 1)} = ${x[0]}</span><span>= ${x[2]}</span></div>`).join('');
    const ok = (a, b) => a === b ? `<span class="ok">matches</span>` : `<span class="no">wrong</span>`;
    $('#stResult').innerHTML =
      `C${sub(11)} = M${sub(1)} + M${sub(4)} &minus; M${sub(5)} + M${sub(7)} = <b>${c11}</b> &middot; school: ${s11} ${ok(c11, s11)}<br>` +
      `C${sub(12)} = M${sub(3)} + M${sub(5)} = <b>${c12}</b> &middot; school: ${s12} ${ok(c12, s12)}<br>` +
      `C${sub(21)} = M${sub(2)} + M${sub(4)} = <b>${c21}</b> &middot; school: ${s21} ${ok(c21, s21)}<br>` +
      `C${sub(22)} = M${sub(1)} &minus; M${sub(2)} + M${sub(3)} + M${sub(6)} = <b>${c22}</b> &middot; school: ${s22} ${ok(c22, s22)}<br>` +
      `Total: <b>7</b> multiplications instead of 8.`;
  }
  $('#stNew').addEventListener('click', stNew);
  stNew();

  /* recursion */
  const recS = bindSlider('recK', null, drawRec);
  function drawRec() {
    const k = recS.value; const n = Math.pow(2, k);
    const a = Math.pow(8, k), b = Math.pow(7, k);
    $('#recBars').innerHTML = `
      <div class="bar-line"><div class="lab"><span>School: 8${sup(k)}</span><span>${fmtInt(a)}</span></div><div class="bar-wrap"><div class="bar" style="width:100%"></div></div></div>
      <div class="bar-line"><div class="lab"><span>Strassen: 7${sup(k)}</span><span>${fmtInt(b)}</span></div><div class="bar-wrap"><div class="bar" style="width:${(b / a * 100).toFixed(2)}%;background:${C.omega}"></div></div></div>
      <div class="bar-line"><div class="lab"><span>Matrix size n = 2${sup(k)} = ${fmtInt(n)}</span><span>Strassen does ${(b / a * 100).toFixed(1)}% of the work</span></div></div>`;
  }
  register(drawRec);

  /* exponent calculator */
  const expU = $('#expU'), expR = $('#expR');
  function syncR() {
    const u = +expU.value; const lo = u * u, hi = u * u * u;
    expR.min = lo; expR.max = hi;
    if (+expR.value < lo) expR.value = lo; if (+expR.value > hi) expR.value = hi;
  }
  function drawExp() {
    syncR();
    const u = +expU.value, r = +expR.value; const e = Math.log(r) / Math.log(u);
    $('#expUOut').textContent = u; $('#expROut').textContent = r;
    const host = $('#expScale'); const W = Math.max(280, host.clientWidth || 320), H = 74;
    const m = { l: 14, r: 14 };
    const X = v => m.l + (v - 2) / 1 * (W - m.l - m.r);
    host.innerHTML = '';
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Exponent scale from 2 to 3' }, host);
    svgEl('line', { x1: X(2), x2: X(3), y1: 40, y2: 40, stroke: C.rule, 'stroke-width': 6, 'stroke-linecap': 'round' }, svg);
    const marks = [[2, '2', C.muted, 1], [2.25, '9/4', C.omega, 1], [2.371, '2.371', C.muted, 0], [2.807, '2.807', C.muted, 1], [3, '3', C.muted, 0]];
    marks.forEach(([v, lab, col, up]) => {
      svgEl('line', { x1: X(v), x2: X(v), y1: 33, y2: 47, stroke: col, 'stroke-width': 1.5 }, svg);
      const t = svgEl('text', { x: X(v), y: up ? 26 : 62, 'text-anchor': v === 2 ? 'start' : v === 3 ? 'end' : 'middle', fill: col, 'font-size': 10.5, 'font-family': MONO }, svg);
      t.textContent = lab;
    });
    svgEl('circle', { cx: X(Math.min(3, Math.max(2, e))), cy: 40, r: 8, fill: C.fg }, svg);
    const need = Math.pow(u, 2.25);
    $('#expOut').innerHTML = `e = log${sub(u)} ${r} = <b>${e.toFixed(3)}</b> &nbsp;(because ${u}${sup(e.toFixed(3))} &asymp; ${r})<br>` +
      `To reach 9/4 with ${u}&times;${u} blocks you would need r &le; ${u}${sup('2.25')} &asymp; ${need.toFixed(1)}` +
      (need < u * u ? '' : '') + (u === 2 ? '. That is impossible for 2&times;2, which needs 7.' : '.');
  }
  expU.addEventListener('input', drawExp); expR.addEventListener('input', drawExp);
  $$('#expScale ~ .row button, [data-u]').forEach(b => b.addEventListener('click', () => {
    expU.value = b.dataset.u; syncR(); expR.value = b.dataset.r; drawExp();
  }));
  register(drawExp);

  /* ------------------------------------------------------------ ch3: 3D tasks */
  const cube = { preset: 'mm2', yaw: 0.75, pitch: 0.42, spin: false, raf: 0, visible: true };
  function cubeData(p) {
    const cells = [];
    if (p === 'mm2' || p === 'mm3') {
      const n = p === 'mm2' ? 2 : 3;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) cells.push([i * n + j, j * n + k, k * n + i]);
      return { dims: [n * n, n * n, n * n], cells };
    }
    if (p === 'dot') { for (let i = 0; i < 5; i++) cells.push([0, i, i]); return { dims: [1, 5, 5], cells }; }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) cells.push([i, j, i + j]);
    return { dims: [3, 4, 6], cells };
  }
  const CUBE_INFO = {
    mm2: 'MM(2): 4 x&rsquo;s, 4 y&rsquo;s, 4 z&rsquo;s. There are 8 cubes, one for each term x' + sub('ij') + 'y' + sub('jk') + 'z' + sub('ki') + '. The school method spends one multiplication per cube. Strassen needs only 7 pieces.',
    mm3: 'MM(3): a 9 by 9 by 9 box with 27 cubes. The shape is sparse: each x meets only 3 of the 9 y&rsquo;s.',
    dot: 'Dot(5): one x, five y&rsquo;s, five z&rsquo;s. The cubes lie on a diagonal, because y' + sub('i') + ' always pairs with z' + sub('i') + '.',
    poly: 'Poly(3, 4): 3 x&rsquo;s, 4 y&rsquo;s, 6 z&rsquo;s. The cube for x' + sub('i') + 'y' + sub('j') + ' sits at height z' + sub('i+j') + '. There are 12 cubes, but Chapter 4 shows the rank is only 6.'
  };
  function drawCube() {
    const cv = $('#cube');
    const { ctx, w, h } = prep(cv, W => Math.round(Math.min(380, Math.max(260, W * 0.85))));
    const { dims, cells } = cubeData(cube.preset);
    const cy = Math.cos(cube.yaw), sy = Math.sin(cube.yaw), cp = Math.cos(cube.pitch), sp = Math.sin(cube.pitch);
    const off = dims.map(d => d / 2);
    const R = 0.5 * Math.hypot(dims[0], dims[1], dims[2]);
    const s = Math.min(w, h) * 0.43 / R;
    const cx0 = w / 2, cy0 = h / 2 + 6;
    function rot(p) {
      const x = p[0], y = p[1], z = p[2];
      const x1 = x * cy - y * sy, y1 = x * sy + y * cy;
      return [x1, y1 * cp - z * sp, y1 * sp + z * cp];
    }
    function proj(p) { const r = rot([p[0] - off[0], p[1] - off[1], p[2] - off[2]]); return [cx0 + r[0] * s, cy0 - r[2] * s, r[1]]; }
    // bounding box
    const corners = [];
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) corners.push([a * dims[0], b * dims[1], c * dims[2]]);
    ctx.lineWidth = 1; ctx.strokeStyle = C.rule;
    const edges = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]];
    const pc = corners.map(proj);
    edges.forEach(([i, j]) => { ctx.beginPath(); ctx.moveTo(pc[i][0], pc[i][1]); ctx.lineTo(pc[j][0], pc[j][1]); ctx.stroke(); });
    // axes from origin corner
    const axes = [[[dims[0], 0, 0], C.X, 'X'], [[0, dims[1], 0], C.Y, 'Y'], [[0, 0, dims[2]], C.Z, 'Z']];
    const o = proj([0, 0, 0]);
    const axisLabels = [];
    axes.forEach(([end, col, lab]) => {
      const e = proj(end);
      ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
      const dx = e[0] - o[0], dy = e[1] - o[1], L = Math.hypot(dx, dy) || 1;
      axisLabels.push([lab, col, e[0] + dx / L * 14, e[1] + dy / L * 14]);
    });
    // cubes
    const sz = 0.78, pad = (1 - sz) / 2;
    const faces = [
      { n: [-1, 0, 0], v: [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]] },
      { n: [1, 0, 0], v: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
      { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
      { n: [0, 1, 0], v: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]] },
      { n: [0, 0, -1], v: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]] },
      { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }
    ];
    const vis = faces.map(f => { const r = rot(f.n); return { f, front: r[1] < 0, light: 0.55 + 0.45 * Math.max(0, -r[1] * 0.6 + r[2] * 0.5 - r[0] * 0.3) }; }).filter(x => x.front);
    const order = cells.map(c => ({ c, d: rot([c[0] + 0.5 - off[0], c[1] + 0.5 - off[1], c[2] + 0.5 - off[2]])[1] })).sort((a, b) => b.d - a.d);
    const base = C.omega;
    order.forEach(({ c }) => {
      vis.forEach(({ f, light }) => {
        ctx.beginPath();
        f.v.forEach((v, idx) => {
          const p = proj([c[0] + pad + v[0] * sz, c[1] + pad + v[1] * sz, c[2] + pad + v[2] * sz]);
          if (idx === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
        });
        ctx.closePath();
        ctx.fillStyle = base; ctx.fill();
        ctx.fillStyle = light > 0.8 ? withAlpha('#ffffff', (light - 0.8) * 0.9) : withAlpha('#000000', (0.8 - light) * 0.75);
        ctx.fill();
        ctx.strokeStyle = withAlpha('#000000', 0.14); ctx.lineWidth = 0.6; ctx.stroke();
      });
    });
    axisLabels.forEach(([lab, col, x, y]) => {
      ctx.font = `italic 500 16px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = C.paper; ctx.strokeText(lab, x, y);
      ctx.fillStyle = col; ctx.fillText(lab, x, y);
    });
    $('#cubeInfo').innerHTML = CUBE_INFO[cube.preset];
  }
  (function cubeInit() {
    const cv = $('#cube');
    let drag = null;
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw: cube.yaw, pitch: cube.pitch, mouse: e.pointerType === 'mouse' }; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } });
    cv.addEventListener('pointermove', e => {
      if (!drag) return;
      cube.yaw = drag.yaw + (e.clientX - drag.x) * 0.012;
      if (drag.mouse) cube.pitch = Math.max(-0.2, Math.min(1.3, drag.pitch + (e.clientY - drag.y) * 0.01));
      drawCube();
    });
    const end = () => { drag = null; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    $$('#cubePresets [data-t]').forEach(b => b.addEventListener('click', () => {
      $$('#cubePresets [data-t]').forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true'); cube.preset = b.dataset.t; drawCube();
    }));
    function loop() {
      cube.raf = 0;
      if (!cube.spin || !cube.visible) return;
      cube.yaw += 0.006; drawCube(); cube.raf = requestAnimationFrame(loop);
    }
    function setSpin(v) { cube.spin = v; $('#cubeSpin').setAttribute('aria-pressed', String(v)); if (v && !cube.raf) cube.raf = requestAnimationFrame(loop); }
    $('#cubeSpin').addEventListener('click', () => setSpin(!cube.spin));
    onVisible(cv, v => { cube.visible = v; if (v && cube.spin && !cube.raf) cube.raf = requestAnimationFrame(loop); });
    if (!reduceMotion) setSpin(true);
  })();
  register(drawCube);

  /* ------------------------------------------------------------ ch4: polynomials */
  const poly = {};
  const PTS = [-1, 0, 1, 2];
  function polyNew() {
    const nz = (lo, hi) => { let v = 0; while (v === 0) v = randInt(lo, hi); return v; };
    poly.f = [randInt(-2, 2), nz(-2, 2)];
    poly.g = [randInt(-2, 2), randInt(-2, 2), nz(-2, 1)];
    drawPoly();
  }
  const ev = (c, x) => c.reduce((s, ci, i) => s + ci * Math.pow(x, i), 0);
  function conv(f, g) { const r = new Array(f.length + g.length - 1).fill(0); f.forEach((a, i) => g.forEach((b, j) => { r[i + j] += a * b; })); return r; }
  function solve(Ain, bin) {
    const n = bin.length; const A = Ain.map(r => r.slice()); const b = bin.slice();
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < n; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
    }
    return b.map((v, i) => v / A[i][i]);
  }
  function polyStr(c, v) {
    const terms = [];
    c.forEach((a, i) => {
      if (Math.abs(a) < 1e-9) return;
      const mon = i === 0 ? '' : i === 1 ? v : `${v}${sup(i)}`;
      const coef = (i > 0 && Math.abs(a) === 1) ? (a < 0 ? '&minus;' : '') : (a < 0 ? '&minus;' + Math.abs(a) : '' + a);
      terms.push({ s: coef + mon, neg: a < 0 });
    });
    if (!terms.length) return '0';
    return terms.map((t, i) => i === 0 ? t.s : (t.neg ? ' &minus; ' + t.s.replace('&minus;', '') : ' + ' + t.s)).join('');
  }
  function drawPoly() {
    const { f, g } = poly;
    const vals = PTS.map(p => [p, ev(f, p), ev(g, p), ev(f, p) * ev(g, p)]);
    const coeffs = solve(PTS.map(p => [1, p, p * p, p * p * p]), vals.map(v => v[3])).map(x => Math.round(x * 1000) / 1000);
    const direct = conv(f, g);
    const same = coeffs.every((c, i) => Math.abs(c - direct[i]) < 1e-6);
    $('#polyTable').innerHTML = `<tr><th>point p</th><th class="lx">f(p)</th><th class="ly">g(p)</th><th class="lz">f(p)&middot;g(p)</th></tr>` +
      vals.map(v => `<tr><td>${v[0]}</td><td>${v[1]}</td><td>${v[2]}</td><td><b>${v[3]}</b></td></tr>`).join('');
    $('#polyOut').innerHTML = `<span class="lx">f(s) = ${polyStr(f, 's')}</span><br><span class="ly">g(s) = ${polyStr(g, 's')}</span><br>` +
      `Rebuilt from the 4 values: <span class="lz">${polyStr(coeffs, 's')}</span><br>Direct product: ${polyStr(direct, 's')} ${same ? '<span class="ok">same</span>' : '<span class="no">different</span>'}`;
    // plot
    const cv = $('#polyPlot');
    const { ctx, w, h } = prep(cv);
    const xa = -1.6, xb = 2.6;
    let ymin = 0, ymax = 0;
    for (let i = 0; i <= 200; i++) {
      const x = xa + (xb - xa) * i / 200;
      [ev(f, x), ev(g, x), ev(f, x) * ev(g, x)].forEach(v => { ymin = Math.min(ymin, v); ymax = Math.max(ymax, v); });
    }
    ymin = Math.max(ymin, -30); ymax = Math.min(ymax, 30);
    const padY = (ymax - ymin) * 0.08 + 0.5; ymin -= padY; ymax += padY;
    const m = { l: 8, r: 8, t: 8, b: 20 };
    const X = x => m.l + (x - xa) / (xb - xa) * (w - m.l - m.r);
    const Y = y => m.t + (ymax - y) / (ymax - ymin) * (h - m.t - m.b);
    ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X(xa), Y(0)); ctx.lineTo(X(xb), Y(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(0), m.t); ctx.lineTo(X(0), h - m.b); ctx.stroke();
    ctx.fillStyle = C.muted; ctx.font = font(10.5); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    [-1, 0, 1, 2].forEach(x => ctx.fillText(String(x), X(x), h - m.b + 4));
    function curve(fn, col, lw) {
      ctx.save();
      ctx.beginPath(); ctx.rect(m.l, m.t, w - m.l - m.r, h - m.t - m.b); ctx.clip();
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
      for (let i = 0; i <= 240; i++) { const x = xa + (xb - xa) * i / 240; const y = fn(x); if (i === 0) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(y)); }
      ctx.stroke(); ctx.restore();
    }
    curve(x => ev(f, x), C.X, 2);
    curve(x => ev(g, x), C.Y, 2);
    curve(x => ev(f, x) * ev(g, x), C.Z, 3.2);
    vals.forEach(v => {
      if (v[3] < ymin || v[3] > ymax) return;
      ctx.setLineDash([3, 3]); ctx.strokeStyle = C.muted; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(v[0]), Y(0)); ctx.lineTo(X(v[0]), Y(v[3])); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.panel; ctx.strokeStyle = C.Z; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(X(v[0]), Y(v[3]), 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
  }
  $('#polyNew').addEventListener('click', polyNew);
  poly.f = [1, 2]; poly.g = [-1, 1, 1];
  register(drawPoly);

  /* ------------------------------------------------------------ ch5: Bini and the power trick */
  const W0 = { x0: 2, x1: -1, y0: 3, y1: 1, z0: 1, z1: 2 };
  bindSlider('wEps', v => { const e = Math.pow(10, -v); return e >= 0.01 ? e.toFixed(2) : e.toExponential(0); }, drawW);
  function drawW() {
    const e = Math.pow(10, -(+$('#wEps').value));
    const { x0, x1, y0, y1, z0, z1 } = W0;
    const W = x0 * y0 * z1 + x0 * y1 * z0 + x1 * y0 * z0;
    const approx = ((x0 + e * x1) * (y0 + e * y1) * (z0 + e * z1) - x0 * y0 * z0) / e;
    const e1 = x1 * y1 * z0 + x1 * y0 * z1 + x0 * y1 * z1, e2 = x1 * y1 * z1;
    const showE = e >= 0.01 ? e.toFixed(2) : e.toExponential(0);
    $('#wOut').innerHTML = `Values: x${sub(0)}=2, x${sub(1)}=&minus;1, y${sub(0)}=3, y${sub(1)}=1, z${sub(0)}=1, z${sub(1)}=2<br>` +
      `Exact W = 12 + 2 &minus; 3 = <b>${W}</b> (3 products)<br>` +
      `Two-product formula with &epsilon; = ${showE}: <b>${approx.toFixed(6)}</b><br>` +
      `Leftover: &epsilon;&middot;(${e1}) + &epsilon;${sup(2)}&middot;(${e2}) = ${(approx - W).toFixed(6)}`;
  }
  register(drawW);
  bindSlider('powN', null, drawPow);
  function drawPow() {
    const N = +$('#powN').value; const c = Math.pow(5, 1 / N);
    $('#powOut').innerHTML = `From &alpha;${sup('N')} &le; 5&middot;&beta;${sup('N')}: &nbsp;&alpha; &le; 5${sup('1/' + N)}&middot;&beta; = <b>${c.toFixed(5)}</b>&middot;&beta;` +
      `<br>${N === 1 ? 'Drag the slider to the right.' : `The extra factor is ${((c - 1) * 100).toFixed(2)}% above 1, and it keeps shrinking toward 0%.`}`;
  }
  register(drawPow);

  /* ------------------------------------------------------------ ch6: meter dials */
  const pS = ['pX', 'pY', 'pZ'].map(id => bindSlider(id, v => v.toFixed(2), drawMeter));
  function drawMeter() {
    const [px, py, pz] = pS.map(s => s.value);
    const t = (px + py + pz) / 3, w3 = 3 * t;
    const host = $('#meterScale'); const W = Math.max(280, host.clientWidth || 320), H = 78;
    const m = { l: 14, r: 14 };
    const X = v => m.l + (v - 1) / 2 * (W - m.l - m.r);
    host.innerHTML = '';
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Scale of meter readings from 1 to 3' }, host);
    svgEl('rect', { x: X(2.25), y: 30, width: X(3) - X(2.25), height: 16, fill: C['X-soft'], stroke: C.X, 'stroke-width': 1, rx: 4 }, svg);
    const rz = svgEl('text', { x: X(3), y: 22, 'text-anchor': 'end', fill: C.X, 'font-size': 10.5, 'font-family': MONO }, svg);
    rz.textContent = 'ruled out by the proof';
    svgEl('line', { x1: X(1), x2: X(3), y1: 38, y2: 38, stroke: C.rule, 'stroke-width': 3 }, svg);
    [[1, '1'], [2, '2'], [2.25, '9/4'], [3, '3']].forEach(([v, lab]) => {
      svgEl('line', { x1: X(v), x2: X(v), y1: 32, y2: 44, stroke: C.muted, 'stroke-width': 1.2 }, svg);
      const t = svgEl('text', { x: X(v), y: 62, 'text-anchor': v === 1 ? 'start' : v === 3 ? 'end' : 'middle', fill: C.muted, 'font-size': 10.5, 'font-family': MONO }, svg);
      t.textContent = lab;
    });
    const tx = svgEl('text', { x: X(1), y: 76, 'text-anchor': 'start', fill: C.muted, 'font-size': 9.5, 'font-family': MONO }, svg);
    tx.textContent = 'reading: MM(n) costs about n^(3t)';
    svgEl('circle', { cx: X(Math.max(1, Math.min(3, w3))), cy: 38, r: 8, fill: w3 > 2.25 ? C.X : C.omega, stroke: C.panel, 'stroke-width': 2 }, svg);
    let msg = `t = (${px.toFixed(2)} + ${py.toFixed(2)} + ${pz.toFixed(2)}) / 3 = <b>${t.toFixed(3)}</b><br>` +
      `This meter says MM(n) costs about n${sup((w3).toFixed(2))}. For n = 10: &lambda;(MM(10)) = 10${sup(w3.toFixed(2))} &asymp; ${fmtNum(Math.pow(10, w3), 1)}<br>`;
    if (px + py + pz < 1) msg += `<span class="no">Impossible:</span> MM(n) contains n separate products, so p${sub('X')} + p${sub('Y')} + p${sub('Z')} &ge; 1.`;
    else if (w3 > 2.25 + 1e-9) msg += `<span class="no">Red zone.</span> Chapter 10 shows that no real meter reads this high.`;
    else msg += `<span class="ok">Allowed.</span> Readings up to 9/4 are consistent with the proof.`;
    $('#meterOut').innerHTML = msg;
  }
  $$('[data-p]').forEach(b => b.addEventListener('click', () => {
    b.dataset.p.split(',').forEach((v, i) => { pS[i].input.value = v; $('#' + ['pX', 'pY', 'pZ'][i] + 'Out').textContent = (+v).toFixed(2); });
    drawMeter();
  }));
  register(drawMeter);

  /* ------------------------------------------------------------ ch7: clock filter */
  const clockL = $('#clockL'), clockK = $('#clockK');
  function drawClock() {
    const L = +clockL.value; clockK.max = 2 * L; if (+clockK.value > 2 * L) clockK.value = 2 * L;
    const k = +clockK.value;
    $('#clockLOut').textContent = L; $('#clockKOut').textContent = k;
    const { ctx, w, h } = prep($('#clock'), W => Math.round(Math.min(320, Math.max(230, W * 0.7))));
    const pts = [[0, 0]];
    for (let r = 0; r < L; r++) { const a = 2 * Math.PI * r * k / L; const p = pts[pts.length - 1]; pts.push([p[0] + Math.cos(a), p[1] + Math.sin(a)]); }
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    pts.forEach(p => { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); });
    const bw = Math.max(maxx - minx, 1e-6), bh = Math.max(maxy - miny, 1e-6);
    const s = Math.min((w - 50) / bw, (h - 60) / bh, 120);
    const ox = w / 2 - (minx + bw / 2) * s, oy = h / 2 + (miny + bh / 2) * s;
    const P = p => [ox + p[0] * s, oy - p[1] * s];
    const sumLen = Math.hypot(pts[L][0], pts[L][1]);
    for (let r = 0; r < L; r++) {
      const a = P(pts[r]), b = P(pts[r + 1]);
      const col = withAlpha(C.Y, 0.35 + 0.65 * (r + 1) / L);
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); const hl = Math.min(10, s * 0.3);
      ctx.beginPath(); ctx.moveTo(b[0], b[1]);
      ctx.lineTo(b[0] - hl * Math.cos(ang - 0.45), b[1] - hl * Math.sin(ang - 0.45));
      ctx.lineTo(b[0] - hl * Math.cos(ang + 0.45), b[1] - hl * Math.sin(ang + 0.45));
      ctx.closePath(); ctx.fill();
    }
    const o = P([0, 0]);
    ctx.fillStyle = C.fg; ctx.beginPath(); ctx.arc(o[0], o[1], 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = font(11); ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText('start', o[0] - 6, o[1] + 4);
    if (sumLen > 0.5) {
      const e = P(pts[L]);
      ctx.strokeStyle = C.omega; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(o[0], o[1] + 14); ctx.lineTo(e[0], e[1] + 14); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.omega; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('total length ' + L, (o[0] + e[0]) / 2, o[1] + 20);
    }
    const mult = k % L === 0;
    $('#clockOut').innerHTML = `k = ${k}, L = ${L}. ` + (mult
      ? `k is a multiple of L, so every arrow points the same way. <b>Sum = ${L}</b>.`
      : `k is not a multiple of L, so the arrows close up into a loop. <b>Sum = 0</b>.`) +
      `<br>Each arrow turns by ${k} &times; 360&deg;/${L} = ${(360 * k / L % 360).toFixed(1)}&deg; from the one before.`;
  }
  clockL.addEventListener('input', drawClock); clockK.addEventListener('input', drawClock);
  register(drawClock);

  /* ------------------------------------------------------------ ch7: separation machine */
  const sep = { stage: 2, sel: null };
  function sepDefaultSel(M) { return M >= 3 ? { h: 1, g: 2, u: 1, v: 3 } : { h: 1, g: 2, u: 1, v: 1 }; }
  sep.sel = sepDefaultSel(3);
  function sepGeom(w, M) {
    const lm = 30, tm = 28;
    const G = Math.min(w - lm - 6, 560);
    const oc = G / M, og = Math.max(4, oc * 0.08);
    const ic = (oc - og) / M;
    return { lm, tm, G, oc, og, ic, h: tm + G + 6 };
  }
  function drawSep() {
    const M = +$('#sepM').value; const eps = +$('#sepEps').value;
    $('#sepMOut').textContent = M; $('#sepEpsOut').textContent = eps.toFixed(2);
    const cv = $('#sep');
    const w0 = Math.max(200, cv.clientWidth || 320);
    const gm = sepGeom(w0, M);
    const { ctx } = prep(cv, () => gm.h);
    const { lm, tm, oc, og, ic } = gm;
    ctx.font = font(11); ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let g = 1; g <= M; g++) ctx.fillText('g=' + g, lm + (g - 1) * oc + (oc - og) / 2, 10);
    ctx.save(); ctx.textAlign = 'center';
    for (let h = 1; h <= M; h++) { ctx.save(); ctx.translate(12, tm + (h - 1) * oc + (oc - og) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('h=' + h, 0, 0); ctx.restore(); }
    ctx.restore();
    let total = 0, pass = 0, surv = 0;
    for (let h = 1; h <= M; h++) for (let g = 1; g <= M; g++) {
      const bx = lm + (g - 1) * oc, by = tm + (h - 1) * oc;
      ctx.fillStyle = C.panel2; ctx.fillRect(bx, by, oc - og, oc - og);
      if (sep.stage === 2 && g === h) { ctx.strokeStyle = C.omega; ctx.lineWidth = 2; ctx.strokeRect(bx - 1, by - 1, oc - og + 2, oc - og + 2); }
      for (let u = 1; u <= M; u++) for (let v = 1; v <= M; v++) {
        total++;
        const k = u - v + 2 * (g - h); const ok = k === 0; const wt = g * g + h * u - h * h - h * v;
        if (ok) pass++; if (ok && wt === 0) surv++;
        const x = bx + (v - 1) * ic + 1, y = by + (u - 1) * ic + 1, s = ic - 2;
        let fill;
        if (sep.stage === 0) fill = withAlpha(C.muted, 0.45);
        else if (sep.stage === 1) fill = ok ? C.Y : withAlpha(C.muted, 0.1);
        else fill = !ok ? withAlpha(C.muted, 0.07) : wt === 0 ? C.omega : withAlpha(C.X, Math.max(0.06, Math.pow(eps, wt)));
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, s, s);
        const S = sep.sel;
        if (S && S.h === h && S.g === g && S.u === u && S.v === v) { ctx.strokeStyle = C.fg; ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 1, s + 2, s + 2); }
      }
    }
    $('#sepCount').textContent = sep.stage === 0 ? `${total} terms` : sep.stage === 1 ? `${pass} of ${total} pass` : `${surv} survive`;
    $('#sepEps').disabled = sep.stage !== 2;
    const S = sep.sel;
    let info = '';
    if (S && S.h <= M && S.g <= M && S.u <= M && S.v <= M) {
      const k = S.u - S.v + 2 * (S.g - S.h); const wt = S.g * S.g + S.h * S.u - S.h * S.h - S.h * S.v;
      info = `Selected term: X${sub('g=' + S.g)} &middot; Y${sub(`h=${S.h}, u=${S.u}`)} &middot; Z${sub(`h=${S.h}, v=${S.v}`)}<br>` +
        `k = u &minus; v + 2(g &minus; h) = ${S.u} &minus; ${S.v} + 2(${S.g} &minus; ${S.h}) = <b>${k}</b> &rarr; ${k === 0 ? '<span class="ok">passes the clock filter</span>' : '<span class="no">removed by the clock filter</span>'}<br>` +
        `weight = g${sup(2)} + (hu &minus; h${sup(2)}) + (&minus;hv) = ${S.g * S.g} + (${S.h * S.u - S.h * S.h}) + (${-S.h * S.v}) = <b>${wt}</b>` +
        (k === 0 ? ` = (g &minus; h)${sup(2)} = (${S.g - S.h})${sup(2)} &rarr; ${wt === 0 ? '<span class="ok">survives the squish</span>' : '<span class="no">fades as &epsilon; &rarr; 0</span>'}` : ' (the square formula only holds after the filter)');
    } else info = 'Tap a small cell to see its numbers.';
    const sum = sep.stage === 2 ? `<br>Result: ${M} separate pieces (diagonal big squares). Inside each, the ${M} surviving terms with u = v form a bonus Dot(${M}).` : '';
    $('#sepInfo').innerHTML = info + sum;
  }
  (function sepInit() {
    const cv = $('#sep');
    cv.addEventListener('click', e => {
      const M = +$('#sepM').value; const rect = cv.getBoundingClientRect();
      const gm = sepGeom(rect.width, M);
      const x = e.clientX - rect.left - gm.lm, y = e.clientY - rect.top - gm.tm;
      if (x < 0 || y < 0) return;
      const g = Math.floor(x / gm.oc) + 1, h = Math.floor(y / gm.oc) + 1;
      const ix = x - (g - 1) * gm.oc, iy = y - (h - 1) * gm.oc;
      if (g > M || h > M || ix > gm.oc - gm.og || iy > gm.oc - gm.og) return;
      const v = Math.min(M, Math.floor(ix / gm.ic) + 1), u = Math.min(M, Math.floor(iy / gm.ic) + 1);
      sep.sel = { h, g, u, v }; drawSep();
    });
    $$('#sepStages [data-stage]').forEach(b => b.addEventListener('click', () => {
      $$('#sepStages [data-stage]').forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true'); sep.stage = +b.dataset.stage; drawSep();
    }));
    $('#sepM').addEventListener('input', () => { sep.sel = sepDefaultSel(+$('#sepM').value); drawSep(); });
    $('#sepEps').addEventListener('input', drawSep);
  })();
  register(drawSep);

  /* entropy: the best q gives A + B */
  bindSlider('entA', v => v.toFixed(1), drawEnt); bindSlider('entB', v => v.toFixed(1), drawEnt);
  function drawEnt() {
    const A = +$('#entA').value, B = +$('#entB').value;
    const cv = $('#ent'); if (!cv.clientWidth) { $('#entOut').innerHTML = ''; }
    const { ctx, w, h } = prep(cv);
    const H = q => (q <= 0 || q >= 1) ? 0 : -q * Math.log(q) - (1 - q) * Math.log(1 - q);
    const F = q => Math.exp(H(q)) * Math.pow(A, q) * Math.pow(B, 1 - q);
    const ymax = (A + B) * 1.12; const m = { l: 34, r: 10, t: 10, b: 22 };
    const X = q => m.l + q * (w - m.l - m.r); const Y = y => m.t + (ymax - y) / ymax * (h - m.t - m.b);
    ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(m.l, Y(0)); ctx.lineTo(w - m.r, Y(0)); ctx.stroke();
    ctx.fillStyle = C.muted; ctx.font = font(10.5); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    [0, 0.5, 1].forEach(q => ctx.fillText('q=' + q, X(q), h - m.b + 5));
    ctx.setLineDash([5, 4]); ctx.strokeStyle = C.omega; ctx.beginPath(); ctx.moveTo(m.l, Y(A + B)); ctx.lineTo(w - m.r, Y(A + B)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.omega; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('\u03b1 + \u03b2 = ' + (A + B).toFixed(1), w - m.r, Y(A + B) - 3);
    ctx.strokeStyle = C.fg; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const q = i / 200; if (i === 0) ctx.moveTo(X(q), Y(F(q))); else ctx.lineTo(X(q), Y(F(q))); }
    ctx.stroke();
    const qs = A / (A + B);
    ctx.fillStyle = C.omega; ctx.beginPath(); ctx.arc(X(qs), Y(F(qs)), 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.muted; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('\u03b2', 4, Y(B)); ctx.fillText('\u03b1', w - m.r - 10, Y(A) + 12);
    $('#entOut').innerHTML = `Best q = &alpha;/(&alpha; + &beta;) = ${qs.toFixed(3)}. Value there: <b>${F(qs).toFixed(3)}</b> = &alpha; + &beta; = ${(A + B).toFixed(3)}<br>At q = 0 the bound is only &beta;. At q = 1 it is only &alpha;. Mixing both kinds of pieces does better.`;
  }
  register(drawEnt);
  const det = document.querySelector('#ent').closest('details');
  if (det) det.addEventListener('toggle', () => { if (det.open) drawEnt(); });

  /* ------------------------------------------------------------ ch8: block matrix */
  const cc = { f: [2, 3, 1] };
  function ccNew() { cc.f = [randInt(1, 4), randInt(1, 4), randInt(1, 4)]; drawCC(); }
  function drawCC() {
    const a = +$('#ccA').value, b = +$('#ccB').value, eps = +$('#ccEps').value;
    $('#ccAOut').textContent = a; $('#ccBOut').textContent = b; $('#ccEpsOut').textContent = eps.toFixed(2);
    const f = cc.f.slice(0, a);
    const nLin = b + 1, nSin = b - 1, nLout = a + b, nSout = a + b - 2;
    const Mx = Array.from({ length: nLout + nSout }, () => new Array(nLin + nSin).fill(0));
    // columns 0..nLin-1 : L_m ; nLin.. : S_j. rows 0..nLout-1 : L'_r ; nLout.. : S'_r
    for (let mI = 0; mI < nLin; mI++) {
      if (mI >= 1) f.forEach((fi, i) => { Mx[mI + i][mI] += fi; });
      else f.forEach((fi, i) => { Mx[i][0] += fi; if (i >= 1) Mx[nLout + i - 1][0] -= fi; });
    }
    for (let j = 0; j < nSin; j++) f.forEach((fi, i) => { Mx[nLout + j + i][nLin + j] += fi; });
    let html = '<tr><th></th>';
    for (let c = 0; c < nLin + nSin; c++) { if (c === nLin) html += '<th class="sepc"></th>'; html += `<th>${c < nLin ? 'L' + c : 'S' + (c - nLin)}</th>`; }
    html += '</tr>';
    let starCount = 0;
    for (let r = 0; r < nLout + nSout; r++) {
      if (r === nLout) html += `<tr><td class="sepc" colspan="${nLin + nSin + 2}" style="height:6px"></td></tr>`;
      html += `<tr><th>${r < nLout ? "L" + r + "'" : "S" + (r - nLout) + "'"}</th>`;
      for (let c = 0; c < nLin + nSin; c++) {
        if (c === nLin) html += '<td class="sepc"></td>';
        const v = Mx[r][c]; const rowL = r < nLout, colL = c < nLin;
        let cls, txt = v === 0 ? '&middot;' : String(v), style = '';
        if (rowL && colL) cls = v ? 'L' : 'L e';
        else if (!rowL && !colL) cls = v ? 'S' : 'S e';
        else if (!rowL && colL) { cls = v ? 'st' : 'zero'; if (v) { starCount++; style = `opacity:${Math.max(0.08, eps)}`; txt = eps === 0 ? '0' : (eps === 1 ? String(v) : (v * eps).toFixed(1)); } }
        else cls = 'zero';
        if (cls.endsWith(' e')) { cls = cls.replace(' e', ''); txt = '&middot;'; style = 'opacity:0.45'; }
        html += `<td class="${cls}" style="${style}">${txt}</td>`;
      }
      html += '</tr>';
    }
    $('#cc').innerHTML = html;
    const fStr = polyStr(f, 's');
    $('#ccInfo').innerHTML = `f(s) = ${fStr} &nbsp;(a = ${a}), and g${sub(1)}, g${sub(2)} each have b = ${b} coefficients.<br>` +
      `Input pairs: 2b = ${2 * b} numbers = ${nLin} long pairs + ${nSin} short pairs.<br>` +
      `Output pairs: ${2 * (a + b - 1)} numbers = ${nLout} long pairs + ${nSout} short pairs.<br>` +
      `Blue block: Poly(${a}, ${b + 1}). Gold block: Poly(${a}, ${b - 1}). Leftover corner: ${starCount} entries, ` +
      (eps === 0 ? '<span class="ok">squished away</span>.' : 'multiplied by &epsilon;.') +
      `<br>Special pairs: L0 = (0, 1), L${sub('m')} = (s${sup('m&minus;1')}, 0), S${sub('j')} = (s${sup('j')}, &minus;s${sup('j+1')}).`;
  }
  ['ccA', 'ccB', 'ccEps'].forEach(id => $('#' + id).addEventListener('input', drawCC));
  $('#ccNew').addEventListener('click', ccNew);
  register(drawCC);

  /* ------------------------------------------------------------ ch9: tripling */
  function drawTri() {
    const a = +$('#triA').value, hh = +$('#triH').value, eps = +$('#triEps').value;
    $('#triAOut').textContent = a; $('#triHOut').textContent = hh; $('#triEpsOut').textContent = eps.toFixed(2);
    const B = 3 * hh + a - 1, rows = B, cols = B + a - 1;
    const cv = $('#tri'); const w0 = Math.max(200, cv.clientWidth || 320);
    const lm = 34, tm = 40;
    const cell = Math.min((w0 - lm - 6) / cols, 34);
    const { ctx, w } = prep(cv, () => tm + rows * cell + 8);
    const ySec = y => y < hh ? 0 : y <= 2 * hh + a - 2 ? 1 : 2;
    const zSec = z => z <= hh + a - 2 ? 0 : z <= 2 * hh + a - 2 ? 1 : 2;
    const secCol = [C.Y, C.omega, C.Z], secSoft = [C['Y-soft'], C['omega-soft'], C['Z-soft']];
    const gx = c => lm + c * cell, gy = r => tm + r * cell;
    // sector bars
    for (let z = 0; z < cols; z++) { ctx.fillStyle = secCol[zSec(z)]; ctx.fillRect(gx(z) + 1, tm - 9, cell - 2, 4); }
    for (let y = 0; y < rows; y++) { ctx.fillStyle = secCol[ySec(y)]; ctx.fillRect(lm - 9, gy(y) + 1, 4, cell - 2); }
    ctx.font = font(Math.max(8.5, Math.min(11, cell * 0.42))); ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let z = 0; z < cols; z++) ctx.fillText(String(z), gx(z) + cell / 2, tm - 20);
    ctx.textAlign = 'right';
    for (let y = 0; y < rows; y++) ctx.fillText(String(y), lm - 13, gy(y) + cell / 2);
    ctx.textAlign = 'left'; ctx.fillText('z →', 0, tm - 20);
    ctx.save(); ctx.translate(8, tm + 18); ctx.fillText('y', -4, 0); ctx.fillText('↓', -4, 12); ctx.restore();
    let crossed = 0;
    for (let y = 0; y < rows; y++) for (let z = 0; z < cols; z++) {
      const x0 = gx(z), y0 = gy(y);
      ctx.strokeStyle = withAlpha(C.muted, 0.18); ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, cell - 1, cell - 1);
      const i = z - y; if (i < 0 || i > a - 1) continue;
      const wt = (ySec(y) === 1 ? 1 : 0) + (zSec(z) === 1 ? -1 : 0);
      if (wt === 0) {
        const s = ySec(y);
        ctx.fillStyle = secSoft[s]; ctx.fillRect(x0 + 1, y0 + 1, cell - 2, cell - 2);
        ctx.fillStyle = secCol[s];
      } else {
        crossed++;
        const al = Math.max(0.1, eps);
        ctx.fillStyle = withAlpha(C.X, 0.16 * al); ctx.fillRect(x0 + 1, y0 + 1, cell - 2, cell - 2);
        ctx.strokeStyle = withAlpha(C.X, al); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x0 + 4, y0 + 4); ctx.lineTo(x0 + cell - 4, y0 + cell - 4); ctx.moveTo(x0 + cell - 4, y0 + 4); ctx.lineTo(x0 + 4, y0 + cell - 4); ctx.stroke();
        ctx.fillStyle = withAlpha(C.X, al);
      }
      ctx.font = font(Math.max(9, Math.min(13, cell * 0.5)), MONO, 600); ctx.textAlign = 'center';
      ctx.fillText(String(i), x0 + cell / 2, y0 + cell / 2 + 0.5);
    }
    // block outlines
    const blocks = [[0, hh - 1, 0, hh + a - 2], [hh, 2 * hh + a - 2, hh + a - 1, 2 * hh + a - 2], [2 * hh + a - 1, 3 * hh + a - 2, 2 * hh + a - 1, 3 * hh + 2 * a - 3]];
    blocks.forEach((bk, s) => {
      ctx.strokeStyle = secCol[s]; ctx.lineWidth = 2;
      ctx.strokeRect(gx(bk[2]) + 0.5, gy(bk[0]) + 0.5, (bk[3] - bk[2] + 1) * cell - 1, (bk[1] - bk[0] + 1) * cell - 1);
    });
    void w;
    $('#triInfo').innerHTML = `Poly(${a}, ${B}): rows y${sub(0)} to y${sub(B - 1)}, labels z${sub(0)} to z${sub(B + a - 2)}, ${a * B} terms.<br>` +
      `<span class="ly">First block</span>: ${hh} rows &times; ${hh + a - 1} labels = Poly(${a}, ${hh}).<br>` +
      `<span class="lo">Middle block</span>: ${hh + a - 1} rows &times; ${hh} labels = Poly(${a}, ${hh}) with Y and Z swapped.<br>` +
      `<span class="lz">Last block</span>: ${hh} rows &times; ${hh + a - 1} labels = Poly(${a}, ${hh}).<br>` +
      `Crossed terms (weight +1): ${crossed}` + (a === 1 ? ' (with a = 1 there is no tax and nothing to cross)' : '') + '.';
  }
  ['triA', 'triH', 'triEps'].forEach(id => $('#' + id).addEventListener('input', drawTri));
  register(drawTri);

  /* ------------------------------------------------------------ ch10: slope */
  bindSlider('slopeK', v => v.toFixed(2), drawSlope);
  function drawSlope() {
    const k = +$('#slopeK').value;
    const { ctx, w, h } = prep($('#slope'));
    const m = { l: 36, r: 14, t: 14, b: 28 };
    const xa = -0.25, xb = 1.08, ya = 0, yb = 3.4;
    const X = x => m.l + (x - xa) / (xb - xa) * (w - m.l - m.r);
    const Y = y => m.t + (yb - y) / (yb - ya) * (h - m.t - m.b);
    const f = x => x >= 0 ? 1 + 2 * (1 - Math.pow(1 - Math.min(x, 1), k)) : 1 + 2 * k * x - 1.2 * x * x * k;
    ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(m.l, Y(0)); ctx.lineTo(w - m.r, Y(0)); ctx.stroke();
    ctx.fillStyle = C.muted; ctx.font = font(10.5); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('b = a', X(0), h - m.b + 6); ctx.fillText('b = 4a − 1', X(1) - 8, h - m.b + 6);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText('D', m.l - 6, Y(1)); ctx.fillText('3D', m.l - 6, Y(3));
    [[0, 1], [1, 3]].forEach(([x, y]) => { ctx.setLineDash([2, 3]); ctx.strokeStyle = C.rule; ctx.beginPath(); ctx.moveTo(X(x), Y(0)); ctx.lineTo(X(x), Y(y)); ctx.moveTo(m.l, Y(y)); ctx.lineTo(X(x), Y(y)); ctx.stroke(); ctx.setLineDash([]); });
    // chord
    ctx.setLineDash([6, 5]); ctx.strokeStyle = C.muted; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(X(0), Y(1)); ctx.lineTo(X(1), Y(3)); ctx.stroke(); ctx.setLineDash([]);
    // tangent
    const xe = Math.min(xb, (yb - 1) / (2 * k));
    ctx.strokeStyle = C.omega; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(X(0), Y(1)); ctx.lineTo(X(xe), Y(1 + 2 * k * xe)); ctx.stroke();
    // curve
    ctx.strokeStyle = C.fg; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const x = xa + (xb - xa) * i / 200; const y = x > 1 ? 3 + (x - 1) * 0.15 * k : f(x); if (i === 0) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(y)); }
    ctx.stroke();
    [[0, 1], [1, 3]].forEach(([x, y]) => { ctx.fillStyle = C.panel; ctx.strokeStyle = C.fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(x), Y(y), 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
    $('#slopeOut').innerHTML = `Average step (dashed chord): 2D / (3a &minus; 1).<br>First step (green): ${k.toFixed(2)} &times; the average. ` +
      (k < 1.02 ? 'With no bend, the first step equals the average.' : 'The more the curve bends, the steeper it starts.');
  }
  register(drawSlope);

  /* ------------------------------------------------------------ ch10: growth */
  function minimalD(A) {
    const out = []; let prod = 1;
    for (let a = 1; a <= A; a++) { if (a > 1) prod *= 1 + 1 / (3 * (a - 1)); out.push((3 * a - 1) / 2 * prod); }
    return out;
  }
  bindSlider('growA', null, drawGrow);
  function drawGrow() {
    const A = +$('#growA').value; const D = minimalD(A);
    const { ctx, w, h } = prep($('#grow'));
    const m = { l: 40, r: 12, t: 12, b: 24 };
    const ymax = Math.max(D[A - 1], Math.pow(A, 4 / 3)) * 1.06;
    const X = a => m.l + (a - 1) / (A - 1) * (w - m.l - m.r); const Y = y => m.t + (ymax - y) / ymax * (h - m.t - m.b);
    ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(m.l, Y(0)); ctx.lineTo(w - m.r, Y(0)); ctx.moveTo(m.l, Y(0)); ctx.lineTo(m.l, m.t); ctx.stroke();
    ctx.fillStyle = C.muted; ctx.font = font(10.5); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    [1, Math.round(A / 2), A].forEach(a => ctx.fillText('a=' + a, X(a), h - m.b + 5));
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(Math.round(ymax / 1.06), m.l - 4, Y(ymax / 1.06));
    ctx.strokeStyle = C.muted; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(1), Y(1)); ctx.lineTo(X(A), Y(A)); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = C.Z; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const a = 1 + (A - 1) * i / 200; if (i === 0) ctx.moveTo(X(a), Y(Math.pow(a, 4 / 3))); else ctx.lineTo(X(a), Y(Math.pow(a, 4 / 3))); }
    ctx.stroke();
    const r = Math.max(2, Math.min(4.5, 120 / A));
    D.forEach((d, i) => { ctx.fillStyle = C.omega; ctx.beginPath(); ctx.arc(X(i + 1), Y(d), r, 0, Math.PI * 2); ctx.fill(); });
    const pick = Array.from(new Set([1, 2, 3, 4, 5, 10, 20, 40, A].filter(a => a <= A))).sort((x, y) => x - y);
    $('#growTable').innerHTML = '<tr><th>a</th><th>smallest P(a,a)</th><th>a<sup>4/3</sup></th><th>a</th></tr>' +
      pick.map(a => `<tr><td>${a}</td><td><b>${D[a - 1].toFixed(2)}</b></td><td>${Math.pow(a, 4 / 3).toFixed(2)}</td><td>${a}</td></tr>`).join('');
  }
  register(drawGrow);

  /* ------------------------------------------------------------ ch10: squeeze */
  bindSlider('sqT', v => v.toFixed(3), drawSq);
  function crossing(t) {
    // smallest L = ln a > 0 where (4/3)L > (1/t) ln(2e^L - 1)
    const g = L => (4 / 3) * L - (1 / t) * (L + Math.log(2 - Math.exp(-L)));
    if (1 / t >= 4 / 3 - 1e-12) return null;
    let lo = 1e-6, hi = 1;
    while (g(hi) <= 0 && hi < 5000) { lo = hi; hi *= 2; }
    if (g(hi) <= 0) return null;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (g(mid) > 0) hi = mid; else lo = mid; }
    return hi; // natural log of a
  }
  function drawSq() {
    const t = +$('#sqT').value;
    const L = crossing(t);
    const crossLog10 = L === null ? null : L / Math.LN10;
    const xmax = crossLog10 === null ? 6 : Math.min(400, Math.max(2, crossLog10 * 1.5 + 0.3));
    const { ctx, w, h } = prep($('#sq'));
    const m = { l: 44, r: 12, t: 14, b: 28 };
    const gap = x => (1 / t) * (x + Math.log10(2 - Math.pow(10, -x))) - (4 / 3) * x;
    let ymin = 0, ymax = 0;
    for (let i = 0; i <= 240; i++) { const v = gap(xmax * i / 240); ymin = Math.min(ymin, v); ymax = Math.max(ymax, v); }
    const span = Math.max(ymax - ymin, 0.5);
    ymin -= span * 0.12; ymax += span * 0.12;
    const X = x => m.l + x / xmax * (w - m.l - m.r); const Y = y => m.t + (ymax - y) / (ymax - ymin) * (h - m.t - m.b);
    // regions
    ctx.fillStyle = withAlpha(C.X, 0.10); ctx.fillRect(m.l, Y(0), w - m.l - m.r, Y(ymin) - Y(0));
    ctx.fillStyle = withAlpha(C.omega, 0.08); ctx.fillRect(m.l, Y(ymax), w - m.l - m.r, Y(0) - Y(ymax));
    ctx.font = font(10.5, MONO, 600); ctx.textAlign = 'right';
    ctx.fillStyle = C.omega; ctx.textBaseline = 'top'; ctx.fillText('ceiling above floor: fine', w - m.r - 4, Y(ymax) + 4);
    if (Y(ymin) - Y(0) > 24) { ctx.fillStyle = C.X; ctx.textBaseline = 'bottom'; ctx.fillText('floor above ceiling: impossible', w - m.r - 4, Y(ymin) - 4); }
    ctx.setLineDash([5, 4]); ctx.strokeStyle = C.muted; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(m.l, Y(0)); ctx.lineTo(w - m.r, Y(0)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.muted; ctx.font = font(10.5); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const fmtTick = v => 'a=10^' + (Math.abs(v - Math.round(v)) < 0.05 ? Math.round(v) : v.toFixed(1));
    [0, xmax / 2, xmax].forEach((v, i) => { ctx.textAlign = i === 0 ? 'left' : i === 2 ? 'right' : 'center'; ctx.fillText(fmtTick(v), X(v), h - m.b + 7); });
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText('1×', m.l - 5, Y(0));
    if (ymax > 0.3) ctx.fillText('10^' + ymax.toFixed(1) + '×', m.l - 5, Y(ymax) + 6);
    ctx.strokeStyle = C.fg; ctx.lineWidth = 2.8; ctx.beginPath();
    for (let i = 0; i <= 300; i++) { const x = xmax * i / 300; const y = gap(x); if (i === 0) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(y)); }
    ctx.stroke();
    if (crossLog10 !== null) { ctx.fillStyle = C.X; ctx.beginPath(); ctx.arc(X(crossLog10), Y(0), 5.5, 0, Math.PI * 2); ctx.fill(); }
    const aStr = crossLog10 === null ? '' : (crossLog10 < 6 ? fmtInt(Math.ceil(Math.exp(L))) : '10^' + crossLog10.toFixed(1));
    $('#sqOut').innerHTML = `Meter level t = ${t.toFixed(3)}: it would read MM(n) as n${sup((3 * t).toFixed(3))}. The ceiling grows like a${sup((1 / t).toFixed(3))}, and the floor like a${sup('1.333')}.<br>` +
      (crossLog10 === null
        ? `<span class="ok">No contradiction.</span> The ceiling stays above the floor for every a. Meters at this level are allowed.`
        : `<span class="no">Contradiction</span> once a passes about <b>${aStr}</b>: there the floor would be above the ceiling. So no meter has level ${t.toFixed(3)}.` +
          (crossLog10 > 12 ? ' The closer t gets to 3/4, the larger a must be, but some a always works.' : ''));
  }
  register(drawSq);

  /* ------------------------------------------------------------ ch11: tax thought experiment */
  bindSlider('taxT', v => v.toFixed(2), drawTax);
  function drawTax() {
    const tau = +$('#taxT').value; const bound = 3 * (2 + tau) / 4; const kappa = 4 / (2 + tau);
    const host = $('#taxScale'); const W = Math.max(280, host.clientWidth || 320), H = 80;
    const lo = 1.5, hi = 3.0; const m = { l: 14, r: 14 };
    const X = v => m.l + (v - lo) / (hi - lo) * (W - m.l - m.r);
    host.innerHTML = '';
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Bound on omega for each tax' }, host);
    svgEl('rect', { x: X(lo), y: 32, width: X(2) - X(lo), height: 14, fill: C['X-soft'], stroke: C.X, rx: 4 }, svg);
    const t1 = svgEl('text', { x: (X(lo) + X(2)) / 2, y: 24, 'text-anchor': 'middle', fill: C.X, 'font-size': 10.5, 'font-family': MONO }, svg); t1.textContent = 'impossible';
    svgEl('line', { x1: X(lo), x2: X(hi), y1: 39, y2: 39, stroke: C.rule, 'stroke-width': 3 }, svg);
    [[1.5, '1.5'], [2, '2'], [2.25, '9/4'], [2.371, '2.371'], [3, '3']].forEach(([v, lab]) => {
      svgEl('line', { x1: X(v), x2: X(v), y1: 33, y2: 45, stroke: C.muted }, svg);
      const t = svgEl('text', { x: X(v), y: v === 2.371 ? 24 : 62, 'text-anchor': v === lo ? 'start' : v === hi ? 'end' : 'middle', fill: v === 2.25 ? C.omega : C.muted, 'font-size': 10.5, 'font-family': MONO }, svg); t.textContent = lab;
    });
    svgEl('circle', { cx: X(Math.max(lo, Math.min(hi, bound))), cy: 39, r: 8, fill: bound < 2 - 1e-9 ? C.X : C.omega, stroke: C.panel, 'stroke-width': 2 }, svg);
    let msg = `Tax &tau; = ${tau.toFixed(2)}: floor growth 4/(2 + &tau;) = ${kappa.toFixed(3)}, bound &omega; &le; 3(2 + &tau;)/4 = <b>${bound.toFixed(3)}</b><br>`;
    if (Math.abs(tau - 1) < 0.005) msg += 'This is the real rule T. It gives 9/4.';
    else if (bound < 2 - 1e-9) msg += '<span class="no">Below 2.</span> That cannot happen, because &omega; &ge; 2. So no true tripling rule has a tax this small.';
    else if (Math.abs(bound - 2) < 0.005) msg += 'This tax would prove &omega; = 2, the dream result.';
    else if (tau < 1) msg += 'A smaller tax than the real one. The bound would beat 9/4.';
    else msg += 'A larger tax than the real one. The bound gets worse.';
    $('#taxOut').innerHTML = msg;
  }
  register(drawTax);

  /* ------------------------------------------------------------ ch11: rule checker */
  const phi = a => { let p = 1; for (let j = 1; j < a; j++) p *= 1 + 1 / (3 * j); return p; };
  const PROFILES = {
    rank: { name: 'Naive guess a + b − 1', P: (a, b) => a + b - 1, inv: 1, invLabel: '1' },
    flat: { name: 'Flattening meter', P: (a, b) => Math.sqrt(a * b * (a + b - 1)), inv: 1.5, invLabel: '3/2' },
    star: { name: 'Extremal P*', P: (a, b) => { const mn = Math.min(a, b), mx = Math.max(a, b); return phi(mn) * (mx + (mn - 1) / 2); }, inv: 4 / 3, invLabel: '4/3' }
  };
  let rcProf = 'rank';
  function runChecks(pr) {
    const P = pr.P, tol = 1e-9; const res = { S: null, B: null, U: null, C: null, T: null };
    for (let a = 1; a <= 25; a++) for (let b = 1; b <= 80; b++) {
      if (!res.S && Math.abs(P(a, b) - P(b, a)) > tol) res.S = `P(${a},${b}) ≠ P(${b},${a})`;
      if (!res.B && a === 1 && Math.abs(P(1, b) - b) > tol) res.B = `P(1,${b}) = ${P(1, b).toFixed(3)}`;
      if (!res.U && P(a, b) > Math.pow(a + b - 1, pr.inv) + tol) res.U = `P(${a},${b}) is above the ceiling`;
      if (!res.C && b >= 2 && 2 * P(a, b) + tol < P(a, b + 1) + P(a, b - 1)) res.C = `fails at a=${a}, b=${b}`;
    }
    for (let a = 1; a <= 25; a++) for (let hh = 1; hh <= 25; hh++) {
      if (!res.T && P(a, 3 * hh + a - 1) + tol < 3 * P(a, hh)) res.T = `P(${a},${3 * hh + a - 1}) = ${fmtNum(P(a, 3 * hh + a - 1))} but 3P(${a},${hh}) = ${fmtNum(3 * P(a, hh))}`;
    }
    return res;
  }
  function drawRC() {
    const pr = PROFILES[rcProf]; const res = runChecks(pr);
    const names = { S: 'swap', B: 'base', U: 'ceiling, with 1/t = ' + pr.invLabel, C: 'bending', T: 'tripling' };
    const t = 1 / pr.inv;
    $('#rcOut').innerHTML = `<b>${pr.name}</b> &middot; level t = ${t.toFixed(3)}, so it reads MM(n) as n${sup((3 * t).toFixed(2))}<br>` +
      Object.keys(names).map(k => `${k} (${names[k]}): ${res[k] ? `<span class="no">fails</span>, ${res[k]}` : '<span class="ok">passes</span>'}`).join('<br>') +
      '<br><span style="opacity:.75">Checked for a up to 25 and b up to 80.</span>';
    let html = '<tr><th style="white-space:nowrap">a, b</th>' + [1, 2, 3, 4].map(b => `<th>b=${b}</th>`).join('') + '</tr>';
    for (let a = 1; a <= 5; a++) html += `<tr><th>a=${a}</th>` + [1, 2, 3, 4].map(b => `<td${a === b ? ' style="color:var(--omega);font-weight:600"' : ''}>${pr.P(a, b).toFixed(2)}</td>`).join('') + '</tr>';
    $('#rcHeat').innerHTML = html;
  }
  $$('#rcBtns [data-prof]').forEach(b => b.addEventListener('click', () => {
    $$('#rcBtns [data-prof]').forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true'); rcProf = b.dataset.prof; drawRC();
  }));
  register(drawRC);

  // fonts load late; redraw canvases once they are ready so text uses the right face
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redrawAll);
})();
