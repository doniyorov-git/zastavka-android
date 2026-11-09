# Zastavka

Wallpaper store (English / Russian / Chinese) with coin top-up via [Buy Me a Coffee](https://www.buymeacoffee.com/admin09wet).

## Live (silkrood.uz)

- App: https://silkrood.uz/zastavka/
- Admin: https://silkrood.uz/zastavka-admin/
- API: https://silkrood.uz/zastavka-api/
- Privacy: https://silkrood.uz/zastavka/privacy.html
- Terms: https://silkrood.uz/zastavka/terms.html

## Payments (Buy Me a Coffee)

Pay creates a BMC shop cart and opens **card checkout** (`/extras/checkout/{cartId}`) for extra [`577212`](https://www.buymeacoffee.com/admin09wet/e/577212) ($1 = 100 coins). Prefills: quantity (= dollars for 100/300/500 packs), email, message=`orderId`, name. Coins credit only after a signed webhook (`x-signature-sha256`): **100 coins per $1**.

In **Admin → Yechib olish** set **To'lov havolasi** and paste the BMC **Webhook signing secret**. Earnings/ledger updates from the same webhook.

Webhook URL (BMC → Integrations → New webhook):

`https://silkrood.uz/zastavka-api/webhooks/bmc`

Events: `donation.created`, `extra_purchase.created` (optional: refunds). Message/note must contain the Zastavka `orderId` (the app sets this automatically).

One-time BMC shop tips for cleanest card-only UX: enable quantity on extra `577212` (or keep PWYW), clear/disable the purchase question if you do not want a message field on BMC itself.

## Logins

- Demo user: `aziz.karimov@gmail.com` / `aziz123`
- Admin: password `ZastavkaAdmin!`

## Flutter apps (v1.0.1) — primary iOS/Android

```bash
cd flutter
flutter pub get
open ios/Runner.xcworkspace   # Xcode
flutter run
```

- Bundle ID: `com.zastavka.app`
- Version: `1.0.1` (build `2`)
- Pay → `POST /topup` → opens BMC **card checkout only** (`/extras/checkout/{cartId}`)
- Desktop builds: `Zastavka-1.0.1.ipa`, `Zastavka-1.0.1.apk`, `Zastavka-1.0.1.aab`

## Capacitor (legacy web shell)

```bash
npm install
npm run build:android   # Play / Android
npm run build:ios       # App Store / Xcode
```

Unlock/download sets the image as wallpaper on Android (Home + Lock via WallpaperManager). iOS cannot auto-set Lock/Home wallpaper; the share sheet opens so the user can tap Use as Wallpaper. Web still downloads the file.

Listing copy and screenshots:

- Play Store: `play/STORE.md`, portrait 9:16 `play/screenshots/` (1080×1920), banner `play/feature-graphic.png`. Do not upload `play/screenshots-16x9/`.
- App Store: `store/ios/STORE.md`, iPhone portrait `store/ios/screenshots/6.7/` and `6.5/`. Do not upload 16:9 landscape.
