import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthCapabilities: vi.fn(),
}));

vi.mock("@/server/auth-capabilities", () => ({
  getAuthCapabilities: mocks.getAuthCapabilities,
}));

import { GET } from "./route";

describe("GET /api/v1/auth/capabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthCapabilities.mockReturnValue({
      magicLink: true,
      apple: false,
      google: true,
    });
  });

  it("returns only public availability flags without caching", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      magicLink: true,
      apple: false,
      google: true,
    });
    expect(response.headers.get("cache-control")).toBe("public, no-store");
    expect(mocks.getAuthCapabilities).toHaveBeenCalledWith(process.env);
  });
});
