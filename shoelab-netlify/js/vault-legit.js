/* ShoeLab Vault — the Legit Check page (legit.html).
 *
 * Someone about to buy a pair on another app, or its owner, sends the photos;
 * ShoeLab answers (and certifies). The page:
 *   - takes a link from any app: typed, pasted (the Paste button), or shared
 *     from the app itself (Android: Share → ShoeLab, via the web manifest's
 *     share_target, which opens this page with ?url= / ?text=);
 *   - recognises the app and shows it;
 *   - collects the photos like the sell page (compressed on the phone);
 *   - signs in if needed, then pays (Stripe), or asks the studio for payment
 *     details when card payments are off. */
(function (w, d) {
  'use strict';
  var S = w.SLV, t = S.t, esc = S.esc, C = w.SLVCert;
  var $ = function (id) { return d.getElementById(id); };
  var SLOTS = ['side_out', 'side_in', 'sole', 'size_tag', 'box_label', 'insole', 'heel', 'other'];
  var REQ = { sell: ['side_out', 'side_in', 'sole', 'size_tag', 'box_label', 'insole'], buy: [] };
  var MIN_BUY = 3;
  var APPS = ['Vinted', 'Kleinanzeigen', 'eBay', 'Depop', 'Grailed', 'StockX', 'Facebook', 'Instagram'];
  var st = { mode: '', photos: {}, busy: {} };
  var cfg = null, pickFor = null, sent = false;

  function price() { return (cfg && cfg.legit != null) ? cfg.legit : 990; }

  /* ── building ─────────────────────────────────────────────────────── */
  function sizes() {
    var out = [];
    for (var n = 35; n <= 50; n++) out.push(String(n), n + ' 1/3', n + '.5', n + ' 2/3');
    return out;
  }
  function buildStatic() {
    $('lgApps').innerHTML = '<small>' + esc(t('lgWorksWith')) + '</small>' + APPS.map(function (a) { return '<span>' + esc(a) + '</span>'; }).join('') +
      '<span class="more">' + esc(t('lgAnyApp')) + '</span>';
    $('lgPrice').textContent = S.money(price(), true);
    var sel = $('lgSize'), cur = sel.value;
    sel.innerHTML = '<option value="">' + esc(t('chooseSize')) + '</option>' + sizes().map(function (s) { return '<option>' + s + '</option>'; }).join('');
    if (cur) sel.value = cur;
    $('lgBrands').innerHTML = ['Nike', 'Jordan', 'Adidas', 'New Balance', 'Yeezy', 'Off-White', 'Asics', 'Puma', 'Converse', 'Vans', 'Salomon', 'Prada', 'Timberland']
      .map(function (b) { return '<option value="' + b + '">'; }).join('');
  }
  function setMode(m) {
    st.mode = m;
    Array.prototype.forEach.call(d.querySelectorAll('.v-lg-mode'), function (el) {
      var on = el.getAttribute('data-mode') === m;
      el.classList.toggle('sel', on);
      el.querySelector('input').checked = on;
    });
    Array.prototype.forEach.call(d.querySelectorAll('[data-only]'), function (el) { el.hidden = el.getAttribute('data-only') !== m; });
    var wrap = $('lgWrap'), first = wrap.hidden;
    wrap.hidden = false;
    renderPhotos();
    refresh();
    if (first) setTimeout(function () { wrap.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
  }

  function renderPhotos() {
    var req = REQ[st.mode] || [];
    $('lgPhotosP').textContent = st.mode === 'sell' ? t('lgPhotosSell', { n: req.length }) : t('lgPhotosBuy', { n: MIN_BUY });
    var order = req.concat(SLOTS.filter(function (k) { return req.indexOf(k) === -1; }));
    $('lgPhotos').innerHTML = order.map(function (k) {
      var p = st.photos[k], must = req.indexOf(k) !== -1, label = t('kind_' + k);
      if (p) {
        return '<div class="v-slot filled' + (st.busy[k] ? ' busy' : '') + '" data-kind="' + k + '" tabindex="0" role="button" aria-label="' + esc(t('replacePhoto', { kind: label })) + '">' +
          '<img src="' + p.thumb + '" alt=""/><span class="ok">✓</span>' +
          '<button type="button" class="x" data-remove="' + k + '" aria-label="' + esc(t('removePhoto', { kind: label })) + '">✕</button>' +
          '<span class="cap">' + esc(label) + '</span></div>';
      }
      return '<div class="v-slot' + (must ? ' req' : '') + (st.busy[k] ? ' busy' : '') + '" data-kind="' + k + '" tabindex="0" role="button" aria-label="' + esc(t('addPhoto', { kind: label })) + '">' +
        (must ? '<span class="req-tag">' + esc(t('required')) + '</span>' : '') +
        S.ico('camera') + '<b>' + esc(label) + '</b><small>' + esc(t(k === 'other' && st.mode === 'buy' ? 'lgTipScreens' : 'kindTip_' + k)) + '</small></div>';
    }).join('');
    $('lgTips').innerHTML = st.mode === 'buy'
      ? '<p class="v-note">' + S.ico('info') + esc(t('lgBuyTip')) + '</p>'
      : '<p class="v-note">' + S.ico('info') + esc(t('lgSellTip')) + '</p>';
  }

  function linkInfo() {
    var v = $('lgLink').value.trim();
    if (!v) return { empty: true };
    var url = /^https?:\/\//i.test(v) ? v : (C.firstUrl(v) || (/^[\w-]+\.[\w.-]+\//.test(v) ? 'https://' + v : ''));
    var name = url ? C.platform(url) : null;
    return { url: name ? url : '', name: name };
  }
  function showLink() {
    var li = linkInfo(), box = $('lgFound');
    box.innerHTML = li.empty ? '' : li.name
      ? '<span class="v-chip ok">' + S.ico('check') + esc(t('lgFoundOn', { app: li.name })) + '</span>'
      : '<span class="v-chip warn">' + esc(t('lgLinkOdd')) + '</span>';
  }

  function refresh() {
    var p = price();
    $('lgLines').innerHTML = S.lineHtml(t(st.mode === 'sell' ? 'lgLineSell' : 'lgLineBuy'), S.money(p, true)) +
      S.lineHtml(t('lineTotal'), S.money(p, true), 'total');
    var online = !!(cfg && cfg.onlinePayment);
    $('lgGo').textContent = !p ? t('lgGoFree') : t(online ? 'lgGoPay' : 'lgGoManual', { amount: S.money(p, true) });
  }

  /* ── photos ───────────────────────────────────────────────────────── */
  function photoErr(text) { var e = $('lgPhotoErr'); e.textContent = text || ''; e.classList.toggle('on', !!text); }
  function addFiles(files, first) {
    var req = REQ[st.mode] || [];
    var order = req.concat(SLOTS.filter(function (k) { return req.indexOf(k) === -1; }));
    var targets = [first];
    order.forEach(function (k) { if (k !== first && !st.photos[k] && targets.length < files.length) targets.push(k); });
    photoErr('');
    Array.prototype.slice.call(files, 0, targets.length).forEach(function (f, i) {
      var k = targets[i];
      if (!/^image\//.test(f.type || 'image/')) { photoErr(t('e_photo_bad')); return; }
      st.busy[k] = true; renderPhotos();
      S.compressPhoto(f).then(function (out) {
        st.photos[k] = out; delete st.busy[k]; renderPhotos(); refresh();
      }, function (err) {
        delete st.busy[k]; renderPhotos();
        photoErr(t(err && err.message === 'large' ? 'e_photo_big' : 'e_photo_bad'));
      });
    });
  }

  /* ── checking and sending ─────────────────────────────────────────── */
  function fieldErr(el, text) {
    var box = el.closest('.v-field'), e = box && box.querySelector('.v-err');
    el.classList.toggle('err', !!text);
    if (e) { e.textContent = text || ''; e.classList.toggle('on', !!text); }
  }
  function validate() {
    var bad = null;
    var mark = function (el, key) { fieldErr(el, key ? t(key) : ''); if (key && !bad) bad = el; };
    var li = linkInfo();
    mark($('lgLink'), !li.empty && !li.url ? 'lgLinkBad' : '');
    mark($('lgBrand'), $('lgBrand').value.trim() ? '' : 'e_brand');
    mark($('lgModel'), $('lgModel').value.trim() ? '' : 'e_model');
    mark($('lgSize'), $('lgSize').value ? '' : 'e_size');
    var asked = $('lgAsked').value.trim();
    mark($('lgAsked'), st.mode === 'buy' && asked && !(S.centsOf(asked) > 0) ? 'lgPriceBad' : '');
    var have = Object.keys(st.photos);
    var missing = (REQ[st.mode] || []).filter(function (k) { return have.indexOf(k) === -1; });
    if (st.mode === 'sell' && missing.length) {
      photoErr(t('lgMissing', { list: missing.map(function (k) { return t('kind_' + k); }).join(', ') }));
      if (!bad) bad = $('lgPhotos');
    } else if (st.mode === 'buy' && have.length < MIN_BUY) {
      photoErr(t('lgMinPhotos', { n: MIN_BUY }));
      if (!bad) bad = $('lgPhotos');
    } else photoErr('');
    if (Object.keys(st.busy).length && !bad) bad = $('lgPhotos');
    if (price() && !$('lgConsent').checked) {
      $('lgConsent').closest('.v-check').classList.add('err');
      if (!bad) bad = $('lgConsent');
    }
    return bad;
  }
  function submit() {
    var msg = $('lgMsg'), go = $('lgGo');
    var bad = validate();
    if (bad) {
      msg.textContent = t('lgFix'); msg.className = 'v-msg bad';
      bad.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    msg.textContent = ''; msg.className = 'v-msg';
    S.requireVerified('authLegit').then(function (u) {
      if (!u) return;
      S.busy(go, true);
      msg.textContent = t('uploading'); msg.className = 'v-msg';
      var li = linkInfo();
      var photos = Object.keys(st.photos).map(function (k) { return { kind: k, data: st.photos[k].data, thumb: st.photos[k].thumb }; });
      S.market('legit', { body: {
        mode: st.mode, brand: $('lgBrand').value.trim(), model: $('lgModel').value.trim(), size: $('lgSize').value,
        link: li.url || null, askedPrice: st.mode === 'buy' && $('lgAsked').value.trim() ? S.centsOf($('lgAsked').value.trim()) / 100 : null,
        note: $('lgNote').value.trim(), publish: $('lgPublish').checked, consent: $('lgConsent').checked, photos: photos
      } }).then(function (res) {
        if (!res.ok) { S.busy(go, false); msg.textContent = S.errText(res); msg.className = 'v-msg bad'; return; }
        sent = true;
        var id = res.data.id;
        if (res.data.url) { w.location.href = res.data.url; return; }
        if (res.data.free) { w.location.href = '/vault-me.html?legit=' + id + '#legit-' + id; return; }
        done(id, res.data);
      });
    });
  }
  function done(id, r) {
    $('lgWrap').innerHTML = '<div class="v-empty v-lg-done">' + S.ico('check') +
      '<h3>' + esc(t('lgSentT')) + '</h3><p>' + esc(t(r.payError ? 'lgSentPayErr' : 'lgSentManual', { amount: S.money(price(), true) })) + '</p>' +
      '<div class="v-btn-row"><a class="v-btn" href="/vault-me.html#legit-' + id + '">' + esc(t('lgSeeMine')) + '</a></div></div>';
    $('lgWrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ── a link that came from another app ───────────────────────────── */
  function fromShare() {
    var q;
    try { q = new URLSearchParams(w.location.search); } catch (e) { return; }
    var link = q.get('url') || C.firstUrl(q.get('text')) || C.firstUrl(q.get('title'));
    if (link) {
      $('lgLink').value = link;
      showLink();
      if (!st.mode) setMode(q.get('mode') === 'sell' ? 'sell' : 'buy');
    } else if (q.get('mode') === 'buy' || q.get('mode') === 'sell') setMode(q.get('mode'));
  }

  function wire() {
    $('lgModes').addEventListener('change', function (e) { if (e.target.name === 'lgMode') setMode(e.target.value); });
    $('lgLink').addEventListener('input', function () { fieldErr(this, ''); showLink(); });
    $('lgPaste').addEventListener('click', function () {
      if (!navigator.clipboard || !navigator.clipboard.readText) { $('lgLink').focus(); S.toast(t('lgPasteHint'), 'info'); return; }
      navigator.clipboard.readText().then(function (txt) {
        var u = C.firstUrl(txt) || txt.trim();
        if (!u) { S.toast(t('lgPasteEmpty'), 'info'); return; }
        $('lgLink').value = u; fieldErr($('lgLink'), ''); showLink();
      }, function () { $('lgLink').focus(); S.toast(t('lgPasteHint'), 'info'); });
    });
    ['lgBrand', 'lgModel', 'lgAsked'].forEach(function (id) { $(id).addEventListener('input', function () { fieldErr(this, ''); }); });
    $('lgSize').addEventListener('change', function () { fieldErr(this, ''); });
    $('lgConsent').addEventListener('change', function () { this.closest('.v-check').classList.remove('err'); });
    $('lgWrap').addEventListener('input', function () { var m = $('lgMsg'); if (m.classList.contains('bad')) { m.textContent = ''; m.className = 'v-msg'; } });
    var grid = $('lgPhotos'), file = $('lgFile');
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
    $('lgGo').addEventListener('click', submit);
    $('lgVerForm').addEventListener('submit', function (e) {
      if (!$('lgVerCode').value.trim()) { e.preventDefault(); $('lgVerCode').focus(); }
    });
    w.addEventListener('beforeunload', function (e) {
      if (!sent && Object.keys(st.photos).length) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  S.boot({
    key: 'legit',
    title: 'pageLegit',
    init: function (me, c) {
      cfg = c;
      buildStatic();
      wire();
      fromShare();
      refresh();
    },
    onLang: function () {
      buildStatic();
      if (st.mode) { renderPhotos(); showLink(); refresh(); }
    }
  });
})(window, document);
