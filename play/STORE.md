# Zastavka — Play Store listing

Package name: `com.zastavka.app`  
Version: `1.0.0` (versionCode 1)  
Category: Personalization  
Content rating: Everyone / PEGI 3  
Default language: English  
Target audience: 13+ (not directed at children)

## Phone install (debug)

`play/Zastavka-1.0.0-debug.apk`

## Play upload (release AAB)

1. Create your own signing key (keep this file forever):

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
mkdir -p android/keystore
cp android/keystore.properties.example android/keystore.properties
keytool -genkeypair -keystore android/keystore/zastavka-release.jks \
  -alias zastavka -keyalg RSA -keysize 2048 -validity 10000
```

2. Put the same passwords into `android/keystore.properties`.

3. Build the Play bundle:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export ANDROID_HOME=$HOME/Library/Android/sdk
npm run build:android
cd android && ./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

## Store listing copy

**App name (30):** Zastavka

**Short description (80):**
Wallpaper store with coins, favorites, and a clean light design.

**Full description:**
Zastavka is a wallpaper store. Browse a daily catalog, save images you like, and unlock premium wallpapers with coins.

Create an account with email and password, keep a saved collection, and top up coins through Buy Me a Coffee. The app is available in English, Russian, and Chinese.

Features:
• Fresh wallpaper catalog
• Coin balance and premium unlocks
• Saved favorites
• Set as Home and Lock wallpaper on Android (WallpaperManager, not gallery-only)
• Buy Me a Coffee payments
• Light, full-screen design

Privacy policy: https://silkrood.uz/zastavka/privacy.html
Terms: https://silkrood.uz/zastavka/terms.html
Account deletion: https://silkrood.uz/zastavka/delete-account.html

## Graphics

JPEG or 24-bit PNG, no alpha. **Upload 9:16 portrait phone screenshots. Do not upload `play/screenshots-16x9/` (landscape / desktop — rejected for this listing).**

- App icon: `play/icon-512.png` (512×512, 24-bit PNG)
- Feature graphic / banner: `play/feature-graphic.png` (1024×500, RGB, no alpha)
- Phone screenshots (1080×1920, 9:16, full-bleed mobile UI, no device frame): `play/screenshots/`

Play Console → Phone screenshots. Minimum 2, use at least 3. Upload order:

1. `05-home.png` — catalog
2. `07-profile.png` — profile
3. `08-topup.png` — Buy Me a Coffee top-up
4. `01-onboarding.png` — onboarding (extra)
5. `06-saved.png` — saved (extra)
6. `02-onboarding-coins.png`, `03-login.png`, `04-register.png` (optional extras)

## Data safety (Play Console)

- Collected: name, email, app activity (saves, wallpaper unlocks, coin top-ups)
- Shared: name, email, and order amount with Buy Me a Coffee to complete checkout
- Purpose: app functionality, account management, payments
- Encrypted in transit: yes (HTTPS)
- Sold: no
- Used for ads / tracking: no
- Users can request deletion: yes
  - In-app: Profile → Delete account
  - Web: https://silkrood.uz/zastavka/delete-account.html

## Account deletion (required)

Play Console → App content → Data safety / Account deletion URL:

`https://silkrood.uz/zastavka/delete-account.html`

## Live URLs

- Store: https://silkrood.uz/zastavka/
- Admin: https://silkrood.uz/zastavka-admin/  (password `ZastavkaAdmin!`)
- API: https://silkrood.uz/zastavka-api/
- Privacy: https://silkrood.uz/zastavka/privacy.html
- Demo login: `aziz.karimov@gmail.com` / `aziz123`
