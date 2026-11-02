/* ShoeLab Vault — the photo viewer of the specialist console (vault-lab.html).
 *
 * A seller's photos, full screen, for a close look:
 *   - zoom to the stitching: scroll, pinch, double-click or double-tap, + and −
 *     (100% is the photo's own pixels), and drag to move around;
 *   - rotate a sideways photo (kept per photo while the viewer is open);
 *   - Enhance: more contrast and light for dark photos;
 *   - Compare: two photos side by side, each with its own zoom (the size tag
 *     opens next to the box label); the gold side follows the strip;
 *   - next to each photo, what the Lab Check noted on it (its findings name
 *     the photo: "Photo 5, size tag: …"), and the photo's resolution;
 *   - ← → photos, + − 0 zoom, R rotate, E enhance, C compare, I notes,
 *     Esc closes; on phones, swipe between photos and Back closes.
 *
 * SLVViewer.open({ photos, index, title, id, check, pub }) opens it; pub: true
 * is the buyers' version (listings, reviews, certificates): no notes panel,
 * the photo takes the whole width; onClose(i) hears which photo it ended on.
 * The console
 * also uses marks() for the dots on its thumbnails and linkRefs() to turn
 * "Photo 4" in the Lab Check's text into a button that opens that photo. */
(function (w, d) {
  'use strict';
  var S = w.SLV, t = S.t, esc = S.esc;

  var IC = {
    zin: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4M8.3 11h5.4M11 8.3v5.4"/>',
    zout: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4M8.3 11h5.4"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    rot: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.8 4.2v4.6h-4.6"/>',
    enh: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/>',
    cmp: '<rect x="3.5" y="5" width="7.3" height="14" rx="1.6"/><rect x="13.2" y="5" width="7.3" height="14" rx="1.6"/>',
    ext: '<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.2M12 7.9h.01"/>',
    x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    left: '<path d="M14.5 5.5L8 12l6.5 6.5"/>', right: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  };
  function ico(n) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[n] + '</svg>';
  }
  function label(p) { return p.kind === 'extra' ? (p.note || t('kind_extra')) : t('kind_' + p.kind); }
  function thumb(p) { return p.url + (p.url.indexOf('?') === -1 ? '?' : '&') + 's=t'; }

  /* ── what the Lab Check said about each photo ──────────────────────────── */
  // The photos a finding names: "Photo 5, size tag", "Photos 3 and 4", "photos 2–4".
  var REF = /\b(photos?)(\s*#?\s*)(\d{1,2}(?:\s*(?:,|and|&amp;|&|\/|-|–|to)\s*\d{1,2})*)/gi;
  function refs(text) {
    var out = [];
    String(text || '').replace(REF, function (m, word, gap, list) {
      var n = list.match(/\d+/g).map(Number);
      if (n.length === 2 && /-|–|to/.test(list) && n[1] > n[0] && n[1] - n[0] < 12) { for (var k = n[0]; k <= n[1]; k++) out.push(k); }
      else out.push.apply(out, n);
      return m;
    });
    return out;
  }
  // Its findings and red flags that name photo n (counted from 1).
  function notes(check, n) {
    var r = check && check.status === 'done' && check.result;
    if (!r) return null;
    var out = [];
    (r.checks || []).forEach(function (k) { if (refs(k.finding).indexOf(n) !== -1) out.push({ kind: k.status, area: k.area, text: k.finding }); });
    (r.red_flags || []).forEach(function (f) { if (refs(f).indexOf(n) !== -1) out.push({ kind: 'flag', text: f }); });
    return out;
  }
  var RANK = { flag: 4, fail: 4, concern: 3, not_visible: 2, pass: 1 };
  var TONE = { flag: 'bad', fail: 'bad', concern: 'warn', not_visible: 'warn', pass: 'ok' };
  // The strongest note on each photo: a dot on its thumbnail ('bad', 'warn', 'ok' or '').
  function marks(check, count) {
    var out = [];
    for (var n = 1; n <= count; n++) {
      var best = null;
      (notes(check, n) || []).forEach(function (x) { if (!best || RANK[x.kind] > RANK[best]) best = x.kind; });
      out.push(best ? TONE[best] : '');
    }
    return out;
  }
  // "Photo 4" in already-escaped text becomes a button that opens photo 4.
  function linkRefs(html, id, count) {
    return String(html).replace(REF, function (m, word, gap, list) {
      var nums = list.match(/\d+/g);
      if (nums.some(function (x) { return +x < 1 || +x > count; })) return m;
      var btn = function (n, text) { return '<button type="button" class="v-ph-ref" data-view="' + id + ':' + n + '">' + text + '</button>'; };
      if (nums.length === 1) return btn(nums[0], word + gap + list);
      return word + gap + list.replace(/\d{1,2}/g, function (n) { return btn(n, n); });
    });
  }

  /* ── the viewer ─────────────────────────────────────────────────────────── */
  var root = null, photos = [], ctx = {}, rots = {}, sizes = {}, panes = [], act = 0, cmp = false;
  var lastFocus = null, pushed = false, hintTimer = null;
  var fine = w.matchMedia && w.matchMedia('(pointer: fine)').matches;

  // One photo on screen with its own zoom and position.
  function makePane() {
    var el = d.createElement('div');
    el.className = 'v-vw-pane';
    el.innerHTML = '<div class="v-vw-ph"></div><img class="v-vw-img" alt="" draggable="false"/>' +
      '<div class="v-vw-wait"><span class="v-lc-spin"></span></div><p class="v-vw-err"></p><span class="v-vw-badge"></span>';
    root.querySelector('.v-vw-panes').appendChild(el);
    var img = el.querySelector('.v-vw-img'), ph = el.querySelector('.v-vw-ph'), badge = el.querySelector('.v-vw-badge');
    var P = { el: el, i: -1, w: 0, h: 0, s: 1, fit: 1, x: 0, y: 0, ready: false, token: 0 };

    function rot() { return rots[P.i] || 0; }
    function box() { var q = rot() % 180 !== 0; return { w: q ? P.h : P.w, h: q ? P.w : P.h }; }
    function maxS() { return Math.max(6, P.fit * 4); }
    function clamp() {
      var b = box(), mx = Math.max(0, (b.w * P.s - el.clientWidth) / 2), my = Math.max(0, (b.h * P.s - el.clientHeight) / 2);
      P.x = Math.min(mx, Math.max(-mx, P.x));
      P.y = Math.min(my, Math.max(-my, P.y));
    }
    function apply(anim) {
      if (!P.ready) return;
      img.classList.toggle('anim', !!anim);
      img.style.transform = 'translate(' + P.x.toFixed(1) + 'px,' + P.y.toFixed(1) + 'px) rotate(' + rot() + 'deg) scale(' + P.s.toFixed(4) + ')';
      el.classList.toggle('zoomed', P.s > P.fit * 1.01);
      if (P === panes[act]) pct();
    }
    P.zoomed = function () { return P.ready && P.s > P.fit * 1.01; };
    // fit the photo to the pane; with keep, a zoomed-in view stays zoomed
    P.layout = function (keep, anim) {
      if (!P.ready || !el.clientWidth) return;
      var b = box(), was = P.zoomed();
      P.fit = Math.min(el.clientWidth / b.w, el.clientHeight / b.h, 3);
      if (!keep || !was) { P.s = P.fit; P.x = 0; P.y = 0; }
      else { P.s = Math.min(maxS(), Math.max(P.fit, P.s)); clamp(); }
      apply(anim);
    };
    // f: zoom factor; cx, cy: the point to keep still, from the pane's centre
    P.zoomAt = function (f, cx, cy, anim) {
      if (!P.ready) return;
      var s2 = Math.min(maxS(), Math.max(P.fit, P.s * f)), k = s2 / P.s;
      P.x = cx - (cx - P.x) * k; P.y = cy - (cy - P.y) * k; P.s = s2;
      clamp(); apply(anim);
    };
    P.fitNow = function () { if (P.ready) { P.s = P.fit; P.x = 0; P.y = 0; apply(true); } };
    P.rotate = function () { if (!P.ready) return; rots[P.i] = (rot() + 90) % 360; P.layout(false, true); };
    P.pct = function () { return P.ready ? Math.round(P.s * 100) + '%' : ''; };
    P.show = function (i) {
      var p = photos[i];
      if (!p) return;
      P.i = i; P.ready = false;
      var tok = ++P.token;
      img.classList.remove('on');
      ph.style.backgroundImage = 'url("' + thumb(p).replace(/"/g, '%22') + '")';
      el.classList.remove('err', 'zoomed'); el.classList.add('loading');
      el.setAttribute('aria-label', t('vwCount', { n: i + 1, total: photos.length }) + ': ' + label(p));
      badge.textContent = (i + 1) + ' · ' + label(p);
      var im = new Image();
      im.className = 'v-vw-img'; im.alt = ''; im.draggable = false;
      im.onload = function () {
        if (tok !== P.token || !root) return;
        P.w = im.naturalWidth || 1; P.h = im.naturalHeight || 1; P.ready = true;
        sizes[i] = { w: P.w, h: P.h };
        im.style.width = P.w + 'px'; im.style.height = P.h + 'px';
        im.style.marginLeft = (-P.w / 2) + 'px'; im.style.marginTop = (-P.h / 2) + 'px';
        el.replaceChild(im, img); img = im;        // the image already loaded, no second download
        el.classList.remove('loading');
        P.layout(false, false);
        requestAnimationFrame(function () { img.classList.add('on'); });
        if (P === panes[act]) side();
      };
      im.onerror = function () {
        if (tok !== P.token || !root) return;
        el.classList.remove('loading'); el.classList.add('err');
        el.querySelector('.v-vw-err').textContent = t('vwFailed');
      };
      im.src = p.url;
    };

    /* gestures: drag, pinch, double-tap, swipe, wheel */
    var pts = {}, g = null, lastTap = 0, tapX = 0, tapY = 0;
    function rel(e) { var b = el.getBoundingClientRect(); return { x: e.clientX - b.left - b.width / 2, y: e.clientY - b.top - b.height / 2 }; }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
    function canSwipe() { return !cmp && photos.length > 1; }
    function toggleZoom(p) {
      if (P.zoomed()) P.fitNow();
      else P.zoomAt(Math.max(1, P.fit * 2.5) / P.s, p.x, p.y, true);
    }
    el.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
      pts[e.pointerId] = rel(e);
      activate(P);
      var ids = Object.keys(pts);
      if (ids.length === 1) g = { kind: 'pan', start: pts[e.pointerId], x0: P.x, y0: P.y, moved: false };
      else if (ids.length === 2) {
        var a = pts[ids[0]], b = pts[ids[1]];
        g = { kind: 'pinch', d0: dist(a, b) || 1, m0: mid(a, b), s0: P.s, x0: P.x, y0: P.y };
      }
    });
    el.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId] || !g || !P.ready) return;
      pts[e.pointerId] = rel(e);
      var ids = Object.keys(pts);
      if (g.kind === 'pinch' && ids.length >= 2) {
        var a = pts[ids[0]], b = pts[ids[1]], m = mid(a, b);
        var s2 = Math.min(maxS(), Math.max(P.fit * 0.8, g.s0 * dist(a, b) / g.d0)), k = s2 / g.s0;
        P.s = s2; P.x = m.x - (g.m0.x - g.x0) * k; P.y = m.y - (g.m0.y - g.y0) * k;
        apply(false);
        return;
      }
      if (g.kind !== 'pan') return;
      var p = pts[e.pointerId], dx = p.x - g.start.x, dy = p.y - g.start.y;
      if (!g.moved && Math.abs(dx) + Math.abs(dy) > 6) { g.moved = true; el.classList.add('drag'); }
      if (!g.moved) return;
      if (P.zoomed()) { P.x = g.x0 + dx; P.y = g.y0 + dy; clamp(); apply(false); }
      else if (canSwipe()) { P.x = dx * 0.55; apply(false); }      // the swipe follows the finger
    });
    function up(e) {
      if (!pts[e.pointerId]) return;
      var p = pts[e.pointerId];
      delete pts[e.pointerId];
      el.classList.remove('drag');
      var left = Object.keys(pts);
      if (g && g.kind === 'pinch') {
        g = left.length === 1 ? { kind: 'pan', start: pts[left[0]], x0: P.x, y0: P.y, moved: true } : null;
        if (P.s < P.fit) { P.s = P.fit; P.x = 0; P.y = 0; }
        clamp(); apply(true);
        return;
      }
      if (!g || g.kind !== 'pan') { g = null; return; }
      var gg = g, dx = p.x - gg.start.x, dy = p.y - gg.start.y;
      g = null;
      if (!gg.moved) {
        if (e.pointerType !== 'mouse' && e.type === 'pointerup') {     // double-tap (a mouse has dblclick)
          var now = Date.now();
          if (now - lastTap < 330 && Math.abs(p.x - tapX) < 30 && Math.abs(p.y - tapY) < 30) { lastTap = 0; toggleZoom(p); return; }
          lastTap = now; tapX = p.x; tapY = p.y;
        }
        return;
      }
      if (!P.zoomed() && canSwipe()) {
        if (e.type === 'pointerup' && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.2) { step(dx < 0 ? 1 : -1); return; }
        P.x = 0; apply(true);
      }
    }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('dblclick', function (e) { if (P.ready) toggleZoom(rel(e)); });
    el.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (!P.ready) return;
      activate(P);
      var unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      // a trackpad's two-finger scroll moves a zoomed photo; a wheel or a pinch zooms
      if (!e.ctrlKey && P.zoomed() && e.deltaX !== 0) { P.x -= e.deltaX * unit; P.y -= e.deltaY * unit; clamp(); apply(false); return; }
      var r = rel(e);
      P.zoomAt(Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0022)), r.x, r.y, false);
    }, { passive: false });
    return P;
  }

  function tool(act2, icon, key, cls, toggle) {
    var l = t(key);
    return '<button type="button" class="v-vw-btn' + (cls ? ' ' + cls : '') + '" data-vw="' + act2 + '" title="' + esc(l) + '" aria-label="' + esc(l) + '"' +
      (toggle ? ' aria-pressed="false"' : '') + '>' + ico(icon) + '</button>';
  }
  function build() {
    root = d.createElement('div');
    root.className = 'v-vw' + (ctx.pub ? ' pub' : '');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', ctx.title || t('vwPhotos'));
    root.innerHTML =
      '<header class="v-vw-top">' +
        '<div class="v-vw-title"><b>' + esc(ctx.title || '') + '</b><small></small></div>' +
        '<div class="v-vw-tools">' +
          tool('out', 'zout', 'vwZoomOut', 'z') + '<span class="v-vw-pct z"></span>' + tool('in', 'zin', 'vwZoomIn', 'z') + tool('fit', 'fit', 'vwFit', 'z') +
          '<i class="v-vw-sep z"></i>' +
          tool('rot', 'rot', 'vwRotate') + tool('enh', 'enh', 'vwEnhance', '', true) + tool('cmp', 'cmp', 'vwCompare', '', true) +
          (ctx.pub ? '' : tool('info', 'info', 'vwNotes', 'm', true)) +
          '<a class="v-vw-btn" data-vw="orig" target="_blank" rel="noopener" title="' + esc(t('vwOriginal')) + '" aria-label="' + esc(t('vwOriginal')) + '">' + ico('ext') + '</a>' +
          '<i class="v-vw-sep"></i>' + tool('close', 'x', 'close') +
        '</div>' +
      '</header>' +
      '<div class="v-vw-main">' +
        '<div class="v-vw-stage"><div class="v-vw-panes"></div>' +
          '<button type="button" class="v-vw-nav prev" data-vw="prev" aria-label="' + esc(t('vwPrev')) + '">' + ico('left') + '</button>' +
          '<button type="button" class="v-vw-nav next" data-vw="next" aria-label="' + esc(t('vwNext')) + '">' + ico('right') + '</button>' +
          '<p class="v-vw-hint" aria-hidden="true"></p>' +
        '</div>' +
        (ctx.pub ? '' : '<aside class="v-vw-side" aria-live="polite"></aside>') +
      '</div>' +
      '<nav class="v-vw-strip" aria-label="' + esc(t('vwStrip')) + '">' + strip() + '</nav>' +
      (fine ? '<p class="v-vw-keys">' + esc(t('vwKeys')) + '</p>' : '');
    root.addEventListener('click', onClick);
  }
  function strip() {
    var mk = marks(ctx.check, photos.length);
    return photos.map(function (p, i) {
      return '<button type="button" class="v-vw-th' + (p.kind === 'extra' ? ' extra' : '') + '" data-i="' + i + '" aria-label="' + esc(t('vwCount', { n: i + 1, total: photos.length }) + ': ' + label(p)) + '">' +
        '<img src="' + esc(thumb(p)) + '" alt="" loading="lazy"/><b>' + (i + 1) + '</b><span>' + esc(label(p)) + '</span>' +
        (mk[i] ? '<em class="v-dot ' + mk[i] + '"></em>' : '') + '</button>';
    }).join('');
  }

  // Everything that follows the photo in focus: title line, buttons, strip, notes.
  function refresh() {
    if (!root) return;
    var P = panes[act], p = photos[P.i];
    root.querySelector('.v-vw-title small').textContent = t('vwCount', { n: P.i + 1, total: photos.length }) + ' · ' + label(p) + (ctx.id ? ' · #' + ctx.id : '');
    root.querySelector('[data-vw="orig"]').href = p.url;
    root.classList.toggle('cmp', cmp);
    root.classList.toggle('one', photos.length < 2);
    root.querySelector('[data-vw="cmp"]').setAttribute('aria-pressed', String(cmp));
    root.querySelector('[data-vw="cmp"]').disabled = photos.length < 2;
    panes.forEach(function (q, k) { q.el.classList.toggle('act', k === act); });
    var other = cmp ? panes[1 - act].i : -1;
    [].forEach.call(root.querySelectorAll('.v-vw-th'), function (b) {
      var i = +b.getAttribute('data-i');
      b.classList.toggle('on', i === P.i);
      b.classList.toggle('on2', i === other && i !== P.i);
      if (i === P.i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    var on = root.querySelector('.v-vw-th.on');
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    pct();
    side();
  }
  function pct() {
    if (!root) return;
    var P = panes[act];
    root.querySelector('.v-vw-pct').textContent = P ? P.pct() : '';
  }
  function side() {
    if (!root || ctx.pub) return;
    var P = panes[act], i = P.i, p = photos[i], sz = sizes[i];
    var c = ctx.check, r = c && c.status === 'done' && c.result, list = notes(c, i + 1);
    var html = '<section class="v-vw-sec"><small class="v-vw-k">' + esc(t('vwCount', { n: i + 1, total: photos.length })) + '</small>' +
      '<h3>' + esc(label(p)) + '</h3>' +
      (p.kind === 'extra' ? '<p><span class="v-chip gold">' + esc(t('kind_extra')) + '</span></p>' : '') +
      (sz ? '<p class="v-vw-res">' + esc(t('vwRes', { w: S.num(sz.w), h: S.num(sz.h) })) + '</p>' +
        (Math.max(sz.w, sz.h) < 1000 ? '<p class="v-vw-low">' + S.ico('alert') + '<span>' + esc(t('vwLowRes')) + '</span></p>' : '') : '') +
      '</section>' +
      '<section class="v-vw-sec"><h4>' + S.ico('sparkle') + esc(t('vwNotesT')) + '</h4>';
    if (!r) html += '<p class="v-note">' + esc(t('vwNoCheck')) + '</p>';
    else if (!list.length) html += '<p class="v-note">' + esc(t('vwNoNotes')) + '</p>';
    else {
      html += '<ul class="v-vw-notes">' + list.map(function (x) {
        var head = x.kind === 'flag'
          ? '<b>' + esc(t('vwFlag')) + '</b>'
          : '<b>' + esc(t('ar_' + x.area)) + '</b> <span class="v-chip ' + (x.kind === 'not_visible' ? '' : TONE[x.kind]) + '">' + esc(t('cs_' + x.kind)) + '</span>';
        return '<li class="' + TONE[x.kind] + '">' + head + '<p>' + esc(x.text) + '</p></li>';
      }).join('') + '</ul>';
    }
    if (r) {
      html += '<p class="v-vw-verdict"><span class="v-chip ' + ({ authentic: 'ok', likely_authentic: 'ok', inconclusive: 'warn' }[r.verdict] || 'bad') + '">' + esc(t('vd_' + r.verdict)) + '</span> ' +
        esc(t('lcConf', { n: r.confidence })) + '</p>';
    }
    html += '</section>';
    if (cmp) html += '<p class="v-vw-pick">' + esc(t('vwPick')) + '</p>';
    root.querySelector('.v-vw-side').innerHTML = html;
  }
  function hint() {
    var h = root && root.querySelector('.v-vw-hint');
    if (!h || fine) return;
    h.textContent = t('vwTouch');
    h.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { h.classList.remove('show'); }, 3600);
  }

  function activate(P) {
    var k = panes.indexOf(P);
    if (k === -1 || k === act) return;
    act = k;
    refresh();
  }
  function step(dir) {
    var P = panes[act], n = photos.length;
    if (n < 2) return;
    P.show((P.i + dir + n) % n);
    preload(P.i);
    refresh();
  }
  function pick(i) {
    panes[act].show(i);
    preload(i);
    refresh();
  }
  function preload(i) {
    [i - 1, i + 1].forEach(function (j) {
      var p = photos[(j + photos.length) % photos.length];
      if (p && p.kind !== 'extra') { var im = new Image(); im.src = p.url; }   // a private photo is never cached
    });
  }
  // The photo that is best looked at next to photo i.
  function partner(i) {
    var want = { size_tag: 'box_label', box_label: 'size_tag', side_out: 'side_in', side_in: 'side_out', toe: 'heel', heel: 'toe' }[photos[i].kind];
    for (var j = 0; want && j < photos.length; j++) if (j !== i && photos[j].kind === want) return j;
    return (i + 1) % photos.length;
  }
  function setCompare(on) {
    if (on === cmp || photos.length < 2) return;
    cmp = on;
    if (on) {
      var A = panes[0];
      var B = makePane();
      panes = [A, B];
      act = 1;
      root.classList.add('cmp');
      B.show(partner(A.i));
    } else {
      var keep = panes[act], drop = panes[1 - act];
      drop.el.remove();
      panes = [keep];
      act = 0;
      root.classList.remove('cmp');
    }
    refresh();
    requestAnimationFrame(function () { panes.forEach(function (q) { q.layout(true, false); }); });
  }
  function toggle(name, on) {
    var b = root.querySelector('[data-vw="' + name + '"]');
    var v = on == null ? b.getAttribute('aria-pressed') !== 'true' : on;
    b.setAttribute('aria-pressed', String(v));
    return v;
  }

  function onClick(e) {
    var th = e.target.closest('.v-vw-th');
    if (th) { pick(+th.getAttribute('data-i')); return; }
    var b = e.target.closest('[data-vw]');
    if (!b) return;
    var P = panes[act], a = b.getAttribute('data-vw');
    if (a === 'orig') return;                         // a link: opens the original in a new tab
    if (a === 'close') close();
    else if (a === 'prev') step(-1);
    else if (a === 'next') step(1);
    else if (a === 'in') P.zoomAt(1.5, 0, 0, true);
    else if (a === 'out') P.zoomAt(1 / 1.5, 0, 0, true);
    else if (a === 'fit') P.fitNow();
    else if (a === 'rot') P.rotate();
    else if (a === 'enh') root.classList.toggle('enh', toggle('enh'));
    else if (a === 'cmp') setCompare(!cmp);
    else if (a === 'info') root.classList.toggle('notes', toggle('info'));
  }
  function onKey(e) {
    if (!root) return;
    if (e.key === 'Tab') { trap(e); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var P = panes[act], k = e.key, c = e.code, done = true;
    if (k === 'Escape') close();
    else if (k === 'ArrowLeft') step(-1);
    else if (k === 'ArrowRight') step(1);
    else if (k === '+' || k === '=' || c === 'NumpadAdd') P.zoomAt(1.5, 0, 0, true);
    else if (k === '-' || k === '_' || c === 'NumpadSubtract') P.zoomAt(1 / 1.5, 0, 0, true);
    else if (k === '0' || c === 'Numpad0') P.fitNow();
    else if (c === 'KeyR') P.rotate();
    else if (c === 'KeyE') root.classList.toggle('enh', toggle('enh'));
    else if (c === 'KeyC') setCompare(!cmp);
    else if (c === 'KeyI' && !ctx.pub) root.classList.toggle('notes', toggle('info'));
    else if (cmp && (k === '1' || k === '2')) activate(panes[+k - 1]);
    else done = false;
    if (done) { e.preventDefault(); e.stopPropagation(); }
  }
  function trap(e) {
    var f = [].filter.call(root.querySelectorAll('button, a[href]'), function (x) { return x.offsetParent !== null && !x.disabled; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (!root.contains(d.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  var resizeRaf = 0;
  function onResize() {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(function () { panes.forEach(function (q) { q.layout(true, false); }); });
  }
  function onPop() { if (root) { pushed = false; close(); } }

  function open(o) {
    if (root) close();
    photos = (o && o.photos || []).slice();
    if (!photos.length) return;
    ctx = o; rots = {}; sizes = {}; panes = []; act = 0; cmp = false;
    lastFocus = d.activeElement;
    build();
    d.body.appendChild(root);
    d.documentElement.classList.add('v-vw-lock');
    panes.push(makePane());
    var i = Math.min(photos.length - 1, Math.max(0, (o.index | 0)));
    panes[0].show(i);
    preload(i);
    refresh();
    requestAnimationFrame(function () { if (root) root.classList.add('open'); });
    var x = root.querySelector('[data-vw="close"]');
    try { x.focus({ preventScroll: true }); } catch (e) { x.focus(); }
    d.addEventListener('keydown', onKey, true);
    w.addEventListener('resize', onResize);
    // on a phone, Back closes the viewer instead of leaving the console
    try { w.history.pushState({ slvViewer: 1 }, ''); pushed = true; } catch (e) { pushed = false; }
    w.addEventListener('popstate', onPop);
    hint();
  }
  function close() {
    if (!root) return;
    var at = panes[act] ? panes[act].i : 0, done = ctx && ctx.onClose;
    d.removeEventListener('keydown', onKey, true);
    w.removeEventListener('resize', onResize);
    w.removeEventListener('popstate', onPop);
    clearTimeout(hintTimer);
    root.remove();
    root = null; panes = [];
    d.documentElement.classList.remove('v-vw-lock');
    if (pushed) { pushed = false; try { w.history.back(); } catch (e) {} }
    if (lastFocus && lastFocus.focus && d.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
    if (typeof done === 'function') { try { done(at); } catch (e) {} }
  }

  w.SLVViewer = { open: open, close: close, isOpen: function () { return !!root; }, marks: marks, linkRefs: linkRefs, refs: refs };
})(window, document);
