# Zastavka — Play Store listing

Package name: `com.zastavka.app`  
Version: `1.0.0` (versionCode 1)  
Category: Personalization  
Content rating: Everyone / PEGI 3  
Default language: English  

## Phone install (debug)

`play/Zastavka-1.0.0-debug.apk`

Also: `android/app/build/outputs/apk/debug/app-debug.apk`

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

Create an account with email and password, keep a saved collection, and top up coins through a secure checkout. The app is available in English, Russian, and Chinese.

Features:
• Fresh wallpaper catalog
• Coin balance and premium unlocks
• Saved favorites
• Secure hosted payments
• Light, full-screen design

Privacy policy: https://130.61.247.126.sslip.io/zastavka/privacy.html
Terms: https://130.61.247.126.sslip.io/zastavka/terms.html

## Graphics

- App icon: `play/icon-512.png` (512×512)
- High-res icon: `play/icon-1024.png`
- Feature graphic: `play/feature-graphic.png` (1024×500)
- Phone screenshots (1080×1920, 2–8 images): `play/screenshots/`

1. `01-onboarding.png`
2. `02-onboarding-coins.png`
3. `03-login.png`
4. `04-register.png`
5. `05-home.png`
6. `06-saved.png`
7. `07-profile.png`
8. `08-topup.png`

## Data safety

- Collected: name, email, app activity (saves, wallpaper unlocks, coin top-ups)
- Shared: name, email, and order amount with the payment processor to complete checkout
- Purpose: app functionality, account, payments
- Encrypted in transit: yes (HTTPS)
- Users can request deletion: yes, via developer email

## Live URLs

- Store: https://130.61.247.126.sslip.io/zastavka/
- Admin: https://130.61.247.126.sslip.io/zastavka-admin/
- API: https://130.61.247.126.sslip.io/zastavka-api/
- Privacy: https://130.61.247.126.sslip.io/zastavka/privacy.html
