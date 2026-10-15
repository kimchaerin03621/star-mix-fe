import { defineConfig } from '@playwright/test';

// Demo recording: a visible Chrome on the real GPU (no software rendering), with
// the page captured together with its sound. Run with `npm run demo:record`.
export default defineConfig({
  testDir: './demo',
  testMatch: '*.spec.js',
  timeout: 300_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5174',
    channel: 'chrome',
    headless: false,
    // Film the real window (no viewport emulation, which leaves bars in the capture).
    viewport: null,
    launchOptions: {
      // No fake-device flags here: they would also fake the tab capture and film a
      // test pattern. The app's camera request is answered in the spec instead.
      args: [
        '--autoplay-policy=no-user-gesture-required',
        '--auto-accept-this-tab-capture',
        '--window-position=0,0',
        // Page area ends up 1440x810 (16:9) once Chrome's "sharing" bar (56px), the
        // tab strip and the window frame (13x93px) are taken off.
        '--window-size=1453,959',
      ],
    },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
