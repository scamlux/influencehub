import { test, expect } from "@playwright/test";
import { registerBrand, uniqueEmail } from "./helpers";

test("a brand can subscribe (mock checkout activates immediately)", async ({ page }) => {
  // A fresh brand has no subscription yet, so the subscribe button is active.
  await registerBrand(page, uniqueEmail("brand-sub"));
  await page.goto("/brand/subscription");

  const subscribe = page
    .getByRole("button", { name: /subscribe|pay with|stripe/i })
    .first();
  await expect(subscribe).toBeEnabled({ timeout: 15_000 });
  await subscribe.click();

  // In mock mode checkout activates the plan without a redirect — the page
  // should reflect an active subscription.
  await expect(page.getByText(/active|current plan/i).first()).toBeVisible({ timeout: 15_000 });
});
