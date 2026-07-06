import { test, expect } from "@playwright/test";
import { login, SEED } from "./helpers";

test("a brand can create a campaign and see it in the list", async ({ page }) => {
  await login(page, SEED.brand);
  await page.goto("/brand/campaigns/new");

  const title = `E2E Campaign ${Date.now()}`;
  await page.getByLabel("Campaign Name").fill(title);
  await page.getByLabel("Description").fill("An end-to-end smoke test campaign.");
  await page.getByLabel(/Budget/).fill("750");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page).toHaveURL(/\/brand\/campaigns$/, { timeout: 15_000 });
  await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });
});
