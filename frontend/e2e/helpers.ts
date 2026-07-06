import { Page, expect } from "@playwright/test";

// Seeded mock logins (password is ignored in mock mode — see api.auth.login).
export const SEED = {
  brand: "brand@influencehub.uz",
  influencer: "influencer@influencehub.uz",
  admin: "admin@influencehub.uz",
};

/** Log in as a seeded user via the real login form. */
export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("whatever"); // ignored in mock mode
  await page.getByRole("button", { name: "Sign In" }).click();
  // Land on some authenticated area (dashboard / onboarding).
  await expect(page).toHaveURL(/\/(brand|influencer|admin)/, { timeout: 15_000 });
}

/** Register a brand-new brand account through the register form. */
export async function registerBrand(page: Page, email: string) {
  await page.goto("/register");
  // Brand is the default role; the card's accessible name carries its
  // description, so match on that rather than an exact "Brand".
  await page.getByRole("button", { name: /Find and hire top bloggers/i }).click();
  await page.getByLabel("Full Name").fill("E2E Brand");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("secret123");
  await page.getByLabel("Confirm Password").fill("secret123");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/brand/, { timeout: 15_000 });
}

/** A per-run unique email so parallel/re-runs never collide in the seed. */
export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@e2e.test`;
}
