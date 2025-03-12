import { defineConfig } from "vitest/config";

/// <reference types="@vitest/browser/providers/playwright" />
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: "playwright",

      // Headless mode configured at BrowserConfigOptions.headless
      headless: true,

      instances: [
        {
          // Headless mode also configured in `BrowserInstanceOption`.
          headless: true,

          browser: "chromium",
        },
      ],

      // The resulting launch options sent to the browser for this config
      // includes `headless: true` from BrowserConfigOptions.
    },
  },
});
