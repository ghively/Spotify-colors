# Spotify Colors

A tiny app for classifying whatever song is playing on Spotify into a color-named
playlist. One screen: the current track on top, a grid of color buttons below.
Tap a color → the song lands in a private playlist with that color's name
(created automatically the first time).

Ships as both:
- a **PWA** (installable from any modern browser), and
- a **native Android APK** (Capacitor wrapper around the same React app, signed and sideloadable).

## Screenshots

<p align="center">
  <img src="docs/screenshots/01-login.png" alt="Sign-in screen" width="220" />
  <img src="docs/screenshots/02-now-playing.png" alt="Now playing with classified indicator, last-classified ticker, and live progress bar" width="220" />
  <img src="docs/screenshots/04-undo-toast.png" alt="Toast with Undo button after classifying a song" width="220" />
</p>

<p align="center">
  <img src="docs/screenshots/03-settings.png" alt="Configurable color palette" width="220" />
  <img src="docs/screenshots/05-update-banner.png" alt="In-app update available banner" width="220" />
  <img src="docs/screenshots/06-confirm-logout.png" alt="Sign-out confirmation dialog" width="220" />
</p>

<sub>Screenshots are rendered via Playwright against the live dev server with the Spotify API mocked — regenerate with <code>npm run screenshots</code> after UI changes.</sub>

## Features

- Sign in once with Spotify (OAuth PKCE — no server needed)
- "Now playing" card with live progress bar, auto-refreshes every 5s; tap to open in Spotify
- Configurable palette (rename, recolor, add, remove colors)
- Already-classified swatches show a checkmark so you never have to wonder if a song's been sorted
- "Last: Blue · 2 min ago" status line confirms the previous tap landed
- One-tap **Undo** in the post-classification toast removes the song from the playlist
- Native haptic feedback on Android color taps
- Duplicate-aware: won't add the same song twice to the same color
- In-app update check (compares against a `version.json` on your PWA host) with a direct download link
- Offline shell + cached album art via service worker
- Same React codebase for web and Android

## Spotify Developer setup (one-time)

At https://developer.spotify.com/dashboard, in **your app → Settings → Redirect URIs** add **all** of these:

| Environment | Redirect URI |
| --- | --- |
| Local web dev | `http://127.0.0.1:5173` |
| Production PWA | your deployed URL, e.g. `https://colors.yourdomain.com` |
| Android app | `com.spotifycolors.app://callback` |

Note your Client ID — you'll put it in `.env`.

## Local web setup

1. `cp .env.example .env` and fill in `VITE_SPOTIFY_CLIENT_ID`
2. `npm install`
3. `npm run generate-pwa-assets` (one-time, generates PNG icons from `public/icon.svg`)
4. `npm run dev` and open http://127.0.0.1:5173

## Deploy PWA to Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`
- Environment variables:
  - `VITE_SPOTIFY_CLIENT_ID`
  - `VITE_SPOTIFY_REDIRECT_URI` — your production URL (e.g. `https://colors.yourdomain.com`)

`public/_redirects` handles SPA fallback so the OAuth callback works on any URL.

## Android APK

The Android app is a Capacitor wrapper around the same React build. Same UX, real Android app icon, fullscreen, offline-capable. OAuth comes back to the app via the custom URI scheme `com.spotifycolors.app://callback`.

### Prerequisites
- JDK 17
- Android SDK with platforms `android-36` and build-tools `36.0.0`
- `ANDROID_HOME` / `ANDROID_SDK_ROOT` env var pointing to the SDK

### Debug APK (for personal sideload)

```sh
npm run android:apk:debug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

The debug APK is auto-signed with Android's debug keystore. It installs fine via "Install unknown apps". For one-person sideload this is enough.

### Release APK (signed)

1. Generate a keystore (once):
   ```sh
   keytool -genkey -v -keystore release.keystore -alias spotifycolors \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Create `android/keystore.properties` (gitignored):
   ```properties
   storeFile=../../release.keystore
   storePassword=YOUR_STORE_PASSWORD
   keyAlias=spotifycolors
   keyPassword=YOUR_KEY_PASSWORD
   ```
3. Build:
   ```sh
   npm run android:apk:release
   # Output: android/app/build/outputs/apk/release/app-release.apk
   ```

### Installing on her phone
- Email / AirDrop / Google Drive the APK to her phone
- Tap the APK file → Android prompts "Allow this source to install apps" → done
- App icon "Spotify Colors" appears in her launcher

### Updating the app
After any code change:
```sh
npm run android:apk:debug   # or :release
```
She reinstalls the new APK over the old one (same signing key required for release builds).

### Customizing the icon

Source SVG is `public/icon.svg`. After editing:
```sh
node -e "require('sharp')('public/icon.svg',{density:1024}).resize(1024,1024).png().toFile('assets/icon.png')"
npx capacitor-assets generate --android
npm run android:sync
```

## Architecture

- `src/spotify/auth.ts` — PKCE flow, token storage, refresh. Detects native platform and uses `com.spotifycolors.app://callback` + `@capacitor/app` deep-link listener instead of `window.location` redirect.
- `src/spotify/api.ts` — currently-playing, playlist resolve/create, add track. Duplicate detection.
- `src/hooks/useNowPlaying.ts` — polling hook (pauses when tab is hidden).
- `src/lib/palette.ts` — default colors + persistence.
- `src/components/` — UI only, no Spotify calls.
- `capacitor.config.ts` — bundle ID `com.spotifycolors.app`, web dir `dist`.
- `android/` — generated Android project, manifest contains the `com.spotifycolors.app://callback` intent filter.

State lives in `localStorage`:
- `sc.tokens.v1` — access + refresh tokens
- `sc.palette.v1` — user's color palette
- `sc.playlists.v1` — cache of `colorName → playlistId`
- `sc.user.v1` — cached Spotify user id

## Scopes used

`user-read-currently-playing`, `user-read-playback-state`, `playlist-read-private`,
`playlist-modify-private`, `playlist-modify-public`.
