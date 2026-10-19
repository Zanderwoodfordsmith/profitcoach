/* Profit System scroll. Pillars open into nine steps. */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

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


  function onScreen(el) {
    var r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  }
  function frame() {
    if (levelsAct && onScreen(levelsAct)) levelsFrame(reduce ? 1 : pinnedP(levelsAct));
    if (triadAct && onScreen(triadAct)) triadFrame(reduce ? 1 : pinnedP(triadAct));
    requestAnimationFrame(frame);
  }
  levelsFrame(reduce ? 1 : 0);
  triadFrame(reduce ? 1 : 0);
  requestAnimationFrame(frame);
})();
