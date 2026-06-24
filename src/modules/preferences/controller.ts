import type { Request, Response } from "express";
import { preferencesSchema } from "./validators.js";
import * as preferences from "./service.js";

export async function get(req: Request, res: Response): Promise<void> {
  const data = await preferences.getPreferences(req.userId!);
  res.json({ preferences: data });
}

export async function update(req: Request, res: Response): Promise<void> {
  const patch = preferencesSchema.parse(req.body);
  const data = await preferences.updatePreferences(req.userId!, patch);
  res.json({ preferences: data });
}
