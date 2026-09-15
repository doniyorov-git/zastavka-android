# Zastavka — Play Store

Package name: `com.zastavka.app`  
Version: `1.0.0` (versionCode 1)

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

## Store listing

**Title:** Zastavka

**Short description:**
Wallpaper store with coins, favorites, and a clean light design.

**Full description:**
Zastavka is a wallpaper store. Browse a daily catalog, save images you like, and unlock premium wallpapers with coins.

- Email and password accounts
- Coin top-up
- Saved collection
- English, Russian, and Chinese

Privacy policy: http://130.61.247.126/zastavka/privacy.html

Icons: `play/icon-512.png`, `play/icon-1024.png`  
Feature graphic: `play/feature-graphic.png`

Phone screenshots (1080×1920, Play Console): `play/screenshots/`

1. `01-onboarding.png`
2. `02-onboarding-coins.png`
3. `03-login.png`
4. `04-register.png`
5. `05-home.png`
6. `06-saved.png`
7. `07-profile.png`
8. `08-topup.png`

## Data safety (Play Console)

- Collected: email, name, app activity (saves and purchases)
- Purpose: app functionality
- Encrypted in transit: no (HTTP API today — switch to HTTPS before a public listing)
- Users can request deletion: yes, via developer email
