# Spotify Colors

A tiny PWA for classifying whatever song is playing on Spotify into a color-named
playlist. One screen: the current track on top, a grid of color buttons below.
Tap a color → the song lands in a private playlist with that color's name
(created automatically the first time).

## Features

- Sign in once with Spotify (OAuth PKCE — no server needed)
- "Now playing" card auto-refreshes every 5s
- Configurable palette (rename, recolor, add, remove colors)
- Duplicate-aware: won't add the same song twice to the same color
- Installable on Android/iOS via the browser's "Add to Home Screen"
- Offline shell + cached album art via service worker

## Local setup

1. Create a Spotify app at https://developer.spotify.com/dashboard
   - **Redirect URIs**: add `http://127.0.0.1:5173` (Spotify no longer accepts `localhost`)
   - Note the **Client ID**
2. `cp .env.example .env` and fill in `VITE_SPOTIFY_CLIENT_ID`
3. `npm install`
4. `npm run generate-pwa-assets` (one-time, regenerates PNG icons from `public/icon.svg`)
5. `npm run dev` and open http://127.0.0.1:5173

## Deploy to Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`
- Environment variables:
  - `VITE_SPOTIFY_CLIENT_ID` — your Client ID
  - `VITE_SPOTIFY_REDIRECT_URI` — your production URL (e.g. `https://colors.yourdomain.com`)
- After first deploy, add that same URL as a Redirect URI in your Spotify app dashboard.

The included `public/_redirects` handles SPA fallback so the OAuth callback works
on any URL.

## Architecture

- `src/spotify/auth.ts` — PKCE flow, token storage, refresh
- `src/spotify/api.ts` — currently-playing, playlist resolve/create, add track
- `src/hooks/useNowPlaying.ts` — polling hook (pauses when tab is hidden)
- `src/lib/palette.ts` — default colors + persistence
- `src/components/` — UI only, no Spotify calls

State lives in `localStorage`:
- `sc.tokens.v1` — access + refresh tokens
- `sc.palette.v1` — user's color palette
- `sc.playlists.v1` — cache of `colorName → playlistId`
- `sc.user.v1` — cached Spotify user id

## Scopes used

`user-read-currently-playing`, `user-read-playback-state`, `playlist-read-private`,
`playlist-modify-private`, `playlist-modify-public`.
