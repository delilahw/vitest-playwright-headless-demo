import { defineConfig } from "vitest/config";

/// <reference types="@vitest/browser/providers/playwright" />
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: "playwright",

      // Headless mode omitted from BrowserConfigOptions.headless
      // headless: true,

      instances: [
        {
          // Headless mode only configured in `BrowserInstanceOption`.
          headless: true,

          browser: "chromium",
        },
      ],

      // The resulting launch options sent to the browser for this config
      // includes `headless: false` from BrowserConfigOptions. The
      // BrowserInstanceOption.headless value is overridden at line 73 from
      // https://github.com/vitest-dev/vitest/blob/470cbec1f91bd3cb0aa604077fa288c4a6e1c2b9/packages/browser/src/node/providers/playwright.ts#L70-L73.
    },
  },
});
