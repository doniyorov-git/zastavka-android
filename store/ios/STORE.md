# Zastavka — App Store listing

Bundle ID: `com.zastavka.app`  
Version: `1.0.0`  
Category: Photo & Video  
Secondary: Lifestyle  
Age rating: 4+ (not directed at children under 13)  
Default language: English  
Devices: **iPhone only** (no iPad screenshots required)

## Name and text

**Name (30):** Zastavka  
**Subtitle (30):** Wallpapers & coin store  
**Promotional text:** Fresh wallpapers, coins, and a clean light design.

**Keywords (100 characters):**
wallpaper,wallpapers,coins,background,lock screen,gallery,favorites

**Description:**
Zastavka is a wallpaper store. Browse a daily catalog, save images you like, and unlock premium wallpapers with coins.

Create an account with email and password, keep a saved collection, and top up coins through Buy Me a Coffee. The app is available in English, Russian, and Chinese.

Features:
• Fresh wallpaper catalog
• Coin balance and premium unlocks
• Saved favorites
• After unlock, the iOS share sheet opens so you can tap Use as Wallpaper
• Buy Me a Coffee payments
• Light, full-screen design

iOS note: Apple does not allow App Store apps to silently set Lock or Home wallpaper via public API. Zastavka does not auto-set wallpaper on iPhone; the user chooses Use as Wallpaper in the system share sheet.

Privacy: https://silkrood.uz/zastavka/privacy.html
Terms: https://silkrood.uz/zastavka/terms.html
Support: https://silkrood.uz/zastavka/
Account deletion: https://silkrood.uz/zastavka/delete-account.html

## Local IPA (Xcode)

`cap sync ios` already copied the web build. `xcodebuild` cannot archive until the Xcode license is accepted on this Mac (`sudo xcodebuild -license`). After that, open the project or archive from the CLI. Apple does not allow the app to auto-set Lock/Home wallpaper; the share sheet is the intended path.

```bash
open "/Users/mac/Desktop/zastavka app/ios/App/App.xcodeproj"
```

```bash
cd "/Users/mac/Desktop/zastavka app"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath play/Zastavka-1.0.0.xcarchive \
  DEVELOPMENT_TEAM=95JD3HUPK8 \
  archive

xcodebuild -exportArchive -archivePath play/Zastavka-1.0.0.xcarchive \
  -exportPath play \
  -exportOptionsPlist ios/exportOptions-development.plist
```

Signing uses the local Apple Development identity (team `95JD3HUPK8`). No keystore/passwords are stored in the repo.

## Screenshots

Full-bleed iPhone portrait UI, no device mockup or bezel. PNG, 24-bit, no alpha.

**App Store Connect has no 1024×500 banner slot.** The listing hero is these portrait iPhone screenshots. Do **not** upload `store/ios/screenshots/16x9/` or any 16:9 landscape files.

- 6.7" iPhone (1290×2796): `store/ios/screenshots/6.7/`
- 6.5" iPhone (1284×2778): `store/ios/screenshots/6.5/`

Upload at least 3 per size. Suggested order:

1. `05-home.png` — catalog
2. `07-profile.png` — profile
3. `08-topup.png` — Buy Me a Coffee top-up
4. `01-onboarding.png` — onboarding (extra)
5. `06-saved.png` — saved (extra)
6. `02-onboarding-coins.png`, `03-login.png`, `04-register.png` (optional)

Optional promo image only (not an App Store Connect screenshot slot): `store/ios/banner-1024x500.png` (1024×500, same as Play feature graphic).

App icon: `store/ios/icon-1024.png` (1024×1024, no alpha, no rounded corners)

## App Review

Review notes:
- Demo login: aziz.karimov@gmail.com / aziz123
- Admin is not part of the iOS app (web: https://silkrood.uz/zastavka-admin/ password `ZastavkaAdmin!`)
- Coin top-up opens Buy Me a Coffee in the in-app browser
- Account deletion: Profile → Delete account
- Wallpaper: iOS cannot auto-set Lock/Home wallpaper. Unlock opens the share sheet; reviewer should tap Use as Wallpaper.

## Privacy nutrition labels

- Contact Info: name, email — account
- Purchases: coin top-up records
- User Content: saved wallpapers
- Identifiers: account / session
- Linked to identity: yes
- Used for tracking: no
- Used for third-party ads: no

## Payments note

Coins unlock digital wallpapers. Checkout opens Buy Me a Coffee (buymeacoffee.com/admin09wet) outside the app UI.
