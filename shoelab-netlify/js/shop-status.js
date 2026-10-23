/* ShoeLab — is the product shop selling yet?
 *
 * false: no stock yet. Every product stays on show with a "Coming soon"
 *        tag; prices, ratings, badges, the cart and every buy button are
 *        hidden, and Wesley tells people the shop opens soon.
 * true:  the shop sells again: prices, cart and checkout come back.
 *
 * This is the only switch. After changing it, bump ?v= where this file is
 * loaded (index.html and brushes.html) so visitors get it at once. It loads
 * in <head>, before anything is drawn, so a price never flashes up. */
(function (w, d) {
  'use strict';
  var OPEN = false;
  w.SHOP_OPEN = OPEN;
  d.documentElement.setAttribute('data-shop', OPEN ? 'open' : 'soon');
})(window, document);
