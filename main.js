(function () {
  'use strict';
  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Theme ---------- */
  function currentTheme() {
    var set = root.getAttribute('data-theme');
    if (set) return set;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.getElementById('themeToggle').addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    readColors();
  });

  /* ---------- Footer year ---------- */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  /* ---------- Nav: border + active link ---------- */
  var nav = document.querySelector('.nav');
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav__links a'));
  var sections = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });

  function onScroll() {
    nav.classList.toggle('is-scrolled', window.scrollY > 8);
    var mark = window.innerHeight * 0.35;
    var active = -1;
    sections.forEach(function (s, i) { if (s && s.getBoundingClientRect().top <= mark) active = i; });
    links.forEach(function (a, i) { a.classList.toggle('is-active', i === active); });
    updateTimeline();
  }

  /* ---------- Timeline progress ---------- */
  var timeline = document.getElementById('timeline');
  var fill = document.getElementById('timelineFill');
  var items = Array.prototype.slice.call(document.querySelectorAll('.tl'));
  function updateTimeline() {
    if (!timeline || !fill) return;
    var r = timeline.getBoundingClientRect();
    var mark = window.innerHeight * 0.6;
    var pct = Math.max(0, Math.min(1, (mark - r.top) / r.height));
    fill.style.height = (pct * 100) + '%';
    items.forEach(function (li) {
      var node = li.querySelector('.tl__node');
      li.classList.toggle('is-passed', node.getBoundingClientRect().top < mark);
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------- Reveal on scroll ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- Project filters ---------- */
  var chips = document.querySelectorAll('.chip');
  var projects = document.querySelectorAll('.project');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.getAttribute('data-filter');
      chips.forEach(function (c) { c.classList.toggle('is-active', c === chip); c.setAttribute('aria-pressed', c === chip); });
      projects.forEach(function (p) {
        var cats = p.getAttribute('data-cat').split(' ');
        var show = f === 'all' || cats.indexOf(f) !== -1;
        p.classList.toggle('is-hidden', !show);
        if (show) p.classList.add('is-in');
      });
    });
  });

  /* ---------- Hero: a tracked ball ----------
     A ball bounces across the hero. A detection box follows it; while the ball
     passes behind the "occluder" the box goes dashed and is carried by optical
     flow (a nod to the tennis tracker). */
  var canvas = document.getElementById('tracker');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, dpr = 1;
  var colors = {};

  function readColors() {
    var cs = getComputedStyle(root);
    colors.track = cs.getPropertyValue('--track').trim() || '#c8ee4a';
    colors.muted = cs.getPropertyValue('--muted').trim() || '#999';
    colors.border = cs.getPropertyValue('--border').trim() || '#333';
    colors.bg = cs.getPropertyValue('--bg').trim() || '#000';
    colors.live = cs.getPropertyValue('--live').trim() || '#f60';
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
    trail = [];
  }

  var trail = [];
  var t0 = performance.now();
  var PERIOD = 9000; // ms for one pass across the screen

  var titleEl = document.querySelector('.hero__title');
  var x0 = 0, narrow = false;
  function layout() {
    // keep the ball's path clear of the hero text on wide screens
    var cr = canvas.getBoundingClientRect();
    var right = titleEl ? titleEl.getBoundingClientRect().right - cr.left : W * 0.5;
    x0 = right + 48;
    narrow = (W * 0.98 - x0) < 300;
    if (narrow) x0 = W * 0.04;
  }

  function ballAt(ms) {
    var p = (ms % PERIOD) / PERIOD;              // 0..1 across
    var x = x0 + (W * 0.98 - x0) * p;
    var floor = H * (narrow ? 0.92 : 0.8);
    var top = H * (narrow ? 0.66 : 0.18);
    var bounces = 3;
    var phase = Math.abs(Math.sin(p * Math.PI * bounces));
    var decay = 1 - p * 0.45;
    var y = floor - (floor - top) * phase * decay;
    return { x: x, y: y, p: p };
  }

  function occluder() {
    // a detected "person" the ball can pass behind
    var w = narrow ? 34 : 56;
    var h = H * (narrow ? 0.2 : 0.34);
    var x = x0 + (W * 0.98 - x0) * 0.6;
    var floor = H * (narrow ? 0.92 : 0.8);
    return { x: x, w: w, top: floor - h + 12, h: h };
  }

  function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function draw(now) {
    var ms = now - t0;
    var b = ballAt(ms);
    if (trail.length && b.x < trail[trail.length - 1].x) trail = []; // wrapped
    trail.push(b);
    if (trail.length > 46) trail.shift();

    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = narrow ? 0.45 : 1;

    var occ = occluder();
    var hidden = b.x > occ.x - 4 && b.x < occ.x + occ.w + 4 && b.y > occ.top - 4;

    // trajectory trail
    for (var i = 0; i < trail.length - 1; i += 2) {
      var a = i / trail.length;
      ctx.fillStyle = colors.track;
      ctx.globalAlpha = (narrow ? 0.45 : 1) * a * 0.55;
      ctx.beginPath(); ctx.arc(trail[i].x, trail[i].y, 1.6 + a * 1.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = narrow ? 0.45 : 1;

    // ball
    var r = 9;
    ctx.fillStyle = colors.track;
    ctx.globalAlpha = (narrow ? 0.45 : 1) * (hidden ? 0.18 : 0.95);
    ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = narrow ? 0.45 : 1;

    // occluder: a simple player silhouette with its own detection box
    var base = narrow ? 0.45 : 1;
    var cx = occ.x + occ.w / 2, hr = occ.w * 0.22;
    ctx.fillStyle = colors.border;
    ctx.globalAlpha = base * 0.95;
    ctx.beginPath(); ctx.arc(cx, occ.top + hr + 4, hr, 0, Math.PI * 2); ctx.fill();          // head
    roundRectPath(occ.x + occ.w * 0.12, occ.top + hr * 2 + 8, occ.w * 0.76, occ.h - hr * 2 - 20, occ.w * 0.2); ctx.fill(); // body
    ctx.globalAlpha = base * 0.7;
    ctx.strokeStyle = colors.muted; ctx.lineWidth = 1;
    ctx.strokeRect(occ.x - 6, occ.top - 2, occ.w + 12, occ.h);
    if (!narrow) {
      ctx.font = '400 10px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillStyle = colors.muted;
      ctx.fillText('person #02 0.91', occ.x - 6, occ.top - 7);
    }
    ctx.globalAlpha = base;

    // detection box
    var jitter = hidden ? 0 : Math.sin(ms / 90) * 1.2;
    var bw = 34 + jitter, bh = 34 - jitter;
    var bx = b.x - bw / 2, by = b.y - bh / 2;
    ctx.strokeStyle = colors.track;
    ctx.lineWidth = 1.6;
    ctx.setLineDash(hidden ? [5, 4] : []);
    ctx.strokeRect(bx, by, bw, bh);
    ctx.setLineDash([]);

    // label
    var conf = hidden ? 'flow' : (0.93 + 0.05 * Math.abs(Math.sin(ms / 700))).toFixed(2);
    var label = 'ball #07 ' + conf;
    ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace';
    var tw = ctx.measureText(label).width + 10;
    ctx.fillStyle = colors.track;
    ctx.fillRect(bx - 0.8, by - 17, tw, 16);
    ctx.fillStyle = colors.bg;
    ctx.fillText(label, bx + 4, by - 5);

    // speed readout
    if (!narrow) {
      var prev = trail[Math.max(0, trail.length - 6)];
      var v = Math.hypot(b.x - prev.x, b.y - prev.y);
      ctx.fillStyle = colors.muted;
      ctx.font = '400 10px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillText((v * 4.1).toFixed(0) + ' km/h', bx + bw + 6, by + bh);
    }
    ctx.globalAlpha = 1;
  }

  readColors();
  resize();
  window.addEventListener('resize', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layout(); trail = []; });
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (mq.addEventListener) mq.addEventListener('change', readColors);

  if (reduceMotion) {
    // static frame: fill a trail and draw once
    for (var k = 0; k < 46; k++) trail.push(ballAt(PERIOD * 0.42 - (46 - k) * 30));
    draw(t0 + PERIOD * 0.42);
  } else {
    // pause when hero is off-screen to save battery
    var running = false, rafId = 0;
    function tick(now) { draw(now); rafId = requestAnimationFrame(tick); }
    var heroIO = new IntersectionObserver(function (e) {
      if (e[0].isIntersecting && !running) { running = true; rafId = requestAnimationFrame(tick); }
      else if (!e[0].isIntersecting && running) { running = false; cancelAnimationFrame(rafId); }
    });
    heroIO.observe(canvas);
  }
})();
