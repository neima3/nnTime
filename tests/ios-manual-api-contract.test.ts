import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

type AdoptionModule = {
  REQUIRED_GENERATED_OPERATIONS?: readonly string[];
  collectShippingSwiftSources?: (
    appRoot: string,
  ) => Array<{ path: string; source: string }>;
  extractGeneratedOperationInventory?: (source: string) => string[];
  validateGeneratedClientAdoption?: (input: {
    sources: Array<{ path: string; source: string }>;
    spec: unknown;
    project: unknown;
  }) => { failures: string[]; operationIDs: string[] };
};

const adoption = (await import(
  "../scripts/ios-manual-api-contract.mjs"
)) as AdoptionModule;

const requiredOperations = [
  "getUserSettings",
  "updateUserSettings",
  "listCategories",
  "getDay",
  "createActivitySeries",
  "updateActivitySeries",
  "deleteActivitySeries",
  "listTasks",
  "createTask",
  "deleteTask",
  "search",
  "getStats",
  "createMoodCheckin",
  "listRoutines",
  "getActiveFocusSession",
  "startFocusSession",
  "updateFocusSession",
] as const;

const fixtureSpec = {
  paths: Object.fromEntries(
    requiredOperations.map((operationId) => [
      `/${operationId}`,
      { get: { operationId } },
    ]),
  ),
};

const fixtureProject = {
  packages: {
    KairoAPIClient: { path: "Kairo" },
  },
  targets: {
    Kairo: {
      dependencies: [
        { package: "KairoAPIClient", product: "KairoAPIClient" },
      ],
    },
  },
};

function facadeSource(
  operations: readonly string[] = requiredOperations,
  extra = "",
) {
  return `
    import Foundation
    import KairoAPIClient

    actor KairoAPI {
      private let planner: KairoAPIClient.Client
      private let authSession: URLSession

      private func authRequest() async throws {
        let url = URL(string: "https://time.neima.me/api/auth/sign-out")!
        let request = URLRequest(url: url)
        _ = try await authSession.data(for: request)
      }

      func plannerCalls() async throws {
        ${operations.map((operation) => `_ = try await planner.${operation}()`).join("\n")}
      }

      ${extra}
    }
  `;
}

function validate(
  sources: Array<{ path: string; source: string }>,
  project: unknown = fixtureProject,
) {
  const validator = adoption.validateGeneratedClientAdoption;
  expect(validator).toBeTypeOf("function");
  if (!validator) return { failures: ["validator missing"], operationIDs: [] };
  return validator({ sources, spec: fixtureSpec, project });
}

