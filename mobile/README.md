# ShoeLab app (iPhone and Android)

The native app for ShoeLab, built with Expo (SDK 58, React Native, Expo
Router). It uses the same server and accounts as the website
(`shoelab-netlify/functions`), signing in with a token instead of a cookie.

| Folder | What it is |
|---|---|
| `src/app/` | The screens (every file is a route): the welcome screen, the five tabs, a listing, an order, sign-in, settings. `_layout.tsx` plays the 0–100 % opening and keeps the app behind the welcome screen until someone signs in or chooses to look around |
| `src/components/` | Shared pieces: buttons and cards, the listing card, the photo gallery and full-screen viewer, the guided camera, sheets |
| `src/lib/` | The API client, sign-in (secure storage, Face ID lock), languages, push notifications, links from emails |
| `src/i18n/` | Texts: `vault/*.json` are the website's own (run `npm run sync:i18n` after the site's texts change); `app/*.ts` are the app's; `studio.json` the treatments and prices |
| `store/` | The store listing texts, privacy answers, review notes and screenshots |

## Working on it

```bash
npm install
npx tsc --noEmit          # typecheck
npx expo start            # then open in Expo Go or a development build
npm run sync:i18n         # copy the website's texts again
```

`EXPO_PUBLIC_API_URL` points the app at another server (default
`https://shoelabonline.de`); the web build (`npx expo export --platform web`)
is used for automated screenshots and tests only.

## What the app does on the server

- `POST /api/account/login|signup` with `app: true` returns a sign-in token and sets no cookie
  (a phone keeps cookies; signing out of the app must really sign out). The app never sends cookies.
- `POST /api/market/push/register|unregister` keeps the phone's push token;
  every Vault email to a member also goes to their phones (`functions/_shared/push.js`).
- `POST /api/account/delete` lets members delete their account in the app (required by Apple).
- Links in emails (`/vault-item.html?id=…`, `/vault-me.html#order-…`) open the matching screen.
- While ShoeLab is on hold (`functions/_shared/core.js`), the app shows the same message.

## Releasing (needs the owner's accounts)

1. **Accounts:** Apple Developer Program (about $99 a year), Google Play
   Console ($25 once), and a free Expo account at expo.dev.
2. **Link the project:** `npx eas-cli@latest init` (adds the project ID to `app.json`,
   which push notifications need).
3. **Build in the cloud:** `npx eas-cli@latest build --platform all --profile production`
   (EAS creates the iOS certificates and the Android keystore and keeps them).
4. **Submit:** `npx eas-cli@latest submit --platform ios` and `--platform android`, then
   fill in the store pages from `store/listing.md`, upload the screenshots and answer
   the privacy questions as written there.
5. **Universal links:** once the Apple Team ID and the Android signing fingerprint
   exist, publish `/.well-known/apple-app-site-association` and
   `/.well-known/assetlinks.json` on the website so links open the app.
6. **Push security (optional):** create an access token in the Expo account and set it as
   `EXPO_ACCESS_TOKEN` in Cloudflare (enable "enhanced push security" in Expo).
