/* The Profit Coach · interactive 50-playbook wheel. The wheel is drawn by
   scripts/site-v3/build-assets.mjs (same geometry as the print pack's banded
   map) and is pointer-only; the panel beside it (area stepper and the five
   level rows) is the accessible control. Markup: [data-pbw] with
   [data-pbw-wheel], [data-pbw-prev], [data-pbw-next], [data-pbw-pillar],
   [data-pbw-count], [data-pbw-area] and [data-pbw-ladder]. */
(function () {
  'use strict';

  var D = window.PC_PLAYBOOK_WHEEL;
  if (!D) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PILLAR = { foundation: 'Foundation', vision: 'Vision', velocity: 'Velocity', value: 'Value' };
  var ARROW = '<svg class="btn__arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"/></svg>';

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function find(area, level) {
    for (var i = 0; i < D.books.length; i++) if (D.books[i].area === area && D.books[i].level === level) return D.books[i];
    return null;
  }

  // textPath ids must be unique on the page if the wheel appears twice (ids only, never class names).
  function svgFor(prefix) { return prefix ? D.svg.replace(/pbw-(c\d|ab\d|pb-)/g, prefix + '-$1') : D.svg; }

  function rise(svg) {
    if (reduce || !('IntersectionObserver' in window)) { svg.classList.add('is-in'); return; }
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      svg.classList.add('is-in');
      io.disconnect();
    }, { threshold: 0.15 });
    io.observe(svg);
  }

  // The hero arc: the same wheel, not interactive, rings filling outwards on arrival.
  Array.prototype.forEach.call(document.querySelectorAll('[data-pbw-arc]'), function (host, n) {
    host.innerHTML = svgFor('pbwa' + n);
    var svg = host.querySelector('svg');
    svg.classList.add('pbw-svg--static');
    rise(svg);
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-pbw]'), mount);

  function mount(root, n) {
    var wheel = root.querySelector('[data-pbw-wheel]');
    wheel.innerHTML = svgFor(n ? 'pbw' + n : '');
    var svg = wheel.querySelector('svg');
    var cells = Array.prototype.slice.call(wheel.querySelectorAll('.pbw-cell'));
    var bands = Array.prototype.slice.call(wheel.querySelectorAll('.pbw-area'));
    var ladder = root.querySelector('[data-pbw-ladder]');
    var areaName = root.querySelector('[data-pbw-area]');
    var pillar = root.querySelector('[data-pbw-pillar]');
    var count = root.querySelector('[data-pbw-count]');
    var start = (root.getAttribute('data-start') || '1.4').split('.');
    var state = { level: +start[0], area: +start[1] };

    function paint(focusRow) {
      cells.forEach(function (c) {
        var a = +c.getAttribute('data-area'), l = +c.getAttribute('data-level');
        c.classList.toggle('is-area', a === state.area);
        c.classList.toggle('is-on', a === state.area && l === state.level);
      });
      bands.forEach(function (b) { b.classList.toggle('is-on', +b.getAttribute('data-area') === state.area); });

      var area = D.areas[state.area];
      root.style.setProperty('--pbw-area', area.color);
      pillar.textContent = PILLAR[area.pillar];
      count.textContent = 'Area ' + (state.area + 1) + ' of 10';
      areaName.textContent = area.name;

      ladder.innerHTML = D.levels.map(function (lv) {
        var b = find(state.area, lv.level);
        var on = lv.level === state.level;
        return '<li class="pbw-row' + (on ? ' is-on' : '') + '" style="--c:' + lv.color + ';--p:' + lv.pastel + '">' +
          '<button type="button" aria-expanded="' + on + '" aria-controls="pbw-more-' + n + '-' + lv.level + '" data-level="' + lv.level + '">' +
          '<span class="pbw-row__lvl">Level ' + lv.level + '<i>' + esc(lv.name) + '</i></span>' +
          '<span class="pbw-row__name">' + esc(b.name) + '</span>' +
          '<span class="pbw-row__ref">' + b.ref + '</span></button>' +
          '<div class="pbw-row__more" id="pbw-more-' + n + '-' + lv.level + '"' + (on ? '' : ' hidden') + '>' +
          '<p>' + esc(b.summary) + '</p>' +
          '<a class="link" href="/playbooks/' + b.ref + '" aria-label="Open the ' + esc(b.name) + ' playbook">Open the playbook' + ARROW + '</a></div></li>';
      }).join('');
      if (focusRow) {
        var btn = ladder.querySelector('[data-level="' + state.level + '"]');
        if (btn) btn.focus();
      }
    }

    function go(area, level, focusRow) {
      state.area = (area + 10) % 10;
      if (level) state.level = level;
      paint(focusRow);
    }

    ladder.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-level]');
      if (btn) go(state.area, +btn.getAttribute('data-level'), true);
    });
    ladder.addEventListener('keydown', function (e) {
      var btn = e.target.closest('button[data-level]');
      if (!btn) return;
      var lv = +btn.getAttribute('data-level');
      if (e.key === 'ArrowDown' && lv < 5) { e.preventDefault(); go(state.area, lv + 1, true); }
      if (e.key === 'ArrowUp' && lv > 1) { e.preventDefault(); go(state.area, lv - 1, true); }
    });
    root.querySelector('[data-pbw-prev]').addEventListener('click', function () { go(state.area - 1); });
    root.querySelector('[data-pbw-next]').addEventListener('click', function () { go(state.area + 1); });

    cells.forEach(function (c) {
      c.addEventListener('click', function () { go(+c.getAttribute('data-area'), +c.getAttribute('data-level')); });
    });
    bands.forEach(function (b) {
      b.addEventListener('click', function () { go(+b.getAttribute('data-area')); });
    });

    paint(false);
    // The rings fill from Level 1 outwards the first time the wheel comes into view.
    rise(svg);
  }
})();
