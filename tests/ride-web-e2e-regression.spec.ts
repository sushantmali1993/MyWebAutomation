import { existsSync } from "node:fs";
import { expect, test as base, type Page } from "@playwright/test";
import {
  cancelBookingTarget,
  completeAdyenTestAuthentication,
  fillCorporateBookingReferences,
  openRidePage,
  selectBookingProfile,
  selectFutureDate,
  selectLocation,
  selectSavedPaymentMethod,
  selectStandardRideOffer,
  type BookingTarget,
} from "./support/ride-regression";

const bookingTestsEnabled = process.env.RIDE_E2E_ALLOW_BOOKING === "true";
const storageState = process.env.RIDE_STORAGE_STATE;
const storageStateExists = storageState ? existsSync(storageState) : false;

type Fixtures = {
  pendingBookings: BookingTarget[];
};

const test = base.extend<Fixtures>({
  pendingBookings: async ({ page }, use) => {
    const targets: BookingTarget[] = [];
    await use(targets);

    for (const target of targets.reverse()) {
      await cancelBookingTarget(page, target);
    }
  },
});

test.describe("ride-web-e2e-regression", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeEach(async ({ browserName }) => {
    test.skip(
      browserName !== "chromium",
      "Booking regression cases run serially in Chromium only.",
    );
    test.skip(
      !bookingTestsEnabled,
      "Set RIDE_E2E_ALLOW_BOOKING=true to enable staging bookings.",
    );
    test.skip(
      !storageStateExists,
      "Set RIDE_STORAGE_STATE to an existing authenticated test-account state.",
    );
  });

  test("RCEW-5301 personal profile can book with its saved credit card @ride-web-e2e-regression", async ({
    page,
    pendingBookings,
  }) => {
    await completeSavedCardBooking(page, pendingBookings);
  });

  test("RCEW-5305 Corporate profile books with Central Payment @ride-web-e2e-regression", async ({
    page,
    pendingBookings,
  }) => {
    await completeSavedCardBooking(page, pendingBookings, {
      profileName: "Innolith Science and Technology GmbH",
      corporateReferences: true,
    });
  });

  test("RCEW-5310 logged-in user books with the VISA 3DS REDIRECT card @ride-web-e2e-regression", async ({
    page,
    pendingBookings,
  }) => {
    await completeSavedCardBooking(page, pendingBookings, {
      profileName: "3ds1 payment",
      paymentLastFourDigits: "746",
      authenticationValue: "password",
    });
  });

  test("RCEW-5306 logged-in user books with the VISA 3DS CHALLENGE card @ride-web-e2e-regression", async ({
    page,
    pendingBookings,
  }) => {
    await completeSavedCardBooking(page, pendingBookings, {
      profileName: "3ds1 payment",
      paymentLastFourDigits: "000",
      authenticationValue: "1234",
    });
  });

  test("RCEW-5338 manage bookings is available from the thank-you page @ride-web-e2e-regression", async ({
    page,
    pendingBookings,
  }) => {
    const booking = await completeSavedCardBooking(page, pendingBookings);
    const manageBookings = page
      .getByRole("link", { name: /manage bookings|view my rides/i })
      .or(page.getByRole("button", { name: /manage bookings|view my rides/i }));

    await expect(manageBookings).toBeVisible();
    await manageBookings.click();
    await expect(page).toHaveURL(/ride-history/);
    await expect.poll(() => findRideId(page, booking)).toBeTruthy();
  });

  test("RCEW-5344 a cancellable ride can be canceled from ride details @ride-web-e2e-regression", async ({
    page,
    pendingBookings,
  }) => {
    const booking = await completeSavedCardBooking(page, pendingBookings);
    await cancelBookingTarget(page, booking);
    pendingBookings.splice(pendingBookings.indexOf(booking), 1);
  });

  for (const regressionCase of getDeferredCases()) {
    test(`${regressionCase.key} ${regressionCase.title} @ride-web-e2e-regression`, async () => {
      test.skip(true, regressionCase.blocker);
    });
  }
});

