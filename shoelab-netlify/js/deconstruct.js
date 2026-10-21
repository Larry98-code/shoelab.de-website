/* ShoeLab — "Deconstructed".
 *
 * One sneaker, shot in pieces, reassembling as you scroll. A different pair
 * every visit. The layer images were cut from the studio photography; each
 * entry below is [file, x, y, width, height] in the coordinate space of the
 * original frame, so the exploded state is exactly where the photographer
 * put it. The first layer of every pair must be the WHOLE sneaker, sole
 * included: the scroll ends with the parts dissolving into it. */
(function (w, d) {
  'use strict';

  var BASE = '/img/deconstruct/';
  var SHOES = [{"id":"nb9060-black","label":"New Balance 9060","sub":"Premium Suede","w":1193,"h":995,"l":[["nb9060-black-0.webp",160,26,872,409],["nb9060-black-1.webp",176,444,837,104],["nb9060-black-2.webp",160,542,880,155],["nb9060-black-3.webp",163,691,868,118],["nb9060-black-4.webp",160,802,874,181]]},{"id":"nb880","label":"New Balance 880","sub":"Fresh Foam X","w":676,"h":1024,"l":[["nb880-0.webp",28,59,642,324],["nb880-1.webp",44,403,612,109],["nb880-2.webp",25,505,644,145],["nb880-3.webp",27,643,637,296]]},{"id":"nb1080","label":"New Balance 1080","sub":"Fresh Foam X","w":676,"h":1024,"l":[["nb1080-0.webp",0,61,643,332],["nb1080-1.webp",0,418,649,236],["nb1080-2.webp",0,647,640,112],["nb1080-3.webp",0,752,644,221]]},{"id":"nb9060-blk2","label":"New Balance 9060","sub":"Black / Silver","w":676,"h":1024,"l":[["nb9060-blk2-0.webp",36,77,627,291],["nb9060-blk2-1.webp",55,397,570,83],["nb9060-blk2-2.webp",52,486,572,100],["nb9060-blk2-3.webp",44,579,606,206],["nb9060-blk2-4.webp",23,798,647,152]]},{"id":"jordan1","label":"Air Jordan 1 Low","sub":"Panda","w":676,"h":1024,"l":[["jordan1-0.webp",0,49,579,308],["jordan1-1.webp",3,394,575,93],["jordan1-2.webp",0,496,587,109],["jordan1-3.webp",2,618,584,87],["jordan1-4.webp",11,724,573,79],["jordan1-5.webp",0,825,602,150]]}];

  var LAST_KEY = 'shoelab_dc_last';
  var HERO_END = 1.07;                   // the whole shoe grows this much on the final beat
  var reduce = false;
  try { reduce = w.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ── copy, per chapter ──────────────────────────────────────────── */
  var COPY = {
    en: [['Anatomy', 'Every sneaker is engineering. Scroll to put this one back together.'],
         ['Layer by layer', 'Foam, plate, airbag, rubber — each one needs a different touch.'],
         ['So we take it seriously', 'We clean what sits under there too. Bring your pair to the lab.']],
    de: [['Anatomie', 'Jeder Sneaker ist Technik. Scrolle und setz ihn wieder zusammen.'],
         ['Schicht für Schicht', 'Schaum, Platte, Luftkammer, Gummi — jedes Teil braucht etwas anderes.'],
         ['Darum nehmen wir es genau', 'Wir reinigen auch das, was darunter liegt. Bring dein Paar ins Lab.']],
    pl: [['Anatomia', 'Każdy sneaker to inżynieria. Przewiń i złóż go z powrotem.'],
         ['Warstwa po warstwie', 'Pianka, płyta, poduszka, guma — każda część wymaga czego innego.'],
         ['Dlatego robimy to dokładnie', 'Czyścimy też to, co jest pod spodem. Przynieś swoją parę do labu.']],
    ru: [['Анатомия', 'Каждый сникер — это инженерия. Листай и собери его обратно.'],
         ['Слой за слоем', 'Пена, пластина, амортизатор, резина — каждому нужен свой подход.'],
         ['Поэтому мы так внимательны', 'Мы чистим и то, что внутри. Привези свою пару в лаб.']],
    uk: [['Анатомія', 'Кожен сникер — це інженерія. Гортай і збери його назад.'],
         ['Шар за шаром', 'Піна, пластина, амортизатор, гума — кожному потрібен свій підхід.'],
         ['Тому ми такі уважні', 'Ми чистимо й те, що всередині. Привези свою пару в лаб.']],
    it: [['Anatomia', 'Ogni sneaker è ingegneria. Scorri e rimettila insieme.'],
         ['Strato dopo strato', 'Schiuma, piastra, camera d\'aria, gomma — ognuno vuole un trattamento diverso.'],
         ['Per questo ci mettiamo cura', 'Puliamo anche quello che sta sotto. Porta il tuo paio in laboratorio.']],
    es: [['Anatomía', 'Cada zapatilla es ingeniería. Desplázate y vuelve a montarla.'],
         ['Capa a capa', 'Espuma, placa, cámara de aire, goma — cada una pide algo distinto.'],
         ['Por eso lo hacemos con cuidado', 'También limpiamos lo que hay debajo. Trae tu par al laboratorio.']],
    fr: [['Anatomie', 'Chaque sneaker est de l\'ingénierie. Fais défiler pour la reconstruire.'],
         ['Couche après couche', 'Mousse, plaque, coussin d\'air, gomme — chacune demande un geste différent.'],
         ['C\'est pourquoi on y met du soin', 'On nettoie aussi ce qu\'il y a dessous. Apporte ta paire au lab.']]
  };
  function copyFor(lang) { return COPY[lang] || COPY.en; }
  function curLang() {
    var l = (d.documentElement.lang || 'en').slice(0, 2).toLowerCase();
    return COPY[l] ? l : 'en';
  }

  /* ── maths ──────────────────────────────────────────────────────── */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  // slow in, slow out — the parts should feel heavy, not snappy
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* A shuffled queue rather than a coin flip: over a few visits you see
     every pair, in a random order, and never the same one twice in a row.
     Pure Math.random() repeats far too often to feel curated. */
  var QUEUE_KEY = 'shoelab_dc_queue';

  function shuffled(ids) {
    var a = ids.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pickShoe() {
    // ?dc=<id> pins a specific pair — handy for previewing one of them
    try {
      var q = (w.location.search || '').match(/[?&]dc=([\w-]+)/);
      if (q) {
        var forced = SHOES.filter(function (s) { return s.id === q[1]; })[0];
        if (forced) { pinned = true; return forced; }
      }
    } catch (e) {}

    var ids = SHOES.map(function (s) { return s.id; });
    var queue = [];
    var last = null;
    try {
      queue = JSON.parse(w.localStorage.getItem(QUEUE_KEY) || '[]') || [];
      last = w.localStorage.getItem(LAST_KEY);
    } catch (e) {}
    if (!Array.isArray(queue)) queue = [];
    queue = queue.filter(function (id) { return ids.indexOf(id) !== -1; });

    if (!queue.length) {
      queue = shuffled(ids);
      // don't open a fresh round on the pair they just saw
      if (last && queue[0] === last && queue.length > 1) {
        queue[0] = queue[1]; queue[1] = last;
      }
    }

    var id = queue.shift();
    try {
      w.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      w.localStorage.setItem(LAST_KEY, id);
    } catch (e) {}

    return SHOES.filter(function (s) { return s.id === id; })[0] || SHOES[0];
  }

  /* ── build ──────────────────────────────────────────────────────── */
  var root, stage, shoeBox, els = [], shoe, geom = null, raf = 0, lastP = -1;

  // Auto-advance. tx is the transition: 0 = settled, 1 = blown apart and
  // gone. The outgoing pair explodes to 1, the next is built at 1 and
  // reassembles to 0, all at whatever point of the scroll the visitor is at.
  var AUTO_MS = 8000;
  var tx = 0, swapping = false, timer = 0, lastScroll = 0, visible = true, pinned = false;
  var ring = [], ringAt = 0;
  var copyEls = {}, chapter = -1;

  function buildShoe(s) {
    shoe = s;
    shoeBox.innerHTML = '';
    els = [];
    s.l.forEach(function (L, i) {
      var div = d.createElement('div');
      div.className = 'dc-layer';
      var img = d.createElement('img');
      img.src = BASE + L[0];
      img.alt = '';                      // decorative; the label carries meaning
      img.decoding = 'async';
      img.draggable = false;
      // the first layer is the hero frame — load it eagerly, rest can wait
      img.loading = i === 0 ? 'eager' : 'lazy';
      div.appendChild(img);
      // the whole shoe sits above its parts
      div.style.zIndex = String(100 - i);
      div.style.transformOrigin = '50% 50%';
      shoeBox.appendChild(div);
      els.push(div);
    });
    geom = null;
    measure();
    render(lastP < 0 ? 0 : lastP, true);
  }

  /* Work out where every layer sits when exploded and when assembled.
     Both states share ONE scale: if each were fitted to the viewport
     separately, the stack would shrink its gaps and grow its scale at the
     same time and nothing would appear to move. */
  function measure() {
    if (!shoe) return;
    var boxW = shoeBox.clientWidth;
    var vh = w.innerHeight;
    var k = boxW / shoe.w;               // photo space -> screen space

    var hs = shoe.l.map(function (L) { return L[4] * k; });
    var ws = shoe.l.map(function (L) { return L[3] * k; });
    var cx = shoe.l.map(function (L) { return (L[1] + L[3] / 2) * k - boxW / 2; });

    // exploded: the positions straight off the photograph, pushed a little
    // further apart so the gaps still read on a wide screen
    var EXTRA = Math.min(30, vh * 0.026);
    var eTop = shoe.l.map(function (L, j) { return L[2] * k + EXTRA * j; });
    var e0 = eTop[0];
    var eH = eTop[eTop.length - 1] + hs[hs.length - 1] - e0;

    // assembled: every part nested into the one above it
    var OVERLAP = 0.34;
    var aTop = [0];
    for (var i = 1; i < hs.length; i++) aTop[i] = aTop[i - 1] + hs[i - 1] * OVERLAP;
    var aH = aTop[hs.length - 1] + hs[hs.length - 1];

    // centre offsets, so scaling never drags a part off its mark
    var eCen = hs.map(function (h, j) { return (eTop[j] + h / 2) - (e0 + eH / 2); });
    var aCen = hs.map(function (h, j) { return (aTop[j] + h / 2) - aH / 2; });

    var base = Math.min(1, (vh * 0.86) / eH);
    // a gentle push-in as it locks together, capped so it still fits
    var push = Math.min(1.12, (vh * 0.90) / (aH * base));
    if (!isFinite(push) || push < 1) push = 1;
    // ...and so the finished shoe, heel to toe, stays on screen: on a phone
    // the push-in (and the hero's last 7%) would carry it past the edges
    var r = shoeBox.getBoundingClientRect(), vw = d.documentElement.clientWidth || w.innerWidth;
    var mid = r.left + r.width / 2, margin = Math.max(10, vw * 0.035), half = ws[0] * HERO_END / 2;
    var fitR = cx[0] + half > 0 ? (vw - margin - mid) / (cx[0] + half) : Infinity;
    var fitL = half - cx[0] > 0 ? (mid - margin) / (half - cx[0]) : Infinity;
    var fit = Math.min(fitR, fitL) / base;
    if (isFinite(fit) && fit > 0) push = Math.min(push, fit);

    els.forEach(function (el, j) { el.style.width = ws[j].toFixed(1) + 'px'; });

    geom = { hs: hs, ws: ws, cx: cx, eCen: eCen, aCen: aCen, base: base, push: push };
  }

  function render(p, force) {
    if (!geom || (!force && p === lastP)) return;
    lastP = p;
    var n = shoe.l.length, g = geom;
    root.style.setProperty('--p', p.toFixed(4));

    var ep = ease(p);
    var posScale = g.base * lerp(1, g.push, ep);

    for (var i = 0; i < n; i++) {
      // parts dock in order, closest to the shoe first
      var delay = n > 1 && i > 0 ? (i - 1) / Math.max(1, n - 1) * 0.28 : 0;
      var pi = clamp((p - delay) / (1 - 0.28), 0, 1);
      var e = ease(pi);

      var yc = lerp(g.eCen[i], g.aCen[i], e) * posScale;
      var sgn = i % 2 ? 1 : -1;
      var drift = i === 0 ? 0 : sgn * (22 + i * 9) * (1 - e);
      var xc = (g.cx[i] + drift) * posScale;

      var rot = (i === 0 ? 0 : sgn * (2.4 + i * 0.6)) * (1 - e);
      var sc = posScale * lerp(0.95, 1, e);
      var blur = (i === 0 ? 0 : i * 0.9) * (1 - e);
      var op = lerp(i === 0 ? 0.88 : 0.46, 1, Math.min(1, e * 1.3));

      // Final beat: the parts slide up behind the upper and dissolve into it,
      // so the scroll ends on one whole sneaker rather than a tidy stack.
      var mp = clamp((p - 0.84) / 0.16, 0, 1);
      if (mp > 0) {
        var m = ease(mp);
        if (i === 0) {
          sc *= lerp(1, HERO_END, m);      // hero pushes forward
        } else {
          yc -= g.hs[0] * 0.46 * m * posScale;
          op *= (1 - m);              // all the way out, or they read as smudges
          sc *= lerp(1, 0.96, m);
        }
      }

      if (tx > 0) {
        // blow apart away from the middle of the stack, drift, soften, fade
        var away = i - (n - 1) / 2;
        yc += away * (70 + 18 * n) * tx * posScale;
        xc += sgn * 46 * tx * posScale;
        rot += sgn * 9 * tx;
        sc *= 1 - 0.14 * tx;
        blur += 16 * tx;
        op *= 1 - tx;
      }

      var el = els[i];
      el.style.transform =
        'translate3d(' + (xc - g.ws[i] / 2).toFixed(2) + 'px,' +
                         (yc - g.hs[i] / 2).toFixed(2) + 'px,0)' +
        ' scale(' + sc.toFixed(4) + ') rotate(' + rot.toFixed(2) + 'deg)';
      el.style.opacity = op.toFixed(3);
      el.style.filter = blur > 0.05 ? 'blur(' + blur.toFixed(2) + 'px)' : '';
    }

    var sweep = d.getElementById('dcSweep');
    if (sweep) {
      var sp = clamp((p - 0.6) / 0.32, 0, 1);
      sweep.style.setProperty('--sx', (-40 + sp * 180) + '%');
      sweep.style.setProperty('--so', (sp > 0 && sp < 1 ? Math.sin(sp * Math.PI) : 0).toFixed(3));
    }

    var hint = d.getElementById('dcHint');
    if (hint) hint.style.opacity = p > 0.04 ? '0' : '1';

    var ch = p < 0.3 ? 0 : p < 0.66 ? 1 : 2;
    if (ch !== chapter) { chapter = ch; paintCopy(); }
  }

  function paintCopy() {
    var c = copyFor(curLang())[chapter < 0 ? 0 : chapter];
    if (!c || !copyEls.kicker) return;
    [copyEls.kicker, copyEls.line].forEach(function (el) { el.classList.add('out'); });
    setTimeout(function () {
      copyEls.kicker.textContent = c[0];
      copyEls.line.textContent = c[1];
      [copyEls.kicker, copyEls.line].forEach(function (el) { el.classList.remove('out'); });
    }, 220);
  }

  /* ── scroll ─────────────────────────────────────────────────────── */
  function onScroll() {
    lastScroll = Date.now();
    if (raf) return;
    raf = w.requestAnimationFrame(function () {
      raf = 0;
      var r = root.getBoundingClientRect();
      var travel = root.offsetHeight - w.innerHeight;
      var p = travel > 0 ? clamp(-r.top / travel, 0, 1) : 1;
      render(p);
    });
  }

  /* ── auto-advance ───────────────────────────────────────────────── */
  function preload(s) {
    return Promise.all(s.l.map(function (L) {
      return new Promise(function (res) {
        var im = new Image();
        im.onload = im.onerror = function () { res(); };
        im.src = BASE + L[0];
      });
    }));
  }

  function tween(from, to, ms, easeFn, done) {
    var t0 = 0;
    function step(now) {
      if (!t0) t0 = now;
      var k = Math.min(1, (now - t0) / ms);
      tx = from + (to - from) * easeFn(k);
      render(lastP < 0 ? 0 : lastP, true);
      if (k < 1) w.requestAnimationFrame(step); else if (done) done();
    }
    w.requestAnimationFrame(step);
  }
  function easeIn(k) { return k * k * k; }
  function easeOut(k) { return 1 - Math.pow(1 - k, 3); }

  function schedule(ms) {
    clearTimeout(timer);
    if (pinned || reduce || !visible || d.hidden) return;
    timer = setTimeout(advance, ms == null ? AUTO_MS : ms);
  }

  function advance() {
    if (swapping || !visible || d.hidden) return;
    // never change the pair under someone's thumb mid-scroll
    if (Date.now() - lastScroll < 900) { schedule(450); return; }
    ringAt = (ringAt + 1) % ring.length;
    var nxt = ring[ringAt];
    swapping = true;
    preload(nxt).then(function () {
      tween(0, 1, 560, easeIn, function () {
        buildShoe(nxt);
        tween(1, 0, 950, easeOut, function () { swapping = false; schedule(); });
      });
    });
  }

  /* ── init ───────────────────────────────────────────────────────── */
  function init() {
    root = d.getElementById('deconstruct');
    if (!root || !SHOES.length) return;
    stage = root.querySelector('.dc-stage');
    shoeBox = d.getElementById('dcShoe');
    copyEls.kicker = d.getElementById('dcKicker');
    copyEls.line = d.getElementById('dcLine');

    buildShoe(pickShoe());

    if (reduce) { render(1, true); return; }

    w.addEventListener('scroll', onScroll, { passive: true });
    w.addEventListener('resize', function () { measure(); render(lastP, true); }, { passive: true });
    onScroll();

    // specular highlight follows the pointer across every glass panel
    stage.addEventListener('pointermove', function (ev) {
      var panels = stage.querySelectorAll('.lg');
      for (var i = 0; i < panels.length; i++) {
        var b = panels[i].getBoundingClientRect();
        panels[i].style.setProperty('--mx', (((ev.clientX - b.left) / b.width) * 100).toFixed(1) + '%');
        panels[i].style.setProperty('--my', (((ev.clientY - b.top) / b.height) * 100).toFixed(1) + '%');
      }
    }, { passive: true });

    // every pair once per cycle, the opening pair first, the rest shuffled
    ring = [shoe].concat(shuffled(SHOES.filter(function (s) { return s.id !== shoe.id; })));
    ringAt = 0;
    if ('IntersectionObserver' in w) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) schedule(); else clearTimeout(timer);
      }, { threshold: 0.25 }).observe(stage);
    }
    d.addEventListener('visibilitychange', function () {
      if (d.hidden) clearTimeout(timer); else schedule();
    });
    schedule();

    // keep the copy in the visitor's language when they switch it
    try {
      new MutationObserver(function () { paintCopy(); })
        .observe(d.documentElement, { attributes: true, attributeFilter: ['lang'] });
    } catch (e) {}
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init);
  else init();
})(window, document);
