/* ShoeLab — shared language resolution with location awareness.
 *
 * Precedence (highest first):
 *   1. ?lang=xx in the URL        — an explicit, shareable choice
 *   2. localStorage               — a choice this visitor made before
 *   3. navigator.language(s)      — the visitor's own declared preference
 *   4. visitor country via /api/geo — where they are connecting from
 *   5. 'en'
 *
 * Browser language outranks country on purpose: a Spanish tourist in Bremen
 * has *said* they read Spanish, while their IP only says where they stand.
 * Country still decides for everyone whose browser language we don't speak
 * (very common in Bremen), and when country and browser disagree we never
 * switch silently — we offer, via a dismissible toast.
 *
 * Nothing here calls a third party: the country comes from our own edge
 * function, which reads it from the CDN request and stores nothing. */
(function (w, d) {
  'use strict';

  var KEY = 'shoelab_lang';
  var GEO_KEY = 'shoelab_geo';
  var OFFER_KEY = 'shoelab_lang_offered';

  var SUPPORTED = ['en', 'de', 'pl', 'ru', 'uk', 'it', 'es', 'fr'];

  /* Country → language. Covers the realistic visitor base of a Bremen studio:
     German-speaking DACH, the large Polish/Russian/Ukrainian communities in
     northern Germany, plus tourists and EU customers ordering products. */
  var COUNTRY_LANG = {
    DE: 'de', AT: 'de', CH: 'de', LI: 'de', LU: 'de',
    PL: 'pl',
    RU: 'ru', BY: 'ru', KZ: 'ru', KG: 'ru', MD: 'ru', AM: 'ru', AZ: 'ru',
    UA: 'uk',
    IT: 'it', SM: 'it', VA: 'it',
    ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es',
    UY: 'es', PY: 'es', BO: 'es', EC: 'es', CR: 'es', PA: 'es', DO: 'es',
    GT: 'es', HN: 'es', SV: 'es', NI: 'es', CU: 'es', PR: 'es',
    FR: 'fr', BE: 'fr', MC: 'fr', SN: 'fr', CI: 'fr', CM: 'fr', MA: 'fr',
    TN: 'fr', DZ: 'fr', HT: 'fr'
  };

  /* Search-engine crawlers must always get the default language: letting an
     IP decide what Googlebot indexes is how multilingual sites get the wrong
     page cached. */
  var BOT = /bot|crawl|spider|slurp|bingpreview|googlebot|duckduckbot|baiduspider|yandex|facebookexternalhit|embedly|quora link preview|showyoubot|outbrain|pinterest|whatsapp|telegrambot|twitterbot|applebot|petalbot|ia_archiver|lighthouse|chrome-lighthouse|headlesschrome/i;

  function isBot() {
    try { return BOT.test(navigator.userAgent || ''); } catch (e) { return false; }
  }
  function ok(l) { return l && SUPPORTED.indexOf(l) !== -1 ? l : null; }

  function readStore(k) { try { return w.localStorage.getItem(k); } catch (e) { return null; } }
  function writeStore(k, v) { try { w.localStorage.setItem(k, v); } catch (e) {} }

  function fromQuery() {
    try {
      var m = (w.location.search || '').match(/[?&]lang=([a-zA-Z-]{2,5})/);
      return m ? ok(m[1].slice(0, 2).toLowerCase()) : null;
    } catch (e) { return null; }
  }

  function stored() { return ok(readStore(KEY)); }

  function fromNavigator() {
    try {
      var list = navigator.languages && navigator.languages.length
        ? navigator.languages : [navigator.language || ''];
      for (var i = 0; i < list.length; i++) {
        var hit = ok(String(list[i]).slice(0, 2).toLowerCase());
        if (hit) return hit;
      }
    } catch (e) {}
    return null;
  }

  /* Country lookup, cached for the tab so we ask at most once per session. */
  function fetchCountry(cb) {
    var cached;
    try { cached = w.sessionStorage.getItem(GEO_KEY); } catch (e) {}
    if (cached) { cb(cached === '-' ? null : cached); return; }

    if (!w.fetch) { cb(null); return; }

    var done = false;
    var finish = function (cc) {
      if (done) return; done = true;
      try { w.sessionStorage.setItem(GEO_KEY, cc || '-'); } catch (e) {}
      cb(cc);
    };
    // Never let a slow edge lookup hold up the page.
    var timer = setTimeout(function () { finish(null); }, 1500);

    w.fetch('/api/geo', { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        clearTimeout(timer);
        var cc = j && j.country ? String(j.country).toUpperCase() : null;
        finish(cc && /^[A-Z]{2}$/.test(cc) ? cc : null);
      })
      .catch(function () { clearTimeout(timer); finish(null); });
  }

  function countryToLang(cc) { return cc ? (COUNTRY_LANG[cc] || null) : null; }

  /* Resolve synchronously from the signals we already have, then — only if
     that leaves something to learn — consult the edge for the country.
     cb(lang, info) may therefore be called twice: once immediately with the
     best guess, once after the country arrives if it changes the answer. */
  function resolve(cb) {
    var q = fromQuery();
    if (q) { writeStore(KEY, q); cb(q, { source: 'url', explicit: true }); return; }

    var s = stored();
    if (s) { cb(s, { source: 'stored', explicit: true }); return; }

    if (isBot()) { cb('en', { source: 'bot', explicit: false }); return; }

    var nav = fromNavigator();
    cb(nav || 'en', { source: nav ? 'navigator' : 'default', explicit: false });

    fetchCountry(function (cc) {
      var geoLang = countryToLang(cc);
      if (!geoLang) return;

      if (!nav) {
        // We had nothing to go on — the country is the best signal available.
        cb(geoLang, { source: 'geo', explicit: false, country: cc });
      } else if (geoLang !== nav) {
        // Browser and country disagree. Respect the browser, offer the local
        // language rather than switching under the visitor's feet.
        cb(nav, { source: 'navigator', explicit: false, country: cc, suggest: geoLang });
      }
    });
  }

  // The server reads the same choice from a cookie, so emails it sends later
  // (a booking confirmation, an outbid notice) arrive in this language too.
  function remember(lang) {
    if (!ok(lang)) return;
    try { d.cookie = 'shoelab_lang=' + lang + '; Path=/; Max-Age=31536000; SameSite=Lax' + (w.location.protocol === 'https:' ? '; Secure' : ''); } catch (e) {}
  }
  function choose(lang) { writeStore(KEY, lang); remember(lang); }

  /* ── the offer / undo toast ─────────────────────────────────────────── */
  var LABEL = {
    en: 'English', de: 'Deutsch', pl: 'Polski', ru: 'Русский',
    uk: 'Українська', it: 'Italiano', es: 'Español', fr: 'Français'
  };
  // "View in <language>?" in the language being offered.
  var OFFER = {
    en: 'View this site in English?', de: 'Diese Seite auf Deutsch ansehen?',
    pl: 'Zobaczyć tę stronę po polsku?', ru: 'Открыть сайт на русском?',
    uk: 'Відкрити сайт українською?', it: 'Vedere il sito in italiano?',
    es: '¿Ver el sitio en español?', fr: 'Voir le site en français ?'
  };
  var YES = {
    en: 'Switch', de: 'Wechseln', pl: 'Przełącz', ru: 'Переключить',
    uk: 'Перемкнути', it: 'Cambia', es: 'Cambiar', fr: 'Changer'
  };

  function offer(lang, onAccept) {
    if (!ok(lang)) return;
    if (readStore(OFFER_KEY) === lang) return;   // asked once, never nag
    writeStore(OFFER_KEY, lang);

    var box = d.createElement('div');
    box.className = 'sl-toast';
    box.setAttribute('role', 'status');

    var txt = d.createElement('span');
    txt.className = 'sl-toast-txt';
    txt.textContent = OFFER[lang] || OFFER.en;

    var yes = d.createElement('button');
    yes.className = 'sl-toast-btn';
    yes.type = 'button';
    yes.textContent = (YES[lang] || 'Switch') + ' → ' + (LABEL[lang] || lang.toUpperCase());

    var no = d.createElement('button');
    no.className = 'sl-toast-x';
    no.type = 'button';
    no.setAttribute('aria-label', 'Dismiss');
    no.textContent = '✕';

    var kill = function () {
      box.classList.remove('on');
      setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 400);
    };
    yes.addEventListener('click', function () { choose(lang); kill(); onAccept(lang); });
    no.addEventListener('click', kill);

    box.appendChild(txt); box.appendChild(yes); box.appendChild(no);
    d.body.appendChild(box);

    // The cookie banner also lives at the bottom of the screen, and it can
    // appear either before or after this toast. Re-measure a few times and on
    // resize, so we always sit above it instead of letting it eat our clicks.
    function place() {
      try {
        var bar = d.getElementById('cookieBar');
        var offset = 0;
        if (bar && d.body.contains(bar)) {
          var st = w.getComputedStyle(bar);
          var r = bar.getBoundingClientRect();
          var shown = st.display !== 'none' && st.visibility !== 'hidden' &&
                      st.opacity !== '0' && r.height > 0;
          // Only when it actually sits across the bottom of the viewport.
          if (shown && r.bottom > w.innerHeight - 4) offset = r.height + 16;
        }
        box.style.bottom = offset ? offset + 'px' : '';
      } catch (e) {}
    }
    place();
    [250, 800, 1600].forEach(function (ms) { setTimeout(place, ms); });
    w.addEventListener('resize', place);

    requestAnimationFrame(function () { box.classList.add('on'); });
    setTimeout(kill, 12000);
  }

  w.SLGeo = {
    SUPPORTED: SUPPORTED,
    COUNTRY_LANG: COUNTRY_LANG,
    STORAGE_KEY: KEY,
    isBot: isBot,
    fromQuery: fromQuery,
    stored: stored,
    fromNavigator: fromNavigator,
    fetchCountry: fetchCountry,
    countryToLang: countryToLang,
    resolve: resolve,
    choose: choose,
    remember: remember,
    offer: offer,
    label: function (l) { return LABEL[l] || l; }
  };
})(window, document);
