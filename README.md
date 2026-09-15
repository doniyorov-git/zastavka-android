# Zastavka

Wallpaper store (English / Russian / Chinese) with coin top-up via [Spayon](https://docs.spayon.io/).

## Live

- App: https://130.61.247.126.sslip.io/zastavka/
- Admin: https://130.61.247.126.sslip.io/zastavka-admin/
- API: https://130.61.247.126.sslip.io/zastavka-api/

## Payments

Coin checkout uses Spayon hosted sessions (Visa/Mastercard, MIR, SBP, crypto).

In **Admin → Payments** paste:

- Client ID
- Client Secret
- Callback secret

from [admin.spayon.io](https://admin.spayon.io) Settings. Also set the same callback URL there:

`https://130.61.247.126.sslip.io/zastavka-api/topup/callback`

Coins are added only after a verified HMAC-SHA256 callback (`X-Signature`).

## Native apps

```bash
npm install
npm run build:android   # Play / Android
npm run build:ios       # App Store / Xcode
```

Listing copy and screenshots:

- Play Store: `play/STORE.md`, `play/screenshots/`
- App Store: `store/ios/STORE.md`, `store/ios/screenshots/`
