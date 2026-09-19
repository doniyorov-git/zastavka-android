# Zastavka

Wallpaper store (English / Russian / Chinese) with coin top-up via [Buy Me a Coffee](https://www.buymeacoffee.com/admin09wet).

## Live (silkrood.uz)

- App: https://silkrood.uz/zastavka/
- Admin: https://silkrood.uz/zastavka-admin/
- API: https://silkrood.uz/zastavka-api/
- Privacy: https://silkrood.uz/zastavka/privacy.html
- Terms: https://silkrood.uz/zastavka/terms.html

## Payments (Buy Me a Coffee)

Pay opens the BMC page (`admin09wet`). Coins are added only after a signed webhook (`x-signature-sha256`).

In **Admin → Payments** paste:

1. BMC username — `admin09wet` (already filled from Silkrood)
2. BMC page URL — `https://www.buymeacoffee.com/admin09wet`
3. **Webhook signing secret** — BMC dashboard → Integrations → New webhook → Signing Secret
4. Optional **Access token** — [developers.buymeacoffee.com](https://developers.buymeacoffee.com/)
5. Optional Extra IDs for packs 100 / 300 / 750 coins (`$0.99` / `$2.99` / `$5.99`)

Webhook URL to paste in BMC:

`https://silkrood.uz/zastavka-api/webhooks/bmc`

Events: `donation.created`, `extra_purchase.created` (and refunds if you want a record). Put the Zastavka order id in the coffee message when BMC asks.

## Logins

- Demo user: `aziz.karimov@gmail.com` / `aziz123`
- Admin: password `ZastavkaAdmin!`

## Native apps

```bash
npm install
npm run build:android   # Play / Android
npm run build:ios       # App Store / Xcode
```

Listing copy and screenshots:

- Play Store: `play/STORE.md`, `play/screenshots/`, `play/screenshots-16x9/`
- App Store: `store/ios/STORE.md`, `store/ios/screenshots/`
