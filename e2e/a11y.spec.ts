import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** WCAG 2.1 AA checks (axe-core) on every page, in light and dark mode. */
for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`accessibility (${colorScheme})`, () => {
    test.use({ colorScheme });

    test("public and logged-in pages have no WCAG A/AA violations", async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "one viewport is enough for axe");
      await page.addInitScript(() => localStorage.setItem("sr-tour-done", "1"));
      const check = async (label: string) => {
        // Measure the settled page, not mid fade-in.
        await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
        const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        expect(violations.map((v) => `${label}: ${v.id} (${v.nodes.length}) ${v.nodes.slice(0, 3).map((n) => n.target.join(" ") + " " + (n.any[0]?.data?.contrastRatio ?? "")).join(" | ")}`)).toEqual([]);
      };

      await page.goto("/login");
      await check("login");
      await page.goto("/signup");
      await check("signup");

      const username = `a11y_${colorScheme}_${Date.now().toString(36)}`;
      await page.getByLabel("Username").fill(username);
      await page.getByLabel("Password", { exact: true }).fill("a11y-password-1");
      await page.getByLabel("Confirm password").fill("a11y-password-1");
      await page.getByRole("button", { name: "Create account" }).click();
      await page.waitForURL("**/vocabulary");
      await check("onboarding");
      await page.getByText("Intermediate", { exact: true }).click();
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByLabel("What field do you work or study in?").fill("Engineering");
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByLabel("Who do you usually speak or write to?").fill("Clients");
      await page.getByRole("button", { name: "Build my deck" }).click();
      await page.getByText("Show definition").click();
      await page.waitForTimeout(500); // the reveal uses a CSS transition, not an animation
      await check("vocabulary");

      for (const path of ["/practice", "/journal", "/account"]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await check(path);
      }
      await page.getByRole("button", { name: "Open the Coach" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await check("coach");
    });
  });
}
