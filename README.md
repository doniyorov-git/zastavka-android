
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
