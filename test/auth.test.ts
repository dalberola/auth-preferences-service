import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import mysql from "mysql2/promise";
import type { Express } from "express";

// Capture the raw verification token instead of sending a real email.
const captured = vi.hoisted(() => ({ token: "" }));
vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn(async (_to: string, raw: string) => {
    captured.token = raw;
  }),
}));

let app: Express;

beforeAll(async () => {
  // TypeORM connects to an existing database; create the test DB if absent.
  // The DataSource then drops/recreates the schema (NODE_ENV=test) for a clean run.
  const admin = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``,
  );
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

const email = "user@example.com";
const password = "Sup3rSecret!pw";

/** Pull the raw `refresh_token` value out of a Set-Cookie header. */
function refreshCookie(
  setCookie: string | string[] | undefined,
): string | undefined {
  const all = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const cookie = all.find((c) => c.startsWith("refresh_token="));
  return cookie?.split(";")[0].slice("refresh_token=".length);
}

/** Register a fresh account and consume its verification token. */
async function registerAndVerify(addr: string): Promise<void> {
  await request(app).post("/auth/register").send({ email: addr, password }).expect(202);
  await request(app).get(`/auth/verify?token=${captured.token}`).expect(302);
}

/** Log in and return the access token + the raw refresh-cookie value. */
async function loginTokens(
  addr: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await request(app)
    .post("/auth/login")
    .send({ email: addr, password })
    .expect(200);
  const refreshToken = refreshCookie(res.headers["set-cookie"]);
  if (!refreshToken) throw new Error("login returned no refresh cookie");
  return { accessToken: res.body.accessToken as string, refreshToken };
}

/** POST /auth/refresh carrying an explicit raw refresh token. */
function sendRefresh(token: string) {
  return request(app)
    .post("/auth/refresh")
    .set("Cookie", `refresh_token=${token}`);
}

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

describe("refresh-token rotation", () => {
  it("detects reuse of a rotated token and burns the family", async () => {
    const addr = "reuse@example.com";
    await registerAndVerify(addr);
    const { refreshToken: r1 } = await loginTokens(addr);

    // Rotate r1 -> r2.
    const rotated = await sendRefresh(r1).expect(200);
    const r2 = refreshCookie(rotated.headers["set-cookie"]);
    expect(r2).toBeTruthy();

    // Replaying the already-rotated r1 is treated as compromise.
    const reuse = await sendRefresh(r1).expect(401);
    expect(reuse.body.error.code).toBe("TOKEN_REUSE");

    // The whole family is burned, so the legitimate successor r2 is dead too.
    await sendRefresh(r2!).expect(401);
  });

  it("logout revokes the refresh token", async () => {
    const addr = "logout@example.com";
    await registerAndVerify(addr);
    const { refreshToken } = await loginTokens(addr);

    await request(app)
      .post("/auth/logout")
      .set("Cookie", `refresh_token=${refreshToken}`)
      .expect(204);

    // A revoked token can no longer be refreshed.
    await sendRefresh(refreshToken).expect(401);
  });
});

describe("preferences (read-merge-save)", () => {
  it("merges partial updates without clobbering untouched keys", async () => {
    const addr = "merge@example.com";
    await registerAndVerify(addr);
    const { accessToken } = await loginTokens(addr);
    const bearer = `Bearer ${accessToken}`;

    await request(app)
      .put("/me/preferences")
      .set("Authorization", bearer)
      .send({ theme: "dark", settings: { a: 1 } })
      .expect(200);

    // Updating only `locale` must preserve `theme` and `settings`.
    const updated = await request(app)
      .put("/me/preferences")
      .set("Authorization", bearer)
      .send({ locale: "es" })
      .expect(200);
    expect(updated.body.preferences).toMatchObject({
      theme: "dark",
      locale: "es",
      settings: { a: 1 },
    });

    const fetched = await request(app)
      .get("/me/preferences")
      .set("Authorization", bearer)
      .expect(200);
    expect(fetched.body.preferences).toMatchObject({
      theme: "dark",
      locale: "es",
      settings: { a: 1 },
    });
  });
});

describe("validation", () => {
  it("rejects a malformed registration with 400 VALIDATION_ERROR", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "not-an-email", password: "short" })
      .expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects login missing a field with 400 VALIDATION_ERROR", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "user@example.com" })
      .expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects unknown preference keys with 400 VALIDATION_ERROR", async () => {
    const addr = "prefval@example.com";
    await registerAndVerify(addr);
    const { accessToken } = await loginTokens(addr);
    const res = await request(app)
      .put("/me/preferences")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ surprise: true })
      .expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an invalid bearer token with 401 INVALID_TOKEN", async () => {
    const res = await request(app)
      .get("/me/preferences")
      .set("Authorization", "Bearer not.a.real.jwt")
      .expect(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });
});
