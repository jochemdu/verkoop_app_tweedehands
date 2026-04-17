import { test, expect } from "@playwright/test";

test.describe("Magic link rate limiting", () => {
  test("rate limiter blokkeert na 3 pogingen voor zelfde email", async ({ request }) => {
    // Gebruik random email zodat deze test herhaalbaar is zonder interferentie
    // met echte gebruikers.
    const email = `rl-test-${Date.now()}@example-invalid.test`;

    // 3 pogingen moeten accepted worden (200 of 502 als email-delivery faalt,
    // maar NIET 429).
    for (let i = 0; i < 3; i++) {
      const res = await request.post("/api/auth/magic-link", { data: { email } });
      expect(res.status()).not.toBe(429);
    }

    // 4e poging moet geblokkeerd (429) worden door email-limiter.
    const blocked = await request.post("/api/auth/magic-link", { data: { email } });
    expect(blocked.status()).toBe(429);
    const body = await blocked.json();
    expect(body.code).toBe("RATE_LIMITED");
  });

  test("validatie faalt bij ongeldig emailadres", async ({ request }) => {
    const res = await request.post("/api/auth/magic-link", { data: { email: "niet-email" } });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION");
  });
});
