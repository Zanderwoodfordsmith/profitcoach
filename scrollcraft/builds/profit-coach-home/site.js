/* The Profit Coach · homepage choreography. Reads scroll position directly
   (same formula the engine uses for pinned progress) and drives only
   transform and opacity. */
(function () {
  'use strict';

  var AREAS = [
    { code: '+', name: 'Owner Performance' },
    { code: 'A', name: 'Aligned Vision' },
    { code: 'D', name: 'Defined Strategy' },
    { code: 'D', name: 'Disciplined Planning' },
    { code: 'P', name: 'Profit & Cash Flow' },
    { code: 'R', name: 'Revenue & Marketing' },
    { code: 'O', name: 'Operations & Delivery' },
    { code: 'F', name: 'Financials & Metrics' },
    { code: 'I', name: 'Infrastructure & Systems' },
    { code: 'T', name: 'Team & Leadership' }
  ];
  var LEVELS = ['Overwhelm', 'Overworked', 'Organised', 'Overseer', 'Owner'];
  // Source of truth: src/lib/bossData.ts PLAYBOOKS, indexed [level][area].
  var PLAYBOOKS = {
    5: ['Life Design', 'Mission', 'Exit Strategy', 'Succession Planning', 'Wealth Building', 'Branding', 'Product Development', 'Business Valuation', 'Optimisation', 'Company Culture'],
    4: ['Leadership', 'Strategic Intent', 'Growth Strategy', 'Meetings & Reviews', 'Profit Allocation', 'Follow-up & Nurture', 'Lifetime Value', 'Dashboards & Reporting', 'AI & Automation', 'Developing Leaders'],
    3: ['Mindset & Habits', 'Vision', 'Business Model', 'Projects & Planning', 'Profit & Pricing', 'Positioning', 'Customer Retention', 'KPIs', 'Management', 'Recruitment'],
    2: ['Time & Energy', 'Goals', 'Core Offer', 'Business Mapping', 'Cost Control', 'Sales & Conversion', 'Customer Experience', 'Finance Fundamentals', 'Systems', 'Team Performance'],
    1: ['Focus', 'Purpose', 'Ideal Customer', 'Execution', 'Cash Flow', 'Customer Acquisition', 'Fulfilment', 'Bookkeeping', 'Processes', 'Team Output']
  };

  var KEY = 'pc-boss-flags';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var flags = load();

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      return new Set((Array.isArray(raw) ? raw : []).filter(function (n) { return Number.isInteger(n) && n >= 0 && n < 10; }));
    } catch (e) { return new Set(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(Array.from(flags))); } catch (e) { /* private mode */ }
  }

  // ------------------------------------------------------------ wheel --
  var uid = 0;
  function polar(r, deg) { var a = deg * Math.PI / 180; return [300 + r * Math.cos(a), 300 + r * Math.sin(a)]; }
  function pt(p) { return p[0].toFixed(2) + ' ' + p[1].toFixed(2); }
  function sector(r0, r1, a0, a1) {
    var large = a1 - a0 > 180 ? 1 : 0;
    return 'M' + pt(polar(r1, a0)) + 'A' + r1 + ' ' + r1 + ' 0 ' + large + ' 1 ' + pt(polar(r1, a1)) +
      'L' + pt(polar(r0, a1)) + 'A' + r0 + ' ' + r0 + ' 0 ' + large + ' 0 ' + pt(polar(r0, a0)) + 'Z';
  }
  function arc(r, a0, a1) {
    return 'M' + pt(polar(r, a0)) + 'A' + r + ' ' + r + ' 0 0 1 ' + pt(polar(r, a1));
  }

  var wheels = {};
  function buildWheel(svg, o) {
    var id = 'pcw' + (++uid);
    var hub = o.hub, outer = o.outer, gap = o.gap == null ? 1.6 : o.gap;
    var h = '<defs><radialGradient id="' + id + '" gradientUnits="userSpaceOnUse" cx="300" cy="300" r="' + outer + '">' +
      '<stop offset="0" stop-color="#0B5191"/><stop offset="0.6" stop-color="#2291EB"/><stop offset="1" stop-color="#1CA0C2"/>' +
      '</radialGradient></defs>';
    if (o.rings) {
      h += '<g class="w-rings">';
      for (var k = 1; k <= 5; k++) h += '<circle class="w-ring" cx="300" cy="300" r="' + (hub + (outer - hub) * k / 5).toFixed(1) + '"/>';
      h += '</g>';
    }
    h += '<g class="w-segs">';
    for (var i = 0; i < 10; i++) {
      var a0 = -108 + i * 36 + gap / 2, a1 = a0 + 36 - gap, d = sector(hub, outer, a0, a1);
      h += '<g class="w-seg" data-area="' + i + '"><path class="w-base" d="' + d + '"/>' +
        '<path class="w-lit" fill="url(#' + id + ')" d="' + d + '"/>' +
        (o.sweep ? '<path class="w-scan" d="' + d + '"/><path class="w-rim" d="' + arc(outer + 12, a0 + 1, a1 - 1) + '"/>' : '') +
        '</g>';
    }
    h += '</g>';
    if (o.codes) {
      h += '<g class="w-codes">';
      for (var c = 0; c < 10; c++) {
        var p = polar(outer + (o.sweep ? 36 : 30), -90 + c * 36);
        h += '<text class="w-code" data-area="' + c + '" x="' + p[0].toFixed(1) + '" y="' + p[1].toFixed(1) + '">' + esc(AREAS[c].code) + '</text>';
      }
      h += '</g>';
    }
    if (o.sweep) {
      // A radar trail: thin slices fading behind a bright leading edge at -108°.
      h += '<g class="w-beam" opacity="0">';
      for (var s = 0; s < 9; s++) {
        h += '<path opacity="' + (0.2 * (1 - s / 9)).toFixed(3) + '" d="' + sector(hub, outer + 6, -108 - (s + 1) * 4, -108 - s * 4) + '"/>';
      }
      var e0 = polar(hub, -108), e1 = polar(outer + 18, -108);
      h += '<line x1="' + e0[0].toFixed(1) + '" y1="' + e0[1].toFixed(1) + '" x2="' + e1[0].toFixed(1) + '" y2="' + e1[1].toFixed(1) + '"/></g>';
    }
    svg.innerHTML = h;
    var segs = $$('.w-seg', svg).map(function (g) {
      return { g: g, lit: $('.w-lit', g), scan: $('.w-scan', g), rim: $('.w-rim', g) };
    });
    return { svg: svg, segs: segs, segsG: $('.w-segs', svg), rings: $$('.w-ring', svg), codes: $$('.w-code', svg), codesG: $('.w-codes', svg), beam: $('.w-beam', svg) };
  }

  var wheelSpecs = {
    ledger: { hub: 58, outer: 232, rings: true, codes: true },
    peak: { hub: 72, outer: 226, rings: true, codes: true, sweep: true },
    close: { hub: 58, outer: 232, rings: true, codes: true },
    dock: { hub: 150, outer: 292, gap: 4 }
  };
  $$('[data-wheel]').forEach(function (svg) {
    var name = svg.getAttribute('data-wheel');
    wheels[name] = buildWheel(svg, wheelSpecs[name]);
  });
  if (wheels.peak) wheels.peak.svg.classList.add('wheel--scrubbed');

  // ------------------------------------------------------------- ticks --
  var ticks = $$('.tick');
  ticks.forEach(function (btn) {
    var i = +btn.getAttribute('data-area');
    btn.addEventListener('click', function () {
      if (flags.has(i)) flags.delete(i); else flags.add(i);
      save();
      paint();
    });
  });
  var clearBtn = $('[data-clear]');
  if (clearBtn) clearBtn.addEventListener('click', function () { flags.clear(); save(); paint(); });

  function flaggedNames() {
    return AREAS.map(function (a, i) { return flags.has(i) ? a.name : null; }).filter(Boolean);
  }
  function listSentence(el, names) {
    el.textContent = '';
    el.appendChild(document.createTextNode('You flagged '));
    names.forEach(function (n, k) {
      if (k > 0) el.appendChild(document.createTextNode(k === names.length - 1 ? ' and ' : ', '));
      var b = document.createElement('b'); b.textContent = n; el.appendChild(b);
    });
    el.appendChild(document.createTextNode('. The score measures how big each gap is, across all ten areas.'));
  }

  function paint() {
    var n = flags.size;
    ticks.forEach(function (btn) { btn.setAttribute('aria-pressed', String(flags.has(+btn.getAttribute('data-area')))); });
    Object.keys(wheels).forEach(function (k) {
      var w = wheels[k];
      w.segs.forEach(function (s, i) { s.g.classList.toggle('is-flagged', flags.has(i)); });
      w.codes.forEach(function (t, i) { t.classList.toggle('is-on', flags.has(i)); });
    });
    $$('[data-flag-count]').forEach(function (el) { el.textContent = String(n); });
    var dockRead = $('[data-dock-read]');
    if (dockRead) dockRead.textContent = n ? n + ' of 10 areas flagged' : '10 areas. One score.';
    var status = $('[data-ledger-status]');
    if (status) status.textContent = n ? n + ' of 10 areas flagged.' + (n === 10 ? ' That\u2019s every area.' : '') : 'Nothing ticked yet.';
    if (clearBtn) clearBtn.hidden = n === 0;
    var sentence = $('[data-flag-sentence]');
    if (sentence) {
      if (n === 0) sentence.textContent = 'Every business scores somewhere between 0 and 100. The BOSS Score reads all ten areas.';
      else if (n <= 3) listSentence(sentence, flaggedNames());
      else sentence.textContent = 'You flagged ' + n + ' of 10 areas. The score measures how big each gap is, across all ten.';
    }
    var close = $('[data-flag-close]');
    if (close) close.textContent = n ? 'You flagged ' + n + ' of 10 areas.' : 'Every business has a score.';
    if (reduce || !peakAct) paintPeakStatic();
  }

  // -------------------------------------------------------------- hero --
  var hero = $('[data-hero]');
  var heroAct = hero && hero.closest('[data-sc-act]');
  var you = hero && $('[data-you]', hero);
  var tethers = hero && $('[data-hero-tethers]', hero);
  var ringsSvg = hero && $('[data-hero-rings]', hero);
  var H = { chips: [], lines: [], cx: 0, cy: 0, w: 0, h: 0 };
  var ptr = { x: 0, y: 0, tx: 0, ty: 0 };

  function layoutHero() {
    if (!hero) return;
    var mobile = innerWidth <= 860;
    H.w = hero.clientWidth; H.h = hero.clientHeight;
    H.cx = you.offsetLeft; H.cy = you.offsetTop;
    var rx = mobile ? 150 : 262, ry = mobile ? 118 : 178;
    var pull = mobile ? 0.45 : 1;
    var margin = 14;
    H.chips = $$('.chip', hero).map(function (el) {
      el.style.transform = '';
      var visible = getComputedStyle(el).display !== 'none';
      var z = parseFloat(el.style.getPropertyValue('--z')) || 1;
      var near = el.classList.contains('chip--near');
      var s0 = 0.82 + 0.22 * z;
      var sx = el.offsetLeft, sy = el.offsetTop;
      var hw = el.offsetWidth * s0 / 2, hh = el.offsetHeight * s0 / 2;
      var x0 = Math.min(Math.max(sx, margin + hw), H.w - margin - hw);
      var y0 = Math.min(Math.max(sy, margin + hh), H.h - margin - hh);
      var vx = x0 - H.cx, vy = y0 - H.cy;
      var d = Math.hypot(vx / rx, vy / ry) || 1;
      var ex = near ? H.cx + vx * 1.22 : d > 1 ? x0 + (H.cx + vx / d - x0) * pull : x0;
      var ey = near ? H.cy + vy * 1.22 : d > 1 ? y0 + (H.cy + vy / d - y0) * pull : y0;
      el.style.filter = near ? 'blur(2.5px)' : z < 0.76 ? 'blur(0.4px)' : '';
      el.style.zIndex = near ? 8 : z < 0.8 ? 2 : 4;
      return { el: el, visible: visible, z: z, near: near, sx: sx, sy: sy, x0: x0, y0: y0, ex: ex, ey: ey, s0: s0 };
    });
    [tethers, ringsSvg].forEach(function (s) { s.setAttribute('viewBox', '0 0 ' + H.w + ' ' + H.h); });
    var radii = mobile ? [98, 168, 250] : [150, 268, 410];
    ringsSvg.innerHTML = radii.map(function (r) { return '<circle cx="' + H.cx + '" cy="' + H.cy + '" r="' + r + '"/>'; }).join('');
    tethers.innerHTML = H.chips.map(function () { return '<line/>'; }).join('');
    H.lines = $$('line', tethers);
    heroFrame(reduce ? 0.5 : pinnedP(heroAct), true);
  }

  if (hero && finePointer && !reduce) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      ptr.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      ptr.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    });
    hero.addEventListener('pointerleave', function () { ptr.tx = 0; ptr.ty = 0; });
  }

  var lastHero = -1;
  function heroFrame(p, force) {
    ptr.x += (ptr.tx - ptr.x) * 0.08;
    ptr.y += (ptr.ty - ptr.y) * 0.08;
    var moving = Math.abs(ptr.tx - ptr.x) > 0.001 || Math.abs(ptr.ty - ptr.y) > 0.001;
    if (!force && !moving && Math.abs(p - lastHero) < 0.0005) return;
    lastHero = p;
    var e = easeInOut(p);
    var px = ptr.x, py = ptr.y;
    var yx = -px * 7, yy = -py * 5;
    you.style.transform = 'translate3d(' + yx.toFixed(1) + 'px,' + yy.toFixed(1) + 'px,0) scale(' + (1 + 0.07 * e).toFixed(3) + ')';
    ringsSvg.style.transform = 'translate3d(' + (-px * 3).toFixed(1) + 'px,' + (-py * 2).toFixed(1) + 'px,0) scale(' + (1 - 0.05 * e).toFixed(3) + ')';
    H.chips.forEach(function (c, i) {
      var L = H.lines[i];
      if (!c.visible) { L.style.opacity = 0; return; }
      var k = c.near ? clamp01(p * 1.1) : e;
      var x = c.x0 + (c.ex - c.x0) * k;
      var y = c.y0 + (c.ey - c.y0) * k;
      var par = c.near ? 28 : 15 * c.z;
      x -= px * par; y -= py * par * 0.7;
      var s = c.s0 * (c.near ? 1 + 0.28 * k : 1 - 0.07 * k);
      var o = c.near ? 1 - clamp01((p - 0.2) / 0.55) : 1;
      c.el.style.transform = 'translate3d(' + (x - c.sx).toFixed(1) + 'px,' + (y - c.sy).toFixed(1) + 'px,0) scale(' + s.toFixed(3) + ')';
      c.el.style.opacity = o.toFixed(3);
      L.setAttribute('x1', (H.cx + yx).toFixed(1));
      L.setAttribute('y1', (H.cy + yy).toFixed(1));
      L.setAttribute('x2', x.toFixed(1));
      L.setAttribute('y2', y.toFixed(1));
      L.style.opacity = ((0.2 + 0.42 * e) * o).toFixed(3);
    });
    hero.setAttribute('data-sc-verify-state', 'hero:' + Math.round(p * 24));
  }

  // -------------------------------------------------------------- peak --
  var peak = $('[data-peak]');
  var peakAct = peak && peak.closest('[data-sc-act]');
  var peakCentre = peak && $('[data-peak-centre]', peak);
  var peakGlow = peak && $('.peak__glow', peak);
  var lastPeak = -1;

  function paintPeakStatic() {
    var W = wheels.peak;
    if (!W) return;
    W.rings.forEach(function (r) { r.style.opacity = 1; r.style.transform = ''; });
    W.segs.forEach(function (s, i) {
      s.g.style.opacity = 1;
      s.lit.style.opacity = flags.has(i) ? 1 : 0;
      s.rim.style.opacity = 0.9;
      s.scan.style.opacity = 0;
    });
    W.segsG.style.transform = '';
    W.codesG.style.opacity = 1;
    W.beam.setAttribute('opacity', '0');
    if (peakCentre) peakCentre.style.opacity = 1;
  }

  function peakFrame(p) {
    if (Math.abs(p - lastPeak) < 0.0005) return;
    lastPeak = p;
    var W = wheels.peak;
    W.rings.forEach(function (r, k) {
      var t = clamp01((p - 0.03 - k * 0.028) / 0.12);
      r.style.opacity = t.toFixed(3);
      r.style.transform = 'scale(' + (0.84 + 0.16 * easeOut(t)).toFixed(3) + ')';
    });
    var g = easeOut(clamp01((p - 0.07) / 0.24));
    W.segsG.style.transform = 'rotate(' + (-14 * (1 - g)).toFixed(2) + 'deg) scale(' + (0.93 + 0.07 * g).toFixed(3) + ')';
    var lit = clamp01((p - 0.2) / 0.1);
    var st = clamp01((p - 0.48) / 0.42);
    var sweepPos = st * 10;
    var beamOp = p < 0.45 ? 0 : p < 0.5 ? (p - 0.45) / 0.05 : p > 0.9 ? clamp01((0.96 - p) / 0.06) : 1;
    W.segs.forEach(function (s, i) {
      s.g.style.opacity = clamp01((p - 0.08 - i * 0.012) / 0.1).toFixed(3);
      s.lit.style.opacity = flags.has(i) ? lit.toFixed(3) : '0';
      s.rim.style.opacity = (clamp01(sweepPos - i) * 0.9).toFixed(3);
      s.scan.style.opacity = (0.16 * beamOp * clamp01(1 - Math.abs(sweepPos - (i + 0.5)) / 0.9)).toFixed(3);
    });
    W.codesG.style.opacity = clamp01((p - 0.16) / 0.1).toFixed(3);
    W.beam.setAttribute('opacity', beamOp.toFixed(3));
    W.beam.setAttribute('transform', 'rotate(' + (st * 360).toFixed(2) + ' 300 300)');
    peakCentre.style.opacity = clamp01((p - 0.2) / 0.1).toFixed(3);
    peakGlow.style.opacity = (0.35 + 0.65 * clamp01((p - 0.04) / 0.3)).toFixed(3);
    peak.setAttribute('data-sc-verify-state', 'peak:' + Math.round(p * 30));
  }

  // -------------------------------------------------------------- dock --
  var dock = $('[data-dock]');
  var closeAct = $('[data-close]') && $('[data-close]').closest('[data-sc-act]');
  var dockOn = false;
  function dockFrame() {
    if (!dock) return;
    var vh = innerHeight, mobile = innerWidth <= 860;
    var afterHero = heroAct.getBoundingClientRect().bottom < vh * 0.4;
    var pr = peakAct.getBoundingClientRect();
    var inPeak = mobile && pr.top < vh * 0.5 && pr.bottom > vh * 0.5;
    var inClose = closeAct.getBoundingClientRect().top < vh * 0.9;
    var on = afterHero && !inPeak && !inClose;
    if (on !== dockOn) { dock.classList.toggle('is-on', on); dockOn = on; }
  }

  // ------------------------------------------------- generated figures --
  $$('[data-bn]').forEach(function (svg) {
    var n = +svg.getAttribute('data-bn');
    var cx = 160, cy = 110, inner = Math.min(n, 8), outer = n - inner, h = '';
    var nodes = [];
    for (var i = 0; i < inner; i++) {
      var a = (-90 + (i + 0.5) * 360 / inner) * Math.PI / 180;
      nodes.push([cx + 86 * Math.cos(a), cy + 56 * Math.sin(a)]);
    }
    for (var j = 0; j < outer; j++) {
      var b = (-90 + (j + 0.25) * 360 / outer) * Math.PI / 180;
      nodes.push([cx + 146 * Math.cos(b), cy + 94 * Math.sin(b)]);
    }
    var op = n > 12 ? 0.3 : n > 5 ? 0.4 : 0.5;
    nodes.forEach(function (q) { h += '<line x1="' + cx + '" y1="' + cy + '" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) + '" opacity="' + op + '"/>'; });
    nodes.forEach(function (q) { h += '<circle class="n" cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="5.5"/>'; });
    h += '<circle class="o" cx="' + cx + '" cy="' + cy + '" r="17"/><text x="' + cx + '" y="' + cy + '">You</text>';
    svg.innerHTML = h;
  });

  var table = $('[data-playbooks]');
  if (table) {
    var t = '<thead><tr><th scope="col"><span class="sr-only">Level</span></th>';
    AREAS.forEach(function (a) { t += '<th scope="col"><span class="grid__code" aria-hidden="true">' + esc(a.code) + '</span><span class="sr-only">' + esc(a.name) + '</span></th>'; });
    t += '</tr></thead><tbody>';
    [5, 4, 3, 2, 1].forEach(function (lvl) {
      t += '<tr><th scope="row"><span class="grid__lvl">Level ' + lvl + '</span>' + LEVELS[lvl - 1] + '</th>';
      PLAYBOOKS[lvl].forEach(function (name, i) {
        t += '<td><span class="grid__ref">' + lvl + '.' + i + '</span><span class="grid__name">' + esc(name) + '</span></td>';
      });
      t += '</tr>';
    });
    table.insertAdjacentHTML('beforeend', t + '</tbody>');
  }

  // -------------------------------------------------------------- loop --
  function pinnedP(el) {
    var r = el.getBoundingClientRect();
    return clamp01(-r.top / Math.max(r.height - innerHeight, 1));
  }
  function onScreen(el) { var r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }

  function loop() {
    if (hero && !reduce && onScreen(heroAct)) heroFrame(pinnedP(heroAct));
    if (peak && !reduce && onScreen(peakAct)) peakFrame(pinnedP(peakAct));
    dockFrame();
    requestAnimationFrame(loop);
  }

  paint();
  layoutHero();
  if (reduce) paintPeakStatic();
  var rz;
  addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(layoutHero, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutHero);
  requestAnimationFrame(loop);
})();
