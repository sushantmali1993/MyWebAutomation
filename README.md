# MyWebAutomation

Use the **Web Automation** agent in VS Code to explore and operate websites through Playwright MCP, or write repeatable browser checks with `@playwright/test`.

## Setup

```sh
npm install
npx playwright install
```

Open this folder in VS Code and start the Playwright MCP server when prompted. Select the **Web Automation** agent from the agent picker, then describe the website and workflow you want it to perform. The agent uses Chromium and asks before consequential actions.

For OTP-assisted tests, select the **OTP Automation** agent. Provide the application URL and an authorized test inbox URL; sign in to the inbox directly in the browser if needed. The agent uses the newest matching OTP only to complete the requested test flow and does not display or save the code. It cannot retrieve OTPs from an inbox that is unavailable through the configured Playwright browser tools.

Both project agents are configured to use Claude Sonnet 5.5. To change the model, edit the `model` field in the YAML frontmatter of `.github/agents/web-automation.agent.md` and `.github/agents/otp-automation.agent.md`, using a model name available in your VS Code model picker. Remove the `model` field to use the currently selected model instead.

## Playwright tests

The regression tests target the staging Ride web app by default. Set
`RIDE_BASE_URL` to override the app origin and `RIDE_STORAGE_STATE` to use a
locally saved, pre-authenticated Playwright state for logged-in cases. Keep the
storage-state file under the ignored `playwright/.auth/` directory; never
commit it.

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

Add repeatable checks under `tests/` and use Playwright's role- and label-based
locators where possible. Booking and payment tests are intended for staging
test accounts and must clean up any rides they create.

### Ride regression suite coverage

The `ride-web-e2e-regression` suite contains the 21 cases matching the Jira
filter for project RCEW, component `Ride-Web-RegressionSuite`, and label
`ride-web-e2e-regression`:

`RCEW-6101`, `RCEW-6100`, `RCEW-6099`, `RCEW-5344`, `RCEW-5338`,
`RCEW-5320`, `RCEW-5319`, `RCEW-5311`, `RCEW-5310`, `RCEW-5307`,
`RCEW-5306`, `RCEW-5305`, `RCEW-5304`, `RCEW-5303`, `RCEW-5302`,
`RCEW-5301`, `RCEW-5300`, `RCEW-5294`, `RCEW-5293`, `RCEW-5292`, and
`RCEW-5291`.

Tests run serially in Chromium and require
`RIDE_E2E_ALLOW_BOOKING=true` plus an authenticated `RIDE_STORAGE_STATE`.
Every confirmed ride is canceled and verified before the next test. The
implemented flows currently cover RCEW-5301, RCEW-5305, RCEW-5306, RCEW-5310,
RCEW-5338, and RCEW-5344. The Corporate Central Payment case selects
“Innolith Science and Technology GmbH” and fills company branch ID `test`,
employee ID `EMP1234`, cost reference `test`, and the first available trip
description. The logged-in 3DS cases select the saved method ending in `746`
for 3DS1 REDIRECT and `000` for 3DS2 CHALLENGE from the `3ds1 payment` booking
profile. The remaining
cases are present as explicitly skipped tests until their Jira-documented
prerequisites are configured, including other profile/payment fixtures,
OTP-assisted entry-point login, the active promotion, the Duration-only
market, and a guest-booking cancellation path. Skip reasons are recorded
beside each case in `tests/ride-web-e2e-regression.spec.ts`.

The public search checks in `tests/ride-search.spec.ts` cover RCEW-5296,
RCEW-5297, RCEW-5298, and RCEW-5299. They are outside the exact 21-case Jira
filter and do not create rides.