describe("generated Swift client adoption gate", () => {
  it("exports the complete current shipping operation inventory, including categories", () => {
    expect(adoption.REQUIRED_GENERATED_OPERATIONS).toEqual(requiredOperations);
    expect(adoption.REQUIRED_GENERATED_OPERATIONS).toContain("listCategories");
  });

  it("extracts generated operations from the shipping facade", () => {
    const extract = adoption.extractGeneratedOperationInventory;
    expect(extract).toBeTypeOf("function");
    if (!extract) return;

    expect(extract(facadeSource())).toEqual(requiredOperations);
  });

  it("rejects a planner path literal in any shipping application source", () => {
    const result = validate([
      {
        path: "ios/App/API/KairoAPI.swift",
        source: facadeSource(),
      },
      {
        path: "ios/App/Features/Today/TodayView.swift",
        source: `let path = "/api/v1/day/2026-07-28"`,
      },
    ]);

    expect(result.failures).toContain(
      "ios/App/Features/Today/TodayView.swift contains a handwritten /api/v1 path",
    );
  });

  it("fails closed on a direct URLRequest even when its planner URL is dynamic", () => {
    const result = validate([
      {
        path: "ios/App/API/KairoAPI.swift",
        source: facadeSource(),
      },
      {
        path: "ios/App/Features/Search/SearchView.swift",
        source: `
          let plannerURL = configuredPlannerURL
          let request = URLRequest(url: plannerURL)
          _ = try await URLSession.shared.data(for: request)
        `,
      },
    ]);

    expect(result.failures).toContain(
      "ios/App/Features/Search/SearchView.swift contains manual URLRequest transport outside KairoAPI.authRequest",
    );
  });

  it("allows Better Auth transport only inside the facade authRequest function", () => {
    expect(
      validate([
        {
          path: "ios/App/API/KairoAPI.swift",
          source: facadeSource(),
        },
      ]).failures,
    ).toEqual([]);

    const escaped = validate([
      {
        path: "ios/App/API/KairoAPI.swift",
        source: facadeSource(
          requiredOperations,
          `
            func handwrittenPlannerRequest(url: URL) async throws {
              let request = URLRequest(url: url)
              _ = try await authSession.data(for: request)
            }
          `,
        ),
      },
    ]);
    expect(escaped.failures).toContain(
      "ios/App/API/KairoAPI.swift contains manual URLRequest transport outside KairoAPI.authRequest",
    );
  });

  it("fails when any required generated operation disappears from the facade", () => {
    const withoutCategories = requiredOperations.filter(
      (operation) => operation !== "listCategories",
    );
    const result = validate([
      {
        path: "ios/App/API/KairoAPI.swift",
        source: facadeSource(withoutCategories),
      },
    ]);

    expect(result.failures).toContain(
      "KairoAPI generated-operation inventory is missing listCategories",
    );
  });

  it("does not let comments or strings satisfy the required operation inventory", () => {
    const withoutCategories = requiredOperations.filter(
      (operation) => operation !== "listCategories",
    );
    const result = validate([
      {
        path: "ios/App/API/KairoAPI.swift",
        source: facadeSource(
          withoutCategories,
          `
            // _ = try await planner.listCategories()
            let misleading = "planner.listCategories()"
          `,
        ),
      },
    ]);

    expect(result.failures).toContain(
      "KairoAPI generated-operation inventory is missing listCategories",
    );
  });

  it("rejects generated facade operations absent from the canonical spec", () => {
    const result = validate([
      {
        path: "ios/App/API/KairoAPI.swift",
        source: facadeSource(requiredOperations, `
          func unknown() async throws {
            _ = try await planner.undocumentedPlannerCall()
          }
        `),
      },
    ]);

    expect(result.failures).toContain(
      "KairoAPI generated operation undocumentedPlannerCall is absent from api/openapi.yaml",
    );
  });

  it("requires the app's generated module import and local package dependency", () => {
    const noImport = facadeSource().replace("import KairoAPIClient", "");
    expect(
      validate([
        { path: "ios/App/API/KairoAPI.swift", source: noImport },
      ]).failures,
    ).toContain("KairoAPI.swift must import KairoAPIClient");

    expect(
      validate(
        [
          {
            path: "ios/App/API/KairoAPI.swift",
            source: facadeSource(),
          },
        ],
        { targets: { Kairo: { dependencies: [] } } },
      ).failures,
    ).toContain(
      "ios/project.yml must link the KairoAPIClient product to the Kairo app target",
    );
  });

  it("passes the real shipping application and canonical contract", () => {
    const spec = parseYaml(
      readFileSync(resolve("api/openapi.yaml"), "utf8"),
    );
    const project = parseYaml(
      readFileSync(resolve("ios/project.yml"), "utf8"),
    );
    const collect = adoption.collectShippingSwiftSources;
    expect(collect).toBeTypeOf("function");
    if (!collect) return;
    const sources = collect(resolve("ios/App"));
    expect(sources.length).toBeGreaterThan(20);

    const result = adoption.validateGeneratedClientAdoption?.({
      sources,
      spec,
      project,
    });
    expect(result?.failures).toEqual([]);
    expect(result?.operationIDs).toEqual(requiredOperations);
  });
});
