import { test, expect } from "@playwright/test";
import { login, SEED } from "./helpers";

test("an influencer can bid on an open campaign", async ({ page }) => {
  await login(page, SEED.influencer);
  await page.goto("/influencer/campaigns");

  // Open the bid dialog for the first biddable campaign.
  const submitBid = page.getByRole("button", { name: "Submit Bid" }).first();
  await expect(submitBid).toBeVisible({ timeout: 15_000 });
  await submitBid.click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Proposed Price").fill("400");
  await dialog.getByLabel("Your Proposal").fill("I can deliver this campaign with great reach.");
  await dialog.getByRole("button", { name: "Submit" }).click();

  // The dialog closes and the card flips to "Bid submitted".
  await expect(dialog).toBeHidden({ timeout: 15_000 });
});
