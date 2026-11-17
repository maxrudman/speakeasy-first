import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Skip the first-run tour banner so it doesn't get in the way.
  await page.addInitScript(() => localStorage.setItem("sr-tour-done", "1"));
});

test("sign up, learn words, practice, journal, coach, account, and log back in", async ({ page }, info) => {
  const username = `e2e_${info.project.name}_${Date.now().toString(36)}`;
  const password = "e2e-password-123";

  await test.step("sign up", async () => {
    await page.goto("/signup");
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/vocabulary");
  });

  await test.step("onboarding builds a deck", async () => {
    await page.getByText("Advanced", { exact: true }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("What field do you work or study in?").fill("Healthcare policy");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Who do you usually speak or write to?").fill("Hiring managers");
    await page.getByRole("button", { name: "Build my deck" }).click();
    await expect(page.getByText("Show definition")).toBeVisible({ timeout: 30_000 });
  });

  await test.step("flashcards: reveal, keep, grade", async () => {
    await page.getByText("Show definition").click();
    await expect(page.getByText("This is a new term")).toBeVisible();
    await page.getByRole("button", { name: "I got it right" }).click();
    await page.getByText("Show definition").click();
    await page.getByRole("button", { name: "I got it wrong" }).click();
    await expect(page.getByText("Right in a row")).toBeVisible();
  });

  await test.step("practice: questions, record, transcript, save to journal", async () => {
    await page.goto("/practice");
    await page.getByText("Who is your audience?").click();
    await page.getByLabel("Purpose").fill("Job interview for a college senior");
    await page.getByLabel("Role or subject").fill("Policy analyst");
    await page.getByRole("button", { name: /Get questions/ }).click();
    await expect(page.getByText(/Question 1 of/)).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Start recording" }).click();
    await expect(page.getByRole("meter", { name: "Microphone level" })).toBeVisible();
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: "Stop recording" }).click();
    await expect(page.locator("audio")).toBeVisible();
    // Browser captions aren't available in headless Chromium, so the (mock) server tier transcribes.
    await expect(page.locator("#transcript")).toHaveValue(/sample transcript/, { timeout: 20_000 });
    await page.getByRole("button", { name: "Save to journal" }).click();
    await expect(page.getByRole("button", { name: "Saved to journal" })).toBeVisible();
  });

  await test.step("moving on deletes the recording after confirmation", async () => {
    await page.getByRole("button", { name: "Next question" }).click();
    await page.getByRole("button", { name: "Delete and continue" }).click();
    await expect(page.getByText(/Question 2 of/)).toBeVisible();
    await expect(page.locator("audio")).toHaveCount(0);
  });

  await test.step("journal shows the saved answer", async () => {
    await page.goto("/journal");
    await expect(page.getByText("sample transcript").first()).toBeVisible();
  });

  await test.step("coach answers (mock tier)", async () => {
    await page.getByRole("button", { name: "Open the Coach" }).click();
    await page.getByLabel("Message the coach").fill("Please critique my answer.\nMy answer: Um, I basically led a team and we shipped it.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Filler words").first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Close the Coach" }).click();
  });

  await test.step("account shows progress", async () => {
    await page.goto("/account");
    await expect(page.getByText("Day streak")).toBeVisible();
    await expect(page.getByText("Flashcards reviewed per day (last 30 days)")).toBeVisible();
  });

  await test.step("log out and back in keeps data", async () => {
    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForURL("**/login");
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("**/vocabulary");
    await expect(page.getByText("Show definition")).toBeVisible();
    await page.goto("/journal");
    await expect(page.getByText("sample transcript").first()).toBeVisible();
  });
});

test("health check and logged-out redirects", async ({ request, page }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBeTruthy();
  expect((await health.json()).database.status).toBe("ok");
  await page.goto("/practice");
  await expect(page).toHaveURL(/\/login/);
});
