# E2E Tests

End-to-end tests for the OpenWorship web frontend using [Playwright](https://playwright.dev/).

These tests validate the UI layer by launching a real browser against the Vite dev server. The Tauri IPC layer is not available in this context — these tests cover routing, layout, component rendering, and user interactions that don't require the Rust backend.

## Prerequisites

- **Node.js** >= 22
- **pnpm** >= 9.15.4

## Setup

From the repository root:

```sh
# Install all workspace dependencies (includes tests/e2e)
pnpm install

# Install Playwright browsers (Chromium only)
pnpm --filter @openworship/e2e exec playwright install --with-deps chromium
```

Or using Taskfile:

```sh
task e2e:install
```

## Running Tests

### Headless (CI mode)

```sh
task e2e:test
# or
pnpm --filter @openworship/e2e test
```

### Headed (visible browser)

```sh
task e2e:test:headed
# or
pnpm --filter @openworship/e2e test:headed
```

### Debug mode (step through tests)

```sh
pnpm --filter @openworship/e2e test:debug
```

### View HTML report

After a test run, open the interactive report:

```sh
task e2e:test:report
# or
pnpm --filter @openworship/e2e test:report
```

## Test Structure

```
tests/e2e/
├── package.json           # Dependencies (@playwright/test)
├── playwright.config.ts   # Playwright config (base URL, web server, projects)
├── tsconfig.json          # TypeScript config
└── specs/
    ├── navigation.spec.ts      # App routing (4 tests)
    ├── operator-page.spec.ts   # Operator UI layout and interactions (7 tests)
    └── display-page.spec.ts    # Display/projection page (3 tests)
```

## How It Works

- Playwright auto-starts the Vite dev server on `http://localhost:1420` before tests run (configured in `playwright.config.ts` via `webServer`).
- Tests run against Chromium by default.
- Screenshots are captured on failure; traces are recorded on first retry.
- In CI, the HTML report is uploaded as a GitHub Actions artifact.

## Adding New Tests

1. Create a new `.spec.ts` file in `specs/`.
2. Use Playwright's `test` and `expect` from `@playwright/test`.
3. Tests auto-discover — no registration needed.

## Cleanup

Remove generated test artifacts:

```sh
rm -rf tests/e2e/playwright-report tests/e2e/test-results
```
