import { expect, type Page } from "@playwright/test";

export interface BookingTarget {
  date: string;
  dateLabel: string;
  time: string;
  pickup: string;
  destination: string;
  confirmed: boolean;
}

export async function openRidePage(page: Page) {
  await page.goto("/ride/");

  const denyConsent = page.getByRole("button", { name: "Deny", exact: true });
  if (await denyConsent.isVisible()) {
    await denyConsent.click();
  }
}

export async function selectBookingProfile(page: Page, profileName: string) {
  const selector = page.getByTestId(
    "customer-settings-profile-select-desktop-cta",
  );
  await selector.click();

  const profile = page.getByRole("menuitem", {
    name: profileName,
    exact: true,
  });
  await expect(profile.first()).toBeVisible();
  await profile.first().click();
  await expect(selector).toContainText(profileName);
}

export async function selectSavedPaymentMethod(
  page: Page,
  lastFourDigits: string,
) {
  const paymentMethod = page.getByLabel(
    new RegExp(`(?:^|\\D)${lastFourDigits}(?:\\D|$)`),
  );
  await expect(paymentMethod).toHaveCount(1);
  await paymentMethod.check();
  await expect(paymentMethod).toBeChecked();
}

export async function fillCorporateBookingReferences(page: Page) {
  const optionalFields = [
    { label: /company branch(?:\s+id)?/i, value: "test" },
    { label: /employee\s+id/i, value: "EMP1234" },
    { label: /cost\s+reference/i, value: "test" },
  ];

  for (const field of optionalFields) {
    const input = page.getByLabel(field.label);
    if (await input.count()) {
      await input.fill(field.value);
    }
  }

  const tripDescription = page.getByRole("combobox", {
    name: /trip\s+description/i,
  });
  if (!(await tripDescription.count())) {
    return;
  }
  await expect(tripDescription).toBeVisible();
  const tagName = await tripDescription.evaluate((element) =>
    element.tagName.toLowerCase(),
  );

  if (tagName === "select") {
    const options = await tripDescription
      .locator("option")
      .evaluateAll((items) =>
        items.map((item) => ({
          value: (item as HTMLOptionElement).value,
          disabled: (item as HTMLOptionElement).disabled,
        })),
      );
    const option = options.find((item) => item.value && !item.disabled);
    if (!option) {
      throw new Error("Trip description dropdown has no selectable values.");
    }
    await tripDescription.selectOption(option.value);
  } else {
    await tripDescription.click();
    const option = page.getByRole("option").first();
    await expect(option).toBeVisible();
    await option.click();
  }
}

export async function selectLocation(
  page: Page,
  fieldName: "Pickup location" | "Destination",
  query: string,
  suggestion: string,
) {
  const field = page.getByRole("textbox", { name: fieldName });
  await field.fill("");
  await field.pressSequentially(query, { delay: 75 });

  const result = page.getByText(suggestion, { exact: true }).last();
  await expect(result).toBeVisible({ timeout: 25_000 });
  await result.click();
  await expect(result).toBeHidden();
  await expect(field).toHaveValue(suggestion);
  await expect(field).not.toHaveAttribute("aria-invalid", "true");
}

export async function selectFutureDate(page: Page, daysFromToday: number) {
  const target = await page.evaluate((days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return {
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      dateLabel: new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date),
    };
  }, daysFromToday);

  await page.getByRole("button", { name: /^\d{1,2} [A-Z][a-z]{2}$/ }).click();

  const dateCell = page.locator(`time[datetime="${target.date}"]`);
  if (!(await dateCell.count())) {
    await page.locator("time").getByRole("button", { name: "Next" }).click();
  }

  await expect(dateCell).toBeVisible();
  await dateCell.getByRole("button").click();
  return target;
}

export async function selectStandardRideOffer(page: Page) {
  const ride = page.getByLabel("Ride32");
  await expect(ride.getByRole("button", { name: "Select" })).toBeVisible({
    timeout: 25_000,
  });
  await ride.getByRole("button", { name: "Select" }).click();
}

export async function completeAdyenTestAuthentication(
  page: Page,
  challengeValue: string | undefined = "password",
) {
  if (!page.url().includes("checkoutshopper-test.adyen.com")) {
    return;
  }

  const challenge = page.frameLocator('iframe[name="threeDSIframe"]');
  await challenge
    .getByRole("textbox")
    .first()
    .fill(challengeValue ?? "password");
  await challenge.getByRole("button", { name: /Continue|Submit/i }).click();
  await expect(page).toHaveURL(/\/thank-you$/, { timeout: 60_000 });
}

export async function findRideId(
  page: Page,
  target: BookingTarget,
): Promise<string | undefined> {
  return page
    .evaluate(({ dateLabel, time, pickup, destination }) => {
      const buttons = Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          'button[aria-label^="Ride ID:"]',
        ),
      );

      for (const button of buttons) {
        let container: HTMLElement | null = button;
        while (container && container !== document.body) {
          const text = container.innerText;
          if (
            text.includes(dateLabel) &&
            text.includes(time) &&
            text.includes(pickup) &&
            (!destination || text.includes(destination))
          ) {
            return button.getAttribute("aria-label") ?? button.innerText;
          }
          container = container.parentElement;
        }
      }

      return undefined;
    }, target)
    .then((label) => label?.match(/Ride ID:\s*(\d+)/)?.[1]);
}

export async function cancelBookingTarget(page: Page, target: BookingTarget) {
  await page.goto("/ride/services/#/ride-history");
  await expect(page.getByText("YOUR UPCOMING RIDE")).toBeVisible({
    timeout: 25_000,
  });

  let rideId: string | undefined;
  await expect
    .poll(
      async () => {
        rideId = await findRideId(page, target);
        return rideId;
      },
      { timeout: 25_000 },
    )
    .toBeTruthy();

  await page.getByRole("button", { name: `Ride ID: ${rideId}` }).click();
  await page.getByRole("button", { name: "Cancel ride" }).click();

  const confirmation = page.getByRole("dialog");
  await confirmation.getByRole("button", { name: "Cancel ride" }).click();
  await expect(page.getByText("Canceled", { exact: true })).toBeVisible({
    timeout: 25_000,
  });
}
