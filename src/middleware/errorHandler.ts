import type { ErrorRequestHandler } from "express";
import { ZodError, z } from "zod";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", details: z.treeifyError(err) },
    });
    return;
  }

  // body-parser raises a SyntaxError (with a `body` property) for unparseable
  // JSON — a client error, so map it to 400 rather than the 500 fallback.
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({
      error: { code: "MALFORMED_BODY", message: "Request body is not valid JSON" },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  logger.error({ err }, "unhandled error");
  res.status(500).json({
    error: { code: "INTERNAL", message: "Something went wrong" },
  });
};
