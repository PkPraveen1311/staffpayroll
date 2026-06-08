# Signing PayPulse for Play Store (Release APK / AAB)

This guide sets up **release signing** so Android Studio (or Gradle CLI) can
produce a signed `app-release.apk` or `app-release.aab` ready for Play Store
upload. Do this **once per machine**. Keep your keystore safe — losing it
means you can never update the app on Play Store again.

> Prerequisite: you've already run `npx cap add android` (see `ANDROID_BUILD.md`).

---

## 1. Generate a keystore (one time, ever)

In a terminal, from the project root:

```bash
keytool -genkey -v \
  -keystore paypulse-release.keystore \
  -alias paypulse \
  -keyalg RSA -keysize 2048 -validity 10000
```

It will ask for:
- A **keystore password** (remember it)
- A **key password** (use the same as keystore for simplicity)
- Your name / org / city / country

Output: `paypulse-release.keystore` in the project root.

### 🔒 Back this file up NOW

Copy `paypulse-release.keystore` + the passwords to:
- A password manager (1Password / Bitwarden), AND
- An encrypted cloud backup (Google Drive / iCloud / Dropbox)

**If you lose this file, Google Play will not let you publish updates.**
Move it OUT of the project folder after backing up so it never gets committed.

A suggested permanent location:
- macOS / Linux: `~/.android-keystores/paypulse-release.keystore`
- Windows: `C:\Users\<you>\.android-keystores\paypulse-release.keystore`

---

## 2. Create `android/keystore.properties`

After `npx cap add android` has created the `android/` folder, create
`android/keystore.properties` with your real values:

```properties
storeFile=/Users/you/.android-keystores/paypulse-release.keystore
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=paypulse
keyPassword=YOUR_KEY_PASSWORD
```

Use an **absolute path** for `storeFile`. On Windows use forward slashes:
`C:/Users/you/.android-keystores/paypulse-release.keystore`.

### Make sure it never gets committed

Add to `android/.gitignore` (create if missing):

```
keystore.properties
*.keystore
*.jks
```

---

## 3. Wire signing into `android/app/build.gradle`

Open `android/app/build.gradle` and make these edits.

**a) At the very top of the file** (before `apply plugin: ...`):

```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

**b) Inside the `android { ... }` block**, add a `signingConfigs` section
(place it above `buildTypes`):

```gradle
signingConfigs {
    release {
        if (keystorePropertiesFile.exists()) {
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }
    }
}
```

**c) In `buildTypes.release`**, attach the signing config and enable
minification (recommended for Play Store):

```gradle
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

---

## 4. Set the version for each release

In `android/app/build.gradle`, inside `defaultConfig`, bump these every release:

```gradle
versionCode 2          // must increase by 1 for every Play Store upload
versionName "1.0.1"    // human-readable, e.g. semver
```

Play Store rejects uploads that don't increase `versionCode`.

---

## 5. Build the signed artifact

```bash
npm run build
npx cap sync android
cd android
./gradlew bundleRelease    # AAB → recommended for Play Store
# OR
./gradlew assembleRelease  # APK → for sideloading / testing
```

Output:
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- APK: `android/app/build/outputs/apk/release/app-release.apk`

Or in Android Studio: **Build → Generate Signed Bundle / APK** and pick the
existing keystore (it will auto-fill from `keystore.properties` if you
re-select the file).

---

## 6. Upload to Play Console

1. https://play.google.com/console → create app.
2. **Production → Create new release → Upload** the `.aab`.
3. Fill in store listing, content rating, data safety.
4. Submit for review (usually a few hours to a few days).

For subsequent releases: bump `versionCode` + `versionName`, rebuild, upload
the new AAB to a new release.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Keystore file not found` | Check `storeFile` path in `keystore.properties` is absolute and correct |
| `Wrong password` / `keystore was tampered with` | Re-enter the password you set in step 1 |
| Play Console: "You uploaded an APK that is not signed with the upload key" | You're using a different keystore than your first upload — use the original one. If lost, contact Play support for a key reset (slow). |
| Play Console: "Version code X has already been used" | Bump `versionCode` in `build.gradle` |
| Release build crashes but debug works | Minification stripped something — add ProGuard `-keep` rules in `android/app/proguard-rules.pro` |
