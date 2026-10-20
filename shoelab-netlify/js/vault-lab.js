/* ShoeLab Vault — the specialist console (vault-lab.html).
 * The review queue (approve or reject new listings from their photos) and
 * every order that needs the lab: manual payments, parcels arriving for
 * inspection, the pass/fail call, shipping on, and reported problems.
 * Access is decided by the server (VAULT_SPECIALISTS); this page only asks. */
(function (w, d) {
  'use strict';
  var S = w.SLV, t = S.t, esc = S.esc, money = S.money;
  var $ = function (id) { return d.getElementById(id); };
  var data = null, tab = 'review', timer = null;

  function load() {
    return S.market('queue').then(function (res) {
      if (res.status === 401) { gate('lock', 'gateT', 'gateLab', true); return; }
      if (res.status === 403) { gate('shield', 'labOnlyT', 'labOnly', false); return; }
      if (!res.ok) { gate('alert', 'emptyErrorT', null, false, S.errText(res)); return; }
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
          kv(t('seller'), esc((l.seller && l.seller.name) || '') + (l.seller && l.seller.email ? ' · <a href="mailto:' + esc(l.seller.email) + '">' + esc(l.seller.email) + '</a>' : '')) +
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

  var TONE = { awaiting_payment: 'warn', paid: 'gold', to_lab: 'gold', in_lab: 'gold', verified: 'ok', disputed: 'bad' };
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
          kv(t('commission'), money(o.commission, true)) + kv(t('payMode'), esc(o.payMode || '—')) +
          kv(t('trackingIn'), o.trackingIn ? esc(o.trackingIn) : '') + kv(t('trackingOut'), o.trackingOut ? esc(o.trackingOut) : '') +
        '</dl></div>' +
        '<div>' + (addr ? '<p class="v-label">' + esc(t('deliveryTo')) + '</p><p class="v-addr">' + esc(addr) + '</p>' : '') +
          '<p class="v-label" style="margin-top:0.8rem;">' + esc(t('history')) + '</p><ul class="v-events">' + (o.events || []).map(function (e) {
            return '<li><time>' + esc(S.fmtShort(e.at)) + '</time><span>' + esc(t('ev_' + e.kind)) + (e.note ? ' — ' + esc(e.note) : '') + '</span></li>';
          }).join('') + '</ul></div>' +
      '</div></details></article>';
  }

  function render() {
    var s = data.stats || {};
    var needs = data.orders.filter(function (o) { return ['awaiting_payment', 'to_lab', 'in_lab', 'verified', 'disputed'].indexOf(o.status) !== -1; }).length;
    var tb = function (k, label, n) {
      return '<button type="button" role="tab" data-tab="' + k + '" class="' + (tab === k ? 'on' : '') + '" aria-selected="' + (tab === k ? 'true' : 'false') + '">' + esc(label) + (n ? '<span class="n">' + n + '</span>' : '') + '</button>';
    };
    $('labBody').innerHTML =
      '<div class="v-stats" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));">' +
        stat(t('statReview'), S.num(s.review || 0)) + stat(t('statLive'), S.num(s.live || 0)) +
        stat(t('statOpen'), S.num(s.open_orders || 0)) + stat(t('statDisputes'), S.num(s.disputes || 0)) +
        stat(t('statRevenue'), money(s.revenue || 0)) +
      '</div>' +
      '<div class="v-tabs" role="tablist">' + tb('review', t('tabReview'), data.review.length) + tb('orders', t('tabOrders'), needs) + '</div>' +
      '<div class="v-rows">' + (tab === 'review'
        ? (data.review.length ? data.review.map(reviewHtml).join('') : '<div class="v-empty">' + S.ico('check') + '<h3>' + esc(t('queueEmptyT')) + '</h3><p>' + esc(t('queueEmpty')) + '</p></div>')
        : (data.orders.length ? data.orders.map(orderHtml).join('') : '<div class="v-empty">' + S.ico('box') + '<h3>' + esc(t('ordersEmptyT')) + '</h3><p>' + esc(t('ordersEmpty')) + '</p></div>')) +
      '</div>';
  }

  /* ── actions ──────────────────────────────────────────────────────── */
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
    if (tb) { tab = tb; render(); return; }
    var id = +el.getAttribute('data-id');
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
    var go = function () { post(el, 'lab', body, 'labDone'); };
    if (ask) S.confirm(t(ask[0]), t(ask[1]), t('confirm'), lab === 'fail' || lab === 'refund').then(function (y) { if (y) go(); });
    else go();
  });
  $('labRefresh').addEventListener('click', function () { load(); });
  d.addEventListener('visibilitychange', function () { if (!d.hidden && data) load(); });

  S.boot({
    key: 'lab',
    title: 'pageLab',
    init: function (me) { if (!me) gate('lock', 'gateT', 'gateLab', true); else load(); },
    onLang: function () { if (data) render(); },
    onAuth: function () { load(); }
  });
})(window, document);
