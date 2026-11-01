/* ShoeLab Vault — certificates of the Legit Check, and the apps they live on.
 *
 * SLVCert.image(c)       → Promise<Blob>: a 1080×1350 certificate picture an
 *                          owner adds as the last photo of their listing on
 *                          Vinted, Kleinanzeigen, eBay … (links are often not
 *                          allowed there; a photo with a number always is).
 * SLVCert.give(blob, n)  → shares the picture (phones) or saves it.
 * SLVCert.platform(url)  → the app a pasted link belongs to, for the form.
 * SLVCert.url(code)      → the public page of a certificate.
 * Drawn on a canvas in the page's language, with the pair's own photo. */
(function (w, d) {
  'use strict';
  var S = w.SLV;
  var SITE = 'shoelabonline.de';

  var PLATFORMS = [
    [/(^|\.)vinted\./, 'Vinted'], [/(^|\.)(ebay-)?kleinanzeigen\.de$/, 'Kleinanzeigen'], [/(^|\.)ebay\./, 'eBay'],
    [/(^|\.)depop\.com$/, 'Depop'], [/(^|\.)grailed\.com$/, 'Grailed'], [/(^|\.)stockx\.com$/, 'StockX'],
    [/(^|\.)goat\.com$/, 'GOAT'], [/(^|\.)(facebook|fb)\.(com|me)$/, 'Facebook'], [/(^|\.)instagram\.com$/, 'Instagram'],
    [/(^|\.)klekt\.com$/, 'KLEKT'], [/(^|\.)restocks\.(net|eu|com)$/, 'Restocks'], [/(^|\.)wethenew\.com$/, 'Wethenew'],
    [/(^|\.)sneakit\.com$/, 'Sneakit'], [/(^|\.)vestiairecollective\.com$/, 'Vestiaire Collective'],
    [/(^|\.)zalando\./, 'Zalando'], [/(^|\.)tiktok\.com$/, 'TikTok'], [/(^|\.)shpock\.com$/, 'Shpock'],
    [/(^|\.)willhaben\.at$/, 'willhaben'], [/(^|\.)marktplaats\.nl$/, 'Marktplaats'], [/(^|\.)leboncoin\.fr$/, 'leboncoin'],
    [/(^|\.)wallapop\.com$/, 'Wallapop'], [/(^|\.)subito\.it$/, 'Subito'], [/(^|\.)olx\./, 'OLX'], [/(^|\.)avito\.ru$/, 'Avito']
  ];
  // the first web address in a shared text ("Look at this on Vinted: https://…")
  function firstUrl(text) {
    var m = /https?:\/\/[^\s<>"']+/i.exec(String(text || ''));
    return m ? m[0].replace(/[).,!?]+$/, '') : '';
  }
  function platform(url) {
    var host = '';
    try { host = new URL(url).hostname.toLowerCase(); } catch (e) { return null; }
    for (var i = 0; i < PLATFORMS.length; i++) if (PLATFORMS[i][0].test(host)) return PLATFORMS[i][1];
    return host.replace(/^www\./, '') || null;
  }
  function certUrl(code) { return 'https://' + SITE + '/verified.html?c=' + encodeURIComponent(code); }

  /* ── the picture ────────────────────────────────────────────────────── */
  function loadImg(src) {
    return new Promise(function (resolve) {
      if (!src) { resolve(null); return; }
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = function () { resolve(null); };
      im.src = src;
    });
  }
  function fontsReady() {
    if (!d.fonts || !d.fonts.load) return Promise.resolve();
    return Promise.all([d.fonts.load('400 80px "Bebas Neue"'), d.fonts.load('500 30px Inter'), d.fonts.load('600 30px Inter')])
      .then(function () {}, function () {});
  }
  function rr(x, c, a, b, wd, ht, r) {
    x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + wd, b, a + wd, b + ht, r); x.arcTo(a + wd, b + ht, a, b + ht, r);
    x.arcTo(a, b + ht, a, b, r); x.arcTo(a, b, a + wd, b, r); x.closePath();
  }
  // wraps text into at most n lines of width maxW, ellipsis on the last
  function lines(x, text, maxW, n) {
    var words = String(text).split(/\s+/), out = [], cur = '';
    words.forEach(function (wd) {
      var test = cur ? cur + ' ' + wd : wd;
      if (x.measureText(test).width <= maxW || !cur) cur = test; else { out.push(cur); cur = wd; }
    });
    if (cur) out.push(cur);
    if (out.length > n) {
      out = out.slice(0, n);
      var last = out[n - 1];
      while (last.length && x.measureText(last + '…').width > maxW) last = last.slice(0, -1);
      out[n - 1] = last + '…';
    }
    return out;
  }
  function image(c) {
    var t = S.t, W = 1080, H = 1350;
    return Promise.all([fontsReady(), loadImg(c.photo), loadImg('/img/shoelab-logo-320.png')]).then(function (r) {
      var photo = r[1], logo = r[2];
      var cv = d.createElement('canvas');
      cv.width = W; cv.height = H;
      var x = cv.getContext('2d');
      // ground: near black, a warm gold glow, a thin gold frame
      x.fillStyle = '#0a0a0a'; x.fillRect(0, 0, W, H);
      var g = x.createRadialGradient(W / 2, 330, 40, W / 2, 330, 760);
      g.addColorStop(0, 'rgba(212,175,55,0.22)'); g.addColorStop(1, 'rgba(212,175,55,0)');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      var gold = x.createLinearGradient(0, 0, W, H);
      gold.addColorStop(0, '#f6e27a'); gold.addColorStop(0.4, '#d4af37'); gold.addColorStop(0.65, '#a8841f'); gold.addColorStop(1, '#f3d77a');
      x.strokeStyle = gold; x.lineWidth = 3; rr(x, null, 28, 28, W - 56, H - 56, 34); x.stroke();
      // brand line
      if (logo) { x.save(); rr(x, null, 72, 70, 76, 76, 18); x.clip(); x.drawImage(logo, 72, 70, 76, 76); x.restore(); }
      x.fillStyle = '#ffffff'; x.font = '400 54px "Bebas Neue", Impact, sans-serif'; x.textBaseline = 'middle';
      x.fillText('SHOE', 170, 110);
      var wShoe = x.measureText('SHOE').width;
      x.fillStyle = '#e11d2a'; x.fillText('LAB', 170 + wShoe, 110);
      var wLab = x.measureText('LAB').width;
      x.fillStyle = gold; x.fillText(' LEGIT CHECK', 170 + wShoe + wLab, 110);
      // the verdict
      x.fillStyle = gold; x.beginPath(); x.arc(W / 2, 250, 52, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#0a0a0a'; x.lineWidth = 11; x.lineCap = 'round'; x.lineJoin = 'round';
      x.beginPath(); x.moveTo(W / 2 - 23, 251); x.lineTo(W / 2 - 5, 270); x.lineTo(W / 2 + 26, 233); x.stroke();
      x.textAlign = 'center'; x.fillStyle = '#ffffff'; x.font = '400 92px "Bebas Neue", Impact, sans-serif';
      x.fillText(t('certVerified').toUpperCase(), W / 2, 368);
      // the pair's own photo
      var px = 80, py = 430, pw = W - 160, ph = 520;
      x.save(); rr(x, null, px, py, pw, ph, 26); x.clip();
      x.fillStyle = '#1a1a1a'; x.fillRect(px, py, pw, ph);
      if (photo) {
        var sc = Math.max(pw / photo.naturalWidth, ph / photo.naturalHeight);
        var dw = photo.naturalWidth * sc, dh = photo.naturalHeight * sc;
        x.drawImage(photo, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh);
      }
      x.restore();
      x.strokeStyle = 'rgba(255,255,255,0.14)'; x.lineWidth = 2; rr(x, null, px, py, pw, ph, 26); x.stroke();
      // what it is
      x.fillStyle = '#ffffff'; x.font = '600 46px Inter, Arial, sans-serif';
      var tl = lines(x, c.title, W - 180, 2);
      tl.forEach(function (ln, i) { x.fillText(ln, W / 2, 1010 + i * 56); });
      var y = 1010 + tl.length * 56;
      x.fillStyle = '#a8a8a8'; x.font = '500 32px Inter, Arial, sans-serif';
      x.fillText('EU ' + c.size + '  ·  ' + t('certChecked', { date: S.fmtDate(c.checkedAt) }), W / 2, y + 6);
      // the number, the thing a buyer types in
      x.fillStyle = gold; x.font = '400 78px "Bebas Neue", Impact, sans-serif';
      x.fillText(c.code, W / 2, y + 96);
      x.fillStyle = '#d4d4d4'; x.font = '500 30px Inter, Arial, sans-serif';
      x.fillText(t('certCheckAt', { site: SITE + '/verified' }), W / 2, H - 92);
      return new Promise(function (resolve) { cv.toBlob(function (b) { resolve(b); }, 'image/png'); });
    });
  }

  // On a phone: the share sheet, straight into Vinted, WhatsApp … Otherwise: a download.
  function give(blob, name, preferShare) {
    var file = null;
    try { file = new File([blob], name, { type: 'image/png' }); } catch (e) {}
    if (preferShare && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file] }).then(function () { return 'shared'; }, function (e) {
        return e && e.name === 'AbortError' ? 'cancelled' : save(blob, name);
      });
    }
    return Promise.resolve(save(blob, name));
  }
  function save(blob, name) {
    var u = URL.createObjectURL(blob), a = d.createElement('a');
    a.href = u; a.download = name; d.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 4000);
    return 'saved';
  }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
    return Promise.resolve(fallback());
    function fallback() {
      var ta = d.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      d.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = d.execCommand('copy'); } catch (e) {}
      ta.remove();
      return ok;
    }
  }

  w.SLVCert = { image: image, give: give, copy: copy, platform: platform, firstUrl: firstUrl, url: certUrl, site: SITE };
})(window, document);
