import { test, expect } from "@playwright/test";

test.describe("Auth guard middleware", () => {
  test("redirects anonymous / → /login", async ({ page }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(page.url()).toContain("/login");
    // Titel is consistent op alle pages.
    await expect(page).toHaveTitle(/VerkoopAssistent/);
    expect(response?.status()).toBeLessThan(400);
  });

  test("renders login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "VerkoopAssistent" })).toBeVisible();
    await expect(page.getByPlaceholder("jij@voorbeeld.nl")).toBeVisible();
    await expect(page.getByRole("button", { name: /magic link/i })).toBeVisible();
  });

  test("protected routes redirect to login", async ({ page }) => {
    for (const path of ["/inventory", "/listings", "/taxatie", "/stickers", "/upload", "/suggestions"]) {
      await page.goto(path);
      expect(page.url()).toContain("/login");
    }
  });

  test("API route returnt 401 JSON voor anonymous", async ({ request }) => {
    const res = await request.post("/api/stickers/generate", {
      data: { startNumber: 1, count: 160 },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});

test.describe("Security headers", () => {
  test("CSP + HSTS + X-Frame-Options aanwezig op /login", async ({ page }) => {
    const response = await page.goto("/login");
    const headers = response?.headers() ?? {};
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["strict-transport-security"]).toMatch(/max-age/);
    expect(headers["content-security-policy"]).toMatch(/default-src/);
  });
});
