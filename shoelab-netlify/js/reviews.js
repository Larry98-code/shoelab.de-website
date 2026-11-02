/* ShoeLab — reviews and the satisfaction survey (reviews.html).
 *
 * The wall: published reviews of the studio, the Vault, the Legit Check and
 * the shop, with the score (average, spread of stars, "would recommend"),
 * filters and the studio's replies. Photos open in the photo viewer.
 *
 * The survey, in three short steps:
 *   1. what is being rated — for a signed-in customer, their own bookings,
 *      orders and Legit Checks ("Verified"); a booking invitation link
 *      (?ref=booking-N&k=…) skips straight to it; otherwise a topic;
 *   2. how satisfied: overall stars, the parts of that service, and
 *      "how likely are you to recommend us" (0–10);
 *   3. the review (public) and a private note for the team, photos, and
 *      whether to publish it at all.
 * Plus ideas ("Help shape ShoeLab"), which only the team reads. */
(function (w, d) {
  'use strict';
  var S = w.SLV, t = S.t, esc = S.esc;
  var $ = function (id) { return d.getElementById(id); };
  var TOPICS = ['studio', 'vault_buy', 'vault_sell', 'legit', 'shop', 'other'];
  var ASPECTS = {
    studio: ['result', 'service', 'value', 'speed'], vault_buy: ['described', 'shipping', 'contact', 'ease'],
    vault_sell: ['review', 'payout', 'contact', 'ease'], legit: ['speed', 'clarity', 'value', 'ease'],
    shop: ['quality', 'shipping', 'value', 'ease'], other: []
  };
  var FILTERS = ['', 'studio', 'vault', 'legit', 'shop'];
  var IDEA_TOPICS = ['studio', 'vault', 'legit', 'shop', 'website', 'other'];
  var STAR = '<path d="M12 2.9l2.75 5.72 6.3.78-4.62 4.36 1.18 6.24L12 16.95l-5.61 3.05 1.18-6.24L2.95 9.4l6.3-.78z"/>';
  var st = { topic: '', sort: 'new', photos: false, stars: 0, page: 1, items: [], total: 0, summary: null, loading: false };
  var mine = null, cfg = null;
  var query = {};
  try { var u = new URLSearchParams(w.location.search); query = { ref: u.get('ref'), k: u.get('k') }; } catch (e) {}

  /* ── small pieces ──────────────────────────────────────────────────── */
  var gid = 0;
  // 4.6 shows four full stars and a 60% star (its own gradient, ids never shared)
  // averages always with one decimal: 4.0, 4,7
  function avg1(n) { try { return new Intl.NumberFormat(S.locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n); } catch (e) { return (+n).toFixed(1); } }
  function stars(n, cls) {
    var h = '<span class="rv-stars' + (cls ? ' ' + cls : '') + '" role="img" aria-label="' + esc(t('rvStarsAria', { n: S.num(n) })) + '">';
    for (var i = 1; i <= 5; i++) {
      var fill = n >= i ? 1 : n > i - 1 ? n - (i - 1) : 0, paint = fill >= 1 ? 'currentColor' : 'none', defs = '';
      if (fill > 0 && fill < 1) {
        var id = 'rvg' + (++gid);
        defs = '<defs><linearGradient id="' + id + '"><stop offset="' + Math.round(fill * 100) + '%" stop-color="currentColor"/><stop offset="' + Math.round(fill * 100) + '%" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>';
        paint = 'url(#' + id + ')';
      }
      h += '<svg viewBox="0 0 24 24" aria-hidden="true">' + defs + '<path d="M12 2.9l2.75 5.72 6.3.78-4.62 4.36 1.18 6.24L12 16.95l-5.61 3.05 1.18-6.24L2.95 9.4l6.3-.78z" fill="' + paint + '" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    }
    return h + '</span>';
  }
  function hue(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function avatar(name) {
    var parts = String(name || '?').replace(/\./g, '').split(/\s+/).filter(Boolean);
    var ini = (parts[0] || '?').charAt(0) + (parts[1] ? parts[1].charAt(0) : '');
    return '<span class="rv-ava" style="background:hsl(' + hue(name || '') + ',38%,26%)" aria-hidden="true">' + esc(ini.toUpperCase()) + '</span>';
  }
  function topicKey(tp) { return tp === 'vault_buy' || tp === 'vault_sell' ? 'vault' : tp; }

  /* ── the score ─────────────────────────────────────────────────────── */
  function renderScore() {
    var sm = st.summary, box = $('rvScore');
    if (!sm || !sm.count) {
      box.innerHTML = '<div class="rv-score-empty">' + stars(0, 'big') + '<b>' + esc(t('rvFirstT')) + '</b><p>' + esc(t('rvFirstP')) + '</p>' +
        '<button type="button" class="v-btn gold sm" data-rv-write>' + esc(t('rvWriteBtn')) + '</button></div>';
      return;
    }
    var max = Math.max.apply(null, sm.dist) || 1;
    box.innerHTML =
      '<div class="rv-score-top"><b class="rv-avg">' + esc(avg1(sm.avg)) + '</b><div>' + stars(sm.avg, 'big') +
        '<small>' + esc(S.tn('rvCount', sm.count)) + (sm.verified ? ' · ' + esc(t('rvVerifiedN', { n: sm.verified })) : '') + '</small></div></div>' +
      '<div class="rv-dist">' + [5, 4, 3, 2, 1].map(function (n) {
        var c = sm.dist[n - 1];
        return '<button type="button" class="rv-dist-row' + (st.stars === n ? ' on' : '') + '" data-rv-stars="' + n + '" aria-pressed="' + (st.stars === n) + '"' + (c ? '' : ' disabled') + '>' +
          '<span>' + n + ' ★</span><i><em style="width:' + Math.round((c / max) * 100) + '%"></em></i><span>' + c + '</span></button>';
      }).join('') + '</div>' +
      (sm.recommend != null ? '<p class="rv-rec"><b>' + sm.recommend + '%</b> ' + esc(t('rvRecommend')) + '</p>' : '') +
      '<div class="rv-topics">' + Object.keys(sm.topics).map(function (k) {
        return '<span><small>' + esc(t('rvF_' + k)) + '</small><b>' + esc(avg1(sm.topics[k].avg)) + ' ★</b></span>';
      }).join('') + '</div>';
  }

  /* ── filters and the wall ──────────────────────────────────────────── */
  function renderBar() {
    $('rvBar').innerHTML =
      '<div class="rv-chips" role="tablist">' + FILTERS.map(function (f) {
        var on = st.topic === f, n = f && st.summary && st.summary.topics[f] ? st.summary.topics[f].n : null;
        return '<button type="button" role="tab" class="rv-chip' + (on ? ' on' : '') + '" aria-selected="' + on + '" data-rv-topic="' + f + '">' + esc(t(f ? 'rvF_' + f : 'rvAll')) + (n ? ' <small>' + n + '</small>' : '') + '</button>';
      }).join('') + '</div>' +
      '<div class="rv-tools">' +
        '<label class="rv-check"><input type="checkbox" id="rvPhotos"' + (st.photos ? ' checked' : '') + '/> ' + esc(t('rvWithPhotos')) + '</label>' +
        (st.stars ? '<button type="button" class="rv-clear" data-rv-stars="0">' + esc(t('rvOnlyStars', { n: st.stars })) + ' ✕</button>' : '') +
        '<select class="v-select rv-sort" id="rvSort" aria-label="' + esc(t('rvSortAria')) + '">' +
          [['new', 'rvSortNew'], ['high', 'rvSortHigh'], ['low', 'rvSortLow']].map(function (o) {
            return '<option value="' + o[0] + '"' + (st.sort === o[0] ? ' selected' : '') + '>' + esc(t(o[1])) + '</option>';
          }).join('') + '</select>' +
      '</div>';
  }
  function cardHtml(r) {
    var asp = Object.keys(r.aspects || {});
    var badge = r.verified
      ? '<span class="rv-ver" title="' + esc(r.refLabel || '') + '">' + S.ico('shield') + esc(t('rvV_' + r.refKind)) + '</span>'
      : '<span class="rv-unver">' + esc(t('rvUnverified')) + '</span>';
    return '<article class="rv-card" id="r' + r.id + '">' +
      '<header>' + avatar(r.name) + '<div class="rv-who"><b>' + esc(r.name) + '</b><small>' + badge + '</small></div>' +
        '<time datetime="' + esc(r.at) + '">' + esc(S.fmtDate(r.at)) + '</time></header>' +
      '<div class="rv-rate">' + stars(r.rating) + '<span class="rv-topic">' + esc(t('rvT_' + r.topic)) + (r.verified && r.refKind === 'booking' && r.refLabel ? ' · ' + esc(r.refLabel) : '') + '</span></div>' +
      (r.title ? '<h3>' + esc(r.title) + '</h3>' : '') +
      (r.body ? '<p class="rv-body">' + esc(r.body) + '</p><button type="button" class="rv-more" data-rv-more hidden>' + esc(t('rvReadMore')) + '</button>' : '') +
      (r.photos && r.photos.length ? '<div class="rv-photos">' + r.photos.map(function (p, i) {
        return '<button type="button" data-rv-photo="' + r.id + ':' + i + '" aria-label="' + esc(t('rvPhotoN', { n: i + 1 })) + '"><img src="' + esc(p.url) + '&amp;s=t" alt="" loading="lazy"/></button>';
      }).join('') + '</div>' : '') +
      (asp.length ? '<dl class="rv-asp">' + asp.map(function (a) {
        return '<div><dt>' + esc(t('rvA_' + a)) + '</dt><dd><i><em style="width:' + (r.aspects[a] * 20) + '%"></em></i><span>' + r.aspects[a] + '</span></dd></div>';
      }).join('') + '</dl>' : '') +
      (r.recommend ? '<p class="rv-recs">' + S.ico('check') + esc(t('rvRecs')) + '</p>' : '') +
      (r.reply ? '<div class="rv-reply"><b>' + esc(t('rvReplyFrom')) + '</b><p>' + esc(r.reply) + '</p></div>' : '') +
    '</article>';
  }
  function renderWall() {
    var wall = $('rvWall');
    if (!st.items.length) {
      wall.innerHTML = st.summary && st.summary.count
        ? '<div class="v-empty">' + S.ico('search') + '<h3>' + esc(t('rvNoneT')) + '</h3><p>' + esc(t('rvNoneP')) + '</p></div>'
        : '';
      $('rvMore').hidden = true;
      return;
    }
    wall.innerHTML = st.items.map(cardHtml).join('');
    $('rvMore').hidden = st.items.length >= st.total;
    // "read more" only where the text is really cut
    Array.prototype.forEach.call(wall.querySelectorAll('.rv-body'), function (p) {
      if (p.scrollHeight > p.clientHeight + 4) p.nextElementSibling.hidden = false;
    });
  }
  function load(reset) {
    if (reset) { st.page = 1; st.items = []; }
    st.loading = true;
    var p = new URLSearchParams();
    if (st.topic) p.set('topic', st.topic);
    if (st.sort !== 'new') p.set('sort', st.sort);
    if (st.photos) p.set('photos', '1');
    if (st.stars) p.set('stars', st.stars);
    p.set('page', st.page);
    return S.market('reviews?' + p.toString()).then(function (res) {
      st.loading = false;
      if (!res.ok) { $('rvWall').innerHTML = '<div class="v-empty">' + S.ico('alert') + '<h3>' + esc(t('emptyErrorT')) + '</h3><p>' + esc(S.errText(res)) + '</p></div>'; return; }
      st.summary = res.data.summary; st.total = res.data.total;
      st.items = st.page === 1 ? res.data.items : st.items.concat(res.data.items);
      renderScore(); renderBar(); renderWall();
      var h = (w.location.hash || '').slice(1), el = /^r\d+$/.test(h) && $(h);
      if (el && reset !== false) { el.classList.add('flash'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });
  }

  /* ── the survey ────────────────────────────────────────────────────── */
  var sv = null, root = null;
  function loadMine() {
    var p = new URLSearchParams();
    if (query.ref) p.set('ref', query.ref);
    if (query.k) p.set('k', query.k);
    return S.market('reviews/mine?' + p.toString()).then(function (res) { mine = res.ok ? res.data : { signedIn: false, eligible: [] }; return mine; });
  }
  function openSurvey() {
    sv = { step: 1, ref: null, k: null, topic: null, label: null, verified: false, rating: 0, aspects: {}, nps: null, title: '', body: '', note: '', publish: true, photos: [], name: '', email: '' };
    var inv = mine && mine.invite, pre = query.ref && mine && mine.eligible.filter(function (x) { return x.ref === query.ref; })[0];
    if (inv && !inv.done) { sv.ref = inv.ref; sv.k = query.k; sv.topic = 'studio'; sv.label = inv.label + (inv.date ? ' · ' + S.fmtDate(inv.date) : ''); sv.verified = true; sv.name = inv.name; sv.step = 2; }
    else if (pre) { pick(pre); sv.step = 2; }
    root = d.createElement('div');
    root.className = 'rv-sv';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'rvSvT');
    root.innerHTML = '<div class="rv-sv-panel"><header class="rv-sv-head"><div><small class="v-eyebrow" data-t="rvSvEyebrow">' + esc(t('rvSvEyebrow')) + '</small><h2 id="rvSvT"></h2></div>' +
      '<button type="button" class="rv-sv-x" aria-label="' + esc(t('close')) + '">✕</button></header>' +
      '<div class="rv-sv-prog" aria-hidden="true"><i></i><i></i><i></i></div>' +
      '<div class="rv-sv-body"></div><footer class="rv-sv-foot"></footer></div>';
    d.body.appendChild(root);
    d.documentElement.classList.add('v-vw-lock');
    root.addEventListener('click', onSurveyClick);
    root.addEventListener('input', onSurveyInput);
    root.addEventListener('change', onSurveyChange);
    d.addEventListener('keydown', onSurveyKey, true);
    requestAnimationFrame(function () { root.classList.add('open'); });
    step(sv.step);
  }
  function closeSurvey() {
    if (!root) return;
    d.removeEventListener('keydown', onSurveyKey, true);
    root.remove(); root = null;
    d.documentElement.classList.remove('v-vw-lock');
    if (/#write$/.test(w.location.hash)) { try { w.history.replaceState(null, '', w.location.pathname); } catch (e) {} }
  }
  function onSurveyKey(e) { if (e.key === 'Escape' && root && sv.step !== 4) { e.stopPropagation(); closeSurvey(); } }
  function pick(x) { sv.ref = x.ref; sv.topic = x.topic; sv.label = x.label + (x.date ? ' · ' + S.fmtDate(x.date) : ''); sv.verified = true; }
  function step(n) {
    sv.step = n;
    var head = root.querySelector('#rvSvT'), body = root.querySelector('.rv-sv-body'), foot = root.querySelector('.rv-sv-foot');
    Array.prototype.forEach.call(root.querySelectorAll('.rv-sv-prog i'), function (x, i) { x.classList.toggle('on', i < n); });
    root.querySelector('.rv-sv-prog').hidden = n === 4;
    var back = '<button type="button" class="v-btn ghost sm" data-sv="back">' + esc(t('rvBack')) + '</button>';
    if (n === 1) {
      head.textContent = t('rvS1T');
      var el = (mine && mine.eligible) || [];
      body.innerHTML =
        (el.length ? '<p class="rv-sv-k">' + esc(t('rvYours')) + '</p><div class="rv-sv-mine">' + el.map(function (x, i) {
          return '<button type="button" class="rv-sv-opt mine' + (sv.ref === x.ref ? ' sel' : '') + '" data-sv-mine="' + i + '">' + S.ico('shield') +
            '<span><b>' + esc(t('rvT_' + x.topic)) + '</b><small>' + esc(x.label) + (x.date ? ' · ' + esc(S.fmtDate(x.date)) : '') + '</small></span><em>' + esc(t('rvVerifiedShort')) + '</em></button>';
        }).join('') + '</div><p class="rv-sv-k">' + esc(t('rvOrTopic')) + '</p>' : '') +
        '<div class="rv-sv-topics">' + TOPICS.map(function (k) {
          return '<button type="button" class="rv-sv-opt' + (!sv.ref && sv.topic === k ? ' sel' : '') + '" data-sv-topic="' + k + '"><b>' + esc(t('rvT_' + k)) + '</b><small>' + esc(t('rvTD_' + k)) + '</small></button>';
        }).join('') + '</div>' +
        (mine && !mine.signedIn ? '<p class="rv-sv-hint">' + S.ico('shield') + '<span>' + esc(t('rvSignInHint')) + ' <button type="button" class="v-link-btn" data-sv="signin">' + esc(t('signIn')) + '</button></span></p>' : '');
      foot.innerHTML = '<span></span><button type="button" class="v-btn gold sm" data-sv="next"' + (sv.topic ? '' : ' disabled') + '>' + esc(t('rvNext')) + '</button>';
    } else if (n === 2) {
      head.textContent = t('rvS2T');
      var asp = ASPECTS[sv.topic] || [];
      body.innerHTML = '<p class="rv-sv-about">' + (sv.verified ? '<span class="rv-ver">' + S.ico('shield') + esc(t('rvVerifiedShort')) + '</span> ' : '') +
          '<b>' + esc(t('rvT_' + sv.topic)) + '</b>' + (sv.label ? ' · ' + esc(sv.label) : '') + '</p>' +
        '<div class="rv-sv-big">' + rater('overall', sv.rating, true) + '<p class="rv-sv-lbl" id="rvOverallLbl">' + esc(sv.rating ? t('rvR' + sv.rating) : t('rvTapStars')) + '</p></div>' +
        (asp.length ? '<div class="rv-sv-asp"><p class="rv-sv-k">' + esc(t('rvAspectsT')) + ' <small>' + esc(t('optional')) + '</small></p>' + asp.map(function (a) {
          return '<div class="rv-sv-asprow"><span>' + esc(t('rvA_' + a)) + '</span>' + rater(a, sv.aspects[a] || 0) + '</div>';
        }).join('') + '</div>' : '') +
        '<div class="rv-sv-nps"><p class="rv-sv-k">' + esc(t('rvNpsQ')) + ' <small>' + esc(t('optional')) + '</small></p><div class="rv-nps" role="radiogroup" aria-label="' + esc(t('rvNpsQ')) + '">' +
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (i) {
            return '<button type="button" role="radio" aria-checked="' + (sv.nps === i) + '" class="' + (sv.nps === i ? 'sel' : '') + (i <= 6 ? ' lo' : i <= 8 ? ' mid' : ' hi') + '" data-sv-nps="' + i + '">' + i + '</button>';
          }).join('') + '</div><div class="rv-nps-ends"><small>' + esc(t('rvNpsLo')) + '</small><small>' + esc(t('rvNpsHi')) + '</small></div></div>';
      foot.innerHTML = (sv.k && sv.step === 2 && mine && mine.invite ? '<span></span>' : back) + '<button type="button" class="v-btn gold sm" data-sv="next"' + (sv.rating ? '' : ' disabled') + '>' + esc(t('rvNext')) + '</button>';
    } else if (n === 3) {
      head.textContent = t('rvS3T');
      var guest = mine && !mine.signedIn && !sv.k;
      body.innerHTML =
        '<div class="v-field"><label class="v-label" for="svTitle"><span>' + esc(t('rvTitleL')) + '</span><small>' + esc(t('optional')) + '</small></label>' +
          '<input class="v-input" id="svTitle" maxlength="90" value="' + esc(sv.title) + '" placeholder="' + esc(t('rvTitlePh')) + '"/></div>' +
        '<div class="v-field"><label class="v-label" for="svBody"><span>' + esc(t('rvBodyL')) + '</span><small id="svBodyN">' + sv.body.length + ' / 2000</small></label>' +
          '<textarea class="v-textarea" id="svBody" rows="5" maxlength="2000" placeholder="' + esc(t('rvBodyPh')) + '">' + esc(sv.body) + '</textarea></div>' +
        '<div class="v-field"><span class="v-label"><span>' + esc(t('rvPhotosL')) + '</span><small>' + esc(t('rvPhotosHint')) + '</small></span>' +
          '<div class="rv-sv-photos" id="svPhotos">' + photoSlots() + '</div><input type="file" id="svFile" accept="image/*" hidden multiple/></div>' +
        '<div class="v-field rv-sv-private"><label class="v-label" for="svNote"><span>' + S.ico('lock') + esc(t('rvNoteL')) + '</span><small>' + esc(t('rvNoteHint')) + '</small></label>' +
          '<textarea class="v-textarea" id="svNote" rows="2" maxlength="1000" placeholder="' + esc(t('rvNotePh')) + '">' + esc(sv.note) + '</textarea></div>' +
        (guest ? '<div class="v-row"><div class="v-field"><label class="v-label" for="svName">' + esc(t('rvNameL')) + '</label><input class="v-input" id="svName" maxlength="60" autocomplete="name" value="' + esc(sv.name) + '"/></div>' +
          '<div class="v-field"><label class="v-label" for="svEmail"><span>' + esc(t('rvEmailL')) + '</span><small>' + esc(t('rvEmailHint')) + '</small></label><input class="v-input" id="svEmail" type="email" autocomplete="email" maxlength="254" value="' + esc(sv.email) + '"/></div></div>' : '') +
        '<label class="v-switch rv-sv-pub"><span><b>' + esc(t('rvPublishL')) + '</b><small class="v-note">' + esc(t(sv.publish ? 'rvPublishOn' : 'rvPublishOff', { name: showName() })) + '</small></span>' +
          '<input type="checkbox" id="svPublish"' + (sv.publish ? ' checked' : '') + '/><span class="knob"></span></label>' +
        '<input type="text" id="svWebsite" name="website" tabindex="-1" autocomplete="off" class="rv-hp" aria-hidden="true"/>' +
        '<p class="v-note" style="margin-top:0.9rem;">' + esc(t('rvConsentNote')) + ' <a class="v-link-btn" href="/datenschutz.html#reviews" target="_blank" rel="noopener">' + esc(t('privacyLink')) + '</a></p>' +
        '<div class="v-msg" role="alert" id="svMsg"></div>';
      foot.innerHTML = back + '<button type="button" class="v-btn gold sm" data-sv="send">' + esc(t('rvSend')) + '</button>';
    } else {
      var fn = S.firstName(sv.name || (mine && mine.name) || '');
      head.textContent = fn ? t('rvS4T', { name: fn }) : t('rvS4Tanon');
      var g = cfg && cfg.googleReviewUrl;
      body.innerHTML = '<div class="rv-sv-done">' + S.ico('check') +
        '<p>' + esc(t(sv.publish ? 'rvDoneP' : 'rvDonePrivate')) + '</p>' +
        (g ? '<div class="rv-sv-google"><p>' + esc(t('rvGoogleP')) + '</p><a class="v-btn ghost sm" href="' + esc(g) + '" target="_blank" rel="noopener">' + esc(t('rvGoogleBtn')) + ' ↗</a></div>' : '') +
        '</div>';
      foot.innerHTML = '<span></span><button type="button" class="v-btn gold sm" data-sv="close">' + esc(t('rvDoneBtn')) + '</button>';
    }
    var f = root.querySelector('.rv-sv-body');
    f.scrollTop = 0;
  }
  function rater(key, val, big) {
    var h = '<div class="rv-rater' + (big ? ' big' : '') + '" role="radiogroup" data-rater="' + key + '" aria-label="' + esc(key === 'overall' ? t('rvS2T') : t('rvA_' + key)) + '">';
    for (var i = 1; i <= 5; i++) {
      h += '<button type="button" role="radio" aria-checked="' + (val === i) + '" aria-label="' + esc(t('rvStarsAria', { n: i })) + '" data-v="' + i + '" class="' + (val >= i ? 'on' : '') + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' + STAR + '</svg></button>';
    }
    return h + '</div>';
  }
  function photoSlots() {
    var h = '';
    for (var i = 0; i < 3; i++) {
      var p = sv.photos[i];
      h += p ? '<div class="rv-sv-ph"><img src="' + p.thumb + '" alt=""/><button type="button" data-sv-rmph="' + i + '" aria-label="' + esc(t('removePhoto', { kind: i + 1 })) + '">✕</button></div>'
        : (i === sv.photos.length ? '<button type="button" class="rv-sv-ph add" data-sv="addph">' + S.ico('camera') + '<span>' + esc(t('nmAdd')) + '</span></button>' : '');
    }
    return h;
  }
  function showName() { return (sv.name && (mine && mine.invite ? sv.name : '')) || (mine && mine.name) || t('rvYourName'); }
  function readStep3() {
    sv.title = root.querySelector('#svTitle').value.trim();
    sv.body = root.querySelector('#svBody').value.trim();
    sv.note = root.querySelector('#svNote').value.trim();
    sv.publish = root.querySelector('#svPublish').checked;
    var n = root.querySelector('#svName'), e = root.querySelector('#svEmail');
    if (n) sv.name = n.value.trim();
    if (e) sv.email = e.value.trim();
  }
  function send(btn) {
    readStep3();
    var msg = root.querySelector('#svMsg');
    var bad = sv.publish && sv.body.length < 20 ? 'rvE_body' : !sv.publish && !sv.body && !sv.note ? 'rvE_some'
      : root.querySelector('#svName') && !sv.name ? 'rvE_name' : root.querySelector('#svEmail') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(sv.email) ? 'rvE_email' : '';
    if (bad) { msg.textContent = t(bad); msg.className = 'v-msg bad'; return; }
    S.busy(btn, true);
    msg.textContent = sv.photos.length ? t('uploading') : ''; msg.className = 'v-msg';
    S.market('reviews', { body: {
      ref: sv.ref, k: sv.k, topic: sv.topic, rating: sv.rating, aspects: sv.aspects, nps: sv.nps,
      title: sv.title, body: sv.body, note: sv.note, publish: sv.publish, name: sv.name, email: sv.email, lang: S.lang(),
      photos: sv.publish ? sv.photos.map(function (p) { return { data: p.data, thumb: p.thumb }; }) : [],
      website: root.querySelector('#svWebsite').value
    } }).then(function (res) {
      S.busy(btn, false);
      if (!res.ok) { msg.textContent = S.errText(res); msg.className = 'v-msg bad'; return; }
      if (mine) mine.eligible = mine.eligible.filter(function (x) { return x.ref !== sv.ref; });
      if (mine && mine.invite) mine.invite.done = true;
      step(4);
    });
  }
  function onSurveyClick(e) {
    if (e.target === root) return;
    var b = e.target.closest('button');
    if (!b) return;
    var a = b.getAttribute('data-sv');
    if (b.classList.contains('rv-sv-x')) { closeSurvey(); return; }
    if (b.hasAttribute('data-sv-mine')) { pick(mine.eligible[+b.getAttribute('data-sv-mine')]); step(1); return; }
    if (b.hasAttribute('data-sv-topic')) { sv.ref = null; sv.verified = false; sv.label = null; sv.topic = b.getAttribute('data-sv-topic'); sv.aspects = {}; step(1); return; }
    var rt = b.closest('[data-rater]');
    if (rt) {
      var key = rt.getAttribute('data-rater'), v = +b.getAttribute('data-v');
      if (key === 'overall') sv.rating = v; else sv.aspects[key] = sv.aspects[key] === v ? 0 : v;
      Array.prototype.forEach.call(rt.querySelectorAll('button'), function (x) { var xv = +x.getAttribute('data-v'); x.classList.toggle('on', xv <= (key === 'overall' ? sv.rating : sv.aspects[key] || 0)); x.setAttribute('aria-checked', String(xv === v)); });
      if (key === 'overall') { root.querySelector('#rvOverallLbl').textContent = t('rvR' + v); root.querySelector('[data-sv="next"]').disabled = false; }
      return;
    }
    if (b.hasAttribute('data-sv-nps')) {
      var nv = +b.getAttribute('data-sv-nps');
      sv.nps = sv.nps === nv ? null : nv;
      Array.prototype.forEach.call(root.querySelectorAll('[data-sv-nps]'), function (x) { var on = +x.getAttribute('data-sv-nps') === sv.nps; x.classList.toggle('sel', on); x.setAttribute('aria-checked', String(on)); });
      return;
    }
    if (b.hasAttribute('data-sv-rmph')) { readStep3(); sv.photos.splice(+b.getAttribute('data-sv-rmph'), 1); root.querySelector('#svPhotos').innerHTML = photoSlots(); return; }
    if (a === 'next') { if (sv.step === 3) return; step(sv.step + 1); return; }
    if (a === 'back') { if (sv.step === 3) readStep3(); step(sv.step - 1); return; }
    if (a === 'send') { send(b); return; }
    if (a === 'close') { closeSurvey(); load(true); return; }
    if (a === 'addph') { root.querySelector('#svFile').click(); return; }
    if (a === 'signin') {
      S.requireAuth('authReview').then(function (u) { if (u) loadMine().then(function () { step(1); }); });
    }
  }
  function onSurveyInput(e) {
    if (e.target.id === 'svBody') root.querySelector('#svBodyN').textContent = e.target.value.length + ' / 2000';
    var m = root.querySelector('#svMsg');
    if (m && m.classList.contains('bad')) { m.textContent = ''; m.className = 'v-msg'; }
  }
  function onSurveyChange(e) {
    if (e.target.id === 'svPublish') {
      sv.publish = e.target.checked;
      e.target.closest('.v-switch').querySelector('small').textContent = t(sv.publish ? 'rvPublishOn' : 'rvPublishOff', { name: showName() });
      return;
    }
    if (e.target.id === 'svFile' && e.target.files && e.target.files.length) {
      readStep3();
      var files = Array.prototype.slice.call(e.target.files, 0, 3 - sv.photos.length);
      e.target.value = '';
      files.reduce(function (p, f) {
        return p.then(function () { return S.compressPhoto(f).then(function (out) { sv.photos.push(out); }, function (err) { S.toast(t(err && err.message === 'large' ? 'e_photo_big' : 'e_photo_bad'), 'bad'); }); });
      }, Promise.resolve()).then(function () { if (root) root.querySelector('#svPhotos').innerHTML = photoSlots(); });
    }
  }

  /* ── ideas ─────────────────────────────────────────────────────────── */
  function renderIdeas() {
    var f = $('rvIdeaForm'), me = S.me();
    f.innerHTML =
      '<div class="v-field"><label class="v-label" for="idTopic">' + esc(t('rvIdeaAbout')) + '</label><select class="v-select" id="idTopic">' +
        IDEA_TOPICS.map(function (k) { return '<option value="' + k + '">' + esc(t('rvIT_' + k)) + '</option>'; }).join('') + '</select></div>' +
      '<div class="v-field"><label class="v-label" for="idBody">' + esc(t('rvIdeaL')) + '</label><textarea class="v-textarea" id="idBody" rows="4" maxlength="2000" placeholder="' + esc(t('rvIdeaPh')) + '"></textarea></div>' +
      (me ? '' : '<div class="v-field"><label class="v-label" for="idEmail"><span>' + esc(t('rvIdeaEmail')) + '</span><small>' + esc(t('optional')) + '</small></label><input class="v-input" id="idEmail" type="email" autocomplete="email" maxlength="254"/></div>') +
      '<input type="text" id="idWebsite" tabindex="-1" autocomplete="off" class="rv-hp" aria-hidden="true"/>' +
      '<div class="v-msg" role="alert" id="idMsg"></div>' +
      '<button type="submit" class="v-btn sm">' + esc(t('rvIdeaSend')) + '</button>';
  }
  function sendIdea(e) {
    e.preventDefault();
    var msg = $('idMsg'), body = $('idBody').value.trim(), btn = $('rvIdeaForm').querySelector('button[type="submit"]');
    if (body.length < 10) { msg.textContent = t('rvE_idea'); msg.className = 'v-msg bad'; return; }
    S.busy(btn, true);
    S.market('reviews/idea', { body: { topic: $('idTopic').value, body: body, email: $('idEmail') ? $('idEmail').value.trim() : '', lang: S.lang(), website: $('idWebsite').value } }).then(function (res) {
      S.busy(btn, false);
      if (!res.ok) { msg.textContent = S.errText(res); msg.className = 'v-msg bad'; return; }
      $('rvIdeaForm').innerHTML = '<div class="rv-ideas-done">' + S.ico('check') + '<b>' + esc(t('rvIdeaThanksT')) + '</b><p>' + esc(t('rvIdeaThanks')) + '</p></div>';
    });
  }

  /* ── wiring ────────────────────────────────────────────────────────── */
  function write() {
    (mine ? Promise.resolve(mine) : loadMine()).then(function () { openSurvey(); });
  }
  function wire() {
    $('rvWrite').addEventListener('click', write);
    $('rvScore').addEventListener('click', function (e) {
      if (e.target.closest('[data-rv-write]')) { write(); return; }
      var s = e.target.closest('[data-rv-stars]');
      if (s) { st.stars = st.stars === +s.getAttribute('data-rv-stars') ? 0 : +s.getAttribute('data-rv-stars'); load(true); }
    });
    $('rvBar').addEventListener('click', function (e) {
      var tp = e.target.closest('[data-rv-topic]');
      if (tp) { st.topic = tp.getAttribute('data-rv-topic'); load(true); return; }
      var s = e.target.closest('[data-rv-stars]');
      if (s) { st.stars = 0; load(true); }
    });
    $('rvBar').addEventListener('change', function (e) {
      if (e.target.id === 'rvSort') { st.sort = e.target.value; load(true); }
      if (e.target.id === 'rvPhotos') { st.photos = e.target.checked; load(true); }
    });
    $('rvWall').addEventListener('click', function (e) {
      var m = e.target.closest('[data-rv-more]');
      if (m) { m.previousElementSibling.classList.add('open'); m.hidden = true; return; }
      var ph = e.target.closest('[data-rv-photo]');
      if (ph && w.SLVViewer) {
        var id = +ph.getAttribute('data-rv-photo').split(':')[0], i = +ph.getAttribute('data-rv-photo').split(':')[1];
        var r = st.items.filter(function (x) { return x.id === id; })[0];
        if (r) w.SLVViewer.open({ photos: r.photos, index: i, title: r.name + ' · ' + t('rvT_' + r.topic), check: null });
      }
    });
    $('rvMore').addEventListener('click', function () { st.page++; load(false); });
    $('rvIdeaForm').addEventListener('submit', sendIdea);
  }

  S.boot({
    key: 'reviews',
    brand: 'lab',
    title: 'pageReviews',
    init: function (me, c) {
      cfg = c;
      wire();
      renderIdeas();
      load(true);
      // from an invitation, My Vault or the studio card: straight into the survey
      if (/#write$/.test(w.location.hash) || query.ref) write();
    },
    onLang: function () {
      renderScore(); renderBar(); renderWall(); renderIdeas();
      if (root) step(sv.step);
    },
    onAuth: function () { loadMine(); renderIdeas(); }
  });
})(window, document);
