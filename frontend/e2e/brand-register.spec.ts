import { test, expect } from "@playwright/test";
import { registerBrand, uniqueEmail } from "./helpers";

test("a brand can register and land in the brand dashboard", async ({ page }) => {
  await registerBrand(page, uniqueEmail("brand"));
  await expect(page).toHaveURL(/\/brand/, { timeout: 15_000 });
});
