import { describe, expect, it } from "vitest";
import {
  mutationFailureMessage,
  shouldRetainIdempotencyKey,
} from "./mutation-failure";

describe("shouldRetainIdempotencyKey", () => {
  it("keeps the key after a lost response and retryable failures", () => {
    expect(shouldRetainIdempotencyKey(null)).toBe(true);
    expect(shouldRetainIdempotencyKey(401)).toBe(true);
    expect(shouldRetainIdempotencyKey(409)).toBe(true);
    expect(shouldRetainIdempotencyKey(429)).toBe(true);
    expect(shouldRetainIdempotencyKey(500)).toBe(true);
  });

  it("drops the key after success or a terminal client error", () => {
    expect(shouldRetainIdempotencyKey(201)).toBe(false);
    expect(shouldRetainIdempotencyKey(400)).toBe(false);
    expect(shouldRetainIdempotencyKey(404)).toBe(false);
  });
});

describe("mutationFailureMessage", () => {
  it("maps each injected status to a truthful recoverable sentence", () => {
    expect(
      mutationFailureMessage(401, {
        fallback: "Couldn't save — try again",
        unauthorized: "Sign in to capture thoughts",
      }),
    ).toBe("Sign in to capture thoughts");
    expect(
      mutationFailureMessage(409, { fallback: "Couldn't save — try again" }),
    ).toBe("That one changed somewhere else — reload and try again");
    expect(
      mutationFailureMessage(429, {
        fallback: "Couldn't save — try again",
        serverMessage: "Too many requests. Please retry shortly.",
      }),
    ).toBe("Too many requests. Please retry shortly.");
    expect(
      mutationFailureMessage(500, { fallback: "Couldn't save — try again" }),
    ).toBe("Couldn't save — try again");
    expect(
      mutationFailureMessage(null, {
        fallback: "Couldn't save — try again",
        offlineNow: true,
      }),
    ).toBe("You're offline — reconnect and try again");
  });
});
