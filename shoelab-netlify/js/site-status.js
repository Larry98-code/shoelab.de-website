/* ShoeLab — ON HOLD switch for the pages (homepage, booking, checkout).
 * Loaded in <head>, before anything is drawn, so the notice is there from the
 * first frame. To reopen: set HOLD to false here AND in
 * functions/_shared/core.js, then deploy. */
(function (w, d) {
  var HOLD = true;
  if (HOLD && !w.__SL_NO_HOLD) d.documentElement.classList.add('site-hold');
})(window, document);
