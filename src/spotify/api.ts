import { load, save } from "../lib/storage";
import { getAccessToken, logout } from "./auth";

const API = "https://api.spotify.com/v1";

export type Track = {
  id: string;
  uri: string;
  name: string;
  artists: string;
  album: string;
  albumImage: string | null;
};

type PlaylistCache = Record<string, string>; // colorName -> playlistId
const PLAYLISTS_KEY = "sc.playlists.v1";
const USER_KEY = "sc.user.v1";

type CachedUser = { id: string; display_name: string | null };

async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T | null> {
  const token = await getAccessToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 204) return null;
  if (res.status === 401 && retry) {
    // token might have been revoked — surface as logout
    logout();
    throw new Error("Session expired. Please sign in again.");
  }
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? "1");
    await new Promise((r) => setTimeout(r, (retryAfter + 1) * 1000));
    return api<T>(path, init, false);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Spotify ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function getMe(): Promise<CachedUser> {
  const cached = load<CachedUser | null>(USER_KEY, null);
  if (cached) return cached;
  const user = await api<CachedUser>("/me");
  if (!user) throw new Error("Could not fetch user profile.");
  save<CachedUser>(USER_KEY, { id: user.id, display_name: user.display_name });
  return user;
}

export async function getCurrentlyPlaying(): Promise<Track | null> {
  type Resp = {
    is_playing: boolean;
    item: {
      id: string;
      uri: string;
      name: string;
      artists: { name: string }[];
      album: { name: string; images: { url: string }[] };
    } | null;
  };
  const data = await api<Resp>("/me/player/currently-playing");
  if (!data || !data.item) return null;
  return {
    id: data.item.id,
    uri: data.item.uri,
    name: data.item.name,
    artists: data.item.artists.map((a) => a.name).join(", "),
    album: data.item.album.name,
    albumImage: data.item.album.images[0]?.url ?? null,
  };
}

async function findPlaylistByName(name: string): Promise<string | null> {
  type Page = {
    items: { id: string; name: string }[];
    next: string | null;
  };
  let url: string | null = `/me/playlists?limit=50`;
  while (url) {
    const page: Page | null = await api<Page>(url);
    if (!page) return null;
    for (const p of page.items) if (p.name === name) return p.id;
    url = page.next ? page.next.replace(API, "") : null;
  }
  return null;
}

async function createPlaylist(name: string): Promise<string> {
  const me = await getMe();
  type Resp = { id: string };
  const created = await api<Resp>(`/users/${me.id}/playlists`, {
    method: "POST",
    body: JSON.stringify({
      name,
      public: false,
      description: `Songs classified as ${name} — Spotify Colors`,
    }),
  });
  if (!created) throw new Error("Failed to create playlist.");
  return created.id;
}

export async function getOrCreateColorPlaylist(colorName: string): Promise<string> {
  const cache = load<PlaylistCache>(PLAYLISTS_KEY, {});
  const cached = cache[colorName];
  if (cached) return cached;
  let id = await findPlaylistByName(colorName);
  if (!id) id = await createPlaylist(colorName);
  cache[colorName] = id;
  save(PLAYLISTS_KEY, cache);
  return id;
}

async function playlistContains(playlistId: string, trackId: string): Promise<boolean> {
  type Page = {
    items: { track: { id: string | null } | null }[];
    next: string | null;
  };
  let url: string | null = `/playlists/${playlistId}/tracks?fields=items(track(id)),next&limit=100`;
  while (url) {
    const page: Page | null = await api<Page>(url);
    if (!page) return false;
    for (const it of page.items) if (it.track?.id === trackId) return true;
    url = page.next ? page.next.replace(API, "") : null;
  }
  return false;
}

export type AddResult = "added" | "duplicate";

export async function addTrackToColor(
  colorName: string,
  track: Track,
): Promise<{ result: AddResult; playlistId: string }> {
  const playlistId = await getOrCreateColorPlaylist(colorName);
  if (await playlistContains(playlistId, track.id)) {
    return { result: "duplicate", playlistId };
  }
  await api(`/playlists/${playlistId}/tracks`, {
    method: "POST",
    body: JSON.stringify({ uris: [track.uri] }),
  });
  return { result: "added", playlistId };
}

export function clearCaches(): void {
  save<PlaylistCache>(PLAYLISTS_KEY, {});
  save<CachedUser | null>(USER_KEY, null);
}
