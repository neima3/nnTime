/**
 * Behavioral SSRF tests for ICS fetch — redirect hops re-verify public targets (SEC-04).
 */
import dns from "node:dns/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  default: {
    lookup: vi.fn(),
  },
}));

import { fetchIcs } from "./calendar";

const lookup = vi.mocked(dns.lookup);

describe("fetchIcs redirect SSRF", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks a redirect whose target is a loopback literal", async () => {
    lookup.mockImplementation(async (hostname) => {
      if (hostname === "public-feed.test") {
        return [{ address: "93.184.216.34", family: 4 }] as never;
      }
      throw new Error(`unexpected lookup: ${String(hostname)}`);
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(null, {
          status: 302,
          headers: { Location: "http://127.0.0.1/secret.ics" },
        }),
      ),
    );

    await expect(fetchIcs("https://public-feed.test/feed.ics")).rejects.toThrow(
      /non-public address/i,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("blocks more than three redirects", async () => {
    lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);

    let hop = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        hop += 1;
        return new Response(null, {
          status: 302,
          headers: { Location: `https://public-feed.test/hop-${hop}.ics` },
        });
      }),
    );

    await expect(fetchIcs("https://public-feed.test/start.ics")).rejects.toThrow(
      /max redirects/i,
    );
    expect(hop).toBeGreaterThan(3);
  });
});
