Scaffold a new HTTP feature module following the project's module pattern.

Argument: the module name (kebab or camel), e.g. `sessions` or `api-keys`.

Module: $ARGUMENTS

Every feature lives in `src/modules/<name>/` with four files and is mounted in
`app.ts`. Keep controllers thin; all DB access and logic live in the service;
all request shapes live in validators. Throw `AppError` (never write try/catch in
routes — `errorHandler` maps errors to JSON). Remember: relative imports use `.js`
extensions (NodeNext/ESM).

## Steps

1. Derive `camelCase` for identifiers and the folder name.
2. Create `src/modules/<name>/` with:

**`validators.ts`**
```ts
import { z } from "zod";

export const createSchema = z.object({
  // TODO: define the request body shape
}).strict();

export type CreateInput = z.infer<typeof createSchema>;
```

**`service.ts`**
```ts
// import models / lib as needed
// import { badRequest } from "../../lib/errors.js";
import type { CreateInput } from "./validators.js";

export async function create(input: CreateInput) {
  // TODO: business logic; throw AppError on failure
}
```

**`controller.ts`**
```ts
import type { Request, Response } from "express";
import { createSchema } from "./validators.js";
import * as service from "./service.js";

export async function create(req: Request, res: Response): Promise<void> {
  const input = createSchema.parse(req.body);
  const result = await service.create(input);
  res.status(201).json(result);
}
```

**`routes.ts`**
```ts
import { Router } from "express";
// import { requireAuth } from "../../middleware/requireAuth.js"; // if protected
// import { apiLimiter } from "../../middleware/rateLimit.js";
import * as controller from "./controller.js";

export const <name>Router = Router();
// <name>Router.use(apiLimiter, requireAuth); // if protected
<name>Router.post("/", controller.create);
```

3. Mount in `src/app.ts`: import the router and `app.use("/<path>", <name>Router)`.
4. Add a test in `test/` covering the happy path + a validation failure.
5. Run `/verify`. Update `docs/api.md` with the new endpoint(s).
