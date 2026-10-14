# MyWebAutomation

Use the **Web Automation** agent in VS Code to explore and operate websites through Playwright MCP, or write repeatable browser checks with `@playwright/test`.

## Setup

```sh
npm install
npx playwright install
```

Open this folder in VS Code and start the Playwright MCP server when prompted. Select the **Web Automation** agent from the agent picker, then describe the website and workflow you want it to perform. The agent uses Chromium and asks before consequential actions.

## Playwright tests

```sh
npm test
npm run test:ui
npm run test:headed
npm run report
```

Tests run in Chromium, Firefox, and WebKit. To run only the public smoke test in Chromium:

```sh
npx playwright test tests/smoke.spec.ts --project=chromium
```

The configurable `tests/example.spec.ts` requires `BASE_URL` and `EXPECTED_TITLE`. Add repeatable checks under `tests/` and use Playwright's role- and label-based locators where possible.
