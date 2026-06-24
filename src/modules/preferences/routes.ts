import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { apiLimiter } from "../../middleware/rateLimit.js";
import * as controller from "./controller.js";

export const meRouter = Router();

meRouter.use(apiLimiter, requireAuth);

meRouter.get("/preferences", controller.get);
meRouter.put("/preferences", controller.update);
