/* ShoeLab — hero sneaker showcase.
 *
 * The pairs turn through on a turntable: one rotates away as the next
 * rotates in, the colour fields behind the hero re-tint to each pair, and
 * the order is shuffled every visit. The progress bar is the timer — its CSS
 * fill animation running out is what advances the slide, so pausing the
 * animation pauses everything, mid-progress, with no clock to keep in sync.
 *
 * To add a pair: put a cut-out with a SOLID matte in /img/showcase/ — a
 * brightness-keyed one lets the coloured light show through dark leather —
 * then add an entry to SHOES and its line in DESC. */
(function (w, d) {
  'use strict';

  var INTERVAL = 6000;

  // c1 = accent (brand line, progress, glow); c2/c3 = the drifting fields.
  var SHOES = [
    { id: 'jordan1',      img: '/img/showcase/jordan1.webp',       brand: 'Jordan',      model: 'Air Jordan 1 Low', ed: 'Panda', word: 'AJ1',
      c: ['#ff2a2a', '#3c0a16', '#d8dbea'], mat: ['leather'] },
    { id: 'pegasus-white',img: '/img/showcase/pegasus-white.webp', brand: 'Nike',        model: 'Pegasus',          word: 'PEGASUS',
      c: ['#ff3355', '#103765', '#7fd3ff'], mat: ['mesh', 'foam'] },
    { id: 'nb1080',       img: '/img/showcase/nb1080.webp',        brand: 'New Balance', model: 'Fresh Foam X 1080', word: '1080',
      c: ['#b28cff', '#1b2858', '#ffcfa3'], mat: ['knit', 'foam'] },
    { id: 'nb9060-black', img: '/img/showcase/nb9060-black.webp',  brand: 'New Balance', model: '9060', edKey: 'black', word: '9060',
      c: ['#e2403a', '#1d2336', '#a3acbb'], mat: ['suede', 'mesh'] },
    { id: 'nb880',        img: '/img/showcase/nb880.webp',         brand: 'New Balance', model: 'Fresh Foam X 880',  word: '880',
      c: ['#2fd1b5', '#0d3a39', '#ffb35c'], mat: ['mesh', 'foam'] }
  ];

  var DESC = {
    'jordan1': {
      en: 'The 1985 court icon, cut low. Its leather creases at the toe — we bring it back into shape.',
      de: 'Die Basketball-Ikone von 1985, als Low. Das Leder knickt an der Spitze — wir bringen es wieder in Form.',
      pl: 'Ikona boisk z 1985 roku w wersji low. Skóra łamie się na czubku — przywracamy jej formę.',
      ru: 'Баскетбольная икона 1985 года в низком варианте. Кожа заламывается на носке — мы возвращаем ей форму.',
      uk: 'Баскетбольна ікона 1985 року в низькому варіанті. Шкіра заломлюється на носку — ми повертаємо їй форму.',
      it: "L'icona del basket del 1985, in versione low. La pelle si piega sulla punta — le ridiamo forma.",
      es: 'El icono de la cancha de 1985, en versión low. La piel se marca en la puntera — le devolvemos la forma.',
      fr: "L'icône des parquets de 1985, en version basse. Le cuir se plisse à l'avant — on lui rend sa forme."
    },
    'pegasus-white': {
      en: "Nike's everyday runner since 1983 — Air Zoom cushioning under an engineered-mesh upper.",
      de: 'Nikes Alltagsläufer seit 1983 — Air-Zoom-Dämpfung unter einem Engineered-Mesh-Obermaterial.',
      pl: 'Codzienny biegacz Nike od 1983 roku — amortyzacja Air Zoom pod siatkową cholewką.',
      ru: 'Повседневные беговые Nike с 1983 года — амортизация Air Zoom под сетчатым верхом.',
      uk: 'Повсякденні бігові Nike з 1983 року — амортизація Air Zoom під сітчастим верхом.',
      it: 'La runner quotidiana di Nike dal 1983 — ammortizzazione Air Zoom sotto una tomaia in mesh.',
      es: 'La zapatilla diaria de Nike desde 1983 — amortiguación Air Zoom bajo una parte superior de malla.',
      fr: 'La running du quotidien de Nike depuis 1983 — amorti Air Zoom sous une tige en mesh.'
    },
    'nb1080': {
      en: "New Balance's plush flagship. White Fresh Foam X yellows with time — we bring the white back.",
      de: 'New Balances weicher Flaggschiff-Läufer. Weißer Fresh Foam X vergilbt — wir machen ihn wieder weiß.',
      pl: 'Miękki flagowiec New Balance. Biała pianka Fresh Foam X żółknie — przywracamy jej biel.',
      ru: 'Мягкий флагман New Balance. Белая пена Fresh Foam X желтеет — мы возвращаем ей белизну.',
      uk: "М'який флагман New Balance. Біла піна Fresh Foam X жовтіє — ми повертаємо їй білизну.",
      it: "L'ammiraglia morbida di New Balance. La Fresh Foam X bianca ingiallisce — le ridiamo il bianco.",
      es: 'La insignia más mullida de New Balance. La Fresh Foam X blanca amarillea — le devolvemos el blanco.',
      fr: 'Le modèle phare et moelleux de New Balance. La Fresh Foam X blanche jaunit — on lui rend son blanc.'
    },
    'nb9060-black': {
      en: 'The all-black 9060. Black suede greys with wear — a suede-safe deep clean restores the depth.',
      de: 'Der 9060 ganz in Schwarz. Schwarzes Wildleder vergraut — eine schonende Tiefenreinigung bringt die Tiefe zurück.',
      pl: '9060 w całości czarny. Czarny zamsz szarzeje — delikatne, głębokie czyszczenie przywraca mu głębię.',
      ru: 'Полностью чёрные 9060. Чёрная замша со временем сереет — бережная глубокая чистка возвращает цвет.',
      uk: 'Повністю чорні 9060. Чорна замша з часом сіріє — дбайливе глибоке чищення повертає колір.',
      it: 'La 9060 total black. Il camoscio nero ingrigisce — una pulizia profonda delicata ne ravviva il colore.',
      es: 'La 9060 totalmente negra. El ante negro se agrisa — una limpieza profunda suave le devuelve la profundidad.',
      fr: 'La 9060 tout en noir. Le daim noir grisaille — un nettoyage en profondeur tout en douceur lui rend son éclat.'
    },
    'nb880': {
      en: 'The do-it-all daily trainer: soft Fresh Foam X under a breathable mesh upper.',
      de: 'Der Allrounder für jeden Tag: weicher Fresh Foam X unter einem atmungsaktiven Mesh-Obermaterial.',
      pl: 'Uniwersalny but na co dzień: miękka pianka Fresh Foam X pod przewiewną siatkową cholewką.',
      ru: 'Универсальная модель на каждый день: мягкая пена Fresh Foam X под дышащим сетчатым верхом.',
      uk: "Універсальна модель на щодень: м'яка піна Fresh Foam X під дихаючим сітчастим верхом.",
      it: 'La scarpa da tutti i giorni: morbida Fresh Foam X sotto una tomaia in mesh traspirante.',
      es: 'La todoterreno diaria: Fresh Foam X suave bajo una parte superior de malla transpirable.',
      fr: 'La polyvalente du quotidien : une Fresh Foam X souple sous une tige en mesh respirante.'
    }
  };

  var T = {
    en: { leather: 'Leather', suede: 'Suede', mesh: 'Mesh', knit: 'Knit', foam: 'Foam', zoomx: 'ZoomX',
          grey: 'Grey', black: 'Black', pause: 'Pause', play: 'Play', show: 'Show', list: 'Featured sneakers' },
    de: { leather: 'Leder', suede: 'Wildleder', mesh: 'Mesh', knit: 'Strick', foam: 'Schaum', zoomx: 'ZoomX',
          grey: 'Grau', black: 'Schwarz', pause: 'Pause', play: 'Abspielen', show: 'Zeige', list: 'Ausgewählte Sneaker' },
    pl: { leather: 'Skóra', suede: 'Zamsz', mesh: 'Siatka', knit: 'Dzianina', foam: 'Pianka', zoomx: 'ZoomX',
          grey: 'Szary', black: 'Czarny', pause: 'Pauza', play: 'Odtwórz', show: 'Pokaż', list: 'Wybrane sneakersy' },
    ru: { leather: 'Кожа', suede: 'Замша', mesh: 'Сетка', knit: 'Трикотаж', foam: 'Пена', zoomx: 'ZoomX',
          grey: 'Серый', black: 'Чёрный', pause: 'Пауза', play: 'Воспроизвести', show: 'Показать', list: 'Избранные кроссовки' },
    uk: { leather: 'Шкіра', suede: 'Замша', mesh: 'Сітка', knit: 'Трикотаж', foam: 'Піна', zoomx: 'ZoomX',
          grey: 'Сірий', black: 'Чорний', pause: 'Пауза', play: 'Відтворити', show: 'Показати', list: 'Обрані кросівки' },
    it: { leather: 'Pelle', suede: 'Camoscio', mesh: 'Mesh', knit: 'Maglia', foam: 'Schiuma', zoomx: 'ZoomX',
          grey: 'Grigio', black: 'Nero', pause: 'Pausa', play: 'Riproduci', show: 'Mostra', list: 'Sneaker in evidenza' },
    es: { leather: 'Piel', suede: 'Ante', mesh: 'Malla', knit: 'Punto', foam: 'Espuma', zoomx: 'ZoomX',
          grey: 'Gris', black: 'Negro', pause: 'Pausa', play: 'Reproducir', show: 'Mostrar', list: 'Zapatillas destacadas' },
    fr: { leather: 'Cuir', suede: 'Daim', mesh: 'Mesh', knit: 'Maille', foam: 'Mousse', zoomx: 'ZoomX',
          grey: 'Gris', black: 'Noir', pause: 'Pause', play: 'Lecture', show: 'Afficher', list: 'Sneakers à la une' }
  };

  function lang() {
    var l = (d.documentElement.lang || 'en').slice(0, 2).toLowerCase();
    return T[l] ? l : 'en';
  }
  function tr(k) { var L = T[lang()]; return L && L[k] != null ? L[k] : (T.en[k] != null ? T.en[k] : k); }
  function desc(s) { var x = DESC[s.id] || {}; return x[lang()] || x.en || ''; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function shuffled(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  var reduce = false;
  try { reduce = w.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var hero, root, stage, word, cap, bar, pp, slots = [];
  var order = [], idx = 0, cur = 0, busy = false;
  var userPaused = reduce, hovering = false, focused = false, inView = true;

  function shoeSlot(k) {
    var el = d.createElement('div');
    el.className = 'hs-shoe' + (k ? ' enter' : '');
    el.innerHTML = '<div class="hs-tilt"><div class="hs-float">' +
                   '<img alt="" decoding="async" draggable="false"/>' +
                   '<img class="hs-reflect" alt="" aria-hidden="true" decoding="async" draggable="false"/>' +
                   '</div></div>';
    return el;
  }

  function build() {
    root.innerHTML =
      '<div class="hs-stage">' +
        '<div class="hs-glow" aria-hidden="true"></div>' +
        '<div class="hs-word" aria-hidden="true"></div>' +
        '<div class="hs-plate" aria-hidden="true"></div>' +
      '</div>' +
      '<div class="hs-cap"><p class="hs-brand"></p><p class="hs-model"></p>' +
        '<p class="hs-desc"></p><ul class="hs-tags"></ul></div>' +
      '<div class="hs-bar" role="group"></div>';
    stage = root.querySelector('.hs-stage');
    word = root.querySelector('.hs-word');
    cap = root.querySelector('.hs-cap');
    bar = root.querySelector('.hs-bar');
    slots = [shoeSlot(0), shoeSlot(1)];
    stage.appendChild(slots[0]); stage.appendChild(slots[1]);

    bar.innerHTML = order.map(function (s, i) {
      return '<button type="button" class="hs-seg" data-i="' + i + '"><i></i></button>';
    }).join('') +
      '<button type="button" class="hs-pp"></button>';
    pp = bar.querySelector('.hs-pp');
    root.style.setProperty('--hs-ms', INTERVAL + 'ms');
  }

  function paintCaption(s) {
    var ed = s.ed || (s.edKey ? tr(s.edKey) : '');
    cap.querySelector('.hs-brand').textContent = s.brand;
    cap.querySelector('.hs-model').innerHTML = esc(s.model) + (ed ? ' <em>' + esc(ed) + '</em>' : '');
    cap.querySelector('.hs-desc').textContent = desc(s);
    cap.querySelector('.hs-tags').innerHTML = s.mat.map(function (m) { return '<li>' + esc(tr(m)) + '</li>'; }).join('');
  }

  function paintChrome() {
    bar.setAttribute('aria-label', tr('list'));
    bar.querySelectorAll('.hs-seg').forEach(function (b, i) {
      var s = order[i];
      b.setAttribute('aria-label', tr('show') + ' ' + s.brand + ' ' + s.model);
      if (i === idx) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    pp.setAttribute('aria-label', userPaused ? tr('play') : tr('pause'));
    pp.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
    pp.innerHTML = userPaused
      ? '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1l7 4-7 4z" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1h2v8H2zM6 1h2v8H6z" fill="currentColor"/></svg>';
  }

  function setColours(s) {
    hero.style.setProperty('--hs-c1', s.c[0]);
    hero.style.setProperty('--hs-c2', s.c[1]);
    hero.style.setProperty('--hs-c3', s.c[2]);
  }

  // restart the active segment's fill — this IS the timer
  function armSegments() {
    bar.querySelectorAll('.hs-seg').forEach(function (b, i) {
      b.classList.remove('on');
      b.classList.toggle('done', i < idx);
    });
    var on = bar.querySelector('.hs-seg[data-i="' + idx + '"]');
    void on.offsetWidth;                 // so the animation starts from 0
    on.classList.add('on');
  }

  function syncPause() {
    var p = userPaused || hovering || focused || !inView || d.hidden;
    root.classList.toggle('paused', p);
  }

  function load(src) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = im.onerror = function () { res(); };
      im.src = src;
      if (im.decode) im.decode().then(res, res);
    });
  }

  function show(i, instant) {
    if (busy && !instant) return;
    var s = order[i];
    var incoming = slots[instant ? cur : 1 - cur];
    var outgoing = slots[cur];
    var imgs = incoming.querySelectorAll('img');
    busy = true;

    load(s.img).then(function () {
      imgs[0].src = s.img; imgs[0].alt = s.brand + ' ' + s.model;
      imgs[1].src = s.img;
      idx = i;
      setColours(s);

      if (instant) {
        incoming.classList.remove('enter', 'leave');
        word.textContent = s.word;
        paintCaption(s); paintChrome(); armSegments();
        busy = false;
        return;
      }

      // park the incoming pair at its start pose with no transition, then
      // release both on the same frame so the turntable moves as one
      incoming.style.transition = 'none';
      incoming.classList.remove('leave'); incoming.classList.add('enter');
      void incoming.offsetWidth;
      incoming.style.transition = '';
      requestAnimationFrame(function () {
        outgoing.classList.add('leave');
        incoming.classList.remove('enter');
      });

      word.classList.add('out');
      cap.classList.add('swap');
      setTimeout(function () {
        word.textContent = s.word; word.classList.remove('out');
        paintCaption(s); cap.classList.remove('swap');
      }, 380);

      paintChrome(); armSegments();
      cur = 1 - cur;
      setTimeout(function () {
        outgoing.style.transition = 'none';
        outgoing.classList.remove('leave'); outgoing.classList.add('enter');
        outgoing.querySelector('.hs-tilt').style.transform = '';
        void outgoing.offsetWidth; outgoing.style.transition = '';
        busy = false;
      }, 1050);
    });
  }

  function next() { show((idx + 1) % order.length); }

  function init() {
    hero = d.getElementById('hero');
    root = d.getElementById('heroShowcase');
    if (!hero || !root) return;

    // Start on a different pair from the one the anatomy section opened with.
    var skip = null;
    try { skip = w.localStorage.getItem('shoelab_dc_last'); } catch (e) {}
    order = shuffled(SHOES);
    if (skip && order[0].id === skip && order.length > 1) order.push(order.shift());

    build();
    show(0, true);

    bar.addEventListener('animationend', function (e) {
      if (e.target.parentNode && e.target.parentNode.classList.contains('on')) next();
    });
    bar.addEventListener('click', function (e) {
      var seg = e.target.closest('.hs-seg');
      if (seg) { var i = +seg.getAttribute('data-i'); if (i !== idx) show(i); return; }
      if (e.target.closest('.hs-pp')) { userPaused = !userPaused; paintChrome(); syncPause(); }
    });

    var fine = false;
    try { fine = w.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) {}
    if (fine) {
      stage.addEventListener('pointerenter', function () { hovering = true; syncPause(); });
      stage.addEventListener('pointerleave', function () {
        hovering = false; syncPause();
        slots[cur].querySelector('.hs-tilt').style.transform = '';
      });
      if (!reduce) stage.addEventListener('pointermove', function (e) {
        var r = stage.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        slots[cur].querySelector('.hs-tilt').style.transform =
          'rotateY(' + (px * 16).toFixed(2) + 'deg) rotateX(' + (-py * 10).toFixed(2) + 'deg)';
      });
    }
    root.addEventListener('focusin', function () { focused = true; syncPause(); });
    root.addEventListener('focusout', function () { focused = false; syncPause(); });
    d.addEventListener('visibilitychange', syncPause);
    if ('IntersectionObserver' in w) {
      new IntersectionObserver(function (es) {
        inView = es[0].isIntersecting; syncPause();
      }, { threshold: 0.15 }).observe(hero);
    }
    syncPause();

    try {
      new MutationObserver(function () { paintCaption(order[idx]); paintChrome(); })
        .observe(d.documentElement, { attributes: true, attributeFilter: ['lang'] });
    } catch (e) {}
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init);
  else init();
})(window, document);
