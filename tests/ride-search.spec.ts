import { expect, test, type Page } from "@playwright/test";

async function selectLocation(
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

async function openRidePage(page: Page) {
  await page.goto("/ride/");

  const denyConsent = page.getByRole("button", { name: "Deny", exact: true });
  if (await denyConsent.isVisible()) {
    await denyConsent.click();
  }
}

test("RCEW-5296 switches between distance and duration ride search", async ({
  page,
}) => {
  await openRidePage(page);

  const oneWay = page.getByRole("button", { name: "One-way" });
  const hourly = page.getByRole("button", { name: "Hourly" });

  await expect(oneWay).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("textbox", { name: "Destination" }),
  ).toBeVisible();

  await hourly.click();
  await expect(hourly).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("textbox", { name: "Destination" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Up to 1 hour" }),
  ).toBeVisible();

  await oneWay.click();
  await expect(oneWay).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("textbox", { name: "Destination" }),
  ).toBeVisible();
});

test("RCEW-5298 restricts pickup dates to the next 365 days", async ({
  page,
}) => {
  await openRidePage(page);

  const today = await page.evaluate(() => {
    const date = new Date();
    return {
      day: date.getDate(),
      month: date.getMonth(),
      year: date.getFullYear(),
    };
  });
  const latestDate = new Date(today.year, today.month, today.day);
  latestDate.setDate(latestDate.getDate() + 365);
  const beyondLatestDate = new Date(latestDate);
  beyondLatestDate.setDate(beyondLatestDate.getDate() + 1);
  const dateTime = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const dateField = page.getByRole("button", {
    name: /^\d{1,2} [A-Z][a-z]{2}$/,
  });
  await dateField.click();

  const previousMonth = page.locator("time").getByRole("button", {
    name: "Previous",
  });
  const nextMonth = page.locator("time").getByRole("button", { name: "Next" });
  await expect(previousMonth).toBeDisabled();

  const yesterday = new Date(today.year, today.month, today.day - 1);
  await expect(
    page.locator(`time[datetime="${dateTime(yesterday)}"]`).getByRole("button"),
  ).toBeDisabled();

  const todayButton = page
    .locator(
      `time[datetime="${dateTime(new Date(today.year, today.month, today.day))}"]`,
    )
    .getByRole("button");
  await expect(todayButton).toBeEnabled();
  await todayButton.click();
  await expect(dateField).toHaveText(
    new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(
      new Date(today.year, today.month, today.day),
    ),
  );

  await dateField.click();
  const latestMonth = `${latestDate.getFullYear()}-${String(latestDate.getMonth() + 1).padStart(2, "0")}`;
  const latestMonthHeader = page.locator(`time[datetime="${latestMonth}"]`);
  for (let month = 0; month < 12; month += 1) {
    if (await latestMonthHeader.count()) {
      break;
    }
    await nextMonth.click();
  }
  await expect(latestMonthHeader).toBeVisible();

  const boundaryDate = page
    .locator(`time[datetime="${dateTime(latestDate)}"]`)
    .getByRole("button");
  const dayBeyondBoundary = page
    .locator(`time[datetime="${dateTime(beyondLatestDate)}"]`)
    .getByRole("button");
  await expect(boundaryDate).toBeEnabled();
  await expect(dayBeyondBoundary).toBeDisabled();
  await boundaryDate.click();

  await expect(dateField).toHaveText(
    new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
    }).format(latestDate),
  );
});

test("RCEW-5297 swaps pickup and destination locations", async ({ page }) => {
  await openRidePage(page);

  await selectLocation(
    page,
    "Pickup location",
    "Munich Central Station",
    "Munich Central Station",
  );
  await selectLocation(
    page,
    "Destination",
    "Munich Airport",
    "(MUC) Munich Airport",
  );
  await expect(page.getByRole("button", { name: "Show offers" })).toBeEnabled();

  const pickup = page.getByRole("textbox", { name: "Pickup location" });
  const destination = page.getByRole("textbox", { name: "Destination" });
  await expect(pickup).toHaveValue("Munich Central Station");
  await expect(destination).toHaveValue("(MUC) Munich Airport");
  const swap = page.getByRole("button", { name: "Swap locations" });
  await swap.focus();
  await swap.press("Enter");

  await expect(pickup).toHaveValue("(MUC) Munich Airport");
  await expect(destination).toHaveValue("Munich Central Station");
});

test("RCEW-5299 searches distance and duration ride offers", async ({
  page,
}) => {
  test.setTimeout(90_000);

  await openRidePage(page);

  await selectLocation(
    page,
    "Pickup location",
    "Munich Central Station",
    "Munich Central Station",
  );
  await selectLocation(
    page,
    "Destination",
    "Munich Airport",
    "(MUC) Munich Airport",
  );
  await expect(page.getByRole("button", { name: "Show offers" })).toBeEnabled();
  const showOffers = page.getByRole("button", { name: "Show offers" });
  await showOffers.focus();
  await showOffers.press("Enter");

  await expect(page).toHaveURL(
    /\/ride\/betafunnel\/#\/offers\?.*type=DISTANCE/,
  );
  await expect(
    page.locator("h4").filter({ hasText: "Ride Business" }).first(),
  ).toBeVisible({ timeout: 20_000 });

  await openRidePage(page);
  await page.getByRole("button", { name: "Hourly" }).click();
  await selectLocation(
    page,
    "Pickup location",
    "Munich Central Station",
    "Munich Central Station",
  );
  await showOffers.focus();
  await showOffers.press("Enter");

  await expect(page).toHaveURL(
    /\/ride\/betafunnel\/#\/offers\?.*type=DURATION/,
  );
  await expect(
    page.locator("h4").filter({ hasText: "Ride Business" }).first(),
  ).toBeVisible({ timeout: 20_000 });
});
