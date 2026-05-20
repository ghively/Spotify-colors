import { Capacitor } from "@capacitor/core";

let hapticsPromise: Promise<typeof import("@capacitor/haptics") | null> | null = null;

async function getHaptics() {
  if (!Capacitor.isNativePlatform()) return null;
  if (!hapticsPromise) hapticsPromise = import("@capacitor/haptics").catch(() => null);
  return hapticsPromise;
}

export async function tap(): Promise<void> {
  const m = await getHaptics();
  if (!m) return;
  try {
    await m.Haptics.impact({ style: m.ImpactStyle.Light });
  } catch {
    // best-effort
  }
}

export async function success(): Promise<void> {
  const m = await getHaptics();
  if (!m) return;
  try {
    await m.Haptics.notification({ type: m.NotificationType.Success });
  } catch {
    // best-effort
  }
}
