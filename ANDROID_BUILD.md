# Building PayPulse as an Android App (Capacitor)

This project is configured with Capacitor. You build the APK on **your own
computer** — Lovable's sandbox cannot produce native Android binaries.

## One-time setup on your computer

1. **Install Android Studio**: https://developer.android.com/studio
   (Includes the Android SDK and emulator. ~5 GB.)
2. **Install Node.js 20+**: https://nodejs.org
3. **Install Git**: https://git-scm.com
4. **Connect this Lovable project to GitHub**
   (chat: Plus menu → GitHub → Connect project), then clone it locally:
   ```bash
   git clone https://github.com/<your-org>/<your-repo>.git
   cd <your-repo>
   npm install
   ```
5. **Add a `.env` file** in the project root with:
   ```
   VITE_SUPABASE_URL=https://tbmetkkkhehxfdfwrzxk.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibWV0a2traGVoeGZkZndyenhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNTQxMzUsImV4cCI6MjA5MzczMDEzNX0.yKX8zqOW7Oyv1aiof-nxMz0T_LFvGRAcDp5KVM8JM9k
   VITE_SUPABASE_PROJECT_ID=tbmetkkkhehxfdfwrzxk
   ```

## Create the Android project (only the first time)

```bash
npm run build
npx cap add android
npx cap sync android
```

This creates an `android/` folder (a real Android Studio project).

## Every time you want a new APK

```bash
git pull               # get latest changes from Lovable
npm install
npm run build          # build the web app into dist/
npx cap sync android   # copy dist/ into the Android project
npx cap open android   # opens Android Studio
```

In Android Studio:
- **Run on a connected phone/emulator**: click the green ▶ Play button.
- **Build an installable APK**:
  Menu → Build → Build Bundle(s) / APK(s) → **Build APK(s)**.
  Output: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Build for Play Store (signed AAB)**:
  Menu → Build → Generate Signed Bundle / APK → follow the wizard
  (you'll create a keystore the first time — keep it safe; you need the
  same keystore for every future update).

## Installing the APK on your phone

1. Enable **Developer options** on the phone (tap Build number 7×).
2. Enable **USB debugging** and connect by USB.
3. Either click ▶ in Android Studio, or copy `app-debug.apk` to the phone
   and tap it to install (you may need to allow "Install unknown apps").

## How updates work

- **Code changes in Lovable** → push to GitHub → on your computer
  `git pull`, then re-run the build + sync + reinstall the APK.
- **Backend / database changes** deploy automatically (they live in Lovable
  Cloud) — no APK rebuild needed for those.
- **No automatic updates** on installed APKs unless you publish to Play
  Store. Users would need a new APK each time.

## Common issues

| Symptom | Fix |
| --- | --- |
| Blank white screen in the APK | Re-run `npm run build && npx cap sync android` |
| "SDK location not found" | Open Android Studio once and let it install SDKs |
| Can't sign in / network errors | Confirm `.env` values are present before `npm run build` |
| Need a custom app icon | Replace icons in `android/app/src/main/res/mipmap-*` |
