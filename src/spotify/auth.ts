import { load, remove, save } from "../lib/storage";

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;
const REDIRECT_URI =
  (import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string | undefined) ??
  window.location.origin;

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

export function getClientIdHint(): string | undefined {
  return CLIENT_ID;
}

export function getRedirectUri(): string {
  return REDIRECT_URI;
}

export async function beginLogin(): Promise<void> {
  if (!CLIENT_ID) throw new Error("VITE_SPOTIFY_CLIENT_ID is not set.");
  const verifier = randomVerifier();
  const challenge = b64url(await sha256(verifier));
  sessionStorage.setItem(VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SCOPES,
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
}

export async function handleRedirectCallback(): Promise<boolean> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error) {
    sessionStorage.removeItem(VERIFIER_KEY);
    cleanUrl();
    throw new Error(`Spotify auth error: ${error}`);
  }
  if (!code) return false;
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier || !CLIENT_ID) {
    cleanUrl();
    return false;
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: verifier,
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    cleanUrl();
    throw new Error(`Token exchange failed: ${res.status}`);
  }
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
  cleanUrl();
  return true;
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
