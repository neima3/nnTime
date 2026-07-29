import Foundation

struct AuthCallback: Equatable, Sendable {
    let token: String

    static func parse(_ url: URL) -> AuthCallback? {
        guard
            let components = URLComponents(
                url: url,
                resolvingAgainstBaseURL: false
            ),
            components.user == nil,
            components.password == nil,
            components.port == nil,
            components.fragment == nil
        else {
            return nil
        }

        let isUniversalLink =
            components.scheme?.lowercased() == "https"
                && components.host?.lowercased() == "time.neima.me"
                && components.path == "/auth/callback"
        let isCustomScheme =
            components.scheme?.lowercased() == "kairo"
                && components.host?.lowercased() == "auth"
                && (components.path.isEmpty || components.path == "/")
        guard isUniversalLink || isCustomScheme else {
            return nil
        }

        guard
            let items = components.queryItems,
            items.count == 1,
            items[0].name == "token",
            let token = items[0].value,
            token.range(
                of: #"^[A-Za-z0-9_-]{1,512}$"#,
                options: .regularExpression
            ) != nil
        else {
            return nil
        }

        return AuthCallback(token: token)
    }
}
