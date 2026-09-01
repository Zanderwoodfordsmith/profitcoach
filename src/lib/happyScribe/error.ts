export class HappyScribeError extends Error {
  readonly status: number;
  readonly retryAfterSeconds: number | null;

  constructor(message: string, status: number, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "HappyScribeError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
