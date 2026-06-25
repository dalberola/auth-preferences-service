import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import mysql from "mysql2/promise";
import jwt from "jsonwebtoken";
import type { Express } from "express";

// Capture the raw tokens instead of sending real emails.
const captured = vi.hoisted(() => ({ token: "", resetToken: "" }));
vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn(async (_to: string, raw: string) => {
    captured.token = raw;
  }),
  sendPasswordResetEmail: vi.fn(async (_to: string, raw: string) => {
    captured.resetToken = raw;
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

  it("rejects a malformed JSON body with 400 MALFORMED_BODY", async () => {
    const res = await request(app)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email": "x@example.com"') // truncated, unparseable
      .expect(400);
    expect(res.body.error.code).toBe("MALFORMED_BODY");
  });
});

describe("password reset", () => {
  it("forgot-password returns 202 whether or not the account exists", async () => {
    // Unknown account: still 202 (no enumeration).
    await request(app)
      .post("/auth/forgot-password")
      .send({ email: "ghost@example.com" })
      .expect(202);

    const addr = "resetme@example.com";
    await registerAndVerify(addr);
    await request(app)
      .post("/auth/forgot-password")
      .send({ email: addr })
      .expect(202);
    expect(captured.resetToken).not.toBe("");
  });

  it("resets the password, revokes sessions, and is single-use", async () => {
    const addr = "resetflow@example.com";
    await registerAndVerify(addr);
    const { refreshToken: r1 } = await loginTokens(addr);

    await request(app)
      .post("/auth/forgot-password")
      .send({ email: addr })
      .expect(202);
    const resetToken = captured.resetToken;
    expect(resetToken).toBeTruthy();

    const newPassword = "Even-Str0nger!pw";
    await request(app)
      .post("/auth/reset-password")
      .send({ token: resetToken, password: newPassword })
      .expect(204);

    // Old password is dead, new one works.
    await request(app).post("/auth/login").send({ email: addr, password }).expect(401);
    await request(app)
      .post("/auth/login")
      .send({ email: addr, password: newPassword })
      .expect(200);

    // Pre-reset session was revoked.
    await sendRefresh(r1).expect(401);

    // The reset link is single-use.
    await request(app)
      .post("/auth/reset-password")
      .send({ token: resetToken, password: newPassword })
      .expect(401);
  });

  it("rejects an invalid reset token with 401 INVALID_TOKEN", async () => {
    const res = await request(app)
      .post("/auth/reset-password")
      .send({ token: "not-a-real-token", password: "Anoth3r-Str0ng!pw" })
      .expect(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });

  it("rejects a weak new password with 400 VALIDATION_ERROR", async () => {
    const res = await request(app)
      .post("/auth/reset-password")
      .send({ token: "whatever", password: "short" })
      .expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("token reaper", () => {
  it("deletes expired tokens but keeps live and revoked-unexpired ones", async () => {
    const { AppDataSource } = await import("../src/db/data-source.js");
    const { reapExpiredTokens } = await import("../src/db/reaper.js");
    const { RefreshToken } = await import("../src/models/refreshToken.js");
    const { VerificationToken } = await import("../src/models/verificationToken.js");

    const rt = AppDataSource.getRepository(RefreshToken);
    const vt = AppDataSource.getRepository(VerificationToken);
    const uid = "00000000-0000-4000-8000-000000000001";
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60 * 60_000);
    const tag = `reap-${Date.now()}`;

    const expiredR = await rt.save(
      rt.create({ userId: uid, tokenHash: `${tag}-r-exp`, family: uid, expiresAt: past }),
    );
    // Revoked but NOT expired — must survive so reuse detection still works.
    const revokedFreshR = await rt.save(
      rt.create({
        userId: uid,
        tokenHash: `${tag}-r-rev`,
        family: uid,
        expiresAt: future,
        revokedAt: new Date(),
      }),
    );
    const liveR = await rt.save(
      rt.create({ userId: uid, tokenHash: `${tag}-r-live`, family: uid, expiresAt: future }),
    );
    const expiredV = await vt.save(
      vt.create({ userId: uid, tokenHash: `${tag}-v-exp`, type: "email_verify", expiresAt: past }),
    );
    const liveV = await vt.save(
      vt.create({ userId: uid, tokenHash: `${tag}-v-live`, type: "email_verify", expiresAt: future }),
    );

    const result = await reapExpiredTokens();
    expect(result.refreshTokens).toBeGreaterThanOrEqual(1);
    expect(result.verificationTokens).toBeGreaterThanOrEqual(1);

    expect(await rt.findOneBy({ id: expiredR.id })).toBeNull();
    expect(await rt.findOneBy({ id: revokedFreshR.id })).not.toBeNull();
    expect(await rt.findOneBy({ id: liveR.id })).not.toBeNull();
    expect(await vt.findOneBy({ id: expiredV.id })).toBeNull();
    expect(await vt.findOneBy({ id: liveV.id })).not.toBeNull();
  });
});

describe("access-token secret rotation", () => {
  it("accepts a token signed with the previous secret during a rotation overlap", async () => {
    const addr = "rotation@example.com";
    await registerAndVerify(addr);
    const { accessToken } = await loginTokens(addr);
    const sub = (jwt.decode(accessToken) as { sub: string }).sub;

    // A token the old secret would have signed must still be accepted.
    const prev = process.env.JWT_ACCESS_SECRET_PREVIOUS as string;
    const prevToken = jwt.sign({}, prev, {
      algorithm: "HS256",
      subject: sub,
      expiresIn: "15m",
    });

    await request(app)
      .get("/me/preferences")
      .set("Authorization", `Bearer ${prevToken}`)
      .expect(200);
  });

  it("rejects a token signed with an unknown secret", async () => {
    const bad = jwt.sign({}, "u".repeat(40), {
      algorithm: "HS256",
      subject: "00000000-0000-4000-8000-000000000009",
      expiresIn: "15m",
    });
    await request(app)
      .get("/me/preferences")
      .set("Authorization", `Bearer ${bad}`)
      .expect(401);
  });
});

describe("login enumeration", () => {
  it("returns the same generic 401 for an unknown email as for a wrong password", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "nobody-here@example.com", password: "whatever-long-enough" })
      .expect(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("login lockout", () => {
  const wrong = "wrong-but-long-enough";

  it("locks the account after repeated failures and rejects the correct password", async () => {
    const { env } = await import("../src/config/env.js");
    const addr = "lockme@example.com";
    await registerAndVerify(addr);

    for (let i = 0; i < env.LOGIN_MAX_ATTEMPTS; i++) {
      await request(app)
        .post("/auth/login")
        .send({ email: addr, password: wrong })
        .expect(401);
    }

    // Locked: the correct password now also fails, with the same generic error
    // (no signal that the account exists or is locked).
    const res = await request(app)
      .post("/auth/login")
      .send({ email: addr, password })
      .expect(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("auto-unlocks after the window and a successful login clears the counter", async () => {
    const { env } = await import("../src/config/env.js");
    const { AppDataSource } = await import("../src/db/data-source.js");
    const { User } = await import("../src/models/user.js");
    const repo = AppDataSource.getRepository(User);

    const addr = "unlockme@example.com";
    await registerAndVerify(addr);

    for (let i = 0; i < env.LOGIN_MAX_ATTEMPTS; i++) {
      await request(app)
        .post("/auth/login")
        .send({ email: addr, password: wrong })
        .expect(401);
    }
    const locked = await repo.findOneByOrFail({ email: addr });
    expect(locked.lockedUntil).not.toBeNull();

    // Simulate the lock window elapsing.
    await repo.update({ email: addr }, { lockedUntil: new Date(Date.now() - 60_000) });

    // The correct password works again and resets the lockout bookkeeping.
    await request(app).post("/auth/login").send({ email: addr, password }).expect(200);
    const after = await repo.findOneByOrFail({ email: addr });
    expect(after.failedLoginAttempts).toBe(0);
    expect(after.lockedUntil).toBeNull();
  });
});
