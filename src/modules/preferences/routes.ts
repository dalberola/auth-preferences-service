import { Router } from "express";
import * as controller from "./controller.js";

// Guarded by apiLimiter + requireAuth at the /me mount in app.ts.
export const meRouter = Router();

meRouter.get("/preferences", controller.get);
meRouter.put("/preferences", controller.update);
