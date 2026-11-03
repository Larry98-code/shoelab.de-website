/* ShoeLab Vault — the admin tools of the lab console (vault-lab.html).
 *
 *   Members    search, filters, a full profile per member, and every measure:
 *              message, warn, limit buying or selling, hide listings, suspend,
 *              close, reinstate, sign out everywhere, delete
 *   Listings   every listing in any state: hide, show, remove, correct details
 *   Orders     "All orders" next to the console's own queue, and on every
 *              order: refund (in full or in part), cancel, hold or release
 *              the payout, notes
 *   Reports    what members and visitors reported, decided with an answer
 *   Activity   who did what, when and why
 *   Controls   pause new listings, all trading, or new accounts
 *
 * vault-lab.js draws the tabs and calls SLVAdmin.show(tab, element); the
 * server (functions/_shared/admin.js) checks every action again. */
(function (w, d) {
  'use strict';
  var S = w.SLV, t = S.t, esc = S.esc, money = S.money;
  var REASONS = ['counterfeit', 'misleading', 'nonpayment', 'nonshipment', 'fraud', 'offplatform', 'abuse', 'prohibited', 'multiple', 'terms', 'other'];
  var DURATIONS = [1, 3, 7, 14, 30, 90, 0];
  var PAID = ['paid', 'to_lab', 'in_lab', 'verified', 'shipped', 'delivered', 'disputed'];
  var EARLY = ['awaiting_payment', 'paid', 'to_lab', 'in_lab', 'verified'];

  var pane = null, tab = null, memberId = null;
  var q = {
    members: { q: '', f: 'all', page: 1 }, listings: { q: '', f: 'live', page: 1 },
    orders: { q: '', f: 'open', page: 1 }, reports: { f: 'open' }, log: { page: 1 }
  };
  var data = {}, orders = {};      // the last answers; every order seen, by id
  var searchTimer = null, seq = 0;

  /* ── small pieces ───────────────────────────────────────────────────── */
  function stat(label, value, tone) { return '<div class="v-stat' + (tone ? ' ' + tone : '') + '"><small>' + esc(label) + '</small><b>' + value + '</b></div>'; }
  function chip(text, tone) { return '<span class="v-chip ' + (tone || '') + '">' + esc(text) + '</span>'; }
  function empty(icon, text) { return '<div class="v-empty sm">' + S.ico(icon) + '<p>' + esc(text) + '</p></div>'; }
  function loading() { return '<div class="adm-loading"><span class="spin" aria-hidden="true"></span></div>'; }
  function avatar(name, id) {
    var hue = ((id || 0) * 47) % 360;
    return '<span class="adm-av" style="background:hsl(' + hue + ',32%,26%)">' + esc(S.initials(name || '?')) + '</span>';
  }
  function memberLink(u, label) {
    return u && u.id ? '<a href="#members/' + u.id + '" data-adm-member="' + u.id + '">' + esc(label || u.name || ('#' + u.id)) + '</a>' : esc(label || '—');
  }
  function when(iso) { return iso ? S.fmtShort(iso) : '—'; }
  function untilText(v) { return !v || v === 'open' ? t('adForever') : S.fmtDate(v); }
  function filterBar(kind, keys, counts, prefix) {
    return '<div class="adm-filters" role="tablist">' + keys.map(function (k) {
      var on = q[kind].f === k;
      return '<button type="button" role="tab" aria-selected="' + on + '" class="adm-f' + (on ? ' on' : '') + '" data-adm-f="' + kind + ':' + k + '">' +
        esc(t(prefix + k)) + (counts && counts[k] != null ? '<span>' + S.num(counts[k]) + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function searchBox(kind, ph) {
    return '<label class="adm-search">' + S.ico('search') + '<input type="search" class="v-input" data-adm-q="' + kind + '" value="' + esc(q[kind].q) +
      '" placeholder="' + esc(t(ph)) + '" aria-label="' + esc(t(ph)) + '"/></label>';
  }
  function pager(kind, r) {
    if (!r || r.pages <= 1) return '';
    return '<div class="adm-pager"><button type="button" class="v-btn ghost sm" data-adm-page="' + kind + ':' + (r.page - 1) + '"' + (r.page <= 1 ? ' disabled' : '') + '>' + esc(t('adPrev')) + '</button>' +
      '<span>' + esc(t('adPage', { n: r.page, total: r.pages })) + '</span>' +
      '<button type="button" class="v-btn ghost sm" data-adm-page="' + kind + ':' + (r.page + 1) + '"' + (r.page >= r.pages ? ' disabled' : '') + '>' + esc(t('adNext')) + '</button></div>';
  }
  function standingChips(s, staff) {
    var out = [];
    if (staff) out.push(chip(t('adStaff'), 'gold'));
    if (s.status === 'suspended') out.push(chip(t('adS_suspended'), 'warn'));
    else if (s.status === 'banned') out.push(chip(t('adS_banned'), 'bad'));
    else if (s.status === 'deleted') out.push(chip(t('adS_deleted'), ''));
    if (s.noSell) out.push(chip(t('adS_noSell'), 'warn'));
    if (s.noBuy) out.push(chip(t('adS_noBuy'), 'warn'));
    if (s.hidden) out.push(chip(t('adS_hidden'), 'warn'));
    return out.join('');
  }
  function get(route) { return S.market(route); }
  function post(route, body) { return S.market(route, { body: body }); }
  function failed(res) { S.toast(S.errText(res), 'bad'); }

  /* ── the dialogs ────────────────────────────────────────────────────── */
  function reasonSelect(withRequest) {
    return '<label class="v-label" for="admReason">' + esc(t('adReason')) + '</label><select class="v-select" id="admReason"><option value="">' + esc(t('adReasonPick')) + '</option>' +
      (withRequest ? ['request'] : []).concat(REASONS).map(function (k) { return '<option value="' + k + '">' + esc(t('rs_' + k)) + '</option>'; }).join('') + '</select>';
  }
  function durationSelect(def) {
    return '<label class="v-label" for="admDays">' + esc(t('adDuration')) + '</label><select class="v-select" id="admDays">' + DURATIONS.map(function (n) {
      return '<option value="' + n + '"' + (n === def ? ' selected' : '') + '>' + esc(n === 0 ? t('adForever') : n === 1 ? t('adDay1') : t('adDays', { n: n })) + '</option>';
    }).join('') + '</select>';
  }
  function detailsBox(label, ph, rows) {
    return '<label class="v-label" for="admDetails">' + esc(t(label || 'adDetails')) + '</label><textarea class="v-textarea" id="admDetails" rows="' + (rows || 3) + '" maxlength="1500" placeholder="' + esc(t(ph || 'adDetailsPh')) + '"></textarea>';
  }
  // A form in a dialog; go(values, dialog) returns the request to send.
  function dialog(o) {
    var m = S.modal({
      title: o.title, wide: !!o.wide,
      html: '<div class="adm-form">' + o.html + (o.dsa ? '<p class="adm-dsa">' + S.ico('info') + '<span>' + esc(t('adDsa')) + '</span></p>' : '') + '<p class="v-msg" id="admMsg" role="alert"></p></div>',
      foot: '<button type="button" class="v-btn ghost" data-x>' + esc(t('cancel')) + '</button><button type="button" class="v-btn' + (o.danger ? ' danger' : o.gold ? ' gold' : '') + '" data-go>' + esc(o.goLabel) + '</button>'
    });
    var msg = m.$('#admMsg');
    var bad = function (k, x) { msg.textContent = typeof k === 'string' && S.has(k) ? t(k, x) : k; msg.className = 'v-msg bad'; };
    m.$('[data-x]').addEventListener('click', function () { m.close(); });
    if (o.wire) o.wire(m);
    m.$('[data-go]').addEventListener('click', function () {
      var btn = this;
      var v = {
        reason: m.$('#admReason') ? m.$('#admReason').value : undefined,
        details: m.$('#admDetails') ? m.$('#admDetails').value.trim() : undefined,
        days: m.$('#admDays') ? +m.$('#admDays').value : undefined
      };
      if (m.$('#admReason') && !v.reason) { bad('e_adm_reason'); m.$('#admReason').focus(); return; }
      var req = o.go(v, m, bad);
      if (!req) return;
      S.busy(btn, true);
      post(req[0], req[1]).then(function (res) {
        S.busy(btn, false);
        if (!res.ok) { bad(S.errText(res)); return; }
        m.close(true);
        S.toast(t(o.doneKey || 'adDone'), 'ok');
        if (o.after) o.after(res.data);
        refresh();
      });
    });
    return m;
  }
  function ask(title, text, yes, danger, route, body, doneKey) {
    S.confirm(title, text, yes, danger).then(function (y) {
      if (!y) return;
      post(route, body).then(function (res) {
        if (!res.ok) { failed(res); return; }
        S.toast(t(doneKey || 'adDone'), 'ok');
        refresh();
      });
    });
  }

  /* ── members ────────────────────────────────────────────────────────── */
  var M_FILTERS = ['all', 'flagged', 'sellers', 'buyers', 'limited', 'suspended', 'banned', 'new', 'unverified', 'deleted'];
  function overviewHtml(o) {
    if (!o) return '';
    return '<div class="v-stats adm-stats">' +
      stat(t('adStMembers'), S.num(o.members)) + stat(t('adStNew'), S.num(o.new_week)) + stat(t('adStSellers'), S.num(o.active_sellers)) +
      stat(t('adStReports'), S.num(o.reports), o.reports ? 'warn' : '') + stat(t('adStSuspended'), S.num(o.suspended)) + stat(t('adStBanned'), S.num(o.banned)) +
      stat(t('adStGmv'), money(o.gmv_month)) + stat(t('adStRefunded'), money(o.refunded_month)) +
    '</div>';
  }
  function memberRowHtml(m) {
    var bits = [];
    if (m.live) bits.push(S.num(m.live) + ' ' + t('adLive'));
    if (m.sold) bits.push(S.num(m.sold) + ' ' + t('adSold'));
    if (m.bought) bits.push(S.num(m.bought) + ' ' + t('adBought'));
    if (m.rating != null) bits.push('★ ' + S.num(m.rating) + ' (' + S.num(m.ratings) + ')');
    var flags = [];
    if (m.disputes) flags.push(chip(S.num(m.disputes) + ' ' + t('adDisputes'), 'bad'));
    if (m.reports) flags.push(chip(S.num(m.reports) + ' ' + t('adReports'), 'bad'));
    if (m.warnings) flags.push(chip(S.num(m.warnings) + ' ' + t('adWarnings'), 'warn'));
    if (!m.verified && m.standing.status !== 'deleted') flags.push(chip(t('adUnconfirmed'), ''));
    return '<button type="button" class="adm-row" data-adm-member="' + m.id + '">' + avatar(m.name, m.id) +
      '<span class="adm-row-main"><b>' + esc(m.name) + '</b><small>' + esc(m.email) + ' · ' + esc(t('adMemberNo', { n: m.id })) + '</small>' +
        '<span class="adm-row-chips">' + standingChips(m.standing, m.staff) + flags.join('') + '</span></span>' +
      '<span class="adm-row-side"><small>' + esc(bits.join(' · ') || '—') + '</small><small>' + esc(m.lastSeen ? t('adSeen', { when: S.ago(m.lastSeen) }) : t('adJoined', { date: S.fmtDate(m.joined) })) + '</small></span>' +
      S.ico('right', 'adm-chev') + '</button>';
  }
  function membersHtml() {
    var r = data.members;
    return overviewHtml(r && r.overview) +
      '<div class="adm-bar">' + searchBox('members', 'adSearchMembers') + '</div>' +
      filterBar('members', M_FILTERS, r && r.counts, 'adF_') +
      (!r ? loading() : r.members.length ? '<div class="adm-list">' + r.members.map(memberRowHtml).join('') + '</div>' + pager('members', r) : empty('user', t('adNoneFound')));
  }

  function kpi(label, value, sub, tone) {
    return '<div class="adm-kpi' + (tone ? ' ' + tone : '') + '"><small>' + esc(label) + '</small><b>' + value + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>';
  }
  function section(title, n, body) {
    return '<section class="adm-sec"><h3>' + esc(title) + (n ? ' <span>' + S.num(n) + '</span>' : '') + '</h3>' + body + '</section>';
  }
  function memberHtml(m) {
    var s = m.standing, a = m.activity || {};
    var standingBox = '';
    if (s.status === 'suspended' || s.status === 'banned' || s.status === 'deleted' || s.noSell || s.noBuy || s.hidden) {
      var lines = [];
      if (s.status === 'suspended') lines.push(s.until ? t('adSuspendedUntil', { date: S.fmtDate(s.until) }) : t('adSuspendedOpen'));
      if (s.status === 'banned') lines.push(t('adS_banned'));
      if (s.status === 'deleted') lines.push(t('adS_deleted'));
      if (s.noSell) lines.push(t('adLimit', { what: t('adS_noSell'), until: untilText(s.noSell) }));
      if (s.noBuy) lines.push(t('adLimit', { what: t('adS_noBuy'), until: untilText(s.noBuy) }));
      if (s.hidden) lines.push(t('adS_hidden'));
      standingBox = '<div class="v-state ' + (s.status === 'banned' || s.status === 'deleted' ? 'bad' : 'warn') + '">' + S.ico('alert') + '<div><b>' + esc(lines.join(' · ')) + '</b>' +
        (s.reason ? ' ' + esc(t('rs_' + s.reason)) : '') + (s.note ? '<br><small>' + esc(s.note) + '</small>' : '') + '</div></div>';
    }
    var gone = s.status === 'deleted', staff = m.staff;
    var btn = function (act, label, cls) { return '<button type="button" class="v-btn sm ' + (cls || 'ghost') + '" data-adm-act="' + act + '">' + esc(t(label)) + '</button>'; };
    var actions = gone ? '' : '<div class="adm-actions">' +
      '<div><small>' + esc(t('adGrpTalk')) + '</small>' + btn('message', 'adActMessage') + btn('warn', 'adActWarn') + btn('note', 'adActNote') + '</div>' +
      (staff ? '' : '<div><small>' + esc(t('adGrpLimit')) + '</small>' +
        (s.noSell || s.noBuy ? btn('unrestrict', 'adActUnrestrict') : btn('restrict', 'adActRestrict')) +
        (s.hidden ? btn('unhide', 'adActUnhide') : btn('hide', 'adActHide')) + '</div>' +
      '<div><small>' + esc(t('adGrpAccount')) + '</small>' +
        (s.status === 'active' ? btn('suspend', 'adActSuspend', 'warn-btn') + btn('ban', 'adActBan', 'danger-ghost') : btn('reinstate', 'adActReinstate', 'ok')) +
        btn('logout', 'adActLogout') + btn('delete', 'adActDelete', 'danger-ghost') + '</div>') +
    '</div>';
    var stripe = m.stripe ? (m.stripe.payouts ? t('adStripeOk') : t('adStripeHalf')) : t('adStripeNone');
    var listings = m.listings.length ? '<div class="adm-mini">' + m.listings.map(function (l) {
      return '<div class="adm-mini-row"><a class="thumb" href="/vault-item.html?id=' + l.id + '" target="_blank" rel="noopener">' + (l.photo ? '<img src="' + esc(l.photo) + '" alt="" loading="lazy"/>' : '') + '</a>' +
        '<span><b>' + esc(l.title) + '</b><small>EU ' + esc(l.size) + ' · #' + l.id + ' · ' + esc(when(l.at)) + '</small></span>' +
        '<span class="adm-mini-side">' + chip(t('st_' + l.status), l.status === 'live' ? 'live' : l.status === 'removed' ? 'bad' : '') + (l.hidden ? chip(t('adHidden'), 'warn') : '') +
          '<b>' + money(l.price) + '</b></span>' +
        '<button type="button" class="v-btn ghost xs" data-adm-lmenu="' + l.id + '">' + esc(t('adManage')) + '</button></div>';
    }).join('') + '</div>' : '<p class="v-note">' + esc(t('adNone')) + '</p>';
    var orderRows = m.orders.length ? '<div class="adm-mini">' + m.orders.map(function (o) {
      return '<div class="adm-mini-row"><span class="adm-ono">#' + o.id + '</span><span><b>' + esc(o.title) + '</b><small>' + esc(t(o.role === 'seller' ? 'adAsSeller' : 'adAsBuyer')) + ' · ' + esc(when(o.at)) + '</small></span>' +
        '<span class="adm-mini-side">' + chip(t('os_' + o.status), '') + (o.refunded ? chip(t('adRefundedN', { amount: money(o.refunded, true) }), 'warn') : '') + '<b>' + money(o.total, true) + '</b></span>' +
        '<button type="button" class="v-btn ghost xs" data-adm-order-open="' + o.id + '">' + esc(t('adOpen')) + '</button></div>';
    }).join('') + '</div>' : '<p class="v-note">' + esc(t('adNone')) + '</p>';
    var reports = m.reportList.length ? '<ul class="adm-log adm-reports">' + m.reportList.map(function (r) {
      return '<li><time>' + esc(when(r.at)) + '</time><span>' + chip(t(r.mine ? 'adReportBy' : 'adReportAbout'), r.mine ? '' : 'bad') + ' ' + esc(t('rp_' + r.reason)) +
        (r.label ? ' · ' + esc(r.label) : '') + ' — ' + esc(r.details || '') + ' ' + chip(t(r.status === 'open' ? 'adRpOpen' : 'adRpDone'), r.status === 'open' ? 'warn' : '') + '</span></li>';
    }).join('') + '</ul>' : '<p class="v-note">' + esc(t('adNone')) + '</p>';
    var tickets = m.tickets.length ? '<ul class="adm-log">' + m.tickets.map(function (k) {
      return '<li><time>' + esc(when(k.at)) + '</time><span>' + esc(k.summary) + ' ' + chip(t('tk_' + k.status), k.status === 'open' ? 'warn' : '') + '</span></li>';
    }).join('') + '</ul>' : '<p class="v-note">' + esc(t('adNone')) + '</p>';
    var feedback = m.feedback.length ? '<ul class="adm-log">' + m.feedback.map(function (f) {
      return '<li><time>' + esc(when(f.at)) + '</time><span>' + '★★★★★'.slice(0, f.rating) + '☆☆☆☆☆'.slice(0, 5 - f.rating) + ' ' + esc(f.comment || '') + ' · #' + f.order + '</span></li>';
    }).join('') + '</ul>' : '<p class="v-note">' + esc(t('adNone')) + '</p>';
    var history = '<div class="adm-note-add"><textarea class="v-textarea" id="admNoteBox" rows="2" maxlength="1500" placeholder="' + esc(t('adNotePh')) + '"></textarea>' +
      '<button type="button" class="v-btn sm" data-adm-act="note-inline">' + esc(t('adDoNote')) + '</button></div>' + logHtml(m.log);
    return '<button type="button" class="adm-back" data-adm-back>' + S.ico('left') + esc(t('adBack')) + '</button>' +
      '<div class="adm-profile">' +
        '<div class="adm-profile-head">' + avatar(m.name, m.id) + '<div><h2>' + esc(m.name) + '</h2>' +
          '<p>' + (gone ? esc(m.email) : '<a href="mailto:' + esc(m.email) + '">' + esc(m.email) + '</a>') + ' · ' + esc(t('adMemberNo', { n: m.id })) + '</p>' +
          '<div class="adm-row-chips">' + (standingChips(s, staff) || chip(t('adS_active'), 'ok')) + (m.verified ? '' : chip(t('adUnconfirmed'), '')) + '</div></div></div>' +
        '<dl class="v-kv adm-facts">' +
          '<dt>' + esc(t('adJoinedL')) + '</dt><dd>' + esc(S.fmtDate(m.joined)) + '</dd>' +
          '<dt>' + esc(t('adSeenL')) + '</dt><dd>' + esc(m.lastSeen ? S.fmtShort(m.lastSeen) : t('adNeverSeen')) + '</dd>' +
          (m.lang ? '<dt>' + esc(t('adLang')) + '</dt><dd>' + esc(m.lang.toUpperCase()) + '</dd>' : '') +
          (m.contact.phone ? '<dt>' + esc(t('adPhone')) + '</dt><dd><a href="tel:' + esc(m.contact.phone) + '">' + esc(m.contact.phone) + '</a></dd>' : '') +
          (m.contact.address ? '<dt>' + esc(t('adAddress')) + '</dt><dd>' + esc(m.contact.address) + '</dd>' : '') +
          '<dt>' + esc(t('adStripe')) + '</dt><dd>' + esc(stripe) + '</dd>' +
        '</dl>' +
      '</div>' +
      standingBox +
      (m.openOrders && !gone ? '<p class="v-note adm-open">' + S.ico('box') + esc(t('adOpenOrdersN', { n: m.openOrders })) + '</p>' : '') +
      actions +
      '<div class="adm-kpis">' +
        kpi(t('adKSold'), S.num(m.sold), money(a.sold_value || 0)) + kpi(t('adKBought'), S.num(m.bought), money(a.bought_value || 0)) +
        kpi(t('adKLive'), S.num(m.live)) + kpi(t('adKBids'), S.num(a.bids || 0)) + kpi(t('adKOffers'), S.num(a.offers || 0)) + kpi(t('adKWatching'), S.num(a.watching || 0)) +
        kpi(t('adKRating'), m.rating != null ? '★ ' + S.num(m.rating) : '—', m.ratings ? S.tn('adRatings', m.ratings) : t('adNoRating')) +
        kpi(t('adKDisputes'), S.num(m.disputes), '', m.disputes ? 'bad' : '') + kpi(t('adKReports'), S.num(m.reports), '', m.reports ? 'bad' : '') +
        kpi(t('adKWarnings'), S.num(m.warnings), '', m.warnings ? 'warn' : '') +
      '</div>' +
      section(t('adSecListings'), m.listings.length, listings) +
      section(t('adSecOrders'), m.orders.length, orderRows) +
      section(t('adSecReports'), m.reportList.length, reports) +
      section(t('adSecTickets'), m.tickets.length, tickets) +
      section(t('adSecFeedback'), m.feedback.length, feedback) +
      section(t('adSecHistory'), 0, history);
  }

  function memberAct(act) {
    var m = data.member;
    if (!m) return;
    var name = S.firstName(m.name) || m.name, body = { id: m.id, action: act };
    var R = 'admin/member';
    if (act === 'message') {
      return dialog({ title: t('adMessageT', { name: name }), goLabel: t('adSend'), doneKey: 'adSent',
        html: '<textarea class="v-textarea" id="admDetails" rows="6" maxlength="3000" placeholder="' + esc(t('adMessagePh')) + '"></textarea>',
        go: function (v, mm, bad) { if (v.details.length < 5) { bad('e_adm_note'); return null; } return [R, { id: m.id, action: 'message', message: v.details }]; } });
    }
    if (act === 'note') {
      return dialog({ title: t('adNoteT'), goLabel: t('adDoNote'), doneKey: 'adNoteSaved',
        html: '<textarea class="v-textarea" id="admDetails" rows="4" maxlength="1500" placeholder="' + esc(t('adNotePh')) + '"></textarea>',
        go: function (v, mm, bad) { if (!v.details) { bad('e_adm_note'); return null; } return [R, { id: m.id, action: 'note', note: v.details }]; } });
    }
    var withReason = function (titleKey, goKey, extra, opts) {
      opts = opts || {};
      return dialog({ title: t(titleKey, { name: name }), goLabel: t(goKey), dsa: true, danger: !!opts.danger, wide: true,
        html: (opts.warn ? '<div class="v-state ' + (opts.danger ? 'bad' : 'warn') + '">' + S.ico('alert') + '<div>' + esc(opts.warn) + '</div></div>' : '') + (opts.top || '') +
          reasonSelect(false) + detailsBox() + (opts.bottom || ''),
        wire: opts.wire,
        go: function (v, mm, bad) {
          if (v.reason === 'other' && v.details.length < 10) { bad('e_adm_details'); return null; }
          var b = Object.assign({ id: m.id, action: act, reason: v.reason, details: v.details }, extra ? extra(v, mm, bad) : {});
          if (b.__stop) return null;
          return [R, b];
        },
        after: opts.after });
    };
    switch (act) {
      case 'warn': return withReason('adWarnT', 'adDoWarn');
      case 'restrict':
        return withReason('adRestrictT', 'adDoRestrict', function (v, mm, bad) {
          var sell = mm.$('#admSell').checked, buy = mm.$('#admBuy').checked;
          if (!sell && !buy) { bad('e_adm_scope'); return { __stop: true }; }
          return { sell: sell, buy: buy, days: v.days };
        }, { top: '<p class="v-label">' + esc(t('adScope')) + '</p><label class="v-check"><input type="checkbox" id="admSell" checked/><span>' + esc(t('adScopeSell')) + '</span></label>' +
            '<label class="v-check"><input type="checkbox" id="admBuy"/><span>' + esc(t('adScopeBuy')) + '</span></label>' + durationSelect(7),
          bottom: '<p class="v-note">' + esc(t('adRestrictBuyWarn')) + '</p>' });
      case 'hide': return withReason('adHideT', 'adDoHide');
      case 'suspend':
        return withReason('adSuspendT', 'adDoSuspend', function (v) { return { days: v.days }; }, { warn: t('adSuspendWarn'), top: durationSelect(7) });
      case 'ban':
        return withReason('adBanT', 'adDoBan', function (v, mm) { return { block: mm.$('#admBlock').checked }; },
          { danger: true, warn: t('adBanWarn') + (m.openOrders ? ' ' + t('adOpenOrdersN', { n: m.openOrders }) : ''),
            bottom: '<label class="v-check"><input type="checkbox" id="admBlock" checked/><span>' + esc(t('adBlock')) + '</span></label>' });
      case 'delete':
        if (m.openOrders) { S.toast(t('adDelOpen', { n: m.openOrders }), 'bad'); return; }
        return dialog({ title: t('adDeleteT', { name: name }), goLabel: t('adDoDelete'), danger: true, wide: true,
          html: '<div class="v-state bad">' + S.ico('alert') + '<div>' + esc(t('adDeleteWarn')) + '</div></div>' + reasonSelect(true) +
            '<div id="admDelWhy" hidden>' + detailsBox() + '</div>' +
            '<label class="v-check"><input type="checkbox" id="admBlock"/><span>' + esc(t('adBlock')) + '</span></label>' +
            '<label class="v-label" for="admConfirm">' + esc(t('adConfirmEmail', { email: m.email })) + '</label><input class="v-input" id="admConfirm" autocomplete="off" spellcheck="false"/>',
          wire: function (mm) {
            mm.$('#admReason').value = 'request';
            mm.$('#admReason').addEventListener('change', function () { mm.$('#admDelWhy').hidden = this.value === 'request'; });
          },
          go: function (v, mm, bad) {
            var c = mm.$('#admConfirm').value.trim();
            if (c.toLowerCase() !== String(m.email).toLowerCase()) { bad('e_adm_confirm'); mm.$('#admConfirm').focus(); return null; }
            return [R, { id: m.id, action: 'delete', reason: v.reason, details: v.details, confirm: c, block: mm.$('#admBlock').checked }];
          } });
      case 'logout': return ask(t('adLogoutT'), t('adLogoutQ', { name: name }), t('adActLogout'), false, R, body);
      case 'reinstate': return ask(t('adReinstateT', { name: name }), t('adReinstateQ', { name: name }), t('adActReinstate'), false, R, body);
      case 'unrestrict': return ask(t('adActUnrestrict'), t('adUnrestrictQ', { name: name }), t('adActUnrestrict'), false, R, body);
      case 'unhide': return ask(t('adActUnhide'), t('adUnhideQ', { name: name }), t('adActUnhide'), false, R, body);
      case 'note-inline': {
        var box = d.getElementById('admNoteBox'), note = box ? box.value.trim() : '';
        if (!note) { if (box) { box.classList.add('err'); box.focus(); } return; }
        post(R, { id: m.id, action: 'note', note: note }).then(function (res) {
          if (!res.ok) { failed(res); return; }
          S.toast(t('adNoteSaved'), 'ok');
          refresh();
        });
        return;
      }
    }
  }

  /* ── listings ───────────────────────────────────────────────────────── */
  var L_FILTERS = ['live', 'review', 'reported', 'hidden', 'sold', 'ended', 'removed', 'all'];
  var listingsById = {};
  function listingRowHtml(l) {
    listingsById[l.id] = l;
    var chips = chip(t('st_' + l.status), l.status === 'live' ? 'live' : l.status === 'removed' ? 'bad' : l.status === 'review' ? 'warn' : '') + S.tierBadge(l.tier) +
      (l.hidden ? chip(t('adHiddenBy', { reason: t('rs_' + (l.hiddenReason || 'other')) }), 'warn') : '') +
      (l.sellerHidden ? chip(t('adSellerHidden'), 'warn') : '') + (l.featured ? chip(t('featured'), 'gold') : '') +
      (l.reports ? chip(S.num(l.reports) + ' ' + t('adReports'), 'bad') : '');
    var stats = [money(l.price)];
    if (l.format === 'auction') stats.push(S.tn('adBidsN', l.bids));
    if (l.watchers) stats.push(S.tn('adWatchers', l.watchers));
    return '<article class="adm-lrow" id="adl-' + l.id + '">' +
      '<a class="thumb" href="/vault-item.html?id=' + l.id + '" target="_blank" rel="noopener">' + (l.photo ? '<img src="' + esc(l.photo) + '" alt="" loading="lazy"/>' : '') + '</a>' +
      '<div class="adm-lrow-main"><b>' + esc(l.title) + '</b><small>EU ' + esc(l.size) + ' · #' + l.id + ' · ' + esc(when(l.at)) + ' · ' + esc(t('adSellerL')) + ': ' + memberLink(l.seller) + '</small>' +
        '<div class="adm-row-chips">' + chips + '</div>' + (l.status === 'removed' && l.note ? '<small class="adm-removed">' + esc(t('adRemovedNote', { note: l.note })) + '</small>' : '') + '</div>' +
      '<div class="adm-lrow-side"><small>' + esc(stats.join(' · ')) + '</small><button type="button" class="v-btn ghost xs" data-adm-lmenu="' + l.id + '">' + esc(t('adManage')) + '</button></div>' +
    '</article>';
  }
  function listingsHtml() {
    var r = data.listings;
    return '<div class="adm-bar">' + searchBox('listings', 'adSearchListings') + '</div>' + filterBar('listings', L_FILTERS, r && r.counts, 'adLF_') +
      (!r ? loading() : r.listings.length ? '<div class="adm-list">' + r.listings.map(listingRowHtml).join('') + '</div>' + pager('listings', r) : empty('vault', t('adNoneFound')));
  }
  // the listing's menu: works from the Listings tab, a member's page and a report
  function listingMenu(id) {
    var l = listingsById[id];
    var open = function (l2) {
      var title = l2.title;
      var m = S.modal({ title: title, html: '<div class="adm-menu">' +
          '<a class="v-btn ghost" href="/vault-item.html?id=' + l2.id + '" target="_blank" rel="noopener">' + esc(t('adView')) + '</a>' +
          (l2.hidden ? '<button type="button" class="v-btn ghost" data-lm="unhide">' + esc(t('adShowOne')) + '</button>' :
            ['live', 'review', 'ended'].indexOf(l2.status) !== -1 ? '<button type="button" class="v-btn ghost" data-lm="hide">' + esc(t('adHideOne')) + '</button>' : '') +
          '<button type="button" class="v-btn ghost" data-lm="edit">' + esc(t('adEdit')) + '</button>' +
          '<button type="button" class="v-btn ghost" data-lm="note">' + esc(t('adActNote')) + '</button>' +
          (['live', 'review', 'ended', 'cancelled', 'rejected'].indexOf(l2.status) !== -1 ? '<button type="button" class="v-btn danger-ghost" data-lm="remove">' + esc(t('adRemove')) + '</button>' : '') +
          (l2.seller ? '<button type="button" class="v-btn ghost" data-lm="seller">' + esc(t('adOpenSeller')) + '</button>' : '') +
        '</div>' });
      m.el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-lm]');
        if (!b) return;
        var a = b.getAttribute('data-lm');
        m.close(true);
        listingAct(l2, a);
      });
    };
    if (l) { open(l); return; }
    // from a member's page: fetch it by number
    get('admin/listings?f=all&q=' + encodeURIComponent('#' + id)).then(function (res) {
      var hit = res.ok && (res.data.listings || []).filter(function (x) { return x.id === id; })[0];
      if (!hit) { failed(res); return; }
      listingsById[id] = hit;
      open(hit);
    });
  }
  function listingAct(l, a) {
    var R = 'admin/listing';
    if (a === 'seller') { go('members', l.seller.id); return; }
    if (a === 'unhide') return ask(t('adShowOne'), t('adUnhideOneQ', { title: l.title }), t('adShowOne'), false, R, { id: l.id, action: 'unhide' });
    if (a === 'hide' || a === 'remove') {
      return dialog({ title: t(a === 'hide' ? 'adHideOneT' : 'adRemoveT', { title: l.title }), goLabel: t(a === 'hide' ? 'adHideOne' : 'adRemove'), dsa: true, danger: a === 'remove', wide: true,
        html: (a === 'remove' ? '<div class="v-state bad">' + S.ico('alert') + '<div>' + esc(t('adRemoveWarn')) + '</div></div>' : '') + reasonSelect(false) + detailsBox(),
        go: function (v, mm, bad) {
          if (v.reason === 'other' && v.details.length < 10) { bad('e_adm_details'); return null; }
          return [R, { id: l.id, action: a, reason: v.reason, details: v.details }];
        } });
    }
    if (a === 'note') {
      return dialog({ title: t('adNoteT'), goLabel: t('adDoNote'), doneKey: 'adNoteSaved',
        html: '<textarea class="v-textarea" id="admDetails" rows="4" maxlength="1500" placeholder="' + esc(t('adNotePh')) + '"></textarea>',
        go: function (v, mm, bad) { if (!v.details) { bad('e_adm_note'); return null; } return [R, { id: l.id, action: 'note', note: v.details }]; } });
    }
    if (a === 'edit') {
      var f = function (id, label, val, max) { return '<label class="v-label" for="' + id + '">' + esc(t(label)) + '</label><input class="v-input" id="' + id + '" maxlength="' + max + '" value="' + esc(val || '') + '"/>'; };
      return dialog({ title: t('adEditT', { title: l.title }), goLabel: t('adSave'), wide: true,
        html: '<div class="v-row">' + f('admBrand', 'adBrand', l.brand, 40) + f('admModel', 'adModel', l.model, 80) + '</div>' + f('admSize', 'adSize', l.size, 8) +
          '<label class="v-label" for="admDesc">' + esc(t('adDescription')) + '</label><textarea class="v-textarea" id="admDesc" rows="4" maxlength="2000">' + esc(l.description || '') + '</textarea>' +
          '<p class="v-note">' + esc(t('adEditNote')) + '</p>',
        go: function (v, mm) {
          return [R, { id: l.id, action: 'edit', brand: mm.$('#admBrand').value.trim(), model: mm.$('#admModel').value.trim(), size: mm.$('#admSize').value.trim(), description: mm.$('#admDesc').value }];
        } });
    }
  }

  /* ── orders ─────────────────────────────────────────────────────────── */
  var O_FILTERS = ['open', 'disputed', 'held', 'delivered', 'refunded', 'cancelled', 'all'];
  function seeOrders(list) { (list || []).forEach(function (o) { orders[o.id] = o; }); }
  // the admin row under an order card (the console's queue and "All orders")
  function orderTools(o) {
    orders[o.id] = o;
    var b = function (a, label, cls) { return '<button type="button" class="v-btn xs ' + (cls || 'ghost') + '" data-adm-order="' + a + '" data-id="' + o.id + '">' + esc(t(label)) + '</button>'; };
    var out = [];
    if (PAID.indexOf(o.status) !== -1 && (o.total - (o.refundedAmount || 0)) > 0) out.push(b('refund', 'adRefund'));
    if (EARLY.indexOf(o.status) !== -1) out.push(b('cancel', 'adCancelOrder', 'danger-ghost'));
    if (['cancelled', 'refunded', 'failed'].indexOf(o.status) === -1 && o.payoutStatus !== 'sent') out.push(o.payoutHold ? b('unhold', 'adUnhold', 'ok') : b('hold', 'adHold'));
    out.push(b('note', 'adActNote'));
    var people = (o.buyerId ? '<a href="#members/' + o.buyerId + '" data-adm-member="' + o.buyerId + '">' + esc(t('adBuyerP')) + '</a>' : '') +
      (o.sellerId ? '<a href="#members/' + o.sellerId + '" data-adm-member="' + o.sellerId + '">' + esc(t('adSellerP')) + '</a>' : '');
    var flags = (o.payoutHold ? chip(t('adPayoutHeld'), 'warn') : '') + (o.refundedAmount ? chip(t('adRefundedN', { amount: money(o.refundedAmount, true) }), 'warn') : '');
    return '<div class="adm-otools"><span class="adm-otools-k">' + S.ico('shield') + esc(t('adAdmin')) + '</span>' + flags + out.join('') + '<span class="adm-people">' + people + '</span></div>';
  }
  function ordersHtml(renderOrder) {
    var r = data.orders;
    return '<div class="adm-bar">' + searchBox('orders', 'adSearchOrders') + '</div>' + filterBar('orders', O_FILTERS, r && r.counts, 'adOF_') +
      (!r ? loading() : r.orders.length ? '<div class="v-rows">' + r.orders.map(function (o) { seeOrders([o]); return renderOrder(o); }).join('') + '</div>' + pager('orders', r) : empty('box', t('adNoneFound')));
  }
  function orderAct(a, id) {
    var o = orders[id];
    if (!o) return;
    var R = 'admin/order';
    var left = o.total - (o.refundedAmount || 0);
    if (a === 'refund') {
      var paidOut = o.payoutStatus === 'sent';
      return dialog({ title: t('adRefundT', { n: o.id }), goLabel: t('adRefund'), danger: true, wide: true,
        html: '<label class="v-check"><input type="checkbox" id="admFull" checked/><span>' + esc(t('adRefundFull', { amount: money(left, true) })) + '</span></label>' +
          '<div id="admPart" hidden><label class="v-label" for="admAmount">' + esc(t('adRefundAmount')) + '</label><input class="v-input" id="admAmount" inputmode="decimal" placeholder="0,00"/></div>' +
          detailsBox('adRefundWhy', 'adRefundWhyPh', 3) +
          '<label class="v-check"><input type="checkbox" id="admFromSeller"/><span>' + esc(t('adFromSeller')) + '<small>' + esc(t(paidOut ? 'adFromSellerSent' : 'adFromSellerOpen')) + '</small></span></label>' +
          '<p class="v-note">' + esc(t(o.stripePaid ? 'adRefundHow' : 'adRefundHowBank')) + '</p>',
        wire: function (mm) { mm.$('#admFull').addEventListener('change', function () { mm.$('#admPart').hidden = this.checked; if (!this.checked) mm.$('#admAmount').focus(); }); },
        go: function (v, mm, bad) {
          if (v.details.length < 5) { bad('e_note_needed'); mm.$('#admDetails').focus(); return null; }
          var full = mm.$('#admFull').checked, amt = full ? null : S.parseEuro(mm.$('#admAmount').value);
          if (!full && !(amt > 0 && amt <= left / 100)) { bad('e_adm_amount', { max: money(left, true) }); return null; }
          return [R, { id: o.id, action: 'refund', full: full, amount: amt, note: v.details, fromSeller: mm.$('#admFromSeller').checked }];
        },
        after: function (r) { if (r.how === 'manual') S.toast(t('adRefundManualToast'), 'info'); } });
    }
    if (a === 'cancel') {
      return dialog({ title: t('adCancelT', { n: o.id }), goLabel: t('adDoCancel'), danger: true, wide: true,
        html: '<div class="v-state warn">' + S.ico('alert') + '<div>' + esc(t(o.status === 'awaiting_payment' ? 'adCancelWarnUnpaid' : 'adCancelWarn', { amount: money(left, true) })) + '</div></div>' + detailsBox('adCancelWhy', 'adCancelWhyPh', 3),
        go: function (v, mm, bad) { if (v.details.length < 5) { bad('e_note_needed'); return null; } return [R, { id: o.id, action: 'cancel', note: v.details }]; } });
    }
    if (a === 'hold') {
      return dialog({ title: t('adHoldT', { n: o.id }), goLabel: t('adHold'), html: '<p class="v-note">' + esc(t('adHoldP')) + '</p>' + detailsBox('adHoldWhy', 'adNotePh', 2),
        go: function (v, mm, bad) { if (v.details.length < 5) { bad('e_note_needed'); return null; } return [R, { id: o.id, action: 'hold', note: v.details }]; } });
    }
    if (a === 'unhold') return ask(t('adUnhold'), t('adUnholdQ'), t('adUnhold'), false, R, { id: o.id, action: 'unhold' });
    if (a === 'note') {
      return dialog({ title: t('adNoteT'), goLabel: t('adDoNote'), doneKey: 'adNoteSaved',
        html: '<textarea class="v-textarea" id="admDetails" rows="4" maxlength="1500" placeholder="' + esc(t('adNotePh')) + '"></textarea>',
        go: function (v, mm, bad) { if (!v.details) { bad('e_adm_note'); return null; } return [R, { id: o.id, action: 'note', note: v.details }]; } });
    }
  }

  /* ── reports ────────────────────────────────────────────────────────── */
  function reportHtml(r) {
    var target = '';
    if (r.listing) {
      listingsById[r.listing.id] = Object.assign({ status: r.listing.status, title: r.listing.title, hidden: r.listing.hidden, seller: r.listing.seller }, listingsById[r.listing.id] || {}, r.listing);
      target = '<div class="adm-rp-target"><a class="thumb" href="/vault-item.html?id=' + r.listing.id + '" target="_blank" rel="noopener">' + (r.listing.photo ? '<img src="' + esc(r.listing.photo) + '" alt="" loading="lazy"/>' : '') + '</a>' +
        '<span><b>' + esc(r.listing.title) + '</b><small>EU ' + esc(r.listing.size) + ' · #' + r.listing.id + ' · ' + money(r.listing.price) + ' · ' + esc(t('adSellerL')) + ': ' + memberLink(r.listing.seller) + '</small>' +
        '<span class="adm-row-chips">' + chip(t('st_' + r.listing.status), '') + (r.listing.hidden ? chip(t('adHidden'), 'warn') : '') + '</span></span>' +
        '<button type="button" class="v-btn ghost xs" data-adm-lmenu="' + r.listing.id + '">' + esc(t('adManage')) + '</button></div>';
    } else if (r.member) {
      target = '<div class="adm-rp-target">' + avatar(r.member.name, r.member.id) + '<span><b>' + esc(r.member.name) + '</b><small>' + esc(r.member.email) + (r.orderId ? ' · ' + esc(t('orderNo', { n: r.orderId })) : '') + '</small></span>' +
        '<button type="button" class="v-btn ghost xs" data-adm-member="' + r.member.id + '">' + esc(t('adOpenMember')) + '</button></div>';
    }
    var head = chip(t(r.kind === 'listing' ? 'adRpListing' : 'adRpMember'), '') + chip(t('rp_' + r.reason), r.reason === 'counterfeit' || r.reason === 'fraud' ? 'bad' : 'warn') +
      (r.others ? chip(t('adRpOthers', { n: r.others }), 'bad') : '');
    var decided = r.status !== 'open' ? '<p class="v-note">' + esc(t('adRpDecided', { decision: t(r.decision === 'actioned' ? 'adRpActioned' : 'adRpDismissed'), when: when(r.handledAt), by: r.handledBy || '' })) +
      (r.answer ? ' — ' + esc(r.answer) : '') + '</p>' : '';
    return '<article class="adm-rp" id="adr-' + r.id + '"><div class="adm-rp-head">' + head + '<time>' + esc(when(r.at)) + ' · #' + r.id + '</time></div>' +
      target +
      '<blockquote class="adm-rp-q">' + esc(r.details || '') + '<cite>' + esc(t('adRpBy', { name: r.reporter.name || '' })) + ' · <a href="mailto:' + esc(r.reporter.email) + '">' + esc(r.reporter.email) + '</a></cite></blockquote>' +
      (r.status === 'open' ? '<label class="v-label" for="adra' + r.id + '">' + esc(t('adRpAnswer')) + '</label><textarea class="v-textarea" id="adra' + r.id + '" rows="2" maxlength="1500"></textarea>' +
        '<div class="row"><button type="button" class="v-btn sm ok" data-adm-rp="actioned" data-id="' + r.id + '">' + esc(t('adRpActioned')) + '</button>' +
        '<button type="button" class="v-btn sm ghost" data-adm-rp="dismissed" data-id="' + r.id + '">' + esc(t('adRpDismissed')) + '</button></div>' : decided) +
    '</article>';
  }
  function reportsHtml() {
    var r = data.reports;
    return filterBar('reports', ['open', 'done'], r ? { open: r.open } : null, 'adRpF_') +
      '<p class="v-note adm-intro">' + esc(t('adRpIntro')) + '</p>' +
      (!r ? loading() : r.reports.length ? '<div class="v-rows">' + r.reports.map(reportHtml).join('') + '</div>' : empty('check', t(q.reports.f === 'open' ? 'adRpNone' : 'adNoneFound')));
  }
  function decide(btn, id, decision) {
    var box = d.getElementById('adra' + id);
    S.confirm(t(decision === 'actioned' ? 'adRpActioned' : 'adRpDismissed'), t(decision === 'actioned' ? 'adRpActionedQ' : 'adRpDismissedQ'), t('confirm'), false).then(function (y) {
      if (!y) return;
      S.busy(btn, true);
      post('admin/report', { id: id, decision: decision, answer: box ? box.value.trim() : '' }).then(function (res) {
        S.busy(btn, false);
        if (!res.ok) { failed(res); return; }
        S.toast(t('adDone'), 'ok');
        refresh();
      });
    });
  }

  /* ── activity ───────────────────────────────────────────────────────── */
  function logLine(e) {
    var target = e.kind === 'user' ? '<a href="#members/' + e.target + '" data-adm-member="' + e.target + '">' + esc(e.label || ('#' + e.target)) + '</a>'
      : e.kind === 'listing' ? '<a href="/vault-item.html?id=' + e.target + '" target="_blank" rel="noopener">' + esc(e.label || ('#' + e.target)) + '</a>'
      : e.kind === 'order' ? esc(t('orderNo', { n: e.target })) : e.kind === 'report' ? '#' + e.target : '';
    var extra = [];
    if (e.data && e.data.days != null) extra.push(e.data.days ? t('adDays', { n: e.data.days }) : t('adForever'));
    if (e.data && e.data.amount) extra.push(money(e.data.amount, true));
    return '<li><time>' + esc(when(e.at)) + '</time><span><b>' + esc(t(S.has('adA_' + e.kind + '_' + e.action) ? 'adA_' + e.kind + '_' + e.action : 'adA_' + e.action)) + '</b>' +
      (target ? ' · ' + target : '') + (e.reason ? ' · ' + esc(t(S.has('rs_' + e.reason) ? 'rs_' + e.reason : 'rp_' + e.reason)) : '') + (extra.length ? ' · ' + esc(extra.join(' · ')) : '') +
      (e.note ? '<small>' + esc(e.note) + '</small>' : '') + '<em>' + esc(e.by || t('adSystem')) + '</em></span></li>';
  }
  function logHtml(list) { return list && list.length ? '<ul class="adm-log">' + list.map(logLine).join('') + '</ul>' : '<p class="v-note">' + esc(t('adLogEmpty')) + '</p>'; }
  function activityHtml() {
    var r = data.log;
    return '<p class="v-note adm-intro">' + esc(t('adLogIntro')) + '</p>' + (!r ? loading() : logHtml(r.entries) +
      (r.entries.length === 50 * r.page ? '<div class="adm-pager"><button type="button" class="v-btn ghost sm" data-adm-more>' + esc(t('adLogMore')) + '</button></div>' : ''));
  }

  /* ── controls ───────────────────────────────────────────────────────── */
  function controlsHtml() {
    var r = data.settings;
    if (!r) return loading();
    var s = r.settings;
    var sw = function (k, label, p) {
      return '<label class="adm-switch"><input type="checkbox" data-adm-set="' + k + '"' + (s[k] ? ' checked' : '') + '/><span class="adm-switch-ui" aria-hidden="true"></span>' +
        '<span><b>' + esc(t(label)) + '</b><small>' + esc(t(p)) + '</small></span></label>';
    };
    var any = s.pause_trading || s.pause_listings || s.pause_signups;
    return '<section class="adm-ctl' + (any ? ' live' : '') + '"><h3>' + S.ico('settings') + esc(t('adCtlT')) + '</h3><p class="v-note">' + esc(t('adCtlP')) + '</p>' +
      (any ? '<div class="v-state warn">' + S.ico('alert') + '<div>' + esc(t('adCtlOn')) + '</div></div>' : '') +
      sw('pause_listings', 'adCtlListings', 'adCtlListingsP') + sw('pause_trading', 'adCtlTrading', 'adCtlTradingP') + sw('pause_signups', 'adCtlSignups', 'adCtlSignupsP') +
      '<label class="v-label" for="admNotice">' + esc(t('adCtlNotice')) + '</label><input class="v-input" id="admNotice" maxlength="300" value="' + esc(s.notice || '') + '" placeholder="' + esc(t('adCtlNoticePh')) + '"/>' +
      '<div class="row"><button type="button" class="v-btn gold" data-adm-save>' + esc(t('adSave')) + '</button></div>' +
      '<p class="v-note">' + S.ico('info') + ' ' + esc(t(r.admins === 'list' ? 'adCtlAdminsList' : 'adCtlAdmins')) + '</p></section>';
  }
  function saveControls(btn) {
    var body = { notice: (d.getElementById('admNotice') || {}).value || '' };
    Array.prototype.forEach.call(pane.querySelectorAll('[data-adm-set]'), function (x) { body[x.getAttribute('data-adm-set')] = x.checked; });
    var turningOn = (body.pause_trading && !data.settings.settings.pause_trading) || (body.pause_listings && !data.settings.settings.pause_listings) || (body.pause_signups && !data.settings.settings.pause_signups);
    var go = function () {
      S.busy(btn, true);
      post('admin/settings', body).then(function (res) {
        S.busy(btn, false);
        if (!res.ok) { failed(res); return; }
        data.settings.settings = res.data.settings;
        S.toast(t('adCtlSaved'), 'ok');
        draw();
      });
    };
    if (turningOn) S.confirm(t('adCtlT'), t('adCtlConfirm'), t('confirm'), true).then(function (y) { if (y) go(); });
    else go();
  }

  /* ── loading and drawing ────────────────────────────────────────────── */
  function qsOf(o) { return Object.keys(o).filter(function (k) { return o[k] !== '' && o[k] != null; }).map(function (k) { return k + '=' + encodeURIComponent(o[k]); }).join('&'); }
  function load() {
    var my = ++seq;
    var done = function (key) { return function (res) { if (my !== seq) return; if (!res.ok) { failed(res); data[key] = data[key] || null; } else data[key] = res.data; draw(); }; };
    if (tab === 'members' && memberId) get('admin/member?id=' + memberId).then(function (res) { if (my !== seq) return; if (!res.ok) { failed(res); memberId = null; load(); return; } data.member = res.data.member; draw(); });
    else if (tab === 'members') get('admin/members?' + qsOf(q.members)).then(done('members'));
    else if (tab === 'listings') get('admin/listings?' + qsOf(q.listings)).then(done('listings'));
    else if (tab === 'orders') get('admin/orders?' + qsOf(q.orders)).then(done('orders'));
    else if (tab === 'reports') get('admin/reports?' + qsOf(q.reports)).then(done('reports'));
    else if (tab === 'activity') get('admin/log?' + qsOf(q.log)).then(done('log'));
    else if (tab === 'controls') get('admin/settings').then(done('settings'));
  }
  var renderOrderFn = null;
  function draw() {
    if (!pane || !d.body.contains(pane)) return;
    var focus = d.activeElement && d.activeElement.getAttribute && d.activeElement.getAttribute('data-adm-q');
    var caret = focus ? d.activeElement.selectionStart : 0;
    pane.innerHTML = tab === 'members' ? (memberId ? (data.member && data.member.id === memberId ? memberHtml(data.member) : loading()) : membersHtml())
      : tab === 'listings' ? listingsHtml() : tab === 'orders' ? ordersHtml(renderOrderFn)
      : tab === 'reports' ? reportsHtml() : tab === 'activity' ? activityHtml() : tab === 'controls' ? controlsHtml() : '';
    if (focus) {
      var inp = pane.querySelector('[data-adm-q="' + focus + '"]');
      if (inp) { inp.focus(); try { inp.setSelectionRange(caret, caret); } catch (e) {} }
    }
  }
  function refresh() {
    load();
    if (w.SLVLab && w.SLVLab.reload) w.SLVLab.reload(true);
  }
  function show(name, el, opts) {
    pane = el; tab = name;
    if (opts && opts.renderOrder) renderOrderFn = opts.renderOrder;
    if (name !== 'members') memberId = null;
    draw();
    load();
  }
  function go(name, id) {
    memberId = name === 'members' && id ? +id : null;
    data.member = null;
    try { w.history.replaceState(null, '', w.location.pathname + '#' + name + (memberId ? '/' + memberId : '')); } catch (e) {}
    if (w.SLVLab && w.SLVLab.setTab) w.SLVLab.setTab(name);
    else if (pane) show(name, pane);
    w.scrollTo({ top: Math.max(0, (pane ? pane.getBoundingClientRect().top + w.scrollY - 120 : 0)), behavior: 'smooth' });
  }

  /* ── clicks and typing ──────────────────────────────────────────────── */
  d.addEventListener('click', function (e) {
    var body = d.getElementById('labBody');
    if (!body || !body.contains(e.target)) return;
    var el = e.target.closest('[data-adm-member],[data-adm-back],[data-adm-f],[data-adm-page],[data-adm-act],[data-adm-lmenu],[data-adm-order],[data-adm-order-open],[data-adm-rp],[data-adm-save],[data-adm-more]');
    if (!el) return;
    if (el.hasAttribute('data-adm-member')) { e.preventDefault(); go('members', el.getAttribute('data-adm-member')); return; }
    if (el.hasAttribute('data-adm-back')) { go('members'); return; }
    if (el.hasAttribute('data-adm-f')) {
      var f = el.getAttribute('data-adm-f').split(':');
      q[f[0]].f = f[1]; if (q[f[0]].page) q[f[0]].page = 1;
      data[f[0] === 'log' ? 'log' : f[0]] = null; draw(); load(); return;
    }
    if (el.hasAttribute('data-adm-page')) {
      var p = el.getAttribute('data-adm-page').split(':');
      q[p[0]].page = +p[1]; load(); w.scrollTo({ top: pane.getBoundingClientRect().top + w.scrollY - 140, behavior: 'smooth' }); return;
    }
    if (el.hasAttribute('data-adm-act')) { memberAct(el.getAttribute('data-adm-act')); return; }
    if (el.hasAttribute('data-adm-lmenu')) { listingMenu(+el.getAttribute('data-adm-lmenu')); return; }
    if (el.hasAttribute('data-adm-order')) { orderAct(el.getAttribute('data-adm-order'), +el.getAttribute('data-id')); return; }
    if (el.hasAttribute('data-adm-order-open')) { q.orders = { q: '#' + el.getAttribute('data-adm-order-open'), f: 'all', page: 1 }; data.orders = null; go('orders'); if (w.SLVLab && w.SLVLab.ordersAll) w.SLVLab.ordersAll(); return; }
    if (el.hasAttribute('data-adm-rp')) { decide(el, +el.getAttribute('data-id'), el.getAttribute('data-adm-rp')); return; }
    if (el.hasAttribute('data-adm-save')) { saveControls(el); return; }
    if (el.hasAttribute('data-adm-more')) { q.log.page++; get('admin/log?' + qsOf(q.log)).then(function (res) { if (res.ok) { data.log = { entries: data.log.entries.concat(res.data.entries), page: res.data.page }; draw(); } }); return; }
  });
  d.addEventListener('input', function (e) {
    var k = e.target && e.target.getAttribute && e.target.getAttribute('data-adm-q');
    if (!k) return;
    q[k].q = e.target.value; q[k].page = 1;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(load, 280);
  });

  w.SLVAdmin = {
    show: show, go: go, orderTools: orderTools, seeOrders: seeOrders, reload: load,
    member: function (id) { memberId = id ? +id : null; },
    tabs: ['members', 'listings', 'reports', 'activity', 'controls']
  };
})(window, document);
