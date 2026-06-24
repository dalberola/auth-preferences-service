import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { MongoMemoryServer } from "mongodb-memory-server";

// Capture the raw verification token instead of sending a real email.
const captured = vi.hoisted(() => ({ token: "" }));
vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn(async (_to: string, raw: string) => {
    captured.token = raw;
  }),
}));

let mongo: MongoMemoryServer;
let app: Express;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  const { connectDb } = await import("../src/db/connect.js");
  await connectDb(mongo.getUri());
  const { createApp } = await import("../src/app.js");
  app = createApp();
});

afterAll(async () => {
  const { disconnectDb } = await import("../src/db/connect.js");
  await disconnectDb();
  await mongo.stop();
});

const email = "user@example.com";
const password = "Sup3rSecret!pw";

describe("registration + verification + preferences", () => {
  it("rejects login before the email is verified", async () => {
    await request(app)
      .post("/auth/register")
      .send({ email, password })
      .expect(202);

    await request(app)
      .post("/auth/login")
      .send({ email, password })
      .expect(403);
  });

  it("verifies, logs in, and round-trips preferences", async () => {
    expect(captured.token).not.toBe("");

    await request(app)
      .get(`/auth/verify?token=${captured.token}`)
      .expect(302);

    const agent = request.agent(app);
    const login = await agent
      .post("/auth/login")
      .send({ email, password })
      .expect(200);

    const accessToken = login.body.accessToken as string;
    expect(accessToken).toBeTruthy();
    expect(login.headers["set-cookie"]).toBeDefined();

    const put = await agent
      .put("/me/preferences")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ theme: "dark", settings: { widgetA: true } })
      .expect(200);
    expect(put.body.preferences.theme).toBe("dark");

    const get = await agent
      .get("/me/preferences")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(get.body.preferences.theme).toBe("dark");
    expect(get.body.preferences.settings.widgetA).toBe(true);

    // Refresh cookie rotates into a fresh access token.
    const refreshed = await agent.post("/auth/refresh").expect(200);
    expect(refreshed.body.accessToken).toBeTruthy();
  });

  it("rejects an already-consumed verification token", async () => {
    await request(app)
      .get(`/auth/verify?token=${captured.token}`)
      .expect(401);
  });

  it("blocks unauthenticated preference access", async () => {
    await request(app).get("/me/preferences").expect(401);
  });
});
