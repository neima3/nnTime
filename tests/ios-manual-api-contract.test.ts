import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  extractManualApiInventory,
  validateManualApiContract,
} from "../scripts/ios-manual-api-contract.mjs";

const fixtureSpec = {
  paths: {
    "/widgets": { get: { operationId: "listWidgets" } },
    "/widgets/{id}": {
      get: { operationId: "getWidget" },
      patch: { operationId: "updateWidget" },
    },
  },
};

describe("manual Swift API contract inventory", () => {
  it("normalizes Swift interpolation against OpenAPI parameter names", () => {
    const source = `
      try await request("GET", "/api/v1/widgets", as: Page.self)
      try await request(
        "PATCH", "/api/v1/widgets/\\(widgetId)",
        body: ["name": name],
        as: Widget.self
      )
    `;

    expect(validateManualApiContract(source, fixtureSpec)).toEqual([]);
    expect(extractManualApiInventory(source).operations).toEqual([
      { method: "GET", path: "/widgets" },
      { method: "PATCH", path: "/widgets/{}" },
    ]);
  });

  it("rejects an undocumented method on a documented path", () => {
    const source = `
      try await request("DELETE", "/api/v1/widgets/\\(widgetId)", as: Empty.self)
    `;

    expect(validateManualApiContract(source, fixtureSpec)).toContain(
      "DELETE /widgets/{} is not documented in api/openapi.yaml",
    );
  });

  it("rejects direct URLRequest paths that are not documented", () => {
    const source = `
      var req = URLRequest(url: baseURL.appending(path: "/api/v1/private/export"))
    `;

    expect(validateManualApiContract(source, fixtureSpec)).toContain(
      "/private/export is not documented in api/openapi.yaml",
    );
  });

  it("fails closed when a request method is dynamic", () => {
    const source = `
      let method = "DELETE"
      try await request(method, "/api/v1/widgets", as: Empty.self)
    `;

    expect(validateManualApiContract(source, fixtureSpec)).toContain(
      "request call at line 3 must use a literal HTTP method",
    );
  });

  it("fails closed when a request path is dynamic", () => {
    const source = `
      let path = "/api/v1/widgets"
      try await request("GET", path, as: Page.self)
    `;

    expect(validateManualApiContract(source, fixtureSpec)).toContain(
      "request call at line 3 must use a literal path",
    );
  });

  it("covers every critical operation used by the shipping app", () => {
    const source = readFileSync(resolve("ios/App/API/KairoAPI.swift"), "utf8");
    const spec = parseYaml(
      readFileSync(resolve("api/openapi.yaml"), "utf8"),
    ) as { paths?: Record<string, Record<string, unknown>> };
    const inventory = extractManualApiInventory(source);

    expect(validateManualApiContract(source, spec)).toEqual([]);
    expect(inventory.operations).toEqual(
      expect.arrayContaining([
        { method: "GET", path: "/settings" },
        { method: "GET", path: "/day/{}" },
        { method: "POST", path: "/activities" },
        { method: "PATCH", path: "/activities/{}" },
        { method: "GET", path: "/tasks" },
        { method: "GET", path: "/search" },
        { method: "GET", path: "/stats" },
        { method: "POST", path: "/mood" },
        { method: "GET", path: "/routines" },
        { method: "GET", path: "/focus-sessions" },
        { method: "PATCH", path: "/focus-sessions/{}" },
      ]),
    );
    expect(inventory.operations).toHaveLength(19);
  });
});
