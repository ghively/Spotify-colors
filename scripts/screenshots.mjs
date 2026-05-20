import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const outDir = resolve(root, "docs/screenshots");
const PORT = 5180;
const ORIGIN = `http://127.0.0.1:${PORT}`;

const MOCK_ALBUM_ART = makeAlbumArt();
const DURATION_MS = 213_000; // 3:33
const PROGRESS_MS = 91_500; // ~43%

async function main() {
  await mkdir(outDir, { recursive: true });

  console.log("Starting dev server...");
  const dev = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
    cwd: root,
    env: {
      ...process.env,
      VITE_SPOTIFY_CLIENT_ID: "mock_client_id",
      VITE_SPOTIFY_REDIRECT_URI: ORIGIN,
      VITE_UPDATE_CHECK_URL: `${ORIGIN}/__mock_version__.json`,
      VITE_UPDATE_DOWNLOAD_URL: "https://example.com/releases",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer(ORIGIN);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });

  await context.route("**/__mock_version__.json", (route) =>
    route.fulfill({ json: { version: "0.2.0", builtAt: new Date().toISOString() } }),
  );
  await context.route("**://api.spotify.com/**", (route) => mockSpotify(route));

  // 1) Login screen
  {
    const page = await context.newPage();
    await page.goto(ORIGIN, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Sign in with Spotify");
    await page.screenshot({ path: `${outDir}/01-login.png` });
    await page.close();
    console.log("✓ 01-login.png");
  }

  // Authenticated state — seed tokens, pre-classify Blue, set a "last"
  await context.addInitScript(() => {
    localStorage.setItem(
      "sc.tokens.v1",
      JSON.stringify({
        access_token: "demo_access",
        refresh_token: "demo_refresh",
        expires_at: Date.now() + 60 * 60 * 1000,
      }),
    );
    localStorage.setItem(
      "sc.classified.v1",
      JSON.stringify({ demo_track_1: ["blue"] }),
    );
    localStorage.setItem(
      "sc.last.v1",
      JSON.stringify({
        colorId: "blue",
        colorName: "Blue",
        colorHex: "#1e88e5",
        trackId: "demo_track_1",
        trackName: "Aurora Tide",
        at: Date.now() - 90_000,
      }),
    );
  });

  // 2) Main screen: progress bar, last-classified line, Blue swatch checked
  {
    const page = await context.newPage();
    await page.goto(ORIGIN, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Aurora Tide");
    await page.waitForSelector(".np-progress-fill");
    await dismissUpdateBanner(page);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${outDir}/02-now-playing.png` });
    console.log("✓ 02-now-playing.png");

    // 3) Settings sheet
    await page.click('[aria-label="Open settings"]');
    await page.waitForSelector("text=Palette");
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${outDir}/03-settings.png` });
    console.log("✓ 03-settings.png");
    await page.close();
  }

  // 4) Toast with Undo action after classifying Red (not yet classified)
  {
    const page = await context.newPage();
    await page.goto(ORIGIN, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Aurora Tide");
    await dismissUpdateBanner(page);
    await page.locator(".swatch", { hasText: "Red" }).click();
    await page.waitForSelector("text=Added to Red");
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${outDir}/04-undo-toast.png` });
    console.log("✓ 04-undo-toast.png");
    await page.close();
  }

  // 5) Update banner
  {
    const page = await context.newPage();
    await page.goto(ORIGIN, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Update available");
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${outDir}/05-update-banner.png` });
    console.log("✓ 05-update-banner.png");
    await page.close();
  }

  // 6) Logout confirm dialog
  {
    const page = await context.newPage();
    await page.goto(ORIGIN, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Aurora Tide");
    await dismissUpdateBanner(page);
    await page.click('[aria-label="Open settings"]');
    await page.waitForSelector("text=Sign out of Spotify");
    await page.click("text=Sign out of Spotify");
    await page.waitForSelector("text=Sign out of Spotify?");
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${outDir}/06-confirm-logout.png` });
    console.log("✓ 06-confirm-logout.png");
    await page.close();
  }

  await browser.close();
  dev.kill("SIGTERM");
  console.log(`\nScreenshots in ${outDir}`);
}

async function dismissUpdateBanner(page) {
  const banner = page.locator(".update-banner");
  if (await banner.count()) {
    await banner.locator('[aria-label="Dismiss"]').click().catch(() => undefined);
  }
}

async function mockSpotify(route) {
  const u = new URL(route.request().url());
  const p = u.pathname;
  const method = route.request().method();

  if (p === "/v1/me") {
    return route.fulfill({ json: { id: "demo_user", display_name: "Demo" } });
  }
  if (p === "/v1/me/player/currently-playing") {
    return route.fulfill({
      json: {
        is_playing: true,
        progress_ms: PROGRESS_MS,
        item: {
          id: "demo_track_1",
          uri: "spotify:track:demo_track_1",
          name: "Aurora Tide",
          duration_ms: DURATION_MS,
          artists: [{ name: "Lumen Bay" }, { name: "Solenne" }],
          album: { name: "Northern Mirrors", images: [{ url: MOCK_ALBUM_ART }] },
        },
      },
    });
  }
  if (p === "/v1/me/playlists") {
    return route.fulfill({ json: { items: [], next: null } });
  }
  if (p.startsWith("/v1/users/") && p.endsWith("/playlists")) {
    return route.fulfill({ json: { id: "new_playlist_id" } });
  }
  if (p.startsWith("/v1/playlists/") && p.endsWith("/tracks")) {
    if (method === "GET") return route.fulfill({ json: { items: [], next: null } });
    return route.fulfill({ json: { snapshot_id: "snap" } });
  }
  return route.fulfill({ json: {} });
}

async function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Dev server did not start at ${url}`);
}

function makeAlbumArt() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#3b1d6e"/>
        <stop offset="0.5" stop-color="#0e5a8a"/>
        <stop offset="1" stop-color="#1bb0a0"/>
      </linearGradient>
    </defs>
    <rect width="300" height="300" fill="url(#g)"/>
    <circle cx="220" cy="80" r="50" fill="#f5e0a0" opacity="0.85"/>
    <path d="M0 220 Q75 180 150 220 T300 220 L300 300 L0 300 Z" fill="#0e3a5a" opacity="0.7"/>
    <path d="M0 250 Q75 220 150 250 T300 250 L300 300 L0 300 Z" fill="#062441" opacity="0.85"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
