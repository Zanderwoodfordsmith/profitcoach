/* The Profit Coach · homepage choreography (v2). Reads scroll position
   directly (same formulas the engine uses) and drives only transform and
   opacity. */
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
  // Source of truth: src/lib/bossData.ts WHEEL_COLORS (pillar groups).
  var COLORS = ['#4C667A', '#093A6D', '#0C5290', '#3D7AB8', '#2E8AD8', '#42A1EE', '#7FC8F5', '#157A96', '#1CA0C2', '#5DCCE3'];
  var LEVELS = ['#DC2626', '#F97316', '#EAB308', '#22C55E', '#238BF7'];
  var BOOKS = [
    ['Focus', 'Time & Energy', 'Mindset & Habits', 'Leadership', 'Life Design'],
    ['Purpose', 'Goals', 'Vision', 'Strategic Intent', 'Mission'],
    ['Ideal Customer', 'Core Offer', 'Business Model', 'Growth Strategy', 'Exit Strategy'],
    ['Execution', 'Business Mapping', 'Projects & Planning', 'Meetings & Reviews', 'Succession Planning'],
    ['Cash Flow', 'Cost Control', 'Profit & Pricing', 'Profit Allocation', 'Wealth Building'],
    ['Customer Acquisition', 'Sales & Conversion', 'Positioning', 'Follow-up & Nurture', 'Branding'],
    ['Fulfilment', 'Customer Experience', 'Customer Retention', 'Lifetime Value', 'Product Development'],
    ['Bookkeeping', 'Finance Fundamentals', 'KPIs', 'Dashboards & Reporting', 'Business Valuation'],
    ['Processes', 'Systems', 'Management', 'AI & Automation', 'Optimisation'],
    ['Team Output', 'Team Performance', 'Recruitment', 'Developing Leaders', 'Company Culture']
  ];
  // The example wheel in the old/new split: Profit & Cash Flow and Team & Leadership are the two lowest.
  var CLARITY = [0.62, 0.72, 0.5, 0.66, 0.3, 0.78, 0.56, 0.64, 0.46, 0.26];

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

  // An illustration, not a score: ticked areas sit low, the rest sit at uneven
  // healthy levels so the wheel never reads as balanced.
  function jitter(i) { return ((i * 37 + 11) % 17) / 17; }
  function profile(i) { return flags.has(i) ? 0.27 + jitter(i) * 0.12 : 0.46 + jitter(i) * 0.5; }
  function lowestTwo(vals) {
    return vals.map(function (v, i) { return [v, i]; }).sort(function (a, b) { return a[0] - b[0]; }).slice(0, 2).map(function (x) { return x[1]; });
  }

  // ------------------------------------------------------- boss wheel --
  // Same construction as src/components/BossCharts/BossWheel.tsx, scaled to a
  // 600 viewBox: petals from the centre, a coloured outer band, curved names.
  var R_PETAL = 240, R_BAND = 276;
  var uid = 0;
  function polar(r, deg) { var a = deg * Math.PI / 180; return [300 + r * Math.cos(a), 300 + r * Math.sin(a)]; }
  function pt(p) { return p[0].toFixed(2) + ' ' + p[1].toFixed(2); }
  function wedge(r0, r1, a0, a1) {
    if (r0 <= 0) return 'M300 300L' + pt(polar(r1, a0)) + 'A' + r1 + ' ' + r1 + ' 0 0 1 ' + pt(polar(r1, a1)) + 'Z';
    return 'M' + pt(polar(r1, a0)) + 'A' + r1 + ' ' + r1 + ' 0 0 1 ' + pt(polar(r1, a1)) +
      'L' + pt(polar(r0, a1)) + 'A' + r0 + ' ' + r0 + ' 0 0 0 ' + pt(polar(r0, a0)) + 'Z';
  }
  function labelArc(r, a0, a1, upper) {
    return upper
      ? 'M' + pt(polar(r, a0)) + 'A' + r + ' ' + r + ' 0 0 1 ' + pt(polar(r, a1))
      : 'M' + pt(polar(r, a1)) + 'A' + r + ' ' + r + ' 0 0 0 ' + pt(polar(r, a0));
  }

  function buildBoss(svg, o) {
    var id = 'pcb' + (++uid);
    var h = '<defs>';
    COLORS.forEach(function (c, i) {
      h += '<radialGradient id="' + id + 'g' + i + '" gradientUnits="userSpaceOnUse" cx="300" cy="300" r="' + R_PETAL + '">' +
        '<stop offset="0" stop-color="' + c + '" stop-opacity="0.55"/><stop offset="1" stop-color="' + c + '"/></radialGradient>';
    });
    for (var d = 0; d < 10 && o.labels; d++) {
      var a0 = -90 + d * 36, a1 = a0 + 36, mid = a0 + 18, upper = Math.sin(mid * Math.PI / 180) < 0;
      h += '<path id="' + id + 'l' + d + '" d="' + labelArc(upper ? 253 : 263, a0 + 1, a1 - 1, upper) + '" fill="none"/>';
    }
    h += '</defs><circle class="b-disc" cx="300" cy="300" r="' + R_BAND + '"/>';
    h += '<g class="b-grid">';
    for (var k = 1; k <= 5; k++) h += '<circle cx="300" cy="300" r="' + (R_PETAL * k / 5).toFixed(1) + '"/>';
    h += '</g><g class="b-petals">';
    for (var i = 0; i < 10; i++) {
      h += '<path class="b-petal" data-area="' + i + '" fill="url(#' + id + 'g' + i + ')" d="' + wedge(0, R_PETAL, -90 + i * 36, -54 + i * 36) + '"/>';
    }
    h += '</g><g class="b-spokes">';
    for (var s = 0; s < 10; s++) { var e = polar(R_BAND, -90 + s * 36); h += '<line x1="300" y1="300" x2="' + e[0].toFixed(1) + '" y2="' + e[1].toFixed(1) + '"/>'; }
    h += '</g><g class="b-band">';
    for (var b = 0; b < 10; b++) h += '<path fill="' + COLORS[b] + '" d="' + wedge(R_PETAL, R_BAND, -90 + b * 36, -54 + b * 36) + '"/>';
    h += '</g>';
    if (o.labels) {
      h += '<g class="b-labels">';
      for (var t = 0; t < 10; t++) h += '<text><textPath href="#' + id + 'l' + t + '" startOffset="50%" text-anchor="middle">' + esc(AREAS[t].name) + '</textPath></text>';
      h += '</g>';
    }
    if (o.focus) {
      h += '<g class="b-focus">';
      for (var f = 0; f < 10; f++) {
        var fa = -72 + f * 36, fp = polar(R_BAND + 26, fa);
        h += '<g class="b-mark" data-area="' + f + '" opacity="0"><path d="' + labelArc(R_BAND + 9, fa - 16, fa + 16, true) + '"/>' +
          '<circle cx="' + fp[0].toFixed(1) + '" cy="' + fp[1].toFixed(1) + '" r="13"/><text x="' + fp[0].toFixed(1) + '" y="' + fp[1].toFixed(1) + '"></text></g>';
      }
      h += '</g>';
    }
    svg.innerHTML = h;
    return {
      svg: svg,
      petals: $$('.b-petal', svg),
      disc: $('.b-disc', svg),
      band: $('.b-band', svg),
      marks: $$('.b-mark', svg)
    };
  }
  function setPetal(el, v) { el.style.transform = 'scale(' + Math.max(0.001, v).toFixed(4) + ')'; }
  function setMarks(W, idx, op) {
    W.marks.forEach(function (m) { m.setAttribute('opacity', '0'); });
    idx.forEach(function (i, n) {
      W.marks[i].setAttribute('opacity', op.toFixed(3));
      $('text', W.marks[i]).textContent = String(n + 1);
    });
  }

  var wheels = {};
  var specs = { clarity: { labels: true }, ledger: { labels: false }, peak: { labels: true, focus: true }, close: { labels: false }, dock: { labels: false } };
  $$('[data-boss]').forEach(function (svg) {
    var name = svg.getAttribute('data-boss');
    wheels[name] = buildBoss(svg, specs[name]);
  });

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
    ['ledger', 'close', 'dock'].forEach(function (k) {
      var W = wheels[k];
      if (W) W.petals.forEach(function (el, i) { setPetal(el, profile(i)); el.classList.toggle('is-flagged', flags.has(i)); });
    });
    var dockRead = $('[data-dock-read]');
    if (dockRead) dockRead.textContent = n ? n + ' of 10 areas flagged' : '10 areas. One score.';
    var status = $('[data-ledger-status]');
    if (status) status.textContent = n ? n + ' of 10 areas flagged.' + (n === 10 ? ' That\u2019s every area.' : '') : 'Nothing ticked yet.';
    if (clearBtn) clearBtn.hidden = n === 0;
    var sentence = $('[data-flag-sentence]');
    if (sentence) {
      if (n === 0) sentence.textContent = 'Some areas are strong, some are holding the rest back. The BOSS Score shows you which.';
      else if (n <= 3) listSentence(sentence, flaggedNames());
      else sentence.textContent = 'You flagged ' + n + ' of 10 areas. The score measures how big each gap is, across all ten.';
    }
    var cap = $('[data-peak-cap]');
    if (cap) cap.textContent = n ? 'Illustration from your ticks' : 'Example wheel';
    var close = $('[data-flag-close]');
    if (close) close.textContent = n ? 'You flagged ' + n + ' of 10 areas.' : 'Every business has a score.';
    lastPeak = -1;
    if (reduce || !peakAct) paintPeakStatic();
  }

  // -------------------------------------------------------------- hero --
  var hero = $('[data-hero]');
  var heroAct = $('.hero');
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
    var rx = mobile ? 150 : 215, ry = mobile ? 112 : 165;
    var pull = mobile ? 0.45 : 0.9;
    var margin = 14;
    var top = mobile ? 0 : 84;
    H.chips = $$('.chip', hero).map(function (el) {
      el.style.transform = '';
      var visible = getComputedStyle(el).display !== 'none';
      var z = parseFloat(el.style.getPropertyValue('--z')) || 1;
      var near = el.classList.contains('chip--near');
      var s0 = 0.82 + 0.22 * z;
      var sx = el.offsetLeft, sy = el.offsetTop;
      var hw = el.offsetWidth * s0 / 2, hh = el.offsetHeight * s0 / 2;
      var x0 = Math.min(Math.max(sx, margin + hw), H.w - margin - hw);
      var y0 = Math.min(Math.max(sy, top + margin + hh), H.h - margin - hh);
      var vx = x0 - H.cx, vy = y0 - H.cy;
      var d = Math.hypot(vx / rx, vy / ry) || 1;
      var ex = near ? H.cx + vx * 1.22 : d > 1 ? x0 + (H.cx + vx / d - x0) * pull : x0;
      var ey = near ? H.cy + vy * 1.22 : d > 1 ? y0 + (H.cy + vy / d - y0) * pull : y0;
      el.style.filter = near ? 'blur(2.5px)' : z < 0.76 ? 'blur(0.4px)' : '';
      el.style.zIndex = near ? 8 : z < 0.8 ? 2 : 4;
      return { el: el, visible: visible, z: z, near: near, sx: sx, sy: sy, x0: x0, y0: y0, ex: ex, ey: ey, s0: s0, color: el.style.getPropertyValue('--c') };
    });
    [tethers, ringsSvg].forEach(function (s) { s.setAttribute('viewBox', '0 0 ' + H.w + ' ' + H.h); });
    var radii = mobile ? [98, 168, 250] : [120, 215, 330];
    ringsSvg.innerHTML = radii.map(function (r) { return '<circle cx="' + H.cx + '" cy="' + H.cy + '" r="' + r + '"/>'; }).join('');
    tethers.innerHTML = H.chips.map(function (c) { return '<line style="stroke:' + c.color + '"/>'; }).join('');
    H.lines = $$('line', tethers);
    lastHero = -1;
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
    you.style.transform = 'translate3d(' + yx.toFixed(1) + 'px,' + yy.toFixed(1) + 'px,0) scale(' + (1 + 0.08 * e).toFixed(3) + ')';
    ringsSvg.style.transform = 'translate3d(' + (-px * 3).toFixed(1) + 'px,' + (-py * 2).toFixed(1) + 'px,0) scale(' + (1 - 0.06 * e).toFixed(3) + ')';
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
      L.style.opacity = ((0.35 + 0.5 * e) * o).toFixed(3);
    });
    hero.setAttribute('data-sc-verify-state', 'hero:' + Math.round(p * 24));
  }

  // ---------------------------------------------------- old way / new --
  var clarity = $('[data-clarity]');
  var clarityAct = clarity && clarity.closest('[data-sc-act]');
  var scribble = $('[data-scribble]');
  if (scribble) {
    // Seeded so the mess is the same mess on every load.
    var seed = 7;
    var rnd = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    var s = '';
    var loop = function (cx, cy, r, turns, cls) {
      var d = '', n = Math.round(turns * 28);
      for (var i = 0; i <= n; i++) {
        var a = i / 28 * Math.PI * 2, rr = r * (0.82 + rnd() * 0.3);
        d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a) * 1.25).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1);
      }
      s += '<path class="' + (cls || '') + '" d="' + d + '"/>';
    };
    var arrow = function (x0, y0, x1, y1, bend) {
      var mx = (x0 + x1) / 2 + bend, my = (y0 + y1) / 2 - bend * 0.6;
      var ang = Math.atan2(y1 - my, x1 - mx);
      var h1 = [x1 - 14 * Math.cos(ang - 0.5), y1 - 14 * Math.sin(ang - 0.5)], h2 = [x1 - 14 * Math.cos(ang + 0.5), y1 - 14 * Math.sin(ang + 0.5)];
      s += '<path d="M' + x0 + ' ' + y0 + 'Q' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + x1 + ' ' + y1 +
        'M' + h1[0].toFixed(1) + ' ' + h1[1].toFixed(1) + 'L' + x1 + ' ' + y1 + 'L' + h2[0].toFixed(1) + ' ' + h2[1].toFixed(1) + '"/>';
    };
    var tangle = function (x, y, w, hgt) {
      var d = 'M' + x + ' ' + y;
      for (var i = 0; i < 14; i++) d += 'L' + (x + rnd() * w).toFixed(1) + ' ' + (y + rnd() * hgt).toFixed(1);
      s += '<path d="' + d + '"/>';
    };
    loop(300, 250, 92, 2.4);
    loop(118, 170, 40, 1.4, 'red');
    loop(470, 395, 36, 1.3, 'red');
    arrow(170, 80, 260, 190, 40);
    arrow(420, 150, 350, 220, -30);
    arrow(120, 300, 220, 330, 30);
    arrow(460, 300, 390, 290, 20);
    tangle(270, 210, 70, 60);
    tangle(500, 20, 70, 36);
    tangle(40, 420, 60, 40);
    s += '<path d="M60 112 Q 140 104 210 116"/><path d="M340 470 Q 420 458 520 468"/>';
    scribble.innerHTML = s;
  }

  var lastClarity = -1;
  function clarityFrame(p) {
    if (Math.abs(p - lastClarity) < 0.0005) return;
    lastClarity = p;
    var W = wheels.clarity;
    if (!W) return;
    W.petals.forEach(function (el, i) {
      var g = easeOut(clamp01((p - 0.3 - i * 0.012) / 0.2));
      setPetal(el, CLARITY[i] * g);
    });
    var f = clamp01((p - 0.44) / 0.08);
    $$('.focus', clarity).forEach(function (el, n) {
      var t = clamp01(f * 1.6 - n * 0.6);
      el.style.opacity = t.toFixed(3);
      el.style.transform = 'translate3d(' + ((1 - t) * 12).toFixed(1) + 'px,0,0)';
    });
  }
  function paintClarityStatic() {
    var W = wheels.clarity;
    if (!W) return;
    W.petals.forEach(function (el, i) { setPetal(el, CLARITY[i]); });
    $$('.focus', clarity).forEach(function (el) { el.style.opacity = 1; el.style.transform = ''; });
  }

  // -------------------------------------------------------------- peak --
  var peak = $('[data-peak]');
  var peakAct = peak && peak.closest('[data-sc-act]');
  var peakCentre = peak && $('[data-peak-centre]', peak);
  var peakCap = peak && $('[data-peak-cap]', peak);
  var peakGlow = peak && $('.peak__glow', peak);
  var lastPeak = -1;

  function peakVals() { var v = []; for (var i = 0; i < 10; i++) v.push(profile(i)); return v; }

  function paintPeakStatic() {
    var W = wheels.peak;
    if (!W) return;
    var v = peakVals();
    W.svg.style.opacity = 1; W.svg.style.transform = '';
    W.petals.forEach(function (el, i) { setPetal(el, v[i]); });
    setMarks(W, lowestTwo(v), 1);
    if (peakCentre) peakCentre.style.opacity = 1;
    if (peakCap) peakCap.style.opacity = 1;
  }

  // The wheel starts thin and fills as you scroll, the way a business fills
  // in as the owner moves up the levels. The two lowest areas are marked once
  // it has filled.
  function peakFrame(p) {
    if (Math.abs(p - lastPeak) < 0.0005) return;
    lastPeak = p;
    var W = wheels.peak;
    var v = peakVals();
    var fill = easeOut(clamp01(p / 0.72));
    W.svg.style.opacity = '1';
    W.svg.style.transform = 'scale(' + (0.96 + 0.04 * fill).toFixed(3) + ')';
    W.petals.forEach(function (el, i) {
      setPetal(el, Math.max(0.08, v[i] * (0.28 + 0.72 * fill)));
    });
    setMarks(W, lowestTwo(v), clamp01((p - 0.62) / 0.1));
    peakCentre.style.opacity = '1';
    peakCap.style.opacity = clamp01(p / 0.12).toFixed(3);
    peakGlow.style.opacity = (0.55 + 0.45 * fill).toFixed(3);
    peak.setAttribute('data-sc-verify-state', 'peak:' + Math.round(p * 30));
  }

  var ladder = $('[data-ladder]');
  function showBooks(area) {
    if (!ladder) return;
    var names = BOOKS[area] || BOOKS[4];
    ladder.setAttribute('aria-label', AREAS[area].name + ' playbooks, Level 1 to Level 5');
    ladder.innerHTML = names.map(function (name, i) {
      return '<li style="--c:' + LEVELS[i] + '"><span class="ladder__lvl">Level ' + (i + 1) + '</span><b>' + esc(name) + '</b></li>';
    }).join('');
  }
  $$('[data-areas] button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $$('[data-areas] button').forEach(function (b) { b.setAttribute('aria-selected', 'false'); });
      btn.setAttribute('aria-selected', 'true');
      showBooks(+btn.getAttribute('data-area'));
    });
  });
  showBooks(4);

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

  // -------------------------------------------------------------- loop --
  function pinnedP(el) {
    var r = el.getBoundingClientRect();
    return clamp01(-r.top / Math.max(r.height - innerHeight, 1));
  }
  function flowP(el) {
    var r = el.getBoundingClientRect();
    return clamp01((innerHeight - r.top) / (r.height + innerHeight));
  }
  function onScreen(el) { var r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }

  function frame() {
    if (hero && !reduce && onScreen(heroAct)) heroFrame(pinnedP(heroAct));
    if (clarity && !reduce && onScreen(clarityAct)) clarityFrame(flowP(clarityAct));
    if (peak && !reduce && onScreen(peakAct)) peakFrame(pinnedP(peakAct));
    dockFrame();
    requestAnimationFrame(frame);
  }

  paint();
  layoutHero();
  if (reduce) { paintPeakStatic(); paintClarityStatic(); }
  var rz;
  addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(layoutHero, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutHero);
  requestAnimationFrame(frame);
})();
