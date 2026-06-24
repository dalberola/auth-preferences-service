import { Router } from "express";
import { authLimiter } from "../../middleware/rateLimit.js";
import * as controller from "./controller.js";

export const authRouter = Router();

authRouter.use(authLimiter);

authRouter.post("/register", controller.register);
authRouter.get("/verify", controller.verify);
authRouter.post("/login", controller.login);
authRouter.post("/refresh", controller.refresh);
authRouter.post("/logout", controller.logout);
authRouter.post("/resend-verification", controller.resendVerification);
authRouter.post("/forgot-password", controller.forgotPassword);
authRouter.post("/reset-password", controller.resetPassword);
