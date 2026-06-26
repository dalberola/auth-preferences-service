import { Router } from "express";
import * as controller from "./controller.js";

// Guarded by apiLimiter + requireAuth at the /me mount in app.ts.
export const accountRouter = Router();

// DELETE /me — permanently delete the authenticated account.
accountRouter.delete("/", controller.remove);
