/* ShoeLab Vault — one listing (vault-item.html?id=N, or ?preview=N for the
 * labelled examples): gallery, bidding, Buy Now, offers, the watchlist, the
 * seller's own controls, bid history and seller reputation. Live auctions
 * refresh themselves, faster in the closing minutes. */
(function (w, d) {
  'use strict';
  var S = w.SLV, t = S.t, esc = S.esc, money = S.money;
  var $ = function (id) { return d.getElementById(id); };

  var id = parseInt(S.qs('id'), 10) || null;
  var pv = parseInt(S.qs('preview'), 10) || null;
  var L = null, photo = 0, timer = null, loading = false, moreDone = false;

  function inc(c) { return c < 5000 ? 100 : c < 20000 ? 250 : c < 50000 ? 500 : c < 100000 ? 1000 : 2500; }

  /* ── example listing (preview mode) ───────────────────────────────── */
  function previewListing(n) {
    var x = S.previewItems().filter(function (i) { return i.id === n; })[0];
    if (!x) return null;
    var hist = [], p = x.price;
    for (var i = 0; i < x.bids; i++) {
      hist.push({ who: ['A***a', 'M***s', 'K***n', 'J***e'][i % 4], amount: p, auto: i % 2 === 1, at: new Date(Date.now() - (i + 1) * 2.7 * 3600000).toISOString() });
      p = Math.max(x.startPrice, p - inc(p) * (i % 2 ? 1 : 3));
    }
    return Object.assign({}, x, {
      description: t(x.descKey), startPrice: x.startPrice || x.price,
      photos: [{ url: x.photo, kind: 'side_out' }],
      seller: { name: t('pvSeller'), since: '2025-03-01T10:00:00Z', sales: 23, rating: { pos: 23, neu: 0, neg: 0, score: 100 }, feedback: [] },
      bidHistory: hist, increment: x.format === 'auction' ? inc(x.price) : null,
      minNext: x.format === 'auction' ? (x.bids ? x.price + inc(x.price) : x.startPrice) : null,
      binAvailable: !!x.buyNow && (x.format === 'fixed' || !x.bids),
      fees: { auth: x.tier === 'lab' ? 1290 : 490, shipping: 699 }, viewer: null, liveAt: new Date(Date.now() - 3 * 86400000).toISOString()
    });
  }

  /* ── loading ──────────────────────────────────────────────────────── */
  function load(first) {
    if (pv) {
      L = previewListing(pv);
      if (!L) { notFound(); return; }
      render();
      return;
    }
    if (!id) { notFound(); return; }
    if (loading) return;
    loading = true;
    S.market('listing?id=' + id).then(function (res) {
      loading = false;
      if (!res.ok) {
        if (first || res.status === 404) notFound(res);
        schedule();
        return;
      }
      var prev = L;
      L = res.data.listing;
      if (first || !prev) render(); else update(prev);
      schedule();
    });
  }
  function schedule() {
    clearTimeout(timer);
    if (pv || !L || L.status !== 'live') return;
    var ms = 60000;
    if (L.format === 'auction' && L.endsAt) ms = S.left(L.endsAt).ms < 180000 ? 4000 : 15000;
    timer = setTimeout(function () { if (d.hidden) schedule(); else load(false); }, ms);
  }
  function notFound(res) {
    $('vItem').innerHTML = '<div class="v-empty">' + S.ico('vault') + '<h3>' + esc(t('goneT')) + '</h3><p>' +
      esc(res && res.status && res.status !== 404 ? S.errText(res) : t('gone')) + '</p>' +
      '<div class="v-btn-row"><a class="v-btn" href="/vault.html">' + esc(t('backToVault')) + '</a></div></div>';
    $('vCrumb').innerHTML = '<a href="/vault.html">ShoeLab Vault</a>';
  }

  /* ── render ───────────────────────────────────────────────────────── */
  function render() {
    var title = L.title + ' · EU ' + L.size;
    d.title = title + ' — ShoeLab Vault';
    $('vCrumb').innerHTML = '<a href="/vault.html">ShoeLab Vault</a><span>/</span>' +
      '<a href="/vault.html?brand=' + encodeURIComponent(L.brand) + '#browse">' + esc(L.brand) + '</a><span>/</span><span>' + esc(L.model) + '</span>';
    $('vPreview').innerHTML = pv ? '<div class="v-preview-bar"><span><b>' + esc(t('previewT')) + '</b> ' + esc(t('previewItemBar')) + '</span>' +
      '<a class="v-btn xs ghost" href="/vault.html?preview=1#browse">' + esc(t('morePreview')) + '</a></div>' : '';
    $('vItem').innerHTML =
      '<div class="v-item">' +
        '<div class="v-gallery">' + galleryHtml() + '</div>' +
        '<div class="v-buy" id="vBuy">' + buyHtml() + '</div>' +
      '</div>' +
      '<div class="v-item" style="margin-top:2rem;align-items:start;" id="vLower">' + lowerHtml() + '</div>';
    wireGallery();
    wireBuy(true);
    sticky();
    seo();
    S.tick();
    if (!moreDone) { moreDone = true; moreLike(); }
  }
  // a refresh only touches the parts that can change
  function update(prev) {
    var inp = $('vBidMax'), val = inp ? inp.value : '', focused = inp && d.activeElement === inp;
    $('vBuy').innerHTML = buyHtml();
    $('vLower').innerHTML = lowerHtml();
    wireBuy(false);
    sticky();
    var n = $('vBidMax');
    if (n) { n.value = val; if (focused) n.focus(); }
    if (prev.price !== L.price) {
      var p = $('vPrice');
      if (p) { p.style.transition = 'none'; p.style.color = '#f3d77a'; setTimeout(function () { p.style.transition = 'color 1.2s'; p.style.color = ''; }, 60); }
    }
    if (prev.viewer && L.viewer && prev.viewer.highBidder && !L.viewer.highBidder && L.status === 'live') S.toast(t('bidOutbidLive'), 'bad');
    if (prev.status === 'live' && L.status !== 'live') S.toast(t(L.status === 'sold' ? 'justSold' : 'justEnded'), 'info');
    S.tick();
  }

  function kindLabel(k) { return t('kind_' + k); }
  function galleryHtml() {
    var ph = L.photos || [];
    if (!ph.length) return '<div class="v-stage">' + S.photoHtml(null) + '</div>';
    photo = Math.min(photo, ph.length - 1);
    var cur = ph[photo];
    return '<div class="v-stage" id="vStage" role="button" tabindex="0" aria-label="' + esc(t('zoom')) + '">' +
        '<img id="vMainImg" src="' + esc(cur.url) + '" alt="' + esc(L.title + ' — ' + kindLabel(cur.kind)) + '"' + (L.cut ? ' class="cut"' : '') + '/>' +
        '<span class="v-kind v-badge ghost" id="vKind">' + esc(kindLabel(cur.kind)) + '</span>' +
        (ph.length > 1 ? '<button type="button" class="nav prev" data-nav="-1" aria-label="' + esc(t('prevPhoto')) + '">' + S.ico('left') + '</button>' +
          '<button type="button" class="nav next" data-nav="1" aria-label="' + esc(t('nextPhoto')) + '">' + S.ico('right') + '</button>' : '') +
      '</div>' +
      (ph.length > 1 ? '<div class="v-thumbs" id="vThumbs">' + ph.map(function (p, i) {
        return '<button type="button" class="v-thumb' + (i === photo ? ' on' : '') + '" data-i="' + i + '" aria-label="' + esc(kindLabel(p.kind)) + '">' +
          '<img src="' + esc(p.url) + '" alt="" loading="lazy"/></button>';
      }).join('') + '</div>' : '');
  }
  function show(i) {
    var ph = L.photos || [];
    if (!ph.length) return;
    photo = (i + ph.length) % ph.length;
    var img = $('vMainImg');
    img.src = ph[photo].url;
    img.alt = L.title + ' — ' + kindLabel(ph[photo].kind);
    $('vKind').textContent = kindLabel(ph[photo].kind);
    Array.prototype.forEach.call(d.querySelectorAll('.v-thumb'), function (b, j) { b.classList.toggle('on', j === photo); });
  }
  function wireGallery() {
    var st = $('vStage');
    if (!st) return;
    st.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-nav]');
      if (nav) { e.stopPropagation(); show(photo + parseInt(nav.getAttribute('data-nav'), 10)); return; }
      openLightbox();
    });
    st.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(); } });
    var th = $('vThumbs');
    if (th) th.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]');
      if (b) show(parseInt(b.getAttribute('data-i'), 10));
    });
    // swipe on touch screens
    var x0 = null;
    st.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    st.addEventListener('touchend', function (e) {
      if (x0 == null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) show(photo + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  }
  function openLightbox() {
    var lb = $('vLightbox'), ph = L.photos || [];
    if (!ph.length) return;
    lb.querySelector('img').src = ph[photo].url;
    lb.querySelector('img').alt = L.title;
    lb.classList.add('open');
    lb.querySelector('button').focus();
  }

  /* ── the buy column ───────────────────────────────────────────────── */
  function isOwner() { return !!(L.viewer && L.viewer.role === 'seller'); }
  function stateBox(kind, icon, html) { return '<div class="v-state ' + kind + '">' + S.ico(icon) + '<div>' + html + '</div></div>'; }

  function statesHtml() {
    var v = L.viewer || {}, out = [];
    if (isOwner()) {
      if (L.status === 'review') out.push(stateBox('warn', 'clock', esc(t('ownReview')) + ' <button type="button" class="v-link-btn" data-act="withdraw">' + esc(t('withdraw')) + '</button>'));
      else if (L.status === 'rejected') out.push(stateBox('bad', 'alert', '<b>' + esc(t('ownRejected')) + '</b> ' + esc(L.reviewNote || '') + ' <a href="/vault-sell.html">' + esc(t('listAgain')) + '</a>'));
      else if (L.status === 'live') out.push(stateBox('info', 'eye', esc(t('ownLive')) + (L.bids ? '' : ' <button type="button" class="v-link-btn" data-act="withdraw">' + esc(t('withdraw')) + '</button>') +
        ' · <a href="/vault-me.html#selling">' + esc(t('manageInVault')) + '</a>'));
      else if (L.status === 'sold') out.push(stateBox('ok', 'check', '<b>' + esc(t('ownSold', { amount: money(L.price) })) + '</b>' +
        (v.order ? ' <a href="/vault-me.html#order-' + v.order.id + '">' + esc(t('viewOrder')) + '</a>' : '')));
      else if (L.status === 'ended' || L.status === 'cancelled') out.push(stateBox('info', 'info', esc(t(L.status === 'ended' ? 'ownEnded' : 'ownCancelled')) +
        (L.liveAt ? ' <button type="button" class="v-link-btn" data-act="relist">' + esc(t('relistBtn')) + '</button>' : '')));
      else if (L.status === 'relisted') out.push(stateBox('info', 'refresh', esc(t('ownRelisted'))));
      return out.join('');
    }
    if (v.specialist && L.status === 'review') out.push(stateBox('gold', 'shield', esc(t('labReviewHint')) + ' <a href="/vault-lab.html">' + esc(t('navLab')) + '</a>'));
    if (L.status === 'live' && L.format === 'auction' && v.highBidder) out.push(stateBox('ok', 'check', '<b>' + esc(t('youLead')) + '</b> ' + esc(t('yourMaxIs', { amount: money(v.myMax, true) }))));
    else if (L.status === 'live' && L.format === 'auction' && v.myMax) out.push(stateBox('bad', 'alert', '<b>' + esc(t('youOutbid')) + '</b> ' + esc(t('yourMaxWas', { amount: money(v.myMax, true) }))));
    if (L.status === 'sold' && v.order && v.role === 'buyer') {
      var unpaid = v.order.status === 'awaiting_payment';
      out.push(stateBox('ok', 'check', '<b>' + esc(t('youBought')) + '</b> ' + (unpaid
        ? '<button type="button" class="v-link-btn" data-act="pay">' + esc(t('completePayment')) + '</button>'
        : '<a href="/vault-me.html#order-' + v.order.id + '">' + esc(t('viewOrder')) + '</a>')));
    } else if (L.status === 'sold') out.push(stateBox('info', 'tag', esc(t('soldInfo'))));
    else if (L.status === 'ended') out.push(stateBox('info', 'clock', esc(t('endedInfo'))));
    var off = v.offer;
    if (off && L.status === 'live') {
      if (off.status === 'pending') out.push(stateBox('info', 'chat', esc(t('offerPending', { amount: money(off.amount, true) })) +
        ' <button type="button" class="v-link-btn" data-act="withdrawOffer">' + esc(t('withdrawOffer')) + '</button>'));
      else if (off.status === 'countered') out.push(stateBox('gold', 'chat', '<b>' + esc(t('offerCountered', { amount: money(off.counter, true) })) + '</b>' +
        '<div class="v-btn-row" style="margin-top:0.6rem;"><button type="button" class="v-btn sm ok" data-act="acceptCounter">' + esc(t('acceptAmount', { amount: money(off.counter) })) + '</button>' +
        '<button type="button" class="v-btn sm ghost" data-act="declineCounter">' + esc(t('decline')) + '</button></div>'));
      else if (off.status === 'declined') out.push(stateBox('bad', 'x', esc(t('offerDeclined', { amount: money(off.amount, true) }))));
      else if (off.status === 'expired') out.push(stateBox('info', 'clock', esc(t('offerExpired'))));
    }
    return out.join('');
  }

  function priceHtml() {
    var auction = L.format === 'auction', live = L.status === 'live', owner = isOwner();
    var h = '<div class="v-pricebox">';
    if (L.status === 'sold') {
      h += '<div class="lbl">' + esc(t('soldFor')) + '</div><div class="big" id="vPrice">' + money(L.price) + '</div>' +
        (auction ? '<div class="sub"><span>' + esc(S.tn('bids', L.bids)) + '</span></div>' : '');
      return h + '</div>';
    }
    if (auction) {
      h += '<div class="lbl">' + esc(t(L.bids ? 'currentBid' : 'startingBid')) + '</div>' +
        '<div class="big" id="vPrice">' + money(L.price) + '</div>' +
        '<div class="sub"><span>' + esc(S.tn('bids', L.bids)) + '</span>' + (L.bids ? '<a href="#vHist">' + esc(t('seeHistory')) + '</a>' : '') + '</div>';
      if (L.endsAt) {
        var c = S.left(L.endsAt);
        h += '<div class="v-endrow"><div class="t">' + esc(t(live ? 'timeLeft' : 'ended')) +
          (live ? '<b class="' + (c.soon ? 'soon' : '') + '" data-ends="' + esc(L.endsAt) + '"><span class="cd-t">' + esc(c.text) + '</span></b>' : '') + '</div>' +
          '<div class="t" style="text-align:right;">' + esc(t(live ? 'endsAt' : 'endedAt')) + '<b>' + esc(S.fmtDateTime(L.endsAt)) + '</b></div></div>';
      }
      if (live && !owner) {
        var mine = L.viewer && L.viewer.highBidder;
        var floor = mine ? L.viewer.myMax + inc(L.viewer.myMax) : L.minNext;
        h += '<form class="v-bidform" id="vBidForm" novalidate>' +
            '<label class="sr-only" for="vBidMax">' + esc(t('yourMaxBid')) + '</label>' +
            '<div class="v-money"><input class="v-input" id="vBidMax" inputmode="decimal" autocomplete="off" placeholder="' + esc(S.amountText(floor)) + '"/></div>' +
            '<button class="v-btn" type="submit">' + esc(t(mine ? 'raiseMax' : 'placeBid')) + '</button>' +
          '</form>' +
          '<div class="v-err" id="vBidErr" role="alert"></div>' +
          '<div class="v-quick">' + [floor, floor + 500, floor + 1500].map(function (x) {
            return '<button type="button" data-quick="' + x + '">' + money(x) + '</button>';
          }).join('') + '</div>' +
          '<p class="v-note" style="margin-top:0.7rem;">' + esc(t(mine ? 'raiseNote' : 'proxyNote', { amount: money(L.minNext, true) })) + '</p>';
      }
      if (L.binAvailable && live && !owner) {
        h += '<div class="v-or">' + esc(t('or')) + '</div>' +
          '<button type="button" class="v-btn gold block" data-act="buy">' + esc(t('buyNowFor', { amount: money(L.buyNow) })) + '</button>' +
          '<p class="v-note" style="margin-top:0.5rem;text-align:center;">' + esc(t('binVanishes')) + '</p>';
      }
    } else {
      h += '<div class="lbl">' + esc(t('price')) + '</div><div class="big" id="vPrice">' + money(L.price) + '</div>' +
        (L.acceptOffers ? '<div class="sub"><span>' + esc(t('orBestOffer')) + '</span></div>' : '');
      if (live && !owner) {
        h += '<div class="v-btn-row" style="margin-top:1.1rem;">' +
          '<button type="button" class="v-btn gold" data-act="buy">' + esc(t('buyNow')) + '</button>' +
          (L.acceptOffers ? '<button type="button" class="v-btn ghost" data-act="offer">' + esc(t('makeOffer')) + '</button>' : '') +
          '</div>';
      }
    }
    if ((live || L.status === 'review') && !owner) {
      var on = L.viewer && L.viewer.watching;
      h += '<div class="v-btn-row" style="margin-top:0.7rem;"><button type="button" class="v-btn ghost sm v-watch' + (on ? ' on' : '') + '" data-watch="' + L.id + '"' +
        (pv ? ' data-preview' : '') + ' aria-pressed="' + (on ? 'true' : 'false') + '">' + S.ico('heart') +
        '<span>' + esc(t(on ? 'watching' : 'watch')) + '</span></button></div>';
    }
    return h + '</div>';
  }

  function proofHtml() {
    var lab = L.tier === 'lab';
    return '<div class="v-card-box v-proof ' + (lab ? 'lab' : 'photo') + '">' +
      '<div class="ico">' + S.ico(lab ? 'shield' : 'camera') + '</div>' +
      '<div><h3>' + esc(t(lab ? 'tierLab' : 'tierPhoto')) + '</h3><p>' + esc(t(lab ? 'proofLab' : 'proofPhoto')) + '</p></div></div>';
  }

  function payHtml() {
    if (L.status !== 'live' || isOwner()) return '';
    var base = L.format === 'fixed' ? L.buyNow : L.price;
    var o = { itemPrice: base, authFee: L.fees.auth, shipFee: L.fees.shipping, total: base + L.fees.auth + L.fees.shipping, tier: L.tier };
    return '<div class="v-card-box"><h3 class="v-h3" style="margin-bottom:0.6rem;">' + esc(t(L.format === 'auction' ? 'payIfWinNow' : 'youPay')) + '</h3>' +
      S.totalsHtml(o) + '<p class="v-note" style="margin-top:0.7rem;">' + esc(t('payWithin')) + '</p></div>';
  }

  function headHtml() {
    var meta = '<span class="v-chip">EU ' + esc(L.size) + '</span><span class="v-chip">' + esc(S.condLabel(L.cond)) + '</span>' + S.tierBadge(L.tier) +
      (L.watchers ? '<span class="v-chip" id="vWatchers">' + S.ico('heart') + ' ' + esc(S.tn('watchers', L.watchers)) + '</span>' : '<span class="v-chip" id="vWatchers" hidden></span>') +
      (L.status !== 'live' ? '<span class="v-chip ' + (L.status === 'sold' ? 'ok' : L.status === 'review' ? 'warn' : L.status === 'rejected' ? 'bad' : '') + '">' + esc(t('st_' + L.status)) + '</span>' : '<span class="v-chip live">' + esc(t('st_live')) + '</span>');
    return '<div class="v-buy-head"><span class="v-card-brand">' + esc(L.brand) + '</span><h1>' + esc(L.model) + '</h1>' +
      '<div class="v-buy-meta">' + meta + '</div></div>';
  }

  function buyHtml() { return headHtml() + statesHtml() + priceHtml() + proofHtml() + payHtml(); }

  /* ── description, details, history, seller ────────────────────────── */
  function lowerHtml() {
    var left = '<div class="v-card-box"><h2 class="v-h3" style="margin-bottom:0.7rem;">' + esc(t('description')) + '</h2>' +
      (L.description ? '<p class="v-desc">' + esc(L.description) + '</p>' : '<p class="v-note">' + esc(t('noDescription')) + '</p>') + '</div>' +
      '<div class="v-card-box" style="margin-top:1rem;"><h2 class="v-h3" style="margin-bottom:0.5rem;">' + esc(t('details')) + '</h2><div class="v-details">' +
        det(t('fBrand'), esc(L.brand)) + det(t('model'), esc(L.model)) + det(t('fSize'), 'EU ' + esc(L.size)) +
        det(t('fCond'), esc(S.condLabel(L.cond))) + det(t('fFormat'), esc(t(L.format === 'auction' ? 'fAuction1' : 'fFixed'))) +
        det(t('fTier'), esc(t(L.tier === 'lab' ? 'tierLab' : 'tierPhoto'))) +
        (L.liveAt ? det(t('listed'), esc(S.fmtDate(L.liveAt))) : '') + det(t('itemNo'), '#' + L.id) +
      '</div><p class="v-note" style="margin-top:0.7rem;">' + esc(t('condD_' + L.cond)) + '</p></div>';

    var right = '';
    if (L.format === 'auction') {
      var hist = L.bidHistory || [];
      right += '<div class="v-card-box" id="vHist" style="scroll-margin-top:90px;"><h2 class="v-h3" style="margin-bottom:0.4rem;">' + esc(t('bidHistory')) + '</h2>' +
        '<p class="v-note" style="margin-bottom:0.5rem;">' + esc(t('histNote')) + '</p>' +
        (hist.length ? '<ul class="v-hist">' + hist.map(function (b, i) {
          return '<li class="' + (i === 0 ? 'top' : '') + '"><span class="who">' + esc(b.who) + (b.auto ? ' <em>' + esc(t('autoBid')) + '</em>' : '') + '</span>' +
            '<span><span class="amt">' + money(b.amount, true) + '</span><span class="at">' + esc(S.ago(b.at)) + '</span></span></li>';
        }).join('') + '<li><span class="who" style="color:var(--muted);">' + esc(t('startingPrice')) + '</span><span class="amt" style="color:var(--muted);">' + money(L.startPrice, true) + '</span></li></ul>'
          : '<p class="v-note">' + esc(t('noBids', { amount: money(L.startPrice, true) })) + '</p>') + '</div>';
    }
    var sl = L.seller || {}, r = sl.rating || {};
    var nr = (r.pos || 0) + (r.neu || 0) + (r.neg || 0);
    right += '<div class="v-card-box"' + (L.format === 'auction' ? ' style="margin-top:1rem;"' : '') + '><h2 class="v-h3" style="margin-bottom:0.8rem;">' + esc(t('seller')) + '</h2>' +
      '<div class="v-seller"><span class="v-avatar">' + esc(S.initials(sl.name)) + '</span><div><b>' + esc(sl.name || '—') + '</b>' +
      (sl.verified ? ' <span class="v-chip ok v-verified" title="' + esc(t('verifiedSellerTip')) + '">' + S.ico('shield', 'inl') + ' ' + esc(t('verifiedSeller')) + '</span>' : '') +
      '<small>' + esc(sl.since ? t('memberSince', { date: S.fmtDate(sl.since) }) : '') + ' · ' + esc(S.tn('sales', sl.sales || 0)) + '</small>' +
      '<small style="display:block;">' + (nr ? S.ico('star', 'inl') + ' ' + esc(t('positive', { pct: r.score == null ? '—' : r.score, n: S.num(nr) })) : esc(t('noRatings'))) + '</small></div></div>' +
      ((sl.feedback || []).length ? '<ul class="v-hist" style="margin-top:0.8rem;">' + sl.feedback.map(function (f) {
        return '<li><span class="who">' + (f.rating > 0 ? '👍' : f.rating < 0 ? '👎' : '➖') + ' ' + esc(f.comment || t('noComment')) + '</span><span class="at">' + esc(f.who) + ' · ' + esc(S.ago(f.at)) + '</span></li>';
      }).join('') + '</ul>' : '') +
      '<p class="v-note" style="margin-top:0.8rem;">' + esc(t('sellerProtect')) + '</p></div>';
    return '<div>' + left + '</div><div>' + right + '</div>';
  }
  function det(k, v) { return '<div><span>' + esc(k) + '</span><span>' + v + '</span></div>'; }

  /* ── actions ──────────────────────────────────────────────────────── */
  // the bid form is rebuilt on every refresh; the column itself only on render
  function wireBuy(column) {
    var f = $('vBidForm');
    if (f) f.addEventListener('submit', onBid);
    if (!column) return;
    $('vBuy').addEventListener('click', function (e) {
      var q = e.target.closest('[data-quick]');
      if (q) { $('vBidMax').value = S.amountText(parseInt(q.getAttribute('data-quick'), 10)); $('vBidMax').focus(); bidErr(''); return; }
      var a = e.target.closest('[data-act]');
      if (!a) return;
      var act = a.getAttribute('data-act');
      if (pv && act !== 'pay') { S.toast(t('previewOnly'), 'info'); return; }
      ({ buy: onBuy, offer: onOffer, withdraw: onWithdraw, relist: onRelist, pay: onPayExisting,
         withdrawOffer: function () { respond('withdraw'); }, acceptCounter: function () { respond('accept'); },
         declineCounter: function () { respond('decline'); } })[act]();
    });
  }
  function bidErr(text) {
    var e = $('vBidErr');
    if (!e) return;
    e.textContent = text || '';
    e.classList.toggle('on', !!text);
    $('vBidMax').classList.toggle('err', !!text);
  }
  function onBid(e) {
    e.preventDefault();
    if (pv) { S.toast(t('previewOnly'), 'info'); return; }
    var c = S.centsOf($('vBidMax').value);
    var mine = L.viewer && L.viewer.highBidder;
    if (isNaN(c) || c <= 0) return bidErr(t('e_bid_input'));
    if (mine && c <= L.viewer.myMax) return bidErr(t('e_max_already', { amount: money(L.viewer.myMax, true) }));
    if (!mine && c < L.minNext) return bidErr(t('e_bid_low', { amount: money(L.minNext, true) }));
    bidErr('');
    S.requireAuth('authBid').then(function (u) {
      if (!u) return;
      var m = S.modal({
        title: t(mine ? 'confirmRaiseT' : 'confirmBidT'),
        html: '<div class="v-lines">' + S.lineHtml(t('yourMaxBid'), money(c, true)) + S.lineHtml(t(L.bids ? 'currentBid' : 'startingBid'), money(L.price, true)) + '</div>' +
          '<p class="v-note" style="margin-top:0.9rem;">' + esc(t('confirmBidNote')) + '</p>' +
          '<p class="v-note" style="margin-top:0.5rem;">' + esc(t('bindingBid', { total: money(c + L.fees.auth + L.fees.shipping, true) })) + '</p>' +
          '<div class="v-msg" role="alert"></div>',
        foot: '<button type="button" class="v-btn ghost" data-no>' + esc(t('cancel')) + '</button><button type="button" class="v-btn" data-yes>' + esc(t('confirmBid')) + '</button>'
      });
      m.$('[data-no]').addEventListener('click', function () { m.close(); });
      var yes = m.$('[data-yes]');
      yes.addEventListener('click', function () {
        S.busy(yes, true);
        S.market('bid', { body: { id: L.id, max: c / 100 } }).then(function (res) {
          if (!res.ok) {
            S.busy(yes, false);
            var msg = m.$('.v-msg'); msg.textContent = S.errText(res); msg.className = 'v-msg bad';
            if (res.data.code === 'bid_low' || res.data.code === 'closed') load(false);
            return;
          }
          m.close(true);
          $('vBidMax').value = '';
          if (res.data.leading) S.toast(t(mine ? 'maxRaised' : 'bidLeading'), 'ok');
          else S.toast(t('bidOutbid'), 'bad');
          if (res.data.extended) setTimeout(function () { S.toast(t('bidExtended'), 'info'); }, 600);
          load(false);
        });
      });
    });
  }
  function onBuy() {
    var o = {
      title: L.title + ' · EU ' + L.size, tier: L.tier, itemPrice: L.buyNow, authFee: L.fees.auth, shipFee: L.fees.shipping,
      total: L.buyNow + L.fees.auth + L.fees.shipping,
      create: function () { return S.market('buy', { body: { id: L.id } }); }
    };
    S.payFlow(o).then(afterPay);
  }
  function afterPay(r) {
    if (!r || r.redirect) return;
    if (r.manual) { w.location.href = '/vault-me.html?reserved=' + r.orderId + '#order-' + r.orderId; return; }
    if (r.unpaid) { S.toast(t('boughtUnpaid'), 'info'); load(false); }
  }
  function onPayExisting() {
    var v = L.viewer || {};
    if (!v.order) return;
    S.payFlow({
      orderId: v.order.id, title: L.title + ' · EU ' + L.size, tier: L.tier, itemPrice: L.price,
      authFee: L.fees.auth, shipFee: L.fees.shipping, total: L.price + L.fees.auth + L.fees.shipping
    }).then(afterPay);
  }
  function onOffer() {
    S.requireAuth('authOffer').then(function (u) {
      if (!u) return;
      var m = S.modal({
        title: t('offerT'),
        html: '<p>' + esc(t('offerLead', { price: money(L.buyNow) })) + '</p>' +
          '<div class="v-field"><label class="v-label" for="voAmt">' + esc(t('yourOffer')) + '</label><div class="v-money"><input class="v-input" id="voAmt" inputmode="decimal" autocomplete="off"/></div></div>' +
          '<div class="v-field"><label class="v-label" for="voMsg"><span>' + esc(t('offerMsg')) + '</span><small>' + esc(t('optional')) + '</small></label>' +
          '<textarea class="v-textarea" id="voMsg" maxlength="300" rows="3" placeholder="' + esc(t('offerMsgPh')) + '"></textarea></div>' +
          '<p class="v-note">' + esc(t('offerNote')) + '</p><div class="v-msg" role="alert"></div>',
        foot: '<button type="button" class="v-btn block" data-go>' + esc(t('sendOffer')) + '</button>'
      });
      var go = m.$('[data-go]'), msg = m.$('.v-msg');
      var bad = function (s) { S.busy(go, false); msg.textContent = s; msg.className = 'v-msg bad'; };
      go.addEventListener('click', function () {
        var c = S.centsOf(m.$('#voAmt').value);
        var minP = (S.config() && S.config().minPrice) || 1000;
        if (isNaN(c)) return bad(t('e_priceInput'));
        if (c < minP) return bad(t('e_offer_min', { amount: money(minP, true) }));
        if (c >= L.buyNow) return bad(t('e_offer_high'));
        S.busy(go, true);
        S.market('offer', { body: { id: L.id, amount: c / 100, message: m.$('#voMsg').value.trim() } }).then(function (res) {
          if (!res.ok) return bad(S.errText(res));
          if (res.data.autoDeclined) return bad(t('offerAutoDeclined'));
          m.close(true);
          S.toast(t('offerSent'), 'ok');
          load(false);
        });
      });
    });
  }
  function respond(action) {
    var off = L.viewer && L.viewer.offer;
    if (!off) return;
    if (action === 'accept') {
      S.confirm(t('acceptCounterT'), t('acceptCounterQ', { amount: money(off.counter, true) }), t('acceptAmount', { amount: money(off.counter) })).then(function (yes) {
        if (!yes) return;
        S.market('offer/respond', { body: { offerId: off.id, action: 'accept' } }).then(function (res) {
          if (!res.ok) { S.toast(S.errText(res), 'bad'); load(false); return; }
          S.payFlow({
            orderId: res.data.orderId, title: L.title + ' · EU ' + L.size, tier: L.tier, itemPrice: off.counter,
            authFee: L.fees.auth, shipFee: L.fees.shipping, total: off.counter + L.fees.auth + L.fees.shipping
          }).then(function (r) { if (r) afterPay(r); else load(false); });
        });
      });
      return;
    }
    var go = function () {
      S.market('offer/respond', { body: { offerId: off.id, action: action } }).then(function (res) {
        if (!res.ok) S.toast(S.errText(res), 'bad');
        else S.toast(t(action === 'withdraw' ? 'offerWithdrawn' : 'counterDeclined'), 'ok');
        load(false);
      });
    };
    if (action === 'withdraw') S.confirm(t('withdrawOfferT'), t('withdrawOfferQ'), t('withdrawOffer'), true).then(function (y) { if (y) go(); });
    else go();
  }
  function onWithdraw() {
    S.confirm(t('withdrawT'), t('withdrawQ'), t('withdraw'), true).then(function (yes) {
      if (!yes) return;
      S.market('listing/cancel', { body: { id: L.id } }).then(function (res) {
        if (!res.ok) { S.toast(S.errText(res), 'bad'); return; }
        S.toast(t('withdrawn'), 'ok');
        load(false);
      });
    });
  }
  function onRelist() {
    S.relistFlow(L).then(function (newId) {
      if (newId) w.location.href = '/vault-item.html?id=' + newId + '&relisted=1';
    });
  }

  /* ── small screens: a buy bar that follows once the price scrolls away ─ */
  var stickyObs = null;
  function sticky() {
    var bar = $('vSticky'), box = d.querySelector('.v-pricebox');
    if (!bar || !box) return;
    var live = L.status === 'live' && !isOwner();
    if (!live) { bar.innerHTML = ''; bar.classList.remove('on'); d.body.classList.remove('v-sticky-on'); return; }
    var auction = L.format === 'auction';
    bar.innerHTML = '<div class="p"><small>' + esc(t(auction ? (L.bids ? 'currentBid' : 'startingBid') : 'price')) + '</small><b>' + money(L.price) + '</b>' +
      (auction && L.endsAt ? ' <span class="v-note" data-ends="' + esc(L.endsAt) + '"><span class="cd-t"></span></span>' : '') + '</div>' +
      '<button type="button" class="v-btn ' + (auction ? '' : 'gold') + '" data-sticky>' + esc(t(auction ? 'placeBid' : 'buyNow')) + '</button>';
    bar.querySelector('[data-sticky]').onclick = function () {
      if (auction) { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(function () { var i = $('vBidMax'); if (i) i.focus(); }, 450); }
      else if (pv) S.toast(t('previewOnly'), 'info');
      else onBuy();
    };
    if (stickyObs) stickyObs.disconnect();
    if ('IntersectionObserver' in w) {
      stickyObs = new IntersectionObserver(function (es) {
        var hidden = !es[0].isIntersecting && es[0].boundingClientRect.top < 0;
        bar.classList.toggle('on', hidden);
        d.body.classList.toggle('v-sticky-on', hidden);   // the help button moves up out of its way
        bar.setAttribute('aria-hidden', hidden ? 'false' : 'true');
      });
      stickyObs.observe(box);
    }
  }

  /* ── more like this ───────────────────────────────────────────────── */
  function moreLike() {
    if (pv) {
      var others = S.previewItems().filter(function (x) { return x.id !== L.id; }).slice(0, 4);
      $('vMoreGrid').innerHTML = others.map(function (x) { return S.card(x); }).join('');
      $('vMoreLike').hidden = false;
      S.tick();
      return;
    }
    S.market('listings?per=8&brand=' + encodeURIComponent(L.brand)).then(function (res) {
      var list = (res.ok ? res.data.items : []).filter(function (x) { return x.id !== L.id; });
      var finish = function (items) {
        if (!items.length) return;
        $('vMoreGrid').innerHTML = items.slice(0, 4).map(function (x) { return S.card(x); }).join('');
        $('vMoreLike').hidden = false;
        S.tick();
      };
      if (list.length >= 2) return finish(list);
      S.market('listings?per=8&sort=popular').then(function (r2) {
        var more = (r2.ok ? r2.data.items : []).filter(function (x) { return x.id !== L.id && !list.some(function (y) { return y.id === x.id; }); });
        finish(list.concat(more));
      });
    });
  }

  /* ── search engines: canonical URL and product data ───────────────── */
  function seo() {
    if (pv) {
      var robots = d.querySelector('meta[name=robots]');
      if (robots) robots.setAttribute('content', 'noindex, follow');
      return;
    }
    var url = w.location.origin + '/vault-item.html?id=' + L.id;
    var can = $('vCanonical');
    if (!can) { can = d.createElement('link'); can.rel = 'canonical'; can.id = 'vCanonical'; d.head.appendChild(can); }
    can.href = url;
    var desc = d.querySelector('meta[name=description]');
    if (desc) desc.setAttribute('content', L.title + ', EU ' + L.size + ' — ' + t(L.tier === 'lab' ? 'tierLab' : 'tierPhoto') + ', ' + money(L.price) + '. ShoeLab Vault.');
    if (['live', 'sold', 'ended'].indexOf(L.status) === -1) return;
    var data = {
      '@context': 'https://schema.org', '@type': 'Product', name: L.title, sku: 'VAULT-' + L.id,
      brand: { '@type': 'Brand', name: L.brand },
      image: (L.photos || []).map(function (p) { return w.location.origin + p.url; }),
      description: L.description || (L.title + ', EU ' + L.size),
      offers: {
        '@type': 'Offer', url: url, priceCurrency: 'EUR', price: (L.price / 100).toFixed(2),
        availability: L.status === 'live' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
        itemCondition: L.cond === 'new' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
        seller: { '@type': 'Organization', name: 'ShoeLab Vault' }
      }
    };
    var tag = $('vLd');
    if (!tag) { tag = d.createElement('script'); tag.type = 'application/ld+json'; tag.id = 'vLd'; d.head.appendChild(tag); }
    tag.textContent = JSON.stringify(data);
  }

  /* ── page-level events ────────────────────────────────────────────── */
  d.addEventListener('slv:watch', function (e) {
    if (!L || e.detail.id !== L.id) return;
    if (L.viewer) L.viewer.watching = e.detail.watching;
    L.watchers = e.detail.watchers;
    Array.prototype.forEach.call(d.querySelectorAll('.v-watch span'), function (s) { s.textContent = t(e.detail.watching ? 'watching' : 'watch'); });
    var chip = $('vWatchers');
    if (chip) {
      chip.hidden = !L.watchers;
      chip.innerHTML = S.ico('heart') + ' ' + esc(S.tn('watchers', L.watchers));
    }
  });
  d.addEventListener('slv:ended', function () { if (!pv) setTimeout(function () { load(false); }, 1500); });
  d.addEventListener('visibilitychange', function () { if (!d.hidden && L && !pv && L.status === 'live') load(false); });
  d.addEventListener('keydown', function (e) {
    var lb = $('vLightbox');
    if (lb.classList.contains('open')) {
      if (e.key === 'Escape') lb.classList.remove('open');
      return;
    }
    if (!L || /input|textarea|select/i.test((d.activeElement || {}).tagName || '')) return;
    if (e.key === 'ArrowRight') show(photo + 1);
    if (e.key === 'ArrowLeft') show(photo - 1);
  });
  $('vLightbox').addEventListener('click', function () { this.classList.remove('open'); });

  S.boot({
    key: 'browse',
    title: 'pageItem',
    init: function () {
      if (S.qs('relisted')) S.toast(t('relistedToast'), 'ok');
      load(true);
    },
    onLang: function () { if (L) render(); },
    onAuth: function () { load(false); }
  });
})(window, document);
