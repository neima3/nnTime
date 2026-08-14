/**
 * DAL error types (ADR-005). Leaf module: imported by every resource module,
 * imports none of them.
 */
import "server-only";

/** Thrown when If-Match revision ≠ server revision → handler returns 409. */
export class ConflictError extends Error {
  constructor(
    message: string,
    public readonly serverState: unknown,
  ) {
    super(message);
    this.name = "ConflictError";
  }
}

/** Thrown when a resource is not found OR belongs to another user (SEC-01:
 *  cross-user returns 404 to avoid enumeration). */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
