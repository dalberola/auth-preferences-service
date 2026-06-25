import type { Request, Response } from "express";
import * as account from "./service.js";
import { clearRefreshCookie } from "../auth/controller.js";

export async function remove(req: Request, res: Response): Promise<void> {
  await account.deleteAccount(req.userId!);
  // The refresh cookie is scoped to `/auth`; clear it so the browser drops it.
  // No-op in `body` transport (the client holds the token, not a cookie).
  clearRefreshCookie(res);
  res.status(204).end();
}
