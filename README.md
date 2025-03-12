# Vitest Playwright Headless Mode Config Resolution Issue Demo

Vitest Browser's Playwright Provider does not resolve configuration values for headless mode correctly. This repository contains a minimal reproducible example of the issue.

## Headless Configuration Settings

In `vitest.config.ts`, the `headless` option can be set in two different places.

1. In [`BrowserConfigOptions.headless`](https://github.com/vitest-dev/vitest/blob/470cbec1f91bd3cb0aa604077fa288c4a6e1c2b9/packages/vitest/src/node/types/browser.ts#L123-L128).

```ts
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: "playwright",

      headless: true,
    },
  },
});
```

2. In `BrowserConfigOptions.instances[]`, which is an array of [`BrowserInstanceOption`](https://github.com/vitest-dev/vitest/blob/470cbec1f91bd3cb0aa604077fa288c4a6e1c2b9/packages/vitest/src/node/types/browser.ts#L71).

```ts
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: "playwright",

      instances: [
        {
          browser: "chromium",
          headless: true,
        },
      ],
    },
  },
});
```

Both of the approaches above will pass type-checking, but only Scenario 1 will launch the browser with headless mode enabled. Scenario 2 will not work as expected, and the tests will run in headed mode.

## Reproduction Steps

Please see https://github.com/delilahw/vitest-playwright-headless-demo for a minimal example. Clone the repository and use `pnpm i` to install dependencies.

Then, you can verify the behaviour by enabling debug logs in Playwright and inspecting the output for the `headless` option. It will be printed after the line containing `"browserType.launch started"`.

```sh
# Launch Scenario 2
$ DEBUG='pw:*' pnpm test:browser -c vitest.config.headless-instance.ts &| tee test-instance.log

$ cat test-instance.log | grep -A3 'browserType.launch started'
# Notice the `headless` option being set to false in the below JSON.
2025-03-12T04:04:06.823Z pw:api => browserType.launch started
2025-03-12T04:04:06.823Z pw:channel SEND> {"id":1,"guid":"browser-type@6b4a60839944b8891fb59ce7131b8330","method":"launch","params":{"args":["--start-maximized"],"ignoreAllDefaultArgs":false,"headless":false}}

# Browser command/args and its PID will also be printed here.
# Notice that `--headless` is not present in the below args.
2025-03-12T04:04:06.826Z pw:browser <launching> ms-playwright/chromium-1161/chrome-mac/Chromium.app/Contents/MacOS/Chromium --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-extensions --disable-features=AcceptCHFrame,AutoExpandDetailsElement,AvoidUnnecessaryBeforeUnloadCheckSync,CertificateTransparencyComponentUpdater,DeferRendererTasksAfterInput,DestroyProfileOnBrowserClose,DialMediaRouteProvider,ExtensionManifestV2Disabled,GlobalMediaControls,HttpsUpgrades,ImprovedCookieControls,LazyFrameLoading,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --enable-automation --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --enable-use-zoom-for-dsf=false --no-sandbox --start-maximized --user-data-dir=/tmp/1/playwright_chromiumdev_profile --remote-debugging-pipe --no-startup-window
2025-03-12T04:04:06.827Z pw:browser <launched> pid=88938
```

You can check the `headless: true | false` output for various scenarios by swapping out the `-c <config file>` argument with the different config files below.
| Config File | `BrowserConfigOptions.headless` Value | `BrowserConfigOptions.instances[].headless` Value | Actual Behaviour | Expected Behaviour | Notes |
|-------------|-------------------------------------|--------------------------------------------------|---------------------|--------------------|-|
[vitest.config.headless-browser.ts](https://github.com/delilahw/vitest-playwright-headless-demo/blob/main/vitest.config.headless-browser.ts) | `true` | `undefined` | Headless | Headless | Scenario 1
[vitest.config.headless-instance.ts](https://github.com/delilahw/vitest-playwright-headless-demo/blob/main/vitest.config.headless-instance.ts) | `undefined` | `true` | Headed | Headless | Scenario 2
[vitest.config.headless-conflicting-values.ts](https://github.com/delilahw/vitest-playwright-headless-demo/blob/main/vitest.config.headless-conflicting-values.ts) | `true` | `false` | Headless | Headed | -

## Cause

What's causing this discrepancy? Simply put, the `headless` option in `BrowserConfigOptions.instances[]` is not being used in the Playwright Provider.

Let's take a look at [`vitest/packages/browser/src/node/providers/playwright.ts:47-54`](https://github.com/vitest-dev/vitest/blob/470cbec1f91bd3cb0aa604077fa288c4a6e1c2b9/packages/browser/src/node/providers/playwright.ts#L47-L54).

```ts
export class PlaywrightBrowserProvider implements BrowserProvider {
  initialize(
    project: TestProject,
    { browser, options }: PlaywrightProviderOptions,
  ): void {
    this.project = project
    this.browserName = browser
    this.options = options as any
  }
}
```

The `this.options.headless` property will be populated with `BrowserConfigOptions.instances[].headless`. However, it isn't consumed.

Let's take a look at [Lines 66-73](https://github.com/vitest-dev/vitest/blob/470cbec1f91bd3cb0aa604077fa288c4a6e1c2b9/packages/browser/src/node/providers/playwright.ts#L66-L73), within the `openBrowser()` method. This snippet determines the final headless setting.

```ts
private async openBrowser() {
  ...

  const options = this.project.config.browser

  const playwright = await import('playwright')

  const launchOptions = {
    ...this.options?.launch,
    headless: options.headless,
  } satisfies LaunchOptions

  ...
}
```

We can see that the `headless` option is set to `options.headless`, which is populated from `this.project.config.browser.headless`, which itself is populated from `BrowserConfigOptions.headless`.

There is no usage of `this.options.headless`, so the value from `BrowserConfigOptions.instances[].headless` is ignored.

## Possible Solutions

### A. Use `BrowserConfigOptions.headless` only

If the preferred behaviour is to always use the value from `BrowserConfigOptions.headless`, then the current implementation is correct.

In this case, we should remove the `headless` option from the [`BrowserInstanceOption` type](https://github.com/vitest-dev/vitest/blob/470cbec1f91bd3cb0aa604077fa288c4a6e1c2b9/packages/vitest/src/node/types/browser.ts#L71). This would make the following configuration invalid:

```ts
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: "playwright",

      instances: [
        {
          browser: "chromium",
          headless: true, // Invalid
        },
      ],
    },
  },
});
```

### B. `BrowserInstanceOption.headless` takes precedence over `BrowserConfigOptions.headless`

According to the [Browser Config Reference Docs](https://github.com/vitest-dev/vitest/blob/470cbec1f91bd3cb0aa604077fa288c4a6e1c2b9/docs/guide/browser/config.md?plain=1#L67-L88), “every browser config inherits from the root config”.

We should replace the resolution logic with

```ts
const options = this.project.config.browser

// BrowserConfigOptions.headless
const headlessFromRoot = options?.headless

// BrowserConfigOptions.instances[].headless
const headlessFromInstance = this.options?.headless

const launchOptions = {
  ...this.options?.launch,
  // Prefer headlessFromInstance if it's set
  headless: headlessFromInstance ?? headlessFromRoot,
} satisfies LaunchOptions
```

### Other Solutions

If you have any other ideas, please feel free to discuss!

I'm happy to implement a solution and make a PR. Let me know what we wanna do. 😇
