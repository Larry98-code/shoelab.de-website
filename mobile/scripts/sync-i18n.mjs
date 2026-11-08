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

// The studio's three treatments (names, prices, texts) from the booking page (js/flow.js).
const flow = fs.readFileSync(path.join(here, '../../shoelab-netlify/js/flow.js'), 'utf8');
const svcs = /var SERVICES = (\[[\s\S]*?\]);/.exec(flow)[1];
const SERVICES = new Function('return ' + svcs)();
const studio = { services: SERVICES, text: {} };
for (const l of ['en', 'de', 'pl', 'ru', 'uk', 'it', 'es', 'fr']) {
  const start = flow.indexOf('\n    ' + l + ': {');
  const end = flow.indexOf('\n    },', start);
  const block = flow.slice(start, end);
  const d = {};
  for (const m of block.matchAll(/(svcTag\d|svcDesc\d)\s*:\s*'((?:[^'\\]|\\.)*)'/g)) d[m[1]] = m[2].replace(/\\'/g, "'");
  studio.text[l] = d;
}
fs.writeFileSync(path.join(here, '../src/i18n/studio.json'), JSON.stringify(studio));
console.log('studio: ' + SERVICES.length + ' treatments, ' + Object.keys(studio.text.de).length + ' texts per language');


// The hero showcase (the turning pairs): the pairs, their colours and the texts
// per language, from the website's js/hero-showcase.js.
{
  const js = fs.readFileSync(path.join(here, '../../shoelab-netlify/js/hero-showcase.js'), 'utf8');
  const grab = (name, open, close) => {
    const at = js.indexOf('var ' + name + ' = ' + open);
    if (at < 0) throw new Error('showcase: ' + name + ' not found');
    let depth = 0, i = js.indexOf(open, at);
    for (let j = i; j < js.length; j++) {
      if (js[j] === open) depth++;
      else if (js[j] === close && --depth === 0) return vm.runInNewContext('(' + js.slice(i, j + 1) + ')');
    }
    throw new Error('showcase: ' + name + ' not closed');
  };
  const shoes = grab('SHOES', '[', ']'), desc = grab('DESC', '{', '}'), tr = grab('T', '{', '}');
  const showcase = { shoes: shoes.map((s) => ({ ...s, img: path.basename(s.img, '.webp') })), desc, tr };
  fs.writeFileSync(path.join(here, '../src/i18n/showcase.json'), JSON.stringify(showcase));
  for (const s of showcase.shoes) {
    const to = path.join(here, '../assets/img/showcase-' + s.img + '.webp');
    fs.copyFileSync(path.join(here, '../../shoelab-netlify/img/showcase/' + s.img + '.webp'), to);
  }
  console.log('showcase: ' + shoes.length + ' pairs');
}