async function completeSavedCardBooking(
  page: Page,
  pendingBookings: BookingTarget[],
  options: {
    profileName?: string;
    paymentLastFourDigits?: string;
    corporateReferences?: boolean;
    authenticationValue?: string;
  } = {},
): Promise<BookingTarget> {
  test.setTimeout(180_000);
  await openRidePage(page);
  if (options.profileName) {
    await selectBookingProfile(page, String(options.profileName));
  }

  const pickup = "Munich Central Station";
  const destination = "(MUC) Munich Airport";
  await selectLocation(page, "Pickup location", pickup, pickup);
  await selectLocation(page, "Destination", "Munich Airport", destination);
  const date = await selectFutureDate(page, 8);
  const time = (
    await page
      .getByRole("button", { name: /^\d{1,2}:\d{2} [AP]M$/ })
      .innerText()
  ).trim();

  const showOffers = page.getByRole("button", { name: "Show offers" });
  await expect(showOffers).toBeEnabled();
  await showOffers.focus();
  await showOffers.press("Enter");
  await expect(page).toHaveURL(/\/ride\/betafunnel\/#\/offers\?/);
  await selectStandardRideOffer(page);
  await expect(page).toHaveURL(/\/ride\/betafunnel\/#\/checkout$/);
  if (options.corporateReferences) {
    await fillCorporateBookingReferences(page);
  }
  if (options.paymentLastFourDigits) {
    await selectSavedPaymentMethod(page, options.paymentLastFourDigits);
  }
  await expect(
    page.locator('input[name="selectedPaymentInstrumentId"]:checked'),
  ).toHaveCount(1);

  const booking: BookingTarget = {
    date: date.date,
    dateLabel: date.dateLabel,
    time,
    pickup,
    destination,
    confirmed: false,
  };
  pendingBookings.push(booking);
  await page.getByRole("button", { name: "Book now" }).click();
  await completeAdyenTestAuthentication(page, options.authenticationValue);
  await expect(page.getByText("Your booking is confirmed")).toBeVisible({
    timeout: 60_000,
  });
  booking.confirmed = true;
  return booking;
}

function getDeferredCases() {
  return [
    {
      key: "RCEW-6101",
      title:
        "book a Duration airport ride with a newly created Private profile and payment method",
      blocker:
        "Requires an isolated profile-creation/payment fixture and the corresponding checkout automation.",
    },
    {
      key: "RCEW-6100",
      title: "book a Duration ride in a Duration-only market",
      blocker:
        "Jira requires a product-confirmed Duration-only market; none is configured, so the test will not guess a city.",
    },
    {
      key: "RCEW-6099",
      title:
        "book with a Corporate profile that has no Central Payment configured",
      blocker:
        "Requires a configured Corporate profile without Central Payment and its supported checkout payment method.",
    },
    {
      key: "RCEW-5320",
      title: "apply the swati12 voucher and book at the discounted fare",
      blocker:
        "Voucher availability is stage-dependent; the voucher apply/discount checkout flow is not configured yet.",
    },
    {
      key: "RCEW-5319",
      title: "book with an automatically applied running promotion",
      blocker:
        "Requires an active promotion on stage for the chosen route and vehicle class.",
    },
    {
      key: "RCEW-5311",
      title: "complete a guest booking with the VISA 3DS REDIRECT flow",
      blocker:
        "Guest booking cleanup is not configured; the ride must be cancellable before another case can run.",
    },
    {
      key: "RCEW-5307",
      title: "complete a guest booking with the VISA 3DS CHALLENGE flow",
      blocker:
        "Guest booking cleanup is not configured; the ride must be cancellable before another case can run.",
    },
    {
      key: "RCEW-5304",
      title: "book with a Corporate profile using AirPlus",
      blocker:
        "Requires a configured AirPlus-capable Corporate profile and stage-approved AirPlus test data.",
    },
    {
      key: "RCEW-5303",
      title: "book with a new credit card entered at checkout",
      blocker:
        "Requires a configured Corporate profile and stage-approved new-card checkout data.",
    },
    {
      key: "RCEW-5302",
      title: "book with the credit card saved on a Corporate profile",
      blocker:
        "Requires a configured Corporate profile with a saved credit card.",
    },
    {
      key: "RCEW-5300",
      title: "book as a guest using the Amex test card",
      blocker:
        "Guest booking cleanup is not configured; the ride must be cancellable before another case can run.",
    },
    {
      key: "RCEW-5294",
      title: "log in from the thank-you page and complete a second reservation",
      blocker:
        "Requires OTP-assisted login in the Playwright flow and safe cleanup for both bookings.",
    },
    {
      key: "RCEW-5293",
      title: "log in from checkout and complete the reservation",
      blocker:
        "Requires OTP-assisted login in the Playwright flow while preserving checkout state.",
    },
    {
      key: "RCEW-5292",
      title: "log in from the offers page and complete the reservation",
      blocker:
        "Requires OTP-assisted login in the Playwright flow while preserving offer state.",
    },
    {
      key: "RCEW-5291",
      title: "log in from the home page and complete the reservation",
      blocker: "Requires OTP-assisted login in the Playwright flow.",
    },
  ] as const;
}
