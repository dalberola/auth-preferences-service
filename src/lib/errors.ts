/** Operational error with an HTTP status and a stable machine-readable code. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (code: string, message: string) =>
  new AppError(400, code, message);
export const unauthorized = (code: string, message: string) =>
  new AppError(401, code, message);
export const forbidden = (code: string, message: string) =>
  new AppError(403, code, message);
export const conflict = (code: string, message: string) =>
  new AppError(409, code, message);
