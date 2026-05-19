import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp, type URLOpenListenerEvent } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { load, remove, save } from "../lib/storage";

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;

const NATIVE_REDIRECT_URI = "com.spotifycolors.app://callback";
const WEB_REDIRECT_URI =
  (import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string | undefined) ??
  (typeof window !== "undefined" ? window.location.origin : "");

const SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "playlist-read-private",
  "playlist-modify-private",
  "playlist-modify-public",
].join(" ");

const TOKEN_KEY = "sc.tokens.v1";
const VERIFIER_KEY = "sc.pkce_verifier";

type TokenSet = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
};

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function redirectUri(): string {
  return isNative() ? NATIVE_REDIRECT_URI : WEB_REDIRECT_URI;
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomVerifier(length = 64): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return b64url(arr);
}

async function sha256(input: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
}

export function isConfigured(): boolean {
  return Boolean(CLIENT_ID);
}

export function getRedirectUri(): string {
  return redirectUri();
}

export function getPlatform(): "web" | "android" | "ios" {
  if (!isNative()) return "web";
  return Capacitor.getPlatform() === "ios" ? "ios" : "android";
}

async function buildAuthUrl(): Promise<string> {
  if (!CLIENT_ID) throw new Error("VITE_SPOTIFY_CLIENT_ID is not set.");
  const verifier = randomVerifier();
  const challenge = b64url(await sha256(verifier));
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri(),
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SCOPES,
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

async function exchangeCode(code: string): Promise<void> {
  if (!CLIENT_ID) throw new Error("VITE_SPOTIFY_CLIENT_ID is not set.");
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error("Missing PKCE verifier.");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    client_id: CLIENT_ID,
    code_verifier: verifier,
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  sessionStorage.removeItem(VERIFIER_KEY);
  save<TokenSet>(TOKEN_KEY, {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + (json.expires_in - 60) * 1000,
  });
}

export async function beginLogin(): Promise<void> {
  const url = await buildAuthUrl();
  if (isNative()) {
    await Browser.open({ url, presentationStyle: "popover" });
  } else {
    window.location.assign(url);
  }
}

export async function handleRedirectCallback(): Promise<boolean> {
  if (isNative()) return false;
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error) {
    sessionStorage.removeItem(VERIFIER_KEY);
    cleanUrl();
    throw new Error(`Spotify auth error: ${error}`);
  }
  if (!code) return false;
  try {
    await exchangeCode(code);
    return true;
  } finally {
    cleanUrl();
  }
}

/**
 * On Android, Spotify redirects to com.spotifycolors.app://callback?code=...
 * which Android delivers to the app via App.appUrlOpen. Returns an unsubscribe fn.
 */
export function listenForNativeRedirect(onComplete: (ok: boolean, err?: Error) => void): () => void {
  if (!isNative()) return () => {};
  let removed = false;
  const handlePromise = CapacitorApp.addListener(
    "appUrlOpen",
    async (event: URLOpenListenerEvent) => {
      try {
        const u = new URL(event.url);
        const code = u.searchParams.get("code");
        const error = u.searchParams.get("error");
        if (error) {
          await Browser.close().catch(() => undefined);
          onComplete(false, new Error(`Spotify auth error: ${error}`));
          return;
        }
        if (!code) return;
        await exchangeCode(code);
        await Browser.close().catch(() => undefined);
        onComplete(true);
      } catch (e) {
        onComplete(false, e as Error);
      }
    },
  );
  return () => {
    if (removed) return;
    removed = true;
    void handlePromise.then((h) => h.remove());
  };
}

function cleanUrl(): void {
  const u = new URL(window.location.href);
  u.searchParams.delete("code");
  u.searchParams.delete("state");
  u.searchParams.delete("error");
  window.history.replaceState({}, document.title, u.pathname + u.search + u.hash);
}

export function isLoggedIn(): boolean {
  return load<TokenSet | null>(TOKEN_KEY, null) !== null;
}

export function logout(): void {
  remove(TOKEN_KEY);
}

async function refresh(tokens: TokenSet): Promise<TokenSet> {
  if (!CLIENT_ID) throw new Error("VITE_SPOTIFY_CLIENT_ID is not set.");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: CLIENT_ID,
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    logout();
    throw new Error(`Refresh failed: ${res.status}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  const next: TokenSet = {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? tokens.refresh_token,
    expires_at: Date.now() + (json.expires_in - 60) * 1000,
  };
  save<TokenSet>(TOKEN_KEY, next);
  return next;
}

export async function getAccessToken(): Promise<string> {
  let tokens = load<TokenSet | null>(TOKEN_KEY, null);
  if (!tokens) throw new Error("Not logged in.");
  if (Date.now() >= tokens.expires_at) tokens = await refresh(tokens);
  return tokens.access_token;
}
