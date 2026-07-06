import { test, expect } from "@playwright/test";
import { login, SEED } from "./helpers";

test("a brand can open a deal chat and send a message (optimistic UI)", async ({ page }) => {
  await login(page, SEED.brand);
  await page.goto("/brand/deals");

  // Open the chat for the first seeded deal.
  const openChat = page.getByRole("link", { name: /open chat/i }).first();
  await expect(openChat).toBeVisible({ timeout: 15_000 });
  await openChat.click();

  await expect(page).toHaveURL(/\/brand\/chat\//, { timeout: 15_000 });

  const message = `Hello from E2E ${Date.now()}`;
  await page.getByPlaceholder(/type a message/i).fill(message);
  await page.keyboard.press("Enter");

  // Optimistic UI: the message bubble shows up immediately.
  await expect(page.getByText(message)).toBeVisible({ timeout: 10_000 });
});
