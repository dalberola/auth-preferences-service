import { describe, it, expect } from "vitest";
import { Writable } from "node:stream";
import { pino } from "pino";
import { redactOptions } from "../src/lib/logger.js";

describe("log redaction", () => {
  it("keeps credentials and tokens out of serialized request logs", () => {
    let captured = "";
    const stream = new Writable({
      write(chunk, _enc, cb) {
        captured += chunk.toString();
        cb();
      },
    });
    const logger = pino({ redact: redactOptions, level: "info" }, stream);

    // Shape mirrors what pino-http logs for a completed request.
    logger.info(
      {
        req: {
          method: "GET",
          url: "/auth/verify?token=SUPERSECRETTOKEN&foo=1",
          // pino-http logs the parsed query separately from the raw URL.
          query: { token: "SUPERSECRETTOKEN", foo: "1" },
          headers: {
            authorization: "Bearer ACCESSJWT",
            cookie: "refresh_token=REFRESHSECRET",
          },
        },
        res: { headers: { "set-cookie": ["refresh_token=REFRESHSECRET2"] } },
      },
      "request completed",
    );

    // No secret value survives.
    expect(captured).not.toContain("SUPERSECRETTOKEN");
    expect(captured).not.toContain("ACCESSJWT");
    expect(captured).not.toContain("REFRESHSECRET");
    expect(captured).not.toContain("REFRESHSECRET2");

    // Redaction markers are present, and the non-sensitive URL parts survive.
    expect(captured).toContain("[REDACTED]");
    expect(captured).toContain("/auth/verify?token=[REDACTED]");
    expect(captured).toContain("foo=1");
  });
});
