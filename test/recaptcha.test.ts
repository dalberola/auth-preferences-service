import { beforeAll, describe, expect, it, vi } from "vitest";

// Import the src module dynamically (after test/setup.ts has populated env);
// a top-level src import would run config/env.ts before env is set. See setup.ts.
let assessCaptcha: typeof import("../src/lib/recaptcha.js").assessCaptcha;
beforeAll(async () => {
  ({ assessCaptcha } = await import("../src/lib/recaptcha.js"));
});

// A fake `fetch` returning a siteverify-shaped JSON body. `ok` controls the HTTP
// status branch; `body` is the parsed JSON.
function fakeFetch(
  body: Record<string, unknown>,
  ok = true,
): typeof fetch {
  return vi.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  })) as unknown as typeof fetch;
}

const base = { secret: "s", minScore: 0.5, action: "register" } as const;

describe("assessCaptcha", () => {
  it("fails closed when the token is missing (no network call)", async () => {
    const fetchImpl = fakeFetch({ success: true, score: 0.9 });
    const r = await assessCaptcha({ ...base, token: undefined, fetchImpl });
    expect(r).toEqual({ ok: false, reason: "missing-token" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("passes a successful high-score token with a matching action", async () => {
    const r = await assessCaptcha({
      ...base,
      token: "t",
      fetchImpl: fakeFetch({ success: true, score: 0.9, action: "register" }),
    });
    expect(r).toEqual({ ok: true, skipped: false });
  });

  it("passes when the provider omits a score (no v3 score present)", async () => {
    const r = await assessCaptcha({
      ...base,
      token: "t",
      fetchImpl: fakeFetch({ success: true }),
    });
    expect(r).toEqual({ ok: true, skipped: false });
  });

  it("fails closed on an unsuccessful verification", async () => {
    const r = await assessCaptcha({
      ...base,
      token: "t",
      fetchImpl: fakeFetch({ success: false, "error-codes": ["timeout-or-duplicate"] }),
    });
    expect(r).toEqual({ ok: false, reason: "verification-failed" });
  });

  it("fails closed below the score threshold", async () => {
    const r = await assessCaptcha({
      ...base,
      token: "t",
      fetchImpl: fakeFetch({ success: true, score: 0.1 }),
    });
    expect(r).toEqual({ ok: false, reason: "low-score" });
  });

  it("fails closed on an action mismatch", async () => {
    const r = await assessCaptcha({
      ...base,
      token: "t",
      fetchImpl: fakeFetch({ success: true, score: 0.9, action: "login" }),
    });
    expect(r).toEqual({ ok: false, reason: "action-mismatch" });
  });

  it("fails OPEN when siteverify is unreachable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const r = await assessCaptcha({ ...base, token: "t", fetchImpl });
    expect(r).toEqual({ ok: true, skipped: true });
  });

  it("fails OPEN on a non-200 from siteverify", async () => {
    const r = await assessCaptcha({
      ...base,
      token: "t",
      fetchImpl: fakeFetch({}, false),
    });
    expect(r).toEqual({ ok: true, skipped: true });
  });
});
