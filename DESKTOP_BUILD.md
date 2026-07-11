# Building PayPulse as a Desktop App (Windows / Mac / Linux)

This packages PayPulse as an installable desktop app using **Electron**.
The app opens in its own native window (no browser, no address bar) and
points at your published Lovable site (`https://staffpayroll.lovable.app`),
so all features — employees, attendance, payroll, advances, PDF/Excel
exports — work exactly like the web version.

> **About offline use:** the app needs internet to load and save data
> (employees, attendance, payroll all live in Lovable Cloud). A page
> already loaded will keep showing until you navigate. True offline
> data isn't possible without rebuilding the backend to store on your PC.

You build the installer on **your own computer** — Lovable's sandbox
cannot produce Windows/Mac binaries.

---

## One-time setup on your computer

1. **Install Node.js 20+**: https://nodejs.org
2. **Install Git**: https://git-scm.com
3. **Connect this Lovable project to GitHub** (chat: Plus menu → GitHub →
   Connect project), then clone it and install dev deps:

```bash
git clone https://github.com/<your-org>/<your-repo>.git
cd <your-repo>
npm install
npm install --save-dev electron @electron/packager
```

4. *(Optional)* Drop a 512×512 PNG at `electron/icon.png` — it becomes
   the app icon. Skip this and Electron uses its default icon.

---

## Build an installable app

Pick the platform you want. Run from the project root.

### Windows (`.exe` folder you can zip and share)

```bash
npx @electron/packager . "PayPulse" \
  --platform=win32 --arch=x64 \
  --out=desktop-release --overwrite \
  --icon=electron/icon.png \
  --ignore="^/(android|src|public|supabase|dist|node_modules/.cache)"
```

Output: `desktop-release/PayPulse-win32-x64/PayPulse.exe` — double-click
to run. Zip the whole `PayPulse-win32-x64` folder to share it.

### macOS (`.app` you can drag to Applications)

```bash
npx @electron/packager . "PayPulse" \
  --platform=darwin --arch=arm64 \
  --out=desktop-release --overwrite \
  --icon=electron/icon.png \
  --ignore="^/(android|src|public|supabase|dist|node_modules/.cache)"
```

Use `--arch=x64` for Intel Macs. Output: `desktop-release/PayPulse-darwin-*/PayPulse.app`.

### Linux

```bash
npx @electron/packager . "PayPulse" \
  --platform=linux --arch=x64 \
  --out=desktop-release --overwrite \
  --icon=electron/icon.png \
  --ignore="^/(android|src|public|supabase|dist|node_modules/.cache)"
```

Output: `desktop-release/PayPulse-linux-x64/PayPulse` — run it directly.

---

## Installing on your PC

**Windows:** unzip the `PayPulse-win32-x64` folder anywhere (e.g.
`C:\Program Files\PayPulse`), right-click `PayPulse.exe` →
"Pin to Start" or "Send to → Desktop (create shortcut)".

**macOS:** drag `PayPulse.app` to your Applications folder. First launch
may need System Settings → Privacy & Security → "Open Anyway".

**Linux:** make executable (`chmod +x PayPulse`) and run.

---

## Updating

Because the app loads your live Lovable site, **any change you make in
Lovable and publish is instantly visible in the desktop app** — no
rebuild, no re-install. You only need to rebuild the installer if you
change `electron/main.cjs` (the window itself).

---

## Common issues

| Symptom | Fix |
| --- | --- |
| App opens blank | Check internet connection; the app loads from `https://staffpayroll.lovable.app` |
| "Cannot find module electron" | Run `npm install --save-dev electron @electron/packager` |
| Windows SmartScreen blocks it | Click "More info" → "Run anyway" (unsigned apps trigger this) |
| macOS says "damaged / can't be opened" | System Settings → Privacy & Security → "Open Anyway", or run `xattr -cr /Applications/PayPulse.app` |
| Want a custom URL (e.g. your own domain) | Set env var `PAYPULSE_URL=https://your-domain.com` before launching, or edit `APP_URL` in `electron/main.cjs` |
