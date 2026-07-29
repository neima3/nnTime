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
  "getAuthCapabilities",
  "createAppleAuthChallenge",
  "exchangeAppleCredential",
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

      private enum AuthEndpoint {
        case signIn
        case signOut

        var pathComponents: [String] {
          switch self {
          case .signIn: ["api", "auth", "sign-in", "email"]
          case .signOut: ["api", "auth", "sign-out"]
          }
        }
      }

      private func authRequest<T>(
        _ endpoint: AuthEndpoint,
        body: [String: String],
        as type: T.Type
      ) async throws {
        let url = endpoint.pathComponents.reduce(baseURL) {
          $0.appending(path: $1)
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(
          "application/json",
          forHTTPHeaderField: "Content-Type"
        )
        request.httpBody = try JSONEncoder().encode(body)
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
    expect(
      result.failures.some((failure) =>
        /^ios\/App\/Features\/Search\/SearchView\.swift:\d+ .*URLRequest/.test(
          failure,
        ),
      ),
    ).toBe(true);
  });

  it.each([
    "URLSession.shared.data(from: plannerURL)",
    "URLSession.shared.dataTask(with: plannerRequest)",
    "URLSession.shared.uploadTask(with: plannerRequest, from: body)",
    "URLSession.shared.download(from: plannerURL)",
    "URLSession.shared.downloadTask(with: plannerRequest)",
    "URLSession.shared.bytes(from: plannerURL)",
    "URLSession.shared.webSocketTask(with: plannerURL)",
    "URLSession.shared.dataTaskPublisher(for: plannerRequest)",
    "URLSession.shared.uploadTask(withStreamedRequest: plannerRequest)",
    "URLSession.shared.download(resumeFrom: resumeData)",
    "URLSession.shared.requestProducer(for: plannerRequest)",
  ])("rejects manual URLSession primitive %s", (primitive) => {
    const result = validate([
      {
        path: "ios/App/API/KairoAPI.swift",
        source: facadeSource(),
      },
      {
        path: "ios/App/Features/Search/SearchView.swift",
        source: `_ = ${primitive}`,
      },
    ]);

    expect(result.failures).toContain(
      "ios/App/Features/Search/SearchView.swift contains manual URLSession transport outside KairoAPI.authRequest",
    );
    const member = /shared\.([A-Za-z_][A-Za-z0-9_]*)/.exec(
      primitive,
    )?.[1];
    expect(
      result.failures.some(
        (failure) =>
          failure.includes(
            "ios/App/Features/Search/SearchView.swift:1",
          ) &&
          failure.includes(`URLSession.${member}`),
      ),
    ).toBe(true);
  });

  it("does not confuse ActivityKit request calls with manual network transport", () => {
    expect(
      validate([
        {
          path: "ios/App/API/KairoAPI.swift",
          source: facadeSource(),
        },
        {
          path: "ios/App/Features/Focus/FocusView.swift",
          source:
            "liveActivity = try ActivityKit.Activity<FocusAttributes>.request(attributes: attributes)",
        },
      ]).failures,
    ).toEqual([]);
  });

  it("allows pure domain request declarations and calls", () => {
    expect(
      validate([
        {
          path: "ios/App/API/KairoAPI.swift",
          source: facadeSource(),
        },
        {
          path: "ios/App/Domain/ApprovalQueue.swift",
          source: `
            struct ApprovalQueue {
              func request(_ identifier: String) -> Bool {
                !identifier.isEmpty
              }

              func approve(_ identifier: String) -> Bool {
                request(identifier)
              }
            }
          `,
        },
      ]).failures,
    ).toEqual([]);
  });

  it("allows benign URLSession construction and lifecycle controls", () => {
    expect(
      validate([
        {
          path: "ios/App/API/KairoAPI.swift",
          source: facadeSource(),
        },
        {
          path: "ios/App/Services/SessionOwner.swift",
          source: `
            let session = URLSession(configuration: .ephemeral)
            session.finishTasksAndInvalidate()
            session.invalidateAndCancel()
          `,
        },
      ]).failures,
    ).toEqual([]);
  });

  it("rejects request calls through fixed-point URLSession aliases", () => {
    const result = validate([
      {
        path: "ios/App/API/KairoAPI.swift",
        source: facadeSource(),
      },
      {
        path: "ios/App/Services/AliasedTransport.swift",
        source: `
          let primary: URLSession = .shared
          let firstAlias = primary
          let secondAlias = firstAlias
          _ = secondAlias.requestProducer(for: plannerRequest)
        `,
      },
    ]);

    expect(result.failures).toContain(
      "ios/App/Services/AliasedTransport.swift contains manual URLSession transport outside KairoAPI.authRequest",
    );
  });

  it.each([
    [
      "Foundation-qualified inferred receiver",
      `
        let client = Foundation.URLSession.shared
        _ = client.data(from: plannerURL)
      `,
    ],
    [
      "same-file qualified optional typealias chain",
      `
        typealias HTTPTransport = Foundation.URLSession
        typealias OptionalHTTPTransport = HTTPTransport?
        func run(_ client: OptionalHTTPTransport) {
          _ = client?.dataTask(with: plannerRequest)
        }
      `,
    ],
  ])("rejects %s", (_label, source) => {
    const result = validate([
      {
        path: "ios/App/API/KairoAPI.swift",
        source: facadeSource(),
      },
      {
        path: "ios/App/Services/TypealiasedTransport.swift",
        source,
      },
    ]);

    expect(result.failures).toContain(
      "ios/App/Services/TypealiasedTransport.swift contains manual URLSession transport outside KairoAPI.authRequest",
    );
  });

  it.each([
    [
      "instance",
      "let transportSession: URLSession = .shared",
      "self.transportSession",
    ],
    [
      "static",
      "static let staticSession: URLSession = .shared",
      "Self.staticSession",
    ],
  ])(
    "rejects request calls through a same-file %s URLSession property alias",
    (_label, property, initializer) => {
      const result = validate([
        {
          path: "ios/App/API/KairoAPI.swift",
          source: facadeSource(),
        },
        {
          path: "ios/App/Services/QualifiedAliasTransport.swift",
          source: `
            final class SessionOwner {
              ${property}

              func run() {
                let transport = ${initializer}
                _ = transport.data(from: plannerURL)
              }
            }
          `,
        },
      ]);

      expect(result.failures).toContain(
        "ios/App/Services/QualifiedAliasTransport.swift contains manual URLSession transport outside KairoAPI.authRequest",
      );
    },
  );

  it("rejects request calls through a current-file URLSession factory result", () => {
    const result = validate([
      {
        path: "ios/App/API/KairoAPI.swift",
        source: facadeSource(),
      },
      {
        path: "ios/App/Services/FactoryTransport.swift",
        source: `
          private func makeSession() -> URLSession {
            URLSession.shared
          }
          let transport = makeSession()
          _ = transport.data(from: plannerURL)
        `,
      },
    ]);

    expect(result.failures).toContain(
      "ios/App/Services/FactoryTransport.swift contains manual URLSession transport outside KairoAPI.authRequest",
    );
  });

  it("rejects an untyped session-like factory binding with unknown provenance", () => {
    const result = validate([
      {
        path: "ios/App/API/KairoAPI.swift",
        source: facadeSource(),
      },
      {
        path: "ios/App/Services/AmbiguousTransport.swift",
        source: `
          let requestSession = makeTransport()
          requestSession.finishTasksAndInvalidate()
        `,
      },
    ]);

    expect(result.failures).toContain(
      "ios/App/Services/AmbiguousTransport.swift contains an ambiguous session-like binding without an explicit non-network type",
    );
  });

  it("rejects URLSession calls through explicitly typed function and closure parameters", () => {
    const result = validate([
      {
        path: "ios/App/API/KairoAPI.swift",
        source: facadeSource(),
      },
      {
        path: "ios/App/Services/ParameterTransport.swift",
        source: `
          func run(_ client: URLSession) {
            _ = client.requestProducer(for: plannerRequest)
          }
          let closure = { (transport: URLSession) in
            _ = transport.dataTaskPublisher(for: plannerRequest)
          }
        `,
      },
    ]);

    expect(result.failures).toContain(
      "ios/App/Services/ParameterTransport.swift contains manual URLSession transport outside KairoAPI.authRequest",
    );
  });

  it.each([
    [
      "optional",
      "client: URLSession?",
      "client?.data(from: plannerURL)",
    ],
    [
      "implicitly unwrapped optional",
      "client: URLSession!",
      "client!.dataTask(with: plannerRequest)",
    ],
  ])(
    "rejects calls through an explicitly typed %s URLSession receiver",
    (_label, declaration, call) => {
      const result = validate([
        {
          path: "ios/App/API/KairoAPI.swift",
          source: facadeSource(),
        },
        {
          path: "ios/App/Services/OptionalTransport.swift",
          source: `
            func run(${declaration}) {
              _ = ${call}
            }
          `,
        },
      ]);

      expect(result.failures).toContain(
        "ios/App/Services/OptionalTransport.swift contains manual URLSession transport outside KairoAPI.authRequest",
      );
    },
  );

  it("allows an explicitly non-network session-like local type", () => {
    expect(
      validate([
        {
          path: "ios/App/API/KairoAPI.swift",
          source: facadeSource(),
        },
        {
          path: "ios/App/Services/PlaybackSession.swift",
          source: `
            let session: PlaybackSession = PlaybackSession()
            session.finishTasksAndInvalidate()
          `,
        },
      ]).failures,
    ).toEqual([]);
  });

  it("ignores transport spellings and braces inside comments and strings", () => {
    const source = facadeSource(
      requiredOperations,
      `
        // func authRequest(_ path: String) { URLSession.shared.data(from: url) }
        let diagnostic = "URLRequest(url: plannerURL) } dataTask(with: request)"
      `,
    );

    expect(
      validate([
        {
          path: "ios/App/API/KairoAPI.swift",
          source,
        },
      ]).failures,
    ).toEqual([]);
  });

  it("keeps the proven auth range scoped across nested closures", () => {
    const nestedAuth = facadeSource(
      requiredOperations,
      `
        func escapedTransport(url: URL) async throws {
          let request = URLRequest(url: url)
          _ = try await URLSession.shared.data(for: request)
        }
      `,
    ).replace(
      "let url = endpoint.pathComponents.reduce(baseURL)",
      `
        let resolveBaseURL = {
          { () -> URL in
            let misleadingBrace = "}"
            return baseURL
          }()
        }
        _ = resolveBaseURL()
        let url = endpoint.pathComponents.reduce(baseURL)
      `,
    );

    const result = validate([
      {
        path: "ios/App/API/KairoAPI.swift",
        source: nestedAuth,
      },
    ]);
    expect(result.failures).toContain(
      "ios/App/API/KairoAPI.swift contains manual URLRequest transport outside KairoAPI.authRequest",
    );
    expect(result.failures).toContain(
      "ios/App/API/KairoAPI.swift contains manual URLSession transport outside KairoAPI.authRequest",
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

  it("rejects an authRequest boundary that accepts a dynamic path", () => {
    const dynamicAuthRequest = facadeSource()
      .replace("_ endpoint: AuthEndpoint", "_ path: String")
      .replace(
        "endpoint.pathComponents.reduce(baseURL)",
        "pathComponents(path).reduce(baseURL)",
      );
    const result = validate([
      {
        path: "ios/App/API/KairoAPI.swift",
        source: dynamicAuthRequest,
      },
    ]);

    expect(result.failures).toContain(
      "KairoAPI manual auth transport must use a closed AuthEndpoint-based authRequest boundary",
    );
  });

  it.each([
    ["request URL reassignment", "request.url = configuredPlannerURL"],
    ["request reassignment", "request = configuredPlannerRequest"],
    [
      "request URL member mutation",
      'request.url?.append(path: "api")',
    ],
    ["request URL inout mutation", "retarget(&request.url)"],
    ["request inout mutation", "retarget(&request)"],
    ["request method reassignment", 'request.httpMethod = "GET"'],
    [
      "request body member mutation",
      "request.httpBody?.append(contentsOf: plannerPayload)",
    ],
  ])("rejects auth %s", (_label, mutation) => {
    const mutatedRequest = facadeSource().replace(
      "_ = try await authSession.data(for: request)",
      `${mutation}
        _ = try await authSession.data(for: request)`,
    );
    const result = validate([
      {
        path: "ios/App/API/KairoAPI.swift",
        source: mutatedRequest,
      },
    ]);

    expect(result.failures).toContain(
      "KairoAPI manual auth transport must use a closed AuthEndpoint-based authRequest boundary",
    );
  });

  it("rejects a discarded safe reduction followed by a dynamic url binding", () => {
    const disconnectedURL = facadeSource().replace(
      "let url = endpoint.pathComponents.reduce(baseURL) {\n          $0.appending(path: $1)\n        }",
      `
        _ = endpoint.pathComponents.reduce(baseURL) {
          $0.appending(path: $1)
        }
        let url = configuredPlannerURL
      `,
    );
    const result = validate([
      {
        path: "ios/App/API/KairoAPI.swift",
        source: disconnectedURL,
      },
    ]);

    expect(result.failures).toContain(
      "KairoAPI manual auth transport must use a closed AuthEndpoint-based authRequest boundary",
    );
  });

  it.each([
    [
      "reassigned",
      `
        var url = endpoint.pathComponents.reduce(baseURL) {
          $0.appending(path: $1)
        }
        url = configuredPlannerURL
      `,
    ],
    [
      "mutated",
      `
        var url = endpoint.pathComponents.reduce(baseURL) {
          $0.appending(path: $1)
        }
        url.append(path: "api")
      `,
    ],
  ])("rejects a %s auth url binding", (_label, urlBinding) => {
    const mutatedURL = facadeSource().replace(
      "let url = endpoint.pathComponents.reduce(baseURL) {\n          $0.appending(path: $1)\n        }",
      urlBinding,
    );
    const result = validate([
      {
        path: "ios/App/API/KairoAPI.swift",
        source: mutatedURL,
      },
    ]);

    expect(result.failures).toContain(
      "KairoAPI manual auth transport must use a closed AuthEndpoint-based authRequest boundary",
    );
  });

  it("rejects an AuthEndpoint path that can target the planner API", () => {
    const plannerCapableEndpoint = facadeSource().replace(
      'case .signOut: ["api", "auth", "sign-out"]',
      'case .signOut: ["api", "v1", "settings"]',
    );
    const result = validate([
      {
        path: "ios/App/API/KairoAPI.swift",
        source: plannerCapableEndpoint,
      },
    ]);

    expect(result.failures).toContain(
      "KairoAPI AuthEndpoint.pathComponents must contain only closed /api/auth/* paths",
    );
  });

  it("rejects a dynamic AuthEndpoint path branch", () => {
    const dynamicEndpoint = facadeSource()
      .replace("case signOut", "case signOut\n        case dynamic")
      .replace(
        'case .signOut: ["api", "auth", "sign-out"]',
        'case .signOut: ["api", "auth", "sign-out"]\n          case .dynamic: dynamicPathComponents',
      );
    const result = validate([
      {
        path: "ios/App/API/KairoAPI.swift",
        source: dynamicEndpoint,
      },
    ]);

    expect(result.failures).toContain(
      "KairoAPI AuthEndpoint.pathComponents must contain only closed /api/auth/* paths",
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
