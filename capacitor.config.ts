import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.spotifycolors.app",
  appName: "Spotify Colors",
  webDir: "dist",
  android: {
    // OAuth comes back to com.spotifycolors.app://callback — see AndroidManifest intent-filter.
    allowMixedContent: false,
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
