// Copies the website's Vault texts (shoelab-netlify/js/vault-i18n/*.js) into
// the app as JSON, so the app and the site always say the same thing.
// Run after the site's texts change: npm run sync:i18n
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const here = path.dirname(new URL(import.meta.url).pathname);
const src = path.join(here, '../../shoelab-netlify/js/vault-i18n');
const out = path.join(here, '../src/i18n/vault');
const ctx = { window: {} };
vm.createContext(ctx);
for (const l of ['en', 'de', 'pl', 'ru', 'uk', 'it', 'es', 'fr']) {
  vm.runInContext(fs.readFileSync(path.join(src, l + '.js'), 'utf8'), ctx);
  const d = ctx.window.SLV_I18N[l];
  fs.writeFileSync(path.join(out, l + '.json'), JSON.stringify(d));
  console.log(l + ': ' + Object.keys(d).length + ' texts');
}
