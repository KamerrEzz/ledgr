import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.waitForSelector("input[type='email']", { timeout: 10000 });
  await page.fill("input[type='email']", "admin@acme.com");
  await page.fill("input[type='password']", "password123");
  await page.click("button[type='submit']");
  await page.waitForURL("**/dashboard", { timeout: 10000 });
}

test("shows login page", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("h1")).toContainText("Ledgr");
  await expect(page.locator("input[type='email']")).toBeVisible();
  await expect(page.locator("input[type='password']")).toBeVisible();
});

test("login with valid credentials", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/dashboard/);
});

test("login with invalid credentials shows error", async ({ page }) => {
  await page.goto("/login");
  await page.fill("input[type='email']", "wrong@example.com");
  await page.fill("input[type='password']", "wrongpassword");
  await page.click("button[type='submit']");
  await expect(page.locator("text=Invalid")).toBeVisible({ timeout: 5000 });
});

test("dashboard shows overview", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("link", { name: "Resources" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Orders" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Balance" })).toBeVisible();
});

test("navigates to resources page", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/resources");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/resources/);
});

test("navigates to orders page", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/orders");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/orders/);
});

test("navigates to balance page", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/balance");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/balance/);
});

test("navigates to ledger page", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/ledger");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/ledger/);
});

test("displays existing resources", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/resources");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("cell", { name: "Cloud Hosting", exact: true })).toBeVisible({ timeout: 15000 });
});

test("can create a new resource", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/resources");
  await page.waitForLoadState("networkidle");
  const createBtn = page.getByRole("button", { name: "Create Resource" });
  await expect(createBtn).toBeVisible({ timeout: 15000 });
  await createBtn.click();
  await page.fill("input[name='name']", "E2E Test Resource");
  await page.fill("textarea[name='description']", "Created by Playwright");
  await page.getByRole("button", { name: "Create" }).last().click();
  await expect(page.getByText("E2E Test Resource")).toBeVisible({ timeout: 10000 });
});
