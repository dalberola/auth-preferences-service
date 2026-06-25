import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { apiLimiter } from "../../middleware/rateLimit.js";
import * as controller from "./controller.js";

export const accountRouter = Router();

accountRouter.use(apiLimiter, requireAuth);

// DELETE /me — permanently delete the authenticated account.
accountRouter.delete("/", controller.remove);
