/* ShoeLab Vault — the specialist console (vault-lab.html).
 * The review queue (approve or reject new listings from their photos), every
 * order that needs the lab (manual payments, parcels arriving for inspection,
 * the pass/fail call, shipping on, reported problems, payouts to retry), and
 * the support requests Wesley or the help form handed over.
 * Access is decided by the server (VAULT_SPECIALISTS); this page only asks. */
(function (w, d) {
  'use strict';
  var S = w.SLV, t = S.t, esc = S.esc, money = S.money;
  var $ = function (id) { return d.getElementById(id); };
  var data = null, tab = /#support$/.test(w.location.hash) ? 'support' : /#orders$/.test(w.location.hash) ? 'orders' : 'review', timer = null;
  var drafts = {};   // answers being written survive the minute-by-minute refresh

  function load() {
    return S.market('queue').then(function (res) {
      if (res.status === 401) { gate('lock', 'gateT', 'gateLab', true); return; }
      // on the list, but the address is not confirmed yet (the bar above offers the link)
      if (res.status === 403 && res.data.code === 'verify_email') { gate('alert', 'verifyT', null, false, t('verifyLead', { email: (S.me() || {}).email || '' })); return; }
      if (res.status === 403) { gate('shield', 'labOnlyT', 'labOnly', false); return; }
      if (!res.ok) { gate('alert', 'emptyErrorT', null, false, S.errText(res)); return; }
      keepDrafts();
      data = res.data;
      render();
      clearTimeout(timer);
      timer = setTimeout(function () { if (!d.hidden) load(); }, 60000);
    });
  }
  function gate(icon, tk, pk, signIn, text) {
    $('labBody').innerHTML = '<div class="v-empty">' + S.ico(icon) + '<h3>' + esc(t(tk)) + '</h3><p>' + esc(text || t(pk)) + '</p>' +
      (signIn ? '<div class="v-btn-row"><button type="button" class="v-btn" id="labSignIn">' + esc(t('signIn')) + '</button></div>' : '') + '</div>';
    if (signIn) $('labSignIn').onclick = function () { S.requireAuth().then(function (u) { if (u) load(); }); };
  }

  /* ── pieces ───────────────────────────────────────────────────────── */
  function stat(label, value) { return '<div class="v-stat"><small>' + esc(label) + '</small><b>' + value + '</b></div>'; }
  function kv(k, v) { return v == null || v === '' ? '' : '<dt>' + esc(k) + '</dt><dd>' + v + '</dd>'; }
  function checklist(key) {
    return '<details class="v-faq" style="margin:0.8rem 0;"><summary>' + esc(t('labChecklist')) + '</summary><div><ul class="v-flow" style="margin-top:0;">' +
      [1, 2, 3, 4, 5, 6].map(function (i) { return '<li><i>' + i + '</i><span>' + esc(t(key + i)) + '</span></li>'; }).join('') +
      '</ul></div></details>';
  }
  function photosHtml(list) {
    return '<div class="v-review-photos">' + (list || []).map(function (p) {
      return '<a href="' + esc(p.url) + '" target="_blank" rel="noopener"><img src="' + esc(p.url) + '" alt="" loading="lazy"/><span>' + esc(t('kind_' + p.kind)) + '</span></a>';
    }).join('') + '</div>';
  }

  function sellerChips(sl) {
    var c = '<span class="v-chip ' + (sl.emailVerified ? 'ok' : 'warn') + '">' + esc(t(sl.emailVerified ? 'chipEmailOk' : 'chipEmailNo')) + '</span>';
    if (data.stats && data.stats.connect) c += '<span class="v-chip ' + (sl.verifiedSeller ? 'ok' : 'warn') + '">' + esc(t(sl.verifiedSeller ? 'chipStripeOk' : 'chipStripeNo')) + '</span>';
    return c;
  }
  function reviewHtml(l) {
    var auction = l.format === 'auction';
    return '<article class="v-review" id="rv-' + l.id + '">' +
      '<div>' + photosHtml(l.photos) + '</div>' +
      '<div>' +
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">' + S.tierBadge(l.tier) +
          '<span class="v-chip">' + esc(t(auction ? 'fAuction1' : 'fFixed')) + '</span>' +
          '<span class="v-note">' + esc(t('submitted', { when: S.ago(l.createdAt) })) + '</span></div>' +
        '<h2 class="v-h3" style="margin-top:0.7rem;font-size:1.45rem;">' + esc(l.title) + '</h2>' +
        '<dl class="v-kv">' +
          kv(t('fSize'), 'EU ' + esc(l.size)) + kv(t('fCond'), esc(S.condLabel(l.cond))) +
          (auction ? kv(t('startPrice'), money(l.startPrice, true)) + kv(t('duration'), esc(S.tn('days', l.duration || 0))) : kv(t('price'), money(l.buyNow, true))) +
          (l.buyNow && auction ? kv(t('binOptional'), money(l.buyNow, true)) : '') +
          (l.minOffer ? kv(t('minOffer'), money(l.minOffer, true)) : '') +
          kv(t('seller'), esc((l.seller && l.seller.name) || '') + (l.seller && l.seller.email ? ' · <a href="mailto:' + esc(l.seller.email) + '">' + esc(l.seller.email) + '</a>' : '') +
            '<span style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.35rem;">' + sellerChips(l.seller || {}) + '</span>') +
          kv(t('itemNo'), '#' + l.id) +
        '</dl>' +
        (l.description ? '<p class="v-desc" style="font-size:0.82rem;">' + esc(l.description) + '</p>' : '') +
        checklist(l.tier === 'lab' ? 'ckQuick' : 'ckPhoto') +
        '<div class="v-field"><label class="v-label" for="note' + l.id + '"><span>' + esc(t('noteSeller')) + '</span><small>' + esc(t('noteSellerHint')) + '</small></label>' +
          '<textarea class="v-textarea" id="note' + l.id + '" rows="2" maxlength="500"></textarea></div>' +
        '<div class="v-btn-row"><button type="button" class="v-btn ok sm" data-review="approve" data-id="' + l.id + '">' + esc(t('approve')) + '</button>' +
          '<button type="button" class="v-btn danger sm" data-review="reject" data-id="' + l.id + '">' + esc(t('reject')) + '</button></div>' +
      '</div></article>';
  }

  var TONE = { awaiting_payment: 'warn', paid: 'gold', to_lab: 'gold', in_lab: 'gold', verified: 'ok', disputed: 'bad', delivered: 'ok' };
  function orderHtml(o) {
    var a = o.address, addr = a && a.line1 ? [a.name, a.line1, a.line2, [a.postal, a.city].filter(Boolean).join(' '), a.country].filter(Boolean).join('\n') : '';
    var problem = (o.events || []).filter(function (e) { return e.kind === 'disputed'; }).pop();
    var act = '', note = function (ph) {
      return '<textarea class="v-textarea" id="lnote' + o.id + '" rows="2" maxlength="500" placeholder="' + esc(t(ph)) + '"></textarea>';
    };
    var btn = function (action, label, cls) { return '<button type="button" class="v-btn ' + (cls || '') + ' sm" data-lab="' + action + '" data-id="' + o.id + '">' + esc(t(label)) + '</button>'; };
    switch (o.status) {
      case 'awaiting_payment':
        act = '<p class="v-note">' + esc(t('labManualPay', { amount: money(o.total, true), email: (o.buyer && o.buyer.email) || '' })) + '</p><div class="row">' + btn('paid', 'markPaid', 'ok') + '</div>';
        break;
      case 'paid':
        act = '<p class="v-note">' + esc(t(o.tier === 'lab' ? 'labWaitSellerLab' : 'labWaitSeller')) + '</p>';
        break;
      case 'to_lab':
        act = '<p class="v-note">' + esc(t('labInbound', { code: o.trackingIn || '—' })) + '</p><div class="row">' + btn('received', 'markReceived', 'gold') + '</div>';
        break;
      case 'in_lab':
        act = checklist('ckLab') + note('labNotePh') + '<div class="row">' + btn('pass', 'passAuth', 'ok') + btn('fail', 'failAuth', 'danger') + '</div>';
        break;
      case 'verified':
        act = '<div class="row"><input class="v-input" id="ltrk' + o.id + '" maxlength="80" placeholder="' + esc(t('trackingPh')) + '"/>' + btn('shipped', 'shippedToBuyer', 'gold') + '</div>';
        break;
      case 'disputed':
        act = '<div class="v-state bad">' + S.ico('flag') + '<div><b>' + esc(t('buyerSays')) + '</b> ' + esc(problem ? problem.note : '') + '</div></div>' +
          note('resolveNotePh') + '<div class="row">' + btn('release', 'releasePayout', 'ok') + btn('refund', 'refundBuyer', 'danger') + '</div>';
        break;
      case 'delivered':
        // only here when the payout to the seller still has to go out
        act = '<div class="v-state ' + (o.payoutStatus === 'failed' ? 'bad' : 'warn') + '">' + S.ico(o.payoutStatus === 'failed' ? 'alert' : 'clock') + '<div>' +
          esc(t(o.payoutStatus === 'failed' ? 'labPayoutFailed' : 'labPayoutWaiting')) + '</div></div><div class="row">' + btn('payout', 'retryPayout', 'gold') + '</div>';
        break;
    }
    return '<article class="v-order" id="lo-' + o.id + '">' +
      '<div class="v-order-top">' +
        '<a class="thumb" href="/vault-item.html?id=' + o.listingId + '">' + (o.photo ? '<img src="' + esc(o.photo) + '" alt="" loading="lazy"/>' : '') + '</a>' +
        '<div style="min-width:0;"><b>' + esc(o.title) + '</b><small>EU ' + esc(o.size || '') + ' · ' + esc(t('orderNo', { n: o.id })) + ' · ' + esc(S.fmtDate(o.createdAt)) + '</small>' +
          '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.45rem;"><span class="v-chip ' + (TONE[o.status] || '') + '">' + esc(t('os_' + o.status)) + '</span>' + S.tierBadge(o.tier) + '</div></div>' +
        '<div class="side"><span class="amt">' + money(o.total, true) + '</span><span class="v-note">' + esc(t('payoutShort', { amount: money(o.payout, true) })) + '</span></div>' +
      '</div>' +
      (act ? '<div class="v-order-act">' + act + '</div>' : '') +
      '<details class="v-order-more"><summary>' + esc(t('orderDetails')) + '</summary><div class="in">' +
        '<div><dl class="v-kv" style="margin-top:0;">' +
          kv(t('buyer'), o.buyer ? esc(o.buyer.name) + ' · <a href="mailto:' + esc(o.buyer.email) + '">' + esc(o.buyer.email) + '</a>' : '') +
          kv(t('seller'), o.seller ? esc(o.seller.name) + ' · <a href="mailto:' + esc(o.seller.email) + '">' + esc(o.seller.email) + '</a>' : '') +
          kv(t('lineItem'), money(o.itemPrice, true)) + kv(t('lineAuth'), money(o.authFee, true)) + kv(t('lineShip'), money(o.shipFee, true)) +
          kv(t('commission'), money(o.commission, true)) + kv(t('payMode'), esc(o.payMode || '—') + (o.stripePaid ? ' · Stripe ✓' : '')) +
          kv(t('payoutStatusL'), o.payoutStatus ? esc(t('ps_' + o.payoutStatus)) + (o.payoutRef ? ' · <code>' + esc(o.payoutRef) + '</code>' : '') : '') +
          kv(t('refundL'), o.refundRef ? '<code>' + esc(o.refundRef) + '</code>' : '') +
          kv(t('trackingIn'), o.trackingIn ? esc(o.trackingIn) : '') + kv(t('trackingOut'), o.trackingOut ? esc(o.trackingOut) : '') +
        '</dl></div>' +
        '<div>' + (addr ? '<p class="v-label">' + esc(t('deliveryTo')) + '</p><p class="v-addr">' + esc(addr) + '</p>' : '') +
          '<p class="v-label" style="margin-top:0.8rem;">' + esc(t('history')) + '</p><ul class="v-events">' + (o.events || []).map(function (e) {
            return '<li><time>' + esc(S.fmtShort(e.at)) + '</time><span>' + esc(t('ev_' + e.kind)) + (e.note ? ' — ' + esc(e.note) : '') + '</span></li>';
          }).join('') + '</ul></div>' +
      '</div></details></article>';
  }

  var TK_TONE = { open: 'warn', answered: 'gold', closed: '' };
  function ticketHtml(k) {
    var lang = (k.lang || 'en').toUpperCase();
    var transcript = (k.transcript || []).map(function (m) {
      return '<div class="' + (m.role === 'user' ? '' : 'spec') + '"><em>' + esc(m.role === 'user' ? t('thMember') : 'Wesley') + '</em>' + esc(m.text) + '</div>';
    }).join('');
    var thread = (k.messages || []).map(function (m) {
      return '<div class="' + (m.from === 'specialist' ? 'spec' : '') + '"><em>' + esc(t(m.from === 'specialist' ? 'thSpecialist' : 'thMember')) + ' · ' + esc(S.fmtShort(m.at)) + '</em>' + esc(m.body) + '</div>';
    }).join('');
    var closed = k.status === 'closed';
    return '<article class="v-ticket ' + (k.status === 'open' ? 'open' : '') + '" id="tk-' + k.id + '">' +
      '<div class="v-ticket-head"><div><b>#' + k.id + ' · ' + esc(t('topic_' + (k.topic || 'other'))) + '</b>' +
        '<small>' + esc(k.name || '—') + ' · <a href="mailto:' + esc(k.email) + '">' + esc(k.email) + '</a> · ' + esc(lang) + ' · ' + esc(S.ago(k.createdAt)) + '</small>' +
        (k.page ? '<small>' + esc(t('ticketPage')) + ': ' + esc(k.page) + '</small>' : '') + '</div>' +
        '<span class="v-chip ' + (TK_TONE[k.status] || '') + '">' + esc(t('tk_' + k.status)) + '</span></div>' +
      (k.summary ? '<p style="font-size:0.86rem;line-height:1.55;">' + esc(k.summary) + '</p>' : '') +
      (transcript ? '<details class="v-faq"><summary>' + esc(t('ticketTranscript')) + '</summary><div class="v-thread">' + transcript + '</div></details>' : '') +
      (thread ? '<div class="v-thread">' + thread + '</div>' : '') +
      (closed ? '' :
        '<textarea class="v-textarea" id="tans' + k.id + '" rows="3" maxlength="4000" placeholder="' + esc(t('ticketReplyPh')) + '"></textarea>' +
        '<p class="v-note">' + esc(t('ticketReplyNote', { email: k.email, lang: lang })) + '</p>' +
        '<div class="v-btn-row" style="justify-content:flex-start;">' +
          '<button type="button" class="v-btn gold sm" data-ticket="send" data-id="' + k.id + '">' + esc(t('ticketSend')) + '</button>' +
          '<button type="button" class="v-btn ghost sm" data-ticket="sendclose" data-id="' + k.id + '">' + esc(t('ticketSendClose')) + '</button>' +
          '<button type="button" class="v-btn ghost sm" data-ticket="close" data-id="' + k.id + '">' + esc(t('ticketClose')) + '</button></div>') +
    '</article>';
  }
  function keepDrafts() {
    d.querySelectorAll('[id^="tans"], [id^="lnote"], [id^="note"]').forEach(function (el) { if (el.value) drafts[el.id] = el.value; else delete drafts[el.id]; });
  }
  function restoreDrafts() {
    Object.keys(drafts).forEach(function (id) { var el = $(id); if (el) el.value = drafts[id]; });
  }

  /* ── photo storage ────────────────────────────────────────────────── */
  var DB_ROOM = 500 * 1024 * 1024;   // a free D1 database holds 500 MB
  function storageHtml(s) {
    if (s.r2 && !s.photos_in_db) return '';
    var used = s.photo_bytes || 0, pct = Math.min(100, Math.round(used / DB_ROOM * 1000) / 10);
    var mb = (used / 1048576).toFixed(used < 10485760 ? 1 : 0) + ' MB';
    return '<div class="v-card-box" style="margin-bottom:1.2rem;"><div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:center;">' +
      '<div><b style="font-weight:600;">' + esc(t('storageT')) + '</b><p class="v-note" style="margin-top:0.2rem;">' +
        esc(s.r2 ? t('storageLeft', { n: S.num(s.photos_in_db) }) : t('storageDb', { used: mb, pct: pct })) + '</p></div>' +
      (s.r2 ? '<button type="button" class="v-btn gold sm" id="labToR2">' + esc(t('storageMove')) + '</button>' : '') + '</div>' +
      (s.r2 ? '' : '<div class="v-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="' + esc(t('storageT')) + '"><i style="width:' + Math.max(pct, 1) + '%;"></i></div>' +
        '<p class="v-note" style="margin-top:0.6rem;">' + esc(t('storageR2Hint')) + '</p>') +
    '</div>';
  }
  function moveToR2(btn) {
    S.busy(btn, true);
    var step = function () {
      S.market('lab/photos-to-r2', { body: {} }).then(function (res) {
        if (!res.ok) { S.busy(btn, false); S.toast(S.errText(res), 'bad'); return; }
        if (res.data.left > 0 && res.data.moved > 0) { btn.lastChild.textContent = t('storageMoving', { n: S.num(res.data.left) }); step(); return; }
        S.busy(btn, false);
        S.toast(t(res.data.left ? 'e_generic' : 'storageDone'), res.data.left ? 'bad' : 'ok');
        load();
      });
    };
    step();
  }

  function render() {
    var s = data.stats || {};
    var tickets = data.tickets || [];
    var needs = data.orders.filter(function (o) { return ['awaiting_payment', 'to_lab', 'in_lab', 'verified', 'disputed', 'delivered'].indexOf(o.status) !== -1; }).length;
    var openTickets = tickets.filter(function (k) { return k.status === 'open'; }).length;
    var tb = function (k, label, n) {
      return '<button type="button" role="tab" data-tab="' + k + '" class="' + (tab === k ? 'on' : '') + '" aria-selected="' + (tab === k ? 'true' : 'false') + '">' + esc(label) + (n ? '<span class="n">' + n + '</span>' : '') + '</button>';
    };
    $('labBody').innerHTML =
      '<div class="v-stats" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));">' +
        stat(t('statReview'), S.num(s.review || 0)) + stat(t('statLive'), S.num(s.live || 0)) +
        stat(t('statOpen'), S.num(s.open_orders || 0)) + stat(t('statDisputes'), S.num(s.disputes || 0)) +
        stat(t('statRevenue'), money(s.revenue || 0)) + stat(t('statTickets'), S.num(openTickets)) +
      '</div>' +
      storageHtml(s) +
      '<div class="v-tabs" role="tablist">' + tb('review', t('tabReview'), data.review.length) + tb('orders', t('tabOrders'), needs) + tb('support', t('tabSupport'), openTickets) + '</div>' +
      '<div class="v-rows">' + (tab === 'review'
        ? (data.review.length ? data.review.map(reviewHtml).join('') : '<div class="v-empty">' + S.ico('check') + '<h3>' + esc(t('queueEmptyT')) + '</h3><p>' + esc(t('queueEmpty')) + '</p></div>')
        : tab === 'orders'
        ? (data.orders.length ? data.orders.map(orderHtml).join('') : '<div class="v-empty">' + S.ico('box') + '<h3>' + esc(t('ordersEmptyT')) + '</h3><p>' + esc(t('ordersEmpty')) + '</p></div>')
        : (tickets.length ? tickets.map(ticketHtml).join('') : '<div class="v-empty">' + S.ico('chat') + '<h3>' + esc(t('ticketsEmptyT')) + '</h3><p>' + esc(t('ticketsEmpty')) + '</p></div>')) +
      '</div>';
    restoreDrafts();
    var r2 = $('labToR2');
    if (r2) r2.onclick = function () { moveToR2(r2); };
  }

  /* ── actions ──────────────────────────────────────────────────────── */
  function retryPayout(btn, body) {
    S.busy(btn, true);
    S.market('lab', { body: body }).then(function (res) {
      S.busy(btn, false);
      if (!res.ok) { S.toast(S.errText(res), 'bad'); return; }
      var r = res.data.payout;
      S.toast(t(r === 'sent' ? 'payoutRetrySent' : r === 'waiting' ? 'payoutRetryWaiting' : r === 'manual' ? 'payoutRetryManual' : 'payoutRetryFailed'), r === 'sent' ? 'ok' : 'bad');
      load();
    });
  }
  function answer(btn, how, id) {
    var box = $('tans' + id), text = box ? box.value.trim() : '';
    if (how !== 'close' && !text) { box.classList.add('err'); box.focus(); S.toast(t('e_note_needed'), 'bad'); return; }
    S.busy(btn, true);
    S.market('support/answer', { body: { ticketId: id, message: how === 'close' ? '' : text, close: how !== 'send' } }).then(function (res) {
      S.busy(btn, false);
      if (!res.ok) { S.toast(S.errText(res), 'bad'); return; }
      delete drafts['tans' + id];
      if (box) box.value = '';
      S.toast(t(how === 'close' ? 'ticketClosedToast' : 'ticketSentToast'), 'ok');
      load();
    });
  }
  function post(btn, route, body, okKey) {
    S.busy(btn, true);
    S.market(route, { body: body }).then(function (res) {
      S.busy(btn, false);
      if (!res.ok) { S.toast(S.errText(res), 'bad'); return; }
      S.toast(t(okKey), 'ok');
      load();
    });
  }
  d.addEventListener('click', function (e) {
    if (!$('labBody').contains(e.target)) return;
    var el = e.target.closest('button');
    if (!el) return;
    var tb = el.getAttribute('data-tab');
    if (tb) {
      keepDrafts(); tab = tb; render();
      try { w.history.replaceState(null, '', w.location.pathname + '#' + tb); } catch (e2) {}
      return;
    }
    var id = +el.getAttribute('data-id');
    var tk = el.getAttribute('data-ticket');
    if (tk) { answer(el, tk, id); return; }
    var rv = el.getAttribute('data-review');
    if (rv) {
      var note = ($('note' + id).value || '').trim();
      if (rv === 'reject' && !note) { $('note' + id).classList.add('err'); $('note' + id).focus(); S.toast(t('e_note_needed'), 'bad'); return; }
      post(el, 'review', { id: id, decision: rv, note: note }, rv === 'approve' ? 'approvedToast' : 'rejectedToast');
      return;
    }
    var lab = el.getAttribute('data-lab');
    if (!lab) return;
    var body = { orderId: id, action: lab };
    var ln = $('lnote' + id);
    if (ln) body.note = ln.value.trim();
    if ((lab === 'fail' || lab === 'refund') && !body.note) { ln.classList.add('err'); ln.focus(); S.toast(t('e_note_needed'), 'bad'); return; }
    if (lab === 'shipped') {
      var trk = $('ltrk' + id);
      body.tracking = trk.value.trim();
      if (!body.tracking) { trk.classList.add('err'); trk.focus(); S.toast(t('e_tracking'), 'bad'); return; }
    }
    var ask = { fail: ['failAuthT', 'failAuthQ'], refund: ['refundT', 'refundQ'], release: ['releaseT', 'releaseQ'], paid: ['markPaidT', 'markPaidQ'] }[lab];
    if (lab === 'payout') { retryPayout(el, body); return; }
    var go = function () { post(el, 'lab', body, 'labDone'); };
    if (ask) S.confirm(t(ask[0]), t(ask[1]), t('confirm'), lab === 'fail' || lab === 'refund').then(function (y) { if (y) go(); });
    else go();
  });
  $('labRefresh').addEventListener('click', function () { load(); });
  w.addEventListener('hashchange', function () {
    var h = (w.location.hash || '').slice(1);
    if ((h === 'support' || h === 'orders' || h === 'review') && h !== tab && data) { keepDrafts(); tab = h; render(); }
  });
  d.addEventListener('visibilitychange', function () { if (!d.hidden && data) load(); });

  S.boot({
    key: 'lab',
    title: 'pageLab',
    init: function (me) { if (!me) gate('lock', 'gateT', 'gateLab', true); else load(); },
    onLang: function () { if (data) render(); },
    onAuth: function () { load(); }
  });
})(window, document);
