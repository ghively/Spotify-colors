import { load, save } from "./storage";

const MAP_KEY = "sc.classified.v1"; // trackId -> color ids[]
const LAST_KEY = "sc.last.v1";

type Map = Record<string, string[]>;

export type LastClassification = {
  colorId: string;
  colorName: string;
  colorHex: string;
  trackId: string;
  trackName: string;
  at: number; // epoch ms
};

export function classifiedColorsFor(trackId: string): string[] {
  const m = load<Map>(MAP_KEY, {});
  return m[trackId] ?? [];
}

export function recordClassification(trackId: string, colorId: string): void {
  const m = load<Map>(MAP_KEY, {});
  const existing = new Set(m[trackId] ?? []);
  existing.add(colorId);
  m[trackId] = [...existing];
  save(MAP_KEY, m);
}

export function removeClassification(trackId: string, colorId: string): void {
  const m = load<Map>(MAP_KEY, {});
  const next = (m[trackId] ?? []).filter((c) => c !== colorId);
  if (next.length === 0) delete m[trackId];
  else m[trackId] = next;
  save(MAP_KEY, m);
}

export function loadLast(): LastClassification | null {
  return load<LastClassification | null>(LAST_KEY, null);
}

export function saveLast(value: LastClassification | null): void {
  save(LAST_KEY, value);
}

export function formatRelative(at: number, now = Date.now()): string {
  const sec = Math.max(0, Math.floor((now - at) / 1000));
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
