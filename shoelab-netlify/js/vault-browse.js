/* ShoeLab Vault — the browse page (vault.html): hero, search, filters, the
 * live and recently-sold grids, and the labelled example preview. */
(function (w, d) {
  'use strict';
  var S = w.SLV;
  var $ = function (id) { return d.getElementById(id); };

  var FIELDS = ['view', 'q', 'sort', 'format', 'tier', 'brand', 'size', 'cond', 'min', 'max'];
  var state = { view: 'live', q: '', sort: '', format: '', tier: '', brand: '', size: '', cond: '', min: '', max: '' };
  var page = 1, per = 24, items = [], total = 0, facets = null, seq = 0, failed = null;
  var preview = S.qs('preview') === '1';

  var SORTS = {
    live: [['new', 'sortNew'], ['ending', 'sortEnding'], ['price_asc', 'sortPriceAsc'], ['price_desc', 'sortPriceDesc'], ['popular', 'sortPopular']],
    sold: [['sold', 'sortSold'], ['price_desc', 'sortPriceDesc'], ['price_asc', 'sortPriceAsc']]
  };

  /* ── URL ⇄ state ──────────────────────────────────────────────────── */
  function readUrl() {
    var p = new URLSearchParams(w.location.search);
    FIELDS.forEach(function (k) { if (p.get(k)) state[k] = p.get(k); });
    if (state.view !== 'sold') state.view = 'live';
  }
  function writeUrl() {
    var p = new URLSearchParams();
    if (preview) p.set('preview', '1');
    FIELDS.forEach(function (k) {
      if (state[k] && !(k === 'view' && state[k] === 'live')) p.set(k, state[k]);
    });
    var qs = p.toString();
    try { w.history.replaceState(null, '', w.location.pathname + (qs ? '?' + qs : '') + w.location.hash); } catch (e) {}
  }
  function filterCount() {
    return ['format', 'tier', 'brand', 'size', 'cond', 'min', 'max'].filter(function (k) { return state[k]; }).length;
  }
  function apiQuery() {
    var p = new URLSearchParams();
    FIELDS.forEach(function (k) { if (state[k]) p.set(k, state[k]); });
    p.set('page', page); p.set('per', per);
    return p.toString();
  }

  /* ── controls ─────────────────────────────────────────────────────── */
  function renderSort() {
    var sel = $('vSort'), list = SORTS[state.view];
    if (!list.some(function (s) { return s[0] === state.sort; })) state.sort = '';
    sel.innerHTML = list.map(function (s, i) {
      var on = state.sort ? s[0] === state.sort : i === 0;
      return '<option value="' + s[0] + '"' + (on ? ' selected' : '') + '>' + S.esc(S.t(s[1])) + '</option>';
    }).join('');
  }
  function fillFacets() {
    if (!facets) return;
    var brand = $('fBrand'), size = $('fSize');
    var brands = (facets.brands || []).slice();
    if (state.brand && !brands.some(function (b) { return b.brand.toLowerCase() === state.brand.toLowerCase(); })) brands.unshift({ brand: state.brand, n: 0 });
    brand.innerHTML = '<option value="">' + S.esc(S.t('fAll')) + '</option>' + brands.map(function (b) {
      return '<option value="' + S.esc(b.brand) + '"' + (b.brand.toLowerCase() === state.brand.toLowerCase() ? ' selected' : '') + '>' +
        S.esc(b.brand) + (b.n ? ' (' + b.n + ')' : '') + '</option>';
    }).join('');
    var sizes = (facets.sizes || []).slice();
    if (state.size && !sizes.some(function (s) { return s.size === state.size; })) sizes.unshift({ size: state.size, n: 0 });
    size.innerHTML = '<option value="">' + S.esc(S.t('fAll')) + '</option>' + sizes.map(function (s) {
      return '<option value="' + S.esc(s.size) + '"' + (s.size === state.size ? ' selected' : '') + '>EU ' + S.esc(s.size) + (s.n ? ' (' + s.n + ')' : '') + '</option>';
    }).join('');
  }
  function syncControls() {
    $('vQ').value = state.q;
    $('fFormat').value = state.format;
    $('fTier').value = state.tier;
    $('fCond').value = state.cond;
    $('fMin').value = state.min;
    $('fMax').value = state.max;
    Array.prototype.forEach.call(d.querySelectorAll('[data-view]'), function (b) {
      var on = b.getAttribute('data-view') === state.view;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $('vBrowseTitle').textContent = S.t(state.view === 'sold' ? 'browseSold' : 'browseLive');
    var n = filterCount(), badge = $('vFilterN');
    badge.textContent = n || ''; badge.classList.toggle('on', n > 0);
    renderSort();
    fillFacets();
    renderActive();
  }
  function renderActive() {
    var chips = [];
    var add = function (k, label) { chips.push('<button type="button" data-clear="' + k + '">' + S.esc(label) + ' ✕</button>'); };
    if (state.q) add('q', '“' + state.q + '”');
    if (state.format) add('format', S.t(state.format === 'auction' ? 'fAuction' : 'fFixed'));
    if (state.tier) add('tier', S.t(state.tier === 'lab' ? 'tierLab' : 'tierPhoto'));
    if (state.brand) add('brand', state.brand);
    if (state.size) add('size', 'EU ' + state.size);
    if (state.cond) add('cond', S.condLabel(state.cond));
    if (state.min) add('min', '≥ ' + S.money(S.centsOf(state.min)));
    if (state.max) add('max', '≤ ' + S.money(S.centsOf(state.max)));
    $('vActive').innerHTML = chips.join('');
  }

  /* ── data ─────────────────────────────────────────────────────────── */
  function load(reset) {
    writeUrl();
    syncControls();
    if (preview) { renderPreview(); return; }
    var my = ++seq;
    if (reset) {
      page = 1;
      $('vGrid').innerHTML = S.skeletonCards(8);
      $('vMore').hidden = true;
    } else {
      S.busy($('vMore'), true);
    }
    S.market('listings?' + apiQuery()).then(function (res) {
      if (my !== seq) return;
      S.busy($('vMore'), false);
      if (!res.ok) { failed = res; items = []; total = 0; render(); return; }
      failed = null;
      facets = res.data.facets || facets;
      fillFacets();
      items = reset ? res.data.items : items.concat(res.data.items);
      total = res.data.total;
      render();
    });
  }

  function emptyHtml(kind) {
    var h = '<div class="v-empty" style="grid-column:1/-1;">' + S.ico('vault');
    if (kind === 'error') {
      h += '<h3>' + S.esc(S.t('emptyErrorT')) + '</h3><p>' + S.esc(S.errText(failed)) + '</p>' +
        '<div class="v-btn-row"><button type="button" class="v-btn ghost" data-act="retry">' + S.esc(S.t('retry')) + '</button></div>';
    } else if (kind === 'filtered') {
      h += '<h3>' + S.esc(S.t('emptyFilteredT')) + '</h3><p>' + S.esc(S.t('emptyFiltered')) + '</p>' +
        '<div class="v-btn-row"><button type="button" class="v-btn ghost" data-act="clear">' + S.esc(S.t('fReset')) + '</button></div>';
    } else if (kind === 'sold') {
      h += '<h3>' + S.esc(S.t('emptySoldT')) + '</h3><p>' + S.esc(S.t('emptySold')) + '</p>' +
        '<div class="v-btn-row"><button type="button" class="v-btn ghost" data-act="live">' + S.esc(S.t('viewLive')) + '</button></div>';
    } else {
      h += '<h3>' + S.esc(S.t('emptyT')) + '</h3><p>' + S.esc(S.t('empty')) + '</p>' +
        '<div class="v-btn-row"><a class="v-btn gold" href="/vault-sell.html">' + S.esc(S.t('sellFirst')) + '</a>' +
        '<button type="button" class="v-btn ghost" data-act="preview">' + S.esc(S.t('seeExample')) + '</button></div>';
    }
    return h + '</div>';
  }

  function render() {
    var grid = $('vGrid');
    $('vPreviewBar').innerHTML = '';
    if (failed) {
      $('vCount').textContent = '';
      grid.innerHTML = emptyHtml('error');
      $('vMore').hidden = true;
      return;
    }
    $('vCount').textContent = S.tn(state.view === 'sold' ? 'soldFound' : 'pairsFound', total);
    if (!items.length) {
      grid.innerHTML = emptyHtml(filterCount() || state.q ? 'filtered' : state.view === 'sold' ? 'sold' : 'none');
    } else {
      grid.innerHTML = items.map(function (it) { return S.card(it, { sold: state.view === 'sold' }); }).join('');
    }
    $('vMore').hidden = items.length >= total;
    S.tick();
  }

  // The examples are filtered on the page with the same controls, so the
  // whole experience can be tried before the first real pair is listed.
  function renderPreview() {
    var list = S.previewItems().filter(function (x) {
      var q = state.q.toLowerCase();
      if (q && (x.brand + ' ' + x.model).toLowerCase().indexOf(q) === -1) return false;
      if (state.format && x.format !== state.format) return false;
      if (state.tier && x.tier !== state.tier) return false;
      if (state.brand && x.brand.toLowerCase() !== state.brand.toLowerCase()) return false;
      if (state.size && x.size !== state.size) return false;
      if (state.cond && x.cond !== state.cond) return false;
      if (state.min && x.price < S.centsOf(state.min)) return false;
      if (state.max && x.price > S.centsOf(state.max)) return false;
      return state.view === 'live';
    });
    var sort = state.sort || 'new';
    list.sort(function (a, b) {
      if (sort === 'ending') return (a.endsAt ? Date.parse(a.endsAt) : Infinity) - (b.endsAt ? Date.parse(b.endsAt) : Infinity);
      if (sort === 'price_asc') return a.price - b.price;
      if (sort === 'price_desc') return b.price - a.price;
      if (sort === 'popular') return b.watchers - a.watchers;
      return a.id - b.id;
    });
    if (!facets) {
      var all = S.previewItems(), bc = {}, sc = {};
      all.forEach(function (x) { bc[x.brand] = (bc[x.brand] || 0) + 1; sc[x.size] = (sc[x.size] || 0) + 1; });
      facets = {
        brands: Object.keys(bc).map(function (b) { return { brand: b, n: bc[b] }; }),
        sizes: Object.keys(sc).sort(function (a, b) { return parseFloat(a) - parseFloat(b); }).map(function (s) { return { size: s, n: sc[s] }; })
      };
      fillFacets();
    }
    $('vPreviewBar').innerHTML = '<div class="v-preview-bar"><span><b>' + S.esc(S.t('previewT')) + '</b> ' + S.esc(S.t('previewBar')) + '</span>' +
      '<button type="button" class="v-btn xs ghost" data-act="exitPreview">' + S.esc(S.t('exitPreview')) + '</button></div>';
    $('vCount').textContent = S.tn('pairsFound', list.length);
    $('vGrid').innerHTML = list.length ? list.map(function (x) { return S.card(x); }).join('') : emptyHtml('filtered');
    $('vMore').hidden = true;
    S.tick();
  }

  /* ── fees from the live configuration ─────────────────────────────── */
  function renderFees(cfg) {
    if (!cfg) return;
    $('feePhoto').textContent = S.money(cfg.fees.photo, true);
    $('feeLab').textContent = S.money(cfg.fees.lab, true);
    $('feesAuthVal').textContent = S.money(cfg.fees.photo, true) + ' / ' + S.money(cfg.fees.lab, true);
    $('feesShipVal').textContent = S.money(cfg.shipping, true);
    var pct = Math.round(cfg.commission * 1000) / 10;
    $('feesCommVal').textContent = S.num(pct) + ' %';
    var sale = 10000, keep = sale - Math.round(sale * cfg.commission);
    $('feesExample').textContent = S.t('feesExample', { price: S.money(sale), payout: S.money(keep) });
  }

  /* ── hero: a slow rotation of pairs behind the dial ───────────────── */
  function hero() {
    var box = $('vHeroShoe');
    if (!box || (w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    var srcs = ['/img/showcase/jordan1.webp', '/img/showcase/nb9060-black.webp', '/img/showcase/nb1080.webp', '/img/showcase/nb880.webp'];
    srcs.slice(1).forEach(function (s) {
      var im = new Image(); im.src = s; im.alt = ''; im.decoding = 'async';
      box.appendChild(im);
    });
    var imgs = box.querySelectorAll('img'), i = 0;
    setInterval(function () {
      if (d.hidden) return;
      imgs[i].classList.remove('on');
      i = (i + 1) % imgs.length;
      imgs[i].classList.add('on');
    }, 4800);
  }

  /* ── events ───────────────────────────────────────────────────────── */
  var typing = null;
  function wire() {
    $('vQ').addEventListener('input', function () {
      clearTimeout(typing);
      var v = this.value.trim();
      typing = setTimeout(function () { if (v !== state.q) { state.q = v; load(true); } }, 350);
    });
    $('vQ').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); clearTimeout(typing); state.q = this.value.trim(); load(true); this.blur(); }
    });
    $('vSort').addEventListener('change', function () { state.sort = this.value; load(true); });
    $('vFilterBtn').addEventListener('click', function () {
      var box = $('vFilters'), on = !box.classList.contains('open');
      box.classList.toggle('open', on);
      this.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    [['fFormat', 'format'], ['fTier', 'tier'], ['fBrand', 'brand'], ['fSize', 'size'], ['fCond', 'cond']].forEach(function (p) {
      $(p[0]).addEventListener('change', function () { state[p[1]] = this.value; load(true); });
    });
    ['fMin', 'fMax'].forEach(function (id) {
      $(id).addEventListener('change', function () {
        var v = this.value.trim(), c = S.centsOf(v);
        state[id === 'fMin' ? 'min' : 'max'] = v && !isNaN(c) ? String(c / 100) : '';
        load(true);
      });
    });
    $('fReset').addEventListener('click', clearAll);
    $('vMore').addEventListener('click', function () { page++; load(false); });
    Array.prototype.forEach.call(d.querySelectorAll('[data-view]'), function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-view');
        if (v === state.view) return;
        state.view = v; state.sort = '';
        load(true);
      });
    });
    $('vActive').addEventListener('click', function (e) {
      var b = e.target.closest('[data-clear]');
      if (!b) return;
      state[b.getAttribute('data-clear')] = '';
      load(true);
    });
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'retry') load(true);
      else if (act === 'clear') clearAll();
      else if (act === 'live') { state.view = 'live'; state.sort = ''; load(true); }
      else if (act === 'preview') { preview = true; facets = null; load(true); }
      else if (act === 'exitPreview') { preview = false; facets = null; load(true); }
    });
    // an auction on screen just ended: give the server a moment to settle it
    var pending = null;
    d.addEventListener('slv:ended', function () {
      if (preview || pending) return;
      pending = setTimeout(function () { pending = null; load(true); }, 2500);
    });
  }
  function clearAll() {
    ['q', 'format', 'tier', 'brand', 'size', 'cond', 'min', 'max'].forEach(function (k) { state[k] = ''; });
    load(true);
  }

  readUrl();
  S.boot({
    key: 'browse',
    title: 'pageBrowse',
    init: function (me, cfg) {
      wire();
      hero();
      renderFees(cfg);
      load(true);
    },
    onLang: function () {
      renderFees(S.config());
      syncControls();
      if (preview) renderPreview(); else render();
    },
    onAuth: function () { if (!preview) load(true); }
  });
})(window, document);
