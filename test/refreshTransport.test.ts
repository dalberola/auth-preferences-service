import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import mysql from "mysql2/promise";
import type { Express } from "express";

// Transport is read from env at app-import time, so body mode needs its own app
// — and its own database, so its dropSchema doesn't race auth.test.ts. Both env
// vars must be set BEFORE the dynamic import in beforeAll.
process.env.REFRESH_TOKEN_TRANSPORT = "body";
process.env.DB_NAME = "auth_preferences_test_body";

const captured = vi.hoisted(() => ({ token: "" }));
vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn(async (_to: string, raw: string) => {
    captured.token = raw;
  }),
  sendPasswordResetEmail: vi.fn(async () => {}),
}));

let app: Express;
const password = "Sup3rSecret!pw";

beforeAll(async () => {
  const admin = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
  await admin.end();

  const { connectDb } = await import("../src/db/connect.js");
  await connectDb();
  const { createApp } = await import("../src/app.js");
  app = createApp();
});

afterAll(async () => {
  const { disconnectDb } = await import("../src/db/connect.js");
  await disconnectDb();
});

describe("refresh-token transport: body mode", () => {
  it("returns the refresh token in the body (no cookie) and refreshes from it", async () => {
    const email = "bodymode@example.com";
    await request(app).post("/auth/register").send({ email, password }).expect(202);
    await request(app).get(`/auth/verify?token=${captured.token}`).expect(302);

    const login = await request(app)
      .post("/auth/login")
      .send({ email, password })
      .expect(200);
    expect(login.headers["set-cookie"]).toBeUndefined(); // no cookie in body mode
    expect(login.body.refreshToken).toBeTruthy();
    expect(login.body.refreshExpiresAt).toBeTruthy();

    const r1 = login.body.refreshToken as string;
    const refreshed = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: r1 })
      .expect(200);
    expect(refreshed.body.accessToken).toBeTruthy();
    expect(refreshed.body.refreshToken).toBeTruthy();
    expect(refreshed.body.refreshToken).not.toBe(r1); // rotated

    // No token in the body → 401 NO_TOKEN.
    const none = await request(app).post("/auth/refresh").send({}).expect(401);
    expect(none.body.error.code).toBe("NO_TOKEN");

    // Replaying the rotated token → reuse detected.
    const reuse = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: r1 })
      .expect(401);
    expect(reuse.body.error.code).toBe("TOKEN_REUSE");
  });
});
