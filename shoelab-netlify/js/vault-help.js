/* ShoeLab Vault — Wesley, the support chat on every Vault page.
 *
 * Wesley answers in the visitor's language from the Vault's own rules and,
 * for a signed-in member, their orders (all of that is assembled on the
 * server, /api/market/support/chat). When something needs a person, he opens
 * a request for a ShoeLab specialist; the "Talk to a specialist" form does
 * the same without the assistant. The conversation survives moving between
 * Vault pages (sessionStorage) and is gone when the tab closes. */
(function (w, d) {
  'use strict';
  var S = w.SLV;
  if (!S) return;
  var t = S.t, esc = S.esc;
  var KEY = 'slv_chat', open = false, sending = false, root = null, log = [];

  function load() { try { log = JSON.parse(w.sessionStorage.getItem(KEY) || '[]') || []; } catch (e) { log = []; } }
  function save() { try { w.sessionStorage.setItem(KEY, JSON.stringify(log.slice(-30))); } catch (e) {} }
  function online() { var c = S.config(); return !!(c && c.support); }

  // Wesley may point to pages like /vault-me.html: those become links,
  // nothing else does.
  function linkify(text) {
    return esc(text).replace(/(^|[\s(])(\/(?:vault[a-z-]*|account|datenschutz|impressum|agb)\.html(?:#[a-z-]+)?)/g,
      '$1<a href="$2">$2</a>').replace(/\n/g, '<br>');
  }
  function bubble(m) {
    if (m.role === 'note') return '<div class="v-help-note">' + S.ico('check') + '<span>' + esc(m.text) + '</span></div>';
    return '<div class="v-help-msg ' + (m.role === 'user' ? 'me' : 'bot') + '">' + (m.role === 'user' ? esc(m.text).replace(/\n/g, '<br>') : linkify(m.text)) + '</div>';
  }
  function chips() {
    return '<div class="v-help-chips">' + ['helpQ1', 'helpQ2', 'helpQ3', 'helpQ4'].map(function (k) {
      return '<button type="button" data-ask="' + k + '">' + esc(t(k)) + '</button>';
    }).join('') + '</div>';
  }

  function render() {
    if (!root) return;
    var body = root.querySelector('.v-help-body');
    var intro = '<div class="v-help-msg bot">' + esc(t(online() ? 'helpHello' : 'helpOffline')) + '</div>';
    body.innerHTML = intro + (log.length || !online() ? '' : chips()) + log.map(bubble).join('') +
      (sending ? '<div class="v-help-msg bot typing" aria-label="' + esc(t('helpTyping')) + '"><i></i><i></i><i></i></div>' : '');
    body.scrollTop = body.scrollHeight;
  }

  function relabel() {
    if (!root) return;
    root.querySelector('.v-help-fab span').textContent = t('helpFab');
    root.querySelector('.v-help-fab').setAttribute('aria-label', t('helpOpen'));
    root.querySelector('.v-help-head b').textContent = t('helpTitle');
    root.querySelector('.v-help-head small').textContent = t(online() ? 'helpSub' : 'helpSubOffline');
    root.querySelector('.v-help-x').setAttribute('aria-label', t('close'));
    root.querySelector('#vHelpInput').setAttribute('placeholder', t('helpPh'));
    root.querySelector('.v-help-send').setAttribute('aria-label', t('helpSend'));
    root.querySelector('.v-help-human').textContent = t('helpHuman');
    renderForm(false);
    render();
  }

  /* ── talking to Wesley ────────────────────────────────────────────── */
  function ask(text) {
    text = String(text || '').trim();
    if (!text || sending) return;
    if (!online()) { renderForm(true, text); return; }
    log.push({ role: 'user', text: text });
    sending = true; save(); render();
    var convo = log.filter(function (m) { return m.role === 'user' || m.role === 'assistant'; }).slice(-12);
    S.market('support/chat', { body: { messages: convo, page: w.location.pathname + w.location.search } }).then(function (res) {
      sending = false;
      if (res.status === 429) log.push({ role: 'assistant', text: t('helpLimit') });
      else if (!res.ok) log.push({ role: 'assistant', text: t('helpError') });
      else {
        log.push({ role: 'assistant', text: res.data.reply || t('helpError') });
        if (res.data.ticket) log.push({ role: 'note', text: t('helpTicket', { n: res.data.ticket.id }) });
        if (res.data.needContact) renderForm(true, text);
      }
      save(); render();
    });
  }

  /* ── the specialist form ──────────────────────────────────────────── */
  function renderForm(show, prefill) {
    var f = root.querySelector('.v-help-form');
    if (!show) { if (!f.hidden && !f.__dirty) f.hidden = true; return; }
    var me = S.me();
    f.hidden = false;
    f.innerHTML =
      '<p class="v-help-form-t">' + esc(t('helpFormT')) + '</p>' +
      (me ? '<p class="v-note">' + esc(t('helpFormMember', { email: me.email })) + '</p>'
        : '<div class="v-row"><input class="v-input" id="vhName" autocomplete="name" placeholder="' + esc(t('yourName')) + '" maxlength="80"/>' +
          '<input class="v-input" id="vhEmail" type="email" autocomplete="email" placeholder="' + esc(t('email')) + '" maxlength="254"/></div>') +
      '<select class="v-select" id="vhTopic">' + ['order', 'payment', 'account', 'authentication', 'technical', 'other'].map(function (k) {
        return '<option value="' + k + '">' + esc(t('topic_' + k)) + '</option>';
      }).join('') + '</select>' +
      '<textarea class="v-textarea" id="vhMsg" rows="3" maxlength="2000" placeholder="' + esc(t('helpFormPh')) + '"></textarea>' +
      '<div class="v-msg" role="alert"></div>' +
      '<div class="v-btn-row"><button type="button" class="v-btn ghost sm" data-form="cancel">' + esc(t('cancel')) + '</button>' +
      '<button type="button" class="v-btn sm" data-form="send">' + esc(t('helpFormSend')) + '</button></div>';
    if (prefill) f.querySelector('#vhMsg').value = prefill;
    f.__dirty = true;
    setTimeout(function () { var el = f.querySelector(me ? '#vhMsg' : '#vhName'); if (el) el.focus(); }, 30);
  }
  function sendForm(btn) {
    var f = root.querySelector('.v-help-form'), me = S.me(), msg = f.querySelector('.v-msg');
    var val = function (id) { var el = f.querySelector('#' + id); return el ? el.value.trim() : ''; };
    var body = { message: val('vhMsg'), topic: val('vhTopic'), page: w.location.pathname + w.location.search,
      transcript: log.filter(function (m) { return m.role !== 'note'; }).slice(-12) };
    if (!me) { body.name = val('vhName'); body.email = val('vhEmail'); }
    if (body.message.length < 10) { msg.textContent = t('e_support_short'); msg.className = 'v-msg bad'; return; }
    if (!me && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email)) { msg.textContent = t('e_email'); msg.className = 'v-msg bad'; return; }
    S.busy(btn, true);
    S.market('support/ticket', { body: body }).then(function (res) {
      S.busy(btn, false);
      if (!res.ok) { msg.textContent = res.status === 429 ? t('helpLimit') : S.errText(res); msg.className = 'v-msg bad'; return; }
      f.__dirty = false; f.hidden = true;
      log.push({ role: 'note', text: t('helpTicket', { n: res.data.ticket.id }) });
      save(); render();
    });
  }

  /* ── the widget ───────────────────────────────────────────────────── */
  function toggle(on) {
    open = on == null ? !open : on;
    root.classList.toggle('open', open);
    root.querySelector('.v-help-fab').setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      render();
      if (!online()) renderForm(true);
      setTimeout(function () { root.querySelector('#vHelpInput').focus(); }, 60);
    }
  }
  function init() {
    if (root) { relabel(); return; }
    load();
    root = d.createElement('div');
    root.className = 'v-help';
    root.innerHTML =
      '<button type="button" class="v-help-fab" aria-expanded="false"><span class="v-help-av" aria-hidden="true">W</span><span></span></button>' +
      '<section class="v-help-panel" role="dialog" aria-modal="false" aria-labelledby="vHelpTitle">' +
        '<header class="v-help-head"><span class="v-help-av" aria-hidden="true">W</span><div><b id="vHelpTitle"></b><small></small></div>' +
          '<button type="button" class="v-help-x">✕</button></header>' +
        '<div class="v-help-body" aria-live="polite"></div>' +
        '<div class="v-help-form" hidden></div>' +
        '<form class="v-help-input"><textarea id="vHelpInput" rows="1" maxlength="1500"></textarea>' +
          '<button type="submit" class="v-help-send">' + S.ico('right') + '</button></form>' +
        '<button type="button" class="v-help-human"></button>' +
      '</section>';
    d.body.appendChild(root);
    root.querySelector('.v-help-fab').addEventListener('click', function () { toggle(); });
    root.querySelector('.v-help-x').addEventListener('click', function () { toggle(false); root.querySelector('.v-help-fab').focus(); });
    root.querySelector('.v-help-human').addEventListener('click', function () {
      var last = log.filter(function (m) { return m.role === 'user'; }).pop();
      renderForm(true, last ? last.text : '');
    });
    var input = root.querySelector('#vHelpInput');
    root.querySelector('.v-help-input').addEventListener('submit', function (e) { e.preventDefault(); var v = input.value; input.value = ''; input.style.height = ''; ask(v); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); root.querySelector('.v-help-input').requestSubmit(); }
    });
    input.addEventListener('input', function () { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
    root.addEventListener('click', function (e) {
      var a = e.target.closest('[data-ask]');
      if (a) { ask(t(a.getAttribute('data-ask'))); return; }
      var f = e.target.closest('[data-form]');
      if (!f) return;
      if (f.getAttribute('data-form') === 'send') sendForm(f);
      else { var form = root.querySelector('.v-help-form'); form.__dirty = false; form.hidden = true; }
    });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) toggle(false); });
    if (/#help$/.test(w.location.hash)) toggle(true);
    relabel();
  }

  w.SLVHelp = { init: init, relabel: relabel, open: function () { if (root) toggle(true); } };
})(window, document);
