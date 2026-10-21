/* ShoeLab Vault — shared core for every Vault page.
 *
 * Language (location-aware through SLGeo, translations in js/vault-i18n/),
 * the API client, the signed-in member, the page chrome (header, mobile tab
 * bar, footer), formatting, modals, toasts, listing cards, live countdowns
 * and the clearly labelled example listings used by preview mode.
 *
 * Every piece of text that came from a member (titles, descriptions, names,
 * notes) goes through esc() before it touches innerHTML. */
(function (w, d) {
  'use strict';

  var V = '2';   // bump together with the ?v= of the translation files
  var I18N = w.SLV_I18N = w.SLV_I18N || {};
  var LANGS = [
    { c: 'en', n: 'English', f: '🇬🇧' }, { c: 'de', n: 'Deutsch', f: '🇩🇪' },
    { c: 'pl', n: 'Polski', f: '🇵🇱' }, { c: 'ru', n: 'Русский', f: '🇷🇺' },
    { c: 'uk', n: 'Українська', f: '🇺🇦' }, { c: 'it', n: 'Italiano', f: '🇮🇹' },
    { c: 'es', n: 'Español', f: '🇪🇸' }, { c: 'fr', n: 'Français', f: '🇫🇷' }
  ];
  var LOCALE = { en: 'en-IE', de: 'de-DE', pl: 'pl-PL', ru: 'ru-RU', uk: 'uk-UA', it: 'it-IT', es: 'es-ES', fr: 'fr-FR' };

  var lang = 'en';
  var me = null;          // { id, name, email, specialist }
  var config = null;      // GET /api/market/config
  var page = {};          // the page controller passed to boot()
  var started = false;

  /* ── i18n ───────────────────────────────────────────────────────────── */
  function fill(s, vars) {
    if (!vars) return s;
    return String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
  }
  function t(key, vars) {
    var L = I18N[lang], s = L && L[key];
    if (s == null && I18N.en) s = I18N.en[key];
    if (s == null) { (w.SLV_MISSING = w.SLV_MISSING || []).push(key); return key; }
    return fill(s, vars);
  }
  // Plurals follow each language's own rules (Polish, Russian and Ukrainian
  // have four forms); a missing form falls back to English.
  function tn(key, n, vars) {
    var rule = 'other';
    try { rule = new Intl.PluralRules(LOCALE[lang] || 'en').select(n); } catch (e) {}
    var L = I18N[lang] || {}, E = I18N.en || {};
    var s = L[key + '_' + rule] || L[key + '_other'];
    if (s == null) s = E[key + '_' + (n === 1 ? 'one' : 'other')] || key;
    var v = vars || {};
    v.n = num(n);
    return fill(s, v);
  }
  function has(key) { return !!((I18N[lang] && I18N[lang][key] != null) || (I18N.en && I18N.en[key] != null)); }

  function loadLang(L, cb) {
    if (L === 'en' || I18N[L]) { cb(); return; }
    var done = false, s = d.createElement('script');
    var fin = function () { if (!done) { done = true; cb(); } };
    s.src = '/js/vault-i18n/' + L + '.js?v=' + V;
    s.onload = fin; s.onerror = fin;
    setTimeout(fin, 4000);
    d.head.appendChild(s);
  }

  function applyI18n(root) {
    root = root || d;
    var each = function (sel, fn) { Array.prototype.forEach.call(root.querySelectorAll(sel), fn); };
    each('[data-t]', function (el) { el.textContent = t(el.getAttribute('data-t')); });
    each('[data-t-ph]', function (el) { el.setAttribute('placeholder', t(el.getAttribute('data-t-ph'))); });
    each('[data-t-aria]', function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-t-aria'))); });
    each('[data-t-title]', function (el) { el.setAttribute('title', t(el.getAttribute('data-t-title'))); });
    if (root === d) {
      d.documentElement.lang = lang;
      if (page.title) d.title = t(page.title) + ' — ShoeLab Vault';
    }
  }

  /* ── formatting ─────────────────────────────────────────────────────── */
  function loc() { return LOCALE[lang] || 'en-IE'; }
  function num(n) { try { return new Intl.NumberFormat(loc()).format(n); } catch (e) { return String(n); } }
  // cents → "€120" / "120 €"; full=true always shows the cents
  function money(c, full) {
    if (c == null || c === '' || isNaN(c)) return '—';
    var whole = Math.round(c) % 100 === 0;
    try {
      return new Intl.NumberFormat(loc(), {
        style: 'currency', currency: 'EUR',
        minimumFractionDigits: whole && !full ? 0 : 2, maximumFractionDigits: 2
      }).format(c / 100);
    } catch (e) { return '€' + (c / 100).toFixed(whole && !full ? 0 : 2); }
  }
  function toDate(iso) { var x = new Date(iso); return isNaN(x) ? null : x; }
  function fmtDate(iso) {
    var x = toDate(iso); if (!x) return '';
    try { return new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short', year: 'numeric' }).format(x); }
    catch (e) { return x.toDateString(); }
  }
  function fmtDateTime(iso) {
    var x = toDate(iso); if (!x) return '';
    try { return new Intl.DateTimeFormat(loc(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(x); }
    catch (e) { return x.toLocaleString(); }
  }
  function fmtShort(iso) {
    var x = toDate(iso); if (!x) return '';
    try { return new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(x); }
    catch (e) { return x.toLocaleString(); }
  }
  function ago(iso) {
    var x = toDate(iso); if (!x) return '';
    var s = Math.round((x.getTime() - Date.now()) / 1000), a = Math.abs(s);
    var u = a < 60 ? ['second', s] : a < 3600 ? ['minute', Math.round(s / 60)] : a < 86400 ? ['hour', Math.round(s / 3600)]
      : a < 2592000 ? ['day', Math.round(s / 86400)] : a < 31536000 ? ['month', Math.round(s / 2592000)] : ['year', Math.round(s / 31536000)];
    try { return new Intl.RelativeTimeFormat(loc(), { numeric: 'auto' }).format(u[1], u[0]); }
    catch (e) { return fmtShort(iso); }
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  // time left until an ISO instant, in the visitor's units
  function left(iso) {
    var x = toDate(iso);
    var ms = x ? x.getTime() - Date.now() : 0;
    if (ms <= 0) return { ms: 0, text: t('ended'), over: true };
    var s = Math.floor(ms / 1000), dd = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
      m = Math.floor((s % 3600) / 60), sec = s % 60, text;
    if (dd > 0) text = dd + t('u_d') + ' ' + h + t('u_h');
    else if (h > 0) text = h + t('u_h') + ' ' + pad(m) + t('u_m');
    else if (m > 0) text = m + t('u_m') + ' ' + pad(sec) + t('u_s');
    else text = sec + t('u_s');
    return { ms: ms, text: text, soon: ms < 3600000, now: ms < 120000 };
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function initials(name, email) {
    var p = String(name || '').trim().split(/\s+/).filter(Boolean);
    var s = p.length > 1 ? p[0][0] + p[p.length - 1][0] : (p[0] || email || '?').slice(0, 2);
    return s.toUpperCase();
  }
  function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || ''; }
  function qs(k) { try { return new URLSearchParams(w.location.search).get(k); } catch (e) { return null; } }
  // "120,50" or "120.50" → 120.5; anything else → NaN
  function parseEuro(v) {
    var s = String(v == null ? '' : v).trim().replace(/\s|€/g, '');
    if (!s) return NaN;
    if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
    return /^\d+(\.\d{1,2})?$/.test(s) ? parseFloat(s) : NaN;
  }
  function centsOf(v) { var e = parseEuro(v); return isNaN(e) ? NaN : Math.round(e * 100); }
  // cents → a plain amount for an input field: "82.50" / "82,50" / "83"
  function amountText(c) {
    if (c == null || isNaN(c)) return '';
    var whole = Math.round(c) % 100 === 0;
    try {
      return new Intl.NumberFormat(loc(), { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2, useGrouping: false }).format(c / 100);
    } catch (e) { return (c / 100).toFixed(whole ? 0 : 2); }
  }
  // "Jordan" + "Air Jordan 1 Low" reads "Air Jordan 1 Low", not "Jordan Air Jordan 1 Low"
  function titleOf(brand, model) {
    brand = String(brand || '').trim(); model = String(model || '').trim();
    return brand && model.toLowerCase().indexOf(brand.toLowerCase()) !== -1 ? model : (brand + ' ' + model).trim();
  }

  /* ── icons ──────────────────────────────────────────────────────────── */
  var ICONS = {
    shield: '<path d="M12 3l7 3v6c0 4.4-3 8.3-7 9-4-.7-7-4.6-7-9V6z"/><path d="M8.8 12.2l2.2 2.2 4.4-4.6"/>',
    camera: '<path d="M4 8h3l1.6-2.4h6.8L17 8h3v11H4z"/><circle cx="12" cy="13.3" r="3.4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/>',
    vault: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="12" cy="12" r="3.6"/><path d="M12 8.4v-1M12 16.6v-1M15.6 12h1M7.4 12h1M7 19.5v1.5M17 19.5v1.5"/>',
    check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    alert: '<path d="M12 3.5l9 16H3z"/><path d="M12 10v4.2M12 17.2v.1"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.2M12 7.8v.1"/>',
    box: '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
    truck: '<path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7z"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    gavel: '<path d="M13.5 4.5l6 6M11 7l6 6M8.5 11.5l4-4 4 4-4 4z"/><path d="M10.5 13.5L4 20"/>',
    tag: '<path d="M3.5 12.5V4h8.5l8.5 8.5-8 8z"/><circle cx="8" cy="8.5" r="1.4"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    star: '<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    upload: '<path d="M12 16V5M7.5 9.5L12 5l4.5 4.5M4.5 15v4.5h15V15"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8.5 8.5"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4.2h-4.2"/>',
    euro: '<path d="M17.5 6.5A6.5 6.5 0 1 0 17.5 17.5"/><path d="M4.5 10.5h8M4.5 13.5h8"/>',
    chat: '<path d="M4 5.5h16v10H9l-5 4z"/>',
    bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
    logout: '<path d="M14.5 4.5h-9v15h9M10.5 12h10M17 8.5l3.5 3.5-3.5 3.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
    home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5.5h4V20"/>'
  };
  function ico(name, cls) {
    return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  /* ── API ────────────────────────────────────────────────────────────── */
  // Never rejects: resolves to { ok, status, data }.
  function api(path, opts) {
    opts = opts || {};
    var init = { method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'), credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    return fetch(path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        return { ok: r.ok, status: r.status, data: data || {} };
      });
    }, function () {
      return { ok: false, status: 0, data: { code: 'network', error: 'Network error' } };
    });
  }
  // Two answers are better met with a next step than with an error message:
  // confirm your email, or verify as a seller with Stripe.
  function market(route, opts) {
    return api('/api/market/' + route, opts).then(function (res) {
      var code = res && res.data && res.data.code;
      if (code === 'verify_email') verifyPrompt();
      else if (code === 'seller_unverified') sellerPrompt();
      return res;
    });
  }
  // The server sends a stable code with every error; show it in the
  // visitor's language and fall back to its English message.
  function errText(res) {
    var dt = (res && res.data) || {};
    if (dt.code === 'verify_email' || dt.code === 'seller_unverified') return '';   // a dialog explains these
    if (dt.code && has('e_' + dt.code)) {
      return t('e_' + dt.code, {
        amount: dt.amount != null ? money(dt.amount, true) : '',
        min: dt.min != null ? money(dt.min) : '', max: dt.max != null ? money(dt.max) : '',
        list: (dt.missing || []).map(function (k) { return t('kind_' + k); }).join(', ')
      });
    }
    if (res && res.status === 503) return t('e_offline');
    return dt.error || t('e_generic');
  }

  /* ── member ─────────────────────────────────────────────────────────── */
  function remember(u) {
    // keeps the main site's header in step with the Vault session
    try {
      if (u) w.localStorage.setItem('shoelab_user', JSON.stringify({ name: u.name, email: u.email }));
      else w.localStorage.removeItem('shoelab_user');
    } catch (e) {}
  }
  function loadConfig() {
    return market('config').then(function (res) {
      if (res.ok) { config = res.data; me = res.data.me || null; remember(me); }
      else if (res.status !== 0) { config = null; }
      return res;
    });
  }

  // Resolves with the member once signed in, or null if they close the form.
  function requireAuth(reasonKey) {
    if (me) return Promise.resolve(me);
    return new Promise(function (resolve) { openAuth(reasonKey, resolve); });
  }
  // Bidding, buying, offers and selling also need a confirmed email address.
  // Ask before a form is filled in, not after; the member may have confirmed
  // in another tab since this page loaded, so check with the server first.
  function requireVerified(reasonKey) {
    return requireAuth(reasonKey).then(function (u) {
      if (!u || u.verified !== false) return u;
      return loadConfig().then(function () {
        renderVerifyBar();
        if (me && me.verified !== false) return me;
        if (me) verifyPrompt();
        return null;
      });
    });
  }

  function openAuth(reasonKey, done) {
    var mode = 'in', finished = false;
    var m = modal({
      title: t('authTitle'),
      html:
        (reasonKey ? '<p>' + esc(t(reasonKey)) + '</p>' : '<p>' + esc(t('authWhy')) + '</p>') +
        '<div class="v-auth-tabs" role="tablist">' +
          '<button type="button" class="on" data-mode="in" role="tab" aria-selected="true">' + esc(t('signIn')) + '</button>' +
          '<button type="button" data-mode="up" role="tab" aria-selected="false">' + esc(t('createAccount')) + '</button>' +
        '</div>' +
        '<form novalidate>' +
          '<div class="v-field" data-only="up" hidden><label class="v-label" for="vaName">' + esc(t('yourName')) + '</label>' +
            '<input class="v-input" id="vaName" autocomplete="name" maxlength="80"/></div>' +
          '<div class="v-field"><label class="v-label" for="vaEmail">' + esc(t('email')) + '</label>' +
            '<input class="v-input" id="vaEmail" type="email" autocomplete="email" inputmode="email" maxlength="254"/></div>' +
          '<div class="v-field"><label class="v-label" for="vaPass"><span>' + esc(t('password')) + '</span><small data-only="up" hidden>' + esc(t('pwHint')) + '</small></label>' +
            '<input class="v-input" id="vaPass" type="password" autocomplete="current-password"/></div>' +
          '<button class="v-btn block" type="submit" id="vaGo">' + esc(t('signIn')) + '</button>' +
          '<div class="v-msg" role="alert"></div>' +
          '<p class="v-note" style="text-align:center;margin-top:0.6rem;" data-only="in"><a class="v-link-btn" href="/account.html">' + esc(t('forgotPw')) + '</a></p>' +
          '<p class="v-note" style="margin-top:0.8rem;" data-only="up" hidden>' + esc(t('authTerms')) +
            ' <a class="v-link-btn" href="/vault-terms.html" target="_blank" rel="noopener">' + esc(t('termsLink')) + '</a> · ' +
            '<a class="v-link-btn" href="/datenschutz.html" target="_blank" rel="noopener">' + esc(t('privacyLink')) + '</a></p>' +
        '</form>',
      onClose: function () { if (!finished) { finished = true; done(null); } }
    });
    var form = m.$('form'), msg = m.$('.v-msg'), go = m.$('#vaGo');
    function setMode(x) {
      mode = x;
      Array.prototype.forEach.call(m.el.querySelectorAll('.v-auth-tabs button'), function (b) {
        var on = b.getAttribute('data-mode') === x;
        b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      Array.prototype.forEach.call(m.el.querySelectorAll('[data-only]'), function (el) {
        el.hidden = el.getAttribute('data-only') !== x;
      });
      m.$('#vaPass').setAttribute('autocomplete', x === 'up' ? 'new-password' : 'current-password');
      go.textContent = t(x === 'up' ? 'createAccount' : 'signIn');
      msg.textContent = ''; msg.className = 'v-msg';
    }
    Array.prototype.forEach.call(m.el.querySelectorAll('.v-auth-tabs button'), function (b) {
      b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = m.$('#vaName').value.trim(), email = m.$('#vaEmail').value.trim(), pass = m.$('#vaPass').value;
      var bad = function (k) { msg.textContent = t(k); msg.className = 'v-msg bad'; };
      if (mode === 'up' && !name) return bad('e_name');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return bad('e_email');
      if (mode === 'up' ? pass.length < 8 : !pass) return bad(mode === 'up' ? 'e_pwShort' : 'e_pw');
      busy(go, true);
      api('/api/account/' + (mode === 'up' ? 'signup' : 'login'), {
        // the confirmation link brings a new member back to this very page
        body: mode === 'up' ? { name: name, email: email, password: pass, next: here() } : { email: email, password: pass }
      }).then(function (res) {
        if (!res.ok || !res.data.user) {
          busy(go, false);
          if (res.status === 401) return bad('e_login');
          if (res.status === 409) return bad('e_exists');
          if (res.status === 0) return bad('e_network');
          msg.textContent = res.data.error || t('e_generic'); msg.className = 'v-msg bad';
          return;
        }
        loadConfig().then(function () {
          if (!me) me = { id: res.data.user.id, name: res.data.user.name, email: res.data.user.email, specialist: false };
          remember(me);
          finished = true;
          m.close(true);
          renderChrome();
          if (mode === 'up') toast(t('welcomeVerify', { name: firstName(me.name), email: me.email }), 'ok');
          else toast(t('welcomeBack', { name: firstName(me.name) }), 'ok');
          if (page.onAuth) page.onAuth(me);
          done(me);
        });
      });
    });
  }

  function signOut() {
    api('/api/account/logout', { body: {} }).then(function () {
      me = null; remember(null);
      w.location.href = '/vault.html';
    });
  }

  /* ── UI helpers ─────────────────────────────────────────────────────── */
  function busy(btn, on) {
    if (!btn) return;
    if (on) {
      if (btn.__label == null) btn.__label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spin" aria-hidden="true"></span>' + btn.__label;
    } else {
      btn.disabled = false;
      if (btn.__label != null) { btn.innerHTML = btn.__label; btn.__label = null; }
    }
  }

  function toast(text, kind) {
    if (!text) return;
    var box = d.querySelector('.v-toasts');
    if (!box) { box = d.createElement('div'); box.className = 'v-toasts'; box.setAttribute('aria-live', 'polite'); d.body.appendChild(box); }
    var el = d.createElement('div');
    kind = kind || 'info';
    el.className = 'v-toast ' + kind;
    el.setAttribute('role', kind === 'bad' ? 'alert' : 'status');
    el.innerHTML = ico(kind === 'ok' ? 'check' : kind === 'bad' ? 'alert' : 'info') + '<span>' + esc(text) + '</span>';
    box.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, kind === 'bad' ? 6500 : 4200);
  }

  var modalSeq = 0;
  // { title, html, foot, wide, onOpen(m), onClose() } → { el, $, close(quiet) }
  function modal(o) {
    var wrap = d.createElement('div');
    var id = 'vModal' + (++modalSeq);
    wrap.className = 'v-modal-wrap';
    wrap.innerHTML =
      '<div class="v-modal' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="' + id + '">' +
        '<div class="v-modal-head"><h2 id="' + id + '">' + esc(o.title) + '</h2>' +
        '<button type="button" class="v-modal-x" aria-label="' + esc(t('close')) + '">✕</button></div>' +
        '<div class="v-modal-body">' + (o.html || '') + '</div>' +
        (o.foot ? '<div class="v-modal-foot">' + o.foot + '</div>' : '') +
      '</div>';
    var prev = d.activeElement, closed = false;
    d.body.appendChild(wrap);
    d.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { wrap.classList.add('open'); });
    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      var f = Array.prototype.filter.call(wrap.querySelectorAll('button,a[href],input,select,textarea'), function (x) {
        return !x.disabled && x.offsetParent !== null;
      });
      if (!f.length) return;
      if (e.shiftKey && d.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && d.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
    function close(quiet) {
      if (closed) return;
      closed = true;
      wrap.classList.remove('open');
      d.removeEventListener('keydown', onKey);
      setTimeout(function () {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        if (!d.querySelector('.v-modal-wrap')) d.body.style.overflow = '';
      }, 200);
      try { if (prev && prev.focus) prev.focus(); } catch (e) {}
      if (!quiet && o.onClose) o.onClose();
    }
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(); });
    wrap.querySelector('.v-modal-x').addEventListener('click', function () { close(); });
    d.addEventListener('keydown', onKey);
    var api = { el: wrap.querySelector('.v-modal'), close: close, $: function (s) { return wrap.querySelector(s); } };
    setTimeout(function () {
      var f = wrap.querySelector('.v-modal-body input:not([type=hidden]),.v-modal-body select,.v-modal-body textarea') ||
        wrap.querySelector('.v-modal-foot .v-btn') || wrap.querySelector('.v-modal-x');
      if (f) try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); }
    }, 60);
    if (o.onOpen) o.onOpen(api);
    return api;
  }

  // a yes/no question; resolves true or false
  function confirmBox(title, text, yesLabel, danger) {
    return new Promise(function (resolve) {
      var answered = false;
      var m = modal({
        title: title,
        html: '<p>' + esc(text) + '</p>',
        foot: '<button type="button" class="v-btn ghost" data-no>' + esc(t('cancel')) + '</button>' +
              '<button type="button" class="v-btn' + (danger ? ' danger' : '') + '" data-yes>' + esc(yesLabel || t('confirm')) + '</button>',
        onClose: function () { if (!answered) { answered = true; resolve(false); } }
      });
      m.$('[data-no]').addEventListener('click', function () { m.close(); });
      m.$('[data-yes]').addEventListener('click', function () { answered = true; m.close(true); resolve(true); });
    });
  }

  /* ── listing presentation ───────────────────────────────────────────── */
  function tierBadge(tier) {
    var lab = tier === 'lab';
    return '<span class="v-badge ' + (lab ? 'lab' : 'photo') + '" title="' + esc(t(lab ? 'tierLabTip' : 'tierPhotoTip')) + '">' +
      ico(lab ? 'shield' : 'camera') + '<span>' + esc(t(lab ? 'tierLab' : 'tierPhoto')) + '</span></span>';
  }
  function condLabel(c) { return t('cond_' + c); }
  function countdownHtml(iso) {
    var c = left(iso);
    return '<span class="v-cd' + (c.over ? ' over' : c.now ? ' soon now' : c.soon ? ' soon' : '') + '" data-ends="' + esc(iso) + '">' +
      ico('clock') + '<span class="cd-t">' + esc(c.text) + '</span></span>';
  }
  function photoHtml(src, alt, cut, lazy) {
    if (!src) return '<div class="noimg">' + ico('image') + '</div>';
    return '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '"' + (cut ? ' class="cut"' : '') + (lazy === false ? '' : ' loading="lazy"') + ' decoding="async"/>';
  }
  function itemHref(it) { return '/vault-item.html?' + (it.preview ? 'preview=' : 'id=') + it.id; }
  function heartHtml(it) {
    return '<button type="button" class="v-heart' + (it.watching ? ' on' : '') + '" data-watch="' + it.id + '"' +
      (it.preview ? ' data-preview' : '') + ' aria-pressed="' + (it.watching ? 'true' : 'false') + '" aria-label="' + esc(t('watchAria')) + '">' + ico('heart') + '</button>';
  }

  // the listing tile used by browse, the dashboard and "more like this"
  function card(it, o) {
    o = o || {};
    var auction = it.format === 'auction', live = it.status === 'live', sold = it.status === 'sold' || o.sold;
    var label, value = money(it.price), right = '';
    if (sold) { label = t('soldFor'); right = it.updatedAt || it.soldAt ? esc(fmtDate(it.soldAt || it.updatedAt)) : ''; }
    else if (auction) { label = it.bids ? t('currentBid') : t('startingBid'); right = esc(tn('bids', it.bids || 0)); }
    else { label = t('buyNow'); right = it.acceptOffers ? '<em>' + esc(t('orBestOffer')) + '</em>' : ''; }
    if (!sold && auction && it.buyNow && !it.bids) right = '<em>' + esc(t('binShort', { amount: money(it.buyNow) })) + '</em>';
    var meta = 'EU ' + esc(it.size) + ' · ' + esc(condLabel(it.cond));
    return '<article class="v-card' + (sold ? ' sold' : '') + '">' +
      '<div class="v-card-img">' + photoHtml(it.photo, it.title, it.cut) +
        '<div class="v-card-top">' + tierBadge(it.tier) + (o.noHeart || sold ? '' : heartHtml(it)) + '</div>' +
        '<div class="v-card-bottom">' +
          (it.preview ? '<span class="v-badge example">' + esc(t('example')) + '</span>' : '') +
          (auction && live && it.endsAt ? countdownHtml(it.endsAt) : '') +
          (!live && !sold && it.status ? '<span class="v-badge ghost">' + esc(t('st_' + it.status)) + '</span>' : '') +
        '</div>' +
        (sold ? '<span class="sold-stamp">' + esc(t('st_sold')) + '</span>' : '') +
      '</div>' +
      '<div class="v-card-body">' +
        '<span class="v-card-brand">' + esc(it.brand) + '</span>' +
        '<h3 class="v-card-title">' + esc(it.model) + '</h3>' +
        '<span class="v-card-meta">' + meta + '</span>' +
        '<div class="v-card-price"><div><small>' + esc(label) + '</small><b>' + value + '</b></div><div class="r">' + right + '</div></div>' +
      '</div>' +
      '<a class="cover" href="' + itemHref(it) + '" aria-label="' + esc(it.title + ' · EU ' + it.size + ' · ' + value) + '"></a>' +
    '</article>';
  }
  function skeletonCards(n) {
    var h = '';
    for (var i = 0; i < n; i++) {
      h += '<div class="v-card skel" aria-hidden="true"><div class="v-card-img"><div class="v-skel"></div></div><div class="v-card-body">' +
        '<div class="v-skel" style="height:10px;width:40%"></div><div class="v-skel" style="height:14px;width:85%;margin-top:6px"></div>' +
        '<div class="v-skel" style="height:10px;width:55%;margin-top:6px"></div><div class="v-skel" style="height:20px;width:45%;margin-top:16px"></div></div></div>';
    }
    return h;
  }

  /* ── watchlist hearts (anywhere on any page) ────────────────────────── */
  function setHeart(b, on) {
    b.classList.toggle('on', !!on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  d.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-watch]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    if (b.hasAttribute('data-preview')) { toast(t('previewOnly'), 'info'); return; }
    var id = parseInt(b.getAttribute('data-watch'), 10);
    requireAuth('authWatch').then(function (u) {
      if (!u) return;
      var on = !b.classList.contains('on');
      setHeart(b, on);
      market('watch', { body: { id: id, on: on } }).then(function (res) {
        if (!res.ok) { setHeart(b, !on); toast(errText(res), 'bad'); return; }
        Array.prototype.forEach.call(d.querySelectorAll('[data-watch="' + id + '"]'), function (x) { setHeart(x, res.data.watching); });
        d.dispatchEvent(new CustomEvent('slv:watch', { detail: { id: id, watching: res.data.watching, watchers: res.data.watchers } }));
        toast(t(res.data.watching ? 'watchAdded' : 'watchRemoved'), 'ok');
      });
    });
  });

  /* ── live countdowns ────────────────────────────────────────────────── */
  function tick() {
    Array.prototype.forEach.call(d.querySelectorAll('[data-ends]'), function (el) {
      var c = left(el.getAttribute('data-ends'));
      var txt = el.querySelector('.cd-t') || el;
      if (txt.textContent !== c.text) txt.textContent = c.text;
      if (el.classList.contains('v-cd')) {
        el.classList.toggle('soon', !!c.soon && !c.over);
        el.classList.toggle('now', !!c.now && !c.over);
        el.classList.toggle('over', !!c.over);
      } else {
        el.classList.toggle('soon', !!c.soon && !c.over);
      }
      if (c.over && !el.__over) {
        el.__over = true;
        el.dispatchEvent(new CustomEvent('slv:ended', { bubbles: true }));
      }
    });
  }
  setInterval(tick, 1000);

  /* ── reveal on scroll ───────────────────────────────────────────────── */
  var io = 'IntersectionObserver' in w ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' }) : null;
  function reveal(root) {
    Array.prototype.forEach.call((root || d).querySelectorAll('.v-reveal:not(.in)'), function (el) {
      if (io) io.observe(el); else el.classList.add('in');
    });
  }

  /* ── chrome: header, mobile tab bar, footer ─────────────────────────── */
  function langMenuHtml() {
    return LANGS.map(function (l) {
      return '<button type="button" class="v-menu-item' + (l.c === lang ? ' active' : '') + '" data-lang="' + l.c + '"><span>' + l.f + '</span> ' + l.n + '</button>';
    }).join('');
  }
  function renderChrome() {
    var key = page.key || '';
    var nav = d.getElementById('vNav');
    if (nav) {
      var link = function (k, href, label, extra) {
        return '<a class="v-link' + (k === key ? ' on' : '') + (extra || '') + '" href="' + href + '"' + (k === key ? ' aria-current="page"' : '') + '>' + esc(label) + '</a>';
      };
      nav.innerHTML =
        '<a class="v-brand" href="/vault.html" aria-label="ShoeLab Vault">' +
          '<img src="/img/shoelab-logo-96.png" alt="" width="34" height="34" decoding="async"/>' +
          '<span class="v-brand-text">SHOE<b>LAB</b><i>VAULT</i></span></a>' +
        '<nav class="v-links" aria-label="Vault">' +
          link('browse', '/vault.html', t('navBrowse')) +
          link('sell', '/vault-sell.html', t('navSell')) +
          link('me', '/vault-me.html', t('navMine')) +
          (me && me.specialist ? link('lab', '/vault-lab.html', t('navLab'), ' lab') : '') +
        '</nav>' +
        '<div class="v-tools">' +
          '<a class="v-back" href="/">' + esc(t('backToSite')) + '</a>' +
          '<div class="v-drop"><button type="button" class="v-pill-btn" id="vLangBtn" aria-haspopup="true" aria-expanded="false" aria-label="' + esc(t('language')) + '">🌐 ' + lang.toUpperCase() + ' ▾</button>' +
            '<div class="v-menu" id="vLangMenu">' + langMenuHtml() + '</div></div>' +
          (me
            ? '<div class="v-drop"><button type="button" class="v-pill-btn" id="vAccBtn" aria-haspopup="true" aria-expanded="false">' +
                ico('user') + '<span class="v-acc-name">' + esc(firstName(me.name) || t('account')) + '</span> ▾</button>' +
                '<div class="v-menu" id="vAccMenu">' +
                  '<div class="v-menu-head"><b>' + esc(me.name || '') + '</b><small>' + esc(me.email || '') + '</small></div>' +
                  '<a class="v-menu-item" href="/vault-me.html">' + ico('vault') + esc(t('navMine')) + '</a>' +
                  '<a class="v-menu-item" href="/vault-me.html#watching">' + ico('heart') + esc(t('watchlist')) + '</a>' +
                  '<a class="v-menu-item" href="/vault-sell.html">' + ico('plus') + esc(t('sellPair')) + '</a>' +
                  (me.specialist ? '<a class="v-menu-item" href="/vault-lab.html">' + ico('shield') + esc(t('navLab')) + '</a>' : '') +
                  '<a class="v-menu-item" href="/account.html">' + ico('settings') + esc(t('accountSettings')) + '</a>' +
                  '<button type="button" class="v-menu-item" id="vSignOut">' + ico('logout') + esc(t('signOut')) + '</button>' +
                '</div></div>'
            : '<button type="button" class="v-pill-btn" id="vSignIn">' + ico('user') + esc(t('signIn')) + '</button>') +
          '<a class="v-sell-cta" href="/vault-sell.html">+ ' + esc(t('sellCta')) + '</a>' +
        '</div>';
      wireMenu('vLangBtn', 'vLangMenu');
      wireMenu('vAccBtn', 'vAccMenu');
      var lm = d.getElementById('vLangMenu');
      if (lm) lm.addEventListener('click', function (e) {
        var o = e.target.closest('[data-lang]');
        if (!o) return;
        var L = o.getAttribute('data-lang');
        if (w.SLGeo) w.SLGeo.choose(L);
        want(L);
      });
      var so = d.getElementById('vSignOut');
      if (so) so.addEventListener('click', signOut);
      var si = d.getElementById('vSignIn');
      if (si) si.addEventListener('click', function () { requireAuth(); });
    }

    renderVerifyBar();
    var tab = d.getElementById('vTabbar');
    if (tab) {
      var tb = function (k, href, icon, label, cls) {
        return '<a class="v-tab' + (k === key ? ' on' : '') + (cls ? ' ' + cls : '') + '" href="' + href + '">' + ico(icon) + '<span>' + esc(label) + '</span></a>';
      };
      tab.setAttribute('aria-label', 'Vault');
      tab.innerHTML =
        tb('browse', '/vault.html', 'grid', t('tabBrowse')) +
        tb('sell', '/vault-sell.html', 'plus', t('tabSell'), 'sell') +
        tb('me', '/vault-me.html', 'vault', t('tabMine')) +
        (me && me.specialist ? tb('lab', '/vault-lab.html', 'shield', t('tabLab'))
          : me ? tb('account', '/account.html', 'user', t('account'))
          : '<button type="button" class="v-tab" id="vTabSignIn">' + ico('user') + '<span>' + esc(t('signIn')) + '</span></button>');
      var ts = d.getElementById('vTabSignIn');
      if (ts) ts.addEventListener('click', function () { requireAuth(); });
    }

    var foot = d.getElementById('vFoot');
    if (foot) {
      foot.innerHTML =
        '<div class="v-foot-in">' +
          '<div><b>SHOELAB <span class="gold">VAULT</span></b><p>' + esc(t('footAbout')) + '</p></div>' +
          '<nav class="v-foot-links" aria-label="Footer">' +
            '<a href="/vault.html#how">' + esc(t('footHow')) + '</a>' +
            '<a href="/vault.html#fees">' + esc(t('footFees')) + '</a>' +
            '<a href="/vault-sell.html">' + esc(t('sellPair')) + '</a>' +
            '<a href="/">ShoeLab.de</a>' +
            '<a href="/vault-terms.html">' + esc(t('footTerms')) + '</a>' +
            '<a href="/datenschutz.html">' + esc(t('footPrivacy')) + '</a>' +
            '<a href="/impressum.html">' + esc(t('footImprint')) + '</a>' +
          '</nav>' +
        '</div>' +
        '<div class="v-foot-in" style="margin-top:1rem;"><small>© ' + new Date().getFullYear() + ' ShoeLab · Bremen · ' + esc(t('footTag')) + '</small></div>';
    }
  }
  var openMenu = null;
  function wireMenu(btnId, menuId) {
    var b = d.getElementById(btnId), m = d.getElementById(menuId);
    if (!b || !m) return;
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var on = !m.classList.contains('open');
      closeMenus();
      if (on) { m.classList.add('open'); b.setAttribute('aria-expanded', 'true'); openMenu = [b, m]; }
    });
  }
  function closeMenus() {
    if (openMenu) { openMenu[1].classList.remove('open'); openMenu[0].setAttribute('aria-expanded', 'false'); openMenu = null; }
  }
  d.addEventListener('click', function (e) { if (openMenu && !openMenu[1].contains(e.target)) closeMenus(); });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenus(); });

  /* ── confirming the email address ───────────────────────────────────── */
  function here() { return w.location.pathname + w.location.search + w.location.hash; }
  function resendVerification(btn) {
    busy(btn, true);
    return api('/api/account/resend-verification', { body: { next: here() } }).then(function (res) {
      busy(btn, false);
      if (res.ok) toast(t(res.data.already ? 'verifiedToast' : 'verifySent', { email: me ? me.email : '' }), 'ok');
      else toast(res.data.code === 'verify_wait' ? t('e_verify_wait') : errText(res), 'bad');
      if (res.ok && res.data.already && me) { me.verified = true; renderChrome(); }
    });
  }
  var verifyOpen = false;
  function verifyPrompt() {
    if (verifyOpen || !me) return;
    verifyOpen = true;
    var m = modal({
      title: t('verifyT'),
      html: '<p>' + esc(t('verifyLead', { email: me.email })) + '</p><p class="v-note">' + esc(t('verifyHint')) + '</p>',
      foot: '<button type="button" class="v-btn ghost" data-no>' + esc(t('close')) + '</button>' +
            '<button type="button" class="v-btn" data-go>' + esc(t('verifyResend')) + '</button>',
      onClose: function () { verifyOpen = false; }
    });
    m.$('[data-no]').addEventListener('click', function () { m.close(); });
    m.$('[data-go]').addEventListener('click', function () { resendVerification(m.$('[data-go]')).then(function () { m.close(); }); });
  }
  // The thin bar under the header for members who have not confirmed yet.
  function renderVerifyBar() {
    var bar = d.getElementById('vVerify'), nav = d.getElementById('vNav');
    if (!nav) return;
    if (!bar) { bar = d.createElement('div'); bar.id = 'vVerify'; bar.className = 'v-verify-bar'; nav.parentNode.insertBefore(bar, nav.nextSibling); }
    if (!me || me.verified) { bar.hidden = true; bar.innerHTML = ''; return; }
    bar.hidden = false;
    bar.innerHTML = ico('alert') + '<span>' + esc(t('verifyBar', { email: me.email })) + '</span>' +
      '<button type="button" class="v-btn xs gold" id="vVerifyResend">' + esc(t('verifyResend')) + '</button>';
    d.getElementById('vVerifyResend').onclick = function () { resendVerification(this); };
  }
  // Confirmed in another tab: the bar goes as soon as this one is looked at.
  d.addEventListener('visibilitychange', function () {
    if (!d.hidden && me && me.verified === false) loadConfig().then(renderVerifyBar);
  });
  // Back from a confirmation link (?verified=1 / 0) or from Stripe.
  function arrivedFromEmail() {
    var v = qs('verified');
    if (v == null) return;
    if (v === '1') { toast(t('verifiedToast'), 'ok'); if (me) { me.verified = true; renderVerifyBar(); } }
    else toast(t('verifyExpired'), 'bad');
    try {
      var u = new URL(w.location.href); u.searchParams.delete('verified');
      w.history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch (e) {}
  }

  /* ── seller verification with Stripe ────────────────────────────────── */
  // Opens Stripe's onboarding in a new tab, so a half-filled listing (with
  // its photos) stays exactly as it is. The tab is opened inside the click,
  // so browsers do not block it, and pointed at Stripe once the link exists.
  function payoutsSetup(btn, sameTab) {
    var tab = sameTab ? null : w.open('about:blank', '_blank');
    busy(btn, true);
    return market('payouts/setup', { body: {} }).then(function (res) {
      busy(btn, false);
      if (!res.ok || !res.data.url) {
        if (tab) tab.close();
        toast(errText(res), 'bad');
        return false;
      }
      if (tab) tab.location.href = res.data.url; else w.location.href = res.data.url;
      return true;
    });
  }
  var sellerOpen = false;
  function sellerPrompt() {
    if (sellerOpen) return;
    sellerOpen = true;
    var m = modal({
      title: t('sellerVerifyT'),
      html: '<p>' + esc(t('sellerVerifyLead')) + '</p><ul class="v-flow">' +
        ['sellerVerify1', 'sellerVerify2', 'sellerVerify3'].map(function (k, i) { return '<li><i>' + (i + 1) + '</i><span>' + esc(t(k)) + '</span></li>'; }).join('') +
        '</ul><p class="v-note" style="margin-top:0.9rem;">' + esc(t('sellerVerifyNote')) + '</p>',
      foot: '<button type="button" class="v-btn ghost" data-no>' + esc(t('later')) + '</button>' +
            '<button type="button" class="v-btn gold" data-go>' + esc(t('verifyWithStripe')) + '</button>',
      onClose: function () { sellerOpen = false; }
    });
    m.$('[data-no]').addEventListener('click', function () { m.close(); });
    m.$('[data-go]').addEventListener('click', function () { payoutsSetup(m.$('[data-go]')).then(function (okk) { if (okk) m.close(); }); });
  }

  /* ── boot ───────────────────────────────────────────────────────────── */
  var wanted = null, langReady = false, cfgReady = false;
  function want(L) {
    wanted = L;
    loadLang(L, function () {
      if (wanted !== L) return;              // a newer choice arrived meanwhile
      lang = (L === 'en' || I18N[L]) ? L : 'en';
      if (w.SLGeo && w.SLGeo.remember) w.SLGeo.remember(lang);   // emails follow the same language
      if (!langReady) { langReady = true; maybeStart(); return; }
      if (started) {
        applyI18n(); renderChrome(); tick();
        if (w.SLVHelp) w.SLVHelp.relabel();
        if (page.onLang) page.onLang(lang);
      }
    });
  }
  function maybeStart() {
    if (started || !langReady || !cfgReady) return;
    started = true;
    applyI18n();
    renderChrome();
    if (page.init) page.init(me, config);
    tick();
    reveal();
    d.documentElement.classList.remove('v-wait');
    arrivedFromEmail();
    if (w.SLVHelp) w.SLVHelp.init();
  }
  function boot(p) {
    page = p || {};
    loadConfig().then(function () { cfgReady = true; maybeStart(); });
    if (w.SLGeo) {
      w.SLGeo.resolve(function (L, info) {
        want(L);
        if (info && info.suggest) w.SLGeo.offer(info.suggest, function (c) { want(c); });
      });
    } else {
      want('en');
    }
  }

  /* ── checkout: delivery address, then payment ───────────────────────── */
  function lineHtml(a, b, cls) {
    return '<div class="v-line' + (cls ? ' ' + cls : '') + '"><span>' + esc(a) + '</span><span>' + b + '</span></div>';
  }
  // the buyer's side of the sum: item, authentication, shipping, total
  function totalsHtml(o) {
    return '<div class="v-lines">' +
      lineHtml(t('lineItem'), money(o.itemPrice, true)) +
      lineHtml(t('lineAuth') + ' · ' + t(o.tier === 'lab' ? 'tierLab' : 'tierPhoto'), money(o.authFee, true)) +
      lineHtml(t('lineShip'), money(o.shipFee, true)) +
      lineHtml(t('lineTotal'), money(o.total, true), 'total') +
    '</div>';
  }
  function addressHtml(p) {
    var f = function (id, key, val, ac, extra) {
      return '<div class="v-field"><label class="v-label" for="' + id + '">' + esc(t(key)) + '</label>' +
        '<input class="v-input" id="' + id + '" autocomplete="' + ac + '" value="' + esc(val || '') + '"' + (extra || '') + '/></div>';
    };
    return f('vpName', 'addrName', p.name, 'name', ' maxlength="80"') +
      f('vpLine1', 'addrLine1', p.address, 'address-line1', ' maxlength="120"') +
      f('vpLine2', 'addrLine2', '', 'address-line2', ' maxlength="120"') +
      '<div class="v-row">' + f('vpPostal', 'addrPostal', p.postal, 'postal-code', ' inputmode="numeric" maxlength="5"') +
      f('vpCity', 'addrCity', p.city, 'address-level2', ' maxlength="60"') + '</div>' +
      '<p class="v-note" style="margin:-0.3rem 0 0.9rem;">' + esc(t('addrGermany')) + '</p>';
  }
  function readAddress(m) {
    var g = function (id) { return (m.$('#' + id).value || '').trim(); };
    var a = { name: g('vpName'), line1: g('vpLine1'), line2: g('vpLine2'), postal: g('vpPostal'), city: g('vpCity'), country: 'DE' };
    ['vpName', 'vpLine1', 'vpPostal', 'vpCity'].forEach(function (id) { m.$('#' + id).classList.toggle('err', !g(id)); });
    if (!a.name || !a.line1 || !a.postal || !a.city) return { error: 'e_address' };
    if (!/^\d{5}$/.test(a.postal)) { m.$('#vpPostal').classList.add('err'); return { error: 'e_postal' }; }
    return a;
  }
  // o: { title, tier, itemPrice, authFee, shipFee, total, orderId? , create? }
  // create() makes the order first (Buy Now) and resolves like an API call.
  // Resolves { redirect } when Stripe opens, { manual } when ShoeLab will
  // email payment details, { unpaid } if closed after the order exists, or null.
  function payFlow(o) {
    return requireVerified('authBuy').then(function (u) {
      if (!u) return null;
      return api('/api/account/me').then(function (pr) {
        var p = (pr.ok && pr.data && pr.data.user) || {};
        if (!p.name) p.name = u.name;
        return new Promise(function (resolve) {
          var finished = false, online = !!(config && config.onlinePayment);
          var m = modal({
            title: t(o.create ? 'buyTitle' : 'payTitle'),
            html:
              '<p style="margin-bottom:0.6rem;"><b style="color:#fff;font-weight:500;">' + esc(o.title) + '</b></p>' +
              totalsHtml(o) +
              '<h3 class="v-h3" style="margin:1.3rem 0 0.8rem;">' + esc(t('deliveryTo')) + '</h3>' + addressHtml(p) +
              '<div class="v-state ' + (online ? 'info' : 'gold') + '">' + ico(online ? 'lock' : 'info') + '<span>' + esc(t(online ? (config.connect ? 'payNoteHeld' : 'payNoteOnline') : 'payNoteManual')) + '</span></div>' +
              '<p class="v-note" style="margin-top:0.8rem;">' + (o.create ? esc(t('bindingNote')) + ' ' : '') + esc(t('payTerms')) +
                ' <a class="v-link-btn" href="/vault-terms.html" target="_blank" rel="noopener">' + esc(t('termsLink')) + '</a> · ' +
                '<a class="v-link-btn" href="/datenschutz.html" target="_blank" rel="noopener">' + esc(t('privacyLink')) + '</a></p>' +
              '<div class="v-msg" role="alert"></div>',
            foot: '<button type="button" class="v-btn block" data-go>' + esc(t(online ? 'payBtn' : 'reserveBtn', { amount: money(o.total, true) })) + '</button>',
            onClose: function () {
              if (finished) return;
              finished = true;
              resolve(o.orderId ? { unpaid: true, orderId: o.orderId } : null);
            }
          });
          var go = m.$('[data-go]'), msg = m.$('.v-msg');
          var fail = function (text) { busy(go, false); msg.textContent = text; msg.className = 'v-msg bad'; };
          go.addEventListener('click', function () {
            var a = readAddress(m);
            if (a.error) { msg.textContent = t(a.error); msg.className = 'v-msg bad'; return; }
            busy(go, true);
            msg.textContent = '';
            var first = o.orderId ? Promise.resolve({ ok: true, data: { orderId: o.orderId } }) : o.create();
            first.then(function (res) {
              if (!res.ok) { fail(errText(res)); return; }
              o.orderId = res.data.orderId;          // a retry pays, it never buys twice
              market('order/pay', { body: { orderId: o.orderId, address: a } }).then(function (pay) {
                if (pay.ok && pay.data.url) { finished = true; resolve({ redirect: true, orderId: o.orderId }); w.location.href = pay.data.url; return; }
                if (pay.ok) { finished = true; m.close(true); resolve({ manual: true, orderId: o.orderId }); return; }
                fail(errText(pay));
              });
            });
          });
        });
      });
    });
  }

  /* ── relisting an ended pair with new terms ──────────────────────────── */
  function relistFlow(l) {
    return new Promise(function (resolve) {
      var done = false, fmt = l.format === 'auction' ? 'auction' : 'fixed';
      var durs = (config && config.durations) || [1, 3, 5, 7];
      var money1 = function (id, key, val, small) {
        return '<div class="v-field"><label class="v-label" for="' + id + '"><span>' + esc(t(key)) + '</span>' + (small ? '<small>' + esc(t(small)) + '</small>' : '') + '</label>' +
          '<div class="v-money"><input class="v-input" id="' + id + '" inputmode="decimal" autocomplete="off" value="' + esc(val) + '"/></div></div>';
      };
      var m = modal({
        title: t('relistT'),
        html:
          '<p>' + esc(t('relistLead')) + '</p>' +
          '<div class="v-seg" style="margin-bottom:1.1rem;" role="tablist">' +
            '<button type="button" data-f="auction">' + esc(t('fAuction')) + '</button>' +
            '<button type="button" data-f="fixed">' + esc(t('fFixed')) + '</button></div>' +
          '<div data-for="auction">' +
            '<div class="v-row">' + money1('vrStart', 'startPrice', amountText(l.startPrice || l.price)) +
              '<div class="v-field"><label class="v-label" for="vrDur">' + esc(t('duration')) + '</label><select class="v-select" id="vrDur">' +
              durs.map(function (x) { return '<option value="' + x + '"' + (x === 7 ? ' selected' : '') + '>' + esc(tn('days', x)) + '</option>'; }).join('') +
              '</select></div></div>' +
            money1('vrBinA', 'binOptional', amountText(l.format === 'auction' ? l.buyNow : null), 'optional') +
          '</div>' +
          '<div data-for="fixed">' +
            money1('vrPrice', 'price', amountText(l.buyNow || l.price)) +
            '<label class="v-switch" style="margin-bottom:0.4rem;"><span>' + esc(t('acceptOffers')) + '</span><input type="checkbox" id="vrOffers"' + (l.acceptOffers ? ' checked' : '') + '/><span class="knob"></span></label>' +
          '</div>' +
          '<div class="v-msg" role="alert"></div>',
        foot: '<button type="button" class="v-btn block gold" data-go>' + esc(t('relistBtn')) + '</button>',
        onClose: function () { if (!done) { done = true; resolve(null); } }
      });
      var setF = function (f) {
        fmt = f;
        Array.prototype.forEach.call(m.el.querySelectorAll('[data-f]'), function (b) { b.classList.toggle('on', b.getAttribute('data-f') === f); });
        Array.prototype.forEach.call(m.el.querySelectorAll('[data-for]'), function (x) { x.hidden = x.getAttribute('data-for') !== f; });
      };
      Array.prototype.forEach.call(m.el.querySelectorAll('[data-f]'), function (b) {
        b.addEventListener('click', function () { setF(b.getAttribute('data-f')); });
      });
      setF(fmt);
      var go = m.$('[data-go]'), msg = m.$('.v-msg');
      go.addEventListener('click', function () {
        var v = function (id) { return parseEuro(m.$('#' + id).value); };
        var body = { id: l.id, format: fmt };
        if (fmt === 'auction') {
          body.startPrice = v('vrStart'); body.duration = parseInt(m.$('#vrDur').value, 10);
          var bin = m.$('#vrBinA').value.trim();
          if (bin) body.buyNow = v('vrBinA');
          if (isNaN(body.startPrice) || (bin && isNaN(body.buyNow))) { msg.textContent = t('e_priceInput'); msg.className = 'v-msg bad'; return; }
        } else {
          body.buyNow = v('vrPrice'); body.acceptOffers = m.$('#vrOffers').checked;
          if (isNaN(body.buyNow)) { msg.textContent = t('e_priceInput'); msg.className = 'v-msg bad'; return; }
        }
        busy(go, true);
        market('listing/relist', { body: body }).then(function (res) {
          if (!res.ok) { busy(go, false); msg.textContent = errText(res); msg.className = 'v-msg bad'; return; }
          done = true; m.close(true); resolve(res.data.id);
        });
      });
    });
  }

  /* ── example listings for preview mode ──────────────────────────────── */
  // Shown only behind ?preview=1 or the "see an example" button, always with
  // an "Example" badge and a banner. None of them is for sale.
  function previewItems() {
    var now = Date.now(), H = 3600000;
    var iso = function (ms) { return new Date(now + ms).toISOString(); };
    return [
      { id: 1, brand: 'Jordan', model: 'Air Jordan 1 Low “Panda”', size: '43', cond: 'like_new', format: 'auction', tier: 'lab',
        price: 9600, startPrice: 6000, buyNow: null, bids: 7, endsAt: iso(27 * H + 12 * 60000), acceptOffers: false, watchers: 14,
        photo: '/img/showcase/jordan1.webp', descKey: 'pvDesc1' },
      { id: 2, brand: 'New Balance', model: '9060 “Black Castlerock”', size: '42', cond: 'new', format: 'auction', tier: 'lab',
        price: 14000, startPrice: 9000, buyNow: null, bids: 4, endsAt: iso(41 * 60000), acceptOffers: false, watchers: 22,
        photo: '/img/showcase/nb9060-black.webp', descKey: 'pvDesc2' },
      { id: 3, brand: 'New Balance', model: 'Fresh Foam X 1080', size: '44.5', cond: 'like_new', format: 'fixed', tier: 'photo',
        price: 11900, buyNow: 11900, bids: 0, endsAt: null, acceptOffers: true, watchers: 6,
        photo: '/img/showcase/nb1080.webp', descKey: 'pvDesc3' },
      { id: 4, brand: 'New Balance', model: 'Fresh Foam X 880', size: '41.5', cond: 'good', format: 'auction', tier: 'photo',
        price: 5500, startPrice: 5500, buyNow: 9500, bids: 0, endsAt: iso(3 * 24 * H + 5 * H), acceptOffers: false, watchers: 3,
        photo: '/img/showcase/nb880.webp', descKey: 'pvDesc4' }
    ].map(function (x) {
      x.preview = true; x.cut = true; x.status = 'live'; x.title = titleOf(x.brand, x.model);
      return x;
    });
  }

  w.SLV = {
    t: t, tn: tn, has: has, lang: function () { return lang; }, locale: loc, started: function () { return started; },
    money: money, num: num, fmtDate: fmtDate, fmtDateTime: fmtDateTime, fmtShort: fmtShort, ago: ago, left: left,
    esc: esc, initials: initials, firstName: firstName, qs: qs, parseEuro: parseEuro, centsOf: centsOf, amountText: amountText,
    titleOf: titleOf, ico: ico,
    api: api, market: market, errText: errText,
    me: function () { return me; }, config: function () { return config; }, reloadConfig: loadConfig,
    requireAuth: requireAuth, requireVerified: requireVerified, signOut: signOut, verifyPrompt: verifyPrompt, resendVerification: resendVerification,
    sellerPrompt: sellerPrompt, payoutsSetup: payoutsSetup,
    busy: busy, toast: toast, modal: modal, confirm: confirmBox,
    tierBadge: tierBadge, condLabel: condLabel, countdownHtml: countdownHtml, photoHtml: photoHtml,
    totalsHtml: totalsHtml, lineHtml: lineHtml, payFlow: payFlow, relistFlow: relistFlow,
    card: card, skeletonCards: skeletonCards, itemHref: itemHref, heartHtml: heartHtml,
    applyI18n: applyI18n, renderChrome: renderChrome, reveal: reveal, tick: tick,
    previewItems: previewItems, boot: boot
  };
})(window, document);
