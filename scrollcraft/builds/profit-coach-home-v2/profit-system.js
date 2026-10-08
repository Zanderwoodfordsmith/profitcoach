/* Profit System scroll. Pillars open into nine steps. Playbooks advance by area. */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COLORS = ['#4C667A', '#093A6D', '#0C5290', '#3D7AB8', '#2E8AD8', '#42A1EE', '#7FC8F5', '#157A96', '#1CA0C2', '#5DCCE3'];
  var LEVELS = ['#DC2626', '#F97316', '#EAB308', '#16A34A', '#0B5191'];
  var AREAS = ['Owner Performance', 'Aligned Vision', 'Defined Strategy', 'Disciplined Planning', 'Profit & Cash Flow', 'Revenue & Marketing', 'Operations & Delivery', 'Financials & Metrics', 'Infrastructure & Systems', 'Team & Leadership'];
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

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function pinnedP(el) {
    var r = el.getBoundingClientRect();
    return clamp01(-r.top / Math.max(r.height - innerHeight, 1));
  }

  var levels = $('[data-levels]');
  var levelsAct = levels && levels.closest('[data-sc-act]');
  var bars = $$('.rise__bar');
  function levelsFrame(p) {
    var g = reduce ? 1 : ease(clamp01(p / 0.85));
    bars.forEach(function (bar, i) {
      var delay = i * 0.08;
      var local = reduce ? 1 : ease(clamp01((g - delay) / 0.55));
      bar.style.setProperty('--grow', String(0.12 + 0.88 * local));
    });
  }

  var triad = $('[data-triad]');
  var triadAct = triad && triad.closest('[data-sc-act]');
  var hexes = {
    vision: $('[data-hex="vision"]'),
    value: $('[data-hex="value"]'),
    velocity: $('[data-hex="velocity"]')
  };
  var gap = $('[data-gap]');
  var steps = $('[data-steps]');
  var own = $('[data-own]');

  function triadFrame(p) {
    var arrive = reduce ? 1 : 0.4 + 0.6 * ease(clamp01(p / 0.14));
    var gapT = reduce ? 0 : ease(clamp01((p - 0.36) / 0.1)) * (1 - ease(clamp01((p - 0.56) / 0.08)));
    var open = reduce ? 1 : ease(clamp01((p - 0.58) / 0.22));
    Object.keys(hexes).forEach(function (k) {
      var el = hexes[k];
      var dim = k === 'velocity' ? 1 - 0.82 * gapT : 1;
      el.style.opacity = String(arrive * (1 - open) * dim);
      el.style.transform = 'scale(' + (0.86 + 0.14 * arrive).toFixed(3) + ')';
    });
    if (gap) gap.style.opacity = String(gapT * (1 - open));
    if (steps) {
      steps.style.opacity = String(open);
      steps.style.transform = 'translateY(' + ((1 - open) * 16).toFixed(1) + 'px)';
    }
    if (own) own.style.opacity = String(ease(clamp01((open - 0.45) / 0.4)));
    triad.setAttribute('data-sc-verify-state', 'triad:' + Math.round(p * 20));
  }

  var wheelHost = $('[data-wheel]');
  if (wheelHost) {
    var parts = COLORS.map(function (c, i) {
      var a0 = (-90 + i * 36) * Math.PI / 180;
      var a1 = (-90 + (i + 1) * 36) * Math.PI / 180;
      var r = 118 + ((i * 17) % 5) * 16;
      var x0 = 150 + r * Math.cos(a0), y0 = 150 + r * Math.sin(a0);
      var x1 = 150 + r * Math.cos(a1), y1 = 150 + r * Math.sin(a1);
      return '<path fill="' + c + '" d="M150 150 L' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A' + r + ' ' + r + ' 0 0 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' Z"/>';
    }).join('');
    wheelHost.innerHTML = '<svg viewBox="0 0 300 300" aria-hidden="true">' + parts + '<circle cx="150" cy="150" r="36" fill="#051E36"/></svg>';
  }

  var books = $('[data-books]');
  var booksAct = books && books.closest('[data-sc-act]');
  var shelfName = $('[data-shelf-name]');
  var shelfMeta = $('[data-shelf-meta]');
  var shelfList = $('[data-shelf-list]');
  var rail = $('[data-rail]');
  if (rail) rail.innerHTML = AREAS.map(function () { return '<i></i>'; }).join('');
  var lastArea = -1;
  function booksFrame(p) {
    var idx = Math.min(9, Math.floor(clamp01(p) * 10));
    if (idx === lastArea && !reduce) return;
    lastArea = idx;
    if (shelfName) shelfName.textContent = AREAS[idx];
    if (shelfMeta) shelfMeta.textContent = 'Area ' + (idx + 1) + ' of 10';
    if (shelfList) {
      shelfList.innerHTML = BOOKS[idx].map(function (name, n) {
        return '<li style="--c:' + LEVELS[n] + '"><em>Level ' + (n + 1) + '</em><b>' + name + '</b></li>';
      }).join('');
    }
    $$('[data-rail] i').forEach(function (mark, n) { mark.classList.toggle('is-on', n <= idx); });
  }

  function onScreen(el) {
    var r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  }
  function frame() {
    if (levelsAct && onScreen(levelsAct)) levelsFrame(reduce ? 1 : pinnedP(levelsAct));
    if (triadAct && onScreen(triadAct)) triadFrame(reduce ? 1 : pinnedP(triadAct));
    if (booksAct && onScreen(booksAct)) booksFrame(reduce ? 0.45 : pinnedP(booksAct));
    requestAnimationFrame(frame);
  }
  levelsFrame(reduce ? 1 : 0);
  triadFrame(reduce ? 1 : 0);
  booksFrame(reduce ? 0.45 : 0);
  requestAnimationFrame(frame);
})();
