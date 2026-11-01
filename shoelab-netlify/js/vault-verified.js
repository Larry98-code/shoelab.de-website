/* ShoeLab Vault — a Legit Check certificate (verified.html?c=SL-XXXX-XXXX).
 * Anyone can look a number up: a buyer on Vinted typing it from the picture
 * in a listing, or someone following the link. The page shows the pair the
 * lab checked (zoomable photos), when, and on which app it was listed; or
 * plainly that the number is unknown, hidden by its owner, or withdrawn. */
(function (w, d) {
  'use strict';
  var S = w.SLV, t = S.t, esc = S.esc, C = w.SLVCert;
  var $ = function (id) { return d.getElementById(id); };
  var cert = null, asked = '';

  function codeFromUrl() {
    try { return (new URLSearchParams(w.location.search).get('c') || '').trim(); } catch (e) { return ''; }
  }
  function show(code) {
    asked = code;
    $('cfCode').value = code;
    if (!code) { $('cfBody').innerHTML = ''; return; }
    $('cfBody').innerHTML = '<div class="v-cert-wait"><span class="v-lc-spin"></span></div>';
    S.api('/api/market/legit/cert?c=' + encodeURIComponent(code)).then(function (res) {
      if (asked !== code) return;
      if (!res.ok) { cert = null; state('bad', 'x', 'certUnknownT', t('certUnknownP')); return; }
      cert = res.data;
      if (cert.revoked) { state('bad', 'alert', 'certRevokedT', t('certRevokedP', { code: cert.code })); return; }
      if (cert.hidden) { state('warn', 'lock', 'certHiddenT', t('certHiddenP', { code: cert.code })); return; }
      render();
    });
  }
  function state(kind, icon, tk, text) {
    $('cfBody').innerHTML = '<div class="v-cert-state ' + kind + '">' + S.ico(icon) + '<div><h2>' + esc(t(tk)) + '</h2><p>' + esc(text) + '</p></div></div>';
  }
  function render() {
    var c = cert, first = c.photos[0];
    var link = c.link ? '<a href="' + esc(c.link) + '" target="_blank" rel="noopener noreferrer nofollow ugc">' + esc(t('certListedOn', { app: c.platform || C.platform(c.link) || '' })) + ' ↗</a>' : '';
    $('cfBody').innerHTML =
      '<article class="v-cert">' +
        '<header class="v-cert-head">' +
          '<span class="v-cert-seal">' + S.ico('check') + '</span>' +
          '<div><p class="v-eyebrow" style="margin:0;">' + esc(t('lgEyebrow')) + '</p>' +
            '<h2>' + esc(t('certVerified')) + '</h2>' +
            '<p class="v-cert-code">' + esc(c.code) + '</p></div>' +
        '</header>' +
        '<div class="v-cert-grid">' +
          '<div class="v-cert-photos">' + c.photos.map(function (p, i) {
            var label = t('kind_' + p.kind);
            return '<button type="button" class="v-rp-tile" data-cv="' + i + '" aria-label="' + esc(t('vwCount', { n: i + 1, total: c.photos.length }) + ': ' + label) + '">' +
              '<img src="' + esc(p.url) + '&amp;s=t" alt="" loading="lazy"/><b>' + (i + 1) + '</b><span>' + esc(label) + '</span><i>' + S.ico('search') + '</i></button>';
          }).join('') + '</div>' +
          '<div class="v-cert-info">' +
            '<h3>' + esc(c.title) + '</h3>' +
            '<dl class="v-kv">' +
              '<dt>' + esc(t('fSize')) + '</dt><dd>EU ' + esc(c.size) + '</dd>' +
              '<dt>' + esc(t('certCheckedOn')) + '</dt><dd>' + esc(S.fmtDate(c.checkedAt)) + '</dd>' +
              '<dt>' + esc(t('certBy')) + '</dt><dd>' + esc(t('certByLab')) + '</dd>' +
              (link ? '<dt>' + esc(t('certListing')) + '</dt><dd>' + link + '</dd>' : '') +
            '</dl>' +
            '<div class="v-state info">' + S.ico('info') + '<div><b>' + esc(t('certMeansT')) + '</b> ' + esc(t('certMeans')) + '</div></div>' +
            '<div class="v-btn-row v-cert-acts">' +
              '<button type="button" class="v-btn gold sm" data-cert="share">' + S.ico('upload') + esc(t('certShareImg')) + '</button>' +
              '<button type="button" class="v-btn ghost sm" data-cert="copy">' + esc(t('certCopyLink')) + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</article>';
    if (first) d.title = t('certVerified') + ' · ' + c.title + ' — ShoeLab';
  }

  function onClick(e) {
    var tile = e.target.closest('[data-cv]');
    if (tile && cert && w.SLVViewer) {
      w.SLVViewer.open({ photos: cert.photos, index: +tile.getAttribute('data-cv'), title: cert.title + ' · ' + cert.code, check: null });
      return;
    }
    var b = e.target.closest('[data-cert]');
    if (!b || !cert) return;
    var what = b.getAttribute('data-cert');
    if (what === 'copy') {
      C.copy(C.url(cert.code)).then(function (ok) { S.toast(t(ok ? 'certCopied' : 'certCopyFail'), ok ? 'ok' : 'bad'); });
      return;
    }
    S.busy(b, true);
    C.image({ code: cert.code, title: cert.title, size: cert.size, checkedAt: cert.checkedAt, photo: cert.photos[0] && cert.photos[0].url })
      .then(function (blob) { return C.give(blob, 'ShoeLab-' + cert.code + '.png', true); })
      .then(function (how) { S.busy(b, false); if (how === 'saved') S.toast(t('certSaved'), 'ok'); },
        function () { S.busy(b, false); S.toast(t('certImgFail'), 'bad'); });
  }

  S.boot({
    key: 'legit',
    title: 'pageVerified',
    init: function () {
      $('cfForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var code = $('cfCode').value.trim();
        if (!code) { $('cfCode').focus(); return; }
        try { w.history.replaceState(null, '', '/verified.html?c=' + encodeURIComponent(code)); } catch (x) {}
        show(code);
      });
      $('cfBody').addEventListener('click', onClick);
      show(codeFromUrl());
    },
    onLang: function () { if (cert && !cert.revoked && !cert.hidden) render(); else if (asked) show(asked); }
  });
})(window, document);
