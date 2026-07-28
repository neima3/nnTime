// swift-tools-version: 6.0
// Phase 7A — iOS contract proof: Swift OpenAPI client generated from
// api/openapi.yaml, compiles in CI, golden decode/error/auth tests.
import PackageDescription

let package = Package(
    name: "Kairo",
    platforms: [
        .iOS("17.0"),
        .macOS("14.0")
    ],
    products: [
        .library(name: "KairoAPIClient", targets: ["KairoAPIClient"]),
    ],
    dependencies: [
        // Swift OpenAPI Generator — generates client code from the OpenAPI spec.
        .package(url: "https://github.com/apple/swift-openapi-generator", from: "1.6.0"),
        // Swift OpenAPI Runtime — runtime types for generated code.
        .package(url: "https://github.com/apple/swift-openapi-runtime", from: "1.7.0"),
        // Swift OpenAPI URLSession Client — HTTP transport.
        .package(url: "https://github.com/apple/swift-openapi-urlsession", from: "1.0.2"),
    ],
    targets: [
        .target(
            name: "KairoAPIClient",
            dependencies: [
                .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
                .product(name: "OpenAPIURLSession", package: "swift-openapi-urlsession"),
            ],
            path: "Sources/Kairo",
            plugins: [
                .plugin(name: "OpenAPIGenerator", package: "swift-openapi-generator"),
            ]
        ),
        .testTarget(
            name: "KairoTests",
            dependencies: ["KairoAPIClient"]
        ),
    ]
)
