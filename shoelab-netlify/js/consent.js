/* ShoeLab — cookie consent and the Google Ads tag (AW-18475286923).
 *
 * The Google tag sets advertising cookies, which in Germany need the
 * visitor's prior consent (§ 25 TDDDG, GDPR). So:
 *   - nothing from Google loads until the visitor presses "Accept";
 *   - "Accept" and "Decline" are equally easy, in the visitor's language;
 *   - the choice is kept for a year (localStorage "shoelab_consent"), then
 *     asked again;
 *   - "Cookie settings" (any element with data-consent-open, in every
 *     footer) opens the banner again; declining later stops the tag and
 *     clears its cookies.
 * Consent Mode is set to "denied" by default for good measure, and updated
 * to "granted" only on acceptance.
 *
 * Not loaded on the password reset page (its address carries a private code)
 * or in the lab console (staff only).
 *
 * SLConsent.open()  shows the banner · SLConsent.ads()  true when accepted
 * SLConsent.label() "Cookie settings" in the page's language */
(function (w, d) {
  'use strict';
  var TAG = 'AW-18475286923';
  var KEY = 'shoelab_consent';
  var KEEP_MS = 365 * 24 * 3600 * 1000;

  var T = {
    en: { t: 'Cookies for our ads?', p: 'We would like to use Google Ads cookies to see which of our ads brought you here and to show you more relevant ads. Only with your OK — you can change your choice any time under “Cookie settings” at the bottom of every page.', y: 'Accept', n: 'Decline', m: 'Privacy policy', s: 'Cookie settings' },
    de: { t: 'Cookies für unsere Werbung?', p: 'Wir würden gern Cookies von Google Ads verwenden, um zu sehen, welche unserer Anzeigen dich hierher gebracht haben, und dir passendere Werbung zu zeigen. Nur mit deinem Okay — du kannst deine Wahl jederzeit unter „Cookie-Einstellungen“ unten auf jeder Seite ändern.', y: 'Akzeptieren', n: 'Ablehnen', m: 'Datenschutz', s: 'Cookie-Einstellungen' },
    pl: { t: 'Pliki cookie do naszych reklam?', p: 'Chcielibyśmy używać plików cookie Google Ads, aby sprawdzić, które nasze reklamy Cię tu przyprowadziły, i pokazywać Ci trafniejsze reklamy. Tylko za Twoją zgodą — swój wybór możesz zmienić w każdej chwili w „Ustawieniach cookie” na dole każdej strony.', y: 'Akceptuję', n: 'Odrzucam', m: 'Prywatność', s: 'Ustawienia cookie' },
    ru: { t: 'Cookie для нашей рекламы?', p: 'Мы хотели бы использовать cookie Google Ads, чтобы понимать, какая реклама привела вас к нам, и показывать вам более подходящую рекламу. Только с вашего согласия — изменить выбор можно в любой момент в «Настройках cookie» внизу каждой страницы.', y: 'Принять', n: 'Отклонить', m: 'Конфиденциальность', s: 'Настройки cookie' },
    uk: { t: 'Cookie для нашої реклами?', p: 'Ми хотіли б використовувати cookie Google Ads, щоб розуміти, яка реклама привела вас до нас, і показувати вам доречнішу рекламу. Лише з вашої згоди — змінити вибір можна будь-коли в «Налаштуваннях cookie» внизу кожної сторінки.', y: 'Прийняти', n: 'Відхилити', m: 'Конфіденційність', s: 'Налаштування cookie' },
    it: { t: 'Cookie per i nostri annunci?', p: 'Vorremmo usare i cookie di Google Ads per capire quali nostri annunci ti hanno portato qui e mostrarti pubblicità più pertinente. Solo con il tuo consenso: puoi cambiare scelta in qualsiasi momento in «Impostazioni cookie» in fondo a ogni pagina.', y: 'Accetto', n: 'Rifiuto', m: 'Privacy', s: 'Impostazioni cookie' },
    es: { t: '¿Cookies para nuestros anuncios?', p: 'Nos gustaría usar cookies de Google Ads para saber qué anuncios nuestros te han traído aquí y mostrarte publicidad más relevante. Solo con tu permiso: puedes cambiar tu elección en cualquier momento en «Ajustes de cookies», al pie de cada página.', y: 'Aceptar', n: 'Rechazar', m: 'Privacidad', s: 'Ajustes de cookies' },
    fr: { t: 'Des cookies pour nos annonces ?', p: 'Nous aimerions utiliser les cookies de Google Ads pour savoir quelles annonces t’ont amené ici et te montrer des publicités plus pertinentes. Seulement avec ton accord : tu peux changer d’avis à tout moment via « Paramètres des cookies » en bas de chaque page.', y: 'Accepter', n: 'Refuser', m: 'Confidentialité', s: 'Paramètres des cookies' }
  };

  /* ── Google tag, held back until consent ──────────────────────────── */
  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  if (!w.gtag) w.gtag = gtag;
  gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
  var loaded = false;
  function loadTag() {
    gtag('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' });
    if (loaded) return;
    loaded = true;
    var s = d.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + TAG;
    d.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', TAG);
  }
  function stopTag() {
    gtag('consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    // the advertising cookies Google set while consent was given
    var host = w.location.hostname, base = host.replace(/^www\./, '');
    d.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (!/^(_gcl|_gac|_ga|_gid)/.test(name)) return;
      [host, '.' + base, ''].forEach(function (dom) {
        d.cookie = name + '=; Max-Age=0; path=/' + (dom ? '; domain=' + dom : '');
      });
    });
  }

  /* ── the visitor's choice ─────────────────────────────────────────── */
  function read() {
    try {
      var v = JSON.parse(w.localStorage.getItem(KEY) || 'null');
      if (v && typeof v.ads === 'boolean' && Date.now() - (v.at || 0) < KEEP_MS) return v;
    } catch (e) {}
    return null;
  }
  function save(ads) {
    try { w.localStorage.setItem(KEY, JSON.stringify({ ads: ads, at: Date.now(), v: 1 })); } catch (e) {}
  }
  function choose(ads) {
    save(ads);
    if (ads) loadTag(); else if (loaded || /(^|;\s*)_gcl/.test(d.cookie)) stopTag();
    hide();
  }

  /* ── the banner ───────────────────────────────────────────────────── */
  function lang() {
    var l = (d.documentElement.getAttribute('lang') || '').slice(0, 2).toLowerCase();
    if (!T[l]) { try { l = (w.localStorage.getItem('shoelab_lang') || '').slice(0, 2); } catch (e) { l = ''; } }
    if (!T[l]) l = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return T[l] ? l : 'en';
  }
  var bar = null, shown = false;
  function css() {
    if (d.getElementById('slConsentCss')) return;
    var st = d.createElement('style');
    st.id = 'slConsentCss';
    st.textContent =
      '#slConsent{position:fixed;left:12px;right:12px;bottom:calc(12px + var(--slc-lift,0px) + env(safe-area-inset-bottom,0px));z-index:99995;display:flex;justify-content:center;pointer-events:none;' +
        'font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;opacity:0;transform:translateY(16px);transition:opacity .3s,transform .3s cubic-bezier(.2,.8,.2,1);}' +
      '#slConsent.on{opacity:1;transform:none;}' +
      '#slConsent .slc{pointer-events:auto;max-width:760px;width:100%;display:flex;gap:1rem 1.2rem;align-items:center;flex-wrap:wrap;' +
        'background:rgba(16,16,16,0.97);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.14);border-radius:18px;' +
        'padding:1rem 1.1rem;box-shadow:0 24px 60px rgba(0,0,0,0.6);color:#e8e8e8;}' +
      '#slConsent .slc-txt{flex:1 1 360px;min-width:0;}' +
      '#slConsent b{display:block;font-size:0.92rem;font-weight:600;color:#fff;margin-bottom:0.25rem;}' +
      '#slConsent p{margin:0;font-size:0.78rem;line-height:1.55;color:#bdbdbd;}' +
      '#slConsent a{color:#e8c86a;text-decoration:underline;text-underline-offset:2px;}' +
      '#slConsent .slc-btns{display:flex;gap:0.5rem;flex:0 0 auto;}' +
      '#slConsent button{font-family:inherit;font-size:0.8rem;font-weight:600;letter-spacing:0.02em;min-width:118px;padding:0.72rem 1.1rem;border-radius:10px;cursor:pointer;' +
        'border:1px solid rgba(255,255,255,0.22);color:#fff;transition:background .15s,border-color .15s;}' +
      '#slConsent .slc-no{background:#2a2a2a;}' +
      '#slConsent .slc-no:hover{background:#363636;}' +
      '#slConsent .slc-yes{background:#CC1111;border-color:#CC1111;}' +
      '#slConsent .slc-yes:hover{background:#e01818;}' +
      '#slConsent button:focus-visible,#slConsent a:focus-visible{outline:2px solid #e8c86a;outline-offset:2px;}' +
      '@media(max-width:560px){#slConsent .slc-btns{width:100%;}#slConsent button{flex:1 1 0;min-width:0;}}' +
      '@media(prefers-reduced-motion:reduce){#slConsent{transition:none;}}';
    d.head.appendChild(st);
  }
  function text() {
    var x = T[lang()];
    bar.querySelector('#slcT').textContent = x.t;
    bar.querySelector('#slcP').innerHTML = '';
    bar.querySelector('#slcP').appendChild(d.createTextNode(x.p + ' '));
    var a = d.createElement('a');
    a.href = '/datenschutz.html#cookies'; a.textContent = x.m;
    bar.querySelector('#slcP').appendChild(a);
    bar.querySelector('.slc-yes').textContent = x.y;
    bar.querySelector('.slc-no').textContent = x.n;
  }
  // sits above a phone tab bar (the Vault), and lifts Wesley above itself (the main site)
  function place() {
    if (!bar) return;
    var tab = d.querySelector('.v-tabbar'), lift = 0;
    if (tab && w.getComputedStyle(tab).display !== 'none') lift = tab.getBoundingClientRect().height;
    bar.style.setProperty('--slc-lift', lift + 'px');
    if (d.body) {
      d.body.classList.toggle('cb-on', shown);
      if (shown) d.documentElement.style.setProperty('--cb-h', (bar.querySelector('.slc').offsetHeight + 24) + 'px');
    }
  }
  function show() {
    css();
    if (!bar) {
      bar = d.createElement('div');
      bar.id = 'slConsent';
      bar.setAttribute('role', 'dialog');
      bar.setAttribute('aria-labelledby', 'slcT');
      bar.setAttribute('aria-describedby', 'slcP');
      bar.innerHTML = '<div class="slc"><div class="slc-txt"><b id="slcT"></b><p id="slcP"></p></div>' +
        '<div class="slc-btns"><button type="button" class="slc-no"></button><button type="button" class="slc-yes"></button></div></div>';
      bar.querySelector('.slc-yes').addEventListener('click', function () { choose(true); });
      bar.querySelector('.slc-no').addEventListener('click', function () { choose(false); });
      d.body.appendChild(bar);
    }
    text();
    shown = true;
    place();
    requestAnimationFrame(function () { if (bar) bar.classList.add('on'); });
  }
  function hide() {
    shown = false;
    if (bar) { bar.classList.remove('on'); var b = bar; bar = null; setTimeout(function () { b.remove(); }, 320); }
    place();
    if (d.body) d.body.classList.remove('cb-on');
  }

  // "Cookie settings" links, in the page's language
  function labels() {
    var s = T[lang()].s;
    Array.prototype.forEach.call(d.querySelectorAll('[data-consent-open]'), function (el) { if (el.textContent !== s) el.textContent = s; });
  }
  d.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-consent-open]');
    if (!el) return;
    e.preventDefault();
    show();
  });

  function start() {
    var c = read();
    if (c && c.ads) loadTag();
    labels();
    if (!c) setTimeout(show, 700);
    // the language can change after load (the main site and the Vault set it)
    if (w.MutationObserver) {
      new MutationObserver(function () { labels(); if (bar) text(); }).observe(d.documentElement, { attributes: true, attributeFilter: ['lang'] });
    }
    w.addEventListener('resize', function () { if (shown) place(); });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();

  w.SLConsent = { open: show, ads: function () { var c = read(); return !!(c && c.ads); }, label: function () { return T[lang()].s; } };
})(window, document);
