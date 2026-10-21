/* ShoeLab Vault — listing a pair (vault-sell.html).
 * One page, five sections, a live checklist and payout preview. Photos are
 * resized and compressed on the device before upload, so a phone picture of
 * several megabytes travels as a sharp JPEG of a few hundred kilobytes. */
(function (w, d) {
  'use strict';
  var S = w.SLV, t = S.t, esc = S.esc, money = S.money;
  var $ = function (id) { return d.getElementById(id); };

  var BRANDS = ['Nike', 'Jordan', 'adidas', 'New Balance', 'Yeezy', 'ASICS', 'Puma', 'Converse', 'Vans', 'Reebok', 'Salomon', 'On',
    'Hoka', 'Saucony', 'Onitsuka Tiger', 'Timberland', 'Dr. Martens', 'UGG', 'Birkenstock', 'Veja', 'Balenciaga', 'Off-White',
    'Golden Goose', 'Common Projects', 'Maison Margiela', 'Rick Owens', 'Prada', 'Gucci', 'Dior', 'Louis Vuitton', 'Alexander McQueen',
    'BAPE', 'Fear of God', 'Merrell', 'Mizuno', 'Diadora', 'Karhu', 'Autry', 'Axel Arigato', 'Clarks'];
  var CONDS = ['new', 'like_new', 'good', 'fair'];
  var SLOTS = ['side_out', 'side_in', 'sole', 'size_tag', 'box_label', 'insole', 'heel', 'toe'];
  var REQ = { photo: ['side_out', 'side_in', 'sole', 'size_tag', 'box_label', 'insole'], lab: ['side_out', 'sole', 'size_tag'] };
  var MAX_SIDE = 1600, MAX_BYTES = 600 * 1024;

  var st = { cond: '', tier: 'photo', format: 'auction', photos: {}, busy: {} };
  var cfg = null, pickFor = null, sent = false;

  /* ── building the form ────────────────────────────────────────────── */
  function sizes() {
    var out = [];
    for (var n = 35; n <= 50; n++) out.push(String(n), n + ' 1/3', n + '.5', n + ' 2/3');
    return out;
  }
  function buildStatic() {
    $('sBrands').innerHTML = BRANDS.map(function (b) { return '<option value="' + esc(b) + '"></option>'; }).join('');
    var sel = $('sSize'), keep = sel.value;
    sel.innerHTML = '<option value="">' + esc(t('chooseSize')) + '</option>' + sizes().map(function (s) {
      return '<option value="' + s + '"' + (s === keep ? ' selected' : '') + '>EU ' + s + '</option>';
    }).join('');
    var durs = (cfg && cfg.durations) || [1, 3, 5, 7], dsel = $('sDur'), dk = dsel.value || '7';
    dsel.innerHTML = durs.map(function (x) { return '<option value="' + x + '"' + (String(x) === dk ? ' selected' : '') + '>' + esc(S.tn('days', x)) + '</option>'; }).join('');
    $('sCond').innerHTML = CONDS.map(function (c) {
      return '<label class="v-choice' + (st.cond === c ? ' sel' : '') + '"><input type="radio" name="sCond" value="' + c + '"' + (st.cond === c ? ' checked' : '') + '/>' +
        '<span class="tick">✓</span><b>' + esc(t('cond_' + c)) + '</b><small>' + esc(t('condD_' + c)) + '</small></label>';
    }).join('');
    var fee = function (k) { return money(cfg ? cfg.fees[k] : (k === 'lab' ? 1290 : 490), true); };
    $('sTier').innerHTML = ['photo', 'lab'].map(function (k) {
      return '<label class="v-choice' + (st.tier === k ? ' sel' : '') + '" style="padding:1.1rem;"><input type="radio" name="sTier" value="' + k + '"' + (st.tier === k ? ' checked' : '') + '/>' +
        '<span class="tick">✓</span><span style="margin-bottom:0.35rem;">' + S.tierBadge(k) + '</span>' +
        '<b>' + esc(t(k === 'lab' ? 'tierLabH' : 'tierPhotoH')) + '</b>' +
        '<small>' + esc(t(k === 'lab' ? 'sellTierLab' : 'sellTierPhoto')) + '</small>' +
        '<small style="color:var(--gold-hi);margin-top:0.3rem;">' + esc(t('sellTierFee', { fee: fee(k) })) + '</small></label>';
    }).join('');
  }

  function renderPhotos() {
    var req = REQ[st.tier];
    $('sPhotosP').textContent = t('photosNeed', { n: req.length, tier: t(st.tier === 'lab' ? 'tierLab' : 'tierPhoto') });
    // required shots first, then the optional ones
    var order = req.concat(SLOTS.filter(function (k) { return req.indexOf(k) === -1; }));
    $('sPhotos').innerHTML = order.map(function (k) {
      var p = st.photos[k], must = req.indexOf(k) !== -1, label = t('kind_' + k);
      if (p) {
        return '<div class="v-slot filled' + (st.busy[k] ? ' busy' : '') + '" data-kind="' + k + '" tabindex="0" role="button" aria-label="' + esc(t('replacePhoto', { kind: label })) + '">' +
          '<img src="' + p.data + '" alt=""/><span class="ok">✓</span>' +
          '<button type="button" class="x" data-remove="' + k + '" aria-label="' + esc(t('removePhoto', { kind: label })) + '">✕</button>' +
          '<span class="cap">' + esc(label) + '</span></div>';
      }
      return '<div class="v-slot' + (must ? ' req' : '') + (st.busy[k] ? ' busy' : '') + '" data-kind="' + k + '" tabindex="0" role="button" aria-label="' + esc(t('addPhoto', { kind: label })) + '">' +
        (must ? '<span class="req-tag">' + esc(t('required')) + '</span>' : '') +
        S.ico('camera') + '<b>' + esc(label) + '</b><small>' + esc(t('kindTip_' + k)) + '</small></div>';
    }).join('');
  }

  function setFormat(f) {
    st.format = f;
    Array.prototype.forEach.call(d.querySelectorAll('#sFormat [data-f]'), function (b) {
      var on = b.getAttribute('data-f') === f;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    Array.prototype.forEach.call(d.querySelectorAll('#secPrice [data-for]'), function (x) { x.hidden = x.getAttribute('data-for') !== f; });
    refresh();
  }

  /* ── photos: pick, compress, store ────────────────────────────────── */
  // a small copy for listing grids: quick on a phone, sharp enough to tell pairs apart
  function thumbnail(img, wd, ht) {
    var k = Math.min(1, 480 / Math.max(wd, ht)), cw = Math.round(wd * k), ch = Math.round(ht * k);
    var c = d.createElement('canvas'); c.width = cw; c.height = ch;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);
    var out = c.toDataURL('image/jpeg', 0.74);
    return out.length * 0.75 <= 110 * 1024 ? out : c.toDataURL('image/jpeg', 0.55);
  }
  function compress(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var wd = img.naturalWidth, ht = img.naturalHeight;
        if (!wd || !ht) { reject(new Error('empty')); return; }
        var thumb = thumbnail(img, wd, ht);
        var side = MAX_SIDE, data = null;
        for (var round = 0; round < 4; round++) {
          var k = Math.min(1, side / Math.max(wd, ht)), cw = Math.round(wd * k), ch = Math.round(ht * k);
          var c = d.createElement('canvas'); c.width = cw; c.height = ch;
          var ctx = c.getContext('2d');
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, ch);   // transparent PNGs get a white floor
          ctx.drawImage(img, 0, 0, cw, ch);
          for (var q = 0.86; q >= 0.5; q -= 0.08) {
            data = c.toDataURL('image/jpeg', q);
            if (data.length * 0.75 <= MAX_BYTES) { resolve({ data: data, thumb: thumb }); return; }
          }
          side = Math.round(side * 0.75);
        }
        if (data && data.length * 0.75 <= 740 * 1024) resolve({ data: data, thumb: thumb }); else reject(new Error('large'));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('format')); };
      img.src = url;
    });
  }
  function photoErr(text) {
    var e = $('sPhotoErr');
    e.textContent = text || '';
    e.classList.toggle('on', !!text);
  }
  function addFiles(files, first) {
    var req = REQ[st.tier];
    var order = req.concat(SLOTS.filter(function (k) { return req.indexOf(k) === -1; }));
    var targets = [first];
    // extra files fill the next empty slots, required ones first
    order.forEach(function (k) { if (k !== first && !st.photos[k] && targets.length < files.length) targets.push(k); });
    photoErr('');
    Array.prototype.slice.call(files, 0, targets.length).forEach(function (f, i) {
      var k = targets[i];
      if (!/^image\//.test(f.type || 'image/')) { photoErr(t('e_photo_bad')); return; }
      st.busy[k] = true; renderPhotos();
      compress(f).then(function (out) {
        st.photos[k] = out;
        delete st.busy[k];
        renderPhotos(); refresh();
      }, function (err) {
        delete st.busy[k];
        renderPhotos();
        photoErr(t(err && err.message === 'large' ? 'e_photo_big' : 'e_photo_bad'));
      });
    });
  }

  /* ── reading and checking the form ────────────────────────────────── */
  function val(id) { return $(id).value.trim(); }
  function terms() {
    var o = { format: st.format };
    if (st.format === 'auction') {
      o.start = S.centsOf(val('sStart'));
      o.duration = parseInt($('sDur').value, 10);
      o.bin = val('sBinA') ? S.centsOf(val('sBinA')) : null;
      o.price = o.start;
    } else {
      o.bin = S.centsOf(val('sPrice'));
      o.offers = $('sOffers').checked;
      o.min = o.offers && val('sMin') ? S.centsOf(val('sMin')) : null;
      o.price = o.bin;
    }
    return o;
  }
  function fieldErr(input, text) {
    var box = input.closest('.v-field');
    var e = box && box.querySelector('.v-err');
    input.classList.toggle('err', !!text);
    if (e) { e.textContent = text || ''; e.classList.toggle('on', !!text); }
    return !text;
  }
  function priceProblems(o) {
    var lo = (cfg && cfg.minPrice) || 1000, hi = (cfg && cfg.maxPrice) || 2000000;
    var range = { min: money(lo), max: money(hi) }, out = {};
    var inR = function (c) { return !isNaN(c) && c >= lo && c <= hi; };
    if (o.format === 'auction') {
      if (!inR(o.start)) out.sStart = t('e_start_range', range);
      if (o.bin != null && (isNaN(o.bin) || !inR(o.bin) || o.bin <= o.start)) out.sBinA = t('e_bin_low');
    } else {
      if (!inR(o.bin)) out.sPrice = t('e_price_range', range);
      if (o.min != null && (isNaN(o.min) || o.min <= 0 || o.min >= o.bin)) out.sMin = t('e_min_offer');
    }
    return out;
  }
  function confirmed() { return $('sOwn').checked && $('sBind').checked && $('sTerms').checked; }

  /* ── getting paid: seller verification with Stripe ────────────────── */
  // With Stripe payouts on, a seller verifies once before listing. Stripe
  // opens in a new tab, so nothing typed or uploaded here is lost; this page
  // checks back by itself and lets them carry on.
  var gatePoll = null;
  function gate() {
    var c = S.config(), me = S.me(), box = $('sGate');
    var need = c && c.connect && me && !(me.seller && me.seller.ready);
    if (!need) { box.innerHTML = ''; clearInterval(gatePoll); gatePoll = null; return; }
    box.innerHTML = '<div class="v-payouts todo v-seller-gate"><div class="ico">' + S.ico('shield') + '</div>' +
      '<div><b>' + esc(t('sellerGateT')) + '</b><small>' + esc(t('sellerGateP')) + '</small></div>' +
      '<div class="act"><button type="button" class="v-btn gold sm" id="sGateGo">' + esc(t('verifyWithStripe')) + '</button>' +
      '<div style="text-align:center;margin-top:0.45rem;"><button type="button" class="v-link-btn" id="sGateCheck">' + esc(t('sellerGateCheck')) + '</button></div></div></div>';
    $('sGateGo').onclick = function () { S.payoutsSetup(this).then(function (okk) { if (okk) watchGate(); }); };
    $('sGateCheck').onclick = function () { checkGate(true); };
  }
  function checkGate(loud) {
    return S.market('payouts/status').then(function (res) {
      if (!res.ok) return;
      var me = S.me();
      if (me) me.seller = { connected: res.data.connected, ready: res.data.ready, payouts: res.data.payouts, due: res.data.due };
      if (res.data.ready) { gate(); S.toast(t('sellerReadyToast'), 'ok'); }
      else if (loud) S.toast(t('sellerNotYet'), 'info');
    });
  }
  function watchGate() {
    clearInterval(gatePoll);
    var until = Date.now() + 15 * 60000;
    gatePoll = setInterval(function () {
      if (Date.now() > until || !$('sGateGo')) { clearInterval(gatePoll); gatePoll = null; return; }
      if (!d.hidden) checkGate(false);
    }, 6000);
  }

  function sections() {
    var o = terms(), pp = priceProblems(o);
    return {
      pair: !!(val('sBrand') && val('sModel') && $('sSize').value && st.cond),
      tier: !!st.tier,
      photos: REQ[st.tier].every(function (k) { return st.photos[k]; }),
      price: !Object.keys(pp).length,
      confirm: confirmed()
    };
  }

  /* ── live checklist + payout preview ──────────────────────────────── */
  function refresh() {
    var s = sections();
    [['secPair', 'pair'], ['secTier', 'tier'], ['secPhotos', 'photos'], ['secPrice', 'price'], ['secConfirm', 'confirm']].forEach(function (p) {
      $(p[0]).classList.toggle('done', !!s[p[1]]);
    });
    var have = REQ[st.tier].filter(function (k) { return st.photos[k]; }).length;
    var items = [
      ['secPair', s.pair, t('chkPair')], ['secTier', s.tier, t('chkTier')],
      ['secPhotos', s.photos, t('chkPhotos', { have: have, need: REQ[st.tier].length })],
      ['secPrice', s.price, t('chkPrice')], ['secConfirm', s.confirm, t('chkConfirm')]
    ];
    $('sCheck').innerHTML = items.map(function (x) {
      return '<li class="' + (x[1] ? 'ok' : '') + '"><i>' + (x[1] ? '✓' : '') + '</i><a href="#' + x[0] + '">' + esc(x[2]) + '</a></li>';
    }).join('');

    var o = terms(), rate = cfg ? cfg.commission : 0.08, ship = cfg ? cfg.shipping : 699;
    var price = o.format === 'auction' ? o.start : o.bin;
    if (isNaN(price) || !price) {
      $('sPayout').innerHTML = '<p class="v-note">' + esc(t('payoutEmpty')) + '</p>';
      return;
    }
    var comm = Math.round(price * rate), back = st.tier === 'photo' ? ship : 0;
    $('sPayout').innerHTML =
      '<p class="v-note" style="margin-bottom:0.4rem;">' + esc(t(o.format === 'auction' ? 'payoutIfStart' : 'payoutIfSold', { price: money(price) })) + '</p>' +
      '<div class="v-lines">' +
        S.lineHtml(t('salePrice'), money(price, true)) +
        S.lineHtml(t('commissionPct', { pct: S.num(Math.round(rate * 1000) / 10) }), '−' + money(comm, true), 'neg') +
        (back ? S.lineHtml(t('postageBack'), '+' + money(back, true), 'pos') : '') +
        S.lineHtml(t('youReceive'), money(price - comm + back, true), 'total') +
      '</div>' +
      '<p class="v-note" style="margin-top:0.6rem;">' + esc(t(st.tier === 'lab' ? 'payoutNoteLab' : 'payoutNotePhoto')) + '</p>';
  }

  /* ── submit ───────────────────────────────────────────────────────── */
  function validate() {
    var ok = true, first = null;
    var mark = function (input, text) { if (!fieldErr(input, text)) { ok = false; first = first || input; } };
    mark($('sBrand'), val('sBrand') ? '' : t('e_brand'));
    mark($('sModel'), val('sModel') ? '' : t('e_model'));
    mark($('sSize'), $('sSize').value ? '' : t('e_size'));
    var ce = $('sCond').parentNode.querySelector('.v-err');
    ce.textContent = st.cond ? '' : t('e_cond'); ce.classList.toggle('on', !st.cond);
    if (!st.cond) { ok = false; first = first || $('sCond'); }
    var missing = REQ[st.tier].filter(function (k) { return !st.photos[k]; });
    if (missing.length) {
      photoErr(t('e_photos_missing', { list: missing.map(function (k) { return t('kind_' + k); }).join(', ') }));
      ok = false; first = first || $('sPhotos');
    }
    var o = terms(), pp = priceProblems(o);
    ['sStart', 'sBinA', 'sPrice', 'sMin'].forEach(function (id) { mark($(id), pp[id] || ''); });
    var conf = confirmed(), cerr = $('sConfirmErr');
    cerr.textContent = conf ? '' : t('e_confirm'); cerr.classList.toggle('on', !conf);
    if (!conf) { ok = false; first = first || $('sOwn'); }
    if (first) {
      var sec = first.closest('.v-sec');
      (sec || first).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return ok;
  }
  function submit() {
    var msg = $('sMsg');
    msg.textContent = ''; msg.className = 'v-msg';
    if (Object.keys(st.busy).length) { msg.textContent = t('photosBusy'); msg.className = 'v-msg bad'; return; }
    if (!validate()) { msg.textContent = t('e_fix'); msg.className = 'v-msg bad'; return; }
    S.requireVerified('authSell').then(function (u) {
      if (!u) return;
      var o = terms(), btn = $('sSubmit');
      var body = {
        brand: val('sBrand'), model: val('sModel'), size: $('sSize').value, cond: st.cond, description: val('sDesc'),
        tier: st.tier, format: o.format,
        photos: Object.keys(st.photos).map(function (k) { return { kind: k, data: st.photos[k].data, thumb: st.photos[k].thumb }; })
      };
      if (o.format === 'auction') { body.startPrice = o.start / 100; body.duration = o.duration; if (o.bin != null) body.buyNow = o.bin / 100; }
      else { body.buyNow = o.bin / 100; body.acceptOffers = o.offers; if (o.min != null) body.minOffer = o.min / 100; }
      S.busy(btn, true);
      msg.textContent = t('uploading'); msg.className = 'v-msg';
      S.market('listings', { body: body }).then(function (res) {
        S.busy(btn, false);
        if (!res.ok) { msg.textContent = S.errText(res); msg.className = 'v-msg bad'; return; }
        sent = true;
        done(res.data.id);
      });
    });
  }
  function done(id) {
    var lab = st.tier === 'lab';
    $('sWrap').innerHTML =
      '<div class="v-done">' +
        '<div class="ico">' + S.ico('shield') + '</div>' +
        '<h2 class="v-h2">' + esc(t('sentT')) + '</h2>' +
        '<p class="v-lead" style="margin:0.8rem auto 0;">' + esc(t(lab ? 'sentLab' : 'sentPhoto')) + '</p>' +
        '<ol class="v-flow" style="text-align:left;max-width:460px;margin:1.6rem auto 0;">' +
          ['sentS1', lab ? 'sentS2Lab' : 'sentS2Photo', 'sentS3'].map(function (k, i) { return '<li><i>' + (i + 1) + '</i><span>' + esc(t(k)) + '</span></li>'; }).join('') +
        '</ol>' +
        '<div class="v-btn-row" style="justify-content:center;margin-top:1.8rem;">' +
          '<a class="v-btn" href="/vault-item.html?id=' + id + '">' + esc(t('viewListing')) + '</a>' +
          '<a class="v-btn ghost" href="/vault-me.html#selling">' + esc(t('navMine')) + '</a>' +
          '<a class="v-btn ghost" href="/vault-sell.html">' + esc(t('listAnother')) + '</a>' +
        '</div>' +
      '</div>';
    w.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── wiring ───────────────────────────────────────────────────────── */
  function wire() {
    ['sBrand', 'sModel', 'sStart', 'sBinA', 'sPrice', 'sMin'].forEach(function (id) {
      $(id).addEventListener('input', function () { fieldErr(this, ''); refresh(); });
    });
    ['sSize', 'sDur'].forEach(function (id) { $(id).addEventListener('change', function () { fieldErr(this, ''); refresh(); }); });
    ['sOwn', 'sBind', 'sTerms'].forEach(function (id) {
      $(id).addEventListener('change', function () {
        if (confirmed()) $('sConfirmErr').classList.remove('on');
        refresh();
      });
    });
    // a fresh change clears the "still needs attention" note under the button
    $('sWrap').addEventListener('input', function () { var m = $('sMsg'); if (m.classList.contains('bad')) { m.textContent = ''; m.className = 'v-msg'; } });
    $('sWrap').addEventListener('change', function () { var m = $('sMsg'); if (m.classList.contains('bad')) { m.textContent = ''; m.className = 'v-msg'; } });
    $('sDesc').addEventListener('input', function () { $('sDescN').textContent = this.value.length + ' / 2000'; });
    $('sOffers').addEventListener('change', function () { $('sMinWrap').hidden = !this.checked; refresh(); });
    $('sCond').addEventListener('change', function (e) {
      st.cond = e.target.value;
      Array.prototype.forEach.call(d.querySelectorAll('#sCond .v-choice'), function (c) { c.classList.toggle('sel', c.querySelector('input').checked); });
      var ce = $('sCond').parentNode.querySelector('.v-err'); ce.classList.remove('on');
      refresh();
    });
    $('sTier').addEventListener('change', function (e) {
      st.tier = e.target.value;
      Array.prototype.forEach.call(d.querySelectorAll('#sTier .v-choice'), function (c) { c.classList.toggle('sel', c.querySelector('input').checked); });
      renderPhotos(); refresh();
    });
    Array.prototype.forEach.call(d.querySelectorAll('#sFormat [data-f]'), function (b) {
      b.addEventListener('click', function () { setFormat(b.getAttribute('data-f')); });
    });
    var grid = $('sPhotos'), file = $('sFile');
    grid.addEventListener('click', function (e) {
      var rm = e.target.closest('[data-remove]');
      if (rm) { e.stopPropagation(); delete st.photos[rm.getAttribute('data-remove')]; renderPhotos(); refresh(); return; }
      var slot = e.target.closest('[data-kind]');
      if (!slot || st.busy[slot.getAttribute('data-kind')]) return;
      pickFor = slot.getAttribute('data-kind');
      file.value = '';
      file.click();
    });
    grid.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-kind]')) { e.preventDefault(); e.target.click(); }
    });
    file.addEventListener('change', function () { if (this.files && this.files.length && pickFor) addFiles(this.files, pickFor); });
    grid.addEventListener('dragover', function (e) {
      var slot = e.target.closest('[data-kind]');
      if (!slot) return;
      e.preventDefault();
      Array.prototype.forEach.call(grid.querySelectorAll('.drag'), function (x) { x.classList.remove('drag'); });
      slot.classList.add('drag');
    });
    grid.addEventListener('dragleave', function (e) { var s = e.target.closest('[data-kind]'); if (s) s.classList.remove('drag'); });
    grid.addEventListener('drop', function (e) {
      var slot = e.target.closest('[data-kind]');
      if (!slot) return;
      e.preventDefault();
      slot.classList.remove('drag');
      if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files, slot.getAttribute('data-kind'));
    });
    $('sSubmit').addEventListener('click', submit);
    // photos live only in this tab: warn before they are thrown away
    w.addEventListener('beforeunload', function (e) {
      if (!sent && Object.keys(st.photos).length) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  S.boot({
    key: 'sell',
    title: 'pageSell',
    init: function (me, c) {
      cfg = c;
      if (c && c.required) { REQ = c.required; }
      gate();
      w.addEventListener('focus', function () { if ($('sGateGo')) checkGate(false); });
      buildStatic();
      renderPhotos();
      wire();
      setFormat('auction');
    },
    onLang: function () {
      if (sent) return;
      gate();
      buildStatic();
      renderPhotos();
      refresh();
    },
    onAuth: function () { if (!sent) gate(); }
  });
})(window, document);
