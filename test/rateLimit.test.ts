import { beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

// This suite runs with NODE_ENV=development (see below), which un-silences the
// logger. Swap in a genuinely silent pino instance so request logging doesn't
// flood the test/CI output — pino-http stays fully compatible.
vi.mock("../src/lib/logger.js", async () => {
  const { pino } = await import("pino");
  return { logger: pino({ level: "silent" }) };
});

// The limiter is skipped when NODE_ENV=test. Flip to "development" BEFORE the app
// is imported so `authLimiter` is active. Uses a dynamic import for that reason —
// static imports are hoisted above this assignment.
let app: Express;

beforeAll(async () => {
  process.env.NODE_ENV = "development";
  const { createApp } = await import("../src/app.js");
  app = createApp();
});

describe("rate limiting (active outside NODE_ENV=test)", () => {
  it("returns 429 RATE_LIMITED once the auth limit is exceeded", async () => {
    // authLimiter allows 20 requests/window. Empty bodies fail validation (400)
    // AFTER the limiter has counted them, so no database access is needed.
    let lastAllowed = 0;
    for (let i = 0; i < 20; i++) {
      const res = await request(app).post("/auth/login").send({});
      lastAllowed = res.status;
    }
    expect(lastAllowed).toBe(400); // 20th request still passed the limiter

    const limited = await request(app).post("/auth/login").send({});
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("RATE_LIMITED");
  });
});
