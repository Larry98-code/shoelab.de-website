/* ShoeLab Vault — My Vault (vault-me.html): what needs doing first, then
 * buying (orders, bids, offers), selling (offers to answer, orders,
 * listings) and the watchlist. Links from emails land on #order-N or
 * #offers and open the right tab at the right card. */
(function (w, d) {
  'use strict';
  var S = w.SLV, t = S.t, esc = S.esc, money = S.money;
  var $ = function (id) { return d.getElementById(id); };

  var data = null, tab = null, firstRender = true;
  var payouts = null;           // the latest answer from payouts/status

  function box(kind, icon, html) { return '<div class="v-state ' + kind + '">' + S.ico(icon) + '<div>' + html + '</div></div>'; }

  /* ── loading ──────────────────────────────────────────────────────── */
  function load() {
    return S.market('me').then(function (res) {
      if (res.status === 401) { gate(); return; }
      if (!res.ok) {
        $('meBody').innerHTML = '<div class="v-empty">' + S.ico('alert') + '<h3>' + esc(t('emptyErrorT')) + '</h3><p>' + esc(S.errText(res)) + '</p>' +
          '<div class="v-btn-row"><button type="button" class="v-btn ghost" id="meRetry">' + esc(t('retry')) + '</button></div></div>';
        $('meRetry').onclick = load;
        return;
      }
      data = res.data;
      render();
      if (data.connect && !payouts) refreshPayouts();
    });
  }
  function gate() {
    $('meHello').textContent = t('meTitle');
    $('meBody').innerHTML = '<div class="v-empty">' + S.ico('lock') + '<h3>' + esc(t('gateT')) + '</h3><p>' + esc(t('gate')) + '</p>' +
      '<div class="v-btn-row"><button type="button" class="v-btn" id="meSignIn">' + esc(t('signIn')) + '</button></div></div>';
    $('meSignIn').onclick = function () { S.requireAuth('authMine').then(function (u) { if (u) load(); }); };
  }

  /* ── helpers ──────────────────────────────────────────────────────── */
  function thumb(src, href) {
    return '<a class="thumb" href="' + href + '">' + (src ? '<img src="' + esc(src) + '" alt="" loading="lazy"/>' : '<span class="noimg" style="display:grid;place-items:center;height:100%;color:#444;">' + S.ico('image') + '</span>') + '</a>';
  }
  function chip(kind, text) { return '<span class="v-chip ' + (kind || '') + '">' + esc(text) + '</span>'; }
  function group(id, title, sub, body) {
    return '<section class="v-group" id="' + id + '" style="scroll-margin-top:90px;"><div class="v-group-head"><h2>' + esc(title) + '</h2>' +
      (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div><div class="v-rows">' + body + '</div></section>';
  }
  function emptyNote(text) { return '<p class="v-note" style="padding:0.9rem 1rem;border:1px dashed var(--border-hi);border-radius:14px;">' + esc(text) + '</p>'; }
  var ORDER_TONE = { awaiting_payment: 'warn', paid: 'gold', to_lab: 'gold', in_lab: 'gold', verified: 'ok', shipped: 'gold', delivered: 'ok', failed: 'bad', cancelled: '', disputed: 'bad', refunded: '' };
  var LIST_TONE = { review: 'warn', live: 'ok', sold: 'gold', ended: '', rejected: 'bad', cancelled: '', relisted: '' };

  /* ── what needs doing ─────────────────────────────────────────────── */
  function todos() {
    var out = [], b = data.buying, s = data.selling;
    b.orders.forEach(function (o) {
      if (o.status === 'awaiting_payment' && o.payMode !== 'manual') out.push({ icon: 'euro', text: t('todoPay', { title: o.title }), go: t('payNow'), order: o.id, pay: o.id });
      if (o.status === 'shipped') out.push({ icon: 'truck', text: t('todoReceive', { title: o.title }), go: t('open'), order: o.id });
    });
    s.orders.forEach(function (o) {
      if (o.status === 'paid') out.push({ icon: 'box', text: t(o.tier === 'lab' ? 'todoShipLab' : 'todoShip', { title: o.title }), go: t('open'), order: o.id });
    });
    var waiting = s.orders.filter(function (o) { return o.payoutStatus === 'waiting'; }).reduce(function (n, o) { return n + o.payout; }, 0);
    if (waiting && !(data.seller && data.seller.ready)) out.push({ icon: 'euro', text: t('todoPayouts', { amount: money(waiting, true) }), go: t('payoutsSetupBtn'), payouts: 1 });
    s.offers.forEach(function (f) {
      if (f.status === 'pending') out.push({ icon: 'chat', text: t('todoOffer', { amount: money(f.amount), title: f.title }), go: t('answer'), offers: 'selling' });
    });
    b.offers.forEach(function (f) {
      if (f.status === 'countered') out.push({ icon: 'chat', text: t('todoCounter', { amount: money(f.counter), title: f.title }), go: t('answer'), offers: 'buying' });
    });
    b.orders.forEach(function (o) {
      if (o.status === 'delivered' && !o.feedback) out.push({ icon: 'star', text: t('todoRate', { title: o.title }), go: t('rate'), order: o.id });
    });
    return out;
  }

  /* ── orders ───────────────────────────────────────────────────────── */
  var STEPS = { photo: ['sold', 'paid', 'shipped', 'delivered'], lab: ['sold', 'paid', 'to_lab', 'in_lab', 'verified', 'shipped', 'delivered'] };
  function timeline(o) {
    var steps = STEPS[o.tier] || STEPS.photo, lab = o.tier === 'lab';
    var pos = {
      awaiting_payment: 1, paid: 2, to_lab: 3, in_lab: 4, verified: 5, shipped: lab ? 6 : 3,
      delivered: steps.length, disputed: steps.length - 1, refunded: steps.length - 1, failed: 4, cancelled: 1
    }[o.status];
    if (pos == null) pos = 0;
    var badAt = o.status === 'failed' ? 4 : o.status === 'cancelled' ? 1 : (o.status === 'disputed' || o.status === 'refunded') ? steps.length - 1 : -1;
    return '<div class="v-timeline" aria-label="' + esc(t('progress')) + '">' + steps.map(function (k, i) {
      var cls = i === badAt ? 'fail' : i < pos ? 'done' : i === pos ? 'cur' : '';
      return '<div class="v-tl ' + cls + '"><i>' + (cls === 'done' ? '✓' : cls === 'fail' ? '!' : '') + '</i><span>' + esc(t('tl_' + k)) + '</span></div>';
    }).join('') + '</div>';
  }
  function trackingLine(label, code) {
    return code ? '<div class="v-line"><span>' + esc(label) + '</span><span style="font-family:ui-monospace,Menlo,monospace;">' + esc(code) + '</span></div>' : '';
  }
  function orderActions(o) {
    var buyer = o.role === 'buyer', h = '';
    switch (o.status) {
      case 'awaiting_payment': {
        var due = new Date(new Date(o.createdAt).getTime() + 72 * 3600000).toISOString();
        if (buyer) {
          h += o.payMode === 'manual'
            ? box('gold', 'info', esc(t('payManualWaiting', { amount: money(o.total, true) })) + (data.onlinePayment ? ' <button type="button" class="v-link-btn" data-pay="' + o.id + '">' + esc(t('payOnlineInstead')) + '</button>' : ''))
            : box('warn', 'clock', '<b>' + esc(t('payWithinShort')) + '</b> <span data-ends="' + due + '"><span class="cd-t"></span></span>') +
              '<div class="row"><button type="button" class="v-btn" data-pay="' + o.id + '">' + esc(t('payAmount', { amount: money(o.total, true) })) + '</button></div>';
        } else {
          h += box('info', 'clock', esc(t('sellerAwaitPay')) + ' <span data-ends="' + due + '"><span class="cd-t"></span></span>');
        }
        break;
      }
      case 'paid':
        if (buyer) h += box('info', 'box', esc(t(o.tier === 'lab' ? 'buyerPaidLab' : 'buyerPaid')));
        else h += box('gold', 'box', '<b>' + esc(t(o.tier === 'lab' ? 'shipToLab' : 'shipToBuyer')) + '</b>') +
          shipToHtml(o) +
          '<div class="row"><input class="v-input" id="trk' + o.id + '" maxlength="80" autocomplete="off" placeholder="' + esc(t('trackingPh')) + '"/>' +
          '<button type="button" class="v-btn sm" data-ship="' + o.id + '">' + esc(t('markShipped')) + '</button></div>';
        break;
      case 'to_lab':
        h += box('info', 'truck', esc(t(buyer ? 'buyerToLab' : 'sellerToLab')));
        break;
      case 'in_lab':
        h += box('gold', 'shield', esc(t(buyer ? 'buyerInLab' : 'sellerInLab')));
        break;
      case 'verified':
        h += box('ok', 'shield', esc(t(buyer ? 'buyerVerified' : 'sellerVerified')));
        break;
      case 'shipped':
        if (buyer) h += box('info', 'truck', esc(t('buyerShipped'))) +
          '<div class="row"><button type="button" class="v-btn ok sm" data-received="' + o.id + '">' + esc(t('confirmDelivery')) + '</button>' +
          '<button type="button" class="v-btn danger sm" data-problem="' + o.id + '">' + esc(t('reportProblem')) + '</button></div>' +
          '<p class="v-note">' + esc(t('confirmDeliveryNote')) + '</p>';
        else h += box('info', 'truck', esc(t('sellerShipped')));
        break;
      case 'delivered':
        if (buyer) {
          if (o.feedback) h += box('ok', 'star', esc(t('youRated', { rating: t(o.feedback.rating > 0 ? 'ratePos' : o.feedback.rating < 0 ? 'rateNeg' : 'rateNeu') })));
          else h += '<div><b style="font-weight:500;">' + esc(t('rateSeller')) + '</b>' +
            '<div class="row" style="margin-top:0.6rem;" data-rate-row="' + o.id + '">' +
              '<button type="button" class="v-btn ghost sm" data-rate="1">👍 ' + esc(t('ratePos')) + '</button>' +
              '<button type="button" class="v-btn ghost sm" data-rate="0">➖ ' + esc(t('rateNeu')) + '</button>' +
              '<button type="button" class="v-btn ghost sm" data-rate="-1">👎 ' + esc(t('rateNeg')) + '</button></div>' +
            '<div class="row" style="margin-top:0.5rem;"><input class="v-input" id="fbc' + o.id + '" maxlength="300" placeholder="' + esc(t('rateCommentPh')) + '"/></div></div>';
        } else h += payoutHtml(o);
        break;
      case 'disputed':
        h += box('bad', 'flag', esc(t(buyer ? 'buyerDisputed' : 'sellerDisputed')));
        break;
      case 'refunded':
        h += box('info', 'refresh', esc(t(buyer ? 'buyerRefunded' : 'sellerRefunded')) + (buyer && o.refunded ? ' ' + esc(t('refundCardNote')) : ''));
        break;
      case 'failed':
        h += box('bad', 'alert', esc(t(buyer ? 'buyerFailed' : 'sellerFailed')) + (buyer && o.refunded ? ' ' + esc(t('refundCardNote')) : ''));
        break;
      case 'cancelled':
        h += box('info', 'x', esc(t('orderCancelled')));
        break;
    }
    return h ? '<div class="v-order-act">' + h + '</div>' : '';
  }
  // Where a paid order goes: the buyer (Photo Verified) or the lab (Lab Verified).
  function shipToHtml(o) {
    var s = o.shipTo;
    if (!s) return '';
    if (!s.address) return s.lab ? '<p class="v-note">' + esc(t('labAddrLater')) + '</p>' : '';
    return '<div class="v-instr"><span class="v-label">' + esc(t(s.lab ? 'sendToLab' : 'sendToBuyer')) + '</span>' +
      '<span class="v-addr" style="display:block;margin-top:0.3rem;">' + esc(s.address) + '</span>' +
      (s.lab ? '<span class="v-note" style="display:block;margin-top:0.55rem;">' + esc(t('labNoteInside', { n: o.id })) + '</span>' : '') + '</div>';
  }
  // A delivered sale: where the seller's money is.
  function payoutHtml(o) {
    var amount = money(o.payout, true), sel = data.seller || {};
    switch (o.payoutStatus) {
      case 'sent': return box('ok', 'check', esc(t('payoutSentLine', { amount: amount, date: S.fmtDate(o.payoutAt) })));
      case 'sending': return box('info', 'clock', esc(t('payoutSendingLine', { amount: amount })));
      case 'failed': return box('bad', 'alert', esc(t('payoutFailedLine', { amount: amount })));
      case 'waiting':
        if (sel.ready) return box('warn', 'clock', esc(t('payoutCheckingLine', { amount: amount })));
        return box('warn', 'euro', esc(t('payoutWaitingLine', { amount: amount }))) +
          '<div class="row"><button type="button" class="v-btn gold sm" data-payouts="setup">' + esc(t(sel.connected ? 'payoutsContinueBtn' : 'payoutsSetupBtn')) + '</button></div>';
      default: return box('ok', 'check', esc(t('sellerDelivered', { amount: amount })));
    }
  }
  function orderHtml(o) {
    var buyer = o.role === 'buyer';
    var lines = buyer
      ? S.lineHtml(t('lineItem'), money(o.itemPrice, true)) + S.lineHtml(t('lineAuth'), money(o.authFee, true)) +
        S.lineHtml(t('lineShip'), money(o.shipFee, true)) + S.lineHtml(t('lineTotal'), money(o.total, true), 'total')
      : S.lineHtml(t('salePrice'), money(o.itemPrice, true)) + S.lineHtml(t('commission'), '−' + money(o.commission, true), 'neg') +
        (o.tier === 'photo' ? S.lineHtml(t('postageBack'), '+' + money(o.shipFee, true), 'pos') : '') +
        S.lineHtml(t('youReceive'), money(o.payout, true), 'total');
    var a = o.address, addr = a && a.line1 ? [a.name, a.line1, a.line2, [a.postal, a.city].filter(Boolean).join(' ')].filter(Boolean).join('\n') : '';
    var events = (o.events || []).map(function (e) {
      return '<li><time>' + esc(S.fmtShort(e.at)) + '</time><span>' + esc(t('ev_' + e.kind)) + (e.note && e.kind !== 'paid' && e.kind !== 'sold' && e.kind !== 'feedback' ? ' — ' + esc(e.note) : '') + '</span></li>';
    }).join('');
    return '<article class="v-order" id="order-' + o.id + '">' +
      '<div class="v-order-top">' + thumb(o.photo, '/vault-item.html?id=' + o.listingId) +
        '<div style="min-width:0;"><b>' + esc(o.title) + '</b>' +
          '<small>EU ' + esc(o.size || '') + ' · ' + esc(t('orderNo', { n: o.id })) + ' · ' + esc(S.fmtDate(o.createdAt)) + '</small>' +
          '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.45rem;">' + chip(ORDER_TONE[o.status], t('os_' + o.status)) + S.tierBadge(o.tier) + '</div></div>' +
        '<div class="side"><span class="v-note">' + esc(t(buyer ? 'lineTotal' : 'youReceive')) + '</span><span class="amt">' + money(buyer ? o.total : o.payout, true) + '</span></div>' +
      '</div>' +
      (o.status === 'cancelled' ? '' : timeline(o)) +
      orderActions(o) +
      '<details class="v-order-more"><summary>' + esc(t('orderDetails')) + '</summary><div class="in">' +
        '<div><div class="v-lines">' + lines + '</div>' +
          trackingLine(t('trackingIn'), o.trackingIn) + trackingLine(t('trackingOut'), o.trackingOut) + '</div>' +
        '<div>' + (addr ? '<p class="v-label">' + esc(t('deliveryTo')) + '</p><p class="v-addr">' + esc(addr) + '</p>' : '') +
          (events ? '<p class="v-label" style="margin-top:' + (addr ? '1rem' : '0') + ';">' + esc(t('history')) + '</p><ul class="v-events">' + events + '</ul>' : '') + '</div>' +
      '</div></details>' +
    '</article>';
  }

  /* ── offers ───────────────────────────────────────────────────────── */
  function offerReceivedHtml(f) {
    var acts = f.status === 'pending'
      ? '<button type="button" class="v-btn ok xs" data-offer-act="accept" data-offer="' + f.id + '">' + esc(t('accept')) + '</button>' +
        '<button type="button" class="v-btn ghost xs" data-offer-act="decline" data-offer="' + f.id + '">' + esc(t('decline')) + '</button>' +
        '<span class="v-money"><input class="v-input" id="ctr' + f.id + '" inputmode="decimal" autocomplete="off" placeholder="' + esc(t('counterPh')) + '" aria-label="' + esc(t('counterPh')) + '"/></span>' +
        '<button type="button" class="v-btn ghost xs" data-offer-act="counter" data-offer="' + f.id + '">' + esc(t('counter')) + '</button>' +
        '<span class="v-note" style="margin-left:auto;">' + esc(t('expiresIn')) + ' <span data-ends="' + esc(f.expiresAt) + '"><span class="cd-t"></span></span></span>'
      : '<span class="v-note">' + esc(t('youCountered', { amount: money(f.counter, true) })) + '</span>';
    return '<div class="v-offer"><div class="main"><b>' + esc(f.title) + ' · EU ' + esc(f.size) + '</b>' +
      '<small>' + esc(t('offerFrom', { name: f.buyer || '—' })) + ' · ' + esc(S.ago(f.createdAt)) + '</small>' +
      (f.message ? '<q>' + esc(f.message) + '</q>' : '') + '</div>' +
      '<div class="amt">' + money(f.amount, true) + '<small>' + esc(t('listedAt', { amount: money(f.listPrice) })) + '</small></div>' +
      '<div class="acts">' + acts + '</div></div>';
  }
  var OFFER_TONE = { pending: 'warn', countered: 'gold', accepted: 'ok', declined: 'bad', withdrawn: '', expired: '' };
  function offerSentHtml(f) {
    var acts = '';
    if (f.status === 'pending') acts = '<button type="button" class="v-btn ghost xs" data-offer-act="withdraw" data-offer="' + f.id + '">' + esc(t('withdrawOffer')) + '</button>' +
      '<span class="v-note" style="margin-left:auto;">' + esc(t('expiresIn')) + ' <span data-ends="' + esc(f.expiresAt) + '"><span class="cd-t"></span></span></span>';
    else if (f.status === 'countered') acts = '<span class="v-note">' + esc(t('sellerCountered', { amount: money(f.counter, true) })) + '</span>' +
      '<button type="button" class="v-btn ok xs" data-offer-act="acceptCounter" data-offer="' + f.id + '">' + esc(t('acceptAmount', { amount: money(f.counter) })) + '</button>' +
      '<button type="button" class="v-btn ghost xs" data-offer-act="declineCounter" data-offer="' + f.id + '">' + esc(t('decline')) + '</button>';
    return '<div class="v-offer"><div class="main"><b><a href="/vault-item.html?id=' + f.listingId + '">' + esc(f.title) + '</a> · EU ' + esc(f.size) + '</b>' +
      '<small>' + esc(S.ago(f.createdAt)) + '</small>' + (f.message ? '<q>' + esc(f.message) + '</q>' : '') + '</div>' +
      '<div class="amt">' + money(f.amount, true) + '<small>' + chip(OFFER_TONE[f.status], t('of_' + f.status)) + '</small></div>' +
      (acts ? '<div class="acts">' + acts + '</div>' : '') + '</div>';
  }

  /* ── bids and listings ────────────────────────────────────────────── */
  function bidRowHtml(l) {
    var live = l.status === 'live', ch;
    if (live) ch = l.leading ? chip('ok', t('bidWinning')) : chip('bad', t('bidOutbidChip'));
    else if (l.status === 'sold') ch = l.leading ? chip('gold', t('bidWon')) : chip('', t('bidLost'));
    else ch = chip('', t('st_' + l.status));
    return '<div class="v-rowcard">' + thumb(l.photo, S.itemHref(l)) +
      '<div class="main"><b><a href="' + S.itemHref(l) + '">' + esc(l.title) + '</a></b><small>EU ' + esc(l.size) + ' · ' + esc(t('yourMaxIs', { amount: money(l.myMax, true) })) + '</small>' +
        '<div class="chips">' + ch + (live && l.endsAt ? S.countdownHtml(l.endsAt) : '') + '</div></div>' +
      '<div class="side"><span class="amt"><small>' + esc(t(live ? 'currentBid' : 'finalPrice')) + '</small>' + money(l.price) + '</span>' +
        (live && !l.leading ? '<div class="acts"><a class="v-btn xs" href="' + S.itemHref(l) + '">' + esc(t('bidAgain')) + '</a></div>' : '') + '</div></div>';
  }
  function listingRowHtml(l) {
    var acts = '<a class="v-btn ghost xs" href="' + S.itemHref(l) + '">' + esc(t('view')) + '</a>';
    if ((l.status === 'review' || l.status === 'live') && !l.bids) acts += '<button type="button" class="v-btn danger xs" data-withdraw="' + l.id + '">' + esc(t('withdraw')) + '</button>';
    if ((l.status === 'ended' || l.status === 'cancelled') && l.liveAt) acts += '<button type="button" class="v-btn gold xs" data-relist="' + l.id + '">' + esc(t('relistBtn')) + '</button>';
    var stats = [];
    if (l.format === 'auction') stats.push(S.tn('bids', l.bids || 0));
    stats.push(S.tn('watchers', l.watchers || 0));
    if (l.openOffers) stats.push(S.tn('openOffers', l.openOffers));
    return '<div class="v-rowcard">' + thumb(l.photo, S.itemHref(l)) +
      '<div class="main"><b><a href="' + S.itemHref(l) + '">' + esc(l.title) + '</a></b><small>EU ' + esc(l.size) + ' · ' + esc(stats.join(' · ')) + '</small>' +
        '<div class="chips">' + chip(LIST_TONE[l.status], t('st_' + l.status)) + S.tierBadge(l.tier) +
          (l.status === 'live' && l.format === 'auction' && l.endsAt ? S.countdownHtml(l.endsAt) : '') + '</div>' +
        (l.status === 'rejected' && l.reviewNote ? '<small style="color:#ff9a9a;margin-top:0.45rem;">' + esc(l.reviewNote) + '</small>' : '') + '</div>' +
      '<div class="side"><span class="amt"><small>' + esc(t(l.format === 'auction' ? (l.bids ? 'currentBid' : 'startingBid') : 'price')) + '</small>' + money(l.price) + '</span>' +
        '<div class="acts">' + acts + '</div></div></div>';
  }

  /* ── payouts (Stripe Connect) ─────────────────────────────────────── */
  function payoutState(p) {
    return p.payouts ? 'ready' : p.ready ? (p.due ? 'due' : 'check') : p.connected ? 'continue' : 'setup';
  }
  function payoutsHtml() {
    if (!data.connect) return '';
    var p = payouts || data.seller || {}, state = payoutState(p);
    var copy = {
      setup: ['payoutsSetupT', 'payoutsSetupP', 'setup', 'payoutsSetupBtn'],
      'continue': ['payoutsContinueT', 'payoutsContinueP', 'setup', 'payoutsContinueBtn'],
      due: ['payoutsCheckT', 'payoutsDueP', 'setup', 'payoutsContinueBtn'],
      check: ['payoutsCheckT', 'payoutsCheckP', 'check', 'payoutsRecheck'],
      ready: ['payoutsReadyT', 'payoutsReadyP', 'dash', 'payoutsDashBtn']
    }[state];
    var nums = [];
    if (payouts && payouts.paid && payouts.paid.count) nums.push('<span>' + esc(t('payoutsPaidL')) + ' <b>' + money(payouts.paid.amount, true) + '</b></span>');
    if (payouts && payouts.waiting && payouts.waiting.count) nums.push('<span>' + esc(t('payoutsWaitingL')) + ' <b>' + money(payouts.waiting.amount, true) + '</b></span>');
    var main = copy[2] === 'setup';
    return '<section class="v-group" id="payouts" style="scroll-margin-top:90px;"><div class="v-group-head"><h2>' + esc(t('payoutsT')) + '</h2><small>' + esc(t('payoutsSub')) + '</small></div>' +
      '<div class="v-payouts ' + (state === 'ready' ? 'ready' : main ? 'todo' : '') + '">' +
        '<span class="ico">' + S.ico(state === 'ready' ? 'check' : state === 'check' ? 'clock' : 'euro') + '</span>' +
        '<div><b>' + esc(t(copy[0])) + '</b><small>' + esc(t(copy[1])) + '</small>' + (nums.length ? '<div class="nums">' + nums.join('') + '</div>' : '') + '</div>' +
        '<div class="act"><button type="button" class="v-btn ' + (main ? 'gold' : 'ghost') + ' sm" data-payouts="' + copy[2] + '">' + esc(t(copy[3])) + '</button></div>' +
      '</div></section>';
  }
  function refreshPayouts(btn, loud) {
    if (!data || !data.connect) return Promise.resolve();
    S.busy(btn, true);
    return S.market('payouts/status').then(function (res) {
      S.busy(btn, false);
      if (!res.ok || !res.data.connect) { if (loud) S.toast(S.errText(res), 'bad'); return; }
      payouts = res.data;
      data.seller = { connected: payouts.connected, ready: payouts.ready, payouts: payouts.payouts, due: payouts.due };
      if (loud) S.toast(t(payouts.payouts ? 'sellerReadyToast' : 'sellerNotYet'), payouts.payouts ? 'ok' : '');
      // money that waited for the setup has just been sent: show it
      if (payouts.released) { S.toast(t('payoutsReleasedToast'), 'ok'); return load(); }
      render();
    });
  }
  // Stripe's dashboard for the seller (bank account, payouts, tax forms).
  // The tab opens inside the click so browsers do not block it.
  function dashboard(btn) {
    var tab2 = w.open('about:blank', '_blank');
    S.busy(btn, true);
    S.market('payouts/dashboard', { body: {} }).then(function (res) {
      S.busy(btn, false);
      if (!res.ok || !res.data.url) { if (tab2) tab2.close(); S.toast(S.errText(res), 'bad'); return; }
      if (tab2) tab2.location.href = res.data.url; else w.location.href = res.data.url;
    });
  }

  /* ── render ───────────────────────────────────────────────────────── */
  function counts() {
    var b = data.buying, s = data.selling;
    var act = function (o) { return ['delivered', 'cancelled', 'failed', 'refunded'].indexOf(o.status) === -1; };
    return {
      buying: b.orders.filter(act).length + b.bids.filter(function (l) { return l.status === 'live'; }).length +
        b.offers.filter(function (f) { return f.status === 'pending' || f.status === 'countered'; }).length,
      selling: s.orders.filter(act).length + s.offers.filter(function (f) { return f.status === 'pending'; }).length +
        s.listings.filter(function (l) { return l.status === 'live' || l.status === 'review'; }).length,
      watching: data.watching.length
    };
  }
  function render() {
    var u = data.user || {};
    $('meHello').textContent = t('hello', { name: S.firstName(u.name) || '' });
    if (!tab) tab = pickTab();
    var td = todos(), c = counts();
    var h = '';
    if (td.length) {
      h += '<div class="v-todo" role="list" aria-label="' + esc(t('todoTitle')) + '">' + td.map(function (x) {
        return '<button type="button" class="v-todo-item" role="listitem" data-todo-order="' + (x.order || '') + '" data-todo-pay="' + (x.pay || '') + '" data-todo-offers="' + (x.offers || '') + '" data-todo-payouts="' + (x.payouts || '') + '">' +
          S.ico(x.icon) + '<span>' + esc(x.text) + '</span><span class="go">' + esc(x.go) + ' →</span></button>';
      }).join('') + '</div>';
    }
    var tb = function (k, label, n) {
      return '<button type="button" role="tab" data-tab="' + k + '" class="' + (tab === k ? 'on' : '') + '" aria-selected="' + (tab === k ? 'true' : 'false') + '">' + esc(label) +
        (n ? '<span class="n' + (k === 'watching' ? ' soft' : '') + '">' + n + '</span>' : '') + '</button>';
    };
    h += '<div class="v-tabs" role="tablist">' + tb('buying', t('tabBuying'), c.buying) + tb('selling', t('tabSelling'), c.selling) + tb('watching', t('watchlist'), c.watching) + '</div>';
    h += '<div id="mePanel">' + panel() + '</div>';
    $('meBody').innerHTML = h;
    S.tick();
    if (firstRender) { firstRender = false; jump(); }
  }
  function panel() {
    var b = data.buying, s = data.selling;
    if (tab === 'buying') {
      if (!b.orders.length && !b.bids.length && !b.offers.length) return emptyBig('bag', 'emptyBuyingT', 'emptyBuying', '/vault.html', 'heroBrowse');
      return (b.orders.length ? group('buyOrders', t('orders'), '', b.orders.map(orderHtml).join('')) : '') +
        group('buyBids', t('bidsTitle'), t('bidsSub'), b.bids.length ? b.bids.map(bidRowHtml).join('') : emptyNote(t('noBidsYet'))) +
        group('offers', t('offersSent'), '', b.offers.length ? b.offers.map(offerSentHtml).join('') : emptyNote(t('noOffersSent')));
    }
    if (tab === 'selling') {
      var listings = s.listings.filter(function (l) { return l.status !== 'relisted'; });
      if (!listings.length && !s.orders.length) return (data.connect && !(data.seller && data.seller.payouts) ? payoutsHtml() : '') + emptyBig('tag', 'emptySellingT', 'emptySelling', '/vault-sell.html', 'sellPair');
      return payoutsHtml() + group('offers', t('offersToAnswer'), t('offersSub'), s.offers.length ? s.offers.map(offerReceivedHtml).join('') : emptyNote(t('noOffersIn'))) +
        (s.orders.length ? group('sellOrders', t('sales'), '', s.orders.map(orderHtml).join('')) : '') +
        group('listings', t('yourListings'), '', listings.map(listingRowHtml).join(''));
    }
    if (!data.watching.length) return emptyBig('heart', 'emptyWatchT', 'emptyWatch', '/vault.html', 'heroBrowse');
    return '<div class="v-grid">' + data.watching.map(function (l) { l.watching = true; return S.card(l); }).join('') + '</div>';
  }
  function emptyBig(icon, tk, pk, href, bk) {
    return '<div class="v-empty">' + S.ico(icon === 'bag' ? 'box' : icon) + '<h3>' + esc(t(tk)) + '</h3><p>' + esc(t(pk)) + '</p>' +
      '<div class="v-btn-row"><a class="v-btn" href="' + href + '">' + esc(t(bk)) + '</a></div></div>';
  }
  function pickTab() {
    var h = (w.location.hash || '').slice(1);
    if (h === 'selling' || h === 'buying' || h === 'watching') return h;
    if (h === 'payouts') return 'selling';
    var m = /^order-(\d+)$/.exec(h);
    if (m) {
      var id = +m[1];
      if (data.selling.orders.some(function (o) { return o.id === id; })) return 'selling';
      return 'buying';
    }
    if (h === 'offers') return data.selling.offers.length ? 'selling' : 'buying';
    var c = counts();
    return !c.buying && c.selling ? 'selling' : 'buying';
  }
  function setTab(k, keepHash) {
    tab = k;
    if (!keepHash) try { w.history.replaceState(null, '', w.location.pathname + w.location.search + '#' + k); } catch (e) {}
    render();
  }
  // scroll to the card a link (or an email) pointed at
  function jump() {
    var h = (w.location.hash || '').slice(1);
    var el = /^order-\d+$/.test(h) ? $(h) : (h === 'offers' || h === 'payouts') ? $(h) : null;
    if (!el) return;
    setTimeout(function () {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      var card = el.classList.contains('v-order') ? el : null;
      if (card) { card.classList.add('flash'); setTimeout(function () { card.classList.remove('flash'); }, 2400); }
    }, 120);
  }
  function findOrder(id) {
    return data.buying.orders.concat(data.selling.orders).filter(function (o) { return o.id === id; })[0];
  }
  function findOffer(id) {
    return data.buying.offers.concat(data.selling.offers).filter(function (f) { return f.id === id; })[0];
  }

  /* ── actions ──────────────────────────────────────────────────────── */
  function act(btn, route, body, okKey) {
    S.busy(btn, true);
    return S.market(route, { body: body }).then(function (res) {
      S.busy(btn, false);
      if (!res.ok) { S.toast(S.errText(res), 'bad'); load(); return null; }
      if (okKey) S.toast(t(okKey), 'ok');
      load();
      return res;
    });
  }
  function pay(id) {
    var o = findOrder(id);
    if (!o) return;
    S.payFlow({ orderId: o.id, title: o.title + ' · EU ' + o.size, tier: o.tier, itemPrice: o.itemPrice, authFee: o.authFee, shipFee: o.shipFee, total: o.total })
      .then(function (r) { if (r && r.manual) { S.toast(t('reservedToast'), 'ok'); load(); } });
  }
  function onClick(e) {
    var el = e.target.closest('button,[data-tab]');
    if (!el) return;
    var g = function (k) { return el.getAttribute(k); };
    if (g('data-tab')) { setTab(g('data-tab')); return; }
    if (el.classList.contains('v-todo-item')) {
      if (g('data-todo-pay')) { pay(+g('data-todo-pay')); return; }
      if (g('data-todo-offers')) { setTab(g('data-todo-offers'), true); w.location.hash = 'offers'; jump(); return; }
      if (g('data-todo-payouts')) { setTab('selling', true); w.location.hash = 'payouts'; jump(); return; }
      if (g('data-todo-order')) {
        var o = findOrder(+g('data-todo-order'));
        if (o) { tab = o.role === 'seller' ? 'selling' : 'buying'; render(); w.location.hash = 'order-' + o.id; jump(); }
      }
      return;
    }
    if (g('data-pay')) { pay(+g('data-pay')); return; }
    if (g('data-payouts')) {
      var how = g('data-payouts');
      if (how === 'setup') S.payoutsSetup(el, true);
      else if (how === 'dash') dashboard(el);
      else refreshPayouts(el, true);
      return;
    }
    if (g('data-ship')) {
      var trk = $('trk' + g('data-ship'));
      if (!trk.value.trim()) { trk.classList.add('err'); trk.focus(); S.toast(t('e_tracking'), 'bad'); return; }
      act(el, 'order/ship', { orderId: +g('data-ship'), tracking: trk.value.trim() }, 'shippedToast');
      return;
    }
    if (g('data-received')) {
      var oid = +g('data-received');
      S.confirm(t('confirmDeliveryT'), t('confirmDeliveryQ'), t('confirmDelivery')).then(function (y) {
        if (y) act(el, 'order/received', { orderId: oid }, 'receivedToast');
      });
      return;
    }
    if (g('data-problem')) { problem(+g('data-problem')); return; }
    if (g('data-rate')) {
      var row = el.closest('[data-rate-row]'), orderId = +row.getAttribute('data-rate-row');
      var comment = ($('fbc' + orderId) || {}).value || '';
      act(el, 'order/feedback', { orderId: orderId, rating: +g('data-rate'), comment: comment.trim() }, 'ratedToast');
      return;
    }
    if (g('data-withdraw')) {
      var lid = +g('data-withdraw');
      S.confirm(t('withdrawT'), t('withdrawQ'), t('withdraw'), true).then(function (y) {
        if (y) act(el, 'listing/cancel', { id: lid }, 'withdrawn');
      });
      return;
    }
    if (g('data-relist')) {
      var l = data.selling.listings.filter(function (x) { return x.id === +g('data-relist'); })[0];
      if (l) S.relistFlow(l).then(function (nid) { if (nid) { S.toast(t('relistedToast'), 'ok'); load(); } });
      return;
    }
    if (g('data-offer-act')) offerAction(el, g('data-offer-act'), +g('data-offer'));
  }
  function offerAction(el, what, id) {
    var f = findOffer(id);
    if (!f) return;
    if (what === 'accept') {
      S.confirm(t('acceptOfferT'), t('acceptOfferQ', { amount: money(f.amount, true), name: f.buyer || '' }), t('accept')).then(function (y) {
        if (y) act(el, 'offer/respond', { offerId: id, action: 'accept' }, 'offerAcceptedToast');
      });
    } else if (what === 'decline') {
      act(el, 'offer/respond', { offerId: id, action: 'decline' }, 'offerDeclinedToast');
    } else if (what === 'counter') {
      var inp = $('ctr' + id), c = S.centsOf(inp.value);
      if (isNaN(c) || c <= f.amount || (f.listPrice && c >= f.listPrice)) {
        inp.classList.add('err'); inp.focus();
        S.toast(t('e_counter_range'), 'bad');
        return;
      }
      act(el, 'offer/respond', { offerId: id, action: 'counter', amount: c / 100 }, 'counterSent');
    } else if (what === 'withdraw') {
      S.confirm(t('withdrawOfferT'), t('withdrawOfferQ'), t('withdrawOffer'), true).then(function (y) {
        if (y) act(el, 'offer/respond', { offerId: id, action: 'withdraw' }, 'offerWithdrawn');
      });
    } else if (what === 'declineCounter') {
      act(el, 'offer/respond', { offerId: id, action: 'decline' }, 'counterDeclined');
    } else if (what === 'acceptCounter') {
      S.confirm(t('acceptCounterT'), t('acceptCounterQ', { amount: money(f.counter, true) }), t('acceptAmount', { amount: money(f.counter) })).then(function (y) {
        if (!y) return;
        S.busy(el, true);
        S.market('offer/respond', { body: { offerId: id, action: 'accept' } }).then(function (res) {
          S.busy(el, false);
          if (!res.ok) { S.toast(S.errText(res), 'bad'); load(); return; }
          load().then(function () { pay(res.data.orderId); });
        });
      });
    }
  }
  function problem(orderId) {
    var m = S.modal({
      title: t('problemT'),
      html: '<p>' + esc(t('problemLead')) + '</p>' +
        '<div class="v-field"><label class="v-label" for="vpbNote">' + esc(t('problemWhat')) + '</label>' +
        '<textarea class="v-textarea" id="vpbNote" rows="4" maxlength="1000" placeholder="' + esc(t('problemPh')) + '"></textarea></div>' +
        '<div class="v-msg" role="alert"></div>',
      foot: '<button type="button" class="v-btn ghost" data-no>' + esc(t('cancel')) + '</button><button type="button" class="v-btn" data-go>' + esc(t('sendReport')) + '</button>'
    });
    m.$('[data-no]').addEventListener('click', function () { m.close(); });
    var go = m.$('[data-go]');
    go.addEventListener('click', function () {
      var note = m.$('#vpbNote').value.trim(), msg = m.$('.v-msg');
      if (note.length < 10) { msg.textContent = t('e_problem_note'); msg.className = 'v-msg bad'; return; }
      S.busy(go, true);
      S.market('order/problem', { body: { orderId: orderId, note: note } }).then(function (res) {
        if (!res.ok) { S.busy(go, false); msg.textContent = S.errText(res); msg.className = 'v-msg bad'; return; }
        m.close(true);
        S.toast(t('problemSent'), 'ok');
        load();
      });
    });
  }

  d.addEventListener('click', function (e) { if ($('meBody').contains(e.target)) onClick(e); });
  w.addEventListener('hashchange', function () {
    if (!data) return;
    var k = pickTab();
    if (k !== tab) { tab = k; render(); }
    jump();
  });
  d.addEventListener('visibilitychange', function () {
    if (d.hidden || !data) return;
    load();
    // back from Stripe in another tab
    if (data.connect && !(data.seller && data.seller.payouts)) refreshPayouts();
  });
  d.addEventListener('slv:watch', function (e) {
    if (tab === 'watching' && !e.detail.watching) load();
  });

  S.boot({
    key: 'me',
    title: 'pageMine',
    init: function (me) {
      var paid = S.qs('paid'), reserved = S.qs('reserved');
      if (paid || reserved) {
        S.toast(t(paid ? 'paidToast' : 'reservedToast'), 'ok');
        try { w.history.replaceState(null, '', w.location.pathname + w.location.hash); } catch (e) {}
        // the payment webhook can trail the redirect by a few seconds
        if (paid) { setTimeout(load, 4000); setTimeout(load, 12000); }
      }
      // back from Stripe's onboarding: ?payouts=done, or ?payouts=retry when
      // the link had expired, in which case a fresh one is made straight away
      var po = S.qs('payouts');
      if (po) {
        try { w.history.replaceState(null, '', w.location.pathname + '#payouts'); } catch (e) {}
        tab = 'selling';
        if (po === 'retry' && me) { S.payoutsSetup(null, true).then(function (ok) { if (!ok) load(); }); return; }
        if (po === 'done' && me) S.toast(t('payoutsDoneToast'), 'ok');
      }
      if (!me) { gate(); return; }
      load();
    },
    onLang: function () { if (data) render(); },
    onAuth: function () { load(); }
  });
})(window, document);
