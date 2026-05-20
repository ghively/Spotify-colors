const CHECK_URL = import.meta.env.VITE_UPDATE_CHECK_URL as string | undefined;
const DOWNLOAD_URL = import.meta.env.VITE_UPDATE_DOWNLOAD_URL as string | undefined;
const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "0.0.0";

export type UpdateInfo = {
  current: string;
  latest: string;
  downloadUrl: string | null;
};

function toParts(v: string): number[] {
  return v.split(".").map((p) => Number.parseInt(p, 10) || 0);
}

function newer(a: string, b: string): boolean {
  const pa = toParts(a);
  const pb = toParts(b);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return true;
    if (da < db) return false;
  }
  return false;
}

export function getAppVersion(): string {
  return APP_VERSION;
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!CHECK_URL) return null;
  try {
    const res = await fetch(CHECK_URL, { cache: "no-cache" });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    if (!data?.version) return null;
    if (!newer(data.version, APP_VERSION)) return null;
    return {
      current: APP_VERSION,
      latest: data.version,
      downloadUrl: DOWNLOAD_URL ?? null,
    };
  } catch {
    return null;
  }
}
